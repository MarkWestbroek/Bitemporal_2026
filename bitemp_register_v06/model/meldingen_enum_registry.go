package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initMeldingenEnumRegistry() {
	EnumWaarden["Meldingsoort"] = []string{"bug", "wens", "vraag", "compliment"}
	EnumDomeinen["Meldingsoort"] = "meldingen"
	EnumWaarden["Meldingstatus"] = []string{"nieuw", "in_behandeling", "opgelost", "afgewezen", "dubbel"}
	EnumDomeinen["Meldingstatus"] = "meldingen"
	EnumWaarden["Meldingprioriteit"] = []string{"laag", "normaal", "hoog"}
	EnumDomeinen["Meldingprioriteit"] = "meldingen"

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["Meldingsoort"] = &EditorLayout{Positie: &V3Positie{X: -420, Y: 250}}
	EnumEditorLayouts["Meldingstatus"] = &EditorLayout{Positie: &V3Positie{X: 300, Y: 620}}
	EnumEditorLayouts["Meldingprioriteit"] = &EditorLayout{Positie: &V3Positie{X: 640, Y: 620}}
}
