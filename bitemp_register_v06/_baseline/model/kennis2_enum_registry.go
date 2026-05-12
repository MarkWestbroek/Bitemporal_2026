package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initKennis2EnumRegistry() {
	EnumWaarden["Taal"] = []string{"nl", "en", "de"}
	EnumDomeinen["Taal"] = "kennis2"
	EnumWaarden["Kennissectietype"] = []string{"samenvatting", "inhoud", "procedureBeschrijving", "bewijs", "enz"}
	EnumDomeinen["Kennissectietype"] = "kennis2"

	// Enum editor-posities
	EnumEditorLayouts["Taal"] = &EditorLayout{Positie: &V3Positie{X: 1050, Y: 238.25}}
	EnumEditorLayouts["Kennissectietype"] = &EditorLayout{Positie: &V3Positie{X: 695.75, Y: 510}}
}
