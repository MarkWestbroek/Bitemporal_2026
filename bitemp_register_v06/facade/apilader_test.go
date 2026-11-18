package facade

// apilader_test.go — de ApiLader op een nagespeeld Open Zaak (Zaken- en Catalogi-API) met de
// binding van het zaakmodel (binding/zgw-zaakmodel.json), rechtstreeks en via het GraphQL-schema.
//
// Het zaakmodel (domeinen catalogus/zaken/documenten/besluiten) staat niet in de repo (besluit
// Mark 18-11); genereer het lokaal in model/ om deze tests te draaien. Zonder die domeinen slaan
// ze over.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
)

const (
	uZaak1   = "11111111-1111-4111-8111-111111111111"
	uZaak2   = "22222222-2222-4222-8222-222222222222"
	uZT      = "33333333-3333-4333-8333-333333333333"
	uST1     = "44444444-4444-4444-8444-444444444441"
	uST2     = "44444444-4444-4444-8444-444444444442"
	uRT      = "55555555-5555-4555-8555-555555555555"
	uStatus1 = "66666666-6666-4666-8666-666666666661"
	uStatus2 = "66666666-6666-4666-8666-666666666662"
	uRol1    = "77777777-7777-4777-8777-777777777771"
	uRol2    = "77777777-7777-4777-8777-777777777772"
	uZO1     = "88888888-8888-4888-8888-888888888881"
	uZO2     = "88888888-8888-4888-8888-888888888882"
	uObject  = "99999999-9999-4999-8999-999999999999"
	uZO3     = "88888888-8888-4888-8888-888888888883"
)

// stubRegister speelt Open Zaak na: objecten op pad, lijsten gefilterd op query-parameters
// (gelijkheid op een veld), gepagineerd per 2 met next-links.
type stubRegister struct {
	srv        *httptest.Server
	mu         sync.Mutex
	objecten   map[string]map[string]any // pad (zonder host) → object
	calls      int
	zonderAuth int
}

func nieuwStubRegister(t *testing.T) *stubRegister {
	s := &stubRegister{objecten: map[string]map[string]any{}}
	s.srv = httptest.NewServer(http.HandlerFunc(s.serve))
	t.Cleanup(s.srv.Close)
	return s
}

func (s *stubRegister) zet(pad string, obj map[string]any) {
	obj["url"] = s.srv.URL + pad
	s.objecten[pad] = obj
}

func (s *stubRegister) serve(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls++
	a := r.Header.Get("Authorization")
	if !(strings.HasPrefix(a, "Bearer ") || strings.HasPrefix(a, "Token ")) {
		s.zonderAuth++
		http.Error(w, `{"detail":"geen autorisatie"}`, http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if obj, ok := s.objecten[r.URL.Path]; ok {
		_ = json.NewEncoder(w).Encode(obj)
		return
	}
	// Lijst: alle objecten direct onder dit pad, gefilterd op de query.
	var paden []string
	for p := range s.objecten {
		if strings.HasPrefix(p, r.URL.Path+"/") && !strings.Contains(strings.TrimPrefix(p, r.URL.Path+"/"), "/") {
			paden = append(paden, p)
		}
	}
	if len(paden) == 0 && !strings.HasSuffix(r.URL.Path, "en") {
		http.Error(w, `{"detail":"niet gevonden"}`, http.StatusNotFound)
		return
	}
	sort.Strings(paden)
	var res []map[string]any
	for _, p := range paden {
		obj := s.objecten[p]
		past := true
		for k, v := range r.URL.Query() {
			if k == "page" {
				continue
			}
			if fmt.Sprint(obj[k]) != v[0] {
				past = false
			}
		}
		if past {
			res = append(res, obj)
		}
	}
	pagina, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if pagina < 1 {
		pagina = 1
	}
	van, tot := (pagina-1)*2, pagina*2
	if van > len(res) {
		van = len(res)
	}
	if tot > len(res) {
		tot = len(res)
	}
	var next any
	if tot < len(res) {
		q := r.URL.Query()
		q.Set("page", strconv.Itoa(pagina+1))
		next = s.srv.URL + r.URL.Path + "?" + q.Encode()
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"count": len(res), "next": next, "previous": nil, "results": res[van:tot]})
}

func vulStub(s *stubRegister) {
	u := s.srv.URL
	s.zet("/catalogi/api/v1/zaaktypen/"+uZT, map[string]any{"identificatie": "ZT-AANVRAAG", "omschrijving": "Aanvraag", "omschrijvingGeneriek": "aanvraag", "doel": "Beslissen", "aanleiding": "Verzoek", "onderwerp": "Vergunning", "toelichting": ""})
	s.zet("/catalogi/api/v1/statustypen/"+uST1, map[string]any{"zaaktype": u + "/catalogi/api/v1/zaaktypen/" + uZT, "omschrijving": "Ontvangen", "omschrijvingGeneriek": "ontvangen", "volgnummer": 1, "statustekst": "", "toelichting": ""})
	s.zet("/catalogi/api/v1/statustypen/"+uST2, map[string]any{"zaaktype": u + "/catalogi/api/v1/zaaktypen/" + uZT, "omschrijving": "In behandeling", "omschrijvingGeneriek": "in_behandeling", "volgnummer": 2, "statustekst": "", "toelichting": ""})
	s.zet("/catalogi/api/v1/roltypen/"+uRT, map[string]any{"zaaktype": u + "/catalogi/api/v1/zaaktypen/" + uZT, "omschrijving": "Aanvrager", "omschrijvingGeneriek": "initiator"})
	for i, uz := range []string{uZaak1, uZaak2} {
		s.zet("/zaken/api/v1/zaken/"+uz, map[string]any{
			"identificatie": fmt.Sprintf("ZAAK-%d", i+1), "bronorganisatie": "002220647", "verantwoordelijkeOrganisatie": "002220647",
			"omschrijving": fmt.Sprintf("Zaak %d", i+1), "toelichting": "", "startdatum": "2026-11-01", "registratiedatum": "2026-11-01",
			"vertrouwelijkheidaanduiding": "zaakvertrouwelijk", "zaaktype": u + "/catalogi/api/v1/zaaktypen/" + uZT, "hoofdzaak": nil,
		})
	}
	zaak1 := u + "/zaken/api/v1/zaken/" + uZaak1
	s.zet("/zaken/api/v1/statussen/"+uStatus1, map[string]any{"zaak": zaak1, "statustype": u + "/catalogi/api/v1/statustypen/" + uST1, "datumStatusGezet": "2026-11-01T09:00:00Z", "statustoelichting": "binnen"})
	s.zet("/zaken/api/v1/statussen/"+uStatus2, map[string]any{"zaak": zaak1, "statustype": u + "/catalogi/api/v1/statustypen/" + uST2, "datumStatusGezet": "2026-11-02T10:00:00Z", "statustoelichting": "opgepakt"})
	s.zet("/zaken/api/v1/rollen/"+uRol1, map[string]any{"zaak": zaak1, "roltype": u + "/catalogi/api/v1/roltypen/" + uRT, "betrokkeneType": "natuurlijk_persoon", "roltoelichting": "aanvrager", "indicatieMachtiging": "", "registratiedatum": "2026-11-01T09:00:00Z",
		"betrokkeneIdentificatie": map[string]any{"inpBsn": "999993653", "geslachtsnaam": "Jansen", "voorvoegselGeslachtsnaam": "", "voornamen": "Jan", "geboortedatum": "1980-05-01"}})
	s.zet("/zaken/api/v1/rollen/"+uRol2, map[string]any{"zaak": zaak1, "roltype": u + "/catalogi/api/v1/roltypen/" + uRT, "betrokkeneType": "medewerker", "roltoelichting": "behandelaar", "indicatieMachtiging": "", "registratiedatum": "2026-11-02T09:00:00Z",
		"betrokkeneIdentificatie": map[string]any{"identificatie": "mw-01", "achternaam": "Pietersen", "voorletters": "P", "voorvoegselAchternaam": ""}})
	s.zet("/zaken/api/v1/zaakobjecten/"+uZO1, map[string]any{"zaak": zaak1, "object": u + "/objecten/api/v2/objects/" + uObject, "objectType": "overige", "relatieomschrijving": "aanvraagformulier"})
	s.zet("/zaken/api/v1/zaakobjecten/"+uZO2, map[string]any{"zaak": zaak1, "object": "", "objectType": "adres", "relatieomschrijving": "locatie"})
	// Een zaakobject naar een component buiten de binding: de URL blijft staan als IRI, object = null.
	s.zet("/zaken/api/v1/zaakobjecten/"+uZO3, map[string]any{"zaak": zaak1, "object": "https://bag.example/api/panden/0599100000000001", "objectType": "pand", "relatieomschrijving": "betreft"})
	// Het object in de Objecten-API (vorm van Objecten-API v2: object met record).
	s.zet("/objecten/api/v2/objects/"+uObject, map[string]any{"uuid": uObject, "type": u + "/objecttypen/api/v2/objecttypes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		"record": map[string]any{"index": 2, "typeVersion": 1, "startAt": "2026-11-01", "endAt": nil, "registrationAt": "2026-11-02", "correctionFor": 1, "correctedBy": nil,
			"data": map[string]any{"kenteken": "AB-123-C", "aanvrager": "Jansen"}}})
}

func zaakmodelAanwezig(t *testing.T) {
	t.Helper()
	if _, ok := model.MetaRegistry["Zaak"]; !ok {
		t.Skip("zaakmodel niet gegenereerd in model/ (staat niet in de repo); test overgeslagen")
	}
}

func nieuweTestLader(t *testing.T) (*ApiLader, *stubRegister) {
	t.Helper()
	zaakmodelAanwezig(t)
	s := nieuwStubRegister(t)
	vulStub(s)
	ruw, err := os.ReadFile("binding/zgw-zaakmodel.json")
	if err != nil {
		t.Fatal(err)
	}
	env := map[string]string{
		"OPENZAAK_URL": s.srv.URL, "OPENZAAK_CLIENT_ID": "facade-test", "OPENZAAK_SECRET": "geheim-voor-de-test",
		"OBJECTEN_URL": s.srv.URL + "/objecten", "OBJECTEN_TOKEN": "token-voor-de-test",
		"FACADE_IRI_BASIS": "https://gemeente.example",
	}
	b, err := ParseBinding(ruw, func(k string) string { return env[k] })
	if err != nil {
		t.Fatal(err)
	}
	l, err := NieuweApiLader(b, NieuweGeheugenIDMap(), nil)
	if err != nil {
		t.Fatal(err)
	}
	return l, s
}

func TestBindingZaakmodelValide(t *testing.T) {
	nieuweTestLader(t) // NieuweApiLader valideert
}

func TestBindingWeigertOnbekendeNamen(t *testing.T) {
	zaakmodelAanwezig(t)
	b, err := ParseBinding([]byte(`{"registers":{"r":{"soort":"zgw","basis":"https://r.example/","auth":"geen"}},
	  "typen":{"Zaak":{"register":"r","resource":"zaken","onderdelen":{"Zaak_Bestaatniet":{},"Zaak_ZaakOmschrijving":{"velden":{"verzonnen":"x"}},"ZaakRol":{"bron":"rollen","filterOp":"zaak"}}},
	  "Onbekend":{"register":"r","resource":"x"}}}`), func(string) string { return "" })
	if err != nil {
		t.Fatal(err)
	}
	err = b.Valideer()
	if err == nil {
		t.Fatal("verwacht fouten")
	}
	for _, moet := range []string{"Zaak_Bestaatniet is geen onderdeel", `veld "verzonnen" bestaat niet`, "ZaakRol: een relatie vraagt een doel", "Onbekend: geen entiteit"} {
		if !strings.Contains(err.Error(), moet) {
			t.Errorf("fout mist %q:\n%v", moet, err)
		}
	}
}

func TestApiLaderLijstEnEen(t *testing.T) {
	l, s := nieuweTestLader(t)
	ctx := context.Background()
	meta := model.MetaRegistry["Zaak"]
	lijst, err := l.LaadLijst(ctx, meta, dynql.LijstVraag{Limit: 10, Volledig: true})
	if err != nil {
		t.Fatal(err)
	}
	// Generiek via JSON (de json-namen van de gegenereerde structs): de test noemt geen
	// modeltypen, zodat hij ook compileert als het zaakmodel niet gegenereerd is.
	zaken := alsMaps(t, lijst)
	if len(zaken) != 2 {
		t.Fatalf("verwacht 2 zaken, kreeg %d", len(zaken))
	}
	z := zaken[0]
	if got := pad(z, "zaak_identificaties.0.data.0.zaakidentificatie"); got != "ZAAK-1" {
		t.Fatalf("identificatie: %v", got)
	}
	rollen, statussen, verw := lijstVan(z, "zaak_rollen"), lijstVan(z, "zaak_statussen"), lijstVan(z, "zaakobject_verwijzingen")
	if len(rollen) != 2 || len(statussen) != 2 || len(verw) != 2 {
		t.Fatalf("rollen %d, statussen %d, verwijzingen %d", len(rollen), len(statussen), len(verw))
	}
	if got := pad(z, "zaakobject_verwijzingen.0.data.0.objectIri"); got != "https://gemeente.example/id/object/"+uObject {
		t.Errorf("objectIri = %v", got)
	}
	// Opvolging: de eerste status eindigt waar de tweede begint.
	if len(lijstVan(statussen[0], "einde")) != 1 || len(lijstVan(statussen[1], "einde")) != 0 || len(lijstVan(statussen[1], "aanvang")) != 1 {
		t.Errorf("aanvang/einde van de statussen klopt niet: %v", statussen)
	}
	// Elk voorkomen heeft een eigen id (rol en status: uit de uuid van het subrecord).
	if statussen[0]["rel_id"] == statussen[1]["rel_id"] || rollen[0]["rel_id"] == rollen[1]["rel_id"] {
		t.Error("voorkomens delen een id")
	}

	// Eén zaak op id, opnieuw uit het register.
	ent, err := l.LaadEen(ctx, meta, int(z["id"].(float64)), time.Now())
	if err != nil || ent == nil {
		t.Fatalf("LaadEen: %v, %v", ent, err)
	}
	if got := pad(alsMaps(t, []any{ent})[0], "zaak_omschrijvingen.0.data.0.omschrijving"); got != "Zaak 1" {
		t.Errorf("LaadEen gaf een andere zaak: %v", got)
	}
	// Onbekend id: niet gevonden, geen fout.
	if ent, err := l.LaadEen(ctx, meta, 999, time.Now()); ent != nil || err != nil {
		t.Errorf("onbekend id: %v, %v", ent, err)
	}
	if s.zonderAuth > 0 {
		t.Errorf("%d verzoeken zonder autorisatie", s.zonderAuth)
	}
}

func TestApiLaderFilterEnWeigeringen(t *testing.T) {
	l, _ := nieuweTestLader(t)
	ctx := context.Background()
	meta := model.MetaRegistry["Zaak"]
	filter := map[string]any{"zaak_identificaties": map[string]any{"zaakidentificatie": map[string]any{"eq": "ZAAK-2"}}}
	lijst, err := l.LaadLijst(ctx, meta, dynql.LijstVraag{Limit: 10, Filter: filter})
	if err != nil {
		t.Fatal(err)
	}
	if n := len(alsMaps(t, lijst)); n != 1 {
		t.Fatalf("filter: verwacht 1 zaak, kreeg %d", n)
	}
	for naam, f := range map[string]any{
		"or":            map[string]any{"or": []any{}},
		"niet gebonden": map[string]any{"zaak_omschrijvingen": map[string]any{"omschrijving": map[string]any{"eq": "x"}}},
		"geen eq":       map[string]any{"zaak_identificaties": map[string]any{"zaakidentificatie": map[string]any{"like": "Z%"}}},
	} {
		_, err := l.LaadLijst(ctx, meta, dynql.LijstVraag{Limit: 10, Filter: f})
		var nie dynql.NietOndersteund
		if !asNietOndersteund(err, &nie) {
			t.Errorf("%s: verwacht NietOndersteund, kreeg %v", naam, err)
		}
	}
}

// alsMaps zet een gevulde struct-slice (of een slice van structs) om naar JSON-maps.
func alsMaps(t *testing.T, v any) []map[string]any {
	t.Helper()
	ruw, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	var uit []map[string]any
	if err := json.Unmarshal(ruw, &uit); err != nil {
		t.Fatal(err)
	}
	return uit
}

// lijstVan geeft een lijst-veld als maps.
func lijstVan(m map[string]any, veld string) []map[string]any {
	ruw, _ := m[veld].([]any)
	uit := make([]map[string]any, 0, len(ruw))
	for _, r := range ruw {
		if mm, ok := r.(map[string]any); ok {
			uit = append(uit, mm)
		}
	}
	return uit
}

// pad volgt "a.0.b" door maps en lijsten.
func pad(v any, p string) any {
	for _, deel := range strings.Split(p, ".") {
		switch x := v.(type) {
		case map[string]any:
			v = x[deel]
		case []any:
			i, err := strconv.Atoi(deel)
			if err != nil || i >= len(x) {
				return nil
			}
			v = x[i]
		default:
			return nil
		}
	}
	return v
}

func asNietOndersteund(err error, doel *dynql.NietOndersteund) bool {
	n, ok := err.(dynql.NietOndersteund)
	if ok {
		*doel = n
	}
	return ok
}

// --- via het GraphQL-schema ---

var (
	schemaEens sync.Once
	schemaGQL  *graphql.Schema
	schemaFout error
)

func gqlDo(t *testing.T, schema *graphql.Schema, q string) map[string]any {
	t.Helper()
	res := graphql.Do(graphql.Params{Schema: *schema, RequestString: q, Context: context.Background()})
	ruw, _ := json.Marshal(res)
	var m map[string]any
	_ = json.Unmarshal(ruw, &m)
	return m
}

func TestGraphQLViaApiLader(t *testing.T) {
	l, s := nieuweTestLader(t)
	// Eén schema per testbinary: dynql heeft pakketglobalen (BACKEND, 18-11).
	schemaEens.Do(func() {
		dynql.ZetLaders(l.Laders())
		dynql.ZetExtraVelden(l.ExtraVelden())
		schemaGQL, schemaFout = dynql.BuildSchema(nil)
	})
	if schemaFout != nil {
		t.Fatal(schemaFout)
	}
	_ = s

	res := gqlDo(t, schemaGQL, `{ full_zaken_list(limit: 10) {
	  id
	  zaak_identificaties { zaakidentificatie }
	  zaak_statussen { statustype_id statustoelichting statustype { id statustype_gegevens { statustypeOmschrijving } } }
	  zaak_rollen { rol_id rol { id rol_natuurlijke_personen { bsn } rol_medewerkers { achternaam } } }
	  zaak_zaaktypen { zaaktype { id zaaktype_identificaties { zaaktypeIdentificatie } } }
	  zaakobject_verwijzingen { objectIri objectType object }
	} }`)
	ruw, _ := json.Marshal(res)
	tekstRes := string(ruw)
	if res["errors"] != nil {
		t.Fatalf("GraphQL-fouten: %s", tekstRes)
	}
	for _, moet := range []string{
		`"zaakidentificatie":"ZAAK-1"`,
		`"statustoelichting":"opgepakt"`, // enkelvoudig materieel: de lopende status
		`"statustypeOmschrijving":"In behandeling"`,
		`"bsn":"999993653"`,
		`"achternaam":"Pietersen"`,
		`"zaaktypeIdentificatie":"ZT-AANVRAAG"`,
		`"objectIri":"https://gemeente.example/id/object/` + uObject + `"`,
		`"kenteken":"AB-123-C"`, // het façade-veld object: het record uit de Objecten-API
		`"index":2`,
		// Onbekend component: de URL blijft staan als IRI, en object is null.
		`"object":null,"objectIri":"https://bag.example/api/panden/0599100000000001"`,
	} {
		if !strings.Contains(tekstRes, moet) {
			t.Errorf("antwoord mist %s\n%s", moet, tekstRes)
		}
	}
	if s.zonderAuth > 0 {
		t.Errorf("%d verzoeken zonder autorisatie (ook de Objecten-API vraagt een token)", s.zonderAuth)
	}

	// Omgekeerd: de zaken van het zaaktype.
	res = gqlDo(t, schemaGQL, `{ full_zaaktypen_list(limit: 5) { id gerelateerde_zaken { id } } }`)
	ruw, _ = json.Marshal(res)
	if res["errors"] != nil || strings.Count(string(ruw), `"id"`) < 3 {
		t.Errorf("omgekeerde relatie: %s", ruw)
	}

	// Een peiltijdstip kan Open Zaak niet: fout met code, niet stil de actuele stand.
	res = gqlDo(t, schemaGQL, `{ full_zaken_list(limit: 1, t: 3) { id } }`)
	ruw, _ = json.Marshal(res)
	if !strings.Contains(string(ruw), `"code":"niet_ondersteund_door_register"`) {
		t.Errorf("peiltijdstip: verwacht niet_ondersteund_door_register, kreeg %s", ruw)
	}
}
