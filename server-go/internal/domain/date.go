package domain

import (
	"encoding/json"
	"fmt"
	"time"
)

// DateLayout is the wire format for calendar dates.
const DateLayout = "2006-01-02"

// Date is a calendar day without a time or zone, serialized as YYYY-MM-DD.
type Date struct {
	time.Time
}

// NewDate truncates a timestamp to its calendar day in UTC.
func NewDate(t time.Time) Date {
	return Date{time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)}
}

// ParseDate reads a YYYY-MM-DD string.
func ParseDate(value string) (Date, error) {
	parsed, err := time.Parse(DateLayout, value)
	if err != nil {
		return Date{}, InvalidInputf("invalid date %q, expected YYYY-MM-DD", value)
	}
	return Date{parsed}, nil
}

func (d Date) String() string { return d.Format(DateLayout) }

func (d Date) MarshalJSON() ([]byte, error) {
	return json.Marshal(d.String())
}

func (d *Date) UnmarshalJSON(data []byte) error {
	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("date must be a string: %w", err)
	}
	parsed, err := ParseDate(raw)
	if err != nil {
		return err
	}
	*d = parsed
	return nil
}

// StringOrNil renders an optional date for a response payload.
func StringOrNil(d *Date) *string {
	if d == nil {
		return nil
	}
	rendered := d.String()
	return &rendered
}
