package model

// Register-scope enum-registraties.
// Wordt aangeroepen vanuit de centrale init-volgorde in metaregistry_plumbing.go.

func initRegisterEnumRegistry() {
	EnumWaarden["ReferentielijstAdrestype"] = []string{"URL", "URN"}
	EnumEditorLayouts["ReferentielijstAdrestype"] = &EditorLayout{Positie: &V3Positie{X: 1890, Y: 120}}
}
