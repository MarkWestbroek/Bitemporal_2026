package model

import "strings"

// PadSegmentMatcht meldt of een padsegment uit een afleidingsregel (bv. "Naam" in
// "Naam.naam") dit onderliggende element aanwijst: op rolnaam, JSON-rolnaam, de klassenaam
// van het doeltype, of het laatste deel van de typenaam (Initiatief_Planning → "Planning").
// Hoofdletterongevoelig.
//
// Afleidingsregels worden in de editor geschreven met de klassenaam (zoals hij in het
// diagram staat), terwijl de rolnaam vaak anders is: ApiStandaard heeft GE "Naam" met
// rolnaam "ApiStandaardNamen". Tot 24-09-2026 matchten de REST- en GraphQL-verrijking
// alleen op rolnaam, waardoor ApiStandaard.weergavenaam leeg bleef; Gemeente werkte
// toevallig omdat rolnaam "Gemeentegegevens" ≈ klassenaam "GemeenteGegevens".
func PadSegmentMatcht(child OnderliggendGegevenselement, deel string) bool {
	if strings.EqualFold(child.Rolnaam, deel) || strings.EqualFold(child.JSONRolnaam, deel) {
		return true
	}
	if cm, ok := MetaRegistry.GetTypeMeta(child.Doeltype); ok && cm.Klassenaam != "" && strings.EqualFold(cm.Klassenaam, deel) {
		return true
	}
	if i := strings.LastIndex(child.Doeltype, "_"); i >= 0 && strings.EqualFold(child.Doeltype[i+1:], deel) {
		return true
	}
	return false
}
