// Tests voor BouwWijzigingen (PATCH wijziging-builder).
//
// Gebruikt het echte NatuurlijkPersoon-type uit de MetaRegistry zodat
// de UnmarshalJSON-flow realistisch is en de hybride wrapper-detectie
// (variant A mét, B zonder) wordt afgedekt.
package handlers

import (
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func npMeta(t *testing.T) model.TypeMeta {
	t.Helper()
	meta, ok := model.MetaRegistry.GetTypeMeta("NatuurlijkPersoon")
	if !ok {
		t.Fatalf("NatuurlijkPersoon ontbreekt in MetaRegistry — test-setup faalt")
	}
	return meta
}

func TestBouwWijzigingen_VariantBZonderWrapperWordtGeaccepteerd(t *testing.T) {
	res, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"namen": {"voornaam": "Jan-Piet", "achternaam": "De Vries"}}`),
		Modus: PatchModusRegistratie,
	})
	if rerr != nil {
		t.Fatalf("onverwachte fout: %+v", rerr)
	}
	if len(res.Wijzigingen) != 1 {
		t.Fatalf("verwacht 1 wijziging, kreeg %d", len(res.Wijzigingen))
	}
	if res.Wijzigingen[0].Opvoer == nil {
		t.Fatalf("verwacht Opvoer, kreeg %+v", res.Wijzigingen[0])
	}
	// Type-disambiguatie is een verantwoordelijkheid van GetByVeldnaamMetPayload —
	// hier checken we alleen dat een _Naam-type is gekozen.
	if !strings.Contains(res.Wijzigingen[0].Opvoer.Representatienaam, "Naam") {
		t.Fatalf("verwacht een Naam-type, kreeg %s", res.Wijzigingen[0].Opvoer.Representatienaam)
	}
}

func TestBouwWijzigingen_VariantAMetWrapperWordtGeaccepteerd(t *testing.T) {
	res, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"natuurlijkpersoon": {"namen": {"voornaam": "Jan"}}}`),
		Modus: PatchModusRegistratie,
	})
	if rerr != nil {
		t.Fatalf("onverwachte fout: %+v", rerr)
	}
	if len(res.Wijzigingen) != 1 {
		t.Fatalf("verwacht 1 wijziging, kreeg %d", len(res.Wijzigingen))
	}
}

func TestBouwWijzigingen_IDMismatchGeeft409(t *testing.T) {
	_, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"id": 99, "namen": {"voornaam": "X"}}`),
		Modus: PatchModusRegistratie,
	})
	if rerr == nil || rerr.Status != 409 {
		t.Fatalf("verwacht 409, kreeg %+v", rerr)
	}
}

func TestBouwWijzigingen_VerbodenENTVeldGeeft400(t *testing.T) {
	_, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"weergavenaam": "Iets"}`),
		Modus: PatchModusRegistratie,
	})
	if rerr == nil || rerr.Status != 400 {
		t.Fatalf("verwacht 400, kreeg %+v", rerr)
	}
	if !strings.Contains(rerr.Msg, "weergavenaam") {
		t.Fatalf("verwacht foutboodschap met 'weergavenaam', kreeg %q", rerr.Msg)
	}
}

func TestBouwWijzigingen_LegeBodyGeeft400(t *testing.T) {
	_, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{}`),
		Modus: PatchModusRegistratie,
	})
	if rerr == nil || rerr.Status != 400 {
		t.Fatalf("verwacht 400 op lege body, kreeg %+v", rerr)
	}
}

func TestBouwWijzigingen_CorrectieZonderRelIDGeeft400(t *testing.T) {
	_, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"namen": {"voornaam": "Jan"}}`),
		Modus: PatchModusCorrectie,
	})
	if rerr == nil || rerr.Status != 400 {
		t.Fatalf("verwacht 400, kreeg %+v", rerr)
	}
	if !strings.Contains(rerr.Msg, "rel_id") {
		t.Fatalf("verwacht foutboodschap met 'rel_id', kreeg %q", rerr.Msg)
	}
}

func TestBouwWijzigingen_CorrectieMetRelIDGeeftAfvoerEnOpvoer(t *testing.T) {
	res, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"namen": {"rel_id": 7, "voornaam": "Jan-Piet"}}`),
		Modus: PatchModusCorrectie,
	})
	if rerr != nil {
		t.Fatalf("onverwachte fout: %+v", rerr)
	}
	if len(res.Wijzigingen) != 2 {
		t.Fatalf("verwacht 2 wijzigingen (afvoer+opvoer), kreeg %d", len(res.Wijzigingen))
	}
	if res.Wijzigingen[0].Afvoer == nil {
		t.Fatalf("eerste wijziging moet Afvoer zijn, kreeg %+v", res.Wijzigingen[0])
	}
	if res.Wijzigingen[1].Opvoer == nil {
		t.Fatalf("tweede wijziging moet Opvoer zijn, kreeg %+v", res.Wijzigingen[1])
	}
}

func TestBouwWijzigingen_CorrectieRelIDZonderVeldenIsNoOpMetMelding(t *testing.T) {
	res, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"namen": [{"rel_id": 7, "voornaam": "Jan"}, {"rel_id": 13}]}`),
		Modus: PatchModusCorrectie,
	})
	if rerr != nil {
		t.Fatalf("onverwachte fout: %+v", rerr)
	}
	// Eerste item (rel_id=7) → 2 wijzigingen (afvoer+opvoer); tweede (rel_id=13) → 0 + melding.
	if len(res.Wijzigingen) != 2 {
		t.Fatalf("verwacht 2 wijzigingen, kreeg %d", len(res.Wijzigingen))
	}
	if len(res.Meldingen) == 0 {
		t.Fatalf("verwacht een melding voor no-op rel_id=13")
	}
	gevonden := false
	for _, m := range res.Meldingen {
		if strings.Contains(m, "13") && strings.Contains(m, "overgeslagen") {
			gevonden = true
		}
	}
	if !gevonden {
		t.Fatalf("verwacht melding met rel_id=13 + 'overgeslagen', kreeg %v", res.Meldingen)
	}
}

func TestBouwWijzigingen_RegistratieMetRelIDGeeftMeldingEnNegeert(t *testing.T) {
	res, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"namen": {"rel_id": 99, "voornaam": "Jan"}}`),
		Modus: PatchModusRegistratie,
	})
	if rerr != nil {
		t.Fatalf("onverwachte fout: %+v", rerr)
	}
	if len(res.Meldingen) == 0 {
		t.Fatalf("verwacht melding over genegeerde rel_id")
	}
	if len(res.Wijzigingen) != 1 || res.Wijzigingen[0].Opvoer == nil {
		t.Fatalf("verwacht 1 Opvoer, kreeg %+v", res.Wijzigingen)
	}
}

func TestBouwWijzigingen_OnbekendeModusGeeft400(t *testing.T) {
	_, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"namen": {"voornaam": "Jan"}}`),
		Modus: PatchModus("delete"),
	})
	if rerr == nil || rerr.Status != 400 {
		t.Fatalf("verwacht 400, kreeg %+v", rerr)
	}
}

func TestBouwWijzigingen_OngeldigeJSONGeeft400(t *testing.T) {
	_, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{kapot`),
		Modus: PatchModusRegistratie,
	})
	if rerr == nil || rerr.Status != 400 {
		t.Fatalf("verwacht 400, kreeg %+v", rerr)
	}
}

func TestBouwWijzigingen_ArrayMeervoudigeRol(t *testing.T) {
	res, rerr := BouwWijzigingen(BouwWijzigingenInput{
		Meta:  npMeta(t),
		URLID: "42",
		Body:  []byte(`{"namen": [{"voornaam": "A"}, {"voornaam": "B"}]}`),
		Modus: PatchModusRegistratie,
	})
	if rerr != nil {
		t.Fatalf("onverwachte fout: %+v", rerr)
	}
	if len(res.Wijzigingen) != 2 {
		t.Fatalf("verwacht 2 wijzigingen, kreeg %d", len(res.Wijzigingen))
	}
}
