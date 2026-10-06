package handlers

// registration_beheer.go — het beheerdomein (Gebruiker en rollen) mag alleen een admin wijzigen
// (docs/plans/gebruikersbeheer/). De gegenereerde routes van dat domein vragen al admin
// (routes/leestoegang.go), maar een registratie kan ook via /registratie/, PATCH, DELETE of een
// GraphQL-mutatie binnenkomen; daarom controleert de engine het zelf.

import (
	"context"
	"net/http"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// controleerBeheerdomein weigert (403) als een wijziging een type uit het beheerdomein raakt
// en de aanroeper geen admin is (en geen interne systeemaanroep).
func controleerBeheerdomein(ctx context.Context, wijzigingen []model.WijzigingRequest) *RegistreerError {
	if middleware.MagBeheren(ctx) {
		return nil
	}
	for _, w := range wijzigingen {
		naam := ""
		if w.Opvoer != nil {
			naam = w.Opvoer.Representatienaam
		} else if w.Afvoer != nil {
			naam = w.Afvoer.Representatienaam
		}
		if meta, ok := model.MetaRegistry.GetTypeMeta(naam); ok && meta.Domein == middleware.DomeinBeheer {
			return newRegistreerErr(http.StatusForbidden, "gebruikers en rollen (domein %s) mag alleen een admin wijzigen", middleware.DomeinBeheer)
		}
	}
	return nil
}
