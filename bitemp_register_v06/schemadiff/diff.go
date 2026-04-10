package schemadiff

import (
	"fmt"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/naamgeving"
)

// ---- Opties ----

// VergelijkOptie configureert de vergelijking.
type VergelijkOptie func(*vergelijkConfig)

type vergelijkConfig struct {
	domein string
}

// MetDomeinFilter beperkt de vergelijking tot het opgegeven domein.
func MetDomeinFilter(domein string) VergelijkOptie {
	return func(c *vergelijkConfig) {
		c.domein = domein
	}
}

// ---- Hoofd-vergelijkfunctie ----

// Vergelijk vergelijkt twee V3-modellen en retourneert een DeltaRapport.
func Vergelijk(oud, nieuw model.V3Model, opties ...VergelijkOptie) DeltaRapport {
	cfg := &vergelijkConfig{}
	for _, opt := range opties {
		opt(cfg)
	}

	rapport := DeltaRapport{
		OudModelNaam:     oud.Naam,
		NieuwModelNaam:   nieuw.Naam,
		OudModelVersie:   oud.Versie,
		NieuwModelVersie: nieuw.Versie,
		Domein:           cfg.domein,
		Tijdstip:         time.Now(),
	}

	// Optioneel domeinfilter toepassen
	oudEnts := filterEntiteiten(oud.Entiteiten, cfg.domein)
	nieuwEnts := filterEntiteiten(nieuw.Entiteiten, cfg.domein)

	// Entiteiten vergelijken
	vergelijkEntiteiten(&rapport, oudEnts, nieuwEnts)

	// Enums vergelijken
	oudEnums := filterEnums(oud.Enums, cfg.domein)
	nieuwEnums := filterEnums(nieuw.Enums, cfg.domein)
	vergelijkEnums(&rapport, oudEnums, nieuwEnums)

	// Datatypes vergelijken
	oudDatatypes := filterDatatypes(oud.Datatypes, cfg.domein)
	nieuwDatatypes := filterDatatypes(nieuw.Datatypes, cfg.domein)
	vergelijkDatatypes(&rapport, oudDatatypes, nieuwDatatypes)

	// Referentielijst-instanties vergelijken
	vergelijkReferentielijsten(&rapport, oud.ReferentielijstInstanties, nieuw.ReferentielijstInstanties)

	return rapport
}

// ---- Filterhelpers ----

func filterEntiteiten(ents []model.V3Entiteit, domein string) []model.V3Entiteit {
	if domein == "" {
		return ents
	}
	var result []model.V3Entiteit
	for _, e := range ents {
		if e.Domein == domein {
			result = append(result, e)
		}
	}
	return result
}

func filterEnums(enums []model.V3Enum, domein string) []model.V3Enum {
	if domein == "" {
		return enums
	}
	var result []model.V3Enum
	for _, e := range enums {
		if e.Domein == domein || e.Domein == "" {
			result = append(result, e)
		}
	}
	return result
}

func filterDatatypes(datatypes []model.V3Datatype, domein string) []model.V3Datatype {
	if domein == "" {
		return datatypes
	}
	var result []model.V3Datatype
	for _, d := range datatypes {
		if d.Domein == domein || d.Domein == "" {
			result = append(result, d)
		}
	}
	return result
}

// ---- Entiteiten-vergelijking ----

func vergelijkEntiteiten(rapport *DeltaRapport, oud, nieuw []model.V3Entiteit) {
	oudMap := indexeerEntiteiten(oud)
	nieuwMap := indexeerEntiteiten(nieuw)

	// Verwijderde entiteiten
	for naam, oudEnt := range oudMap {
		if _, exists := nieuwMap[naam]; !exists {
			d := naamgeving.DeriveEntiteit(oudEnt)
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Destructief,
				Categorie:    CategorieEntiteit,
				Actie:        ActieVerwijderd,
				Pad:          naam,
				OudeWaarde:   naam,
				Omschrijving: fmt.Sprintf("Entiteit '%s' verwijderd", naam),
				Tabelnaam:    d.Tabelnaam,
			})
			// Alle onderliggende tabellen worden ook verwijderd (cascade)
			voegVerwijderdeOnderliggendenToe(rapport, oudEnt)
		}
	}

	// Toegevoegde entiteiten
	for naam, nieuwEnt := range nieuwMap {
		if _, exists := oudMap[naam]; !exists {
			d := naamgeving.DeriveEntiteit(nieuwEnt)
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Additief,
				Categorie:    CategorieEntiteit,
				Actie:        ActieToeGevoegd,
				Pad:          naam,
				NieuweWaarde: naam,
				Omschrijving: fmt.Sprintf("Entiteit '%s' toegevoegd", naam),
				Tabelnaam:    d.Tabelnaam,
			})
			// Alle onderliggende tabellen worden ook aangemaakt
			voegToegevoegdeOnderliggendenToe(rapport, nieuwEnt)
		}
	}

	// Gewijzigde entiteiten
	for naam, oudEnt := range oudMap {
		if nieuwEnt, exists := nieuwMap[naam]; exists {
			vergelijkEntiteit(rapport, oudEnt, nieuwEnt)
		}
	}
}

func vergelijkEntiteit(rapport *DeltaRapport, oud, nieuw model.V3Entiteit) {
	pad := oud.Typenaam

	// isMaterieel wijziging
	if oud.IsMaterieel != nieuw.IsMaterieel {
		if nieuw.IsMaterieel {
			// false → true: materiele plumbing tabellen nodig
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Modificatie,
				Categorie:    CategorieEntiteit,
				Actie:        ActieGewijzigd,
				Pad:          pad,
				OudeWaarde:   "isMaterieel=false",
				NieuweWaarde: "isMaterieel=true",
				Omschrijving: fmt.Sprintf("Entiteit '%s' wordt materieel — aanvang/einde tabellen nodig", pad),
				Tabelnaam:    strings.ToLower(oud.Typenaam),
			})
		} else {
			// true → false: materiele plumbing tabellen verwijderen
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Destructief,
				Categorie:    CategorieEntiteit,
				Actie:        ActieGewijzigd,
				Pad:          pad,
				OudeWaarde:   "isMaterieel=true",
				NieuweWaarde: "isMaterieel=false",
				Omschrijving: fmt.Sprintf("Entiteit '%s' wordt niet-materieel — aanvang/einde tabellen worden verwijderd", pad),
				Tabelnaam:    strings.ToLower(oud.Typenaam),
			})
		}
	}

	// description wijziging
	if oud.Description != nieuw.Description {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Informatief,
			Categorie:    CategorieEntiteit,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   oud.Description,
			NieuweWaarde: nieuw.Description,
			Omschrijving: fmt.Sprintf("Beschrijving van entiteit '%s' gewijzigd", pad),
		})
	}

	// kleur wijziging
	if oud.Kleur != nieuw.Kleur {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Informatief,
			Categorie:    CategorieEntiteit,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   oud.Kleur,
			NieuweWaarde: nieuw.Kleur,
			Omschrijving: fmt.Sprintf("Kleur van entiteit '%s' gewijzigd", pad),
		})
	}

	// Gegevenselementen vergelijken
	vergelijkGegevenselementen(rapport, pad, oud, nieuw)

	// Relaties vergelijken
	vergelijkRelaties(rapport, pad, oud, nieuw)
}

// ---- Gegevenselementen-vergelijking ----

func vergelijkGegevenselementen(rapport *DeltaRapport, entPad string, oud, nieuw model.V3Entiteit) {
	oudMap := indexeerGEs(oud.Gegevenselementen)
	nieuwMap := indexeerGEs(nieuw.Gegevenselementen)

	for naam, oudGE := range oudMap {
		if _, exists := nieuwMap[naam]; !exists {
			hubType := naamgeving.GeHubTypeName(oud, naam)
			hub := naamgeving.DeriveHub(oud.Typenaam, hubType, "gegevenselement", oudGE.IsMaterieel, oudGE.Meervoud, "")
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Destructief,
				Categorie:    CategorieGegevenselement,
				Actie:        ActieVerwijderd,
				Pad:          entPad + " > " + naam,
				OudeWaarde:   naam,
				Omschrijving: fmt.Sprintf("Gegevenselement '%s' verwijderd uit '%s'", naam, entPad),
				Tabelnaam:    hub.Tabelnaam,
			})
		}
	}

	for naam, nieuwGE := range nieuwMap {
		if _, exists := oudMap[naam]; !exists {
			hubType := naamgeving.GeHubTypeName(nieuw, naam)
			hub := naamgeving.DeriveHub(nieuw.Typenaam, hubType, "gegevenselement", nieuwGE.IsMaterieel, nieuwGE.Meervoud, "")
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Additief,
				Categorie:    CategorieGegevenselement,
				Actie:        ActieToeGevoegd,
				Pad:          entPad + " > " + naam,
				NieuweWaarde: naam,
				Omschrijving: fmt.Sprintf("Gegevenselement '%s' toegevoegd aan '%s'", naam, entPad),
				Tabelnaam:    hub.Tabelnaam,
			})
		}
	}

	for naam, oudGE := range oudMap {
		if nieuwGE, exists := nieuwMap[naam]; exists {
			vergelijkGE(rapport, entPad, oud, nieuw, oudGE, nieuwGE)
		}
	}
}

func vergelijkGE(rapport *DeltaRapport, entPad string, oudEnt, nieuwEnt model.V3Entiteit, oud, nieuw model.V3Gegevenselement) {
	pad := entPad + " > " + oud.Naam
	hubType := naamgeving.GeHubTypeName(oudEnt, oud.Naam)
	dataType := naamgeving.DeriveData(hubType, oudEnt.Typenaam)

	// isMaterieel
	if oud.IsMaterieel != nieuw.IsMaterieel {
		ernst := Modificatie
		if !nieuw.IsMaterieel {
			ernst = Destructief
		}
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        ernst,
			Categorie:    CategorieGegevenselement,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   fmt.Sprintf("isMaterieel=%v", oud.IsMaterieel),
			NieuweWaarde: fmt.Sprintf("isMaterieel=%v", nieuw.IsMaterieel),
			Omschrijving: fmt.Sprintf("Materialiteit van GE '%s' gewijzigd", pad),
			Tabelnaam:    dataType.Tabelnaam,
		})
	}

	// momentvoorkomen
	if oud.Momentvoorkomen != nieuw.Momentvoorkomen {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Modificatie,
			Categorie:    CategorieGegevenselement,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   oud.Momentvoorkomen,
			NieuweWaarde: nieuw.Momentvoorkomen,
			Omschrijving: fmt.Sprintf("Momentvoorkomen van GE '%s' gewijzigd van '%s' naar '%s'", pad, oud.Momentvoorkomen, nieuw.Momentvoorkomen),
		})
	}

	// description
	if oud.Description != nieuw.Description {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Informatief,
			Categorie:    CategorieGegevenselement,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   oud.Description,
			NieuweWaarde: nieuw.Description,
			Omschrijving: fmt.Sprintf("Beschrijving van GE '%s' gewijzigd", pad),
		})
	}

	// Velden vergelijken
	vergelijkVelden(rapport, pad, dataType.Tabelnaam, oud.Velden, nieuw.Velden)
}

// ---- Relaties-vergelijking ----

func vergelijkRelaties(rapport *DeltaRapport, entPad string, oud, nieuw model.V3Entiteit) {
	oudMap := indexeerRelaties(oud.Relaties)
	nieuwMap := indexeerRelaties(nieuw.Relaties)

	for naam, oudRel := range oudMap {
		if _, exists := nieuwMap[naam]; !exists {
			hub := naamgeving.DeriveHub(oud.Typenaam, naam, "relatie", oudRel.IsMaterieel, oudRel.Meervoud, "")
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Destructief,
				Categorie:    CategorieRelatie,
				Actie:        ActieVerwijderd,
				Pad:          entPad + " > " + naam,
				OudeWaarde:   naam,
				Omschrijving: fmt.Sprintf("Relatie '%s' verwijderd uit '%s'", naam, entPad),
				Tabelnaam:    hub.Tabelnaam,
			})
		}
	}

	for naam, nieuwRel := range nieuwMap {
		if _, exists := oudMap[naam]; !exists {
			hub := naamgeving.DeriveHub(nieuw.Typenaam, naam, "relatie", nieuwRel.IsMaterieel, nieuwRel.Meervoud, "")
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Additief,
				Categorie:    CategorieRelatie,
				Actie:        ActieToeGevoegd,
				Pad:          entPad + " > " + naam,
				NieuweWaarde: naam,
				Omschrijving: fmt.Sprintf("Relatie '%s' toegevoegd aan '%s'", naam, entPad),
				Tabelnaam:    hub.Tabelnaam,
			})
		}
	}

	for naam, oudRel := range oudMap {
		if nieuwRel, exists := nieuwMap[naam]; exists {
			vergelijkRelatie(rapport, entPad, oud, oudRel, nieuwRel)
		}
	}
}

func vergelijkRelatie(rapport *DeltaRapport, entPad string, oudEnt model.V3Entiteit, oud, nieuw model.V3Relatie) {
	pad := entPad + " > " + oud.Naam

	// doelEntiteit: bij wijziging is FK gebroken → destructief
	if oud.DoelEntiteit != nieuw.DoelEntiteit {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Destructief,
			Categorie:    CategorieRelatie,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   oud.DoelEntiteit,
			NieuweWaarde: nieuw.DoelEntiteit,
			Omschrijving: fmt.Sprintf("DoelEntiteit van relatie '%s' gewijzigd van '%s' naar '%s' — FK moet opnieuw worden aangemaakt", pad, oud.DoelEntiteit, nieuw.DoelEntiteit),
			Tabelnaam:    strings.ToLower(oud.Naam),
		})
	}

	// isMaterieel
	if oud.IsMaterieel != nieuw.IsMaterieel {
		ernst := Modificatie
		if !nieuw.IsMaterieel {
			ernst = Destructief
		}
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        ernst,
			Categorie:    CategorieRelatie,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   fmt.Sprintf("isMaterieel=%v", oud.IsMaterieel),
			NieuweWaarde: fmt.Sprintf("isMaterieel=%v", nieuw.IsMaterieel),
			Omschrijving: fmt.Sprintf("Materialiteit van relatie '%s' gewijzigd", pad),
			Tabelnaam:    strings.ToLower(oud.Naam),
		})
	}

	// momentvoorkomen
	if oud.Momentvoorkomen != nieuw.Momentvoorkomen {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Modificatie,
			Categorie:    CategorieRelatie,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   oud.Momentvoorkomen,
			NieuweWaarde: nieuw.Momentvoorkomen,
			Omschrijving: fmt.Sprintf("Momentvoorkomen van relatie '%s' gewijzigd", pad),
		})
	}

	// description
	if oud.Description != nieuw.Description {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Informatief,
			Categorie:    CategorieRelatie,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   oud.Description,
			NieuweWaarde: nieuw.Description,
			Omschrijving: fmt.Sprintf("Beschrijving van relatie '%s' gewijzigd", pad),
		})
	}

	// Velden vergelijken (op de _Data tabel)
	if len(oud.Velden) > 0 || len(nieuw.Velden) > 0 {
		dataType := naamgeving.DeriveData(oud.Naam, oudEnt.Typenaam)
		vergelijkVelden(rapport, pad, dataType.Tabelnaam, oud.Velden, nieuw.Velden)
	}
}

// ---- Velden-vergelijking ----

func vergelijkVelden(rapport *DeltaRapport, parentPad, tabelnaam string, oud, nieuw []model.V3Veld) {
	oudMap := indexeerVelden(oud)
	nieuwMap := indexeerVelden(nieuw)

	for naam, oudVeld := range oudMap {
		if _, exists := nieuwMap[naam]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Destructief,
				Categorie:    CategorieVeld,
				Actie:        ActieVerwijderd,
				Pad:          parentPad + " > " + naam,
				OudeWaarde:   oudVeld.GoType,
				Omschrijving: fmt.Sprintf("Veld '%s' verwijderd uit '%s'", naam, parentPad),
				Tabelnaam:    tabelnaam,
				Kolomnaam:    naam,
			})
		}
	}

	for naam, nieuwVeld := range nieuwMap {
		if _, exists := oudMap[naam]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Additief,
				Categorie:    CategorieVeld,
				Actie:        ActieToeGevoegd,
				Pad:          parentPad + " > " + naam,
				NieuweWaarde: nieuwVeld.GoType,
				Omschrijving: fmt.Sprintf("Veld '%s' (%s) toegevoegd aan '%s'", naam, nieuwVeld.GoType, parentPad),
				Tabelnaam:    tabelnaam,
				Kolomnaam:    naam,
				DBType:       naamgeving.GoTypeToDBType(nieuwVeld.GoType),
			})
		}
	}

	for naam, oudVeld := range oudMap {
		if nieuwVeld, exists := nieuwMap[naam]; exists {
			vergelijkVeld(rapport, parentPad, tabelnaam, naam, oudVeld, nieuwVeld)
		}
	}
}

func vergelijkVeld(rapport *DeltaRapport, parentPad, tabelnaam, naam string, oud, nieuw model.V3Veld) {
	pad := parentPad + " > " + naam

	// goType wijziging
	if oud.GoType != nieuw.GoType {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Modificatie,
			Categorie:    CategorieVeld,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   oud.GoType,
			NieuweWaarde: nieuw.GoType,
			Omschrijving: fmt.Sprintf("Type van veld '%s' gewijzigd van '%s' naar '%s'", pad, oud.GoType, nieuw.GoType),
			Tabelnaam:    tabelnaam,
			Kolomnaam:    naam,
			DBType:       naamgeving.GoTypeToDBType(nieuw.GoType),
		})
	}

	// verplicht: false → true (NOT NULL toevoegen)
	if !oud.Verplicht && nieuw.Verplicht {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Modificatie,
			Categorie:    CategorieVeld,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   "verplicht=false",
			NieuweWaarde: "verplicht=true",
			Omschrijving: fmt.Sprintf("Veld '%s' wordt verplicht — SET NOT NULL vereist", pad),
			Tabelnaam:    tabelnaam,
			Kolomnaam:    naam,
		})
	}

	// verplicht: true → false (NOT NULL verwijderen, veilig)
	if oud.Verplicht && !nieuw.Verplicht {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Informatief,
			Categorie:    CategorieVeld,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   "verplicht=true",
			NieuweWaarde: "verplicht=false",
			Omschrijving: fmt.Sprintf("Veld '%s' wordt optioneel — DROP NOT NULL", pad),
			Tabelnaam:    tabelnaam,
			Kolomnaam:    naam,
		})
	}

	// enum wijziging
	if oud.Enum != nieuw.Enum {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Modificatie,
			Categorie:    CategorieVeld,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   "enum=" + oud.Enum,
			NieuweWaarde: "enum=" + nieuw.Enum,
			Omschrijving: fmt.Sprintf("Enum-referentie van veld '%s' gewijzigd", pad),
			Tabelnaam:    tabelnaam,
			Kolomnaam:    naam,
		})
	}

	// description
	if oud.Description != nieuw.Description {
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Informatief,
			Categorie:    CategorieVeld,
			Actie:        ActieGewijzigd,
			Pad:          pad,
			OudeWaarde:   oud.Description,
			NieuweWaarde: nieuw.Description,
			Omschrijving: fmt.Sprintf("Beschrijving van veld '%s' gewijzigd", pad),
		})
	}
}

// ---- Enum-vergelijking ----

func vergelijkEnums(rapport *DeltaRapport, oud, nieuw []model.V3Enum) {
	oudMap := indexeerEnums(oud)
	nieuwMap := indexeerEnums(nieuw)

	for goType := range oudMap {
		if _, exists := nieuwMap[goType]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Modificatie,
				Categorie:    CategorieEnum,
				Actie:        ActieVerwijderd,
				Pad:          goType,
				OudeWaarde:   goType,
				Omschrijving: fmt.Sprintf("Enum '%s' verwijderd — data-integriteitsrisico voor bestaande records", goType),
			})
		}
	}

	for goType := range nieuwMap {
		if _, exists := oudMap[goType]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Informatief,
				Categorie:    CategorieEnum,
				Actie:        ActieToeGevoegd,
				Pad:          goType,
				NieuweWaarde: goType,
				Omschrijving: fmt.Sprintf("Enum '%s' toegevoegd", goType),
			})
		}
	}

	for goType, oudEnum := range oudMap {
		if nieuwEnum, exists := nieuwMap[goType]; exists {
			vergelijkEnum(rapport, goType, oudEnum, nieuwEnum)
		}
	}
}

func vergelijkEnum(rapport *DeltaRapport, goType string, oud, nieuw model.V3Enum) {
	oudWaarden := make(map[string]string)
	for _, w := range oud.Waarden {
		oudWaarden[w.ConstNaam] = w.Waarde
	}

	nieuwWaarden := make(map[string]string)
	for _, w := range nieuw.Waarden {
		nieuwWaarden[w.ConstNaam] = w.Waarde
	}

	for constNaam := range oudWaarden {
		if _, exists := nieuwWaarden[constNaam]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Modificatie,
				Categorie:    CategorieEnum,
				Actie:        ActieGewijzigd,
				Pad:          goType + " > " + constNaam,
				OudeWaarde:   constNaam,
				Omschrijving: fmt.Sprintf("Enum-waarde '%s' verwijderd uit '%s' — data-integriteitsrisico", constNaam, goType),
			})
		}
	}

	for constNaam := range nieuwWaarden {
		if _, exists := oudWaarden[constNaam]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Informatief,
				Categorie:    CategorieEnum,
				Actie:        ActieGewijzigd,
				Pad:          goType + " > " + constNaam,
				NieuweWaarde: constNaam,
				Omschrijving: fmt.Sprintf("Enum-waarde '%s' toegevoegd aan '%s'", constNaam, goType),
			})
		}
	}
}

// ---- Datatype-vergelijking ----

func vergelijkDatatypes(rapport *DeltaRapport, oud, nieuw []model.V3Datatype) {
	oudMap := indexeerDatatypes(oud)
	nieuwMap := indexeerDatatypes(nieuw)

	for naam := range oudMap {
		if _, exists := nieuwMap[naam]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Modificatie,
				Categorie:    CategorieDatatype,
				Actie:        ActieVerwijderd,
				Pad:          naam,
				OudeWaarde:   naam,
				Omschrijving: fmt.Sprintf("Datatype '%s' verwijderd", naam),
			})
		}
	}

	for naam := range nieuwMap {
		if _, exists := oudMap[naam]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Informatief,
				Categorie:    CategorieDatatype,
				Actie:        ActieToeGevoegd,
				Pad:          naam,
				NieuweWaarde: naam,
				Omschrijving: fmt.Sprintf("Datatype '%s' toegevoegd", naam),
			})
		}
	}

	for naam, oudDT := range oudMap {
		if nieuwDT, exists := nieuwMap[naam]; exists {
			if oudDT.Basistype != nieuwDT.Basistype {
				rapport.Items = append(rapport.Items, DeltaItem{
					Ernst:        Modificatie,
					Categorie:    CategorieDatatype,
					Actie:        ActieGewijzigd,
					Pad:          naam,
					OudeWaarde:   oudDT.Basistype,
					NieuweWaarde: nieuwDT.Basistype,
					Omschrijving: fmt.Sprintf("Basistype van datatype '%s' gewijzigd van '%s' naar '%s'", naam, oudDT.Basistype, nieuwDT.Basistype),
				})
			}
		}
	}
}

// ---- Referentielijsten-vergelijking ----

func vergelijkReferentielijsten(rapport *DeltaRapport, oud, nieuw []model.V3ReferentielijstInstantie) {
	oudMap := make(map[string]model.V3ReferentielijstInstantie)
	for _, r := range oud {
		oudMap[r.Systeemnaam] = r
	}
	nieuwMap := make(map[string]model.V3ReferentielijstInstantie)
	for _, r := range nieuw {
		nieuwMap[r.Systeemnaam] = r
	}

	for naam := range oudMap {
		if _, exists := nieuwMap[naam]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Modificatie,
				Categorie:    CategorieReferentielijst,
				Actie:        ActieVerwijderd,
				Pad:          naam,
				OudeWaarde:   naam,
				Omschrijving: fmt.Sprintf("Referentielijst-instantie '%s' verwijderd", naam),
			})
		}
	}

	for naam := range nieuwMap {
		if _, exists := oudMap[naam]; !exists {
			rapport.Items = append(rapport.Items, DeltaItem{
				Ernst:        Informatief,
				Categorie:    CategorieReferentielijst,
				Actie:        ActieToeGevoegd,
				Pad:          naam,
				NieuweWaarde: naam,
				Omschrijving: fmt.Sprintf("Referentielijst-instantie '%s' toegevoegd", naam),
			})
		}
	}
}

// ---- Helpers voor verwijderde/toegevoegde onderliggende types ----

func voegVerwijderdeOnderliggendenToe(rapport *DeltaRapport, ent model.V3Entiteit) {
	for _, ge := range ent.Gegevenselementen {
		hubType := naamgeving.GeHubTypeName(ent, ge.Naam)
		hub := naamgeving.DeriveHub(ent.Typenaam, hubType, "gegevenselement", ge.IsMaterieel, ge.Meervoud, "")
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Destructief,
			Categorie:    CategorieGegevenselement,
			Actie:        ActieVerwijderd,
			Pad:          ent.Typenaam + " > " + ge.Naam,
			OudeWaarde:   ge.Naam,
			Omschrijving: fmt.Sprintf("GE '%s' verwijderd (onderdeel van verwijderde entiteit '%s')", ge.Naam, ent.Typenaam),
			Tabelnaam:    hub.Tabelnaam,
		})
	}
	for _, rel := range ent.Relaties {
		hub := naamgeving.DeriveHub(ent.Typenaam, rel.Naam, "relatie", rel.IsMaterieel, rel.Meervoud, "")
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Destructief,
			Categorie:    CategorieRelatie,
			Actie:        ActieVerwijderd,
			Pad:          ent.Typenaam + " > " + rel.Naam,
			OudeWaarde:   rel.Naam,
			Omschrijving: fmt.Sprintf("Relatie '%s' verwijderd (onderdeel van verwijderde entiteit '%s')", rel.Naam, ent.Typenaam),
			Tabelnaam:    hub.Tabelnaam,
		})
	}
}

func voegToegevoegdeOnderliggendenToe(rapport *DeltaRapport, ent model.V3Entiteit) {
	for _, ge := range ent.Gegevenselementen {
		hubType := naamgeving.GeHubTypeName(ent, ge.Naam)
		hub := naamgeving.DeriveHub(ent.Typenaam, hubType, "gegevenselement", ge.IsMaterieel, ge.Meervoud, "")
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Additief,
			Categorie:    CategorieGegevenselement,
			Actie:        ActieToeGevoegd,
			Pad:          ent.Typenaam + " > " + ge.Naam,
			NieuweWaarde: ge.Naam,
			Omschrijving: fmt.Sprintf("GE '%s' toegevoegd (onderdeel van nieuwe entiteit '%s')", ge.Naam, ent.Typenaam),
			Tabelnaam:    hub.Tabelnaam,
		})
	}
	for _, rel := range ent.Relaties {
		hub := naamgeving.DeriveHub(ent.Typenaam, rel.Naam, "relatie", rel.IsMaterieel, rel.Meervoud, "")
		rapport.Items = append(rapport.Items, DeltaItem{
			Ernst:        Additief,
			Categorie:    CategorieRelatie,
			Actie:        ActieToeGevoegd,
			Pad:          ent.Typenaam + " > " + rel.Naam,
			NieuweWaarde: rel.Naam,
			Omschrijving: fmt.Sprintf("Relatie '%s' toegevoegd (onderdeel van nieuwe entiteit '%s')", rel.Naam, ent.Typenaam),
			Tabelnaam:    hub.Tabelnaam,
		})
	}
}

// ---- Indexeerfuncties ----

func indexeerEntiteiten(ents []model.V3Entiteit) map[string]model.V3Entiteit {
	m := make(map[string]model.V3Entiteit, len(ents))
	for _, e := range ents {
		m[e.Typenaam] = e
	}
	return m
}

func indexeerGEs(ges []model.V3Gegevenselement) map[string]model.V3Gegevenselement {
	m := make(map[string]model.V3Gegevenselement, len(ges))
	for _, ge := range ges {
		m[ge.Naam] = ge
	}
	return m
}

func indexeerRelaties(rels []model.V3Relatie) map[string]model.V3Relatie {
	m := make(map[string]model.V3Relatie, len(rels))
	for _, r := range rels {
		m[r.Naam] = r
	}
	return m
}

func indexeerVelden(velden []model.V3Veld) map[string]model.V3Veld {
	m := make(map[string]model.V3Veld, len(velden))
	for _, v := range velden {
		m[v.Naam] = v
	}
	return m
}

func indexeerEnums(enums []model.V3Enum) map[string]model.V3Enum {
	m := make(map[string]model.V3Enum, len(enums))
	for _, e := range enums {
		m[e.GoType] = e
	}
	return m
}

func indexeerDatatypes(datatypes []model.V3Datatype) map[string]model.V3Datatype {
	m := make(map[string]model.V3Datatype, len(datatypes))
	for _, d := range datatypes {
		m[d.Naam] = d
	}
	return m
}
