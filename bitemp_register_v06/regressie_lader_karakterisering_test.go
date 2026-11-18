//go:build integration

package main

// regressie_lader_karakterisering_test.go — vangnet voor de Lader-naad in dynql (façade fase 1,
// docs/plans/2026-11-18 Façade fase 1 — technisch ontwerp.md §3).
//
// De test seedt np-loc (zoals de regressietests), haalt het GraphQL-schema op via introspectie en
// bouwt daaruit voor elke entiteit een reeks queries: full_<x>(id) voor een paar id's, met en
// zonder peiltijdstip, de lijst en de full-lijst. De selectie loopt tot drie niveaus diep, met de
// geneste GE's, de omgekeerde (gerelateerde_*) en de forward-relaties. Het antwoord wordt
// genormaliseerd (lijsten gesorteerd) en vergeleken met testdata/lader_karakterisering.golden.json.
//
// Doel: vastleggen dat het verhuizen van de laadcode naar de dbLader niets aan het gedrag
// verandert. Golden bijwerken (alleen bewust, vóór een verhuizing): LADER_GOLDEN_BIJWERKEN=1.
//
// Draait alleen met REGRESSIE_DATABASE_URL (een eigen database; de test leegt hem).

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

const laderGoldenPad = "testdata/lader_karakterisering.golden.json"

type gqlTypeRef struct {
	Kind   string      `json:"kind"`
	Name   *string     `json:"name"`
	OfType *gqlTypeRef `json:"ofType"`
}

type gqlArg struct {
	Name string     `json:"name"`
	Type gqlTypeRef `json:"type"`
}

type gqlVeld struct {
	Name string     `json:"name"`
	Args []gqlArg   `json:"args"`
	Type gqlTypeRef `json:"type"`
}

type gqlType struct {
	Name   string    `json:"name"`
	Kind   string    `json:"kind"`
	Fields []gqlVeld `json:"fields"`
}

const introspectieQuery = `{ __schema { queryType { name } types { name kind fields { name
  args { name type { kind name ofType { kind name ofType { kind name } } } }
  type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } } } }`

// kern geeft het benoemde type onder NON_NULL/LIST.
func (r gqlTypeRef) kern() gqlTypeRef {
	for r.OfType != nil && (r.Kind == "NON_NULL" || r.Kind == "LIST") {
		r = *r.OfType
	}
	return r
}

func heeftVerplichtArg(v gqlVeld) bool {
	for _, a := range v.Args {
		if a.Type.Kind == "NON_NULL" {
			return true
		}
	}
	return false
}

// selectie bouwt een selection set tot diepte `diepte`. Objectvelden zonder scalaire inhoud op
// de laatste laag vallen weg (een lege selectie is ongeldig).
func selectie(typen map[string]gqlType, typenaam string, diepte int) string {
	t, ok := typen[typenaam]
	if !ok {
		return ""
	}
	var delen []string
	for _, v := range t.Fields {
		if heeftVerplichtArg(v) {
			continue
		}
		k := v.Type.kern()
		if k.Name == nil {
			continue
		}
		switch k.Kind {
		case "SCALAR", "ENUM":
			delen = append(delen, v.Name)
		case "OBJECT":
			if diepte <= 1 {
				continue
			}
			if sub := selectie(typen, *k.Name, diepte-1); sub != "" {
				delen = append(delen, v.Name+" "+sub)
			}
		}
	}
	sort.Strings(delen)
	if len(delen) == 0 {
		return ""
	}
	return "{ " + strings.Join(delen, " ") + " }"
}

// normaliseer sorteert alle lijsten op hun JSON-vorm, zodat de volgorde van geneste voorkomens
// (die de database niet garandeert) de vergelijking niet breekt.
func normaliseer(v any) any {
	switch x := v.(type) {
	case map[string]any:
		for k, w := range x {
			x[k] = normaliseer(w)
		}
		return x
	case []any:
		for i := range x {
			x[i] = normaliseer(x[i])
		}
		sort.SliceStable(x, func(a, b int) bool {
			ja, _ := json.Marshal(x[a])
			jb, _ := json.Marshal(x[b])
			return string(ja) < string(jb)
		})
		return x
	default:
		return v
	}
}

func TestLaderKarakterisering(t *testing.T) {
	if strings.TrimSpace(os.Getenv("REGRESSIE_DATABASE_URL")) == "" {
		t.Skip("REGRESSIE_DATABASE_URL niet gezet; karakteriseringstest overgeslagen")
	}
	o := nieuweRegressieOmgeving(t)
	o.seedViaReplay()

	gql := func(q string) map[string]any {
		b, _ := json.Marshal(map[string]string{"query": q})
		status, body, raw := o.do("POST", "/graphql/query", b)
		if status != 200 {
			t.Fatalf("status %d op %s: %s", status, kort([]byte(q)), kort(raw))
		}
		return body
	}

	intro := gql(introspectieQuery)
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
	query := typen[schema.QueryType.Name]

	resultaten := map[string]any{}
	aantal := 0
	for _, v := range query.Fields {
		if !strings.HasPrefix(v.Name, "full_") {
			continue
		}
		k := v.Type.kern()
		if k.Name == nil {
			continue
		}
		sel := selectie(typen, *k.Name, 3)
		if sel == "" {
			continue
		}
		var docs map[string]string
		if strings.HasSuffix(v.Name, "_list") {
			basis := strings.TrimSuffix(strings.TrimPrefix(v.Name, "full_"), "_list")
			docs = map[string]string{
				v.Name:              fmt.Sprintf("{ r: %s(limit: 5) %s }", v.Name, sel),
				v.Name + "@t3":      fmt.Sprintf("{ r: %s(limit: 5, t: 3) %s }", v.Name, sel),
				basis + "@lijst":    fmt.Sprintf("{ r: %s(limit: 5) %s }", basis, selectie(typen, *k.Name, 1)),
			}
		} else {
			docs = map[string]string{}
			for _, id := range []int{1, 2, 3} {
				docs[fmt.Sprintf("%s(%d)", v.Name, id)] = fmt.Sprintf("{ r: %s(id: %d) %s }", v.Name, id, sel)
			}
			docs[v.Name+"(2)@t3"] = fmt.Sprintf("{ r: %s(id: 2, t: 3) %s }", v.Name, sel)
		}
		for sleutel, doc := range docs {
			resultaten[sleutel] = normaliseer(gql(doc))
			aantal++
		}
	}
	t.Logf("%d queries uitgevoerd", aantal)

	actueel, err := json.MarshalIndent(resultaten, "", " ")
	if err != nil {
		t.Fatal(err)
	}
	if os.Getenv("LADER_GOLDEN_BIJWERKEN") == "1" {
		if err := os.MkdirAll(filepath.Dir(laderGoldenPad), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(laderGoldenPad, actueel, 0o644); err != nil {
			t.Fatal(err)
		}
		t.Logf("golden bijgewerkt: %s (%d bytes)", laderGoldenPad, len(actueel))
		return
	}
	verwacht, err := os.ReadFile(laderGoldenPad)
	if err != nil {
		t.Fatalf("golden ontbreekt (%v); maak hem met LADER_GOLDEN_BIJWERKEN=1 vóór de wijziging", err)
	}
	if string(verwacht) == string(actueel) {
		return
	}
	var oud map[string]any
	_ = json.Unmarshal(verwacht, &oud)
	// Een query die niet in de golden staat (een type dat erbij kwam, bv. lokaal gegenereerde
	// domeinen) is geen verschil in gedrag: melden, niet afkeuren. Gewijzigd of verdwenen wel.
	verschillen, nieuw := 0, 0
	for k, res := range resultaten {
		o, bestond := oud[k]
		if !bestond {
			nieuw++
			continue
		}
		jo, _ := json.Marshal(o)
		jn, _ := json.Marshal(res)
		if string(jo) != string(jn) {
			verschillen++
			if verschillen <= 5 {
				t.Errorf("%s verschilt:\n oud:   %s\n nieuw: %s", k, kort(jo), kort(jn))
			}
		}
	}
	for k := range oud {
		if _, ok := resultaten[k]; !ok {
			verschillen++
			t.Errorf("%s ontbreekt in de nieuwe uitvoer", k)
		}
	}
	if nieuw > 0 {
		t.Logf("%d nieuwe queries zonder golden (typen die erbij kwamen); niet vergeleken", nieuw)
	}
	if verschillen == 0 && nieuw == 0 {
		t.Error("golden verschilt alleen in opmaak; werk hem bij met LADER_GOLDEN_BIJWERKEN=1")
	}
	t.Logf("%d van %d bestaande queries verschillen", verschillen, len(oud))
}
