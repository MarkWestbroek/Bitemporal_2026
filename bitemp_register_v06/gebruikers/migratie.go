package gebruikers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// MigreerOudeGebruikers zet de rijen uit gebruiker_oud (de platte tabel van vóór het
// gebruikersbeheer; dbsetup/gebruiker_tabellen.go hernoemt hem) over naar een Gebruiker in het
// register plus gebruiker_inlog. Idempotent: een gebruikersnaam die al in het register staat
// wordt overgeslagen. Hashes gaan ongewijzigd mee, dus iedereen houdt zijn wachtwoord.
// gebruiker_oud blijft staan; verwijder hem met de hand als alles klopt.
func MigreerOudeGebruikers(ctx context.Context) error {
	var bestaat bool
	if err := handlers.DB.NewRaw(`SELECT to_regclass('gebruiker_oud') IS NOT NULL`).Scan(ctx, &bestaat); err != nil {
		return err
	}
	if !bestaat {
		return nil
	}
	var oud []model.GebruikerOud
	if err := handlers.DB.NewSelect().Model(&oud).Order("id ASC").Scan(ctx); err != nil {
		return fmt.Errorf("gebruiker_oud lezen: %w", err)
	}
	overgezet := 0
	for _, o := range oud {
		bestaand, err := Zoek(ctx, o.Gebruikersnaam, time.Now())
		if err != nil {
			return err
		}
		if bestaand != nil {
			continue
		}
		status := StatusActief
		if !o.Actief {
			status = StatusGeblokkeerd
		}
		rol := strings.ToLower(strings.TrimSpace(o.Rol))
		if _, ok := rolNiveau[rol]; !ok {
			rol = "viewer"
		}
		id, err := MaakAan(ctx, NieuweGebruiker{
			Gebruikersnaam: o.Gebruikersnaam, Email: o.Email, Status: status, Rol: rol,
			Opmerking: fmt.Sprintf("Overgezet uit de oude tabel gebruiker (id %d)", o.ID),
		})
		if err != nil {
			return err
		}
		if err := zetHash(ctx, id, o.WachtwoordHash); err != nil {
			return fmt.Errorf("hash van %q overzetten: %w", o.Gebruikersnaam, err)
		}
		if o.LaatsteLoginOp != nil {
			_, _ = handlers.DB.NewUpdate().Model((*model.GebruikerInlog)(nil)).
				Set("laatste_login_op = ?", *o.LaatsteLoginOp).Where("gebruiker_id = ?", id).Exec(ctx)
		}
		overgezet++
	}
	if overgezet > 0 {
		fmt.Printf("gebruikersbeheer: %d gebruiker(s) uit gebruiker_oud overgezet naar het register\n", overgezet)
	}
	return nil
}
