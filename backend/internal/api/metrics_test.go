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

func newTestServer(t *testing.T) *Server {
	t.Helper()
	cfg := config.DefaultConfig()
	st := stratum.NewClient(cfg.PoolURL, cfg.PoolPort)
	mgr := miner.NewManager()
	col := stats.NewCollector(100)
	return NewServer(cfg, st, mgr, col)
}

func TestRenderMetricsFormat(t *testing.T) {
	out := renderMetrics([]metric{
		{"soloforge_b_metric", "Second metric.", "gauge", 1.5},
		{"soloforge_a_metric", "First metric.", "counter", 42},
	})

	// Metrics must be emitted in sorted order regardless of input order.
	aIdx := strings.Index(out, "soloforge_a_metric 42")
	bIdx := strings.Index(out, "soloforge_b_metric 1.5")
	if aIdx == -1 || bIdx == -1 {
		t.Fatalf("metric samples missing in output:\n%s", out)
	}
	if aIdx > bIdx {
		t.Fatalf("metrics not sorted alphabetically:\n%s", out)
	}

	// HELP and TYPE lines must precede their sample.
	if !strings.Contains(out, "# HELP soloforge_a_metric First metric.") {
		t.Fatalf("missing HELP line:\n%s", out)
	}
	if !strings.Contains(out, "# TYPE soloforge_a_metric counter") {
		t.Fatalf("missing TYPE line:\n%s", out)
	}
}

func TestHandleMetricsEndpoint(t *testing.T) {
	s := newTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rec := httptest.NewRecorder()
	s.handleMetrics(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/plain") {
		t.Fatalf("content-type = %q, want text/plain", ct)
	}

	body := rec.Body.String()
	for _, name := range []string{
		"soloforge_hashrate_hashes_per_second",
		"soloforge_shares_total",
		"soloforge_pool_connected",
		"soloforge_workers",
		"soloforge_ws_clients",
	} {
		if !strings.Contains(body, name) {
			t.Fatalf("metric %q missing from output:\n%s", name, body)
		}
	}
}

func TestHandleMetricsRejectsPost(t *testing.T) {
	s := newTestServer(t)

	req := httptest.NewRequest(http.MethodPost, "/metrics", nil)
	rec := httptest.NewRecorder()
	s.handleMetrics(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestBoolToFloat(t *testing.T) {
	if boolToFloat(true) != 1 || boolToFloat(false) != 0 {
		t.Fatalf("boolToFloat conversion wrong")
	}
}
