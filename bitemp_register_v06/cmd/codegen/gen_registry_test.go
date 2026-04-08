package main

import (
	"strings"
	"testing"

	"github.com/MarkWestbroek/Bitemporal_2026/bitemp_register_v06/model"
)

func TestWriteLayoutLine_WritesUseEdgesZonderPositie(t *testing.T) {
	var b strings.Builder

	writeLayoutLine(&b, &layoutInfo{
		UseEdges: []model.V3UseEdge{{
			Doel:         "StatusEnum",
			ID:           "Voorbeeld_Status-->StatusEnum",
			SourceHandle: "right",
			TargetHandle: "left",
			Hidden:       true,
		}},
	})

	got := b.String()
	wants := []string{
		"Layout: &EditorLayout{",
		"UseEdges: []V3UseEdge{",
		`Doel: "StatusEnum"`,
		`ID: "Voorbeeld_Status-->StatusEnum"`,
		`SourceHandle: "right"`,
		`TargetHandle: "left"`,
		"Hidden: true",
	}

	for _, want := range wants {
		if !strings.Contains(got, want) {
			t.Fatalf("verwacht %q in output, kreeg:\n%s", want, got)
		}
	}
}
