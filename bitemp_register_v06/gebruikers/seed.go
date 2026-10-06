package gebruikers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"time"
)

// SeedAdmin maakt de admin uit ADMIN_USERNAME/ADMIN_PASSWORD (en optioneel ADMIN_EMAIL) aan
// als die nog niet bestaat. Bestaande gebruikers worden nooit overschreven; na de eerste keer
// mag ADMIN_PASSWORD uit de .env. Gaat via de registratie-engine (kip-en-ei: zonder deze admin
// kan niemand inloggen om de rest aan te maken).
func SeedAdmin(ctx context.Context) error {
	naam := os.Getenv("ADMIN_USERNAME")
	wachtwoord := os.Getenv("ADMIN_PASSWORD")
	if naam == "" || wachtwoord == "" {
		fmt.Println("AUTH: Geen ADMIN_USERNAME/ADMIN_PASSWORD ingesteld, standaard admin-seed overgeslagen.")
		return nil
	}
	bestaand, err := Zoek(ctx, naam, time.Now())
	if err != nil {
		return fmt.Errorf("seed admin: %w", err)
	}
	if bestaand != nil {
		fmt.Printf("AUTH: Admin-gebruiker '%s' bestaat al.\n", naam)
		return nil
	}
	id, err := MaakAan(ctx, NieuweGebruiker{
		Gebruikersnaam: naam, Email: os.Getenv("ADMIN_EMAIL"), Rol: "admin",
		Opmerking: "Eerste admin uit ADMIN_USERNAME (seed)",
	})
	if err != nil {
		return fmt.Errorf("seed admin: %w", err)
	}
	if err := ZetWachtwoord(ctx, id, wachtwoord); err != nil {
		return fmt.Errorf("seed admin: wachtwoord: %w", err)
	}
	fmt.Printf("AUTH: Admin-gebruiker '%s' aangemaakt (Gebruiker %d).\n", naam, id)
	return nil
}

func isGeenRij(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}
