package model

// validatie_vectoren_test.go — de Go-kant van de gedeelde validatie-testset
// (testdata/validatie/vectoren.json). De JS-kant (web/vite/src/shared/validatieVectoren.test.js)
// draait dezelfde gevallen tegen dezelfde datatypes; zo blijft "één regel in het model, overal
// dezelfde uitkomst" toetsbaar (ontwerp "Invoersoort en vorm" §9d).
//
// testdata/validatie/datatypes.json is een momentopname van de validatie-kant van de
// DatatypeRegistry, voor de JS-test. Deze test faalt als hij achterloopt; bijwerken met
//
//	UPDATE_GOLDEN=1 go test ./model -run TestValidatieDatatypesMomentopname

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

const validatieTestdata = "../testdata/validatie"

type validatieVector struct {
	Datatype string `json:"datatype"`
	Waarde   string `json:"waarde"`
	Waarom   string `json:"waarom,omitempty"`
}

type validatieVectoren struct {
	Ongeldig []validatieVector `json:"ongeldig"`
	Geldig   []validatieVector `json:"geldig"`
}

// datatypeMomentopname: alleen wat een evaluator nodig heeft.
type datatypeMomentopname struct {
	Naam         string       `json:"naam"`
	Basistype    string       `json:"basistype,omitempty"`
	Format       string       `json:"format,omitempty"`
	Normalisatie string       `json:"normalisatie,omitempty"`
	Validatie    *V3Validatie `json:"validatie"`
}

func maakDatatypeMomentopname() []byte {
	var lijst []datatypeMomentopname
	for _, dt := range DatatypeRegistry {
		if dt.Validatie == nil {
			continue
		}
		lijst = append(lijst, datatypeMomentopname{Naam: dt.Naam, Basistype: dt.Basistype, Format: dt.Format, Normalisatie: dt.Normalisatie, Validatie: dt.Validatie})
	}
	sort.Slice(lijst, func(i, j int) bool { return lijst[i].Naam < lijst[j].Naam })
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	_ = enc.Encode(lijst)
	return buf.Bytes()
}

func TestValidatieDatatypesMomentopname(t *testing.T) {
	pad := filepath.Join(validatieTestdata, "datatypes.json")
	nu := maakDatatypeMomentopname()
	if os.Getenv("UPDATE_GOLDEN") == "1" {
		if err := os.WriteFile(pad, nu, 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	oud, err := os.ReadFile(pad)
	if err != nil {
		t.Fatalf("%s ontbreekt; maak hem met UPDATE_GOLDEN=1: %v", pad, err)
	}
	if !bytes.Equal(bytes.ReplaceAll(oud, []byte("\r\n"), []byte("\n")), nu) {
		t.Fatalf("%s loopt achter op de DatatypeRegistry; bijwerken met UPDATE_GOLDEN=1 go test ./model -run TestValidatieDatatypesMomentopname", pad)
	}
}

func TestValidatieVectoren(t *testing.T) {
	ruw, err := os.ReadFile(filepath.Join(validatieTestdata, "vectoren.json"))
	if err != nil {
		t.Fatal(err)
	}
	var v validatieVectoren
	if err := json.Unmarshal(ruw, &v); err != nil {
		t.Fatal(err)
	}
	geldig := append([]validatieVector{}, v.Geldig...)
	// Elk voorbeeld in het model hoort geldig te zijn.
	for _, dt := range DatatypeRegistry {
		if dt.Validatie == nil {
			continue
		}
		for _, vb := range dt.Validatie.Voorbeelden {
			geldig = append(geldig, validatieVector{Datatype: dt.Naam, Waarde: vb})
		}
	}
	for _, g := range geldig {
		if _, ok := FindDatatype(g.Datatype); !ok {
			t.Errorf("onbekend datatype %s", g.Datatype)
			continue
		}
		if f := ValideerWaarde(g.Datatype, g.Waarde, "x"); len(f) > 0 {
			t.Errorf("%s %q hoort geldig te zijn, fouten: %v", g.Datatype, g.Waarde, f)
		}
	}
	for _, o := range v.Ongeldig {
		if _, ok := FindDatatype(o.Datatype); !ok {
			t.Errorf("onbekend datatype %s", o.Datatype)
			continue
		}
		if f := ValideerWaarde(o.Datatype, o.Waarde, "x"); len(f) == 0 {
			t.Errorf("%s %q hoort ongeldig te zijn (%s)", o.Datatype, o.Waarde, o.Waarom)
		}
	}
	t.Logf("%d geldige en %d ongeldige gevallen", len(geldig), len(v.Ongeldig))
}
