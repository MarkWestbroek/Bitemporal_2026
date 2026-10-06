package gebruikers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"golang.org/x/crypto/bcrypt"
)

// bron in de registratie, zodat seed en migratie in de geschiedenis herkenbaar zijn.
const bron = "gebruikersbeheer"

// NieuweGebruiker is wat MaakAan vastlegt.
type NieuweGebruiker struct {
	Gebruikersnaam string
	Weergavenaam   string
	Email          string
	Status         string // leeg = actief
	Rol            string // viewer, editor of admin
	Opmerking      string // in de registratie
}

// MaakAan registreert een nieuwe Gebruiker (identiteit, status, één roltoewijzing) in één
// registratie via de engine, als systeemaanroep. Geeft de id van de hub. Het wachtwoord gaat
// apart (ZetWachtwoord), zodat de hash nooit in de registratie (request_body) belandt.
func MaakAan(ctx context.Context, n NieuweGebruiker) (int, error) {
	if n.Status == "" {
		n.Status = StatusActief
	}
	const g = "$nieuw.gebruiker"
	identiteit := map[string]any{"gebruiker_id": g, "gebruikersnaam": n.Gebruikersnaam}
	if n.Weergavenaam != "" {
		identiteit["weergavenaam"] = n.Weergavenaam
	}
	if n.Email != "" {
		identiteit["email"] = n.Email
	}
	wijzigingen := []map[string]any{
		{"opvoer": map[string]any{"gebruiker": map[string]any{"id": g}}},
		{"opvoer": map[string]any{"gebruikeridentiteit": identiteit}},
		{"opvoer": map[string]any{"gebruikerstatus": map[string]any{"gebruiker_id": g, "status": n.Status}}},
		{"opvoer": map[string]any{"gebruikerroltoewijzing": map[string]any{"gebruiker_id": g, "rol": n.Rol}}},
	}
	b := bron
	opmerking := n.Opmerking
	raw, err := json.Marshal(map[string]any{
		"registratie": model.Registratie{Registratietype: model.RegistratietypeRegistratie, Bron: &b, Opmerking: &opmerking},
		"wijzigingen": wijzigingen,
	})
	if err != nil {
		return 0, err
	}
	res, rerr := handlers.RegistreerJSONCore(middleware.AlsSysteem(ctx), raw, model.RegistratietypeRegistratie,
		handlers.AuditMeta{RawBody: raw, RequestPath: "/intern/gebruikersbeheer", RequestMethod: "POST"})
	if rerr != nil {
		return 0, fmt.Errorf("registratie van gebruiker %q: %s", n.Gebruikersnaam, rerr.Msg)
	}
	id := res.ToegekendeIDs[g]
	if id == 0 {
		return 0, fmt.Errorf("registratie van gebruiker %q gaf geen id terug", n.Gebruikersnaam)
	}
	return id, nil
}

// ZetWachtwoord hasht het wachtwoord en schrijft het in gebruiker_inlog (aanmaken of vervangen).
func ZetWachtwoord(ctx context.Context, gebruikerID int, wachtwoord string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(wachtwoord), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("bcrypt: %w", err)
	}
	return zetHash(ctx, gebruikerID, string(hash))
}

// zetHash schrijft een (bestaande) bcrypt-hash weg; ook gebruikt door de migratie.
func zetHash(ctx context.Context, gebruikerID int, hash string) error {
	inlog := &model.GebruikerInlog{GebruikerID: int64(gebruikerID), WachtwoordHash: hash, WachtwoordGewijzigdOp: time.Now()}
	_, err := handlers.DB.NewInsert().Model(inlog).
		On("CONFLICT (gebruiker_id) DO UPDATE").
		Set("wachtwoord_hash = EXCLUDED.wachtwoord_hash").
		Set("wachtwoord_gewijzigd_op = EXCLUDED.wachtwoord_gewijzigd_op").
		Exec(ctx)
	middleware.VergeetGebruikerStand()
	return err
}

// leesInlog geeft de inloggegevens van een gebruiker, of nil als er geen wachtwoord is gezet.
func leesInlog(ctx context.Context, gebruikerID int) (*model.GebruikerInlog, error) {
	var inlog model.GebruikerInlog
	err := handlers.DB.NewSelect().Model(&inlog).Where("gebruiker_id = ?", gebruikerID).Limit(1).Scan(ctx)
	if err != nil {
		if isGeenRij(err) {
			return nil, nil
		}
		return nil, err
	}
	return &inlog, nil
}
