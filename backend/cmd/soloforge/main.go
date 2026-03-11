package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

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

	// Wire up job callback: broadcast new jobs to all workers
	stratumClient.SetJobCallback(func(job *stratum.Job) {
		manager.BroadcastJob(job)
	})

	// Create and start HTTP server
	server := api.NewServer(cfg, stratumClient, manager, statsCollector)
	server.StartStatsLoop()

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
