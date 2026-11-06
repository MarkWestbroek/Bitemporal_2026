package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// zonderRecenteOps zet de controle op recente ops van anderen uit voor tests die over iets
// anders gaan (compactie); open SSE-verbindingen tellen nog wel.
func zonderRecenteOps(t *testing.T) {
	t.Helper()
	oud := recenteOpClients
	recenteOpClients = func(context.Context, bun.IDB, string, time.Time) ([]recenteOpClient, error) { return nil, nil }
	t.Cleanup(func() { recenteOpClients = oud })
}

func TestAndereClients(t *testing.T) {
	nu := time.Now()
	verbonden := []StudioAanwezige{{ClientID: "tab-a", Actor: "mark"}, {ClientID: "tab-b", Actor: "fundament"}, {ClientID: "tab-b", Actor: "fundament"}}
	recent := []recenteOpClient{{ClientID: "tab-b", Actor: "fundament", Laatst: nu}, {ClientID: "tab-c", Actor: "x", Laatst: nu}}

	if got := andereClients("", nil, nil); len(got) != 0 {
		t.Fatalf("niemand: %+v", got)
	}
	if got := andereClients("tab-a", []StudioAanwezige{{ClientID: "tab-a"}}, []recenteOpClient{{ClientID: "tab-a", Laatst: nu}}); len(got) != 0 {
		t.Fatalf("alleen de eigen tab moet vrij zijn: %+v", got)
	}
	got := andereClients("tab-a", verbonden, recent)
	if len(got) != 2 || got[0].ClientID != "tab-b" || got[0].Bron != "verbonden" || got[1].ClientID != "tab-c" || got[1].Bron != "recent" || got[1].Laatst == nil {
		t.Fatalf("anderen naast tab-a: %+v", got)
	}
	// Zonder eigen clientId (script) is ook tab-a een ander.
	if got := andereClients("  ", verbonden, nil); len(got) != 2 {
		t.Fatalf("zonder clientId: %+v", got)
	}
	// Een verbinding zonder clientId is altijd een ander, ook naast een eigen clientId.
	if got := andereClients("tab-a", []StudioAanwezige{{ClientID: ""}, {ClientID: ""}}, nil); len(got) != 2 {
		t.Fatalf("verbinding zonder clientId: %+v", got)
	}
}

// TestStudioProjectPut_WeigertBijGebruik — integratietest (STUDIO_TEST_PG_DSN): een PUT wordt
// geweigerd zolang een andere tab verbonden is of net een op stuurde, en lukt voor de eigen tab
// als die alleen is. Bij een weigering blijft het project ongewijzigd.
func TestStudioProjectPut_WeigertBijGebruik(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/studio/projecten", MaakStudioProjectAanmakenHandler())
	r.PUT("/api/studio/projecten/:id", MaakStudioProjectOpslaanHandler())
	r.GET("/api/studio/projecten/:id", MaakStudioProjectOphalenHandler())

	const id = "test-put-in-gebruik"
	inhoud := map[string]any{"formaat": "studio-project", "versie": 2, "profielen": map[string]any{}}
	if rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": id, "naam": "In gebruik", "inhoud": inhoud}); rec.Code != http.StatusCreated {
		t.Fatalf("POST: %d %s", rec.Code, rec.Body.String())
	}
	vervangen := map[string]any{"formaat": "studio-project", "versie": 2, "profielen": map[string]any{"x": map[string]any{}}}

	// 1. Alleen de eigen tab verbonden → de PUT van die tab lukt.
	eigenAb := hub.abonneer(id, "tab-eigen", "mark")
	rec := studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, map[string]any{"inhoud": inhoud, "versie": 1, "clientId": "tab-eigen"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT eigen tab alleen: %d %s", rec.Code, rec.Body.String())
	}

	// 2. Een andere tab verbonden → 409 project_in_gebruik, zowel voor de eigen tab als voor een script.
	anderAb := hub.abonneer(id, "tab-ander", "fundament")
	for _, body := range []map[string]any{
		{"inhoud": vervangen, "versie": 2, "clientId": "tab-eigen"},
		{"inhoud": vervangen, "versie": 2},
	} {
		rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, body)
		var uit struct {
			Reden   string               `json:"reden"`
			Anderen []StudioAndereClient `json:"anderen"`
			Server  StudioProjectMeta    `json:"server"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &uit)
		if rec.Code != http.StatusConflict || uit.Reden != "project_in_gebruik" || len(uit.Anderen) == 0 || uit.Server.Versie != 2 {
			t.Fatalf("PUT met een andere tab verbonden: %d %s", rec.Code, rec.Body.String())
		}
	}
	// Ook via de header.
	req := httptest.NewRequest(http.MethodPut, "/api/studio/projecten/"+id, bytes.NewBufferString(`{"inhoud":{"formaat":"studio-project","versie":2,"profielen":{}},"versie":2}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Omnium-Client", "tab-eigen")
	if rec := studioDoeReq(r, req); rec.Code != http.StatusConflict {
		t.Fatalf("PUT via header met een andere tab: %d %s", rec.Code, rec.Body.String())
	}
	// 2b. Uitzondering: een bijgewerkte snapshot van de eigen, verbonden tab mag wel (log leeg → grens 0).
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, map[string]any{"inhoud": inhoud, "versie": 2, "tot_volgnummer": 0, "clientId": "tab-eigen"})
	if rec.Code != http.StatusOK {
		t.Fatalf("snapshot van de verbonden, bijgewerkte tab: %d %s", rec.Code, rec.Body.String())
	}
	// 2c. Een script met dezelfde grens maar zonder (verbonden) clientId niet.
	for _, body := range []map[string]any{
		{"inhoud": vervangen, "versie": 3, "tot_volgnummer": 0},
		{"inhoud": vervangen, "versie": 3, "tot_volgnummer": 0, "clientId": "script-zonder-sse"},
	} {
		if rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, body); rec.Code != http.StatusConflict {
			t.Fatalf("snapshot zonder verbonden clientId: %d %s", rec.Code, rec.Body.String())
		}
	}
	hub.afmelden(id, anderAb)

	// 3. De andere tab is weg, maar stuurde net een op → nog steeds 409 (bron "recent").
	ctx := context.Background()
	if _, err := db.NewInsert().Model(&model.StudioProjectOp{
		ProjectID: id, Volgnummer: 1, ClientID: "tab-ander", Actor: "fundament", Store: "structuur", Op: "proef", Args: json.RawMessage(`[]`), Tijd: time.Now(),
	}).Exec(ctx); err != nil {
		t.Fatalf("op invoegen: %v", err)
	}
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, map[string]any{"inhoud": vervangen, "versie": 3, "clientId": "tab-eigen"})
	if rec.Code != http.StatusConflict || !bytes.Contains(rec.Body.Bytes(), []byte(`"recent"`)) {
		t.Fatalf("PUT na een recente op van een ander: %d %s", rec.Code, rec.Body.String())
	}
	// 3b. Een snapshot die achterloopt (grens 0, log tot 1) valt niet onder de uitzondering.
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, map[string]any{"inhoud": vervangen, "versie": 3, "tot_volgnummer": 0, "clientId": "tab-eigen"})
	if rec.Code != http.StatusConflict {
		t.Fatalf("achterlopende snapshot: %d %s", rec.Code, rec.Body.String())
	}
	// 3c. Bijgewerkt (grens 1) wel; de op gaat daarbij uit het log (compactie).
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, map[string]any{"inhoud": inhoud, "versie": 3, "tot_volgnummer": 1, "clientId": "tab-eigen"})
	if rec.Code != http.StatusOK {
		t.Fatalf("bijgewerkte snapshot naast een recente op: %d %s", rec.Code, rec.Body.String())
	}
	// Een nieuwe op van de ander (na de grens) houdt een gewone PUT weer tegen.
	if _, err := db.NewInsert().Model(&model.StudioProjectOp{
		ProjectID: id, Volgnummer: 2, ClientID: "tab-ander", Actor: "fundament", Store: "structuur", Op: "proef", Args: json.RawMessage(`[]`), Tijd: time.Now(),
	}).Exec(ctx); err != nil {
		t.Fatalf("op 2 invoegen: %v", err)
	}
	if rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, map[string]any{"inhoud": vervangen, "versie": 4, "clientId": "tab-eigen"}); rec.Code != http.StatusConflict {
		t.Fatalf("PUT na op 2: %d %s", rec.Code, rec.Body.String())
	}

	// 4. Die op is ouder dan het venster → de eigen tab mag weer.
	if _, err := db.NewUpdate().Model((*model.StudioProjectOp)(nil)).
		Set("tijd = ?", time.Now().Add(-studioInGebruikVenster-time.Minute)).
		Where("project_id = ?", id).Exec(ctx); err != nil {
		t.Fatalf("op verouderen: %v", err)
	}
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, map[string]any{"inhoud": vervangen, "versie": 4, "clientId": "tab-eigen"})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT na het venster: %d %s", rec.Code, rec.Body.String())
	}
	hub.afmelden(id, eigenAb)

	// 5. Niemand meer verbonden → ook een script zonder clientId mag (zoals voorheen).
	rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+id, map[string]any{"inhoud": inhoud, "versie": 5})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT zonder iemand: %d %s", rec.Code, rec.Body.String())
	}
}
