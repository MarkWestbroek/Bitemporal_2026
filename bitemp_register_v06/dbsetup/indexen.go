package dbsetup

// indexen.go — indexen als patroon uit het metamodel (akkoord Mark 18-11-2026, stap 1).
//
// Eén bronfunctie, ModelIndexDefinities, leidt uit de MetaRegistry af welke indexen een
// register nodig heeft. Twee afnemers gebruiken dezelfde lijst:
//
//   - CreateTables (start en rebuild): CREATE INDEX IF NOT EXISTS, zie createModelIndexes;
//   - later het script voor bestaande registers: CREATE INDEX CONCURRENTLY (stap 5),
//     via IndexDefinitie.SQL(true).
//
// Stap 1 bevat alleen de indexen die geen aanwijzing in het model nodig hebben:
//
//	doel     de doelkant van een relatie-hub: (doel_id, bron_id). Zonder deze index is elke
//	         omgekeerde vraag ("welke zaken wijzen naar deze rol") een scan van de hele
//	         relatietabel (dynql makeReverseRelationResolver).
//	uniek    een veld met schema-tag uniek=<bereik>: (kolom) op de _Data-tabel. De
//	         uniekheidscontrole (handlers/registration_uniek.go, bezetDoor) zoekt bij elke
//	         opvoer op die waarde; zonder index is dat een scan per opvoer, en wordt een
//	         grote seed steeds trager. Niet partieel (sinds 18-11-2026): het filter van een
//	         lijst vraagt "actief op het leesmoment" (opvoer <= t AND (afvoer IS NULL OR
//	         afvoer > t)), en een index WHERE afvoer IS NULL mag PostgreSQL daar niet voor
//	         gebruiken. Een uniek veld is zo vanzelf een zoeksleutel. De index heet
//	         ix_<tabel>_<kolom>_zoek, dezelfde naam als bij de mark; de oude partiële
//	         ix_<tabel>_<kolom>_uniek wordt weggehaald zodra de nieuwe er staat.
//
// Stap 4 voegt de index toe die een aanwijzing vraagt:
//
//	zoek     een veld met de mark register.zoeksleutel of register.sorteerbaar (schema-tag
//	         zoeksleutel / sorteerbaar, door de codegen gezet uit de marks-bijlage): (kolom)
//	         op de _Data-tabel. Niet partieel, zodat ook een vraag op een peiltijdstip hem
//	         gebruikt. Dient het filter (eq, in, bereik) en het sorteren van een lijst op
//	         één sleutel van een enkelvoudig, niet-materieel GE (dynql/sortering.go).
//
// Uitleg: docs/INDEXEN.md.

import (
	"context"
	"fmt"
	"hash/crc32"
	"reflect"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
	"github.com/uptrace/bun/schema"
)

// IndexDefinitie beschrijft één index die uit het model volgt.
type IndexDefinitie struct {
	Naam     string   // indexnaam, hooguit 63 tekens
	Tabel    string   // tabelnaam
	Kolommen []string // SQL-kolomnamen, in volgorde
	Waar     string   // optionele WHERE van een partiële index (zonder het woord WHERE)
	Soort    string   // "doel" | "uniek" | "zoek"
	Reden    string   // voor logregels en het script: waar de index voor dient
	Vervangt string   // optioneel: de naam van een oudere eigen index die hierdoor overbodig is
}

// SQL geeft het CREATE INDEX-statement. Met concurrently=true blokkeert het aanmaken geen
// schrijvers; dat mag niet binnen een transactie en is bedoeld voor bestaande registers.
func (d IndexDefinitie) SQL(concurrently bool) string {
	var b strings.Builder
	b.WriteString("CREATE INDEX ")
	if concurrently {
		b.WriteString("CONCURRENTLY ")
	}
	fmt.Fprintf(&b, "IF NOT EXISTS %s ON %s (", pgIdent(d.Naam), pgIdent(d.Tabel))
	for i, k := range d.Kolommen {
		if i > 0 {
			b.WriteString(", ")
		}
		b.WriteString(pgIdent(k))
	}
	b.WriteString(")")
	if d.Waar != "" {
		b.WriteString(" WHERE " + d.Waar)
	}
	return b.String()
}

// indexTabellen: bun's tabelschema, dezelfde bron als CreateTables en het GraphQL-filter,
// zodat kolomnamen exact kloppen (bv. agbCode → agbcode).
var indexTabellen = pgdialect.New().Tables()

// ModelIndexDefinities leidt de indexen af uit de MetaRegistry, gesorteerd op naam.
func ModelIndexDefinities() []IndexDefinitie {
	var uit []IndexDefinitie
	gezien := map[string]bool{}
	voegToe := func(d IndexDefinitie) {
		if !gezien[d.Naam] {
			gezien[d.Naam] = true
			uit = append(uit, d)
		}
	}

	for _, meta := range model.MetaRegistry {
		if meta.Tabelnaam == "" {
			continue
		}
		tabel := bunTabel(meta)
		if tabel == nil {
			continue
		}

		// Doelkant van een relatie-hub.
		if meta.Metatype == model.MetatypeRelatie && meta.SecondaireEntiteitIDKolom != "" &&
			heeftKolom(tabel, meta.SecondaireEntiteitIDKolom) {
			kolommen := []string{meta.SecondaireEntiteitIDKolom}
			if meta.EntiteitIDKolom != "" && meta.EntiteitIDKolom != meta.SecondaireEntiteitIDKolom &&
				heeftKolom(tabel, meta.EntiteitIDKolom) {
				kolommen = append(kolommen, meta.EntiteitIDKolom)
			}
			voegToe(IndexDefinitie{
				Naam:     indexNaam(meta.Tabelnaam, meta.SecondaireEntiteitIDKolom, "doel"),
				Tabel:    meta.Tabelnaam,
				Kolommen: kolommen,
				Soort:    "doel",
				Reden:    "omgekeerde relatie van " + meta.Typenaam,
			})
		}

		// Unieke velden: de waarde staat in de _Data-tabel van een GE-hub.
		if meta.GESubtype == model.GESubtypeHub && meta.DataTypenaam != "" {
			dataMeta, ok := model.MetaRegistry.GetTypeMeta(meta.DataTypenaam)
			if !ok || dataMeta.Tabelnaam == "" {
				continue
			}
			dataTabel := bunTabel(dataMeta)
			if dataTabel == nil {
				continue
			}
			for _, f := range dataTabel.Fields {
				tag := model.ParseSchemaTag(f.StructField.Tag.Get("schema"))
				if tag.Uniek != "" {
					voegToe(IndexDefinitie{
						Naam:     indexNaam(dataMeta.Tabelnaam, f.Name, "zoek"),
						Tabel:    dataMeta.Tabelnaam,
						Kolommen: []string{f.Name},
						Soort:    "uniek",
						Vervangt: indexNaam(dataMeta.Tabelnaam, f.Name, "uniek"),
						Reden:    fmt.Sprintf("uniekheidscontrole (%s) op %s", tag.Uniek, meta.Typenaam),
					})
				}
				// Marks register.zoeksleutel en register.sorteerbaar: dezelfde index op de kolom.
				if tag.Zoeksleutel || tag.Sorteerbaar {
					reden := "zoeksleutel"
					if !tag.Zoeksleutel {
						reden = "sorteerbaar"
					} else if tag.Sorteerbaar {
						reden = "zoeksleutel en sorteerbaar"
					}
					voegToe(IndexDefinitie{
						Naam:     indexNaam(dataMeta.Tabelnaam, f.Name, "zoek"),
						Tabel:    dataMeta.Tabelnaam,
						Kolommen: []string{f.Name},
						Soort:    "zoek",
						Reden:    fmt.Sprintf("mark %s op %s", reden, meta.Typenaam),
					})
				}
			}
		}
	}

	sort.Slice(uit, func(i, j int) bool { return uit[i].Naam < uit[j].Naam })
	return uit
}

// bunTabel: het tabelschema van de struct waarmee CreateTables de tabel aanmaakt
// (DBFactory als die er is, anders Factory).
func bunTabel(meta model.TypeMeta) *schema.Table {
	var rep any
	switch {
	case meta.DBFactory != nil:
		rep = meta.DBFactory()
	case meta.Factory != nil:
		rep = meta.Factory()
	default:
		return nil
	}
	t := reflect.TypeOf(rep)
	for t != nil && t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	if t == nil || t.Kind() != reflect.Struct {
		return nil
	}
	return indexTabellen.Get(t)
}

func heeftKolom(tabel *schema.Table, kolom string) bool {
	for _, f := range tabel.Fields {
		if f.Name == kolom {
			return true
		}
	}
	return false
}

// indexNaam bouwt ix_<tabel>_<kolom>_<soort>. PostgreSQL kapt namen af op 63 tekens; twee
// lange namen kunnen dan samenvallen. Een te lange naam wordt daarom zelf ingekort, met een
// hash van de volledige naam erachter.
func indexNaam(tabel, kolom, soort string) string {
	naam := fmt.Sprintf("ix_%s_%s_%s", tabel, kolom, soort)
	if len(naam) <= 63 {
		return naam
	}
	hash := fmt.Sprintf("_%08x", crc32.ChecksumIEEE([]byte(naam)))
	return naam[:63-len(hash)] + hash
}

// createModelIndexes maakt de indexen uit ModelIndexDefinities aan. Niet-fataal, net als de
// enkelvoudig-invariant: een index die mislukt mag de start niet blokkeren. Een tabel die
// niet bestaat (domein niet gebouwd, zie gebouwde_domeinen) wordt stil overgeslagen.
func createModelIndexes(ctx context.Context, db bun.IDB) {
	for _, def := range ModelIndexDefinities() {
		var bestaat bool
		if err := db.NewRaw(`SELECT to_regclass(?) IS NOT NULL`, pgIdent(def.Tabel)).Scan(ctx, &bestaat); err != nil || !bestaat {
			continue
		}
		stmt := def.SQL(false)
		if err := veiligeStap(ctx, db, func() error { _, err := db.ExecContext(ctx, stmt); return err }); err != nil {
			fmt.Printf("WARN: index %s niet aangemaakt (%s): %v\n", def.Naam, def.Reden, err)
			continue
		}
		// De voorganger (de partiële index van api 0.28.0/0.29.0) pas weghalen als de nieuwe
		// er staat. Alleen een index met onze eigen naam; mislukt het, dan blijft hij staan.
		if def.Vervangt != "" && def.Vervangt != def.Naam {
			weg := "DROP INDEX IF EXISTS " + pgIdent(def.Vervangt)
			if err := veiligeStap(ctx, db, func() error { _, err := db.ExecContext(ctx, weg); return err }); err != nil {
				fmt.Printf("WARN: oude index %s niet weggehaald: %v\n", def.Vervangt, err)
			}
		}
	}
}
