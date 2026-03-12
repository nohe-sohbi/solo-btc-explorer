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
	"github.com/soloforge/backend/internal/proxy"
)

func main() {
	port := flag.Int("port", 8080, "HTTP server port")
	configPath := flag.String("config", "config.json", "Path to configuration file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	stratumProxy := proxy.NewStratumProxy(cfg)
	server := api.NewServer(cfg, stratumProxy)

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("Starting SoloForge proxy server on %s (client-side mining mode)", addr)

	httpServer := &http.Server{
		Addr:    addr,
		Handler: server.GetHandler(),
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		log.Println("Shutting down...")
		httpServer.Close()
	}()

	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
