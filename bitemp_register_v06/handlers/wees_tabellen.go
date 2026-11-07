package handlers

// wees_tabellen.go — tabellen van domeinen die niet meer in het register zitten (07-11-2026).
//
// Na een rebuild met `precies` (rebuild_domeinen.go) kent de code bepaalde domeinen niet meer,
// maar hun tabellen staan nog in de database: een rebuild gooit nooit iets weg (CODEGEN §7.3e).
// Op cg-test ging het om ~200 lege tabellen van de demo-domeinen uit het image. Opruimen is een
// bewuste beheerdersstap in twee delen:
//
//	GET  /admin/wees-tabellen            → welke tabellen, met hun aantal rijen; verandert niets
//	POST /admin/wees-tabellen/opruimen   → {"tabellen": [...]} precies de lijst van GET
//
// Waarborgen bij opruimen: de lijst moet gelijk zijn aan wat GET nu geeft (je ruimt op wat je
// gezien hebt); alle tabellen moeten leeg zijn en er mag geen `wijziging` naar hun types wijzen
// (dus nooit geregistreerde data); alles in één transactie, zonder CASCADE — een view of
// verwijzende tabel die eraan hangt laat het geheel mislukken. Alleen in een devloop
// (DEVLOOP=true, -tags devtools) met het beheerwachtwoord, zoals de rebuild.
//
// Kandidaten komen alleen uit gegenereerde registerbestanden: het image (_image/model, zoals
// Dockerfile.devloop het bewaart), de backup van vóór de laatste rebuild (_pre_rebuild/model),
// de baseline en model/. Daarvan vallen de tabellen en types af die de draaiende code kent.
// Een tabel die nergens in zo'n bestand staat (systeemtabellen, handwerk), komt er nooit in.

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// WeesTabel is één tabel zonder domein in het register.
type WeesTabel struct {
	Tabel  string `json:"tabel"`
	Prefix string `json:"prefix"` // de bestandsprefix van het domein waar hij vandaan kwam
	Rijen  int64  `json:"rijen"`
}

// WeesTabellenOverzicht is het antwoord van GET /admin/wees-tabellen.
type WeesTabellenOverzicht struct {
	Tabellen    []WeesTabel `json:"tabellen"`
	Wijzigingen int64       `json:"wijzigingen"` // wijziging-rijen die naar hun types wijzen
	Leeg        bool        `json:"leeg"`        // alle tabellen leeg en geen wijzigingen: opruimen kan
	Bronnen     []string    `json:"bronnen"`     // de gelezen mappen
	Toelichting string      `json:"toelichting"`
	Opgeruimd   []string    `json:"opgeruimd,omitempty"`
	Fout        string      `json:"fout,omitempty"`
}

// weesKandidaten: tabel → prefix en de typenamen, uit de gegenereerde registerbestanden in de
// gegeven mappen, zonder wat de draaiende MetaRegistry kent.
func weesKandidaten(mappen []string, live model.MetaRegistryType) (tabellen map[string]string, types []string, gelezen []string) {
	tabellen = map[string]string{}
	liveTabel := map[string]bool{}
	for _, tm := range live {
		if tm.Tabelnaam != "" {
			liveTabel[strings.ToLower(tm.Tabelnaam)] = true
		}
	}
	typeSet := map[string]bool{}
	for _, dir := range mappen {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		gelezen = append(gelezen, dir)
		for _, e := range entries {
			naam := e.Name()
			if e.IsDir() || !strings.HasSuffix(naam, "_metaregistry.go") || naam == "metaregistry_plumbing.go" {
				continue
			}
			prefix := strings.TrimSuffix(naam, "_metaregistry.go")
			b, err := os.ReadFile(filepath.Join(dir, naam))
			if err != nil {
				continue
			}
			for _, m := range reTabelnaam.FindAllSubmatch(b, -1) {
				t := strings.ToLower(string(m[1]))
				if !liveTabel[t] {
					if _, al := tabellen[t]; !al {
						tabellen[t] = prefix
					}
				}
			}
			for _, m := range reRegistryType.FindAllSubmatch(b, -1) {
				if _, ok := live[string(m[1])]; !ok {
					typeSet[string(m[1])] = true
				}
			}
		}
	}
	for t := range typeSet {
		types = append(types, t)
	}
	sort.Strings(types)
	return tabellen, types, gelezen
}

func weesMappen(appDir string) []string {
	return []string{
		filepath.Join(appDir, "_image", "model"),
		filepath.Join(appDir, "_pre_rebuild", "model"),
		filepath.Join(appDir, "_baseline", "model"),
		filepath.Join(appDir, "model"),
	}
}

// weesOverzicht bepaalt de wees-tabellen die echt in de database staan, met hun aantal rijen.
func weesOverzicht(ctx context.Context, db bun.IDB, mappen []string, live model.MetaRegistryType) (WeesTabellenOverzicht, error) {
	ov := WeesTabellenOverzicht{Tabellen: []WeesTabel{}}
	kandidaten, types, gelezen := weesKandidaten(mappen, live)
	ov.Bronnen = gelezen
	if len(kandidaten) == 0 {
		ov.Leeg = true
		ov.Toelichting = "Geen tabellen van weggelaten domeinen gevonden."
		return ov, nil
	}
	namen := make([]string, 0, len(kandidaten))
	for t := range kandidaten {
		namen = append(namen, t)
	}
	var bestaand []string
	if err := db.NewRaw(`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename IN (?) ORDER BY tablename`,
		bun.In(namen)).Scan(ctx, &bestaand); err != nil {
		return ov, fmt.Errorf("kan tabellen niet opzoeken: %w", err)
	}
	ov.Leeg = true
	for _, t := range bestaand {
		var n int64
		if err := db.NewRaw(`SELECT count(*) FROM `+pgIdentHandlers(t)).Scan(ctx, &n); err != nil {
			return ov, fmt.Errorf("kan rijen van %s niet tellen: %w", t, err)
		}
		if n > 0 {
			ov.Leeg = false
		}
		ov.Tabellen = append(ov.Tabellen, WeesTabel{Tabel: t, Prefix: kandidaten[t], Rijen: n})
	}
	if len(types) > 0 && len(ov.Tabellen) > 0 {
		if err := db.NewRaw(`SELECT count(*) FROM wijziging WHERE representatienaam IN (?)`, bun.In(types)).Scan(ctx, &ov.Wijzigingen); err != nil {
			return ov, fmt.Errorf("kan wijzigingen niet tellen: %w", err)
		}
		if ov.Wijzigingen > 0 {
			ov.Leeg = false
		}
	}
	switch {
	case len(ov.Tabellen) == 0:
		ov.Toelichting = "De weggelaten domeinen hebben geen tabellen in deze database."
	case ov.Leeg:
		ov.Toelichting = fmt.Sprintf("%d tabellen, alle leeg en nooit geregistreerd. Opruimen: POST /admin/wees-tabellen/opruimen met precies deze lijst.", len(ov.Tabellen))
	default:
		ov.Toelichting = "Niet alle tabellen zijn leeg, of er zijn wijzigingen naar hun types: opruimen wordt geweigerd. Neem het domein terug in het register, of verwijder de data bewust."
	}
	return ov, nil
}

// pgIdentHandlers citeert een tabelnaam als SQL-identifier.
func pgIdentHandlers(s string) string { return `"` + strings.ReplaceAll(s, `"`, `""`) + `"` }

// ruimWeesTabellenOp gooit de gevraagde tabellen weg als ze precies de wees-tabellen van nu zijn,
// alle leeg en zonder wijzigingen. Eén transactie, controle vooraf (binnen de transactie) en achteraf.
func ruimWeesTabellenOp(ctx context.Context, db *bun.DB, mappen []string, live model.MetaRegistryType, gevraagd []string) (WeesTabellenOverzicht, int, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return WeesTabellenOverzicht{}, http.StatusInternalServerError, err
	}
	defer tx.Rollback() //nolint:errcheck

	ov, err := weesOverzicht(ctx, tx, mappen, live)
	if err != nil {
		return ov, http.StatusInternalServerError, err
	}
	nu := make([]string, 0, len(ov.Tabellen))
	for _, t := range ov.Tabellen {
		nu = append(nu, t.Tabel)
	}
	want := make([]string, 0, len(gevraagd))
	for _, t := range gevraagd {
		if t = strings.ToLower(strings.TrimSpace(t)); t != "" {
			want = append(want, t)
		}
	}
	sort.Strings(nu)
	sort.Strings(want)
	if len(want) == 0 {
		return ov, http.StatusBadRequest, fmt.Errorf("geef de tabellen uit GET /admin/wees-tabellen mee")
	}
	if strings.Join(nu, ",") != strings.Join(want, ",") {
		return ov, http.StatusConflict, fmt.Errorf("de lijst wijkt af van de wees-tabellen van nu (%d gevraagd, %d nu); vraag het overzicht opnieuw op", len(want), len(nu))
	}
	if !ov.Leeg {
		return ov, http.StatusConflict, fmt.Errorf("niet alle tabellen zijn leeg of er zijn %d wijzigingen naar hun types; niets weggegooid", ov.Wijzigingen)
	}
	idents := make([]string, 0, len(nu))
	for _, t := range nu {
		idents = append(idents, pgIdentHandlers(t))
	}
	// Eén DROP voor alles: onderlinge verwijzingen tussen de wees-tabellen zijn dan geen
	// probleem, een verwijzing van buitenaf (of een view) wel — dan mislukt het geheel.
	if _, err := tx.ExecContext(ctx, `DROP TABLE `+strings.Join(idents, ", ")); err != nil {
		return ov, http.StatusConflict, fmt.Errorf("DROP mislukt, niets weggegooid: %w", err)
	}
	var over int
	if err := tx.NewRaw(`SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename IN (?)`, bun.In(nu)).Scan(ctx, &over); err != nil {
		return ov, http.StatusInternalServerError, err
	}
	if over != 0 {
		return ov, http.StatusInternalServerError, fmt.Errorf("controle achteraf: nog %d tabellen aanwezig; teruggedraaid", over)
	}
	if err := tx.Commit(); err != nil {
		return ov, http.StatusInternalServerError, err
	}
	ov.Opgeruimd = nu
	ov.Toelichting = fmt.Sprintf("%d tabellen weggegooid.", len(nu))
	return ov, http.StatusOK, nil
}

// MaakWeesTabellenHandler: GET /admin/wees-tabellen (overzicht, verandert niets).
func MaakWeesTabellenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !isDevloopEnabled() {
			c.JSON(http.StatusForbidden, gin.H{"error": "alleen beschikbaar in devloop modus (DEVLOOP=true)"})
			return
		}
		if !eisBeheerWachtwoord(c, "DEVLOOP_PASSWORD") {
			return
		}
		if DB == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database niet geïnitialiseerd"})
			return
		}
		ov, err := weesOverzicht(c.Request.Context(), DB, weesMappen(resolveAppDir()), model.MetaRegistry)
		if err != nil {
			ov.Fout = err.Error()
			c.JSON(http.StatusInternalServerError, ov)
			return
		}
		c.JSON(http.StatusOK, ov)
	}
}

// MaakWeesTabellenOpruimenHandler: POST /admin/wees-tabellen/opruimen {"tabellen": [...]}.
func MaakWeesTabellenOpruimenHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !isDevloopEnabled() {
			c.JSON(http.StatusForbidden, gin.H{"error": "alleen beschikbaar in devloop modus (DEVLOOP=true)"})
			return
		}
		if !eisBeheerWachtwoord(c, "DEVLOOP_PASSWORD") {
			return
		}
		if DB == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "database niet geïnitialiseerd"})
			return
		}
		var body struct {
			Tabellen []string `json:"tabellen"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ongeldige JSON: " + err.Error()})
			return
		}
		// Niet tegelijk met een rebuild (die de bestanden in model/ verandert).
		if !rebuildMutex.TryLock() {
			c.JSON(http.StatusConflict, gin.H{"error": "er loopt een rebuild; probeer het zo opnieuw", "reden": "bezig"})
			return
		}
		defer rebuildMutex.Unlock()
		ov, status, err := ruimWeesTabellenOp(c.Request.Context(), DB, weesMappen(resolveAppDir()), model.MetaRegistry, body.Tabellen)
		if err != nil {
			ov.Fout = err.Error()
			ov.Opgeruimd = nil
		}
		c.JSON(status, ov)
	}
}
