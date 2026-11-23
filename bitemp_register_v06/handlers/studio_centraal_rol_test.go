package handlers

// Stap 7: de rol ontwerper en de centrale projecten (studio_centraal_rol.go).

import (
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestAftoppenCentraal(t *testing.T) {
	gevallen := []struct {
		r        ProjectRecht
		rol      string
		centraal bool
		wil      ProjectRecht
	}{
		{RechtBeheren, "ontwerper", true, RechtLezen},   // eigenaar, maar geen beheerder
		{RechtSchrijven, "bouwer", true, RechtLezen},    // ook een bouwer niet
		{RechtBeheren, "beheerder", true, RechtBeheren}, // de beheerder wel
		{RechtBeheren, "admin", true, RechtBeheren},     // alias
		{RechtSchrijven, "ontwerper", false, RechtSchrijven},
		{RechtLezen, "lezer", true, RechtLezen},
		{RechtGeen, "ontwerper", true, RechtGeen},
	}
	for _, g := range gevallen {
		if uit := aftoppenCentraal(g.r, g.rol, g.centraal); uit != g.wil {
			t.Errorf("aftoppen(%s, %s, %v) = %s, wil %s", g.r, g.rol, g.centraal, uit, g.wil)
		}
	}
	for rol, mag := range map[string]bool{"lezer": false, "modelleur": false, "ontwerper": true, "bouwer": true, "editor": true, "beheerder": true} {
		if magCentraalAfsplitsen(rol) != mag {
			t.Errorf("afsplitsen %s: wil %v", rol, mag)
		}
	}
}

func TestStudioCentraal_RolOntwerper(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	t.Setenv("AUTH_ENABLED", "true")
	t.Setenv("CENTRAAL_URL", "")
	ctx := t.Context()
	_, _ = db.NewDelete().Model((*model.StudioProjectUitgave)(nil)).Where("soort = 'profielen'").Exec(ctx)

	r := toegangRouter()
	ontwerper := middleware.RequireRol("modelleur")
	r.POST("/api/studio/projecten/:id/ops", ontwerper, VereisProjectRecht(RechtSchrijven), MaakStudioProjectOpsToevoegenHandler())
	r.POST("/api/studio/projecten/:id/afsplitsen", ontwerper, VereisProjectRecht(RechtLezen), MaakStudioProjectAfsplitsenHandler())
	r.POST("/api/studio/projecten/:id/uitbrengen", middleware.RequireRol("beheerder"), VereisProjectRecht(RechtLezen), MaakStudioProjectUitbrengenHandler())

	const id = "test-centraal-rol"
	inhoud := sidecarInhoud("0.1.0")
	ops := map[string]any{"clientId": "c1", "ops": []map[string]any{{"store": "modelleren", "op": "patchStructuur", "args": []any{map[string]any{}}}}}

	// Olga (ontwerper) maakt het profielenproject; iedereen mag schrijven.
	if code, b := alsGebruiker(r, "olga", "ontwerper", "POST", "/api/studio/projecten", map[string]any{"id": id, "naam": "Profielen", "inhoud": inhoud}); code != 201 {
		t.Fatalf("aanmaken: %d %s", code, b)
	}
	if code, b := alsGebruiker(r, "olga", "ontwerper", "PUT", "/api/studio/projecten/"+id+"/toegang", map[string]any{"toegang": []map[string]any{{"subject": "*", "recht": "schrijven"}}}); code != 200 && code != 204 {
		t.Fatalf("toegang: %d %s", code, b)
	}
	// Vóór de eerste versie is het nog geen centraal project: gewoon schrijven.
	if code, b := alsGebruiker(r, "olga", "ontwerper", "POST", "/api/studio/projecten/"+id+"/ops", ops); code != 200 && code != 201 {
		t.Fatalf("ops vóór uitbrengen: %d %s", code, b)
	}
	// Mark (beheerder) brengt 1.0.0 uit.
	if code, b := alsGebruiker(r, "mark", "beheerder", "POST", "/api/studio/projecten/"+id+"/uitbrengen", map[string]any{"versie": "1.0.0", "inhoud": inhoud, "totVolgnummer": 1}); code != 201 {
		t.Fatalf("uitbrengen: %d %s", code, b)
	}

	// Nu is MAIN van de beheerder: de eigenaar (ontwerper) en een modelleur mogen er niet meer in schrijven.
	for _, wie := range []struct{ naam, rol string }{{"olga", "ontwerper"}, {"mo", "modelleur"}} {
		code, b := alsGebruiker(r, wie.naam, wie.rol, "POST", "/api/studio/projecten/"+id+"/ops", ops)
		if code != 403 || !strings.Contains(string(b), `"centraal"`) {
			t.Fatalf("ops op MAIN door %s: %d %s", wie.rol, code, b)
		}
		if code, b := alsGebruiker(r, wie.naam, wie.rol, "GET", "/api/studio/projecten/"+id, nil); code != 200 || !strings.Contains(string(b), `"recht":"lezen"`) || !strings.Contains(string(b), `"centraal":true`) {
			t.Fatalf("ophalen door %s: %d %s", wie.rol, code, b)
		}
	}
	if code, _ := alsGebruiker(r, "olga", "ontwerper", "DELETE", "/api/studio/projecten/"+id, nil); code != 403 {
		t.Fatalf("verwijderen door de eigenaar-ontwerper: %d", code)
	}
	// De lijst toont het afgetopte recht.
	if _, b := alsGebruiker(r, "olga", "ontwerper", "GET", "/api/studio/projecten", nil); !strings.Contains(string(b), `"id":"`+id+`"`) || !strings.Contains(string(b), `"recht":"lezen"`) {
		t.Fatalf("lijst: %s", b)
	}
	// De beheerder schrijft wel.
	if code, b := alsGebruiker(r, "mark", "beheerder", "POST", "/api/studio/projecten/"+id+"/ops", ops); code != 200 && code != 201 {
		t.Fatalf("ops door de beheerder: %d %s", code, b)
	}

	// Een branch: de modelleur niet, de ontwerper wel; in haar branch schrijft ze gewoon.
	if code, b := alsGebruiker(r, "mo", "modelleur", "POST", "/api/studio/projecten/"+id+"/afsplitsen", map[string]any{"id": id + "-mo", "naam": "Concept Mo"}); code != 403 || !strings.Contains(string(b), "centraal_ontwerper") {
		t.Fatalf("afsplitsen door modelleur: %d %s", code, b)
	}
	if code, b := alsGebruiker(r, "olga", "ontwerper", "POST", "/api/studio/projecten/"+id+"/afsplitsen", map[string]any{"id": id + "-olga", "naam": "Concept Olga"}); code != 201 {
		t.Fatalf("afsplitsen door ontwerper: %d %s", code, b)
	}
	if code, b := alsGebruiker(r, "olga", "ontwerper", "POST", "/api/studio/projecten/"+id+"-olga/ops", ops); code != 200 && code != 201 {
		t.Fatalf("ops in de branch: %d %s", code, b)
	}
	// Uitbrengen vanaf een branch kan niet, ook niet door de beheerder.
	if code, b := alsGebruiker(r, "mark", "beheerder", "POST", "/api/studio/projecten/"+id+"-olga/uitbrengen", map[string]any{"versie": "1.1.0", "inhoud": inhoud, "totVolgnummer": 99}); code != 409 || !strings.Contains(string(b), `"branch"`) {
		t.Fatalf("uitbrengen vanaf branch: %d %s", code, b)
	}
}
