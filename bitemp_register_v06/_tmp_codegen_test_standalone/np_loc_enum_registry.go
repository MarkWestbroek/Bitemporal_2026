package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initNpLocEnumRegistry() {
	EnumWaarden["Naamgebruiksoort"] = []string{"EigenNaam", "PartnerNaam", "EigenNaam-PartnerNaam", "PartnerNaam-EigenNaam"}
	EnumWaarden["Bereikbaarheidssoort"] = []string{"Woonadres", "Briefadres", "Correspondentieadres"}
	EnumWaarden["ReferentielijstAdrestype"] = []string{"URL", "URN"}

	// Enum editor-posities
	EnumEditorLayouts["Naamgebruiksoort"] = &EditorLayout{Positie: &V3Positie{X: 285, Y: 405}}
	EnumEditorLayouts["Bereikbaarheidssoort"] = &EditorLayout{Positie: &V3Positie{X: 330, Y: 60}}
	EnumEditorLayouts["ReferentielijstAdrestype"] = &EditorLayout{Positie: &V3Positie{X: 1890, Y: 120}}
}
