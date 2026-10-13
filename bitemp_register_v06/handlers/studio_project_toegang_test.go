package handlers

// Tests voor toegang per Studio-project ("alles dicht tenzij", plan 2026-10-12 §5). De
// beslisregel is zuiver; de routes en de migratie draaien tegen PostgreSQL
// (STUDIO_TEST_PG_DSN, zie studio_project_handler_test.go).

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func TestBesluitProjectRecht(t *testing.T) {
	acl := map[string]ProjectRecht{"anna": RechtSchrijven, "lezer1": RechtSchrijven}
	iedereen := map[string]ProjectRecht{IedereenSubject: RechtLezen}
	for _, g := range []struct {
		naam                     string
		auth                     bool
		rol, gebruiker, eigenaar string
		acl                      map[string]ProjectRecht
		wil                      ProjectRecht
	}{
		{"auth uit", false, "", "", "mark", nil, RechtBeheren},
		{"beheerder", true, "admin", "mark", "hugo", nil, RechtBeheren},
		{"beheerder nieuwe naam", true, "beheerder", "x1", "hugo", nil, RechtBeheren},
		{"eigenaar", true, "modelleur", "hugo", "hugo", nil, RechtBeheren},
		{"geen rij: dicht", true, "bouwer", "piet", "hugo", nil, RechtGeen},
		{"rij schrijven", true, "modelleur", "anna", "hugo", acl, RechtSchrijven},
		{"lezer met schrijfrij: alleen lezen", true, "lezer", "lezer1", "hugo", acl, RechtLezen},
		{"iedereen lezen", true, "modelleur", "piet", "hugo", iedereen, RechtLezen},
		{"hoogste van eigen rij en *", true, "modelleur", "anna", "hugo", map[string]ProjectRecht{"anna": RechtSchrijven, IedereenSubject: RechtLezen}, RechtSchrijven},
		{"geen rol", true, "", "anna", "hugo", acl, RechtGeen},
		{"onbekende rol", true, "medewerker", "anna", "hugo", acl, RechtGeen},
		{"lege eigenaar is niet iedereen", true, "modelleur", "", "", nil, RechtGeen},
	} {
		if got := besluitProjectRecht(g.auth, g.rol, g.gebruiker, g.eigenaar, g.acl); got != g.wil {
			t.Errorf("%s: %v, wil %v", g.naam, got, g.wil)
		}
	}
}

func TestValideerToegang(t *testing.T) {
	if msg := valideerToegang([]toegangRij{{"anna", "schrijven"}, {"*", "lezen"}}); msg != "" {
		t.Errorf("goed: %s", msg)
	}
	for _, rijen := range [][]toegangRij{
		{{"anna", "beheren"}}, {{"an na", "lezen"}}, {{"", "lezen"}}, {{"anna", "lezen"}, {"anna", "schrijven"}},
	} {
		if valideerToegang(rijen) == "" {
			t.Errorf("verwacht fout: %+v", rijen)
		}
	}
}

// toegangRouter: dezelfde routes en guards als main.go; de claims komen uit testheaders.
func toegangRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if naam := c.GetHeader("X-Test-Gebruiker"); naam != "" {
			c.Set(middleware.ContextKeyGebruiker, &middleware.JWTClaims{Gebruikersnaam: naam, Rol: c.GetHeader("X-Test-Rol")})
		}
		c.Next()
	})
	ingelogd := middleware.RequireAuth()
	modelleur := middleware.RequireRol("modelleur")
	pLezen, pSchrijven, pBeheren := VereisProjectRecht(RechtLezen), VereisProjectRecht(RechtSchrijven), VereisProjectRecht(RechtBeheren)
	r.GET("/api/studio/projecten", ingelogd, MaakStudioProjectenLijstHandler())
	r.GET("/api/studio/projecten/:id", ingelogd, pLezen, MaakStudioProjectOphalenHandler())
	r.POST("/api/studio/projecten", modelleur, MaakStudioProjectAanmakenHandler())
	r.PUT("/api/studio/projecten/:id", modelleur, pSchrijven, MaakStudioProjectOpslaanHandler())
	r.DELETE("/api/studio/projecten/:id", ingelogd, pBeheren, MaakStudioProjectVerwijderenHandler())
	r.GET("/api/studio/projecten/:id/toegang", ingelogd, pBeheren, MaakStudioProjectToegangOphalenHandler())
	r.PUT("/api/studio/projecten/:id/toegang", ingelogd, pBeheren, MaakStudioProjectToegangOpslaanHandler())
	r.GET("/api/studio/projecten/:id/ops", ingelogd, pLezen, MaakStudioProjectOpsLijstHandler())
	return r
}

func alsGebruiker(r *gin.Engine, naam, rol, methode, pad string, body any) (int, []byte) {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(methode, pad, &buf)
	req.Header.Set("Content-Type", "application/json")
	if naam != "" {
		req.Header.Set("X-Test-Gebruiker", naam)
		req.Header.Set("X-Test-Rol", rol)
	}
	rec := studioDoeReq(r, req)
	return rec.Code, rec.Body.Bytes()
}

func TestStudioProjectToegang_AllesDichtTenzij(t *testing.T) {
	db := studioTestDB(t)
	oud := DB
	DB = db
	defer func() { DB = oud }()
	t.Setenv("AUTH_ENABLED", "true")
	r := toegangRouter()
	inhoud := map[string]any{"formaat": "studio-project", "versie": 2, "profielen": map[string]any{}}
	ids := func(b []byte) map[string]string {
		var lijst []StudioProjectMeta
		_ = json.Unmarshal(b, &lijst)
		uit := map[string]string{}
		for _, m := range lijst {
			if strings.HasPrefix(m.ID, "test-") {
				uit[m.ID] = m.Recht
			}
		}
		return uit
	}

	// Mark (beheerder) maakt het productie- en het probeerproject.
	for _, id := range []string{"test-productie", "test-probeer"} {
		if code, b := alsGebruiker(r, "mark", "admin", "POST", "/api/studio/projecten", map[string]any{"id": id, "naam": id, "inhoud": inhoud}); code != 201 {
			t.Fatalf("POST %s: %d %s", id, code, b)
		}
	}
	// Een lezer mag geen project maken; zonder login niets.
	if code, _ := alsGebruiker(r, "lien", "lezer", "POST", "/api/studio/projecten", map[string]any{"id": "test-lien", "naam": "L", "inhoud": inhoud}); code != 403 {
		t.Fatalf("POST door lezer: %d", code)
	}
	if code, _ := alsGebruiker(r, "", "", "GET", "/api/studio/projecten", nil); code != 401 {
		t.Fatalf("lijst anoniem: %d", code)
	}

	// Genodigde zonder rij ziet niets; het productieproject bestaat voor hem niet.
	if code, b := alsGebruiker(r, "gast", "modelleur", "GET", "/api/studio/projecten", nil); code != 200 || len(ids(b)) != 0 {
		t.Fatalf("lijst gast vóór toegang: %d %s", code, b)
	}
	for _, m := range []struct{ methode, pad string }{
		{"GET", "/api/studio/projecten/test-productie"}, {"GET", "/api/studio/projecten/test-productie/ops"},
		{"PUT", "/api/studio/projecten/test-productie"}, {"DELETE", "/api/studio/projecten/test-productie"},
	} {
		if code, _ := alsGebruiker(r, "gast", "modelleur", m.methode, m.pad, map[string]any{"inhoud": inhoud, "versie": 1}); code != 404 {
			t.Fatalf("%s %s door gast: %d", m.methode, m.pad, code)
		}
	}

	// Mark geeft de gast schrijven op het probeerproject en iedereen lezen.
	if code, b := alsGebruiker(r, "mark", "admin", "PUT", "/api/studio/projecten/test-probeer/toegang",
		map[string]any{"toegang": []map[string]string{{"subject": "gast", "recht": "schrijven"}, {"subject": "*", "recht": "lezen"}}}); code != 204 {
		t.Fatalf("PUT toegang: %d %s", code, b)
	}
	if code, b := alsGebruiker(r, "gast", "modelleur", "GET", "/api/studio/projecten", nil); code != 200 || len(ids(b)) != 1 || ids(b)["test-probeer"] != "schrijven" {
		t.Fatalf("lijst gast na toegang: %d %s", code, b)
	}
	if code, b := alsGebruiker(r, "gast", "modelleur", "GET", "/api/studio/projecten/test-probeer", nil); code != 200 || !bytes.Contains(b, []byte(`"recht":"schrijven"`)) {
		t.Fatalf("GET probeer door gast: %d %s", code, b)
	}
	if code, b := alsGebruiker(r, "gast", "modelleur", "PUT", "/api/studio/projecten/test-probeer", map[string]any{"inhoud": inhoud, "versie": 1}); code != 200 {
		t.Fatalf("PUT probeer door gast: %d %s", code, b)
	}
	// Een andere ingelogde gebruiker ziet het probeerproject alleen lezend.
	if code, b := alsGebruiker(r, "ander", "modelleur", "GET", "/api/studio/projecten", nil); code != 200 || ids(b)["test-probeer"] != "lezen" || len(ids(b)) != 1 {
		t.Fatalf("lijst ander: %d %s", code, b)
	}
	if code, _ := alsGebruiker(r, "ander", "modelleur", "PUT", "/api/studio/projecten/test-probeer", map[string]any{"inhoud": inhoud, "versie": 2}); code != 403 {
		t.Fatalf("PUT door lezende ander: %d", code)
	}
	// Toegang beheren en verwijderen: alleen eigenaar of beheerder.
	if code, _ := alsGebruiker(r, "gast", "modelleur", "GET", "/api/studio/projecten/test-probeer/toegang", nil); code != 403 {
		t.Fatalf("toegang lezen door gast: %d", code)
	}
	if code, _ := alsGebruiker(r, "gast", "modelleur", "DELETE", "/api/studio/projecten/test-probeer", nil); code != 403 {
		t.Fatalf("DELETE door gast: %d", code)
	}
	// Ongeldige toegang wordt geweigerd.
	if code, _ := alsGebruiker(r, "mark", "admin", "PUT", "/api/studio/projecten/test-probeer/toegang",
		map[string]any{"toegang": []map[string]string{{"subject": "gast", "recht": "beheren"}}}); code != 400 {
		t.Fatalf("PUT toegang met beheren: %d", code)
	}
	// Gast maakt een eigen project: daarvan is hij eigenaar (beheren).
	if code, b := alsGebruiker(r, "gast", "modelleur", "POST", "/api/studio/projecten", map[string]any{"id": "test-gast-eigen", "naam": "Eigen", "inhoud": inhoud}); code != 201 || !bytes.Contains(b, []byte(`"recht":"beheren"`)) {
		t.Fatalf("POST eigen: %d %s", code, b)
	}
	if code, b := alsGebruiker(r, "mark", "beheerder", "GET", "/api/studio/projecten", nil); code != 200 || len(ids(b)) != 3 {
		t.Fatalf("lijst beheerder: %d %s", code, b)
	}
	// Verwijderen ruimt de toegangsrijen op.
	if code, _ := alsGebruiker(r, "mark", "admin", "DELETE", "/api/studio/projecten/test-probeer", nil); code != 204 {
		t.Fatalf("DELETE probeer: %d", code)
	}
	n, _ := db.NewSelect().Model((*model.StudioProjectToegang)(nil)).Where("project_id = 'test-probeer'").Count(context.Background())
	if n != 0 {
		t.Fatalf("toegangsrijen na DELETE: %d", n)
	}
}

func TestMigreerProjectToegangV1(t *testing.T) {
	db := studioTestDB(t)
	ctx := context.Background()
	_, _ = db.NewDelete().Model((*model.StudioMigratie)(nil)).Where("naam = ?", migratieProjectToegangV1).Exec(ctx)
	t.Cleanup(func() {
		_, _ = db.NewDelete().Model((*model.StudioMigratie)(nil)).Where("naam = ?", migratieProjectToegangV1).Exec(ctx)
	})
	for _, p := range []*model.StudioProject{
		{ID: "test-mig-a", Naam: "A", Eigenaar: "mark", Versie: 1, Inhoud: []byte(`{"formaat":"studio-project"}`)},
		{ID: "test-mig-b", Naam: "B", Eigenaar: "", Versie: 1, Inhoud: []byte(`{"formaat":"studio-project"}`)},
	} {
		if _, err := db.NewInsert().Model(p).Exec(ctx); err != nil {
			t.Fatal(err)
		}
	}
	gebruikers := []GebruikerMetRol{{"mark", "admin"}, {"hugo", "editor"}, {"lien", "viewer"}, {"zonder", ""}}
	if _, err := MigreerProjectToegangV1(ctx, db, gebruikers); err != nil {
		t.Fatal(err)
	}
	var rijen []model.StudioProjectToegang
	_ = db.NewSelect().Model(&rijen).Where("project_id LIKE 'test-mig-%'").Scan(ctx)
	kort := map[string]string{}
	for _, r := range rijen {
		kort[r.ProjectID+"/"+r.Subject] = r.Recht
	}
	wil := map[string]string{"test-mig-a/hugo": "schrijven", "test-mig-a/lien": "lezen", "test-mig-b/hugo": "schrijven", "test-mig-b/lien": "lezen"}
	if len(kort) != len(wil) {
		t.Fatalf("rijen: %v", kort)
	}
	for k, v := range wil {
		if kort[k] != v {
			t.Fatalf("%s = %q, wil %q (alle: %v)", k, kort[k], v, kort)
		}
	}
	// Tweede keer: niets (markering), ook niet voor een nieuwe gebruiker.
	if n2, err := MigreerProjectToegangV1(ctx, db, append(gebruikers, GebruikerMetRol{"nieuw", "editor"})); err != nil || n2 != 0 {
		t.Fatalf("tweede keer: %d %v", n2, err)
	}
}
