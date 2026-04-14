package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initAbuvwxyEnumRegistry() {
	EnumWaarden["ABCEnum"] = []string{"Optie A", "Optie B", "Optie C"}
	EnumDomeinen["ABCEnum"] = "abuvwxy"
	EnumWaarden["RelABSoort"] = []string{"LTT", "LAT", "LTA"}
	EnumDomeinen["RelABSoort"] = "abuvwxy"

	// Enum editor-posities
	EnumEditorLayouts["ABCEnum"] = &EditorLayout{Positie: &V3Positie{X: -570, Y: 1020}}
	EnumEditorLayouts["RelABSoort"] = &EditorLayout{Positie: &V3Positie{X: -150, Y: 690}}
}
