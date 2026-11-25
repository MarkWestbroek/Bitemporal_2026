package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestParseSchrijffilter(t *testing.T) {
	got, err := ParseSchrijffilter(" Omnium-Koppelaar = Koppeling*, component* ,edienstversiekoppeling ; ander=omgeving* ")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string][]string{
		"omnium-koppelaar": {"koppeling*", "component*", "edienstversiekoppeling"},
		"ander":            {"omgeving*"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v", got)
	}
	if leeg, err := ParseSchrijffilter(""); err != nil || len(leeg) != 0 {
		t.Fatalf("lege waarde: %v %v", leeg, err)
	}
	for _, fout := range []string{"zonder-is", "a=", "=koppeling*", "a=ko*ppeling", "a=*", "a=x;A=y"} {
		if _, err := ParseSchrijffilter(fout); err == nil {
			t.Errorf("%q hoort een fout te geven", fout)
		}
	}
}

func TestTypeToegestaan(t *testing.T) {
	p := []string{"koppeling*", "edienstversiekoppeling"}
	for typ, want := range map[string]bool{
		"Koppeling": true, "KoppelingNaam_Data": true, "EDienstversieKoppeling": true,
		"EDienstversie": false, "EDienstversieKoppelingen": false, "Component": false, "": false,
	} {
		if got := TypeToegestaan(p, typ); got != want {
			t.Errorf("%q: %v, verwacht %v", typ, got, want)
		}
	}
}

func TestSchrijffilterVoor_OngeldigIsFailClosed(t *testing.T) {
	t.Setenv(SchrijffilterEnv, "omnium-koppelaar=ko*ppeling")
	if p, beperkt := SchrijffilterVoor("omnium-koppelaar"); !beperkt || len(p) != 0 {
		t.Fatalf("genoemd account bij een ongeldig filter: %v %v (verwacht beperkt, geen patronen)", p, beperkt)
	}
	if _, beperkt := SchrijffilterVoor("iemand-anders"); beperkt {
		t.Fatal("een niet-genoemd account hoort geen filter te krijgen")
	}
	if !strings.Contains(BeschrijfSchrijffilter(nil), "FOUT schrijffilter") {
		t.Fatal("opstartregel hoort de fout te noemen")
	}
}

func TestSchrijffilterUitContext(t *testing.T) {
	t.Setenv(SchrijffilterEnv, "omnium-koppelaar=koppeling*")
	ctx := MetClaims(context.Background(), &JWTClaims{Gebruikersnaam: "Omnium-Koppelaar", Rol: "bouwer"})
	if _, _, beperkt := SchrijffilterUitContext(ctx); beperkt {
		t.Fatal("zonder AUTH_ENABLED geen filter (dev)")
	}
	t.Setenv("AUTH_ENABLED", "true")
	if _, p, beperkt := SchrijffilterUitContext(ctx); !beperkt || !reflect.DeepEqual(p, []string{"koppeling*"}) {
		t.Fatalf("got %v %v", p, beperkt)
	}
	if _, _, beperkt := SchrijffilterUitContext(AlsSysteem(ctx)); beperkt {
		t.Fatal("een systeemaanroep heeft geen filter")
	}
}

// Een account met een filter mag boven lezer alleen POST /registratie/; lezen en andere
// accounts blijven zoals ze waren.
func TestControleerRol_Schrijffilter(t *testing.T) {
	t.Setenv("AUTH_ENABLED", "true")
	t.Setenv(SchrijffilterEnv, "omnium-koppelaar=koppeling*")
	gin.SetMode(gin.TestMode)
	r := gin.New()
	zet := func(naam string) gin.HandlerFunc {
		return func(c *gin.Context) {
			c.Set(ContextKeyGebruiker, &JWTClaims{Gebruikersnaam: naam, Rol: "bouwer"})
		}
	}
	ok := func(c *gin.Context) { c.Status(http.StatusOK) }
	for _, naam := range []string{"omnium-koppelaar", "bouwer-jan"} {
		g := r.Group("/" + naam)
		g.Use(zet(naam))
		g.POST("/registratie/", RequireRol("editor"), ok)
		g.PATCH("/registraties/:id", RequireRol("editor"), ok)
		g.POST("/api/schema/model", RequireRol("editor"), ok)
		g.GET("/full/koppelingen", RequireRol("viewer"), ok)
	}
	// De gegroepeerde route heet /<naam>/registratie/; voor de test volstaat dat de echte
	// route /registratie/ is: zet die ook ongegroepeerd.
	r.POST("/registratie/", zet("omnium-koppelaar"), RequireRol("editor"), ok)

	cases := []struct {
		methode, pad string
		want         int
	}{
		{"POST", "/registratie/", 200},
		{"PATCH", "/omnium-koppelaar/registraties/1", 403},
		{"POST", "/omnium-koppelaar/api/schema/model", 403},
		{"GET", "/omnium-koppelaar/full/koppelingen", 200},
		{"POST", "/omnium-koppelaar/registratie/", 403}, // ander pad dan /registratie/
		{"PATCH", "/bouwer-jan/registraties/1", 200},
		{"POST", "/bouwer-jan/api/schema/model", 200},
	}
	for _, tc := range cases {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(tc.methode, tc.pad, nil))
		if w.Code != tc.want {
			t.Errorf("%s %s: %d, verwacht %d (%s)", tc.methode, tc.pad, w.Code, tc.want, w.Body.String())
		}
		if w.Code == 403 && !strings.Contains(w.Body.String(), "schrijffilter") {
			t.Errorf("%s %s: melding noemt het schrijffilter niet: %s", tc.methode, tc.pad, w.Body.String())
		}
	}
}
