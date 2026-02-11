package model

import (
	"reflect"
	"testing"
	"time"
)

func TestEqualPrimitives(t *testing.T) {
	if !Equal[string]("x", "x") {
		t.Fatal("expected strings to be equal")
	}
	if Equal[int](1, 2) {
		t.Fatal("expected ints to be not equal")
	}
}

func TestEqualStructComparablePointers(t *testing.T) {
	now := time.Now()
	copyNow := now

	a1 := A{ID: "1", Opvoer: &now, Afvoer: nil}
	a2 := A{ID: "1", Opvoer: &now, Afvoer: nil}
	// same pointer address -> Equal should be true
	if !Equal(a1, a2) {
		t.Fatalf("expected a1 == a2 (same pointer): %#v %#v", a1, a2)
	}

	a3 := A{ID: "1", Opvoer: &copyNow, Afvoer: nil}
	// different pointer addresses (but same time value) -> Equal is false because pointers are compared by address
	if Equal(a1, a3) {
		t.Fatalf("expected a1 != a3 (different pointer addresses): %#v %#v", a1, a3)
	}

	// reflect.DeepEqual compares values recursively and thus will report equal in this case
	if !reflect.DeepEqual(a1, a3) {
		t.Fatalf("expected reflect.DeepEqual(a1, a3) to be true: %#v %#v", a1, a3)
	}
}

func TestEqualForB(t *testing.T) {
	now := time.Now()
	b1 := B{ID: "b1", Opvoer: &now}
	b2 := B{ID: "b1", Opvoer: &now}
	if !Equal(b1, b2) {
		t.Fatal("expected b1 == b2")
	}
}
