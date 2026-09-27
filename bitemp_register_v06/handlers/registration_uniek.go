package handlers

// registration_uniek.go — uniekheid (UML {unique}, V3Veld.Uniek) bij registratie (27-09-2026).
//
// Een veld met schema-tag `uniek=<bereik>` mag in de ACTUELE stand (data, hub en entiteit niet
// afgevoerd) maar één keer dezelfde waarde hebben, binnen het bereik:
//
//	entiteit  onder alle exemplaren van dit entiteittype (bv. de code van een FormulierDefinitie)
//	domein    over alle velden met uniek=domein in hetzelfde domein
//	register  over alle velden met uniek=register in het hele register
//
// Een nieuwe versie van hetzelfde record (zelfde entiteit) botst niet met zichzelf. Waarden
// binnen één registratie worden ook onderling vergeleken. Een botsing wordt een ValidatieFout
// met code "uniek", dus dezelfde route als de datatype-validatie (422 in strict-modus).
//
// Bewust nog niet: uniek op elk formeel moment (de tweede tijdas) en uniek over registers heen
// (een centraal register); zie docs/plans/2026-09-26 Invoersoort en vorm (ontwerp).md §9d.

import (
	"context"
	"fmt"
	"log"
	"reflect"
	"strconv"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
)

// uniekKandidaat: één veld met een uniek-markering en de tabellen om het in te zoeken.
type uniekKandidaat struct {
	HubType   string // typenaam van de GE-hub
	DataTabel string
	HubTabel  string
	EntTabel  string
	EntIDKol  string // kolom in hub/data die naar de entiteit wijst
	EntPK     string // PK-kolom van de entiteit
	Kolom     string
	Bereik    string
	Domein    string
}

// uniekeVelden: de velden met een uniek-markering in een representatie-struct (json-naam → bereik).
func uniekeVelden(rep any) map[string]string {
	uit := map[string]string{}
	t := reflect.TypeOf(rep)
	for t != nil && t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t == nil || t.Kind() != reflect.Struct {
		return uit
	}
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if b := model.ParseSchemaTag(f.Tag.Get("schema")).Uniek; b != "" {
			uit[jsonNaamVan(f)] = b
		}
	}
	return uit
}

func jsonNaamVan(f reflect.StructField) string {
	if tag := f.Tag.Get("json"); tag != "" && tag != "-" {
		return strings.SplitN(tag, ",", 2)[0]
	}
	return f.Name
}

// stringWaarden: json-naam → string-waarde (pointers gevolgd) van een representatie.
func stringWaarden(rep any) map[string]string {
	uit := map[string]string{}
	v := reflect.ValueOf(rep)
	for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
		if v.IsNil() {
			return uit
		}
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return uit
	}
	for i := 0; i < v.NumField(); i++ {
		fv := v.Field(i)
		for fv.Kind() == reflect.Ptr && !fv.IsNil() {
			fv = fv.Elem()
		}
		switch fv.Kind() {
		case reflect.String:
			uit[jsonNaamVan(v.Type().Field(i))] = fv.String()
		case reflect.Int, reflect.Int32, reflect.Int64:
			uit[jsonNaamVan(v.Type().Field(i))] = strconv.FormatInt(fv.Int(), 10)
		}
	}
	return uit
}

// kandidaatVoorHub: de tabellen van een GE-hub met één uniek veld.
func kandidaatVoorHub(hub model.TypeMeta, kolom, bereik string) (uniekKandidaat, bool) {
	if hub.GESubtype != model.GESubtypeHub || hub.DataTypenaam == "" {
		return uniekKandidaat{}, false
	}
	data, ok := model.MetaRegistry.GetTypeMeta(hub.DataTypenaam)
	if !ok {
		return uniekKandidaat{}, false
	}
	ent, ok := model.MetaRegistry.GetBovenliggendeEntiteitMeta(hub.Typenaam)
	if !ok {
		return uniekKandidaat{}, false
	}
	pk := ent.IDKolom
	if pk == "" {
		pk = "id"
	}
	return uniekKandidaat{HubType: hub.Typenaam, DataTabel: data.Tabelnaam, HubTabel: hub.Tabelnaam, EntTabel: ent.Tabelnaam,
		EntIDKol: hub.EntiteitIDKolom, EntPK: pk, Kolom: kolom, Bereik: bereik, Domein: hub.Domein}, true
}

// kandidatenVoor: alle plekken waar een waarde met dit bereik niet nog eens mag voorkomen.
func kandidatenVoor(eigen uniekKandidaat) []uniekKandidaat {
	if eigen.Bereik == "entiteit" {
		return []uniekKandidaat{eigen}
	}
	var uit []uniekKandidaat
	for naam, meta := range model.MetaRegistry {
		if meta.GESubtype != model.GESubtypeHub || meta.Factory == nil {
			continue
		}
		if eigen.Bereik == "domein" && meta.Domein != eigen.Domein {
			continue
		}
		for kolom, bereik := range uniekeVelden(meta.Factory()) {
			if bereik != eigen.Bereik {
				continue
			}
			if k, ok := kandidaatVoorHub(model.MetaRegistry.MustTypeMeta(naam), kolom, bereik); ok {
				uit = append(uit, k)
			}
		}
	}
	return uit
}

// bezetDoor: de entiteit-id's in de actuele stand die deze waarde in dit veld hebben.
func bezetDoor(ctx context.Context, db bun.IDB, k uniekKandidaat, waarde string) ([]string, error) {
	var ids []string
	err := db.NewRaw(`SELECT DISTINCT CAST(h.? AS text)
		FROM ? d
		JOIN ? h ON d.? = h.? AND d.rel_id = h.rel_id
		JOIN ? e ON e.? = h.?
		WHERE d.? = ? AND d.afvoer IS NULL AND h.afvoer IS NULL AND e.afvoer IS NULL
		LIMIT 10`,
		bun.Ident(k.EntIDKol), bun.Ident(k.DataTabel), bun.Ident(k.HubTabel), bun.Ident(k.EntIDKol), bun.Ident(k.EntIDKol),
		bun.Ident(k.EntTabel), bun.Ident(k.EntPK), bun.Ident(k.EntIDKol), bun.Ident(k.Kolom), waarde).Scan(ctx, &ids)
	return ids, err
}

// controleerUniekheid: fouten voor waarden die in hun bereik al bestaan (in de database of
// eerder in dezelfde registratie). Databasefouten worden gelogd en overgeslagen: een
// ontbrekende kolom mag een registratie niet blokkeren.
func controleerUniekheid(ctx context.Context, db bun.IDB, wijzigingen []model.WijzigingRequest) []model.ValidatieFout {
	var fouten []model.ValidatieFout
	type sleutel struct{ bereik, domein, waarde string }
	gezien := map[sleutel]string{} // → entiteit-id binnen deze registratie
	for idx, w := range wijzigingen {
		rep := w.Opvoer
		if rep == nil || rep.Representatie == nil {
			continue
		}
		velden := uniekeVelden(rep.Representatie)
		if len(velden) == 0 {
			continue
		}
		hub, ok := model.MetaRegistry.GetTypeMeta(rep.Representatienaam)
		if !ok {
			continue
		}
		waarden := stringWaarden(rep.Representatie)
		eigenID := waarden[hub.EntiteitIDKolom]
		for kolom, bereik := range velden {
			waarde := strings.TrimSpace(waarden[kolom])
			if waarde == "" {
				continue
			}
			eigen, ok := kandidaatVoorHub(hub, kolom, bereik)
			if !ok {
				continue
			}
			pad := fmt.Sprintf("wijzigingen[%d].%s.%s", idx, rep.Veldnaam, kolom)
			fout := func(bericht string) {
				fouten = append(fouten, model.ValidatieFout{Veld: pad, Code: "uniek", Waarde: waarde, Severity: model.SeverityError, Bericht: bericht})
			}
			s := sleutel{bereik, eigen.Domein, waarde}
			if bereik == "entiteit" {
				s.domein = hub.Typenaam
			} else if bereik == "register" {
				s.domein = ""
			}
			if ander, dubbel := gezien[s]; dubbel && ander != eigenID {
				fout(fmt.Sprintf("%s %q komt twee keer voor in deze registratie (uniek binnen %s)", kolom, waarde, bereik))
				continue
			}
			gezien[s] = eigenID
			for _, k := range kandidatenVoor(eigen) {
				ids, err := bezetDoor(ctx, db, k, waarde)
				if err != nil {
					log.Printf("[uniek] controle %s.%s overgeslagen: %v", k.DataTabel, k.Kolom, err)
					continue
				}
				for _, id := range ids {
					if k.HubType == hub.Typenaam && id == eigenID {
						continue // een nieuwe versie van hetzelfde record
					}
					fout(fmt.Sprintf("%s %q is al in gebruik (%s %s; uniek binnen %s)", kolom, waarde, strings.SplitN(k.HubType, "_", 2)[0], id, bereik))
					break
				}
			}
		}
	}
	return fouten
}
