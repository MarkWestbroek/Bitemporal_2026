package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initConfiguratieEnumRegistry() {
	EnumWaarden["FormulierDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["FormulierDefinitieStatus"] = "configuratie"
	EnumWaarden["WeergaveDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["WeergaveDefinitieStatus"] = "configuratie"

	// Enum editor-posities
	EnumEditorLayouts["FormulierDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 2535, Y: 540}}
	EnumEditorLayouts["WeergaveDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 3090, Y: 540}}
}
