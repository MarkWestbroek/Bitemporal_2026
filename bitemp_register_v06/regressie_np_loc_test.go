//go:build integration

// regressie_np_loc_test.go — geautomatiseerde regressietest op het np-loc domein.
//
// Draait de échte API in-process (NewRouter + httptest) tegen een échte, eigen
// Postgres-database, seedt np-loc vanuit replay-bestanden (scenario 00) en speelt
// daarna alle declaratieve scenario's uit regressie/scenarios/*.json af — elk als
// eigen subtest, in de volgorde (volgorde, id). Zie regressie_declaratief_test.go
// voor het scenarioformaat en docs/REGRESSIETEST.md voor het geheel.
//
// Bewust een aparte build-tag: `go test -tags integration -run TestRegressieNpLoc -v .`
// (zie scripts/regressie-np-loc.ps1). Zonder DB faalt de test hard — een
// integratietest die stil 'slaagt' zonder database is gevaarlijker dan een die
// niet draait.
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
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
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
	t      testing.TB
	srv    *httptest.Server
	client *http.Client
	db     *bun.DB
	teller *queryTeller
}

func nieuweRegressieOmgeving(t testing.TB) *regressieOmgeving {
	t.Helper()
	dsn := strings.TrimSpace(os.Getenv("REGRESSIE_DATABASE_URL"))
	if dsn == "" {
		dsn = defaultRegressieDSN
	}
	if strings.Contains(dsn, "bitemp_go_db_v06") {
		t.Fatalf("weiger te draaien tegen de dev-database (%s); gebruik een dedicated regressie-DB", dsn)
	}

	// Maak de database aan als die nog niet bestaat (hergebruik main.go-logica).
	// DATABASE_ADMIN_URL bewust negeren: die kan naar een andere Postgres wijzen
	// (bv. de dev-DB op 5432), waardoor de DB elders wordt aangemaakt dan waar
	// we verbinden. De admin-DSN wordt dan uit de regressie-DSN zelf afgeleid.
	t.Setenv("DATABASE_ADMIN_URL", "")
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
func (o *regressieOmgeving) met(t testing.TB) *regressieOmgeving {
	kopie := *o
	kopie.t = t
	return &kopie
}

// doRaw voert een request uit zonder de test af te breken: geeft status, headers,
// rauwe body en een eventuele transportfout terug (gebruikt door de load-runner).
func (o *regressieOmgeving) doRaw(method, pad string, body []byte) (int, http.Header, []byte, error) {
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, o.srv.URL+pad, reader)
	if err != nil {
		return 0, nil, nil, err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := o.client.Do(req)
	if err != nil {
		return 0, nil, nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, resp.Header, raw, nil
}

// do voert een request uit en geeft (status, geparste JSON-body of nil, rauwe body).
func (o *regressieOmgeving) do(method, pad string, body []byte) (int, map[string]any, []byte) {
	o.t.Helper()
	status, _, raw, err := o.doRaw(method, pad, body)
	if err != nil {
		o.t.Fatalf("%s %s: %v", method, pad, err)
	}
	var parsed map[string]any
	_ = json.Unmarshal(raw, &parsed)
	return status, parsed, raw
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

// ── Replay ──────────────────────────────────────────────────────────────────

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

// seedViaReplay speelt de seed-bestanden af en geeft het laatste registratie-id terug.
func (o *regressieOmgeving) seedViaReplay() int64 {
	o.t.Helper()
	seeds := defaultSeeds
	if s := strings.TrimSpace(os.Getenv("REGRESSIE_SEEDS")); s != "" {
		seeds = strings.Split(s, ";")
	}
	var laatsteSeed int64
	totaal := 0
	for _, seed := range seeds {
		n, laatste := o.replay(strings.TrimSpace(seed))
		totaal += n
		if laatste > laatsteSeed {
			laatsteSeed = laatste
		}
		o.t.Logf("replay %s: %d entries, laatste registratie_id=%d", filepath.Base(seed), n, laatste)
	}
	if totaal == 0 {
		o.t.Fatal("geen replay-entries afgespeeld")
	}
	return laatsteSeed
}

// basisVars zijn de ingebouwde variabelen van een gewone (niet-load) run.
func basisVars(seedLaatste int64) map[string]string {
	return map[string]string{
		"seedLaatsteRegistratieID": strconv.FormatInt(seedLaatste, 10),
		"vu":                       "1",
		"iter":                     "1",
		"uniek":                    "110001",
	}
}

// ── De regressietest ────────────────────────────────────────────────────────

func TestRegressieNpLoc(t *testing.T) {
	o := nieuweRegressieOmgeving(t)

	var seedLaatste int64
	t.Run("00 seed via replay", func(t *testing.T) {
		seedLaatste = o.met(t).seedViaReplay()
	})

	globaal := map[string]string{}
	scenarios := laadDeclaratieveScenarios(t)
	if len(scenarios) == 0 {
		t.Fatalf("geen scenario's gevonden in %s", declaratieveScenarioMap)
	}
	for _, sc := range scenarios {
		sc := sc
		t.Run(sc.ID+" "+sc.Naam, func(t *testing.T) {
			if sc.Uit {
				t.Skip("scenario staat uit")
			}
			for k, v := range sc.Env {
				t.Setenv(k, v)
			}
			o.met(t).voerDeclaratiefUit(t, sc, nieuweDeclVars(globaal, basisVars(seedLaatste)))
		})
	}
}
