package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initConfiguratieEnumRegistry() {
	EnumWaarden["FormulierDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["FormulierDefinitieStatus"] = "configuratie"
	EnumWaarden["WeergaveDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["WeergaveDefinitieStatus"] = "configuratie"
	EnumWaarden["QueryDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["QueryDefinitieStatus"] = "configuratie"

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["FormulierDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 2895, Y: -330}}
	EnumEditorLayouts["WeergaveDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 3480, Y: -315}}
	EnumEditorLayouts["QueryDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 4330, Y: -315}}
}
