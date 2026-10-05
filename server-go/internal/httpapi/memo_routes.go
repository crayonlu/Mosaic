package httpapi

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

const html2llmTimeout = 30 * time.Second

// registerMemoRoutes mounts the memo endpoints. It is called from within the
// authenticated /api scope, so it adds no auth middleware of its own.
func registerMemoRoutes(
	r chi.Router,
	memos *service.MemoService,
	hybrid *service.HybridSearchService,
	embedder QueryEmbedder,
) {
	serve(r, "/memos", map[string]http.HandlerFunc{
		http.MethodPost: createMemoHandler(memos),
		http.MethodGet:  listMemosHandler(memos),
	})
	serve(r, "/memos/tags", map[string]http.HandlerFunc{
		http.MethodGet: listTagsHandler(memos),
	})
	serve(r, "/memos/search", map[string]http.HandlerFunc{
		http.MethodGet: searchMemosHandler(memos, hybrid, embedder),
	})
	serve(r, "/memos/date/{date}", map[string]http.HandlerFunc{
		http.MethodGet: memosByDateHandler(memos),
	})
	serve(r, "/memos/clip", map[string]http.HandlerFunc{
		http.MethodPost: clipHandler(memos),
	})

	serve(r, "/memos/{id}", map[string]http.HandlerFunc{
		http.MethodGet:    getMemoHandler(memos),
		http.MethodPut:    updateMemoHandler(memos),
		http.MethodDelete: deleteMemoHandler(memos),
	})
	serve(r, "/memos/{id}/detail", map[string]http.HandlerFunc{
		http.MethodGet: memoDetailHandler(memos),
	})
	serve(r, "/memos/{id}/revisions", map[string]http.HandlerFunc{
		http.MethodGet: revisionsHandler(memos),
	})
	serve(r, "/memos/{id}/revisions/{revisionID}", map[string]http.HandlerFunc{
		http.MethodDelete: deleteRevisionHandler(memos),
	})
	serve(r, "/memos/{id}/archive", map[string]http.HandlerFunc{
		http.MethodPut: archiveMemoHandler(memos),
	})
	serve(r, "/memos/{id}/unarchive", map[string]http.HandlerFunc{
		http.MethodPut: unarchiveMemoHandler(memos),
	})
}

// HTMLClipFetcher retrieves pages through the html2llm service. It lives in the
// HTTP package so that net/http stays out of the service layer, which depends
// only on the ClipFetcher interface.
type HTMLClipFetcher struct {
	client  *http.Client
	baseURL string
}

// NewHTMLClipFetcher builds a fetcher over the given HTTP client and html2llm
// base URL. Both are required so tests can inject an httptest server.
func NewHTMLClipFetcher(client *http.Client, baseURL string) *HTMLClipFetcher {
	return &HTMLClipFetcher{client: client, baseURL: strings.TrimRight(baseURL, "/")}
}

// Fetch requests the target page in headless mode and extracts its title from
// the returned CSX document.
func (f *HTMLClipFetcher) Fetch(ctx context.Context, target string) (service.ClipArticle, error) {
	ctx, cancel := context.WithTimeout(ctx, html2llmTimeout)
	defer cancel()

	separator := "?"
	if strings.Contains(target, "?") {
		separator = "&"
	}
	requestURL := f.baseURL + "/" + target + separator + "headless"

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return service.ClipArticle{}, domain.Internal(err)
	}

	response, err := f.client.Do(request)
	if err != nil {
		return service.ClipArticle{}, domain.Internal(fmt.Errorf("failed to fetch URL via html2llm: %w", err))
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return service.ClipArticle{}, domain.Internal(fmt.Errorf("html2llm returned status %d", response.StatusCode))
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return service.ClipArticle{}, domain.Internal(fmt.Errorf("failed to read html2llm response: %w", err))
	}

	title, ok := service.ExtractCSXTitle(string(body))
	if !ok {
		title = "Untitled"
	}
	return service.ClipArticle{Title: title, Content: string(body)}, nil
}
