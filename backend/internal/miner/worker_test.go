package miner

import (
	"encoding/hex"
	"math/big"
	"testing"

	"github.com/soloforge/backend/internal/stratum"
)

// TestDoubleSHA256GenesisBlock verifies SHA-256d against the canonical Bitcoin
// genesis block: hashing its 80-byte header (and reversing to big-endian) must
// yield the well-known genesis block hash.
func TestDoubleSHA256GenesisBlock(t *testing.T) {
	headerHex := "01000000" +
		"0000000000000000000000000000000000000000000000000000000000000000" +
		"3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a" +
		"29ab5f49" + "ffff001d" + "1dac2b7c"

	header, err := hex.DecodeString(headerHex)
	if err != nil {
		t.Fatalf("decode header: %v", err)
	}

	got := hex.EncodeToString(reverseBytes(doubleSHA256(header)))
	want := "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"
	if got != want {
		t.Fatalf("genesis hash mismatch:\n got = %s\nwant = %s", got, want)
	}
}

func TestReverseBytes(t *testing.T) {
	in := []byte{0x01, 0x02, 0x03, 0x04}
	got := reverseBytes(in)
	want := []byte{0x04, 0x03, 0x02, 0x01}
	if string(got) != string(want) {
		t.Fatalf("reverseBytes = %x, want %x", got, want)
	}
	// The original slice must be left untouched.
	if in[0] != 0x01 {
		t.Fatalf("reverseBytes mutated its input: %x", in)
	}
}

// TestCalculateTargetDifficulty1 checks that the genesis nBits (0x1d00ffff)
// decodes to the difficulty-1 target.
func TestCalculateTargetDifficulty1(t *testing.T) {
	got := calculateTarget("1d00ffff")
	if got.Cmp(difficulty1Target) != 0 {
		t.Fatalf("calculateTarget(1d00ffff) = %x, want %x", got, difficulty1Target)
	}
}

func TestCalculateTargetInvalid(t *testing.T) {
	if got := calculateTarget("zz"); got.Sign() != 0 {
		t.Fatalf("calculateTarget on invalid input = %v, want 0", got)
	}
}

func TestShareTargetFromDifficulty(t *testing.T) {
	// Difficulty 1 -> the difficulty-1 target.
	if got := shareTargetFromDifficulty(1); got.Cmp(difficulty1Target) != 0 {
		t.Fatalf("shareTargetFromDifficulty(1) = %x, want %x", got, difficulty1Target)
	}

	// Non-positive difficulty -> nil (caller falls back to the block target).
	if got := shareTargetFromDifficulty(0); got != nil {
		t.Fatalf("shareTargetFromDifficulty(0) = %v, want nil", got)
	}

	// Higher difficulty -> smaller (harder) target.
	easy := shareTargetFromDifficulty(1)
	hard := shareTargetFromDifficulty(1024)
	if hard.Cmp(easy) >= 0 {
		t.Fatalf("expected harder target to be smaller: easy=%x hard=%x", easy, hard)
	}
}

func TestHashDifficulty(t *testing.T) {
	// A hash equal to the difficulty-1 target has difficulty ~1.
	if d := hashDifficulty(difficulty1Target); d < 0.999 || d > 1.001 {
		t.Fatalf("hashDifficulty(difficulty1Target) = %v, want ~1", d)
	}
	// Half the target is twice as hard.
	half := new(big.Int).Rsh(difficulty1Target, 1)
	if d := hashDifficulty(half); d < 1.999 || d > 2.001 {
		t.Fatalf("hashDifficulty(target/2) = %v, want ~2", d)
	}
	// A zero/negative value yields 0 instead of dividing by zero.
	if d := hashDifficulty(big.NewInt(0)); d != 0 {
		t.Fatalf("hashDifficulty(0) = %v, want 0", d)
	}
}

// TestMineBatchFindsShare uses a maximally easy target so the very first hash
// counts as a share, exercising the full header-building and reporting path.
func TestMineBatchFindsShare(t *testing.T) {
	w := NewWorker(1, "test", 100)

	job := &stratum.Job{
		ID:           "job1",
		PrevHash:     "0000000000000000000000000000000000000000000000000000000000000000",
		Coinbase1:    "00",
		Coinbase2:    "00",
		MerkleBranch: []string{},
		Version:      "01000000",
		NBits:        "1d00ffff",
		NTime:        "29ab5f49",
	}

	// Target = 2^256-1 — every possible hash beats it.
	easyTarget := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 256), big.NewInt(1))

	res := w.mineBatch(job, "", "", easyTarget, 10)
	if !res.found {
		t.Fatalf("expected a share to be found with a maximal target")
	}
	if len(res.nonce) != 8 {
		t.Fatalf("expected an 8-hex-char nonce, got %q", res.nonce)
	}
	if w.GetHashCount() == 0 {
		t.Fatalf("expected hash count to advance")
	}
}

// TestMineBatchNoShare uses an impossible target so no share is reported but the
// best-difficulty bookkeeping still runs.
func TestMineBatchNoShare(t *testing.T) {
	w := NewWorker(2, "test", 100)
	job := &stratum.Job{
		ID:        "job2",
		PrevHash:  "0000000000000000000000000000000000000000000000000000000000000000",
		Coinbase1: "00",
		Coinbase2: "00",
		Version:   "01000000",
		NBits:     "1d00ffff",
		NTime:     "29ab5f49",
	}

	// Target = 0 — nothing can beat it.
	res := w.mineBatch(job, "", "", big.NewInt(0), 50)
	if res.found {
		t.Fatalf("did not expect a share with a zero target")
	}
	if w.GetHashCount() != 50 {
		t.Fatalf("expected 50 hashes, got %d", w.GetHashCount())
	}
}
