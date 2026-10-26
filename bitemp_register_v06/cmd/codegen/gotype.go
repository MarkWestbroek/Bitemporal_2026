package main

import (
	"fmt"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/naamgeving"
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

// padnaamBotsingen meldt padnamen van het te genereren model die al bij een type uit een ánder
// domein in de MetaRegistry van deze build staan. Elke padnaam wordt een route
// (routes/addroutes_helper.go); gin paniekt bij het opstarten op een dubbele route
// ("handlers are already registered for path '/producten'", Fundament 23-10-2026). Types van het
// eigen domein (die opnieuw gegenereerd worden) tellen niet mee.
func padnaamBotsingen(v3 model.V3Model, domein string) []string {
	eigen := map[string]bool{}
	nieuw := map[string]string{} // padnaam → typenaam in het nieuwe model
	for _, d := range naamgeving.AlleDerivedTypes(entiteitenVanDomein(v3, domein)) {
		eigen[d.Typenaam] = true
		if p := strings.TrimSpace(d.Padnaam); p != "" {
			if _, al := nieuw[p]; !al {
				nieuw[p] = d.Typenaam
			}
		}
	}
	var errs []string
	for typenaam, meta := range model.MetaRegistry {
		if eigen[typenaam] || meta.Padnaam == "" || (domein != "" && strings.EqualFold(meta.Domein, domein)) {
			continue
		}
		if t, ok := nieuw[meta.Padnaam]; ok {
			errs = append(errs, fmt.Sprintf("padnaam '%s' van %s bestaat al bij %s (domein %s): dat wordt een dubbele route; kies een ander meervoud", meta.Padnaam, t, typenaam, meta.Domein))
		}
	}
	sort.Strings(errs)
	return errs
}

// onbekendDomeinFout: niet leeg als het model geen entiteit, datatype of enum van dit domein bevat.
// Voor "register" tellen entiteiten zonder domein mee, en voor elk domein dat gelijk is aan de
// modelnaam ook (zelfde regels als het domeinfilter in main).
func onbekendDomeinFout(v3 model.V3Model, domein string) string {
	bekend := map[string]bool{}
	for _, e := range v3.Entiteiten {
		d := strings.TrimSpace(e.Domein)
		if d == domein || (d == "" && (domein == "register" || v3.Naam == domein)) {
			return ""
		}
		if d != "" {
			bekend[d] = true
		}
	}
	for _, dt := range v3.Datatypes {
		if strings.TrimSpace(dt.Domein) == domein {
			return ""
		}
	}
	for _, en := range v3.Enums { // domeinRunsUitModel (rebuild) maakt ook runs voor enum-domeinen
		if strings.TrimSpace(en.Domein) == domein {
			return ""
		}
	}
	namen := make([]string, 0, len(bekend))
	for d := range bekend {
		namen = append(namen, d)
	}
	sort.Strings(namen)
	tip := ""
	if strings.ContainsAny(domein, ", ") {
		tip = " Eén domein per run; geef meerdere domeinen als aparte runs op."
	}
	return fmt.Sprintf("domein %q komt niet voor in het model (domeinen in het model: %s).%s", domein, strings.Join(namen, ", "), tip)
}

// typenaamBotsingen meldt typenamen van het te genereren model (entiteiten, GE-hubs, relaties en
// hun _Data/_Aanvang/_Einde) die al bij een type uit een ánder domein in de MetaRegistry van deze
// build bestaan. Go-typen en tabelnamen zijn niet per domein geprefixt: een tweede NatuurlijkPersoon
// (relatiebeheer naast np-loc) of Contactpersoon (naast CG) geeft "redeclared in this block" pas bij
// go build (FUNDAMENT, 26-10-2026). Types van het eigen domein tellen niet mee.
func typenaamBotsingen(v3 model.V3Model, domein string) []string {
	var errs []string
	gemeld := map[string]bool{}
	for _, d := range naamgeving.AlleDerivedTypes(entiteitenVanDomein(v3, domein)) {
		bestaand, ok := model.MetaRegistry[d.Typenaam]
		if !ok || gemeld[d.Typenaam] || (domein != "" && strings.EqualFold(bestaand.Domein, domein)) {
			continue
		}
		gemeld[d.Typenaam] = true
		errs = append(errs, fmt.Sprintf("typenaam '%s' bestaat al in domein %s (%s): Go-typen en tabellen zijn niet per domein geprefixt; kies een andere naam (bv. met het domein ervoor)", d.Typenaam, bestaand.Domein, metatypeTekst(bestaand)))
	}
	sort.Strings(errs)
	return errs
}

func metatypeTekst(m model.TypeMeta) string {
	switch m.Metatype {
	case model.MetatypeEntiteit:
		return "entiteit"
	case model.MetatypeRelatie:
		return "relatie"
	default:
		return "gegevenselement"
	}
}

// entiteitenVanDomein: het model beperkt tot de entiteiten die deze run genereert (zelfde regels
// als het domeinfilter in main: het domein zelf, en entiteiten zonder domein bij "register" of bij
// de modelnaam). Nodig voor de botsingscontroles: een samengesteld model bevat ook de entiteiten
// van domeinen die al in de MetaRegistry van deze codegen-build zitten (bv. inrichting, als die
// eerder gegenereerd is) en die zouden anders tegen zichzelf botsen.
func entiteitenVanDomein(v3 model.V3Model, domein string) model.V3Model {
	if domein == "" {
		return v3
	}
	uit := v3
	uit.Entiteiten = nil
	for _, e := range v3.Entiteiten {
		d := strings.TrimSpace(e.Domein)
		if d == domein || (d == "" && (domein == "register" || v3.Naam == domein)) {
			uit.Entiteiten = append(uit.Entiteiten, e)
		}
	}
	return uit
}

// maxTabelnaam: Postgres kapt identifiers af op 63 tekens (NAMEDATALEN-1). Een langere tabelnaam
// wordt stil ingekort, maar triggers en constraints verwijzen naar de volledige naam en falen dan
// ("column versie of relation … does not exist", FUNDAMENT 26-10-2026 bij een GE dat de
// entiteitsnaam herhaalt: natuurlijkpersoonzonderregistratie_natuurlijkpersoonzonderregistratiegegevens_data).
const maxTabelnaam = 63

// tabelnaamTeLang meldt afgeleide tabellen (hubs, _Data, _Aanvang, _Einde) met een te lange naam.
func tabelnaamTeLang(v3 model.V3Model, domein string) []string {
	var errs []string
	for _, d := range naamgeving.AlleDerivedTypes(entiteitenVanDomein(v3, domein)) {
		if len(d.Tabelnaam) > maxTabelnaam {
			errs = append(errs, fmt.Sprintf("tabelnaam '%s' (%s) is %d tekens; Postgres staat %d toe. Kort de naam van het gegevenselement of de relatie in (het hoeft de entiteitsnaam niet te herhalen)", d.Tabelnaam, d.Typenaam, len(d.Tabelnaam), maxTabelnaam))
		}
	}
	sort.Strings(errs)
	return errs
}
