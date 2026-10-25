package handlers

// registration_decodefout.go — een waarde die al bij het decoderen van POST /registratie/ strandt
// (een tijdstip of datum die niet te parsen is, een getal waar tekst staat) als 422 problem+json
// met veldpad, in dezelfde vorm als de validatiefouten (model.BuildProblemDetails).
//
// Tot 25-10-2026 gaf dit een kale 400 met de Go-fout ("parsing time \"gisteren\" as …"), zodat een
// afnemer (de aanvraagservice op Fundament) niet kon zien welk veld fout was. Het decoderen gebeurt
// vóór de validatie, dus de Go-fout kent het veld niet; het veldpad wordt teruggezocht in de ruwe
// wijzigingen aan de hand van de foute waarde (tijdstip/datum) of de veldnaam (typefout).

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// decodeFoutAlsProbleem geeft een 422-RegistreerError voor een herkende waardefout, anders nil
// (dan blijft de bestaande 400).
func decodeFoutAlsProbleem(err error, wijzigingen json.RawMessage, instance string) *RegistreerError {
	var param model.InvalidParam
	var pe *time.ParseError
	var te *json.UnmarshalTypeError
	switch {
	case errors.As(err, &pe):
		param = model.InvalidParam{Code: "format", Value: pe.Value}
		if strings.Contains(err.Error(), "ongeldige datum") {
			param.Reason = "geen geldige datum (verwacht JJJJ-MM-DD, bv. 2026-10-25)"
		} else {
			param.Reason = "geen geldig tijdstip (verwacht RFC 3339, bv. 2026-10-25T10:00:00Z)"
		}
		param.Name = zoekVeldpad(wijzigingen, func(_ string, v any) bool { s, ok := v.(string); return ok && s == pe.Value })
	case errors.As(err, &te):
		veld := te.Field
		if i := strings.LastIndex(veld, "."); i >= 0 {
			veld = veld[i+1:]
		}
		param = model.InvalidParam{Code: "type", Reason: fmt.Sprintf("verwacht %s, kreeg %s", te.Type.String(), te.Value)}
		if veld != "" {
			param.Name = zoekVeldpad(wijzigingen, func(k string, _ any) bool { return k == veld })
		}
		if param.Name == "" {
			param.Name = veld
		}
	default:
		return nil
	}
	if param.Name == "" {
		param.Name = "wijzigingen"
	}
	return &RegistreerError{
		Status: http.StatusUnprocessableEntity,
		Msg:    err.Error(),
		Problem: &model.ProblemDetails{
			Type:          "https://api.bitemporeel/problemen/validatie",
			Title:         "Validatiefout",
			Status:        http.StatusUnprocessableEntity,
			Detail:        "1 veldfout(en) gevonden tijdens validatie",
			Instance:      instance,
			Code:          "validation_error",
			InvalidParams: []model.InvalidParam{param},
		},
	}
}

// zoekVeldpad zoekt in de ruwe wijzigingen het eerste blad (sleutel + waarde) dat aan past voldoet,
// en geeft het pad in de vorm van de validatiefouten: wijzigingen[i].<representatie>.<veld> (het
// niveau opvoer/afvoer valt weg). Leeg als niets past.
func zoekVeldpad(wijzigingen json.RawMessage, past func(sleutel string, waarde any) bool) string {
	var lijst []map[string]any
	if json.Unmarshal(wijzigingen, &lijst) != nil {
		return ""
	}
	var zoek func(pad string, v any) string
	zoek = func(pad string, v any) string {
		switch t := v.(type) {
		case map[string]any:
			sleutels := make([]string, 0, len(t))
			for k := range t {
				sleutels = append(sleutels, k)
			}
			sort.Strings(sleutels)
			for _, k := range sleutels {
				switch t[k].(type) {
				case map[string]any, []any:
				default:
					if past(k, t[k]) {
						return pad + "." + k
					}
				}
			}
			for _, k := range sleutels {
				if p := zoek(pad+"."+k, t[k]); p != "" {
					return p
				}
			}
		case []any:
			for i, kind := range t {
				if p := zoek(fmt.Sprintf("%s[%d]", pad, i), kind); p != "" {
					return p
				}
			}
		}
		return ""
	}
	for i, w := range lijst {
		for _, soort := range []string{"opvoer", "afvoer"} {
			if p := zoek(fmt.Sprintf("wijzigingen[%d]", i), w[soort]); p != "" {
				return p
			}
		}
	}
	return ""
}
