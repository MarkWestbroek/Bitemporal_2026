package routes

import (
	"github.com/MarkWestbroek/Bitemporal_2026/bitemporal_go_API_v01/handlers"
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
}
