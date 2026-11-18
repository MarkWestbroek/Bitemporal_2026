//go:build integration

package main

// regressie_sorteren_op_waarde_test.go — bewijst dat sorteren via een join op de waarde
// (dynql/sortering.go, 18-11-2026) dezelfde volgorde geeft als de subquery-vorm.
//
// De test seedt np-loc en zoekt in de introspectie elke lijst met het argument `sorteer`. Voor
// elk veld van elk onderliggend object (GE of relatie) draait hij een reeks lijstvragen twee
// keer: met de noodrem (subquery-vorm) en zonder. De antwoorden moeten letterlijk gelijk zijn,
// inclusief de volgorde. De reeks dekt oplopend en aflopend, paginering over de grens tussen
// entiteiten met en zonder waarde, een offset voorbij alle entiteiten met een waarde, een
// filter, een peiltijdstip en de full-lijst.
//
// Draait alleen met REGRESSIE_DATABASE_URL (een eigen database; de test leegt hem).

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
)

func TestSorterenOpWaarde(t *testing.T) {
	if strings.TrimSpace(os.Getenv("REGRESSIE_DATABASE_URL")) == "" {
		t.Skip("REGRESSIE_DATABASE_URL niet gezet; test overgeslagen")
	}
	o := nieuweRegressieOmgeving(t)
	o.seedViaReplay()
	defer dynql.ZetKlassiekLaden(false)

	gql := func(q string) (map[string]any, int64) {
		b, _ := json.Marshal(map[string]string{"query": q})
		o.teller.reset()
		status, body, raw := o.do("POST", "/graphql/query", b)
		if status != 200 {
			t.Fatalf("status %d op %s: %s", status, kort([]byte(q)), kort(raw))
		}
		return body, o.teller.aantal()
	}

	intro, _ := gql(introspectieQuery)
	rauw, _ := json.Marshal(intro["data"].(map[string]any)["__schema"])
	var schema struct {
		QueryType struct{ Name string } `json:"queryType"`
		Types     []gqlType             `json:"types"`
	}
	if err := json.Unmarshal(rauw, &schema); err != nil {
		t.Fatal(err)
	}
	typen := map[string]gqlType{}
	for _, ty := range schema.Types {
		typen[ty.Name] = ty
	}

	heeftArg := func(v gqlVeld, naam string) bool {
		for _, a := range v.Args {
			if a.Name == naam {
				return true
			}
		}
		return false
	}

	docs := map[string]string{}
	lijsten := 0
	for _, v := range typen[schema.QueryType.Name].Fields {
		if strings.HasPrefix(v.Name, "full_") || !heeftArg(v, "sorteer") {
			continue
		}
		k := v.Type.kern()
		if k.Name == nil {
			continue
		}
		// Alleen lijsten met inhoud: op een lege lijst valt niets te vergelijken.
		eerste, _ := gql(fmt.Sprintf("{ r: %s(limit: 100) { id } }", v.Name))
		data, _ := eerste["data"].(map[string]any)
		rijen, _ := data["r"].([]any)
		if len(rijen) < 2 {
			continue
		}
		lijsten++
		n := len(rijen)
		for _, ge := range typen[*k.Name].Fields {
			gk := ge.Type.kern()
			if gk.Kind != "OBJECT" || gk.Name == nil || heeftVerplichtArg(ge) {
				continue
			}
			for _, veld := range typen[*gk.Name].Fields {
				vk := veld.Type.kern()
				if vk.Kind != "SCALAR" && vk.Kind != "ENUM" {
					continue
				}
				pad := ge.Name + "." + veld.Name
				sleutel := v.Name + "/" + pad
				op := fmt.Sprintf(`sorteer: [{ veld: %q }]`, pad)
				af := fmt.Sprintf(`sorteer: [{ veld: %q, aflopend: true }]`, pad)
				docs[sleutel+"/op"] = fmt.Sprintf("{ r: %s(%s, limit: 100) { id } }", v.Name, op)
				// Technische velden (opvoer, rel_id, de entiteit-id) zijn geen sorteersleutel.
				if proef, _ := gql(docs[sleutel+"/op"]); proef["errors"] != nil {
					if tekst, _ := json.Marshal(proef["errors"]); strings.Contains(string(tekst), "sorteer: onbekend veld") {
						delete(docs, sleutel+"/op")
						continue
					}
				}
				docs[sleutel+"/af"] = fmt.Sprintf("{ r: %s(%s, limit: 100) { id } }", v.Name, af)
				// Kleine pagina's die samen de hele lijst afgaan: zo ligt er altijd een pagina
				// over de grens tussen de entiteiten met en zonder waarde.
				for offset := 0; offset < n && offset < 12; offset += 2 {
					docs[fmt.Sprintf("%s/af/pagina-%d", sleutel, offset)] = fmt.Sprintf(
						"{ r: %s(%s, limit: 3, offset: %d) { id } }", v.Name, af, offset)
				}
				docs[sleutel+"/op/voorbij"] = fmt.Sprintf("{ r: %s(%s, limit: 3, offset: %d) { id } }", v.Name, op, n-1)
				docs[sleutel+"/op/ver-voorbij"] = fmt.Sprintf("{ r: %s(%s, limit: 3, offset: 5000) { id } }", v.Name, op)
				docs[sleutel+"/op/filter"] = fmt.Sprintf(
					"{ r: %s(%s, filter: { id: { gte: 2 } }, limit: 4, offset: 1) { id } }", v.Name, op)
				// Met een filter gaat deel 1 via "filter eerst" (de CTE), in beide richtingen.
				docs[sleutel+"/af/filter"] = fmt.Sprintf(
					"{ r: %s(%s, filter: { id: { gte: 2 } }, limit: 4, offset: 1) { id } }", v.Name, af)
				docs[sleutel+"/af/peil"] = fmt.Sprintf(
					`{ r: %s(%s, peiltijdstip: "2000-01-01T00:00:00Z", limit: 5) { id } }`, v.Name, af)
				docs[sleutel+"/af/full"] = fmt.Sprintf("{ r: full_%s_list(%s, limit: 5, offset: 1) { id } }", v.Name, af)
			}
		}
	}

	verschillen, metFout, andereWeg, hersteld := 0, 0, 0, 0
	soorten := map[string]int{}
	for sleutel, doc := range docs {
		dynql.ZetKlassiekLaden(true)
		oud, nOud := gql(doc)
		dynql.ZetKlassiekLaden(false)
		nieuw, nNieuw := gql(doc)
		if fouten, ok := oud["errors"]; ok && fouten != nil {
			tekst, _ := json.Marshal(fouten)
			// De subquery-vorm kan niet op een ja/nee-veld sorteren (MIN/MAX bestaat daar
			// niet voor); de join-vorm wel. Dat verschil is bedoeld.
			if strings.Contains(string(tekst), "(boolean) does not exist") {
				if f, ok := nieuw["errors"]; !ok || f == nil {
					hersteld++
					continue
				}
			}
			metFout++
			if i := strings.Index(string(tekst), `"message":"`); i >= 0 {
				m := string(tekst)[i+11:]
				if len(m) > 60 {
					m = m[:60]
				}
				soorten[m]++
			}
		}
		if nOud != nNieuw {
			andereWeg++ // de join-vorm doet de id's en het laden in aparte vragen
		}
		jo, _ := json.Marshal(oud)
		jn, _ := json.Marshal(nieuw)
		if string(jo) != string(jn) {
			verschillen++
			if verschillen <= 5 {
				t.Errorf("%s verschilt:\n query:    %s\n subquery: %s\n join:     %s", sleutel, kort([]byte(doc)), kort(jo), kort(jn))
			}
		}
	}
	t.Logf("%d lijsten met inhoud, %d queries (%d met een fout in beide wegen, %d via de join-vorm, %d ja/nee-velden die alleen de join-vorm kan); %d verschillen",
		lijsten, len(docs), metFout, andereWeg, hersteld, verschillen)
	for m, n := range soorten {
		t.Logf("  fout %dx: %s", n, m)
	}
	if andereWeg == 0 {
		t.Errorf("geen enkele query ging via de join-vorm: de test dekt niets")
	}
	if metFout*2 > len(docs) {
		t.Errorf("te veel queries met een fout (%d van %d): de test dekt te weinig", metFout, len(docs))
	}
}
