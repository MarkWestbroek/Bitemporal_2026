package handlers

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Domeinen mag als lijst namen én als objecten.
func TestRebuildDomeinSpec_StringOfObject(t *testing.T) {
	var req RebuildRequest
	if err := json.Unmarshal([]byte(`{"domeinen":["inrichting",{"domein":"np-loc","prefix":"np_loc"}],"precies":true}`), &req); err != nil {
		t.Fatal(err)
	}
	want := []RebuildDomeinSpec{{Domein: "inrichting"}, {Domein: "np-loc", Prefix: "np_loc"}}
	if !reflect.DeepEqual(req.Domeinen, want) || !req.Precies {
		t.Fatalf("domeinen = %+v precies=%v", req.Domeinen, req.Precies)
	}
}

func TestKiesDomeinRuns(t *testing.T) {
	modelRuns := []RebuildDomeinSpec{
		{Domein: "CG", Prefix: "cg", Mode: "additive"},
		{Domein: "aanvraag", Prefix: "aanvraag", Mode: "additive"},
		{Domein: "gegevenstypen", Prefix: "gegevenstypen", Mode: "additive"},
		{Domein: "inrichting", Prefix: "inrichting", Mode: "additive"},
		{Domein: "register", Prefix: "register", Mode: "additive"},
	}
	aanwezig := []model.GebouwdDomein{{Domein: "CG", Prefix: "cg"}, {Domein: "register", Prefix: "register"}, {Domein: "beheer", Prefix: "beheer"},
		{Domein: "gegevenstypen", Prefix: "gegevenstypen"}} // gegevenstypen: aanwezig, maar "bestaande" genereert het niet opnieuw
	prefixen := func(k domeinenKeuze) []string {
		var p []string
		for _, r := range k.runs {
			p = append(p, r.Prefix)
		}
		return p
	}

	// Lijst: in die volgorde; gegevenstypen (handgemaakt standaardpakket) wordt niet vanzelf
	// opnieuw gegenereerd; zonder precies niets houden (additief).
	k, fout := kiesDomeinRuns(modelRuns, aanwezig, []RebuildDomeinSpec{{Domein: "inrichting"}, {Domein: "Aanvraag"}}, false, false, true)
	if fout != "" || !reflect.DeepEqual(prefixen(k), []string{"inrichting", "aanvraag"}) || k.houden != nil {
		t.Fatalf("lijst: %v %+v (%s)", prefixen(k), k.houden, fout)
	}
	// Precies: houden = de runs.
	k, _ = kiesDomeinRuns(modelRuns, aanwezig, []RebuildDomeinSpec{{Domein: "inrichting"}}, false, true, true)
	if !reflect.DeepEqual(k.houden, []string{"inrichting"}) {
		t.Fatalf("precies houden = %v", k.houden)
	}
	// Project zonder lijst: de bestaande domeinen die in het model staan.
	k, _ = kiesDomeinRuns(modelRuns, aanwezig, nil, false, false, true)
	if !reflect.DeepEqual(prefixen(k), []string{"cg", "register"}) {
		t.Fatalf("bestaande = %v", prefixen(k))
	}
	// Alle.
	k, _ = kiesDomeinRuns(modelRuns, aanwezig, nil, true, false, false)
	if len(k.runs) != len(modelRuns) {
		t.Fatalf("alle = %v", prefixen(k))
	}
	// Fouten.
	for naam, geval := range map[string]func() string{
		"onbekend": func() string {
			_, f := kiesDomeinRuns(modelRuns, aanwezig, []RebuildDomeinSpec{{Domein: "zorg"}}, false, false, true)
			return f
		},
		"allebei": func() string {
			_, f := kiesDomeinRuns(modelRuns, aanwezig, []RebuildDomeinSpec{{Domein: "CG"}}, true, false, true)
			return f
		},
		"precies-kaal":  func() string { _, f := kiesDomeinRuns(modelRuns, aanwezig, nil, false, true, false); return f },
		"niets-bestaat": func() string { _, f := kiesDomeinRuns(modelRuns, nil, nil, false, false, true); return f },
	} {
		if geval() == "" {
			t.Errorf("%s: verwacht een fout", naam)
		}
	}
	// Geen project, geen lijst: de oude enkel-domein-route.
	if k, f := kiesDomeinRuns(modelRuns, aanwezig, nil, false, false, false); f != "" || len(k.runs) != 0 {
		t.Fatalf("enkel-domein: %+v %s", k, f)
	}
}

// De versielijst toont de herkomst en de domeinenlijst (stonden tot 0.22.0 niet in het antwoord).
func TestSchemaVersieLijstResponse_HerkomstEnDomeinen(t *testing.T) {
	versie, nummer := int64(7), int64(40)
	r := schemaVersieLijstResponse(model.SchemaVersie{ID: 5, BronProjectID: "p1", BronProjectVersie: &versie, BronTotVolgnummer: &nummer,
		GebouwdeDomeinen: []model.GebouwdDomein{{Domein: "inrichting", Prefix: "inrichting"}}})
	if r["bron_project_id"] != "p1" || r["bron_project_versie"] != &versie || len(r["gebouwde_domeinen"].([]model.GebouwdDomein)) != 1 {
		t.Fatalf("antwoord: %+v", r)
	}
	if _, ok := schemaVersieLijstResponse(model.SchemaVersie{ID: 6})["gebouwde_domeinen"]; ok {
		t.Fatal("zonder lijst hoort het veld weg te blijven")
	}
}

// schrijfDomein zet een nagebootst gegenereerd domein in dir.
func schrijfDomein(t *testing.T, dir, prefix, pascal, domein, registry string) {
	t.Helper()
	bestanden := map[string]string{
		prefix + "_metaregistry.go":        "package model\n\nfunc init" + pascal + "MetaRegistry() {\n" + registry + "}\n",
		prefix + "_enum_registry.go":       "package model\n\nfunc init" + pascal + "EnumRegistry() {}\n",
		prefix + "_datatype_registry.go":   "package model\n\nfunc init" + pascal + "DatatypeRegistry() {}\n",
		prefix + "_modellen_entiteiten.go": "package model\n",
	}
	if domein != "" {
		bestanden[prefix+"_metaregistry.go"] = strings.Replace(bestanden[prefix+"_metaregistry.go"], "{\n", "{\n\t// Domein: \""+domein+"\"\n", 1)
	}
	for n, inhoud := range bestanden {
		if err := os.WriteFile(filepath.Join(dir, n), []byte(inhoud), 0644); err != nil {
			t.Fatal(err)
		}
	}
}

// Precies: de bestanden en init-aanroepen van niet-gekozen domeinen gaan eruit, het
// standaardpakket en handwerk blijven, en een verwijzing naar een weggelaten type wordt gevonden.
func TestLaatDomeinenWegEnVerwijzingen(t *testing.T) {
	dir := t.TempDir()
	schrijfDomein(t, dir, "cg", "Cg", "CG", "\tMetaRegistry[\"GitRepo\"] = TypeMeta{\n\t\tTabelnaam: \"gitrepo\",\n\t}\n")
	schrijfDomein(t, dir, "np_loc", "NpLoc", "np-loc", "\tMetaRegistry[\"AdellijkeTitel\"] = TypeMeta{\n\t\tTabelnaam: \"adellijketitel\",\n\t}\n")
	schrijfDomein(t, dir, "inrichting", "Inrichting", "inrichting", "\tMetaRegistry[\"Component\"] = TypeMeta{Tabelnaam: \"component\"}\n")
	schrijfDomein(t, dir, "register", "Register", "register",
		"\tMetaRegistry[\"Referentielijst\"] = TypeMeta{\n\t\tTabelnaam: \"referentielijst\",\n\t\tDoelEntiteit: \"AdellijkeTitel\",\n\t}\n")
	// Datatypes: GitAdres staat alleen in CG; URL ook in het handwerk (extra) en blijft dus bestaan.
	extra := map[string]string{
		"extra_datatype_registry.go":    "package model\n\nvar _ = []V3Datatype{\n\t{\n\t\tNaam: \"URL\",\n\t},\n}\n",
		"cg_datatype_registry.go":       "package model\n\nfunc initCgDatatypeRegistry() {\n\tDatatypeRegistry = append(DatatypeRegistry,\n\t\tV3Datatype{\n\t\t\tNaam: \"GitAdres\",\n\t\t},\n\t\tV3Datatype{\n\t\t\tNaam: \"URL\",\n\t\t},\n\t)\n}\n",
		"inrichting_modellen_ge_rel.go": "package model\n\ntype Component_Bron_Data struct {\n\tGitRepo *string `schema:\"datatype:GitAdres\"`\n\tSite *string `schema:\"datatype:URL\"`\n}\n",
	}
	for n, inhoud := range extra {
		if err := os.WriteFile(filepath.Join(dir, n), []byte(inhoud), 0644); err != nil {
			t.Fatal(err)
		}
	}
	plumbing := "package model\n\nfunc init() {\n\tinitCgEnumRegistry()\n\tinitCgDatatypeRegistry()\n\tinitCgMetaRegistry()\n" +
		"\tinitNpLocMetaRegistry()\n\tinitNpLocEnumRegistry()\n\tinitNpLocDatatypeRegistry()\n" +
		"\tinitInrichtingMetaRegistry()\n\tinitRegisterMetaRegistry()\n\tpropageerDomeinNaarOnderliggende()\n}\n"
	if err := os.WriteFile(filepath.Join(dir, "metaregistry_plumbing.go"), []byte(plumbing), 0644); err != nil {
		t.Fatal(err)
	}

	if got := aanwezigeDomeinen(dir); len(got) != 4 || got[0] != (model.GebouwdDomein{Domein: "CG", Prefix: "cg"}) {
		t.Fatalf("aanwezig = %+v", got)
	}

	w, err := laatDomeinenWeg(dir, []string{"inrichting"})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(w.prefixen, []string{"cg", "np_loc"}) || w.types["AdellijkeTitel"] != "np_loc" || w.tabellen["gitrepo"] != "cg" {
		t.Fatalf("weggelaten = %+v", w)
	}
	for _, f := range []string{"cg_metaregistry.go", "cg_enum_registry.go", "np_loc_modellen_entiteiten.go"} {
		if _, err := os.Stat(filepath.Join(dir, f)); !os.IsNotExist(err) {
			t.Errorf("%s hoort weg te zijn", f)
		}
	}
	for _, f := range []string{"inrichting_metaregistry.go", "register_metaregistry.go", "extra_datatype_registry.go"} {
		if _, err := os.Stat(filepath.Join(dir, f)); err != nil {
			t.Errorf("%s hoort te blijven: %v", f, err)
		}
	}
	b, _ := os.ReadFile(filepath.Join(dir, "metaregistry_plumbing.go"))
	if strings.Contains(string(b), "initCg") || strings.Contains(string(b), "initNpLoc") ||
		!strings.Contains(string(b), "initInrichtingMetaRegistry()") || !strings.Contains(string(b), "propageerDomeinNaarOnderliggende()") {
		t.Fatalf("plumbing:\n%s", b)
	}

	// register (standaard) verwijst naar AdellijkeTitel uit het weggelaten np-loc, en inrichting
	// gebruikt GitAdres, dat alleen in het weggelaten CG gedefinieerd was. URL bestaat nog (extra).
	fouten := strings.Join(verwijzingenNaarWeggelaten(dir, w), "\n")
	if !strings.Contains(fouten, `register_metaregistry.go:`) || !strings.Contains(fouten, `"AdellijkeTitel"`) ||
		!strings.Contains(fouten, `inrichting_modellen_ge_rel.go:4: veld met datatype "GitAdres"`) ||
		strings.Contains(fouten, `"URL"`) || strings.Count(fouten, "\n") != 1 {
		t.Fatalf("verwijzingen =\n%s", fouten)
	}
}

// Wees-kandidaten: alleen tabellen uit gegenereerde registerbestanden die de code niet kent.
func TestWeesKandidaten(t *testing.T) {
	image := t.TempDir()
	nu := t.TempDir()
	schrijfDomein(t, image, "cg", "Cg", "CG", "\tMetaRegistry[\"GitRepo\"] = TypeMeta{Tabelnaam: \"gitrepo\"}\n")
	schrijfDomein(t, image, "inrichting", "Inrichting", "inrichting", "\tMetaRegistry[\"Component\"] = TypeMeta{Tabelnaam: \"component\"}\n")
	live := model.MetaRegistryType{"Component": {Tabelnaam: "component"}}
	tabellen, types, gelezen := weesKandidaten([]string{image, nu, filepath.Join(nu, "bestaat-niet")}, live)
	if !reflect.DeepEqual(tabellen, map[string]string{"gitrepo": "cg"}) || !reflect.DeepEqual(types, []string{"GitRepo"}) || len(gelezen) != 2 {
		t.Fatalf("tabellen=%v types=%v gelezen=%v", tabellen, types, gelezen)
	}
}

// TestWeesTabellenOpruimen — integratietest (STUDIO_TEST_PG_DSN): het overzicht vindt de lege
// wees-tabel, opruimen met een andere lijst of met data erin wordt geweigerd, met de juiste lijst
// gaat hij weg; een tabel die de code kent blijft altijd staan.
func TestWeesTabellenOpruimen(t *testing.T) {
	db := studioTestDB(t)
	ctx := context.Background()
	dir := t.TempDir()
	schrijfDomein(t, dir, "wtproef", "Wtproef", "wtproef",
		"\tMetaRegistry[\"WtA\"] = TypeMeta{Tabelnaam: \"wtproef_a\"}\n\tMetaRegistry[\"WtB\"] = TypeMeta{Tabelnaam: \"wtproef_b\"}\n\tMetaRegistry[\"WtLive\"] = TypeMeta{Tabelnaam: \"wtproef_live\"}\n")
	for _, s := range []string{
		`CREATE TABLE IF NOT EXISTS wtproef_a (id BIGSERIAL PRIMARY KEY)`,
		`CREATE TABLE IF NOT EXISTS wtproef_b (id BIGSERIAL PRIMARY KEY, a_id BIGINT REFERENCES wtproef_a(id))`,
		`CREATE TABLE IF NOT EXISTS wtproef_live (id BIGSERIAL PRIMARY KEY)`,
		`CREATE TABLE IF NOT EXISTS wijziging (id BIGSERIAL PRIMARY KEY, representatienaam TEXT)`,
	} {
		if _, err := db.ExecContext(ctx, s); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		_, _ = db.ExecContext(ctx, `DROP TABLE IF EXISTS wtproef_b, wtproef_a, wtproef_live`)
	})
	live := model.MetaRegistryType{"WtLive": {Tabelnaam: "wtproef_live"}}
	mappen := []string{dir}

	ov, err := weesOverzicht(ctx, db, mappen, live)
	if err != nil {
		t.Fatal(err)
	}
	if len(ov.Tabellen) != 2 || !ov.Leeg || ov.Tabellen[0].Tabel != "wtproef_a" {
		t.Fatalf("overzicht: %+v", ov)
	}

	// Andere lijst: geweigerd.
	if _, status, err := ruimWeesTabellenOp(ctx, db, mappen, live, []string{"wtproef_a"}); err == nil || status != 409 {
		t.Fatalf("afwijkende lijst: status %d, %v", status, err)
	}
	// Data erin: geweigerd.
	if _, err := db.ExecContext(ctx, `INSERT INTO wtproef_a DEFAULT VALUES`); err != nil {
		t.Fatal(err)
	}
	if _, status, err := ruimWeesTabellenOp(ctx, db, mappen, live, []string{"wtproef_a", "wtproef_b"}); err == nil || status != 409 {
		t.Fatalf("met data: status %d, %v", status, err)
	}
	if _, err := db.ExecContext(ctx, `TRUNCATE wtproef_a CASCADE`); err != nil {
		t.Fatal(err)
	}
	// Juiste lijst, leeg: weg (ondanks de verwijzing b → a), de live-tabel blijft.
	ov, status, err := ruimWeesTabellenOp(ctx, db, mappen, live, []string{"WTPROEF_B", "wtproef_a"})
	if err != nil || status != 200 || len(ov.Opgeruimd) != 2 {
		t.Fatalf("opruimen: status %d, %v, %+v", status, err, ov)
	}
	var n int
	_ = db.NewRaw(`SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename LIKE 'wtproef_%'`).Scan(ctx, &n)
	if n != 1 {
		t.Fatalf("na opruimen %d wtproef-tabellen, verwacht 1 (live)", n)
	}
}
