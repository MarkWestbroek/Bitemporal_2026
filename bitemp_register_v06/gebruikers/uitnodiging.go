package gebruikers

// uitnodiging.go — gebruikers uitnodigen (plan docs/plans/2026-10-12 Gebruikers uitnodigen en
// toolrechten, §2 en §5; besluiten Mark 13-10).
//
// Een beheerder nodigt iemand uit met een rol en, optioneel, toegang tot Studio-projecten
// ("alles dicht tenzij": zonder project ziet de genodigde niets). De server maakt een
// willekeurige token (32 bytes) en bewaart alleen de sha256 ervan. De link
// <basis>/viz/react/studio.html#uitnodiging=<token> gaat per mail (als SMTP is ingericht) en
// staat één keer in het antwoord, zodat de beheerder hem ook zelf kan doorsturen. De token
// staat in het fragment (#), dus niet in de serverlogs.
//
// De genodigde kiest zelf een gebruikersnaam (die staat in "wie is actief") en een
// wachtwoord. Accepteren claimt de uitnodiging atomair (één keer), registreert de gebruiker
// in het register (domein beheer), zet het wachtwoord, kent de projecttoegang toe en logt in.
//
// Aan/uit per instantie: UITNODIGEN_ENABLED=true (en AUTH_ENABLED=true). Basis-URL van de
// link: STUDIO_BASIS_URL, anders NOTIFICATIE_BASIS_URL, anders de host van het verzoek.
//
// Routes (main.go):
//   GET    /api/gebruikers/uitnodigingen          beheerder: lijst + of uitnodigen aan staat
//   POST   /api/gebruikers/uitnodigingen          beheerder: {email, weergavenaam, rol, projecten, dagen}
//   DELETE /api/gebruikers/uitnodigingen/:id      beheerder: intrekken
//   GET    /api/uitnodiging/:token                openbaar: wat de uitnodiging inhoudt
//   POST   /api/uitnodiging/:token/accepteer      openbaar: {gebruikersnaam, wachtwoord}

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/mail"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/notificaties"
)

const (
	uitnodigingDagenStandaard = 7
	uitnodigingDagenMax       = 30
)

// gebruikersnaamPatroon: wat een genodigde als gebruikersnaam mag kiezen.
var gebruikersnaamPatroon = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$`)

// UitnodigenAan: UITNODIGEN_ENABLED=true en auth aan.
func UitnodigenAan() bool {
	return middleware.IsAuthEnabled() && strings.EqualFold(strings.TrimSpace(os.Getenv("UITNODIGEN_ENABLED")), "true")
}

// UitnodigingProject: toegang die bij het accepteren wordt toegekend.
type UitnodigingProject struct {
	ID    string `json:"id"`
	Recht string `json:"recht"` // lezen | schrijven
	Naam  string `json:"naam,omitempty"`
}

type uitnodigingInvoer struct {
	Email        string               `json:"email"`
	Weergavenaam string               `json:"weergavenaam"`
	Rol          string               `json:"rol"`
	Projecten    []UitnodigingProject `json:"projecten"`
	Dagen        int                  `json:"dagen"`
}

// valideerUitnodiging controleert de invoer; lege string = goed. Zuiver (testbaar); of de
// projecten bestaan, controleert de handler.
func valideerUitnodiging(in *uitnodigingInvoer) string {
	in.Email = strings.TrimSpace(in.Email)
	in.Weergavenaam = strings.TrimSpace(in.Weergavenaam)
	in.Rol = strings.TrimSpace(in.Rol)
	if a, err := mail.ParseAddress(in.Email); err != nil || a.Address != in.Email || len(in.Email) > 254 {
		return "Geef een geldig e-mailadres (alleen het adres)."
	}
	if len(in.Weergavenaam) > 200 {
		return "De weergavenaam is te lang (max 200 tekens)."
	}
	if !middleware.IsToekenbareRol(in.Rol) {
		return "Kies een rol: " + strings.Join(middleware.ToekenbareRollen, ", ") + "."
	}
	if in.Dagen == 0 {
		in.Dagen = uitnodigingDagenStandaard
	}
	if in.Dagen < 1 || in.Dagen > uitnodigingDagenMax {
		return fmt.Sprintf("Geldigheid: 1 tot %d dagen.", uitnodigingDagenMax)
	}
	gezien := map[string]bool{}
	for _, p := range in.Projecten {
		if _, ok := handlers.ParseProjectRecht(p.Recht); !ok {
			return fmt.Sprintf("Recht %q op project %s: kies lezen of schrijven.", p.Recht, p.ID)
		}
		if gezien[p.ID] {
			return "Een project staat er twee keer in."
		}
		gezien[p.ID] = true
	}
	return ""
}

// maakToken geeft de token (voor de link) en zijn hash (voor de database).
func maakToken() (token, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, hashToken(token), nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// UitnodigingStatus: open, geaccepteerd, ingetrokken of verlopen (op `nu`).
func UitnodigingStatus(u *model.GebruikerUitnodiging, nu time.Time) string {
	switch {
	case u.GeaccepteerdOp != nil:
		return "geaccepteerd"
	case u.IngetrokkenOp != nil:
		return "ingetrokken"
	case !nu.Before(u.Verloopt):
		return "verlopen"
	}
	return "open"
}

// basisURL voor de link in de mail.
func basisURL(c *gin.Context) string {
	for _, k := range []string{"STUDIO_BASIS_URL", "NOTIFICATIE_BASIS_URL"} {
		if v := strings.TrimRight(strings.TrimSpace(os.Getenv(k)), "/"); v != "" {
			return v
		}
	}
	schema := "http"
	if c.Request.TLS != nil || strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https") {
		schema = "https"
	}
	return schema + "://" + c.Request.Host
}

func uitnodigingLink(c *gin.Context, token string) string {
	return basisURL(c) + "/viz/react/studio.html#uitnodiging=" + token
}

func uitnodigingMail(in *uitnodigingInvoer, door, link string, verloopt time.Time) (onderwerp, tekst string) {
	aanhef := "Hallo"
	if in.Weergavenaam != "" {
		aanhef += " " + in.Weergavenaam
	}
	if door == "" {
		door = "Een beheerder"
	}
	onderwerp = "Uitnodiging voor Omnium Studio"
	tekst = fmt.Sprintf("%s,\n\n%s nodigt je uit om Omnium Studio te proberen, als %s.\n\n"+
		"Kies via deze link je gebruikersnaam en wachtwoord:\n%s\n\n"+
		"De link werkt tot %s en maar één keer. Verwachtte je deze mail niet, dan kun je hem negeren.\n",
		aanhef, door, in.Rol, link, verloopt.Format("2 januari 2006 15:04"))
	return
}

// UitnodigingenLijstHandler — GET /api/gebruikers/uitnodigingen (beheerder)
func UitnodigingenLijstHandler() gin.HandlerFunc {
	type rij struct {
		model.GebruikerUitnodiging
		Status string `json:"status"`
	}
	return func(c *gin.Context) {
		var alle []model.GebruikerUitnodiging
		if err := handlers.DB.NewSelect().Model(&alle).OrderExpr("aangemaakt DESC").Limit(500).Scan(c.Request.Context()); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Uitnodigingen lezen mislukt: " + err.Error()})
			return
		}
		nu := time.Now()
		uit := make([]rij, 0, len(alle))
		for _, u := range alle {
			uit = append(uit, rij{GebruikerUitnodiging: u, Status: UitnodigingStatus(&u, nu)})
		}
		cfg := notificaties.ConfigUitEnv()
		c.JSON(http.StatusOK, gin.H{
			"aan": UitnodigenAan(), "mail": cfg.SMTP.Host != "",
			"rollen": middleware.ToekenbareRollen, "uitnodigingen": uit,
		})
	}
}

// UitnodigingMakenHandler — POST /api/gebruikers/uitnodigingen (beheerder)
func UitnodigingMakenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !UitnodigenAan() {
			c.JSON(http.StatusForbidden, gin.H{"error": "Uitnodigen staat uit op deze instantie (UITNODIGEN_ENABLED)."})
			return
		}
		var in uitnodigingInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON: " + err.Error()})
			return
		}
		if msg := valideerUitnodiging(&in); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		ctx := c.Request.Context()
		for i, p := range in.Projecten {
			var naam string
			err := handlers.DB.NewSelect().Model((*model.StudioProject)(nil)).Column("naam").Where("id = ?", p.ID).Scan(ctx, &naam)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Project %q bestaat niet.", p.ID)})
				return
			}
			in.Projecten[i].Naam = naam
		}
		token, hash, err := maakToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Kon geen token maken."})
			return
		}
		projecten, _ := json.Marshal(in.Projecten)
		if in.Projecten == nil {
			projecten = []byte("[]")
		}
		door := ""
		if claims := middleware.GetClaims(c); claims != nil {
			door = claims.Gebruikersnaam
		}
		nu := time.Now()
		u := &model.GebruikerUitnodiging{
			Email: in.Email, Weergavenaam: in.Weergavenaam, Rol: in.Rol, Projecten: projecten,
			TokenHash: hash, Aangemaakt: nu, AangemaaktDoor: door, Verloopt: nu.Add(time.Duration(in.Dagen) * 24 * time.Hour),
		}
		if _, err := handlers.DB.NewInsert().Model(u).Exec(ctx); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Uitnodiging opslaan mislukt: " + err.Error()})
			return
		}
		link := uitnodigingLink(c, token)
		gemaild, mailfout := false, ""
		if cfg := notificaties.ConfigUitEnv(); cfg.SMTP.Host != "" {
			onderwerp, tekst := uitnodigingMail(&in, door, link, u.Verloopt)
			if err := notificaties.VerstuurEmail(cfg.SMTP, in.Email, onderwerp, tekst); err != nil {
				mailfout = err.Error()
				fmt.Printf("WARN: uitnodiging %d mailen mislukt: %v\n", u.ID, err)
			} else {
				gemaild = true
			}
		}
		c.JSON(http.StatusCreated, gin.H{
			"uitnodiging": u, "status": UitnodigingStatus(u, nu),
			"link": link, "gemaild": gemaild, "mailfout": mailfout,
		})
	}
}

// UitnodigingIntrekkenHandler — DELETE /api/gebruikers/uitnodigingen/:id (beheerder)
func UitnodigingIntrekkenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig id."})
			return
		}
		res, err := handlers.DB.NewUpdate().Model((*model.GebruikerUitnodiging)(nil)).
			Set("ingetrokken_op = ?", time.Now()).
			Where("id = ? AND geaccepteerd_op IS NULL AND ingetrokken_op IS NULL", id).Exec(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Intrekken mislukt: " + err.Error()})
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			c.JSON(http.StatusConflict, gin.H{"error": "Deze uitnodiging bestaat niet, is al geaccepteerd of al ingetrokken."})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

// uitnodigingLimiter: rate limit per IP op de openbare routes (raden van tokens, misbruik).
type uitnodigingLimiter struct {
	mu      sync.Mutex
	tijden  map[string][]time.Time
	venster time.Duration
	max     int
}

var openbaarLimiter = &uitnodigingLimiter{tijden: map[string][]time.Time{}, venster: 10 * time.Minute, max: 30}

func (l *uitnodigingLimiter) toestaan(ip string, nu time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	recent := l.tijden[ip][:0]
	for _, t := range l.tijden[ip] {
		if nu.Sub(t) < l.venster {
			recent = append(recent, t)
		}
	}
	if len(recent) >= l.max {
		l.tijden[ip] = recent
		return false
	}
	l.tijden[ip] = append(recent, nu)
	return true
}

// openbaarVooraf: aan/uit en rate limit voor de openbare routes. false = al beantwoord.
func openbaarVooraf(c *gin.Context) bool {
	if !UitnodigenAan() {
		c.JSON(http.StatusNotFound, gin.H{"error": "Uitnodigen staat uit op deze instantie."})
		return false
	}
	if !openbaarLimiter.toestaan(c.ClientIP(), time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Te veel pogingen; probeer het over een paar minuten opnieuw."})
		return false
	}
	return true
}

const ongeldigeUitnodiging = "Deze uitnodiging is ongeldig, verlopen, ingetrokken of al gebruikt."

func zoekUitnodiging(ctx context.Context, token string) (*model.GebruikerUitnodiging, error) {
	u := new(model.GebruikerUitnodiging)
	err := handlers.DB.NewSelect().Model(u).Where("token_hash = ?", hashToken(token)).Limit(1).Scan(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

// UitnodigingBekijkenHandler — GET /api/uitnodiging/:token (openbaar)
func UitnodigingBekijkenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !openbaarVooraf(c) {
			return
		}
		u, err := zoekUitnodiging(c.Request.Context(), c.Param("token"))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Uitnodiging lezen mislukt."})
			return
		}
		if u == nil || UitnodigingStatus(u, time.Now()) != "open" {
			c.JSON(http.StatusGone, gin.H{"error": ongeldigeUitnodiging})
			return
		}
		var projecten []UitnodigingProject
		_ = json.Unmarshal(u.Projecten, &projecten)
		c.JSON(http.StatusOK, gin.H{
			"email": u.Email, "weergavenaam": u.Weergavenaam, "rol": u.Rol, "verloopt": u.Verloopt,
			"uitgenodigd_door": u.AangemaaktDoor, "projecten": projecten,
			"min_wachtwoord": MinWachtwoordLengte,
		})
	}
}

type accepteerInvoer struct {
	Gebruikersnaam string `json:"gebruikersnaam"`
	Wachtwoord     string `json:"wachtwoord"`
}

// valideerAccepteer: gebruikersnaam en wachtwoord; lege string = goed. Zuiver (testbaar).
func valideerAccepteer(in *accepteerInvoer) string {
	in.Gebruikersnaam = strings.TrimSpace(in.Gebruikersnaam)
	if !gebruikersnaamPatroon.MatchString(in.Gebruikersnaam) {
		return "Gebruikersnaam: 3 tot 64 tekens, letters, cijfers, punt, - of _, beginnend met een letter of cijfer."
	}
	if len(in.Wachtwoord) < MinWachtwoordLengte {
		return fmt.Sprintf("Het wachtwoord moet minstens %d tekens hebben.", MinWachtwoordLengte)
	}
	if len(in.Wachtwoord) > 200 {
		return "Het wachtwoord is te lang."
	}
	return ""
}

// UitnodigingAccepterenHandler — POST /api/uitnodiging/:token/accepteer (openbaar)
func UitnodigingAccepterenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !openbaarVooraf(c) {
			return
		}
		var in accepteerInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON."})
			return
		}
		if msg := valideerAccepteer(&in); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		ctx := c.Request.Context()
		hash := hashToken(c.Param("token"))
		bestaand, err := Zoek(ctx, in.Gebruikersnaam, time.Now())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Kon de gebruikersnaam niet controleren."})
			return
		}
		if bestaand != nil {
			c.JSON(http.StatusConflict, gin.H{"error": "Deze gebruikersnaam is al in gebruik; kies een andere."})
			return
		}
		// Claim de uitnodiging atomair: twee gelijktijdige pogingen kunnen hem niet allebei gebruiken.
		u := new(model.GebruikerUitnodiging)
		err = handlers.DB.NewUpdate().Model(u).
			Set("geaccepteerd_op = ?", time.Now()).Set("gebruikersnaam = ?", in.Gebruikersnaam).
			Where("token_hash = ? AND geaccepteerd_op IS NULL AND ingetrokken_op IS NULL AND verloopt > ?", hash, time.Now()).
			Returning("*").Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusGone, gin.H{"error": ongeldigeUitnodiging})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Uitnodiging verwerken mislukt."})
			return
		}
		vrijgeven := func() { // bij een fout hierna: de uitnodiging weer bruikbaar maken
			_, _ = handlers.DB.NewUpdate().Model((*model.GebruikerUitnodiging)(nil)).
				Set("geaccepteerd_op = NULL").Set("gebruikersnaam = NULL").Where("id = ?", u.ID).Exec(context.Background())
		}
		id, err := MaakAan(ctx, NieuweGebruiker{
			Gebruikersnaam: in.Gebruikersnaam, Weergavenaam: u.Weergavenaam, Email: u.Email, Rol: u.Rol,
			Opmerking: fmt.Sprintf("Uitnodiging %d van %s geaccepteerd", u.ID, u.AangemaaktDoor),
		})
		if err != nil {
			vrijgeven()
			fmt.Printf("WARN: uitnodiging %d: gebruiker registreren mislukt: %v\n", u.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Registreren mislukt; probeer het opnieuw of vraag de beheerder."})
			return
		}
		if err := ZetWachtwoord(ctx, id, in.Wachtwoord); err != nil {
			// De gebruiker bestaat al; een beheerder kan het wachtwoord zetten. Uitnodiging blijft gebruikt.
			fmt.Printf("WARN: uitnodiging %d: wachtwoord zetten mislukt: %v\n", u.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Account aangemaakt, maar het wachtwoord zetten mislukte; vraag de beheerder."})
			return
		}
		var projecten []UitnodigingProject
		_ = json.Unmarshal(u.Projecten, &projecten)
		for _, p := range projecten {
			recht, _ := handlers.ParseProjectRecht(p.Recht)
			if err := handlers.ZetProjectToegang(ctx, handlers.DB, p.ID, in.Gebruikersnaam, recht, "uitnodiging "+strconv.FormatInt(u.ID, 10)); err != nil {
				fmt.Printf("WARN: uitnodiging %d: toegang tot project %s mislukt: %v\n", u.ID, p.ID, err)
			}
		}
		token, err := middleware.GenereerJWT(in.Gebruikersnaam, u.Rol, u.Email)
		if err == nil {
			isSecure := os.Getenv("COOKIE_SECURE") == "true"
			c.SetSameSite(http.SameSiteLaxMode)
			c.SetCookie(middleware.CookieNaam, token, 3600*middleware.JwtExpiryHours(), "/", "", isSecure, true)
		}
		c.JSON(http.StatusCreated, gin.H{"gebruikersnaam": in.Gebruikersnaam, "rol": u.Rol, "ingelogd": err == nil})
	}
}
