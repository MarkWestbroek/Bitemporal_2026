package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initCgEnumRegistry() {
	EnumWaarden["OrganisatieType"] = []string{"Gemeente", "Leverancier"}
	EnumDomeinen["OrganisatieType"] = "CG"
	EnumWaarden["Producttype"] = []string{"Component", "Toepassing"}
	EnumDomeinen["Producttype"] = "CG"
	EnumWaarden["Fase"] = []string{"Idee", "Verkenning", "Realisatie", "InGebruik"}
	EnumDomeinen["Fase"] = "CG"
	EnumWaarden["Schaal"] = []string{"1", "2", "3", "4"}
	EnumDomeinen["Schaal"] = "CG"
	EnumWaarden["Bijdragetype"] = []string{"Wendbaarheid", "Dienstverlening", "Regie"}
	EnumDomeinen["Bijdragetype"] = "CG"
	EnumWaarden["CGLaag"] = []string{"Laag 5", "Laag 4", "Laag 3", "Laag 2", "Laag 1", "Hosting en infrastructuur"}
	EnumDomeinen["CGLaag"] = "CG"

	// Enum editor-posities
	EnumEditorLayouts["OrganisatieType"] = &EditorLayout{Positie: &V3Positie{X: 270, Y: 75}}
	EnumEditorLayouts["Producttype"] = &EditorLayout{Positie: &V3Positie{X: 765, Y: 330}}
	EnumEditorLayouts["Fase"] = &EditorLayout{Positie: &V3Positie{X: 405, Y: 450}}
	EnumEditorLayouts["Schaal"] = &EditorLayout{Positie: &V3Positie{X: 1365, Y: 225}}
	EnumEditorLayouts["Bijdragetype"] = &EditorLayout{Positie: &V3Positie{X: 1380, Y: 60}}
	EnumEditorLayouts["CGLaag"] = &EditorLayout{Positie: &V3Positie{X: 885, Y: 465}}
}
