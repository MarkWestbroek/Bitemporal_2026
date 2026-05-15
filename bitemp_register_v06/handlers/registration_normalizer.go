package handlers

// registration_normalizer.go — Fase 1 van het plan "drie extra registratiemanieren"
// (zie /memories/session/plan.md).
//
// Doel: een registratie-payload mag een geneste boom bevatten in dezelfde
// shape als de `GET /full/{padnaam}/:id`-response. Bijvoorbeeld:
//
//   {
//     "registratie": { "registratietype": "registratie", ... },
//     "wijzigingen": [
//       {
//         "opvoer": {
//           "natuurlijkpersoon": {
//             "id": 1,
//             "persoonsidentificatie": { ... },
//             "naam": { ... },
//             "burgerschap": [ {...}, {...} ],
//             "natuurlijkpersoon_aanvang": { ... }
//           }
//         }
//       }
//     ]
//   }
//
// De normalizer splitst deze geneste boom in een serie platte
// WijzigingRequests (één per representatie) zoals de huidige engine
// `RegistreerMetNieuweAanpak` verwacht. Eén Wijziging per leaf-record;
// dezelfde Registratie. Audit-granulariteit blijft daarmee fijnmazig
// (één Wijziging-rij per representatie). De originele geneste payload
// wordt apart bewaard in `Registratie.RequestBody` (zie de raw-body
// capture in registration_handlers.go).
//
// Dit is fase 1 van het plan; auto-flatten van afvoer-bomen volgt
// dezelfde logica maar wordt door de huidige engine al deels afgevangen
// via de ENT-cascade (afvoer van een entiteit cascadeert naar alle GE's).

import (
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// NormaliseerWijzigingen past NormaliseerWijziging toe op een lijst en
// retourneert de afgevlakte lijst. De volgorde is: voor elke input-wijziging
// eerst de top-level representatie, daarna haar onderliggende GE's/relaties
// in de volgorde waarin ze in de payload voorkomen (recursief).
func NormaliseerWijzigingen(in []model.WijzigingRequest) ([]model.WijzigingRequest, error) {
	out := make([]model.WijzigingRequest, 0, len(in))
	for i, w := range in {
		sub, err := NormaliseerWijziging(w)
		if err != nil {
			return nil, fmt.Errorf("wijziging[%d]: %w", i, err)
		}
		out = append(out, sub...)
	}
	return out, nil
}

// NormaliseerWijziging neemt één WijzigingRequest die mogelijk geneste
// onderliggende GE's/relaties bevat, en splitst die in een serie platte
// WijzigingRequests, één per representatie. Niet-geneste (al platte)
// wijzigingen worden ongewijzigd doorgegeven.
//
// Werkwijze:
//  1. Bepaal de modus (opvoer of afvoer) en de RepresentatiePlusNaam.
//  2. Lees `RawPayload` als JSON-object.
//  3. Bepaal welke top-level keys onderliggende GE's/relaties zijn op basis
//     van TypeMeta.OnderliggendeGegevenselementen[*].JSONRolnaam.
//  4. Splits de payload in 'eigen velden' (re-unmarshal naar het top-level type)
//     en 'kind-velden' (één of meerdere kinderen per rol; arrays voor meervoud).
//  5. Recurseer op elk kind — een kind kan zelf onderliggende GE's/relaties hebben.
func NormaliseerWijziging(w model.WijzigingRequest) ([]model.WijzigingRequest, error) {
	var rep *model.RepresentatiePlusNaam
	isOpvoer := false
	switch {
	case w.Opvoer != nil:
		rep = w.Opvoer
		isOpvoer = true
	case w.Afvoer != nil:
		rep = w.Afvoer
	default:
		// geen opvoer/afvoer — laat ongemoeid (engine verwerpt dit alsnog)
		return []model.WijzigingRequest{w}, nil
	}

	if rep == nil || rep.Representatie == nil || len(rep.RawPayload) == 0 {
		return []model.WijzigingRequest{w}, nil
	}

	meta, ok := model.MetaRegistry.GetTypeMeta(rep.Representatienaam)
	if !ok || len(meta.OnderliggendeGegevenselementen) == 0 {
		// geen onderliggende GE's bekend voor dit type → niets te normaliseren
		return []model.WijzigingRequest{w}, nil
	}

	var rawMap map[string]json.RawMessage
	if err := json.Unmarshal(rep.RawPayload, &rawMap); err != nil {
		return nil, fmt.Errorf("normaliseer: payload van %s niet als JSON-object te lezen: %w", rep.Representatienaam, err)
	}

	// Bouw lookup: JSONRolnaam → OnderliggendGegevenselement
	childByRol := make(map[string]model.OnderliggendGegevenselement, len(meta.OnderliggendeGegevenselementen))
	for _, og := range meta.OnderliggendeGegevenselementen {
		if og.JSONRolnaam != "" {
			childByRol[og.JSONRolnaam] = og
		}
	}

	// Splits payload in eigen velden + kind-velden. Loop in stabiele volgorde
	// (volgens OnderliggendeGegevenselementen) zodat de uitgesplitste
	// wijzigingen deterministisch zijn.
	eigenPayload := make(map[string]json.RawMessage, len(rawMap))
	type childItem struct {
		og  model.OnderliggendGegevenselement
		raw json.RawMessage // payload van één kind-record
	}
	var children []childItem

	consumed := make(map[string]struct{}, len(meta.OnderliggendeGegevenselementen))
	for _, og := range meta.OnderliggendeGegevenselementen {
		if og.JSONRolnaam == "" {
			continue
		}
		raw, ok := rawMap[og.JSONRolnaam]
		if !ok {
			continue
		}
		consumed[og.JSONRolnaam] = struct{}{}
		trimmed := bytes.TrimSpace(raw)
		if len(trimmed) == 0 || string(trimmed) == "null" {
			continue
		}
		if trimmed[0] == '[' {
			var arr []json.RawMessage
			if err := json.Unmarshal(raw, &arr); err != nil {
				return nil, fmt.Errorf("normaliseer: kind '%s' van %s is geen geldige array: %w", og.JSONRolnaam, rep.Representatienaam, err)
			}
			for _, item := range arr {
				children = append(children, childItem{og: og, raw: item})
			}
		} else {
			children = append(children, childItem{og: og, raw: raw})
		}
	}
	for k, v := range rawMap {
		if _, isChild := consumed[k]; isChild {
			continue
		}
		eigenPayload[k] = v
	}

	if len(children) == 0 {
		// geen geneste velden gevonden → niets te splitsen
		return []model.WijzigingRequest{w}, nil
	}

	// Re-unmarshal het top-level record met alleen eigen velden zodat de
	// engine straks dezelfde representatie ziet zonder ruis van geneste keys.
	eigenRaw, err := json.Marshal(eigenPayload)
	if err != nil {
		return nil, fmt.Errorf("normaliseer: kan eigen velden van %s niet hermarshallen: %w", rep.Representatienaam, err)
	}
	topRep := meta.Factory()
	if err := json.Unmarshal(eigenRaw, topRep); err != nil {
		return nil, fmt.Errorf("normaliseer: kan %s top-level niet opnieuw unmarshal'en: %w", rep.Representatienaam, err)
	}
	topPlusNaam := &model.RepresentatiePlusNaam{
		Representatie:     topRep,
		Representatienaam: meta.Typenaam,
		Veldnaam:          rep.Veldnaam,
		RawPayload:        eigenRaw,
	}

	out := make([]model.WijzigingRequest, 0, 1+len(children))

	// Top-level wijziging eerst: bij opvoer moet de entiteit bestaan
	// voordat de GE's eraan kunnen hangen (FK-volgorde). Bij afvoer is
	// de volgorde minder strikt; we houden hetzelfde patroon voor
	// consistentie en eenvoud.
	top := model.WijzigingRequest{}
	if isOpvoer {
		top.Opvoer = topPlusNaam
	} else {
		top.Afvoer = topPlusNaam
	}
	out = append(out, top)

	// Voor elk kind: bepaal het type via de Doeltype-naam en bouw een
	// RepresentatiePlusNaam. Recurseer zodat ook kinderen met eigen
	// onderliggende GE's/relaties verder uitgesplitst worden.
	for _, ch := range children {
		childMeta, ok := model.MetaRegistry.GetTypeMeta(ch.og.Doeltype)
		if !ok {
			return nil, fmt.Errorf("normaliseer: doeltype '%s' (kind van %s, rol %s) niet gevonden in MetaRegistry", ch.og.Doeltype, rep.Representatienaam, ch.og.JSONRolnaam)
		}

		// Aanvang/einde shorthand: als het kind-GESubtype aanvang of einde is
		// en de client stuurde een bare JSON-string (bijv. "1969-02-01"), wrap
		// dat automatisch als {"datum": <waarde>} zodat de unmarshal slaagt.
		// Dit maakt het mogelijk om "aanvang": "2024-01-01" te schrijven als
		// shorthand voor "aanvang": {"datum": "2024-01-01"}.
		childRaw := ch.raw
		if trimmedChild := bytes.TrimSpace(childRaw); len(trimmedChild) > 0 && trimmedChild[0] == '"' {
			if childMeta.GESubtype == model.GESubtypeAanvang || childMeta.GESubtype == model.GESubtypeEinde {
				childRaw = append([]byte(`{"datum":`), append(trimmedChild, '}')...)
			}
		}

		// FK-propagatie: injecteer de entity-ID automatisch als het FK-veld nog
		// niet aanwezig is in de child-payload. Voor hub-types retourneert
		// GetID() de rel_id (niet de entity-ID); lees de juiste FK-waarde
		// daarom direct uit rawMap van de parent-payload.
		fkWaarde := leesIntUitRawMap(rawMap, childMeta.EntiteitIDKolom)
		if fkWaarde == 0 {
			// Fallback: GetID() — werkt correct voor entiteiten (retourneert entity-ID)
			if id, ok := rep.Representatie.GetID().(int); ok && id != 0 {
				fkWaarde = id
			}
		}
		childRaw, err := injecteerParentFK(childRaw, childMeta.EntiteitIDKolom, fkWaarde)
		if err != nil {
			return nil, fmt.Errorf("normaliseer: FK-injectie kind %s mislukt: %w", childMeta.Typenaam, err)
		}

		childRep := childMeta.Factory()
		if err := json.Unmarshal(childRaw, childRep); err != nil {
			return nil, fmt.Errorf("normaliseer: kan kind %s (rol %s onder %s) niet unmarshal'en: %w", childMeta.Typenaam, ch.og.JSONRolnaam, rep.Representatienaam, err)
		}
		childPN := &model.RepresentatiePlusNaam{
			Representatie:     childRep,
			Representatienaam: childMeta.Typenaam,
			Veldnaam:          childMeta.Veldnaam,
			RawPayload:        childRaw,
		}
		var childWijz model.WijzigingRequest
		if isOpvoer {
			childWijz.Opvoer = childPN
		} else {
			childWijz.Afvoer = childPN
		}
		sub, err := NormaliseerWijziging(childWijz)
		if err != nil {
			return nil, err
		}
		out = append(out, sub...)
	}

	return out, nil
}

// leesIntUitRawMap leest een integer-waarde voor een gegeven sleutel uit een
// JSON-rawmap. Retourneert 0 als de sleutel ontbreekt of geen integer is.
func leesIntUitRawMap(m map[string]json.RawMessage, sleutel string) int {
	if sleutel == "" {
		return 0
	}
	raw, ok := m[sleutel]
	if !ok {
		return 0
	}
	var v int
	if json.Unmarshal(raw, &v) != nil {
		return 0
	}
	return v
}

// injecteerParentFK voegt de parent-ID toe aan een kind-payload als het FK-veld
// (fkKolom) nog niet aanwezig is. Zo hoeft de client het `{ent}_id`-veld niet
// zelf mee te sturen in geneste payloads — de parent-context impliceert de FK.
//
//   - Als fkKolom leeg is of parentID nil: ongewijzigd terug.
//   - Als het veld al aanwezig is: ongewijzigd terug (client-waarde wint).
//   - Anders: inject {fkKolom: parentID} in de payload-map.
func injecteerParentFK(raw json.RawMessage, fkKolom string, parentID any) (json.RawMessage, error) {
	if fkKolom == "" || parentID == nil {
		return raw, nil
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		// geen JSON-object; ongewijzigd teruggeven (engine zal het afwijzen)
		return raw, nil
	}
	if _, reeds := m[fkKolom]; reeds {
		return raw, nil // al aanwezig; niet overschrijven
	}
	encoded, err := json.Marshal(parentID)
	if err != nil {
		return nil, fmt.Errorf("FK-injectie: kan parent-ID niet marshallen: %w", err)
	}
	m[fkKolom] = encoded
	updated, err := json.Marshal(m)
	if err != nil {
		return nil, fmt.Errorf("FK-injectie: kan payload niet hermarshallen: %w", err)
	}
	return updated, nil
}
