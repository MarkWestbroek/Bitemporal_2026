package handlers

// SSE-kanaal (projectsync stap 2, onderdeel 5): naspelen vanaf Last-Event-ID,
// live events na een POST, keepalive-vorm. Draait tegen PostgreSQL
// (STUDIO_TEST_PG_DSN), net als de andere Studio-project-tests.

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// leesEvents leest SSE-events tot `aantal` events van type `op` binnen zijn of de tijd om is.
func leesEvents(t *testing.T, body *bufio.Reader, aantal int, timeout time.Duration) []StudioOpUit {
	t.Helper()
	deadline := time.Now().Add(timeout)
	var uit []StudioOpUit
	var event string
	done := make(chan struct{})
	go func() {
		defer close(done)
		for len(uit) < aantal {
			regel, err := body.ReadString('\n')
			if err != nil {
				return
			}
			regel = strings.TrimRight(regel, "\r\n")
			switch {
			case strings.HasPrefix(regel, "event: "):
				event = strings.TrimPrefix(regel, "event: ")
			case strings.HasPrefix(regel, "data: "):
				if event == "op" {
					var o StudioOpUit
					if err := json.Unmarshal([]byte(strings.TrimPrefix(regel, "data: ")), &o); err == nil {
						uit = append(uit, o)
					}
				}
				event = ""
			}
		}
	}()
	select {
	case <-done:
	case <-time.After(time.Until(deadline)):
	}
	return uit
}

func TestStudioProjectSSE_NaspelenEnLive(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	KoppelStudioSSE()
	defer func() { NaStudioProjectOps = nil }()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/api/studio/projecten", MaakStudioProjectAanmakenHandler())
	r.POST("/api/studio/projecten/:id/ops", MaakStudioProjectOpsToevoegenHandler())
	r.GET("/api/studio/projecten/:id/events", MaakStudioProjectEventsHandler())
	srv := httptest.NewServer(r)
	defer srv.Close()

	const pid = "test-sse-0001"
	inhoud := map[string]any{"formaat": "studio-project", "versie": 3}
	rec := studioDoe(r, http.MethodPost, "/api/studio/projecten", map[string]any{"id": pid, "naam": "SSE", "inhoud": inhoud})
	if rec.Code != http.StatusCreated {
		t.Fatalf("project: %d %s", rec.Code, rec.Body.String())
	}
	batch := func(client string, n int) map[string]any {
		ops := make([]any, 0, n)
		for i := 0; i < n; i++ {
			ops = append(ops, map[string]any{"lokaalNr": i + 1, "store": "model:uml", "op": "addElement", "args": []any{map[string]any{"id": client}}})
		}
		return map[string]any{"clientId": client, "ops": ops}
	}
	// Vooraf: 3 operaties in het log (volgnummers 1..3).
	if rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/"+pid+"/ops", batch("vooraf", 3)); rec.Code != http.StatusCreated {
		t.Fatalf("ops vooraf: %d %s", rec.Code, rec.Body.String())
	}

	// Verbinden met Last-Event-ID: 1 → naspelen 2 en 3.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/studio/projecten/"+pid+"/events", nil)
	req.Header.Set("Last-Event-ID", "1")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("verbinden: %v", err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content-type: %q", ct)
	}
	if resp.Header.Get("X-Accel-Buffering") != "no" {
		t.Fatalf("X-Accel-Buffering ontbreekt")
	}
	body := bufio.NewReader(resp.Body)
	nagespeeld := leesEvents(t, body, 2, 3*time.Second)
	if len(nagespeeld) != 2 || nagespeeld[0].Volgnummer != 2 || nagespeeld[1].Volgnummer != 3 {
		t.Fatalf("naspelen: %+v", nagespeeld)
	}

	// Abonnee is aangemeld; een nieuwe batch komt live door.
	wacht := time.Now().Add(2 * time.Second)
	for AantalSSEAbonnees(pid) == 0 && time.Now().Before(wacht) {
		time.Sleep(20 * time.Millisecond)
	}
	if AantalSSEAbonnees(pid) != 1 {
		t.Fatalf("abonnees: %d", AantalSSEAbonnees(pid))
	}
	if rec = studioDoe(r, http.MethodPost, "/api/studio/projecten/"+pid+"/ops", batch("live", 2)); rec.Code != http.StatusCreated {
		t.Fatalf("ops live: %d %s", rec.Code, rec.Body.String())
	}
	live := leesEvents(t, body, 2, 3*time.Second)
	if len(live) != 2 || live[0].Volgnummer != 4 || live[1].Volgnummer != 5 || live[0].ClientID != "live" {
		t.Fatalf("live: %+v", live)
	}

	// Compactie: snapshot t/m 4 → wie met Last-Event-ID 2 komt krijgt "snapshot".
	r.PUT("/api/studio/projecten/:id", MaakStudioProjectOpslaanHandler())
	if rec = studioDoe(r, http.MethodPut, "/api/studio/projecten/"+pid, map[string]any{"inhoud": inhoud, "versie": 1, "tot_volgnummer": 4}); rec.Code != http.StatusOK {
		t.Fatalf("PUT snapshot: %d %s", rec.Code, rec.Body.String())
	}
	req2, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/studio/projecten/"+pid+"/events", nil)
	req2.Header.Set("Last-Event-ID", "2")
	resp2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatalf("verbinden 2: %v", err)
	}
	alles := make([]byte, 0, 256)
	buf := make([]byte, 256)
	for {
		n, err := resp2.Body.Read(buf)
		alles = append(alles, buf[:n]...)
		if err != nil {
			break
		}
	}
	resp2.Body.Close()
	if !strings.Contains(string(alles), "event: snapshot") || !strings.Contains(string(alles), `"totVolgnummer": 4`) {
		t.Fatalf("snapshot-event verwacht, kreeg: %q", string(alles))
	}

	// Afsluiten → abonnee weg.
	cancel()
	wacht = time.Now().Add(2 * time.Second)
	for AantalSSEAbonnees(pid) != 0 && time.Now().Before(wacht) {
		time.Sleep(20 * time.Millisecond)
	}
	if AantalSSEAbonnees(pid) != 0 {
		t.Fatalf("abonnee niet afgemeld")
	}
}
