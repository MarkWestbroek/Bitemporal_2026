package model

import (
	"time"

	"github.com/uptrace/bun"
)

// GebruikerInlog bevat de inloggegevens van een gebruiker. Plumbing, geen bitemporele
// representatie: wie iemand is, welke status en welke rollen staat in de gegenereerde
// entiteit Gebruiker (domein beheer, beheer_*.go). Hash en laatste login staan hier
// bewust buiten, zodat ze nooit in de registratiegeschiedenis of de gegenereerde API
// belanden. Zie docs/plans/gebruikersbeheer/.
type GebruikerInlog struct {
	bun.BaseModel `bun:"table:gebruiker_inlog,alias:gi"`

	// GebruikerID is de id van de hub `gebruiker` (de bitemporele entiteit).
	GebruikerID           int64      `bun:"gebruiker_id,pk" json:"gebruiker_id"`
	WachtwoordHash        string     `bun:"wachtwoord_hash,notnull" json:"-"` // nooit in JSON-response
	WachtwoordGewijzigdOp time.Time  `bun:"wachtwoord_gewijzigd_op,notnull,default:current_timestamp" json:"wachtwoord_gewijzigd_op"`
	LaatsteLoginOp        *time.Time `bun:"laatste_login_op" json:"laatste_login_op,omitempty"`
}

// GebruikerOud is de platte tabel van vóór het gebruikersbeheer (tot oktober 2026: één rij
// per gebruiker met hash, rol en actief). Bij de opstart wordt die tabel hernoemd naar
// gebruiker_oud en eenmalig overgezet naar de entiteit Gebruiker + gebruiker_inlog
// (handlers/gebruikers_migratie.go). De tabel blijft staan tot hij met de hand wordt
// verwijderd.
type GebruikerOud struct {
	bun.BaseModel `bun:"table:gebruiker_oud,alias:go"`

	ID             int64      `bun:"id,pk,autoincrement"`
	Gebruikersnaam string     `bun:"gebruikersnaam"`
	WachtwoordHash string     `bun:"wachtwoord_hash"`
	Email          string     `bun:"email"`
	Rol            string     `bun:"rol"`
	Actief         bool       `bun:"actief"`
	AangemaaktOp   time.Time  `bun:"aangemaakt_op"`
	LaatsteLoginOp *time.Time `bun:"laatste_login_op"`
}
