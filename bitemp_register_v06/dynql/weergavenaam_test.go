package dynql

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// De afleidingsregel van ApiStandaard.weergavenaam is "Naam.naam": het segment "Naam" is
// de klassenaam van het GE, niet de rolnaam ("ApiStandaardNamen"). Vóór 24-09-2026 bleef
// de weergavenaam daardoor leeg.
func TestWeergavenaam_PadSegmentOpKlassenaam(t *testing.T) {
	meta, ok := model.MetaRegistry.GetTypeMeta("ApiStandaard")
	if !ok {
		t.Skip("CG-model niet geregistreerd")
	}
	flat := map[string]interface{}{"id": float64(2), "api_standaard_namen": map[string]interface{}{"naam": "REST API"}}
	if got := navigeerAfgeleidPadVlak(flat, "Naam.naam", meta); got != "REST API" {
		t.Errorf("Naam.naam via klassenaam: kreeg %q", got)
	}
	if got := navigeerAfgeleidPadVlak(flat, "ApiStandaardNamen.naam", meta); got != "REST API" {
		t.Errorf("via rolnaam: kreeg %q", got)
	}
	if got := berekenWeergavenaamVlak(flat, meta); got != "REST API" {
		t.Errorf("berekenWeergavenaamVlak: kreeg %q", got)
	}
	// Gemeente werkte al (rolnaam ≈ klassenaam) en moet blijven werken.
	gm, _ := model.MetaRegistry.GetTypeMeta("Gemeente")
	g := map[string]interface{}{"gemeentegegevens": map[string]interface{}{"naam": "Zeist", "code": "GM0355"}}
	if got := berekenWeergavenaamVlak(g, gm); got != "Zeist (GM0355)" {
		t.Errorf("Gemeente: kreeg %q", got)
	}
}
