package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/soloforge/backend/internal/network"
)

// stubNetwork is a fixed networkProvider for tests.
type stubNetwork struct{ s network.Stats }

func (n stubNetwork) Get() network.Stats { return n.s }

func TestHandleNetworkNilProvider(t *testing.T) {
	s := newTestServer(t) // no provider wired in
	req := httptest.NewRequest(http.MethodGet, "/api/network", nil)
	rec := httptest.NewRecorder()
	s.handleNetwork(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "network_difficulty") {
		t.Fatalf("expected zero-value Stats JSON, got %q", rec.Body.String())
	}
}

func TestHandleNetworkReportsProviderData(t *testing.T) {
	s := newTestServer(t)
	s.SetNetworkProvider(stubNetwork{network.Stats{
		Difficulty:      1.21e14,
		BlockHeight:     840000,
		NetworkHashrate: 6.5e20,
		PriceUSD:        65000,
	}})

	req := httptest.NewRequest(http.MethodGet, "/api/network", nil)
	rec := httptest.NewRecorder()
	s.handleNetwork(rec, req)

	body := rec.Body.String()
	if !strings.Contains(body, "840000") || !strings.Contains(body, "65000") {
		t.Fatalf("network JSON missing expected fields: %q", body)
	}
}

func TestStatsPayloadIncludesNetworkContext(t *testing.T) {
	s := newTestServer(t)
	s.SetNetworkProvider(stubNetwork{network.Stats{Difficulty: 1.21e14, BlockHeight: 840000}})

	payload := s.buildStatsPayload()
	if payload["network_difficulty"] != 1.21e14 {
		t.Fatalf("network_difficulty = %v, want 1.21e14", payload["network_difficulty"])
	}
	if payload["block_height"] != int64(840000) {
		t.Fatalf("block_height = %v, want 840000", payload["block_height"])
	}
	// Zero-valued fields are omitted so the dashboard can fall back cleanly.
	if _, ok := payload["btc_price_usd"]; ok {
		t.Fatalf("btc_price_usd should be omitted when zero")
	}
}

func TestMetricsIncludeNetworkContext(t *testing.T) {
	s := newTestServer(t)
	s.SetNetworkProvider(stubNetwork{network.Stats{Difficulty: 200, PriceUSD: 65000, BlockRewardBTC: 3.125}})

	out := renderMetrics(s.collectMetrics())
	if !strings.Contains(out, "soloforge_network_difficulty 200") {
		t.Fatalf("metrics missing network difficulty: %q", out)
	}
	if !strings.Contains(out, "soloforge_btc_price_usd 65000") {
		t.Fatalf("metrics missing btc price: %q", out)
	}
	if !strings.Contains(out, "soloforge_block_reward_btc 3.125") {
		t.Fatalf("metrics missing block reward: %q", out)
	}
}

func TestStatsPayloadIncludesBlockReward(t *testing.T) {
	s := newTestServer(t)
	s.SetNetworkProvider(stubNetwork{network.Stats{BlockHeight: 840000, BlockRewardBTC: 3.125}})

	payload := s.buildStatsPayload()
	if payload["block_reward_btc"] != 3.125 {
		t.Fatalf("block_reward_btc = %v, want 3.125", payload["block_reward_btc"])
	}

	// Omitted when unknown so the dashboard can fall back to a static reward.
	s2 := newTestServer(t)
	s2.SetNetworkProvider(stubNetwork{network.Stats{Difficulty: 1e14}})
	if _, ok := s2.buildStatsPayload()["block_reward_btc"]; ok {
		t.Fatalf("block_reward_btc should be omitted when zero")
	}
}
