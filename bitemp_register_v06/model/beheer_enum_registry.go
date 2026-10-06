package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initBeheerEnumRegistry() {
	EnumWaarden["Gebruikersstatus"] = []string{"actief", "geblokkeerd"}
	EnumDomeinen["Gebruikersstatus"] = "beheer"
	EnumWaarden["Gebruikersrol"] = []string{"viewer", "editor", "admin"}
	EnumDomeinen["Gebruikersrol"] = "beheer"

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["Gebruikersstatus"] = &EditorLayout{Positie: &V3Positie{X: 300, Y: 500}}
	EnumEditorLayouts["Gebruikersrol"] = &EditorLayout{Positie: &V3Positie{X: 600, Y: 500}}
}
