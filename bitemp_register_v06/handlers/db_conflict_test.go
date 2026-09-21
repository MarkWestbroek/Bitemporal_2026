package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestNewRegistreerErr_VertaaltDatabaseConflictNaar409(t *testing.T) {
	gevallen := []struct {
		naam        string
		fout        error
		herkansbaar bool
	}{
		{"dubbele sleutel", errors.New(`HANDLER: failed to insert NatuurlijkPersoon: ERROR: duplicate key value violates unique constraint "natuurlijkpersoon_pkey" (SQLSTATE=23505)`), false},
		{"enkelvoudig-constraint bij commit", errors.New(`ERROR: conflicting key value violates exclusion constraint "ux_natuurlijkpersoon_naam_enkelvoudig_actief" (SQLSTATE=23P01)`), false},
		{"deadlock", fmt.Errorf("ont-opvoer update mislukt: %w", errors.New("ERROR: deadlock detected (SQLSTATE=40P01)")), true},
		{"serialisatiefout", errors.New("ERROR: could not serialize access (SQLSTATE=40001)"), true},
	}
	for _, g := range gevallen {
		t.Run(g.naam, func(t *testing.T) {
			rerr := newRegistreerErr(http.StatusInternalServerError, "wijziging[0]: opvoer mislukt: %v", g.fout)
			if rerr.Status != http.StatusConflict {
				t.Fatalf("status = %d, wil 409", rerr.Status)
			}
			if rerr.Herkansbaar != g.herkansbaar {
				t.Errorf("Herkansbaar = %v, wil %v", rerr.Herkansbaar, g.herkansbaar)
			}
			for _, lek := range []string{"SQLSTATE", "constraint", "pkey", "ux_", "ERROR:"} {
				if strings.Contains(rerr.Msg, lek) {
					t.Errorf("boodschap lekt %q: %s", lek, rerr.Msg)
				}
			}
		})
	}
}

func TestNewRegistreerErr_LaatOverigeFoutenOngemoeid(t *testing.T) {
	// Een andere databasefout blijft 500.
	rerr := newRegistreerErr(http.StatusInternalServerError, "failed to insert registratie: %v", errors.New("ERROR: relation does not exist (SQLSTATE=42P01)"))
	if rerr.Status != http.StatusInternalServerError || rerr.Herkansbaar {
		t.Errorf("status = %d herkansbaar = %v, wil 500/false", rerr.Status, rerr.Herkansbaar)
	}
	// Een 400 met toevallig een SQLSTATE in de tekst wordt niet vertaald: alleen 500's.
	rerr = newRegistreerErr(http.StatusBadRequest, "ongeldige invoer (SQLSTATE=23505)")
	if rerr.Status != http.StatusBadRequest {
		t.Errorf("status = %d, wil 400", rerr.Status)
	}
}
