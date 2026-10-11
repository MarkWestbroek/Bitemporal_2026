package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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

// fullLader laadt entiteiten zoals /full ze levert (GE's en relaties, hub-kinderen, afgeleide
// formele tijd) op één vast formeel peilmoment. Implementeert afleiding.Lader.
type fullLader struct {
	peil time.Time
}

// NieuweAfleidingLader geeft de lader voor afgeleide relaties op het formele peilmoment peil.
// Ook gebruikt door dynql (GraphQL).
func NieuweAfleidingLader(peil time.Time) afleiding.Lader {
	return fullLader{peil: peil}
}

func (l fullLader) LaadEntiteiten(ctx context.Context, typenaam string, ids []int) (map[int]map[string]any, error) {
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok || meta.SliceFactory == nil || meta.IDKolom == "" {
		return nil, fmt.Errorf("geen laadbare entiteit: %s", typenaam)
	}
	if len(ids) == 0 {
		return map[int]map[string]any{}, nil
	}
	peil := l.peil
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
		if id, ok := m[meta.IDKolom].(float64); ok {
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
		id, ok := m[meta.IDKolom].(float64)
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
		id, ok := m[meta.IDKolom].(float64)
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
