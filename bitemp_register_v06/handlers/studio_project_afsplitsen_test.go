package handlers

// Tests voor afgeleide projecten (werkplaats-plan §4B, stap 1) en verwachtLaatsteVolgnummer.
// De integratietests draaien alleen met STUDIO_TEST_PG_DSN (zie studioTestDB).

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func TestValideerAfsplitsen(t *testing.T) {
	gevallen := []struct {
		in      afsplitsenInvoer
		wilFout bool
	}{
		{afsplitsenInvoer{Naam: "Branch"}, false},
		{afsplitsenInvoer{Naam: "Branch", MapID: "map-123e4567-e89b"}, false},
		{afsplitsenInvoer{Naam: "Branch", ID: "test-branch-01"}, false},
		{afsplitsenInvoer{Naam: "  "}, true},
		{afsplitsenInvoer{Naam: "Branch", ID: "kort"}, true},
		{afsplitsenInvoer{Naam: "Branch", ID: "test-ouder-01"}, true}, // gelijk aan de ouder
		{afsplitsenInvoer{Naam: "Branch", MapID: "map met spatie"}, true},
	}
	for _, g := range gevallen {
		if msg := valideerAfsplitsen(&g.in, "test-ouder-01"); (msg != "") != g.wilFout {
			t.Errorf("%+v: fout=%q, verwacht fout=%v", g.in, msg, g.wilFout)
		}
	}
}

func afsplitsenRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/studio/projecten", MaakStudioProjectAanmakenHandler())
	r.GET("/api/studio/projecten", MaakStudioProjectenLijstHandler())
	r.GET("/api/studio/projecten/:id", MaakStudioProjectOphalenHandler())
	r.PUT("/api/studio/projecten/:id", MaakStudioProjectOpslaanHandler())
	r.DELETE("/api/studio/projecten/:id", MaakStudioProjectVerwijderenHandler())
	r.POST("/api/studio/projecten/:id/ops", MaakStudioProjectOpsToevoegenHandler())
	r.GET("/api/studio/projecten/:id/ops", MaakStudioProjectOpsLijstHandler())
	r.POST("/api/studio/projecten/:id/afsplitsen", MaakStudioProjectAfsplitsenHandler())
	r.GET("/api/studio/projecten/:id/basis", MaakStudioProjectBasisHandler())
	return r
}

func opsBatch(client string, n int, verwacht *int64) map[string]any {
	ops := make([]any, 0, n)
	for i := 0; i < n; i++ {
		ops = append(ops, map[string]any{"lokaalNr": i + 1, "store": "model:uml", "op": "addElement",
			"args": []any{map[string]any{"id": fmt.Sprintf("%s-%d", client, i)}}})
	}
	b := map[string]any{"clientId": client, "ops": ops}
	if verwacht != nil {
		b["verwachtLaatsteVolgnummer"] = *verwacht
	}
	return b
}

func TestStudioOps_VerwachtLaatsteVolgnummer(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	r := afsplitsenRouter()

	inhoud := map[string]any{"formaat": "studio-project", "versie": 2}
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-verw-0001", "naam": "V", "inhoud": inhoud}); rec.Code != http.StatusCreated {
		t.Fatalf("POST project: %d %s", rec.Code, rec.Body.String())
	}
	nul, twee := int64(0), int64(2)
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-verw-0001/ops", opsBatch("a", 2, &nul)); rec.Code != http.StatusCreated {
		t.Fatalf("batch met juiste verwachting: %d %s", rec.Code, rec.Body.String())
	}
	// Verouderde verwachting → 409 met de echte stand, niets opgeslagen.
	rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-verw-0001/ops", opsBatch("b", 1, &nul))
	if rec.Code != http.StatusConflict {
		t.Fatalf("verouderde verwachting: %d %s", rec.Code, rec.Body.String())
	}
	var fout struct {
		Reden             string `json:"reden"`
		LaatsteVolgnummer int64  `json:"laatsteVolgnummer"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &fout)
	if fout.Reden != "volgnummer_verschoven" || fout.LaatsteVolgnummer != 2 {
		t.Fatalf("409-body: %s", rec.Body.String())
	}
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-verw-0001/ops", opsBatch("b", 1, &twee)); rec.Code != http.StatusCreated {
		t.Fatalf("batch na bijwerken: %d %s", rec.Code, rec.Body.String())
	}
	// Zonder veld: zoals altijd.
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-verw-0001/ops", opsBatch("c", 1, nil)); rec.Code != http.StatusCreated {
		t.Fatalf("batch zonder verwachting: %d %s", rec.Code, rec.Body.String())
	}
}

func TestStudioProject_Afsplitsen(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	ctx := context.Background()
	if _, err := db.NewCreateTable().Model((*model.StudioGedeeldBeeld)(nil)).IfNotExists().Exec(ctx); err != nil {
		t.Fatalf("beelden-tabel: %v", err)
	}
	r := afsplitsenRouter()

	inhoud := map[string]any{"formaat": "studio-project", "versie": 2, "naam": "ouder"}
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-ouder-0001", "naam": "Ouder", "inhoud": inhoud}); rec.Code != http.StatusCreated {
		t.Fatalf("POST ouder: %d %s", rec.Code, rec.Body.String())
	}
	// 5 ops, compactie t/m 3 (blob vervangen), dan nog 2: staart = 4..7.
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-ouder-0001/ops", opsBatch("a", 5, nil))
	inhoud["naam"] = "ouder-na-compactie"
	if rec := studioDoe(r, http.MethodPut, "/api/studio/projecten/test-ouder-0001", map[string]any{"inhoud": inhoud, "versie": 1, "tot_volgnummer": 3, "clientId": "a"}); rec.Code != http.StatusOK {
		t.Fatalf("PUT compactie: %d %s", rec.Code, rec.Body.String())
	}
	studioDoe(r, http.MethodPost, "/api/studio/projecten/test-ouder-0001/ops", opsBatch("b", 2, nil))
	if err := ZetProjectToegang(ctx, db, "test-ouder-0001", "lezer-x", RechtLezen, "test"); err != nil {
		t.Fatal(err)
	}

	// Onbekende ouder → 404; ongeldige invoer → 400.
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-ouder-nope/afsplitsen", map[string]any{"naam": "x"}); rec.Code != http.StatusNotFound {
		t.Fatalf("onbekende ouder: %d", rec.Code)
	}
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-ouder-0001/afsplitsen", map[string]any{"naam": ""}); rec.Code != http.StatusBadRequest {
		t.Fatalf("zonder naam: %d", rec.Code)
	}

	rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-ouder-0001/afsplitsen",
		map[string]any{"id": "test-branch-0001", "naam": "Werkplaats GPK", "mapId": "map-gpk"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("afsplitsen: %d %s", rec.Code, rec.Body.String())
	}
	var meta StudioProjectMeta
	_ = json.Unmarshal(rec.Body.Bytes(), &meta)
	if meta.Herkomst == nil || meta.Herkomst.OuderProject != "test-ouder-0001" || meta.Herkomst.BasisVolgnummer != 7 ||
		meta.Herkomst.MapID != "map-gpk" || meta.TotVolgnummer != 3 || meta.LaatsteVolgnummer != 7 {
		t.Fatalf("meta: %s", rec.Body.String())
	}
	// Zelfde id nog eens → 409.
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-ouder-0001/afsplitsen", map[string]any{"id": "test-branch-0001", "naam": "x"}); rec.Code != http.StatusConflict {
		t.Fatalf("dubbel id: %d", rec.Code)
	}

	// GET branch: blob van de ouder, herkomst erbij.
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-branch-0001", nil)
	var volledig struct {
		Inhoud   map[string]any   `json:"inhoud"`
		Herkomst *ProjectHerkomst `json:"herkomst"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &volledig)
	if volledig.Inhoud["naam"] != "ouder-na-compactie" || volledig.Herkomst == nil {
		t.Fatalf("GET branch: %s", rec.Body.String())
	}
	// De ouder zelf heeft geen herkomst.
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-ouder-0001", nil)
	if json.Unmarshal(rec.Body.Bytes(), &volledig); volledig.Herkomst != nil {
		t.Fatalf("ouder heeft herkomst: %s", rec.Body.String())
	}

	// Staart gekopieerd met dezelfde volgnummers en inhoud.
	leesOps := func(id string) []StudioOpUit {
		rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/"+id+"/ops?vanaf=3", nil)
		var uit struct {
			Ops []StudioOpUit `json:"ops"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &uit)
		return uit.Ops
	}
	ouderOps, branchOps := leesOps("test-ouder-0001"), leesOps("test-branch-0001")
	if len(branchOps) != 4 || len(ouderOps) != 4 {
		t.Fatalf("staart: ouder %d, branch %d", len(ouderOps), len(branchOps))
	}
	for i := range ouderOps {
		if ouderOps[i].Volgnummer != branchOps[i].Volgnummer || string(ouderOps[i].Args) != string(branchOps[i].Args) {
			t.Fatalf("op %d verschilt: %+v vs %+v", i, ouderOps[i], branchOps[i])
		}
	}

	// Basis: blob + staart, ook na compactie van de branch nog volledig.
	if rec := studioDoe(r, http.MethodPut, "/api/studio/projecten/test-branch-0001", map[string]any{"inhoud": inhoud, "versie": 1, "tot_volgnummer": 7}); rec.Code != http.StatusOK {
		t.Fatalf("PUT compactie branch: %d %s", rec.Code, rec.Body.String())
	}
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten/test-branch-0001/basis", nil)
	var basis struct {
		OuderProject    string         `json:"ouderProject"`
		BasisVolgnummer int64          `json:"basisVolgnummer"`
		TotVolgnummer   int64          `json:"totVolgnummer"`
		Inhoud          map[string]any `json:"profiel"`
		Ops             []StudioOpUit  `json:"ops"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &basis)
	if rec.Code != http.StatusOK || basis.BasisVolgnummer != 7 || basis.TotVolgnummer != 3 || len(basis.Ops) != 4 ||
		basis.Ops[0].Volgnummer != 4 || basis.Inhoud["naam"] != "ouder-na-compactie" {
		t.Fatalf("basis: %d %s", rec.Code, rec.Body.String())
	}
	if rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/test-ouder-0001/basis", nil); rec.Code != http.StatusNotFound {
		t.Fatalf("basis van gewoon project: %d", rec.Code)
	}

	// Nieuwe ops op de branch tellen door vanaf 8; de ouder blijft ongemoeid.
	rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/test-branch-0001/ops", opsBatch("w", 1, nil))
	var nr struct{ Van int64 }
	_ = json.Unmarshal(rec.Body.Bytes(), &nr)
	if nr.Van != 8 || len(leesOps("test-ouder-0001")) != 4 {
		t.Fatalf("doortellen op branch: van=%d", nr.Van)
	}

	// Toegang overgenomen.
	var toegang []model.StudioProjectToegang
	_ = db.NewSelect().Model(&toegang).Where("project_id = ?", "test-branch-0001").Scan(ctx)
	if len(toegang) != 1 || toegang[0].Subject != "lezer-x" || toegang[0].Recht != "lezen" {
		t.Fatalf("toegang branch: %+v", toegang)
	}

	// Lijst toont de herkomst.
	rec = studioDoe(r, http.MethodGet, "/api/studio/projecten", nil)
	var lijst []StudioProjectMeta
	_ = json.Unmarshal(rec.Body.Bytes(), &lijst)
	gevonden := false
	for _, m := range lijst {
		if m.ID == "test-branch-0001" {
			gevonden = m.Herkomst != nil && m.Herkomst.BasisVolgnummer == 7
		}
	}
	if !gevonden {
		t.Fatalf("lijst zonder herkomst: %s", rec.Body.String())
	}

	// Verwijderen neemt de basis mee.
	if rec := studioDoe(r, http.MethodDelete, "/api/studio/projecten/test-branch-0001", nil); rec.Code != http.StatusNoContent {
		t.Fatalf("DELETE branch: %d %s", rec.Code, rec.Body.String())
	}
	n, _ := db.NewSelect().Model((*model.StudioProjectBasis)(nil)).Where("project_id = ?", "test-branch-0001").Count(ctx)
	if n != 0 {
		t.Fatalf("basis bleef staan")
	}
}

// Afsplitsen terwijl er ops binnenkomen: de branch krijgt precies de ops t/m zijn basis,
// niets half (het FOR UPDATE-slot op de ouder).
func TestStudioProject_AfsplitsenGelijktijdig(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	r := afsplitsenRouter()

	inhoud := map[string]any{"formaat": "studio-project", "versie": 2}
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": "test-gelijk-0001", "naam": "G", "inhoud": inhoud}); rec.Code != http.StatusCreated {
		t.Fatalf("POST: %d", rec.Code)
	}
	var wg sync.WaitGroup
	for w := 0; w < 4; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < 10; i++ {
				studioDoe(r, http.MethodPost, "/api/studio/projecten/test-gelijk-0001/ops", opsBatch(fmt.Sprintf("w%d", w), 3, nil))
			}
		}(w)
	}
	var branches []StudioProjectMeta
	var mu sync.Mutex
	for b := 0; b < 3; b++ {
		wg.Add(1)
		go func(b int) {
			defer wg.Done()
			rec := studioDoe(r, http.MethodPost, "/api/studio/projecten/test-gelijk-0001/afsplitsen",
				map[string]any{"id": fmt.Sprintf("test-gelijk-br%02d", b), "naam": "br"})
			var m StudioProjectMeta
			_ = json.Unmarshal(rec.Body.Bytes(), &m)
			mu.Lock()
			branches = append(branches, m)
			mu.Unlock()
		}(b)
	}
	wg.Wait()
	for _, m := range branches {
		if m.Herkomst == nil {
			t.Fatalf("branch zonder herkomst: %+v", m)
		}
		rec := studioDoe(r, http.MethodGet, "/api/studio/projecten/"+m.ID+"/ops?vanaf=0&limiet=5000", nil)
		var uit struct {
			Ops []StudioOpUit `json:"ops"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &uit)
		if int64(len(uit.Ops)) != m.Herkomst.BasisVolgnummer {
			t.Fatalf("%s: %d ops, basis %d", m.ID, len(uit.Ops), m.Herkomst.BasisVolgnummer)
		}
		for i, o := range uit.Ops {
			if o.Volgnummer != int64(i+1) {
				t.Fatalf("%s: gat in de volgnummers bij %d", m.ID, i)
			}
		}
	}
}
