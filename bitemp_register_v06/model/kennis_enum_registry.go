package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initKennisEnumRegistry() {
	EnumWaarden["Taal"] = []string{"nl", "en", "de"}
	EnumDomeinen["Taal"] = "kennis"
	EnumWaarden["Kennissectietype"] = []string{"titel", "samenvatting", "inhoud", "procedureBeschrijving", "bewijs"}
	EnumDomeinen["Kennissectietype"] = "kennis"

	// Enum editor-posities
	EnumEditorLayouts["Taal"] = &EditorLayout{Positie: &V3Positie{X: 675, Y: 375}}
	EnumEditorLayouts["Kennissectietype"] = &EditorLayout{Positie: &V3Positie{X: 660, Y: 195}}
}
