package pep

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/toegang"
)

const testMap = "../testdata/toegang"

func bundel(t *testing.T, naam string) *toegang.Bundel {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(testMap, naam+".bundel.json"))
	if err != nil {
		t.Fatal(err)
	}
	b, err := toegang.LaadBundel(data)
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func voorbeeldRecord(t *testing.T) any {
	t.Helper()
	data, err := os.ReadFile(filepath.Join(testMap, "full-np-voorbeeld.json"))
	if err != nil {
		t.Fatal(err)
	}
	var r any
	if err := json.Unmarshal(data, &r); err != nil {
		t.Fatal(err)
	}
	return r
}

func verzoek(s toegang.Subject) toegang.Verzoek {
	return toegang.Verzoek{Subject: s, Handeling: "bekijken", Peilmoment: time.Date(2026, 10, 12, 0, 0, 0, 0, time.UTC)}
}

// paden geeft de veldpaden van de niet-technische bladeren in een (gesnoeid) record.
func paden(x any) []string {
	w := map[string][]any{}
	verzamel(x, "NatuurlijkPersoon", w)
	uit := make([]string, 0, len(w))
	for p := range w {
		uit = append(uit, p)
	}
	sort.Strings(uit)
	return uit
}

func TestAnoniemZietAlleenNamen(t *testing.T) {
	uit, zichtbaar := filterRecord(bundel(t, "openbaar"), verzoek(toegang.Subject{Anoniem: true}), "NatuurlijkPersoon", voorbeeldRecord(t), true)
	if !zichtbaar {
		t.Fatal("record hoort zichtbaar te blijven (namen zijn openbaar)")
	}
	want := []string{"NatuurlijkPersoon.namen.achternaam", "NatuurlijkPersoon.namen.roepnaam", "NatuurlijkPersoon.namen.voorletters"}
	if got := paden(uit); !reflect.DeepEqual(got, want) {
		t.Fatalf("anoniem ziet %v, verwacht %v", got, want)
	}
	m := uit.(map[string]any)
	if m["id"] == nil {
		t.Error("technisch veld id hoort mee te gaan met zichtbare inhoud")
	}
	if _, ok := m["persoonsidentificaties"]; ok {
		t.Error("persoonsidentificaties (bsn) mag anoniem niet zichtbaar zijn, ook niet als lege GE")
	}
	naam := m["namen"].([]any)[0].(map[string]any)
	if naam["rel_id"] == nil || naam["data"].([]any)[0].(map[string]any)["versie"] == nil {
		t.Error("technische velden van een zichtbare GE horen te blijven")
	}
}

func TestMedewerkerZietAllesBehalveBsn(t *testing.T) {
	s := toegang.Subject{Kenmerken: map[string][]string{"rol": {"medewerker"}}}
	uit, _ := filterRecord(bundel(t, "openbaar"), verzoek(s), "NatuurlijkPersoon", voorbeeldRecord(t), true)
	got := paden(uit)
	if contains(got, "NatuurlijkPersoon.persoonsidentificaties.bsn") {
		t.Fatal("bsn hoort verborgen te zijn (verbod)")
	}
	for _, p := range []string{"NatuurlijkPersoon.geslacht.geslacht", "NatuurlijkPersoon.persoonsidentificaties.ingezetene", "NatuurlijkPersoon.aanvang.datum", "NatuurlijkPersoon.weergavenaam"} {
		if !contains(got, p) {
			t.Errorf("medewerker hoort %s te zien; zag %v", p, got)
		}
	}
}

func TestVoorwaardeOverBetrokkeneGebruiktHetRecord(t *testing.T) {
	// "aanspreken zonder geslacht": een telefoonmedewerker ziet de aanspreektitel als die
	// bekend is (in het record); "geen geslacht aan de telefoon": geslacht verboden.
	s := toegang.Subject{Kenmerken: map[string][]string{"rol": {"medewerker"}, "kanaal": {"telefoon"}}}
	uit, zichtbaar := filterRecord(bundel(t, "np-loc-demo"), verzoek(s), "NatuurlijkPersoon", voorbeeldRecord(t), true)
	if !zichtbaar {
		t.Fatal("record hoort zichtbaar te zijn via de aanspreektitel")
	}
	want := []string{"NatuurlijkPersoon.aanspraak.aanspreektitel"}
	if got := paden(uit); !reflect.DeepEqual(got, want) {
		t.Fatalf("telefoonmedewerker ziet %v, verwacht %v", got, want)
	}
}

func TestNietsZichtbaarRecordValtWeg(t *testing.T) {
	_, zichtbaar := filterRecord(bundel(t, "np-loc-demo"), verzoek(toegang.Subject{Anoniem: true}), "NatuurlijkPersoon", voorbeeldRecord(t), false)
	if zichtbaar {
		t.Fatal("anoniem ziet in het np-loc-beleid niets; het record hoort weg te vallen")
	}
}

func TestKanIetsZien(t *testing.T) {
	m := time.Date(2026, 10, 12, 0, 0, 0, 0, time.UTC)
	anon := toegang.Subject{Anoniem: true}
	if !bundel(t, "openbaar").KanIetsZien(anon, "bekijken", "NatuurlijkPersoon", m) {
		t.Error("openbaar: anoniem kan namen zien")
	}
	if bundel(t, "np-loc-demo").KanIetsZien(anon, "bekijken", "NatuurlijkPersoon", m) {
		t.Error("np-loc-demo: anoniem kan niets zien (gate hoort 403 te geven)")
	}
	if !bundel(t, "openbaar").KanIetsZien(anon, "bekijken", "NatuurlijkPersoon.namen", m) {
		t.Error("openbaar: GE-pad onder een gedekt pad")
	}
	if bundel(t, "openbaar").KanIetsZien(anon, "bekijken", "NatuurlijkPersoon.persoonsidentificaties", m) {
		t.Error("openbaar: anoniem kan niets onder persoonsidentificaties zien")
	}
}

func TestPrefixUitMetaRegistry(t *testing.T) {
	gevallen := map[string]string{
		"NatuurlijkPersoon":           "NatuurlijkPersoon",
		"NatuurlijkPersoon_Naam":      "NatuurlijkPersoon.namen",
		"NatuurlijkPersoon_Naam_Data": "NatuurlijkPersoon.namen",
	}
	for typenaam, want := range gevallen {
		meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
		if !ok {
			t.Skipf("type %s staat niet in deze MetaRegistry", typenaam)
		}
		if got := Prefix(meta); got != want {
			t.Errorf("Prefix(%s) = %q, verwacht %q", typenaam, got, want)
		}
	}
}

func TestTechnischeSleutels(t *testing.T) {
	for _, k := range []string{"id", "rel_id", "versie", "opvoer", "afvoer", "natuurlijkpersoon_id", "Gemeente_ID"} {
		if !IsTechnisch(k) {
			t.Errorf("%s hoort technisch te zijn", k)
		}
	}
	for _, k := range []string{"achternaam", "data", "aanvang", "identiteit"} {
		if IsTechnisch(k) {
			t.Errorf("%s hoort geen technisch veld te zijn", k)
		}
	}
}

// Optioneel: een echte /full-respons filteren (PEP_LIVE_JSON=<bestand>, PEP_LIVE_BUNDEL=<naam>).
// Niet in CI; voor handmatige controle tegen een lokale API zonder een tweede instantie te starten.
func TestLiveRespons(t *testing.T) {
	bestand := os.Getenv("PEP_LIVE_JSON")
	if bestand == "" {
		t.Skip("PEP_LIVE_JSON niet gezet")
	}
	naam := os.Getenv("PEP_LIVE_BUNDEL")
	if naam == "" {
		naam = "openbaar"
	}
	data, err := os.ReadFile(bestand)
	if err != nil {
		t.Fatal(err)
	}
	var top map[string]any
	if err := json.Unmarshal(data, &top); err != nil {
		t.Fatal(err)
	}
	b := bundel(t, naam)
	for sleutel, v := range top {
		lijst, ok := v.([]any)
		if !ok {
			continue
		}
		for _, s := range []toegang.Subject{{Anoniem: true}, {Kenmerken: map[string][]string{"rol": {"medewerker"}}}} {
			zichtbaar := 0
			var voorbeeld []string
			for _, r := range lijst {
				if uit, z := filterRecord(b, verzoek(s), "NatuurlijkPersoon", r, true); z {
					zichtbaar++
					if voorbeeld == nil {
						voorbeeld = paden(uit)
					}
				}
			}
			t.Logf("%s, subject %+v: %d van %d records zichtbaar; paden in eerste: %v", sleutel, s, zichtbaar, len(lijst), voorbeeld)
		}
	}
}

func contains(l []string, s string) bool {
	for _, x := range l {
		if x == s {
			return true
		}
	}
	return false
}

// GraphQL snoeit na het flatten van hub+data: een enkelvoudige GE is dan een object zonder
// data-niveau. De paden blijven gelijk.
func TestSnoeiNaFlatten(t *testing.T) {
	geflattend := map[string]any{
		"id":                     float64(7),
		"weergavenaam":           "J. de Vries",
		"namen":                  map[string]any{"rel_id": float64(1), "voorletters": "J.", "achternaam": "Vries"},
		"persoonsidentificaties": map[string]any{"rel_id": float64(1), "bsn": "000000000"},
		"burgerschappen": []any{
			map[string]any{"rel_id": float64(1), "nationaliteit": "NL"},
		},
	}
	uit, zichtbaar := filterRecord(bundel(t, "openbaar"), verzoek(toegang.Subject{Anoniem: true}), "NatuurlijkPersoon", geflattend, true)
	if !zichtbaar {
		t.Fatal("namen zijn openbaar")
	}
	m := uit.(map[string]any)
	if _, ok := m["persoonsidentificaties"]; ok {
		t.Error("bsn-GE hoort weg te zijn")
	}
	if _, ok := m["burgerschappen"]; ok {
		t.Error("burgerschappen horen weg te zijn")
	}
	if _, ok := m["weergavenaam"]; ok {
		t.Error("weergavenaam van de entiteit valt niet onder de namen-regel")
	}
	namen := m["namen"].(map[string]any)
	if namen["achternaam"] != "Vries" || namen["rel_id"] == nil {
		t.Errorf("namen-object hoort te blijven met technische sleutel: %#v", namen)
	}
}
