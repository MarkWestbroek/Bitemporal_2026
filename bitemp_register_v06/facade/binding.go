package facade

// binding.go — de afbeelding CM ↔ register (technisch ontwerp fase 1 §5).
//
// Tijdelijk een JSON-bestand. Later genereert de Studio dit uit de kruisverbanden CM ↔ OAS (de
// OAS van elk register als M1-model in het OAS-profiel; CLAUDE.md, M0–M3). De vorm is daarom
// zo gekozen dat hij 1-op-1 uit die kruisverbanden te maken is: per CM-entiteit een resource,
// per onderliggend element (GE of relatie) waar het in het register staat.
//
// Namen in de binding zijn die van de MetaRegistry: de entiteit op Typenaam, een onderdeel op
// zijn Doeltype (bv. "Zaak_ZaakIdentificatie", "ZaakRol"), een veld op zijn JSON-naam in de
// _Data-struct. Valideer controleert dat alles bestaat; een onbekende naam is een startfout.

import (
	"encoding/json"
	"fmt"
	"os"
	"reflect"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// Binding is het hele bindingbestand.
type Binding struct {
	// Registers op sleutel (bv. "openzaak", "objecten").
	Registers map[string]RegisterCfg `json:"registers"`
	// IRI-regels: welk IRI-prefix bij welk register en welke resource hoort (besluit 18-11, vorm c).
	IRI []IRICfg `json:"iri"`
	// Typen op CM-typenaam (entiteiten).
	Typen map[string]TypeBinding `json:"typen"`
}

// RegisterCfg beschrijft één register. Basis en de geheimen komen uit de omgeving
// (${VAR} wordt bij het laden ingevuld), nooit uit het bestand zelf.
type RegisterCfg struct {
	// Soort: "zgw" (Zaken, Catalogi, Documenten, Besluiten) of "objecten" (Objecten-API).
	Soort string `json:"soort"`
	// Basis-URL, eindigend op "/", bv. "${OPENZAAK_URL}/".
	Basis string `json:"basis"`
	// Auth: "jwt-zgw", "token" of "geen".
	Auth string `json:"auth"`
	// ClientID en Secret (jwt-zgw) of Token (token), meestal als ${VAR}.
	ClientID string `json:"clientId,omitempty"`
	Secret   string `json:"secret,omitempty"`
	Token    string `json:"token,omitempty"`
}

// IRICfg is een IRI-regel in de binding; Resource is relatief aan de basis van het register.
type IRICfg struct {
	Prefix   string `json:"prefix"`
	Register string `json:"register"`
	Resource string `json:"resource"`
}

// TypeBinding zegt waar een CM-entiteit staat.
type TypeBinding struct {
	Register string `json:"register"`
	// Resource relatief aan de basis, zonder slash aan het eind, bv. "zaken/api/v1/zaken".
	Resource string `json:"resource"`
	// Onderdelen op Doeltype (GE-hub of relatie-hub van de entiteit).
	Onderdelen map[string]OnderdeelBinding `json:"onderdelen"`
	// Filters: GraphQL-filterpad ("<jsonRolnaam>.<veld>", of "id") → query-parameter van het
	// register. Alleen wat hier staat, kan de façade doorgeven; de rest weigert hij.
	Filters map[string]string `json:"filters,omitempty"`
}

// OnderdeelBinding zegt waar een GE of relatie staat.
type OnderdeelBinding struct {
	// Bron: "" = in het object zelf (één voorkomen). Anders een lijst-resource van het register,
	// bv. "zaken/api/v1/rollen", gefilterd met FilterOp=<url van het object>.
	Bron     string `json:"bron,omitempty"`
	FilterOp string `json:"filterOp,omitempty"`
	// Als: alleen items die hieraan voldoen (bv. de rol met betrokkeneType natuurlijk_persoon).
	Als *Voorwaarde `json:"als,omitempty"`
	// Velden: JSON-naam in de _Data-struct → pad in het registerobject (met punten).
	Velden map[string]string `json:"velden,omitempty"`
	// IRIVelden: velden die een componentURL bevatten en als IRI getoond worden.
	IRIVelden []string `json:"iriVelden,omitempty"`
	// Doel (alleen relaties): het pad met de URL van het doel, bv. "zaaktype" of "url".
	Doel string `json:"doel,omitempty"`
	// Aanvang (alleen materiële relaties/GE's): pad met de datum of het tijdstip van aanvang.
	// Het einde van een voorkomen is de aanvang van het volgende (opvolging).
	Aanvang string `json:"aanvang,omitempty"`
	// OmgekeerdFilter (alleen relaties in het object zelf): de query-parameter op de resource van
	// de entiteit die op de doel-URL filtert, bv. "zaaktype" voor "de zaken van dit zaaktype".
	// Zonder deze sleutel kan de omgekeerde relatie (gerelateerde_*) niet.
	OmgekeerdFilter string `json:"omgekeerdFilter,omitempty"`
}

// Voorwaarde op een item: Veld is gelijk aan Is, of (Gevuld) niet leeg.
type Voorwaarde struct {
	Veld   string `json:"veld"`
	Is     string `json:"is,omitempty"`
	Gevuld bool   `json:"gevuld,omitempty"`
}

// LaadBinding leest een bindingbestand en vult ${VAR} in uit de omgeving.
func LaadBinding(pad string) (*Binding, error) {
	ruw, err := os.ReadFile(pad)
	if err != nil {
		return nil, fmt.Errorf("binding lezen: %w", err)
	}
	return ParseBinding(ruw, os.Getenv)
}

// ParseBinding leest een binding uit JSON; omgeving vult ${VAR} in (in tests een map).
func ParseBinding(ruw []byte, omgeving func(string) string) (*Binding, error) {
	var b Binding
	dec := json.NewDecoder(strings.NewReader(string(ruw)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&b); err != nil {
		return nil, fmt.Errorf("binding parsen: %w", err)
	}
	vul := func(s string) string { return os.Expand(s, omgeving) }
	for k, r := range b.Registers {
		r.Basis, r.ClientID, r.Secret, r.Token = vul(r.Basis), vul(r.ClientID), vul(r.Secret), vul(r.Token)
		b.Registers[k] = r
	}
	for i := range b.IRI {
		b.IRI[i].Prefix = vul(b.IRI[i].Prefix)
	}
	return &b, nil
}

// IRITabel maakt de vertaaltabel uit de IRI-regels.
func (b *Binding) IRITabel() (*IRITabel, error) {
	regels := make([]IRIRegel, 0, len(b.IRI))
	for _, r := range b.IRI {
		reg, ok := b.Registers[r.Register]
		if !ok {
			return nil, fmt.Errorf("iri-regel %q: onbekend register %q", r.Prefix, r.Register)
		}
		regels = append(regels, IRIRegel{Prefix: r.Prefix, Register: r.Register, Basis: reg.Basis + strings.Trim(r.Resource, "/") + "/"})
	}
	return NieuweIRITabel(regels)
}

// Valideer controleert de binding tegen de MetaRegistry en geeft alle fouten tegelijk.
func (b *Binding) Valideer() error {
	var fouten []string
	f := func(format string, a ...any) { fouten = append(fouten, fmt.Sprintf(format, a...)) }

	for naam, r := range b.Registers {
		switch r.Soort {
		case "zgw", "objecten":
		default:
			f("register %s: onbekende soort %q", naam, r.Soort)
		}
		switch r.Auth {
		case "jwt-zgw":
			if r.ClientID == "" || r.Secret == "" {
				f("register %s: jwt-zgw vraagt clientId en secret", naam)
			}
		case "token":
			if r.Token == "" {
				f("register %s: token ontbreekt", naam)
			}
		case "geen":
		default:
			f("register %s: onbekende auth %q", naam, r.Auth)
		}
		if !strings.HasSuffix(r.Basis, "/") || !(strings.HasPrefix(r.Basis, "https://") || strings.HasPrefix(r.Basis, "http://")) {
			f("register %s: basis %q moet een http(s)-adres zijn dat op / eindigt", naam, r.Basis)
		}
	}
	if _, err := b.IRITabel(); err != nil {
		f("%v", err)
	}

	for typenaam, tb := range b.Typen {
		meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
		if !ok || meta.Metatype != model.MetatypeEntiteit {
			f("type %s: geen entiteit in de MetaRegistry", typenaam)
			continue
		}
		if _, ok := b.Registers[tb.Register]; !ok {
			f("type %s: onbekend register %q", typenaam, tb.Register)
		}
		if tb.Resource == "" || strings.HasSuffix(tb.Resource, "/") {
			f("type %s: resource %q is leeg of eindigt op /", typenaam, tb.Resource)
		}
		kinderen := map[string]model.OnderliggendGegevenselement{}
		for _, k := range meta.OnderliggendeGegevenselementen {
			kinderen[k.Doeltype] = k
		}
		for doeltype, ob := range tb.Onderdelen {
			if _, ok := kinderen[doeltype]; !ok {
				f("type %s: %s is geen onderdeel van de entiteit", typenaam, doeltype)
				continue
			}
			kindMeta, _ := model.MetaRegistry.GetTypeMeta(doeltype)
			if (ob.Bron == "") != (ob.FilterOp == "") {
				f("%s.%s: bron en filterOp horen samen", typenaam, doeltype)
			}
			if kindMeta.Metatype == model.MetatypeRelatie {
				if ob.Doel == "" {
					f("%s.%s: een relatie vraagt een doel", typenaam, doeltype)
				}
				doel := model.DoelTypenaamVanRelatie(kindMeta)
				if _, ok := b.Typen[doel]; !ok {
					f("%s.%s: doelentiteit %s heeft geen binding", typenaam, doeltype, doel)
				}
			} else if ob.Doel != "" {
				f("%s.%s: doel hoort alleen bij een relatie", typenaam, doeltype)
			}
			if ob.Aanvang != "" && !kindMeta.IsMaterieel {
				f("%s.%s: aanvang op een niet-materieel onderdeel", typenaam, doeltype)
			}
			dataVelden := jsonVeldenVan(kindMeta.DataTypenaam)
			for veld := range ob.Velden {
				if !dataVelden[veld] {
					f("%s.%s: veld %q bestaat niet in %s", typenaam, doeltype, veld, kindMeta.DataTypenaam)
				}
			}
			for _, veld := range ob.IRIVelden {
				if _, ok := ob.Velden[veld]; !ok {
					f("%s.%s: iriVeld %q staat niet in velden", typenaam, doeltype, veld)
				}
			}
		}
		for pad := range tb.Filters {
			if pad == "id" {
				continue
			}
			kind, _, ok := strings.Cut(pad, ".")
			gevonden := false
			for _, k := range meta.OnderliggendeGegevenselementen {
				if k.JSONRolnaam == kind {
					gevonden = true
				}
			}
			if !ok || !gevonden {
				f("type %s: filter %q is geen <jsonRolnaam>.<veld> van de entiteit", typenaam, pad)
			}
		}
	}
	if len(fouten) > 0 {
		sort.Strings(fouten)
		return fmt.Errorf("binding ongeldig:\n  %s", strings.Join(fouten, "\n  "))
	}
	return nil
}

// jsonVeldenVan geeft de JSON-veldnamen van een struct uit de MetaRegistry.
func jsonVeldenVan(typenaam string) map[string]bool {
	uit := map[string]bool{}
	meta, ok := model.MetaRegistry.GetTypeMeta(typenaam)
	if !ok || meta.Factory == nil {
		return uit
	}
	t := reflect.TypeOf(meta.Factory())
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	for i := 0; i < t.NumField(); i++ {
		naam, _, _ := strings.Cut(t.Field(i).Tag.Get("json"), ",")
		if naam != "" && naam != "-" {
			uit[naam] = true
		}
	}
	return uit
}
