package api

import (
	"log"
	"net/http"
	"runtime/debug"
	"time"
)

// statusRecorder wraps http.ResponseWriter to capture the status code and the
// number of bytes written so the logging middleware can report them. It defaults
// to 200, matching net/http's behaviour when a handler writes a body without an
// explicit WriteHeader call.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	n, err := r.ResponseWriter.Write(b)
	r.bytes += n
	return n, err
}

// recoverMiddleware turns a panic in any HTTP handler into a 500 response
// instead of letting it unwind through net/http and crash the whole process.
// This matters here because the same process is mining: a stray nil-pointer in a
// request handler should never take down hours of accumulated mining work. The
// panic and its stack are logged so the bug is still visible.
func recoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic recovered in %s %s: %v\n%s", r.Method, r.URL.Path, rec, debug.Stack())
				// Only set the status if nothing has been written yet; once the
				// handler has started a response we can't change the code.
				if sr, ok := w.(*statusRecorder); ok && sr.status == 0 {
					http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				} else if !ok {
					http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				}
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// loggingMiddleware emits a structured access-log line for every request with
// the method, path, resulting status, response size and latency. It wraps the
// writer in a statusRecorder, which recoverMiddleware also relies on to decide
// whether a response has already been started.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w}
		next.ServeHTTP(rec, r)
		status := rec.status
		if status == 0 {
			status = http.StatusOK
		}
		log.Printf("%s %s %d %dB %s", r.Method, r.URL.Path, status, rec.bytes, time.Since(start).Round(time.Millisecond))
	})
}
