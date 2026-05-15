package model

import "testing"

// Tests voor de generieke regel-evaluator (regels_eval.go).
// Dekken het AST-pad (go/parser-based) los van de validation-laag.

func TestEvalueerExpressie_BasisOperatoren(t *testing.T) {
	tests := []struct {
		expr string
		env  map[string]any
		want any
	}{
		{"1 + 2 * 3", nil, int64(7)},
		{"(1 + 2) * 3", nil, int64(9)},
		{"10 % 3", nil, int64(1)},
		{"10 / 3", nil, int64(3)},
		{"10.0 / 4.0", nil, float64(2.5)},
		{"-5", nil, int64(-5)},
		{"!true", nil, false},
		{"true && false", nil, false},
		{"true || false", nil, true},
		{"1 == 1 && 2 < 3", nil, true},
		{"a + b", map[string]any{"a": int64(2), "b": int64(40)}, int64(42)},
		{`"x" == "x"`, nil, true},
	}
	for _, tt := range tests {
		got, err := evalueerExpressie(tt.expr, tt.env)
		if err != nil {
			t.Errorf("expr %q: onverwachte error: %v", tt.expr, err)
			continue
		}
		if got != tt.want {
			t.Errorf("expr %q: got %v (%T), want %v (%T)", tt.expr, got, got, tt.want, tt.want)
		}
	}
}

func TestEvalueerChecksum_BSN(t *testing.T) {
	expr := "(9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0"
	ok, err := evalueerChecksum(expr, "111222333")
	if err != nil || !ok {
		t.Errorf("verwachtte true, got ok=%v err=%v", ok, err)
	}
	ok, err = evalueerChecksum(expr, "111222334")
	if err != nil || ok {
		t.Errorf("verwachtte false, got ok=%v err=%v", ok, err)
	}
}

func TestEvalueerFormula_Numeriek(t *testing.T) {
	ok, err := evalueerFormula("valueNum >= 0 && valueNum <= 100", "42.5")
	if err != nil || !ok {
		t.Errorf("verwachtte true, got ok=%v err=%v", ok, err)
	}
	ok, err = evalueerFormula("valueNum > 100", "42.5")
	if err != nil || ok {
		t.Errorf("verwachtte false, got ok=%v err=%v", ok, err)
	}
}

func TestRegistreerValidatieFunctie(t *testing.T) {
	RegistreerValidatieFunctie("test_altijd_true", func(string) (bool, error) { return true, nil })
	defer delete(validatieFuncties, "test_altijd_true")
	regel := V3Regel{Naam: "altijd-ok", Type: "function", Expressie: "test_altijd_true"}
	if fout := evalueerRegel(regel, "wat dan ook"); fout != nil {
		t.Errorf("verwachtte geen fout, got %+v", fout)
	}
}

func TestEvalueerRegel_OnbekendeFunctieIsWaarschuwing(t *testing.T) {
	regel := V3Regel{Naam: "x", Type: "function", Expressie: "bestaat_niet"}
	fout := evalueerRegel(regel, "abc")
	if fout == nil {
		t.Fatal("verwachtte een fout")
	}
	if fout.Severity != SeverityWarning {
		t.Errorf("verwachtte waarschuwing, got severity=%s", fout.Severity)
	}
}

func TestBuildProblemDetails_NLAPIVorm(t *testing.T) {
	res := ValidatieResultaat{Fouten: []ValidatieFout{
		{Veld: "voornaam", Datatype: "KorteTekst", Code: "max-length",
			Bericht: "te lang", Waarde: "...", Severity: SeverityError},
	}}
	pd := BuildProblemDetails(res, "/registratie/np")
	if pd.Status != 422 || pd.Code != "validation_error" {
		t.Errorf("onjuist envelope: %+v", pd)
	}
	if len(pd.InvalidParams) != 1 ||
		pd.InvalidParams[0].Name != "voornaam" ||
		pd.InvalidParams[0].Code != "max-length" ||
		pd.InvalidParams[0].Reason != "te lang" {
		t.Errorf("invalidParams mapping fout: %+v", pd.InvalidParams)
	}
	if pd.Instance != "/registratie/np" {
		t.Errorf("instance fout: %q", pd.Instance)
	}
}
