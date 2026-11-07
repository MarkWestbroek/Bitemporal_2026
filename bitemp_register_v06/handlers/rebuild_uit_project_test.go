package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

const proefProjectID = "p1234567-aaaa-bbbb"

// nepExportSvc speelt de render-sidecar na voor POST /export/v3; `antwoord` bepaalt status en body.
func nepExportSvc(t *testing.T, status int, body string, gezien *map[string]any) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/export/v3" || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		b, _ := io.ReadAll(r.Body)
		if gezien != nil {
			_ = json.Unmarshal(b, gezien)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = io.WriteString(w, body)
	}))
	t.Cleanup(srv.Close)
	return srv
}

// zetProefProject vervangt de project-lader en de achterstand; profiel nil = geen profiel.
func zetProefProject(t *testing.T, profiel json.RawMessage, achterstand int64, gevraagdProfiel *string) {
	t.Helper()
	oudDeel, oudAchter := laadProjectDeel, projectAchterstand
	laadProjectDeel = func(_ context.Context, id, p string) (*projectStand, json.RawMessage, error) {
		if id != proefProjectID {
			return nil, nil, nil
		}
		if gevraagdProfiel != nil {
			*gevraagdProfiel = p
		}
		return &projectStand{Naam: "Inrichten", Versie: 7, TotVolgnummer: 40}, profiel, nil
	}
	projectAchterstand = func(context.Context, string, int64) int64 { return achterstand }
	t.Cleanup(func() { laadProjectDeel, projectAchterstand = oudDeel, oudAchter })
}

const proefV3 = `{"versie":"v3","naam":"Inrichten","entiteiten":[{"typenaam":"Dienst","meervoud":"diensten","domein":"inrichting"}]}`

func TestModelUitProject_Goed(t *testing.T) {
	var gezien map[string]any
	var profiel string
	zetProefProject(t, json.RawMessage(`{"elements":[]}`), 0, &profiel)
	t.Setenv("RENDER_SVC_URL", nepExportSvc(t, 200, `{"model":`+proefV3+`,"meldingen":[{"regel":"x","bericht":"let op"}],"nagespeeld":0,"renderVersie":"0.3.5"}`, &gezien).URL)

	model, meldingen, bron, stappen, fout := modelUitProject(context.Background(), proefProjectID, "", nil, true)
	if fout != nil {
		t.Fatalf("fout: %+v", fout)
	}
	if profiel != "diagram05" || gezien["profielId"] != "diagram05" || gezien["profiel"] == nil {
		t.Fatalf("profiel %q, verzoek aan de sidecar %v", profiel, gezien)
	}
	if _, met := gezien["ops"]; met {
		t.Fatalf("ops horen (nog) niet mee: %v", gezien)
	}
	if !strings.Contains(string(model), `"Dienst"`) || !strings.Contains(string(meldingen), "let op") {
		t.Fatalf("model %s, meldingen %s", model, meldingen)
	}
	if bron.ProjectID != proefProjectID || bron.ProjectVersie != 7 || bron.TotVolgnummer != 40 || bron.RenderVersie != "0.3.5" || bron.Profiel != "diagram05" {
		t.Fatalf("bron: %+v", bron)
	}
	if len(stappen) != 2 {
		t.Fatalf("stappen: %v", stappen)
	}
}

func TestModelUitProject_Weigeringen(t *testing.T) {
	gevallen := []struct {
		naam        string
		id          string
		profiel     json.RawMessage
		achterstand int64
		svcStatus   int
		svcBody     string
		wil         int
		reden       string
		inFout      string
	}{
		{"ongeldig id", "x", nil, 0, 200, "", 400, "ongeldig", "project_id"},
		{"geen project", "p9999999-aaaa-bbbb", nil, 0, 200, "", 404, "geen_project", "niet gevonden"},
		{"geen canoniek profiel", proefProjectID, nil, 0, 200, "", 422, "geen_profiel", "diagram05"},
		{"achterstand", proefProjectID, json.RawMessage(`{}`), 3, 200, `{"model":` + proefV3 + `}`, 409, "achterstand", "3 wijziging(en)"},
		{"terugreis faalt", proefProjectID, json.RawMessage(`{}`), 0, 422, `{"fout":"Geen V3 mogelijk","meldingen":[{"bericht":"veld zonder type"}]}`, 422, "export", "Geen V3 mogelijk"},
		{"oude sidecar", proefProjectID, json.RawMessage(`{}`), 0, 404, `{}`, 502, "sidecar", "kent /export/v3 niet"},
		{"sidecar 500", proefProjectID, json.RawMessage(`{}`), 0, 500, `{"detail":"stuk"}`, 502, "sidecar", "stuk"},
	}
	for _, g := range gevallen {
		t.Run(g.naam, func(t *testing.T) {
			zetProefProject(t, g.profiel, g.achterstand, nil)
			t.Setenv("RENDER_SVC_URL", nepExportSvc(t, g.svcStatus, g.svcBody, nil).URL)
			_, _, _, _, fout := modelUitProject(context.Background(), g.id, "", nil, true)
			if fout == nil {
				t.Fatalf("verwacht een weigering")
			}
			if fout.status != g.wil || fout.body.Reden != g.reden || !strings.Contains(fout.body.Error, g.inFout) {
				t.Fatalf("kreeg %d %q: %s", fout.status, fout.body.Reden, fout.body.Error)
			}
			if g.reden == "achterstand" && (fout.body.TotVolgnummer != 40 || fout.body.LaatsteVolgnummer != 43) {
				t.Fatalf("volgnummers: %+v", fout.body)
			}
			if g.reden == "export" && !strings.Contains(string(fout.body.Meldingen), "veld zonder type") {
				t.Fatalf("meldingen niet doorgegeven: %s", fout.body.Meldingen)
			}
		})
	}
	t.Run("sidecar onbereikbaar", func(t *testing.T) {
		zetProefProject(t, json.RawMessage(`{}`), 0, nil)
		t.Setenv("RENDER_SVC_URL", "http://127.0.0.1:1")
		_, _, _, _, fout := modelUitProject(context.Background(), proefProjectID, "", nil, true)
		if fout == nil || fout.status != 502 || fout.body.Reden != "sidecar" {
			t.Fatalf("onbereikbaar: %+v", fout)
		}
	})
}

// De leesroute geeft het model ook bij achterstand, met die achterstand erbij.
func TestStudioProjectV3Handler(t *testing.T) {
	var profiel string
	zetProefProject(t, json.RawMessage(`{"elements":[]}`), 2, &profiel)
	t.Setenv("RENDER_SVC_URL", nepExportSvc(t, 200, `{"model":`+proefV3+`,"meldingen":[],"renderVersie":"0.3.5"}`, nil).URL)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/api/studio/projecten/:id/v3", MaakStudioProjectV3Handler())

	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/studio/projecten/"+proefProjectID+"/v3?profiel=mijnprofiel", nil))
	if rec.Code != 200 || rec.Header().Get("X-Omnium-Achterstand") != "2" || rec.Header().Get("X-Omnium-Project-Versie") != "7" || rec.Header().Get("X-Render-Versie") != "0.3.5" {
		t.Fatalf("%d %v %s", rec.Code, rec.Header(), rec.Body.String())
	}
	var uit struct {
		Model     map[string]any `json:"model"`
		Meldingen []any          `json:"meldingen"`
		Bron      RebuildBron    `json:"bron"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &uit); err != nil || uit.Model["naam"] != "Inrichten" || uit.Bron.Achterstand != 2 || uit.Meldingen == nil {
		t.Fatalf("body: %s (%v)", rec.Body.String(), err)
	}
	if profiel != "mijnprofiel" {
		t.Fatalf("?profiel niet gebruikt: %q", profiel)
	}

	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/studio/projecten/p9999999-aaaa-bbbb/v3", nil))
	if rec.Code != 404 || !strings.Contains(rec.Body.String(), "geen_project") {
		t.Fatalf("onbekend project: %d %s", rec.Code, rec.Body.String())
	}
}

func TestKaalV3(t *testing.T) {
	env := json.RawMessage(`{"versie":"v3","bron":"studio","model":` + proefV3 + `}`)
	if string(kaalV3(env)) != proefV3 {
		t.Fatalf("envelop niet uitgepakt: %s", kaalV3(env))
	}
	if string(kaalV3(json.RawMessage(proefV3))) != proefV3 {
		t.Fatal("kaal model hoort ongewijzigd te blijven")
	}
}

// TestActiveerGebouwdModel_MetHerkomst — integratietest (STUDIO_TEST_PG_DSN): een rebuild uit een
// project slaat de herkomst op de nieuwe actieve schema-versie op; de vorige actieve wordt archived.
func TestActiveerGebouwdModel_MetHerkomst(t *testing.T) {
	db := studioTestDB(t)
	ctx := context.Background()
	for _, m := range []any{(*model.SchemaVersie)(nil), (*model.SchemaDomein)(nil)} {
		if _, err := db.NewCreateTable().Model(m).IfNotExists().Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	// Een testdatabase van vóór 0.22.0 heeft de kolom nog niet (dbsetup voegt hem toe).
	if _, err := db.ExecContext(ctx, `ALTER TABLE schema_versies ADD COLUMN IF NOT EXISTS gebouwde_domeinen JSONB`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = db.NewDelete().Model((*model.SchemaVersie)(nil)).Where("bron_project_id = ? OR opmerking = 'test-herkomst'", proefProjectID).Exec(ctx)
	})
	oud := DB
	DB = db
	defer func() { DB = oud }()
	vorige := model.SchemaVersie{SchemaJSON: json.RawMessage(proefV3), Status: model.SchemaVersieStatusActive, Opmerking: "test-herkomst"}
	if _, err := db.NewInsert().Model(&vorige).Exec(ctx); err != nil {
		t.Fatal(err)
	}
	bron := &RebuildBron{ProjectID: proefProjectID, ProjectNaam: "Inrichten", ProjectVersie: 7, TotVolgnummer: 40, RenderVersie: "0.3.5"}
	gebouwd := []model.GebouwdDomein{{Domein: "inrichting", Prefix: "inrichting"}, {Domein: "register", Prefix: "register"}}
	melding, err := activeerGebouwdModel(ctx, []byte(proefV3), nil, "mark", bron, gebouwd)
	if err != nil {
		t.Fatal(err)
	}
	// De startup-rebuild leest de domeinenlijst van de actieve versie terug.
	if terug, err := laadGebouwdeDomeinenVanActieveVersie(ctx); err != nil || !reflect.DeepEqual(terug, gebouwd) {
		t.Fatalf("gebouwde domeinen terug: %+v (%v)", terug, err)
	}
	var v model.SchemaVersie
	if err := db.NewSelect().Model(&v).Where("bron_project_id = ?", proefProjectID).Scan(ctx); err != nil {
		t.Fatalf("%s: %v", melding, err)
	}
	if v.Bron != "studio-project" || v.Status != model.SchemaVersieStatusActive || v.BronProjectVersie == nil || *v.BronProjectVersie != 7 ||
		v.BronTotVolgnummer == nil || *v.BronTotVolgnummer != 40 || v.ModelNaam != "Inrichten" || !strings.Contains(v.Opmerking, "Inrichten") {
		t.Fatalf("schema-versie: %+v", v)
	}
	var status model.SchemaVersieStatus
	_ = db.NewSelect().Model((*model.SchemaVersie)(nil)).Column("status").Where("id = ?", vorige.ID).Scan(ctx, &status)
	if status != model.SchemaVersieStatusArchived {
		t.Fatalf("vorige actieve: %s", status)
	}
}
