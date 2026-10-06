package middleware

import (
	"context"
	"errors"
	"testing"
)

func TestActueleClaims(t *testing.T) {
	defer ZetGebruikerResolver(nil)
	token := &JWTClaims{Gebruikersnaam: "jan", Rol: "admin"}

	// Zonder resolver gelden de claims uit het token.
	ZetGebruikerResolver(nil)
	if got := actueleClaims(context.Background(), token); got != token {
		t.Fatalf("zonder resolver: claims gewijzigd")
	}

	// De rol komt uit het register, niet uit het token.
	aanroepen := 0
	ZetGebruikerResolver(func(ctx context.Context, naam string) (GebruikerStand, bool, error) {
		aanroepen++
		return GebruikerStand{Rol: "viewer", Email: "j@x.nl"}, true, nil
	})
	got := actueleClaims(context.Background(), token)
	if got == nil || got.Rol != "viewer" || got.Email != "j@x.nl" {
		t.Fatalf("rol uit register verwacht, kreeg %+v", got)
	}
	if token.Rol != "admin" {
		t.Fatalf("token-claims mogen niet in place veranderen")
	}
	actueleClaims(context.Background(), token)
	if aanroepen != 1 {
		t.Fatalf("tweede opzoeking moet uit de cache komen, resolver %d× aangeroepen", aanroepen)
	}

	// Geblokkeerd / geen rol → anoniem.
	ZetGebruikerResolver(func(ctx context.Context, naam string) (GebruikerStand, bool, error) {
		return GebruikerStand{}, false, nil
	})
	if got := actueleClaims(context.Background(), token); got != nil {
		t.Fatalf("geblokkeerde gebruiker moet anoniem worden, kreeg %+v", got)
	}

	// Een storing sluit niemand buiten: de token-claims blijven gelden.
	ZetGebruikerResolver(func(ctx context.Context, naam string) (GebruikerStand, bool, error) {
		return GebruikerStand{}, false, errors.New("db weg")
	})
	if got := actueleClaims(context.Background(), token); got != token {
		t.Fatalf("bij een fout horen de token-claims te blijven gelden")
	}
}

func TestMagBeheren(t *testing.T) {
	t.Setenv("AUTH_ENABLED", "true")
	ctx := context.Background()
	if MagBeheren(ctx) {
		t.Error("anoniem mag niet beheren")
	}
	if MagBeheren(MetClaims(ctx, &JWTClaims{Rol: "editor"})) {
		t.Error("editor mag niet beheren")
	}
	if !MagBeheren(MetClaims(ctx, &JWTClaims{Rol: "admin"})) {
		t.Error("admin mag beheren")
	}
	if !MagBeheren(AlsSysteem(ctx)) {
		t.Error("systeemaanroep (seed, migratie) mag beheren")
	}
	t.Setenv("AUTH_ENABLED", "false")
	if !MagBeheren(ctx) {
		t.Error("met auth uit is alles open")
	}
}
