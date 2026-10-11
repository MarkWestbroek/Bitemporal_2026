package celexpr

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// pariteitsBestand is gedeeld met web/vite/src/shared/celEvaluator.test.js.
var pariteitsBestand = filepath.Join("..", "testdata", "cel-pariteit.json")

type pariteitsGeval struct {
	Naam      string `json:"naam"`
	Kenmerk   string `json:"kenmerk"`
	Expressie string `json:"expressie"`
	Context   any    `json:"context"`
	Verwacht  any    `json:"verwacht"`
	ParseFout bool   `json:"parseFout"`
}

func TestPariteitMetFrontend(t *testing.T) {
	data, err := os.ReadFile(pariteitsBestand)
	if err != nil {
		t.Fatal(err)
	}
	var bestand struct {
		Gevallen []pariteitsGeval `json:"gevallen"`
	}
	if err := json.Unmarshal(data, &bestand); err != nil {
		t.Fatal(err)
	}
	if len(bestand.Gevallen) < 40 {
		t.Fatalf("verwacht het volledige pariteitsbestand, kreeg %d gevallen", len(bestand.Gevallen))
	}
	for _, g := range bestand.Gevallen {
		t.Run(g.Naam, func(t *testing.T) {
			got, err := Evalueer(g.Expressie, g.Context)
			if g.ParseFout {
				if err == nil {
					t.Fatalf("verwacht een parsefout voor %q, kreeg %#v", g.Expressie, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("parsefout voor %q: %v", g.Expressie, err)
			}
			if !reflect.DeepEqual(got, g.Verwacht) {
				t.Fatalf("%q\n kreeg:    %#v\n verwacht: %#v", g.Expressie, got, g.Verwacht)
			}
		})
	}
}

// De NP-weergavenaam uit metamodel_v3.json (BRP-naamgebruik met geneste ?:) — dezelfde
// controle als in celEvaluator.test.js. De oude Go-evaluator splitste op '+' en kon dit niet.
func TestNPWeergavenaamUitMetamodel(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("..", "metamodel_v3.json"))
	if err != nil {
		t.Skip("metamodel_v3.json niet gevonden")
	}
	var mm struct {
		Entiteiten []struct {
			Typenaam        string `json:"typenaam"`
			AfgeleideVelden []struct {
				Naam            string `json:"naam"`
				Afleidingsregel string `json:"afleidingsregel"`
			} `json:"afgeleideVelden"`
		} `json:"entiteiten"`
	}
	if err := json.Unmarshal(data, &mm); err != nil {
		t.Fatal(err)
	}
	var regel string
	for _, e := range mm.Entiteiten {
		for _, av := range e.AfgeleideVelden {
			if e.Typenaam == "NatuurlijkPersoon" && av.Naam == "weergavenaam" {
				regel = av.Afleidingsregel
			}
		}
	}
	if regel == "" {
		t.Skip("NatuurlijkPersoon.weergavenaam niet gevonden")
	}
	expr := MustParse(regel)
	ctx := func(naamgebruik string, partner any) map[string]any {
		return map[string]any{
			"Naam":        map[string]any{"voorletters": "J.A.", "roepnaam": "Jan", "tussenvoegsel": "van den", "achternaam": "Berg"},
			"Partnernaam": map[string]any{"achternaam": partner},
			"Naamgebruik": map[string]any{"naamgebruik": naamgebruik},
		}
	}
	for _, c := range []struct {
		gebruik string
		partner any
		want    string
	}{
		{"EigenNaam", "Jansen", "Jan van den Berg"},
		{"PartnerNaam", "Jansen", "Jan Jansen"},
		{"EigenNaam-PartnerNaam", "Jansen", "Jan van den Berg-Jansen"},
		{"PartnerNaam-EigenNaam", "Jansen", "Jan Jansen-van den Berg"},
		{"PartnerNaam", nil, "Jan van den Berg"},
	} {
		if got := expr.Eval(ctx(c.gebruik, c.partner)); got != c.want {
			t.Errorf("%s: kreeg %#v, verwacht %q", c.gebruik, got, c.want)
		}
	}
}

type testObject map[string]any

func (o testObject) Veld(naam string) (any, bool) { return LeesVeld(map[string]any(o), naam) }

// Een Object levert zijn velden zelf; collect werkt ook over Objects.
func TestObjectEnCollect(t *testing.T) {
	ctx := map[string]any{"l": []any{testObject{"x": 1.0}, testObject{"x": []any{2.0, 3.0}}}}
	if got := MustParse("l.x").Eval(ctx); !reflect.DeepEqual(got, []any{1.0, 2.0, 3.0}) {
		t.Fatalf("kreeg %#v", got)
	}
}
