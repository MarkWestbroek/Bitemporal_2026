package handlers

// aanmelding_handler.go — openbare indiening van een FormulierDefinitie in nieuw-modus
// (stap C van het aanmeldformulier-plan, docs/plans/2026-09-22 §4 B6).
//
//	POST /aanmelding/:formulierId   body: { "wijzigingen": [ { "opvoer": { … } }, … ] }
//
// Anoniem toegankelijk, maar alleen voor formulierdefinities die in de omgevingsvariabele
// OPENBARE_FORMULIEREN staan (komma-gescheiden id's). Dat is bewust géén veld op de
// FormulierDefinitie: een formulier openbaar maken is een autorisatiebesluit van de
// beheerder van de instantie, niet iets wat een FD-wijziging mag regelen (plan §5.4).
//
// De server vertrouwt de inzender niet en dwingt af:
//   - alleen `opvoer`, geen afvoer;
//   - alleen representaties die uit de layout van het formulier volgen: de doelentiteit
//     met haar gegevenselementen/relaties, plus de doelentiteiten van ingebedde
//     subformulieren (`veld.nieuwFormulier`, één niveau diep);
//   - alle entiteit-id's en entiteit-verwijzingen (initiatief_id, organisatie_id van een
//     GE) zijn plaatshouders (`$nieuw.x`): er wordt nooit op een bestaand record geschreven.
//     Secundaire id's van relaties (gemeente_id, organisatie_id in een relatie) mogen wél
//     naar bestaande records wijzen — dat is kiezen, geen wijzigen;
//   - de vaste waarden uit de layout (bv. aanmeldstatus = nieuwe_aanmelding) worden gezet of
//     overschreven; de registratie krijgt bron "aanmeldformulier";
//   - bodylimiet (256 KB) en een eenvoudige rate-limit per IP.
//
// De echte id's worden daarna door de registratie-engine toegekend (registration_plaatshouders.go)
// en teruggegeven als `toegekendeIds`.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

const (
	aanmeldingMaxBody       = 256 * 1024
	aanmeldingLimietAantal  = 10
	aanmeldingLimietVenster = 10 * time.Minute
	aanmeldingBron          = "aanmeldformulier"
)

// OpenbareFormulieren leest OPENBARE_FORMULIEREN (bv. "2,5") — de FormulierDefinitie-id's
// die anoniem ingediend mogen worden.
func OpenbareFormulieren() map[int]bool {
	uit := map[int]bool{}
	for _, deel := range strings.Split(os.Getenv("OPENBARE_FORMULIEREN"), ",") {
		if id, err := strconv.Atoi(strings.TrimSpace(deel)); err == nil && id > 0 {
			uit[id] = true
		}
	}
	return uit
}

// formulierDefinitie is wat de handler van een FD nodig heeft.
type formulierDefinitie struct {
	ID       int
	Naam     string
	Doeltype string
	Status   string
	Layout   map[string]any
}

// laadFormulierDefinitie leest de actuele meta en layout van een FormulierDefinitie
// (formeel actueel: hub en data zonder afvoer; bij meerdere actieve hubs de laatst opgevoerde).
func laadFormulierDefinitie(ctx context.Context, db bun.IDB, id int) (*formulierDefinitie, error) {
	var afgevoerd int
	if err := db.NewRaw(`SELECT COUNT(*) FROM formulierdefinitie WHERE id = ? AND afvoer IS NULL`, id).Scan(ctx, &afgevoerd); err != nil {
		return nil, err
	}
	if afgevoerd == 0 {
		return nil, nil
	}
	fd := &formulierDefinitie{ID: id}
	var meta struct {
		Naam     string `bun:"naam"`
		Doeltype string `bun:"doeltype"`
		Status   string `bun:"status"`
	}
	if err := db.NewRaw(`SELECT d.naam, d.doeltype, d.status
		FROM formulierdefinitie_meta h JOIN formulierdefinitie_meta_data d
		  ON d.formulierdefinitie_id = h.formulierdefinitie_id AND d.rel_id = h.rel_id
		WHERE h.formulierdefinitie_id = ? AND h.afvoer IS NULL AND d.afvoer IS NULL
		ORDER BY h.opvoer DESC, d.versie DESC LIMIT 1`, id).Scan(ctx, &meta); err != nil {
		return nil, err
	}
	fd.Naam, fd.Doeltype, fd.Status = meta.Naam, meta.Doeltype, meta.Status
	var layoutJSON string
	if err := db.NewRaw(`SELECT d.layout_json
		FROM formulierdefinitie_layout h JOIN formulierdefinitie_layout_data d
		  ON d.formulierdefinitie_id = h.formulierdefinitie_id AND d.rel_id = h.rel_id
		WHERE h.formulierdefinitie_id = ? AND h.afvoer IS NULL AND d.afvoer IS NULL
		ORDER BY h.opvoer DESC, d.versie DESC LIMIT 1`, id).Scan(ctx, &layoutJSON); err != nil {
		return nil, err
	}
	if layoutJSON == "" {
		return nil, fmt.Errorf("formulierdefinitie %d heeft geen layout", id)
	}
	if err := json.Unmarshal([]byte(layoutJSON), &fd.Layout); err != nil {
		return nil, fmt.Errorf("layout van formulierdefinitie %d is geen geldige JSON: %w", id, err)
	}
	return fd, nil
}

// wandelLayout bezoekt elk element; ctx is de bron van de omsluitende lijst (of "").
func wandelLayout(el map[string]any, ctx string, fn func(el map[string]any, ctx string)) {
	if el == nil {
		return
	}
	fn(el, ctx)
	kinderen, _ := el["elementen"].([]any)
	if el["type"] == "conditioneel" {
		kinderen, _ = el["dan"].([]any)
	}
	kindCtx := ctx
	if el["type"] == "lijst" {
		kindCtx, _ = el["bron"].(string)
	}
	for _, k := range kinderen {
		if km, ok := k.(map[string]any); ok {
			wandelLayout(km, kindCtx, fn)
		}
	}
}

// subFormulierIDs levert de FD-id's uit `veld.nieuwFormulier` in een layout.
func subFormulierIDs(layout map[string]any) []int {
	gezien := map[int]bool{}
	uit := []int{}
	wandelLayout(layout, "", func(el map[string]any, _ string) {
		if el["type"] != "veld" {
			return
		}
		if s, ok := el["nieuwFormulier"].(string); ok {
			if id, err := strconv.Atoi(strings.TrimSpace(s)); err == nil && !gezien[id] {
				gezien[id] = true
				uit = append(uit, id)
			}
		}
	})
	return uit
}

// veldnamenVanDoeltype: de veldnamen (JSON-sleutels in wijzigingen) die bij een entiteit
// horen: de entiteit zelf en al haar onderliggende GE's/relaties (incl. aanvang/einde).
func veldnamenVanDoeltype(doeltype string) (map[string]bool, error) {
	meta, ok := model.MetaRegistry.GetTypeMeta(doeltype)
	if !ok || meta.Metatype != model.MetatypeEntiteit {
		return nil, fmt.Errorf("doeltype %q is geen entiteit", doeltype)
	}
	uit := map[string]bool{meta.Veldnaam: true}
	for _, kind := range meta.OnderliggendeGegevenselementen {
		if km, ok := model.MetaRegistry.GetTypeMeta(kind.Doeltype); ok && km.Veldnaam != "" {
			uit[km.Veldnaam] = true
		}
	}
	return uit, nil
}

// vasteWaarde is een `veld.vasteWaarde` buiten een lijst: GE-veldnaam + kolom + waarde.
type vasteWaarde struct {
	GEVeldnaam string
	Kolom      string
	Waarde     any
}

// vasteWaardenVanLayout vertaalt top-level velden met vasteWaarde (pad ENT.rol.kolom) naar
// de GE-veldnaam via de JSON-rolnaam van de onderliggende.
func vasteWaardenVanLayout(layout map[string]any, doeltype string) []vasteWaarde {
	meta, ok := model.MetaRegistry.GetTypeMeta(doeltype)
	if !ok {
		return nil
	}
	uit := []vasteWaarde{}
	wandelLayout(layout, "", func(el map[string]any, ctx string) {
		if el["type"] != "veld" || ctx != "" {
			return
		}
		vw, heeft := el["vasteWaarde"]
		if !heeft || vw == nil || vw == "" {
			return
		}
		pad, _ := el["veld"].(string)
		delen := strings.Split(pad, ".")
		if len(delen) != 3 || delen[0] != doeltype {
			return
		}
		for _, kind := range meta.OnderliggendeGegevenselementen {
			if kind.JSONRolnaam == delen[1] || kind.Rolnaam == delen[1] {
				if km, ok := model.MetaRegistry.GetTypeMeta(kind.Doeltype); ok {
					uit = append(uit, vasteWaarde{GEVeldnaam: km.Veldnaam, Kolom: delen[2], Waarde: vw})
				}
			}
		}
	})
	return uit
}

type aanmeldingWijziging map[string]map[string]map[string]any

// valideerAanmelding controleert de ingezonden wijzigingen en past de vaste waarden toe.
// Levert de (mogelijk aangevulde) wijzigingen en de plaatshouder van de hoofdentiteit.
func valideerAanmelding(wijzigingen []aanmeldingWijziging, doeltype string, toegestaan map[string]bool, vaste []vasteWaarde) ([]aanmeldingWijziging, string, error) {
	hoofdMeta, ok := model.MetaRegistry.GetTypeMeta(doeltype)
	if !ok {
		return nil, "", fmt.Errorf("onbekend doeltype %q", doeltype)
	}
	hoofd := ""
	for i, w := range wijzigingen {
		if len(w) != 1 {
			return nil, "", fmt.Errorf("wijziging[%d]: precies één van opvoer/afvoer verwacht", i)
		}
		reps, isOpvoer := w["opvoer"]
		if !isOpvoer {
			return nil, "", fmt.Errorf("wijziging[%d]: alleen opvoer is toegestaan", i)
		}
		if len(reps) != 1 {
			return nil, "", fmt.Errorf("wijziging[%d]: precies één representatie per opvoer verwacht", i)
		}
		for veldnaam, payload := range reps {
			if !toegestaan[veldnaam] {
				return nil, "", fmt.Errorf("wijziging[%d]: %q hoort niet bij dit formulier", i, veldnaam)
			}
			keys := map[string]struct{}{}
			for k := range payload {
				keys[k] = struct{}{}
			}
			meta, ok := model.MetaRegistry.GetByVeldnaamMetPayload(veldnaam, keys)
			if !ok {
				return nil, "", fmt.Errorf("wijziging[%d]: onbekende representatie %q", i, veldnaam)
			}
			if meta.Metatype == model.MetatypeEntiteit {
				naam, isP := isPlaatshouder(payload[meta.IDKolom])
				if !isP {
					return nil, "", fmt.Errorf("wijziging[%d]: een entiteit-id moet een plaatshouder ($nieuw.x) zijn; bestaande records zijn niet te wijzigen via het formulier", i)
				}
				if meta.Typenaam == hoofdMeta.Typenaam {
					if hoofd != "" {
						return nil, "", fmt.Errorf("wijziging[%d]: meer dan één %s in één aanmelding", i, doeltype)
					}
					hoofd = naam
				}
			} else if meta.EntiteitIDKolom != "" {
				if _, isP := isPlaatshouder(payload[meta.EntiteitIDKolom]); !isP {
					return nil, "", fmt.Errorf("wijziging[%d]: %s.%s moet een plaatshouder zijn; gegevens van bestaande records zijn niet te wijzigen via het formulier", i, veldnaam, meta.EntiteitIDKolom)
				}
			}
		}
	}
	if hoofd == "" {
		return nil, "", fmt.Errorf("de aanmelding bevat geen nieuwe %s", doeltype)
	}
	// Vaste waarden: zetten op de bestaande GE-opvoer van de hoofdentiteit, anders toevoegen.
	for _, v := range vaste {
		gezet := false
		for _, w := range wijzigingen {
			if payload, ok := w["opvoer"][v.GEVeldnaam]; ok {
				meta, _ := model.MetaRegistry.GetByVeldnaam(v.GEVeldnaam)
				if s, _ := payload[meta.EntiteitIDKolom].(string); s == hoofd {
					payload[v.Kolom] = v.Waarde
					gezet = true
				}
			}
		}
		if !gezet {
			meta, ok := model.MetaRegistry.GetByVeldnaam(v.GEVeldnaam)
			if !ok {
				continue
			}
			wijzigingen = append(wijzigingen, aanmeldingWijziging{"opvoer": {v.GEVeldnaam: {meta.EntiteitIDKolom: hoofd, v.Kolom: v.Waarde}}})
		}
	}
	return wijzigingen, hoofd, nil
}

// aanmeldingLimiter: eenvoudige rate-limit per IP (venster met maximum aantal).
type aanmeldingLimiter struct {
	mu     sync.Mutex
	tijden map[string][]time.Time
}

var aanmeldLimiter = &aanmeldingLimiter{tijden: map[string][]time.Time{}}

func (l *aanmeldingLimiter) toestaan(ip string, nu time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	recent := l.tijden[ip][:0]
	for _, t := range l.tijden[ip] {
		if nu.Sub(t) < aanmeldingLimietVenster {
			recent = append(recent, t)
		}
	}
	if len(recent) >= aanmeldingLimietAantal {
		l.tijden[ip] = recent
		return false
	}
	l.tijden[ip] = append(recent, nu)
	return true
}

// MaakAanmeldingHandler — POST /aanmelding/:formulierId.
func MaakAanmeldingHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(strings.TrimSpace(c.Param("formulierId")))
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldig formulier-id"})
			return
		}
		if !OpenbareFormulieren()[id] {
			c.JSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("formulier %d is niet opengesteld voor openbare indiening (OPENBARE_FORMULIEREN)", id)})
			return
		}
		if !aanmeldLimiter.toestaan(c.ClientIP(), time.Now()) {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "te veel aanmeldingen; probeer het later opnieuw"})
			return
		}
		if DB == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database not initialized"})
			return
		}
		fd, err := laadFormulierDefinitie(c.Request.Context(), DB, id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "formulierdefinitie laden mislukt: " + err.Error()})
			return
		}
		if fd == nil || fd.Status != "actief" {
			c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("formulier %d bestaat niet of is niet actief", id)})
			return
		}

		// Toegestane representaties: doeltype + subformulieren (één niveau).
		toegestaan, err := veldnamenVanDoeltype(fd.Doeltype)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		for _, subID := range subFormulierIDs(fd.Layout) {
			sub, err := laadFormulierDefinitie(c.Request.Context(), DB, subID)
			if err != nil || sub == nil || sub.Status != "actief" {
				continue
			}
			if extra, err := veldnamenVanDoeltype(sub.Doeltype); err == nil {
				for k := range extra {
					toegestaan[k] = true
				}
			}
		}

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, aanmeldingMaxBody)
		var body struct {
			Wijzigingen []aanmeldingWijziging `json:"wijzigingen"`
		}
		if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige body: " + err.Error()})
			return
		}
		wijzigingen, hoofd, err := valideerAanmelding(body.Wijzigingen, fd.Doeltype, toegestaan, vasteWaardenVanLayout(fd.Layout, fd.Doeltype))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		bron := aanmeldingBron
		kenmerk := fmt.Sprintf("formulierdefinitie:%d", fd.ID)
		opmerking := fmt.Sprintf("Openbare aanmelding via formulier %q (%d)", fd.Naam, fd.ID)
		req := map[string]any{
			"registratie": model.Registratie{Registratietype: model.RegistratietypeRegistratie, Opmerking: &opmerking, Bron: &bron, BronKenmerk: &kenmerk},
			"wijzigingen": wijzigingen,
		}
		raw, err := json.Marshal(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		result, rerr := RegistreerJSONCore(c.Request.Context(), raw, model.RegistratietypeRegistratie, AuditMeta{
			RawBody: raw, RequestPath: c.Request.URL.Path, RequestMethod: c.Request.Method,
		})
		if rerr != nil {
			if rerr.Problem != nil {
				c.Header("Content-Type", "application/problem+json")
				c.JSON(rerr.Status, rerr.Problem)
				return
			}
			c.JSON(rerr.Status, gin.H{"error": rerr.Msg})
			return
		}
		c.JSON(http.StatusCreated, gin.H{
			"registratieId": result.RegistratieID,
			"toegekendeIds": result.ToegekendeIDs,
			"id":            result.ToegekendeIDs[hoofd],
		})
	}
}

// aanmeldingVeldnamenGesorteerd is voor logging/tests.
func aanmeldingVeldnamenGesorteerd(m map[string]bool) []string {
	uit := make([]string, 0, len(m))
	for k := range m {
		uit = append(uit, k)
	}
	sort.Strings(uit)
	return uit
}
