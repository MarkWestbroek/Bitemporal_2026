package dynql

// zoektabel.go — zoektabellen: een leesversnelling buiten de formele historie.
//
// Ontwerp: docs/plans/2026-11-18 Zoekdefinities — zoektabellen als inrichting (ontwerp).md.
// Gebruik: docs/INDEXEN.md, paragraaf "Zoektabellen".
//
// Een lijst "binnen één relatie, gesorteerd op één veld van een gegevenselement" (zaken van
// een zaaktype op startdatum) kan geen index gebruiken: de relatie en het veld staan in
// verschillende tabellen. Een ZoekDefinitie (registerdata in het configuratiedomein, dus
// inrichting) vraagt de API om daarvoor een zoektabel bij te houden:
//
//	zk_<definitie-id>_<hash> (doel_id, waarde, entiteit_id, rel_id, opvoer, afvoer)
//	index (doel_id, waarde, entiteit_id)
//
// Richting van de afhankelijkheid (besluit Mark, 18-11-2026): zoektabel → register, niet
// andersom. Het register kent de zoektabel niet. De registratiecode biedt alleen een haak aan
// (handlers.VoorCommit); dit bestand meldt zich daarop aan via main.go. Een fout hier laat een
// registratie nooit mislukken: de zoektabel gaat dan naar status "fout" en het lezen volgt de
// gewone weg.
//
// De zoektabel is plumbing, zoals een index: geen wijziging-rijen, geen registratie, altijd
// herbouwbaar. De rijen van één entiteit worden afgeleid uit de brontabellen met één query
// (afleidSQL); elke schrijfweg (opvoer, afvoer, correctie, ongedaanmaking, replay) leidt tot
// hetzelfde: "reken de rijen van deze entiteit opnieuw uit". De tijdkolommen zijn de doorsnede
// van die van de entiteit, het relatievoorkomen, de GE-hub en het datarecord; de leesregel is
// dus dezelfde als op de brontabellen, ook met een peiltijdstip.
//
// ZoekDefinitie is een gereserveerd woord, zoals QueryDefinitie (opgeslagen_documenten.go).

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/pgdialect"
)

const (
	zoekEntiteit    = "ZoekDefinitie"
	zoekGENaam      = "ZoekDefinitie_ZoekdefinitieNaam"
	zoekGEPad       = "ZoekDefinitie_ZoekdefinitiePad"
	zoekGEStatus    = "ZoekDefinitie_ZoekdefinitieStatus"
	zoekStatusActie = "actief"

	zoekStandTabel = "zoektabel_stand"

	// Status van een zoektabel in zoektabel_stand.
	zoekVullen     = "vullen"     // bestaat, wordt gevuld; registraties houden hem al bij
	zoekGevuld     = "gevuld"     // bruikbaar voor het lezen
	zoekUitfaseren = "uitfaseren" // niet meer lezen; nog wel bijhouden tot hij wordt weggegooid
	zoekFout       = "fout"       // bijhouden of vullen mislukt; wordt opnieuw gevuld

	// zoekVulGroep: aantal entiteiten per transactie bij het vullen. Klein, zodat het vullen
	// een slot nooit lang vasthoudt en een registratie er niet op hoeft te wachten.
	zoekVulGroep = 500
	// zoekSlotGrens: zo lang wacht het bijhouden in een registratie hooguit op een slot.
	zoekSlotGrens = "200ms"
	// zoekSlotSleutel: eerste sleutel van het advisory lock (tweede: de entiteit-id).
	zoekSlotSleutel = 0x5A4B0000
)

// ZoekAfstemInterval: zo vaak stemt de API de zoektabellen af met de definities. Dat vangt
// een vooruit geregistreerde status en een tweede API-proces.
var ZoekAfstemInterval = time.Minute

// ZoekUitfaseerTijd: zo lang blijft een zoektabel die niet meer gewenst is nog staan en
// bijgehouden. Langer dan ZoekAfstemInterval: een ander API-proces kan hem nog even lezen.
var ZoekUitfaseerTijd = 5 * time.Minute

// zoekBron: de brontabellen en -kolommen van één zoekdefinitie, opgelost uit de MetaRegistry.
type zoekBron struct {
	typenaam  string // de entiteit, bv. Zaak
	rol       string // JSON-rolnaam van de relatie, bv. zaak_zaaktypen
	doelVeld  string // naam van het doel-id-veld in het filter, bv. zaaktype_id
	veldpad   string // <rolnaam GE>.<veld>, bv. zaaklooptijd.startdatum
	entTabel  string
	entID     string
	relTabel  string
	relEnt    string
	relID     string
	relDoel   string
	geTabel   string
	geEnt     string
	geID      string
	dataTabel string // leeg: de waarde staat in de GE-hub zelf
	waardeKol string
}

// zoekTabel: één zoektabel zoals hij in zoektabel_stand staat, met zijn opgeloste bron.
type zoekTabel struct {
	definitieID int64
	naam        string // naam van de zoekdefinitie (voor het log)
	tabel       string
	status      string
	bron        *zoekBron
}

var (
	// zoektabellenAan: de standtabel bestaat; pas dan doet de haak iets.
	zoektabellenAan atomic.Bool
	// leesbareZoektabellen: []*zoekTabel met status gevuld en een nu actieve definitie.
	leesbareZoektabellen atomic.Value
	zoekAfstemMu         sync.Mutex
	zoekVullers          sync.Map // tabel → struct{}: in dit proces loopt het vullen
)

func pgNaam(naam string) string { return `"` + strings.ReplaceAll(naam, `"`, `""`) + `"` }

// losZoekpadOp zoekt de brontabellen bij de twee paden van een zoekdefinitie en controleert de
// voorwaarden van versie 1 (ontwerp §4).
func losZoekpadOp(binnen, sorteerveld string) (*zoekBron, error) {
	b := strings.Split(strings.TrimSpace(binnen), ".")
	s := strings.Split(strings.TrimSpace(sorteerveld), ".")
	if len(b) != 2 {
		return nil, fmt.Errorf("binnen %q: verwacht <Entiteit>.<rolnaam van de relatie>", binnen)
	}
	if len(s) != 3 {
		return nil, fmt.Errorf("sorteerveld %q: verwacht <Entiteit>.<rolnaam van het gegevenselement>.<veld>", sorteerveld)
	}
	if b[0] != s[0] {
		return nil, fmt.Errorf("de relatie (%s) en het sorteerveld (%s) horen niet bij dezelfde entiteit", b[0], s[0])
	}
	meta, ok := model.MetaRegistry.GetTypeMeta(b[0])
	if !ok || meta.Tabelnaam == "" || meta.IDKolom == "" {
		return nil, fmt.Errorf("onbekende entiteit %q", b[0])
	}
	def := filterDefVoor(meta)
	if def == nil {
		return nil, fmt.Errorf("%s heeft geen filterbare velden", b[0])
	}
	rel := def.kinderen[b[1]]
	if rel == nil {
		return nil, fmt.Errorf("%s heeft geen relatie %q", b[0], b[1])
	}
	if rel.hubMeta.Metatype != model.MetatypeRelatie || rel.hubMeta.SecondaireEntiteitIDKolom == "" {
		return nil, fmt.Errorf("%s.%s is geen relatie met een doel", b[0], b[1])
	}
	doelVeld := ""
	for naam, v := range rel.velden {
		if v.kolom == rel.hubMeta.SecondaireEntiteitIDKolom && !v.opData {
			doelVeld = naam
		}
	}
	if doelVeld == "" {
		return nil, fmt.Errorf("%s.%s: de doel-id staat niet in de hub van de relatie", b[0], b[1])
	}
	w := waardeSorteringVoor(meta, []Sortering{{Veldpad: s[1] + "." + s[2]}})
	if w == nil {
		return nil, fmt.Errorf("%s: geen veld van een enkelvoudig, niet-materieel gegevenselement van %s", sorteerveld, b[0])
	}
	bron := &zoekBron{
		typenaam: meta.Typenaam, rol: b[1], doelVeld: doelVeld, veldpad: s[1] + "." + s[2],
		entTabel: meta.Tabelnaam, entID: meta.IDKolom,
		relTabel: rel.hubMeta.Tabelnaam, relEnt: rel.hubMeta.EntiteitIDKolom, relID: rel.hubMeta.IDKolom,
		relDoel: rel.hubMeta.SecondaireEntiteitIDKolom,
		geTabel: w.kind.hubMeta.Tabelnaam, geEnt: w.kind.hubMeta.EntiteitIDKolom, geID: w.kind.hubMeta.IDKolom,
		waardeKol: w.veld.kolom,
	}
	if w.veld.opData {
		bron.dataTabel = w.kind.dataMeta.Tabelnaam
	}
	if bron.relEnt == "" || bron.relID == "" || bron.geEnt == "" || bron.geID == "" {
		return nil, fmt.Errorf("%s / %s: onvolledige metagegevens", binnen, sorteerveld)
	}
	return bron, nil
}

// hash: verandert als de zoektabel een andere inhoud zou krijgen. Staat in de tabelnaam, zodat
// een gewijzigde definitie een nieuwe tabel is en de oude rustig kan uitfaseren.
func (b *zoekBron) hash() string {
	som := sha1.Sum([]byte(strings.Join([]string{b.typenaam, b.rol, b.veldpad, b.entTabel, b.entID,
		b.relTabel, b.relEnt, b.relID, b.relDoel, b.geTabel, b.geEnt, b.geID, b.dataTabel, b.waardeKol}, "|")))
	return hex.EncodeToString(som[:])[:8]
}

// afleidSQL geeft de SELECT die de rijen van de zoektabel afleidt uit de brontabellen, zonder
// beperking op de entiteit. opvoer/afvoer zijn de doorsnede van de vier tijdvakken; GREATEST
// en LEAST slaan NULL over, dus afvoer is NULL als geen van de vier is afgevoerd. Een rij met
// een lege opvoer telt niet mee: zo laat een ongedaan gemaakte opvoer zijn rij achter
// (handleRepresentatieOntOpvoer), en de gewone weg sluit die uit met "opvoer <= moment".
func (b *zoekBron) afleidSQL() string {
	waardeAlias, opvoer, afvoer, dataJoin := "h", "e.opvoer, r.opvoer, h.opvoer", "e.afvoer, r.afvoer, h.afvoer", ""
	opgevoerd := "e.opvoer IS NOT NULL AND r.opvoer IS NOT NULL AND h.opvoer IS NOT NULL"
	if b.dataTabel != "" {
		waardeAlias = "d"
		opvoer += ", d.opvoer"
		afvoer += ", d.afvoer"
		opgevoerd += " AND d.opvoer IS NOT NULL"
		dataJoin = fmt.Sprintf(" JOIN %s AS d ON d.%s = h.%s AND d.%s = h.%s",
			pgNaam(b.dataTabel), pgNaam(b.geEnt), pgNaam(b.geEnt), pgNaam(b.geID), pgNaam(b.geID))
	}
	return fmt.Sprintf(`SELECT r.%s AS doel_id, %s.%s AS waarde, e.%s AS entiteit_id, r.%s AS rel_id,
       GREATEST(%s) AS opvoer, LEAST(%s) AS afvoer
FROM %s AS e
JOIN %s AS r ON r.%s = e.%s
JOIN %s AS h ON h.%s = e.%s%s
WHERE %s.%s IS NOT NULL AND r.%s IS NOT NULL
  AND %s
  AND (LEAST(%s) IS NULL OR LEAST(%s) > GREATEST(%s))`,
		pgNaam(b.relDoel), waardeAlias, pgNaam(b.waardeKol), pgNaam(b.entID), pgNaam(b.relID),
		opvoer, afvoer,
		pgNaam(b.entTabel),
		pgNaam(b.relTabel), pgNaam(b.relEnt), pgNaam(b.entID),
		pgNaam(b.geTabel), pgNaam(b.geEnt), pgNaam(b.entID), dataJoin,
		waardeAlias, pgNaam(b.waardeKol), pgNaam(b.relDoel),
		opgevoerd,
		afvoer, afvoer, opvoer)
}

// herbereken zet de rijen van de gegeven entiteiten opnieuw in de zoektabel: slot per
// entiteit, verwijderen, opnieuw afleiden. Het slot geldt tot het einde van de transactie; wie
// het als tweede krijgt, leidt (READ COMMITTED) af uit de stand na de commit van de eerste.
func (t *zoekTabel) herbereken(ctx context.Context, tx bun.IDB, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	lijst := pgdialect.Array(ids)
	if _, err := tx.ExecContext(ctx,
		`SELECT pg_advisory_xact_lock(?, s.x::int) FROM (SELECT x FROM unnest(?::bigint[]) AS x ORDER BY x) AS s`,
		zoekSlotSleutel|int(t.definitieID&0xFFFF), lijst); err != nil {
		return fmt.Errorf("slot: %w", err)
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM "+pgNaam(t.tabel)+" WHERE entiteit_id = ANY(?::bigint[])", lijst); err != nil {
		return fmt.Errorf("verwijderen: %w", err)
	}
	if _, err := tx.ExecContext(ctx, "INSERT INTO "+pgNaam(t.tabel)+
		" (doel_id, waarde, entiteit_id, rel_id, opvoer, afvoer) "+t.bron.afleidSQL()+
		" AND e."+pgNaam(t.bron.entID)+" = ANY(?::bigint[])", lijst); err != nil {
		return fmt.Errorf("afleiden: %w", err)
	}
	return nil
}

// --- Stand en afstemmen ------------------------------------------------------

type zoekStandRij struct {
	Tabel       string    `bun:"tabel"`
	DefinitieID int64     `bun:"definitie_id"`
	Naam        string    `bun:"naam"`
	Binnen      string    `bun:"binnen"`
	Sorteerveld string    `bun:"sorteerveld"`
	Status      string    `bun:"status"`
	GevuldTotID int64     `bun:"gevuld_tot_id"`
	GewijzigdOp time.Time `bun:"gewijzigd_op"`
}

func leesZoekStand(ctx context.Context, d bun.IDB, statussen ...string) ([]zoekStandRij, error) {
	var rijen []zoekStandRij
	q := "SELECT tabel, definitie_id, naam, binnen, sorteerveld, status, gevuld_tot_id, gewijzigd_op FROM " + zoekStandTabel
	var err error
	if len(statussen) > 0 {
		err = d.NewRaw(q+" WHERE status IN (?) ORDER BY tabel", bun.In(statussen)).Scan(ctx, &rijen)
	} else {
		err = d.NewRaw(q+" ORDER BY tabel").Scan(ctx, &rijen)
	}
	return rijen, err
}

func zetZoekStatus(ctx context.Context, d bun.IDB, tabel, status, melding string) error {
	_, err := d.ExecContext(ctx, "UPDATE "+zoekStandTabel+
		" SET status = ?, melding = NULLIF(?, ''), gewijzigd_op = now() WHERE tabel = ? AND status <> ?",
		status, melding, tabel, status)
	return err
}

// bronCache: de opgeloste bron per tabelnaam (de naam bevat de hash van de bron).
var zoekBronCache sync.Map

func (r zoekStandRij) alsTabel() (*zoekTabel, error) {
	if b, ok := zoekBronCache.Load(r.Tabel); ok {
		return &zoekTabel{definitieID: r.DefinitieID, naam: r.Naam, tabel: r.Tabel, status: r.Status, bron: b.(*zoekBron)}, nil
	}
	bron, err := losZoekpadOp(r.Binnen, r.Sorteerveld)
	if err != nil {
		return nil, err
	}
	zoekBronCache.Store(r.Tabel, bron)
	return &zoekTabel{definitieID: r.DefinitieID, naam: r.Naam, tabel: r.Tabel, status: r.Status, bron: bron}, nil
}

// zoekWens: één zoekdefinitie zoals ze nu in het register staat.
type zoekWens struct {
	id          int64
	naam        string
	binnen      string
	sorteerveld string
	gewenst     bool // nu actief, of later actief (vooruit geregistreerd): de tabel moet bestaan
	leesbaar    bool // nu actief: het lezen mag de tabel gebruiken
}

// laadZoekWensen leest de zoekdefinities. De status is materieel: een definitie die nu actief
// is, is leesbaar; een definitie met een actieve status in de toekomst is al wel gewenst, zodat
// de zoektabel op de ingangsdatum klaar is.
func laadZoekWensen(ctx context.Context, nu time.Time) ([]zoekWens, error) {
	if _, ok := model.MetaRegistry.GetTypeMeta(zoekEntiteit); !ok {
		return nil, nil
	}
	rijen, err := LaadActueleEntiteiten(ctx, zoekEntiteit, nu)
	if err != nil {
		return nil, err
	}
	ent, _ := model.MetaRegistry.GetTypeMeta(zoekEntiteit)
	rol := map[string]string{}
	for _, child := range ent.OnderliggendeGegevenselementen {
		rol[child.Doeltype] = child.JSONRolnaam
	}
	statusMeta, _ := model.MetaRegistry.GetTypeMeta(zoekGEStatus)
	tekst := func(r map[string]interface{}, veld string) string {
		if r == nil || r[veld] == nil {
			return ""
		}
		return strings.TrimSpace(fmt.Sprint(r[veld]))
	}
	var uit []zoekWens
	for _, m := range rijen {
		w := zoekWens{}
		switch id := m[ent.IDKolom].(type) {
		case float64:
			w.id = int64(id)
		case int64:
			w.id = id
		case int:
			w.id = int64(id)
		}
		w.naam = tekst(GeldigeHub(m[rol[zoekGENaam]], zoekGENaam, nu), "naam")
		pad := GeldigeHub(m[rol[zoekGEPad]], zoekGEPad, nu)
		w.binnen, w.sorteerveld = tekst(pad, "binnen"), tekst(pad, "sorteerveld")
		leeft := EntiteitMaterieelGeldig(m, zoekEntiteit, nu)
		if nuStatus := GeldigeHub(m[rol[zoekGEStatus]], zoekGEStatus, nu); leeft && tekst(nuStatus, "status") == zoekStatusActie {
			w.leesbaar, w.gewenst = true, true
		}
		if !w.gewenst {
			// Een actieve status die nog moet ingaan.
			lijst, _ := m[rol[zoekGEStatus]].([]interface{})
			for _, item := range lijst {
				raw, ok := item.(map[string]interface{})
				if !ok {
					continue
				}
				rec := flattenEntityMap(flattenHubData(kopieer(raw)), statusMeta)
				if aanvang := aanvangVan(rec, statusMeta); tekst(rec, "status") == zoekStatusActie && aanvang != nil && aanvang.After(nu) {
					w.gewenst = true
				}
			}
		}
		uit = append(uit, w)
	}
	return uit, nil
}

// StartZoektabellen maakt de standtabel aan, stemt af en blijft dat periodiek doen tot ctx
// stopt. Aanroepen bij de start van de API, na dynql.SetDB en CreateTables.
func StartZoektabellen(ctx context.Context) {
	if db == nil {
		return
	}
	if _, ok := model.MetaRegistry.GetTypeMeta(zoekEntiteit); !ok {
		fmt.Println("zoektabellen uit: het type ZoekDefinitie staat niet in dit register")
		return
	}
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS `+zoekStandTabel+` (
		tabel text PRIMARY KEY,
		definitie_id bigint NOT NULL,
		naam text NOT NULL DEFAULT '',
		binnen text NOT NULL,
		sorteerveld text NOT NULL,
		status text NOT NULL,
		gevuld_tot_id bigint NOT NULL DEFAULT 0,
		gewijzigd_op timestamptz NOT NULL DEFAULT now(),
		melding text)`); err != nil {
		fmt.Println("WARN: zoektabellen uit: standtabel niet aangemaakt:", err)
		return
	}
	zoektabellenAan.Store(true)
	regels, err := StemZoektabellenAf(ctx)
	if err != nil {
		fmt.Println("WARN: zoektabellen afstemmen mislukt:", err)
	}
	fmt.Printf("zoektabellen aan; %d zoektabel(len)\n", len(regels))
	for _, r := range regels {
		fmt.Println("  ", r)
	}
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-time.After(ZoekAfstemInterval):
				if _, err := StemZoektabellenAf(ctx); err != nil {
					fmt.Println("WARN: zoektabellen afstemmen mislukt:", err)
				}
			}
		}
	}()
}

// StemZoektabellenAf brengt de zoektabellen in lijn met de zoekdefinities: aanmaken en vullen
// wat gewenst is, uitfaseren en opruimen wat niet meer gewenst is, en de lijst van leesbare
// zoektabellen verversen. Geeft per zoektabel één regel voor het log.
func StemZoektabellenAf(ctx context.Context) ([]string, error) {
	if !zoektabellenAan.Load() {
		return nil, nil
	}
	zoekAfstemMu.Lock()
	defer zoekAfstemMu.Unlock()

	nu := time.Now()
	wensen, err := laadZoekWensen(ctx, nu)
	if err != nil {
		return nil, err
	}
	stand, err := leesZoekStand(ctx, db)
	if err != nil {
		return nil, err
	}
	perTabel := map[string]zoekStandRij{}
	for _, r := range stand {
		perTabel[r.Tabel] = r
	}

	var regels []string
	gewenst := map[string]zoekWens{}
	for _, w := range wensen {
		if !w.gewenst {
			continue
		}
		bron, err := losZoekpadOp(w.binnen, w.sorteerveld)
		if err != nil {
			regels = append(regels, fmt.Sprintf("zoekdefinitie %d (%s) overgeslagen: %v", w.id, w.naam, err))
			continue
		}
		tabel := fmt.Sprintf("zk_%d_%s", w.id, bron.hash())
		zoekBronCache.Store(tabel, bron)
		gewenst[tabel] = w
		rij, bestaat := perTabel[tabel]
		t := &zoekTabel{definitieID: w.id, naam: w.naam, tabel: tabel, bron: bron}
		switch {
		case !bestaat:
			if err := t.maakAan(ctx, w); err != nil {
				regels = append(regels, fmt.Sprintf("%s (%s): aanmaken mislukt: %v", tabel, w.naam, err))
				continue
			}
			rij = zoekStandRij{Tabel: tabel, Status: zoekVullen}
		case rij.Status == zoekFout || rij.Status == zoekUitfaseren:
			// Opnieuw vullen: na een fout is de inhoud niet te vertrouwen; een tabel die
			// uitfaseerde was mogelijk nooit helemaal gevuld.
			if _, err := db.ExecContext(ctx, "UPDATE "+zoekStandTabel+
				" SET status = ?, gevuld_tot_id = 0, melding = NULL, gewijzigd_op = now() WHERE tabel = ?", zoekVullen, tabel); err != nil {
				return regels, err
			}
			rij.Status, rij.GevuldTotID = zoekVullen, 0
		}
		if rij.Status == zoekVullen {
			t.startVullen(ctx)
		}
		regels = append(regels, fmt.Sprintf("%s (%s): %s binnen %s — %s", tabel, w.naam, w.sorteerveld, w.binnen, rij.Status))
	}

	// Wat niet meer gewenst is: uitfaseren, en na de wachttijd weggooien.
	for _, r := range stand {
		if _, ok := gewenst[r.Tabel]; ok {
			continue
		}
		if r.Status != zoekUitfaseren {
			if err := zetZoekStatus(ctx, db, r.Tabel, zoekUitfaseren, "geen actieve zoekdefinitie meer"); err != nil {
				return regels, err
			}
			regels = append(regels, fmt.Sprintf("%s (%s): uitfaseren", r.Tabel, r.Naam))
			continue
		}
		if nu.Sub(r.GewijzigdOp) < ZoekUitfaseerTijd {
			continue
		}
		if _, err := db.ExecContext(ctx, "DROP TABLE IF EXISTS "+pgNaam(r.Tabel)); err != nil {
			return regels, err
		}
		if _, err := db.ExecContext(ctx, "DELETE FROM "+zoekStandTabel+" WHERE tabel = ?", r.Tabel); err != nil {
			return regels, err
		}
		zoekBronCache.Delete(r.Tabel)
		regels = append(regels, fmt.Sprintf("%s (%s): opgeruimd", r.Tabel, r.Naam))
	}

	return regels, ververseLeesbaar(ctx, gewenst)
}

// ververseLeesbaar zet de lijst die het lezen gebruikt: gevuld, en de definitie is nu actief.
func ververseLeesbaar(ctx context.Context, gewenst map[string]zoekWens) error {
	gevuld, err := leesZoekStand(ctx, db, zoekGevuld)
	if err != nil {
		return err
	}
	var lijst []*zoekTabel
	for _, r := range gevuld {
		if w, ok := gewenst[r.Tabel]; !ok || !w.leesbaar {
			continue
		}
		if t, err := r.alsTabel(); err == nil {
			lijst = append(lijst, t)
		}
	}
	leesbareZoektabellen.Store(lijst)
	return nil
}

// maakAan maakt de zoektabel (kolomtypen volgen uit de brontabellen), zijn indexen en de
// standrij met status "vullen".
func (t *zoekTabel) maakAan(ctx context.Context, w zoekWens) error {
	stappen := []string{
		"CREATE TABLE IF NOT EXISTS " + pgNaam(t.tabel) + " AS " + t.bron.afleidSQL() + " WITH NO DATA",
		"CREATE INDEX IF NOT EXISTS " + pgNaam(t.tabel+"_zoek") + " ON " + pgNaam(t.tabel) + " (doel_id, waarde, entiteit_id)",
		"CREATE INDEX IF NOT EXISTS " + pgNaam(t.tabel+"_ent") + " ON " + pgNaam(t.tabel) + " (entiteit_id)",
	}
	for _, s := range stappen {
		if _, err := db.ExecContext(ctx, s); err != nil {
			return err
		}
	}
	_, err := db.ExecContext(ctx, "INSERT INTO "+zoekStandTabel+
		" (tabel, definitie_id, naam, binnen, sorteerveld, status) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (tabel) DO NOTHING",
		t.tabel, t.definitieID, w.naam, w.binnen, w.sorteerveld, zoekVullen)
	return err
}

// startVullen vult de zoektabel op de achtergrond, in groepen entiteiten op id. Elke groep is
// een eigen transactie met dezelfde stap als het bijhouden. Loopt hooguit één keer per proces.
func (t *zoekTabel) startVullen(ctx context.Context) {
	if _, loopt := zoekVullers.LoadOrStore(t.tabel, struct{}{}); loopt {
		return
	}
	go func() {
		defer zoekVullers.Delete(t.tabel)
		if err := t.vul(ctx); err != nil {
			fmt.Printf("WARN: zoektabel %s vullen mislukt: %v\n", t.tabel, err)
			_ = zetZoekStatus(ctx, db, t.tabel, zoekFout, "vullen: "+err.Error())
			return
		}
		if _, err := StemZoektabellenAf(ctx); err != nil {
			fmt.Println("WARN: zoektabellen afstemmen mislukt:", err)
		}
	}()
}

func (t *zoekTabel) vul(ctx context.Context) error {
	for {
		klaar := false
		err := db.RunInTx(ctx, nil, func(ctx context.Context, tx bun.Tx) error {
			var vanaf int64
			var status string
			if err := tx.NewRaw("SELECT gevuld_tot_id, status FROM "+zoekStandTabel+" WHERE tabel = ?", t.tabel).Scan(ctx, &vanaf, &status); err != nil {
				return err
			}
			if status != zoekVullen {
				klaar = true // ingetrokken of op fout gezet terwijl het vullen liep
				return nil
			}
			var ids []int64
			if err := tx.NewRaw("SELECT "+pgNaam(t.bron.entID)+" FROM "+pgNaam(t.bron.entTabel)+
				" WHERE "+pgNaam(t.bron.entID)+" > ? ORDER BY 1 LIMIT ?", vanaf, zoekVulGroep).Scan(ctx, &ids); err != nil {
				return err
			}
			if len(ids) == 0 {
				klaar = true
				_, err := tx.ExecContext(ctx, "UPDATE "+zoekStandTabel+
					" SET status = ?, gewijzigd_op = now() WHERE tabel = ? AND status = ?", zoekGevuld, t.tabel, zoekVullen)
				return err
			}
			laatste := ids[len(ids)-1]
			for _, id := range ids {
				if id > laatste {
					laatste = id
				}
			}
			if err := t.herbereken(ctx, tx, ids); err != nil {
				return err
			}
			_, err := tx.ExecContext(ctx, "UPDATE "+zoekStandTabel+" SET gevuld_tot_id = ? WHERE tabel = ?", laatste, t.tabel)
			return err
		})
		if err != nil || klaar {
			return err
		}
	}
}

// --- Bijhouden bij een registratie -------------------------------------------

// ZoektabellenBijhouden is de haak vlak voor de commit van een registratie (handlers.VoorCommit,
// gezet door main.go). Voor elke zoektabel die bijgehouden wordt: de entiteiten die deze
// registratie heeft geraakt opnieuw afleiden. Een fout raakt alleen de zoektabel (status
// "fout"), nooit de registratie; de aanroeper zet er bovendien een savepoint omheen.
func ZoektabellenBijhouden(ctx context.Context, tx bun.Tx, registratieID int64, reg model.Registratie) error {
	if !zoektabellenAan.Load() {
		return nil
	}
	stand, err := leesZoekStand(ctx, tx, zoekVullen, zoekGevuld, zoekUitfaseren)
	if err != nil || len(stand) == 0 {
		return err
	}
	// Een ongedaanmaking of correctie raakt de entiteiten van de registratie waar ze naar wijst.
	regs := []int64{registratieID}
	if reg.MaaktOngedaanRegistratieID != nil {
		regs = append(regs, *reg.MaaktOngedaanRegistratieID)
	}
	if reg.CorrigeertRegistratieID != nil {
		regs = append(regs, *reg.CorrigeertRegistratieID)
	}
	geraakt := map[string][]int64{} // per entiteittype, één keer opgehaald
	for _, rij := range stand {
		t, err := rij.alsTabel()
		if err != nil {
			continue // het model past niet meer bij deze tabel; het afstemmen ruimt hem op
		}
		ids, bekend := geraakt[t.bron.typenaam]
		if !bekend {
			if err := tx.NewRaw(`SELECT DISTINCT entiteit_id::bigint FROM wijziging
				WHERE registratie_id IN (?) AND entiteitnaam = ? AND entiteit_id ~ '^[0-9]+$'`,
				bun.In(regs), t.bron.typenaam).Scan(ctx, &ids); err != nil {
				return err
			}
			geraakt[t.bron.typenaam] = ids
		}
		if len(ids) == 0 {
			continue
		}
		if err := t.herberekenVeilig(ctx, tx, ids); err != nil {
			fmt.Printf("WARN: zoektabel %s bijhouden mislukt (registratie %d): %v\n", t.tabel, registratieID, err)
			if err := zetZoekStatus(ctx, tx, t.tabel, zoekFout, "bijhouden: "+err.Error()); err != nil {
				return err
			}
		}
	}
	return nil
}

// herberekenVeilig doet herbereken in een savepoint met een grens op het wachten op een slot.
// Bij een fout is alleen dit stuk teruggedraaid en kan de transactie gewoon verder.
func (t *zoekTabel) herberekenVeilig(ctx context.Context, tx bun.Tx, ids []int64) error {
	if _, err := tx.ExecContext(ctx, "SAVEPOINT zoektabel"); err != nil {
		return err
	}
	err := func() error {
		if _, err := tx.ExecContext(ctx, "SET LOCAL lock_timeout = '"+zoekSlotGrens+"'"); err != nil {
			return err
		}
		return t.herbereken(ctx, tx, append([]int64(nil), ids...))
	}()
	if err != nil {
		// ROLLBACK TO draait ook de SET LOCAL terug.
		if _, rerr := tx.ExecContext(ctx, "ROLLBACK TO SAVEPOINT zoektabel"); rerr != nil {
			return rerr
		}
		return err
	}
	if _, err := tx.ExecContext(ctx, "SET LOCAL lock_timeout = DEFAULT"); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, "RELEASE SAVEPOINT zoektabel")
	return err
}

// NaRegistratieZoekdefinities stemt direct af als een registratie het configuratiedomein
// raakte: een nieuwe, gewijzigde of ingetrokken ZoekDefinitie werkt dan zonder herstart en
// zonder op het interval te wachten. Na de commit, op de achtergrond.
func NaRegistratieZoekdefinities(reg model.Registratie) {
	if !zoektabellenAan.Load() {
		return
	}
	meta, ok := model.MetaRegistry.GetTypeMeta(zoekEntiteit)
	if !ok {
		return
	}
	for _, d := range reg.Domeinen {
		if d == meta.Domein {
			// De regels gaan naar het log: wie een zoekdefinitie registreert, ziet daar of ze
			// is opgepakt of waarom ze is overgeslagen.
			go func() {
				regels, err := StemZoektabellenAf(context.Background())
				if err != nil {
					fmt.Println("WARN: zoektabellen afstemmen mislukt:", err)
				}
				for _, r := range regels {
					fmt.Println("zoektabellen:", r)
				}
			}()
			return
		}
	}
}

// --- Lezen --------------------------------------------------------------------

// zoekGebruik: een lijstvraag die uit een zoektabel beantwoord kan worden.
type zoekGebruik struct {
	tabel *zoekTabel
	doel  interface{}
}

// zoektabelVoor zegt of de lijstvraag past op een leesbare zoektabel (ontwerp §9): het filter
// is precies "de relatie heeft dit ene doel", de sortering is het veld van de zoektabel, en er
// is geen toegangsbeleid actief (mag == nil).
func zoektabelVoor(meta model.TypeMeta, v LijstVraag, w *waardeSortering, mag func(string) bool) *zoekGebruik {
	if w == nil || mag != nil || klassiekLaden {
		return nil
	}
	lijst, _ := leesbareZoektabellen.Load().([]*zoekTabel)
	if len(lijst) == 0 {
		return nil
	}
	filter, ok := v.Filter.(map[string]interface{})
	if !ok || len(filter) != 1 || len(v.Sortering) != 1 {
		return nil
	}
	for _, t := range lijst {
		if t.bron.typenaam != meta.Typenaam || t.bron.veldpad != v.Sortering[0].Veldpad {
			continue
		}
		rel, ok := filter[t.bron.rol].(map[string]interface{})
		if !ok || len(rel) != 1 {
			continue
		}
		ops, ok := rel[t.bron.doelVeld].(map[string]interface{})
		if !ok || len(ops) != 1 || ops["eq"] == nil {
			continue
		}
		return &zoekGebruik{tabel: t, doel: ops["eq"]}
	}
	return nil
}

// zoekLezingen telt de lijstvragen die uit een zoektabel zijn beantwoord (tests, diagnose).
var zoekLezingen atomic.Int64

// ZoektabelLezingen: het aantal lijstvragen dat sinds de start uit een zoektabel is beantwoord.
func ZoektabelLezingen() int64 { return zoekLezingen.Load() }

// actiefOp: de leesregel van elke tabel, op de zoektabel.
const zoekActiefOp = "doel_id = ? AND opvoer <= ? AND (afvoer IS NULL OR afvoer > ?)"

// ids geeft de entiteit-id's van één pagina uit de zoektabel. DISTINCT: twee voorkomens van de
// relatie naar hetzelfde doel geven twee rijen voor dezelfde entiteit; de index levert
// (waarde, entiteit_id) al gesorteerd, dus PostgreSQL ontdubbelt lopend en stopt na de pagina.
func (g *zoekGebruik) ids(ctx context.Context, moment time.Time, aflopend bool, limit, offset int) ([]int64, error) {
	richting := "ASC"
	if aflopend {
		richting = "DESC"
	}
	var rijen []struct {
		EntiteitID int64 `bun:"entiteit_id"`
	}
	zoekLezingen.Add(1)
	err := db.NewRaw("SELECT entiteit_id FROM (SELECT DISTINCT waarde, entiteit_id FROM "+pgNaam(g.tabel.tabel)+
		" WHERE "+zoekActiefOp+" ORDER BY waarde "+richting+", entiteit_id "+richting+" LIMIT ? OFFSET ?) AS p"+
		" ORDER BY waarde "+richting+", entiteit_id "+richting,
		g.doel, moment, moment, limit, offset).Scan(ctx, &rijen)
	if err != nil {
		return nil, err
	}
	ids := make([]int64, len(rijen))
	for i, r := range rijen {
		ids[i] = r.EntiteitID
	}
	return ids, nil
}

// aantal: het aantal entiteiten met een waarde binnen het doel (voor de offset van deel 2).
func (g *zoekGebruik) aantal(ctx context.Context, moment time.Time) (int, error) {
	var n int
	err := db.NewRaw("SELECT count(*) FROM (SELECT DISTINCT waarde, entiteit_id FROM "+pgNaam(g.tabel.tabel)+
		" WHERE "+zoekActiefOp+") AS p", g.doel, moment, moment).Scan(ctx, &n)
	return n, err
}
