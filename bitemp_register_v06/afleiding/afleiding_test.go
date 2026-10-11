package afleiding

import (
	"context"
	"reflect"
	"sort"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// nepLader levert vaste /full-maps en telt de batches per type.
type nepLader struct {
	data    map[string]map[int]map[string]any
	batches []string
}

func (l *nepLader) LaadEntiteiten(_ context.Context, typenaam string, ids []int) (map[int]map[string]any, error) {
	l.batches = append(l.batches, typenaam)
	uit := map[int]map[string]any{}
	for _, id := range ids {
		if m, ok := l.data[typenaam][id]; ok {
			uit[id] = m
		}
	}
	return uit, nil
}

// De demo-keten van np-loc/org-geo, in de vorm van /full (lijsten, hub met data).
// Persoon 1 woont op locatie 10 (wijk 7), persoon 2 op locatie 11 (wijk 8), persoon 3 nergens.
// De woonlocatie van persoon 2 heeft een afgevoerd ouder voorkomen naar locatie 10.
func demoLader() *nepLader {
	persoon := func(id int, woonlocaties ...map[string]any) map[string]any {
		items := []any{}
		for _, w := range woonlocaties {
			items = append(items, w)
		}
		return map[string]any{
			"id":          float64(id),
			"woonlocatie": items,
			"namen": []any{map[string]any{"rel_id": 1.0, "data": []any{
				map[string]any{"voorletters": "J.", "achternaam": "Berg"},
			}}},
		}
	}
	woon := func(locatie int, afvoer any) map[string]any {
		return map[string]any{"rel_id": 1.0, "locatie_id": float64(locatie), "afvoer": afvoer, "data": []any{map[string]any{}}}
	}
	locatie := func(id, wijk int, straat string) map[string]any {
		return map[string]any{
			"id":             float64(id),
			"gebiedsligging": []any{map[string]any{"rel_id": 1.0, "locatie_id": float64(id), "gemeentedeel_id": float64(wijk), "data": []any{map[string]any{}}}},
			"adressen":       []any{map[string]any{"rel_id": 1.0, "data": []any{map[string]any{"straatnaam": straat, "huisnummer": 1.0}}}},
		}
	}
	return &nepLader{data: map[string]map[int]map[string]any{
		"NatuurlijkPersoon": {
			1: persoon(1, woon(10, nil)),
			2: persoon(2, woon(10, "2026-01-01T00:00:00Z"), woon(11, nil)),
			3: persoon(3),
		},
		"Locatie":      {10: locatie(10, 7, "Kerkstraat"), 11: locatie(11, 8, "Dorpsweg")},
		"Gemeentedeel": {7: {"id": 7.0}, 8: {"id": 8.0}},
	}}
}

func npMetAfgeleid(t *testing.T, ars ...model.AfgeleideRelatie) model.TypeMeta {
	t.Helper()
	meta, ok := model.MetaRegistry.GetTypeMeta("NatuurlijkPersoon")
	if !ok {
		t.Skip("NatuurlijkPersoon niet in MetaRegistry")
	}
	if _, ok := model.MetaRegistry.GetTypeMeta("Gemeentedeel"); !ok {
		t.Skip("Gemeentedeel niet in MetaRegistry")
	}
	meta.AfgeleideRelaties = ars
	return meta
}

func ids(vs []Verwijzing) []int {
	uit := []int{}
	for _, v := range vs {
		uit = append(uit, v.ID)
	}
	return uit
}

// /woonwijk = woonlocatie.gebiedsligging: twee hops, drie batches (bronnen, locaties,
// gemeentedelen voor de weergavenaam) — onafhankelijk van het aantal bronnen.
func TestWoonwijkOverTweeHops(t *testing.T) {
	meta := npMetAfgeleid(t, model.AfgeleideRelatie{
		Naam: "Woonwijk", JSONRolnaam: "woonwijk", DoelEntiteit: "Gemeentedeel",
		Momentvoorkomen: model.Enkelvoudig, Afleidingsregel: "woonlocatie.gebiedsligging",
	})
	lader := demoLader()
	uit, err := NieuweOmgeving(lader).BerekenAfgeleideRelaties(context.Background(), meta, []int{1, 2, 3})
	if err != nil {
		t.Fatal(err)
	}
	for bron, want := range map[int][]int{1: {7}, 2: {8}, 3: {}} {
		if got := ids(uit[bron]["woonwijk"]); !reflect.DeepEqual(got, want) {
			t.Errorf("persoon %d: woonwijk = %v, verwacht %v", bron, got, want)
		}
	}
	sort.Strings(lader.batches)
	if want := []string{"Gemeentedeel", "Locatie", "NatuurlijkPersoon"}; !reflect.DeepEqual(lader.batches, want) {
		t.Errorf("batches = %v, verwacht één per type: %v", lader.batches, want)
	}
}

// Een relatie direct als uitkomst (geen doorkijk nodig) en de weergavenaam van het doel.
func TestWoonadresMetWeergavenaam(t *testing.T) {
	meta := npMetAfgeleid(t, model.AfgeleideRelatie{
		Naam: "Woonadres", JSONRolnaam: "woonadres", DoelEntiteit: "Locatie",
		Momentvoorkomen: model.Enkelvoudig, Afleidingsregel: "Woonlocatie",
	})
	uit, err := NieuweOmgeving(demoLader()).BerekenAfgeleideRelaties(context.Background(), meta, []int{1})
	if err != nil {
		t.Fatal(err)
	}
	got := uit[1]["woonadres"]
	if len(got) != 1 || got[0].ID != 10 || got[0].Weergavenaam != "Kerkstraat 1" {
		t.Fatalf("woonadres = %+v, verwacht locatie 10 'Kerkstraat 1'", got)
	}
}

// Meervoudig, met collect, filter, self en ontdubbelen; een fout type levert een lege relatie.
func TestUitkomstRegels(t *testing.T) {
	meta := npMetAfgeleid(t,
		model.AfgeleideRelatie{JSONRolnaam: "zelf", DoelEntiteit: "NatuurlijkPersoon", Momentvoorkomen: model.Meervoudig, Afleidingsregel: "self"},
		model.AfgeleideRelatie{JSONRolnaam: "getallen", DoelEntiteit: "Gemeentedeel", Momentvoorkomen: model.Meervoudig,
			Afleidingsregel: "woonlocatie.gebiedsligging.map(g, g.gemeentedeel_id)"},
		model.AfgeleideRelatie{JSONRolnaam: "fouttype", DoelEntiteit: "Gemeentedeel", Momentvoorkomen: model.Meervoudig, Afleidingsregel: "self"},
		model.AfgeleideRelatie{JSONRolnaam: "tekst", DoelEntiteit: "Gemeentedeel", Momentvoorkomen: model.Meervoudig, Afleidingsregel: "'abc'"},
		model.AfgeleideRelatie{JSONRolnaam: "parsefout", DoelEntiteit: "Gemeentedeel", Momentvoorkomen: model.Meervoudig, Afleidingsregel: "(("},
	)
	uit, err := NieuweOmgeving(demoLader()).BerekenAfgeleideRelaties(context.Background(), meta, []int{2})
	if err != nil {
		t.Fatal(err)
	}
	for rol, want := range map[string][]int{
		"zelf": {2}, "getallen": {8}, "fouttype": {}, "tekst": {}, "parsefout": {},
	} {
		if got := ids(uit[2][rol]); !reflect.DeepEqual(got, want) {
			t.Errorf("%s = %v, verwacht %v", rol, got, want)
		}
	}
}

// Lijsten worden plat gemaakt en dubbele id's vallen weg, in volgorde.
func TestVerwijzingenUitOntdubbelt(t *testing.T) {
	got, err := verwijzingenUit([]any{7.0, []any{7.0, 8.0}, nil, 0.0, 7.0}, "Gemeentedeel")
	if err != nil || !reflect.DeepEqual(got, []int{7, 8}) {
		t.Fatalf("kreeg %v (%v), verwacht [7 8]", got, err)
	}
	if _, err := verwijzingenUit(1.5, "Gemeentedeel"); err == nil {
		t.Fatal("een niet-geheel getal hoort een fout te geven")
	}
}

// Afgeleide velden lopen via dezelfde evaluator: tekst blijft tekst ("" voor null).
func TestAfgeleidVeldEnWeergavenaam(t *testing.T) {
	meta := npMetAfgeleid(t)
	m := demoLader().data["NatuurlijkPersoon"][1]
	if got := Weergavenaam(meta, m); got != "J. Berg" {
		t.Errorf("weergavenaam = %q, verwacht %q", got, "J. Berg")
	}
	if got := AfgeleidVeld(meta, m, model.AfgeleidVeld{Afleidingsregel: "Naam.bestaatNiet"}); got != "" {
		t.Errorf("ontbrekend tekstveld = %#v, verwacht \"\"", got)
	}
	if got := AfgeleidVeld(meta, m, model.AfgeleidVeld{GoType: "int", Afleidingsregel: "leeftijd('2000-01-01', '2026-01-01')"}); got != 26 {
		t.Errorf("leeftijd = %#v, verwacht 26", got)
	}
}
