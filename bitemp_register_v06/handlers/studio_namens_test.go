package handlers

import (
	"encoding/json"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
)

func TestValideerNamens(t *testing.T) {
	for naam, wilFout := range map[string]bool{"jan": false, "jan.jansen@gemeente.nl": false, "met spatie": true, "<script>": true} {
		in := opsBatch("a", 1, nil)
		b, _ := json.Marshal(in)
		var batch studioOpsBatchInvoer
		_ = json.Unmarshal(b, &batch)
		batch.Namens = naam
		if msg := valideerStudioOpsBatch(&batch); (msg != "") != wilFout {
			t.Errorf("namens %q: fout=%q, verwacht fout=%v", naam, msg, wilFout)
		}
	}
}

// Alleen accounts in OMNIUM_NAMENS_ACCOUNTS mogen namens meesturen; actor blijft het account.
func TestStudioOps_Namens(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	t.Setenv("AUTH_ENABLED", "true")
	t.Setenv("OMNIUM_NAMENS_ACCOUNTS", "omnium-schrijver, iets-anders")
	r := toegangRouter()
	modelleur := middleware.RequireRol("modelleur")
	r.POST("/api/studio/projecten/:id/ops", modelleur, VereisProjectRecht(RechtSchrijven), MaakStudioProjectOpsToevoegenHandler())

	inhoud := map[string]any{"formaat": "studio-project", "versie": 2}
	if code, b := alsGebruiker(r, "mark", "admin", "POST", "/api/studio/projecten", map[string]any{"id": "test-namens-01", "naam": "N", "inhoud": inhoud}); code != 201 {
		t.Fatalf("POST: %d %s", code, b)
	}
	for _, g := range []string{"omnium-schrijver", "mo"} {
		if err := ZetProjectToegang(t.Context(), db, "test-namens-01", g, RechtSchrijven, "test"); err != nil {
			t.Fatal(err)
		}
	}
	batch := opsBatch("imprint", 1, nil)
	batch["namens"] = "jan@gemeente.nl"

	// Gewone modelleur met namens → 403.
	if code, b := alsGebruiker(r, "mo", "modelleur", "POST", "/api/studio/projecten/test-namens-01/ops", batch); code != 403 {
		t.Fatalf("modelleur met namens: %d %s", code, b)
	}
	// Serviceaccount → 201; namens staat naast actor.
	if code, b := alsGebruiker(r, "omnium-schrijver", "modelleur", "POST", "/api/studio/projecten/test-namens-01/ops", batch); code != 201 {
		t.Fatalf("serviceaccount: %d %s", code, b)
	}
	// Zonder namens mag de modelleur gewoon.
	if code, b := alsGebruiker(r, "mo", "modelleur", "POST", "/api/studio/projecten/test-namens-01/ops", opsBatch("studio", 1, nil)); code != 201 {
		t.Fatalf("modelleur zonder namens: %d %s", code, b)
	}
	code, b := alsGebruiker(r, "mark", "admin", "GET", "/api/studio/projecten/test-namens-01/ops", nil)
	var uit struct {
		Ops []StudioOpUit `json:"ops"`
	}
	_ = json.Unmarshal(b, &uit)
	if code != 200 || len(uit.Ops) != 2 || uit.Ops[0].Actor != "omnium-schrijver" || uit.Ops[0].Namens != "jan@gemeente.nl" || uit.Ops[1].Namens != "" {
		t.Fatalf("ops: %d %s", code, b)
	}
}
