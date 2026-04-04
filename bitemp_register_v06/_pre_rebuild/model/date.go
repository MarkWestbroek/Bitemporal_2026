package model

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

const dateLayout = "2006-01-02"

// Date serializes as YYYY-MM-DD and stores as a SQL DATE.
type Date struct {
	time.Time
}

func NewDate(year int, month time.Month, day int) Date {
	return Date{Time: time.Date(year, month, day, 0, 0, 0, 0, time.UTC)}
}

func (d Date) String() string {
	if d.Time.IsZero() {
		return ""
	}
	return d.Time.Format(dateLayout)
}

func (d Date) MarshalJSON() ([]byte, error) {
	if d.Time.IsZero() {
		return []byte("null"), nil
	}
	return json.Marshal(d.Time.Format(dateLayout))
}

func (d *Date) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		if d != nil {
			d.Time = time.Time{}
		}
		return nil
	}

	var value string
	if err := json.Unmarshal(data, &value); err != nil {
		return fmt.Errorf("datum moet een string in formaat %s zijn: %w", dateLayout, err)
	}

	parsed, err := time.Parse(dateLayout, value)
	if err != nil {
		return fmt.Errorf("ongeldige datum %q, verwacht formaat %s: %w", value, dateLayout, err)
	}

	d.Time = parsed
	return nil
}

func (d Date) Value() (driver.Value, error) {
	if d.Time.IsZero() {
		return nil, nil
	}
	return d.Time.Format(dateLayout), nil
}

func (d *Date) Scan(src any) error {
	if src == nil {
		d.Time = time.Time{}
		return nil
	}

	switch value := src.(type) {
	case time.Time:
		d.Time = time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, time.UTC)
		return nil
	case string:
		parsed, err := time.Parse(dateLayout, value)
		if err != nil {
			return fmt.Errorf("kon datum-string %q niet parsen: %w", value, err)
		}
		d.Time = parsed
		return nil
	case []byte:
		parsed, err := time.Parse(dateLayout, string(value))
		if err != nil {
			return fmt.Errorf("kon datum-bytes %q niet parsen: %w", string(value), err)
		}
		d.Time = parsed
		return nil
	default:
		return fmt.Errorf("onbekend datumtype %T", src)
	}
}
