package handlers

// registration_plaatshouders.go — server-side plaatshouder-id's in een registratie (B1 uit
// het aanmeldformulier-plan, docs/plans/2026-09-22 §4).
//
// Een registratie mag voor een nieuwe entiteit een plaatshouder als id gebruiken:
//
//	{ "opvoer": { "organisatie":     { "id": "$nieuw.org" } } },
//	{ "opvoer": { "organisatienaam": { "organisatie_id": "$nieuw.org", "naam": "…" } } },
//	{ "opvoer": { "initiatieforganisatie": { "initiatief_id": "$nieuw.init", "organisatie_id": "$nieuw.org" } } }
//
// De server kent binnen de transactie per entiteittype de volgende id's toe (max+1, onder
// een advisory lock per tabel) en vult ze overal in vóór het decoderen naar de getypte
// representaties. Zo hoeft een formulier geen max-id-roundtrips te doen en kan één
// registratie meerdere nieuwe entiteiten aanmaken die naar elkaar verwijzen.
//
// Regels:
//   - een plaatshouder heeft de vorm `$nieuw.<naam>` (letters, cijfers, _ en -);
//   - hij wordt gedefinieerd door de opvoer van een entiteit waarvan de id-kolom die
//     plaatshouder is; elders gebruikte plaatshouders zonder definitie → 400;
//   - de toegekende id's komen terug in de response (`toegekendeIds`).

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
)

var plaatshouderRe = regexp.MustCompile(`^\$nieuw\.[A-Za-z0-9_-]+$`)

// isPlaatshouder zegt of een JSON-waarde een plaatshouder-string is.
func isPlaatshouder(v any) (string, bool) {
	s, ok := v.(string)
	if !ok || !plaatshouderRe.MatchString(s) {
		return "", false
	}
	return s, true
}

// Plaatshouders is het resultaat van vindPlaatshouders: definities in volgorde van
// verschijnen (naam → entiteit-typenaam).
type Plaatshouders struct {
	Volgorde []string
	Typenaam map[string]string
}

// Leeg zegt of er geen plaatshouders zijn.
func (p *Plaatshouders) Leeg() bool { return p == nil || len(p.Volgorde) == 0 }

// vindPlaatshouders leest de ruwe wijzigingen, verzamelt de plaatshouder-definities
// (entiteit-opvoer met plaatshouder als id) en controleert dat elk gebruik gedefinieerd is.
func vindPlaatshouders(rawWijzigingen json.RawMessage) (*Plaatshouders, error) {
	if len(rawWijzigingen) == 0 {
		return &Plaatshouders{Typenaam: map[string]string{}}, nil
	}
	var wijzigingen []map[string]map[string]any
	if err := json.Unmarshal(rawWijzigingen, &wijzigingen); err != nil {
		// Geen herkenbare structuur: laat de gewone decodering de fout melden.
		return &Plaatshouders{Typenaam: map[string]string{}}, nil
	}
	p := &Plaatshouders{Typenaam: map[string]string{}}
	gebruikt := map[string]struct{}{}
	for _, w := range wijzigingen {
		for soort, reps := range w {
			for veldnaam, payload := range reps {
				payloadMap, _ := payload.(map[string]any)
				if soort == "opvoer" && payloadMap != nil {
					keys := map[string]struct{}{}
					for k := range payloadMap {
						keys[k] = struct{}{}
					}
					meta, ok := model.MetaRegistry.GetByVeldnaamMetPayload(veldnaam, keys)
					if ok && meta.Metatype == model.MetatypeEntiteit {
						if naam, isP := isPlaatshouder(payloadMap[meta.IDKolom]); isP {
							if bestaand, dubbel := p.Typenaam[naam]; dubbel && bestaand != meta.Typenaam {
								return nil, fmt.Errorf("plaatshouder %s is voor twee entiteittypen gedefinieerd (%s en %s)", naam, bestaand, meta.Typenaam)
							}
							if _, dubbel := p.Typenaam[naam]; !dubbel {
								p.Volgorde = append(p.Volgorde, naam)
								p.Typenaam[naam] = meta.Typenaam
							}
						}
					}
				}
				verzamelPlaatshouders(payload, gebruikt)
			}
		}
	}
	ontbrekend := []string{}
	for naam := range gebruikt {
		if _, ok := p.Typenaam[naam]; !ok {
			ontbrekend = append(ontbrekend, naam)
		}
	}
	if len(ontbrekend) > 0 {
		sort.Strings(ontbrekend)
		return nil, fmt.Errorf("plaatshouder(s) zonder entiteit-opvoer die ze definieert: %v", ontbrekend)
	}
	return p, nil
}

func verzamelPlaatshouders(v any, uit map[string]struct{}) {
	switch t := v.(type) {
	case string:
		if naam, ok := isPlaatshouder(t); ok {
			uit[naam] = struct{}{}
		}
	case map[string]any:
		for _, kind := range t {
			verzamelPlaatshouders(kind, uit)
		}
	case []any:
		for _, kind := range t {
			verzamelPlaatshouders(kind, uit)
		}
	}
}

// kenPlaatshoudersToe kent binnen de transactie per entiteittype opeenvolgende id's toe
// (max+1), onder een advisory lock op de tabelnaam zodat gelijktijdige registraties
// niet hetzelfde id kiezen.
func kenPlaatshoudersToe(ctx context.Context, tx bun.Tx, p *Plaatshouders) (map[string]int, error) {
	ids := map[string]int{}
	volgend := map[string]int{} // typenaam → volgende id
	for _, naam := range p.Volgorde {
		typenaam := p.Typenaam[naam]
		if _, ok := volgend[typenaam]; !ok {
			meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
			if !ok {
				return nil, fmt.Errorf("onbekend entiteittype %s", typenaam)
			}
			if _, err := tx.NewRaw("SELECT pg_advisory_xact_lock(hashtext(?))", meta.Tabelnaam).Exec(ctx); err != nil {
				return nil, fmt.Errorf("lock op %s: %w", meta.Tabelnaam, err)
			}
			var max int
			if err := tx.NewSelect().TableExpr(meta.Tabelnaam).ColumnExpr("COALESCE(MAX("+meta.IDKolom+"), 0)").Scan(ctx, &max); err != nil {
				return nil, fmt.Errorf("max id van %s: %w", meta.Tabelnaam, err)
			}
			volgend[typenaam] = max + 1
		}
		ids[naam] = volgend[typenaam]
		volgend[typenaam]++
	}
	return ids, nil
}

// vulPlaatshoudersIn vervangt elke plaatshouder-string in de ruwe wijzigingen door het
// toegekende id (als getal).
func vulPlaatshoudersIn(rawWijzigingen json.RawMessage, ids map[string]int) (json.RawMessage, error) {
	var boom any
	if err := json.Unmarshal(rawWijzigingen, &boom); err != nil {
		return nil, err
	}
	boom = vervangPlaatshouders(boom, ids)
	return json.Marshal(boom)
}

func vervangPlaatshouders(v any, ids map[string]int) any {
	switch t := v.(type) {
	case string:
		if naam, ok := isPlaatshouder(t); ok {
			if id, bekend := ids[naam]; bekend {
				return id
			}
		}
		return t
	case map[string]any:
		for k, kind := range t {
			t[k] = vervangPlaatshouders(kind, ids)
		}
		return t
	case []any:
		for i, kind := range t {
			t[i] = vervangPlaatshouders(kind, ids)
		}
		return t
	default:
		return v
	}
}

// verwerkPlaatshouders is de stap in RegistreerCore: id's toekennen, invullen, decoderen en
// normaliseren. Zet req.Wijzigingen en levert de toegekende id's.
func verwerkPlaatshouders(ctx context.Context, tx bun.Tx, req *model.RegistreerRequest) (map[string]int, *RegistreerError) {
	p, err := vindPlaatshouders(req.RuweWijzigingen)
	if err != nil {
		return nil, newRegistreerErr(400, "plaatshouders: %v", err)
	}
	ids, err := kenPlaatshoudersToe(ctx, tx, p)
	if err != nil {
		return nil, newRegistreerErr(500, "plaatshouder-id's toekennen mislukt: %v", err)
	}
	ingevuld, err := vulPlaatshoudersIn(req.RuweWijzigingen, ids)
	if err != nil {
		return nil, newRegistreerErr(400, "plaatshouders invullen mislukt: %v", err)
	}
	var wijzigingen []model.WijzigingRequest
	if err := json.Unmarshal(ingevuld, &wijzigingen); err != nil {
		return nil, newRegistreerErr(400, "wijzigingen decoderen na plaatshouders: %v", err)
	}
	genormaliseerd, err := NormaliseerWijzigingen(wijzigingen)
	if err != nil {
		return nil, newRegistreerErr(400, "normaliseren van wijzigingen mislukt: %v", err)
	}
	req.Wijzigingen = genormaliseerd
	req.RuweWijzigingen = nil
	return ids, nil
}
