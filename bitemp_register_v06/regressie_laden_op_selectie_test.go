//go:build integration

package main

// regressie_laden_op_selectie_test.go — bewijst dat het laden op selectie en het bundelen van
// omgekeerde relaties (dynql/selectie.go, 18-11-2026) hetzelfde antwoord geven als het
// klassieke laden, met minder SQL-vragen.
//
// De test seedt np-loc en bouwt uit de introspectie voor elke full-query een reeks deelselecties:
// per veld van het type één query met alleen `id` en dat veld (drie niveaus diep), plus een
// query met een fragment en een met twee aliassen van dezelfde omgekeerde relatie. Elke query
// draait twee keer, klassiek en nieuw; de genormaliseerde antwoorden moeten gelijk zijn. De
// volledige selectie is al gedekt door TestLaderKarakterisering.
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

func TestLadenOpSelectie(t *testing.T) {
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

	// Per veld van het type: de selectie van alleen dat veld (met zijn onderliggende velden).
	deelselecties := func(typenaam string) map[string]string {
		uit := map[string]string{}
		for _, v := range typen[typenaam].Fields {
			if heeftVerplichtArg(v) || v.Name == "id" {
				continue
			}
			k := v.Type.kern()
			if k.Name == nil {
				continue
			}
			switch k.Kind {
			case "SCALAR", "ENUM":
				uit[v.Name] = v.Name
			case "OBJECT":
				if sub := selectie(typen, *k.Name, 2); sub != "" {
					uit[v.Name] = v.Name + " " + sub
				}
			}
		}
		return uit
	}

	docs := map[string]string{}
	for _, v := range typen[schema.QueryType.Name].Fields {
		if !strings.HasPrefix(v.Name, "full_") {
			continue
		}
		k := v.Type.kern()
		if k.Name == nil {
			continue
		}
		args := "(limit: 5)"
		if !strings.HasSuffix(v.Name, "_list") {
			// Eén entiteit: neem een id dat bestaat (de meeste typen zijn in np-loc leeg).
			lijst, _ := gql(fmt.Sprintf("{ r: %s_list(limit: 1) { id } }", v.Name))
			data, _ := lijst["data"].(map[string]any)
			rijen, _ := data["r"].([]any)
			if len(rijen) == 0 {
				continue
			}
			args = fmt.Sprintf("(id: %v)", rijen[0].(map[string]any)["id"])
		}
		delen := deelselecties(*k.Name)
		var eerste, omgekeerd string
		for naam, sel := range delen {
			docs[v.Name+"/"+naam] = fmt.Sprintf("{ r: %s%s { id %s } }", v.Name, args, sel)
			if strings.HasPrefix(naam, "gerelateerde_") {
				omgekeerd = sel
			} else if eerste == "" || naam < strings.Fields(eerste)[0] {
				eerste = sel
			}
		}
		docs[v.Name+"/alleen-id"] = fmt.Sprintf("{ r: %s%s { id } }", v.Name, args)
		if eerste != "" {
			docs[v.Name+"/fragment"] = fmt.Sprintf(
				"query { r: %s%s { id ...F ... on %s { __typename } } } fragment F on %s { %s }",
				v.Name, args, *k.Name, *k.Name, eerste)
		}
		if omgekeerd != "" {
			veld := strings.Fields(omgekeerd)[0]
			docs[v.Name+"/aliassen"] = fmt.Sprintf(
				"{ r: %s%s { id a: %s(limit: 1) { id } b: %s } }", v.Name, args, veld, omgekeerd)
		}
	}

	var klassiekTotaal, nieuwTotaal int64
	metFout := 0
	verschillen := 0
	for sleutel, doc := range docs {
		dynql.ZetKlassiekLaden(true)
		oud, nOud := gql(doc)
		dynql.ZetKlassiekLaden(false)
		nieuw, nNieuw := gql(doc)
		// Een fout hoort in beide wegen dezelfde te zijn (bv. een id dat niet bestaat); hij
		// zit in de vergelijking hieronder. Wel tellen, zodat de test niet stil op fouten draait.
		if fouten, ok := oud["errors"]; ok && fouten != nil {
			metFout++
		}
		jo, _ := json.Marshal(normaliseer(oud))
		jn, _ := json.Marshal(normaliseer(nieuw))
		if string(jo) != string(jn) {
			verschillen++
			if verschillen <= 5 {
				t.Errorf("%s verschilt:\n query:    %s\n klassiek: %s\n nieuw:    %s", sleutel, kort([]byte(doc)), kort(jo), kort(jn))
			}
		}
		if nNieuw > nOud {
			t.Errorf("%s: meer SQL-vragen dan klassiek (%d > %d)", sleutel, nNieuw, nOud)
		}
		klassiekTotaal += nOud
		nieuwTotaal += nNieuw
	}
	t.Logf("%d queries (%d met een fout in beide wegen); %d verschillen; SQL-vragen klassiek %d, nieuw %d",
		len(docs), metFout, verschillen, klassiekTotaal, nieuwTotaal)
	if metFout*4 > len(docs) {
		t.Errorf("te veel queries met een fout (%d van %d): de test dekt te weinig", metFout, len(docs))
	}
	if nieuwTotaal >= klassiekTotaal {
		t.Errorf("verwacht minder SQL-vragen dan klassiek, kreeg %d tegen %d", nieuwTotaal, klassiekTotaal)
	}
}
