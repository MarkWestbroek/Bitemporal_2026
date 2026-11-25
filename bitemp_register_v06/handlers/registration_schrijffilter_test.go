package handlers

import (
	"net/http"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Geneste GE's en relaties tellen mee: een toegestane entiteit mag geen ander type meesmokkelen.
// Organisatie → Contactpersoon heet niet "organisatie…" en valt dus buiten organisatie*.
func TestTypenInWijzigingen_GenestTeltMee(t *testing.T) {
	if _, ok := model.MetaRegistry.GetTypeMeta("Organisatie"); !ok {
		t.Skip("CG-model niet aanwezig")
	}
	org := &model.Organisatie{
		ID:               1,
		Organisatienamen: []model.Organisatie_Organisatienaam{{}},
		Contactpersonen:  []model.Contactpersoon{{Persoon_ID: 2}},
	}
	w := []model.WijzigingRequest{
		{Opvoer: &model.RepresentatiePlusNaam{Representatienaam: "Organisatie", Representatie: org}},
		{Afvoer: &model.RepresentatiePlusNaam{Representatienaam: "Persoon", Representatie: &model.Persoon{ID: 3}}},
	}
	typen := strings.Join(typenInWijzigingen(w), ",")
	for _, moet := range []string{"Organisatie", "Organisatie_Organisatienaam", "Contactpersoon", "Persoon"} {
		if !strings.Contains(","+typen+",", ","+moet+",") {
			t.Errorf("%s ontbreekt in %s", moet, typen)
		}
	}

	rerr := weigerBuitenFilter("omnium-koppelaar", []string{"organisatie*"}, typenInWijzigingen(w))
	if rerr == nil || rerr.Status != http.StatusForbidden {
		t.Fatalf("verwacht 403, kreeg %+v", rerr)
	}
	if !strings.Contains(rerr.Msg, "Contactpersoon, Persoon") || strings.Contains(rerr.Msg, "Organisatie_Organisatienaam,") {
		t.Errorf("melding: %s", rerr.Msg)
	}
	if rerr.Problem == nil || rerr.Problem.Code != "schrijffilter" || len(rerr.Problem.InvalidParams) != 2 ||
		rerr.Problem.InvalidParams[0].Name != "Contactpersoon" || rerr.Problem.InvalidParams[1].Name != "Persoon" {
		t.Errorf("problem: %+v", rerr.Problem)
	}
	if weigerBuitenFilter("x", []string{"organisatie*", "contactpersoon", "persoon"}, typenInWijzigingen(w)) != nil {
		t.Error("alles toegestaan hoort geen weigering te geven")
	}
}

// Een ongeldig filter geeft een account geen patronen: alles wordt geweigerd, met een melding
// die dat zegt.
func TestWeigerBuitenFilter_OngeldigFilter(t *testing.T) {
	rerr := weigerBuitenFilter("omnium-koppelaar", []string{}, []string{"Koppeling"})
	if rerr == nil || !strings.Contains(rerr.Msg, "ongeldig") {
		t.Fatalf("got %+v", rerr)
	}
}
