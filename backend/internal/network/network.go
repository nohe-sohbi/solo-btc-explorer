// Package network fetches live Bitcoin network context (difficulty, block
// height, network hashrate and price) from a public explorer API so the
// dashboard can show real "what are my chances" odds instead of a hard-coded
// fallback difficulty. It is intentionally best-effort: a failed poll keeps the
// last known good value rather than blanking the UI or crashing the miner.
package network

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// DefaultBaseURL is the public mempool.space REST API. It can be overridden via
// the MEMPOOL_API_URL environment variable (handled by the caller) or for tests.
const DefaultBaseURL = "https://mempool.space"

// defaultInterval is how often the network context is refreshed. The underlying
// figures (difficulty, price) move slowly, so a relaxed cadence is plenty and
// keeps us well within the public API's rate limits.
const defaultInterval = 2 * time.Minute

// halvingInterval is the number of blocks between Bitcoin subsidy halvings.
const halvingInterval = 210000

// initialSubsidy is the block reward (in BTC) for the first halving era.
const initialSubsidy = 50.0

// Stats is a snapshot of the live Bitcoin network context.
type Stats struct {
	Difficulty      float64   `json:"network_difficulty"`
	BlockHeight     int64     `json:"block_height"`
	NetworkHashrate float64   `json:"network_hashrate"`
	PriceUSD        float64   `json:"btc_price_usd"`
	BlockRewardBTC  float64   `json:"block_reward_btc"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// BlockSubsidy returns the block reward (in BTC) mined at a given block height,
// following Bitcoin's halving schedule: 50 BTC initially, halved every 210000
// blocks. After 64 halvings the subsidy is zero (the reward has shifted entirely
// to transaction fees). This is derived locally from the height rather than
// fetched, so it costs nothing and is always correct.
func BlockSubsidy(height int64) float64 {
	if height < 0 {
		return 0
	}
	halvings := height / halvingInterval
	if halvings >= 64 {
		return 0
	}
	return initialSubsidy / float64(uint64(1)<<uint(halvings))
}

// Fetcher periodically polls the explorer API and caches the most recent
// successful result for cheap, thread-safe reads.
type Fetcher struct {
	baseURL  string
	client   *http.Client
	interval time.Duration

	mu     sync.RWMutex
	latest Stats
}

// NewFetcher builds a Fetcher. An empty baseURL falls back to DefaultBaseURL.
func NewFetcher(baseURL string) *Fetcher {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = DefaultBaseURL
	}
	return &Fetcher{
		baseURL:  strings.TrimRight(baseURL, "/"),
		client:   &http.Client{Timeout: 10 * time.Second},
		interval: defaultInterval,
	}
}

// Get returns the most recent cached snapshot. The zero value is returned until
// the first successful poll completes.
func (f *Fetcher) Get() Stats {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.latest
}

// set merges a freshly fetched snapshot into the cache.
func (f *Fetcher) set(s Stats) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.latest = s
}

// Start kicks off the polling loop. It refreshes once immediately so the
// dashboard has data quickly, then ticks on the configured interval until ctx is
// cancelled. It returns straight away (the loop runs in its own goroutine).
func (f *Fetcher) Start(ctx context.Context) {
	go func() {
		f.Refresh(ctx)
		ticker := time.NewTicker(f.interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				f.Refresh(ctx)
			}
		}
	}()
}

// Refresh performs a single poll. Each field is fetched independently so a
// failure of one endpoint (e.g. the price feed) never discards the others — any
// field that can't be refreshed keeps its previous value.
func (f *Fetcher) Refresh(ctx context.Context) {
	next := f.Get()

	if diff, hashrate, err := f.fetchHashrate(ctx); err == nil {
		next.Difficulty = diff
		next.NetworkHashrate = hashrate
	}
	if height, err := f.fetchHeight(ctx); err == nil {
		next.BlockHeight = height
		// The block reward is a pure function of the height, so derive it here
		// rather than fetching it — it's always exact and never blanks.
		next.BlockRewardBTC = BlockSubsidy(height)
	}
	if price, err := f.fetchPrice(ctx); err == nil {
		next.PriceUSD = price
	}

	next.UpdatedAt = time.Now().UTC()
	f.set(next)
}

// getJSON issues a GET against the API and decodes the JSON body into v.
func (f *Fetcher) getJSON(ctx context.Context, path string, v interface{}) error {
	body, err := f.getBody(ctx, path)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, v)
}

// getBody issues a GET against the API and returns the raw response body.
func (f *Fetcher) getBody(ctx context.Context, path string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, f.baseURL+path, nil)
	if err != nil {
		return nil, err
	}
	resp, err := f.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s: unexpected status %d", path, resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 1<<20))
}

// fetchHashrate returns the current network difficulty and hashrate.
func (f *Fetcher) fetchHashrate(ctx context.Context) (difficulty, hashrate float64, err error) {
	var payload struct {
		CurrentHashrate   float64 `json:"currentHashrate"`
		CurrentDifficulty float64 `json:"currentDifficulty"`
	}
	if err := f.getJSON(ctx, "/api/v1/mining/hashrate/3d", &payload); err != nil {
		return 0, 0, err
	}
	return payload.CurrentDifficulty, payload.CurrentHashrate, nil
}

// fetchHeight returns the height of the chain tip. The endpoint replies with a
// bare integer rather than JSON.
func (f *Fetcher) fetchHeight(ctx context.Context) (int64, error) {
	body, err := f.getBody(ctx, "/api/blocks/tip/height")
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(strings.TrimSpace(string(body)), 10, 64)
}

// fetchPrice returns the current BTC/USD spot price.
func (f *Fetcher) fetchPrice(ctx context.Context) (float64, error) {
	var payload struct {
		USD float64 `json:"USD"`
	}
	if err := f.getJSON(ctx, "/api/v1/prices", &payload); err != nil {
		return 0, err
	}
	return payload.USD, nil
}
