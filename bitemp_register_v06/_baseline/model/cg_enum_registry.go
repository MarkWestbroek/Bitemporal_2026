package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initCgEnumRegistry() {
	EnumWaarden["Fase"] = []string{"Idee (nog geen concrete opbrengsten)", "Initiatie (al een snelle POC)", "Realisatie (gaat binnenkort draaien bij eerste gemeenten)", "Opschaling (draait bij enkele gemeenten, nu op zoek naar verbreding)", "Doorontwikkeling en beheer", "Doorontwikkeling en beheer (stabiel, onderdeel gevestigde orde)"}
	EnumDomeinen["Fase"] = "CG"
	EnumWaarden["Producttype"] = []string{"Component", "Toepassing", "Standaard"}
	EnumDomeinen["Producttype"] = "CG"
	EnumWaarden["CGLaag"] = []string{"Laag 5", "Laag 4", "Laag 3", "Laag 2", "Laag 1", "Hosting en infrastructuur"}
	EnumDomeinen["CGLaag"] = "CG"
	EnumWaarden["Bijdragetype"] = []string{"Wendbaarheid", "Dienstverlening", "Regie"}
	EnumDomeinen["Bijdragetype"] = "CG"
	EnumWaarden["Schaal"] = []string{"Schaal 1", "Schaal 2", "Schaal 3", "Schaal 4"}
	EnumDomeinen["Schaal"] = "CG"
	EnumWaarden["Organisatietype"] = []string{"Gemeenten", "Leveranciers", "VNG", "Ketenpartners", "Rijk"}
	EnumDomeinen["Organisatietype"] = "CG"
	EnumWaarden["CGPortfolioFase"] = []string{"Brons", "Zilver", "Goud", "Niet gecontroleerd"}
	EnumDomeinen["CGPortfolioFase"] = "CG"
	EnumWaarden["Gemeenterol"] = []string{"Realiseert", "Maakt gebruik van"}
	EnumDomeinen["Gemeenterol"] = "CG"
	EnumWaarden["Organisatierol"] = []string{"Contactorganisatie", "BetrokkenOrganisatie"}
	EnumDomeinen["Organisatierol"] = "CG"

	// Enum editor-posities
	EnumEditorLayouts["Fase"] = &EditorLayout{Positie: &V3Positie{X: 315, Y: -1560}}
	EnumEditorLayouts["Producttype"] = &EditorLayout{Positie: &V3Positie{X: 615, Y: -1695}}
	EnumEditorLayouts["CGLaag"] = &EditorLayout{Positie: &V3Positie{X: 810, Y: -1530}}
	EnumEditorLayouts["Bijdragetype"] = &EditorLayout{Positie: &V3Positie{X: 1290, Y: -1980}}
	EnumEditorLayouts["Schaal"] = &EditorLayout{Positie: &V3Positie{X: 1290, Y: -1815}}
	EnumEditorLayouts["Organisatietype"] = &EditorLayout{Positie: &V3Positie{X: 420, Y: -2925}}
	EnumEditorLayouts["CGPortfolioFase"] = &EditorLayout{Positie: &V3Positie{X: 1545, Y: -1590}}
	EnumEditorLayouts["Gemeenterol"] = &EditorLayout{Positie: &V3Positie{X: 1395, Y: -3195}}
	EnumEditorLayouts["Organisatierol"] = &EditorLayout{Positie: &V3Positie{X: 435, Y: -2280}}
}
