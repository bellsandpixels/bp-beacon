import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// The shared, design-system-agnostic assume-pass WALK SURFACE, ported from the approved Beacon walk mocks.
// Themed by --beacon-* CSS variables (neutral fallbacks) like FeedbackPane. Assume-pass: tasks are visible
// by default; a check passes unless flagged with a note; flagging a check auto-marks its surface walked
// (flagging is looking); the derived verdict updates live. Coverage + flags call the injected WalkAdapter;
// Submit writes the walk record. The host opens this from the hub's "Start walk". See walkVerdict.ts for
// the assume-pass rules (kept in step with the bp-qa record format).
import { useEffect, useMemo, useState } from 'react';
import { surfacesOf, deriveVerdict } from './walkVerdict.js';
const v = (name, fallback) => `var(--beacon-${name}, ${fallback})`;
export function WalkSurfacePane({ catalogue, adapter, build, env, onDone }) {
    const [state, setState] = useState({ walked: {}, defects: {} });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const surfaces = useMemo(() => surfacesOf(catalogue), [catalogue]);
    const verdict = useMemo(() => deriveVerdict(catalogue, state), [catalogue, state]);
    useEffect(() => {
        let live = true;
        setBusy(true);
        adapter
            .start()
            .then((s) => live && setState({ walked: s.walked || {}, defects: s.defects || {} }))
            .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not start the walk.'))
            .finally(() => live && setBusy(false));
        return () => {
            live = false;
        };
    }, [adapter]);
    async function toggleWalked(surfaceKey) {
        const next = !state.walked[surfaceKey];
        // Unwalking a surface also clears its flags, so a counted defect can never survive on a NOT-WALKED
        // surface (which would make the verdict read "must-fix ... across 0 walked surfaces").
        const surface = surfaces.find((s) => s.key === surfaceKey);
        const clearing = !next && surface
            ? surface.checks.map((c) => c.n).filter((n) => Object.prototype.hasOwnProperty.call(state.defects, n))
            : [];
        setState((s) => {
            const walked = { ...s.walked };
            if (next)
                walked[surfaceKey] = true;
            else
                delete walked[surfaceKey];
            const defects = { ...s.defects };
            for (const n of clearing)
                delete defects[n];
            return { ...s, walked, defects };
        });
        try {
            await adapter.markWalked(surfaceKey, next);
            for (const n of clearing)
                await adapter.clearFlag(n);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save that.');
        }
    }
    async function toggleFlag(surfaceKey, n) {
        const has = Object.prototype.hasOwnProperty.call(state.defects, n);
        if (has) {
            setState((s) => {
                const defects = { ...s.defects };
                delete defects[n];
                return { ...s, defects };
            });
            try {
                await adapter.clearFlag(n);
            }
            catch (e) {
                setError(e instanceof Error ? e.message : 'Could not clear that.');
            }
        }
        else {
            // Flagging a check means you looked at the surface: auto-walk it.
            setState((s) => ({ walked: { ...s.walked, [surfaceKey]: true }, defects: { ...s.defects, [n]: '' } }));
            try {
                await adapter.markWalked(surfaceKey, true);
                await adapter.flag({ checkRef: n, note: '' });
            }
            catch (e) {
                setError(e instanceof Error ? e.message : 'Could not flag that.');
            }
        }
    }
    // Typing only updates local state; the note is synced to the adapter once, on blur (below). flag()
    // upserts by checkRef, so one intake item is updated, not one created per keystroke.
    function setNote(n, note) {
        setState((s) => ({ ...s, defects: { ...s.defects, [n]: note } }));
    }
    // The note is the defect. Sync it when the field loses focus, and surface a failure like every other
    // write, so a lost note can never pass unnoticed into a submit (empty note = in-progress flag, still
    // tracked). Awaited and single, so writes stay ordered and last-typed wins.
    async function syncNote(n, note) {
        try {
            await adapter.flag({ checkRef: n, note });
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save that note.');
        }
    }
    async function submit() {
        setSubmitting(true);
        setError(null);
        try {
            const summary = await adapter.submit();
            onDone?.({ walkId: summary.walkId });
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not submit the walk.');
        }
        finally {
            setSubmitting(false);
        }
    }
    const verdictColor = verdict.label === 'PASS' ? v('ok', '#2f6d3a') : verdict.label === 'BLOCKED' || verdict.label === 'FAIL' ? v('error', '#a8322b') : v('muted', '#8a836f');
    return (_jsxs("div", { style: { color: v('fg', '#1a1a1a'), padding: v('pad', '16px'), fontFamily: v('font', 'inherit'), display: 'grid', gap: 14 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }, children: [_jsx("strong", { style: { fontFamily: v('serif', 'inherit') }, children: "Walk" }), build ? _jsxs("span", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 12, opacity: 0.7 }, children: [build, env ? ` (${env})` : ''] }) : null, _jsxs("span", { style: { marginLeft: 'auto', fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 12, opacity: 0.8 }, children: [verdict.walked, " / ", verdict.total, " walked", verdict.defects ? ` · ${verdict.defects} flagged` : ''] })] }), busy ? _jsx("span", { style: { opacity: 0.6, fontSize: 13 }, children: "Loading the walk..." }) : null, error ? _jsx("p", { style: { margin: 0, color: v('error', '#a8322b'), fontSize: 13 }, children: error }) : null, surfaces.map((s) => {
                const on = !!state.walked[s.key];
                return (_jsxs("div", { style: { border: `1px solid ${v('border', '#e4ddcd')}`, borderRadius: v('radius', '10px'), overflow: 'hidden' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: v('sunk', '#f0ebe0') }, children: [_jsxs("strong", { style: { flex: 1, fontFamily: v('serif', 'inherit'), fontSize: 14 }, children: [s.title, s.route ? _jsx("span", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.6, marginLeft: 6 }, children: s.route }) : null] }), _jsx("button", { onClick: () => toggleWalked(s.key), style: {
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: '4px 8px',
                                        borderRadius: v('radius', '7px'),
                                        border: `1px solid ${on ? v('ok', '#2f6d3a') : v('border', '#d0d0d0')}`,
                                        background: on ? v('ok-bg', '#e7efe4') : 'transparent',
                                        color: on ? v('ok', '#2f6d3a') : v('fg', '#1a1a1a'),
                                        cursor: 'pointer',
                                    }, children: on ? 'Walked' : 'Mark walked' })] }), !on ? (_jsxs("div", { style: { padding: '6px 10px', fontSize: 12, fontStyle: 'italic', opacity: 0.6, borderBottom: `1px solid ${v('border', '#eee')}` }, children: ["Not walked yet. Read the ", s.checks.length, " checks and flag anything wrong."] })) : null, s.checks.map((c) => {
                            const has = Object.prototype.hasOwnProperty.call(state.defects, c.n);
                            const note = state.defects[c.n] ?? '';
                            const noted = has && note.trim().length > 0;
                            return (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderTop: `1px solid ${v('border', '#eee')}`, background: has ? (noted ? v('bad-bg', '#f6e5e1') : 'transparent') : 'transparent' }, children: [_jsxs("span", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.6 }, children: [c.n, "."] }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("span", { style: { fontSize: 13, color: noted ? v('error', '#a8322b') : v('fg', '#1a1a1a') }, children: [c.text, c.severity === 'blocker' ? (_jsx("span", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: v('error', '#a8322b'), border: `1px solid ${v('error', '#a8322b')}`, borderRadius: 4, padding: '0 4px', marginLeft: 6 }, children: "must-fix" })) : null] }), has ? (_jsxs(_Fragment, { children: [_jsx("input", { value: note, onChange: (e) => setNote(c.n, e.target.value), onBlur: (e) => syncNote(c.n, e.target.value), placeholder: "What is wrong? This becomes the defect record.", "aria-label": `Defect note for check ${c.n}`, style: { display: 'block', width: '100%', marginTop: 6, padding: 6, fontSize: 13, borderRadius: v('radius', '7px'), border: `1px solid ${v('border', '#d0d0d0')}`, background: v('field-bg', '#fff'), color: v('fg', '#1a1a1a') } }), !noted ? (_jsx("p", { style: { margin: '4px 0 0', fontSize: 11, fontStyle: 'italic', opacity: 0.6 }, children: "Note required. Until you write what is wrong, this is not counted as a defect." })) : null] })) : null] }), _jsx("button", { onClick: () => toggleFlag(s.key, c.n), style: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: v('radius', '6px'), border: `1px solid ${has ? v('error', '#a8322b') : v('border', '#d0d0d0')}`, background: 'transparent', color: has ? v('error', '#a8322b') : v('fg', '#1a1a1a'), cursor: 'pointer', flex: 'none' }, children: has ? 'Clear' : 'Flag' })] }, c.n));
                        })] }, s.key));
            }), _jsxs("div", { style: { borderTop: `1px solid ${v('border', '#e4ddcd')}`, paddingTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, children: [_jsx("span", { style: { flex: 1, fontSize: 13, fontWeight: 600, color: verdictColor }, children: verdict.line }), _jsx("button", { onClick: submit, disabled: submitting, style: { padding: '8px 16px', borderRadius: v('radius', '8px'), border: 'none', background: v('accent', '#9B251B'), color: v('accent-fg', '#fff'), cursor: submitting ? 'default' : 'pointer' }, children: submitting ? 'Submitting...' : 'Submit walk' })] })] }));
}
