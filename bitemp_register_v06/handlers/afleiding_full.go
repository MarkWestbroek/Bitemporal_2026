package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/afleiding"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// Afgeleide relaties in /full (ontwerp: docs/plans/2026-10-11 Afgeleide relaties backend —
// ontwerp.md §5). De relatie heeft geen tabel; ze wordt bij elk lezen berekend uit haar
// afleidingsregel (pakket afleiding). Bron en doelen worden op hetzelfde formele peilmoment
// gelezen: het peiltijdstip van het verzoek, of "nu" als er geen is.
//
// Leesconsistentie (BACKLOG §32): de extra batch-queries lopen, net als de rest van /full,
// niet in één snapshot. Dat lost de REPEATABLE READ-aanpak voor /full in één keer mee op.

// verzoekContext geeft de request-context van een gin.Context (annuleren bij een
// verbroken verbinding), of ctx zelf.
func verzoekContext(ctx context.Context) context.Context {
	if gc, ok := ctx.(*gin.Context); ok && gc.Request != nil {
		return gc.Request.Context()
	}
	return ctx
}

// luiLader laadt voor de afleiding op één vast formeel peilmoment, lui (afleiding.Lader):
// kale entiteitrijen, en per onderliggend element alleen wat een regel aanspreekt. Een doel
// kost zo een paar queries in plaats van een hele /full-lading (die ook formele-tijdafleiding
// en alle GE's meeneemt). Door het formele-tijdfilter zijn alle geladen voorkomens actief.
type luiLader struct {
	peil time.Time
}

// NieuweAfleidingLader geeft de lader voor afgeleide relaties op het formele peilmoment peil.
// Ook gebruikt door dynql (GraphQL).
func NieuweAfleidingLader(peil time.Time) afleiding.Lader {
	return luiLader{peil: peil}
}

func (l luiLader) LaadEntiteiten(ctx context.Context, typenaam string, ids []int) (map[int]map[string]any, error) {
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok || meta.SliceFactory == nil || meta.IDKolom == "" {
		return nil, fmt.Errorf("geen laadbare entiteit: %s", typenaam)
	}
	if len(ids) == 0 {
		return map[int]map[string]any{}, nil
	}
	entities := meta.SliceFactory()
	query := applyFormeleTijdFilterVoorModel(DB.NewSelect().Model(entities), typenaam, l.peil)
	if err := query.Where("?TableAlias."+meta.IDKolom+" IN (?)", bun.In(ids)).Scan(verzoekContext(ctx)); err != nil && !isNoRows(err) {
		return nil, err
	}
	return mapsPerID(entities, meta)
}

func (l luiLader) LaadVoorkomens(ctx context.Context, typenaam, rol string, ids []int) (map[int][]any, error) {
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok {
		return nil, fmt.Errorf("onbekend type: %s", typenaam)
	}
	var child *model.OnderliggendGegevenselement
	for i := range meta.OnderliggendeGegevenselementen {
		if meta.OnderliggendeGegevenselementen[i].JSONRolnaam == rol {
			child = &meta.OnderliggendeGegevenselementen[i]
			break
		}
	}
	if child == nil {
		return nil, fmt.Errorf("%s heeft geen onderliggend element %q", typenaam, rol)
	}
	childMeta, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype)
	if !ok {
		return nil, fmt.Errorf("onbekend type: %s", child.Doeltype)
	}
	items, err := l.rijenVan(ctx, childMeta, ids)
	if err != nil {
		return nil, err
	}

	// Hub: de actieve _Data (en _Aanvang/_Einde) erbij, gegroepeerd op (entiteit, rel_id).
	if childMeta.GESubtype == model.GESubtypeHub {
		type hubSleutel struct{ entiteit, rel int }
		sleutelVan := func(m map[string]any, entKolom string) hubSleutel {
			e, _ := m[entKolom].(float64)
			r, _ := m["rel_id"].(float64)
			return hubSleutel{int(e), int(r)}
		}
		for _, gc := range childMeta.OnderliggendeGegevenselementen {
			gcMeta, ok := model.MetaRegistry.GetTypeMeta(gc.Doeltype)
			if !ok {
				continue
			}
			kinderen, err := l.rijenVan(ctx, gcMeta, ids)
			if err != nil {
				return nil, err
			}
			perHub := map[hubSleutel][]any{}
			for _, k := range kinderen {
				km := k.(map[string]any)
				hs := sleutelVan(km, gcMeta.EntiteitIDKolom)
				perHub[hs] = append(perHub[hs], km)
			}
			for _, it := range items {
				m := it.(map[string]any)
				lijst := perHub[sleutelVan(m, childMeta.EntiteitIDKolom)]
				if lijst == nil {
					lijst = []any{}
				}
				m[gc.JSONRolnaam] = lijst
			}
		}
	}

	uit := map[int][]any{}
	for _, it := range items {
		m := it.(map[string]any)
		if id, ok := m[childMeta.EntiteitIDKolom].(float64); ok {
			uit[int(id)] = append(uit[int(id)], m)
		}
	}
	for id := range uit {
		lijst := uit[id]
		sort.SliceStable(lijst, func(i, j int) bool {
			ri, _ := lijst[i].(map[string]any)["rel_id"].(float64)
			rj, _ := lijst[j].(map[string]any)["rel_id"].(float64)
			return ri < rj
		})
	}
	return uit, nil
}

// rijenVan laadt de rijen van een (onderliggend) type voor de gegeven entiteit-id's, actief op
// het peilmoment, als JSON-maps.
func (l luiLader) rijenVan(ctx context.Context, meta model.TypeMeta, ids []int) ([]any, error) {
	if meta.DBSliceFactory == nil || meta.EntiteitIDKolom == "" {
		return nil, fmt.Errorf("geen laadbaar onderliggend type: %s", meta.Typenaam)
	}
	rijen := meta.DBSliceFactory()
	query := applyFormeleTijdFilterVoorModel(DB.NewSelect().Model(rijen), meta.Typenaam, l.peil)
	if err := query.Where("?TableAlias."+meta.EntiteitIDKolom+" IN (?)", bun.In(ids)).Scan(verzoekContext(ctx)); err != nil && !isNoRows(err) {
		return nil, err
	}
	b, err := json.Marshal(rijen)
	if err != nil {
		return nil, err
	}
	var lijst []any
	if err := json.Unmarshal(b, &lijst); err != nil {
		return nil, err
	}
	return lijst, nil
}

// LaadVolledigeEntiteiten laadt entiteiten zoals /full ze levert (alle GE's en relaties,
// hub-kinderen, afgeleide formele tijd) op het formele peilmoment peil, per id. Voor GraphQL
// <rol>_doelen, waar de volledige doelobjecten gevraagd zijn.
func LaadVolledigeEntiteiten(ctx context.Context, peil time.Time, typenaam string, ids []int) (map[int]map[string]any, error) {
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok || meta.SliceFactory == nil || meta.IDKolom == "" {
		return nil, fmt.Errorf("geen laadbare entiteit: %s", typenaam)
	}
	if len(ids) == 0 {
		return map[int]map[string]any{}, nil
	}
	entities := meta.SliceFactory()
	query := DB.NewSelect().Model(entities)
	query = applyFormeleTijdFilterVoorModel(query, typenaam, peil)
	query = addOnderliggendeRelations(query, meta, &peil)
	if err := query.Where("?TableAlias."+meta.IDKolom+" IN (?)", bun.In(ids)).Scan(verzoekContext(ctx)); err != nil && !isNoRows(err) {
		return nil, err
	}
	if err := laadHubKinderenNaQuery(ctx, entities, meta, &peil); err != nil {
		return nil, err
	}
	if err := vulAfgeleideFormeleTijdVoorFullSlice(ctx, entities, peil); err != nil {
		return nil, err
	}
	return mapsPerID(entities, meta)
}

// mapsPerID zet een slice entiteiten om naar JSON-maps, per id.
func mapsPerID(entities any, meta model.TypeMeta) (map[int]map[string]any, error) {
	b, err := json.Marshal(entities)
	if err != nil {
		return nil, err
	}
	var lijst []map[string]any
	if err := json.Unmarshal(b, &lijst); err != nil {
		return nil, err
	}
	uit := make(map[int]map[string]any, len(lijst))
	for _, m := range lijst {
		if id, ok := m[meta.JSONID()].(float64); ok {
			uit[int(id)] = m
		}
	}
	return uit, nil
}

// effectiefPeil is het formele peilmoment voor afgeleide relaties: het peiltijdstip uit de
// querystring, of nu. Zonder peiltijdstip filtert /full zelf niet op formele tijd; afgeleide
// relaties moeten wel over de actuele voorkomens navigeren.
func effectiefPeil(c *gin.Context) (time.Time, bool) {
	peil, err := parsePeiltijdstipUitQuerystring(c)
	if err == nil && peil != nil {
		return *peil, true
	}
	return time.Now(), false
}

// voegAfgeleideRelatiesToe zet in elke entiteit-map onder de JSON-rolnaam van elke afgeleide
// relatie de lijst [{<doel>_id, weergavenaam}] (ook als die leeg is). Bij een fout blijft de
// rest van het antwoord intact en wordt de fout gelogd.
func voegAfgeleideRelatiesToe(c *gin.Context, maps []map[string]any, meta model.TypeMeta) {
	if len(meta.AfgeleideRelaties) == 0 || len(maps) == 0 {
		return
	}
	peil, expliciet := effectiefPeil(c)
	omg := afleiding.NieuweOmgeving(NieuweAfleidingLader(peil))
	var bronIDs []int
	for _, m := range maps {
		id, ok := m[meta.JSONID()].(float64)
		if !ok {
			continue
		}
		bronIDs = append(bronIDs, int(id))
		// Met een expliciet peiltijdstip is de response al op dat moment gelezen (alleen
		// actieve voorkomens): hergebruiken scheelt een query. Zonder peiltijdstip bevat de
		// response ook beëindigde voorkomens; dan laadt de omgeving de bron zelf op "nu".
		if expliciet {
			omg.VoegToe(meta.Typenaam, int(id), m)
		}
	}
	uitkomst, err := omg.BerekenAfgeleideRelaties(c, meta, bronIDs)
	if err != nil {
		log.Printf("AFLEIDING: %s: afgeleide relaties niet berekend: %v", meta.Typenaam, err)
		return
	}
	for _, m := range maps {
		id, ok := m[meta.JSONID()].(float64)
		if !ok {
			continue
		}
		for _, ar := range meta.AfgeleideRelaties {
			items := []map[string]any{}
			for _, v := range uitkomst[int(id)][ar.JSONRolnaam] {
				item := map[string]any{ar.DoelIDSleutel(): v.ID}
				if v.Weergavenaam != "" {
					item["weergavenaam"] = v.Weergavenaam
				}
				items = append(items, item)
			}
			m[ar.JSONRolnaam] = items
		}
	}
}
