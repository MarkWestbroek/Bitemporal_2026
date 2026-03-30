package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

type vizSchemaResponseTest struct {
	Versie string `json:"versie"`
	Types  []struct {
		Typenaam    string `json:"typenaam"`
		Description string `json:"description"`
		Velden      []struct {
			Naam        string   `json:"naam"`
			Description string   `json:"description"`
			Type        string   `json:"type"`
			Format      string   `json:"format"`
			Enum        []string `json:"enum"`
			Verplicht   bool     `json:"verplicht"`
		} `json:"velden"`
	} `json:"types"`
}

func TestMaakVizSchemaHandler_GeeftSchemaTerug(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/viz/schema", MaakVizSchemaHandler())

	req := httptest.NewRequest(http.MethodGet, "/viz/schema", nil)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var body vizSchemaResponseTest
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode json response: %v", err)
	}

	if body.Versie != "v1" {
		t.Fatalf("expected versie v1, got %q", body.Versie)
	}

	if len(body.Types) == 0 {
		t.Fatal("expected at least one type in schema")
	}

	foundA := false
	for _, item := range body.Types {
		if item.Typenaam == "A" {
			foundA = true
			break
		}
	}

	if !foundA {
		t.Fatal("expected type A in schema response")
	}

	assertField := func(typeName, fieldName, expectedType, expectedFormat string) {
		t.Helper()
		for _, item := range body.Types {
			if item.Typenaam != typeName {
				continue
			}
			for _, field := range item.Velden {
				if field.Naam != fieldName {
					continue
				}
				if field.Type != expectedType {
					t.Fatalf("expected %s.%s type %q, got %q", typeName, fieldName, expectedType, field.Type)
				}
				if field.Format != expectedFormat {
					t.Fatalf("expected %s.%s format %q, got %q", typeName, fieldName, expectedFormat, field.Format)
				}
				return
			}
			t.Fatalf("expected field %s on type %s", fieldName, typeName)
		}
		t.Fatalf("expected type %s in schema response", typeName)
	}

	assertField("A", "id", "integer", "")
	assertField("A", "us", "A_U", "array")
	assertField("A_U_Data", "bbb", "boolean", "")
	assertField("A_W_Data", "float", "number", "float64")
	assertField("A_W_Data", "heel", "integer", "")
	assertField("A_V_Data", "datum", "string", "date")

	for _, item := range body.Types {
		if item.Typenaam != "Rel_A_B" {
			continue
		}
		if item.Description == "" {
			t.Fatal("expected type description on Rel_A_B")
		}
		break
	}

	for _, item := range body.Types {
		if item.Typenaam != "Rel_A_B_Data" {
			continue
		}
		for _, field := range item.Velden {
			if field.Naam != "soort" {
				continue
			}
			if field.Description == "" {
				t.Fatal("expected field description on Rel_A_B_Data.soort")
			}
			expected := []string{"LTT", "LAT", "LTA"}
			if len(field.Enum) != len(expected) {
				t.Fatalf("expected Rel_A_B_Data.soort enum length %d, got %d", len(expected), len(field.Enum))
			}
			for index, value := range expected {
				if field.Enum[index] != value {
					t.Fatalf("expected Rel_A_B_Data.soort enum[%d] %q, got %q", index, value, field.Enum[index])
				}
			}
			return
		}
		t.Fatalf("expected field soort on type Rel_A_B_Data")
	}
	t.Fatal("expected type Rel_A_B_Data in schema response")
}

func TestBouwFlatTypeRegistry_DomeinFilterIsRecursiefVanafRootEntiteiten(t *testing.T) {
	items := BouwFlatTypeRegistry("np-loc")

	set := map[string]bool{}
	for _, item := range items {
		set[item.Typenaam] = true
	}

	// Root-entiteit van np-loc moet aanwezig zijn.
	if !set["NatuurlijkPersoon"] {
		t.Fatal("expected NatuurlijkPersoon in domeinfilter np-loc")
	}

	// Onderliggend type zonder expliciet Domein-label moet via recursie worden meegenomen.
	if !set["NatuurlijkPersoon_Naam_Data"] {
		t.Fatal("expected NatuurlijkPersoon_Naam_Data via recursive inclusion from root entity")
	}

	// Register-basislaag blijft beschikbaar.
	if !set["Referentielijst"] {
		t.Fatal("expected Referentielijst from register basis layer")
	}

	// AB-testmodel moet niet meekomen in np-loc domeinfilter.
	if set["A"] {
		t.Fatal("did not expect A in domeinfilter np-loc")
	}
	if set["A_U_Data"] {
		t.Fatal("did not expect A_U_Data in domeinfilter np-loc")
	}
}

func TestBouwFlatTypeRegistryMetOpties_StrictZonderRegister(t *testing.T) {
	items := BouwFlatTypeRegistryMetOpties("np-loc", false)

	set := map[string]bool{}
	for _, item := range items {
		set[item.Typenaam] = true
	}

	if !set["NatuurlijkPersoon"] {
		t.Fatal("expected NatuurlijkPersoon in strict np-loc filter")
	}
	if !set["NatuurlijkPersoon_Naam_Data"] {
		t.Fatal("expected NaturallyPersoon_Naam_Data via recursive strict inclusion")
	}
	if set["Referentielijst"] {
		t.Fatal("did not expect Referentielijst in strict np-loc filter")
	}
	if set["Land"] {
		t.Fatal("did not expect Land in strict np-loc filter")
	}
}
