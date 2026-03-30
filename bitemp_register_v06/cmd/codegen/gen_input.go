package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// generateInput genereert modellen_input.go met platte _Input structs
// die hub + data velden combineren voor de registratie-API.
func generateInput(v3 model.V3Model) (string, error) {
	var b strings.Builder
	b.WriteString(fileHeader("_Input structs: platte API-input die hub + data combineert.\n// Gegenereerd door cmd/codegen — niet handmatig bewerken."))
	b.WriteString("\n")

	for _, ent := range v3.Entiteiten {
		entIDKolom := strings.ToLower(ent.Typenaam) + "_id"

		// GE inputs
		for _, ge := range ent.Gegevenselementen {
			inputType := geHubTypeName(ent, ge.Naam) + "_Input"
			b.WriteString(fmt.Sprintf("type %s struct {\n", inputType))

			// Plumbing: ent_id + rel_id
			for _, f := range inputPlumbingFields(entIDKolom) {
				writeField(&b, f)
			}

			// Inhoudsvelden uit de _Data struct (skip parent FK)
			for _, v := range ge.Velden {
				if v.Naam == entIDKolom {
					continue
				}
				writeField(&b, inputContentField(v))
			}

			// Aanvang/Einde (alleen als het GE zelf materieel is)
			if ge.IsMaterieel {
				for _, f := range inputAanvangEindeFields() {
					writeField(&b, f)
				}
			}

			b.WriteString("}\n\n")
		}

		// Relatie inputs
		for _, rel := range ent.Relaties {
			inputType := rel.Naam + "_Input"
			b.WriteString(fmt.Sprintf("type %s struct {\n", inputType))

			// Plumbing: ent_id + rel_id
			for _, f := range inputPlumbingFields(entIDKolom) {
				writeField(&b, f)
			}

			// Secondary FK: doel_entiteit_id (bijv. B_ID voor Rel_A_B)
			doelIDKolom := strings.ToLower(rel.DoelEntiteit) + "_id"
			doelIDField := strings.ToUpper(strings.TrimSuffix(doelIDKolom, "_id")) + "_ID"
			b.WriteString(fmt.Sprintf("\t%s int `json:\"%s\"`\n", doelIDField, doelIDKolom))

			// Inhoudsvelden uit de _Data struct (skip parent + doel FK)
			for _, v := range rel.Velden {
				if v.Naam == entIDKolom || v.Naam == doelIDKolom {
					continue
				}
				writeField(&b, inputContentField(v))
			}

			// Aanvang/Einde (alleen als relatie zelf materieel is)
			if rel.IsMaterieel {
				for _, f := range inputAanvangEindeFields() {
					writeField(&b, f)
				}
			}

			b.WriteString("}\n\n")
		}
	}

	return b.String(), nil
}
