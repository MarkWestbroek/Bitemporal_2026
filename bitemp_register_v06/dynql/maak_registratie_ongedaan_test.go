package dynql

// maak_registratie_ongedaan_test — verifieert de typed mutation-resolver
// voor maakRegistratieOngedaan. De resolver wordt geïsoleerd getest:
// alleen de input-validatie (zonder DB-call door registratie_id <= 0).

import (
	"testing"

	"github.com/graphql-go/graphql"
)

func TestMakeMaakRegistratieOngedaanResolver_VereistRegistratieID(t *testing.T) {
	resolver := makeMaakRegistratieOngedaanResolver()

	// Ontbrekend registratie_id (nul-waarde)
	_, err := resolver(graphql.ResolveParams{
		Args: map[string]interface{}{},
	})
	if err == nil {
		t.Fatal("verwachtte fout bij ontbrekend registratie_id, kreeg nil")
	}
}

func TestMakeMaakRegistratieOngedaanResolver_AfwijstNegatieveID(t *testing.T) {
	resolver := makeMaakRegistratieOngedaanResolver()

	_, err := resolver(graphql.ResolveParams{
		Args: map[string]interface{}{"registratie_id": -1},
	})
	if err == nil {
		t.Fatal("verwachtte fout bij negatief registratie_id, kreeg nil")
	}
}
