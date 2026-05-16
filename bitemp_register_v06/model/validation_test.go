package model

import (
	"strings"
	"testing"
)

func TestValideerWaarde_BSN(t *testing.T) {
	cases := []struct {
		naam      string
		waarde    string
		wilFouten bool
	}{
		{"geldig 11-proef BSN (111222333)", "111222333", false}, // sum=66 → 66%11=0
		{"geldig 11-proef BSN (123456782)", "123456782", false},
		{"te kort", "12345678", true},
		{"niet-cijfers", "12345678a", true},
		{"checksum fout", "111111111", true},
	}
	for _, c := range cases {
		t.Run(c.naam, func(t *testing.T) {
			fouten := ValideerWaarde("BSN", c.waarde, "bsn")
			if c.wilFouten && len(fouten) == 0 {
				t.Errorf("verwachtte fouten voor %q, kreeg er geen", c.waarde)
			}
			if !c.wilFouten && len(fouten) > 0 {
				t.Errorf("verwachtte geen fouten voor %q, kreeg %+v", c.waarde, fouten)
			}
		})
	}
}

func TestValideerWaarde_IBAN(t *testing.T) {
	cases := []struct {
		naam      string
		waarde    string
		wilFouten bool
	}{
		{"geldig NL IBAN", "NL91ABNA0417164300", false},
		// Spaces zijn geen geldig invoerformaat in V3 IBAN-pattern; frontend hoort te normaliseren.
		{"met spaties wordt afgewezen", "NL91 ABNA 0417 1643 00", true},
		{"checksum fout", "NL92ABNA0417164300", true},
		{"ongeldig charset", "NL91ABNA041716430!", true},
	}
	for _, c := range cases {
		t.Run(c.naam, func(t *testing.T) {
			fouten := ValideerWaarde("IBAN", c.waarde, "iban")
			if c.wilFouten && len(fouten) == 0 {
				t.Errorf("verwachtte fouten voor %q", c.waarde)
			}
			if !c.wilFouten && len(fouten) > 0 {
				t.Errorf("onverwachte fouten voor %q: %+v", c.waarde, fouten)
			}
		})
	}
}

func TestValideerWaarde_NLPostcode(t *testing.T) {
	cases := []struct {
		waarde    string
		wilFouten bool
	}{
		{"1234 AB", false},
		{"1234AB", false},
		{"0234 AB", true}, // mag niet met 0
		{"12 AB", true},   // pattern faalt
		{"1234 ab", false},
	}
	for _, c := range cases {
		fouten := ValideerWaarde("NLPostcode", c.waarde, "postcode")
		if c.wilFouten && len(fouten) == 0 {
			t.Errorf("verwachtte fouten voor %q", c.waarde)
		}
		if !c.wilFouten && len(fouten) > 0 {
			t.Errorf("onverwachte fouten voor %q: %+v", c.waarde, fouten)
		}
	}
}

func TestValideerWaarde_Email(t *testing.T) {
	cases := []struct {
		waarde    string
		wilFouten bool
	}{
		{"a@b.nl", false},
		{"abc", true},
		{"a@b", true},
		{"@b.nl", true},
	}
	for _, c := range cases {
		fouten := ValideerWaarde("Emailadres", c.waarde, "email")
		if c.wilFouten && len(fouten) == 0 {
			t.Errorf("verwachtte fouten voor %q", c.waarde)
		}
		if !c.wilFouten && len(fouten) > 0 {
			t.Errorf("onverwachte fouten voor %q: %+v", c.waarde, fouten)
		}
	}
}

func TestValideerWaarde_Kleur(t *testing.T) {
	cases := []struct {
		waarde    string
		wilFouten bool
	}{
		{"#fff", false},
		{"#1a2b3c", false},
		{"#ff8800cc", false},
		{"1a2b3c", true},
		{"#xyz", true},
	}
	for _, c := range cases {
		fouten := ValideerWaarde("Kleur", c.waarde, "kleur")
		if c.wilFouten && len(fouten) == 0 {
			t.Errorf("verwachtte fouten voor %q", c.waarde)
		}
		if !c.wilFouten && len(fouten) > 0 {
			t.Errorf("onverwachte fouten voor %q: %+v", c.waarde, fouten)
		}
	}
}

func TestValideerWaarde_GeoPunt(t *testing.T) {
	cases := []struct {
		waarde    string
		wilFouten bool
	}{
		{"52.3676,4.9041", false},
		{"-33.8688,151.2093", false},
		{"95,0", true},  // lat > 90
		{"0,200", true}, // lng > 180
		{"abc,def", true},
	}
	for _, c := range cases {
		fouten := ValideerWaarde("GeoPunt", c.waarde, "geo")
		if c.wilFouten && len(fouten) == 0 {
			t.Errorf("verwachtte fouten voor %q", c.waarde)
		}
		if !c.wilFouten && len(fouten) > 0 {
			t.Errorf("onverwachte fouten voor %q: %+v", c.waarde, fouten)
		}
	}
}

func TestParseStrengheid(t *testing.T) {
	cases := map[string]Validatiestrengheid{
		"":              StrengheidStrict,
		"strict":        StrengheidStrict,
		"STRICT":        StrengheidStrict,
		"lenient":       StrengheidLenient,
		"warnings-only": StrengheidWarningsOnly,
		"warnings":      StrengheidWarningsOnly,
		"warn":          StrengheidWarningsOnly,
		"onbekend":      StrengheidStrict,
	}
	for in, wil := range cases {
		got := ParseStrengheid(in)
		if got != wil {
			t.Errorf("ParseStrengheid(%q) = %q, wil %q", in, got, wil)
		}
	}
}

func TestValideerRepresentatie_Walker(t *testing.T) {
	type Voorbeeld struct {
		Postcode *string `json:"postcode" schema:"datatype:NLPostcode"`
		Email    *string `json:"email" schema:"datatype:Emailadres"`
		Naam     string  `json:"naam"` // geen datatype-tag → genegeerd
	}
	bad := "0123 AB"
	bademail := "abc"
	v := Voorbeeld{Postcode: &bad, Email: &bademail, Naam: "test"}
	fouten := ValideerRepresentatie(&v, "x")
	if len(fouten) < 2 {
		t.Errorf("verwachtte minstens 2 fouten, kreeg %d: %+v", len(fouten), fouten)
	}
	for _, f := range fouten {
		if f.Veld == "" {
			t.Errorf("fout zonder veld: %+v", f)
		}
	}
}

// TestValideerRepresentatie_InputStructBSN controleert dat de schema:"datatype:BSN"
// tag op de _Input struct (codegen-gegenereerd) door de walker wordt opgepikt,
// zodat een ongeldige BSN bij registratie-validatie wordt afgewezen.
func TestValideerRepresentatie_InputStructBSN(t *testing.T) {
	// Simuleer de NatuurlijkPersoon_Persoonsidentificatie_Input struct
	// (de echte struct heeft nu schema:"datatype:BSN" op het Bsn-veld).
	type PersoonsidentificatieInput struct {
		Bsn        string `json:"bsn" schema:"datatype:BSN"`
		Ingezetene *bool  `json:"ingezetene,omitempty"`
	}

	t.Run("ongeldige BSN wordt afgewezen", func(t *testing.T) {
		v := PersoonsidentificatieInput{Bsn: "123456789"}
		fouten := ValideerRepresentatie(&v, "persoonsidentificatie")
		if len(fouten) == 0 {
			t.Fatal("verwachtte BSN-validatiefout voor 123456789, maar geen fouten gevonden")
		}
		gevonden := false
		for _, f := range fouten {
			if strings.Contains(f.Veld, "bsn") || strings.Contains(f.Code, "BSN") || strings.Contains(f.Bericht, "BSN") || strings.Contains(f.Bericht, "11") {
				gevonden = true
			}
		}
		if !gevonden {
			t.Errorf("verwachtte BSN-specifieke fout, kreeg: %+v", fouten)
		}
	})

	t.Run("lege BSN wordt overgeslagen (niet verplicht via walker)", func(t *testing.T) {
		v := PersoonsidentificatieInput{Bsn: ""}
		fouten := ValideerRepresentatie(&v, "persoonsidentificatie")
		if len(fouten) != 0 {
			t.Errorf("lege BSN mag geen fout geven, maar kreeg: %+v", fouten)
		}
	})

	t.Run("geldige BSN slaagt", func(t *testing.T) {
		// 111222333 voldoet aan de 11-proef (testwaarde)
		v := PersoonsidentificatieInput{Bsn: "111222333"}
		fouten := ValideerRepresentatie(&v, "persoonsidentificatie")
		if len(fouten) != 0 {
			t.Errorf("geldige BSN 111222333 mag geen fout geven, maar kreeg: %+v", fouten)
		}
	})
}

// TestValideerGeoLijn controleert de geolijn_geojson named function.
func TestValideerGeoLijn(t *testing.T) {
	cases := []struct {
		input  string
		geldig bool
	}{
		{`{"type":"LineString","coordinates":[[4.9041,52.3676],[5.1,52.5]]}`, true},
		{`{"type":"LineString","coordinates":[[4.9,52.3],[5.0,52.4],[5.1,52.5]]}`, true},
		{`{"type":"LineString","coordinates":[[4.9,52.3]]}`, false},                      // slechts 1 punt
		{`{"type":"Point","coordinates":[4.9,52.3]}`, false},                             // verkeerd type
		{`{"type":"Polygon","coordinates":[[[4.9,52.3],[5.1,52.3],[4.9,52.3]]]}`, false}, // Polygon i.p.v. LineString
		{"niet-geldig-json", false},
	}
	for _, c := range cases {
		ok, err := valideerGeoLijnGeoJson(c.input)
		short := c.input
		if len(short) > 30 {
			short = short[:30]
		}
		if err != nil && c.geldig {
			t.Errorf("GeoLijn %q: onverwachte error: %v", short, err)
		}
		if ok != c.geldig {
			short := c.input
			if len(short) > 30 {
				short = short[:30]
			}
			t.Errorf("GeoLijn %q: geldig=%v, wil %v", short, ok, c.geldig)
		}
	}
}

// TestValideerGeoVlak controleert de geovlak_geojson named function.
func TestValideerGeoVlak(t *testing.T) {
	cases := []struct {
		input  string
		geldig bool
	}{
		{`{"type":"Polygon","coordinates":[[[4.9,52.3],[5.1,52.3],[5.1,52.5],[4.9,52.3]]]}`, true},
		{`{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}`, true},
		// niet gesloten: eerste != laatste
		{`{"type":"Polygon","coordinates":[[[4.9,52.3],[5.1,52.3],[5.1,52.5],[4.9,52.6]]]}`, false},
		// te weinig punten (3)
		{`{"type":"Polygon","coordinates":[[[0,0],[1,0],[0,0]]]}`, false},
		// verkeerd type
		{`{"type":"LineString","coordinates":[[4.9,52.3],[5.1,52.5]]}`, false},
		{"niet-geldig-json", false},
	}
	for _, c := range cases {
		ok, err := valideerGeoVlakGeoJson(c.input)
		if err != nil && c.geldig {
			short := c.input
			if len(short) > 30 {
				short = short[:30]
			}
			t.Errorf("GeoVlak %q: onverwachte error: %v", short, err)
		}
		if ok != c.geldig {
			short := c.input
			if len(short) > 30 {
				short = short[:30]
			}
			t.Errorf("GeoVlak %q: geldig=%v, wil %v", short, ok, c.geldig)
		}
	}
}
