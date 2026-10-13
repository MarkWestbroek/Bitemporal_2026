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
// de gegeven id's. Bronnen die met VoegToe al (volledig) bekend zijn, worden hergebruikt; de
// rest en alle doelen worden via de Lader geladen, allemaal op hetzelfde peilmoment.
//
// Werkwijze (ontwerp §5 en §8): evalueer alle regels voor alle bronnen; laad wat er bij de
// doorkijk ontbrak (doelentiteiten kaal, onderliggende elementen alleen als een regel ze
// aanspreekt), per type en rol in één batch; herhaal tot er niets meer ontbreekt (maximaal
// MaxRondes). Daarna hetzelfde voor de weergavenamen van de doelen. Een regel die niet parset
// of een uitkomst van het verkeerde type levert een lege relatie en een logregel op, geen
// fout: de rest van het antwoord blijft bruikbaar.
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

	// Fase 1: de doel-id's per bron.
	ids := map[int]map[string][]int{}
	err := o.totStabiel(ctx, meta.Typenaam, func(laatste bool) {
		for _, bronID := range bronIDs {
			e := o.geladen[sleutel{meta.Typenaam, bronID}]
			if e == nil || e.m == nil {
				continue
			}
			ctxBron := wortel{bron: o.entiteitVan(meta, e)}
			perRol := map[string][]int{}
			for i, ar := range meta.AfgeleideRelaties {
				if regels[i] == nil {
					continue
				}
				voor := o.aantalMissers()
				doelIDs, err := verwijzingenUit(regels[i].Eval(ctxBron), ar.DoelEntiteit)
				// Melden pas als deze regel niets meer mist: een misser kan de uitkomst veranderen.
				definitief := laatste || o.aantalMissers() == voor
				if err != nil {
					if definitief {
						log.Printf("AFLEIDING: %s %d, %s: %v", meta.Typenaam, bronID, ar.Naam, err)
					}
					doelIDs = nil
				}
				if ar.Momentvoorkomen == model.Enkelvoudig && len(doelIDs) > 1 {
					if definitief {
						log.Printf("AFLEIDING: %s %d, %s is enkelvoudig maar levert %d doelen; de eerste telt", meta.Typenaam, bronID, ar.Naam, len(doelIDs))
					}
					doelIDs = doelIDs[:1]
				}
				perRol[ar.JSONRolnaam] = doelIDs
			}
			ids[bronID] = perRol
		}
	})
	if err != nil {
		return nil, err
	}

	// Fase 2: de weergavenamen van de doelen (kaal geladen; hun weergaveveld laadt lui bij).
	type doel struct {
		typenaam string
		id       int
	}
	var doelen []doel
	gezien := map[doel]bool{}
	for _, ar := range meta.AfgeleideRelaties {
		for _, bronID := range bronIDs {
			for _, id := range ids[bronID][ar.JSONRolnaam] {
				d := doel{ar.DoelEntiteit, id}
				if !gezien[d] {
					gezien[d] = true
					doelen = append(doelen, d)
				}
			}
		}
	}
	namen := map[doel]string{}
	err = o.totStabiel(ctx, meta.Typenaam+" (weergavenamen)", func(bool) {
		for _, d := range doelen {
			if e := o.entiteitOp(d.typenaam, d.id); e != nil {
				namen[d] = o.weergavenaamVan(e)
			}
		}
	})
	if err != nil {
		return nil, err
	}

	for bronID, perRol := range ids {
		uit[bronID] = map[string][]Verwijzing{}
		for _, ar := range meta.AfgeleideRelaties {
			lijst := []Verwijzing{}
			for _, id := range perRol[ar.JSONRolnaam] {
				lijst = append(lijst, Verwijzing{ID: id, Weergavenaam: namen[doel{ar.DoelEntiteit, id}]})
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

// weergavenaamVan rekent het weergaveveld van een (mogelijk kaal geladen) entiteit uit; wat
// het weergaveveld aanspreekt, wordt via de missers lui bijgeladen.
func (o *Omgeving) weergavenaamVan(e *Entiteit) string {
	for _, av := range e.meta.AfgeleideVelden {
		if !av.IsWeergaveVeld {
			continue
		}
		ex, err := ParseRegel(av.Afleidingsregel)
		if err != nil {
			return ""
		}
		if v := ex.Eval(wortel{bron: e}); v != nil {
			return celexpr.Tekst(v)
		}
		return ""
	}
	return ""
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
