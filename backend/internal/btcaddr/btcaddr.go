// Package btcaddr provides dependency-free validation of mainnet Bitcoin
// addresses. Solo mining is paid out to the address configured here, so a
// silently mistyped address means any block reward is lost forever. The
// previous check only looked at string length; this package verifies the
// actual encoding and checksum so bad input is rejected before mining starts.
//
// Supported mainnet formats:
//   - P2PKH  ("1..."):  Base58Check, version byte 0x00
//   - P2SH   ("3..."):  Base58Check, version byte 0x05
//   - SegWit ("bc1..."): Bech32 (witness v0) / Bech32m (witness v1+)
//
// Testnet/regtest addresses are intentionally rejected: the whole app targets
// mainnet (solo.ckpool.org, 3.125 BTC reward), so accepting a testnet address
// would itself be a footgun.
package btcaddr

import (
	"crypto/sha256"
	"fmt"
	"strings"
)

// Validate returns nil if addr is a well-formed mainnet Bitcoin address and a
// descriptive error otherwise.
func Validate(addr string) error {
	if addr == "" {
		return fmt.Errorf("address is empty")
	}

	// Bech32 addresses are case-insensitive but must not mix cases, and always
	// start with the mainnet human-readable part "bc1".
	lower := strings.ToLower(addr)
	if strings.HasPrefix(lower, "bc1") {
		return validateBech32(addr)
	}

	if strings.HasPrefix(addr, "1") || strings.HasPrefix(addr, "3") {
		return validateBase58Check(addr)
	}

	if strings.HasPrefix(lower, "tb1") || strings.HasPrefix(addr, "m") ||
		strings.HasPrefix(addr, "n") || strings.HasPrefix(addr, "2") {
		return fmt.Errorf("looks like a testnet address; a mainnet address (1.., 3.. or bc1..) is required")
	}

	return fmt.Errorf("unrecognized address format (expected 1.., 3.. or bc1..)")
}

// IsValid reports whether addr is a valid mainnet Bitcoin address.
func IsValid(addr string) bool {
	return Validate(addr) == nil
}

// ---------------------------------------------------------------------------
// Base58Check (P2PKH / P2SH)
// ---------------------------------------------------------------------------

const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

func validateBase58Check(addr string) error {
	// Legacy addresses are 25–34 characters; cheap length guard before decoding.
	if len(addr) < 26 || len(addr) > 35 {
		return fmt.Errorf("invalid length for a legacy (base58) address")
	}

	decoded, err := base58Decode(addr)
	if err != nil {
		return err
	}

	// version(1) + payload(20) + checksum(4)
	if len(decoded) != 25 {
		return fmt.Errorf("invalid base58 address payload length")
	}

	body := decoded[:21]
	checksum := decoded[21:]
	want := doubleSHA256(body)[:4]
	for i := 0; i < 4; i++ {
		if checksum[i] != want[i] {
			return fmt.Errorf("invalid address checksum (likely a typo)")
		}
	}

	switch decoded[0] {
	case 0x00, 0x05: // mainnet P2PKH, mainnet P2SH
		return nil
	default:
		return fmt.Errorf("unsupported address version byte 0x%02x (not mainnet)", decoded[0])
	}
}

// base58Decode decodes a base58 string into bytes, preserving leading zero
// bytes (encoded as leading '1's).
func base58Decode(s string) ([]byte, error) {
	result := []byte{0}
	for _, r := range s {
		idx := strings.IndexRune(base58Alphabet, r)
		if idx < 0 {
			return nil, fmt.Errorf("invalid base58 character %q", string(r))
		}

		// result = result*58 + idx
		carry := idx
		for i := len(result) - 1; i >= 0; i-- {
			carry += 58 * int(result[i])
			result[i] = byte(carry & 0xff)
			carry >>= 8
		}
		for carry > 0 {
			result = append([]byte{byte(carry & 0xff)}, result...)
			carry >>= 8
		}
	}

	// Each leading '1' represents a leading zero byte.
	leadingZeros := 0
	for _, r := range s {
		if r != '1' {
			break
		}
		leadingZeros++
	}

	// Strip the single sentinel zero we seeded result with, if it is still
	// significant (i.e. not part of the real leading-zero count).
	for len(result) > 1 && result[0] == 0 {
		result = result[1:]
	}

	out := make([]byte, leadingZeros+len(result))
	copy(out[leadingZeros:], result)
	return out, nil
}

// ---------------------------------------------------------------------------
// Bech32 / Bech32m (native SegWit)
// ---------------------------------------------------------------------------

const bech32Charset = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"

const (
	bech32Const  = 1
	bech32mConst = 0x2bc830a3
)

func validateBech32(addr string) error {
	// Reject mixed case (BIP-173): the address must be all-lower or all-upper.
	if addr != strings.ToLower(addr) && addr != strings.ToUpper(addr) {
		return fmt.Errorf("bech32 address must not mix upper and lower case")
	}
	addr = strings.ToLower(addr)

	if len(addr) < 8 || len(addr) > 90 {
		return fmt.Errorf("invalid length for a bech32 address")
	}

	pos := strings.LastIndexByte(addr, '1')
	if pos < 1 {
		return fmt.Errorf("malformed bech32 address (missing separator)")
	}
	hrp := addr[:pos]
	if hrp != "bc" {
		return fmt.Errorf("not a mainnet bech32 address (human-readable part %q)", hrp)
	}

	dataPart := addr[pos+1:]
	if len(dataPart) < 6 {
		return fmt.Errorf("bech32 data too short")
	}

	data := make([]int, 0, len(dataPart))
	for _, r := range dataPart {
		idx := strings.IndexRune(bech32Charset, r)
		if idx < 0 {
			return fmt.Errorf("invalid bech32 character %q", string(r))
		}
		data = append(data, idx)
	}

	// First data value is the witness version (0–16).
	witnessVersion := data[0]
	if witnessVersion > 16 {
		return fmt.Errorf("invalid witness version %d", witnessVersion)
	}

	// The checksum constant depends on the witness version: v0 uses Bech32,
	// v1+ uses Bech32m (BIP-350).
	expectedConst := bech32Const
	if witnessVersion >= 1 {
		expectedConst = bech32mConst
	}
	if bech32Polymod(append(hrpExpand(hrp), data...)) != expectedConst {
		return fmt.Errorf("invalid bech32 checksum (likely a typo)")
	}

	// Decode the witness program (everything after the version, minus the 6
	// checksum symbols) from 5-bit groups to bytes.
	program, err := convertBits(data[1:len(data)-6], 5, 8, false)
	if err != nil {
		return fmt.Errorf("invalid witness program encoding")
	}
	if len(program) < 2 || len(program) > 40 {
		return fmt.Errorf("witness program must be 2–40 bytes")
	}
	// Witness v0 is only defined for 20-byte (P2WPKH) and 32-byte (P2WSH) programs.
	if witnessVersion == 0 && len(program) != 20 && len(program) != 32 {
		return fmt.Errorf("witness v0 program must be 20 or 32 bytes")
	}

	return nil
}

func hrpExpand(hrp string) []int {
	out := make([]int, 0, len(hrp)*2+1)
	for _, c := range hrp {
		out = append(out, int(c)>>5)
	}
	out = append(out, 0)
	for _, c := range hrp {
		out = append(out, int(c)&31)
	}
	return out
}

func bech32Polymod(values []int) int {
	gen := []int{0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3}
	chk := 1
	for _, v := range values {
		top := chk >> 25
		chk = (chk&0x1ffffff)<<5 ^ v
		for i := 0; i < 5; i++ {
			if (top>>i)&1 == 1 {
				chk ^= gen[i]
			}
		}
	}
	return chk
}

// convertBits regroups a byte/symbol stream from `from`-bit groups into
// `to`-bit groups, as used to recover the witness program from bech32 data.
func convertBits(data []int, from, to uint, pad bool) ([]int, error) {
	acc := 0
	bits := uint(0)
	var out []int
	maxv := (1 << to) - 1
	for _, value := range data {
		if value < 0 || value>>from != 0 {
			return nil, fmt.Errorf("invalid value in convertBits")
		}
		acc = (acc << from) | value
		bits += from
		for bits >= to {
			bits -= to
			out = append(out, (acc>>bits)&maxv)
		}
	}
	if pad {
		if bits > 0 {
			out = append(out, (acc<<(to-bits))&maxv)
		}
	} else if bits >= from || ((acc<<(to-bits))&maxv) != 0 {
		return nil, fmt.Errorf("invalid padding in convertBits")
	}
	return out, nil
}

// doubleSHA256 computes SHA256(SHA256(b)).
func doubleSHA256(b []byte) []byte {
	first := sha256.Sum256(b)
	second := sha256.Sum256(first[:])
	return second[:]
}
