package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/soloforge/backend/internal/btcaddr"
)

// Validation bounds for user-supplied configuration.
const (
	minPoolPort   = 1
	maxPoolPort   = 65535
	minCPUPercent = 10
	maxCPUPercent = 100
	minWorkers    = 1
	maxWorkers    = 64
)

// Config holds the application configuration
type Config struct {
	mu sync.RWMutex

	// path is where the config was loaded from / should be persisted to.
	path string

	// Pool settings
	PoolURL  string `json:"pool_url"`
	PoolPort int    `json:"pool_port"`

	// Wallet
	WalletAddress string `json:"wallet_address"`

	// Mining settings
	MaxCPUPercent int `json:"max_cpu_percent"`
	NumWorkers    int `json:"num_workers"`
}

// DefaultConfig returns a config with sensible defaults
func DefaultConfig() *Config {
	return &Config{
		PoolURL:       "solo.ckpool.org",
		PoolPort:      3333,
		WalletAddress: "1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9",
		MaxCPUPercent: 80,
		NumWorkers:    4,
	}
}

// Load reads configuration from a JSON file
func Load(path string) (*Config, error) {
	cfg := DefaultConfig()
	cfg.path = path

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return nil, err
	}

	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Persist writes the configuration back to the path it was loaded from. It is a
// no-op when no path is configured.
func (c *Config) Persist() error {
	c.mu.RLock()
	path := c.path
	c.mu.RUnlock()

	if path == "" {
		return nil
	}
	return c.Save(path)
}

// Save writes configuration to a JSON file
func (c *Config) Save(path string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// GetPoolURL returns the pool URL thread-safely
func (c *Config) GetPoolURL() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.PoolURL
}

// GetPoolPort returns the pool port thread-safely
func (c *Config) GetPoolPort() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.PoolPort
}

// GetWalletAddress returns the wallet address thread-safely
func (c *Config) GetWalletAddress() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.WalletAddress
}

// GetMaxCPUPercent returns the max CPU percentage thread-safely
func (c *Config) GetMaxCPUPercent() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.MaxCPUPercent
}

// GetNumWorkers returns the number of workers thread-safely
func (c *Config) GetNumWorkers() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.NumWorkers
}

// ValidateUpdates checks an incoming config patch for sane values before it is
// applied. It returns a descriptive error for the first invalid field so the API
// can reject bad input with a 400 instead of silently persisting a broken pool
// URL, an out-of-range CPU cap, or a wallet that would stall mining.
func ValidateUpdates(updates map[string]interface{}) error {
	if v, ok := updates["pool_url"]; ok {
		s, ok := v.(string)
		if !ok {
			return fmt.Errorf("pool_url must be a string")
		}
		if strings.TrimSpace(s) == "" {
			return fmt.Errorf("pool_url must not be empty")
		}
	}

	if v, ok := updates["pool_port"]; ok {
		f, ok := v.(float64)
		if !ok {
			return fmt.Errorf("pool_port must be a number")
		}
		port := int(f)
		if port < minPoolPort || port > maxPoolPort {
			return fmt.Errorf("pool_port must be between %d and %d", minPoolPort, maxPoolPort)
		}
	}

	if v, ok := updates["wallet_address"]; ok {
		s, ok := v.(string)
		if !ok {
			return fmt.Errorf("wallet_address must be a string")
		}
		// Allow clearing the wallet, but otherwise verify the encoding and
		// checksum so a mistyped address can't silently send a block reward into
		// the void.
		if trimmed := strings.TrimSpace(s); trimmed != "" {
			if err := btcaddr.Validate(trimmed); err != nil {
				return fmt.Errorf("wallet_address: %w", err)
			}
		}
	}

	if v, ok := updates["max_cpu_percent"]; ok {
		f, ok := v.(float64)
		if !ok {
			return fmt.Errorf("max_cpu_percent must be a number")
		}
		cpu := int(f)
		if cpu < minCPUPercent || cpu > maxCPUPercent {
			return fmt.Errorf("max_cpu_percent must be between %d and %d", minCPUPercent, maxCPUPercent)
		}
	}

	if v, ok := updates["num_workers"]; ok {
		f, ok := v.(float64)
		if !ok {
			return fmt.Errorf("num_workers must be a number")
		}
		n := int(f)
		if n < minWorkers || n > maxWorkers {
			return fmt.Errorf("num_workers must be between %d and %d", minWorkers, maxWorkers)
		}
	}

	return nil
}

// Update updates the configuration with new values
func (c *Config) Update(updates map[string]interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if v, ok := updates["pool_url"].(string); ok {
		c.PoolURL = v
	}
	if v, ok := updates["pool_port"].(float64); ok {
		c.PoolPort = int(v)
	}
	if v, ok := updates["wallet_address"].(string); ok {
		c.WalletAddress = v
	}
	if v, ok := updates["max_cpu_percent"].(float64); ok {
		c.MaxCPUPercent = int(v)
	}
	if v, ok := updates["num_workers"].(float64); ok {
		c.NumWorkers = int(v)
	}
}
