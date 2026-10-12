package toegang

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

// De bundels en vectoren in testdata/toegang/ zijn gedeeld met de compiler in de Studio
// (web/vite/src/toegangsspraak/bundel.test.js): die schrijft de bundels, deze test voert ze uit.

const testMap = "../testdata/toegang"

type vector struct {
	Naam       string          `json:"naam"`
	Bundel     string          `json:"bundel"`
	Subject    vectorSubject   `json:"subject"`
	Handeling  string          `json:"handeling"`
	Pad        string          `json:"pad"`
	Peilmoment string          `json:"peilmoment"`
	Aanvraag   map[string]any  `json:"aanvraag"`
	Betrokkene map[string]any  `json:"betrokkene"`
	Verwacht   verwachtBesluit `json:"verwacht"`
}

type vectorSubject struct {
	Anoniem   bool                `json:"anoniem"`
	Kenmerken map[string][]string `json:"kenmerken"`
}

type verwachtBesluit struct {
	Toegestaan     bool     `json:"toegestaan"`
	Regel          string   `json:"regel"`
	Voorwaardelijk []string `json:"voorwaardelijk"`
}

func laadTestBundel(t testing.TB, naam string) *Bundel {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(testMap, naam+".bundel.json"))
	if err != nil {
		t.Fatalf("bundel %s: %v", naam, err)
	}
	b, err := LaadBundel(data)
	if err != nil {
		t.Fatalf("bundel %s: %v", naam, err)
	}
	return b
}

func (v vector) verzoek(t *testing.T) Verzoek {
	moment := "2026-10-12"
	if v.Peilmoment != "" {
		moment = v.Peilmoment
	}
	m, err := time.Parse("2006-01-02", moment)
	if err != nil {
		t.Fatalf("peilmoment %q: %v", moment, err)
	}
	vz := Verzoek{
		Subject:    Subject{Anoniem: v.Subject.Anoniem, Kenmerken: v.Subject.Kenmerken},
		Handeling:  v.Handeling,
		Peilmoment: m,
		Aanvraag:   v.Aanvraag,
	}
	if v.Betrokkene != nil {
		data := v.Betrokkene
		vz.Betrokkene = func(pad string) (any, bool) { w, ok := data[pad]; return w, ok }
	}
	return vz
}

func TestVectoren(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(testMap, "vectoren.json"))
	if err != nil {
		t.Fatal(err)
	}
	var bestand struct {
		Vectoren []vector `json:"vectoren"`
	}
	if err := json.Unmarshal(data, &bestand); err != nil {
		t.Fatal(err)
	}
	bundels := map[string]*Bundel{}
	for _, v := range bestand.Vectoren {
		t.Run(v.Naam, func(t *testing.T) {
			b := bundels[v.Bundel]
			if b == nil {
				b = laadTestBundel(t, v.Bundel)
				bundels[v.Bundel] = b
			}
			got := b.Beslis(v.verzoek(t), v.Pad)
			if got.Toegestaan != v.Verwacht.Toegestaan || got.Regel != v.Verwacht.Regel {
				t.Fatalf("pad %s: kreeg toegestaan=%v regel=%q, verwacht toegestaan=%v regel=%q",
					v.Pad, got.Toegestaan, got.Regel, v.Verwacht.Toegestaan, v.Verwacht.Regel)
			}
			if v.Verwacht.Voorwaardelijk != nil && !reflect.DeepEqual(got.Voorwaardelijk, v.Verwacht.Voorwaardelijk) {
				t.Fatalf("voorwaardelijk: kreeg %v, verwacht %v", got.Voorwaardelijk, v.Verwacht.Voorwaardelijk)
			}
		})
	}
}

func TestToegestanePadenOpVeldenlijst(t *testing.T) {
	b := laadTestBundel(t, "openbaar")
	var velden []struct {
		Veldpad string `json:"veldpad"`
	}
	data, _ := os.ReadFile(filepath.Join(testMap, "np-loc-velden.json"))
	if err := json.Unmarshal(data, &velden); err != nil {
		t.Fatal(err)
	}
	paden := make([]string, len(velden))
	for i, v := range velden {
		paden[i] = v.Veldpad
	}
	besluiten := b.ToegestanePaden(Verzoek{Subject: Subject{Anoniem: true}, Handeling: "bekijken"}, paden)
	var open []string
	for _, p := range paden {
		if besluiten[p].Toegestaan {
			open = append(open, p)
		}
	}
	verwacht := []string{
		"NatuurlijkPersoon.namen.voorletters", "NatuurlijkPersoon.namen.roepnaam",
		"NatuurlijkPersoon.namen.tussenvoegsel", "NatuurlijkPersoon.namen.achternaam",
		"NatuurlijkPersoon.namen.weergavenaam",
	}
	if !reflect.DeepEqual(open, verwacht) {
		t.Fatalf("anoniem ziet %v, verwacht %v", open, verwacht)
	}
}

func TestLaadBundelWeigertOngeldig(t *testing.T) {
	gevallen := map[string]string{
		"formaat":   `{"formaat":"iets-anders","regels":[]}`,
		"effect":    `{"formaat":"omnium-toegangsbundel/1","regels":[{"id":"a","effect":"misschien","handeling":"bekijken"}]}`,
		"dubbel id": `{"formaat":"omnium-toegangsbundel/1","regels":[{"id":"a","effect":"toestaan","handeling":"bekijken"},{"id":"a","effect":"toestaan","handeling":"bekijken"}]}`,
		"standaard": `{"formaat":"omnium-toegangsbundel/1","standaard":"misschien","regels":[]}`,
		"conflict":  `{"formaat":"omnium-toegangsbundel/1","conflict":"loting","regels":[]}`,
		"geen JSON": `{`,
	}
	for naam, json := range gevallen {
		if _, err := LaadBundel([]byte(json)); err == nil {
			t.Errorf("%s: verwacht een fout", naam)
		}
	}
}

// Indicatie van de kosten per veldbeslissing (vgl. ± 17 µs per veldrecord voor geïndexeerde
// OPA in de meting van 30-09).
func BenchmarkBeslisVeld(b *testing.B) {
	bundel := laadTestBundel(b, "np-loc-demo")
	v := Verzoek{
		Subject:    Subject{Kenmerken: map[string][]string{"rol": {"medewerker"}, "kanaal": {"telefoon"}, "dienst": {"avond"}}},
		Handeling:  "bekijken",
		Peilmoment: time.Date(2026, 10, 12, 0, 0, 0, 0, time.UTC),
	}
	paden := make([]string, 40)
	for i := range paden {
		paden[i] = fmt.Sprintf("NatuurlijkPersoon.ge%d.veld%d", i%5, i)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bundel.Beslis(v, paden[i%len(paden)])
	}
}
