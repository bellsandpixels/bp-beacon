// The assume-pass derived verdict, ported from the bp-qa validation-checklist model (deriveVerdict). Pure
// and testable, no React. A walked surface's checks pass unless flagged; a flag counts only with a
// non-empty note; a blocker-floor defect outranks everything; NOT WALKED is never a silent pass. Kept in
// step with vendor/bp-qa/validation/validation-checklist-format.mjs (the record FORMAT the walk renders
// downstream), so a Beacon walk and a committed record agree.
export function surfacesOf(catalogue) {
    const out = [];
    for (const area of catalogue.areas)
        for (const s of area.surfaces)
            out.push(s);
    return out;
}
export function checkByNumber(catalogue, n) {
    for (const s of surfacesOf(catalogue))
        for (const c of s.checks)
            if (c.n === n)
                return c;
    return undefined;
}
// A defect counts only when its note is non-empty after trim (an in-progress flag is not a defect).
function recordedDefects(state) {
    const out = [];
    for (const key of Object.keys(state.defects)) {
        const n = Number(key);
        const note = state.defects[n];
        if (note != null && String(note).trim().length > 0)
            out.push(n);
    }
    return out;
}
export function deriveVerdict(catalogue, state) {
    const surfaces = surfacesOf(catalogue);
    const total = surfaces.length;
    let walked = 0;
    for (const s of surfaces)
        if (state.walked[s.key])
            walked++;
    const defectNs = recordedDefects(state);
    let blockers = 0;
    for (const n of defectNs) {
        const chk = checkByNumber(catalogue, n);
        if (chk && chk.severity === 'blocker')
            blockers++;
    }
    const defects = defectNs.length;
    const debt = defects - blockers;
    const unwalked = total - walked;
    let label;
    if (blockers > 0)
        label = 'BLOCKED';
    else if (defects > 0)
        label = 'FAIL';
    else if (walked === 0)
        label = 'NOT REVIEWED';
    else if (walked < total)
        label = 'INCOMPLETE';
    else
        label = 'PASS';
    const tail = unwalked ? `; ${unwalked} surface${unwalked === 1 ? '' : 's'} NOT WALKED.` : '.';
    let line;
    if (label === 'BLOCKED') {
        line = `BLOCKED: ${blockers} must-fix defect${blockers === 1 ? '' : 's'}${debt ? ` and ${debt} tolerable` : ''} across ${walked} walked surface${walked === 1 ? '' : 's'}${tail} Do not ship until the must-fix list is empty.`;
    }
    else if (label === 'FAIL') {
        line = `FAIL: ${debt} tolerable defect${debt === 1 ? '' : 's'}, none must-fix, across ${walked} walked surface${walked === 1 ? '' : 's'}${tail} Shippable with recorded debt.`;
    }
    else if (label === 'NOT REVIEWED') {
        line = 'NOT REVIEWED: no surface was walked. Nobody looked.';
    }
    else if (label === 'INCOMPLETE') {
        line = `INCOMPLETE: ${walked} of ${total} surfaces walked, no defects flagged. ${unwalked} surface${unwalked === 1 ? '' : 's'} went unjudged.`;
    }
    else {
        line = `PASS: all ${total} surfaces walked, no defects flagged.`;
    }
    return { label, line, walked, total, defects, blockers };
}
