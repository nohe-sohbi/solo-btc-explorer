package config

import (
	"path/filepath"
	"testing"
)

func TestLoadMissingFileReturnsDefaults(t *testing.T) {
	cfg, err := Load(filepath.Join(t.TempDir(), "does-not-exist.json"))
	if err != nil {
		t.Fatalf("Load on missing file should not error, got %v", err)
	}
	def := DefaultConfig()
	if cfg.GetPoolURL() != def.PoolURL {
		t.Fatalf("pool url = %q, want default %q", cfg.GetPoolURL(), def.PoolURL)
	}
	if cfg.GetPoolPort() != def.PoolPort {
		t.Fatalf("pool port = %d, want default %d", cfg.GetPoolPort(), def.PoolPort)
	}
}

func TestUpdate(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Update(map[string]interface{}{
		"pool_url":        "pool.example.com",
		"pool_port":       float64(4444), // JSON numbers decode to float64
		"wallet_address":  "bc1qexample",
		"max_cpu_percent": float64(50),
		"num_workers":     float64(3),
	})

	if cfg.GetPoolURL() != "pool.example.com" {
		t.Fatalf("pool url not updated: %q", cfg.GetPoolURL())
	}
	if cfg.GetPoolPort() != 4444 {
		t.Fatalf("pool port not updated: %d", cfg.GetPoolPort())
	}
	if cfg.GetWalletAddress() != "bc1qexample" {
		t.Fatalf("wallet not updated: %q", cfg.GetWalletAddress())
	}
	if cfg.GetMaxCPUPercent() != 50 {
		t.Fatalf("cpu percent not updated: %d", cfg.GetMaxCPUPercent())
	}
	if cfg.GetNumWorkers() != 3 {
		t.Fatalf("num workers not updated: %d", cfg.GetNumWorkers())
	}
}

func TestUpdateIgnoresWrongTypes(t *testing.T) {
	cfg := DefaultConfig()
	original := cfg.GetPoolPort()
	// pool_port as a string should be ignored, not crash.
	cfg.Update(map[string]interface{}{"pool_port": "not-a-number"})
	if cfg.GetPoolPort() != original {
		t.Fatalf("pool port should be unchanged, got %d", cfg.GetPoolPort())
	}
}

func TestPersistRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")

	cfg, err := Load(path) // file absent -> defaults, but path is remembered
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	cfg.Update(map[string]interface{}{"pool_url": "persisted.example.com"})
	if err := cfg.Persist(); err != nil {
		t.Fatalf("Persist: %v", err)
	}

	reloaded, err := Load(path)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	if reloaded.GetPoolURL() != "persisted.example.com" {
		t.Fatalf("persisted value not reloaded: %q", reloaded.GetPoolURL())
	}
}

func TestPersistNoPathIsNoop(t *testing.T) {
	cfg := DefaultConfig() // no path set
	if err := cfg.Persist(); err != nil {
		t.Fatalf("Persist without a path should be a no-op, got %v", err)
	}
}

func TestValidateUpdatesAcceptsValidInput(t *testing.T) {
	err := ValidateUpdates(map[string]interface{}{
		"pool_url":        "solo.ckpool.org",
		"pool_port":       float64(3333),
		"wallet_address":  "1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9",
		"max_cpu_percent": float64(80),
		"num_workers":     float64(4),
	})
	if err != nil {
		t.Fatalf("valid config rejected: %v", err)
	}
}

func TestValidateUpdatesEmptyPatchIsValid(t *testing.T) {
	if err := ValidateUpdates(map[string]interface{}{}); err != nil {
		t.Fatalf("empty patch should be valid, got %v", err)
	}
}

func TestValidateUpdatesAllowsClearingWallet(t *testing.T) {
	if err := ValidateUpdates(map[string]interface{}{"wallet_address": ""}); err != nil {
		t.Fatalf("clearing wallet should be allowed, got %v", err)
	}
}

func TestValidateUpdatesRejectsBadValues(t *testing.T) {
	cases := []struct {
		name    string
		updates map[string]interface{}
	}{
		{"empty pool url", map[string]interface{}{"pool_url": "   "}},
		{"pool url wrong type", map[string]interface{}{"pool_url": float64(1)}},
		{"port too low", map[string]interface{}{"pool_port": float64(0)}},
		{"port too high", map[string]interface{}{"pool_port": float64(70000)}},
		{"port wrong type", map[string]interface{}{"pool_port": "3333"}},
		{"short wallet", map[string]interface{}{"wallet_address": "abc"}},
		{"cpu too low", map[string]interface{}{"max_cpu_percent": float64(5)}},
		{"cpu too high", map[string]interface{}{"max_cpu_percent": float64(150)}},
		{"workers zero", map[string]interface{}{"num_workers": float64(0)}},
		{"workers too high", map[string]interface{}{"num_workers": float64(1000)}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateUpdates(tc.updates); err == nil {
				t.Fatalf("expected validation error for %s, got nil", tc.name)
			}
		})
	}
}
