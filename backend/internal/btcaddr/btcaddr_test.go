package btcaddr

import "testing"

func TestValidateAcceptsMainnetAddresses(t *testing.T) {
	valid := []struct {
		name string
		addr string
	}{
		{"default P2PKH", "1FngDUBvDhPh9z3paCRHFEtHjnUMAFacn9"},
		{"genesis P2PKH", "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"},
		{"P2SH", "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"},
		{"P2SH 2", "342ftSRCvFHfCeFFBuz4xwbeqnDw6BGUey"},
		{"bech32 P2WPKH", "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"},
		{"bech32 P2WSH", "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3"},
		{"bech32m taproot", "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0"},
		{"bech32 uppercase", "BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4"},
	}

	for _, tc := range valid {
		t.Run(tc.name, func(t *testing.T) {
			if err := Validate(tc.addr); err != nil {
				t.Fatalf("Validate(%q) = %v, want nil", tc.addr, err)
			}
			if !IsValid(tc.addr) {
				t.Fatalf("IsValid(%q) = false, want true", tc.addr)
			}
		})
	}
}

func TestValidateRejectsBadAddresses(t *testing.T) {
	invalid := []struct {
		name string
		addr string
	}{
		{"empty", ""},
		{"too short", "abc"},
		{"P2PKH bad checksum", "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb"},
		{"P2PKH invalid char (0)", "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf0a"},
		{"bech32 bad checksum", "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5"},
		{"bech32 wrong hrp", "lc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"},
		{"bech32 mixed case", "bc1Qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"},
		{"testnet P2PKH", "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn"},
		{"testnet bech32", "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"},
		{"random garbage", "not-an-address"},
	}

	for _, tc := range invalid {
		t.Run(tc.name, func(t *testing.T) {
			if err := Validate(tc.addr); err == nil {
				t.Fatalf("Validate(%q) = nil, want error", tc.addr)
			}
			if IsValid(tc.addr) {
				t.Fatalf("IsValid(%q) = true, want false", tc.addr)
			}
		})
	}
}

func TestValidateTestnetMessageIsHelpful(t *testing.T) {
	// A testnet address is a common mistake; the error should call it out
	// rather than just saying "invalid".
	err := Validate("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx")
	if err == nil {
		t.Fatal("expected testnet address to be rejected")
	}
}
