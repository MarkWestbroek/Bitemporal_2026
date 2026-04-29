package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initIdeBestandenEnumRegistry() {
	EnumWaarden["IdeBestandCategorie"] = []string{"model_snapshot", "ide_snapshot", "gegenereerde_code", "import", "export", "documentatie", "configuratie", "overig"}
	EnumDomeinen["IdeBestandCategorie"] = "ide-bestanden"
	EnumWaarden["IdeBestandFormaat"] = []string{"json", "yaml", "xml", "markdown", "go_code", "sql", "tekst", "binair", "overig"}
	EnumDomeinen["IdeBestandFormaat"] = "ide-bestanden"
	EnumWaarden["IdeBestandOpslagType"] = []string{"inline", "minio"}
	EnumDomeinen["IdeBestandOpslagType"] = "ide-bestanden"

	// Enum editor-posities
	EnumEditorLayouts["IdeBestandCategorie"] = &EditorLayout{Positie: &V3Positie{X: 4425, Y: -315}}
	EnumEditorLayouts["IdeBestandFormaat"] = &EditorLayout{Positie: &V3Positie{X: 4645, Y: -315}}
	EnumEditorLayouts["IdeBestandOpslagType"] = &EditorLayout{Positie: &V3Positie{X: 4865, Y: -315}}
}
