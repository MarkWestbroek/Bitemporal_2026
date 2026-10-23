package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initCgEnumRegistry() {
	EnumWaarden["Fase"] = []string{"Idee (nog geen concrete opbrengsten)", "Initiatie (al een snelle POC)", "Realisatie (gaat binnenkort draaien bij eerste gemeenten)", "Opschaling (draait bij enkele gemeenten, nu op zoek naar verbreding)", "Doorontwikkeling en beheer", "Doorontwikkeling en beheer (stabiel, onderdeel gevestigde orde)"}
	EnumDomeinen["Fase"] = "CG"
	EnumConstNamen["Fase"] = map[string]string{"Idee (nog geen concrete opbrengsten)": "FaseIdeeNogGeenConcreteOpbrengsten", "Initiatie (al een snelle POC)": "FaseInitiatieAlEenSnellePOC", "Realisatie (gaat binnenkort draaien bij eerste gemeenten)": "FaseRealisatieGaatBinnenkortDraaienBijEersteGemeenten", "Opschaling (draait bij enkele gemeenten, nu op zoek naar verbreding)": "FaseOpschalingDraaitBijEnkeleGemeentenNuOpZoekNaarVerbreding", "Doorontwikkeling en beheer": "FaseDoorontwikkelingEnBeheer", "Doorontwikkeling en beheer (stabiel, onderdeel gevestigde orde)": "FaseDoorontwikkelingEnBeheerStabielOnderdeelGevestigdeOrde"}
	EnumWaarden["Producttype"] = []string{"Component", "Toepassing", "Standaard"}
	EnumDomeinen["Producttype"] = "CG"
	EnumConstNamen["Producttype"] = map[string]string{"Component": "ProducttypeComponent", "Toepassing": "ProducttypeToepassing", "Standaard": "ProducttypeStandaard"}
	EnumWaarden["CGLaag"] = []string{"Laag 5", "Laag 4", "Laag 3", "Laag 2", "Laag 1", "Hosting en infrastructuur", "Utility"}
	EnumDomeinen["CGLaag"] = "CG"
	EnumConstNamen["CGLaag"] = map[string]string{"Laag 5": "CGLaagLaag5", "Laag 4": "CGLaagLaag4", "Laag 3": "CGLaagLaag3", "Laag 2": "CGLaagLaag2", "Laag 1": "CGLaagLaag1", "Hosting en infrastructuur": "CGLaagHostingEnInfrastructuur", "Utility": "CGLaagUtility"}
	EnumWaarden["Bijdragetype"] = []string{"Wendbaarheid", "Dienstverlening", "Regie"}
	EnumDomeinen["Bijdragetype"] = "CG"
	EnumConstNamen["Bijdragetype"] = map[string]string{"Wendbaarheid": "BijdragetypeWendbaarheid", "Dienstverlening": "BijdragetypeDienstverlening", "Regie": "BijdragetypeRegie"}
	EnumWaarden["Schaal"] = []string{"Schaal 1", "Schaal 2", "Schaal 3", "Schaal 4"}
	EnumDomeinen["Schaal"] = "CG"
	EnumConstNamen["Schaal"] = map[string]string{"Schaal 1": "SchaalSchaal1", "Schaal 2": "SchaalSchaal2", "Schaal 3": "SchaalSchaal3", "Schaal 4": "SchaalSchaal4"}
	EnumWaarden["Organisatietype"] = []string{"Gemeenten", "Leveranciers", "VNG", "Ketenpartners", "Rijk"}
	EnumDomeinen["Organisatietype"] = "CG"
	EnumConstNamen["Organisatietype"] = map[string]string{"Gemeenten": "OrganisatietypeGemeenten", "Leveranciers": "OrganisatietypeLeveranciers", "VNG": "OrganisatietypeVNG", "Ketenpartners": "OrganisatietypeKetenpartners", "Rijk": "OrganisatietypeRijk"}
	EnumWaarden["CGPortfolioFase"] = []string{"Brons", "Zilver", "Goud", "Niet gecontroleerd"}
	EnumDomeinen["CGPortfolioFase"] = "CG"
	EnumConstNamen["CGPortfolioFase"] = map[string]string{"Brons": "CGPortfolioFaseBrons", "Zilver": "CGPortfolioFaseZilver", "Goud": "CGPortfolioFaseGoud", "Niet gecontroleerd": "CGPortfolioFaseNietGecontroleerd"}
	EnumWaarden["Gemeenterol"] = []string{"Realiseert", "Maakt gebruik van"}
	EnumDomeinen["Gemeenterol"] = "CG"
	EnumConstNamen["Gemeenterol"] = map[string]string{"Realiseert": "GemeenterolRealiseert", "Maakt gebruik van": "GemeenterolMaaktGebruikVan"}
	EnumWaarden["Organisatierol"] = []string{"Contactorganisatie", "BetrokkenOrganisatie"}
	EnumDomeinen["Organisatierol"] = "CG"
	EnumConstNamen["Organisatierol"] = map[string]string{"Contactorganisatie": "OrganisatierolContactorganisatie", "BetrokkenOrganisatie": "OrganisatierolBetrokkenOrganisatie"}
	EnumWaarden["Aanmeldstatus"] = []string{"nieuwe_aanmelding", "in_behandeling", "geaccepteerd", "afgewezen"}
	EnumDomeinen["Aanmeldstatus"] = "CG"
	EnumConstNamen["Aanmeldstatus"] = map[string]string{"nieuwe_aanmelding": "AanmeldstatusNieuweAanmelding", "in_behandeling": "AanmeldstatusInBehandeling", "geaccepteerd": "AanmeldstatusGeaccepteerd", "afgewezen": "AanmeldstatusAfgewezen"}

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["Fase"] = &EditorLayout{Positie: &V3Positie{X: 315, Y: -1560}}
	EnumEditorLayouts["Producttype"] = &EditorLayout{Positie: &V3Positie{X: 615, Y: -1695}}
	EnumEditorLayouts["CGLaag"] = &EditorLayout{Positie: &V3Positie{X: 810, Y: -1530}}
	EnumEditorLayouts["Bijdragetype"] = &EditorLayout{Positie: &V3Positie{X: 1290, Y: -1980}}
	EnumEditorLayouts["Schaal"] = &EditorLayout{Positie: &V3Positie{X: 1290, Y: -1815}}
	EnumEditorLayouts["Organisatietype"] = &EditorLayout{Positie: &V3Positie{X: 420, Y: -2925}}
	EnumEditorLayouts["CGPortfolioFase"] = &EditorLayout{Positie: &V3Positie{X: 1545, Y: -1590}}
	EnumEditorLayouts["Gemeenterol"] = &EditorLayout{Positie: &V3Positie{X: 1395, Y: -3195}}
	EnumEditorLayouts["Organisatierol"] = &EditorLayout{Positie: &V3Positie{X: 435, Y: -2280}}
	EnumEditorLayouts["Aanmeldstatus"] = &EditorLayout{Positie: &V3Positie{X: 1545, Y: -1380}}
}
