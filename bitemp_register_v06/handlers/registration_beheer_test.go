package handlers

import (
	"context"
	"net/http"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestControleerBeheerdomein(t *testing.T) {
	t.Setenv("AUTH_ENABLED", "true")
	rol := []model.WijzigingRequest{{Opvoer: &model.RepresentatiePlusNaam{Representatienaam: "Gebruiker_GebruikerRoltoewijzing"}}}
	anders := []model.WijzigingRequest{{Opvoer: &model.RepresentatiePlusNaam{Representatienaam: "QueryDefinitie"}}}
	editor := middleware.MetClaims(context.Background(), &middleware.JWTClaims{Rol: "editor"})
	admin := middleware.MetClaims(context.Background(), &middleware.JWTClaims{Rol: "admin"})

	if err := controleerBeheerdomein(editor, rol); err == nil || err.Status != http.StatusForbidden {
		t.Fatalf("editor die een rol registreert: 403 verwacht, kreeg %+v", err)
	}
	if err := controleerBeheerdomein(editor, anders); err != nil {
		t.Fatalf("editor buiten het beheerdomein: geen fout verwacht, kreeg %+v", err)
	}
	if err := controleerBeheerdomein(admin, rol); err != nil {
		t.Fatalf("admin: geen fout verwacht, kreeg %+v", err)
	}
	if err := controleerBeheerdomein(middleware.AlsSysteem(context.Background()), rol); err != nil {
		t.Fatalf("systeemaanroep: geen fout verwacht, kreeg %+v", err)
	}
}
