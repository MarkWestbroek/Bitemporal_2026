package routes

import (
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

/*
Add functional REST routes to the provided router,
including routes for entities, relations and data elements,
as well as bitemporal registration, correction and undoing routes.
*/
// corsMiddleware voegt CORS-headers toe aan elke response.
// Bij een preflight OPTIONS-request worden de extra Allow-headers
// teruggegeven en wordt de keten afgebroken met 204 No Content.
func corsMiddleware() gin.HandlerFunc {
	allowedOrigins := map[string]struct{}{
		"http://test1.pleio.local:8000": {},
		// Lokale frontend dev-servers (Vite)
		"http://localhost:5173": {},
		"http://localhost:5174": {},
		"http://localhost:5175": {},
		"http://127.0.0.1:5173": {},
		"http://127.0.0.1:5174": {},
		"http://127.0.0.1:5175": {},
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := allowedOrigins[origin]; ok {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
		}

		if c.Request.Method == http.MethodOptions {
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func SetupMiddleware(router *gin.Engine) {
	// CORS middleware moet vroeg worden geregistreerd, zodat alle routes
	// (ook routes die buiten AddRoutes worden toegevoegd) CORS-headers krijgen.
	router.Use(corsMiddleware())

	// Request body logger — logt POST/PUT/PATCH bodies als APP_DEBUG_LOGS=1.
	// Moet vóór handler-registratie staan, zodat de body wordt opgevangen
	// voordat ShouldBindJSON het consumeert.
	router.Use(handlers.RequestBodyLogger())

	// Preflight-handler: vangt OPTIONS /*path op zodat Gin het request
	// doorgeeft aan de middleware hierboven (en niet met 405 afwijst).
	router.OPTIONS("/*path", func(c *gin.Context) {})
}

func AddRoutes(router *gin.Engine) {

	//Add Tests routes to router
	router.GET("/tests", handlers.GetTests)
	router.GET("/tests/:id", handlers.GetTest)
	router.DELETE("/tests/:id", handlers.RemoveTest)
	router.POST("/tests", handlers.AddTest)
	router.PUT("/tests/:id", handlers.UpdateTest)

	//Add Entities routes to router (via metamap)
	addMetaRegistryRoutes(router)

	// Full entity routes (via metamap)
	addMetaRegistryFullRoutes(router)

	// Referentielijst routes (/referentielijsten/...)
	addReferentielijstRoutes(router)

	// Registratie routes (dedicated, want plumbing,maar gebruikt een generieke handler)
	router.GET("/registraties", handlers.MakeGetEntitiesHandler[model.Registratie]("Registraties"))
	router.GET("/registraties/:id", handlers.MakeGetEntityHandler[model.Registratie]("Registratie"))
	router.POST("/registraties", handlers.MakeAddEntityHandler[model.Registratie]("Registratie"))
	router.PATCH("/registraties/:id", handlers.PatchRegistratie())

	// Wijziging routes (idem dedicated, generieke handler)
	router.GET("/wijzigingen", handlers.MakeGetEntitiesHandler[model.Wijziging]("Wijzigingen"))
	router.GET("/wijzigingen/:id", handlers.MakeGetEntityHandler[model.Wijziging]("Wijziging"))
	router.POST("/wijzigingen", handlers.MakeAddEntityHandler[model.Wijziging]("Wijziging"))

	// Get registratie met onderliggende wijzigingen (geen generieke handler gebruikt,
	// omdat dit een specifiek afhandeling vroeg, en bovendien toch plumbing is)
	router.GET("/full/registraties", handlers.MakeGetRegistratiesMetWijzigingenHandler())
	router.GET("/full/registraties/:id", handlers.MakeGetRegistratieMetWijzigingenByIDHandler())

	/*
		=== BELANGRIJKSTE BITEMPORELE REGISTRATIE ENDPOINT ===

		REGISTRATIE, CORRECTIE EN ONGEDAANMAKING ROUTES

		Dit gaat allemaal via /registratie/ en de payload in de de body.

		Zie voorbeelden in de readme.
	*/
	router.POST("/registratie/", handlers.RegistreerMetNieuweAanpak())

	/* IDEE
	Idee voor een generieke registratie/correctie/ongedaanmaking route,
	waarbij het entiteittype en de te corrigeren gegevenselementen in de URL worden meegegeven.
	De body bevat dan de volledige nieuwe versie van de entiteit,
	inclusief alle gegevenselementen.
	De handler haalt de bestaande versie van de entiteit op,
	vergelijkt deze met de nieuwe versie,
	bepaalt welke gegevenselementen zijn gewijzigd
	en maakt op basis daarvan de juiste Registratie en Wijziging records aan.
	Deze aanpak vereist wel dat we in de handler kunnen bepalen
	welke gegevenselementen bij welk entiteittype horen,
	bijvoorbeeld door middel van een map of door gebruik te maken van reflectie.
	*/
	//router.POST("/registreer/:entity", handlers.RegisterEntity)
	//router.POST("/corrigeer/:entity/:id", handlers.CorrectEntity)
	//router.POST("/maakongedaan/:entity/:id", handlers.UndoEntity)
}
