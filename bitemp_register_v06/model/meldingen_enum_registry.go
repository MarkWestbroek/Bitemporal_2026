package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initMeldingenEnumRegistry() {
	EnumWaarden["Meldingsoort"] = []string{"bug", "wens", "vraag", "compliment"}
	EnumDomeinen["Meldingsoort"] = "meldingen"
	EnumConstNamen["Meldingsoort"] = map[string]string{"bug": "Meldingsoortbug", "wens": "Meldingsoortwens", "vraag": "Meldingsoortvraag", "compliment": "Meldingsoortcompliment"}
	EnumWaarden["Meldingstatus"] = []string{"nieuw", "in_behandeling", "opgelost", "afgewezen", "dubbel"}
	EnumDomeinen["Meldingstatus"] = "meldingen"
	EnumConstNamen["Meldingstatus"] = map[string]string{"nieuw": "Meldingstatusnieuw", "in_behandeling": "Meldingstatusinbehandeling", "opgelost": "Meldingstatusopgelost", "afgewezen": "Meldingstatusafgewezen", "dubbel": "Meldingstatusdubbel"}
	EnumWaarden["Meldingprioriteit"] = []string{"laag", "normaal", "hoog"}
	EnumDomeinen["Meldingprioriteit"] = "meldingen"
	EnumConstNamen["Meldingprioriteit"] = map[string]string{"laag": "Meldingprioriteitlaag", "normaal": "Meldingprioriteitnormaal", "hoog": "Meldingprioriteithoog"}

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["Meldingsoort"] = &EditorLayout{Positie: &V3Positie{X: -420, Y: 250}}
	EnumEditorLayouts["Meldingstatus"] = &EditorLayout{Positie: &V3Positie{X: 300, Y: 620}}
	EnumEditorLayouts["Meldingprioriteit"] = &EditorLayout{Positie: &V3Positie{X: 640, Y: 620}}
}
