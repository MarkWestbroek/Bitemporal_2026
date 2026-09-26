package model

import (
	"reflect"
	"testing"
)

func TestParseSchemaTag(t *testing.T) {
	gevallen := map[string]SchemaTag{
		"":                                {},
		"datatype:NLPostcode":             {Datatype: "NLPostcode"},
		"ref:LandenlijstLand":             {Ref: "LandenlijstLand"},
		"enum=CGLaag":                     {Enum: "CGLaag"},
		"enum=CGLaag,datatype:EnumLijst":  {Enum: "CGLaag", Datatype: "EnumLijst"},
		"datatype:EnumLijst, enum=CGLaag": {Enum: "CGLaag", Datatype: "EnumLijst"},
		"enum:A|B,ref:X":                  {Enum: "A|B", Ref: "X"},
	}
	for tag, verwacht := range gevallen {
		if got := ParseSchemaTag(tag); got != verwacht {
			t.Errorf("ParseSchemaTag(%q) = %+v, verwacht %+v", tag, got, verwacht)
		}
	}
}

func TestSplitsLijstwaarde(t *testing.T) {
	if got := SplitsLijstwaarde(" Laag 1; Laag 2;;", ";"); !reflect.DeepEqual(got, []string{"Laag 1", "Laag 2"}) {
		t.Errorf("got %v", got)
	}
	if got := SplitsLijstwaarde("  ", ";"); got != nil {
		t.Errorf("leeg: got %v", got)
	}
	if got := SplitsLijstwaarde("a;b", ""); !reflect.DeepEqual(got, []string{"a;b"}) {
		t.Errorf("zonder scheiding: got %v", got)
	}
}

func TestEnumLijstDatatypeHeeftScheiding(t *testing.T) {
	if s := LijstScheiding("EnumLijst"); s != ";" {
		t.Fatalf("LijstScheiding(EnumLijst) = %q, verwacht \";\"", s)
	}
	if s := LijstScheiding("Kleur"); s != "" {
		t.Errorf("Kleur is geen lijst, kreeg %q", s)
	}
}

// Een lijst van enum-waarden in één veld: elke waarde wordt afzonderlijk gecontroleerd.
func TestValidatieEnumLijst(t *testing.T) {
	goed := Initiatief_Product_Data{Naam: "x", Type: "Component", CGLaag: "Laag 1;Laag 2; Utility"}
	if f := ValideerRepresentatie(&goed, ""); len(f) != 0 {
		t.Errorf("geldige lijst gaf fouten: %+v", f)
	}
	fout := Initiatief_Product_Data{Naam: "x", Type: "Component", CGLaag: "Laag 1;Laag 9"}
	f := ValideerRepresentatie(&fout, "")
	if len(f) != 1 || f[0].Waarde != "Laag 9" {
		t.Errorf("verwacht één fout op \"Laag 9\", kreeg %+v", f)
	}
	enkel := Initiatief_Product_Data{Naam: "x", Type: "Onzin", CGLaag: "Laag 1"}
	if f := ValideerRepresentatie(&enkel, ""); len(f) != 1 {
		t.Errorf("gewone enum (Type) moet nog steeds als geheel gecontroleerd worden, kreeg %+v", f)
	}
}
