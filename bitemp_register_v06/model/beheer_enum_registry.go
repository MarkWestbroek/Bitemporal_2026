package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initBeheerEnumRegistry() {
	EnumWaarden["Gebruikersstatus"] = []string{"actief", "geblokkeerd"}
	EnumDomeinen["Gebruikersstatus"] = "beheer"
	EnumConstNamen["Gebruikersstatus"] = map[string]string{"actief": "Gebruikersstatusactief", "geblokkeerd": "Gebruikersstatusgeblokkeerd"}
	EnumWaarden["Gebruikersrol"] = []string{"viewer", "editor", "admin", "lezer", "modelleur", "ontwerper", "bouwer", "beheerder"}
	EnumDomeinen["Gebruikersrol"] = "beheer"
	EnumConstNamen["Gebruikersrol"] = map[string]string{"viewer": "Gebruikersrolviewer", "editor": "Gebruikersroleditor", "admin": "Gebruikersroladmin", "lezer": "Gebruikersrollezer", "modelleur": "Gebruikersrolmodelleur", "ontwerper": "Gebruikersrolontwerper", "bouwer": "Gebruikersrolbouwer", "beheerder": "Gebruikersrolbeheerder"}

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["Gebruikersstatus"] = &EditorLayout{Positie: &V3Positie{X: 300, Y: 500}}
	EnumEditorLayouts["Gebruikersrol"] = &EditorLayout{Positie: &V3Positie{X: 600, Y: 500}}
}
