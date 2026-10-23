package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// goTypeUitOAS leidt het Go-type van een veld af uit de V3.1-metadata (type, format, verplicht,
// enum) als goType ontbreekt — de omgekeerde afbeelding van oasTypeVoorGoType in de exporter.
// Een extern geleverd V3-model (bv. FUNDAMENT, 23-10-2026) heeft wél type/datatype maar geen
// goType; zonder deze afleiding kwam er een struct zonder veldtype uit. Niet verplicht = pointer
// (nil = niet ingevuld), zoals in de gegenereerde code gebruikelijk.
func goTypeUitOAS(v model.V3Veld) string {
	basis := ""
	switch {
	case strings.TrimSpace(v.Enum) != "":
		basis = strings.TrimSpace(v.Enum)
	default:
		switch strings.ToLower(strings.TrimSpace(v.Type)) {
		case "integer":
			basis = "int"
		case "number":
			if strings.EqualFold(v.Format, "float32") {
				basis = "float32"
			} else {
				basis = "float64"
			}
		case "boolean":
			basis = "bool"
		case "string", "":
			switch strings.ToLower(strings.TrimSpace(v.Format)) {
			case "date":
				basis = "Date"
			case "date-time":
				basis = "time.Time"
			default:
				basis = "string"
			}
		default:
			basis = "string"
		}
	}
	if v.Verplicht {
		return basis
	}
	return "*" + basis
}

// vulGoTypesAan zet goType op elk veld dat het mist; geeft meldingen voor het logboek.
func vulGoTypesAan(v3 *model.V3Model) []string {
	var meldingen []string
	vul := func(ctx string, velden []model.V3Veld) {
		for i := range velden {
			if strings.TrimSpace(velden[i].GoType) != "" {
				continue
			}
			velden[i].GoType = goTypeUitOAS(velden[i])
			meldingen = append(meldingen, fmt.Sprintf("%s.%s: goType afgeleid als %s", ctx, velden[i].Naam, velden[i].GoType))
		}
	}
	for ei := range v3.Entiteiten {
		ent := &v3.Entiteiten[ei]
		for gi := range ent.Gegevenselementen {
			vul(ent.Typenaam+"."+ent.Gegevenselementen[gi].Naam, ent.Gegevenselementen[gi].Velden)
		}
		for ri := range ent.Relaties {
			vul(ent.Typenaam+"."+ent.Relaties[ri].Naam, ent.Relaties[ri].Velden)
		}
	}
	return meldingen
}

// datatypeBekend meldt of een datatype-naam bestaat: in het model zelf of in het register
// (model.DatatypeRegistry, gevuld door de init van package model).
func datatypeBekend(v3 model.V3Model, naam string) bool {
	for _, dt := range v3.Datatypes {
		if dt.Naam == naam {
			return true
		}
	}
	_, ok := model.FindDatatype(naam)
	return ok
}
