package handlers

import (
	"testing"

	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/schema"
)

// Melding FUNDAMENT 27-10-2026: een uniek veld met een hoofdletter in de JSON-naam (agbCode) moet
// in SQL de kolomnaam van het bun-schema krijgen, niet de JSON-naam.
type uniekProefData struct {
	Partij_ID int    `json:"partij_id" bun:"partij_id,pk"`
	Rel_ID    int    `json:"rel_id" bun:"rel_id,pk"`
	AgbCode   string `json:"agbCode" schema:"uniek=entiteit"`
	KvkNummer string `json:"kvkNummer" bun:"kvknummer" schema:"uniek=entiteit"`
	Code      string `json:"code" schema:"uniek=entiteit"`
}

func TestSqlKolomVoorJSONVeld(t *testing.T) {
	tabellen := schema.NewTables(pgdialect.New())
	rep := &uniekProefData{}
	gevallen := map[string]string{
		"agbCode":     "agb_code",  // bun: snake_case van AgbCode
		"kvkNummer":   "kvknummer", // expliciete bun-tag
		"code":        "code",
		"bestaatNiet": "bestaatniet", // terugval: kleine letters
	}
	for veld, wil := range gevallen {
		if got := sqlKolomVoorJSONVeld(tabellen, rep, veld); got != wil {
			t.Errorf("%s: wil kolom %q, kreeg %q", veld, wil, got)
		}
	}
	if velden := uniekeVelden(rep); len(velden) != 3 || velden["agbCode"] != "entiteit" {
		t.Errorf("uniekeVelden: %v", velden)
	}
}
