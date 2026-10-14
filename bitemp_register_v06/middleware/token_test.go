package middleware

import (
	"context"
	"testing"
)

func TestBearerToken(t *testing.T) {
	for kop, wil := range map[string]string{
		"Bearer omt_abc":   "omt_abc",
		"bearer  omt_abc ": "omt_abc",
		"Bearer eyJhbGci":  "", // een JWT is geen Omnium-token
		"Basic omt_abc":    "",
		"":                 "",
		"Bearer ":          "",
	} {
		if got := BearerToken(kop); got != wil {
			t.Errorf("BearerToken(%q) = %q, wil %q", kop, got, wil)
		}
	}
}

func TestClaimsUitToken(t *testing.T) {
	ZetTokenResolver(func(_ context.Context, tok string) (string, bool, error) {
		return "gast", tok == "omt_goed", nil
	})
	defer ZetTokenResolver(nil)
	if c := claimsUitToken(context.Background(), "omt_goed"); c == nil || c.Gebruikersnaam != "gast" || !c.ViaToken {
		t.Fatalf("geldig token: %+v", c)
	}
	if claimsUitToken(context.Background(), "omt_fout") != nil {
		t.Fatal("ongeldig token gaf claims")
	}
}
