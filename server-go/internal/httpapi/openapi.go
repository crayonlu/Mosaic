package httpapi

import (
	"bytes"
	_ "embed"
	"net/http"
	"time"
)

//go:embed openapi.json
var openAPISpec []byte

func handleOpenAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeContent(w, r, "openapi.json", time.Time{}, bytes.NewReader(openAPISpec))
}
