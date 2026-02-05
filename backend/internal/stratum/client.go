package stratum

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync"
	"time"
)

// Request represents a Stratum JSON-RPC request
type Request struct {
	ID     int           `json:"id"`
	Method string        `json:"method"`
	Params []interface{} `json:"params"`
}

// Response represents a Stratum JSON-RPC response
type Response struct {
	ID     int             `json:"id"`
	Result json.RawMessage `json:"result"`
	Error  interface{}     `json:"error"`
}

// Notification represents a Stratum notification (no ID)
type Notification struct {
	Method string          `json:"method"`
	Params json.RawMessage `json:"params"`
}

// Job represents a mining job received from the pool
type Job struct {
	ID           string   `json:"job_id"`
	PrevHash     string   `json:"prevhash"`
	Coinbase1    string   `json:"coinb1"`
	Coinbase2    string   `json:"coinb2"`
	MerkleBranch []string `json:"merkle_branch"`
	Version      string   `json:"version"`
	NBits        string   `json:"nbits"`
	NTime        string   `json:"ntime"`
	CleanJobs    bool     `json:"clean_jobs"`
}

// Client manages the Stratum protocol connection to a mining pool
type Client struct {
	mu sync.RWMutex

	conn   net.Conn
	reader *bufio.Reader

	poolURL  string
	poolPort int

	// Subscription data
	extranonce1     string
	extranonce2Size int
	subscribed      bool
	authorized      bool

	// Current job
	currentJob *Job

	// Callbacks
	onJobReceived  func(*Job)
	onConnected    func()
	onDisconnected func(error)
	onSubscribed   func(string, int)
	onAuthorized   func(bool)

	// State
	requestID int
	shutdown  chan struct{}
	running   bool

	// Map to store pending requests and their response channels
	pendingRequests sync.Map // map[int]chan Response
}

// NewClient creates a new Stratum client
func NewClient(poolURL string, poolPort int) *Client {
	return &Client{
		poolURL:  poolURL,
		poolPort: poolPort,
		shutdown: make(chan struct{}),
	}
}

// SetJobCallback sets the callback for new jobs
func (c *Client) SetJobCallback(cb func(*Job)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.onJobReceived = cb
}

// SetConnectedCallback sets the callback for connection established
func (c *Client) SetConnectedCallback(cb func()) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.onConnected = cb
}

// SetDisconnectedCallback sets the callback for disconnection
func (c *Client) SetDisconnectedCallback(cb func(error)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.onDisconnected = cb
}

// SetSubscribedCallback sets the callback for subscription
func (c *Client) SetSubscribedCallback(cb func(string, int)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.onSubscribed = cb
}

// SetAuthorizedCallback sets the callback for authorization
func (c *Client) SetAuthorizedCallback(cb func(bool)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.onAuthorized = cb
}

// Connect establishes a connection to the pool
func (c *Client) Connect() error {
	addr := fmt.Sprintf("%s:%d", c.poolURL, c.poolPort)
	dialer := net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	conn, err := dialer.Dial("tcp", addr)
	if err != nil {
		return fmt.Errorf("failed to connect to pool: %w", err)
	}

	c.mu.Lock()
	c.conn = conn
	c.reader = bufio.NewReader(conn)
	c.running = true
	c.shutdown = make(chan struct{}) // Reinitialize for reconnection
	c.mu.Unlock()

	go c.readLoop()

	if c.onConnected != nil {
		c.onConnected()
	}

	return nil
}

// Subscribe sends the mining.subscribe message
func (c *Client) Subscribe() error {
	req := Request{
		ID:     c.nextID(),
		Method: "mining.subscribe",
		Params: []interface{}{},
	}

	if err := c.send(req); err != nil {
		return err
	}

	// Wait for response
	return nil
}

// Authorize sends the mining.authorize message
func (c *Client) Authorize(walletAddress, password string) error {
	if password == "" {
		password = "x"
	}

	req := Request{
		ID:     c.nextID(),
		Method: "mining.authorize",
		Params: []interface{}{walletAddress, password},
	}

	return c.send(req)
}

// Submit submits a share to the pool
func (c *Client) Submit(walletAddress, jobID, extranonce2, ntime, nonce string) error {
	req := Request{
		ID:     c.nextID(),
		Method: "mining.submit",
		Params: []interface{}{walletAddress, jobID, extranonce2, ntime, nonce},
	}

	return c.send(req)
}

// GetExtranonce1 returns the extranonce1 value
func (c *Client) GetExtranonce1() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.extranonce1
}

// GetExtranonce2Size returns the extranonce2 size
func (c *Client) GetExtranonce2Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.extranonce2Size
}

// GetCurrentJob returns the current mining job
func (c *Client) GetCurrentJob() *Job {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.currentJob
}

// IsConnected returns whether the client is connected
func (c *Client) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.conn != nil && c.running
}

// IsAuthorized returns whether the client is authorized
func (c *Client) IsAuthorized() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.authorized
}

// Close closes the connection
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.running = false
	close(c.shutdown)

	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

// send writes a request to the connection
func (c *Client) send(req Request) error {
	c.mu.RLock()
	conn := c.conn
	c.mu.RUnlock()

	if conn == nil {
		return fmt.Errorf("not connected")
	}

	data, err := json.Marshal(req)
	if err != nil {
		return err
	}

	data = append(data, '\n')

	// LOG VERBOSE pour debug
	log.Printf("📤 TX: %s", string(data))

	_, err = conn.Write(data)
	return err
}

// nextID returns the next request ID
func (c *Client) nextID() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.requestID++
	return c.requestID
}

// readLoop continuously reads from the connection
func (c *Client) readLoop() {
	for {
		select {
		case <-c.shutdown:
			return
		default:
		}

		c.mu.RLock()
		reader := c.reader
		running := c.running
		c.mu.RUnlock()

		if !running || reader == nil {
			return
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			c.mu.Lock()
			c.running = false
			c.subscribed = false
			c.authorized = false
			c.mu.Unlock()

			if c.onDisconnected != nil {
				c.onDisconnected(err)
			}
			return
		}

		// LOG VERBOSE pour debug
		log.Printf("📥 RX: %s", line)

		c.handleMessage([]byte(line))
	}
}

// handleMessage processes incoming messages
func (c *Client) handleMessage(data []byte) {
	// Try to parse as response
	var resp Response
	if err := json.Unmarshal(data, &resp); err == nil && resp.ID != 0 {
		c.handleResponse(&resp)
		return
	}

	// Try to parse as notification
	var notif Notification
	if err := json.Unmarshal(data, &notif); err == nil && notif.Method != "" {
		c.handleNotification(&notif)
		return
	}
}

// handleResponse processes response messages
func (c *Client) handleResponse(resp *Response) {
	if resp.Error != nil {
		return
	}

	// Handle subscribe response
	if resp.ID == 1 {
		var result []json.RawMessage
		if err := json.Unmarshal(resp.Result, &result); err == nil && len(result) >= 3 {
			var extranonce1 string
			var extranonce2Size int
			json.Unmarshal(result[1], &extranonce1)
			json.Unmarshal(result[2], &extranonce2Size)

			c.mu.Lock()
			c.extranonce1 = extranonce1
			c.extranonce2Size = extranonce2Size
			c.subscribed = true
			c.mu.Unlock()

			if c.onSubscribed != nil {
				c.onSubscribed(extranonce1, extranonce2Size)
			}
		}
	}

	// Handle authorize response
	if resp.ID == 2 {
		var result bool
		if err := json.Unmarshal(resp.Result, &result); err == nil {
			c.mu.Lock()
			c.authorized = result
			c.mu.Unlock()

			if c.onAuthorized != nil {
				c.onAuthorized(result)
			}
		}
	}
}

// handleNotification processes notification messages
func (c *Client) handleNotification(notif *Notification) {
	switch notif.Method {
	case "mining.notify":
		c.handleMiningNotify(notif.Params)
	case "mining.set_difficulty":
		// Handle difficulty changes if needed
	}
}

// handleMiningNotify processes mining.notify notifications
func (c *Client) handleMiningNotify(params json.RawMessage) {
	var p []json.RawMessage
	if err := json.Unmarshal(params, &p); err != nil || len(p) < 9 {
		return
	}

	job := &Job{}

	json.Unmarshal(p[0], &job.ID)
	json.Unmarshal(p[1], &job.PrevHash)
	json.Unmarshal(p[2], &job.Coinbase1)
	json.Unmarshal(p[3], &job.Coinbase2)
	json.Unmarshal(p[4], &job.MerkleBranch)
	json.Unmarshal(p[5], &job.Version)
	json.Unmarshal(p[6], &job.NBits)
	json.Unmarshal(p[7], &job.NTime)
	json.Unmarshal(p[8], &job.CleanJobs)

	c.mu.Lock()
	c.currentJob = job
	c.mu.Unlock()

	if c.onJobReceived != nil {
		c.onJobReceived(job)
	}
}
