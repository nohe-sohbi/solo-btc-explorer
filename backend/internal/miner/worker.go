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
	job         *stratum.Job
	extranonce1 string
	extranonce2 string

	// Throttling
	cpuPercent int

	// Pool-assigned share target. When nil, the network (block) target is used.
	shareTarget *big.Int

	// Channels
	shutdown   chan struct{}
	jobChannel chan *stratum.Job

	// Callbacks
	onShareFound func(workerID int, jobID, extranonce2, ntime, nonce string, difficulty float64)
	onBlockFound func(workerID int, nonce string, difficulty float64)
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

// difficulty1Target is the target corresponding to difficulty 1 (the maximum
// target / "pool difficulty 1"). Computed once and treated as read-only.
var difficulty1Target, _ = new(big.Int).SetString("00000000FFFF0000000000000000000000000000000000000000000000000000", 16)

// SetShareCallback sets the callback for found shares
func (w *Worker) SetShareCallback(cb func(workerID int, jobID, extranonce2, ntime, nonce string, difficulty float64)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.onShareFound = cb
}

// SetBlockCallback sets the callback invoked when a hash meets the full network
// (block) target — i.e. a candidate block solution.
func (w *Worker) SetBlockCallback(cb func(workerID int, nonce string, difficulty float64)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.onBlockFound = cb
}

// SetShareDifficulty updates the pool-assigned share difficulty. A share is
// reported whenever a hash beats target = difficulty1Target / difficulty.
func (w *Worker) SetShareDifficulty(difficulty float64) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.shareTarget = shareTargetFromDifficulty(difficulty)
}

// shareTargetFromDifficulty converts a pool difficulty into a 256-bit target.
// Returns nil for non-positive difficulties (callers fall back to the block target).
func shareTargetFromDifficulty(difficulty float64) *big.Int {
	if difficulty <= 0 {
		return nil
	}
	d1 := new(big.Float).SetInt(difficulty1Target)
	target, _ := new(big.Float).Quo(d1, big.NewFloat(difficulty)).Int(nil)
	return target
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

// UpdateExtranonce updates the extranonce1 (e.g. after a pool reconnect) and
// regenerates extranonce2 so subsequently mined shares stay valid for the pool.
func (w *Worker) UpdateExtranonce(extranonce1 string, extranonce2Size int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.extranonce1 = extranonce1
	w.extranonce2 = generateExtranonce2(extranonce2Size)
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
			shareTarget := w.shareTarget
			onShareFound := w.onShareFound
			onBlockFound := w.onBlockFound
			w.mu.RUnlock()

			if job == nil {
				time.Sleep(100 * time.Millisecond)
				continue
			}

			// Mine a batch of nonces
			res := w.mineBatch(job, extranonce1, extranonce2, shareTarget, 1000)
			if res.found {
				if onShareFound != nil {
					onShareFound(w.ID, job.ID, extranonce2, job.NTime, res.nonce, res.difficulty)
				}
				if res.isBlock && onBlockFound != nil {
					onBlockFound(w.ID, res.nonce, res.difficulty)
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

// batchResult holds the outcome of mining a batch of nonces.
type batchResult struct {
	found      bool    // a hash beat the share target
	isBlock    bool    // the hash also beat the full network (block) target
	nonce      string  // winning (or best) nonce, hex-encoded
	difficulty float64 // difficulty of the winning/best hash
}

// mineBatch attempts to mine a batch of nonces. A share is reported when a hash
// beats shareTarget; if shareTarget is nil the network (block) target is used.
func (w *Worker) mineBatch(job *stratum.Job, extranonce1, extranonce2 string, shareTarget *big.Int, batchSize int) batchResult {
	// Calculate the full network (block) target from nBits
	networkTarget := calculateTarget(job.NBits)

	// Shares are reported against the pool-assigned share target. Fall back to
	// the network target when no share difficulty has been set yet.
	target := shareTarget
	if target == nil {
		target = networkTarget
	}

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
			diff := hashDifficulty(hashInt)
			if diff > bestDifficulty {
				bestDifficulty = diff
				bestNonce = fmt.Sprintf("%08x", nonce)
			}
		}

		// Check if hash meets the share target
		if hashInt.Cmp(target) <= 0 {
			nonceHex := fmt.Sprintf("%08x", nonce)
			return batchResult{
				found:      true,
				isBlock:    hashInt.Cmp(networkTarget) <= 0,
				nonce:      nonceHex,
				difficulty: hashDifficulty(hashInt),
			}
		}
	}

	return batchResult{nonce: bestNonce, difficulty: bestDifficulty}
}

// hashDifficulty returns the difficulty of a hash (difficulty1Target / hash).
func hashDifficulty(hashInt *big.Int) float64 {
	if hashInt.Sign() <= 0 {
		return 0
	}
	diff := new(big.Float).Quo(
		new(big.Float).SetInt(difficulty1Target),
		new(big.Float).SetInt(hashInt),
	)
	f, _ := diff.Float64()
	return f
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
