package main

import (
	"fmt"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/celexpr"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Afgeleide relaties (UML isDerived) krijgen geen tabel, geen _Data, geen Input en geen
// routes: ze zijn alleen leesbaar en worden bij het lezen berekend uit hun afleidingsregel.
// Codegen haalt ze daarom vóór de generatie uit V3Entiteit.Relaties (splitsAfgeleideRelaties);
// alle bestaande generators zien ze dan niet. Alleen writeEntiteitEntry schrijft ze, als
// TypeMeta.AfgeleideRelaties van de bronentiteit.
// Zie docs/plans/2026-10-11 Afgeleide relaties backend — ontwerp.md.

// splitsAfgeleideRelaties haalt de afgeleide relaties uit elke entiteit van v3 en geeft ze
// terug per typenaam van de bronentiteit. v3 wordt ter plekke aangepast; de Relaties-slices
// worden opnieuw opgebouwd, zodat de oorspronkelijke backing arrays ongemoeid blijven.
func splitsAfgeleideRelaties(v3 *model.V3Model) map[string][]model.V3Relatie {
	afgeleid := map[string][]model.V3Relatie{}
	for i := range v3.Entiteiten {
		ent := &v3.Entiteiten[i]
		var opgeslagen []model.V3Relatie
		for _, rel := range ent.Relaties {
			if rel.Afgeleid {
				afgeleid[ent.Typenaam] = append(afgeleid[ent.Typenaam], rel)
				continue
			}
			opgeslagen = append(opgeslagen, rel)
		}
		if len(afgeleid[ent.Typenaam]) > 0 {
			ent.Relaties = opgeslagen
		}
	}
	return afgeleid
}

// validateAfgeleideRelatie controleert de regels die alleen voor een afgeleide relatie
// gelden (ontwerp §2). rctx is het pad voor de foutmelding (bijv. "entiteiten[0].relaties[1]").
// De regel moet parsen in de CEL-subset (pakket celexpr); of het pad in het model klopt,
// blijkt pas bij het lezen.
func validateAfgeleideRelatie(rctx string, rel model.V3Relatie) []string {
	var errs []string
	if strings.TrimSpace(rel.Afleidingsregel) == "" {
		errs = append(errs, fmt.Sprintf("%s is afgeleid maar heeft geen afleidingsregel", rctx))
	} else if _, err := celexpr.Parse(rel.Afleidingsregel); err != nil {
		errs = append(errs, fmt.Sprintf("%s.afleidingsregel parset niet: %v", rctx, err))
	}
	if taal := strings.TrimSpace(rel.AfleidingsregelTaal); taal != "" && taal != "cel" {
		errs = append(errs, fmt.Sprintf("%s.afleidingsregelTaal '%s' wordt niet ondersteund voor afgeleide relaties; gebruik 'cel'", rctx, rel.AfleidingsregelTaal))
	}
	if len(rel.Velden) > 0 {
		errs = append(errs, fmt.Sprintf("%s is afgeleid en mag geen velden hebben (een afgeleide relatie heeft geen eigen gegevens)", rctx))
	}
	if len(rel.AfgeleideVelden) > 0 {
		errs = append(errs, fmt.Sprintf("%s is afgeleid en mag geen afgeleideVelden hebben", rctx))
	}
	if rel.RelatieSubtype != "" {
		errs = append(errs, fmt.Sprintf("%s is afgeleid en mag geen relatieSubtype '%s' hebben", rctx, rel.RelatieSubtype))
	}
	return errs
}

// writeAfgeleideRelaties schrijft het AfgeleideRelaties-blok van een entiteit-entry.
// isMaterieel van de V3-relatie wordt bewust niet overgenomen: de materiële tijd volgt uit
// de relaties waarlangs de regel navigeert.
func writeAfgeleideRelaties(b *strings.Builder, rels []model.V3Relatie, domein string) {
	if len(rels) == 0 {
		return
	}
	b.WriteString("\t\tAfgeleideRelaties: []AfgeleideRelatie{\n")
	for _, rel := range rels {
		taal := strings.TrimSpace(rel.AfleidingsregelTaal)
		if taal == "" {
			taal = "cel"
		}
		relDomein := rel.Domein
		if relDomein == "" {
			relDomein = domein
		}
		b.WriteString("\t\t\t{\n")
		b.WriteString(fmt.Sprintf("\t\t\t\tNaam: %q,\n", rel.Naam))
		if rel.Description != "" {
			b.WriteString(fmt.Sprintf("\t\t\t\tDescription: %q,\n", rel.Description))
		}
		if relDomein != "" {
			b.WriteString(fmt.Sprintf("\t\t\t\tDomein: %q,\n", relDomein))
		}
		b.WriteString(fmt.Sprintf("\t\t\t\tMeervoud: %q,\n", rel.Meervoud))
		b.WriteString(fmt.Sprintf("\t\t\t\tRolnaam: %q,\n", relRolnaam(rel.Naam, rel.Meervoud)))
		b.WriteString(fmt.Sprintf("\t\t\t\tJSONRolnaam: %q,\n", relJSONRolnaam(rel.Naam, rel.Meervoud)))
		b.WriteString(fmt.Sprintf("\t\t\t\tDoelEntiteit: %q,\n", rel.DoelEntiteit))
		b.WriteString(fmt.Sprintf("\t\t\t\tMomentvoorkomen: %s,\n", momentvoorkomenConst(rel.Momentvoorkomen)))
		if rel.Directioneel {
			b.WriteString("\t\t\t\tDirectioneel: true,\n")
		}
		if rel.Geordend {
			b.WriteString("\t\t\t\tGeordend: true,\n")
		}
		if rel.NaamLabelHeen != "" {
			b.WriteString(fmt.Sprintf("\t\t\t\tNaamLabelHeen: %q,\n", rel.NaamLabelHeen))
		}
		if rel.NaamLabelTerug != "" {
			b.WriteString(fmt.Sprintf("\t\t\t\tNaamLabelTerug: %q,\n", rel.NaamLabelTerug))
		}
		if rel.BronKardinaliteit != "" {
			b.WriteString(fmt.Sprintf("\t\t\t\tBronKardinaliteit: %q,\n", rel.BronKardinaliteit))
		}
		if rel.DoelKardinaliteit != "" {
			b.WriteString(fmt.Sprintf("\t\t\t\tDoelKardinaliteit: %q,\n", rel.DoelKardinaliteit))
		}
		b.WriteString(fmt.Sprintf("\t\t\t\tAfleidingsregelTaal: %q,\n", taal))
		b.WriteString(fmt.Sprintf("\t\t\t\tAfleidingsregel: %q,\n", rel.Afleidingsregel))
		writeLayoutLine(b, relatieLayoutInfo(rel))
		b.WriteString("\t\t\t},\n")
	}
	b.WriteString("\t\t},\n")
}

// relatieLayoutInfo verzamelt de editor-layout van een relatie (bron→anker, anker→doel,
// anker╌relatieblok en «use»-edges) voor writeLayoutLine.
func relatieLayoutInfo(rel model.V3Relatie) *layoutInfo {
	return &layoutInfo{
		Positie: rel.Positie, LayoutLocked: rel.LayoutLocked, EdgeID: rel.ID, SourceHandle: rel.SourceHandle, TargetHandle: rel.TargetHandle,
		DoelEdgeID: rel.DoelID, DoelSourceHandle: rel.DoelSourceHandle, DoelTargetHandle: rel.DoelTargetHandle,
		AnkerPositie: rel.AnkerPositie, AnkerLayoutLocked: rel.AnkerLayoutLocked, ClassLinkEdgeID: rel.ClassLinkID,
		ClassLinkSourceHandle: rel.ClassLinkSourceHandle, ClassLinkTargetHandle: rel.ClassLinkTargetHandle,
		UseEdges: rel.UseEdges,
	}
}
