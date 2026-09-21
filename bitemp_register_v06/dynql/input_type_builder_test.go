package dynql

// input_type_builder_test — verifieert dat BuildPatchInputTypes typed InputObject
// types bouwt uit de MetaRegistry, zonder DB-verbinding.

import (
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/graphql-go/graphql"
)

// TestBuildPatchInputTypes_VultCacheVoorAlleEntiteiten controleert dat voor
// elke ENT met Factory én minstens één hub-kind een PatchInput type in de
// cache wordt opgeslagen. Entiteiten zonder hub-kinderen (bijv. TPT-subtypes
// zonder eigen GE's, zoals C_sub) krijgen bewust géén PatchInput; hun
// wijzig-mutatie valt terug op JSONScalar (zie buildEntiteitPatchInputType).
func TestBuildPatchInputTypes_VultCacheVoorAlleEntiteiten(t *testing.T) {
	// Reset caches zodat parallel-tests niet interfereren.
	inputTypeCache = map[string]*graphql.InputObject{}
	patchInputTypeCache = map[string]*graphql.InputObject{}

	result := BuildPatchInputTypes()

	for typenaam, meta := range model.MetaRegistry {
		if meta.Metatype != model.MetatypeEntiteit || meta.Factory == nil {
			continue
		}
		if !heeftHubKind(meta) {
			// Geen hub-kinderen → geen PatchInput verwacht.
			if _, ok := result[typenaam]; ok {
				t.Errorf("onverwacht PatchInput type voor ENT %q zonder hub-kinderen", typenaam)
			}
			continue
		}
		if _, ok := result[typenaam]; !ok {
			t.Errorf("geen PatchInput type voor ENT %q in resultaat", typenaam)
		}
		if _, ok := patchInputTypeCache[typenaam]; !ok {
			t.Errorf("geen PatchInput type voor ENT %q in patchInputTypeCache", typenaam)
		}
	}
}

// heeftHubKind is de test-spiegel van de eligibility-check in
// buildEntiteitPatchInputType: minstens één onderliggend GE/REL met GESubtype hub.
func heeftHubKind(meta model.TypeMeta) bool {
	for _, child := range meta.OnderliggendeGegevenselementen {
		childMeta, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype)
		if ok && childMeta.GESubtype == model.GESubtypeHub {
			return true
		}
	}
	return false
}

// TestBuildPatchInputTypes_NatuurlijkPersoonHeeftGERollen controleert dat
// NatuurlijkPersoonPatchInput de verwachte GE/REL rolnamen bevat.
func TestBuildPatchInputTypes_NatuurlijkPersoonHeeftGERollen(t *testing.T) {
	if _, ok := model.MetaRegistry["NatuurlijkPersoon"]; !ok {
		t.Skip("NatuurlijkPersoon niet in MetaRegistry — skip test")
	}

	inputTypeCache = map[string]*graphql.InputObject{}
	patchInputTypeCache = map[string]*graphql.InputObject{}
	BuildPatchInputTypes()

	patchType, ok := patchInputTypeCache["NatuurlijkPersoon"]
	if !ok {
		t.Fatal("geen PatchInput type voor NatuurlijkPersoon")
	}

	// Verwachte GE-rolnamen (JSONRolnaam uit OnderliggendeGegevenselementen die GESubtype==hub hebben).
	wantRollen := []string{"namen", "persoonsidentificaties", "burgerschappen", "bereikbaarheden"}
	fields := patchType.Fields()
	for _, rol := range wantRollen {
		if _, exists := fields[rol]; !exists {
			t.Errorf("NatuurlijkPersoonPatchInput mist veld %q (heeft: %v)", rol, inputFieldKeys(fields))
		}
	}

	// Aanvang/Einde plumbing mogen NIET in de patch zitten.
	for _, forbidden := range []string{"aanvang", "einde"} {
		if _, exists := fields[forbidden]; exists {
			t.Errorf("NatuurlijkPersoonPatchInput bevat onverwacht plumbing-veld %q", forbidden)
		}
	}
}

// TestBuildPatchInputTypes_GEInputHeeftRelID controleert dat GE input types
// het rel_id veld bevatten.
func TestBuildPatchInputTypes_GEInputHeeftRelID(t *testing.T) {
	if _, ok := model.MetaRegistry["NatuurlijkPersoon_Naam"]; !ok {
		t.Skip("NatuurlijkPersoon_Naam niet in MetaRegistry — skip test")
	}

	inputTypeCache = map[string]*graphql.InputObject{}
	patchInputTypeCache = map[string]*graphql.InputObject{}
	BuildPatchInputTypes()

	geType, ok := inputTypeCache["NatuurlijkPersoon_Naam"]
	if !ok {
		t.Fatal("geen InputType voor NatuurlijkPersoon_Naam")
	}

	fields := geType.Fields()
	if _, exists := fields["rel_id"]; !exists {
		t.Errorf("NatuurlijkPersoon_NaamInput mist verplicht veld rel_id (heeft: %v)", inputFieldKeys(fields))
	}
}

// TestBuildPatchInputTypes_GEInputHeeftDataVelden controleert dat de
// inhoudsvelden uit de _Data struct aanwezig zijn in het GE InputType.
func TestBuildPatchInputTypes_GEInputHeeftDataVelden(t *testing.T) {
	if _, ok := model.MetaRegistry["NatuurlijkPersoon_Naam"]; !ok {
		t.Skip("NatuurlijkPersoon_Naam niet in MetaRegistry — skip test")
	}

	inputTypeCache = map[string]*graphql.InputObject{}
	patchInputTypeCache = map[string]*graphql.InputObject{}
	BuildPatchInputTypes()

	geType, ok := inputTypeCache["NatuurlijkPersoon_Naam"]
	if !ok {
		t.Fatal("geen InputType voor NatuurlijkPersoon_Naam")
	}

	fields := geType.Fields()
	// NatuurlijkPersoon_Naam_Data bevat: voorletters, roepnaam, tussenvoegsel, achternaam.
	wantVelden := []string{"voorletters", "achternaam"}
	for _, v := range wantVelden {
		if _, exists := fields[v]; !exists {
			t.Errorf("NatuurlijkPersoon_NaamInput mist inhoudsveld %q (heeft: %v)", v, inputFieldKeys(fields))
		}
	}

	// PK-velden mogen NIET aanwezig zijn.
	for _, forbidden := range []string{"natuurlijkpersoon_id", "versie"} {
		if _, exists := fields[forbidden]; exists {
			t.Errorf("NatuurlijkPersoon_NaamInput bevat onverwacht PK-veld %q", forbidden)
		}
	}
}

// TestBuildPatchInputTypes_MaterieleGEHeeftAanvangEinde controleert dat
// materieel GE input types aanvang/einde sub-inputs bevatten.
func TestBuildPatchInputTypes_MaterieleGEHeeftAanvangEinde(t *testing.T) {
	if _, ok := model.MetaRegistry["NatuurlijkPersoon_Burgerschap"]; !ok {
		t.Skip("NatuurlijkPersoon_Burgerschap niet in MetaRegistry — skip test")
	}

	inputTypeCache = map[string]*graphql.InputObject{}
	patchInputTypeCache = map[string]*graphql.InputObject{}
	BuildPatchInputTypes()

	geType, ok := inputTypeCache["NatuurlijkPersoon_Burgerschap"]
	if !ok {
		t.Fatal("geen InputType voor NatuurlijkPersoon_Burgerschap")
	}

	fields := geType.Fields()
	for _, plumbing := range []string{"aanvang", "einde"} {
		if _, exists := fields[plumbing]; !exists {
			t.Errorf("NatuurlijkPersoon_BurgerschapInput mist materieel veld %q (heeft: %v)", plumbing, inputFieldKeys(fields))
		}
	}
}

// TestBuildPatchInputTypes_WijzigMutatieGebruiktTypedInput controleert dat
// wijzig<X>.Args["patch"] een InputObject is (niet meer JSONScalar).
func TestBuildPatchInputTypes_WijzigMutatieGebruiktTypedInput(t *testing.T) {
	if _, ok := model.MetaRegistry["NatuurlijkPersoon"]; !ok {
		t.Skip("NatuurlijkPersoon niet in MetaRegistry — skip test")
	}

	inputTypeCache = map[string]*graphql.InputObject{}
	patchInputTypeCache = map[string]*graphql.InputObject{}
	BuildPatchInputTypes()

	fields := graphql.Fields{}
	meta := model.MetaRegistry["NatuurlijkPersoon"]
	AddTypedMutationsForEntiteit(fields, meta)

	wijzig, ok := fields["wijzigNatuurlijkPersoon"]
	if !ok {
		t.Fatal("mutation wijzigNatuurlijkPersoon niet gevonden")
	}

	patchArg, ok := wijzig.Args["patch"]
	if !ok {
		t.Fatal("patch argument niet gevonden op wijzigNatuurlijkPersoon")
	}

	// Type moet NonNull(InputObject) zijn, niet NonNull(Scalar/JSON).
	argType := patchArg.Type
	// Unwrap NonNull wrapper
	if nn, ok := argType.(*graphql.NonNull); ok {
		argType = nn.OfType
	}
	if _, ok := argType.(*graphql.InputObject); !ok {
		t.Errorf("verwacht InputObject als patch-type voor wijzigNatuurlijkPersoon, kreeg %T", argType)
	}
}

// TestBuildPatchInputTypes_BereikbaarheidHeeftLocatieID controleert dat
// BereikbaarheidInput de secundaire FK (locatie_id) bevat.
func TestBuildPatchInputTypes_BereikbaarheidHeeftLocatieID(t *testing.T) {
	if _, ok := model.MetaRegistry["Bereikbaarheid"]; !ok {
		t.Skip("Bereikbaarheid niet in MetaRegistry — skip test")
	}

	inputTypeCache = map[string]*graphql.InputObject{}
	patchInputTypeCache = map[string]*graphql.InputObject{}
	BuildPatchInputTypes()

	geType, ok := inputTypeCache["Bereikbaarheid"]
	if !ok {
		t.Fatal("geen InputType voor Bereikbaarheid")
	}

	fields := geType.Fields()
	if _, exists := fields["locatie_id"]; !exists {
		t.Errorf("BereikbaarheidInput mist secundaire FK locatie_id (heeft: %v)", inputFieldKeys(fields))
	}
	// Parent FK moet NIET aanwezig zijn.
	if _, exists := fields["natuurlijkpersoon_id"]; exists {
		t.Errorf("BereikbaarheidInput bevat onverwacht parent-FK veld natuurlijkpersoon_id")
	}
}

// TestGetPatchInputType_FallbackOpJSONScalar controleert dat niet-bestaande
// typen terugvallen op JSONScalar.
func TestGetPatchInputType_FallbackOpJSONScalar(t *testing.T) {
	inputTypeCache = map[string]*graphql.InputObject{}
	patchInputTypeCache = map[string]*graphql.InputObject{}

	result := getPatchInputType("BestaatNietTypenaam")
	if result != JSONScalar {
		t.Errorf("verwacht JSONScalar als fallback, kreeg %T", result)
	}
}

// inputFieldKeys geeft de veldnamen van een InputObject-veldmap terug (voor foutmeldingen).
func inputFieldKeys(fields map[string]*graphql.InputObjectField) []string {
	out := make([]string, 0, len(fields))
	for k := range fields {
		out = append(out, k)
	}
	return out
}
