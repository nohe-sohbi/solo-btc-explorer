package stats

import (
	"path/filepath"
	"testing"
)

func TestAddShareCounters(t *testing.T) {
	c := NewCollector(100)
	c.dataDir = t.TempDir() // isolate any persistence

	c.AddShare(1, "worker-a", "job1", "deadbeef", 0.5, true)
	c.AddShare(1, "worker-a", "job1", "cafebabe", 2.0, true)
	c.AddShare(2, "worker-b", "job2", "0badf00d", 1.0, false)

	stats := c.GetStats()
	if got := stats["total_shares"].(int); got != 3 {
		t.Fatalf("total_shares = %d, want 3", got)
	}
	if got := stats["accepted_shares"].(int); got != 2 {
		t.Fatalf("accepted_shares = %d, want 2", got)
	}
	if got := stats["best_difficulty"].(float64); got != 2.0 {
		t.Fatalf("best_difficulty = %v, want 2.0", got)
	}
}

func TestGetShareHistoryNewestFirstAndLimit(t *testing.T) {
	c := NewCollector(100)
	c.dataDir = t.TempDir()

	c.AddShare(1, "w", "job1", "n1", 1, true)
	c.AddShare(1, "w", "job2", "n2", 1, true)
	c.AddShare(1, "w", "job3", "n3", 1, true)

	hist := c.GetShareHistory(2)
	if len(hist) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(hist))
	}
	// Newest first.
	if hist[0].JobID != "job3" || hist[1].JobID != "job2" {
		t.Fatalf("unexpected order: %s, %s", hist[0].JobID, hist[1].JobID)
	}
}

func TestMaxHistorySizeEviction(t *testing.T) {
	c := NewCollector(2) // keep only 2
	c.dataDir = t.TempDir()

	for i := 0; i < 5; i++ {
		c.AddShare(1, "w", "job", "n", 1, true)
	}
	if got := len(c.GetShareHistory(0)); got != 2 {
		t.Fatalf("expected history capped at 2, got %d", got)
	}
}

func TestAddBlock(t *testing.T) {
	c := NewCollector(100)
	c.dataDir = t.TempDir()

	c.AddBlock(840000, "prevhashvalue")
	blocks := c.GetBlockHistory(10)
	if len(blocks) != 1 {
		t.Fatalf("expected 1 block, got %d", len(blocks))
	}
	if blocks[0].Height != 840000 || blocks[0].PrevHash != "prevhashvalue" {
		t.Fatalf("unexpected block entry: %+v", blocks[0])
	}
}

func TestSaveLoadRoundTrip(t *testing.T) {
	dir := t.TempDir()

	c := NewCollector(100)
	c.dataDir = dir
	c.UpdateHashes(123456)
	c.AddShare(1, "w", "job1", "n1", 3.5, true)
	c.AddBlock(840000, "prev")

	if err := c.Save(); err != nil {
		t.Fatalf("Save: %v", err)
	}
	if _, err := filepath.Glob(filepath.Join(dir, "stats.json")); err != nil {
		t.Fatalf("glob: %v", err)
	}

	// A fresh collector pointed at the same dir should restore the data.
	c2 := &Collector{
		maxHistorySize: 100,
		dataDir:        dir,
		dataFile:       "stats.json",
	}
	if err := c2.Load(); err != nil {
		t.Fatalf("Load: %v", err)
	}

	stats := c2.GetStats()
	if got := stats["total_hashes"].(uint64); got != 123456 {
		t.Fatalf("total_hashes after reload = %d, want 123456", got)
	}
	if got := stats["best_difficulty"].(float64); got != 3.5 {
		t.Fatalf("best_difficulty after reload = %v, want 3.5", got)
	}
	if len(c2.GetShareHistory(0)) != 1 {
		t.Fatalf("expected 1 share after reload")
	}
	if len(c2.GetBlockHistory(0)) != 1 {
		t.Fatalf("expected 1 block after reload")
	}
}

func TestSessionLifecycle(t *testing.T) {
	c := NewCollector(100)
	c.dataDir = t.TempDir()

	c.UpdateHashes(1000)
	c.EndSession()

	sessions := c.GetSessionHistory(10)
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
	if sessions[0].TotalHashes != 1000 {
		t.Fatalf("session total hashes = %d, want 1000", sessions[0].TotalHashes)
	}
}

func TestReset(t *testing.T) {
	c := NewCollector(100)
	c.dataDir = t.TempDir()

	c.AddShare(1, "w", "job", "n", 5, true)
	c.UpdateHashes(999)
	c.Reset()

	stats := c.GetStats()
	if stats["total_shares"].(int) != 0 || stats["total_hashes"].(uint64) != 0 {
		t.Fatalf("Reset did not clear counters: %+v", stats)
	}
	if len(c.GetShareHistory(0)) != 0 {
		t.Fatalf("Reset did not clear share history")
	}
}
