package handlers

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestVindPlaatshouders_DefinitiesEnGebruik(t *testing.T) {
	raw := json.RawMessage(`[
	  {"opvoer": {"initiatief": {"id": "$nieuw.init"}}},
	  {"opvoer": {"organisatie": {"id": "$nieuw.org"}}},
	  {"opvoer": {"organisatienaam": {"organisatie_id": "$nieuw.org", "naam": "Test BV"}}},
	  {"opvoer": {"initiatieforganisatie": {"initiatief_id": "$nieuw.init", "organisatie_id": "$nieuw.org", "rol": "Contactorganisatie"}}}
	]`)
	p, err := vindPlaatshouders(raw)
	if err != nil {
		t.Fatalf("onverwachte fout: %v", err)
	}
	if got := strings.Join(p.Volgorde, ","); got != "$nieuw.init,$nieuw.org" {
		t.Fatalf("volgorde = %q", got)
	}
	if p.Typenaam["$nieuw.init"] != "Initiatief" || p.Typenaam["$nieuw.org"] != "Organisatie" {
		t.Fatalf("typenamen = %v", p.Typenaam)
	}
}

func TestVindPlaatshouders_ZonderDefinitieIsFout(t *testing.T) {
	raw := json.RawMessage(`[{"opvoer": {"organisatienaam": {"organisatie_id": "$nieuw.org", "naam": "x"}}}]`)
	if _, err := vindPlaatshouders(raw); err == nil || !strings.Contains(err.Error(), "$nieuw.org") {
		t.Fatalf("verwachtte fout over $nieuw.org, kreeg %v", err)
	}
}

func TestVindPlaatshouders_GeenPlaatshoudersIsLeeg(t *testing.T) {
	p, err := vindPlaatshouders(json.RawMessage(`[{"opvoer": {"organisatie": {"id": 5}}}]`))
	if err != nil || !p.Leeg() {
		t.Fatalf("verwachtte leeg zonder fout, kreeg %v / %v", p, err)
	}
	// Een gewone string die er alleen op lijkt, telt niet.
	p, err = vindPlaatshouders(json.RawMessage(`[{"opvoer": {"organisatienaam": {"organisatie_id": 5, "naam": "$nieuw.org niet echt"}}}]`))
	if err != nil || !p.Leeg() {
		t.Fatalf("string met spatie is geen plaatshouder: %v / %v", p, err)
	}
}

func TestKenPlaatshoudersToe_MaxPlusEenPerType(t *testing.T) {
	db, mock, cleanup := newMockDB(t)
	defer cleanup()
	mock.ExpectBegin()
	mock.ExpectExec(`pg_advisory_xact_lock`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectQuery(`COALESCE\(MAX\(id\), 0\)`).WillReturnRows(sqlmock.NewRows([]string{"coalesce"}).AddRow(143))
	mock.ExpectExec(`pg_advisory_xact_lock`).WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectQuery(`COALESCE\(MAX\(id\), 0\)`).WillReturnRows(sqlmock.NewRows([]string{"coalesce"}).AddRow(0))

	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	p := &Plaatshouders{
		Volgorde: []string{"$nieuw.init", "$nieuw.org", "$nieuw.org2"},
		Typenaam: map[string]string{"$nieuw.init": "Initiatief", "$nieuw.org": "Organisatie", "$nieuw.org2": "Organisatie"},
	}
	ids, err := kenPlaatshoudersToe(context.Background(), tx, p)
	if err != nil {
		t.Fatalf("toekennen: %v", err)
	}
	if ids["$nieuw.init"] != 144 || ids["$nieuw.org"] != 1 || ids["$nieuw.org2"] != 2 {
		t.Fatalf("ids = %v", ids)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestVulPlaatshoudersIn_VervangtDoorGetallen(t *testing.T) {
	raw := json.RawMessage(`[{"opvoer": {"organisatienaam": {"organisatie_id": "$nieuw.org", "naam": "x", "tags": ["$nieuw.org", "vast"]}}}]`)
	uit, err := vulPlaatshoudersIn(raw, map[string]int{"$nieuw.org": 7})
	if err != nil {
		t.Fatal(err)
	}
	var boom []map[string]map[string]map[string]any
	if err := json.Unmarshal(uit, &boom); err != nil {
		t.Fatal(err)
	}
	pl := boom[0]["opvoer"]["organisatienaam"]
	if pl["organisatie_id"] != float64(7) || pl["tags"].([]any)[0] != float64(7) || pl["tags"].([]any)[1] != "vast" {
		t.Fatalf("payload = %v", pl)
	}
}

func TestRegistreerJSONCore_PlaatshouderZonderDefinitieIs400(t *testing.T) {
	body := []byte(`{"registratie":{"registratietype":"registratie"},"wijzigingen":[{"opvoer":{"organisatienaam":{"organisatie_id":"$nieuw.org","naam":"x"}}}]}`)
	_, rerr := RegistreerJSONCore(context.Background(), body, "", AuditMeta{})
	if rerr == nil || rerr.Status != 400 || !strings.Contains(rerr.Msg, "$nieuw.org") {
		t.Fatalf("verwachtte 400 over $nieuw.org, kreeg %v", rerr)
	}
}
