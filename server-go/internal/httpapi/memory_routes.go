package httpapi

import (
	"github.com/go-chi/chi/v5"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// registerMemoryRoutes mounts the memory endpoints. It is called from within
// the authenticated /api scope, so it adds no auth middleware of its own.
func registerMemoryRoutes(r chi.Router, memory *service.MemoryService) {
	r.Get("/memory/stats", memoryStatsHandler(memory))
	r.Get("/memory/activity", memoryActivityHandler(memory))
	r.Get("/memory/context", memoryContextHandler(memory))
	r.Get("/memos/{id}/memory-contexts", memoMemoryContextsHandler(memory))
}
