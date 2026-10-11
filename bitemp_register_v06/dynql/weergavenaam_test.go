package dynql

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// De afleidingsregel van ApiStandaard.weergavenaam is "Naam.naam": het segment "Naam" is
// de klassenaam van het GE, niet de rolnaam ("ApiStandaardNamen"). Vóór 24-09-2026 bleef
// de weergavenaam daardoor leeg. Sinds 11-10-2026 rekent de gedeelde evaluator (afleiding)
// dit uit; deze test bewaakt dat hij de platte GraphQL-vorm net zo leest.
func TestWeergavenaam_PadSegmentOpKlassenaam(t *testing.T) {
	meta, ok := model.MetaRegistry.GetTypeMeta("ApiStandaard")
	if !ok {
		t.Skip("CG-model niet geregistreerd")
	}
	flat := map[string]interface{}{"id": float64(2), "api_standaard_namen": map[string]interface{}{"naam": "REST API"}}
	for _, regel := range []string{"Naam.naam", "ApiStandaardNamen.naam"} {
		meta2 := meta
		meta2.AfgeleideVelden = []model.AfgeleidVeld{{Naam: "x", IsWeergaveVeld: true, Afleidingsregel: regel}}
		if got := berekenWeergavenaamVlak(flat, meta2); got != "REST API" {
			t.Errorf("%s: kreeg %q", regel, got)
		}
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
