package dbsetup

import (
	"strings"
	"testing"
)

func TestModelIndexDefinities_DoelEnUniek(t *testing.T) {
	defs := ModelIndexDefinities()
	if len(defs) == 0 {
		t.Fatal("geen indexdefinities uit de MetaRegistry")
	}
	perNaam := map[string]IndexDefinitie{}
	soorten := map[string]int{}
	for _, d := range defs {
		if len(d.Naam) > 63 {
			t.Errorf("indexnaam langer dan 63 tekens: %s", d.Naam)
		}
		if _, dubbel := perNaam[d.Naam]; dubbel {
			t.Errorf("dubbele indexnaam: %s", d.Naam)
		}
		perNaam[d.Naam] = d
		soorten[d.Soort]++
	}
	if soorten["doel"] == 0 || soorten["uniek"] == 0 {
		t.Fatalf("verwacht beide soorten, kreeg %v", soorten)
	}

	// Relatie MeldingBehandelaar (Melding → Gebruiker): index op de doelkant, bron erachter.
	doel, ok := perNaam["ix_meldingbehandelaar_gebruiker_id_doel"]
	if !ok {
		t.Fatalf("index op de doelkant van MeldingBehandelaar ontbreekt; namen: %v", namen(defs, "doel"))
	}
	if got := doel.SQL(false); got != `CREATE INDEX IF NOT EXISTS "ix_meldingbehandelaar_gebruiker_id_doel" ON "meldingbehandelaar" ("gebruiker_id", "melding_id")` {
		t.Errorf("onverwachte SQL: %s", got)
	}

	// Elk uniek veld: een index op de kolom, niet partieel (anders mag het lijstfilter hem niet
	// gebruiken), onder de naam van de zoeksleutel; hij vervangt de oude partiële _uniek-index.
	for _, d := range defs {
		if d.Soort != "uniek" {
			continue
		}
		sql := d.SQL(true)
		if !strings.HasPrefix(sql, "CREATE INDEX CONCURRENTLY IF NOT EXISTS ") || strings.Contains(sql, " WHERE ") {
			t.Errorf("onverwachte SQL voor uniek veld: %s", sql)
		}
		if !strings.HasSuffix(d.Naam, "_zoek") && len(d.Naam) < 63 {
			t.Errorf("uniek veld hoort de naam van een zoeksleutel te hebben: %s", d.Naam)
		}
		if d.Vervangt == "" || d.Vervangt == d.Naam {
			t.Errorf("uniek veld hoort de oude index te vervangen: %+v", d)
		}
	}
}

func TestIndexNaam_KortLangeNamenIn(t *testing.T) {
	lang := strings.Repeat("x", 80)
	a, b := indexNaam(lang, "kolom_a", "doel"), indexNaam(lang, "kolom_b", "doel")
	if len(a) != 63 || len(b) != 63 {
		t.Fatalf("lengte %d en %d, verwacht 63", len(a), len(b))
	}
	if a == b {
		t.Fatal("twee verschillende lange namen vallen samen")
	}
}

func namen(defs []IndexDefinitie, soort string) []string {
	var uit []string
	for _, d := range defs {
		if d.Soort == soort {
			uit = append(uit, d.Naam)
		}
	}
	return uit
}
