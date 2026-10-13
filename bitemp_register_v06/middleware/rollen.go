package middleware

// Rollen en hun rangorde (uitnodigen-plan 2026-10-12, besluit Mark 13-10): oplopend in impact
// van wat je maakt. De oude namen blijven geldig als alias, zodat bestaande gebruikers en
// RequireRol("editor"/"admin") hun betekenis houden:
//
//	1 lezer      (= viewer)  bekijken, documenten genereren
//	2 modelleur              modellen bewerken (Studio-projecten waar je schrijfrecht hebt)
//	3 ontwerper              + formulierdefinities, documentsjablonen, huisstijl
//	4 bouwer     (= editor)  + codegen, schema publiceren, EA-import, registratie
//	5 beheerder  (= admin)   + gebruikers, rollen, beleid
//
// Later worden rollen een referentielijst in domein beheer die de PIP levert; deze tabel is
// dan de afbeelding van rolcode op niveau.
var rolNiveaus = map[string]int{
	"lezer": 1, "viewer": 1,
	"modelleur": 2,
	"ontwerper": 3,
	"bouwer":    4, "editor": 4,
	"beheerder": 5, "admin": 5,
}

// Rollen die je nu toekent (de oude namen niet meer actief aanbieden).
var ToekenbareRollen = []string{"lezer", "modelleur", "ontwerper", "bouwer", "beheerder"}

// RolNiveau geeft het niveau van een rol (0 = onbekend of leeg).
func RolNiveau(rol string) int { return rolNiveaus[rol] }

// IsBeheerder: beheerder of admin.
func IsBeheerder(rol string) bool { return RolNiveau(rol) >= 5 }

// IsToekenbareRol: een rol die een beheerder nu mag toekennen (uitnodiging).
func IsToekenbareRol(rol string) bool {
	for _, r := range ToekenbareRollen {
		if r == rol {
			return true
		}
	}
	return false
}

// RollenTotEnMet: de rol zelf plus alle rolnamen (ook aliassen) van gelijk of lager niveau,
// zodat beleid op "viewer"/"lezer" ook voor een bouwer geldt (PEP-subject). Onbekende rol:
// alleen zichzelf.
func RollenTotEnMet(rol string) []string {
	n := RolNiveau(rol)
	if n == 0 {
		if rol == "" {
			return nil
		}
		return []string{rol}
	}
	uit := []string{rol}
	for _, r := range []string{"beheerder", "admin", "bouwer", "editor", "ontwerper", "modelleur", "lezer", "viewer"} {
		if r != rol && rolNiveaus[r] <= n {
			uit = append(uit, r)
		}
	}
	return uit
}
