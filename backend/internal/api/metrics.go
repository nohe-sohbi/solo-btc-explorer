package api

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
)

// metric is a single Prometheus sample with optional help/type metadata.
type metric struct {
	name  string
	help  string
	typ   string // "gauge" or "counter"
	value float64
}

// boolToFloat maps a boolean to the Prometheus 1/0 convention.
func boolToFloat(b bool) float64 {
	if b {
		return 1
	}
	return 0
}

// collectMetrics snapshots the current mining state into a flat metric list.
// It reuses the same sources as the JSON stats payload so the two never drift.
func (s *Server) collectMetrics() []metric {
	basic := s.stats.GetStats()

	asFloat := func(v interface{}) float64 {
		switch n := v.(type) {
		case float64:
			return n
		case int:
			return float64(n)
		case uint64:
			return float64(n)
		default:
			return 0
		}
	}

	workers := s.manager.GetAllWorkers()
	running := 0
	for _, w := range workers {
		if w.IsRunning() {
			running++
		}
	}

	metrics := []metric{
		{"soloforge_hashrate_hashes_per_second", "Combined hashrate of all workers in H/s.", "gauge", s.manager.GetTotalHashrate()},
		{"soloforge_hashes_total", "Total number of hashes computed across all sessions.", "counter", asFloat(basic["total_hashes"])},
		{"soloforge_shares_total", "Total shares submitted to the pool.", "counter", asFloat(basic["total_shares"])},
		{"soloforge_shares_accepted_total", "Shares accepted by the pool.", "counter", asFloat(basic["accepted_shares"])},
		{"soloforge_shares_rejected_total", "Shares rejected by the pool.", "counter", asFloat(basic["rejected_shares"])},
		{"soloforge_best_difficulty", "Highest share difficulty found so far.", "gauge", asFloat(basic["best_difficulty"])},
		{"soloforge_uptime_seconds", "Cumulative mining time across all sessions in seconds.", "counter", asFloat(basic["uptime_seconds"])},
		{"soloforge_workers", "Number of configured mining workers.", "gauge", float64(len(workers))},
		{"soloforge_workers_running", "Number of workers currently mining.", "gauge", float64(running)},
		{"soloforge_pool_connected", "Whether the Stratum connection to the pool is up (1) or down (0).", "gauge", boolToFloat(s.stratum.IsConnected())},
		{"soloforge_pool_authorized", "Whether the miner is authorized with the pool (1) or not (0).", "gauge", boolToFloat(s.stratum.IsAuthorized())},
		{"soloforge_ws_clients", "Number of connected dashboard WebSocket clients.", "gauge", float64(s.wsHub.ClientCount())},
	}

	// Live network context, when a provider is wired in.
	if s.network != nil {
		ns := s.network.Get()
		metrics = append(metrics,
			metric{"soloforge_network_difficulty", "Current Bitcoin network difficulty.", "gauge", ns.Difficulty},
			metric{"soloforge_network_hashrate_hashes_per_second", "Estimated total Bitcoin network hashrate in H/s.", "gauge", ns.NetworkHashrate},
			metric{"soloforge_block_height", "Current Bitcoin chain tip height.", "gauge", float64(ns.BlockHeight)},
			metric{"soloforge_btc_price_usd", "Current BTC/USD spot price.", "gauge", ns.PriceUSD},
			metric{"soloforge_block_reward_btc", "Current block subsidy in BTC for the chain tip height.", "gauge", ns.BlockRewardBTC},
		)
	}

	return metrics
}

// renderMetrics writes the metric list in the Prometheus text exposition format.
func renderMetrics(metrics []metric) string {
	// Stable output ordering keeps diffs and scrapes deterministic.
	sort.SliceStable(metrics, func(i, j int) bool { return metrics[i].name < metrics[j].name })

	var b strings.Builder
	for _, m := range metrics {
		if m.help != "" {
			fmt.Fprintf(&b, "# HELP %s %s\n", m.name, m.help)
		}
		if m.typ != "" {
			fmt.Fprintf(&b, "# TYPE %s %s\n", m.name, m.typ)
		}
		// %g keeps integers compact while still rendering fractional gauges.
		fmt.Fprintf(&b, "%s %g\n", m.name, m.value)
	}
	return b.String()
}

// handleMetrics exposes mining statistics in the Prometheus exposition format so
// the dashboard can be scraped by Prometheus/Grafana for long-term monitoring.
func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	fmt.Fprint(w, renderMetrics(s.collectMetrics()))
}
