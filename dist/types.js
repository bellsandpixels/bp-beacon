// The shared Beacon feedback contract. This is the design-system-agnostic core that fudemoji and ike each
// re-ported off @bp/ui; it is now extracted here (decision #63) so every product speaks ONE contract. The
// wire envelope is canonical in client-portal docs/beacon-anon-ingest-spec.md; a contract test in
// client-portal asserts this SDK's envelope matches what /api/beacon-signal accepts.
export {};
