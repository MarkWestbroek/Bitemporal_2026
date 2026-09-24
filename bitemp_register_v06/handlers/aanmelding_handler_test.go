package handlers

import (
	"strings"
	"testing"
	"time"
)

func laagOpvoer(veldnaam string, payload map[string]any) aanmeldingWijziging {
	return aanmeldingWijziging{"opvoer": {veldnaam: payload}}
}

func TestVeldnamenVanDoeltype_InitiatiefBevatGEsEnRelaties(t *testing.T) {
	v, err := veldnamenVanDoeltype("Initiatief")
	if err != nil {
		t.Fatal(err)
	}
	for _, k := range []string{"initiatief", "product", "aanmeldstatus", "initiatieforganisatie", "initiatief_aanvang"} {
		if !v[k] {
			t.Fatalf("%s ontbreekt in %v", k, aanmeldingVeldnamenGesorteerd(v))
		}
	}
	if v["organisatie"] {
		t.Fatal("organisatie hoort niet bij Initiatief")
	}
	if _, err := veldnamenVanDoeltype("Initiatief_Product"); err == nil {
		t.Fatal("een GE is geen doeltype")
	}
}

func TestVasteWaardenVanLayout_TopLevelAlleen(t *testing.T) {
	layout := map[string]any{"type": "formulier", "elementen": []any{
		map[string]any{"type": "veld", "veld": "Initiatief.aanmeldstatussen.status", "vasteWaarde": "nieuwe_aanmelding"},
		map[string]any{"type": "lijst", "bron": "Initiatief.bijdragen", "elementen": []any{
			map[string]any{"type": "veld", "veld": "type_bijdrage", "vasteWaarde": "Regie"},
		}},
	}}
	vaste := vasteWaardenVanLayout(layout, "Initiatief")
	if len(vaste) != 1 || vaste[0].GEVeldnaam != "aanmeldstatus" || vaste[0].Kolom != "status" || vaste[0].Waarde != "nieuwe_aanmelding" {
		t.Fatalf("vaste = %+v", vaste)
	}
	if ids := subFormulierIDs(map[string]any{"type": "formulier", "elementen": []any{map[string]any{"type": "veld", "veld": "x", "nieuwFormulier": "3"}}}); len(ids) != 1 || ids[0] != 3 {
		t.Fatalf("subFormulierIDs = %v", ids)
	}
}

func TestValideerAanmelding_ZetVasteWaardeEnWeigertBestaandeRecords(t *testing.T) {
	toegestaan, _ := veldnamenVanDoeltype("Initiatief")
	org, _ := veldnamenVanDoeltype("Organisatie")
	for k := range org {
		toegestaan[k] = true
	}
	vaste := []vasteWaarde{{GEVeldnaam: "aanmeldstatus", Kolom: "status", Waarde: "nieuwe_aanmelding"}}

	goed := []aanmeldingWijziging{
		laagOpvoer("initiatief", map[string]any{"id": "$nieuw.initiatief"}),
		laagOpvoer("organisatie", map[string]any{"id": "$nieuw.org"}),
		laagOpvoer("organisatienaam", map[string]any{"organisatie_id": "$nieuw.org", "naam": "X"}),
		laagOpvoer("product", map[string]any{"initiatief_id": "$nieuw.initiatief", "naam": "P"}),
		laagOpvoer("aanmeldstatus", map[string]any{"initiatief_id": "$nieuw.initiatief", "status": "geaccepteerd"}),
		laagOpvoer("initiatieforganisatie", map[string]any{"initiatief_id": "$nieuw.initiatief", "organisatie_id": 5, "rol": "Contactorganisatie"}),
	}
	uit, hoofd, err := valideerAanmelding(goed, "Initiatief", toegestaan, vaste)
	if err != nil {
		t.Fatal(err)
	}
	if hoofd != "$nieuw.initiatief" {
		t.Fatalf("hoofd = %s", hoofd)
	}
	if uit[4]["opvoer"]["aanmeldstatus"]["status"] != "nieuwe_aanmelding" {
		t.Fatalf("vaste waarde niet afgedwongen: %v", uit[4])
	}

	// Zonder aanmeldstatus in de inzending wordt hij toegevoegd.
	uit, _, err = valideerAanmelding(goed[:1], "Initiatief", toegestaan, vaste)
	if err != nil || len(uit) != 2 || uit[1]["opvoer"]["aanmeldstatus"]["initiatief_id"] != "$nieuw.initiatief" {
		t.Fatalf("aanmeldstatus niet toegevoegd: %v / %v", uit, err)
	}

	fouten := map[string][]aanmeldingWijziging{
		"bestaand entiteit-id":  {laagOpvoer("initiatief", map[string]any{"id": 143})},
		"GE op bestaand record": {laagOpvoer("initiatief", map[string]any{"id": "$nieuw.i"}), laagOpvoer("product", map[string]any{"initiatief_id": 143, "naam": "x"})},
		"afvoer":                {laagOpvoer("initiatief", map[string]any{"id": "$nieuw.i"}), {"afvoer": {"product": {"initiatief_id": "$nieuw.i"}}}},
		"vreemde representatie": {laagOpvoer("initiatief", map[string]any{"id": "$nieuw.i"}), laagOpvoer("gebruiker", map[string]any{"id": "$nieuw.g"})},
		"geen hoofdentiteit":    {laagOpvoer("organisatie", map[string]any{"id": "$nieuw.org"})},
		"twee hoofdentiteiten":  {laagOpvoer("initiatief", map[string]any{"id": "$nieuw.a"}), laagOpvoer("initiatief", map[string]any{"id": "$nieuw.b"})},
	}
	for naam, w := range fouten {
		if _, _, err := valideerAanmelding(w, "Initiatief", toegestaan, vaste); err == nil {
			t.Fatalf("%s: verwachtte een fout", naam)
		}
	}
}

func TestAanmeldingLimiter(t *testing.T) {
	l := &aanmeldingLimiter{tijden: map[string][]time.Time{}}
	nu := time.Now()
	for i := 0; i < aanmeldingLimietAantal; i++ {
		if !l.toestaan("1.2.3.4", nu) {
			t.Fatalf("aanvraag %d geweigerd", i)
		}
	}
	if l.toestaan("1.2.3.4", nu) {
		t.Fatal("boven de limiet toch toegestaan")
	}
	if !l.toestaan("5.6.7.8", nu) || !l.toestaan("1.2.3.4", nu.Add(aanmeldingLimietVenster+time.Second)) {
		t.Fatal("ander ip of na het venster moet mogen")
	}
}

func TestOpenbareFormulieren(t *testing.T) {
	t.Setenv("OPENBARE_FORMULIEREN", " 2, 5 ,x")
	m := OpenbareFormulieren()
	if !m[2] || !m[5] || len(m) != 2 {
		t.Fatalf("m = %v", m)
	}
	if got := strings.Join(aanmeldingVeldnamenGesorteerd(map[string]bool{"b": true, "a": true}), ","); got != "a,b" {
		t.Fatal(got)
	}
}
