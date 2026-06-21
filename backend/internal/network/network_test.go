package network

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// mockAPI stands in for mempool.space, serving the three endpoints the Fetcher
// consumes. Handlers can be swapped per-test to simulate partial failures.
func mockAPI(t *testing.T, handlers map[string]http.HandlerFunc) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	for path, h := range handlers {
		mux.HandleFunc(path, h)
	}
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestRefreshPopulatesAllFields(t *testing.T) {
	srv := mockAPI(t, map[string]http.HandlerFunc{
		"/api/v1/mining/hashrate/3d": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"currentHashrate": 6.5e20, "currentDifficulty": 1.21e14}`))
		},
		"/api/blocks/tip/height": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("840123\n"))
		},
		"/api/v1/prices": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"time":1700000000,"USD":65000.5,"EUR":60000}`))
		},
	})

	f := NewFetcher(srv.URL)
	f.Refresh(context.Background())

	got := f.Get()
	if got.Difficulty != 1.21e14 {
		t.Errorf("Difficulty = %v, want 1.21e14", got.Difficulty)
	}
	if got.NetworkHashrate != 6.5e20 {
		t.Errorf("NetworkHashrate = %v, want 6.5e20", got.NetworkHashrate)
	}
	if got.BlockHeight != 840123 {
		t.Errorf("BlockHeight = %d, want 840123", got.BlockHeight)
	}
	if got.PriceUSD != 65000.5 {
		t.Errorf("PriceUSD = %v, want 65000.5", got.PriceUSD)
	}
	if got.UpdatedAt.IsZero() {
		t.Error("UpdatedAt should be set after a refresh")
	}
}

func TestRefreshKeepsLastGoodValueOnPartialFailure(t *testing.T) {
	// First, a fully healthy API to seed the cache.
	good := mockAPI(t, map[string]http.HandlerFunc{
		"/api/v1/mining/hashrate/3d": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"currentHashrate": 100, "currentDifficulty": 200}`))
		},
		"/api/blocks/tip/height": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte("500"))
		},
		"/api/v1/prices": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"USD":42000}`))
		},
	})
	f := NewFetcher(good.URL)
	f.Refresh(context.Background())

	// Now point at an API where only the price endpoint still works; the other
	// two should retain their previously cached values.
	degraded := mockAPI(t, map[string]http.HandlerFunc{
		"/api/v1/mining/hashrate/3d": func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "boom", http.StatusInternalServerError)
		},
		"/api/blocks/tip/height": func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "boom", http.StatusInternalServerError)
		},
		"/api/v1/prices": func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"USD":43000}`))
		},
	})
	f.baseURL = degraded.URL
	f.Refresh(context.Background())

	got := f.Get()
	if got.Difficulty != 200 {
		t.Errorf("Difficulty = %v, want retained 200", got.Difficulty)
	}
	if got.BlockHeight != 500 {
		t.Errorf("BlockHeight = %d, want retained 500", got.BlockHeight)
	}
	if got.PriceUSD != 43000 {
		t.Errorf("PriceUSD = %v, want refreshed 43000", got.PriceUSD)
	}
}

func TestNewFetcherDefaultsBaseURL(t *testing.T) {
	if f := NewFetcher("   "); f.baseURL != DefaultBaseURL {
		t.Errorf("baseURL = %q, want default %q", f.baseURL, DefaultBaseURL)
	}
	if f := NewFetcher("https://example.com/"); f.baseURL != "https://example.com" {
		t.Errorf("trailing slash not trimmed: %q", f.baseURL)
	}
}
