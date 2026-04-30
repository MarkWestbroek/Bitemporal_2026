package dynql

// typed_mutations_test — verifieert dat per-ENT typed mutations geregistreerd
// worden in de mutation-velden, zónder dat een DB-verbinding nodig is.

import (
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
)

func TestAddTypedMutationsForEntiteit_RegistreertWijzigCorrigeerVoerAf(t *testing.T) {
	// Zoek een entiteit-meta uit de registry — A is altijd aanwezig.
	meta, ok := model.MetaRegistry["A"]
	if !ok {
		t.Skip("type A niet aanwezig in MetaRegistry — skip test")
	}
	if meta.Metatype != model.MetatypeEntiteit {
		t.Fatalf("verwachte entiteit, kreeg %s", meta.Metatype)
	}

	fields := graphql.Fields{}
	AddTypedMutationsForEntiteit(fields, meta)

	want := []string{"wijzigA", "corrigeerA", "voerAAf"}
	for _, name := range want {
		if _, ok := fields[name]; !ok {
			t.Errorf("verwachtte mutation-veld %q, niet aanwezig. Aanwezig: %v", name, keysOf(fields))
		}
	}

	// Argumenten-check op wijzigA
	if f, ok := fields["wijzigA"]; ok {
		argNames := map[string]bool{}
		for name := range f.Args {
			argNames[name] = true
		}
		for _, expected := range []string{"id", "patch"} {
			if !argNames[expected] {
				t.Errorf("wijzigA mist argument %q (heeft: %v)", expected, argNames)
			}
		}
	}
}

func TestAddTypedMutationsForEntiteit_GeenOpVoorNietEntiteit(t *testing.T) {
	// Zoek een GE of relatie.
	var nonEnt model.TypeMeta
	var found bool
	for _, m := range model.MetaRegistry {
		if m.Metatype != model.MetatypeEntiteit && m.Factory != nil {
			nonEnt = m
			found = true
			break
		}
	}
	if !found {
		t.Skip("geen niet-entiteit met Factory in registry")
	}

	fields := graphql.Fields{}
	AddTypedMutationsForEntiteit(fields, nonEnt)
	if len(fields) != 0 {
		t.Errorf("verwacht geen velden voor niet-entiteit %s, kreeg %v", nonEnt.Typenaam, keysOf(fields))
	}
}

func TestAddTypedMutationsForEntiteit_AlleEntiteitenKrijgenDrieMutations(t *testing.T) {
	fields := graphql.Fields{}
	for _, meta := range model.MetaRegistry {
		AddTypedMutationsForEntiteit(fields, meta)
	}

	// Voor elke ENT met Factory + IDKolom moeten 3 mutations bestaan.
	missing := []string{}
	for _, meta := range model.MetaRegistry {
		if meta.Metatype != model.MetatypeEntiteit || meta.Factory == nil || meta.IDKolom == "" {
			continue
		}
		for _, prefix := range []string{"wijzig", "corrigeer"} {
			name := prefix + meta.Typenaam
			if _, ok := fields[name]; !ok {
				missing = append(missing, name)
			}
		}
		voerAf := "voer" + meta.Typenaam + "Af"
		if _, ok := fields[voerAf]; !ok {
			missing = append(missing, voerAf)
		}
	}
	if len(missing) > 0 {
		t.Errorf("missende typed mutations: %s", strings.Join(missing, ", "))
	}
}

func keysOf(m graphql.Fields) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}
