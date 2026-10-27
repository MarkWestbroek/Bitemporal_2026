package main

import (
	"go/format"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Tijdprecisie (27-10-2026, besluit Mark): V3 `tijdprecisie: "tijdstip"` op een materieel GE,
// relatie of entiteit maakt aanvang/einde een time.Time (kolom timestamptz) in plaats van een
// Date; "datum" of leeg blijft Date.
func tijdprecisieTestModel() model.V3Model {
	return model.V3Model{
		Versie: "v3",
		Entiteiten: []model.V3Entiteit{
			{
				Typenaam: "Zaak", Meervoud: "zaken", Domein: "proef", IsMaterieel: true, Tijdprecisie: "tijdstip",
				Gegevenselementen: []model.V3Gegevenselement{
					{Naam: "ZaakStatus", Meervoud: "zaak_statussen", Momentvoorkomen: "enkelvoudig", IsMaterieel: true, Tijdprecisie: "tijdstip",
						Velden: []model.V3Veld{{Naam: "status", GoType: "string"}}},
					{Naam: "ZaakNaam", Meervoud: "zaak_namen", Momentvoorkomen: "enkelvoudig", IsMaterieel: true,
						Velden: []model.V3Veld{{Naam: "naam", GoType: "string"}}},
				},
				Relaties: []model.V3Relatie{{Naam: "ZaakBehandelaar", Meervoud: "zaak_behandelaars", Momentvoorkomen: "enkelvoudig",
					IsMaterieel: true, Tijdprecisie: "tijdstip", DoelEntiteit: "Medewerker"}},
			},
			{Typenaam: "Medewerker", Meervoud: "medewerkers", Domein: "proef"},
		},
	}
}

func TestTijdprecisie_StructsInputRegistry(t *testing.T) {
	v3 := tijdprecisieTestModel()
	geRel, err := generateGeRelWithOpts(v3, codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := format.Source([]byte(geRel)); err != nil {
		t.Fatalf("ge_rel geen geldige Go: %v", err)
	}
	// Tijdstip: time.Time + timestamptz; datum (default): Date + date.
	for _, want := range []string{
		"type Zaak_ZaakStatus_Aanvang struct",
		"Datum *time.Time `json:\"datum,omitempty\" bun:\"datum,type:timestamptz\"`",
		"type ZaakBehandelaar_Einde struct",
	} {
		if !strings.Contains(geRel, want) {
			t.Errorf("ge_rel mist %q", want)
		}
	}
	statusDeel := geRel[strings.Index(geRel, "type Zaak_ZaakStatus_Aanvang struct"):]
	statusDeel = statusDeel[:strings.Index(statusDeel, "}")]
	if strings.Contains(statusDeel, "*Date") {
		t.Errorf("ZaakStatus_Aanvang hoort time.Time te hebben, geen Date:\n%s", statusDeel)
	}
	naamDeel := geRel[strings.Index(geRel, "type Zaak_ZaakNaam_Aanvang struct"):]
	naamDeel = naamDeel[:strings.Index(naamDeel, "}")]
	if !strings.Contains(naamDeel, "Datum *Date `json:\"datum,omitempty\" bun:\"datum,type:date\"`") {
		t.Errorf("ZaakNaam_Aanvang (default datum) hoort Date te houden:\n%s", naamDeel)
	}

	ent, err := generateEntiteitenWithOpts(v3, codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ent, "type Zaak_Aanvang struct") || !strings.Contains(ent, "bun:\"datum,type:timestamptz\"") {
		t.Errorf("entiteit-niveau aanvang hoort timestamptz te zijn")
	}

	input, err := generateInputWithOpts(v3, codegenOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(input, "Aanvang *time.Time `json:\"aanvang,omitempty\"`") || !strings.Contains(input, "import \"time\"") {
		t.Errorf("_Input van ZaakStatus hoort Aanvang *time.Time (met time-import) te hebben")
	}
	if !strings.Contains(input, "Aanvang *Date `json:\"aanvang,omitempty\"`") {
		t.Errorf("_Input van ZaakNaam hoort Aanvang *Date te houden")
	}

	reg, err := generateMetaRegistry(v3, codegenOptions{domein: "proef", prefix: "proef"})
	if err != nil {
		t.Fatal(err)
	}
	if n := strings.Count(reg, "Tijdprecisie: TijdprecisieTijdstip,"); n != 3+2+2+2 {
		// Zaak, ZaakStatus-hub, ZaakBehandelaar-hub + hun _Aanvang/_Einde (2 per type)
		t.Errorf("verwacht 9× Tijdprecisie in de registry, kreeg %d", n)
	}
	naamEntry := reg[strings.Index(reg, `"Zaak_ZaakNaam": {`):]
	naamEntry = naamEntry[:strings.Index(naamEntry, "\n\t},")]
	if strings.Contains(naamEntry, "Tijdprecisie") {
		t.Errorf("ZaakNaam (datum) hoort geen Tijdprecisie te krijgen")
	}
}

func TestTijdprecisie_Validatie(t *testing.T) {
	v3 := tijdprecisieTestModel()
	if errs := validateV3Model(v3, ""); len(errs) != 0 {
		t.Fatalf("geldig model geeft fouten: %v", errs)
	}
	v3.Entiteiten[0].Gegevenselementen[0].Tijdprecisie = "uur"
	errs := validateV3Model(v3, "")
	if len(errs) != 1 || !strings.Contains(errs[0], "tijdprecisie 'uur' is ongeldig") {
		t.Errorf("ongeldige waarde: %v", errs)
	}
	v3.Entiteiten[0].Gegevenselementen[0].Tijdprecisie = "tijdstip"
	v3.Entiteiten[0].Gegevenselementen[0].IsMaterieel = false
	errs = validateV3Model(v3, "")
	if len(errs) != 1 || !strings.Contains(errs[0], "alleen betekenis met isMaterieel") {
		t.Errorf("tijdprecisie zonder materieel: %v", errs)
	}
}
