package routes

import (
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v03/model"
	"github.com/gin-gonic/gin"
)

/*
Add functional REST routes to the provided router,
including routes for entities, relations and data elements,
as well as bitemporal registration, correction and undoing routes.
*/
func AddRoutes(router *gin.Engine) {
	//add Tasks routes to router
	router.GET("/tasks", handlers.GetTasks)
	router.GET("/tasks/:id", handlers.GetTask)
	router.DELETE("/tasks/:id", handlers.RemoveTask)
	router.POST("/tasks", handlers.AddTask)
	router.PUT("/tasks/:id", handlers.UpdateTask)

	//Add Tests routes to router
	router.GET("/tests", handlers.GetTests)
	router.GET("/tests/:id", handlers.GetTest)
	router.DELETE("/tests/:id", handlers.RemoveTest)
	router.POST("/tests", handlers.AddTest)
	router.PUT("/tests/:id", handlers.UpdateTest)

	//Add Entities routes to router
	router.GET("/as", handlers.MakeGetEntitiesHandler[model.A]("As"))
	router.GET("/as/:id", handlers.MakeGetEntityHandler[model.A]("A"))
	router.POST("/as", handlers.MakeAddEntityHandler[model.A]("A"))

	router.GET("/bs", handlers.MakeGetEntitiesHandler[model.B]("Bs"))
	router.GET("/bs/:id", handlers.MakeGetEntityHandler[model.B]("B"))
	router.POST("/bs", handlers.MakeAddEntityHandler[model.B]("B"))

	// add relation routes
	router.GET("/rel_a_bs", handlers.MakeGetEntitiesHandler[model.Rel_A_B]("Rel_A_Bs"))
	router.GET("/rel_a_bs/:id", handlers.MakeGetEntityHandler[model.Rel_A_B]("Rel_A_B"))
	router.POST("/rel_a_bs", handlers.MakeAddEntityHandler[model.Rel_A_B]("Rel_A_B"))

	// add data element routes
	router.GET("/a_us", handlers.MakeGetEntitiesHandler[model.A_U]("A_Us"))
	router.GET("/a_us/:id", handlers.MakeGetEntityHandler[model.A_U]("A_U"))
	router.POST("/a_us", handlers.MakeAddEntityHandler[model.A_U]("A_U"))

	router.GET("/a_vs", handlers.MakeGetEntitiesHandler[model.A_V]("A_Vs"))
	router.GET("/a_vs/:id", handlers.MakeGetEntityHandler[model.A_V]("A_V"))
	router.POST("/a_vs", handlers.MakeAddEntityHandler[model.A_V]("A_V"))

	router.GET("/b_xs", handlers.MakeGetEntitiesHandler[model.B_X]("B_Xs"))
	router.GET("/b_xs/:id", handlers.MakeGetEntityHandler[model.B_X]("B_X"))
	router.POST("/b_xs", handlers.MakeAddEntityHandler[model.B_X]("B_X"))

	// Registratie routes
	router.GET("/registraties", handlers.MakeGetEntitiesHandler[model.Registratie]("Registraties"))
	router.GET("/registraties/:id", handlers.MakeGetEntityHandler[model.Registratie]("Registratie"))
	router.POST("/registraties", handlers.MakeAddEntityHandler[model.Registratie]("Registratie"))

	// Wijziging routes
	router.GET("/wijzigingen", handlers.MakeGetEntitiesHandler[model.Wijziging]("Wijzigingen"))
	router.GET("/wijzigingen/:id", handlers.MakeGetEntityHandler[model.Wijziging]("Wijziging"))
	router.POST("/wijzigingen", handlers.MakeAddEntityHandler[model.Wijziging]("Wijziging"))

	// Full entity routes
	router.GET("/full/as", handlers.MakeGetFullEntitiesHandler[model.Full_A]("As", []string{"Us", "Vs", "RelABs"}))
	router.GET("/full/as/:id", handlers.MakeGetFullEntityHandler[model.Full_A]("A", []string{"Us", "Vs", "RelABs"}))
	router.POST("/full/as", handlers.MakeAddFullEntityHandler[model.Full_A]("Full_A", []string{"Us", "Vs", "RelABs"}))

	router.GET("/full/bs", handlers.MakeGetFullEntitiesHandler[model.Full_B]("Bs", []string{"Xs", "Ys"}))
	router.GET("/full/bs/:id", handlers.MakeGetFullEntityHandler[model.Full_B]("B", []string{"Xs", "Ys"}))
	router.POST("/full/bs", handlers.MakeAddFullEntityHandler[model.Full_B]("Full_B", []string{"Xs", "Ys"}))

	// Bitemporal registration, correction and undoing routes
	// see README.md for details and examples
	router.POST("/registreer/as", handlers.MakeRegisterFullEntityHandlerA())
	//	router.POST("/full/as/:id", handlers.MakeCorrectFullEntityHandler[model.Full_A]("Full_A", "Vs"))
	//	router.POST("/full/as/:id/undo", handlers.MakeUndoFullEntityHandler[model.Full_A]("Full_A", "Vs"))
	router.POST("/registreer/bs", handlers.MakeRegisterFullEntityHandlerB())

	// met ID
	//router.POST("/registreer/as/:id", handlers.MakeRegisterFullEntityHandlerAWithID())

	// test met nieuwe aanpak
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
