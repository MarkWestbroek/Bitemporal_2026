package model

import (
	"reflect"
	"testing"
)

func entMetEnum(naam, domein, enum string) V3Entiteit {
	return V3Entiteit{Typenaam: naam, Domein: domein, Gegevenselementen: []V3Gegevenselement{
		{Velden: []V3Veld{{Naam: "v", Enum: enum}}},
	}}
}

func TestEnumGenererendDomein(t *testing.T) {
	ents := []V3Entiteit{
		entMetEnum("Zaaktype", "catalogus", "Vertrouwelijkheid"),
		entMetEnum("Zaak", "zaken", "Vertrouwelijkheid"),
		entMetEnum("Document", "documenten", "Vertrouwelijkheid"),
		entMetEnum("Besluit", "besluiten", "Alleen"),
		entMetEnum("A", "zaken", "Zwerver"),
		entMetEnum("B", "documenten", "Zwerver"),
	}
	gebruik := EnumGebruikPerDomein(ents, func(e V3Entiteit) string { return EffectiefDomein(e.Domein, "zaakmodel", "zaken") })

	gevallen := []struct{ enum, enumDomein, verwacht string }{
		{"Vertrouwelijkheid", "catalogus", "catalogus"}, // eigenaar gebruikt hem zelf
		{"Alleen", "catalogus", "besluiten"},            // één gebruiker: daar, ook al heet de eigenaar anders
		{"Alleen", "", "besluiten"},
		{"Zwerver", "", "documenten"},          // geen eigenaar: alfabetisch eerste gebruiker
		{"Zwerver", "catalogus", "documenten"}, // eigenaar gebruikt hem niet
	}
	for _, g := range gevallen {
		if got := EnumGenererendDomein(g.enumDomein, gebruik[g.enum]); got != g.verwacht {
			t.Errorf("%s (domein %q): %q, verwacht %q", g.enum, g.enumDomein, got, g.verwacht)
		}
	}

	// Precies één domein genereert een gedeelde enum.
	aantal := 0
	for d := range gebruik["Vertrouwelijkheid"] {
		if EnumGenererendDomein("catalogus", gebruik["Vertrouwelijkheid"]) == d {
			aantal++
		}
	}
	if aantal != 1 {
		t.Errorf("gedeelde enum gegenereerd in %d domeinen, verwacht 1", aantal)
	}
}

func TestEffectiefDomein(t *testing.T) {
	gevallen := []struct{ ent, model, gevraagd, verwacht string }{
		{"zaken", "x", "catalogus", "zaken"},
		{"", "x", "register", "register"},
		{"", "np-loc", "np-loc", "np-loc"},
		{"", "x", "np-loc", "register"},
	}
	for _, g := range gevallen {
		if got := EffectiefDomein(g.ent, g.model, g.gevraagd); got != g.verwacht {
			t.Errorf("EffectiefDomein(%q,%q,%q) = %q, verwacht %q", g.ent, g.model, g.gevraagd, got, g.verwacht)
		}
	}
}

func TestEnumDomeinVolgorde(t *testing.T) {
	v3 := V3Model{
		Enums: []V3Enum{{GoType: "Vertrouwelijkheid", Domein: "catalogus"}},
		Entiteiten: []V3Entiteit{
			entMetEnum("Zaak", "zaken", "Vertrouwelijkheid"),
			entMetEnum("Zaaktype", "catalogus", "Vertrouwelijkheid"),
			entMetEnum("Document", "documenten", "Vertrouwelijkheid"),
			entMetEnum("Besluit", "besluiten", ""),
		},
	}
	got := EnumDomeinVolgorde(v3, []string{"besluiten", "zaken", "documenten", "catalogus"})
	want := []string{"besluiten", "catalogus", "zaken", "documenten"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("volgorde %v, verwacht %v", got, want)
	}
	// De eigenaar wordt niet meegebouwd: de volgorde blijft zoals hij was.
	got = EnumDomeinVolgorde(v3, []string{"zaken", "documenten"})
	if !reflect.DeepEqual(got, []string{"zaken", "documenten"}) {
		t.Errorf("zonder eigenaar: %v", got)
	}
}
