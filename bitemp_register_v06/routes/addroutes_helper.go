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

		// Referentielijsten krijgen aparte routes via addReferentielijstRoutes
		if meta.EntiteitSubtype == model.EntiteitSubtypeReferentielijst {
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

		// Referentielijsten krijgen aparte routes via addReferentielijstRoutes
		if meta.EntiteitSubtype == model.EntiteitSubtypeReferentielijst {
			continue
		}

		basePath := "/full/" + meta.Padnaam
		router.GET(basePath, handlers.MakeGetFullEntitiesByMetaHandler(meta))
		router.GET(basePath+"/:id", handlers.MakeGetFullEntityByMetaHandler(meta))
		router.POST(basePath, handlers.MakeAddFullEntityByMetaHandler(meta))
	}
}

// addReferentielijstRoutes registreert de /referentielijsten routes:
// - GET /referentielijsten                        → overzicht van alle referentielijsten (systeemtabel)
// - GET /referentielijsten/{padnaam}              → lijst van entiteiten van een referentielijst
// - GET /referentielijsten/{padnaam}/:id          → detail van één referentielijst-entiteit
// - GET /full/referentielijsten/{padnaam}         → volledige (expanded) lijst
// - GET /full/referentielijsten/{padnaam}/:id     → volledige (expanded) detail
func addReferentielijstRoutes(router *gin.Engine) {
	// Overzicht: alle referentielijst-instanties uit de register_referentielijst tabel
	router.GET("/referentielijsten", handlers.MakeGetEntitiesHandler[model.Referentielijst]("Referentielijsten"))

	typeNamen := make([]string, 0)
	for typeNaam, meta := range model.MetaRegistry {
		if meta.EntiteitSubtype == model.EntiteitSubtypeReferentielijst {
			typeNamen = append(typeNamen, typeNaam)
		}
	}
	sort.Strings(typeNamen)

	for _, typeNaam := range typeNamen {
		meta, ok := model.MetaRegistry.GetTypeMeta(typeNaam)
		if !ok {
			continue
		}

		basePath := "/referentielijsten/" + meta.Padnaam
		router.GET(basePath, handlers.MakeGetEntitiesByMetaHandler(meta))
		router.GET(basePath+"/:id", handlers.MakeGetEntityByMetaHandler(meta))
		router.POST(basePath, handlers.MakeAddEntityByMetaHandler(meta))

		if meta.Factory != nil && meta.SliceFactory != nil {
			fullPath := "/full/referentielijsten/" + meta.Padnaam
			router.GET(fullPath, handlers.MakeGetFullEntitiesByMetaHandler(meta))
			router.GET(fullPath+"/:id", handlers.MakeGetFullEntityByMetaHandler(meta))
			router.POST(fullPath, handlers.MakeAddFullEntityByMetaHandler(meta))
		}
	}
}
