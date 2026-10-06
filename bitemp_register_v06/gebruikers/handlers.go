package gebruikers

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// MinWachtwoordLengte geldt voor nieuwe wachtwoorden (niet voor overgezette hashes).
const MinWachtwoordLengte = 10

const ongeldigeLogin = "Ongeldige gebruikersnaam of wachtwoord."

type loginRequest struct {
	Gebruikersnaam string `json:"gebruikersnaam" binding:"required"`
	Wachtwoord     string `json:"wachtwoord" binding:"required"`
}

// LoginHandler verwerkt POST /api/auth/login: zoekt de gebruiker in het register, controleert
// het wachtwoord uit gebruiker_inlog en zet het JWT als httpOnly cookie. De rol in het token is
// informatief; de middleware leest rol en status per verzoek opnieuw (middleware/gebruiker_stand.go).
func LoginHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Gebruikersnaam en wachtwoord zijn verplicht."})
			return
		}
		ctx := c.Request.Context()
		s, err := Zoek(ctx, req.Gebruikersnaam, time.Now())
		if err != nil {
			fmt.Printf("WARN: login: gebruiker %q opzoeken mislukt: %v\n", req.Gebruikersnaam, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Kon de gebruiker niet opzoeken."})
			return
		}
		if s == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": ongeldigeLogin}) // geen user enumeration
			return
		}
		inlog, err := leesInlog(ctx, s.ID)
		if err != nil || inlog == nil ||
			bcrypt.CompareHashAndPassword([]byte(inlog.WachtwoordHash), []byte(req.Wachtwoord)) != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": ongeldigeLogin})
			return
		}
		// Pas ná een juist wachtwoord zeggen we waarom iemand er niet in mag.
		if !s.MagInloggen() {
			c.JSON(http.StatusForbidden, gin.H{"error": "Dit account is geblokkeerd of heeft (nu) geen rol."})
			return
		}
		token, err := middleware.GenereerJWT(s.Gebruikersnaam, s.HoogsteRol(), s.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Kon geen token genereren."})
			return
		}
		_, _ = handlers.DB.NewUpdate().Model((*model.GebruikerInlog)(nil)).
			Set("laatste_login_op = ?", time.Now()).Where("gebruiker_id = ?", s.ID).Exec(ctx)

		// COOKIE_SECURE=true vereist HTTPS (bijv. productie achter TLS-proxy).
		isSecure := os.Getenv("COOKIE_SECURE") == "true"
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie(middleware.CookieNaam, token, 3600*middleware.JwtExpiryHours(), "/", "", isSecure, true)
		c.JSON(http.StatusOK, gin.H{
			"bericht":        "Succesvol ingelogd.",
			"gebruikersnaam": s.Gebruikersnaam,
			"rol":            s.HoogsteRol(),
		})
	}
}

// LijstHandler verwerkt GET /api/gebruikers (admin): de stand "nu" van alle gebruikers, met
// laatste login. Handiger dan de gegenereerde /full/gebruikers voor een beheerscherm.
func LijstHandler() gin.HandlerFunc {
	type rij struct {
		Stand
		LaatsteLoginOp  *time.Time `json:"laatste_login_op,omitempty"`
		HeeftWachtwoord bool       `json:"heeft_wachtwoord"`
		MagInloggen     bool       `json:"mag_inloggen"`
	}
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		alle, err := LaadAlle(ctx, time.Now())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		var inlogs []model.GebruikerInlog
		_ = handlers.DB.NewSelect().Model(&inlogs).Scan(ctx)
		perID := map[int64]model.GebruikerInlog{}
		for _, i := range inlogs {
			perID[i.GebruikerID] = i
		}
		uit := make([]rij, 0, len(alle))
		for _, s := range alle {
			r := rij{Stand: s, MagInloggen: s.MagInloggen()}
			if i, ok := perID[int64(s.ID)]; ok {
				r.HeeftWachtwoord = true
				r.LaatsteLoginOp = i.LaatsteLoginOp
			}
			uit = append(uit, r)
		}
		c.JSON(http.StatusOK, uit)
	}
}

type wachtwoordRequest struct {
	Wachtwoord string `json:"wachtwoord"` // leeg = laat de server er een maken
}

// ZetWachtwoordHandler verwerkt PUT /api/gebruikers/:id/wachtwoord (admin): zet of reset het
// wachtwoord. Zonder wachtwoord in de body maakt de server er een en geeft het één keer terug.
func ZetWachtwoordHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := strconv.Atoi(c.Param("id"))
		if err != nil || id <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige gebruiker-id."})
			return
		}
		var req wachtwoordRequest
		_ = c.ShouldBindJSON(&req)
		gegenereerd := false
		if req.Wachtwoord == "" {
			req.Wachtwoord, gegenereerd = maakWachtwoord(), true
		}
		if len(req.Wachtwoord) < MinWachtwoordLengte {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Het wachtwoord moet minstens " + strconv.Itoa(MinWachtwoordLengte) + " tekens hebben."})
			return
		}
		ctx := c.Request.Context()
		if !bestaatGebruiker(c, id) {
			return
		}
		if err := ZetWachtwoord(ctx, id, req.Wachtwoord); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		antwoord := gin.H{"bericht": "Wachtwoord gezet."}
		if gegenereerd {
			antwoord["wachtwoord"] = req.Wachtwoord
		}
		c.JSON(http.StatusOK, antwoord)
	}
}

type eigenWachtwoordRequest struct {
	Huidig string `json:"huidig" binding:"required"`
	Nieuw  string `json:"nieuw" binding:"required"`
}

// EigenWachtwoordHandler verwerkt PUT /api/auth/wachtwoord (ingelogd): het eigen wachtwoord
// wijzigen, met het huidige ter controle.
func EigenWachtwoordHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := middleware.GetClaims(c)
		if claims == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Niet ingelogd."})
			return
		}
		var req eigenWachtwoordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Huidig en nieuw wachtwoord zijn verplicht."})
			return
		}
		if len(req.Nieuw) < MinWachtwoordLengte {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Het wachtwoord moet minstens " + strconv.Itoa(MinWachtwoordLengte) + " tekens hebben."})
			return
		}
		ctx := c.Request.Context()
		s, err := Zoek(ctx, claims.Gebruikersnaam, time.Now())
		if err != nil || s == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Niet ingelogd."})
			return
		}
		inlog, err := leesInlog(ctx, s.ID)
		if err != nil || inlog == nil ||
			bcrypt.CompareHashAndPassword([]byte(inlog.WachtwoordHash), []byte(req.Huidig)) != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Het huidige wachtwoord klopt niet."})
			return
		}
		if err := ZetWachtwoord(ctx, s.ID, req.Nieuw); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"bericht": "Wachtwoord gewijzigd."})
	}
}

// bestaatGebruiker controleert of de hub bestaat (anders 404); schrijft zelf het antwoord.
func bestaatGebruiker(c *gin.Context, id int) bool {
	n, err := handlers.DB.NewSelect().Table("gebruiker").Where("id = ?", id).Count(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return false
	}
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gebruiker niet gevonden."})
		return false
	}
	return true
}

// maakWachtwoord maakt een willekeurig wachtwoord van 16 tekens (URL-veilig base64).
func maakWachtwoord() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}
