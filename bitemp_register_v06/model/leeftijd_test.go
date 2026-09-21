package model

import (
	"testing"
	"time"
)

func peil(s string) *time.Time {
	t, _ := time.Parse("2006-01-02", s)
	return &t
}

func TestBerekenLeeftijd(t *testing.T) {
	// nil-verwachting wordt uitgedrukt als -1
	cases := []struct {
		naam     string
		geboorte string
		peil     string
		verwacht int
	}{
		{"volledig, na verjaardag", "1990-06-15", "2026-07-09", 36},
		{"volledig, dag voor verjaardag", "1990-06-15", "2026-06-14", 35},
		{"volledig, op verjaardag", "1990-06-15", "2026-06-15", 36},
		{"date-time invoer", "2000-01-01T12:00:00Z", "2026-07-09", 26},
		{"incompleet jaar → 1 juli, na", "1990-00-00", "2026-07-09", 36},
		{"incompleet jaar → 1 juli, voor", "1990-00-00", "2026-06-30", 35},
		{"incompleet jaar (alleen JJJJ)", "1990", "2026-07-09", 36},
		{"incompleet maand → 15e, na", "1990-06-00", "2026-07-09", 36},
		{"incompleet maand → 15e, voor", "1990-06-00", "2026-06-14", 35},
		{"incompleet maand (JJJJ-MM)", "1990-06", "2026-06-14", 35},
		{"volledig onbekend", "0000-00-00", "2026-07-09", -1},
		{"lege string", "", "2026-07-09", -1},
		{"onparsbaar", "geen-datum", "2026-07-09", -1},
		{"peil voor geboorte", "2030-01-01", "2026-07-09", -1},
	}

	for _, c := range cases {
		t.Run(c.naam, func(t *testing.T) {
			got := BerekenLeeftijdVanArgs(c.geboorte, c.peil)
			if c.verwacht == -1 {
				if got != nil {
					t.Fatalf("verwachtte nil, kreeg %d", *got)
				}
				return
			}
			if got == nil {
				t.Fatalf("verwachtte %d, kreeg nil", c.verwacht)
			}
			if *got != c.verwacht {
				t.Fatalf("verwachtte %d, kreeg %d", c.verwacht, *got)
			}
		})
	}
}

func TestParseAfgeleideFunctieAanroep(t *testing.T) {
	cases := []struct {
		expr     string
		naam     string
		args     []string
		ok       bool
	}{
		{`leeftijd(geboortedatum)`, "leeftijd", []string{"geboortedatum"}, true},
		{`leeftijd(np.geboortedatum, "2026-01-01")`, "leeftijd", []string{"np.geboortedatum", `"2026-01-01"`}, true},
		{`leeftijd( geboortedatum , "2026-01-01" )`, "leeftijd", []string{"geboortedatum", `"2026-01-01"`}, true},
		{`leeftijd("a, b")`, "leeftijd", []string{`"a, b"`}, true}, // komma binnen quotes telt niet
		{`DomeinGegevens.naam`, "", nil, false},                    // gewoon pad
		{`"letterlijk"`, "", nil, false},                          // string-literal
		{``, "", nil, false},
	}
	for _, c := range cases {
		naam, args, ok := ParseAfgeleideFunctieAanroep(c.expr)
		if ok != c.ok || naam != c.naam {
			t.Fatalf("%q: naam=%q ok=%v; verwacht naam=%q ok=%v", c.expr, naam, ok, c.naam, c.ok)
		}
		if ok {
			if len(args) != len(c.args) {
				t.Fatalf("%q: args=%v; verwacht %v", c.expr, args, c.args)
			}
			for i := range args {
				if args[i] != c.args[i] {
					t.Fatalf("%q: arg[%d]=%q; verwacht %q", c.expr, i, args[i], c.args[i])
				}
			}
		}
	}
}

func TestBerekenLeeftijdWandklokDefault(t *testing.T) {
	// Zonder peildatum mag het niet crashen en moet een plausibele leeftijd geven.
	got := BerekenLeeftijd("2000-01-01", nil)
	if got == nil {
		t.Fatal("verwachtte een leeftijd, kreeg nil")
	}
	if *got < 20 || *got > 120 {
		t.Fatalf("onwaarschijnlijke leeftijd: %d", *got)
	}
}
