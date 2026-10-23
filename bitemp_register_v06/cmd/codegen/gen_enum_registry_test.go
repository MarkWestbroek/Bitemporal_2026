package main

import (
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

// De enum-registry bewaart de constantenamen per waarde (EnumConstNamen), zodat de exporter
// ze exact teruggeeft; een lege constNaam krijgt de standaardafleiding.
func TestWriteEnumRegistryEntries_ConstNamen(t *testing.T) {
	var b strings.Builder
	writeEnumRegistryEntries(&b, []model.V3Enum{{
		GoType: "IdeBestandFormaat", Domein: "ide-bestanden",
		Waarden: []model.V3EnumWaarde{
			{ConstNaam: "IdeBestandFormaatJSON", Waarde: "json"},
			{ConstNaam: "", Waarde: "go_code"},
		},
	}})
	got := b.String()
	want := `	EnumConstNamen["IdeBestandFormaat"] = map[string]string{"json": "IdeBestandFormaatJSON", "go_code": "IdeBestandFormaatgo_code"}` + "\n"
	if !strings.Contains(got, want) {
		t.Fatalf("verwacht:\n%s\nin:\n%s", want, got)
	}
	if !strings.Contains(got, `EnumWaarden["IdeBestandFormaat"] = []string{"json", "go_code"}`) {
		t.Fatalf("EnumWaarden ontbreekt:\n%s", got)
	}
}
