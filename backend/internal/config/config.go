package config

import (
	"encoding/json"
	"os"
	"sync"
)

// Config holds the application configuration
type Config struct {
	mu sync.RWMutex

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
