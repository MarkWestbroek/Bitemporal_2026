package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initConfiguratieEnumRegistry() {
	EnumWaarden["FormulierDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["FormulierDefinitieStatus"] = "configuratie"
	EnumWaarden["WeergaveDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["WeergaveDefinitieStatus"] = "configuratie"

	// Enum editor-posities
	EnumEditorLayouts["FormulierDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 2895, Y: -330}}
	EnumEditorLayouts["WeergaveDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 3480, Y: -315}}
}
