package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-playground/validator/v10"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

var validate = validator.New(validator.WithRequiredStructEnabled())

// decodeJSON parses a request body and enforces the destination's validation
// tags. Both failures are reported as invalid input.
func decodeJSON(r *http.Request, dst any) error {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return domain.InvalidInput("Malformed JSON body")
	}
	if err := validate.Struct(dst); err != nil {
		return domain.InvalidInput(validationDetail(err))
	}
	return nil
}

// validationDetail renders the first field violation as a readable phrase.
func validationDetail(err error) string {
	var invalid *validator.InvalidValidationError
	if errors.As(err, &invalid) {
		return "Invalid request body"
	}

	var violations validator.ValidationErrors
	if !errors.As(err, &violations) || len(violations) == 0 {
		return "Invalid request body"
	}

	violation := violations[0]
	field := lowerFirst(violation.Field())
	if violation.Tag() == "required" {
		return fmt.Sprintf("%s is required", field)
	}
	return fmt.Sprintf("%s is invalid", field)
}

func lowerFirst(value string) string {
	if value == "" {
		return value
	}
	return strings.ToLower(value[:1]) + value[1:]
}
