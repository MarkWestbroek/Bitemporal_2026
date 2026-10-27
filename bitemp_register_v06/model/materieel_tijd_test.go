package model

import (
	"testing"
	"time"
)

func dag(s string) time.Time {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestParseGeldigOp(t *testing.T) {
	g, err := ParseGeldigOp("2026-10-27")
	if err != nil || !g.OpDag || g.Moment != dag("2026-10-27") {
		t.Fatalf("datum: %v %+v", err, g)
	}
	g, err = ParseGeldigOp("2026-10-27T10:30:00+02:00")
	if err != nil || g.OpDag || g.Moment.Hour() != 8 {
		t.Fatalf("tijdstip: %v %+v", err, g)
	}
	if _, err := ParseGeldigOp("gisteren"); err == nil {
		t.Fatal("ongeldig moet falen")
	}
}

func TestGeldigOp_Geldig(t *testing.T) {
	aanvang := &TijdWaarde{T: dag("2010-05-01"), IsDatum: true}
	einde := &TijdWaarde{T: dag("2020-11-30"), IsDatum: true}
	gevallen := []struct {
		op  string
		wil bool
		wat string
	}{
		{"2010-04-30", false, "dag vóór aanvang"},
		{"2010-05-01", true, "aanvangsdag"},
		{"2015-01-01", true, "middenin"},
		{"2020-11-30", true, "eindedag is inclusief"},
		{"2020-12-01", false, "dag na einde"},
		{"2020-11-30T23:59:00Z", true, "tijdstip op de eindedag, datumgrens inclusief"},
	}
	for _, c := range gevallen {
		g, _ := ParseGeldigOp(c.op)
		if got := g.Geldig(aanvang, einde); got != c.wil {
			t.Errorf("%s (%s): wil %v, kreeg %v", c.op, c.wat, c.wil, got)
		}
	}
	// Open aan beide kanten: altijd geldig.
	g, _ := ParseGeldigOp("1900-01-01")
	if !g.Geldig(nil, nil) {
		t.Error("open periode hoort altijd geldig te zijn")
	}
	// Tijdstippen: einde exclusief.
	tA := &TijdWaarde{T: dag("2026-01-01").Add(10 * time.Hour)}
	tE := &TijdWaarde{T: dag("2026-01-01").Add(12 * time.Hour)}
	g, _ = ParseGeldigOp("2026-01-01T12:00:00Z")
	if g.Geldig(tA, tE) {
		t.Error("tijdstip-einde is exclusief")
	}
	g, _ = ParseGeldigOp("2026-01-01T11:59:59Z")
	if !g.Geldig(tA, tE) {
		t.Error("vlak vóór het einde hoort geldig te zijn")
	}
}

func TestVolgendEindeVoor(t *testing.T) {
	e := VolgendEindeVoor(TijdWaarde{T: dag("2010-05-01"), IsDatum: true})
	if !e.IsDatum || e.T != dag("2010-04-30") {
		t.Errorf("datum: wil 2010-04-30, kreeg %s", e)
	}
	m := dag("2026-01-01").Add(10 * time.Hour)
	if e := VolgendEindeVoor(TijdWaarde{T: m}); e.IsDatum || !e.T.Equal(m) {
		t.Errorf("tijdstip: wil hetzelfde moment, kreeg %s", e)
	}
}

// TestSnoeiMaterieelGeldigOp gebruikt het echte np-loc-model: NatuurlijkPersoon met twee
// burgerschappen (NL 2000-01-01 t/m 2010-04-30, DE vanaf 2010-05-01) en een ont-opvoerd einde
// dat niet mee mag tellen.
func TestSnoeiMaterieelGeldigOp(t *testing.T) {
	opvoer := dag("2026-01-10")
	later := dag("2026-01-20")
	d := func(s string) *Date { x := Date{Time: dag(s)}; return &x }
	np := &NatuurlijkPersoon{ID: 1}
	np.Burgerschappen = []NatuurlijkPersoon_Burgerschap{
		{NatuurlijkPersoon_ID: 1, Rel_ID: 1, Opvoer: &opvoer,
			Aanvang: []NatuurlijkPersoon_Burgerschap_Aanvang{{Rel_ID: 1, Versie: 1, Datum: d("2000-01-01"), Opvoer: &opvoer}},
			Einde: []NatuurlijkPersoon_Burgerschap_Einde{
				{Rel_ID: 1, Versie: 1, Datum: d("2005-12-31"), Opvoer: &opvoer, Afvoer: &later}, // gecorrigeerd: telt niet
				{Rel_ID: 1, Versie: 2, Datum: d("2010-04-30"), Opvoer: &later},
			}},
		{NatuurlijkPersoon_ID: 1, Rel_ID: 2, Opvoer: &later,
			Aanvang: []NatuurlijkPersoon_Burgerschap_Aanvang{{Rel_ID: 2, Versie: 1, Datum: d("2010-05-01"), Opvoer: &later}}},
	}
	meta, ok := MetaRegistry.GetTypeMeta("NatuurlijkPersoon")
	if !ok {
		t.Skip("np-loc niet in de registry")
	}
	kopie := func() *NatuurlijkPersoon {
		k := *np
		k.Burgerschappen = append([]NatuurlijkPersoon_Burgerschap(nil), np.Burgerschappen...)
		return &k
	}
	gevallen := []struct {
		op  string
		rel []int
	}{
		{"1999-12-31", nil},
		{"2005-12-31", []int{1}}, // het gecorrigeerde einde telt niet
		{"2010-04-30", []int{1}},
		{"2010-05-01", []int{2}},
		{"2030-01-01", []int{2}},
	}
	for _, c := range gevallen {
		g, _ := ParseGeldigOp(c.op)
		k := kopie()
		if !SnoeiMaterieelGeldigOp(k, meta, g, nil) {
			t.Errorf("%s: NP zonder eigen tijdlijn hoort te bestaan", c.op)
		}
		var rel []int
		for _, b := range k.Burgerschappen {
			rel = append(rel, b.Rel_ID)
		}
		if len(rel) != len(c.rel) || (len(rel) > 0 && rel[0] != c.rel[0]) {
			t.Errorf("%s: wil rel_ids %v, kreeg %v", c.op, c.rel, rel)
		}
	}
	// Formeel peilmoment vóór de correctie: het oude einde (2005-12-31) geldt dan nog.
	g, _ := ParseGeldigOp("2008-01-01")
	k := kopie()
	peil := dag("2026-01-15")
	SnoeiMaterieelGeldigOp(k, meta, g, &peil)
	if len(k.Burgerschappen) != 0 {
		t.Errorf("op peil vóór de correctie eindigde NL al in 2005; kreeg %d voorkomens", len(k.Burgerschappen))
	}
	// Slice-variant: twee personen, één zonder burgerschappen.
	lijst := []NatuurlijkPersoon{*kopie(), {ID: 2}}
	g, _ = ParseGeldigOp("2015-01-01")
	if n := FilterSliceMaterieelGeldigOp(&lijst, meta, g, nil); n != 2 || len(lijst) != 2 || len(lijst[0].Burgerschappen) != 1 {
		t.Errorf("slice: wil 2 personen, de eerste met 1 burgerschap; kreeg n=%d len=%d", n, len(lijst))
	}
}
