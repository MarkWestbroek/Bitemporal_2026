package routes

import (
	"sort"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func addMetaRegistryRoutes(router *gin.Engine) {
	typeNamen := make([]string, 0, len(model.MetaRegistry))
	for typeNaam := range model.MetaRegistry {
		typeNamen = append(typeNamen, typeNaam)
	}
	sort.Strings(typeNamen)

	for _, typeNaam := range typeNamen {
		meta, ok := model.MetaRegistry.GetTypeMeta(typeNaam)
		if !ok || meta.DBFactory == nil || meta.Padnaam == "" {
			continue
		}

		basePath := "/" + meta.Padnaam
		router.GET(basePath, handlers.MakeGetEntitiesByMetaHandler(meta))
		router.GET(basePath+"/:id", handlers.MakeGetEntityByMetaHandler(meta))
		router.POST(basePath, handlers.MakeAddEntityByMetaHandler(meta))
	}
}

func addMetaRegistryFullRoutes(router *gin.Engine) {
	typeNamen := make([]string, 0, len(model.MetaRegistry))
	for typeNaam := range model.MetaRegistry {
		typeNamen = append(typeNamen, typeNaam)
	}
	sort.Strings(typeNamen)

	for _, typeNaam := range typeNamen {
		meta, ok := model.MetaRegistry.GetTypeMeta(typeNaam)
		if !ok || meta.Metatype != model.MetatypeEntiteit || meta.Factory == nil || meta.SliceFactory == nil || meta.Padnaam == "" {
			continue
		}

		basePath := "/full/" + meta.Padnaam
		router.GET(basePath, handlers.MakeGetFullEntitiesByMetaHandler(meta))
		router.GET(basePath+"/:id", handlers.MakeGetFullEntityByMetaHandler(meta))
		router.POST(basePath, handlers.MakeAddFullEntityByMetaHandler(meta))
	}
}
