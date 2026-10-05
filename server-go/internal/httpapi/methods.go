package httpapi

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// methodOrder fixes the order the verbs appear in an Allow header.
var methodOrder = []string{
	http.MethodGet,
	http.MethodPost,
	http.MethodPut,
	http.MethodPatch,
	http.MethodDelete,
}

// serve mounts one handler per method on a path and answers the remaining verbs
// with 405 plus an Allow header naming the ones that are served.
//
// The previous server matched the path before the method, so a path that exists
// always answered 405 for a verb it does not serve. chi instead falls through
// to a parameterised sibling — PUT /memos/tags would land on PUT /memos/{id}
// and fail on the invalid parameter — and its own 405 lists only a subset of
// the allowed verbs. Registering the unsupported verbs explicitly restores both
// the status and the header.
//
// A GET route also answers HEAD, which is what the previous server did: the
// container healthcheck uses `wget --spider`, and that sends HEAD.
func serve(r chi.Router, pattern string, handlers map[string]http.HandlerFunc) {
	served := make([]string, 0, len(handlers))
	for _, method := range methodOrder {
		handler, ok := handlers[method]
		if !ok {
			continue
		}
		served = append(served, method)
		r.Method(method, pattern, handler)
	}

	// HEAD shares the GET handler; the HTTP server discards the body it writes.
	// The previous server's router answered HEAD for every GET route, and the
	// container healthcheck relies on it.
	if get, ok := handlers[http.MethodGet]; ok {
		r.Method(http.MethodHead, pattern, get)

		ordered := make([]string, 0, len(served)+1)
		for _, method := range served {
			ordered = append(ordered, method)
			if method == http.MethodGet {
				ordered = append(ordered, http.MethodHead)
			}
		}
		served = ordered
	}

	allow := strings.Join(served, ", ")

	notAllowed := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Allow", allow)
		w.WriteHeader(http.StatusMethodNotAllowed)
	})

	for _, method := range methodOrder {
		if _, ok := handlers[method]; ok {
			continue
		}
		r.Method(method, pattern, notAllowed)
	}
}
