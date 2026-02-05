package miner

import (
	"sync"

	"github.com/soloforge/backend/internal/stratum"
)

// Manager manages multiple mining workers
type Manager struct {
	mu sync.RWMutex

	workers    map[int]*Worker
	nextID     int
	cpuPercent int

	// Stratum connection data
	extranonce1     string
	extranonce2Size int

	// Callbacks
	onShareFound func(workerID int, jobID, extranonce2, ntime, nonce string, difficulty float64)
}

// NewManager creates a new worker manager
func NewManager() *Manager {
	return &Manager{
		workers:    make(map[int]*Worker),
		nextID:     1,
		cpuPercent: 80,
	}
}

// SetShareCallback sets the callback for found shares
func (m *Manager) SetShareCallback(cb func(workerID int, jobID, extranonce2, ntime, nonce string, difficulty float64)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onShareFound = cb
}

// SetStratumData sets the extranonce data from the Stratum connection
func (m *Manager) SetStratumData(extranonce1 string, extranonce2Size int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.extranonce1 = extranonce1
	m.extranonce2Size = extranonce2Size
}

// SetCPUPercent sets the CPU throttling for all workers
func (m *Manager) SetCPUPercent(percent int) {
	m.mu.Lock()
	m.cpuPercent = percent
	workers := make([]*Worker, 0, len(m.workers))
	for _, w := range m.workers {
		workers = append(workers, w)
	}
	m.mu.Unlock()

	for _, w := range workers {
		w.SetCPUPercent(percent)
	}
}

// AddWorker creates and starts a new worker
func (m *Manager) AddWorker(name string) *Worker {
	m.mu.Lock()
	id := m.nextID
	m.nextID++

	if name == "" {
		name = "Worker " + string(rune('A'+id-1))
	}

	worker := NewWorker(id, name, m.cpuPercent)
	worker.SetShareCallback(m.onShareFound)
	m.workers[id] = worker

	extranonce1 := m.extranonce1
	extranonce2Size := m.extranonce2Size
	m.mu.Unlock()

	if extranonce1 != "" {
		worker.Start(extranonce1, extranonce2Size)
	}

	return worker
}

// RemoveWorker stops and removes a worker
func (m *Manager) RemoveWorker(id int) bool {
	m.mu.Lock()
	worker, exists := m.workers[id]
	if exists {
		delete(m.workers, id)
	}
	m.mu.Unlock()

	if exists {
		worker.Stop()
	}

	return exists
}

// GetWorker returns a worker by ID
func (m *Manager) GetWorker(id int) *Worker {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.workers[id]
}

// GetAllWorkers returns all workers
func (m *Manager) GetAllWorkers() []*Worker {
	m.mu.RLock()
	defer m.mu.RUnlock()

	workers := make([]*Worker, 0, len(m.workers))
	for _, w := range m.workers {
		workers = append(workers, w)
	}
	return workers
}

// GetTotalHashrate returns the combined hashrate of all workers
func (m *Manager) GetTotalHashrate() float64 {
	workers := m.GetAllWorkers()
	var total float64
	for _, w := range workers {
		total += w.GetHashrate()
	}
	return total
}

// GetTotalHashCount returns the combined hash count of all workers
func (m *Manager) GetTotalHashCount() uint64 {
	workers := m.GetAllWorkers()
	var total uint64
	for _, w := range workers {
		total += w.GetHashCount()
	}
	return total
}

// StartAll starts all workers
func (m *Manager) StartAll() {
	m.mu.RLock()
	extranonce1 := m.extranonce1
	extranonce2Size := m.extranonce2Size
	workers := make([]*Worker, 0, len(m.workers))
	for _, w := range m.workers {
		workers = append(workers, w)
	}
	m.mu.RUnlock()

	for _, w := range workers {
		if !w.IsRunning() {
			w.Start(extranonce1, extranonce2Size)
		}
	}
}

// StopAll stops all workers
func (m *Manager) StopAll() {
	workers := m.GetAllWorkers()
	for _, w := range workers {
		w.Stop()
	}
}

// BroadcastJob sends a new job to all workers
func (m *Manager) BroadcastJob(job *stratum.Job) {
	workers := m.GetAllWorkers()
	for _, w := range workers {
		w.UpdateJob(job)
	}
}

// WorkerCount returns the number of workers
func (m *Manager) WorkerCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.workers)
}
