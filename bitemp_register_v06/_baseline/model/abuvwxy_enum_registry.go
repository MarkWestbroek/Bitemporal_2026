package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initAbuvwxyEnumRegistry() {
	EnumWaarden["ABCEnum"] = []string{"Optie A", "Optie B", "Optie C"}
	EnumDomeinen["ABCEnum"] = "abuvwxy"
	EnumConstNamen["ABCEnum"] = map[string]string{"Optie A": "ABCEnumOptieA", "Optie B": "ABCEnumOptieB", "Optie C": "ABCEnumOptieC"}
	EnumWaarden["RelABSoort"] = []string{"LTT", "LAT", "LTA"}
	EnumDomeinen["RelABSoort"] = "abuvwxy"
	EnumConstNamen["RelABSoort"] = map[string]string{"LTT": "RelABSoortLTT", "LAT": "RelABSoortLAT", "LTA": "RelABSoortLTA"}

	// Enum editor-posities
	EnumEditorLayouts["ABCEnum"] = &EditorLayout{Positie: &V3Positie{X: 270, Y: 1125}}
	EnumEditorLayouts["RelABSoort"] = &EditorLayout{Positie: &V3Positie{X: 690, Y: 795}}
}
