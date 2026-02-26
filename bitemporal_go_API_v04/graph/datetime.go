package graph

import (
	"fmt"
	"time"
)

// MarshalDateTime marshals a time.Time to a string for GraphQL
func MarshalDateTime(t time.Time) string {
	return t.Format(time.RFC3339)
}

// UnmarshalDateTime unmarshals a string to a time.Time from GraphQL
func UnmarshalDateTime(v interface{}) (time.Time, error) {
	switch v := v.(type) {
	case string:
		return time.Parse(time.RFC3339, v)
	default:
		return time.Time{}, fmt.Errorf("invalid DateTime value: %v", v)
	}
}
