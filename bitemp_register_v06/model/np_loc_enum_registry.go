package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initNpLocEnumRegistry() {
	EnumWaarden["Naamgebruiksoort"] = []string{"EigenNaam", "PartnerNaam", "EigenNaam-PartnerNaam", "PartnerNaam-EigenNaam"}
	EnumDomeinen["Naamgebruiksoort"] = "np-loc"
	EnumConstNamen["Naamgebruiksoort"] = map[string]string{"EigenNaam": "NaamgebruiksoortEigenNaam", "PartnerNaam": "NaamgebruiksoortPartnerNaam", "EigenNaam-PartnerNaam": "NaamgebruiksoortEigenNaamPartnerNaam", "PartnerNaam-EigenNaam": "NaamgebruiksoortPartnerNaamEigenNaam"}
	EnumWaarden["Bereikbaarheidssoort"] = []string{"Woonadres", "Briefadres", "Correspondentieadres"}
	EnumDomeinen["Bereikbaarheidssoort"] = "np-loc"
	EnumConstNamen["Bereikbaarheidssoort"] = map[string]string{"Woonadres": "BereikbaarheidssoortWoonadres", "Briefadres": "BereikbaarheidssoortBriefadres", "Correspondentieadres": "BereikbaarheidssoortCorrespondentieadres"}
	EnumWaarden["Geslachtsaanduiding"] = []string{"man", "vrouw", "X"}
	EnumDomeinen["Geslachtsaanduiding"] = "np-loc"
	EnumConstNamen["Geslachtsaanduiding"] = map[string]string{"man": "GeslachtsaanduidingMan", "vrouw": "GeslachtsaanduidingVrouw", "X": "GeslachtsaanduidingX"}
	EnumWaarden["Aanspreektitel"] = []string{"meneer", "mevrouw", "hen"}
	EnumDomeinen["Aanspreektitel"] = "np-loc"
	EnumConstNamen["Aanspreektitel"] = map[string]string{"meneer": "AanspreektitelMeneer", "mevrouw": "AanspreektitelMevrouw", "hen": "AanspreektitelHen"}

	// Enum editor-layout (positie + lock)
	EnumEditorLayouts["Naamgebruiksoort"] = &EditorLayout{Positie: &V3Positie{X: 75, Y: -345}}
	EnumEditorLayouts["Bereikbaarheidssoort"] = &EditorLayout{Positie: &V3Positie{X: 210, Y: -690}}
	EnumEditorLayouts["Geslachtsaanduiding"] = &EditorLayout{Positie: &V3Positie{X: -1020, Y: -1215}}
	EnumEditorLayouts["Aanspreektitel"] = &EditorLayout{Positie: &V3Positie{X: -1320, Y: -930}}
}
