package httpapi

import "net/http"

// Version is the reported build version, set at link time with
// -ldflags "-X github.com/crayonlu/mosaic/server-go/internal/httpapi.Version=..."
var Version = "dev"

type healthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	WriteJSON(w, http.StatusOK, healthResponse{Status: "ok", Version: Version})
}
