package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/filestore"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// MaxInlineGrootte is de drempelwaarde voor inline vs. MinIO-opslag.
// Bestanden tot deze grootte worden inline in de DB opgeslagen; grotere bestanden gaan naar MinIO.
// Standaard 1 MB; overschrijfbaar via env var BESTAND_INLINE_DREMPEL_MB.
var MaxInlineGrootte int64 = 1024 * 1024

// MaxBestandGrootte is de absolute bovengrens voor uploads.
// Standaard 500 MB; overschrijfbaar via env var BESTAND_MAX_GROOTTE_MB.
var MaxBestandGrootte int64 = 500 * 1024 * 1024

func init() {
	if v := os.Getenv("BESTAND_INLINE_DREMPEL_MB"); v != "" {
		if mb, err := strconv.ParseInt(v, 10, 64); err == nil && mb > 0 {
			MaxInlineGrootte = mb * 1024 * 1024
		}
	}
	if v := os.Getenv("BESTAND_MAX_GROOTTE_MB"); v != "" {
		if mb, err := strconv.ParseInt(v, 10, 64); err == nil && mb > 0 {
			MaxBestandGrootte = mb * 1024 * 1024
		}
	}
}

// MaakUploadBestandHandler retourneert een handler voor multipart file upload.
// Slaat het bestand op als IdeBestand in de database (inline of MinIO via RegistreerBestandSnapshot).
//
// POST /api/bestanden/upload
// multipart/form-data met velden: file, naam (optioneel), beschrijving (optioneel),
// categorie, bestandsformaat, domein (optioneel), tags (optioneel), versie_label (optioneel)
func MaakUploadBestandHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Bestand ontbreekt in upload: " + err.Error()})
			return
		}
		defer file.Close()

		// Vroeg-check op bestandsgrootte via Content-Length header (snel, zonder inlezen)
		if header.Size > MaxBestandGrootte {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": fmt.Sprintf("Bestand te groot: %d MB (maximum is %d MB).", header.Size/1024/1024, MaxBestandGrootte/1024/1024),
			})
			return
		}

		// Lees het volledige bestand in geheugen
		data, err := io.ReadAll(file)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Bestand lezen mislukt: " + err.Error()})
			return
		}

		// Definitieve check na inlezen (verdedigingslinie tegen afwijkende header.Size)
		if int64(len(data)) > MaxBestandGrootte {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error": fmt.Sprintf("Bestand te groot: %d MB (maximum is %d MB).", int64(len(data))/1024/1024, MaxBestandGrootte/1024/1024),
			})
			return
		}

		naam := c.PostForm("naam")
		if naam == "" {
			naam = header.Filename
		}
		beschrijving := c.PostForm("beschrijving")
		categorie := c.PostForm("categorie")
		bestandsformaat := c.PostForm("bestandsformaat")
		if bestandsformaat == "" {
			bestandsformaat = detecteerFormaat(naam)
		}
		mimeType := header.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = http.DetectContentType(data)
		}
		domein := c.PostForm("domein")
		tags := c.PostForm("tags")
		versieLabel := c.PostForm("versie_label")

		// Sla op in DB (inline of MinIO) via de standaard snapshot-registratie.
		err = RegistreerBestandSnapshot(c.Request.Context(), DB, BestandSnapshotParams{
			Naam:         naam,
			Beschrijving: beschrijving,
			Categorie:    model.IdeBestandCategorie(categorie),
			Formaat:      model.IdeBestandFormaat(bestandsformaat),
			MimeType:     mimeType,
			Domein:       domein,
			Tags:         tags,
			VersieLabel:  versieLabel,
			Inhoud:       string(data),
			Opmerking:    "upload via IDE bestanden-tab",
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Opslaan mislukt: " + err.Error()})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"status": "opgeslagen", "naam": naam})
	}
}

// MaakDownloadBestandHandler retourneert een handler voor bestandsdownload.
// Haalt het bestand op uit de database (inline) of uit MinIO (object_key).
//
// GET /api/bestanden/:id/download
func MaakDownloadBestandHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		// Haal de IdeBestand_Inhoud_Data op met de actuele (niet-afgevoerde) versie
		var inhoud model.IdeBestand_Inhoud_Data
		err := DB.NewSelect().
			Model(&inhoud).
			Where("idebestand_id = ?", id).
			Where("afvoer IS NULL").
			OrderExpr("versie DESC").
			Limit(1).
			Scan(c.Request.Context())

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Bestandsinhoud niet gevonden"})
			return
		}

		// Haal metadata op voor Content-Disposition
		var meta model.IdeBestand_Meta_Data
		_ = DB.NewSelect().
			Model(&meta).
			Where("idebestand_id = ?", id).
			Where("afvoer IS NULL").
			OrderExpr("versie DESC").
			Limit(1).
			Scan(c.Request.Context())

		bestandsnaam := "bestand"
		if meta.Naam != "" {
			bestandsnaam = meta.Naam
		}

		if inhoud.OpslagType == model.IdeBestandOpslagTypeInline {
			c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, bestandsnaam))
			c.Header("Content-Type", "application/octet-stream")
			c.String(http.StatusOK, inhoud.InlineInhoud)
			return
		}

		// MinIO download
		if !filestore.Beschikbaar {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "MinIO niet beschikbaar"})
			return
		}

		reader, contentType, size, err := filestore.Huidig().Download(c.Request.Context(), inhoud.ObjectKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "MinIO download mislukt: " + err.Error()})
			return
		}
		defer reader.Close()

		c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, bestandsnaam))
		c.Header("Content-Type", contentType)
		c.Header("Content-Length", fmt.Sprintf("%d", size))
		c.Status(http.StatusOK)
		io.Copy(c.Writer, reader)
	}
}

// MaakPreviewBestandHandler retourneert een handler voor inline preview van tekstbestanden.
//
// GET /api/bestanden/:id/preview
func MaakPreviewBestandHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var inhoud model.IdeBestand_Inhoud_Data
		err := DB.NewSelect().
			Model(&inhoud).
			Where("idebestand_id = ?", id).
			Where("afvoer IS NULL").
			OrderExpr("versie DESC").
			Limit(1).
			Scan(c.Request.Context())

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Bestandsinhoud niet gevonden"})
			return
		}

		var meta model.IdeBestand_Meta_Data
		_ = DB.NewSelect().
			Model(&meta).
			Where("idebestand_id = ?", id).
			Where("afvoer IS NULL").
			OrderExpr("versie DESC").
			Limit(1).
			Scan(c.Request.Context())

		if inhoud.OpslagType == model.IdeBestandOpslagTypeInline {
			c.JSON(http.StatusOK, gin.H{
				"naam":            meta.Naam,
				"bestandsformaat": meta.Bestandsformaat,
				"mime_type":       meta.MimeType,
				"inhoud":          inhoud.InlineInhoud,
				"grootte_bytes":   inhoud.GrootteBytes,
			})
			return
		}

		// MinIO: lees tekst-preview (max 2 MB)
		if !filestore.Beschikbaar {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "MinIO niet beschikbaar"})
			return
		}

		reader, _, _, err := filestore.Huidig().Download(c.Request.Context(), inhoud.ObjectKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "MinIO download mislukt: " + err.Error()})
			return
		}
		defer reader.Close()

		// Beperk tot 2 MB voor preview
		beperkt := io.LimitReader(reader, 2*1024*1024)
		data, err := io.ReadAll(beperkt)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Preview lezen mislukt: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"naam":            meta.Naam,
			"bestandsformaat": meta.Bestandsformaat,
			"mime_type":       meta.MimeType,
			"inhoud":          string(data),
			"grootte_bytes":   inhoud.GrootteBytes,
			"afgekapt":        int64(len(data)) < inhoud.GrootteBytes,
		})
	}
}

// RegistreerBestandSnapshot slaat een IdeBestand op als bitemporale registratie.
// Wordt intern aangeroepen door auto-snapshot hooks (publish, rebuild) en de upload handler.
func RegistreerBestandSnapshot(ctx context.Context, db *bun.DB, params BestandSnapshotParams) error {
	grootte := int64(len(params.Inhoud))
	if grootte > MaxBestandGrootte {
		return fmt.Errorf("bestand te groot: %d MB (maximum is %d MB)", grootte/1024/1024, MaxBestandGrootte/1024/1024)
	}

	sha256Hash := filestore.BerekenSHA256([]byte(params.Inhoud))

	opslagType := model.IdeBestandOpslagTypeInline
	objectKey := ""
	inlineInhoud := params.Inhoud

	// Grote bestanden naar MinIO als beschikbaar
	if grootte > MaxInlineGrootte && filestore.Beschikbaar {
		opslagType = model.IdeBestandOpslagTypeMinio
		objectKey = genereerObjectKey(string(params.Categorie), params.Naam)
		inlineInhoud = ""

		_, err := filestore.Huidig().Upload(
			ctx,
			objectKey,
			bytes.NewReader([]byte(params.Inhoud)),
			grootte,
			params.MimeType,
		)
		if err != nil {
			return fmt.Errorf("minio upload voor snapshot mislukt: %w", err)
		}
	}

	// Bepaal volgend IdeBestand ID
	var maxID int64
	err := db.NewSelect().
		TableExpr("idebestand").
		ColumnExpr("COALESCE(MAX(id), 0)").
		Scan(ctx, &maxID)
	if err != nil {
		return fmt.Errorf("max id ophalen mislukt: %w", err)
	}
	nieuwID := maxID + 1

	// Registratie aanmaken — tijdstip nu instellen zodat het terugkomt via Returning
	var opmerking *string
	if params.Opmerking != "" {
		o := params.Opmerking
		opmerking = &o
	}
	nu := time.Now()
	reg := model.Registratie{
		Registratietype: model.RegistratietypeRegistratie,
		Opmerking:       opmerking,
		Tijdstip:        nu,
	}
	_, err = db.NewInsert().Model(&reg).Returning("*").Exec(ctx)
	if err != nil {
		return fmt.Errorf("registratie aanmaken mislukt: %w", err)
	}
	opvoerTijdstip := reg.Tijdstip

	// Wijziging 1: opvoer entiteit
	wij1 := model.Wijziging{
		RegistratieID:     reg.ID,
		Wijzigingstype:    model.WijzigingstypeOpvoer,
		Representatienaam: "idebestand",
	}
	_, err = db.NewInsert().Model(&wij1).Exec(ctx)
	if err != nil {
		return fmt.Errorf("wijziging entiteit aanmaken mislukt: %w", err)
	}

	// IdeBestand entiteit
	ent := model.IdeBestand{ID: int(nieuwID), Opvoer: &opvoerTijdstip}
	_, err = db.NewInsert().Model(&ent).Exec(ctx)
	if err != nil {
		return fmt.Errorf("ide_bestand insert mislukt: %w", err)
	}

	// Wijziging 2: opvoer Meta hub + data
	wij2 := model.Wijziging{
		RegistratieID:     reg.ID,
		Wijzigingstype:    model.WijzigingstypeOpvoer,
		Representatienaam: "idebestand_meta_data",
	}
	_, err = db.NewInsert().Model(&wij2).Exec(ctx)
	if err != nil {
		return fmt.Errorf("wijziging meta aanmaken mislukt: %w", err)
	}

	metaHub := model.IdeBestand_Meta{
		IdeBestand_ID: int(nieuwID),
		Rel_ID:        1,
		Opvoer:        &opvoerTijdstip,
	}
	_, err = db.NewInsert().Model(&metaHub).Exec(ctx)
	if err != nil {
		return fmt.Errorf("meta hub insert mislukt: %w", err)
	}

	metaData := model.IdeBestand_Meta_Data{
		IdeBestand_ID:   int(nieuwID),
		Rel_ID:          1,
		Versie:          1,
		Naam:            params.Naam,
		Beschrijving:    params.Beschrijving,
		Categorie:       params.Categorie,
		Bestandsformaat: params.Formaat,
		MimeType:        params.MimeType,
		Domein:          params.Domein,
		Tags:            params.Tags,
		Opvoer:          &opvoerTijdstip,
	}
	_, err = db.NewInsert().Model(&metaData).Exec(ctx)
	if err != nil {
		return fmt.Errorf("meta data insert mislukt: %w", err)
	}

	// Wijziging 3: opvoer Inhoud hub + data
	wij3 := model.Wijziging{
		RegistratieID:     reg.ID,
		Wijzigingstype:    model.WijzigingstypeOpvoer,
		Representatienaam: "idebestand_inhoud_data",
	}
	_, err = db.NewInsert().Model(&wij3).Exec(ctx)
	if err != nil {
		return fmt.Errorf("wijziging inhoud aanmaken mislukt: %w", err)
	}

	inhoudHub := model.IdeBestand_Inhoud{
		IdeBestand_ID: int(nieuwID),
		Rel_ID:        1,
		Opvoer:        &opvoerTijdstip,
	}
	_, err = db.NewInsert().Model(&inhoudHub).Exec(ctx)
	if err != nil {
		return fmt.Errorf("inhoud hub insert mislukt: %w", err)
	}

	inhoudData := model.IdeBestand_Inhoud_Data{
		IdeBestand_ID: int(nieuwID),
		Rel_ID:        1,
		Versie:        1,
		OpslagType:    opslagType,
		InlineInhoud:  inlineInhoud,
		ObjectKey:     objectKey,
		Sha256Hash:    sha256Hash,
		GrootteBytes:  grootte,
		VersieLabel:   params.VersieLabel,
		Opvoer:        &opvoerTijdstip,
	}
	_, err = db.NewInsert().Model(&inhoudData).Exec(ctx)
	if err != nil {
		return fmt.Errorf("inhoud data insert mislukt: %w", err)
	}

	fmt.Printf("IdeBestand snapshot geregistreerd: id=%d, naam=%s, categorie=%s, grootte=%d bytes\n",
		nieuwID, params.Naam, params.Categorie, grootte)
	return nil
}

// BestandSnapshotParams bevat de parameters voor het aanmaken van een IdeBestand snapshot.
type BestandSnapshotParams struct {
	Naam         string
	Beschrijving string
	Categorie    model.IdeBestandCategorie
	Formaat      model.IdeBestandFormaat
	MimeType     string
	Domein       string
	Tags         string
	VersieLabel  string
	Inhoud       string
	Opmerking    string
}

// --- Hulpfuncties ---

// detecteerFormaat bepaalt het bestandsformaat op basis van de bestandsnaam extensie.
func detecteerFormaat(naam string) string {
	ext := strings.ToLower(path.Ext(naam))
	switch ext {
	case ".json":
		return "json"
	case ".yaml", ".yml":
		return "yaml"
	case ".xml":
		return "xml"
	case ".md", ".markdown":
		return "markdown"
	case ".go":
		return "go_code"
	case ".sql":
		return "sql"
	case ".txt", ".text", ".log":
		return "tekst"
	default:
		return "overig"
	}
}

// isTekstFormaat geeft aan of het bestandsformaat een tekstformaat is.
func isTekstFormaat(formaat string) bool {
	switch formaat {
	case "json", "yaml", "xml", "markdown", "go_code", "sql", "tekst":
		return true
	default:
		return false
	}
}

// genereerObjectKey maakt een unieke MinIO object key aan.
func genereerObjectKey(categorie, naam string) string {
	if categorie == "" {
		categorie = "overig"
	}
	now := time.Now()
	return fmt.Sprintf("%s/%d/%02d/%d_%s",
		categorie,
		now.Year(),
		now.Month(),
		now.UnixNano(),
		sanitizeBestandsnaam(naam),
	)
}

// sanitizeBestandsnaam verwijdert onveilige tekens uit bestandsnamen.
func sanitizeBestandsnaam(naam string) string {
	// Verwijder pad-scheidingstekens en gevaarlijke tekens
	naam = strings.ReplaceAll(naam, "/", "_")
	naam = strings.ReplaceAll(naam, "\\", "_")
	naam = strings.ReplaceAll(naam, "..", "_")
	naam = strings.ReplaceAll(naam, "\x00", "")
	if naam == "" {
		naam = "bestand"
	}
	return naam
}
