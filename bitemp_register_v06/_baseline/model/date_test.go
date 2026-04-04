package model

import (
	"encoding/json"
	"testing"
	"time"
)

func TestDateMarshalJSON_UsesDateOnlyFormat(t *testing.T) {
	value := NewDate(2026, time.March, 15)

	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	if string(data) != `"2026-03-15"` {
		t.Fatalf("expected date-only json, got %s", string(data))
	}
}

func TestDateUnmarshalJSON_ParsesDateOnlyFormat(t *testing.T) {
	var value Date

	if err := json.Unmarshal([]byte(`"2026-03-15"`), &value); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	if value.String() != "2026-03-15" {
		t.Fatalf("expected parsed date 2026-03-15, got %s", value.String())
	}
}
