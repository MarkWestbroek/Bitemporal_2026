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
	EnumWaarden["QueryDefinitieToegankelijkheid"] = []string{"publiek", "intern"}
	EnumDomeinen["QueryDefinitieToegankelijkheid"] = "configuratie"

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["FormulierDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 2895, Y: -330}}
	EnumEditorLayouts["WeergaveDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 3480, Y: -315}}
	EnumEditorLayouts["QueryDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 4330, Y: -315}}
	EnumEditorLayouts["QueryDefinitieToegankelijkheid"] = &EditorLayout{Positie: &V3Positie{X: 4580, Y: -315}}
	EnumWaarden["NotificatieDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["NotificatieDefinitieStatus"] = "configuratie"
	EnumWaarden["NotificatieKanaal"] = []string{"email", "webhook"}
	EnumDomeinen["NotificatieKanaal"] = "configuratie"
	EnumWaarden["NotificatieRegistratietype"] = []string{"registratie", "correctie", "ongedaanmaking", "alle"}
	EnumDomeinen["NotificatieRegistratietype"] = "configuratie"
	EnumEditorLayouts["NotificatieDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 5330, Y: -330}}
	EnumEditorLayouts["NotificatieKanaal"] = &EditorLayout{Positie: &V3Positie{X: 5530, Y: -330}}
	EnumEditorLayouts["NotificatieRegistratietype"] = &EditorLayout{Positie: &V3Positie{X: 5730, Y: -330}}
}
