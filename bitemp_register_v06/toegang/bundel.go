// Package toegang is de PDP (Policy Decision Point) van het register: het voert een
// gecompileerde Toegangsspraak-beleidsbundel uit.
//
// Plan: docs/plans/"2026-10-12 Toegang op beleid — PAP, PDP en PEP (plan).md" §5 (B1, B4).
// De Studio (PAP) parseert en resolveert het beleid en compileert het met
// web/vite/src/toegangsspraak/bundel.js tot een bundel (formaat "omnium-toegangsbundel/1").
// Dit package parseert geen Toegangsspraak; het evalueert alleen die data.
//
// Semantiek:
//   - standaard weigeren (deny-by-default);
//   - verbod wint van toestemming (ODRL conflict: prohibit);
//   - een regel dekt zijn registerpad en alles eronder ("NatuurlijkPersoon" dekt
//     "NatuurlijkPersoon.namen.achternaam"); pad "*" dekt alles;
//   - voorwaarden zijn drieweg (waar / onwaar / onbepaald). Onbepaald = de PDP heeft de
//     benodigde gegevens niet (bv. een veld van de betrokkene, of een PIP-vraag "bestaat er …").
//     Fail-closed: een toestemming met een onbepaalde voorwaarde geldt níet, een verbod met een
//     onbepaalde voorwaarde geldt wél.
package toegang

import (
	"encoding/json"
	"fmt"
	"strings"
)

// BundelFormaat is het formaat dat bundel.js schrijft.
const BundelFormaat = "omnium-toegangsbundel/1"

// Bundel is een gecompileerd beleid.
type Bundel struct {
	Formaat   string     `json:"formaat"`
	Beleid    BeleidMeta `json:"beleid"`
	Standaard string     `json:"standaard"`
	Conflict  string     `json:"conflict"`
	Regels    []Regel    `json:"regels"`

	// afgeleid bij het laden: handeling → registerpad → regels
	index map[string]map[string][]*Regel
}

// BeleidMeta draagt naam, geldigheid, grondslag en doel van het beleid.
type BeleidMeta struct {
	Naam        string  `json:"naam"`
	GeldigVanaf *string `json:"geldigVanaf"` // ISO-datum, inclusief
	GeldigTot   *string `json:"geldigTot"`   // ISO-datum, exclusief
	Grondslag   *string `json:"grondslag"`
	Doel        *string `json:"doel"`
}

// Regel is één toestemming of verbod.
type Regel struct {
	ID          string      `json:"id"`
	Naam        string      `json:"naam"`
	Effect      string      `json:"effect"` // "toestaan" | "verbieden"
	Handeling   string      `json:"handeling"`
	Subject     *SubjectEis `json:"subject"` // nil = iedereen, ook anoniem
	Gegevens    []Gegeven   `json:"gegevens"`
	Voorwaarden *Voorwaarde `json:"voorwaarden"`
	Plichten    []string    `json:"plichten"`
}

// SubjectEis: alle kenmerken moeten bij het subject aanwezig zijn.
type SubjectEis struct {
	Kenmerken []Kenmerk `json:"kenmerken"`
}

// Kenmerk is een eis als rol = "medewerker".
type Kenmerk struct {
	Kenmerk string `json:"kenmerk"`
	Waarde  string `json:"waarde"`
}

// Gegeven is een gedekt registerpad.
type Gegeven struct {
	Pad string `json:"pad"`
}

// Voorwaarde is een samenstelling (En/Of/Xof), een vergelijking (Links/Op/…) of een
// existentievraag (Bestaat).
type Voorwaarde struct {
	En  []Voorwaarde `json:"en,omitempty"`
	Of  []Voorwaarde `json:"of,omitempty"`
	Xof []Voorwaarde `json:"xof,omitempty"`

	Links   *Term  `json:"links,omitempty"`
	Op      string `json:"op,omitempty"`
	Rechts  *Term  `json:"rechts,omitempty"`
	Rechts2 *Term  `json:"rechts2,omitempty"`
	Lijst   []Term `json:"lijst,omitempty"`

	Bestaat *Bestaat `json:"bestaat,omitempty"`
}

// Term is een literal (Waarde + Type), een veldwaarde (Pad) of een verwijzing via een
// anker: aanvrager (het subject), aanvraag (de context), betrokkene/gegevens (het record).
type Term struct {
	Waarde any    `json:"waarde,omitempty"`
	Type   string `json:"type,omitempty"`
	Pad    string `json:"pad,omitempty"`
	Anker  string `json:"anker,omitempty"`
}

// Bestaat is een PIP-vraag ("als er een toestemming voor de betrokkene is").
type Bestaat struct {
	Omschrijving string `json:"omschrijving"`
	Ontkenning   bool   `json:"ontkenning"`
	Voor         *Term  `json:"voor,omitempty"`
}

// LaadBundel leest en controleert een bundel en bouwt de index.
func LaadBundel(data []byte) (*Bundel, error) {
	var b Bundel
	if err := json.Unmarshal(data, &b); err != nil {
		return nil, fmt.Errorf("beleidsbundel is geen geldige JSON: %w", err)
	}
	if b.Formaat != BundelFormaat {
		return nil, fmt.Errorf("onbekend bundelformaat %q (verwacht %q)", b.Formaat, BundelFormaat)
	}
	if b.Standaard != "" && b.Standaard != "weigeren" {
		return nil, fmt.Errorf("standaard %q wordt niet ondersteund (alleen \"weigeren\")", b.Standaard)
	}
	if b.Conflict != "" && b.Conflict != "verbod-wint" {
		return nil, fmt.Errorf("conflictregel %q wordt niet ondersteund (alleen \"verbod-wint\")", b.Conflict)
	}
	ids := map[string]bool{}
	b.index = map[string]map[string][]*Regel{}
	for i := range b.Regels {
		r := &b.Regels[i]
		if r.ID == "" {
			return nil, fmt.Errorf("regel %d heeft geen id", i+1)
		}
		if ids[r.ID] {
			return nil, fmt.Errorf("regel-id %q komt dubbel voor", r.ID)
		}
		ids[r.ID] = true
		if r.Effect != "toestaan" && r.Effect != "verbieden" {
			return nil, fmt.Errorf("regel %q: effect %q is geen \"toestaan\" of \"verbieden\"", r.ID, r.Effect)
		}
		if r.Handeling == "" {
			return nil, fmt.Errorf("regel %q heeft geen handeling", r.ID)
		}
		perPad := b.index[r.Handeling]
		if perPad == nil {
			perPad = map[string][]*Regel{}
			b.index[r.Handeling] = perPad
		}
		for _, g := range r.Gegevens {
			if g.Pad == "" {
				continue
			}
			perPad[g.Pad] = append(perPad[g.Pad], r)
		}
	}
	return &b, nil
}

// regelsVoor geeft de regels voor deze handeling die pad dekken: de regels op het pad zelf,
// op elk voorvoegsel ervan (per segment) en op "*".
func (b *Bundel) regelsVoor(handeling, pad string) []*Regel {
	perPad := b.index[handeling]
	if perPad == nil {
		return nil
	}
	var uit []*Regel
	uit = append(uit, perPad["*"]...)
	for i := 0; i <= len(pad); i++ {
		if i == len(pad) || pad[i] == '.' {
			uit = append(uit, perPad[pad[:i]]...)
		}
	}
	return uit
}

// isGeldigOp: valt de datum (JJJJ-MM-DD) binnen de geldigheid van het beleid?
func (b *Bundel) isGeldigOp(datum string) bool {
	if b.Beleid.GeldigVanaf != nil && *b.Beleid.GeldigVanaf != "" && datum < *b.Beleid.GeldigVanaf {
		return false
	}
	if b.Beleid.GeldigTot != nil && *b.Beleid.GeldigTot != "" && datum >= *b.Beleid.GeldigTot {
		return false
	}
	return true
}

func normaliseer(s string) string { return strings.ToLower(strings.TrimSpace(s)) }
