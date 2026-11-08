package handlers

// rebuild_domeinen.go — welke domeinen het register heeft (besluit Mark 07-11-2026).
//
// Een Studio-model mag meer domeinen hebben dan er gegenereerd worden ("goed bouwmateriaal"),
// maar bij genereren moet expliciet zijn wat er in het register komt. Daarom:
//
//   - Een rebuild kiest zijn domeinen: een lijst (`domeinen`), alle domeinen van het model
//     (`alle_domeinen: true`), of — bij een Studio-project zonder lijst — de bestaande: de
//     domeinen die het register nu al heeft en die in het model staan.
//   - `precies: true` maakt de lijst de samenstelling van het register: wat er niet op staat en
//     niet tot het standaardpakket hoort, gaat eruit (de gegenereerde bestanden en hun
//     init-aanroepen; hetzelfde mechanisme als scripts/bouw-domeinen.ps1). Zonder `precies`
//     blijft het additief: de gekozen domeinen worden (opnieuw) gebouwd, de rest blijft staan.
//   - Na elke rebuild die een versie activeert, onthoudt die versie zijn domeinen
//     (`schema_versies.gebouwde_domeinen`). De startup-rebuild bouwt precies die; zo komen
//     ingebakken domeinen uit het image er op een verse container niet terug.
//   - Het standaardpakket gaat altijd mee: de systeemdomeinen die de handgeschreven code nodig
//     heeft, en `gegevenstypen` (de datatypes van de NL-overheid-voorkeurslijst, in het
//     handgemaakte gegevenstypen_datatype_registry.go). Ze blijven staan zoals het image ze heeft;
//     alleen als je ze expliciet noemt, worden ze uit het model opnieuw gegenereerd.
//
// Zie docs/DEVLOOP.md §"Domeinen van het register" en CODEGEN.md §12.

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// standaardDomeinPrefixen gaan altijd mee, ook bij `precies` en ook als ze niet op de lijst van
// een schema-versie staan. register en ide_bestanden zijn compile-time nodig (handlers), de
// andere zijn systeemfuncties van Omnium (formulieren/weergaven/versies, gebruikers, het
// financiële basisdomein) en het datatypepakket. Een nieuw systeemdomein hoort hier bij in de
// release die het toevoegt; anders haalt de startup-rebuild het weg op een container waarvan de
// actieve versie een oudere lijst heeft.
var standaardDomeinPrefixen = []string{"beheer", "configuratie", "financieel", "gegevenstypen", "ide_bestanden", "register"}

// isHandgemaaktPakket: gegevenstypen heeft een handgemaakte, canonieke datatype-registry die
// codegen zou overschrijven. Alleen een expliciete lijst (of alle_domeinen) genereert het uit het
// model; "bestaande domeinen" en de startup-rebuild laten het staan zoals het image het heeft.
func isHandgemaaktPakket(prefix string) bool { return strings.EqualFold(prefix, "gegevenstypen") }

func isStandaardPrefix(prefix string) bool {
	p := strings.ToLower(prefix)
	for _, s := range standaardDomeinPrefixen {
		if s == p {
			return true
		}
	}
	return false
}

// UnmarshalJSON laat een domein ook als kale string toe: "domeinen": ["inrichting", "aanvraag"]
// naast de objectvorm {"domein": "np-loc", "prefix": "np_loc"}.
func (d *RebuildDomeinSpec) UnmarshalJSON(b []byte) error {
	b = bytes.TrimSpace(b)
	if len(b) > 0 && b[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		*d = RebuildDomeinSpec{Domein: strings.TrimSpace(s)}
		return nil
	}
	type alias RebuildDomeinSpec
	var a alias
	if err := json.Unmarshal(b, &a); err != nil {
		return err
	}
	*d = RebuildDomeinSpec(a)
	return nil
}

var (
	reDomeinVeld   = regexp.MustCompile(`Domein:\s*"([^"]*)"`)
	reRegistryType = regexp.MustCompile(`MetaRegistry\["([^"]+)"\]\s*=`)
	reTabelnaam    = regexp.MustCompile(`Tabelnaam:\s*"([^"]+)"`)
	reInitFunctie  = regexp.MustCompile(`func\s+(init\w+Registry)\s*\(`)
)

// aanwezigeDomeinen: de domeinen die nu in model/ gegenereerd staan, één per
// <prefix>_metaregistry.go, gesorteerd op prefix. De domeinnaam is het eerste niet-lege
// `Domein:` in dat bestand, anders de prefix.
func aanwezigeDomeinen(modelDir string) []model.GebouwdDomein {
	entries, err := os.ReadDir(modelDir)
	if err != nil {
		return nil
	}
	var uit []model.GebouwdDomein
	for _, e := range entries {
		naam := e.Name()
		if e.IsDir() || !strings.HasSuffix(naam, "_metaregistry.go") || naam == "metaregistry_plumbing.go" {
			continue
		}
		prefix := strings.TrimSuffix(naam, "_metaregistry.go")
		domein := prefix
		if b, err := os.ReadFile(filepath.Join(modelDir, naam)); err == nil {
			for _, m := range reDomeinVeld.FindAllSubmatch(b, -1) {
				if d := strings.TrimSpace(string(m[1])); d != "" {
					domein = d
					break
				}
			}
		}
		uit = append(uit, model.GebouwdDomein{Domein: domein, Prefix: prefix})
	}
	sort.Slice(uit, func(i, j int) bool { return uit[i].Prefix < uit[j].Prefix })
	return uit
}

// domeinenKeuze is de uitkomst van kiesDomeinRuns: welke domeinen gegenereerd worden, en bij
// `precies` welke prefixen het register houdt (nil = additief, niets weglaten).
type domeinenKeuze struct {
	runs    []RebuildDomeinSpec
	houden  []string
	melding string
}

// kiesDomeinRuns bepaalt de codegen-runs voor een meer-domeinen-rebuild.
//   - modelRuns: alle domeinen van het model (domeinRunsUitModel), met de bestaande prefixen.
//   - aanwezig: de domeinen die het register nu heeft (aanwezigeDomeinen).
//   - lijst/alle/precies: uit de request. project: de bron is een Studio-project (dan is
//     "bestaande domeinen" de standaard zonder lijst).
//
// ok=false met een foutmelding als de keuze ongeldig is. ok=true met lege runs betekent: geen
// meer-domeinen-rebuild (de oude enkel-domein-route van de handler geldt).
func kiesDomeinRuns(modelRuns []RebuildDomeinSpec, aanwezig []model.GebouwdDomein, lijst []RebuildDomeinSpec, alle, precies, project bool) (domeinenKeuze, string) {
	var k domeinenKeuze
	opPrefix := map[string]RebuildDomeinSpec{}
	opDomein := map[string]RebuildDomeinSpec{}
	for _, r := range modelRuns {
		opPrefix[strings.ToLower(r.Prefix)] = r
		opDomein[strings.ToLower(r.Domein)] = r
	}
	switch {
	case alle && len(lijst) > 0:
		return k, "geef óf domeinen óf alle_domeinen, niet allebei"
	case alle:
		k.runs = append(k.runs, modelRuns...)
		k.melding = fmt.Sprintf("Alle %d domeinen van het model bouwen", len(modelRuns))
	case len(lijst) > 0:
		gezien := map[string]bool{}
		for _, d := range lijst {
			sleutel := strings.ToLower(strings.TrimSpace(d.Domein))
			if sleutel == "" {
				return k, "leeg domein in de lijst"
			}
			r, ok := opDomein[sleutel]
			if !ok {
				r, ok = opPrefix[strings.ToLower(strings.ReplaceAll(sleutel, "-", "_"))]
			}
			if !ok {
				return k, fmt.Sprintf("domein %q staat niet in het model", d.Domein)
			}
			if p := strings.TrimSpace(d.Prefix); p != "" {
				r.Prefix = p
			}
			if !gezien[strings.ToLower(r.Prefix)] {
				gezien[strings.ToLower(r.Prefix)] = true
				k.runs = append(k.runs, r)
			}
		}
		k.melding = fmt.Sprintf("Gekozen domeinen bouwen: %s", runNamen(k.runs))
	case project:
		heeft := map[string]bool{}
		for _, a := range aanwezig {
			heeft[strings.ToLower(a.Prefix)] = true
		}
		for _, r := range modelRuns {
			if heeft[strings.ToLower(r.Prefix)] && !isHandgemaaktPakket(r.Prefix) {
				k.runs = append(k.runs, r)
			}
		}
		if len(k.runs) == 0 {
			return k, "geen van de domeinen van het project zit al in het register; kies ze met domeinen (of alle_domeinen)"
		}
		k.melding = fmt.Sprintf("Bestaande domeinen bouwen (in het register én in het model): %s", runNamen(k.runs))
	default:
		if precies {
			return k, "precies vraagt een domeinenlijst (domeinen) of alle_domeinen"
		}
		return k, ""
	}

	// Het datatypepakket (gegevenstypen) wordt NIET automatisch opnieuw gegenereerd: zijn
	// gegevenstypen_datatype_registry.go is het handgemaakte, canonieke bestand dat duplicaten
	// uit andere domeinen vervangt; codegen zou het overschrijven met de versie uit het model.
	// Het blijft als standaardpakket staan zoals het image het heeft; noem het domein expliciet
	// om het toch uit het model te genereren.
	if precies {
		for _, r := range k.runs {
			k.houden = append(k.houden, r.Prefix)
		}
		k.melding += "; precies: andere domeinen gaan eruit (behalve het standaardpakket)"
	}
	return k, ""
}

func gebouwdeNamen(g []model.GebouwdDomein) string {
	namen := make([]string, 0, len(g))
	for _, d := range g {
		namen = append(namen, d.Domein)
	}
	return strings.Join(namen, ", ")
}

// laadGebouwdeDomeinenVanActieveVersie leest de domeinenlijst van de nieuwste actieve
// schema-versie. De startup-rebuild draait vóór de migraties van dbsetup: bestaat de kolom nog
// niet (database van vóór 0.22.0), dan is er geen lijst — geen fout (zie de uitval van 0.24.13).
func laadGebouwdeDomeinenVanActieveVersie(ctx context.Context) ([]model.GebouwdDomein, error) {
	if DB == nil {
		return nil, fmt.Errorf("database niet geïnitialiseerd")
	}
	var n int
	if err := DB.NewRaw(`SELECT count(*) FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = 'schema_versies' AND column_name = 'gebouwde_domeinen'`).
		Scan(ctx, &n); err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, nil
	}
	var waarde sql.NullString
	err := DB.NewRaw(`SELECT gebouwde_domeinen::text FROM schema_versies WHERE status = ? ORDER BY id DESC LIMIT 1`,
		model.SchemaVersieStatusActive).Scan(ctx, &waarde)
	if err == sql.ErrNoRows || !waarde.Valid || strings.TrimSpace(waarde.String) == "" || waarde.String == "null" {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var g []model.GebouwdDomein
	if err := json.Unmarshal([]byte(waarde.String), &g); err != nil {
		return nil, fmt.Errorf("gebouwde_domeinen onleesbaar: %w", err)
	}
	return g, nil
}

func runNamen(runs []RebuildDomeinSpec) string {
	namen := make([]string, 0, len(runs))
	for _, r := range runs {
		namen = append(namen, r.Domein)
	}
	return strings.Join(namen, ", ")
}

// weggelatenDomeinen beschrijft wat laatDomeinenWeg heeft verwijderd, voor de verwijzingscontrole
// na codegen: typenaam → prefix en tabelnaam → prefix.
type weggelatenDomeinen struct {
	prefixen  []string
	types     map[string]string
	tabellen  map[string]string
	datatypes map[string]string // datatypenaam → prefix (uit <prefix>_datatype_registry.go)
}

// laatDomeinenWeg verwijdert uit modelDir de gegenereerde bestanden van elk aanwezig domein
// waarvan de prefix niet in houden staat (hoofdletterongevoelig) en geen standaarddomein is, en
// haalt hun init-aanroepen uit metaregistry_plumbing.go. Handgeschreven bestanden blijven staan.
func laatDomeinenWeg(modelDir string, houden []string) (weggelatenDomeinen, error) {
	w := weggelatenDomeinen{types: map[string]string{}, tabellen: map[string]string{}, datatypes: map[string]string{}}
	hou := map[string]bool{}
	for _, p := range houden {
		hou[strings.ToLower(p)] = true
	}
	var initNamen []string
	for _, d := range aanwezigeDomeinen(modelDir) {
		if hou[strings.ToLower(d.Prefix)] || isStandaardPrefix(d.Prefix) {
			continue
		}
		w.prefixen = append(w.prefixen, d.Prefix)
		for _, suffix := range codegenGegeneerdeSuffixen {
			pad := filepath.Join(modelDir, d.Prefix+suffix)
			b, err := os.ReadFile(pad)
			if err != nil {
				if os.IsNotExist(err) {
					continue
				}
				return w, fmt.Errorf("kan %s niet lezen: %w", pad, err)
			}
			for _, m := range reInitFunctie.FindAllSubmatch(b, -1) {
				initNamen = append(initNamen, string(m[1]))
			}
			if suffix == "_metaregistry.go" {
				for _, m := range reRegistryType.FindAllSubmatch(b, -1) {
					w.types[string(m[1])] = d.Prefix
				}
				for _, m := range reTabelnaam.FindAllSubmatch(b, -1) {
					w.tabellen[string(m[1])] = d.Prefix
				}
			}
			if suffix == "_datatype_registry.go" {
				for _, m := range reDatatypeNaam.FindAllSubmatch(b, -1) {
					w.datatypes[string(m[1])] = d.Prefix
				}
			}
			if err := os.Remove(pad); err != nil {
				return w, fmt.Errorf("kan %s niet verwijderen: %w", pad, err)
			}
		}
	}
	if len(initNamen) == 0 {
		return w, nil
	}
	plumbing := filepath.Join(modelDir, "metaregistry_plumbing.go")
	b, err := os.ReadFile(plumbing)
	if err != nil {
		return w, fmt.Errorf("kan %s niet lezen: %w", plumbing, err)
	}
	tekst := string(b)
	for _, n := range initNamen {
		re := regexp.MustCompile(`(?m)^[ \t]*` + regexp.QuoteMeta(n) + `\(\)[ \t]*\r?\n`)
		tekst = re.ReplaceAllString(tekst, "")
	}
	if err := os.WriteFile(plumbing, []byte(tekst), 0644); err != nil {
		return w, fmt.Errorf("kan %s niet schrijven: %w", plumbing, err)
	}
	return w, nil
}

// verwijzingenFout: de keuze bij `precies` laat een domein weg waar een overgebleven domein naar
// verwijst. De handler geeft er 422 met reden "verwijzingen" voor (een keuze van de aanroeper,
// geen serverfout).
type verwijzingenFout struct{ plekken []string }

func (e *verwijzingenFout) Error() string {
	return "de gekozen domeinen verwijzen naar weggelaten domeinen; neem die ook mee of pas het model aan:\n  " +
		strings.Join(e.plekken, "\n  ")
}

var (
	reVerwijsVeld   = regexp.MustCompile(`(Doeltype|DoelEntiteit|BovenliggendTypenaam|ParentTypenaam):\s*"([^"]+)"`)
	reSecundaireKol = regexp.MustCompile(`SecondaireEntiteitIDKolom:\s*"([^"]+)_id"`)
	reOnderliggend  = regexp.MustCompile(`VoegOnderliggendGEToe\(\s*"([^"]+)"`)
	reRefTag        = regexp.MustCompile(`ref:([A-Za-z_]\w*)`)
	reDatatypeTag   = regexp.MustCompile(`datatype:([A-Za-z_]\w*)`)
	// Ook de compacte vorm `{Naam: "Emailadres", …}` van gegevenstypen_datatype_registry.go.
	reDatatypeNaam = regexp.MustCompile(`\bNaam:\s*"([^"]+)"`)
)

// gedefinieerdeDatatypes: de datatypes die na het weglaten nog een registryregel hebben, uit
// alle overgebleven *datatype_registry.go (gegenereerd én extra_datatype_registry.go).
func gedefinieerdeDatatypes(modelDir string) map[string]bool {
	uit := map[string]bool{}
	entries, _ := os.ReadDir(modelDir)
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), "datatype_registry.go") {
			continue
		}
		if b, err := os.ReadFile(filepath.Join(modelDir, e.Name())); err == nil {
			for _, m := range reDatatypeNaam.FindAllSubmatch(b, -1) {
				uit[string(m[1])] = true
			}
		}
	}
	return uit
}

// verwijzingenNaarWeggelaten zoekt in de overgebleven domeinen naar verwijzingen naar types of
// tabellen van weggelaten domeinen: relatie-doelen, onderliggende elementen, secundaire
// relatiekolommen en $ref-velden. Zulke verwijzingen compileren vaak gewoon (het zijn strings),
// maar de relatie werkt dan niet; daarom weigert de rebuild (zoals bouw-domeinen.ps1).
func verwijzingenNaarWeggelaten(modelDir string, w weggelatenDomeinen) []string {
	if len(w.prefixen) == 0 {
		return nil
	}
	var fouten []string
	gezien := map[string]bool{}
	nogGedefinieerd := gedefinieerdeDatatypes(modelDir)
	voeg := func(f string) {
		if !gezien[f] {
			gezien[f] = true
			fouten = append(fouten, f)
		}
	}
	for _, d := range aanwezigeDomeinen(modelDir) {
		for _, naam := range []string{"_metaregistry.go", "_modellen_ge_rel.go", "_modellen_entiteiten.go"} {
			bestand := d.Prefix + naam
			b, err := os.ReadFile(filepath.Join(modelDir, bestand))
			if err != nil {
				continue
			}
			for i, regel := range strings.Split(string(b), "\n") {
				plek := fmt.Sprintf("%s:%d", bestand, i+1)
				if naam == "_metaregistry.go" {
					for _, m := range reVerwijsVeld.FindAllStringSubmatch(regel, -1) {
						if p, ok := w.types[m[2]]; ok {
							voeg(fmt.Sprintf("%s: %s %q hoort bij weggelaten domein %s", plek, m[1], m[2], p))
						}
					}
					if m := reSecundaireKol.FindStringSubmatch(regel); m != nil {
						if p, ok := w.tabellen[m[1]]; ok {
							voeg(fmt.Sprintf("%s: relatie naar %q (weggelaten domein %s)", plek, m[1], p))
						}
					}
					if m := reOnderliggend.FindStringSubmatch(regel); m != nil {
						if p, ok := w.types[m[1]]; ok {
							voeg(fmt.Sprintf("%s: VoegOnderliggendGEToe op %q (weggelaten domein %s)", plek, m[1], p))
						}
					}
					continue
				}
				for _, m := range reRefTag.FindAllStringSubmatch(regel, -1) {
					if p, ok := w.types[m[1]]; ok {
						voeg(fmt.Sprintf("%s: veld met $ref %q (weggelaten domein %s)", plek, m[1], p))
					}
				}
				// Een datatype waarvan de registryregel met zijn domein verdwijnt (bv. GitAdres uit
				// CG, gebruikt door inrichting): de Go-alias blijft in datatype_aliases.go, dus het
				// compileert, maar het formaat en de validatie zijn weg.
				for _, m := range reDatatypeTag.FindAllStringSubmatch(regel, -1) {
					if p, ok := w.datatypes[m[1]]; ok && !nogGedefinieerd[m[1]] {
						voeg(fmt.Sprintf("%s: veld met datatype %q (gedefinieerd in weggelaten domein %s)", plek, m[1], p))
					}
				}
			}
		}
	}
	return fouten
}
