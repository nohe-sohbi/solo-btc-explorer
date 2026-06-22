package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/soloforge/backend/internal/config"
	"github.com/soloforge/backend/internal/miner"
	"github.com/soloforge/backend/internal/network"
	"github.com/soloforge/backend/internal/stats"
	"github.com/soloforge/backend/internal/stratum"
)

// networkProvider supplies the live Bitcoin network context. It is satisfied by
// *network.Fetcher; the interface keeps the server testable with a nil/stub.
type networkProvider interface {
	Get() network.Stats
}

// Server represents the HTTP/WebSocket server
type Server struct {
	cfg      *config.Config
	stratum  *stratum.Client
	manager  *miner.Manager
	stats    *stats.Collector
	network  networkProvider
	wsHub    *WSHub
	mux      *http.ServeMux
	origins  *OriginChecker
	running  bool
	shutdown chan struct{}
}

// NewServer creates a new API server. allowedOrigins locks down CORS and the
// WebSocket handshake; a nil/empty list (or one containing "*") allows all
// origins, preserving the original behaviour.
func NewServer(cfg *config.Config, stratumClient *stratum.Client, manager *miner.Manager, statsCollector *stats.Collector, allowedOrigins []string) *Server {
	origins := NewOriginChecker(allowedOrigins)
	s := &Server{
		cfg:      cfg,
		stratum:  stratumClient,
		manager:  manager,
		stats:    statsCollector,
		wsHub:    NewWSHub(origins),
		mux:      http.NewServeMux(),
		origins:  origins,
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
	s.mux.HandleFunc("/api/stats/reset", s.handleStatsReset)
	s.mux.HandleFunc("/api/history", s.handleHistory)
	s.mux.HandleFunc("/api/sessions", s.handleSessions)
	s.mux.HandleFunc("/api/workers", s.handleWorkers)
	s.mux.HandleFunc("/api/workers/", s.handleWorkerByID)
	s.mux.HandleFunc("/api/config", s.handleConfig)
	s.mux.HandleFunc("/api/mining/start", s.handleMiningStart)
	s.mux.HandleFunc("/api/mining/stop", s.handleMiningStop)

	// Live Bitcoin network context (difficulty, height, price).
	s.mux.HandleFunc("/api/network", s.handleNetwork)

	// CSV/JSON export of accumulated history for spreadsheets / archival.
	s.mux.HandleFunc("/api/export", s.handleExport)

	// Prometheus-compatible metrics for external monitoring.
	s.mux.HandleFunc("/metrics", s.handleMetrics)

	// Liveness/readiness probes for container orchestration.
	s.mux.HandleFunc("/healthz", s.handleHealthz)
	s.mux.HandleFunc("/readyz", s.handleReadyz)

	// WebSocket
	s.mux.HandleFunc("/ws", s.wsHub.HandleWebSocket)
}

// GetHandler returns the fully wrapped HTTP handler. The chain is, from outermost
// to innermost: access logging -> panic recovery -> CORS -> routes. Logging is
// outermost so it wraps the writer in a statusRecorder that recovery reuses to
// tell whether a response was already started, and so a recovered 500 still gets
// logged.
func (s *Server) GetHandler() http.Handler {
	return loggingMiddleware(recoverMiddleware(s.corsMiddleware(s.mux)))
}

// GetWSHub returns the WebSocket hub
func (s *Server) GetWSHub() *WSHub {
	return s.wsHub
}

// SetNetworkProvider attaches a live network-stats source (mempool.space poller)
// so the stats stream, /api/network and /metrics can report real difficulty,
// block height, network hashrate and BTC price.
func (s *Server) SetNetworkProvider(p networkProvider) {
	s.network = p
}

// BroadcastLog pushes a log line to all connected dashboards.
func (s *Server) BroadcastLog(message, color string) {
	s.wsHub.BroadcastEvent("log", map[string]interface{}{
		"message": message,
		"color":   color,
	})
}

// BroadcastBlock notifies all connected dashboards of a block candidate.
func (s *Server) BroadcastBlock(difficulty float64) {
	s.wsHub.BroadcastEvent("block", map[string]interface{}{
		"difficulty": difficulty,
	})
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

	payload := map[string]interface{}{
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

	// Fold in live network context when available so the dashboard's odds
	// estimator runs against the real difficulty instead of a stale fallback.
	if s.network != nil {
		ns := s.network.Get()
		if ns.Difficulty > 0 {
			payload["network_difficulty"] = ns.Difficulty
		}
		if ns.NetworkHashrate > 0 {
			payload["network_hashrate"] = ns.NetworkHashrate
		}
		if ns.BlockHeight > 0 {
			payload["block_height"] = ns.BlockHeight
		}
		if ns.PriceUSD > 0 {
			payload["btc_price_usd"] = ns.PriceUSD
		}
		if ns.BlockRewardBTC > 0 {
			payload["block_reward_btc"] = ns.BlockRewardBTC
		}
	}

	return payload
}

// handleNetwork returns the latest live Bitcoin network context. It always
// responds 200 with the cached snapshot (zero values until the first poll lands
// or when no provider is wired in).
func (s *Server) handleNetwork(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if s.network == nil {
		jsonResponse(w, network.Stats{})
		return
	}
	jsonResponse(w, s.network.Get())
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

// handleHealthz is a liveness probe: it returns 200 as long as the process can
// serve HTTP. It deliberately reports nothing about the pool so a transient
// pool outage never makes the container look dead and get restart-looped.
func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonResponse(w, map[string]string{"status": "ok"})
}

// handleReadyz is a readiness probe: it returns 200 only when the miner is
// connected to and authorized with the pool, and 503 otherwise. Orchestrators
// can use it to gauge whether mining is actually live.
func (s *Server) handleReadyz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	connected := s.stratum.IsConnected()
	authorized := s.stratum.IsAuthorized()
	ready := connected && authorized

	w.Header().Set("Content-Type", "application/json")
	if !ready {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ready":           ready,
		"pool_connected":  connected,
		"pool_authorized": authorized,
	})
}

// handleStats returns mining statistics
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	jsonResponse(w, s.buildStatsPayload())
}

// handleStatsReset clears all accumulated statistics and history. This lets the
// dashboard offer a "start fresh" action without restarting the container.
func (s *Server) handleStatsReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.stats.Reset()

	// Persist immediately so the cleared state survives a restart.
	if err := s.stats.Save(); err != nil {
		log.Printf("Failed to persist stats after reset: %v", err)
	}

	jsonResponse(w, map[string]string{"status": "reset"})
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

		// Reject invalid values before mutating/persisting anything.
		if err := config.ValidateUpdates(updates); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			jsonResponse(w, map[string]string{"status": "error", "error": err.Error()})
			return
		}

		s.cfg.Update(updates)

		// Apply CPU percent change immediately
		if _, ok := updates["max_cpu_percent"]; ok {
			s.manager.SetCPUPercent(s.cfg.GetMaxCPUPercent())
		}

		// Persist the change so it survives a restart.
		if err := s.cfg.Persist(); err != nil {
			log.Printf("Failed to persist config: %v", err)
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

// corsMiddleware adds CORS headers, honoring the configured origin allowlist.
// When all origins are allowed (the default) it keeps emitting the permissive
// "*". Otherwise it reflects only allowed origins and adds a Vary header so
// caches don't leak one origin's response to another.
func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if s.origins.AllowAll() {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		} else if origin != "" && s.origins.Allowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
