package api

import "testing"

func TestOriginCheckerDefaultsToPermissive(t *testing.T) {
	cases := [][]string{
		nil,
		{},
		{"*"},
		{"  ", ""}, // only blanks -> still permissive
		{"https://a.example", "*"},
	}
	for _, origins := range cases {
		oc := NewOriginChecker(origins)
		if !oc.AllowAll() {
			t.Fatalf("NewOriginChecker(%v) should allow all", origins)
		}
		if !oc.Allowed("https://anything.example") {
			t.Fatalf("permissive checker should allow any origin, %v", origins)
		}
	}
}

func TestOriginCheckerAllowlist(t *testing.T) {
	oc := NewOriginChecker([]string{"https://dash.example", "https://other.example"})
	if oc.AllowAll() {
		t.Fatal("explicit allowlist should not allow all")
	}
	if !oc.Allowed("https://dash.example") {
		t.Fatal("listed origin should be allowed")
	}
	// Matching is case-insensitive on the scheme/host.
	if !oc.Allowed("https://DASH.example") {
		t.Fatal("origin matching should be case-insensitive")
	}
	if oc.Allowed("https://evil.example") {
		t.Fatal("unlisted origin must be rejected")
	}
	if oc.Allowed("") {
		t.Fatal("empty origin must be rejected under an allowlist")
	}
}
