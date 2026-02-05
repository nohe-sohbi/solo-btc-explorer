package stats

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ShareEntry represents a found share in history
type ShareEntry struct {
	Timestamp  time.Time `json:"timestamp"`
	WorkerID   int       `json:"worker_id"`
	WorkerName string    `json:"worker_name"`
	JobID      string    `json:"job_id"`
	Nonce      string    `json:"nonce"`
	Difficulty float64   `json:"difficulty"`
	Accepted   bool      `json:"accepted"`
}

// BlockEntry represents a block detection event
type BlockEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Height    int64     `json:"height"`
	PrevHash  string    `json:"prev_hash"`
}

// Session represents a mining session
type Session struct {
	ID             string    `json:"id"`
	StartTime      time.Time `json:"start_time"`
	EndTime        time.Time `json:"end_time"`
	Duration       string    `json:"duration"`
	TotalHashes    uint64    `json:"total_hashes"`
	BestDifficulty float64   `json:"best_difficulty"`
}

// PersistentData represents the data structure for JSON persistence
type PersistentData struct {
	TotalHashes        uint64       `json:"total_hashes"`
	TotalShares        int          `json:"total_shares"`
	AcceptedShares     int          `json:"accepted_shares"`
	RejectedShares     int          `json:"rejected_shares"`
	BestDifficulty     float64      `json:"best_difficulty"`
	TotalMiningSeconds float64      `json:"total_mining_seconds"`
	ShareHistory       []ShareEntry `json:"share_history"`
	BlockHistory       []BlockEntry `json:"block_history"`
	SessionHistory     []Session    `json:"session_history"`
	LastSaved          time.Time    `json:"last_saved"`
}

// Collector collects and stores mining statistics
type Collector struct {
	mu sync.RWMutex

	// Real-time stats
	totalHashes    uint64
	totalShares    int
	acceptedShares int
	rejectedShares int
	bestDifficulty float64
	startTime      time.Time

	// Session tracking
	startHashes uint64 // Hashes at start of session

	// Accumulated time from previous sessions
	previousMiningSeconds float64

	// History
	shareHistory   []ShareEntry
	blockHistory   []BlockEntry
	sessionHistory []Session

	// Limits
	maxHistorySize int

	// Persistence
	dataDir  string
	dataFile string
}

// NewCollector creates a new stats collector
func NewCollector(maxHistorySize int) *Collector {
	if maxHistorySize <= 0 {
		maxHistorySize = 1000
	}

	c := &Collector{
		maxHistorySize: maxHistorySize,
		shareHistory:   make([]ShareEntry, 0),
		blockHistory:   make([]BlockEntry, 0),
		sessionHistory: make([]Session, 0),
		startTime:      time.Now(),
		dataDir:        "/app/data", // Use absolute path in container
		dataFile:       "stats.json",
	}

	// Try to load existing data
	c.Load()

	// Record hashes at start of this session (loaded from persistence)
	c.startHashes = c.totalHashes

	return c
}

// EndSession records the current session to history
func (c *Collector) EndSession() {
	c.mu.Lock()
	defer c.mu.Unlock()

	endTime := time.Now()
	duration := endTime.Sub(c.startTime)

	sessionHashes := c.totalHashes - c.startHashes

	session := Session{
		ID:             endTime.Format("2006-01-02 15:04:05"),
		StartTime:      c.startTime,
		EndTime:        endTime,
		Duration:       duration.String(),
		TotalHashes:    sessionHashes,
		BestDifficulty: c.bestDifficulty,
	}

	c.sessionHistory = append(c.sessionHistory, session)
	// Keep last 50 sessions
	if len(c.sessionHistory) > 50 {
		c.sessionHistory = c.sessionHistory[1:]
	}
}

// Save persists the current statistics to disk
func (c *Collector) Save() error {
	c.mu.RLock()
	data := PersistentData{
		TotalHashes:        c.totalHashes,
		TotalShares:        c.totalShares,
		AcceptedShares:     c.acceptedShares,
		RejectedShares:     c.rejectedShares,
		BestDifficulty:     c.bestDifficulty,
		TotalMiningSeconds: c.previousMiningSeconds + time.Since(c.startTime).Seconds(),
		ShareHistory:       c.shareHistory,
		BlockHistory:       c.blockHistory,
		SessionHistory:     c.sessionHistory,
		LastSaved:          time.Now(),
	}
	c.mu.RUnlock()

	// Ensure data directory exists
	if err := os.MkdirAll(c.dataDir, 0755); err != nil {
		return err
	}

	filePath := filepath.Join(c.dataDir, c.dataFile)
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(data)
}

// Load restores statistics from disk
func (c *Collector) Load() error {
	filePath := filepath.Join(c.dataDir, c.dataFile)

	file, err := os.Open(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// No previous data, start fresh
			return nil
		}
		return err
	}
	defer file.Close()

	var data PersistentData
	if err := json.NewDecoder(file).Decode(&data); err != nil {
		return err
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	c.totalHashes = data.TotalHashes
	c.totalShares = data.TotalShares
	c.acceptedShares = data.AcceptedShares
	c.rejectedShares = data.RejectedShares
	c.bestDifficulty = data.BestDifficulty
	c.previousMiningSeconds = data.TotalMiningSeconds
	c.shareHistory = data.ShareHistory
	c.blockHistory = data.BlockHistory
	c.sessionHistory = data.SessionHistory

	if c.shareHistory == nil {
		c.shareHistory = make([]ShareEntry, 0)
	}
	if c.blockHistory == nil {
		c.blockHistory = make([]BlockEntry, 0)
	}
	if c.sessionHistory == nil {
		c.sessionHistory = make([]Session, 0)
	}

	return nil
}

// AddShare records a new share
func (c *Collector) AddShare(workerID int, workerName, jobID, nonce string, difficulty float64, accepted bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry := ShareEntry{
		Timestamp:  time.Now(),
		WorkerID:   workerID,
		WorkerName: workerName,
		JobID:      jobID,
		Nonce:      nonce,
		Difficulty: difficulty,
		Accepted:   accepted,
	}

	c.shareHistory = append(c.shareHistory, entry)
	if len(c.shareHistory) > c.maxHistorySize {
		c.shareHistory = c.shareHistory[1:]
	}

	c.totalShares++
	if accepted {
		c.acceptedShares++
	} else {
		c.rejectedShares++
	}

	if difficulty > c.bestDifficulty {
		c.bestDifficulty = difficulty
	}
}

// AddBlock records a new block detection
func (c *Collector) AddBlock(height int64, prevHash string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	entry := BlockEntry{
		Timestamp: time.Now(),
		Height:    height,
		PrevHash:  prevHash,
	}

	c.blockHistory = append(c.blockHistory, entry)
	if len(c.blockHistory) > c.maxHistorySize {
		c.blockHistory = c.blockHistory[1:]
	}
}

// UpdateHashes updates the total hash count
func (c *Collector) UpdateHashes(count uint64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.totalHashes = count
}

// GetStats returns the current statistics
func (c *Collector) GetStats() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	// Current session uptime + previous sessions
	currentUptime := time.Since(c.startTime).Seconds()
	totalUptime := c.previousMiningSeconds + currentUptime

	return map[string]interface{}{
		"total_hashes":    c.totalHashes,
		"total_shares":    c.totalShares,
		"accepted_shares": c.acceptedShares,
		"rejected_shares": c.rejectedShares,
		"best_difficulty": c.bestDifficulty,
		"uptime_seconds":  totalUptime,
		"session_uptime":  currentUptime,
		"start_time":      c.startTime,
	}
}

// GetShareHistory returns the share history
func (c *Collector) GetShareHistory(limit int) []ShareEntry {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if limit <= 0 || limit > len(c.shareHistory) {
		limit = len(c.shareHistory)
	}

	// Return most recent entries
	start := len(c.shareHistory) - limit
	if start < 0 {
		start = 0
	}

	result := make([]ShareEntry, limit)
	copy(result, c.shareHistory[start:])

	// Reverse to get newest first
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result
}

// GetBlockHistory returns the block history
func (c *Collector) GetBlockHistory(limit int) []BlockEntry {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if limit <= 0 || limit > len(c.blockHistory) {
		limit = len(c.blockHistory)
	}

	start := len(c.blockHistory) - limit
	if start < 0 {
		start = 0
	}

	result := make([]BlockEntry, limit)
	copy(result, c.blockHistory[start:])

	// Reverse to get newest first
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result
}

// GetSessionHistory returns the session history
func (c *Collector) GetSessionHistory(limit int) []Session {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if limit <= 0 || limit > len(c.sessionHistory) {
		limit = len(c.sessionHistory)
	}

	start := len(c.sessionHistory) - limit
	if start < 0 {
		start = 0
	}

	result := make([]Session, limit)
	copy(result, c.sessionHistory[start:])

	// Reverse to get newest first
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return result
}

// GetBestDifficulty returns the best difficulty achieved
func (c *Collector) GetBestDifficulty() float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.bestDifficulty
}

// Reset resets all statistics
func (c *Collector) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.totalHashes = 0
	c.totalShares = 0
	c.acceptedShares = 0
	c.rejectedShares = 0
	c.bestDifficulty = 0
	c.previousMiningSeconds = 0
	c.shareHistory = make([]ShareEntry, 0)
	c.blockHistory = make([]BlockEntry, 0)
	c.startTime = time.Now()
}
