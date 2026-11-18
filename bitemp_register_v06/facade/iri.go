// Package facade bevat de façade-API op Common Ground-registers: een voorkant gelijk aan een
// Omnium-register uit het CM, met lezen (en later schrijven) op bestaande registers zoals
// Open Zaak en Open Object. Zie docs/plans/2026-11-18 Façade fase 1 — technisch ontwerp.md.
package facade

// iri.go — vertaling tussen de identiteit van een extern object (een persistente IRI volgens de
// NL URI-strategie) en het adres ervan bij een component (de URL in de register-API).
//
// Besluit Mark 18-11-2026 (vorm c): een zaakobject wijst met een IRI naar een object, bv.
// https://<domein-organisatie>/id/object/<uuid>. De IRI is identiteit, geen adres. Welk register
// het object heeft, staat in de binding: een tabel van IRI-prefix naar componentbasis.
//
// Veiligheid: een IRI komt van buiten (afnemer of register). Daarom vertaalt NaarURL alleen naar
// een bekende componentbasis, en alleen als de rest een uuid is. Zo kan een IRI de façade nooit
// naar een willekeurig adres laten bellen (geen SSRF via het zaakobject).

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// IRIRegel koppelt een IRI-prefix aan de URL-basis van één resource bij één register.
type IRIRegel struct {
	Prefix   string // bv. "https://gemeente.example/id/object/"
	Register string // sleutel in de binding, bv. "objecten"
	Basis    string // bv. "https://objecten.example/api/v2/objects/"
}

// IRITabel vertaalt in beide richtingen. Langste prefix wint.
type IRITabel struct {
	regels []IRIRegel
}

var uuidPatroon = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// NieuweIRITabel controleert de regels: prefix en basis eindigen op "/", zijn https of http,
// en geen prefix of basis komt twee keer voor.
func NieuweIRITabel(regels []IRIRegel) (*IRITabel, error) {
	gezienPrefix := map[string]bool{}
	gezienBasis := map[string]bool{}
	for i, r := range regels {
		for naam, waarde := range map[string]string{"prefix": r.Prefix, "basis": r.Basis} {
			if !(strings.HasPrefix(waarde, "https://") || strings.HasPrefix(waarde, "http://")) {
				return nil, fmt.Errorf("iri-regel %d: %s %q is geen http(s)-adres", i, naam, waarde)
			}
			if !strings.HasSuffix(waarde, "/") {
				return nil, fmt.Errorf("iri-regel %d: %s %q moet op / eindigen", i, naam, waarde)
			}
		}
		if r.Register == "" {
			return nil, fmt.Errorf("iri-regel %d: register ontbreekt", i)
		}
		if gezienPrefix[r.Prefix] {
			return nil, fmt.Errorf("iri-regel %d: prefix %q komt twee keer voor", i, r.Prefix)
		}
		if gezienBasis[r.Basis] {
			return nil, fmt.Errorf("iri-regel %d: basis %q komt twee keer voor", i, r.Basis)
		}
		gezienPrefix[r.Prefix] = true
		gezienBasis[r.Basis] = true
	}
	kopie := append([]IRIRegel(nil), regels...)
	// Langste prefix eerst, zodat een specifiekere regel voorgaat.
	sort.SliceStable(kopie, func(a, b int) bool { return len(kopie[a].Prefix) > len(kopie[b].Prefix) })
	return &IRITabel{regels: kopie}, nil
}

// Verwijzing is een IRI die de façade kan ophalen: bij welk register, op welke URL, welke uuid.
type Verwijzing struct {
	Register string
	URL      string
	UUID     string
}

// NaarURL zoekt de componentURL bij een IRI. ok=false als de IRI geen bekend prefix heeft of de
// rest geen uuid is; de façade haalt zo'n object dan niet op.
func (t *IRITabel) NaarURL(iri string) (Verwijzing, bool) {
	for _, r := range t.regels {
		if rest, ok := strings.CutPrefix(iri, r.Prefix); ok {
			if !uuidPatroon.MatchString(rest) {
				return Verwijzing{}, false
			}
			return Verwijzing{Register: r.Register, URL: r.Basis + strings.ToLower(rest), UUID: strings.ToLower(rest)}, true
		}
	}
	return Verwijzing{}, false
}

// NaarIRI vertaalt een componentURL (zoals ZGW hem in zaakobject.object zet) naar de IRI. Een
// URL van een onbekend component blijft staan: een http(s)-URL is zelf ook een geldige IRI. Zo
// is het veld altijd gevuld, ook voor zaakobjecten die buiten de façade om zijn gemaakt.
func (t *IRITabel) NaarIRI(url string) string {
	for _, r := range t.regels {
		if rest, ok := strings.CutPrefix(url, r.Basis); ok && uuidPatroon.MatchString(rest) {
			return r.Prefix + strings.ToLower(rest)
		}
	}
	return url
}
