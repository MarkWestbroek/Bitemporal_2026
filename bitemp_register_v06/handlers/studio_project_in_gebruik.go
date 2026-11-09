package handlers

// Een volledige PUT op een Studio-project weigeren zolang anderen er nog in bezig zijn
// (besluit Mark 06-11-2026, "nu liever defensief").
//
// Aanleiding: op cg-test deed een script een PUT (versie 2→3) op project Inrichten terwijl er
// nog een Studio-tab open stond. Die tab wist van niets, stuurde later een `laadModel`-op met
// zijn oude kopie, en daarmee was de PUT voor iedereen weer ongedaan. Een PUT vervangt alleen
// de snapshot-blob; open clients krijgen er geen bericht over. We sturen open clients dus
// geen "herlaad"-bericht, maar weigeren de PUT en laten alles zoals het is.
//
// "Bezig" betekent hier een van beide:
//   - een open SSE-verbinding (/events) van een andere client, of
//   - een operatie van een andere client in de laatste studioInGebruikVenster.
// Het tweede vangt een tab op waarvan de SSE-verbinding even weg is (herverbinden, slaapstand).
//
// De eigen client noemt zich met `clientId` in de body of de header `X-Omnium-Client`
// (de tab-id die de Studio ook bij /ops en /events meestuurt). Zonder clientId, bij een script
// of een oudere Studio, telt elke open verbinding als een ander. Is er niemand anders, dan
// werkt de PUT zoals voorheen, ook "Naar server sturen" en de snapshot van de eigen tab.
// Uitzondering (Mark 06-11): ook naast anderen mag een tab die zelf verbonden is en alle ops
// heeft zijn stand bewaren (isBijgewerkteSnapshot).
//
// Een hele modelvervanging hoort eigenlijk bij versiebeheer (nieuw model of nieuwe versie,
// de oude behouden). Dat is nog niet uitgewerkt; deze weigering is het vangnet tot dan.

import (
	"context"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
)

// studioInGebruikVenster: hoe lang een operatie van een andere client nog als "bezig" telt.
const studioInGebruikVenster = 5 * time.Minute

// StudioAndereClient is één client die de PUT tegenhoudt; `bron` = "verbonden" (open SSE)
// of "recent" (operatie binnen het venster, met het tijdstip).
type StudioAndereClient struct {
	ClientID string     `json:"clientId"`
	Actor    string     `json:"actor"`
	Bron     string     `json:"bron"`
	Laatst   *time.Time `json:"laatst,omitempty"`
}

// recenteOpClient is een samengevatte rij uit het operatielog (per client de laatste op).
type recenteOpClient struct {
	ClientID string
	Actor    string
	Laatst   time.Time
}

// andereClients bepaalt wie er naast `eigen` bezig is. Zuivere functie (testbaar): een lege
// `eigen` maakt iedereen een ander; dubbelen (zelfde clientId verbonden én recent) tellen één
// keer, als "verbonden". Een verbinding zonder clientId telt altijd als een ander.
func andereClients(eigen string, verbonden []StudioAanwezige, recent []recenteOpClient) []StudioAndereClient {
	eigen = strings.TrimSpace(eigen)
	isEigen := func(id string) bool { return eigen != "" && id == eigen }
	gezien := map[string]bool{}
	uit := []StudioAndereClient{}
	for _, a := range verbonden {
		if isEigen(a.ClientID) {
			continue
		}
		if a.ClientID != "" {
			if gezien[a.ClientID] {
				continue
			}
			gezien[a.ClientID] = true
		}
		uit = append(uit, StudioAndereClient{ClientID: a.ClientID, Actor: a.Actor, Bron: "verbonden"})
	}
	for _, r := range recent {
		if isEigen(r.ClientID) || gezien[r.ClientID] {
			continue
		}
		if r.ClientID != "" {
			gezien[r.ClientID] = true
		}
		t := r.Laatst
		uit = append(uit, StudioAndereClient{ClientID: r.ClientID, Actor: r.Actor, Bron: "recent", Laatst: &t})
	}
	return uit
}

// recenteOpClients leest per client de laatste operatie binnen het venster.
// Variabele zodat tests hem kunnen vervangen. Bij een afgeleid project tellen de van de
// ouder gekopieerde operaties (t/m basis_volgnummer) niet mee: die clients werken in de
// ouder, niet hier (studio_project_afsplitsen.go). Voor een gewoon project is de basis 0.
var recenteOpClients = func(ctx context.Context, db bun.IDB, projectID string, sinds time.Time) ([]recenteOpClient, error) {
	var rijen []recenteOpClient
	err := db.NewSelect().Model((*model.StudioProjectOp)(nil)).
		ColumnExpr("client_id, max(actor) AS actor, max(tijd) AS laatst").
		Where("project_id = ? AND tijd >= ?", projectID, sinds).
		Where("volgnummer > COALESCE((SELECT p.basis_volgnummer FROM studio_projecten p WHERE p.id = ?), 0)", projectID).
		Group("client_id").
		OrderExpr("laatst DESC").
		Scan(ctx, &rijen)
	return rijen, err
}

// isVerbonden: heeft deze clientId een open SSE-verbinding op het project?
func isVerbonden(projectID, clientID string) bool {
	if clientID == "" {
		return false
	}
	for _, a := range Aanwezigen(projectID) {
		if a.ClientID == clientID {
			return true
		}
	}
	return false
}

// isBijgewerkteSnapshot is de uitzondering op de weigering (Mark 06-11, "met de uitzondering"):
// de PUT komt van een tab die zelf live verbonden is (open SSE) en die alle operaties uit het
// log al verwerkt heeft (`tot_volgnummer` ≥ het laatste volgnummer). Zo'n blob is dezelfde stand
// als die van de anderen, dus vervangen verliest niets. Dat dekt de stille compactie en de
// snapshot vóór "Kopieer als SVG-link". Een script zonder SSE-verbinding of een tab die achterloopt
// valt hier niet onder. Grenzen: de server kan niet nagaan of de inhoud echt de som van de ops is;
// hij vertrouwt een bijgewerkte, verbonden tab. Daarom gaat `laadModel` in de Studio voortaan als
// diff (OMNIUM-UI) en niet meer als hele vervanging.
func isBijgewerkteSnapshot(ctx context.Context, db bun.IDB, projectID, eigenClient string, totVolgnummer *int64) bool {
	if totVolgnummer == nil || !isVerbonden(projectID, strings.TrimSpace(eigenClient)) {
		return false
	}
	return *totVolgnummer >= laatsteVolgnummerVan(ctx, db, projectID)
}

// projectInGebruik geeft de andere clients die een PUT op het project tegenhouden (leeg = vrij).
func projectInGebruik(ctx context.Context, db bun.IDB, projectID, eigenClient string) ([]StudioAndereClient, error) {
	recent, err := recenteOpClients(ctx, db, projectID, time.Now().Add(-studioInGebruikVenster))
	if err != nil {
		return nil, err
	}
	return andereClients(eigenClient, Aanwezigen(projectID), recent), nil
}
