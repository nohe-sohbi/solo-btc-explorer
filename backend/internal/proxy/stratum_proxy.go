package proxy

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/soloforge/backend/internal/config"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// StratumProxy relays WebSocket messages to/from a Stratum pool via TCP.
// Each browser client gets its own independent TCP connection.
type StratumProxy struct {
	cfg *config.Config
}

// NewStratumProxy creates a new proxy instance.
func NewStratumProxy(cfg *config.Config) *StratumProxy {
	return &StratumProxy{cfg: cfg}
}

// HandleConnection upgrades the HTTP request to WebSocket, opens a TCP
// connection to the configured pool, and relays messages bidirectionally.
func (p *StratumProxy) HandleConnection(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer ws.Close()

	// Connect to pool via TCP
	addr := fmt.Sprintf("%s:%d", p.cfg.GetPoolURL(), p.cfg.GetPoolPort())
	dialer := net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	tcp, err := dialer.Dial("tcp", addr)
	if err != nil {
		log.Printf("Failed to connect to pool %s: %v", addr, err)
		msg := fmt.Sprintf(`{"type":"proxy_status","connected":false,"error":"%s"}`, err.Error())
		ws.WriteMessage(websocket.TextMessage, []byte(msg))
		return
	}
	defer tcp.Close()

	log.Printf("Proxy: connected to pool %s for client %s", addr, r.RemoteAddr)

	// Notify browser that pool connection is established
	ws.WriteMessage(websocket.TextMessage, []byte(`{"type":"proxy_status","connected":true}`))

	var wg sync.WaitGroup
	done := make(chan struct{})

	// Goroutine 1: browser → pool (WebSocket → TCP)
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			_, message, err := ws.ReadMessage()
			if err != nil {
				break
			}
			// Stratum protocol: newline-delimited JSON
			if len(message) == 0 {
				continue
			}
			if message[len(message)-1] != '\n' {
				message = append(message, '\n')
			}
			if _, err := tcp.Write(message); err != nil {
				break
			}
		}
		select {
		case <-done:
		default:
			close(done)
		}
	}()

	// Goroutine 2: pool → browser (TCP → WebSocket)
	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(tcp)
		scanner.Buffer(make([]byte, 0, 64*1024), 64*1024)
		for scanner.Scan() {
			select {
			case <-done:
				return
			default:
			}
			line := scanner.Bytes()
			if len(line) == 0 {
				continue
			}
			if err := ws.WriteMessage(websocket.TextMessage, line); err != nil {
				break
			}
		}
		select {
		case <-done:
		default:
			close(done)
		}
	}()

	// Wait for either side to close
	<-done

	// Force close both connections to unblock the other goroutine
	ws.Close()
	tcp.Close()

	wg.Wait()
	log.Printf("Proxy: session ended for client %s", r.RemoteAddr)
}
