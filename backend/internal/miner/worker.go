package miner

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"math/big"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/soloforge/backend/internal/stratum"
)

// Worker represents a single mining worker
type Worker struct {
	ID   int    `json:"id"`
	Name string `json:"name"`

	mu sync.RWMutex

	// State
	running   bool
	hashCount uint64
	startTime time.Time

	// Current job
	job          *stratum.Job
	extranonce1  string
	extranonce2  string

	// Throttling
	cpuPercent int

	// Channels
	shutdown   chan struct{}
	jobChannel chan *stratum.Job

	// Callbacks
	onShareFound func(workerID int, jobID, extranonce2, ntime, nonce string, difficulty float64)
}

// NewWorker creates a new mining worker
func NewWorker(id int, name string, cpuPercent int) *Worker {
	return &Worker{
		ID:         id,
		Name:       name,
		cpuPercent: cpuPercent,
		shutdown:   make(chan struct{}),
		jobChannel: make(chan *stratum.Job, 10),
	}
}

// SetShareCallback sets the callback for found shares
func (w *Worker) SetShareCallback(cb func(workerID int, jobID, extranonce2, ntime, nonce string, difficulty float64)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.onShareFound = cb
}

// Start begins mining
func (w *Worker) Start(extranonce1 string, extranonce2Size int) {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	w.startTime = time.Now()
	w.extranonce1 = extranonce1
	w.extranonce2 = generateExtranonce2(extranonce2Size)
	w.mu.Unlock()

	go w.mineLoop()
}

// Stop halts mining
func (w *Worker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	w.mu.Unlock()

	close(w.shutdown)
}

// IsRunning returns whether the worker is running
func (w *Worker) IsRunning() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.running
}

// GetHashrate returns the current hashrate in H/s
func (w *Worker) GetHashrate() float64 {
	w.mu.RLock()
	startTime := w.startTime
	w.mu.RUnlock()

	elapsed := time.Since(startTime).Seconds()
	if elapsed == 0 {
		return 0
	}

	count := atomic.LoadUint64(&w.hashCount)
	return float64(count) / elapsed
}

// GetHashCount returns the total number of hashes computed
func (w *Worker) GetHashCount() uint64 {
	return atomic.LoadUint64(&w.hashCount)
}

// UpdateJob sends a new job to the worker
func (w *Worker) UpdateJob(job *stratum.Job) {
	select {
	case w.jobChannel <- job:
	default:
		// Channel full, drop old job
		select {
		case <-w.jobChannel:
		default:
		}
		w.jobChannel <- job
	}
}

// SetCPUPercent updates the CPU throttling percentage
func (w *Worker) SetCPUPercent(percent int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.cpuPercent = percent
}

// mineLoop is the main mining goroutine
func (w *Worker) mineLoop() {
	for {
		select {
		case <-w.shutdown:
			return
		case job := <-w.jobChannel:
			w.mu.Lock()
			w.job = job
			w.extranonce2 = generateExtranonce2(len(w.extranonce2) / 2)
			w.mu.Unlock()
		default:
			w.mu.RLock()
			job := w.job
			extranonce1 := w.extranonce1
			extranonce2 := w.extranonce2
			cpuPercent := w.cpuPercent
			w.mu.RUnlock()

			if job == nil {
				time.Sleep(100 * time.Millisecond)
				continue
			}

			// Mine a batch of nonces
			found, nonce, difficulty := w.mineBatch(job, extranonce1, extranonce2, 1000)
			if found {
				if w.onShareFound != nil {
					w.onShareFound(w.ID, job.ID, extranonce2, job.NTime, nonce, difficulty)
				}
			}

			// CPU throttling
			if cpuPercent < 100 {
				sleepTime := time.Duration((100-cpuPercent)*10) * time.Microsecond
				time.Sleep(sleepTime)
			}
		}
	}
}

// mineBatch attempts to mine a batch of nonces
func (w *Worker) mineBatch(job *stratum.Job, extranonce1, extranonce2 string, batchSize int) (bool, string, float64) {
	// Calculate target from nBits
	target := calculateTarget(job.NBits)

	// Build coinbase
	coinbase := job.Coinbase1 + extranonce1 + extranonce2 + job.Coinbase2
	coinbaseBytes, _ := hex.DecodeString(coinbase)

	// Double SHA256 of coinbase
	coinbaseHash := doubleSHA256(coinbaseBytes)

	// Calculate Merkle root
	merkleRoot := coinbaseHash
	for _, branch := range job.MerkleBranch {
		branchBytes, _ := hex.DecodeString(branch)
		merkleRoot = doubleSHA256(append(merkleRoot, branchBytes...))
	}

	// Reverse merkle root for block header (little endian)
	merkleRootHex := reverseBytes(merkleRoot)

	// Parse version, prevhash, ntime, nbits
	version, _ := hex.DecodeString(job.Version)
	prevHash, _ := hex.DecodeString(job.PrevHash)
	ntime, _ := hex.DecodeString(job.NTime)
	nbits, _ := hex.DecodeString(job.NBits)

	// Build block header (without nonce and padding)
	header := make([]byte, 80)
	copy(header[0:4], version)
	copy(header[4:36], prevHash)
	copy(header[36:68], merkleRootHex)
	copy(header[68:72], ntime)
	copy(header[72:76], nbits)

	var bestDifficulty float64
	var bestNonce string

	difficulty1Target := new(big.Int)
	difficulty1Target.SetString("00000000FFFF0000000000000000000000000000000000000000000000000000", 16)

	for i := 0; i < batchSize; i++ {
		// Generate random nonce
		nonce := rand.Uint32()
		binary.LittleEndian.PutUint32(header[76:80], nonce)

		// Double SHA256
		hash := doubleSHA256(header)
		atomic.AddUint64(&w.hashCount, 1)

		// Convert hash to big.Int (reverse for comparison)
		hashInt := new(big.Int).SetBytes(reverseBytes(hash))

		// Calculate difficulty
		if hashInt.Sign() > 0 {
			diff := new(big.Int).Div(difficulty1Target, hashInt)
			diffFloat := float64(diff.Int64())
			if diffFloat > bestDifficulty {
				bestDifficulty = diffFloat
				bestNonce = fmt.Sprintf("%08x", nonce)
			}
		}

		// Check if hash meets target
		if hashInt.Cmp(target) <= 0 {
			nonceHex := fmt.Sprintf("%08x", nonce)
			return true, nonceHex, bestDifficulty
		}
	}

	return false, bestNonce, bestDifficulty
}

// doubleSHA256 computes SHA256(SHA256(data))
func doubleSHA256(data []byte) []byte {
	first := sha256.Sum256(data)
	second := sha256.Sum256(first[:])
	return second[:]
}

// reverseBytes reverses a byte slice
func reverseBytes(data []byte) []byte {
	result := make([]byte, len(data))
	for i, b := range data {
		result[len(data)-1-i] = b
	}
	return result
}

// calculateTarget computes the target from nBits
func calculateTarget(nbits string) *big.Int {
	nbitsBytes, _ := hex.DecodeString(nbits)
	if len(nbitsBytes) != 4 {
		return new(big.Int)
	}

	exp := int(nbitsBytes[0])
	coeff := new(big.Int).SetBytes(nbitsBytes[1:4])

	// target = coeff * 2^(8*(exp-3))
	target := new(big.Int).Lsh(coeff, uint(8*(exp-3)))
	return target
}

// generateExtranonce2 generates a random extranonce2
func generateExtranonce2(size int) string {
	bytes := make([]byte, size)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
