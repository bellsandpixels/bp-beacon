// The shared Beacon VALIDATION WALK contract, the walk analog of the feedback contract in types.ts.
// Design-system-agnostic, exactly like FeedbackPane: themed by --beacon-* CSS variables the host sets.
// The validation walk becomes a fourth Beacon affordance; @bp/ui/app-frame mounts the walk pane through a
// slot mirroring renderFeedback. Assume-pass: a walked surface's checks pass unless one is flagged with a
// note. Coverage (which surfaces nobody walked) is the load-bearing signal. See the validation-motion plan
// (T1) and bp-qa validation-checklist.md (the record FORMAT the walk renders downstream).
export {};
