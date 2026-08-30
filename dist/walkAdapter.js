// A WALK ADAPTER for local use: an in-memory stub, and the shape a portal-backed adapter fills. The
// PRODUCTION adapter (speaking the client-portal walk envelope: cohort intake with check-ref + build/env,
// coverage, dispositions) rides T3, when that server contract exists. createStubWalkAdapter keeps state in
// memory so the hub + surface render and demo end to end (and drive the smoke) without a backend. It is a
// stub, clearly: submit returns a synthetic id and moves flags into "my issues" with a Submitted status.
import { deriveVerdict, checkByNumber, surfacesOf } from './walkVerdict.js';
export function createStubWalkAdapter(catalogue, opts = {}) {
    const build = opts.build ?? '0.0.0';
    const env = opts.env ?? 'uat';
    let authed = opts.authenticated ?? false;
    const state = { walked: {}, defects: {} };
    const refs = {}; // the intake ref minted per flagged check, reused when its note updates
    const completed = [];
    const issues = [];
    let seq = 1;
    const identity = () => ({ authenticated: authed, name: authed ? opts.name : undefined });
    return {
        authenticate: async () => {
            authed = true;
            return identity();
        },
        identity: async () => identity(),
        available: async () => ({ offered: true, build, env, catalogueId: catalogue.catalogueId }),
        current: async () => {
            // In-memory in-progress = any walked surface or held flag not yet submitted. No persisted walkId until
            // submit, so a synthetic id stands in; the hub only reads coverage/flagged for the Resume affordance.
            if (!Object.keys(state.walked).length && !Object.keys(state.defects).length)
                return null;
            const v = deriveVerdict(catalogue, state);
            return { walkId: 'stub-current', build, env, coverage: { walked: v.walked, total: v.total }, flagged: v.defects };
        },
        start: async () => ({ walked: { ...state.walked }, defects: { ...state.defects } }),
        markWalked: async (surfaceKey, walked) => {
            if (walked)
                state.walked[surfaceKey] = true;
            else
                delete state.walked[surfaceKey];
        },
        flag: async ({ checkRef, note }) => {
            // Upsert by checkRef: one ref per check, minted once and reused when the note is edited.
            state.defects[checkRef] = note;
            const ref = refs[checkRef] ?? (refs[checkRef] = `INT-${String(1000 + seq++)}`);
            return { id: ref, reference: ref };
        },
        clearFlag: async (checkRef) => {
            delete state.defects[checkRef];
            delete refs[checkRef];
        },
        submit: async () => {
            const v = deriveVerdict(catalogue, state);
            const walkId = `walk-${seq++}`;
            const summary = {
                walkId,
                build,
                env,
                submittedOn: new Date().toISOString(),
                coverage: { walked: v.walked, total: v.total },
                flagged: v.defects,
            };
            completed.unshift(summary);
            // Move noted flags into "my issues" with a fresh Submitted disposition, keeping each flag's own ref.
            for (const key of Object.keys(state.defects)) {
                const n = Number(key);
                const note = state.defects[n];
                if (note == null || !note.trim().length)
                    continue;
                const chk = checkByNumber(catalogue, n);
                const surface = surfacesOf(catalogue).find((s) => s.checks.some((c) => c.n === n));
                issues.unshift({
                    id: `iss-${seq++}`,
                    reference: refs[n] ?? `INT-${String(1000 + seq++)}`,
                    checkRef: n,
                    surfaceKey: surface?.key,
                    title: chk?.text ?? `Check ${n}`,
                    status: 'submitted',
                    build,
                });
            }
            // Consume the flags: they now live as issues, so a re-submit cannot duplicate them and the live
            // verdict reflects that they were moved out.
            state.defects = {};
            for (const key of Object.keys(refs))
                delete refs[Number(key)];
            return summary;
        },
        listMine: async () => [...completed],
        listMyIssues: async () => [...issues],
    };
}
