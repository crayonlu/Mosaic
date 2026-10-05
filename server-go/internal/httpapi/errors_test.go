package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// The envelope and status codes below are what installed clients already parse.
func TestWriteErrorEnvelope(t *testing.T) {
	cases := []struct {
		name        string
		err         error
		wantStatus  int
		wantError   string
		wantMessage string
	}{
		{
			name:        "unauthorized",
			err:         domain.Unauthorized(),
			wantStatus:  http.StatusUnauthorized,
			wantError:   "401 Unauthorized",
			wantMessage: "Authentication failed",
		},
		{
			name:        "invalid input",
			err:         domain.InvalidInput("Username cannot be empty"),
			wantStatus:  http.StatusBadRequest,
			wantError:   "400 Bad Request",
			wantMessage: "Invalid input: Username cannot be empty",
		},
		{
			name:        "not found",
			err:         domain.MemoNotFound(),
			wantStatus:  http.StatusNotFound,
			wantError:   "404 Not Found",
			wantMessage: "Memo not found",
		},
		{
			name:        "forbidden",
			err:         domain.Forbidden("Account is disabled"),
			wantStatus:  http.StatusForbidden,
			wantError:   "403 Forbidden",
			wantMessage: "Forbidden: Account is disabled",
		},
		{
			name:        "internal detail is hidden",
			err:         fmt.Errorf("connection reset by peer"),
			wantStatus:  http.StatusInternalServerError,
			wantError:   "500 Internal Server Error",
			wantMessage: "Internal server error",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			writeError(rec, httptest.NewRequest(http.MethodGet, "/api/memos", nil), tc.err)

			if rec.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", got)
			}

			var body errorBody
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decoding body %q: %v", rec.Body.String(), err)
			}
			if body.Error != tc.wantError {
				t.Errorf("error = %q, want %q", body.Error, tc.wantError)
			}
			if body.Message != tc.wantMessage {
				t.Errorf("message = %q, want %q", body.Message, tc.wantMessage)
			}
		})
	}
}

func TestWriteJSONHasNoTrailingNewline(t *testing.T) {
	rec := httptest.NewRecorder()
	WriteJSON(rec, http.StatusOK, healthResponse{Status: "ok", Version: "1.2.3"})

	want := `{"status":"ok","version":"1.2.3"}`
	if got := rec.Body.String(); got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}
