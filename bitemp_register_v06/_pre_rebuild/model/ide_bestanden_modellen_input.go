package model

// _Input structs: platte API-input die hub + data combineert.
// Gegenereerd door cmd/codegen — niet handmatig bewerken.

type IdeBestand_Meta_Input struct {
	IDEBESTAND_ID   int                 `json:"idebestand_id"`
	Rel_ID          int                 `json:"rel_id"`
	Naam            string              `json:"naam"`
	Beschrijving    string              `json:"beschrijving"`
	Categorie       IdeBestandCategorie `json:"categorie"`
	Bestandsformaat IdeBestandFormaat   `json:"bestandsformaat"`
	MimeType        string              `json:"mime_type"`
	Domein          string              `json:"domein"`
	Tags            string              `json:"tags"`
}

type IdeBestand_Inhoud_Input struct {
	IDEBESTAND_ID int                  `json:"idebestand_id"`
	Rel_ID        int                  `json:"rel_id"`
	OpslagType    IdeBestandOpslagType `json:"opslag_type"`
	InlineInhoud  string               `json:"inline_inhoud"`
	ObjectKey     string               `json:"object_key"`
	Sha256Hash    string               `json:"sha256_hash"`
	GrootteBytes  int64                `json:"grootte_bytes"`
	VersieLabel   string               `json:"versie_label"`
}
