package handlers

// Tests voor de foutafhandeling van BE-review 2026-07-07 §4.2/§4.3:
// onbekend ID → 404 (bun's sql.ErrNoRows), en interne DB-fouten lekken niet
// naar de client.

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestMakeGetEntityByMetaHandler_OnbekendIDGeeft404(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, cleanup := newMockDB(t)
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	// bun retourneert sql.ErrNoRows als er geen rij is — dat is een 404.
	mock.ExpectQuery(`SELECT .* FROM "crud_dummy"`).WillReturnError(sql.ErrNoRows)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/crud_dummies/99", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "99"}}

	MakeGetEntityByMetaHandler(crudDummyMeta())(ctx)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status: wil 404 bij onbekend ID, kreeg %d: %s", rec.Code, rec.Body.String())
	}
}

func TestMakeGetEntityByMetaHandler_DBFoutLektNietNaarClient(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, cleanup := newMockDB(t)
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	mock.ExpectQuery(`SELECT .* FROM "crud_dummy"`).WillReturnError(sql.ErrConnDone)

	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/crud_dummies/1", nil)
	ctx.Params = gin.Params{{Key: "id", Value: "1"}}

	MakeGetEntityByMetaHandler(crudDummyMeta())(ctx)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status: wil 500, kreeg %d: %s", rec.Code, rec.Body.String())
	}

	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("kon response niet decoderen: %v", err)
	}
	foutTekst, _ := body["error"].(string)
	if strings.Contains(foutTekst, sql.ErrConnDone.Error()) || strings.Contains(strings.ToLower(foutTekst), "sql:") {
		t.Errorf("interne DB-fout lekt naar client: %q", foutTekst)
	}
}

func TestVoerEntiteitAfCore_OnbekendIDGeeft404(t *testing.T) {
	db, mock, cleanup := newMockDB(t)
	defer cleanup()

	oldDB := DB
	DB = db
	defer func() { DB = oldDB }()

	mock.ExpectQuery(`SELECT .* FROM "crud_dummy"`).WillReturnError(sql.ErrNoRows)

	_, rerr := VoerEntiteitAfCore(t.Context(), crudDummyMeta(), "99", AuditMeta{})
	if rerr == nil || rerr.Status != http.StatusNotFound {
		t.Fatalf("wil 404 bij onbekend ID, kreeg %+v", rerr)
	}
}
