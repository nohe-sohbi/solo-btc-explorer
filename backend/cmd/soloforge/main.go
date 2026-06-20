package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/soloforge/backend/internal/api"
	"github.com/soloforge/backend/internal/config"
	"github.com/soloforge/backend/internal/miner"
	"github.com/soloforge/backend/internal/stats"
	"github.com/soloforge/backend/internal/stratum"
)

func main() {
	port := flag.Int("port", 8080, "HTTP server port")
	configPath := flag.String("config", "config.json", "Path to configuration file")
	flag.Parse()

	// Load configuration
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Create components
	stratumClient := stratum.NewClient(cfg.GetPoolURL(), cfg.GetPoolPort())
	manager := miner.NewManager()
	statsCollector := stats.NewCollector(1000)

	// Create the HTTP server up front so callbacks can stream events to dashboards.
	server := api.NewServer(cfg, stratumClient, manager, statsCollector)

	// Wire up callbacks: when a share is found, submit it via stratum
	manager.SetShareCallback(func(workerID int, jobID, extranonce2, ntime, nonce string, difficulty float64) {
		wallet := cfg.GetWalletAddress()
		if err := stratumClient.Submit(wallet, jobID, extranonce2, ntime, nonce); err != nil {
			log.Printf("Failed to submit share: %v", err)
		}
		w := manager.GetWorker(workerID)
		workerName := ""
		if w != nil {
			workerName = w.Name
		}
		statsCollector.AddShare(workerID, workerName, jobID, nonce, difficulty, true)
	})

	// Wire up block callback: a hash meeting the full network target is a candidate block.
	manager.SetBlockCallback(func(workerID int, nonce string, difficulty float64) {
		prevHash := ""
		if job := stratumClient.GetCurrentJob(); job != nil {
			prevHash = job.PrevHash
		}
		statsCollector.AddBlock(0, prevHash)
		log.Printf("🆕 BLOCK CANDIDATE found by worker %d (difficulty %.2f)", workerID, difficulty)
		server.BroadcastBlock(difficulty)
		server.BroadcastLog("🆕 Block candidate found!", "var(--gold)")
	})

	// Wire up job callback: broadcast new jobs to all workers
	stratumClient.SetJobCallback(func(job *stratum.Job) {
		manager.BroadcastJob(job)
	})

	// Pool difficulty changes adjust the workers' share target.
	stratumClient.SetDifficultyCallback(func(difficulty float64) {
		manager.SetShareDifficulty(difficulty)
		server.BroadcastLog(fmt.Sprintf("🎚️ Pool difficulty set to %g", difficulty), "var(--info)")
	})

	// Keep the manager's extranonce in sync (initial subscribe and reconnects).
	stratumClient.SetSubscribedCallback(func(extranonce1 string, extranonce2Size int) {
		manager.SetStratumData(extranonce1, extranonce2Size)
	})

	// Surface connection lifecycle on the dashboard.
	stratumClient.SetConnectedCallback(func() {
		server.BroadcastLog("📡 Connected to pool", "var(--success)")
	})
	stratumClient.SetDisconnectedCallback(func(err error) {
		server.BroadcastLog("⚠️ Disconnected from pool — reconnecting...", "var(--warning)")
	})

	// Recover automatically from dropped pool connections.
	stratumClient.SetAutoReconnect(true)

	// Start broadcasting stats to dashboards.
	server.StartStatsLoop()

	// Periodically flush stats to disk. Without this, a crash, OOM kill or
	// `docker kill` (anything that skips the graceful-shutdown path below) would
	// lose every hash and share accumulated since the last clean stop.
	autoSaveStop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-autoSaveStop:
				return
			case <-ticker.C:
				if err := statsCollector.Save(); err != nil {
					log.Printf("Auto-save failed: %v", err)
				}
			}
		}
	}()

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("Starting SoloForge server on %s", addr)

	httpServer := &http.Server{
		Addr:    addr,
		Handler: server.GetHandler(),
	}

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		log.Println("Shutting down...")

		// Stop the periodic auto-save before the final flush.
		close(autoSaveStop)

		// Save stats before exit
		statsCollector.EndSession()
		if err := statsCollector.Save(); err != nil {
			log.Printf("Failed to save stats: %v", err)
		}

		server.Stop()
		manager.StopAll()
		stratumClient.Close()
		httpServer.Close()
	}()

	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
