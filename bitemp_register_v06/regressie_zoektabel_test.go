//go:build integration

package main

// regressie_zoektabel_test.go — bewijst dat een lijst via een zoektabel (dynql/zoektabel.go)
// hetzelfde antwoord geeft als de gewone weg, ook nadat er geregistreerd, afgevoerd en
// ongedaan gemaakt is, en op een peiltijdstip.
//
// De test seedt np-loc, geeft één locatie meerdere bewoners, registreert een ZoekDefinitie
// (personen binnen een locatie, op achternaam) en wacht tot de zoektabel gevuld is. Daarna
// draait hij na elke wijziging dezelfde reeks lijstvragen twee keer: met de noodrem (gewone
// weg) en zonder. De antwoorden moeten letterlijk gelijk zijn, en de vragen zonder noodrem
// moeten echt uit de zoektabel komen.
//
// Draait alleen met REGRESSIE_DATABASE_URL (een eigen database; de test leegt hem).

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
)

func TestZoektabel(t *testing.T) {
	if strings.TrimSpace(os.Getenv("REGRESSIE_DATABASE_URL")) == "" {
		t.Skip("REGRESSIE_DATABASE_URL niet gezet; test overgeslagen")
	}
	o := nieuweRegressieOmgeving(t)
	o.seedViaReplay()
	defer dynql.ZetKlassiekLaden(false)
	ctx := context.Background()

	// Resten van een vorige run: de standtabel en de zoektabellen vallen buiten DeleteTables.
	var oud []string
	_ = o.db.NewRaw("SELECT tabel FROM zoektabel_stand").Scan(ctx, &oud)
	for _, tabel := range oud {
		if _, err := o.db.ExecContext(ctx, "DROP TABLE IF EXISTS \""+tabel+"\""); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := o.db.ExecContext(ctx, "DELETE FROM zoektabel_stand"); err != nil {
		t.Fatalf("standtabel ontbreekt (StartZoektabellen niet gelopen?): %v", err)
	}

	registreer := func(naam string, body string) int64 {
		t.Helper()
		status, antwoord, raw := o.do("POST", "/registratie/", []byte(body))
		if status != 201 {
			t.Fatalf("%s: status %d: %s", naam, status, kort(raw))
		}
		id, _ := antwoord["registratie_id"].(float64)
		return int64(id)
	}
	stand := func() string {
		var s []string
		_ = o.db.NewRaw("SELECT status || COALESCE(' (' || melding || ')', '') FROM zoektabel_stand ORDER BY tabel").Scan(ctx, &s)
		return strings.Join(s, "; ")
	}
	wachtOp := func(wat string) {
		t.Helper()
		grens := time.Now().Add(20 * time.Second)
		for time.Now().Before(grens) {
			regels, err := dynql.StemZoektabellenAf(ctx)
			if err != nil {
				t.Fatal(err)
			}
			if stand() == wat {
				return
			}
			for _, r := range regels {
				if strings.Contains(r, "overgeslagen") || strings.Contains(r, "mislukt") {
					t.Fatalf("afstemmen: %s", r)
				}
			}
			time.Sleep(100 * time.Millisecond)
		}
		t.Fatalf("stand werd niet %q; nu: %q", wat, stand())
	}

	// Locatie 2 krijgt alle personen als bewoner; persoon 3 twee keer (twee voorkomens naar
	// hetzelfde doel: de zoektabel moet ontdubbelen). Persoon 9201 heeft geen naam.
	registreer("extra bewoners", `{"registratie": {"registratietype": "registratie"}, "wijzigingen": [
		{"opvoer": {"natuurlijkpersoon": {"id": 9201}}},
		{"opvoer": {"bereikbaarheid": {"natuurlijkpersoon_id": 9201, "locatie_id": 2, "soort": "Woonadres", "aanvang": "2024-01-01"}}},
		{"opvoer": {"bereikbaarheid": {"natuurlijkpersoon_id": 3, "locatie_id": 2, "soort": "Woonadres", "aanvang": "2024-01-01"}}},
		{"opvoer": {"bereikbaarheid": {"natuurlijkpersoon_id": 3, "locatie_id": 2, "soort": "Briefadres", "aanvang": "2025-01-01"}}},
		{"opvoer": {"bereikbaarheid": {"natuurlijkpersoon_id": 4, "locatie_id": 2, "soort": "Woonadres", "aanvang": "2024-01-01"}}},
		{"opvoer": {"bereikbaarheid": {"natuurlijkpersoon_id": 5, "locatie_id": 2, "soort": "Woonadres", "aanvang": "2024-01-01"}}},
		{"opvoer": {"bereikbaarheid": {"natuurlijkpersoon_id": 6, "locatie_id": 2, "soort": "Woonadres", "aanvang": "2024-01-01"}}}
	]}`)

	const lijst = "natuurlijk_personen"
	docs := map[string]string{}
	for _, loc := range []int{2, 3, 999} {
		for _, af := range []bool{false, true} {
			args := fmt.Sprintf(`filter: { bereikbaarheden: { locatie_id: { eq: %d } } }, sorteer: [{ veld: "namen.achternaam", aflopend: %v }]`, loc, af)
			sleutel := fmt.Sprintf("loc%d/af=%v", loc, af)
			docs[sleutel+"/alles"] = fmt.Sprintf("{ r: %s(%s, limit: 100) { id } }", lijst, args)
			for offset := 0; offset < 8; offset += 2 {
				docs[fmt.Sprintf("%s/pagina-%d", sleutel, offset)] = fmt.Sprintf("{ r: %s(%s, limit: 3, offset: %d) { id } }", lijst, args, offset)
			}
			docs[sleutel+"/ver-voorbij"] = fmt.Sprintf("{ r: %s(%s, limit: 3, offset: 500) { id } }", lijst, args)
			docs[sleutel+"/full"] = fmt.Sprintf("{ r: full_%s_list(%s, limit: 4, offset: 1) { id } }", lijst, args)
		}
	}
	gql := func(q string) string {
		t.Helper()
		b, _ := json.Marshal(map[string]string{"query": q})
		status, body, raw := o.do("POST", "/graphql/query", b)
		if status != 200 || body["errors"] != nil {
			t.Fatalf("status %d op %s: %s", status, kort([]byte(q)), kort(raw))
		}
		j, _ := json.Marshal(body["data"])
		return string(j)
	}
	// vergelijk draait elke vraag via de gewone weg en via de zoektabel. peil != "": dezelfde
	// vragen op dat peiltijdstip.
	vergelijk := func(fase, peil string) {
		t.Helper()
		verschillen, nietLeeg := 0, 0
		voor := dynql.ZoektabelLezingen()
		for sleutel, doc := range docs {
			if peil != "" {
				doc = strings.Replace(doc, "(filter:", fmt.Sprintf("(peiltijdstip: %q, filter:", peil), 1)
			}
			dynql.ZetKlassiekLaden(true)
			gewoon := gql(doc)
			dynql.ZetKlassiekLaden(false)
			zoek := gql(doc)
			if gewoon != zoek {
				verschillen++
				if verschillen <= 5 {
					t.Errorf("%s, %s verschilt:\n query:     %s\n gewoon:    %s\n zoektabel: %s", fase, sleutel, kort([]byte(doc)), gewoon, zoek)
				}
			}
			if strings.Contains(gewoon, `"id"`) {
				nietLeeg++
			}
		}
		gebruikt := dynql.ZoektabelLezingen() - voor
		t.Logf("%s (peil %q): %d vragen, %d met rijen, %d via de zoektabel, %d verschillen", fase, peil, len(docs), nietLeeg, gebruikt, verschillen)
		if gebruikt < int64(len(docs)) {
			t.Errorf("%s: maar %d van de %d vragen gingen via de zoektabel", fase, gebruikt, len(docs))
		}
		if nietLeeg == 0 {
			t.Errorf("%s: geen enkele vraag gaf rijen: de test dekt niets", fase)
		}
	}

	// De zoekdefinitie: registerdata in het configuratiedomein.
	registreer("zoekdefinitie", `{"registratie": {"registratietype": "registratie"}, "wijzigingen": [
		{"opvoer": {"zoekdefinitie": {"id": 1, "aanvang": "2020-01-01"}}},
		{"opvoer": {"zoekdefinitienaam": {"zoekdefinitie_id": 1, "naam": "personen-per-locatie-op-achternaam"}}},
		{"opvoer": {"zoekdefinitiepad": {"zoekdefinitie_id": 1, "binnen": "NatuurlijkPersoon.bereikbaarheden", "sorteerveld": "NatuurlijkPersoon.namen.achternaam"}}},
		{"opvoer": {"zoekdefinitiestatus": {"zoekdefinitie_id": 1, "status": "actief", "aanvang": "2020-01-01"}}}
	]}`)
	wachtOp("gevuld")
	vergelijk("na het vullen", "")
	// Het peiltijdstip van vóór de wijzigingen hieronder: het tijdstip van de laatste
	// registratie tot nu toe (de registratietijd is in deze suite synthetisch, niet de klok).
	var laatste time.Time
	if err := o.db.NewRaw("SELECT max(tijdstip) FROM registratie").Scan(ctx, &laatste); err != nil {
		t.Fatal(err)
	}
	peilVoor := laatste.UTC().Format(time.RFC3339Nano)

	// Wijzigingen op elk van de drie bronnen; na elke wijziging opnieuw vergelijken.
	regNaam := registreer("naam wijzigen (GE)", `{"registratie": {"registratietype": "registratie"}, "wijzigingen": [
		{"opvoer": {"naam": {"natuurlijkpersoon_id": 4, "voorletters": "A.", "roepnaam": "Aad", "achternaam": "Aaaa"}}}]}`)
	vergelijk("na een nieuwe naam", "")

	registreer("naam voor de naamloze (GE)", `{"registratie": {"registratietype": "registratie"}, "wijzigingen": [
		{"opvoer": {"naam": {"natuurlijkpersoon_id": 9201, "voorletters": "Z.", "roepnaam": "Zed", "achternaam": "Zzzz"}}}]}`)
	vergelijk("na een eerste naam", "")

	registreer("nieuwe bewoner (relatie)", `{"registratie": {"registratietype": "registratie"}, "wijzigingen": [
		{"opvoer": {"bereikbaarheid": {"natuurlijkpersoon_id": 2, "locatie_id": 3, "soort": "Briefadres", "aanvang": "2025-06-01"}}}]}`)
	vergelijk("na een nieuwe relatie", "")

	registreer("ongedaan maken van de naamswijziging", fmt.Sprintf(`{"registratie": {"registratietype": "ongedaanmaking", "maakt_ongedaan_registratie_id": %d}}`, regNaam))
	vergelijk("na een ongedaanmaking", "")

	status, _, raw := o.do("DELETE", "/natuurlijk_personen/6", nil)
	if status >= 300 {
		t.Fatalf("persoon afvoeren: status %d: %s", status, kort(raw))
	}
	vergelijk("na het afvoeren van een entiteit", "")
	vergelijk("op het peiltijdstip van voor de wijzigingen", peilVoor)

	// Herbouwbaar: leegmaken en opnieuw vullen geeft dezelfde rijen.
	var tabel string
	if err := o.db.NewRaw("SELECT tabel FROM zoektabel_stand").Scan(ctx, &tabel); err != nil {
		t.Fatal(err)
	}
	inhoud := func() string {
		var s []string
		if err := o.db.NewRaw("SELECT concat_ws('|', doel_id, waarde, entiteit_id, rel_id, opvoer, afvoer) FROM \""+tabel+"\" ORDER BY 1").Scan(ctx, &s); err != nil {
			t.Fatal(err)
		}
		return strings.Join(s, "\n")
	}
	voorHerbouw := inhoud()
	if _, err := o.db.ExecContext(ctx, "TRUNCATE \""+tabel+"\""); err != nil {
		t.Fatal(err)
	}
	if _, err := o.db.ExecContext(ctx, "UPDATE zoektabel_stand SET status = 'fout', melding = 'test'"); err != nil {
		t.Fatal(err)
	}
	wachtOp("gevuld")
	if na := inhoud(); na != voorHerbouw {
		t.Errorf("na opnieuw vullen andere inhoud:\nvoor:\n%s\nna:\n%s", voorHerbouw, na)
	}
	t.Logf("zoektabel %s: %d rijen", tabel, strings.Count(voorHerbouw, "\n")+1)

	// Intrekken: de definitie afvoeren; de zoektabel faseert uit en wordt daarna opgeruimd.
	status, _, raw = o.do("DELETE", "/zoek_definities/1", nil)
	if status >= 300 {
		t.Fatalf("zoekdefinitie afvoeren: status %d: %s", status, kort(raw))
	}
	wachtOp("uitfaseren (geen actieve zoekdefinitie meer)")
	voor := dynql.ZoektabelLezingen()
	gql(docs["loc2/af=false/alles"])
	if dynql.ZoektabelLezingen() != voor {
		t.Errorf("een uitfaserende zoektabel wordt nog gelezen")
	}
	dynql.ZoekUitfaseerTijd = 0
	defer func() { dynql.ZoekUitfaseerTijd = 5 * time.Minute }()
	wachtOp("")
	var bestaat bool
	if err := o.db.NewRaw("SELECT to_regclass(?) IS NOT NULL", "\""+tabel+"\"").Scan(ctx, &bestaat); err != nil || bestaat {
		t.Errorf("zoektabel %s is niet opgeruimd (bestaat=%v, err=%v)", tabel, bestaat, err)
	}
}
