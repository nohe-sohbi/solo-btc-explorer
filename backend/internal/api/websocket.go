package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// WSClient represents a connected WebSocket client
type WSClient struct {
	conn *websocket.Conn
	send chan []byte
}

// WSHub manages WebSocket connections
type WSHub struct {
	mu         sync.RWMutex
	clients    map[*WSClient]bool
	logHistory []map[string]interface{}
}

// NewWSHub creates a new WebSocket hub
func NewWSHub() *WSHub {
	return &WSHub{
		clients:    make(map[*WSClient]bool),
		logHistory: make([]map[string]interface{}, 0),
	}
}

// AddClient adds a new client
func (h *WSHub) AddClient(client *WSClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[client] = true

	// Send log history to new client
	for _, logEntry := range h.logHistory {
		data, err := json.Marshal(logEntry)
		if err == nil {
			client.send <- data
		}
	}
}

// RemoveClient removes a client
func (h *WSHub) RemoveClient(client *WSClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		close(client.send)
	}
}

// Broadcast sends a message to all clients
func (h *WSHub) Broadcast(message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.send <- message:
		default:
			// Client buffer full, skip
		}
	}
}

// BroadcastEvent sends a typed event to all clients
func (h *WSHub) BroadcastEvent(eventType string, data interface{}) {
	event := map[string]interface{}{
		"type":      eventType,
		"data":      data,
		"timestamp": time.Now().UnixMilli(),
	}

	// Store log events in history
	if eventType == "log" {
		h.mu.Lock()
		h.logHistory = append(h.logHistory, event)
		// Keep last 50 logs
		if len(h.logHistory) > 50 {
			h.logHistory = h.logHistory[1:]
		}
		h.mu.Unlock()
	}

	message, err := json.Marshal(event)
	if err != nil {
		return
	}

	h.Broadcast(message)
}

// ClientCount returns the number of connected clients
func (h *WSHub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// HandleWebSocket handles WebSocket upgrade requests
func (h *WSHub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &WSClient{
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.AddClient(client)

	// Start goroutines for reading and writing
	go h.writePump(client)
	go h.readPump(client)
}

// writePump sends messages to the client
func (h *WSHub) writePump(client *WSClient) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		client.conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.send:
			if !ok {
				client.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := client.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// readPump reads messages from the client
func (h *WSHub) readPump(client *WSClient) {
	defer func() {
		h.RemoveClient(client)
		client.conn.Close()
	}()

	client.conn.SetReadLimit(512)
	client.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	client.conn.SetPongHandler(func(string) error {
		client.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := client.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
