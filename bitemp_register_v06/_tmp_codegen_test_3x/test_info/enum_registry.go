package model

// EnumRegistry — enum-waarden en editor-posities.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func init() {
	EnumWaarden["ABCEnum"] = []string{"Optie A", "Optie B", "Optie C"}
	EnumDomeinen["ABCEnum"] = "abuvwxy"
	EnumWaarden["RelABSoort"] = []string{"LTT", "LAT", "LTA"}
	EnumDomeinen["RelABSoort"] = "abuvwxy"
	EnumWaarden["Naamgebruiksoort"] = []string{"EigenNaam", "PartnerNaam", "EigenNaam-PartnerNaam", "PartnerNaam-EigenNaam"}
	EnumDomeinen["Naamgebruiksoort"] = "np-loc"
	EnumWaarden["Bereikbaarheidssoort"] = []string{"Woonadres", "Briefadres", "Correspondentieadres"}
	EnumDomeinen["Bereikbaarheidssoort"] = "np-loc"
	EnumWaarden["ReferentielijstAdrestype"] = []string{"URL", "URN"}
	EnumDomeinen["ReferentielijstAdrestype"] = "register"

	// Enum editor-posities
	EnumEditorLayouts["Naamgebruiksoort"] = &EditorLayout{Positie: &V3Positie{X: 285, Y: 405}}
	EnumEditorLayouts["Bereikbaarheidssoort"] = &EditorLayout{Positie: &V3Positie{X: 330, Y: 60}}
	EnumEditorLayouts["ReferentielijstAdrestype"] = &EditorLayout{Positie: &V3Positie{X: 1890, Y: 120}}
}
