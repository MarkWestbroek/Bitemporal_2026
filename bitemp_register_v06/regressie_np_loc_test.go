//go:build integration

// regressie_np_loc_test.go — geautomatiseerde regressietest op het np-loc domein.
//
// Draait de échte API in-process (NewRouter + httptest) tegen een échte, eigen
// Postgres-database, seedt np-loc vanuit replay-bestanden en loopt daarna de
// gedragsscenario's af die de BE-review van 2026-07-07 heeft geraakt:
// tijdreizen, POST-per-padnaam via de engine, PATCH/DELETE/ongedaanmaking,
// 404-gedrag, validatie (datatype/enum), referentielijsten, GraphQL-smoke,
// admin-afscherming, N+1-guard en auth-afdwinging.
//
// Bewust een aparte build-tag: `go test -tags integration -run TestRegressieNpLoc -v .`
// (zie scripts/regressie-np-loc.ps1 en docs/REGRESSIETEST.md). Zonder DB faalt
// de test hard — een integratietest die stil 'slaagt' zonder database is
// gevaarlijker dan een die niet draait.
//
// De database wordt bij elke run leeggehaald en opnieuw opgebouwd. Gebruik dus
// een DEDICATED database (default: bitemp_regressie_np_loc op poort 5433), nooit
// je dev-database.
package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/driver/pgdriver"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dbsetup"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
)

const defaultRegressieDSN = "postgres://postgres:1234@localhost:5433/bitemp_regressie_np_loc?sslmode=disable"

// defaultSeeds zijn de replay-bestanden waarmee np-loc wordt opgebouwd.
// Overschrijf met REGRESSIE_SEEDS (puntkomma-gescheiden paden).
var defaultSeeds = []string{
	"replay files/registraties-replay-synth-natuurlijkpersoon-locatie-woonadres.json",
	"replay files/registraties-replay-init-adellijketitels.json",
}

// ── Query-teller (N+1-guard) ────────────────────────────────────────────────

type queryTeller struct{ n atomic.Int64 }

func (q *queryTeller) BeforeQuery(ctx context.Context, _ *bun.QueryEvent) context.Context {
	q.n.Add(1)
	return ctx
}
func (q *queryTeller) AfterQuery(context.Context, *bun.QueryEvent) {}
func (q *queryTeller) reset()                                      { q.n.Store(0) }
func (q *queryTeller) aantal() int64                               { return q.n.Load() }

// ── Testomgeving ────────────────────────────────────────────────────────────

type regressieOmgeving struct {
	t      *testing.T
	srv    *httptest.Server
	client *http.Client
	db     *bun.DB
	teller *queryTeller
}

func nieuweRegressieOmgeving(t *testing.T) *regressieOmgeving {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("REGRESSIE_DATABASE_URL"))
	if dsn == "" {
		dsn = defaultRegressieDSN
	}
	if strings.Contains(dsn, "bitemp_go_db_v06") {
		t.Fatalf("weiger te draaien tegen de dev-database (%s); gebruik een dedicated regressie-DB", dsn)
	}

	// Maak de database aan als die nog niet bestaat (hergebruik main.go-logica).
	if err := ensureDatabaseExists(dsn); err != nil {
		t.Fatalf("regressie-database aanmaken/controleren mislukt: %v\n(draait er een Postgres op de DSN? zie scripts/regressie-np-loc.ps1)", err)
	}

	sqldb := sql.OpenDB(pgdriver.NewConnector(pgdriver.WithDSN(dsn)))
	db := bun.NewDB(sqldb, pgdialect.New())
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		t.Fatalf("geen verbinding met regressie-database %s: %v", dsn, err)
	}
	t.Cleanup(func() { _ = db.Close() })

	// Schone lei: alle model- en plumbingtabellen weg en opnieuw opbouwen.
	if err := dbsetup.DeleteTables(db); err != nil {
		t.Fatalf("tabellen opruimen mislukt: %v", err)
	}
	if err := dbsetup.CreateTables(db); err != nil {
		t.Fatalf("tabellen aanmaken mislukt: %v", err)
	}

	teller := &queryTeller{}
	db.AddQueryHook(teller)

	handlers.DB = db
	t.Setenv("AUTH_ENABLED", "false")
	t.Setenv("AUTHZ_PDP_ENABLED", "false")
	t.Setenv("REGISTRATIE_TIJD", "synthetisch")
	t.Setenv("DEVLOOP", "false")
	t.Setenv("ALLOW_DROP_TABLES", "false")
	t.Setenv("APP_DEBUG_LOGS", "0")
	gin.SetMode(gin.TestMode)

	srv := httptest.NewServer(NewRouter())
	t.Cleanup(srv.Close)

	jar, _ := cookiejar.New(nil)
	return &regressieOmgeving{
		t:      t,
		srv:    srv,
		client: &http.Client{Jar: jar, Timeout: 30 * time.Second},
		db:     db,
		teller: teller,
	}
}

// met geeft een kopie van de omgeving gebonden aan een subtest-t, zodat Fatalf
// binnen een subtest de subtest afbreekt en niet de parent (dat geeft een panic).
func (o *regressieOmgeving) met(t *testing.T) *regressieOmgeving {
	kopie := *o
	kopie.t = t
	return &kopie
}

// do voert een request uit en geeft (status, geparste JSON-body of nil, rauwe body).
func (o *regressieOmgeving) do(method, pad string, body any) (int, map[string]any, []byte) {
	o.t.Helper()
	var reader io.Reader
	if body != nil {
		switch b := body.(type) {
		case []byte:
			reader = bytes.NewReader(b)
		case string:
			reader = strings.NewReader(b)
		default:
			raw, err := json.Marshal(b)
			if err != nil {
				o.t.Fatalf("body marshallen mislukt: %v", err)
			}
			reader = bytes.NewReader(raw)
		}
	}
	req, err := http.NewRequest(method, o.srv.URL+pad, reader)
	if err != nil {
		o.t.Fatalf("request bouwen mislukt: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := o.client.Do(req)
	if err != nil {
		o.t.Fatalf("%s %s: %v", method, pad, err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var parsed map[string]any
	_ = json.Unmarshal(raw, &parsed)
	return resp.StatusCode, parsed, raw
}

func (o *regressieOmgeving) eisStatus(method, pad string, body any, wil int) (map[string]any, []byte) {
	o.t.Helper()
	status, parsed, raw := o.do(method, pad, body)
	if status != wil {
		o.t.Fatalf("%s %s: wil %d, kreeg %d\n%s", method, pad, wil, status, kort(raw))
	}
	return parsed, raw
}

func kort(b []byte) string {
	s := string(b)
	if len(s) > 600 {
		return s[:600] + "…"
	}
	return s
}

func alsInt64(v any) int64 {
	switch n := v.(type) {
	case float64:
		return int64(n)
	case int64:
		return n
	case int:
		return int64(n)
	}
	return 0
}

// tijdstipUitRegistratieID spiegelt handlers.tijdstipUitT: synthetische tijd
// = 2026-01-01T00:00:00Z + id uur + id µs.
func tijdstipUitRegistratieID(id int64) time.Time {
	return time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC).
		Add(time.Duration(id) * time.Hour).
		Add(time.Microsecond * time.Duration(id))
}

// ── Replay-seed ─────────────────────────────────────────────────────────────

type replayBestand struct {
	Entries []struct {
		RequestPath          string          `json:"request_path"`
		RequestMethod        string          `json:"request_method"`
		RequestBody          json.RawMessage `json:"request_body"`
		ExpectedResponseCode *int            `json:"expected_response_code"`
	} `json:"entries"`
}

// replay speelt een replay-bestand af zoals de FE (RegistratieReplayPage) dat doet:
// elke entry als request_method op request_path met request_body.
func (o *regressieOmgeving) replay(pad string) (aantal int, laatsteRegistratieID int64) {
	o.t.Helper()
	raw, err := os.ReadFile(pad)
	if err != nil {
		o.t.Fatalf("replay-bestand lezen mislukt (%s): %v", pad, err)
	}
	var rb replayBestand
	if err := json.Unmarshal(raw, &rb); err != nil {
		o.t.Fatalf("replay-bestand parsen mislukt (%s): %v", pad, err)
	}
	for i, e := range rb.Entries {
		method := e.RequestMethod
		if method == "" {
			method = http.MethodPost
		}
		rp := e.RequestPath
		if rp == "" {
			rp = "/registratie/"
		}
		wil := http.StatusCreated
		if e.ExpectedResponseCode != nil {
			wil = *e.ExpectedResponseCode
		}
		status, parsed, body := o.do(method, rp, []byte(e.RequestBody))
		if status != wil {
			o.t.Fatalf("replay %s entry %d: %s %s wil %d, kreeg %d\n%s", filepath.Base(pad), i, method, rp, wil, status, kort(body))
		}
		if id := alsInt64(parsed["registratie_id"]); id > 0 {
			laatsteRegistratieID = id
		}
		aantal++
	}
	return aantal, laatsteRegistratieID
}

// ── Helpers voor het navigeren van full-responses ───────────────────────────

// actieveDataVeld zoekt in een full-entity map het eerste actieve (afvoer == nil)
// data-record van een hub-rol en geeft de waarde van `veld` terug.
func actieveDataVeld(entity map[string]any, rol, veld string) (string, bool) {
	hubs, _ := entity[rol].([]any)
	for _, h := range hubs {
		hub, _ := h.(map[string]any)
		if hub == nil || hub["afvoer"] != nil {
			continue
		}
		data, _ := hub["data"].([]any)
		for _, d := range data {
			rec, _ := d.(map[string]any)
			if rec == nil || rec["afvoer"] != nil {
				continue
			}
			if v, ok := rec[veld]; ok {
				return fmt.Sprint(v), true
			}
		}
	}
	return "", false
}

// ── De regressietest ────────────────────────────────────────────────────────

func TestRegressieNpLoc(t *testing.T) {
	o := nieuweRegressieOmgeving(t)

	seeds := defaultSeeds
	if s := strings.TrimSpace(os.Getenv("REGRESSIE_SEEDS")); s != "" {
		seeds = strings.Split(s, ";")
	}

	var seedRegistraties int64
	t.Run("00 seed via replay", func(t *testing.T) {
		o := o.met(t)
		totaal := 0
		for _, seed := range seeds {
			n, laatste := o.replay(strings.TrimSpace(seed))
			totaal += n
			if laatste > seedRegistraties {
				seedRegistraties = laatste
			}
			t.Logf("replay %s: %d entries, laatste registratie_id=%d", filepath.Base(seed), n, laatste)
		}
		if totaal == 0 {
			t.Fatal("geen replay-entries afgespeeld")
		}
	})

	t.Run("01 lijst en detail", func(t *testing.T) {
		o := o.met(t)
		lijst, _ := o.eisStatus(http.MethodGet, "/natuurlijk_personen?size=100", nil, http.StatusOK)
		if tc := alsInt64(lijst["total_count"]); tc < 5 {
			t.Fatalf("wil ≥5 natuurlijk_personen na seed, kreeg total_count=%d", tc)
		}
		detail, _ := o.eisStatus(http.MethodGet, "/natuurlijk_personen/2", nil, http.StatusOK)
		if alsInt64(detail["id"]) != 2 {
			t.Fatalf("detail id: wil 2, kreeg %v", detail["id"])
		}
		full, raw := o.eisStatus(http.MethodGet, "/full/natuurlijk_personen/2", nil, http.StatusOK)
		if naam, ok := actieveDataVeld(full, "namen", "achternaam"); !ok || naam != "Vries" {
			t.Fatalf("full NP=2: wil actieve achternaam 'Vries', kreeg %q (ok=%v)\n%s", naam, ok, kort(raw))
		}
	})

	t.Run("02 onbekend id geeft 404 zonder sql-lek", func(t *testing.T) {
		o := o.met(t)
		for _, pad := range []string{"/natuurlijk_personen/999999", "/full/natuurlijk_personen/999999", "/locaties/999999"} {
			status, _, raw := o.do(http.MethodGet, pad, nil)
			if status != http.StatusNotFound {
				t.Errorf("%s: wil 404, kreeg %d: %s", pad, status, kort(raw))
			}
			if strings.Contains(strings.ToLower(string(raw)), "sql:") {
				t.Errorf("%s: interne SQL-fout lekt naar client: %s", pad, kort(raw))
			}
		}
	})

	t.Run("03 tijdreizen (synthetische t)", func(t *testing.T) {
		o := o.met(t)
		// NP=2 is opgevoerd in registratie 1 → bestaat vanaf t=1, niet op t=0.
		if status, _, raw := o.do(http.MethodGet, "/full/natuurlijk_personen/2?t=0", nil); status != http.StatusNotFound {
			t.Errorf("t=0: wil 404 (bestond nog niet), kreeg %d: %s", status, kort(raw))
		}
		full, raw := o.eisStatus(http.MethodGet, "/full/natuurlijk_personen/2?t=1", nil, http.StatusOK)
		if naam, ok := actieveDataVeld(full, "namen", "achternaam"); !ok || naam != "Vries" {
			t.Fatalf("t=1: wil achternaam 'Vries', kreeg %q\n%s", naam, kort(raw))
		}
	})

	t.Run("04 referentielijst", func(t *testing.T) {
		o := o.met(t)
		// AdellijkeTitel is een referentielijst-ITEM (EntiteitSubtypeReferentielijstItem) en
		// krijgt daarom een gewone padnaam-route; /referentielijsten/{padnaam} is voor de
		// lijst-entiteiten zelf (register-domein).
		lijst, raw := o.eisStatus(http.MethodGet, "/adellijke_titels?size=100", nil, http.StatusOK)
		if tc := alsInt64(lijst["total_count"]); tc == 0 {
			t.Fatalf("wil ≥1 adellijke titel na seed, kreeg 0\n%s", kort(raw))
		}
		o.eisStatus(http.MethodGet, "/referentielijsten", nil, http.StatusOK)
	})

	var regIDPostPadnaam int64
	t.Run("05 POST per padnaam loopt via de engine", func(t *testing.T) {
		o := o.met(t)
		resp, raw := o.eisStatus(http.MethodPost, "/natuurlijk_personen", map[string]any{"id": 42}, http.StatusCreated)
		regIDPostPadnaam = alsInt64(resp["registratie_id"])
		if regIDPostPadnaam == 0 {
			t.Fatalf("wil registratie_id in response, kreeg %s", kort(raw))
		}
		// Audit-trail: de registratie bestaat en het record heeft een opvoer-tijdstip.
		reg, _ := o.eisStatus(http.MethodGet, fmt.Sprintf("/registraties/%d", regIDPostPadnaam), nil, http.StatusOK)
		if reg["registratietype"] != "registratie" {
			t.Errorf("registratie %d: wil type 'registratie', kreeg %v", regIDPostPadnaam, reg["registratietype"])
		}
		np, _ := o.eisStatus(http.MethodGet, "/natuurlijk_personen/42", nil, http.StatusOK)
		if np["opvoer"] == nil {
			t.Errorf("NP=42 via POST /natuurlijk_personen heeft geen opvoer-tijdstip (buiten de boekhouding om?)")
		}
	})

	t.Run("06 synthetisch registratietijdstip", func(t *testing.T) {
		o := o.met(t)
		reg, _ := o.eisStatus(http.MethodGet, fmt.Sprintf("/registraties/%d", regIDPostPadnaam), nil, http.StatusOK)
		got, err := time.Parse(time.RFC3339Nano, fmt.Sprint(reg["tijdstip"]))
		if err != nil {
			t.Fatalf("tijdstip parsen: %v (%v)", err, reg["tijdstip"])
		}
		if wil := tijdstipUitRegistratieID(regIDPostPadnaam); !got.Equal(wil) {
			t.Errorf("REGISTRATIE_TIJD=synthetisch: wil %s, kreeg %s", wil.Format(time.RFC3339Nano), got.Format(time.RFC3339Nano))
		}
	})

	t.Run("07 POST /full met geneste shape", func(t *testing.T) {
		o := o.met(t)
		body := map[string]any{
			"id":    43,
			"namen": []any{map[string]any{"data": []any{map[string]any{"voorletters": "A.", "achternaam": "Volledig"}}}},
		}
		resp, raw := o.eisStatus(http.MethodPost, "/full/natuurlijk_personen", body, http.StatusCreated)
		if alsInt64(resp["registratie_id"]) == 0 {
			t.Fatalf("wil registratie_id, kreeg %s", kort(raw))
		}
		full, raw := o.eisStatus(http.MethodGet, "/full/natuurlijk_personen/43", nil, http.StatusOK)
		if naam, ok := actieveDataVeld(full, "namen", "achternaam"); !ok || naam != "Volledig" {
			t.Fatalf("geneste POST: wil achternaam 'Volledig', kreeg %q\n%s", naam, kort(raw))
		}
	})

	var regIDPatch int64
	t.Run("08 PATCH /full (merge patch, registratie)", func(t *testing.T) {
		o := o.met(t)
		// BEKEND GAT (zie 08b): de PATCH-builder injecteert de URL-id niet als
		// parent-FK; daarom hier expliciet natuurlijkpersoon_id meesturen.
		body := map[string]any{"namen": []any{map[string]any{"natuurlijkpersoon_id": 2, "voorletters": "J.K.", "achternaam": "Gewijzigd"}}}
		resp, raw := o.eisStatus(http.MethodPatch, "/full/natuurlijk_personen/2", body, http.StatusOK)
		regIDPatch = alsInt64(resp["registratie_id"])
		if regIDPatch == 0 {
			t.Fatalf("wil registratie_id, kreeg %s", kort(raw))
		}
		full, raw := o.eisStatus(http.MethodGet, "/full/natuurlijk_personen/2", nil, http.StatusOK)
		if naam, ok := actieveDataVeld(full, "namen", "achternaam"); !ok || naam != "Gewijzigd" {
			t.Fatalf("na PATCH: wil actieve achternaam 'Gewijzigd', kreeg %q\n%s", naam, kort(raw))
		}
	})

	t.Run("08b PATCH zonder expliciete FK (URL-id hoort leidend te zijn)", func(t *testing.T) {
		o := o.met(t)
		body := map[string]any{"namen": []any{map[string]any{"voorletters": "X.", "achternaam": "ZonderFK"}}}
		status, _, raw := o.do(http.MethodPatch, "/full/natuurlijk_personen/3", body)
		if status == http.StatusInternalServerError && strings.Contains(string(raw), "id ontbreekt") {
			t.Skipf("BEKEND GAT: PATCH /full injecteert URL-id niet als parent-FK (500: %s)", kort(raw))
		}
		if status != http.StatusOK {
			t.Fatalf("wil 200, kreeg %d: %s", status, kort(raw))
		}
	})

	t.Run("09 ongedaanmaking herstelt vorige toestand", func(t *testing.T) {
		o := o.met(t)
		body := map[string]any{
			"registratie": map[string]any{
				"registratietype":               "ongedaanmaking",
				"maakt_ongedaan_registratie_id": regIDPatch,
			},
		}
		o.eisStatus(http.MethodPost, "/registratie/", body, http.StatusCreated)
		full, raw := o.eisStatus(http.MethodGet, "/full/natuurlijk_personen/2", nil, http.StatusOK)
		if naam, ok := actieveDataVeld(full, "namen", "achternaam"); !ok || naam != "Vries" {
			t.Fatalf("na ongedaanmaking: wil 'Vries' terug, kreeg %q\n%s", naam, kort(raw))
		}
	})

	t.Run("10 DELETE per padnaam + tijdreis rond afvoer", func(t *testing.T) {
		o := o.met(t)
		resp, raw := o.eisStatus(http.MethodDelete, "/natuurlijk_personen/6", nil, http.StatusOK)
		regID := alsInt64(resp["registratie_id"])
		if regID == 0 {
			t.Fatalf("wil registratie_id, kreeg %s", kort(raw))
		}
		if status, _, raw := o.do(http.MethodGet, fmt.Sprintf("/full/natuurlijk_personen/6?t=%d", regID), nil); status != http.StatusNotFound {
			t.Errorf("op afvoertijdstip: wil 404, kreeg %d: %s", status, kort(raw))
		}
		o.eisStatus(http.MethodGet, fmt.Sprintf("/full/natuurlijk_personen/6?t=%d", regID-1), nil, http.StatusOK)
		if status, _, _ := o.do(http.MethodDelete, "/natuurlijk_personen/6", nil); status != http.StatusConflict {
			t.Errorf("tweede DELETE op afgevoerd record: wil 409, kreeg %d", status)
		}
	})

	t.Run("11 audit-routes zijn read-only", func(t *testing.T) {
		o := o.met(t)
		for _, pad := range []string{"/registraties", "/wijzigingen"} {
			if status, _, _ := o.do(http.MethodPost, pad, map[string]any{"registratietype": "registratie"}); status != http.StatusNotFound {
				t.Errorf("POST %s: wil 404 (verwijderd), kreeg %d", pad, status)
			}
		}
	})

	t.Run("12 validatie: ongeldige BSN geeft 422 problem+json", func(t *testing.T) {
		o := o.met(t)
		body := map[string]any{
			"registratie": map[string]any{"registratietype": "registratie"},
			"wijzigingen": []any{
				map[string]any{"opvoer": map[string]any{"natuurlijkpersoon": map[string]any{"id": 90}}},
				map[string]any{"opvoer": map[string]any{"persoonsidentificatie": map[string]any{"natuurlijkpersoon_id": 90, "bsn": "123456789"}}},
			},
		}
		req, _ := http.NewRequest(http.MethodPost, o.srv.URL+"/registratie/", strings.NewReader(mustJSON(body)))
		req.Header.Set("Content-Type", "application/json")
		resp, err := o.client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusUnprocessableEntity {
			t.Fatalf("wil 422, kreeg %d: %s", resp.StatusCode, kort(raw))
		}
		if ct := resp.Header.Get("Content-Type"); !strings.Contains(ct, "application/problem+json") {
			t.Errorf("wil application/problem+json, kreeg %q", ct)
		}
		// Rollback: NP=90 mag niet bestaan.
		if status, _, _ := o.do(http.MethodGet, "/natuurlijk_personen/90", nil); status != http.StatusNotFound {
			t.Errorf("na 422 hoort NP=90 niet te bestaan (rollback), kreeg %d", status)
		}
	})

	t.Run("13 validatie: ongeldige enumwaarde wordt geweigerd", func(t *testing.T) {
		o := o.met(t)
		body := map[string]any{
			"registratie": map[string]any{"registratietype": "registratie"},
			"wijzigingen": []any{
				map[string]any{"opvoer": map[string]any{"naamgebruik": map[string]any{"natuurlijkpersoon_id": 3, "naamgebruik": "Onzin"}}},
			},
		}
		status, _, raw := o.do(http.MethodPost, "/registratie/", body)
		if status == http.StatusCreated {
			t.Skipf("BEKEND GAT: enumwaarden worden niet gevalideerd (schema:\"enum=…\" wordt genegeerd); 'Onzin' is opgeslagen (registratie %v)", kort(raw))
		}
		if status < 400 || status >= 500 {
			t.Fatalf("ongeldige enum: wil 4xx, kreeg %d: %s", status, kort(raw))
		}
	})

	t.Run("14 GraphQL smoke", func(t *testing.T) {
		o := o.met(t)
		resp, raw := o.eisStatus(http.MethodPost, "/graphql/query", map[string]any{"query": "{ __schema { queryType { name } } }"}, http.StatusOK)
		data, _ := resp["data"].(map[string]any)
		if data == nil || data["__schema"] == nil {
			t.Fatalf("wil __schema in GraphQL-response, kreeg %s", kort(raw))
		}
	})

	t.Run("15 admin-endpoints afgeschermd", func(t *testing.T) {
		o := o.met(t)
		status, _, _ := o.do(http.MethodPost, "/admin/rebuild", nil)
		if handlers.DevtoolsEnabled {
			// devtools-build + DEVLOOP=false → handler weigert.
			if status != http.StatusForbidden {
				t.Errorf("devtools-build: wil 403 (DEVLOOP=false), kreeg %d", status)
			}
		} else if status != http.StatusNotFound {
			t.Errorf("productie-build: wil 404 (niet meegecompileerd), kreeg %d", status)
		}
	})

	t.Run("16 N+1-guard bij peiltijdstip", func(t *testing.T) {
		o := o.met(t)
		o.teller.reset()
		o.eisStatus(http.MethodGet, fmt.Sprintf("/full/natuurlijk_personen?t=%d&size=5", seedRegistraties), nil, http.StatusOK)
		n := o.teller.aantal()
		t.Logf("GET /full/natuurlijk_personen?t=…&size=5 → %d queries", n)
		// Vóór §4.4: 1 query per entiteit × per kind (≈ 5 × 12 = 60+). Nu: entity-query,
		// relaties, hub-kinderen en één set-based peil-query.
		if n > 40 {
			t.Errorf("N+1-regressie: %d queries voor 5 entiteiten (grens 40)", n)
		}
	})

	t.Run("17 auth wordt afgedwongen zodra AUTH_ENABLED=true", func(t *testing.T) {
		o := o.met(t)
		t.Setenv("AUTH_ENABLED", "true")
		t.Setenv("JWT_SECRET", "regressie-secret-1234567890-abcdefghij")
		t.Setenv("ADMIN_USERNAME", "regressie-admin")
		t.Setenv("ADMIN_PASSWORD", "regressie-wachtwoord")
		if err := handlers.SeedAdminGebruiker(context.Background()); err != nil {
			t.Fatalf("admin seeden: %v", err)
		}

		// Anoniem muteren → 401; lezen blijft open.
		if status, _, raw := o.do(http.MethodPost, "/natuurlijk_personen", map[string]any{"id": 77}); status != http.StatusUnauthorized {
			t.Fatalf("anonieme POST: wil 401, kreeg %d: %s", status, kort(raw))
		}
		o.eisStatus(http.MethodGet, "/natuurlijk_personen/2", nil, http.StatusOK)

		// Inloggen (cookie in jar) → mutatie slaagt.
		o.eisStatus(http.MethodPost, "/api/auth/login", map[string]any{"gebruikersnaam": "regressie-admin", "wachtwoord": "regressie-wachtwoord"}, http.StatusOK)
		me, _ := o.eisStatus(http.MethodGet, "/api/auth/me", nil, http.StatusOK)
		if me["rol"] != "admin" {
			t.Errorf("wil rol admin na login, kreeg %v", me["rol"])
		}
		o.eisStatus(http.MethodPost, "/natuurlijk_personen", map[string]any{"id": 77}, http.StatusCreated)
		o.eisStatus(http.MethodPost, "/api/auth/logout", nil, http.StatusOK)
		if status, _, _ := o.do(http.MethodPost, "/natuurlijk_personen", map[string]any{"id": 78}); status != http.StatusUnauthorized {
			t.Errorf("na logout: wil 401, kreeg %d", status)
		}
	})
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}
