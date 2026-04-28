package handlers

import (
	"encoding/json"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Tests voor de registratie-normalizer (Fase 1: geneste full-payload).
// Gebruikt het simpele ABUVWXY-referentiemodel:
//   A heeft onderliggende GE's: us (A_U enkelvoudig), vs (A_V meervoudig),
//                                ws (A_W meervoudig), aanvang (A_Aanvang),
//                                einde (A_Einde), rel_a_bs (Rel_A_B meervoudig).
//   A_U heeft onderliggend: data (A_U_Data enkelvoudig).

// helperParseWijzigingJSON unmarshalt een JSON-string als WijzigingRequest
// (de RepresentatiePlusNaam.UnmarshalJSON capture't dan ook RawPayload).
func helperParseWijzigingJSON(t *testing.T, payload string) model.WijzigingRequest {
	t.Helper()
	var w model.WijzigingRequest
	if err := json.Unmarshal([]byte(payload), &w); err != nil {
		t.Fatalf("unmarshal wijziging mislukt: %v", err)
	}
	return w
}

// TestNormaliseer_VlakkeWijziging_BlijftOngewijzigd: een wijziging zónder
// onderliggende geneste velden moet één-op-één doorgegeven worden.
func TestNormaliseer_VlakkeWijziging_BlijftOngewijzigd(t *testing.T) {
	w := helperParseWijzigingJSON(t, `{
		"opvoer": { "a": { "id": 1 } }
	}`)

	out, err := NormaliseerWijziging(w)
	if err != nil {
		t.Fatalf("normaliseer mislukt: %v", err)
	}
	if len(out) != 1 {
		t.Fatalf("verwacht 1 wijziging, kreeg %d", len(out))
	}
	if out[0].Opvoer == nil || out[0].Opvoer.Representatienaam != "A" {
		t.Fatalf("verwacht behoud van top-level A; kreeg %+v", out[0].Opvoer)
	}
}

// TestNormaliseer_GenesteOpvoer_SplittsNaarPlatteWijzigingen: één geneste A
// met us, vs[2], aanvang en einde moet 5 platte wijzigingen opleveren in
// volgorde A → A_U → A_V → A_V → A_Aanvang → A_Einde.
func TestNormaliseer_GenesteOpvoer_SplittsNaarPlatteWijzigingen(t *testing.T) {
	w := helperParseWijzigingJSON(t, `{
		"opvoer": {
			"a": {
				"id": 1,
				"us": { "a_id": 1 },
				"vs": [ { "a_id": 1 }, { "a_id": 1 } ],
				"aanvang": { "a_id": 1, "datum": "2026-01-01" },
				"einde":   { "a_id": 1, "datum": "2099-12-31" }
			}
		}
	}`)

	out, err := NormaliseerWijziging(w)
	if err != nil {
		t.Fatalf("normaliseer mislukt: %v", err)
	}

	// 1 A + 1 A_U + 2 A_V + 1 A_Aanvang + 1 A_Einde = 6
	if len(out) != 6 {
		var typen []string
		for _, w := range out {
			if w.Opvoer != nil {
				typen = append(typen, w.Opvoer.Representatienaam)
			}
		}
		t.Fatalf("verwacht 6 wijzigingen, kreeg %d (%v)", len(out), typen)
	}

	wantTypen := []string{"A", "A_U", "A_V", "A_V", "A_Aanvang", "A_Einde"}
	for i, want := range wantTypen {
		if out[i].Opvoer == nil {
			t.Fatalf("wijziging[%d] mist opvoer", i)
		}
		if out[i].Opvoer.Representatienaam != want {
			t.Errorf("wijziging[%d]: verwacht type %s, kreeg %s", i, want, out[i].Opvoer.Representatienaam)
		}
	}

	// Het top-level A-record mag geen geneste keys meer in zijn RawPayload hebben.
	var topMap map[string]json.RawMessage
	if err := json.Unmarshal(out[0].Opvoer.RawPayload, &topMap); err != nil {
		t.Fatalf("top-level RawPayload niet als object te lezen: %v", err)
	}
	for _, verboden := range []string{"us", "vs", "aanvang", "einde"} {
		if _, present := topMap[verboden]; present {
			t.Errorf("top-level A bevat nog kind-key '%s' na normaliseren", verboden)
		}
	}
}

// TestNormaliseer_OnbekendDoeltype_GeeftFout: een onbekend kind-doeltype
// moet een duidelijke fout opleveren.
func TestNormaliseer_GenesteAfvoer_SplittsOok(t *testing.T) {
	w := helperParseWijzigingJSON(t, `{
		"afvoer": {
			"a": {
				"id": 1,
				"us": { "a_id": 1 }
			}
		}
	}`)

	out, err := NormaliseerWijziging(w)
	if err != nil {
		t.Fatalf("normaliseer mislukt: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("verwacht 2 wijzigingen, kreeg %d", len(out))
	}
	if out[0].Afvoer == nil || out[0].Afvoer.Representatienaam != "A" {
		t.Fatalf("verwacht A-afvoer eerst, kreeg %+v", out[0])
	}
	if out[1].Afvoer == nil || out[1].Afvoer.Representatienaam != "A_U" {
		t.Fatalf("verwacht A_U-afvoer, kreeg %+v", out[1])
	}
}

// TestNormaliseerWijzigingen_LijstAggregatie verifieert dat
// NormaliseerWijzigingen meerdere wijzigingen samenvoegt en doorbouwt
// (gemixt: één geneste, één al plat).
func TestNormaliseerWijzigingen_LijstAggregatie(t *testing.T) {
	w1 := helperParseWijzigingJSON(t, `{
		"opvoer": { "a": { "id": 1, "us": { "a_id": 1 } } }
	}`)
	w2 := helperParseWijzigingJSON(t, `{
		"opvoer": { "b": { "id": 2 } }
	}`)

	out, err := NormaliseerWijzigingen([]model.WijzigingRequest{w1, w2})
	if err != nil {
		t.Fatalf("normaliseer mislukt: %v", err)
	}
	// w1 → 2 wijzigingen (A + A_U), w2 → 1 wijziging (B). Totaal 3.
	if len(out) != 3 {
		var typen []string
		for _, w := range out {
			if w.Opvoer != nil {
				typen = append(typen, w.Opvoer.Representatienaam)
			}
		}
		t.Fatalf("verwacht 3 wijzigingen, kreeg %d (%v)", len(out), typen)
	}
	wantTypen := []string{"A", "A_U", "B"}
	for i, want := range wantTypen {
		if out[i].Opvoer.Representatienaam != want {
			t.Errorf("wijziging[%d]: verwacht %s, kreeg %s", i, want, out[i].Opvoer.Representatienaam)
		}
	}
}
