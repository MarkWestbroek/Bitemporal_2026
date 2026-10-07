package handlers

// SSE-kanaal van het operatielog (plan 2026-10-07 Projectsync, stap 2, onderdeel 5).
//
//   GET /api/studio/projecten/:id/events[?vanaf=N]      Content-Type: text/event-stream
//
// Eén open HTTP-verbinding per Studio-tab; elke bevestigde operatie gaat als
// event `op` (id = volgnummer, data = StudioOpUit als JSON) naar alle abonnees
// van dat project. Bij (her)verbinden speelt de server eerst na wat de client
// miste: `Last-Event-ID` (zet de browser zelf bij een herverbinding) of
// `?vanaf=N`, beide = laatst verwerkte volgnummer. Zo blijft de garantie van
// de poll: geen gat, nooit overheen springen.
//
// Eén hub per proces (in-memory). Meerdere API-instanties zouden Postgres
// LISTEN/NOTIFY nodig hebben; dat is nu niet aan de orde (app en pf zijn
// aparte instanties met elk hun eigen hub). Keepalive-commentaar elke 15 s
// houdt proxies (nginx in de frontend-image, Caddy) van een time-out af;
// `X-Accel-Buffering: no` zet het bufferen van nginx uit.

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

const (
	sseKeepalive     = 15 * time.Second
	sseBuffer        = 256 // events per abonnee; vol = afkoppelen, de client herverbindt en speelt na
	sseNaspeelLimiet = 1000
)

// sseEvent is één regelgroep op de stream: naam ("op" | "presence"), id (volgnummer bij "op") en data.
type sseEvent struct {
	naam string
	id   int64
	data []byte
}

type sseAbonnee struct {
	ch       chan sseEvent
	clientID string // browsertab (uit ?client=), voor presence en echo-filter
	actor    string // gebruikersnaam (leeg zonder auth)
}

// StudioAanwezige is één open verbinding in de presence-lijst (onderdeel 7).
type StudioAanwezige struct {
	ClientID string `json:"clientId"`
	Actor    string `json:"actor"`
}

// studioHub verdeelt bevestigde operaties over de open SSE-verbindingen per project.
type studioHub struct {
	mu         sync.Mutex
	perProject map[string]map[*sseAbonnee]struct{}
}

var hub = &studioHub{perProject: map[string]map[*sseAbonnee]struct{}{}}

func (h *studioHub) abonneer(projectID, clientID, actor string) *sseAbonnee {
	a := &sseAbonnee{ch: make(chan sseEvent, sseBuffer), clientID: clientID, actor: actor}
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.perProject[projectID] == nil {
		h.perProject[projectID] = map[*sseAbonnee]struct{}{}
	}
	h.perProject[projectID][a] = struct{}{}
	h.zendPresence(projectID)
	return a
}

func (h *studioHub) afmelden(projectID string, a *sseAbonnee) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if m := h.perProject[projectID]; m != nil {
		if _, was := m[a]; !was {
			return
		}
		delete(m, a)
		if len(m) == 0 {
			delete(h.perProject, projectID)
			return
		}
		h.zendPresence(projectID)
	}
}

// aanwezigen geeft de open verbindingen van een project (lock moet vast zijn).
func (h *studioHub) aanwezigen(projectID string) []StudioAanwezige {
	uit := make([]StudioAanwezige, 0, len(h.perProject[projectID]))
	for a := range h.perProject[projectID] {
		uit = append(uit, StudioAanwezige{ClientID: a.clientID, Actor: a.actor})
	}
	return uit
}

// zendPresence stuurt de actuele lijst naar alle abonnees van het project (lock moet vast zijn).
// Wie dit niet bijhoudt wordt niet afgekoppeld: presence is bijzaak.
func (h *studioHub) zendPresence(projectID string) {
	data, err := json.Marshal(gin.H{"aanwezig": h.aanwezigen(projectID)})
	if err != nil {
		return
	}
	for a := range h.perProject[projectID] {
		select {
		case a.ch <- sseEvent{naam: "presence", data: data}:
		default:
		}
	}
}

// Aanwezigen — diagnose/tests: de presence-lijst van een project.
func Aanwezigen(projectID string) []StudioAanwezige {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	return hub.aanwezigen(projectID)
}

// publiceer levert de operaties aan alle abonnees; een volle abonnee wordt
// afgekoppeld (kanaal dicht) — de browser herverbindt en speelt na vanaf zijn
// Last-Event-ID, dus er gaat niets verloren.
func (h *studioHub) publiceer(projectID string, ops []model.StudioProjectOp) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for a := range h.perProject[projectID] {
		if !leverAan(a, ops) {
			close(a.ch)
			delete(h.perProject[projectID], a)
		}
	}
}

// leverAan zet de operaties in het kanaal van één abonnee; false = kanaal vol.
func leverAan(a *sseAbonnee, ops []model.StudioProjectOp) bool {
	for _, op := range ops {
		data, err := json.Marshal(studioOpUit(op))
		if err != nil {
			continue
		}
		select {
		case a.ch <- sseEvent{naam: "op", id: op.Volgnummer, data: data}:
		default:
			return false
		}
	}
	return true
}

// AantalSSEAbonnees — diagnose/tests.
func AantalSSEAbonnees(projectID string) int {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	return len(hub.perProject[projectID])
}

// KoppelStudioSSE hangt de hub aan het operatielog (aanroepen vanuit main).
func KoppelStudioSSE() {
	NaStudioProjectOps = hub.publiceer
}

func schrijfSSEOp(w gin.ResponseWriter, op model.StudioProjectOp) error {
	data, err := json.Marshal(studioOpUit(op))
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(w, "id: %d\nevent: op\ndata: %s\n\n", op.Volgnummer, data)
	return err
}

// schrijfSSEEvent schrijft één event uit het kanaal; "op" met id, andere zonder.
func schrijfSSEEvent(w gin.ResponseWriter, ev sseEvent) error {
	var err error
	if ev.naam == "op" {
		_, err = fmt.Fprintf(w, "id: %d\nevent: op\ndata: %s\n\n", ev.id, ev.data)
	} else {
		_, err = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", ev.naam, ev.data)
	}
	return err
}

// MaakStudioProjectEventsHandler — GET /api/studio/projecten/:id/events
func MaakStudioProjectEventsHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		ctx := c.Request.Context()
		project := new(model.StudioProject)
		err := DB.NewSelect().Model(project).Column("id", "tot_volgnummer").Where("id = ?", id).Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden op de server."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		// Vanaf waar naspelen: Last-Event-ID (herverbinding) wint van ?vanaf.
		vanaf, _ := strconv.ParseInt(strings.TrimSpace(c.Query("vanaf")), 10, 64)
		if h := strings.TrimSpace(c.GetHeader("Last-Event-ID")); h != "" {
			if n, err := strconv.ParseInt(h, 10, 64); err == nil {
				vanaf = n
			}
		}
		// Compactie (onderdeel 6): te oud om bij te praten → de client laadt de
		// snapshot opnieuw en verbindt dan weer (met de nieuwe grens als vanaf).
		if vanaf < project.TotVolgnummer {
			w := c.Writer
			w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache, no-transform")
			w.Header().Set("X-Accel-Buffering", "no")
			w.WriteHeader(http.StatusOK)
			fmt.Fprintf(w, "event: snapshot\ndata: {\"totVolgnummer\": %d}\n\n", project.TotVolgnummer)
			w.Flush()
			return
		}

		w := c.Writer
		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache, no-transform")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("X-Accel-Buffering", "no") // nginx: niet bufferen
		w.WriteHeader(http.StatusOK)
		// Eerst abonneren, dan naspelen: wat tussendoor binnenkomt zit in het
		// kanaal en wordt op volgnummer ontdubbeld. Presence (onderdeel 7): de
		// client-id uit ?client= en de ingelogde gebruiker.
		ab := hub.abonneer(id, strings.TrimSpace(c.Query("client")), studioActor(c))
		defer hub.afmelden(id, ab)

		laatste := vanaf
		for {
			var rijen []model.StudioProjectOp
			err := DB.NewSelect().Model(&rijen).
				Where("project_id = ? AND volgnummer > ?", id, laatste).
				OrderExpr("volgnummer ASC").Limit(sseNaspeelLimiet).Scan(ctx)
			if err != nil || len(rijen) == 0 {
				break
			}
			for _, r := range rijen {
				if err := schrijfSSEOp(w, r); err != nil {
					return
				}
				laatste = r.Volgnummer
			}
			if len(rijen) < sseNaspeelLimiet {
				break
			}
		}
		// Welkom: de client weet waar hij staat (ook als er niets na te spelen was).
		fmt.Fprintf(w, "event: stand\ndata: {\"laatste\": %d}\n\n", laatste)
		w.Flush()

		tikker := time.NewTicker(sseKeepalive)
		defer tikker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case ev, open := <-ab.ch:
				if !open {
					return // vol geweest: de browser herverbindt en speelt na
				}
				if ev.naam == "op" && ev.id <= laatste {
					continue // al nagespeeld
				}
				if err := schrijfSSEEvent(w, ev); err != nil {
					return
				}
				if ev.naam == "op" {
					laatste = ev.id
				}
				// Wat nog klaarstaat meteen mee, dan één flush.
			leeg:
				for {
					select {
					case ev2, open2 := <-ab.ch:
						if !open2 {
							w.Flush()
							return
						}
						if ev2.naam == "op" && ev2.id <= laatste {
							continue
						}
						if err := schrijfSSEEvent(w, ev2); err != nil {
							return
						}
						if ev2.naam == "op" {
							laatste = ev2.id
						}
					default:
						break leeg
					}
				}
				w.Flush()
			case <-tikker.C:
				if _, err := fmt.Fprint(w, ": keepalive\n\n"); err != nil {
					return
				}
				w.Flush()
			}
		}
	}
}
