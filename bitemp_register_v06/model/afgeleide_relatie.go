package model

import "strings"

// DoelIDSleutel is de JSON-sleutel van het doel-id in een voorkomen van een afgeleide relatie
// in /full (bijv. "gemeentedeel_id"). Zelfde conventie als SecondaireEntiteitIDKolom van een
// gewone relatie, zodat de frontend het voorkomen net zo kan tonen.
func (ar AfgeleideRelatie) DoelIDSleutel() string {
	return strings.ToLower(ar.DoelEntiteit) + "_id"
}
