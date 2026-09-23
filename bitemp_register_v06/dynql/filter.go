package dynql

// filter.go — generiek filter-argument op de lijst-queries.
//
// Plan: docs/plans/2026-09-22 Aanmeldformulier CG PF als formulierdefinitie (analyse).md §7.6.
// Uitleg voor gebruikers: docs/dynamische-graphql-laag.md, paragraaf "Filteren".
//
// Alles wordt uit de MetaRegistry afgeleid; er staat geen typenaam in deze code.
// Per entiteit ontstaat een input-type <Entiteit>Filter met:
//   - de eigen kolommen van de entiteit (in de praktijk: id);
//   - per onderliggend GE of relatie een <Kind>Filter met de kolommen van hub én
//     _Data samen — dezelfde platgeslagen vorm als het GraphQL-outputtype;
//   - and / or / not om condities te combineren.
//
// Semantiek:
//   - Elk <Kind>Filter wordt één EXISTS-subquery: "er is ten minste één actief record
//     van dit GE dat aan álle opgegeven veldcondities voldoet". Condities op hub- en
//     data-kolommen van hetzelfde GE gelden dus voor hetzelfde record.
//   - Actief = hub én data niet afgevoerd; met een peiltijdstip: actief op dat moment.
//   - Afgeleide velden zijn geen filterdoel: die worden pas na het laden in Go
//     berekend (plan §7.6.1).

import (
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/schema"
)

// filterSoort bepaalt welke operatoren een veld krijgt.
type filterSoort int

const (
	soortTekst filterSoort = iota
	soortGeheel
	soortDecimaal
	soortWaarheid
	soortDatum
	soortTijdstip
)

// filterVeld beschrijft één filterbare kolom.
type filterVeld struct {
	kolom       string // SQL-kolomnaam
	opData      bool   // true: kolom staat in de _Data-tabel, anders in de hub (of enkelvoudige tabel)
	soort       filterSoort
	enumWaarden []string
}

// filterKind beschrijft een onderliggend GE of relatie van een entiteit.
type filterKind struct {
	hubMeta  model.TypeMeta
	dataMeta *model.TypeMeta // nil als het kind geen hub met _Data is (bv. _Aanvang)
	velden   map[string]filterVeld
	input    *graphql.InputObject
}

// filterDef is de filterbeschrijving van één entiteit.
type filterDef struct {
	meta     model.TypeMeta
	alias    string // bun-alias van de entiteittabel in de buitenste query
	eigen    map[string]filterVeld
	kinderen map[string]*filterKind // op JSONRolnaam
	input    *graphql.InputObject
}

// Combinatoren op entiteitniveau.
const (
	filterEn   = "and"
	filterOf   = "or"
	filterNiet = "not"
)

// Technische kolommen die geen filterdoel zijn. De entiteit-id-kolom en rel_id van
// een kind worden per type uitgesloten (zie kolommenVoorFilter).
var nietFilterbaar = map[string]struct{}{"opvoer": {}, "afvoer": {}, "versie": {}}

var (
	filterDefCache  = map[string]*filterDef{}
	filterKindCache = map[string]*filterKind{}

	// Kolomnamen komen uit bun's eigen tabelschema, zodat ze exact overeenkomen met
	// wat bun bij het opslaan gebruikt (ook voor velden zonder expliciete bun-tag).
	filterTabellen = pgdialect.New().Tables()
)

// --- Schema-opbouw ---------------------------------------------------------

// filterInputVoorEntiteit levert (en cachet) het <Entiteit>Filter input-type.
// Geeft nil als de entiteit niets filterbaars heeft.
func filterInputVoorEntiteit(meta model.TypeMeta) *graphql.InputObject {
	def := filterDefVoor(meta)
	if def == nil {
		return nil
	}
	return def.input
}

func filterDefVoor(meta model.TypeMeta) *filterDef {
	if def, ok := filterDefCache[meta.Typenaam]; ok {
		return def
	}
	tabel := bunTabelVoor(meta)
	if tabel == nil {
		return nil
	}

	def := &filterDef{
		meta:     meta,
		alias:    tabel.Alias,
		eigen:    kolommenVoorFilter(meta, false, nil),
		kinderen: map[string]*filterKind{},
	}
	for _, child := range meta.OnderliggendeGegevenselementen {
		kind := filterKindVoor(child.Doeltype)
		if kind == nil || child.JSONRolnaam == "" {
			continue
		}
		def.kinderen[child.JSONRolnaam] = kind
	}
	if len(def.eigen) == 0 && len(def.kinderen) == 0 {
		return nil
	}

	// Registreer vóór het bouwen van de velden: and/or/not verwijzen naar dit type zelf.
	filterDefCache[meta.Typenaam] = def
	def.input = graphql.NewInputObject(graphql.InputObjectConfig{
		Name:        sanitizeTypeName(meta.Typenaam) + "Filter",
		Description: fmt.Sprintf("Filter op %s. Velden binnen één object gelden samen (EN).", meta.Typenaam),
		Fields: graphql.InputObjectConfigFieldMapThunk(func() graphql.InputObjectConfigFieldMap {
			velden := graphql.InputObjectConfigFieldMap{}
			for naam, v := range def.eigen {
				velden[naam] = &graphql.InputObjectFieldConfig{Type: operatorInputVoor(v.soort)}
			}
			for naam, kind := range def.kinderen {
				velden[naam] = &graphql.InputObjectFieldConfig{
					Type:        kind.input,
					Description: fmt.Sprintf("Er is ten minste één actief %s dat aan alle opgegeven condities voldoet.", kind.hubMeta.Typenaam),
				}
			}
			// Een modelveld met dezelfde naam wint (komt in de praktijk niet voor).
			// De lijst-items zijn bewust nullable: zo past een optionele variabele in een
			// opgeslagen document, bv. and: [ {<vast deel>}, $extra ]. Een weggelaten item
			// telt niet mee (zie combineer), dus een aanroeper kan alleen versmallen.
			combinatoren := map[string]*graphql.InputObjectFieldConfig{
				filterEn:   {Type: graphql.NewList(def.input), Description: "Alle condities moeten gelden. Een null-item telt niet mee."},
				filterOf:   {Type: graphql.NewList(def.input), Description: "Ten minste één conditie moet gelden. Een null-item telt niet mee."},
				filterNiet: {Type: def.input, Description: "De conditie mag niet gelden."},
			}
			for naam, cfg := range combinatoren {
				if _, bezet := velden[naam]; !bezet {
					velden[naam] = cfg
				}
			}
			return velden
		}),
	})
	return def
}

func filterKindVoor(typenaam string) *filterKind {
	if kind, ok := filterKindCache[typenaam]; ok {
		return kind
	}
	hubMeta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok || bunTabelVoor(hubMeta) == nil {
		return nil
	}

	kind := &filterKind{hubMeta: hubMeta}
	if hubMeta.GESubtype == model.GESubtypeHub && hubMeta.DataTypenaam != "" {
		if dataMeta, ok := model.MetaRegistry.GetTypeMeta(hubMeta.DataTypenaam); ok && bunTabelVoor(dataMeta) != nil {
			kind.dataMeta = &dataMeta
		}
	}

	// Hub-kolommen winnen bij een naamconflict, net als in het outputtype (type_builder.go).
	kind.velden = kolommenVoorFilter(hubMeta, false, nil)
	if kind.dataMeta != nil {
		kind.velden = kolommenVoorFilter(*kind.dataMeta, true, kind.velden)
	}
	if len(kind.velden) == 0 {
		return nil // een leeg input-type is ongeldig in GraphQL
	}

	velden := graphql.InputObjectConfigFieldMap{}
	for naam, v := range kind.velden {
		velden[naam] = &graphql.InputObjectFieldConfig{Type: operatorInputVoor(v.soort)}
	}
	kind.input = graphql.NewInputObject(graphql.InputObjectConfig{
		Name:        sanitizeTypeName(typenaam) + "Filter",
		Description: fmt.Sprintf("Condities op één actief %s-record (hub en data samen).", typenaam),
		Fields:      velden,
	})
	filterKindCache[typenaam] = kind
	return kind
}

// kolommenVoorFilter leest de filterbare kolommen van een type uit bun's tabelschema,
// op JSON-naam (de naam die ook in het GraphQL-outputtype staat). Bestaande
// entries in `bestaand` blijven staan.
func kolommenVoorFilter(meta model.TypeMeta, opData bool, bestaand map[string]filterVeld) map[string]filterVeld {
	uit := bestaand
	if uit == nil {
		uit = map[string]filterVeld{}
	}
	tabel := bunTabelVoor(meta)
	if tabel == nil {
		return uit
	}

	uitgesloten := map[string]struct{}{}
	if meta.Metatype != model.MetatypeEntiteit {
		// Bij een kind is de entiteit-id de correlatiesleutel en rel_id de interne
		// hub-sleutel; geen van beide is een zinvol filterdoel.
		if meta.EntiteitIDKolom != "" {
			uitgesloten[meta.EntiteitIDKolom] = struct{}{}
		}
		uitgesloten["rel_id"] = struct{}{}
	}

	for _, f := range tabel.Fields {
		naam, _, skip := parseJSONTag(f.StructField.Tag.Get("json"))
		if skip || naam == "" {
			continue
		}
		if _, nee := nietFilterbaar[strings.ToLower(f.Name)]; nee {
			continue
		}
		if _, nee := uitgesloten[f.Name]; nee {
			continue
		}
		if _, al := uit[naam]; al {
			continue
		}
		soort, ok := filterSoortVoor(f.StructField.Type)
		if !ok {
			continue
		}
		uit[naam] = filterVeld{
			kolom:       f.Name,
			opData:      opData,
			soort:       soort,
			enumWaarden: resolveEnumWaarden(f.StructField),
		}
	}
	return uit
}

func filterSoortVoor(t reflect.Type) (filterSoort, bool) {
	goType, format := schemaTypeVoorReflectType(t)
	if strings.HasPrefix(format, "array") {
		return 0, false
	}
	switch goType {
	case "string":
		switch format {
		case "date":
			return soortDatum, true
		case "date-time":
			return soortTijdstip, true
		}
		return soortTekst, true
	case "integer":
		return soortGeheel, true
	case "number":
		return soortDecimaal, true
	case "boolean":
		return soortWaarheid, true
	}
	return 0, false
}

func bunTabelVoor(meta model.TypeMeta) *schema.Table {
	rep := makeMetaRepresentative(meta)
	if rep == nil {
		return nil
	}
	t := reflect.TypeOf(rep)
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t.Kind() != reflect.Struct {
		return nil
	}
	return filterTabellen.Get(t)
}

// --- Operator-inputtypen (één per scalaire soort) --------------------------

func operatorVelden(scalar graphql.Input, vergelijk bool) graphql.InputObjectConfigFieldMap {
	velden := graphql.InputObjectConfigFieldMap{
		"eq":     {Type: scalar, Description: "Gelijk aan."},
		"ne":     {Type: scalar, Description: "Niet gelijk aan (records zonder waarde tellen mee)."},
		"in":     {Type: graphql.NewList(graphql.NewNonNull(scalar)), Description: "Een van deze waarden."},
		"isNull": {Type: graphql.Boolean, Description: "true: geen waarde; false: wel een waarde."},
	}
	if vergelijk {
		velden["lt"] = &graphql.InputObjectFieldConfig{Type: scalar, Description: "Kleiner dan."}
		velden["lte"] = &graphql.InputObjectFieldConfig{Type: scalar, Description: "Kleiner dan of gelijk aan."}
		velden["gt"] = &graphql.InputObjectFieldConfig{Type: scalar, Description: "Groter dan."}
		velden["gte"] = &graphql.InputObjectFieldConfig{Type: scalar, Description: "Groter dan of gelijk aan."}
	}
	return velden
}

var (
	tekstFilterInput = graphql.NewInputObject(graphql.InputObjectConfig{
		Name:        "TekstFilter",
		Description: "Condities op een tekstveld. Enumwaarden worden als tekst vergeleken, zoals in de output.",
		Fields: func() graphql.InputObjectConfigFieldMap {
			v := operatorVelden(graphql.String, false)
			v["contains"] = &graphql.InputObjectFieldConfig{Type: graphql.String, Description: "Bevat deze tekst (hoofdletterongevoelig)."}
			return v
		}(),
	})
	geheelFilterInput = graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "GeheelGetalFilter", Description: "Condities op een geheel getal.",
		Fields: operatorVelden(graphql.Int, true),
	})
	decimaalFilterInput = graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "DecimaalFilter", Description: "Condities op een decimaal getal.",
		Fields: operatorVelden(graphql.Float, true),
	})
	waarheidFilterInput = graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "WaarheidFilter", Description: "Condities op een ja/nee-veld.",
		Fields: graphql.InputObjectConfigFieldMap{
			"eq":     {Type: graphql.Boolean},
			"isNull": {Type: graphql.Boolean},
		},
	})
	datumFilterInput = graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "DatumFilter", Description: "Condities op een datum (YYYY-MM-DD).",
		Fields: operatorVelden(DateScalar, true),
	})
	tijdstipFilterInput = graphql.NewInputObject(graphql.InputObjectConfig{
		Name: "TijdstipFilter", Description: "Condities op een tijdstip (ISO 8601).",
		Fields: operatorVelden(DateTimeScalar, true),
	})
)

func operatorInputVoor(s filterSoort) *graphql.InputObject {
	switch s {
	case soortGeheel:
		return geheelFilterInput
	case soortDecimaal:
		return decimaalFilterInput
	case soortWaarheid:
		return waarheidFilterInput
	case soortDatum:
		return datumFilterInput
	case soortTijdstip:
		return tijdstipFilterInput
	}
	return tekstFilterInput
}

// --- SQL-opbouw ------------------------------------------------------------

// pasFilterToe voegt de filterconditie toe aan een query op de entiteittabel.
// `filter` is de waarde van het GraphQL-argument (nil = geen filter).
func pasFilterToe(query *bun.SelectQuery, meta model.TypeMeta, filter interface{}, peil *time.Time) (*bun.SelectQuery, error) {
	if filter == nil {
		return query, nil
	}
	f, ok := filter.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("filter: verwacht een object")
	}
	def := filterDefVoor(meta)
	if def == nil {
		return nil, fmt.Errorf("filter: %s heeft geen filterbare velden", meta.Typenaam)
	}
	b := &filterBouwer{peil: peil}
	cond, err := b.entiteit(def, f)
	if err != nil {
		return nil, err
	}
	if cond == "" {
		return query, nil
	}
	return query.Where(cond, b.args...), nil
}

// filterBouwer bouwt een SQL-fragment met ?-plaatshouders. Identifiers gaan als
// bun.Ident mee (juist gequote), waarden als gewone argumenten: er komt geen
// invoer van de aanvrager letterlijk in de SQL.
type filterBouwer struct {
	peil   *time.Time
	args   []interface{}
	aantal int // teller voor unieke subquery-aliassen
}

func (b *filterBouwer) arg(v interface{}) string {
	b.args = append(b.args, v)
	return "?"
}

func (b *filterBouwer) kol(alias, kolom string) string {
	return b.arg(bun.Ident(alias)) + "." + b.arg(bun.Ident(kolom))
}

// actief: het record is (op het peilmoment) niet afgevoerd.
func (b *filterBouwer) actief(alias string) string {
	if b.peil == nil {
		return b.kol(alias, "afvoer") + " IS NULL"
	}
	return fmt.Sprintf("%s <= %s AND (%s IS NULL OR %s > %s)",
		b.kol(alias, "opvoer"), b.arg(*b.peil),
		b.kol(alias, "afvoer"), b.kol(alias, "afvoer"), b.arg(*b.peil))
}

// entiteit bouwt de conditie voor één <Entiteit>Filter-object. Sleutels worden
// gesorteerd verwerkt, zodat de SQL deterministisch is.
func (b *filterBouwer) entiteit(def *filterDef, f map[string]interface{}) (string, error) {
	delen := []string{}
	for _, naam := range gesorteerdeSleutels(f) {
		waarde := f[naam]
		if waarde == nil {
			continue
		}
		var (
			cond string
			err  error
		)
		switch {
		case def.eigen[naam].kolom != "":
			cond, err = b.velden(def.alias, def.eigen[naam], naam, waarde)
		case def.kinderen[naam] != nil:
			cond, err = b.kind(def, def.kinderen[naam], naam, waarde)
		case naam == filterEn || naam == filterOf:
			cond, err = b.combineer(def, naam, waarde)
		case naam == filterNiet:
			sub, ok := waarde.(map[string]interface{})
			if !ok {
				return "", fmt.Errorf("filter %s: verwacht een object", naam)
			}
			cond, err = b.entiteit(def, sub)
			if cond == "" {
				cond = "TRUE" // een leeg object is altijd waar, dus not {} is nooit waar
			}
			cond = "NOT (" + cond + ")"
		default:
			return "", fmt.Errorf("filter: onbekend veld %q op %s", naam, def.meta.Typenaam)
		}
		if err != nil {
			return "", err
		}
		if cond != "" {
			delen = append(delen, cond)
		}
	}
	return strings.Join(delen, " AND "), nil
}

func (b *filterBouwer) combineer(def *filterDef, naam string, waarde interface{}) (string, error) {
	lijst, ok := waarde.([]interface{})
	if !ok {
		return "", fmt.Errorf("filter %s: verwacht een lijst", naam)
	}
	delen := []string{}
	for _, item := range lijst {
		// Een null-item (bv. een weggelaten variabele) telt niet mee: in een and is het
		// neutraal, en in een or voegt het geen alternatief toe. Het mag nooit als
		// "altijd waar" in een or belanden, want dan zou het filter verruimen.
		if item == nil {
			continue
		}
		sub, ok := item.(map[string]interface{})
		if !ok {
			return "", fmt.Errorf("filter %s: verwacht een lijst van objecten", naam)
		}
		cond, err := b.entiteit(def, sub)
		if err != nil {
			return "", err
		}
		if cond == "" {
			cond = "TRUE" // een leeg object is altijd waar
		}
		delen = append(delen, "("+cond+")")
	}
	if len(delen) == 0 {
		if naam == filterOf {
			return "FALSE", nil // geen enkel alternatief: nooit waar (niet "geen conditie")
		}
		return "", nil
	}
	sep := " AND "
	if naam == filterOf {
		sep = " OR "
	}
	return "(" + strings.Join(delen, sep) + ")", nil
}

// kind bouwt één EXISTS-subquery voor een onderliggend GE of relatie:
//
//	EXISTS (SELECT 1 FROM <hub> AS fN
//	        JOIN <data> AS fNd ON <sleutels gelijk> AND <data actief>
//	        WHERE fN.<entiteit_id> = <buitenste>.<id> AND <hub actief> AND <veldcondities>)
//
// Alle veldcondities staan in dezelfde subquery en gelden dus voor hetzelfde record.
func (b *filterBouwer) kind(def *filterDef, kind *filterKind, naam string, waarde interface{}) (string, error) {
	ops, ok := waarde.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("filter %s: verwacht een object", naam)
	}
	b.aantal++
	h := fmt.Sprintf("f%d", b.aantal)
	d := h + "d"

	var sql strings.Builder
	sql.WriteString("EXISTS (SELECT 1 FROM ")
	sql.WriteString(b.arg(bun.Ident(kind.hubMeta.Tabelnaam)) + " AS " + b.arg(bun.Ident(h)))
	if kind.dataMeta != nil {
		ent := kind.hubMeta.EntiteitIDKolom
		sleutel := kind.hubMeta.IDKolom // rel_id: staat in hub én data
		fmt.Fprintf(&sql, " JOIN %s AS %s ON %s = %s AND %s = %s AND %s",
			b.arg(bun.Ident(kind.dataMeta.Tabelnaam)), b.arg(bun.Ident(d)),
			b.kol(d, ent), b.kol(h, ent),
			b.kol(d, sleutel), b.kol(h, sleutel),
			b.actief(d))
	}
	fmt.Fprintf(&sql, " WHERE %s = %s AND %s",
		b.kol(h, kind.hubMeta.EntiteitIDKolom), b.kol(def.alias, def.meta.IDKolom),
		b.actief(h))

	for _, veldNaam := range gesorteerdeSleutels(ops) {
		veld, ok := kind.velden[veldNaam]
		if !ok {
			return "", fmt.Errorf("filter %s: onbekend veld %q", naam, veldNaam)
		}
		alias := h
		if veld.opData {
			alias = d
		}
		cond, err := b.velden(alias, veld, naam+"."+veldNaam, ops[veldNaam])
		if err != nil {
			return "", err
		}
		if cond != "" {
			sql.WriteString(" AND " + cond)
		}
	}
	sql.WriteString(")")
	return sql.String(), nil
}

// velden bouwt de condities voor één veld, bv. { eq: "Idee", isNull: false }.
func (b *filterBouwer) velden(alias string, veld filterVeld, pad string, waarde interface{}) (string, error) {
	ops, ok := waarde.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("filter %s: verwacht een object met operatoren", pad)
	}
	kol := func() string { return b.kol(alias, veld.kolom) }
	delen := []string{}
	for _, op := range gesorteerdeSleutels(ops) {
		v := ops[op]
		if v == nil {
			continue
		}
		if err := controleerEnum(veld, pad, op, v); err != nil {
			return "", err
		}
		switch op {
		case "eq":
			delen = append(delen, kol()+" = "+b.arg(v))
		case "ne":
			// NULL-veilig: "fase is niet Idee" omvat ook records zonder fase.
			delen = append(delen, kol()+" IS DISTINCT FROM "+b.arg(v))
		case "lt", "lte", "gt", "gte":
			teken := map[string]string{"lt": "<", "lte": "<=", "gt": ">", "gte": ">="}[op]
			delen = append(delen, kol()+" "+teken+" "+b.arg(v))
		case "in":
			lijst, ok := v.([]interface{})
			if !ok {
				return "", fmt.Errorf("filter %s.in: verwacht een lijst", pad)
			}
			if len(lijst) == 0 {
				delen = append(delen, "FALSE") // "een van geen enkele waarde" klopt nooit
				continue
			}
			delen = append(delen, kol()+" IN ("+b.arg(bun.In(lijst))+")")
		case "contains":
			s, ok := v.(string)
			if !ok {
				return "", fmt.Errorf("filter %s.contains: verwacht tekst", pad)
			}
			delen = append(delen, kol()+" ILIKE "+b.arg("%"+escapeLike(s)+"%"))
		case "isNull":
			if leeg, _ := v.(bool); leeg {
				delen = append(delen, kol()+" IS NULL")
			} else {
				delen = append(delen, kol()+" IS NOT NULL")
			}
		default:
			return "", fmt.Errorf("filter %s: onbekende operator %q", pad, op)
		}
	}
	return strings.Join(delen, " AND "), nil
}

// controleerEnum geeft een duidelijke fout bij een waarde die niet in de enum staat,
// in plaats van stilletjes nul resultaten.
func controleerEnum(veld filterVeld, pad, op string, v interface{}) error {
	if len(veld.enumWaarden) == 0 || (op != "eq" && op != "ne" && op != "in") {
		return nil
	}
	waarden := []interface{}{v}
	if lijst, ok := v.([]interface{}); ok {
		waarden = lijst
	}
	for _, w := range waarden {
		s, _ := w.(string)
		if !bevat(veld.enumWaarden, s) {
			return fmt.Errorf("filter %s.%s: onbekende waarde %q; toegestaan: %s",
				pad, op, s, strings.Join(veld.enumWaarden, ", "))
		}
	}
	return nil
}

func bevat(lijst []string, s string) bool {
	for _, w := range lijst {
		if w == s {
			return true
		}
	}
	return false
}

// escapeLike maakt %, _ en \ letterlijk in een ILIKE-patroon (backslash is in
// PostgreSQL het standaard escape-teken voor LIKE).
func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func gesorteerdeSleutels(m map[string]interface{}) []string {
	sleutels := make([]string, 0, len(m))
	for k := range m {
		sleutels = append(sleutels, k)
	}
	sort.Strings(sleutels)
	return sleutels
}
