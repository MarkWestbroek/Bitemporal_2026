package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initNpLocEnumRegistry() {
	EnumWaarden["Naamgebruiksoort"] = []string{"EigenNaam", "PartnerNaam", "EigenNaam-PartnerNaam", "PartnerNaam-EigenNaam"}
	EnumDomeinen["Naamgebruiksoort"] = "np-loc"
	EnumWaarden["Bereikbaarheidssoort"] = []string{"Woonadres", "Briefadres", "Correspondentieadres"}
	EnumDomeinen["Bereikbaarheidssoort"] = "np-loc"

	// Enum editor-posities
	EnumEditorLayouts["Naamgebruiksoort"] = &EditorLayout{Positie: &V3Positie{X: 165, Y: -360}}
	EnumEditorLayouts["Bereikbaarheidssoort"] = &EditorLayout{Positie: &V3Positie{X: 210, Y: -690}}
}
