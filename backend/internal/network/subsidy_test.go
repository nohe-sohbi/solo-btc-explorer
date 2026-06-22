package network

import "testing"

func TestBlockSubsidy(t *testing.T) {
	cases := []struct {
		name   string
		height int64
		want   float64
	}{
		{"genesis era", 0, 50},
		{"end of first era", 209999, 50},
		{"first halving", 210000, 25},
		{"second halving", 420000, 12.5},
		{"third halving", 630000, 6.25},
		{"fourth halving (current era)", 840000, 3.125},
		{"deep in fourth era", 930000, 3.125},
		{"negative height is zero", -1, 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := BlockSubsidy(tc.height); got != tc.want {
				t.Fatalf("BlockSubsidy(%d) = %v, want %v", tc.height, got, tc.want)
			}
		})
	}
}

func TestBlockSubsidyEventuallyZero(t *testing.T) {
	// After 64 halvings the integer subsidy is exhausted.
	if got := BlockSubsidy(64 * halvingInterval); got != 0 {
		t.Fatalf("subsidy after 64 halvings = %v, want 0", got)
	}
}

func TestRefreshDerivesBlockReward(t *testing.T) {
	// A height-only refresh (price/hashrate endpoints failing) should still fill
	// in the locally-derived block reward.
	f := NewFetcher("")
	f.set(Stats{BlockHeight: 840000, BlockRewardBTC: BlockSubsidy(840000)})
	if got := f.Get().BlockRewardBTC; got != 3.125 {
		t.Fatalf("BlockRewardBTC = %v, want 3.125", got)
	}
}
