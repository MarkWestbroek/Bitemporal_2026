//go:build integration

// regressie_afgeleide_relaties_test.go — afgeleide relaties (alleen lezen, geen tabel) end-to-end
// tegen de regressie-database (zie regressie_np_loc_test.go en scripts/regressie-np-loc.ps1):
//
//	go test -tags integration -run TestAfgeleideRelatiesNpLoc -v .
//
// De afgeleide relaties worden vóór het bouwen van de router op NatuurlijkPersoon gezet (de
// routes nemen een kopie van de TypeMeta). Seed: NP n woont via Bereikbaarheid (soort
// Woonadres) op Locatie n. Ontwerp: docs/plans/2026-10-11 Afgeleide relaties backend — ontwerp.md.
package main

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestAfgeleideRelatiesNpLoc(t *testing.T) {
	orig, ok := model.MetaRegistry["NatuurlijkPersoon"]
	if !ok {
		t.Skip("NatuurlijkPersoon niet in MetaRegistry")
	}
	t.Cleanup(func() { model.MetaRegistry["NatuurlijkPersoon"] = orig })
	metAfgeleid := orig
	metAfgeleid.AfgeleideRelaties = []model.AfgeleideRelatie{
		{
			Naam: "Woonadres", Rolnaam: "Woonadres", JSONRolnaam: "woonadres", DoelEntiteit: "Locatie",
			Momentvoorkomen: model.Enkelvoudig, AfleidingsregelTaal: "cel",
			Afleidingsregel: "bereikbaarheden.filter(b, b.soort == 'Woonadres')",
		},
		{
			// Doorkijk: van de bereikbaarheid naar Locatie (geladen in een tweede ronde), daar het
			// GE Adres en zijn locatie_id.
			Naam: "Adreslocatie", Rolnaam: "Adreslocatie", JSONRolnaam: "adreslocatie", DoelEntiteit: "Locatie",
			Momentvoorkomen: model.Enkelvoudig, AfleidingsregelTaal: "cel",
			Afleidingsregel: "bereikbaarheden.filter(b, b.soort == 'Woonadres').Adres.locatie_id",
		},
		{
			// Doorkijk naar Adres.gemeente ($ref Gemeente). De seed vult die niet (0): een lege
			// int-verwijzing levert geen doel, geen fout.
			Naam: "Woongemeente", Rolnaam: "Woongemeente", JSONRolnaam: "woongemeente", DoelEntiteit: "Gemeente",
			Momentvoorkomen: model.Enkelvoudig, AfleidingsregelTaal: "cel",
			Afleidingsregel: "bereikbaarheden.filter(b, b.soort == 'Woonadres').Adres.gemeente",
		},
	}
	model.MetaRegistry["NatuurlijkPersoon"] = metAfgeleid

	o := nieuweRegressieOmgeving(t)
	o.seedViaReplay()

	t.Run("full detail", func(t *testing.T) {
		status, body, raw := o.met(t).do("GET", "/full/natuurlijk_personen/2", nil)
		if status != 200 {
			t.Fatalf("status %d: %s", status, kort(raw))
		}
		woon, _ := body["woonadres"].([]any)
		if len(woon) != 1 {
			t.Fatalf("woonadres = %v, verwacht één locatie", body["woonadres"])
		}
		item := woon[0].(map[string]any)
		if item["locatie_id"] != 2.0 || item["weergavenaam"] == nil {
			t.Fatalf("woonadres[0] = %v, verwacht locatie_id 2 met weergavenaam", item)
		}
		adres, _ := body["adreslocatie"].([]any)
		if len(adres) != 1 || adres[0].(map[string]any)["locatie_id"] != 2.0 {
			t.Fatalf("adreslocatie = %v, verwacht locatie 2 (doorkijk via Locatie.Adres)", body["adreslocatie"])
		}
		if gem, ok := body["woongemeente"].([]any); !ok || len(gem) != 0 {
			t.Fatalf("woongemeente = %v, verwacht [] (gemeente 0 = lege verwijzing)", body["woongemeente"])
		}
		if _, ok := body["bereikbaarheden"]; !ok {
			t.Fatal("de gewone relatie bereikbaarheden ontbreekt")
		}
	})

	t.Run("full lijst: elke persoon zijn eigen locatie, queries per hop", func(t *testing.T) {
		o.teller.reset()
		status, body, raw := o.met(t).do("GET", "/full/natuurlijk_personen?size=100", nil)
		if status != 200 {
			t.Fatalf("status %d: %s", status, kort(raw))
		}
		queries := o.teller.aantal()
		lijst, _ := body[orig.Meervoud].([]any)
		if len(lijst) < 5 {
			t.Fatalf("verwacht ≥5 personen, kreeg %d (sleutels: %v)", len(lijst), sleutels(body))
		}
		for _, el := range lijst {
			np := el.(map[string]any)
			woon, _ := np["woonadres"].([]any)
			if len(woon) == 0 {
				continue // persoon zonder woonadres
			}
			if got := woon[0].(map[string]any)["locatie_id"]; got != np["id"] {
				t.Errorf("NP %v: woonadres locatie_id %v, verwacht %v", np["id"], got, np["id"])
			}
		}
		// N+1-bewaking: met 2 personen evenveel queries als met alle (één batch per hop).
		o.teller.reset()
		if status, _, raw := o.met(t).do("GET", "/full/natuurlijk_personen?size=2", nil); status != 200 {
			t.Fatalf("status %d: %s", status, kort(raw))
		}
		if klein := o.teller.aantal(); klein != queries {
			t.Errorf("queries: %d bij size=2, %d bij %d personen — verwacht gelijk (geen N+1)", klein, queries, len(lijst))
		}
		t.Logf("/full lijst met %d personen: %d queries", len(lijst), queries)
	})

	t.Run("GraphQL full", func(t *testing.T) {
		q := `{ full_natuurlijk_personen(id: 2) { id woonadres { id weergavenaam } woongemeente { id } } }`
		b, _ := json.Marshal(map[string]string{"query": q})
		status, body, raw := o.met(t).do("POST", "/graphql/query", b)
		if status != 200 || body["errors"] != nil {
			t.Fatalf("status %d: %s", status, kort(raw))
		}
		np := body["data"].(map[string]any)["full_natuurlijk_personen"].(map[string]any)
		woon, _ := np["woonadres"].([]any)
		if len(woon) != 1 || woon[0].(map[string]any)["id"] != 2.0 {
			t.Fatalf("woonadres = %v, verwacht [{id: 2}]", np["woonadres"])
		}
	})
}

func sleutels(m map[string]any) string {
	var s []string
	for k := range m {
		s = append(s, k)
	}
	return fmt.Sprint(s)
}
