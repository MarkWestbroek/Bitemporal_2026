package handlers

// registration_schrijffilter.go — het schrijffilter per account (middleware/schrijffilter.go,
// besluit Mark 25-11-2026) in de registratie-engine. Een account met een filter mag in een
// registratie alleen typen raken die op zijn patronen passen: bij opvoer en afvoer (ook de
// onderliggende GE's en relaties die genest in een opvoer zitten), bij een correctie, en bij een
// ongedaanmaking (dan de typen van de wijzigingen die ongedaan gemaakt worden).
//
// De controle zit in de engine (RegistreerCore), net als controleerBeheerdomein: dan geldt hij
// ongeacht de route. ControleerRol laat zo'n account bovendien alleen POST /registratie/ door.

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/middleware"
	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
	"github.com/uptrace/bun"
)

// controleerSchrijffilter weigert (403) als de aanroeper een schrijffilter heeft en de
// registratie een type raakt dat er niet op past. De melding noemt alle geweigerde typen.
func controleerSchrijffilter(ctx context.Context, tx bun.Tx, req *model.RegistreerRequest) *RegistreerError {
	account, patronen, beperkt := middleware.SchrijffilterUitContext(ctx)
	if !beperkt {
		return nil
	}
	typen := typenInWijzigingen(req.Wijzigingen)
	if req.Registratie.Registratietype == model.RegistratietypeOngedaanmaking && req.Registratie.MaaktOngedaanRegistratieID != nil {
		var rijen []model.Wijziging
		if err := tx.NewSelect().Model(&rijen).
			Where("registratie_id = ?", *req.Registratie.MaaktOngedaanRegistratieID).
			Scan(ctx); err != nil {
			return newRegistreerErr(http.StatusInternalServerError, "schrijffilter: wijzigingen van registratie %d lezen mislukt: %v", *req.Registratie.MaaktOngedaanRegistratieID, err)
		}
		for _, w := range rijen {
			typen = append(typen, typeVanWijzigingRij(w))
		}
	}
	return weigerBuitenFilter(account, patronen, typen)
}

// weigerBuitenFilter geeft de 403 als een of meer typen niet op de patronen passen.
func weigerBuitenFilter(account string, patronen, typen []string) *RegistreerError {
	gezien := map[string]bool{}
	var buiten []string
	for _, t := range typen {
		if t == "" || gezien[strings.ToLower(t)] {
			continue
		}
		gezien[strings.ToLower(t)] = true
		if !middleware.TypeToegestaan(patronen, t) {
			buiten = append(buiten, t)
		}
	}
	if len(buiten) == 0 {
		return nil
	}
	sort.Strings(buiten)
	toegestaan := strings.Join(patronen, ", ")
	if toegestaan == "" {
		toegestaan = "niets (het schrijffilter is ongeldig)"
	}
	msg := fmt.Sprintf("account %s mag deze typen niet schrijven: %s (toegestaan: %s)",
		account, strings.Join(buiten, ", "), toegestaan)
	// RFC 9457, zoals de 422 van de validatie (registration_decodefout.go): code "schrijffilter"
	// en per geweigerd type één invalidParams-regel met de typenaam als name.
	params := make([]model.InvalidParam, 0, len(buiten))
	for _, t := range buiten {
		params = append(params, model.InvalidParam{
			Name:   t,
			Code:   "type_niet_toegestaan",
			Reason: fmt.Sprintf("%s valt niet onder het schrijffilter van %s (toegestaan: %s)", t, account, toegestaan),
		})
	}
	return &RegistreerError{
		Status: http.StatusForbidden,
		Msg:    msg,
		Problem: &model.ProblemDetails{
			Type:          "https://api.bitemporeel/problemen/schrijffilter",
			Title:         "Schrijffilter",
			Status:        http.StatusForbidden,
			Detail:        msg,
			Instance:      middleware.SchrijffilterRoute,
			Code:          "schrijffilter",
			InvalidParams: params,
		},
	}
}

// typenInWijzigingen verzamelt de typenamen van alle opvoeren en afvoeren, met de onderliggende
// GE's en relaties die genest in een representatie zitten (recursief).
func typenInWijzigingen(wijzigingen []model.WijzigingRequest) []string {
	var typen []string
	var loop func(naam string, rep any)
	loop = func(naam string, rep any) {
		typen = append(typen, naam)
		if ouder, ok := rep.(model.HeeftOnderliggendeGegevenselementen); ok && rep != nil {
			for _, kind := range ouder.GeefOnderliggendeGegevenselementen() {
				loop(kind.Typenaam, kind.Representatie)
			}
		}
	}
	for _, w := range wijzigingen {
		for _, r := range []*model.RepresentatiePlusNaam{w.Opvoer, w.Afvoer} {
			if r != nil {
				loop(r.Representatienaam, r.Representatie)
			}
		}
	}
	return typen
}

// typeVanWijzigingRij: het type dat een opgeslagen wijziging raakt (een GE of relatie heeft een
// representatienaam; een wijziging op de entiteit zelf alleen een entiteitnaam).
func typeVanWijzigingRij(w model.Wijziging) string {
	if w.Representatienaam != "" {
		return w.Representatienaam
	}
	return w.Entiteitnaam
}
