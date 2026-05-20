// Package adapter mapt MetaRegistry-instanties naar Operaton-procesvariabelen
// en terug. Werkt op basis van het procesvariabele-contract uit
// docs/CONTRACTEN.md.
package adapter

// Kind is de discriminator op een procesvariabele die bepaalt hoe deze
// resolveert naar een waarde.
type Kind string

const (
	KindRepHandle  Kind = "rep_handle"
	KindRepInline  Kind = "rep_inline"
	KindScalar     Kind = "scalar"
	KindEnumValue  Kind = "enum_value"
	KindReflistRef Kind = "reflist_item"
)

// Variable is de typed JSON-representatie van een procesvariabele zoals deze
// in Operaton wordt opgeslagen (in de "value" van een Json-typed variable).
type Variable struct {
	Kind       Kind   `json:"__kind"`
	Typenaam   string `json:"__typenaam,omitempty"`
	RegisterID string `json:"register_id,omitempty"`
	EntID      string `json:"ent_id,omitempty"`
	Tijdstip   string `json:"t,omitempty"`
	// Bij rep_inline of scalar: de inhoud zelf.
	Inhoud any `json:"inhoud,omitempty"`
}
