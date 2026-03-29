package model

// enum_registry.go registreert alle bekende enum-type waarden.
// Wordt gebruikt door de schema-API handler om correcte dropdowns te genereren.
// Kan in de toekomst door codegen gegenereerd worden.

func init() {
	// v05 enums
	EnumWaarden["RelABSoort"] = []string{"LTT", "LAT", "LTA"}
	EnumWaarden["ABCEnum"] = []string{"Optie A", "Optie B", "Optie C"}

	// v06 codegen enums
	EnumWaarden["Bereikbaarheidssoort"] = []string{"Woonadres", "Briefadres", "Correspondentieadres"}
	EnumWaarden["Naamgebruiksoort"] = []string{"EigenNaam", "PartnerNaam", "EigenNaam-PartnerNaam", "PartnerNaam-EigenNaam"}

	// Enum editor-posities
	EnumEditorLayouts["Bereikbaarheidssoort"] = &EditorLayout{Positie: &V3Positie{X: 330, Y: 45}}
	EnumEditorLayouts["Naamgebruiksoort"] = &EditorLayout{Positie: &V3Positie{X: 330, Y: 375}}
}
