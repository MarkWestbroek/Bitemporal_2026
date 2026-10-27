package meldingen

// Endpoints (main.go), alle achter inloggen:
//
//	POST /api/meldingen                       melden: {soort, titel, beschrijving, context:{…}} → {id}
//	GET  /api/meldingen                       eigen meldingen; een beheerder ziet ze allemaal
//	GET  /api/meldingen/:id                   één melding (eigen, of beheerder)
//	POST /api/meldingen/:id/reacties          {tekst}: melder of beheerder
//	POST /api/meldingen/:id/bijlagen          multipart "bestand" (+ "omschrijving"): melder of beheerder
//	GET  /api/meldingen/bestanden/:bestand    een bijlage downloaden (wie de melding mag zien)
//	PUT  /api/meldingen/:id/behandeling       {status?, toelichting?, prioriteit?, behandelaar?}: beheerder
//
// Registreren gaat via de registratie-engine als systeemaanroep (het domein meldingen is via de
// generieke routes alleen voor beheerders, handlers/registration_beheer.go).

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/filestore"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/gebruikers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

const (
	bron          = "meldingen"
	maxBijlage    = 10 << 20 // 10 MB
	maxTitel      = 255
	maxTekst      = 20000
	maxContextVal = 255
)

var (
	soorten      = map[string]bool{"bug": true, "wens": true, "vraag": true, "compliment": true}
	statussen    = map[string]bool{"nieuw": true, "in_behandeling": true, "opgelost": true, "afgewezen": true, "dubbel": true}
	prioriteiten = map[string]bool{"laag": true, "normaal": true, "hoog": true}
	mediatypen   = map[string]bool{"image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true, "application/pdf": true, "text/plain": true}
)

// MeldingInvoer is het verzoek van POST /api/meldingen.
type MeldingInvoer struct {
	Soort        string            `json:"soort"`
	Titel        string            `json:"titel"`
	Beschrijving string            `json:"beschrijving"`
	Context      map[string]string `json:"context"`
}

// valideerMelding: lege string = goed. Zuiver (testbaar); knipt de context bij tot bekende velden.
func valideerMelding(in *MeldingInvoer) string {
	in.Soort = strings.TrimSpace(in.Soort)
	in.Titel = strings.TrimSpace(in.Titel)
	in.Beschrijving = strings.TrimSpace(in.Beschrijving)
	if !soorten[in.Soort] {
		return "Kies een soort: bug, wens, vraag of compliment."
	}
	if in.Titel == "" {
		return "Geef een titel: in één regel wat er misging of wat je wilt."
	}
	if len(in.Titel) > maxTitel {
		return "De titel is te lang (max 255 tekens)."
	}
	if len(in.Beschrijving) > maxTekst {
		return "De beschrijving is te lang."
	}
	schoon := map[string]string{}
	for _, k := range contextVelden {
		if v := strings.TrimSpace(in.Context[k]); v != "" {
			if len(v) > maxContextVal {
				v = v[:maxContextVal]
			}
			schoon[k] = v
		}
	}
	in.Context = schoon
	return ""
}

// wie: gebruikersnaam, beheerder?, gebruiker-id (0 zonder auth of onbekend).
func wie(c *gin.Context) (naam string, beheerder bool, id int) {
	if !middleware.IsAuthEnabled() {
		return "", true, 0
	}
	claims := middleware.GetClaims(c)
	if claims == nil {
		return "", false, 0
	}
	if s, err := gebruikers.Zoek(c.Request.Context(), claims.Gebruikersnaam, time.Now()); err == nil && s != nil {
		id = s.ID
	}
	return claims.Gebruikersnaam, middleware.IsBeheerder(claims.Rol), id
}

func namenNu(ctx context.Context) map[int]string {
	namen := map[int]string{}
	if alle, err := gebruikers.LaadAlle(ctx, time.Now()); err == nil {
		for _, g := range alle {
			namen[g.ID] = g.Gebruikersnaam
		}
	}
	return namen
}

// registreer voert één registratie uit via de engine (systeemaanroep); geeft de toegekende ids.
func registreer(ctx context.Context, opmerking string, wijzigingen []map[string]any) (map[string]int, error) {
	b, o := bron, opmerking
	raw, err := json.Marshal(map[string]any{
		"registratie": model.Registratie{Registratietype: model.RegistratietypeRegistratie, Bron: &b, Opmerking: &o},
		"wijzigingen": wijzigingen,
	})
	if err != nil {
		return nil, err
	}
	res, rerr := handlers.RegistreerJSONCore(middleware.AlsSysteem(ctx), raw, model.RegistratietypeRegistratie,
		handlers.AuditMeta{RawBody: raw, RequestPath: "/intern/meldingen", RequestMethod: "POST"})
	if rerr != nil {
		return nil, fmt.Errorf("%s", rerr.Msg)
	}
	return res.ToegekendeIDs, nil
}

// zichtbaar: de melding als de aanroeper hem mag zien, anders nil.
func zichtbaar(c *gin.Context, id int) *Melding {
	_, beheerder, gid := wie(c)
	alle, err := LaadAlle(c.Request.Context(), time.Now(), namenNu(c.Request.Context()))
	if err != nil {
		return nil
	}
	for i := range alle {
		if alle[i].ID == id && (beheerder || (gid != 0 && alle[i].MelderID == gid)) {
			return &alle[i]
		}
	}
	return nil
}

func idParam(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig id."})
		return 0, false
	}
	return id, true
}

// MeldenHandler — POST /api/meldingen
func MeldenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var in MeldingInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON."})
			return
		}
		if msg := valideerMelding(&in); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		naam, _, gid := wie(c)
		const m = "$nieuw.melding"
		inhoud := map[string]any{"melding_id": m, "soort": in.Soort, "titel": in.Titel}
		if in.Beschrijving != "" {
			inhoud["beschrijving"] = in.Beschrijving
		}
		wijzigingen := []map[string]any{
			{"opvoer": map[string]any{"melding": map[string]any{"id": m}}},
			{"opvoer": map[string]any{"meldinginhoud": inhoud}},
			{"opvoer": map[string]any{"meldingstatus": map[string]any{"melding_id": m, "status": "nieuw"}}},
		}
		if len(in.Context) > 0 {
			ctx := map[string]any{"melding_id": m}
			for k, v := range in.Context {
				ctx[k] = v
			}
			wijzigingen = append(wijzigingen, map[string]any{"opvoer": map[string]any{"meldingcontext": ctx}})
		}
		if gid != 0 {
			wijzigingen = append(wijzigingen, map[string]any{"opvoer": map[string]any{"meldingmelder": map[string]any{"melding_id": m, "gebruiker_id": gid}}})
		}
		ids, err := registreer(c.Request.Context(), fmt.Sprintf("%s gemeld door %s", in.Soort, naamOf(naam)), wijzigingen)
		if err != nil {
			fmt.Printf("WARN: melding registreren mislukt: %v\n", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Melden mislukt; probeer het opnieuw."})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"id": ids[m]})
	}
}

func naamOf(n string) string {
	if n == "" {
		return "(geen login)"
	}
	return n
}

// LijstHandler — GET /api/meldingen
func LijstHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, beheerder, gid := wie(c)
		alle, err := LaadAlle(c.Request.Context(), time.Now(), namenNu(c.Request.Context()))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Meldingen lezen mislukt: " + err.Error()})
			return
		}
		uit := []Melding{}
		for _, m := range alle {
			if beheerder || (gid != 0 && m.MelderID == gid) {
				uit = append(uit, m)
			}
		}
		c.JSON(http.StatusOK, gin.H{"meldingen": uit, "beheerder": beheerder})
	}
}

// EenHandler — GET /api/meldingen/:id
func EenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := idParam(c)
		if !ok {
			return
		}
		m := zichtbaar(c, id)
		if m == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Melding niet gevonden."})
			return
		}
		c.JSON(http.StatusOK, m)
	}
}

// ReactieHandler — POST /api/meldingen/:id/reacties
func ReactieHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := idParam(c)
		if !ok {
			return
		}
		var in struct {
			Tekst string `json:"tekst"`
		}
		if err := c.ShouldBindJSON(&in); err != nil || strings.TrimSpace(in.Tekst) == "" || len(in.Tekst) > maxTekst {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geef een reactie (niet leeg)."})
			return
		}
		if zichtbaar(c, id) == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Melding niet gevonden."})
			return
		}
		naam, _, _ := wie(c)
		_, err := registreer(c.Request.Context(), fmt.Sprintf("reactie op melding %d door %s", id, naamOf(naam)), []map[string]any{
			{"opvoer": map[string]any{"meldingreactie": map[string]any{"melding_id": id, "tekst": strings.TrimSpace(in.Tekst), "auteur": naamOf(naam)}}},
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Reageren mislukt: " + err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// BehandelingHandler — PUT /api/meldingen/:id/behandeling (beheerder)
func BehandelingHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := idParam(c)
		if !ok {
			return
		}
		if _, beheerder, _ := wie(c); !beheerder {
			c.JSON(http.StatusForbidden, gin.H{"error": "Alleen een beheerder behandelt meldingen."})
			return
		}
		var in struct {
			Status      string  `json:"status"`
			Toelichting *string `json:"toelichting"`
			Prioriteit  string  `json:"prioriteit"`
			Behandelaar string  `json:"behandelaar"` // gebruikersnaam
		}
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON."})
			return
		}
		if zichtbaar(c, id) == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Melding niet gevonden."})
			return
		}
		var w []map[string]any
		if in.Status != "" {
			if !statussen[in.Status] {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Onbekende status."})
				return
			}
			// Materieel enkelvoudig met tijdstipprecisie (27-10-2026): elke statuswissel is een
			// nieuw voorkomen vanaf nu; de vorige status krijgt automatisch dit tijdstip als einde.
			st := map[string]any{"melding_id": id, "status": in.Status, "aanvang": time.Now().UTC().Format(time.RFC3339Nano)}
			if in.Toelichting != nil && strings.TrimSpace(*in.Toelichting) != "" {
				st["toelichting"] = strings.TrimSpace(*in.Toelichting)
			}
			w = append(w, map[string]any{"opvoer": map[string]any{"meldingstatus": st}})
		}
		if in.Prioriteit != "" {
			if !prioriteiten[in.Prioriteit] {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Onbekende prioriteit."})
				return
			}
			w = append(w, map[string]any{"opvoer": map[string]any{"meldingprioriteit": map[string]any{"melding_id": id, "prioriteit": in.Prioriteit}}})
		}
		if in.Behandelaar != "" {
			s, err := gebruikers.Zoek(c.Request.Context(), in.Behandelaar, time.Now())
			if err != nil || s == nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Onbekende behandelaar."})
				return
			}
			w = append(w, map[string]any{"opvoer": map[string]any{"meldingbehandelaar": map[string]any{"melding_id": id, "gebruiker_id": s.ID, "aanvang": time.Now().UTC().Format(time.RFC3339Nano)}}})
		}
		if len(w) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Niets te wijzigen."})
			return
		}
		naam, _, _ := wie(c)
		if _, err := registreer(c.Request.Context(), fmt.Sprintf("melding %d behandeld door %s", id, naamOf(naam)), w); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Opslaan mislukt: " + err.Error()})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func nieuwUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

// BijlageHandler — POST /api/meldingen/:id/bijlagen (multipart: bestand, omschrijving)
func BijlageHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := idParam(c)
		if !ok {
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBijlage+64<<10)
		bestand, kop, err := c.Request.FormFile("bestand")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Geen bestand ontvangen (max 10 MB)."})
			return
		}
		defer bestand.Close()
		data, err := io.ReadAll(io.LimitReader(bestand, maxBijlage+1))
		if err != nil || len(data) == 0 || len(data) > maxBijlage {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Het bestand is leeg of groter dan 10 MB."})
			return
		}
		mt := http.DetectContentType(data)
		if i := strings.Index(mt, ";"); i > 0 {
			mt = mt[:i]
		}
		if !mediatypen[mt] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Alleen afbeeldingen (png, jpeg, gif, webp), pdf of tekst."})
			return
		}
		if zichtbaar(c, id) == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Melding niet gevonden."})
			return
		}
		naam, _, _ := wie(c)
		ctx := c.Request.Context()
		rec := &model.MeldingBestand{ID: nieuwUUID(), Naam: schoneNaam(kop.Filename), Mediatype: mt, Grootte: int64(len(data)), Aangemaakt: time.Now(), Door: naam}
		if filestore.Beschikbaar {
			rec.ObjectKey = "meldingen/" + rec.ID
			if _, err := filestore.Huidig().Upload(ctx, rec.ObjectKey, bytes.NewReader(data), int64(len(data)), mt); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Opslaan van het bestand mislukt."})
				return
			}
		} else {
			rec.Inhoud = data
		}
		if _, err := handlers.DB.NewInsert().Model(rec).Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Bestand vastleggen mislukt: " + err.Error()})
			return
		}
		bijlage := map[string]any{"melding_id": id, "bestand": rec.ID}
		if o := strings.TrimSpace(c.PostForm("omschrijving")); o != "" {
			if len(o) > maxContextVal {
				o = o[:maxContextVal]
			}
			bijlage["omschrijving"] = o
		}
		if _, err := registreer(ctx, fmt.Sprintf("bijlage bij melding %d door %s", id, naamOf(naam)), []map[string]any{
			{"opvoer": map[string]any{"meldingbijlage": bijlage}},
		}); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Bijlage registreren mislukt: " + err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"bestand": rec.ID})
	}
}

func schoneNaam(n string) string {
	n = strings.TrimSpace(n)
	n = strings.Map(func(r rune) rune {
		if r < 32 || strings.ContainsRune(`/\"<>|:*?`, r) {
			return '_'
		}
		return r
	}, n)
	if n == "" {
		n = "bijlage"
	}
	if len(n) > 120 {
		n = n[:120]
	}
	return n
}

// BestandHandler — GET /api/meldingen/bestanden/:bestand
func BestandHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		rec := new(model.MeldingBestand)
		if err := handlers.DB.NewSelect().Model(rec).Where("id = ?", c.Param("bestand")).Limit(1).Scan(ctx); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Bestand niet gevonden."})
			return
		}
		// Mag de aanroeper een melding zien die naar dit bestand verwijst?
		_, beheerder, gid := wie(c)
		if !beheerder {
			mag := false
			if alle, err := LaadAlle(ctx, time.Now(), nil); err == nil {
				for _, m := range alle {
					if gid == 0 || m.MelderID != gid {
						continue
					}
					for _, b := range m.Bijlagen {
						if b.Bestand == rec.ID {
							mag = true
						}
					}
				}
			}
			if !mag {
				c.JSON(http.StatusNotFound, gin.H{"error": "Bestand niet gevonden."})
				return
			}
		}
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=%q", rec.Naam))
		c.Header("X-Content-Type-Options", "nosniff")
		if rec.ObjectKey != "" && filestore.Beschikbaar {
			r, _, size, err := filestore.Huidig().Download(ctx, rec.ObjectKey)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Bestand lezen mislukt."})
				return
			}
			defer r.Close()
			c.DataFromReader(http.StatusOK, size, rec.Mediatype, r, nil)
			return
		}
		c.Data(http.StatusOK, rec.Mediatype, rec.Inhoud)
	}
}
