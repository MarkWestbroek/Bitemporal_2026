package handlers

// Stap 10: hoofdlijn, onderhoudslijnen en terugmergen (studio_versiegraaf.go).

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestBeoordeelNieuweVersie(t *testing.T) {
	bestaand := []string{"0.3.0", "0.4.0", "0.5.0"}
	gevallen := []struct {
		nieuw, lijn, ouder, reden string
	}{
		{"0.6.0", LijnHoofd, "0.5.0", ""},
		{"1.0.0", LijnHoofd, "0.5.0", ""},
		{"0.5.1", LijnHoofd, "0.5.0", ""}, // hoger dan alles: gewoon de hoofdlijn
		{"0.4.1", LijnOnderhoud, "0.4.0", ""},
		{"0.3.7", LijnOnderhoud, "0.3.0", ""},
		{"0.4.0", "", "", "versie_niet_hoger"}, // bestaat
		{"0.2.1", "", "", "versie_niet_hoger"}, // lijn 0.2 heeft geen versie
	}
	for _, g := range gevallen {
		lijn, ouder, reden, _ := beoordeelNieuweVersie(g.nieuw, bestaand)
		if lijn != g.lijn || ouder != g.ouder || reden != g.reden {
			t.Errorf("%s: lijn %q ouder %q reden %q", g.nieuw, lijn, ouder, reden)
		}
	}
	// Binnen een onderhoudslijn: hoger dan de hoogste in die lijn.
	if _, _, reden, _ := beoordeelNieuweVersie("0.4.1", []string{"0.4.0", "0.4.2", "0.5.0"}); reden == "" {
		t.Error("0.4.1 onder 0.4.2: geweigerd verwacht")
	}
	if lijn, ouder, _, _ := beoordeelNieuweVersie("0.4.3", []string{"0.4.0", "0.4.2", "0.5.0"}); lijn != LijnOnderhoud || ouder != "0.4.2" {
		t.Errorf("0.4.3: %s %s", lijn, ouder)
	}
	if lijn, ouder, reden, _ := beoordeelNieuweVersie("1.0.0", nil); lijn != LijnHoofd || ouder != "" || reden != "" {
		t.Errorf("eerste: %s %s %s", lijn, ouder, reden)
	}

	bestaat := map[string]bool{"0.4.1": true, "0.5.0": true}
	if msg := controleerOuders("0.6.0", []string{"0.5.0", "0.4.1"}, bestaat); msg != "" {
		t.Errorf("merge: %s", msg)
	}
	for _, fout := range [][]string{{"0.9.0"}, {"0.5.0", "0.5.0"}, {"0.5.0", "0.4.1", "0.4.1"}} {
		if controleerOuders("0.6.0", fout, bestaat) == "" {
			t.Errorf("%v: geweigerd verwacht", fout)
		}
	}
	if controleerOuders("0.4.1", []string{"0.5.0"}, bestaat) == "" {
		t.Error("een ouder hoger dan de nieuwe versie: geweigerd verwacht")
	}
}

func TestStudioCentraal_OnderhoudEnMerge(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	t.Setenv("CENTRAAL_URL", "")
	_, _ = db.NewDelete().Model((*model.StudioProjectUitgave)(nil)).Where("soort = 'profielen'").Exec(t.Context())
	r := centraalRouter()

	maak := func(id string) {
		if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": id, "naam": id, "inhoud": sidecarInhoud("0.4.0")}); rec.Code != http.StatusCreated {
			t.Fatalf("aanmaken %s: %d %s", id, rec.Code, rec.Body.String())
		}
	}
	breng := func(id, versie string, ouders ...string) (int, string) {
		body := map[string]any{"versie": versie, "inhoud": sidecarInhoud(versie), "totVolgnummer": 0}
		if len(ouders) > 0 {
			body["ouders"] = ouders
		}
		rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/"+id+"/uitbrengen", body)
		return rec.Code, rec.Body.String()
	}
	maak("test-graaf-hoofd")
	maak("test-graaf-04")
	for _, v := range []string{"0.4.0", "0.5.0"} {
		if code, b := breng("test-graaf-hoofd", v); code != 201 {
			t.Fatalf("%s: %d %s", v, code, b)
		}
	}
	// De hoofdlijn uit een ander project: geweigerd.
	if code, b := breng("test-graaf-04", "0.6.0"); code != 409 || !strings.Contains(b, "ander_project") {
		t.Fatalf("hoofdlijn uit onderhoudsproject: %d %s", code, b)
	}
	// Onderhoud op 0.4 uit het onderhoudsproject: ouder 0.4.0.
	code, b := breng("test-graaf-04", "0.4.1")
	if code != 201 || !strings.Contains(b, `"lijn":"onderhoud"`) || !strings.Contains(strings.ReplaceAll(b, " ", ""), `"ouders":[{"versie":"0.4.0"}]`) {
		t.Fatalf("0.4.1: %d %s", code, b)
	}
	// Terugmergen: 0.6.0 met ouders 0.5.0 en 0.4.1.
	code, b = breng("test-graaf-hoofd", "0.6.0", "0.5.0", "0.4.1")
	if code != 201 || !strings.Contains(b, `"lijn":"hoofd"`) {
		t.Fatalf("0.6.0: %d %s", code, b)
	}
	var u struct {
		Ouders []uitgaveOuder `json:"ouders"`
	}
	_ = json.Unmarshal([]byte(b), &u)
	if len(u.Ouders) != 2 || u.Ouders[0].Versie != "0.5.0" || u.Ouders[1].Versie != "0.4.1" {
		t.Fatalf("ouders 0.6.0: %+v", u.Ouders)
	}
	// Een nieuwe lijn onder de hoofdlijn zonder uitgebrachte versie: geweigerd.
	if code, b := breng("test-graaf-04", "0.3.1"); code != 409 {
		t.Fatalf("0.3.1: %d %s", code, b)
	}
}
