package afleiding

import (
	"context"
	"fmt"
	"log"
	"math"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/celexpr"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Verwijzing is één voorkomen van een afgeleide relatie: het doel, met zijn weergavenaam
// (leeg als het doel geen weergaveveld heeft).
type Verwijzing struct {
	ID           int
	Weergavenaam string
}

// Uitkomst: per bron-id, per JSON-rolnaam van de afgeleide relatie, de verwijzingen.
type Uitkomst map[int]map[string][]Verwijzing

// BerekenAfgeleideRelaties rekent alle afgeleide relaties van meta uit voor de bronnen met
// de gegeven id's. Bronnen en doelen worden via de Lader van de omgeving geladen (allemaal
// op hetzelfde peilmoment); al toegevoegde maps (VoegToe) worden hergebruikt.
//
// Werkwijze (ontwerp §5): evalueer alle regels voor alle bronnen; laad de doelen die bij de
// doorkijk ontbraken per type in één batch; herhaal tot er niets meer ontbreekt (maximaal
// MaxRondes). Een regel die niet parset of een uitkomst van het verkeerde type levert een
// lege relatie en een logregel op, geen fout: de rest van het antwoord blijft bruikbaar.
func (o *Omgeving) BerekenAfgeleideRelaties(ctx context.Context, meta model.TypeMeta, bronIDs []int) (Uitkomst, error) {
	uit := Uitkomst{}
	if len(meta.AfgeleideRelaties) == 0 || len(bronIDs) == 0 {
		return uit, nil
	}
	bronnen := make([]sleutel, len(bronIDs))
	for i, id := range bronIDs {
		bronnen[i] = sleutel{meta.Typenaam, id}
	}
	if err := o.laad(ctx, bronnen); err != nil {
		return nil, err
	}

	regels := make([]*celexpr.Expr, len(meta.AfgeleideRelaties))
	for i, ar := range meta.AfgeleideRelaties {
		e, err := ParseRegel(ar.Afleidingsregel)
		if err != nil {
			log.Printf("AFLEIDING: %s.%s: %v", meta.Typenaam, ar.Naam, err)
			continue
		}
		regels[i] = e
	}

	ids := map[int]map[string][]int{}
	for ronde := 1; ; ronde++ {
		for _, bronID := range bronIDs {
			m := o.geladen[sleutel{meta.Typenaam, bronID}]
			if m == nil {
				continue
			}
			ctxBron := wortel{bron: o.Entiteit(meta, m)}
			perRol := map[string][]int{}
			for i, ar := range meta.AfgeleideRelaties {
				if regels[i] == nil {
					continue
				}
				doelIDs, err := verwijzingenUit(regels[i].Eval(ctxBron), ar.DoelEntiteit)
				if err != nil {
					// Pas melden als alles geladen is; een misser kan de uitkomst nog veranderen.
					if len(o.missers) == 0 {
						log.Printf("AFLEIDING: %s %d, %s: %v", meta.Typenaam, bronID, ar.Naam, err)
					}
					doelIDs = nil
				}
				if ar.Momentvoorkomen == model.Enkelvoudig && len(doelIDs) > 1 {
					if len(o.missers) == 0 {
						log.Printf("AFLEIDING: %s %d, %s is enkelvoudig maar levert %d doelen; de eerste telt", meta.Typenaam, bronID, ar.Naam, len(doelIDs))
					}
					doelIDs = doelIDs[:1]
				}
				perRol[ar.JSONRolnaam] = doelIDs
			}
			ids[bronID] = perRol
		}
		meer, err := o.laadMissers(ctx)
		if err != nil {
			return nil, err
		}
		if !meer {
			break
		}
		if ronde >= MaxRondes {
			log.Printf("AFLEIDING: %s: na %d rondes nog niet alle doelen geladen (diepte of cyclus?); uitkomst kan onvolledig zijn", meta.Typenaam, MaxRondes)
			break
		}
	}

	// Weergavenamen: laad de doelen (één batch per type) en reken hun weergaveveld uit.
	doelen := map[sleutel]bool{}
	for _, ar := range meta.AfgeleideRelaties {
		for _, perRol := range ids {
			for _, id := range perRol[ar.JSONRolnaam] {
				doelen[sleutel{ar.DoelEntiteit, id}] = true
			}
		}
	}
	var teLaden []sleutel
	for k := range doelen {
		teLaden = append(teLaden, k)
	}
	if err := o.laad(ctx, teLaden); err != nil {
		return nil, err
	}
	for bronID, perRol := range ids {
		uit[bronID] = map[string][]Verwijzing{}
		for _, ar := range meta.AfgeleideRelaties {
			lijst := []Verwijzing{}
			for _, id := range perRol[ar.JSONRolnaam] {
				lijst = append(lijst, Verwijzing{ID: id, Weergavenaam: o.weergavenaamVan(ar.DoelEntiteit, id)})
			}
			uit[bronID][ar.JSONRolnaam] = lijst
		}
	}
	return uit, nil
}

// verwijzingenUit zet de uitkomst van een regel om naar doel-id's (ontwerp §3.4): een
// relatie-voorkomen telt als zijn doel, een entiteit als zichzelf, een geheel getal als id
// (0 = lege verwijzing, geen doel);
// lijsten worden plat gemaakt; dubbele id's vallen weg (volgorde blijft).
func verwijzingenUit(v any, doelEntiteit string) ([]int, error) {
	var ids []int
	gezien := map[int]bool{}
	var loop func(any) error
	loop = func(v any) error {
		switch x := v.(type) {
		case nil:
			return nil
		case []any:
			for _, el := range x {
				if err := loop(el); err != nil {
					return err
				}
			}
			return nil
		case *Voorkomen:
			k, ok := x.doelSleutel()
			if !ok {
				return fmt.Errorf("uitkomst is een voorkomen van %s, geen relatie naar %s", x.meta.Typenaam, doelEntiteit)
			}
			if !IsTypeOf(k.typenaam, doelEntiteit) {
				return fmt.Errorf("uitkomst wijst naar %s, verwacht %s", k.typenaam, doelEntiteit)
			}
			if !gezien[k.id] {
				gezien[k.id] = true
				ids = append(ids, k.id)
			}
			return nil
		case *Entiteit:
			if !IsTypeOf(x.Typenaam(), doelEntiteit) {
				return fmt.Errorf("uitkomst is een %s, verwacht %s", x.Typenaam(), doelEntiteit)
			}
			if id := x.ID(); id > 0 && !gezien[id] {
				gezien[id] = true
				ids = append(ids, id)
			}
			return nil
		}
		if id, ok := alsID(v); ok {
			if !gezien[id] {
				gezien[id] = true
				ids = append(ids, id)
			}
			return nil
		}
		if f, ok := v.(float64); ok && f == 0 {
			return nil // 0 is een lege int-verwijzing (bijv. een niet ingevulde $ref): geen doel
		}
		return fmt.Errorf("uitkomst %q wijst niet naar een %s", celexpr.Tekst(v), doelEntiteit)
	}
	if err := loop(v); err != nil {
		return nil, err
	}
	return ids, nil
}

func (o *Omgeving) weergavenaamVan(typenaam string, id int) string {
	m := o.geladen[sleutel{typenaam, id}]
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if m == nil || !ok {
		return ""
	}
	return o.Weergavenaam(meta, m)
}

// ── Afgeleide velden (vervangt de zelfgeschreven evaluators in handlers en dynql) ──

// Weergavenaam rekent het weergaveveld (AfgeleidVeld met IsWeergaveVeld) van een entiteit-map
// uit; "" als er geen is of de uitkomst null is.
func (o *Omgeving) Weergavenaam(meta model.TypeMeta, m map[string]any) string {
	for _, av := range meta.AfgeleideVelden {
		if av.IsWeergaveVeld {
			if v := o.AfgeleidVeld(meta, m, av); v != nil {
				return celexpr.Tekst(v)
			}
			return ""
		}
	}
	return ""
}

// AfgeleidVeld rekent één afgeleid veld uit op een entiteit-map. Een veld van type string
// (of zonder type) levert altijd tekst, met "" voor null — zoals de oude evaluator; andere
// typen (bijv. int voor leeftijd) leveren de waarde zelf. Een regel die niet parset levert
// "" respectievelijk null.
func (o *Omgeving) AfgeleidVeld(meta model.TypeMeta, m map[string]any, av model.AfgeleidVeld) any {
	tekst := av.GoType == "" || av.GoType == "string" || av.GoType == "*string"
	e, err := ParseRegel(av.Afleidingsregel)
	if err != nil {
		if tekst {
			return ""
		}
		return nil
	}
	v := e.Eval(wortel{bron: o.Entiteit(meta, m)})
	if !tekst {
		// Een geheel getal voor een int-veld blijft een int (zoals de oude evaluator, en
		// zodat GraphQL Int het zonder omweg serialiseert).
		if f, ok := v.(float64); ok && (av.GoType == "int" || av.GoType == "*int" || av.GoType == "int64") && f == math.Trunc(f) {
			return int(f)
		}
		return v
	}
	if v == nil {
		return ""
	}
	return celexpr.Tekst(v)
}

// Weergavenaam en AfgeleidVeld zonder database (doorkijk naar niet geladen doelen is null).
func Weergavenaam(meta model.TypeMeta, m map[string]any) string {
	return NieuweOmgeving(nil).Weergavenaam(meta, m)
}

func AfgeleidVeld(meta model.TypeMeta, m map[string]any, av model.AfgeleidVeld) any {
	return NieuweOmgeving(nil).AfgeleidVeld(meta, m, av)
}
