package model

// v3_enum_domein.go — in welk domein een enum gegenereerd wordt (18-11-2026).
//
// De codegen draait per domein (--domein) en schrijft alles naar package model. Een enum die
// velden in meer dan één domein gebruiken, werd in elk van die domeinen gegenereerd: twee keer
// `type X string` met dezelfde constanten, waarna het pakket niet meer compileert
// ("XWaarde redeclared in this block"). Gevonden met het zaakmodel (Vertrouwelijkheidaanduiding
// in catalogus, zaken en documenten; gemeld door FACADE en AI-INRICHTEN).
//
// Regel: een enum wordt in precies één domein gegenereerd.
//   - Gebruikt maar één domein hem, dan dat domein (ongewijzigd gedrag).
//   - Gebruiken meerdere domeinen hem, dan het domein van de enum zelf, mits dat domein hem
//     ook gebruikt; anders het alfabetisch eerste domein dat hem gebruikt.
//
// De andere domeinen verwijzen naar hetzelfde Go-type. Ze bouwen dus alleen als het
// genererende domein is meegebouwd, net als bij een relatie naar een entiteit in een ander domein.

import "sort"

// EffectiefDomein: het domein waarin een entiteit gegenereerd wordt. Een entiteit zonder domein
// hoort bij de run voor "register", of bij de run voor het domein dat zo heet als het model
// (editor-v2 exporteert het domein niet altijd).
func EffectiefDomein(entDomein, modelNaam, gevraagd string) string {
	if entDomein != "" {
		return entDomein
	}
	if gevraagd == "register" || modelNaam == gevraagd {
		return gevraagd
	}
	return "register"
}

// EnumGebruikPerDomein: enum (GoType) → de domeinen waarvan een veld hem gebruikt.
func EnumGebruikPerDomein(entiteiten []V3Entiteit, effectief func(V3Entiteit) string) map[string]map[string]bool {
	uit := map[string]map[string]bool{}
	merk := func(enum, domein string) {
		if enum == "" {
			return
		}
		if uit[enum] == nil {
			uit[enum] = map[string]bool{}
		}
		uit[enum][domein] = true
	}
	for _, ent := range entiteiten {
		d := effectief(ent)
		for _, ge := range ent.Gegevenselementen {
			for _, v := range ge.Velden {
				merk(v.Enum, d)
			}
		}
		for _, rel := range ent.Relaties {
			for _, v := range rel.Velden {
				merk(v.Enum, d)
			}
		}
	}
	return uit
}

// EnumGenererendDomein: het ene domein dat de enum genereert (zie de regel bovenaan).
func EnumGenererendDomein(enumDomein string, gebruikers map[string]bool) string {
	if len(gebruikers) == 0 {
		return ""
	}
	if gebruikers[enumDomein] {
		return enumDomein
	}
	namen := make([]string, 0, len(gebruikers))
	for d := range gebruikers {
		namen = append(namen, d)
	}
	sort.Strings(namen)
	return namen[0]
}

// EnumDomeinVolgorde zet de domeinen zo dat een domein dat een gedeelde enum genereert vóór de
// domeinen komt die hem alleen gebruiken. Nodig voor de rebuild met `go run ./cmd/codegen`: die
// compileert package model bij elke run, en een domein dat naar een nog niet gegenereerde enum
// verwijst breekt dan de volgende run. De volgorde is verder stabiel. Bij een kring (A genereert
// een enum voor B en B een voor A) blijft de oorspronkelijke volgorde van de rest staan.
func EnumDomeinVolgorde(v3 V3Model, domeinen []string) []string {
	gebruik := EnumGebruikPerDomein(v3.Entiteiten, func(e V3Entiteit) string {
		if e.Domein == "" {
			return "register"
		}
		return e.Domein
	})
	// eerst[d] = de domeinen die vóór d moeten.
	eerst := map[string]map[string]bool{}
	for _, e := range v3.Enums {
		gebruikers := gebruik[e.GoType]
		if len(gebruikers) < 2 {
			continue
		}
		eigenaar := EnumGenererendDomein(e.Domein, gebruikers)
		for d := range gebruikers {
			if d == eigenaar {
				continue
			}
			if eerst[d] == nil {
				eerst[d] = map[string]bool{}
			}
			eerst[d][eigenaar] = true
		}
	}
	inLijst := map[string]bool{}
	for _, d := range domeinen {
		inLijst[d] = true
	}
	uit := make([]string, 0, len(domeinen))
	gedaan := map[string]bool{}
	for len(uit) < len(domeinen) {
		voortgang := false
		for _, d := range domeinen {
			if gedaan[d] {
				continue
			}
			klaar := true
			for v := range eerst[d] {
				if inLijst[v] && !gedaan[v] {
					klaar = false
					break
				}
			}
			if klaar {
				uit = append(uit, d)
				gedaan[d] = true
				voortgang = true
			}
		}
		if !voortgang { // kring: de rest in de oorspronkelijke volgorde
			for _, d := range domeinen {
				if !gedaan[d] {
					uit = append(uit, d)
					gedaan[d] = true
				}
			}
		}
	}
	return uit
}
