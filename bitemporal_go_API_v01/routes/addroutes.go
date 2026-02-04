package routes

import (
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v01/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v01/model"
	"github.com/gin-gonic/gin"
)

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

}
