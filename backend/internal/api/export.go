package api

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/soloforge/backend/internal/stats"
)

// handleExport streams accumulated history as a downloadable file. It supports
// two datasets (?dataset=shares|sessions, default shares) and two formats
// (?format=csv|json, default csv) so users can pull their data into a
// spreadsheet or pipe it into their own tooling without scraping the dashboard.
func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	dataset := strings.ToLower(r.URL.Query().Get("dataset"))
	if dataset == "" {
		dataset = "shares"
	}
	format := strings.ToLower(r.URL.Query().Get("format"))
	if format == "" {
		format = "csv"
	}

	var (
		payload  interface{}
		csvBytes []byte
		err      error
	)

	switch dataset {
	case "shares":
		shares := s.stats.GetShareHistory(0)
		payload = shares
		csvBytes = sharesToCSV(shares)
	case "sessions":
		sessions := s.stats.GetSessionHistory(0)
		payload = sessions
		csvBytes = sessionsToCSV(sessions)
	default:
		http.Error(w, "Invalid dataset (use shares or sessions)", http.StatusBadRequest)
		return
	}

	filename := fmt.Sprintf("soloforge-%s-%s.%s", dataset, time.Now().UTC().Format("20060102-150405"), format)
	w.Header().Set("Content-Disposition", "attachment; filename=\""+filename+"\"")

	switch format {
	case "csv":
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		_, err = w.Write(csvBytes)
	case "json":
		w.Header().Set("Content-Type", "application/json")
		jsonResponse(w, payload)
	default:
		http.Error(w, "Invalid format (use csv or json)", http.StatusBadRequest)
		return
	}

	if err != nil {
		// Headers are already sent; nothing actionable beyond logging upstream.
		return
	}
}

// sharesToCSV renders share history as CSV with a header row.
func sharesToCSV(shares []stats.ShareEntry) []byte {
	var b strings.Builder
	cw := csv.NewWriter(&b)
	cw.Write([]string{"timestamp", "worker_id", "worker_name", "job_id", "nonce", "difficulty", "accepted"})
	for _, sh := range shares {
		cw.Write([]string{
			sh.Timestamp.UTC().Format(time.RFC3339),
			strconv.Itoa(sh.WorkerID),
			sh.WorkerName,
			sh.JobID,
			sh.Nonce,
			strconv.FormatFloat(sh.Difficulty, 'f', -1, 64),
			strconv.FormatBool(sh.Accepted),
		})
	}
	cw.Flush()
	return []byte(b.String())
}

// sessionsToCSV renders session history as CSV with a header row.
func sessionsToCSV(sessions []stats.Session) []byte {
	var b strings.Builder
	cw := csv.NewWriter(&b)
	cw.Write([]string{"id", "start_time", "end_time", "duration", "total_hashes", "best_difficulty"})
	for _, se := range sessions {
		cw.Write([]string{
			se.ID,
			se.StartTime.UTC().Format(time.RFC3339),
			se.EndTime.UTC().Format(time.RFC3339),
			se.Duration,
			strconv.FormatUint(se.TotalHashes, 10),
			strconv.FormatFloat(se.BestDifficulty, 'f', -1, 64),
		})
	}
	cw.Flush()
	return []byte(b.String())
}
