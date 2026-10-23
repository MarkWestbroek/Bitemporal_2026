package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initConfiguratieEnumRegistry() {
	EnumWaarden["FormulierDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["FormulierDefinitieStatus"] = "configuratie"
	EnumConstNamen["FormulierDefinitieStatus"] = map[string]string{"concept": "FormulierDefinitieStatusconcept", "actief": "FormulierDefinitieStatusactief", "inactief": "FormulierDefinitieStatusinactief"}
	EnumWaarden["WeergaveDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["WeergaveDefinitieStatus"] = "configuratie"
	EnumConstNamen["WeergaveDefinitieStatus"] = map[string]string{"concept": "WeergaveDefinitieStatusconcept", "actief": "WeergaveDefinitieStatusactief", "inactief": "WeergaveDefinitieStatusinactief"}
	EnumWaarden["QueryDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["QueryDefinitieStatus"] = "configuratie"
	EnumConstNamen["QueryDefinitieStatus"] = map[string]string{"concept": "QueryDefinitieStatusconcept", "actief": "QueryDefinitieStatusactief", "inactief": "QueryDefinitieStatusinactief"}
	EnumWaarden["QueryDefinitieToegankelijkheid"] = []string{"publiek", "intern"}
	EnumDomeinen["QueryDefinitieToegankelijkheid"] = "configuratie"
	EnumConstNamen["QueryDefinitieToegankelijkheid"] = map[string]string{"publiek": "QueryDefinitieToegankelijkheidpubliek", "intern": "QueryDefinitieToegankelijkheidintern"}
	EnumWaarden["NotificatieDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["NotificatieDefinitieStatus"] = "configuratie"
	EnumConstNamen["NotificatieDefinitieStatus"] = map[string]string{"concept": "NotificatieDefinitieStatusconcept", "actief": "NotificatieDefinitieStatusactief", "inactief": "NotificatieDefinitieStatusinactief"}
	EnumWaarden["NotificatieKanaal"] = []string{"email", "webhook"}
	EnumDomeinen["NotificatieKanaal"] = "configuratie"
	EnumConstNamen["NotificatieKanaal"] = map[string]string{"email": "NotificatieKanaalemail", "webhook": "NotificatieKanaalwebhook"}
	EnumWaarden["NotificatieRegistratietype"] = []string{"registratie", "correctie", "ongedaanmaking", "alle"}
	EnumDomeinen["NotificatieRegistratietype"] = "configuratie"
	EnumConstNamen["NotificatieRegistratietype"] = map[string]string{"registratie": "NotificatieRegistratietyperegistratie", "correctie": "NotificatieRegistratietypecorrectie", "ongedaanmaking": "NotificatieRegistratietypeongedaanmaking", "alle": "NotificatieRegistratietypealle"}
	EnumWaarden["DashboardDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["DashboardDefinitieStatus"] = "configuratie"
	EnumConstNamen["DashboardDefinitieStatus"] = map[string]string{"concept": "DashboardDefinitieStatusconcept", "actief": "DashboardDefinitieStatusactief", "inactief": "DashboardDefinitieStatusinactief"}
	EnumWaarden["DashboardWeergave"] = []string{"aantal", "tabel", "lijst"}
	EnumDomeinen["DashboardWeergave"] = "configuratie"
	EnumConstNamen["DashboardWeergave"] = map[string]string{"aantal": "DashboardWeergaveaantal", "tabel": "DashboardWeergavetabel", "lijst": "DashboardWeergavelijst"}
	EnumWaarden["LijstDefinitieStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["LijstDefinitieStatus"] = "configuratie"
	EnumConstNamen["LijstDefinitieStatus"] = map[string]string{"concept": "LijstDefinitieStatusconcept", "actief": "LijstDefinitieStatusactief", "inactief": "LijstDefinitieStatusinactief"}
	EnumWaarden["UitlegStatus"] = []string{"concept", "actief", "inactief"}
	EnumDomeinen["UitlegStatus"] = "configuratie"
	EnumConstNamen["UitlegStatus"] = map[string]string{"concept": "UitlegStatusconcept", "actief": "UitlegStatusactief", "inactief": "UitlegStatusinactief"}
	EnumWaarden["UitlegTaal"] = []string{"nl", "en", "de", "fr", "fy"}
	EnumDomeinen["UitlegTaal"] = "configuratie"
	EnumConstNamen["UitlegTaal"] = map[string]string{"nl": "UitlegTaalnl", "en": "UitlegTaalen", "de": "UitlegTaalde", "fr": "UitlegTaalfr", "fy": "UitlegTaalfy"}
	EnumWaarden["UitlegSoort"] = []string{"inhoud", "vorm"}
	EnumDomeinen["UitlegSoort"] = "configuratie"
	EnumConstNamen["UitlegSoort"] = map[string]string{"inhoud": "UitlegSoortinhoud", "vorm": "UitlegSoortvorm"}

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["FormulierDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 2895, Y: -330}}
	EnumEditorLayouts["WeergaveDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 3480, Y: -315}}
	EnumEditorLayouts["QueryDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 4330, Y: -315}}
	EnumEditorLayouts["QueryDefinitieToegankelijkheid"] = &EditorLayout{Positie: &V3Positie{X: 4580, Y: -315}}
	EnumEditorLayouts["NotificatieDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 5330, Y: -330}}
	EnumEditorLayouts["NotificatieKanaal"] = &EditorLayout{Positie: &V3Positie{X: 5530, Y: -330}}
	EnumEditorLayouts["NotificatieRegistratietype"] = &EditorLayout{Positie: &V3Positie{X: 5730, Y: -330}}
	EnumEditorLayouts["DashboardDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 6130, Y: -330}}
	EnumEditorLayouts["DashboardWeergave"] = &EditorLayout{Positie: &V3Positie{X: 6330, Y: -330}}
	EnumEditorLayouts["LijstDefinitieStatus"] = &EditorLayout{Positie: &V3Positie{X: 4280, Y: -315}}
	EnumEditorLayouts["UitlegStatus"] = &EditorLayout{Positie: &V3Positie{X: 5130, Y: -315}}
	EnumEditorLayouts["UitlegTaal"] = &EditorLayout{Positie: &V3Positie{X: 5380, Y: -315}}
	EnumEditorLayouts["UitlegSoort"] = &EditorLayout{Positie: &V3Positie{X: 5630, Y: -315}}
}
