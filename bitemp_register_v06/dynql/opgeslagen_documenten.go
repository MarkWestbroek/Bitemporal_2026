package dynql

// opgeslagen_documenten.go — uitvoeren op naam (persisted queries / trusted documents).
//
// Plan: docs/plans/2026-09-22 Aanmeldformulier CG PF als formulierdefinitie (analyse).md §7.4.
// Gebruik: docs/dynamische-graphql-laag.md, paragraaf "Uitvoeren op naam".
//
// Een QueryDefinitie is registerdata, geen model. Er wordt bij het opstarten dus niets
// "opgebouwd": het schema komt uit de MetaRegistry, de documenten komen per aanroep uit de
// database. Zo hoeft er bij een nieuwe of gewijzigde definitie niets herstart te worden en
// werkt een vooruit geregistreerde ("gestagede") status vanzelf op zijn aanvangsdatum.
//
// Bij het opstarten gebeuren wel twee controles:
//   - het contract: bestaat het gereserveerde type QueryDefinitie met de verwachte GE's en
//     velden (initOpgeslagenContract)? Zo nee, dan staat uitvoeren op naam uit;
//   - de documenten: alle actuele documenten worden tegen het schema gevalideerd
//     (ValideerOpgeslagenDocumenten), zodat een modelwijziging onder een document vandaan
//     in het log staat.
//
// QueryDefinitie is een gereserveerd woord, zoals Referentielijst dat feitelijk ook is
// (routes/addroutes_helper.go): dit bestand kent de typenamen. Alles eromheen — laden,
// formele tijd, hub+data platslaan — loopt via dezelfde generieke code als de gewone
// GraphQL-resolvers.

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/parser"
	"github.com/uptrace/bun"
)

// Gereserveerde typenamen (zie docs/CODEGEN.md §7.5 punt 7 voor de naamgeving).
const (
	opgeslagenEntiteit         = "QueryDefinitie"
	opgeslagenGENaam           = "QueryDefinitie_QuerydefinitieNaam"
	opgeslagenGEBeschrijving   = "QueryDefinitie_QuerydefinitieBeschrijving"
	opgeslagenGEStatus         = "QueryDefinitie_QuerydefinitieStatus"
	opgeslagenGEToegankelijk   = "QueryDefinitie_QuerydefinitieToegankelijkheid"
	opgeslagenGEDocument       = "QueryDefinitie_QuerydefinitieDocument"
	opgeslagenStatusActief     = "actief"
	opgeslagenStatusInactief   = "inactief"
	opgeslagenToegangPubliek   = "publiek"
	opgeslagenMaxDocumentNamen = 2 // meer dan één treffer op een naam is een fout, geen keuze
)

// opgeslagenGE beschrijft één verwacht GE van het contract.
type opgeslagenGE struct {
	typenaam  string
	velden    []string // verwachte kolommen in de _Data (json-namen)
	materieel bool     // verwacht IsMaterieel op de hub (stagen)
}

var opgeslagenGEs = []opgeslagenGE{
	{opgeslagenGENaam, []string{"naam"}, false},
	{opgeslagenGEBeschrijving, []string{"beschrijving"}, false},
	{opgeslagenGEStatus, []string{"status", "reden"}, true},
	{opgeslagenGEToegankelijk, []string{"toegankelijkheid"}, true},
	{opgeslagenGEDocument, []string{"graphql_document", "definitie_versie", "toelichting"}, true},
}

// opgeslagenContract is het bij het opstarten opgeloste contract: de entiteit en per GE de
// rolnaam waaronder hij in de geladen (platgeslagen) entiteit staat, plus zijn hub-meta.
type opgeslagenContract struct {
	ent  model.TypeMeta
	rol  map[string]string         // GE-typenaam → JSONRolnaam
	hub  map[string]model.TypeMeta // GE-typenaam → hub-meta
	fout string                    // leeg als het contract klopt
}

var opgeslagen *opgeslagenContract

// initOpgeslagenContract lost het contract op tegen de MetaRegistry. Wordt door BuildSchema
// aangeroepen; puur, geen database.
func initOpgeslagenContract() {
	c := &opgeslagenContract{rol: map[string]string{}, hub: map[string]model.TypeMeta{}}
	opgeslagen = c

	ent, ok := model.MetaRegistry.GetTypeMeta(opgeslagenEntiteit)
	if !ok || ent.Metatype != model.MetatypeEntiteit || ent.SliceFactory == nil {
		c.fout = fmt.Sprintf("entiteit %s ontbreekt in het model", opgeslagenEntiteit)
		return
	}
	c.ent = ent

	var fouten []string
	for _, ge := range opgeslagenGEs {
		var child *model.OnderliggendGegevenselement
		for i := range ent.OnderliggendeGegevenselementen {
			if ent.OnderliggendeGegevenselementen[i].Doeltype == ge.typenaam {
				child = &ent.OnderliggendeGegevenselementen[i]
				break
			}
		}
		if child == nil {
			fouten = append(fouten, ge.typenaam+" ontbreekt")
			continue
		}
		if child.Momentvoorkomen != model.Enkelvoudig {
			fouten = append(fouten, ge.typenaam+" is niet enkelvoudig")
		}
		hub, ok := model.MetaRegistry.GetTypeMeta(ge.typenaam)
		if !ok || hub.GESubtype != model.GESubtypeHub || hub.DataTypenaam == "" {
			fouten = append(fouten, ge.typenaam+" is geen hub met _Data")
			continue
		}
		if ge.materieel && !hub.IsMaterieel {
			fouten = append(fouten, ge.typenaam+" is niet materieel (stagen werkt dan niet)")
		}
		data, ok := model.MetaRegistry.GetTypeMeta(hub.DataTypenaam)
		if !ok || data.Factory == nil {
			fouten = append(fouten, hub.DataTypenaam+" ontbreekt")
			continue
		}
		velden := fieldsVoorMeta(data)
		for _, v := range ge.velden {
			if _, ok := velden[v]; !ok {
				fouten = append(fouten, fmt.Sprintf("%s mist veld %q", hub.DataTypenaam, v))
			}
		}
		c.rol[ge.typenaam] = child.JSONRolnaam
		c.hub[ge.typenaam] = hub
	}
	if len(fouten) > 0 {
		c.fout = strings.Join(fouten, "; ")
	}
}

// OpgeslagenDocumentenBeschikbaar meldt of uitvoeren op naam aanstaat, en zo nee waarom niet.
func OpgeslagenDocumentenBeschikbaar() (bool, string) {
	if opgeslagen == nil {
		return false, "contract niet geïnitialiseerd (BuildSchema niet aangeroepen)"
	}
	return opgeslagen.fout == "", opgeslagen.fout
}

// OpgeslagenDocument is wat er op een naam is gevonden, beoordeeld op het moment van de aanroep.
// Lege strings betekenen: geen (materieel én formeel) geldig record voor dat GE.
type OpgeslagenDocument struct {
	ID               int
	Naam             string
	Beschrijving     string
	Status           string
	Reden            string
	Toegankelijkheid string // leeg = intern
	Document         string
	Versie           string
	Toelichting      string
}

// IsPubliek: alleen een expliciet publiek document mag anoniem worden uitgevoerd.
func (d *OpgeslagenDocument) IsPubliek() bool { return d.Toegankelijkheid == opgeslagenToegangPubliek }

// ZoekOpgeslagenDocument zoekt de definitie met deze naam, formeel actueel op `nu`, en
// leest per GE het record dat op `nu` ook materieel geldig is. Geen treffer: (nil, nil).
func ZoekOpgeslagenDocument(ctx context.Context, naam string, nu time.Time) (*OpgeslagenDocument, error) {
	if db == nil {
		return nil, fmt.Errorf("database niet geïnitialiseerd")
	}
	if ok, reden := OpgeslagenDocumentenBeschikbaar(); !ok {
		return nil, fmt.Errorf("uitvoeren op naam staat uit: %s", reden)
	}
	c := opgeslagen
	filter := map[string]interface{}{
		c.rol[opgeslagenGENaam]: map[string]interface{}{"naam": map[string]interface{}{"eq": naam}},
	}
	maps, err := laadOpgeslagen(ctx, filter, nu, opgeslagenMaxDocumentNamen)
	if err != nil {
		return nil, err
	}
	if len(maps) == 0 {
		return nil, nil
	}
	if len(maps) > 1 {
		return nil, fmt.Errorf("naam %q komt bij meer dan één QueryDefinitie voor", naam)
	}
	return c.lees(maps[0], nu), nil
}

// AlleOpgeslagenDocumenten levert alle formeel actuele definities, beoordeeld op `nu`
// (voor de validatie bij het opstarten).
func AlleOpgeslagenDocumenten(ctx context.Context, nu time.Time) ([]*OpgeslagenDocument, error) {
	if db == nil {
		return nil, fmt.Errorf("database niet geïnitialiseerd")
	}
	if ok, reden := OpgeslagenDocumentenBeschikbaar(); !ok {
		return nil, fmt.Errorf("uitvoeren op naam staat uit: %s", reden)
	}
	maps, err := laadOpgeslagen(ctx, nil, nu, 0)
	if err != nil {
		return nil, err
	}
	uit := make([]*OpgeslagenDocument, 0, len(maps))
	for _, m := range maps {
		uit = append(uit, opgeslagen.lees(m, nu))
	}
	sort.Slice(uit, func(i, j int) bool { return uit[i].ID < uit[j].ID })
	return uit, nil
}

// laadOpgeslagen laadt QueryDefinitie-entiteiten met alle GE's op formeel peilmoment `nu`,
// langs dezelfde weg als full_<padnaam>_list, en slaat hub+data plat.
func laadOpgeslagen(ctx context.Context, filter map[string]interface{}, nu time.Time, limiet int) ([]map[string]interface{}, error) {
	ent := opgeslagen.ent
	entities := ent.SliceFactory()
	query := applyFormeleTijdFilter(db.NewSelect().Model(entities), ent.Typenaam, nu)
	if filter != nil {
		var err error
		if query, err = pasFilterToe(query, ent, filter, &nu); err != nil {
			return nil, err
		}
	}
	query = addOnderliggendeRelations(query, ent, &nu)
	if ent.IDKolom != "" {
		query = query.OrderExpr("?TableAlias.? ASC", bun.Ident(ent.IDKolom))
	}
	if limiet > 0 {
		query = query.Limit(limiet)
	}
	if err := query.Scan(ctx); err != nil {
		return nil, fmt.Errorf("QueryDefinitie laden: %v", err)
	}
	if err := laadHubKinderenNaQuery(ctx, entities, ent, &nu); err != nil {
		return nil, fmt.Errorf("QueryDefinitie hub-kinderen laden: %v", err)
	}
	// Bewust niet platgeslagen op entiteitniveau: bij een enkelvoudig GE zou
	// flattenEntityMap de eerste hub nemen, terwijl wij per GE de hub willen die op `nu`
	// materieel geldig is (zie kiesGeldigeHub).
	return sliceToMaps(entities, ent)
}

// lees haalt uit een geladen entiteit (formeel actueel op `nu`) per GE het record dat op
// `nu` ook materieel geldig is.
func (c *opgeslagenContract) lees(m map[string]interface{}, nu time.Time) *OpgeslagenDocument {
	d := &OpgeslagenDocument{}
	if id, ok := m[c.ent.IDKolom].(float64); ok {
		d.ID = int(id)
	}
	// De entiteit zelf: levensduur van de definitie als geheel. Aanvang/einde van de
	// entiteit staan als lijsten in de map; flattenEntityMap maakt er één record van.
	kop := flattenEntityMap(kopieer(m), c.ent)
	if !materieelGeldigOp(kop, c.ent, nu) {
		return d // bestaat formeel, maar leeft (nog/niet meer) niet: alle GE's blijven leeg
	}
	rec := func(ge string) map[string]interface{} {
		items, _ := m[c.rol[ge]].([]interface{})
		return kiesGeldigeHub(items, c.hub[ge], nu)
	}
	tekst := func(r map[string]interface{}, veld string) string {
		if r == nil {
			return ""
		}
		s, _ := r[veld].(string)
		return s
	}
	naam := rec(opgeslagenGENaam)
	d.Naam = tekst(naam, "naam")
	d.Beschrijving = tekst(rec(opgeslagenGEBeschrijving), "beschrijving")
	status := rec(opgeslagenGEStatus)
	d.Status = tekst(status, "status")
	d.Reden = tekst(status, "reden")
	d.Toegankelijkheid = tekst(rec(opgeslagenGEToegankelijk), "toegankelijkheid")
	doc := rec(opgeslagenGEDocument)
	d.Document = tekst(doc, "graphql_document")
	d.Versie = tekst(doc, "definitie_versie")
	d.Toelichting = tekst(doc, "toelichting")
	return d
}

// kiesGeldigeHub kiest uit de formeel actieve hubs van één GE de hub die op `nu` materieel
// geldig is, platgeslagen (hub + data + aanvang/einde). Zijn er meer (hoort niet, maar de
// database dwingt het niet af), dan wint de laatste aanvang. Geen geldige: nil.
//
// Bedoelde semantiek van "enkelvoudig" op een materieel GE (Mark, 24-09-2026): op de
// materiële lijn één geldig record tegelijk, terwijl er formeel meerdere actieve records
// naast elkaar bestaan — zoals de woongeschiedenis van een persoon actueel is, maar hij op
// één adres tegelijk woont. De exclusieconstraint in dbsetup laat nu nog maar één formeel
// actieve hub toe; tot die is aangepast (backlog) is een vooruit geregistreerde status tot
// zijn aanvangsdatum voor niemand geldig. Deze functie werkt in beide werelden goed.
func kiesGeldigeHub(items []interface{}, hubMeta model.TypeMeta, nu time.Time) map[string]interface{} {
	var beste map[string]interface{}
	var besteAanvang *time.Time
	for _, item := range items {
		raw, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		rec := flattenEntityMap(flattenHubData(kopieer(raw)), hubMeta)
		if !materieelGeldigOp(rec, hubMeta, nu) {
			continue
		}
		aanvang := aanvangVan(rec, hubMeta)
		if beste == nil || (aanvang != nil && (besteAanvang == nil || aanvang.After(*besteAanvang))) {
			beste, besteAanvang = rec, aanvang
		}
	}
	return beste
}

// aanvangVan geeft de aanvangsdatum van een platgeslagen record (nil als er geen is).
func aanvangVan(rec map[string]interface{}, meta model.TypeMeta) *time.Time {
	for _, child := range meta.OnderliggendeGegevenselementen {
		if cm, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype); ok && cm.GESubtype == model.GESubtypeAanvang {
			return datumUit(rec[child.JSONRolnaam])
		}
	}
	return nil
}

// kopieer maakt een ondiepe kopie, zodat flattenHubData/flattenEntityMap de geladen map
// niet in place veranderen.
func kopieer(m map[string]interface{}) map[string]interface{} {
	uit := make(map[string]interface{}, len(m))
	for k, v := range m {
		uit[k] = v
	}
	return uit
}

// materieelGeldigOp beoordeelt een (platgeslagen) record op zijn aanvang/einde-kinderen:
// geldig als er geen aanvang is of de aanvang op of vóór de dag van `nu` ligt, en er geen
// einde is of het einde ná die dag ligt. Een niet-materieel type is altijd geldig.
func materieelGeldigOp(rec map[string]interface{}, meta model.TypeMeta, nu time.Time) bool {
	if !meta.IsMaterieel {
		return true
	}
	dag := time.Date(nu.Year(), nu.Month(), nu.Day(), 0, 0, 0, 0, time.UTC)
	for _, child := range meta.OnderliggendeGegevenselementen {
		cm, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype)
		if !ok {
			continue
		}
		var datum *time.Time
		switch cm.GESubtype {
		case model.GESubtypeAanvang, model.GESubtypeEinde:
			datum = datumUit(rec[child.JSONRolnaam])
		default:
			continue
		}
		if datum == nil {
			continue // geen (geldige) aanvang of einde: open aan die kant
		}
		if cm.GESubtype == model.GESubtypeAanvang && datum.After(dag) {
			return false
		}
		if cm.GESubtype == model.GESubtypeEinde && !datum.After(dag) {
			return false
		}
	}
	return true
}

// datumUit leest "datum" (YYYY-MM-DD) uit een aanvang-/einde-record; nil als er geen is.
func datumUit(raw interface{}) *time.Time {
	r, _ := raw.(map[string]interface{})
	if r == nil {
		return nil
	}
	s, _ := r["datum"].(string)
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

// ValideerOpgeslagenDocumenten valideert alle actuele documenten tegen het schema en geeft
// per document één regel terug (voor het log bij het opstarten). Geen fout als er geen
// definities zijn.
func ValideerOpgeslagenDocumenten(ctx context.Context, schema *graphql.Schema, nu time.Time) ([]string, error) {
	docs, err := AlleOpgeslagenDocumenten(ctx, nu)
	if err != nil {
		return nil, err
	}
	regels := make([]string, 0, len(docs))
	for _, d := range docs {
		kop := fmt.Sprintf("QueryDefinitie %d %q v%s [%s, %s]", d.ID, d.Naam, d.Versie, of(d.Status, "geen geldige status"), of(d.Toegankelijkheid, "intern"))
		if d.Document == "" {
			regels = append(regels, kop+": geen geldig document")
			continue
		}
		if fouten := valideerDocument(schema, d.Document); len(fouten) > 0 {
			regels = append(regels, kop+": ONGELDIG — "+strings.Join(fouten, "; "))
			continue
		}
		regels = append(regels, kop+": geldig")
	}
	return regels, nil
}

// valideerDocument parseert en valideert een document tegen het schema; ook een mutatie
// telt als fout (opgeslagen documenten zijn alleen-lezen).
func valideerDocument(schema *graphql.Schema, document string) []string {
	doc, err := parser.Parse(parser.ParseParams{Source: document})
	if err != nil {
		return []string{"parse: " + err.Error()}
	}
	if BevatMutatie(document) {
		return []string{"document bevat een mutatie"}
	}
	vr := graphql.ValidateDocument(schema, doc, graphql.SpecifiedRules)
	if vr.IsValid {
		return nil
	}
	uit := make([]string, 0, len(vr.Errors))
	for _, e := range vr.Errors {
		uit = append(uit, e.Message)
	}
	return uit
}

func of(s, anders string) string {
	if s == "" {
		return anders
	}
	return s
}
