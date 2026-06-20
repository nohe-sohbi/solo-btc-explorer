package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/soloforge/backend/internal/config"
	"github.com/soloforge/backend/internal/miner"
	"github.com/soloforge/backend/internal/stats"
	"github.com/soloforge/backend/internal/stratum"
)

// newTestServerWithOrigins builds a server with an explicit CORS/WS allowlist.
func newTestServerWithOrigins(t *testing.T, origins []string) *Server {
	t.Helper()
	cfg := config.DefaultConfig()
	st := stratum.NewClient(cfg.PoolURL, cfg.PoolPort)
	mgr := miner.NewManager()
	col := stats.NewCollector(100)
	return NewServer(cfg, st, mgr, col, origins)
}

func TestHandleHealthz(t *testing.T) {
	s := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	s.handleHealthz(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("healthz status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "ok") {
		t.Fatalf("healthz body = %q, want it to contain \"ok\"", rec.Body.String())
	}
}

func TestHandleHealthzRejectsPost(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	rec := httptest.NewRecorder()
	s.handleHealthz(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestHandleReadyzNotReadyWhenDisconnected(t *testing.T) {
	s := newTestServer(t) // never connects to a pool in tests

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()
	s.handleReadyz(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("readyz status = %d, want 503 when pool is down", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "\"ready\":false") {
		t.Fatalf("readyz body = %q, want ready:false", rec.Body.String())
	}
}

func TestCORSDefaultIsPermissive(t *testing.T) {
	s := newTestServer(t) // nil origins -> allow all
	handler := s.GetHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	req.Header.Set("Origin", "https://anything.example")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("Access-Control-Allow-Origin = %q, want \"*\"", got)
	}
}

func TestCORSRestrictedReflectsAllowedOrigin(t *testing.T) {
	s := newTestServerWithOrigins(t, []string{"https://dash.example"})
	handler := s.GetHandler()

	// Allowed origin is echoed back (not "*").
	req := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	req.Header.Set("Origin", "https://dash.example")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://dash.example" {
		t.Fatalf("allowed origin not reflected: got %q", got)
	}

	// Disallowed origin gets no CORS grant.
	req2 := httptest.NewRequest(http.MethodGet, "/api/status", nil)
	req2.Header.Set("Origin", "https://evil.example")
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if got := rec2.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("disallowed origin should get no ACAO header, got %q", got)
	}
}

func TestCORSPreflightShortCircuits(t *testing.T) {
	s := newTestServer(t)
	handler := s.GetHandler()

	req := httptest.NewRequest(http.MethodOptions, "/api/config", nil)
	req.Header.Set("Origin", "https://anything.example")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("preflight status = %d, want 200", rec.Code)
	}
}
