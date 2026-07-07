package routes

import (
	"sort"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/handlers"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
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
		// Muterende routes vereisen minimaal rol "editor" (no-op als AUTH_ENABLED=false).
		editor := middleware.RequireRol("editor")
		router.GET(basePath, handlers.MakeGetEntitiesByMetaHandler(meta))
		router.GET(basePath+"/:id", handlers.MakeGetEntityByMetaHandler(meta))
		// POST via de registratie-engine (BE-review §3.5): audit + transactie zoals POST /registratie/.
		router.POST(basePath, editor, handlers.MakeAddEntityViaEngineHandler(meta))
		// FASE 2 (REST/CRUD-laag, 2026-04-29): DELETE per padnaam.
		// Routes naar de generieke afvoer-handler die intern RegistreerCore aanroept,
		// zodat audit-trail + transactiegedrag identiek zijn aan POST /registratie/.
		router.DELETE(basePath+"/:id", editor, handlers.MakeDeleteEntityByMetaHandler(meta))
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
		// Muterende routes vereisen minimaal rol "editor" (no-op als AUTH_ENABLED=false).
		editor := middleware.RequireRol("editor")
		router.GET(basePath, handlers.MakeGetFullEntitiesByMetaHandler(meta))
		router.GET(basePath+"/:id", handlers.MakeGetFullEntityByMetaHandler(meta))
		// POST via de registratie-engine (BE-review §3.5); geneste full-shape wordt genormaliseerd.
		router.POST(basePath, editor, handlers.MakeAddEntityViaEngineHandler(meta))
		// FASE 2 (REST/CRUD-laag, 2026-04-29): PATCH op /full/{padnaam}/:id.
		// JSON Merge Patch (RFC 7396) op onderliggende GE's/RELs; ?modus=registratie|correctie.
		router.PATCH(basePath+"/:id", editor, handlers.MakePatchFullEntityByMetaHandler(meta))
	}
}

// addReferentielijstRoutes registreert de /referentielijsten routes:
// - GET /referentielijsten                        → overzicht van alle referentielijsten (systeemtabel)
// - GET /referentielijsten/{padnaam}              → lijst van entiteiten van een referentielijst
// - GET /referentielijsten/{padnaam}/:id          → detail van één referentielijst-entiteit
// - GET /full/referentielijsten/{padnaam}         → volledige (expanded) lijst
// - GET /full/referentielijsten/{padnaam}/:id     → volledige (expanded) detail
func addReferentielijstRoutes(router *gin.Engine) {
	// Overzicht: alle referentielijst-instanties — dynamisch via MetaRegistry lookup.
	// Als "Referentielijst" niet in het model zit (bijv. bij een domein zonder
	// referentielijsten), worden de /referentielijsten routes overgeslagen.
	refMeta, hasRef := model.MetaRegistry.GetTypeMeta("Referentielijst")
	if !hasRef {
		return // geen referentielijsten in dit model
	}
	router.GET("/referentielijsten", handlers.MakeGetEntitiesByMetaHandler(refMeta))

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
		// Muterende routes vereisen minimaal rol "editor" (no-op als AUTH_ENABLED=false).
		editor := middleware.RequireRol("editor")
		router.GET(basePath, handlers.MakeGetEntitiesByMetaHandler(meta))
		router.GET(basePath+"/:id", handlers.MakeGetEntityByMetaHandler(meta))
		// POST via de registratie-engine (BE-review §3.5): audit + transactie zoals POST /registratie/.
		router.POST(basePath, editor, handlers.MakeAddEntityViaEngineHandler(meta))

		if meta.Factory != nil && meta.SliceFactory != nil {
			fullPath := "/full/referentielijsten/" + meta.Padnaam
			router.GET(fullPath, handlers.MakeGetFullEntitiesByMetaHandler(meta))
			router.GET(fullPath+"/:id", handlers.MakeGetFullEntityByMetaHandler(meta))
			router.POST(fullPath, editor, handlers.MakeAddEntityViaEngineHandler(meta))
		}
	}
}
