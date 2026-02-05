package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/soloforge/backend/internal/config"
	"github.com/soloforge/backend/internal/miner"
	"github.com/soloforge/backend/internal/stats"
	"github.com/soloforge/backend/internal/stratum"
)

// Server represents the HTTP/WebSocket server
type Server struct {
	cfg      *config.Config
	stratum  *stratum.Client
	manager  *miner.Manager
	stats    *stats.Collector
	wsHub    *WSHub
	mux      *http.ServeMux
	running  bool
	shutdown chan struct{}
}

// NewServer creates a new API server
func NewServer(cfg *config.Config, stratumClient *stratum.Client, manager *miner.Manager, statsCollector *stats.Collector) *Server {
	s := &Server{
		cfg:      cfg,
		stratum:  stratumClient,
		manager:  manager,
		stats:    statsCollector,
		wsHub:    NewWSHub(),
		mux:      http.NewServeMux(),
		shutdown: make(chan struct{}),
	}

	s.setupRoutes()
	return s
}

// setupRoutes configures HTTP routes
func (s *Server) setupRoutes() {
	// API routes
	s.mux.HandleFunc("/api/status", s.handleStatus)
	s.mux.HandleFunc("/api/stats", s.handleStats)
	s.mux.HandleFunc("/api/history", s.handleHistory)
	s.mux.HandleFunc("/api/sessions", s.handleSessions)
	s.mux.HandleFunc("/api/workers", s.handleWorkers)
	s.mux.HandleFunc("/api/workers/", s.handleWorkerByID)
	s.mux.HandleFunc("/api/config", s.handleConfig)
	s.mux.HandleFunc("/api/mining/start", s.handleMiningStart)
	s.mux.HandleFunc("/api/mining/stop", s.handleMiningStop)

	// WebSocket
	s.mux.HandleFunc("/ws", s.wsHub.HandleWebSocket)
}

// GetHandler returns the HTTP handler with CORS
func (s *Server) GetHandler() http.Handler {
	return corsMiddleware(s.mux)
}

// GetWSHub returns the WebSocket hub
func (s *Server) GetWSHub() *WSHub {
	return s.wsHub
}

// StartStatsLoop starts broadcasting stats periodically
func (s *Server) StartStatsLoop() {
	s.running = true
	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-s.shutdown:
				return
			case <-ticker.C:
				if !s.running {
					continue
				}

				// Update hash count in stats
				s.stats.UpdateHashes(s.manager.GetTotalHashCount())

				// Broadcast stats
				statsData := s.buildStatsPayload()
				s.wsHub.BroadcastEvent("stats", statsData)
			}
		}
	}()
}

// Stop stops the stats loop
func (s *Server) Stop() {
	s.running = false
	close(s.shutdown)
}

// buildStatsPayload builds the stats payload for broadcasting
func (s *Server) buildStatsPayload() map[string]interface{} {
	basicStats := s.stats.GetStats()

	// Add worker-specific data
	workers := s.manager.GetAllWorkers()
	workerStats := make([]map[string]interface{}, 0, len(workers))

	for _, w := range workers {
		workerStats = append(workerStats, map[string]interface{}{
			"id":        w.ID,
			"name":      w.Name,
			"running":   w.IsRunning(),
			"hashrate":  w.GetHashrate(),
			"hashCount": w.GetHashCount(),
		})
	}

	return map[string]interface{}{
		"hashrate":        s.manager.GetTotalHashrate(),
		"total_hashes":    basicStats["total_hashes"],
		"total_shares":    basicStats["total_shares"],
		"accepted_shares": basicStats["accepted_shares"],
		"best_difficulty": basicStats["best_difficulty"],
		"uptime_seconds":  basicStats["uptime_seconds"],
		"workers":         workerStats,
		"connected":       s.stratum.IsConnected(),
		"authorized":      s.stratum.IsAuthorized(),
	}
}

// handleStatus returns the miner status
func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status := map[string]interface{}{
		"running":      s.manager.WorkerCount() > 0,
		"connected":    s.stratum.IsConnected(),
		"authorized":   s.stratum.IsAuthorized(),
		"worker_count": s.manager.WorkerCount(),
		"pool_url":     s.cfg.GetPoolURL(),
		"pool_port":    s.cfg.GetPoolPort(),
	}

	jsonResponse(w, status)
}

// handleStats returns mining statistics
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	jsonResponse(w, s.buildStatsPayload())
}

// handleHistory returns share/block history
func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	history := map[string]interface{}{
		"shares": s.stats.GetShareHistory(limit),
		"blocks": s.stats.GetBlockHistory(limit),
	}

	jsonResponse(w, history)
}

// handleSessions returns session history
func (s *Server) handleSessions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	sessions := s.stats.GetSessionHistory(limit)
	jsonResponse(w, sessions)
}

// handleWorkers handles worker CRUD
func (s *Server) handleWorkers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		workers := s.manager.GetAllWorkers()
		workerList := make([]map[string]interface{}, 0, len(workers))

		for _, worker := range workers {
			workerList = append(workerList, map[string]interface{}{
				"id":        worker.ID,
				"name":      worker.Name,
				"running":   worker.IsRunning(),
				"hashrate":  worker.GetHashrate(),
				"hashCount": worker.GetHashCount(),
			})
		}

		jsonResponse(w, workerList)

	case http.MethodPost:
		var req struct {
			Name string `json:"name"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			req.Name = ""
		}

		worker := s.manager.AddWorker(req.Name)

		// If we have a job, send it to the new worker
		if job := s.stratum.GetCurrentJob(); job != nil {
			worker.UpdateJob(job)
		}

		jsonResponse(w, map[string]interface{}{
			"id":   worker.ID,
			"name": worker.Name,
		})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleWorkerByID handles individual worker operations
func (s *Server) handleWorkerByID(w http.ResponseWriter, r *http.Request) {
	// Extract ID from path /api/workers/{id}
	idStr := r.URL.Path[len("/api/workers/"):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid worker ID", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		worker := s.manager.GetWorker(id)
		if worker == nil {
			http.Error(w, "Worker not found", http.StatusNotFound)
			return
		}

		jsonResponse(w, map[string]interface{}{
			"id":        worker.ID,
			"name":      worker.Name,
			"running":   worker.IsRunning(),
			"hashrate":  worker.GetHashrate(),
			"hashCount": worker.GetHashCount(),
		})

	case http.MethodDelete:
		if s.manager.RemoveWorker(id) {
			jsonResponse(w, map[string]string{"status": "deleted"})
		} else {
			http.Error(w, "Worker not found", http.StatusNotFound)
		}

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleConfig handles configuration
func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		jsonResponse(w, map[string]interface{}{
			"pool_url":        s.cfg.GetPoolURL(),
			"pool_port":       s.cfg.GetPoolPort(),
			"wallet_address":  s.cfg.GetWalletAddress(),
			"max_cpu_percent": s.cfg.GetMaxCPUPercent(),
			"num_workers":     s.cfg.GetNumWorkers(),
		})

	case http.MethodPut:
		var updates map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		s.cfg.Update(updates)

		// Apply CPU percent change immediately
		if _, ok := updates["max_cpu_percent"]; ok {
			s.manager.SetCPUPercent(s.cfg.GetMaxCPUPercent())
		}

		jsonResponse(w, map[string]string{"status": "updated"})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleMiningStart starts mining
func (s *Server) handleMiningStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Connect to pool if not connected
	if !s.stratum.IsConnected() {
		if err := s.stratum.Connect(); err != nil {
			jsonResponse(w, map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			})
			return
		}

		// Subscribe
		if err := s.stratum.Subscribe(); err != nil {
			jsonResponse(w, map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			})
			return
		}

		// Wait a bit for subscription response
		time.Sleep(500 * time.Millisecond)

		// Authorize
		wallet := s.cfg.GetWalletAddress()
		if wallet == "" {
			jsonResponse(w, map[string]interface{}{
				"status": "error",
				"error":  "No wallet address configured",
			})
			return
		}

		if err := s.stratum.Authorize(wallet, "x"); err != nil {
			jsonResponse(w, map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			})
			return
		}

		// Wait for authorization
		time.Sleep(500 * time.Millisecond)
	}

	// Set stratum data to manager
	s.manager.SetStratumData(s.stratum.GetExtranonce1(), s.stratum.GetExtranonce2Size())

	// Add workers if none exist
	if s.manager.WorkerCount() == 0 {
		numWorkers := s.cfg.GetNumWorkers()
		if numWorkers <= 0 {
			numWorkers = 1
		}
		for i := 0; i < numWorkers; i++ {
			s.manager.AddWorker("")
		}
	}

	// Start all workers
	s.manager.StartAll()

	// Send current job to workers
	if job := s.stratum.GetCurrentJob(); job != nil {
		s.manager.BroadcastJob(job)
	}

	jsonResponse(w, map[string]string{"status": "started"})
}

// handleMiningStop stops mining
func (s *Server) handleMiningStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.manager.StopAll()
	s.stratum.Close()

	jsonResponse(w, map[string]string{"status": "stopped"})
}

// jsonResponse writes a JSON response
func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

// corsMiddleware adds CORS headers
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
