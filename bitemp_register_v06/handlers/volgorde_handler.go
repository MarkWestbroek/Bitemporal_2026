package handlers

// volgorde_handler.go — GET /api/volgorde/:padnaam: entiteiten in afhankelijkheidsvolgorde.
//
// Generiek (MetaRegistry-gedreven, geen domeinkennis), gemaakt voor de uitrol van e-diensten
// (Omnium op Fundament, 23-10-2026): "alle artefacten van e-dienstversie X, de vereiste eerst".
//
//	GET /api/volgorde/artefacten?via=artefactedienstversie&doel=12&na=artefactafhankelijkheid
//
//   - padnaam: de entiteit (bv. artefacten);
//   - via + doel: alleen de entiteiten die via relatie `via` naar entiteit `doel` wijzen;
//     zonder via/doel: alle entiteiten van het type;
//   - na: een zelf-relatie (A → A) die "A hangt af van B" uitdrukt; B komt vóór A. Zonder na:
//     volgorde op id.
//
// Relaties noem je met hun rolnaam, JSON-rolnaam of klassenaam (zoals in afleidingsregels).
// Alles op één formeel peilmoment: ?t= / ?peiltijdstip=, anders nu. Antwoord: de entiteiten in
// /full-vorm in volgorde, plus `volgorde` (id's) en `externeAfhankelijkheden` (afhankelijkheden
// naar entiteiten buiten de selectie). Een cyclus geeft 409 met de betrokken id's.

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

// ExterneAfhankelijkheid: een entiteit in de selectie hangt af van een entiteit erbuiten.
type ExterneAfhankelijkheid struct {
	ID             int `json:"id"`
	AfhankelijkVan int `json:"afhankelijkVan"`
}

// TopologischeVolgorde ordent ids zo dat elk id na zijn afhankelijkheden komt (Kahn; bij
// gelijke stand het laagste id eerst, dus deterministisch). afhankelijkVan[a] = de ids waar a
// van afhangt; ids buiten de selectie tellen niet mee. Bij een cyclus: de ids in of achter de
// cyclus als tweede resultaat, en geen volgorde.
func TopologischeVolgorde(ids []int, afhankelijkVan map[int][]int) (volgorde []int, cyclus []int) {
	in := map[int]bool{}
	for _, id := range ids {
		in[id] = true
	}
	aantalVoor := map[int]int{}    // aantal nog niet geplaatste afhankelijkheden
	dependenten := map[int][]int{} // b → de a's die van b afhangen
	for _, a := range ids {
		gezien := map[int]bool{}
		for _, b := range afhankelijkVan[a] {
			if !in[b] || b == a || gezien[b] {
				continue
			}
			gezien[b] = true
			aantalVoor[a]++
			dependenten[b] = append(dependenten[b], a)
		}
	}
	var klaar []int
	for _, id := range ids {
		if aantalVoor[id] == 0 {
			klaar = append(klaar, id)
		}
	}
	sort.Ints(klaar)
	for len(klaar) > 0 {
		id := klaar[0]
		klaar = klaar[1:]
		volgorde = append(volgorde, id)
		for _, d := range dependenten[id] {
			aantalVoor[d]--
			if aantalVoor[d] == 0 {
				klaar = append(klaar, d)
				sort.Ints(klaar)
			}
		}
	}
	if len(volgorde) < len(in) {
		for _, id := range ids {
			if aantalVoor[id] > 0 {
				cyclus = append(cyclus, id)
			}
		}
		sort.Ints(cyclus)
		return nil, cyclus
	}
	return volgorde, nil
}

// entiteitMetaOpPadnaam zoekt de entiteit met deze padnaam (of veldnaam/typenaam).
func entiteitMetaOpPadnaam(padnaam string) (model.TypeMeta, bool) {
	for _, m := range model.MetaRegistry {
		if m.Metatype != model.MetatypeEntiteit {
			continue
		}
		if strings.EqualFold(m.Padnaam, padnaam) || strings.EqualFold(m.Veldnaam, padnaam) || strings.EqualFold(m.Typenaam, padnaam) {
			return m, true
		}
	}
	return model.TypeMeta{}, false
}

// relatieOpRol zoekt een relatie onder een entiteit op rolnaam, JSON-rolnaam of klassenaam.
func relatieOpRol(meta model.TypeMeta, rol string) (model.OnderliggendGegevenselement, model.TypeMeta, bool) {
	for _, child := range meta.OnderliggendeGegevenselementen {
		if !model.PadSegmentMatcht(child, rol) && !strings.EqualFold(child.Doeltype, rol) {
			continue
		}
		cm, ok := model.MetaRegistry.GetTypeMeta(child.Doeltype)
		if ok && cm.Metatype == model.MetatypeRelatie && cm.SecondaireEntiteitIDKolom != "" {
			return child, cm, true
		}
	}
	return model.OnderliggendGegevenselement{}, model.TypeMeta{}, false
}

// idsViaRelatie geeft de id's van de eigenaren van relatie relMeta die op het peilmoment naar
// doelID wijzen.
func idsViaRelatie(ctx context.Context, relMeta model.TypeMeta, doelID int, peil time.Time) ([]int, error) {
	rijen := relMeta.DBSliceFactory()
	q := applyFormeleTijdFilterVoorModel(DB.NewSelect().Model(rijen), relMeta.Typenaam, peil)
	if err := q.Where("?TableAlias."+relMeta.SecondaireEntiteitIDKolom+" = ?", doelID).Scan(verzoekContext(ctx)); err != nil && !isNoRows(err) {
		return nil, err
	}
	b, err := json.Marshal(rijen)
	if err != nil {
		return nil, err
	}
	var lijst []map[string]any
	if err := json.Unmarshal(b, &lijst); err != nil {
		return nil, err
	}
	gezien := map[int]bool{}
	var ids []int
	for _, m := range lijst {
		if id, ok := m[relMeta.EntiteitIDKolom].(float64); ok && !gezien[int(id)] {
			gezien[int(id)] = true
			ids = append(ids, int(id))
		}
	}
	sort.Ints(ids)
	return ids, nil
}

// alleIDs geeft alle id's van een entiteittype die op het peilmoment bestaan.
func alleIDs(ctx context.Context, meta model.TypeMeta, peil time.Time) ([]int, error) {
	ents := meta.SliceFactory()
	q := applyFormeleTijdFilterVoorModel(DB.NewSelect().Model(ents), meta.Typenaam, peil)
	if err := q.Scan(verzoekContext(ctx)); err != nil && !isNoRows(err) {
		return nil, err
	}
	maps, err := mapsPerID(ents, meta)
	if err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(maps))
	for id := range maps {
		ids = append(ids, id)
	}
	sort.Ints(ids)
	return ids, nil
}

func volgordeFout(c *gin.Context, status int, soort, detail string, extra gin.H) {
	body := gin.H{"type": "urn:omnium:volgorde:" + soort, "title": "Volgorde niet te bepalen", "status": status, "detail": detail}
	for k, v := range extra {
		body[k] = v
	}
	c.Header("Content-Type", "application/problem+json")
	c.JSON(status, body)
}

// MaakVolgordeHandler: GET /api/volgorde/:padnaam (zie de bestandsdocumentatie).
func MaakVolgordeHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		meta, ok := entiteitMetaOpPadnaam(c.Param("padnaam"))
		if !ok || meta.SliceFactory == nil {
			volgordeFout(c, http.StatusNotFound, "niet-gevonden", "onbekende entiteit: "+c.Param("padnaam"), nil)
			return
		}
		peil, _ := effectiefPeil(c)
		ctx := c.Request.Context()

		var ids []int
		var err error
		via, doelTekst := strings.TrimSpace(c.Query("via")), strings.TrimSpace(c.Query("doel"))
		switch {
		case via != "" && doelTekst != "":
			doelID, convErr := strconv.Atoi(doelTekst)
			if convErr != nil {
				volgordeFout(c, http.StatusBadRequest, "ongeldige-parameter", "doel moet een id (geheel getal) zijn", nil)
				return
			}
			_, relMeta, ok := relatieOpRol(meta, via)
			if !ok {
				volgordeFout(c, http.StatusBadRequest, "ongeldige-parameter", fmt.Sprintf("%s heeft geen relatie %q", meta.Typenaam, via), nil)
				return
			}
			ids, err = idsViaRelatie(ctx, relMeta, doelID, peil)
		case via == "" && doelTekst == "":
			ids, err = alleIDs(ctx, meta, peil)
		default:
			volgordeFout(c, http.StatusBadRequest, "ongeldige-parameter", "geef via én doel samen op, of geen van beide", nil)
			return
		}
		if err != nil {
			interneFout(c, "kon de selectie niet ophalen", err)
			return
		}

		maps, err := LaadVolledigeEntiteiten(ctx, peil, meta.Typenaam, ids)
		if err != nil {
			interneFout(c, "kon de entiteiten niet laden", err)
			return
		}

		afhankelijkVan := map[int][]int{}
		var extern []ExterneAfhankelijkheid
		if na := strings.TrimSpace(c.Query("na")); na != "" {
			child, relMeta, ok := relatieOpRol(meta, na)
			if !ok || model.DoelTypenaamVanRelatie(relMeta) != meta.Typenaam {
				volgordeFout(c, http.StatusBadRequest, "ongeldige-parameter", fmt.Sprintf("%q is geen zelf-relatie van %s", na, meta.Typenaam), nil)
				return
			}
			sleutel := jsonNaamVoorBunKolom(relMeta, relMeta.SecondaireEntiteitIDKolom)
			for _, id := range ids {
				items, _ := maps[id][child.JSONRolnaam].([]any)
				for _, it := range items {
					m, _ := it.(map[string]any)
					b, ok := m[sleutel].(float64)
					if !ok || m["afvoer"] != nil {
						continue
					}
					if _, binnen := maps[int(b)]; binnen {
						afhankelijkVan[id] = append(afhankelijkVan[id], int(b))
					} else {
						extern = append(extern, ExterneAfhankelijkheid{ID: id, AfhankelijkVan: int(b)})
					}
				}
			}
		}

		volgorde, cyclus := TopologischeVolgorde(ids, afhankelijkVan)
		if cyclus != nil {
			volgordeFout(c, http.StatusConflict, "cyclus", "de afhankelijkheden bevatten een cyclus", gin.H{"ids": cyclus})
			return
		}
		lijst := make([]map[string]any, 0, len(volgorde))
		for _, id := range volgorde {
			if m, ok := maps[id]; ok {
				lijst = append(lijst, m)
			}
		}
		verrijkt, _ := verrijkResponseMetWeergavenamen(c, lijst, meta)
		if extern == nil {
			extern = []ExterneAfhankelijkheid{}
		}
		c.JSON(http.StatusOK, gin.H{
			"volgorde":                volgorde,
			meta.Meervoud:             verrijkt,
			"externeAfhankelijkheden": extern,
			"peiltijdstip":            peil.UTC().Format(time.RFC3339Nano),
		})
	}
}
