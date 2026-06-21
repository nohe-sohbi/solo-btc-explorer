package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandleExportSharesCSV(t *testing.T) {
	s := newTestServer(t)
	s.stats.AddShare(1, "worker-a", "job1", "deadbeef", 1.5, true)
	s.stats.AddShare(2, "worker-b", "job2", "cafebabe", 2.5, false)

	req := httptest.NewRequest(http.MethodGet, "/api/export?dataset=shares&format=csv", nil)
	rec := httptest.NewRecorder()
	s.handleExport(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/csv") {
		t.Fatalf("Content-Type = %q, want text/csv", ct)
	}
	if cd := rec.Header().Get("Content-Disposition"); !strings.Contains(cd, "attachment") {
		t.Fatalf("Content-Disposition = %q, want attachment", cd)
	}

	body := rec.Body.String()
	if !strings.HasPrefix(body, "timestamp,worker_id,worker_name,job_id,nonce,difficulty,accepted") {
		t.Fatalf("missing/incorrect CSV header: %q", body)
	}
	// Both shares should appear, with worker names and accepted flags.
	if !strings.Contains(body, "worker-a") || !strings.Contains(body, "worker-b") {
		t.Fatalf("CSV missing worker rows: %q", body)
	}
	if !strings.Contains(body, "deadbeef") || !strings.Contains(body, "true") {
		t.Fatalf("CSV missing share data: %q", body)
	}
}

func TestHandleExportSessionsJSON(t *testing.T) {
	s := newTestServer(t)
	s.stats.UpdateHashes(1234)
	s.stats.EndSession()

	req := httptest.NewRequest(http.MethodGet, "/api/export?dataset=sessions&format=json", nil)
	rec := httptest.NewRecorder()
	s.handleExport(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Fatalf("Content-Type = %q, want application/json", ct)
	}
	if !strings.Contains(rec.Body.String(), "total_hashes") {
		t.Fatalf("JSON export missing session fields: %q", rec.Body.String())
	}
}

func TestHandleExportRejectsBadDataset(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/export?dataset=bogus", nil)
	rec := httptest.NewRecorder()
	s.handleExport(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for bad dataset", rec.Code)
	}
}

func TestHandleExportRejectsPost(t *testing.T) {
	s := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/export", nil)
	rec := httptest.NewRecorder()
	s.handleExport(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}
