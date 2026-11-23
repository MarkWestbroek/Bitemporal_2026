package handlers

// Stap 8: klantaanpassingen als delta (studio_klantaanpassing.go).

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func delta(soort, basis string, eenheden int) json.RawMessage {
	e := make([]map[string]any, eenheden)
	for i := range e {
		e[i] = map[string]any{"soort": "element", "profielId": "m3Profiel05", "id": "x", "waarde": map[string]any{"naam": "X"}}
	}
	b, _ := json.Marshal(map[string]any{"formaat": "studio-klantdelta", "soort": soort, "basisVersie": basis, "eenheden": e})
	return b
}

func TestValideerKlantAanpassing(t *testing.T) {
	goed := func() *klantAanpassingInvoer {
		return &klantAanpassingInvoer{Klant: "test-gemeente", Soort: "profielen", Versie: "1.0.0", BasisVersie: "1.0.0", Delta: delta("profielen", "1.0.0", 2)}
	}
	if n, msg := valideerKlantAanpassing(goed()); msg != "" || n != 2 {
		t.Fatalf("goed: %d %q", n, msg)
	}
	fout := map[string]func(i *klantAanpassingInvoer){
		"klant":        func(i *klantAanpassingInvoer) { i.Klant = "Gemeente X" },
		"soort":        func(i *klantAanpassingInvoer) { i.Soort = "model" },
		"versie":       func(i *klantAanpassingInvoer) { i.Versie = "1.0" },
		"formaat":      func(i *klantAanpassingInvoer) { i.Delta = json.RawMessage(`{"formaat":"x"}`) },
		"basis anders": func(i *klantAanpassingInvoer) { i.Delta = delta("profielen", "0.9.0", 1) },
	}
	for naam, wijzig := range fout {
		in := goed()
		wijzig(in)
		if _, msg := valideerKlantAanpassing(in); msg == "" {
			t.Errorf("%s: geen melding", naam)
		}
	}
}

func TestStudioKlantAanpassing_VastleggenEnLezen(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	t.Setenv("CENTRAAL_URL", "")
	ctx := t.Context()
	_, _ = db.NewDelete().Model((*model.StudioProjectUitgave)(nil)).Where("soort = 'profielen'").Exec(ctx)
	_, _ = db.NewDelete().Model((*model.StudioKlantAanpassing)(nil)).Where("klant LIKE 'test-%'").Exec(ctx)

	gin.SetMode(gin.TestMode)
	r := centraalRouter()
	r.POST("/api/studio/klantaanpassingen", MaakStudioKlantAanpassingVastleggenHandler())
	r.GET("/api/studio/klantaanpassingen", MaakStudioKlantAanpassingenLijstHandler())
	r.GET("/api/studio/klantaanpassingen/:klant/:soort/:versie", MaakStudioKlantAanpassingOphalenHandler())

	leg := func(versie, basis string, n int) (int, string) {
		rec := studioDoe(r, http.MethodPost, "/api/studio/klantaanpassingen", map[string]any{
			"klant": "test-gemeente", "soort": "profielen", "versie": versie, "basisVersie": basis, "delta": delta("profielen", basis, n), "notitie": "eigen kleur"})
		return rec.Code, rec.Body.String()
	}
	// Zonder uitgebrachte basisversie: 404.
	if code, b := leg("1.0.0", "1.0.0", 1); code != http.StatusNotFound {
		t.Fatalf("zonder basis: %d %s", code, b)
	}
	// De basis uitbrengen (zoals in stap 5).
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-centraal-p", "naam": "Profielen", "inhoud": sidecarInhoud("1.0.0")}); rec.Code != http.StatusCreated {
		t.Fatalf("project: %d %s", rec.Code, rec.Body.String())
	}
	for _, v := range []string{"1.0.0", "1.1.0"} {
		if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-centraal-p/uitbrengen", map[string]any{"versie": v, "inhoud": sidecarInhoud(v), "totVolgnummer": 0}); rec.Code != http.StatusCreated {
			t.Fatalf("uitbrengen %s: %d %s", v, rec.Code, rec.Body.String())
		}
	}
	if code, b := leg("1.0.0", "1.0.0", 2); code != http.StatusCreated || strings.Contains(b, `"delta"`) || !strings.Contains(b, `"eenheden":2`) || !strings.Contains(b, `"ouders":[]`) {
		t.Fatalf("eerste: %d %s", code, b)
	}
	if code, b := leg("1.0.0", "1.1.0", 1); code != http.StatusConflict || !strings.Contains(b, "versie_niet_hoger") {
		t.Fatalf("niet hoger: %d %s", code, b)
	}
	// Op de nieuwe basis gezet: een nieuwe versie, met de vorige als ouder; de delta kromp.
	if code, b := leg("1.1.0", "1.1.0", 1); code != http.StatusCreated || !strings.Contains(b, `"versie":"1.0.0"`) {
		t.Fatalf("tweede: %d %s", code, b)
	}
	rec := studioDoe(r, http.MethodGet, "/api/studio/klantaanpassingen", nil)
	if rec.Code != http.StatusOK || strings.Count(rec.Body.String(), `"klant":"test-gemeente"`) != 2 || strings.Contains(rec.Body.String(), `"delta"`) {
		t.Fatalf("lijst: %d %s", rec.Code, rec.Body.String())
	}
	rec = studioDoe(r, http.MethodGet, "/api/studio/klantaanpassingen/test-gemeente/profielen/1.1.0", nil)
	var rij model.StudioKlantAanpassing
	_ = json.Unmarshal(rec.Body.Bytes(), &rij)
	if rec.Code != http.StatusOK || rij.BasisVersie != "1.1.0" || !strings.Contains(string(rij.Delta), "studio-klantdelta") {
		t.Fatalf("ophalen: %d %s", rec.Code, rec.Body.String())
	}
	if rec = studioDoe(r, http.MethodGet, "/api/studio/klantaanpassingen/test-gemeente/profielen/9.9.9", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("onbekend: %d", rec.Code)
	}
}
