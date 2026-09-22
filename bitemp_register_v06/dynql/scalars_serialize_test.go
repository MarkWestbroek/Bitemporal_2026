package dynql

// Datum-scalars moeten ook tekst accepteren: de resolvers zetten entiteiten om via een
// JSON-roundtrip (entityToMap), waardoor datums als string binnenkomen. Tot 22-09-2026
// gaven alle datum- en tijdvelden in GraphQL daardoor null.

import (
	"testing"
	"time"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestDateScalarSerialize(t *testing.T) {
	d := model.Date{Time: time.Date(2020, 3, 12, 0, 0, 0, 0, time.UTC)}
	tests := []struct {
		naam     string
		in       interface{}
		verwacht interface{}
	}{
		{"model.Date", d, "2020-03-12"},
		{"*model.Date", &d, "2020-03-12"},
		{"string uit JSON", "2020-03-12", "2020-03-12"},
		{"lege string", "", nil},
		{"nul-datum", model.Date{}, nil},
		{"onbekend type", 42, nil},
	}
	for _, tt := range tests {
		if got := DateScalar.Serialize(tt.in); got != tt.verwacht {
			t.Errorf("%s: Serialize(%v) = %v, verwacht %v", tt.naam, tt.in, got, tt.verwacht)
		}
	}
}

func TestDateTimeScalarSerialize(t *testing.T) {
	tm := time.Date(2026, 1, 1, 8, 0, 0, 8000, time.UTC)
	if got := DateTimeScalar.Serialize(tm); got != "2026-01-01T08:00:00Z" {
		t.Errorf("time.Time: %v", got)
	}
	if got := DateTimeScalar.Serialize("2026-01-01T08:00:00.000008Z"); got != "2026-01-01T08:00:00.000008Z" {
		t.Errorf("string uit JSON: %v", got)
	}
	if got := DateTimeScalar.Serialize(""); got != nil {
		t.Errorf("lege string: %v", got)
	}
}
