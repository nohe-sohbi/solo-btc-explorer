package api

import (
	"bufio"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecoverMiddlewareTurnsPanicInto500(t *testing.T) {
	// Silence the panic log so test output stays clean, then restore it.
	prev := log.Writer()
	log.SetOutput(io.Discard)
	defer log.SetOutput(prev)

	panicky := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("boom")
	})

	// Mirror the production chain so the statusRecorder interplay is exercised.
	handler := loggingMiddleware(recoverMiddleware(panicky))

	req := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	rec := httptest.NewRecorder()

	// The key guarantee: ServeHTTP returns normally rather than re-panicking and
	// crashing the process.
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

func TestRecoverMiddlewarePassesThroughOK(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		w.Write([]byte("hello"))
	})
	handler := loggingMiddleware(recoverMiddleware(ok))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTeapot {
		t.Fatalf("status = %d, want 418", rec.Code)
	}
	if rec.Body.String() != "hello" {
		t.Fatalf("body = %q, want %q", rec.Body.String(), "hello")
	}
}

func TestStatusRecorderDefaultsAndCounts(t *testing.T) {
	rec := httptest.NewRecorder()
	sr := &statusRecorder{ResponseWriter: rec}
	n, err := sr.Write([]byte("abcd"))
	if err != nil {
		t.Fatalf("write error: %v", err)
	}
	if n != 4 || sr.bytes != 4 {
		t.Fatalf("byte count = %d (recorder %d), want 4", n, sr.bytes)
	}
}

func TestServerHandlerRecoversAcrossFullChain(t *testing.T) {
	// A panic surfacing through the real server handler chain must not escape.
	prev := log.Writer()
	log.SetOutput(io.Discard)
	defer log.SetOutput(prev)

	s := newTestServer(t)
	// Register a route that panics to prove the wired-up chain protects the miner.
	s.mux.HandleFunc("/api/_boom", func(w http.ResponseWriter, r *http.Request) {
		panic("kaboom")
	})

	req := httptest.NewRequest(http.MethodGet, "/api/_boom", nil)
	rec := httptest.NewRecorder()
	s.GetHandler().ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Internal Server Error") {
		t.Fatalf("body = %q, want a 500 message", rec.Body.String())
	}
}

// hijackableWriter is a ResponseWriter that supports connection takeover, like
// the real server's.
type hijackableWriter struct {
	*httptest.ResponseRecorder
	hijacked bool
}

func (h *hijackableWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h.hijacked = true
	return nil, nil, nil
}

func TestStatusRecorderStillAllowsWebSocketUpgrades(t *testing.T) {
	inner := &hijackableWriter{ResponseRecorder: httptest.NewRecorder()}
	rec := &statusRecorder{ResponseWriter: inner}

	if _, _, err := rec.Hijack(); err != nil {
		t.Fatalf("Hijack through the recorder failed: %v", err)
	}
	if !inner.hijacked {
		t.Fatal("the underlying writer was not asked to hijack")
	}
	if rec.status != http.StatusSwitchingProtocols {
		t.Fatalf("expected the upgrade to be logged as 101, got %d", rec.status)
	}
}

func TestStatusRecorderHijackFailsCleanlyWhenUnsupported(t *testing.T) {
	rec := &statusRecorder{ResponseWriter: httptest.NewRecorder()}
	if _, _, err := rec.Hijack(); err == nil {
		t.Fatal("expected an error when the underlying writer cannot hijack")
	}
}

func TestLoggingMiddlewareKeepsWebSocketHandlersWorking(t *testing.T) {
	var sawHijacker bool
	handler := loggingMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, sawHijacker = w.(http.Hijacker)
	}))
	handler.ServeHTTP(&hijackableWriter{ResponseRecorder: httptest.NewRecorder()}, httptest.NewRequest(http.MethodGet, "/ws", nil))
	if !sawHijacker {
		t.Fatal("handlers behind the logging middleware must still see an http.Hijacker (required by /ws)")
	}
}
