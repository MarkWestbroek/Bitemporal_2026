package routes

import (
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v05/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v05/model"
	"github.com/gin-gonic/gin"
)

/*
Add functional REST routes to the provided router,
including routes for entities, relations and data elements,
as well as bitemporal registration, correction and undoing routes.
*/
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
