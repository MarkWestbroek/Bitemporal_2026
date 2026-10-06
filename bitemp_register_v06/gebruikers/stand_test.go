package gebruikers

import "testing"

func TestHoogsteRolEnMagInloggen(t *testing.T) {
	gevallen := []struct {
		naam  string
		stand Stand
		rol   string
		inlog bool
	}{
		{"geen rol", Stand{Status: StatusActief}, "", false},
		{"editor", Stand{Status: StatusActief, Rollen: []Rol{{Rol: "editor"}}}, "editor", true},
		{"hoogste telt", Stand{Status: StatusActief, Rollen: []Rol{{Rol: "viewer"}, {Rol: "admin"}, {Rol: "editor"}}}, "admin", true},
		{"rol met domein telt niet", Stand{Status: StatusActief, Rollen: []Rol{{Rol: "admin", Domein: "CG"}}}, "", false},
		{"geblokkeerd", Stand{Status: StatusGeblokkeerd, Rollen: []Rol{{Rol: "admin"}}}, "admin", false},
		{"onbekende rol", Stand{Status: StatusActief, Rollen: []Rol{{Rol: "superuser"}}}, "", false},
	}
	for _, g := range gevallen {
		if got := g.stand.HoogsteRol(); got != g.rol {
			t.Errorf("%s: HoogsteRol = %q, want %q", g.naam, got, g.rol)
		}
		if got := g.stand.MagInloggen(); got != g.inlog {
			t.Errorf("%s: MagInloggen = %v, want %v", g.naam, got, g.inlog)
		}
	}
}
