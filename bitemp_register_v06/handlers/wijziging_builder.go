// Package handlers — wijziging_builder.go
//
// FASE 2 (REST/CRUD-laag, 2026-04-29): pure wijziging-builder voor PATCH /full/{padnaam}/:id.
//
// Vertaalt een JSON Merge Patch (RFC 7396) op een full-entity payload naar
// een lijst []model.WijzigingRequest die de bestaande RegistreerCore-engine
// (fase 0) verwerkt. Geen DB-toegang in deze functie; volledig pure logica.
//
// Ontwerpkeuzes (zie design-checkpoint in chat 2026-04-29):
//   - Hybride wrapper: body MAG met of zonder ENT-wrapper komen. Zonder
//     wrapper wrappen we server-side alvorens te unmarshallen, zodat de
//     bestaande RepresentatiePlusNaam.UnmarshalJSON 1-op-1 herbruikbaar is.
//   - URL-id is leidend; payload-id mag, maar mismatch → 409.
//   - Modus default = registratie. correctie vergt rel_id per GE/REL.
//   - PATCH op velden direct op ENT-niveau (anders dan id en JSONRolnamen
//     van onderliggende GE's/RELs) → 400 ("ENT zelf is niet patchable").
//   - null op een onderliggend GE/REL-veld in de body = afvoer van die GE/REL.
//   - Lege effectieve patch (na validatie/no-ops) → 400.
package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// PatchModus bepaalt of een PATCH een nieuwe registratie of een correctie van bestaande versies oplevert.
type PatchModus string

const (
	PatchModusRegistratie PatchModus = "registratie"
	PatchModusCorrectie   PatchModus = "correctie"
)

// BouwWijzigingenInput verzamelt alle invoer die de wijziging-builder nodig heeft.
type BouwWijzigingenInput struct {
	Meta  model.TypeMeta // metadata van het ENT-type (uit URL)
	URLID string         // ENT-id uit de URL (leidend)
	Body  []byte         // raw JSON van de PATCH-body (mag met of zonder ENT-wrapper)
	Modus PatchModus     // registratie (default) of correctie
}

// BouwWijzigingenResult bevat het resultaat van de builder.
type BouwWijzigingenResult struct {
	Wijzigingen []model.WijzigingRequest
	Meldingen   []string // niet-fatale waarschuwingen (bv. no-op rel_id zonder velden)
}

// BouwWijzigingen vertaalt een PATCH-body naar wijzigingen.
//
// Foutgevallen:
//   - 400: body is geen geldig JSON-object; bevat verboden velden op ENT-niveau;
//     correctie zonder rel_id; lege effectieve patch.
//   - 409: payload-id ≠ URL-id.
func BouwWijzigingen(in BouwWijzigingenInput) (*BouwWijzigingenResult, *RegistreerError) {
	if in.Meta.Metatype != model.MetatypeEntiteit {
		return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("PATCH /full is alleen ondersteund voor entiteit-types, niet voor %s (%s)", in.Meta.Typenaam, in.Meta.Metatype)}
	}
	if in.URLID == "" {
		return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: "ID must be present"}
	}
	if in.Modus == "" {
		in.Modus = PatchModusRegistratie
	}
	if in.Modus != PatchModusRegistratie && in.Modus != PatchModusCorrectie {
		return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("onbekende modus %q (geldig: registratie, correctie)", in.Modus)}
	}

	// Stap 1: parse body als losse map[string]json.RawMessage.
	var topLevel map[string]json.RawMessage
	if err := json.Unmarshal(in.Body, &topLevel); err != nil {
		return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("ongeldige JSON-body: %v", err)}
	}
	if len(topLevel) == 0 {
		return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: "PATCH-body is leeg"}
	}

	// Stap 2: hybride wrapper-detectie. Als top-level exact één key heeft die
	// gelijk is aan meta.Veldnaam → variant A (mét wrapper). Anders variant B
	// (zonder wrapper) → server-side wrappen.
	var entPayload map[string]json.RawMessage
	if len(topLevel) == 1 {
		if raw, ok := topLevel[in.Meta.Veldnaam]; ok {
			if err := json.Unmarshal(raw, &entPayload); err != nil {
				return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("ongeldige inhoud onder %q: %v", in.Meta.Veldnaam, err)}
			}
		}
	}
	if entPayload == nil {
		// variant B: top-level IS het ENT-payload object
		entPayload = topLevel
	}

	// Stap 3: id-controle. Payload-id mag, maar moet matchen met URL-id.
	if rawID, ok := entPayload[in.Meta.IDKolom]; ok {
		// Vergelijk als string om type-issues (int vs string) te omzeilen.
		var anyID any
		if err := json.Unmarshal(rawID, &anyID); err != nil {
			return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("ongeldige %s in payload: %v", in.Meta.IDKolom, err)}
		}
		if fmt.Sprintf("%v", anyID) != in.URLID {
			return nil, &RegistreerError{Status: http.StatusConflict, Msg: fmt.Sprintf("%s in payload (%v) komt niet overeen met %s in URL (%s)", in.Meta.IDKolom, anyID, in.Meta.IDKolom, in.URLID)}
		}
	}

	// Stap 4: bouw lookup van JSONRolnaam → OnderliggendGegevenselement.
	rollen := make(map[string]model.OnderliggendGegevenselement, len(in.Meta.OnderliggendeGegevenselementen))
	for _, og := range in.Meta.OnderliggendeGegevenselementen {
		if og.JSONRolnaam != "" {
			rollen[og.JSONRolnaam] = og
		}
	}

	// Stap 5: itereer top-level velden van ENT-payload. Sta toe: id-veld + JSONRolnamen.
	// Andere velden → 400 (ENT zelf is niet patchable).
	out := &BouwWijzigingenResult{}
	for veld, raw := range entPayload {
		if veld == in.Meta.IDKolom {
			continue
		}
		og, isRol := rollen[veld]
		if !isRol {
			return nil, &RegistreerError{
				Status: http.StatusBadRequest,
				Msg: fmt.Sprintf(
					"veld %q is geen onderliggend GE/relatie van %s; PATCH op ENT-velden is niet ondersteund (een ENT zelf is niet wijzigbaar — alleen onderliggende GE's, RELs en plumbing aanvang/einde)",
					veld, in.Meta.Typenaam),
			}
		}

		if err := bouwWijzigingenVoorRol(og, raw, in.Modus, out); err != nil {
			return nil, err
		}
	}

	if len(out.Wijzigingen) == 0 {
		return nil, &RegistreerError{Status: http.StatusBadRequest, Msg: "PATCH-body bevat geen effectieve wijzigingen"}
	}

	return out, nil
}

// bouwWijzigingenVoorRol verwerkt één onderliggend GE/REL veld uit de patch-body.
//
// Drie vormen van raw mogelijk:
//   - "null"           → afvoer van de hele relatie/GE (gehele key wegnemen)
//   - object {…}        → enkelvoudig: één wijziging
//   - array [{…}, …]   → meervoudig: wijziging per item
func bouwWijzigingenVoorRol(og model.OnderliggendGegevenselement, raw json.RawMessage, modus PatchModus, out *BouwWijzigingenResult) *RegistreerError {
	doelMeta, ok := model.MetaRegistry.GetTypeMeta(og.Doeltype)
	if !ok {
		return &RegistreerError{Status: http.StatusInternalServerError, Msg: fmt.Sprintf("onbekend doeltype %s voor rol %s", og.Doeltype, og.JSONRolnaam)}
	}

	rawTrimmed := bytesTrim(raw)

	// null → afvoer (engine-helper bepaalt welke versie afgevoerd wordt op basis van actuele toestand)
	if string(rawTrimmed) == "null" {
		// Voor afvoer-zonder-id moet de engine de huidige actieve versie kunnen vinden.
		// In v1 ondersteunen we afvoer-via-null alleen op enkelvoudige rollen (engine zoekt actuele).
		if og.Momentvoorkomen != model.Enkelvoudig {
			return &RegistreerError{
				Status: http.StatusBadRequest,
				Msg:    fmt.Sprintf("null-afvoer is alleen ondersteund voor enkelvoudige rollen; rol %q is meervoudig — geef een array met expliciete rel_id-items op", og.JSONRolnaam),
			}
		}
		// Hier bouwen we een Afvoer-wijziging zonder body — de URL-loader zal dit niet steunen
		// in v1; we geven een melding en slaan over.
		out.Meldingen = append(out.Meldingen,
			fmt.Sprintf("rol %q: null-afvoer wordt in deze fase nog niet ondersteund door de engine; gebruik POST /registratie/ met expliciete Afvoer", og.JSONRolnaam))
		return nil
	}

	// array of object?
	switch rawTrimmed[0] {
	case '[':
		var items []json.RawMessage
		if err := json.Unmarshal(rawTrimmed, &items); err != nil {
			return &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("rol %q: array-payload ongeldig: %v", og.JSONRolnaam, err)}
		}
		for i, item := range items {
			if rerr := bouwWijzigingVoorItem(doelMeta, og, item, modus, out, i); rerr != nil {
				return rerr
			}
		}
	case '{':
		if rerr := bouwWijzigingVoorItem(doelMeta, og, rawTrimmed, modus, out, -1); rerr != nil {
			return rerr
		}
	default:
		return &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("rol %q: payload moet object, array of null zijn", og.JSONRolnaam)}
	}
	return nil
}

// bouwWijzigingVoorItem bouwt één Opvoer-wijziging (registratie) of Afvoer+Opvoer-paar (correctie)
// voor één GE/REL-item.
func bouwWijzigingVoorItem(doelMeta model.TypeMeta, og model.OnderliggendGegevenselement, item json.RawMessage, modus PatchModus, out *BouwWijzigingenResult, indexInArray int) *RegistreerError {
	var itemMap map[string]json.RawMessage
	if err := json.Unmarshal(item, &itemMap); err != nil {
		return &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("rol %q: item-payload ongeldig: %v", og.JSONRolnaam, err)}
	}

	// Tel niet-rel_id velden — een item met alléén rel_id is een no-op (waarschuwing, geen fout).
	relIDRaw, hasRelID := itemMap["rel_id"]
	overigeVelden := 0
	for k := range itemMap {
		if k != "rel_id" {
			overigeVelden++
		}
	}

	if modus == PatchModusCorrectie {
		if !hasRelID {
			locatie := og.JSONRolnaam
			if indexInArray >= 0 {
				locatie = fmt.Sprintf("%s[%d]", og.JSONRolnaam, indexInArray)
			}
			return &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("rol %q: correctie vereist rel_id (locatie: %s)", og.JSONRolnaam, locatie)}
		}
		if overigeVelden == 0 {
			out.Meldingen = append(out.Meldingen,
				fmt.Sprintf("rol %q: item met rel_id=%s zonder verdere velden — niets te corrigeren, overgeslagen", og.JSONRolnaam, string(relIDRaw)))
			return nil
		}
	} else {
		// modus=registratie: rel_id heeft geen betekenis (engine genereert nieuwe id).
		if hasRelID {
			out.Meldingen = append(out.Meldingen,
				fmt.Sprintf("rol %q: rel_id in payload genegeerd (modus=registratie genereert nieuwe id)", og.JSONRolnaam))
			delete(itemMap, "rel_id")
			rebuilt, err := json.Marshal(itemMap)
			if err != nil {
				return &RegistreerError{Status: http.StatusInternalServerError, Msg: fmt.Sprintf("rol %q: kon item niet herserialiseren: %v", og.JSONRolnaam, err)}
			}
			item = rebuilt
		}
		if overigeVelden == 0 && !hasRelID {
			return &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("rol %q: leeg item zonder velden", og.JSONRolnaam)}
		}
	}

	// Bouw wrapped payload {Veldnaam: item} en hergebruik RepresentatiePlusNaam.UnmarshalJSON.
	wrapped, err := json.Marshal(map[string]json.RawMessage{doelMeta.Veldnaam: item})
	if err != nil {
		return &RegistreerError{Status: http.StatusInternalServerError, Msg: fmt.Sprintf("rol %q: kon payload niet wrappen: %v", og.JSONRolnaam, err)}
	}
	rep := &model.RepresentatiePlusNaam{}
	if err := rep.UnmarshalJSON(wrapped); err != nil {
		return &RegistreerError{Status: http.StatusBadRequest, Msg: fmt.Sprintf("rol %q: kon payload niet unmarshallen naar %s: %v", og.JSONRolnaam, doelMeta.Typenaam, err)}
	}

	// Voor correctie: voeg eerst Afvoer (met rel_id) toe, daarna Opvoer (met rel_id).
	// De engine herkent dit aan rel_id en past het correctie-pad toe (afvoer huidige + opvoer nieuwe).
	if modus == PatchModusCorrectie {
		out.Wijzigingen = append(out.Wijzigingen, model.WijzigingRequest{Afvoer: rep})
	}
	out.Wijzigingen = append(out.Wijzigingen, model.WijzigingRequest{Opvoer: rep})
	return nil
}

// bytesTrim verwijdert leading/trailing JSON-whitespace.
func bytesTrim(b []byte) []byte {
	start, end := 0, len(b)
	for start < end {
		switch b[start] {
		case ' ', '\t', '\n', '\r':
			start++
			continue
		}
		break
	}
	for end > start {
		switch b[end-1] {
		case ' ', '\t', '\n', '\r':
			end--
			continue
		}
		break
	}
	return b[start:end]
}
