// First-run / onboarding types: the contract a product's first-run experience runs on. Design-system
// agnostic like the feedback and walk contracts. The OnboardingAdapter is async so a server-backed store
// (per-user, cross-device) can replace the default local one without a consumer change.
//
// The three user choices are deliberately distinct:
//   - SKIP ("not now"): closes the welcome pane; it may resurface after a quiet period while the checklist
//     is unfinished (OnboardingPolicy.resurfaceAfterMs). Skipping a TOUR ends that tour for good.
//   - DON'T SHOW ME THIS AGAIN (suppressed): nothing auto-opens again, neither the pane nor any tour. The
//     user can still open onboarding by hand from wherever the host offers it.
//   - The seen version: what the user last saw, so What's new opens once per upgrade, not every visit.
export {};
