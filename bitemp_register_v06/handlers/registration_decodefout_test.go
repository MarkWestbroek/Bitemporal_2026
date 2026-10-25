package handlers

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestDecodeFoutAlsProbleem(t *testing.T) {
	wijzigingen := json.RawMessage(`[
		{"opvoer": {"aanvraag": {"id": 1}}},
		{"opvoer": {"aanvraagindiening": {"aanvraag_id": 1, "ingediendOp": "gisteren"}}},
		{"opvoer": {"aanvraagstatus": {"aanvraag_id": 1, "aanvang": "25-10-2026", "volgnummer": "drie"}}}
	]`)
	decodeer := func(doel any, js string) error { return json.Unmarshal([]byte(js), doel) }

	var tijd struct {
		IngediendOp time.Time `json:"ingediendOp"`
	}
	var datum struct {
		Aanvang model.Date `json:"aanvang"`
	}
	var getal struct {
		Volgnummer int `json:"volgnummer"`
	}
	gevallen := []struct {
		naam      string
		err       error
		pad, code string
	}{
		{"tijdstip", decodeer(&tijd, `{"ingediendOp":"gisteren"}`), "wijzigingen[1].aanvraagindiening.ingediendOp", "format"},
		{"datum", decodeer(&datum, `{"aanvang":"25-10-2026"}`), "wijzigingen[2].aanvraagstatus.aanvang", "format"},
		{"type", decodeer(&getal, `{"volgnummer":"drie"}`), "wijzigingen[2].aanvraagstatus.volgnummer", "type"},
	}
	for _, g := range gevallen {
		if g.err == nil {
			t.Fatalf("%s: verwacht een decodeerfout", g.naam)
		}
		p := decodeFoutAlsProbleem(g.err, wijzigingen, "/registratie/")
		if p == nil || p.Status != http.StatusUnprocessableEntity || p.Problem == nil || len(p.Problem.InvalidParams) != 1 {
			t.Fatalf("%s: verwacht 422 met één invalidParam, kreeg %+v", g.naam, p)
		}
		ip := p.Problem.InvalidParams[0]
		if ip.Name != g.pad || ip.Code != g.code {
			t.Errorf("%s: invalidParam = %+v, verwacht pad %s code %s", g.naam, ip, g.pad, g.code)
		}
	}
	if p := decodeFoutAlsProbleem(json.Unmarshal([]byte(`{`), &getal), wijzigingen, "/registratie/"); p != nil {
		t.Errorf("syntaxfout hoort 400 te blijven, kreeg %+v", p)
	}
}
