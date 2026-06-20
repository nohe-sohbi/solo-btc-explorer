package api

import "strings"

// OriginChecker decides whether a browser Origin is allowed to call the API or
// open a WebSocket. By default (no configured origins) every origin is allowed,
// which preserves the original development-friendly behaviour. Setting
// ALLOWED_ORIGINS locks both CORS and the WebSocket handshake down to an
// explicit allowlist — important because the dashboard can change the payout
// wallet and start/stop mining, so an open WebSocket CheckOrigin is a real
// cross-site request vector in a hosted deployment.
type OriginChecker struct {
	allowAll bool
	allowed  map[string]bool
}

// NewOriginChecker builds a checker from a list of origins. An empty list, or a
// list containing "*", allows all origins.
func NewOriginChecker(origins []string) *OriginChecker {
	oc := &OriginChecker{allowed: make(map[string]bool)}
	for _, o := range origins {
		o = strings.TrimSpace(o)
		switch {
		case o == "":
			continue
		case o == "*":
			oc.allowAll = true
		default:
			oc.allowed[strings.ToLower(o)] = true
		}
	}
	// Nothing concrete configured -> stay permissive (dev default).
	if len(oc.allowed) == 0 {
		oc.allowAll = true
	}
	return oc
}

// AllowAll reports whether every origin is permitted.
func (oc *OriginChecker) AllowAll() bool { return oc.allowAll }

// Allowed reports whether the given origin may access the API.
func (oc *OriginChecker) Allowed(origin string) bool {
	if oc.allowAll {
		return true
	}
	return oc.allowed[strings.ToLower(origin)]
}
