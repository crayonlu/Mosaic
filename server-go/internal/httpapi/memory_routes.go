package httpapi

import (
	"github.com/go-chi/chi/v5"
	"net/http"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// registerMemoryRoutes mounts the memory endpoints. It is called from within
// the authenticated /api scope, so it adds no auth middleware of its own.
func registerMemoryRoutes(r chi.Router, memory *service.MemoryService) {
	serve(r, "/memory/stats", map[string]http.HandlerFunc{http.MethodGet: memoryStatsHandler(memory)})
	serve(r, "/memory/activity", map[string]http.HandlerFunc{http.MethodGet: memoryActivityHandler(memory)})
	serve(r, "/memory/context", map[string]http.HandlerFunc{http.MethodGet: memoryContextHandler(memory)})
	serve(r, "/memos/{id}/memory-contexts", map[string]http.HandlerFunc{http.MethodGet: memoMemoryContextsHandler(memory)})
}
