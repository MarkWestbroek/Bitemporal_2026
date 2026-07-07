package handlers

// diff_handler.go — Delta-analyse endpoint voor de IDE/editor.
//
// POST /admin/diff/:password
//
// Vergelijkt het meegegeven V3 model (nieuw) met een referentiemodel (oud).
// De referentiebron is configureerbaar: actieve schema-versie, code, proposed,
// of een specifiek schema-versie ID.
//
// Retourneert een DeltaRapport als JSON, inclusief ernst-classificatie,
// migratie-informatie en samenvatting.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/schemadiff"
	"github.com/gin-gonic/gin"
)

// DiffRequest beschrijft de request body voor het diff endpoint.
type DiffRequest struct {
	// Model is het nieuwe V3 model (vanuit de editor).
	Model json.RawMessage `json:"model"`

	// Bron bepaalt waar het oude (referentie) model vandaan komt.
	// Ondersteunde waarden: "actief" (default), "code", "proposed", "id".
	Bron string `json:"bron"`

	// SchemaVersieID kiest expliciet een schema_versies record als referentie.
	// Alleen gebruikt als Bron == "id".
	SchemaVersieID *int64 `json:"schema_versie_id,omitempty"`

	// Domein filtert de vergelijking tot een specifiek domein.
	// Als leeg, worden alle domeinen vergeleken.
	Domein string `json:"domein"`
}

// DiffItemJSON is de JSON-representatie van een DeltaItem.
type DiffItemJSON struct {
	Ernst        string `json:"ernst"`
	Categorie    string `json:"categorie"`
	Actie        string `json:"actie"`
	Pad          string `json:"pad"`
	OudeWaarde   string `json:"oude_waarde,omitempty"`
	NieuweWaarde string `json:"nieuwe_waarde,omitempty"`
	Omschrijving string `json:"omschrijving"`
	Tabelnaam    string `json:"tabelnaam,omitempty"`
	Kolomnaam    string `json:"kolomnaam,omitempty"`
	DBType       string `json:"db_type,omitempty"`
}

// DiffResponse beschrijft de response van het diff endpoint.
type DiffResponse struct {
	Status        string `json:"status"` // "ok" of "fout"
	Samenvatting  string `json:"samenvatting"`
	IsBreaking    bool   `json:"is_breaking"`
	HeeftMigratie bool   `json:"heeft_migratie"`

	Totaal      int `json:"totaal"`
	Informatief int `json:"informatief"`
	Additief    int `json:"additief"`
	Modificatie int `json:"modificatie"`
	Destructief int `json:"destructief"`

	OudModelNaam   string `json:"oud_model_naam"`
	NieuwModelNaam string `json:"nieuw_model_naam"`
	Domein         string `json:"domein,omitempty"`

	Items []DiffItemJSON `json:"items"`

	// MigratieSQL bevat het gegenereerde migratie-SQL als er DB-wijzigingen zijn.
	MigratieSQL string `json:"migratie_sql,omitempty"`

	Error string `json:"error,omitempty"`
}

// MaakDiffHandler maakt de POST /admin/diff/:password handler.
func MaakDiffHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Beveiligingscontroles (zelfde als rebuild)
		if !isDevloopEnabled() {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "diff is alleen beschikbaar in devloop modus (DEVLOOP=true)",
			})
			return
		}

		if !eisBeheerWachtwoord(c, "DEVLOOP_PASSWORD") {
			return
		}

		// Parse request
		var req DiffRequest
		rawBody, err := readBodySafe(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, DiffResponse{
				Status: "fout",
				Error:  fmt.Sprintf("kan request body niet lezen: %v", err),
			})
			return
		}
		if len(bytes.TrimSpace(rawBody)) == 0 {
			c.JSON(http.StatusBadRequest, DiffResponse{
				Status: "fout",
				Error:  "request body is leeg — stuur minimaal een 'model' veld",
			})
			return
		}
		if err := json.Unmarshal(rawBody, &req); err != nil {
			c.JSON(http.StatusBadRequest, DiffResponse{
				Status: "fout",
				Error:  fmt.Sprintf("ongeldige JSON: %v", err),
			})
			return
		}

		// Nieuw model parsen
		if len(req.Model) == 0 {
			c.JSON(http.StatusBadRequest, DiffResponse{
				Status: "fout",
				Error:  "veld 'model' is verplicht (het nieuwe V3 model vanuit de editor)",
			})
			return
		}

		var nieuwModel model.V3Model
		if err := json.Unmarshal(req.Model, &nieuwModel); err != nil {
			// Probeer wrapper-formaat: { model: { ... } }
			var wrapper struct {
				Model model.V3Model `json:"model"`
			}
			if err2 := json.Unmarshal(req.Model, &wrapper); err2 != nil {
				c.JSON(http.StatusBadRequest, DiffResponse{
					Status: "fout",
					Error:  fmt.Sprintf("kan nieuw model niet parsen: %v", err),
				})
				return
			}
			nieuwModel = wrapper.Model
		}

		// Oud model laden op basis van bron
		oudModel, bronBeschrijving, err := laadOudModel(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, DiffResponse{
				Status: "fout",
				Error:  fmt.Sprintf("kan oud model niet laden (%s): %v", req.Bron, err),
			})
			return
		}

		// Vergelijking uitvoeren
		opties := []schemadiff.VergelijkOptie{}
		if strings.TrimSpace(req.Domein) != "" {
			opties = append(opties, schemadiff.MetDomeinFilter(req.Domein))
		}

		rapport := schemadiff.Vergelijk(oudModel, nieuwModel, opties...)

		// Migratie-SQL genereren als er DB-wijzigingen zijn
		var migratieSQL string
		if rapport.HeeftDBMigratie() {
			migratie := schemadiff.GenereerMigratie(rapport)
			migratieSQL = migratie.AlsSQL()
		}

		// Response opbouwen
		items := make([]DiffItemJSON, len(rapport.Items))
		for i, item := range rapport.Items {
			items[i] = DiffItemJSON{
				Ernst:        item.Ernst.String(),
				Categorie:    item.Categorie,
				Actie:        item.Actie,
				Pad:          item.Pad,
				OudeWaarde:   item.OudeWaarde,
				NieuweWaarde: item.NieuweWaarde,
				Omschrijving: item.Omschrijving,
				Tabelnaam:    item.Tabelnaam,
				Kolomnaam:    item.Kolomnaam,
				DBType:       item.DBType,
			}
		}

		c.JSON(http.StatusOK, DiffResponse{
			Status:         "ok",
			Samenvatting:   rapport.Samenvatting() + " — vergeleken met: " + bronBeschrijving,
			IsBreaking:     rapport.IsBreaking(),
			HeeftMigratie:  rapport.HeeftDBMigratie(),
			Totaal:         len(rapport.Items),
			Informatief:    len(rapport.Informatief()),
			Additief:       len(rapport.Additief()),
			Modificatie:    len(rapport.Modificaties()),
			Destructief:    len(rapport.Destructief()),
			OudModelNaam:   rapport.OudModelNaam,
			NieuwModelNaam: rapport.NieuwModelNaam,
			Domein:         rapport.Domein,
			Items:          items,
			MigratieSQL:    migratieSQL,
		})
	}
}

// laadOudModel laadt het referentiemodel op basis van de opgegeven bron.
func laadOudModel(req DiffRequest) (model.V3Model, string, error) {
	bron := strings.TrimSpace(strings.ToLower(req.Bron))
	if bron == "" {
		bron = "actief"
	}

	var modelBytes []byte
	var beschrijving string

	switch bron {
	case "actief", "active":
		bytes, melding, err := laadLaatsteSchemaVersieJSONOpStatus(model.SchemaVersieStatusActive)
		if err != nil {
			return model.V3Model{}, "actieve versie", err
		}
		modelBytes = bytes
		beschrijving = melding

	case "proposed", "latest_proposed", "laatste":
		bytes, melding, err := laadLaatsteSchemaVersieJSONOpStatus(model.SchemaVersieStatusProposed)
		if err != nil {
			return model.V3Model{}, "proposed versie", err
		}
		modelBytes = bytes
		beschrijving = melding

	case "id":
		if req.SchemaVersieID == nil {
			return model.V3Model{}, "specifiek ID", fmt.Errorf("schema_versie_id is verplicht bij bron=id")
		}
		bytes, melding, err := laadSchemaVersieJSONOpID(*req.SchemaVersieID)
		if err != nil {
			return model.V3Model{}, fmt.Sprintf("versie #%d", *req.SchemaVersieID), err
		}
		modelBytes = bytes
		beschrijving = melding

	case "code":
		// Exporteer het huidige model vanuit de MetaRegistry
		v3 := model.ExportMetaRegistryToV3()
		return v3, "huidige code (MetaRegistry)", nil

	default:
		return model.V3Model{}, bron, fmt.Errorf("onbekende bron %q — gebruik: actief, proposed, id, code", bron)
	}

	// Parse het geladen JSON naar V3Model
	var v3 model.V3Model
	if err := json.Unmarshal(modelBytes, &v3); err != nil {
		// Probeer wrapper-formaat
		var wrapper struct {
			Model model.V3Model `json:"model"`
		}
		if err2 := json.Unmarshal(modelBytes, &wrapper); err2 != nil {
			return model.V3Model{}, beschrijving, fmt.Errorf("kan JSON niet parsen als V3Model: %v", err)
		}
		v3 = wrapper.Model
	}

	return v3, beschrijving, nil
}

// readBodySafe leest de request body veilig uit.
func readBodySafe(c *gin.Context) ([]byte, error) {
	rawBody, err := c.GetRawData()
	if err != nil {
		return nil, err
	}
	return rawBody, nil
}
