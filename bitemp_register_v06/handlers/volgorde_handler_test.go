package handlers

import (
	"reflect"
	"testing"
)

func TestTopologischeVolgorde(t *testing.T) {
	// 3 hangt af van 1 en 2; 2 van 1; 4 los; 5 van 9 (buiten de selectie, telt niet).
	volgorde, cyclus := TopologischeVolgorde([]int{5, 4, 3, 2, 1}, map[int][]int{3: {1, 2}, 2: {1}, 5: {9}})
	if cyclus != nil || !reflect.DeepEqual(volgorde, []int{1, 2, 3, 4, 5}) {
		t.Fatalf("volgorde = %v, cyclus = %v", volgorde, cyclus)
	}
	// Zelfverwijzing en dubbele afhankelijkheden zijn geen probleem.
	volgorde, cyclus = TopologischeVolgorde([]int{2, 1}, map[int][]int{2: {1, 1, 2}})
	if cyclus != nil || !reflect.DeepEqual(volgorde, []int{1, 2}) {
		t.Fatalf("volgorde = %v, cyclus = %v", volgorde, cyclus)
	}
	// Cyclus 1 → 2 → 3 → 1; 4 hangt af van 3 en komt dus ook niet vrij.
	volgorde, cyclus = TopologischeVolgorde([]int{1, 2, 3, 4, 5}, map[int][]int{1: {3}, 2: {1}, 3: {2}, 4: {3}})
	if volgorde != nil || !reflect.DeepEqual(cyclus, []int{1, 2, 3, 4}) {
		t.Fatalf("verwacht cyclus [1 2 3 4], kreeg volgorde %v cyclus %v", volgorde, cyclus)
	}
}
