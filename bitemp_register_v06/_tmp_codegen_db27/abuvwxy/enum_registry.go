package model

// EnumRegistry — enum-waarden en editor-posities.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func init() {
	EnumWaarden["ABCEnum"] = []string{"Optie A", "Optie B", "Optie C"}
	EnumDomeinen["ABCEnum"] = "abuvwxy"
	EnumWaarden["RelABSoort"] = []string{"LTT", "LAT", "LTA"}
	EnumDomeinen["RelABSoort"] = "abuvwxy"

	// Enum editor-posities
	EnumEditorLayouts["ABCEnum"] = &EditorLayout{Positie: &V3Positie{X: -675, Y: 615}}
	EnumEditorLayouts["RelABSoort"] = &EditorLayout{Positie: &V3Positie{X: -330, Y: 225}}
}
