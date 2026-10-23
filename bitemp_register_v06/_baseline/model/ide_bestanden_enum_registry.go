package model

// Enum-registraties.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

func initIdeBestandenEnumRegistry() {
	EnumWaarden["IdeBestandCategorie"] = []string{"model_snapshot", "ide_snapshot", "gegenereerde_code", "import", "export", "documentatie", "configuratie", "overig"}
	EnumDomeinen["IdeBestandCategorie"] = "ide-bestanden"
	EnumConstNamen["IdeBestandCategorie"] = map[string]string{"model_snapshot": "IdeBestandCategorieModelSnapshot", "ide_snapshot": "IdeBestandCategorieIdeSnapshot", "gegenereerde_code": "IdeBestandCategorieGenereerdCode", "import": "IdeBestandCategorieImport", "export": "IdeBestandCategorieExport", "documentatie": "IdeBestandCategorieDocumentatie", "configuratie": "IdeBestandCategorieConfiguratie", "overig": "IdeBestandCategorieOverig"}
	EnumWaarden["IdeBestandFormaat"] = []string{"json", "yaml", "xml", "markdown", "go_code", "sql", "tekst", "binair", "overig"}
	EnumDomeinen["IdeBestandFormaat"] = "ide-bestanden"
	EnumConstNamen["IdeBestandFormaat"] = map[string]string{"json": "IdeBestandFormaatJSON", "yaml": "IdeBestandFormaatYAML", "xml": "IdeBestandFormaatXML", "markdown": "IdeBestandFormaatMarkdown", "go_code": "IdeBestandFormaatGoCode", "sql": "IdeBestandFormaatSQL", "tekst": "IdeBestandFormaatTekst", "binair": "IdeBestandFormaatBinair", "overig": "IdeBestandFormaatOverig"}
	EnumWaarden["IdeBestandOpslagType"] = []string{"inline", "minio"}
	EnumDomeinen["IdeBestandOpslagType"] = "ide-bestanden"
	EnumConstNamen["IdeBestandOpslagType"] = map[string]string{"inline": "IdeBestandOpslagTypeInline", "minio": "IdeBestandOpslagTypeMinio"}

	// Enum editor-posities
	EnumEditorLayouts["IdeBestandCategorie"] = &EditorLayout{Positie: &V3Positie{X: 4425, Y: -315}}
	EnumEditorLayouts["IdeBestandFormaat"] = &EditorLayout{Positie: &V3Positie{X: 4645, Y: -315}}
	EnumEditorLayouts["IdeBestandOpslagType"] = &EditorLayout{Positie: &V3Positie{X: 4865, Y: -315}}
}
