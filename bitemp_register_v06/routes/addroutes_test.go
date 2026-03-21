package routes

import (
	"fmt"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
)

func routeExists(routes []gin.RouteInfo, method, path string) bool {
	for _, route := range routes {
		if route.Method == method && route.Path == path {
			return true
		}
	}
	return false
}

func TestAddRoutes_RegistersMetaRegistryRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	AddRoutes(router)
	routes := router.Routes()

	for _, meta := range model.MetaRegistry {
		if meta.DBFactory != nil && meta.Padnaam != "" {
			basePath := "/" + meta.Padnaam
			if !routeExists(routes, "GET", basePath) {
				t.Fatalf("expected GET route %s for %s", basePath, meta.Typenaam)
			}
			if !routeExists(routes, "GET", basePath+"/:id") {
				t.Fatalf("expected GET route %s/:id for %s", basePath, meta.Typenaam)
			}
			if !routeExists(routes, "POST", basePath) {
				t.Fatalf("expected POST route %s for %s", basePath, meta.Typenaam)
			}
		}

		if meta.Metatype == model.MetatypeEntiteit && meta.Factory != nil && meta.SliceFactory != nil && meta.Padnaam != "" {
			basePath := "/full/" + meta.Padnaam
			if !routeExists(routes, "GET", basePath) {
				t.Fatalf("expected GET route %s for full %s", basePath, meta.Typenaam)
			}
			if !routeExists(routes, "GET", basePath+"/:id") {
				t.Fatalf("expected GET route %s/:id for full %s", basePath, meta.Typenaam)
			}
			if !routeExists(routes, "POST", basePath) {
				t.Fatalf("expected POST route %s for full %s", basePath, meta.Typenaam)
			}
		}
	}

	requiredStatic := []struct {
		method string
		path   string
	}{
		{method: "GET", path: "/tests"},
		{method: "PATCH", path: "/registraties/:id"},
		{method: "GET", path: "/full/registraties"},
		{method: "GET", path: "/full/registraties/:id"},
		{method: "POST", path: "/registratie/"},
	}

	for _, required := range requiredStatic {
		if !routeExists(routes, required.method, required.path) {
			t.Fatal(fmt.Sprintf("expected static route %s %s", required.method, required.path))
		}
	}
}
