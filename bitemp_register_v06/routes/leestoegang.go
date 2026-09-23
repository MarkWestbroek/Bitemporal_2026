package routes

import (
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// Domein van de platform-eigen definities (WeergaveDefinitie, FormulierDefinitie,
// QueryDefinitie). Zie docs/CODEGEN.md §2.
const configuratieDomein = "configuratie"

// OpenbaarLeesbaar meldt of een type ook met de poort dicht (LEESTOEGANG=documenten) anoniem
// gelezen mag worden. Dat zijn geen registerdata maar configuratie en naslag, en de
// publicatiepagina heeft ze nodig om überhaupt te kunnen tekenen:
//   - het configuratie-domein: de WeergaveDefinitie bepaalt kolommen en template, de
//     QueryDefinitie is het gepubliceerde contract zelf;
//   - referentielijsten (Gemeente, Domein, …): naslag zonder persoons- of bedrijfsgegevens.
//
// Alles wordt uit het model afgeleid; er staat geen typenaam in.
//
// Kanttekening: hiermee is ook de tekst van een *interne* QueryDefinitie leesbaar (niet de
// data die hij oplevert). Wie dat niet wil, zet het document op status concept of maakt de
// lookup van definities zelf een opgeslagen document.
func OpenbaarLeesbaar(meta model.TypeMeta) bool {
	if meta.Domein == configuratieDomein {
		return true
	}
	switch meta.EntiteitSubtype {
	case model.EntiteitSubtypeReferentielijst, model.EntiteitSubtypeReferentielijstItem:
		return true
	}
	return false
}

// lezer geeft de leesguard voor een type: geen guard voor openbaar leesbare typen,
// anders RequireLezer (no-op zolang LEESTOEGANG=open of AUTH_ENABLED=false).
func lezer(meta model.TypeMeta) gin.HandlerFunc {
	if OpenbaarLeesbaar(meta) {
		return func(c *gin.Context) { c.Next() }
	}
	return middleware.RequireLezer()
}
