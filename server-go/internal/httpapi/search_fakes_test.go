package httpapi

import (
	"context"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// fakeHybridStore serves the two retrieval legs from memory and records the
// filter it was handed, so a test can assert what the handler asked for.
type fakeHybridStore struct {
	hits []domain.HybridHit
	err  error
	seen []domain.HybridSearchFilter
}

func (f *fakeHybridStore) Search(
	_ context.Context,
	_ uuid.UUID,
	filter domain.HybridSearchFilter,
) ([]domain.HybridHit, error) {
	f.seen = append(f.seen, filter)
	if f.err != nil {
		return nil, f.err
	}
	return f.hits, nil
}

// stubEmbedder stands in for the provider boundary. An empty embedding (or an
// error) makes the handler fall back to the keyword search.
type stubEmbedder struct {
	embedding []float32
	err       error
	calls     int
	lastText  string
}

func (s *stubEmbedder) EmbedQuery(_ context.Context, text string) ([]float32, error) {
	s.calls++
	s.lastText = text
	return s.embedding, s.err
}

// defaultHybridService is what routers under test get when a case is not about
// search: a store with no hits and an embedder that produces nothing.
func defaultHybridService() *service.HybridSearchService {
	return service.NewHybridSearchService(&fakeHybridStore{}, nil)
}
