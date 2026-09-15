package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initOrgGeoEnumRegistry() {
	EnumWaarden["Medewerkerrol"] = []string{"medewerker", "behandelaar", "leidinggevende"}
	EnumDomeinen["Medewerkerrol"] = "org-geo"
	EnumWaarden["Kanaalsoort"] = []string{"balie", "telefoon", "email", "post"}
	EnumDomeinen["Kanaalsoort"] = "org-geo"
	EnumWaarden["Gemeentedeelsoort"] = []string{"Stadsdeel", "Wijk", "Buurt"}
	EnumDomeinen["Gemeentedeelsoort"] = "org-geo"

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["Medewerkerrol"] = &EditorLayout{Positie: &V3Positie{X: -1350, Y: -2535}}
	EnumEditorLayouts["Kanaalsoort"] = &EditorLayout{Positie: &V3Positie{X: -990, Y: -2460}}
	EnumEditorLayouts["Gemeentedeelsoort"] = &EditorLayout{Positie: &V3Positie{X: 1500, Y: -1710}}
}
