package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

type vizSchemaFieldResponseTest struct {
	Naam        string   `json:"naam"`
	Description string   `json:"description"`
	Type        string   `json:"type"`
	Format      string   `json:"format"`
	Enum        []string `json:"enum"`
	Verplicht   bool     `json:"verplicht"`
}

type vizSchemaTypeResponseTest struct {
	Typenaam    string                       `json:"typenaam"`
	Description string                       `json:"description"`
	Velden      []vizSchemaFieldResponseTest `json:"velden"`
}

type vizSchemaResponseTest struct {
	Versie string                      `json:"versie"`
	Types  []vizSchemaTypeResponseTest `json:"types"`
}

func findSchemaType(t *testing.T, body vizSchemaResponseTest, typeName string) vizSchemaTypeResponseTest {
	t.Helper()
	for _, item := range body.Types {
		if item.Typenaam == typeName {
			return item
		}
	}
	t.Fatalf("expected type %s in schema response", typeName)
	return vizSchemaTypeResponseTest{}
}

func findSchemaField(t *testing.T, item vizSchemaTypeResponseTest, fieldName string) vizSchemaFieldResponseTest {
	t.Helper()
	for _, field := range item.Velden {
		if field.Naam == fieldName {
			return field
		}
	}
	t.Fatalf("expected field %s on type %s", fieldName, item.Typenaam)
	return vizSchemaFieldResponseTest{}
}

func assertFieldContract(t *testing.T, body vizSchemaResponseTest, typeName, fieldName, expectedType, expectedFormat string) {
	t.Helper()
	field := findSchemaField(t, findSchemaType(t, body, typeName), fieldName)
	if field.Type != expectedType {
		t.Fatalf("expected %s.%s type %q, got %q", typeName, fieldName, expectedType, field.Type)
	}
	if field.Format != expectedFormat {
		t.Fatalf("expected %s.%s format %q, got %q", typeName, fieldName, expectedFormat, field.Format)
	}
}

func assertFieldEnum(t *testing.T, body vizSchemaResponseTest, typeName, fieldName string, expected []string) {
	t.Helper()
	field := findSchemaField(t, findSchemaType(t, body, typeName), fieldName)
	if len(field.Enum) != len(expected) {
		t.Fatalf("expected %s.%s enum length %d, got %d", typeName, fieldName, len(expected), len(field.Enum))
	}
	for index, value := range expected {
		if field.Enum[index] != value {
			t.Fatalf("expected %s.%s enum[%d] %q, got %q", typeName, fieldName, index, value, field.Enum[index])
		}
	}
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

	// Houd de test gericht op het publieke schema-contract in plaats van op
	// toevallige codegen-details. We controleren per categorie een representatief
	// voorbeeld: entiteit, data-GE, materiële datum en enum op een relatie.
	aType := findSchemaType(t, body, "A")
	if aType.Description == "" {
		t.Fatal("expected type description on A")
	}
	if len(aType.Velden) == 0 {
		t.Fatal("expected A to expose schema fields")
	}

	assertFieldContract(t, body, "A", "id", "integer", "")
	assertFieldContract(t, body, "A", "us", "A_U", "array")
	assertFieldContract(t, body, "A_U_Data", "bbb", "boolean", "")
	assertFieldContract(t, body, "A_V_Data", "ccc", "string", "")
	assertFieldContract(t, body, "A_W_Data", "float", "number", "float64")
	assertFieldContract(t, body, "A_W_Data", "heel", "integer", "")
	assertFieldContract(t, body, "A_W_Aanvang", "datum", "string", "date")
	assertFieldEnum(t, body, "Rel_A_B_Data", "soort", []string{"LTT", "LAT", "LTA"})
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
