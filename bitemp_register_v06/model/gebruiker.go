package model

import (
	"time"

	"github.com/uptrace/bun"
)

// Rol bepaalt het autorisatieniveau van een gebruiker.
type Rol string

const (
	RolAdmin  Rol = "admin"
	RolEditor Rol = "editor"
	RolViewer Rol = "viewer"
)

// Gebruiker representeert een gebruiker van het register (authenticatie + autorisatie).
// Dit is een plumbing-tabel, geen bitemporele representatie.
type Gebruiker struct {
	bun.BaseModel `bun:"table:gebruiker,alias:g"`

	ID             int64      `bun:"id,pk,autoincrement" json:"id"`
	Gebruikersnaam string     `bun:"gebruikersnaam,notnull,unique" json:"gebruikersnaam"`
	WachtwoordHash string     `bun:"wachtwoord_hash,notnull" json:"-"` // nooit in JSON-response
	Email          string     `bun:"email" json:"email,omitempty"`
	Rol            Rol        `bun:"rol,notnull,default:'viewer'" json:"rol"`
	Actief         bool       `bun:"actief,notnull,default:true" json:"actief"`
	AangemaaktOp   time.Time  `bun:"aangemaakt_op,notnull,default:current_timestamp" json:"aangemaakt_op"`
	LaatsteLoginOp *time.Time `bun:"laatste_login_op" json:"laatste_login_op,omitempty"`
}
