package gebruikers

import (
	"strings"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestValideerUitnodiging(t *testing.T) {
	goed := func() uitnodigingInvoer {
		return uitnodigingInvoer{Email: " a@b.nl ", Rol: "modelleur",
			Projecten: []UitnodigingProject{{ID: "probeer-0001", Recht: "schrijven"}}}
	}
	in := goed()
	if msg := valideerUitnodiging(&in); msg != "" || in.Email != "a@b.nl" || in.Dagen != 7 {
		t.Fatalf("goed geval: %q %+v", msg, in)
	}
	for naam, pas := range map[string]func(*uitnodigingInvoer){
		"geen e-mail":    func(u *uitnodigingInvoer) { u.Email = "geen-adres" },
		"naam in adres":  func(u *uitnodigingInvoer) { u.Email = "Piet <a@b.nl>" },
		"oude rolnaam":   func(u *uitnodigingInvoer) { u.Rol = "admin" },
		"onbekende rol":  func(u *uitnodigingInvoer) { u.Rol = "god" },
		"te lang geldig": func(u *uitnodigingInvoer) { u.Dagen = 31 },
		"recht beheren":  func(u *uitnodigingInvoer) { u.Projecten[0].Recht = "beheren" },
		"project dubbel": func(u *uitnodigingInvoer) { u.Projecten = append(u.Projecten, u.Projecten[0]) },
	} {
		in := goed()
		pas(&in)
		if valideerUitnodiging(&in) == "" {
			t.Errorf("%s: verwacht een fout", naam)
		}
	}
}

func TestValideerAccepteer(t *testing.T) {
	for _, g := range []struct {
		naam, ww string
		goed     bool
	}{
		{"hugo", "lang-genoeg-1", true},
		{"anna.de-vries_2", "lang-genoeg-1", true},
		{"ab", "lang-genoeg-1", false},    // te kort
		{"-hugo", "lang-genoeg-1", false}, // begint met teken
		{"hugo met spatie", "lang-genoeg-1", false},
		{"hugo", "kort", false},
		{"hugo", strings.Repeat("x", 201), false},
	} {
		in := accepteerInvoer{Gebruikersnaam: g.naam, Wachtwoord: g.ww}
		if (valideerAccepteer(&in) == "") != g.goed {
			t.Errorf("%q/%d tekens: goed=%v verwacht", g.naam, len(g.ww), g.goed)
		}
	}
}

func TestTokenEnStatus(t *testing.T) {
	token, hash, err := maakToken()
	if err != nil || len(token) < 40 || hash != hashToken(token) || hash == token {
		t.Fatalf("token %q hash %q err %v", token, hash, err)
	}
	t2, _, _ := maakToken()
	if t2 == token {
		t.Fatal("twee gelijke tokens")
	}
	nu := time.Now()
	u := &model.GebruikerUitnodiging{Verloopt: nu.Add(time.Hour)}
	if UitnodigingStatus(u, nu) != "open" {
		t.Error("open")
	}
	if UitnodigingStatus(u, nu.Add(2*time.Hour)) != "verlopen" {
		t.Error("verlopen")
	}
	u.IngetrokkenOp = &nu
	if UitnodigingStatus(u, nu) != "ingetrokken" {
		t.Error("ingetrokken")
	}
	u.GeaccepteerdOp = &nu
	if UitnodigingStatus(u, nu) != "geaccepteerd" {
		t.Error("geaccepteerd gaat voor")
	}
}
