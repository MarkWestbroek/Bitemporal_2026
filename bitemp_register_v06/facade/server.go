package facade

// server.go — de HTTP-kant van de façade (technisch ontwerp fase 1 §4).
//
// Fase 1 is alleen lezen op de registers:
//   - GraphQL (/graphql/query, ook op naam met documentId) zonder mutaties: de zaaktypen komen
//     via de ApiLader uit het register; configuratie (QueryDefinitie) uit de eigen database;
//   - REST /full/<padnaam>/:id en /full/<padnaam>: intern een GraphQL-aanroep met een selectie
//     die uit het schema volgt, zodat er één leespad is;
//   - POST /registratie alleen voor het configuratiedomein (QueryDefinities beheren). Een
//     registratie die een ander type raakt, krijgt 501: registreren in een register is fase 2,
//     en de lege lokale tabellen van de zaaktypen mogen nooit gevuld worden.

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/dynql"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/routes"
	"github.com/gin-gonic/gin"
	"github.com/graphql-go/graphql"
	"github.com/uptrace/bun"
)

// LokaalDomein is het enige domein dat de façade zelf registreert (QueryDefinitie e.d.).
const LokaalDomein = "configuratie"

// Config is wat de façade nodig heeft om te starten.
type Config struct {
	DB      *bun.DB // de eigen database: configuratie, plumbing, facade_id
	Binding *Binding
	IDs     IDMap
	HTTP    *http.Client // optioneel; voor tests of een eigen transport
	Versie  string
}

// Server is een gestarte façade: router, schema en lader.
type Server struct {
	Router *gin.Engine
	Schema *graphql.Schema
	Lader  *ApiLader
}

// NieuweServer bouwt lader, schema en routes. Aanroepen na dbsetup.CreateTables.
func NieuweServer(cfg Config) (*Server, error) {
	clients := map[string]*Client{}
	for naam, rc := range cfg.Binding.Registers {
		clients[naam] = NieuweClient(naam, rc, cfg.HTTP)
	}
	lader, err := NieuweApiLader(cfg.Binding, cfg.IDs, clients)
	if err != nil {
		return nil, err
	}
	handlers.DB = cfg.DB
	dynql.ZetLaders(lader.Laders())
	dynql.ZetExtraVelden(lader.ExtraVelden())
	schema, err := dynql.BuildSchema(cfg.DB)
	if err != nil {
		return nil, fmt.Errorf("GraphQL-schema bouwen: %w", err)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	routes.SetupMiddleware(r)
	editor := middleware.RequireRol("editor")
	// Fase 1: alleen lezen. De guard schrijft zelf het antwoord (zoals ControleerRol dat doet
	// met 401/403); de GraphQL-handler stopt daarna zonder iets uit te voeren.
	geenMutaties := func(c *gin.Context) bool {
		c.JSON(http.StatusNotImplemented, gin.H{"errors": []gin.H{{
			"message":    "de façade voert in fase 1 geen mutaties uit; registreren in het register volgt in fase 2",
			"extensions": gin.H{"code": "niet_ondersteund_door_register"},
		}}})
		return false
	}
	magIntern := func(c *gin.Context) bool { return middleware.ControleerRol(c, "viewer") }

	r.GET("/graphql/playground", dynql.PlaygroundHandler("/graphql/query"))
	r.POST("/graphql/query", dynql.GraphQLHandler(schema, geenMutaties, magIntern, middleware.MagLezen))
	r.GET("/graphql/query", dynql.GraphQLHandler(schema, geenMutaties, magIntern, middleware.MagLezen))
	r.POST("/graphql/valideer", dynql.ValideerDocumentHandler(schema))

	full := &fullREST{schema: schema, selecties: map[string]string{}}
	r.GET("/full/:padnaam", middleware.RequireLezer(), full.lijst)
	r.GET("/full/:padnaam/:id", middleware.RequireLezer(), full.een)

	r.POST("/registratie", editor, lokaleRegistratie())
	r.POST("/registratie/*rest", editor, lokaleRegistratie())

	r.GET("/version", func(c *gin.Context) { c.JSON(200, gin.H{"facade": cfg.Versie}) })
	r.GET("/health", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if cfg.DB == nil || cfg.DB.PingContext(ctx) != nil {
			c.JSON(503, gin.H{"status": "fout", "database": "onbereikbaar"})
			return
		}
		c.JSON(200, gin.H{"status": "ok", "database": "ok"})
	})
	r.GET("/facade/registers", func(c *gin.Context) {
		// Welke typen uit welk register komen, en het aantal verzoeken per register (meting §8).
		uit := gin.H{}
		for naam, cl := range clients {
			typen := []string{}
			for t, tb := range cfg.Binding.Typen {
				if tb.Register == naam {
					typen = append(typen, t)
				}
			}
			sort.Strings(typen)
			uit[naam] = gin.H{"soort": cfg.Binding.Registers[naam].Soort, "typen": typen, "verzoeken": cl.Calls()}
		}
		c.JSON(200, uit)
	})
	return &Server{Router: r, Schema: schema, Lader: lader}, nil
}

// --- REST /full via GraphQL ---

type fullREST struct {
	schema    *graphql.Schema
	mu        sync.Mutex
	selecties map[string]string
}

// selectie bouwt (en onthoudt) de selectie van een full-veld: alle scalaire velden, de geneste
// GE's en relaties en het doel van een relatie, drie niveaus diep. Omgekeerde relaties
// (gerelateerde_*) blijven weg: die kosten per item extra verzoeken aan het register.
func (f *fullREST) selectie(veld string) (string, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if s, ok := f.selecties[veld]; ok {
		return s, s != ""
	}
	def, ok := f.schema.QueryType().Fields()[veld]
	s := ""
	if ok {
		if obj, ok := kernObject(def.Type); ok {
			s = selectieVan(obj, 3)
		}
	}
	f.selecties[veld] = s
	return s, s != ""
}

func kernObject(t graphql.Type) (*graphql.Object, bool) {
	for {
		switch x := t.(type) {
		case *graphql.NonNull:
			t = x.OfType
		case *graphql.List:
			t = x.OfType
		case *graphql.Object:
			return x, true
		default:
			return nil, false
		}
	}
}

func selectieVan(obj *graphql.Object, diepte int) string {
	var delen []string
	for naam, def := range obj.Fields() {
		if strings.HasPrefix(naam, "gerelateerde_") {
			continue
		}
		verplicht := false
		for _, a := range def.Args {
			if _, ok := a.Type.(*graphql.NonNull); ok {
				verplicht = true
			}
		}
		if verplicht {
			continue
		}
		if sub, ok := kernObject(def.Type); ok {
			if diepte > 1 {
				if s := selectieVan(sub, diepte-1); s != "" {
					delen = append(delen, naam+" "+s)
				}
			}
			continue
		}
		delen = append(delen, naam)
	}
	if len(delen) == 0 {
		return ""
	}
	sort.Strings(delen)
	return "{ " + strings.Join(delen, " ") + " }"
}

// tijdArgs neemt peiltijdstip, t en geldigOp over uit de query-string.
func tijdArgs(c *gin.Context) (string, error) {
	var args []string
	if p := c.Query("peiltijdstip"); p != "" {
		if _, err := time.Parse(time.RFC3339, p); err != nil {
			return "", fmt.Errorf("peiltijdstip is geen RFC 3339-tijdstip")
		}
		args = append(args, "peiltijdstip: "+strconv.Quote(p))
	}
	if t := c.Query("t"); t != "" {
		n, err := strconv.Atoi(t)
		if err != nil {
			return "", fmt.Errorf("t is geen geheel getal")
		}
		args = append(args, "t: "+strconv.Itoa(n))
	}
	if g := c.Query("geldigOp"); g != "" {
		args = append(args, "geldigOp: "+strconv.Quote(g))
	}
	return strings.Join(args, ", "), nil
}

func (f *fullREST) voerUit(c *gin.Context, veld, args string) {
	sel, ok := f.selectie(veld)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "onbekend type: " + c.Param("padnaam")})
		return
	}
	if args != "" {
		args = "(" + args + ")"
	}
	res := graphql.Do(graphql.Params{Schema: *f.schema, RequestString: "{ r: " + veld + args + " " + sel + " }", Context: c.Request.Context()})
	if len(res.Errors) > 0 {
		status := http.StatusBadGateway
		for _, e := range res.Errors {
			if e.Extensions != nil && e.Extensions["code"] == "niet_ondersteund_door_register" {
				status = http.StatusNotImplemented
			}
		}
		c.JSON(status, gin.H{"error": res.Errors[0].Message, "errors": res.Errors})
		return
	}
	data, _ := res.Data.(map[string]any)
	if data["r"] == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "niet gevonden"})
		return
	}
	c.JSON(http.StatusOK, data["r"])
}

func (f *fullREST) een(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id is geen geheel getal"})
		return
	}
	args, err := tijdArgs(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if args != "" {
		args = ", " + args
	}
	f.voerUit(c, "full_"+c.Param("padnaam"), "id: "+strconv.Itoa(id)+args)
}

func (f *fullREST) lijst(c *gin.Context) {
	limit, offset := 20, 0
	if v, err := strconv.Atoi(c.DefaultQuery("limit", "20")); err == nil {
		limit = v
	}
	if v, err := strconv.Atoi(c.DefaultQuery("offset", "0")); err == nil {
		offset = v
	}
	args, err := tijdArgs(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	alle := fmt.Sprintf("limit: %d, offset: %d", limit, offset)
	if args != "" {
		alle += ", " + args
	}
	f.voerUit(c, "full_"+c.Param("padnaam")+"_list", alle)
}

// --- registreren: alleen het eigen configuratiedomein ---

var (
	veldnaamDomeinEens sync.Once
	veldnaamDomein     map[string]string
)

// domeinVanVeldnaam zoekt het domein van een type op zijn veldnaam in een registratieverzoek.
func domeinVanVeldnaam(veldnaam string) (string, bool) {
	veldnaamDomeinEens.Do(func() {
		veldnaamDomein = map[string]string{}
		for _, m := range model.MetaRegistry {
			if m.Veldnaam != "" {
				veldnaamDomein[m.Veldnaam] = m.Domein
			}
		}
	})
	d, ok := veldnaamDomein[veldnaam]
	return d, ok
}

// geraakteDomeinen leest uit een registratieverzoek welke domeinen het raakt.
func geraakteDomeinen(body []byte) (map[string]bool, error) {
	var req struct {
		Wijzigingen []map[string]map[string]json.RawMessage `json:"wijzigingen"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		return nil, fmt.Errorf("registratie is geen geldige JSON: %v", err)
	}
	uit := map[string]bool{}
	for _, w := range req.Wijzigingen {
		for _, kant := range w { // opvoer / afvoer
			for veldnaam := range kant {
				d, ok := domeinVanVeldnaam(veldnaam)
				if !ok {
					d = "?" + veldnaam
				}
				uit[d] = true
			}
		}
	}
	return uit, nil
}

func lokaleRegistratie() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, err := io.ReadAll(io.LimitReader(c.Request.Body, 20<<20))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "body lezen mislukt"})
			return
		}
		domeinen, err := geraakteDomeinen(body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		for d := range domeinen {
			if d != LokaalDomein {
				c.JSON(http.StatusNotImplemented, gin.H{
					"error":  "niet_ondersteund_door_register",
					"detail": fmt.Sprintf("de façade registreert in fase 1 alleen het domein %s; deze registratie raakt %s", LokaalDomein, strings.TrimPrefix(d, "?")),
				})
				return
			}
		}
		res, rerr := handlers.RegistreerJSONCore(c.Request.Context(), body, "", handlers.AuditMeta{
			RawBody: body, RequestPath: c.Request.URL.Path, RequestMethod: c.Request.Method,
		})
		if rerr != nil {
			if rerr.Problem != nil {
				c.Header("Content-Type", "application/problem+json")
				c.JSON(rerr.Status, rerr.Problem)
				return
			}
			c.JSON(rerr.Status, gin.H{"error": rerr.Msg})
			return
		}
		c.JSON(res.Status, gin.H{"message": res.Message, "registratie_id": res.RegistratieID, "tijdstip": res.Tijdstip, "wijzigingen": res.Wijzigingen})
	}
}
