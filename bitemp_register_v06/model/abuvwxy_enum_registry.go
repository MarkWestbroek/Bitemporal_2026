package model

// Additieve enum-registry entries voor het abuvwxy-basisdomein.

func initAbuvwxyEnumRegistry() {
	EnumWaarden["RelABSoort"] = []string{"LTT", "LAT", "LTA"}
	EnumDomeinen["RelABSoort"] = "abuvwxy"
	EnumEditorLayouts["RelABSoort"] = &EditorLayout{Positie: &V3Positie{X: -330, Y: 330}}

	EnumWaarden["ABCEnum"] = []string{"Optie A", "Optie B", "Optie C"}
	EnumDomeinen["ABCEnum"] = "abuvwxy"
	EnumEditorLayouts["ABCEnum"] = &EditorLayout{Positie: &V3Positie{X: -675, Y: 720}}
}
