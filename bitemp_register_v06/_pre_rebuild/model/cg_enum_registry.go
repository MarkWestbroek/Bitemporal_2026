package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initCgEnumRegistry() {
	EnumWaarden["Producttype"] = []string{"Component", "Toepassing"}
	EnumDomeinen["Producttype"] = "CG"
	EnumWaarden["Fase"] = []string{"Idee", "Verkenning", "Realisatie", "InGebruik"}
	EnumDomeinen["Fase"] = "CG"
	EnumWaarden["Schaal"] = []string{"Schaal 1", "Schaal 2", "Schaal 3", "Schaal 4"}
	EnumDomeinen["Schaal"] = "CG"
	EnumWaarden["Bijdragetype"] = []string{"Wendbaarheid", "Dienstverlening", "Regie"}
	EnumDomeinen["Bijdragetype"] = "CG"
	EnumWaarden["CGLaag"] = []string{"Laag 5", "Laag 4", "Laag 3", "Laag 2", "Laag 1", "Hosting en infrastructuur"}
	EnumDomeinen["CGLaag"] = "CG"
	EnumWaarden["Organisatierol"] = []string{"Contactorganisatie", "BetrokkenOrganisatie"}
	EnumDomeinen["Organisatierol"] = "CG"
	EnumWaarden["Gemeenterol"] = []string{"Realiseert", "Maakt gebruik van"}
	EnumDomeinen["Gemeenterol"] = "CG"

	// Enum editor-posities
	EnumEditorLayouts["Producttype"] = &EditorLayout{Positie: &V3Positie{X: 765, Y: 330}}
	EnumEditorLayouts["Fase"] = &EditorLayout{Positie: &V3Positie{X: 390, Y: 480}}
	EnumEditorLayouts["Schaal"] = &EditorLayout{Positie: &V3Positie{X: 1380, Y: 225}}
	EnumEditorLayouts["Bijdragetype"] = &EditorLayout{Positie: &V3Positie{X: 1380, Y: 60}}
	EnumEditorLayouts["CGLaag"] = &EditorLayout{Positie: &V3Positie{X: 885, Y: 465}}
	EnumEditorLayouts["Organisatierol"] = &EditorLayout{Positie: &V3Positie{X: 510, Y: -150}}
	EnumEditorLayouts["Gemeenterol"] = &EditorLayout{Positie: &V3Positie{X: 1170, Y: -870}}
}
