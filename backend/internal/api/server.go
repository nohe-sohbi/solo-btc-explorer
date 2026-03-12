package api

import (
	"encoding/json"
	"net/http"

	"github.com/soloforge/backend/internal/config"
	"github.com/soloforge/backend/internal/proxy"
)

// Server represents the HTTP server with config endpoints and Stratum proxy.
type Server struct {
	cfg   *config.Config
	proxy *proxy.StratumProxy
	mux   *http.ServeMux
}

// NewServer creates a new API server.
func NewServer(cfg *config.Config, stratumProxy *proxy.StratumProxy) *Server {
	s := &Server{
		cfg:   cfg,
		proxy: stratumProxy,
		mux:   http.NewServeMux(),
	}
	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	s.mux.HandleFunc("/api/status", s.handleStatus)
	s.mux.HandleFunc("/api/config", s.handleConfig)
	s.mux.HandleFunc("/ws/stratum", s.proxy.HandleConnection)
}

// GetHandler returns the HTTP handler with CORS.
func (s *Server) GetHandler() http.Handler {
	return corsMiddleware(s.mux)
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jsonResponse(w, map[string]interface{}{
		"pool_url":  s.cfg.GetPoolURL(),
		"pool_port": s.cfg.GetPoolPort(),
		"mode":      "client-side",
	})
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		jsonResponse(w, map[string]interface{}{
			"pool_url":       s.cfg.GetPoolURL(),
			"pool_port":      s.cfg.GetPoolPort(),
			"wallet_address": s.cfg.GetWalletAddress(),
		})

	case http.MethodPut:
		var updates map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}
		s.cfg.Update(updates)
		jsonResponse(w, map[string]string{"status": "updated"})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func jsonResponse(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

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
