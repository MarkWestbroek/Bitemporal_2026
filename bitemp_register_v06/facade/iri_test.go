package facade

import "testing"

const testUUID = "3f2c1a9e-4b7d-4c1e-9a0b-1234567890ab"

func testTabel(t *testing.T) *IRITabel {
	t.Helper()
	tab, err := NieuweIRITabel([]IRIRegel{
		{Prefix: "https://gemeente.example/id/object/", Register: "objecten", Basis: "https://objecten.example/api/v2/objects/"},
		{Prefix: "https://gemeente.example/id/", Register: "overig", Basis: "https://overig.example/api/"},
	})
	if err != nil {
		t.Fatal(err)
	}
	return tab
}

func TestIRINaarURL(t *testing.T) {
	tab := testTabel(t)
	v, ok := tab.NaarURL("https://gemeente.example/id/object/" + testUUID)
	if !ok {
		t.Fatal("verwacht een verwijzing")
	}
	if v.Register != "objecten" || v.URL != "https://objecten.example/api/v2/objects/"+testUUID || v.UUID != testUUID {
		t.Fatalf("onverwacht: %+v", v)
	}
}

func TestIRILangstePrefixWint(t *testing.T) {
	tab := testTabel(t)
	v, ok := tab.NaarURL("https://gemeente.example/id/object/" + testUUID)
	if !ok || v.Register != "objecten" {
		t.Fatalf("langste prefix moet winnen, kreeg %+v", v)
	}
}

func TestIRIWeigertGeenUUID(t *testing.T) {
	tab := testTabel(t)
	for _, iri := range []string{
		"https://gemeente.example/id/object/../../admin",
		"https://gemeente.example/id/object/" + testUUID + "/extra",
		"https://gemeente.example/id/object/" + testUUID + "?x=1",
		"https://gemeente.example/id/object/",
		"https://elders.example/id/object/" + testUUID,
	} {
		if v, ok := tab.NaarURL(iri); ok {
			t.Errorf("%q had geweigerd moeten worden, kreeg %+v", iri, v)
		}
	}
}

func TestURLNaarIRI(t *testing.T) {
	tab := testTabel(t)
	if got := tab.NaarIRI("https://objecten.example/api/v2/objects/" + testUUID); got != "https://gemeente.example/id/object/"+testUUID {
		t.Fatalf("kreeg %q", got)
	}
	// Onbekend component: de URL blijft staan (ook een geldige IRI).
	vreemd := "https://bag.example/api/panden/0599100000000001"
	if got := tab.NaarIRI(vreemd); got != vreemd {
		t.Fatalf("onbekende URL moet blijven staan, kreeg %q", got)
	}
}

func TestIRIHoofdlettersUUID(t *testing.T) {
	tab := testTabel(t)
	v, ok := tab.NaarURL("https://gemeente.example/id/object/3F2C1A9E-4B7D-4C1E-9A0B-1234567890AB")
	if !ok || v.UUID != testUUID {
		t.Fatalf("uuid moet genormaliseerd worden, kreeg %+v", v)
	}
}

func TestIRITabelValidatie(t *testing.T) {
	gevallen := map[string][]IRIRegel{
		"geen slash":     {{Prefix: "https://a.example/id/object", Register: "o", Basis: "https://b.example/"}},
		"geen http":      {{Prefix: "urn:x:", Register: "o", Basis: "https://b.example/"}},
		"geen register":  {{Prefix: "https://a.example/", Basis: "https://b.example/"}},
		"dubbele prefix": {{Prefix: "https://a.example/", Register: "o", Basis: "https://b.example/"}, {Prefix: "https://a.example/", Register: "p", Basis: "https://c.example/"}},
		"dubbele basis":  {{Prefix: "https://a.example/", Register: "o", Basis: "https://b.example/"}, {Prefix: "https://d.example/", Register: "p", Basis: "https://b.example/"}},
	}
	for naam, regels := range gevallen {
		if _, err := NieuweIRITabel(regels); err == nil {
			t.Errorf("%s: verwacht een fout", naam)
		}
	}
}
