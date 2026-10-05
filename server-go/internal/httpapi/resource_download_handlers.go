package httpapi

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

func handleDownloadResource(resources *service.ResourceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		resourceID, err := resourceIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}

		variant := r.URL.Query().Get("variant")
		if variant == "" {
			variant = "original"
		}
		download, err := resources.DownloadVariant(r.Context(), userID, resourceID, variant)
		if err != nil {
			writeError(w, r, err)
			return
		}
		writeDownload(w, r, download, variantCacheHeaders(variant))
	}
}

func handleDownloadThumbnail(resources *service.ResourceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := callerID(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		resourceID, err := resourceIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		download, err := resources.DownloadThumbnail(r.Context(), userID, resourceID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		writeDownload(w, r, download, variantCacheHeaders("thumb"))
	}
}

func handleDownloadAvatar(resources *service.ResourceService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, err := callerID(r); err != nil {
			writeError(w, r, err)
			return
		}
		avatarID, err := resourceIDParam(r)
		if err != nil {
			writeError(w, r, err)
			return
		}
		download, err := resources.DownloadAvatar(r.Context(), avatarID)
		if err != nil {
			writeError(w, r, err)
			return
		}
		writeDownload(w, r, download, avatarCacheHeaders())
	}
}

// cacheHeader is one response header a download sets.
type cacheHeader struct{ name, value string }

func variantCacheHeaders(variant string) []cacheHeader {
	switch variant {
	case "thumb":
		return []cacheHeader{
			{"Cache-Control", "private, max-age=86400"},
			{"Vary", "Authorization"},
		}
	case "opt":
		return []cacheHeader{
			{"Cache-Control", "private, max-age=2592000"},
			{"Vary", "Authorization"},
		}
	default:
		return []cacheHeader{
			{"Cache-Control", "private, max-age=31536000"},
			{"Vary", "Authorization"},
		}
	}
}

func avatarCacheHeaders() []cacheHeader {
	return []cacheHeader{
		{"Cache-Control", "private, max-age=3600"},
		{"Vary", "Authorization"},
	}
}

// writeDownload serves a blob with the previous server's caching, ETag, and
// single-range semantics.
func writeDownload(w http.ResponseWriter, r *http.Request, download *service.Download, cache []cacheHeader) {
	etag := generateETag(download.Data)
	w.Header().Set("ETag", etag)
	for _, header := range cache {
		w.Header().Set(header.name, header.value)
	}

	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set("Content-Type", download.MimeType)
	w.Header().Set("Accept-Ranges", "bytes")

	if rangeHeader := r.Header.Get("Range"); rangeHeader != "" {
		start, end, ok := parseRange(rangeHeader, len(download.Data))
		if !ok {
			w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", len(download.Data)))
			w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
			return
		}
		chunk := download.Data[start : end+1]
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, len(download.Data)))
		w.Header().Set("Content-Length", strconv.Itoa(len(chunk)))
		w.WriteHeader(http.StatusPartialContent)
		if _, err := w.Write(chunk); err != nil {
			return
		}
		return
	}

	w.Header().Set("Content-Length", strconv.Itoa(len(download.Data)))
	w.WriteHeader(http.StatusOK)
	if _, err := w.Write(download.Data); err != nil {
		return
	}
}

func generateETag(data []byte) string {
	sum := sha256.Sum256(data)
	return `"` + hex.EncodeToString(sum[:]) + `"`
}

// parseRange understands a single "bytes=" range, including suffix ranges.
func parseRange(header string, size int) (int, int, bool) {
	raw, ok := strings.CutPrefix(header, "bytes=")
	if !ok || size == 0 {
		return 0, 0, false
	}
	startRaw, endRaw, ok := strings.Cut(raw, "-")
	if !ok {
		return 0, 0, false
	}
	if startRaw == "" {
		suffix, err := strconv.Atoi(endRaw)
		if err != nil || suffix == 0 {
			return 0, 0, false
		}
		start := size - suffix
		if start < 0 {
			start = 0
		}
		return start, size - 1, true
	}
	start, err := strconv.Atoi(startRaw)
	if err != nil || start >= size {
		return 0, 0, false
	}
	end := size - 1
	if endRaw != "" {
		parsed, err := strconv.Atoi(endRaw)
		if err != nil {
			return 0, 0, false
		}
		if parsed < end {
			end = parsed
		}
	}
	if start > end {
		return 0, 0, false
	}
	return start, end, true
}
