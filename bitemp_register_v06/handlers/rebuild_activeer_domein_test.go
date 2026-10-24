package handlers

import (
	"reflect"
	"testing"
)

func TestDomeinenVanModel(t *testing.T) {
	m := []byte(`{"entiteiten":[{"typenaam":"A","domein":"inrichting"},{"typenaam":"B","domein":"register"},{"typenaam":"C","domein":" inrichting "},{"typenaam":"D"}]}`)
	if got := domeinenVanModel(m); !reflect.DeepEqual(got, []string{"inrichting", "register"}) {
		t.Fatalf("domeinen = %v", got)
	}
	if got := domeinenVanModel([]byte("geen json")); got != nil {
		t.Fatalf("ongeldige JSON: %v", got)
	}
}
