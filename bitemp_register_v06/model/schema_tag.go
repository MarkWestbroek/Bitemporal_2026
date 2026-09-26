package model

// schema_tag.go — één lezer voor de `schema:"…"`-structtag.
//
// cmd/codegen (conventions.go, contentField) schrijft de delen komma-gescheiden:
//
//	schema:"enum=CGLaag,datatype:EnumLijst"
//	schema:"datatype:NLPostcode"
//	schema:"ref:LandenlijstLand"
//
// Het schema-endpoint, de validatie-walker en de V3-exporter lazen de tag alleen op het
// BEGIN (strings.HasPrefix), waardoor een veld met zowel een enum als een datatype zijn
// datatype kwijtraakte. Sinds 2026-09-26 (lijst van enum-waarden in één veld, datatype
// EnumLijst) lezen ze allemaal via ParseSchemaTag.

import "strings"

// SchemaTag zijn de delen van een schema-tag. Enum kan een enum-naam zijn ("CGLaag") of
// expliciete waarden gescheiden door | ("A|B|C").
type SchemaTag struct {
	Enum     string
	Datatype string
	Ref      string
}

// ParseSchemaTag leest een schema-tag per komma-deel; de volgorde van de delen doet er niet toe.
func ParseSchemaTag(tag string) SchemaTag {
	var uit SchemaTag
	for _, deel := range strings.Split(tag, ",") {
		d := strings.TrimSpace(deel)
		switch {
		case strings.HasPrefix(d, "enum="):
			uit.Enum = strings.TrimSpace(strings.TrimPrefix(d, "enum="))
		case strings.HasPrefix(d, "enum:"):
			uit.Enum = strings.TrimSpace(strings.TrimPrefix(d, "enum:"))
		case strings.HasPrefix(d, "datatype:"):
			uit.Datatype = strings.TrimSpace(strings.TrimPrefix(d, "datatype:"))
		case strings.HasPrefix(d, "ref:"):
			uit.Ref = strings.TrimSpace(strings.TrimPrefix(d, "ref:"))
		}
	}
	return uit
}

// LijstScheiding geeft het scheidingsteken als het datatype "meerdere waarden in één veld"
// betekent (V3Weergave.Scheiding, bv. EnumLijst → ";"), anders "".
func LijstScheiding(datatypeNaam string) string {
	if datatypeNaam == "" {
		return ""
	}
	dt, ok := FindDatatype(datatypeNaam)
	if !ok || dt.Weergave == nil {
		return ""
	}
	return dt.Weergave.Scheiding
}

// SplitsLijstwaarde splitst een lijstwaarde op het scheidingsteken; spaties rond de delen
// en lege delen vallen weg ("Laag 1; Laag 2;" → ["Laag 1", "Laag 2"]).
func SplitsLijstwaarde(waarde, scheiding string) []string {
	if scheiding == "" {
		if strings.TrimSpace(waarde) == "" {
			return nil
		}
		return []string{strings.TrimSpace(waarde)}
	}
	var uit []string
	for _, d := range strings.Split(waarde, scheiding) {
		if t := strings.TrimSpace(d); t != "" {
			uit = append(uit, t)
		}
	}
	return uit
}
