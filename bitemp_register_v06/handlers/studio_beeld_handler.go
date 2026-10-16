package handlers

// Gedeelde plaatjes: een diagram als PNG op een openbaar, onraadbaar adres, om in Confluence of
// een wiki als gewone <img>-link op te nemen (Mark, 16-10-2026). Zie model/studio_gedeeld_beeld.go
// en docs/STUDIO.md §"Gedeelde plaatjes".
//
//   POST   /api/studio/projecten/:id/beelden          {profiel_id, diagram_id, diagram_naam, soort, png, breedte, hoogte, alleen_bijwerken?}
//   GET    /api/studio/projecten/:id/beelden          → {beelden: [...]} (niet ingetrokken, nieuwste eerst)
//   DELETE /api/studio/projecten/:id/beelden/:token   → 204; het adres geeft voortaan 404
//   GET    /api/beeld/:bestand                        → de PNG, openbaar (bestand = <token>.png)
//
// Opslag: MinIO (beelden/<token>.png) als de filestore beschikbaar is, anders de kolom inhoud,
// net als de bijlagen van meldingen. Geen versies: een actueel plaatje overschrijft het vorige.
//
// Waarom maakt Studio de PNG en niet de server? De render-sidecar tekent alleen het canonieke
// V3-model; Studio tekent elk profiel (dezelfde schets als de documenten). De server bewaart dus
// alleen wat Studio aanlevert, en controleert dat het echt een PNG is.
//
// Rechten: lezen op het project is genoeg om een plaatje te delen (wie het diagram kan zien, kan
// er ook een schermafdruk van maken). Intrekken mag wie het plaatje deelde, of wie in het project
// mag schrijven.

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/filestore"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

const (
	beeldMaxBytes     = 4 << 20 // 4 MB PNG; een groot diagram op schaal 2 is ~0,5 MB
	beeldSoortMoment  = "momentopname"
	beeldSoortActueel = "actueel"
)

var (
	beeldTokenPatroon = regexp.MustCompile(`^[A-Za-z0-9_-]{32}$`)
	beeldIDPatroon    = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,128}$`)
	pngHandtekening   = []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}
)

type beeldInvoer struct {
	ProfielID       string `json:"profiel_id"`
	DiagramID       string `json:"diagram_id"`
	DiagramNaam     string `json:"diagram_naam"`
	Soort           string `json:"soort"`
	PNG             string `json:"png"` // base64, of een data-URL "data:image/png;base64,…"
	Breedte         int    `json:"breedte"`
	Hoogte          int    `json:"hoogte"`
	AlleenBijwerken bool   `json:"alleen_bijwerken"` // alleen een bestaand actueel adres bijwerken, geen nieuw maken
}

// BeeldMeta: wat de client van een gedeeld plaatje ziet (zonder inhoud).
type BeeldMeta struct {
	Token       string    `json:"token"`
	Pad         string    `json:"pad"` // relatief adres, bv. /api/beeld/<token>.png
	ProfielID   string    `json:"profiel_id"`
	DiagramID   string    `json:"diagram_id"`
	DiagramNaam string    `json:"diagram_naam"`
	Soort       string    `json:"soort"`
	Hash        string    `json:"hash"`
	Grootte     int64     `json:"grootte"`
	Breedte     int       `json:"breedte"`
	Hoogte      int       `json:"hoogte"`
	Aangemaakt  time.Time `json:"aangemaakt"`
	Bijgewerkt  time.Time `json:"bijgewerkt"`
	Door        string    `json:"door"`
	Gewijzigd   bool      `json:"gewijzigd"` // POST: is er een nieuw plaatje opgeslagen?
}

func beeldMeta(b *model.StudioGedeeldBeeld) BeeldMeta {
	return BeeldMeta{
		Token: b.Token, Pad: "/api/beeld/" + b.Token + ".png", ProfielID: b.ProfielID, DiagramID: b.DiagramID,
		DiagramNaam: b.DiagramNaam, Soort: b.Soort, Hash: b.Hash, Grootte: b.Grootte, Breedte: b.Breedte,
		Hoogte: b.Hoogte, Aangemaakt: b.Aangemaakt, Bijgewerkt: b.Bijgewerkt, Door: b.Door,
	}
}

func nieuwBeeldToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil // 32 tekens
}

// leesPNG: base64 (met of zonder data-URL-kop) naar bytes, en controleer dat het een PNG is.
func leesPNG(s string) ([]byte, string) {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, ","); strings.HasPrefix(s, "data:") && i > 0 {
		if !strings.HasPrefix(s, "data:image/png;base64,") {
			return nil, "Alleen PNG (data:image/png;base64,…)."
		}
		s = s[i+1:]
	}
	data, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, "Veld 'png' is geen geldige base64."
	}
	if len(data) == 0 || len(data) > beeldMaxBytes {
		return nil, "Plaatje is leeg of groter dan 4 MB."
	}
	if !bytes.HasPrefix(data, pngHandtekening) {
		return nil, "Veld 'png' is geen PNG."
	}
	return data, ""
}

// bewaarBeeldInhoud: naar MinIO (vaste sleutel per token, dus overschrijven bij bijwerken) of,
// zonder filestore, terug als bytes voor de kolom.
func bewaarBeeldInhoud(ctx context.Context, token string, data []byte) (objectKey string, inhoud []byte, err error) {
	if !filestore.Beschikbaar {
		return "", data, nil
	}
	key := "beelden/" + token + ".png"
	if _, err := filestore.Huidig().Upload(ctx, key, bytes.NewReader(data), int64(len(data)), "image/png"); err != nil {
		return "", nil, err
	}
	return key, nil, nil
}

// VerwijderBeeldObjecten: de MinIO-objecten van deze plaatjes weg (intrekken, project weg).
// Fouten worden gelogd, niet teruggegeven: de rij is al ingetrokken of weg, dus het adres geeft
// hoe dan ook 404.
func VerwijderBeeldObjecten(ctx context.Context, keys []string) {
	if !filestore.Beschikbaar {
		return
	}
	for _, k := range keys {
		if k == "" {
			continue
		}
		if err := filestore.Huidig().Verwijder(ctx, k); err != nil {
			log.Printf("WARN: gedeeld plaatje %s uit MinIO verwijderen mislukt: %v", k, err)
		}
	}
}

// valideerBeeldInvoer: zuiver, zodat de test het zonder database kan nagaan.
func valideerBeeldInvoer(in *beeldInvoer) string {
	if in.Soort == "" {
		in.Soort = beeldSoortMoment
	}
	if in.Soort != beeldSoortMoment && in.Soort != beeldSoortActueel {
		return "Veld 'soort' moet 'momentopname' of 'actueel' zijn."
	}
	if !beeldIDPatroon.MatchString(in.ProfielID) || !beeldIDPatroon.MatchString(in.DiagramID) {
		return "Velden 'profiel_id' en 'diagram_id' zijn verplicht (letters, cijfers, _ . : -)."
	}
	if len([]rune(in.DiagramNaam)) > 200 {
		in.DiagramNaam = string([]rune(in.DiagramNaam)[:200])
	}
	if in.Breedte < 0 || in.Hoogte < 0 || in.Breedte > 20000 || in.Hoogte > 20000 {
		return "Ongeldige breedte of hoogte."
	}
	if in.AlleenBijwerken && in.Soort != beeldSoortActueel {
		return "'alleen_bijwerken' kan alleen bij soort 'actueel'."
	}
	return ""
}

// MaakStudioBeeldDelenHandler — POST /api/studio/projecten/:id/beelden
//
// Momentopname: hetzelfde plaatje van hetzelfde diagram geeft hetzelfde adres terug (geen
// dubbele rijen bij opnieuw kopiëren); een ander plaatje krijgt een nieuw adres.
// Actueel: één adres per diagram; een nieuw plaatje vervangt het oude (adres blijft gelijk).
func MaakStudioBeeldDelenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		// base64 is ~4/3 van de PNG, plus de rest van de JSON
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, beeldMaxBytes*4/3+64<<10)
		var in beeldInvoer
		if err := c.ShouldBindJSON(&in); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldige JSON of te groot (max 4 MB PNG): " + err.Error()})
			return
		}
		if fout := valideerBeeldInvoer(&in); fout != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": fout})
			return
		}
		data, fout := leesPNG(in.PNG)
		if fout != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": fout})
			return
		}
		som := sha256.Sum256(data)
		hash := hex.EncodeToString(som[:])
		ctx := c.Request.Context()
		bestaat, err := DB.NewSelect().Model((*model.StudioProject)(nil)).Where("id = ?", id).Exists(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Project lezen mislukt: " + err.Error()})
			return
		}
		if !bestaat {
			c.JSON(http.StatusNotFound, gin.H{"error": "Project niet gevonden op de server."})
			return
		}

		// Bestaand adres voor dit diagram (actueel), of hetzelfde plaatje (momentopname)?
		oud := new(model.StudioGedeeldBeeld)
		q := DB.NewSelect().Model(oud).ExcludeColumn("inhoud").
			Where("project_id = ? AND profiel_id = ? AND diagram_id = ? AND soort = ? AND ingetrokken_op IS NULL", id, in.ProfielID, in.DiagramID, in.Soort)
		if in.Soort == beeldSoortMoment {
			q = q.Where("hash = ?", hash)
		}
		err = q.OrderExpr("aangemaakt DESC").Limit(1).Scan(ctx)
		switch {
		case err == nil:
			uit := beeldMeta(oud)
			if in.Soort == beeldSoortActueel && (oud.Hash != hash || oud.DiagramNaam != in.DiagramNaam) {
				nu := time.Now()
				key, inhoud := oud.ObjectKey, []byte(nil)
				if oud.Hash != hash {
					// Overschrijft het vorige plaatje (geen versies).
					if key, inhoud, err = bewaarBeeldInhoud(ctx, oud.Token, data); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Plaatje opslaan mislukt: " + err.Error()})
						return
					}
				}
				upd := DB.NewUpdate().Model((*model.StudioGedeeldBeeld)(nil)).
					Set("hash = ?, grootte = ?, breedte = ?, hoogte = ?, diagram_naam = ?, bijgewerkt = ?", hash, len(data), in.Breedte, in.Hoogte, in.DiagramNaam, nu)
				if oud.Hash != hash {
					upd = upd.Set("object_key = ?, inhoud = ?", key, inhoud)
				}
				_, err = upd.Where("token = ?", oud.Token).Exec(ctx)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Plaatje bijwerken mislukt: " + err.Error()})
					return
				}
				uit.Gewijzigd = oud.Hash != hash
				uit.Hash, uit.Grootte, uit.Breedte, uit.Hoogte, uit.DiagramNaam, uit.Bijgewerkt = hash, int64(len(data)), in.Breedte, in.Hoogte, in.DiagramNaam, nu
			}
			c.JSON(http.StatusOK, uit)
			return
		case !errors.Is(err, sql.ErrNoRows):
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gedeelde plaatjes lezen mislukt: " + err.Error()})
			return
		}
		if in.AlleenBijwerken {
			// Het actuele adres is ingetrokken of bestaat niet (meer): Studio stopt met bijwerken.
			c.JSON(http.StatusNotFound, gin.H{"error": "Geen actueel gedeeld plaatje voor dit diagram."})
			return
		}
		token, err := nieuwBeeldToken()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Token maken mislukt."})
			return
		}
		key, inhoud, err := bewaarBeeldInhoud(ctx, token, data)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Plaatje opslaan mislukt: " + err.Error()})
			return
		}
		nu := time.Now()
		b := &model.StudioGedeeldBeeld{
			Token: token, ProjectID: id, ProfielID: in.ProfielID, DiagramID: in.DiagramID, DiagramNaam: in.DiagramNaam,
			Soort: in.Soort, Mediatype: "image/png", Hash: hash, Grootte: int64(len(data)), Breedte: in.Breedte, Hoogte: in.Hoogte,
			ObjectKey: key, Inhoud: inhoud, Aangemaakt: nu, Bijgewerkt: nu, Door: studioActor(c),
		}
		if _, err := DB.NewInsert().Model(b).Exec(ctx); err != nil {
			VerwijderBeeldObjecten(ctx, []string{key})
			// Twee tabbladen tegelijk een actueel adres: de unieke index laat er één winnen.
			// De client vraagt dan opnieuw en krijgt het bestaande adres.
			c.JSON(http.StatusConflict, gin.H{"error": "Plaatje opslaan mislukt (probeer opnieuw): " + err.Error()})
			return
		}
		uit := beeldMeta(b)
		uit.Gewijzigd = true
		c.JSON(http.StatusCreated, uit)
	}
}

// MaakStudioBeeldenLijstHandler — GET /api/studio/projecten/:id/beelden
func MaakStudioBeeldenLijstHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		if !studioProjectIDPatroon.MatchString(id) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id."})
			return
		}
		var rijen []model.StudioGedeeldBeeld
		err := DB.NewSelect().Model(&rijen).ExcludeColumn("inhoud").
			Where("project_id = ? AND ingetrokken_op IS NULL", id).
			OrderExpr("bijgewerkt DESC").Limit(500).Scan(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gedeelde plaatjes lezen mislukt: " + err.Error()})
			return
		}
		uit := make([]BeeldMeta, 0, len(rijen))
		for i := range rijen {
			uit = append(uit, beeldMeta(&rijen[i]))
		}
		c.JSON(http.StatusOK, gin.H{"beelden": uit})
	}
}

// MaakStudioBeeldIntrekkenHandler — DELETE /api/studio/projecten/:id/beelden/:token
// De rij blijft (wie deelde wat, wanneer ingetrokken); de inhoud gaat weg.
func MaakStudioBeeldIntrekkenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id, token := c.Param("id"), c.Param("token")
		if !studioProjectIDPatroon.MatchString(id) || !beeldTokenPatroon.MatchString(token) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Ongeldig project-id of token."})
			return
		}
		ctx := c.Request.Context()
		b := new(model.StudioGedeeldBeeld)
		err := DB.NewSelect().Model(b).ExcludeColumn("inhoud").Where("token = ? AND project_id = ? AND ingetrokken_op IS NULL", token, id).Scan(ctx)
		if errors.Is(err, sql.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Gedeeld plaatje niet gevonden (of al ingetrokken)."})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gedeeld plaatje lezen mislukt: " + err.Error()})
			return
		}
		if b.Door != studioActor(c) && huidigProjectRecht(c) < RechtSchrijven {
			c.JSON(http.StatusForbidden, gin.H{"error": "Alleen wie het plaatje deelde, of wie in het project mag schrijven, kan het intrekken."})
			return
		}
		_, err = DB.NewUpdate().Model((*model.StudioGedeeldBeeld)(nil)).
			Set("ingetrokken_op = ?, inhoud = NULL", time.Now()).
			Where("token = ?", token).Exec(ctx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Intrekken mislukt: " + err.Error()})
			return
		}
		VerwijderBeeldObjecten(ctx, []string{b.ObjectKey})
		c.Status(http.StatusNoContent)
	}
}

// MaakBeeldOpenbaarHandler — GET /api/beeld/:bestand (zonder inloggen; het token is de toegang)
func MaakBeeldOpenbaarHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := strings.TrimSuffix(c.Param("bestand"), ".png")
		h := c.Writer.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Robots-Tag", "noindex, nofollow")
		// Confluence, Teams en wiki's laden het plaatje vanaf hun eigen domein.
		h.Set("Cross-Origin-Resource-Policy", "cross-origin")
		if !beeldTokenPatroon.MatchString(token) {
			c.Status(http.StatusNotFound)
			return
		}
		b := new(model.StudioGedeeldBeeld)
		err := DB.NewSelect().Model(b).Where("token = ? AND ingetrokken_op IS NULL", token).Scan(c.Request.Context())
		if err != nil {
			if !errors.Is(err, sql.ErrNoRows) {
				c.Status(http.StatusInternalServerError)
				return
			}
			c.Status(http.StatusNotFound)
			return
		}
		etag := `"` + b.Hash + `"`
		h.Set("ETag", etag)
		h.Set("Last-Modified", b.Bijgewerkt.UTC().Format(http.TimeFormat))
		if b.Soort == beeldSoortMoment {
			h.Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			// Actueel: elke keer even navragen (een 304 kost bijna niets), zodat een nieuw plaatje
			// meteen zichtbaar is bij wie de pagina opnieuw laadt.
			h.Set("Cache-Control", "public, no-cache")
		}
		if c.GetHeader("If-None-Match") == etag {
			c.Status(http.StatusNotModified)
			return
		}
		if b.ObjectKey != "" {
			if !filestore.Beschikbaar {
				c.Status(http.StatusServiceUnavailable)
				return
			}
			r, _, size, err := filestore.Huidig().Download(c.Request.Context(), b.ObjectKey)
			if err != nil {
				c.Status(http.StatusInternalServerError)
				return
			}
			defer r.Close()
			c.DataFromReader(http.StatusOK, size, b.Mediatype, r, nil)
			return
		}
		c.Data(http.StatusOK, b.Mediatype, b.Inhoud)
	}
}
