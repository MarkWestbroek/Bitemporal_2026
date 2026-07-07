package handlers

// Tests voor de engine-based POST-handler (BE-review 2026-07-07, §3.5).
// Verifieert:
//   - maakRegistreerBodyVoorOpvoer bouwt de juiste RegistreerRequest-wrapper
//   - 400 bij niet-object body en bij ontbrekende Veldnaam
//   - happy path: POST /{padnaam} loopt volledig door RegistreerCore
//     (registratie + entity-insert + wijziging + audit, transactioneel)

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/gin-gonic/gin"
	"github.com/uptrace/bun"
)

// opvoerDummy is een minimale FormeleRepresentatie mét (lege) onderliggende
// gegevenselementen, zodat de entity-recursie in handleRepresentatieOpvoer werkt.
type opvoerDummy struct {
	bun.BaseModel `bun:"table:opvoer_dummy"`
	ID            int        `json:"id" bun:"id,pk"`
	Naam          string     `json:"naam" bun:"naam"`
	Opvoer        *time.Time `json:"opvoer" bun:"opvoer"`
	Afvoer        *time.Time `json:"afvoer" bun:"afvoer"`
}

func (d *opvoerDummy) GetID() any               { return d.ID }
func (d *opvoerDummy) Metatype() model.Metatype { return model.MetatypeEntiteit }
func (d *opvoerDummy) String() string           { return "opvoerDummy" }
func (d *opvoerDummy) GetOpvoer() *time.Time    { return d.Opvoer }
func (d *opvoerDummy) SetOpvoer(t *time.Time)   { d.Opvoer = t }
func (d *opvoerDummy) GetAfvoer() *time.Time    { return d.Afvoer }
func (d *opvoerDummy) SetAfvoer(t *time.Time)   { d.Afvoer = t }
func (d *opvoerDummy) ClearID()                 { d.ID = 0 }
func (d *opvoerDummy) GeefOnderliggendeGegevenselementen() []model.OnderliggendeRepresentatie {
	return nil
}

func opvoerDummyMeta() model.TypeMeta {
	return model.TypeMeta{
		Typenaam:  "OpvoerDummy",
		Veldnaam:  "opvoer_dummy",
		Padnaam:   "opvoer_dummies",
		Metatype:  model.MetatypeEntiteit,
		Tabelnaam: "opvoer_dummy",
		IDKolom:   "id",
		Factory:   func() model.Representatie { return &opvoerDummy{} },
		DBFactory: func() model.Representatie { return &opvoerDummy{} },
	}
}

// registreerTijdelijkeMeta zet een test-meta in de globale MetaRegistry en
// ruimt die na de test weer op. Nodig omdat RepresentatiePlusNaam.UnmarshalJSON
// het type via de registry resolvet (op veldnaam).
func registreerTijdelijkeMeta(t *testing.T, meta model.TypeMeta) {
	t.Helper()
	if _, bestaat := model.MetaRegistry[meta.Typenaam]; bestaat {
		t.Fatalf("typenaam %q bestaat al in MetaRegistry; kies een unieke testnaam", meta.Typenaam)
	}
	model.MetaRegistry[meta.Typenaam] = meta
	t.Cleanup(func() { delete(model.MetaRegistry, meta.Typenaam) })
}

func TestMaakRegistreerBodyVoorOpvoer_WrapperShape(t *testing.T) {
	body, err := maakRegistreerBodyVoorOpvoer(opvoerDummyMeta(), []byte(`{"id":3,"naam":"x"}`))
	if err != nil {
		t.Fatalf("onverwachte fout: %v", err)
	}

	var wrapper struct {
		Registratie struct {
			Registratietype string `json:"registratietype"`
		} `json:"registratie"`
		Wijzigingen []struct {
			Opvoer map[string]json.RawMessage `json:"opvoer"`
		} `json:"wijzigingen"`
	}
	if err := json.Unmarshal(body, &wrapper); err != nil {
		t.Fatalf("wrapper is geen geldige JSON: %v", err)
	}
	if wrapper.Registratie.Registratietype != string(model.RegistratietypeRegistratie) {
		t.Errorf("registratietype: wil %q, kreeg %q", model.RegistratietypeRegistratie, wrapper.Registratie.Registratietype)
	}
	if len(wrapper.Wijzigingen) != 1 {
		t.Fatalf("wil precies 1 wijziging, kreeg %d", len(wrapper.Wijzigingen))
	}
	payload, ok := wrapper.Wijzigingen[0].Opvoer["opvoer_dummy"]
	if !ok {
		t.Fatalf("opvoer mist veldnaam-sleutel 'opvoer_dummy': %s", body)
	}
	if strings.TrimSpace(string(payload)) != `{"id":3,"naam":"x"}` {
		t.Errorf("payload niet ongewijzigd doorgegeven: %s", payload)
	}
}

func TestMaakRegistreerBodyVoorOpvoer_Fouten(t *testing.T) {
	metaZonderVeldnaam := opvoerDummyMeta()
	metaZonderVeldnaam.Veldnaam = ""
	if _, err := maakRegistreerBodyVoorOpvoer(metaZonderVeldnaam, []byte(`{}`)); err == nil {
		t.Error("wil fout bij ontbrekende Veldnaam, kreeg nil")
	}
	if _, err := maakRegistreerBodyVoorOpvoer(opvoerDummyMeta(), []byte(`[1,2]`)); err == nil {
		t.Error("wil fout bij niet-object body, kreeg nil")
	}
	if _, err := maakRegistreerBodyVoorOpvoer(opvoerDummyMeta(), nil); err == nil {
		t.Error("wil fout bij lege body, kreeg nil")
	}
}

func TestMakeAddEntityViaEngineHandler_NietObjectBodyGeeft400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/opvoer_dummies", strings.NewReader(`"geen object"`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	MakeAddEntityViaEngineHandler(opvoerDummyMeta())(ctx)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status: wil 400, kreeg %d: %s", rec.Code, rec.Body.String())
	}
}

func TestMakeAddEntityViaEngineHandler_HappyPathViaRegistreerCore(t *testing.T) {
	gin.SetMode(gin.TestMode)

	meta := opvoerDummyMeta()
	registreerTijdelijkeMeta(t, meta)

	db, mock, cleanup := newMockDB(t)
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// RegistreerCore: BEGIN → INSERT registratie (RETURNING id) → UPDATE
	// tijdstip (synthetische modus, default) → INSERT entity (RETURNING *) →
	// INSERT wijziging (RETURNING id, autoincrement pk) → UPDATE audit → COMMIT.
	mock.ExpectBegin()
	mock.ExpectQuery(`INSERT INTO "registratie"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(7))
	mock.ExpectExec(`UPDATE "registratie"`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(`INSERT INTO "opvoer_dummy"`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "naam", "opvoer", "afvoer"}).
			AddRow(3, "x", time.Now(), nil))
	mock.ExpectQuery(`INSERT INTO "wijziging"`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(70))
	mock.ExpectExec(`UPDATE "registratie"`).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/opvoer_dummies", strings.NewReader(`{"id":3,"naam":"x"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	MakeAddEntityViaEngineHandler(meta)(ctx)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status: wil 201, kreeg %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("kon response niet decoderen: %v", err)
	}
	if regID, ok := body["registratie_id"].(float64); !ok || int(regID) != 7 {
		t.Fatalf("wil registratie_id 7 in response, kreeg %#v", body["registratie_id"])
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("onvervulde sql-verwachtingen: %v", err)
	}
}
