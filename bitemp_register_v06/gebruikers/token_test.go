package gebruikers

import (
	"strings"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestNieuwTokenEnGeldig(t *testing.T) {
	a, ha, err := nieuwToken()
	b, _, _ := nieuwToken()
	if err != nil || !strings.HasPrefix(a, "omt_") || len(a) < 40 || a == b || ha != hashVanToken(a) || ha == a {
		t.Fatalf("token %q hash %q", a, ha)
	}
	nu := time.Now()
	later, eerder := nu.Add(time.Hour), nu.Add(-time.Hour)
	if !tokenGeldig(&model.GebruikerToken{Verloopt: &later}, nu) {
		t.Error("nog geldig")
	}
	if tokenGeldig(&model.GebruikerToken{Verloopt: &eerder}, nu) {
		t.Error("verlopen")
	}
	if tokenGeldig(&model.GebruikerToken{IngetrokkenOp: &eerder}, nu) {
		t.Error("ingetrokken")
	}
	if !tokenGeldig(&model.GebruikerToken{}, nu) {
		t.Error("zonder vervaldatum")
	}
}
