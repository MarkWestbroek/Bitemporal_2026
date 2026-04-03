package model

// enum_registry.go registreert alle bekende enum-type waarden.
// Wordt gebruikt door de schema-API handler om correcte dropdowns te genereren.
// Kan in de toekomst door codegen gegenereerd worden.

func init() {
	// v05 enums
	EnumWaarden["RelABSoort"] = []string{"LTT", "LAT", "LTA"}
	EnumDomeinen["RelABSoort"] = "abuvwxy"
	EnumWaarden["ABCEnum"] = []string{"Optie A", "Optie B", "Optie C"}
	EnumDomeinen["ABCEnum"] = "abuvwxy"

	// Enum editor-posities

}
