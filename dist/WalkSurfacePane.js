import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// The shared, design-system-agnostic assume-pass WALK SURFACE, ported from the approved Beacon walk mocks.
// Themed by --beacon-* CSS variables (neutral fallbacks) like FeedbackPane. Assume-pass: tasks are visible
// by default; a check passes unless flagged with a note; flagging a check auto-marks its surface walked
// (flagging is looking); the derived verdict updates live. Coverage + flags call the injected WalkAdapter;
// Submit writes the walk record. The host opens this from the hub's "Start walk". See walkVerdict.ts for
// the assume-pass rules (kept in step with the bp-qa record format).
import { useEffect, useMemo, useState } from 'react';
import { surfacesOf, deriveVerdict } from './walkVerdict.js';
import { qrMatrix } from './qr.js';
import { isFlagged, startFailureMessage, withDefect, withDefects, withWalked, withoutDefects } from './walkState.js';
const v = (name, fallback) => `var(--beacon-${name}, ${fallback})`;
/** A QR code for `text`, drawn as one SVG path. Encoded locally (qr.ts); the URL never goes to a QR service. */
function WalkQr({ text, size = 168 }) {
    const path = useMemo(() => {
        const m = qrMatrix(text, { ecc: 'M' });
        let d = '';
        m.forEach((row, y) => row.forEach((on, x) => (on ? (d += `M${x},${y}h1v1h-1z`) : null)));
        return { d, n: m.length };
    }, [text]);
    return (
    // A fixed light background and dark modules in both themes: phone cameras read dark-on-light reliably.
    _jsx("svg", { role: "img", "aria-label": "QR code for this walk", viewBox: `-4 -4 ${path.n + 8} ${path.n + 8}`, width: size, height: size, shapeRendering: "crispEdges", style: { background: '#fff', borderRadius: 8, display: 'block' }, children: _jsx("path", { d: path.d, fill: "#111" }) }));
}
function hasHelp(h) {
    return !!h && (!!(h.how && h.how.length) || !!h.why || !!h.success || !!h.failure);
}
/**
 * A check's authored guidance for a mixed-skill tester, ported from Toudai's retired TesterWalk (the layout
 * testers walked in before walks moved to the portal, toudai ffaf6bd8): a "Not sure? Show me how" toggle
 * opens How to do this (the steps) and Why this matters, then two columns, "Looks right when" and "Flag it
 * when". The columns stack on a narrow (phone) screen. Only the parts the catalogue authored are shown.
 */
function CheckHelp({ n, help }) {
    const [open, setOpen] = useState(false);
    const k = { margin: '0 0 4px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 };
    const t = { margin: 0, fontSize: 13, lineHeight: 1.45 };
    const box = (color) => ({ border: `1px solid ${color}`, borderRadius: v('radius', '8px'), padding: 8 });
    const good = v('ok', '#2f6d3a');
    const bad = v('error', '#a8322b');
    return (_jsxs("div", { "data-testid": `walk-check-help-${n}`, style: { marginTop: 6 }, children: [_jsxs("button", { type: "button", onClick: () => setOpen((o) => !o), "aria-expanded": open, style: { display: 'inline-flex', gap: 4, alignItems: 'center', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: v('accent', '#9B251B') }, children: [_jsx("span", { "aria-hidden": true, children: open ? '−' : '+' }), open ? 'Hide guidance' : 'Not sure? Show me how'] }), open ? (_jsxs("div", { style: { marginTop: 6, padding: 12, borderRadius: v('radius', '8px'), border: `1px solid ${v('border', '#e4ddcd')}`, background: v('sunk', '#f0ebe0') }, children: [help.how && help.how.length ? (_jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("p", { style: k, children: "How to do this" }), _jsx("ol", { style: { ...t, paddingLeft: 18 }, children: help.how.map((step, i) => (_jsx("li", { style: { marginBottom: 4 }, children: step }, i))) })] })) : null, help.why ? (_jsxs("div", { style: { marginBottom: 12 }, children: [_jsx("p", { style: k, children: "Why this matters" }), _jsx("p", { style: t, children: help.why })] })) : null, help.success || help.failure ? (_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }, children: [help.success ? (_jsxs("div", { style: box(good), children: [_jsx("p", { style: { margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: good }, children: "Looks right when" }), _jsx("p", { style: t, children: help.success })] })) : null, help.failure ? (_jsxs("div", { style: box(bad), children: [_jsx("p", { style: { margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: bad }, children: "Flag it when" }), _jsx("p", { style: t, children: help.failure })] })) : null] })) : null] })) : null] }));
}
export function WalkSurfacePane({ catalogue, adapter, build, env, startOpts, onDone, onExit, title, links }) {
    const [device, setDevice] = useState(false);
    const [copied, setCopied] = useState(false);
    const [state, setState] = useState({ walked: {}, defects: {} });
    const [start, setStart] = useState({ phase: 'starting' });
    // Bumped by Try again, so the start effect runs once more against the same adapter.
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const ready = start.phase === 'ready';
    const surfaces = useMemo(() => surfacesOf(catalogue), [catalogue]);
    const verdict = useMemo(() => deriveVerdict(catalogue, state), [catalogue, state]);
    // The walk exists only once start() resolves. Until then the checks are not rendered at all, and a failed
    // start is a blocking state with its reason, never a quiet line above a checklist that still takes marks and
    // flags (2026-10-09: a refused start left "4 / 4 walked, 1 flagged" on screen while nothing was saved).
    useEffect(() => {
        let live = true;
        setStart({ phase: 'starting' });
        setError(null);
        setState({ walked: {}, defects: {} });
        adapter
            .start(startOpts)
            .then((s) => {
            if (!live)
                return;
            setState({ walked: s.walked || {}, defects: s.defects || {} });
            setStart({ phase: 'ready' });
        })
            .catch((e) => live && setStart({ phase: 'failed', message: startFailureMessage(e) }));
        return () => {
            live = false;
        };
    }, [adapter, startOpts, attempt]);
    // Every write below is optimistic: the pane shows the change, then saves it. A save that throws is ROLLED
    // BACK, so the pane only ever shows what the server holds, and the error says it was not saved.
    const notSaved = (e, fallback) => setError(`Not saved. ${e instanceof Error && e.message.trim() ? e.message : fallback}`);
    async function toggleWalked(surfaceKey) {
        if (!ready)
            return;
        const was = !!state.walked[surfaceKey];
        const next = !was;
        // Unwalking a surface also clears its flags, so a counted defect can never survive on a NOT-WALKED
        // surface (which would make the verdict read "must-fix ... across 0 walked surfaces").
        const surface = surfaces.find((s) => s.key === surfaceKey);
        const clearing = !next && surface
            ? surface.checks.filter((c) => isFlagged(state, c.n)).map((c) => [c.n, state.defects[c.n] ?? ''])
            : [];
        setError(null);
        setState((s) => withoutDefects(withWalked(s, surfaceKey, next), clearing.map(([n]) => n)));
        let marked = false;
        let cleared = 0;
        try {
            await adapter.markWalked(surfaceKey, next);
            marked = true;
            for (const [n] of clearing) {
                await adapter.clearFlag(n);
                cleared++;
            }
        }
        catch (e) {
            // Undo exactly what did not save: the walk mark if it failed, and every flag not yet cleared.
            setState((s) => withDefects(marked ? s : withWalked(s, surfaceKey, was), clearing.slice(cleared)));
            notSaved(e, 'Could not save that.');
        }
    }
    async function toggleFlag(surfaceKey, n) {
        if (!ready)
            return;
        setError(null);
        if (isFlagged(state, n)) {
            const note = state.defects[n] ?? '';
            setState((s) => withoutDefects(s, [n]));
            try {
                await adapter.clearFlag(n);
            }
            catch (e) {
                setState((s) => withDefects(s, [[n, note]]));
                notSaved(e, 'Could not clear that.');
            }
        }
        else {
            // Flagging a check means you looked at the surface: auto-walk it.
            const wasWalked = !!state.walked[surfaceKey];
            setState((s) => withDefect(withWalked(s, surfaceKey, true), n, ''));
            let marked = false;
            try {
                await adapter.markWalked(surfaceKey, true);
                marked = true;
                await adapter.flag({ checkRef: n, note: '' });
            }
            catch (e) {
                setState((s) => {
                    const unflagged = withoutDefects(s, [n]);
                    return marked ? unflagged : withWalked(unflagged, surfaceKey, wasWalked);
                });
                notSaved(e, 'Could not flag that.');
            }
        }
    }
    // Typing only updates local state; the note is synced to the adapter once, on blur (below). flag()
    // upserts by checkRef, so one intake item is updated, not one created per keystroke.
    function setNote(n, note) {
        setState((s) => withDefect(s, n, note));
    }
    // The note is the defect. Sync it when the field loses focus, and surface a failure like every other
    // write, so a lost note can never pass unnoticed into a submit (empty note = in-progress flag, still
    // tracked). Awaited and single, so writes stay ordered and last-typed wins. A failed note keeps the typed
    // text in the field (it is the tester's words), and the error says it was not saved.
    async function syncNote(n, note) {
        if (!ready)
            return;
        try {
            await adapter.flag({ checkRef: n, note });
        }
        catch (e) {
            notSaved(e, `Could not save the note on check ${n}.`);
        }
    }
    async function submit() {
        if (!ready)
            return;
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
    const mono = { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 12, opacity: 0.75 };
    const linkBtn = { border: 'none', background: 'transparent', padding: '4px 0', color: v('accent', '#9B251B'), cursor: 'pointer', fontSize: 13, fontWeight: 600 };
    const toolBtn = (hi = false) => ({
        fontSize: 12,
        padding: '5px 10px',
        borderRadius: v('radius', '8px'),
        border: `1px solid ${hi ? v('accent', '#9B251B') : v('border', '#d0d0d0')}`,
        background: 'transparent',
        color: v('fg', '#1a1a1a'),
        cursor: 'pointer',
        whiteSpace: 'nowrap',
    });
    const wrap = { color: v('fg', '#1a1a1a'), padding: v('pad', '16px'), fontFamily: v('font', 'inherit'), display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 14 };
    async function copyHandoff() {
        if (!links?.handoff)
            return;
        try {
            await navigator.clipboard.writeText(links.handoff);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            setError('Could not copy the link. Select it and copy it by hand.');
        }
    }
    const header = (_jsxs("div", { style: { display: 'grid', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, children: [onExit ? (_jsx("button", { onClick: onExit, style: linkBtn, "data-testid": "walk-exit", children: "\u2190 Walks" })) : null, _jsxs("div", { style: { marginLeft: onExit ? 'auto' : 0, textAlign: onExit ? 'right' : 'left', display: 'grid' }, children: [_jsx("strong", { style: { fontFamily: v('serif', 'inherit') }, children: title || catalogue.catalogueId }), _jsxs("span", { style: mono, "data-testid": "walk-progress", children: [build ? `${build}${env ? ` (${env})` : ''} · ` : '', ready
                                        ? `${verdict.walked} / ${verdict.total} walked${verdict.defects ? ` · ${verdict.defects} flagged` : ''}`
                                        : start.phase === 'failed'
                                            ? 'not started'
                                            : 'starting'] })] })] }), ready && links && (links.popOut || links.review || links.handoff) ? (_jsxs("div", { style: { display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: `1px solid ${v('border', '#e4ddcd')}`, paddingTop: 8 }, children: [links.popOut ? (_jsx("button", { style: toolBtn(), title: "Open this walk in its own window", onClick: () => window.open(links.popOut, 'bp-validation-walk', 'popup=yes,width=820,height=960'), children: "\u29C9 Pop out" })) : null, links.review ? (_jsx("button", { style: toolBtn(), title: "Open the walk record in the portal", onClick: () => window.open(links.review, '_blank', 'noopener'), children: "\u2197 Review in portal" })) : null, links.handoff ? (_jsx("button", { style: toolBtn(true), title: "Continue this walk on a tablet or phone", onClick: () => setDevice(true), children: "\u25A3 Another device" })) : null] })) : null] }));
    // Continue on another device: the same walk's URL as a QR code and a copyable link. The walk itself stays
    // mounted underneath (this is a view swap, not a navigation), so Back returns with nothing lost.
    if (device && ready && links?.handoff) {
        return (_jsxs("div", { style: wrap, children: [_jsx("button", { onClick: () => setDevice(false), style: { ...linkBtn, justifySelf: 'start' }, children: "\u2190 Back to the walk" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'center', gap: 10, textAlign: 'center' }, children: [_jsx("span", { style: { ...mono, letterSpacing: '0.12em', textTransform: 'uppercase' }, children: "Continue on another device" }), _jsx("strong", { style: { fontFamily: v('serif', 'inherit'), fontSize: 18 }, children: "Scan to walk on your tablet" }), _jsx(WalkQr, { text: links.handoff }), _jsx("p", { style: { margin: 0, fontSize: 13, maxWidth: 340 }, children: "Sign in on the tablet with your B&P email. Your walked checks and flags carry over, because they are saved on the server." }), _jsxs("div", { style: { display: 'flex', gap: 6, alignItems: 'center', width: '100%', boxSizing: 'border-box', border: `1px solid ${v('border', '#e4ddcd')}`, borderRadius: v('radius', '8px'), padding: '6px 8px' }, children: [_jsx("span", { style: { ...mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }, children: links.handoff }), _jsx("button", { style: toolBtn(), onClick: copyHandoff, children: copied ? 'Copied' : 'Copy' })] }), error ? _jsx("p", { style: { margin: 0, color: v('error', '#a8322b'), fontSize: 13 }, children: error }) : null] })] }));
    }
    if (start.phase === 'starting') {
        return (_jsxs("div", { style: wrap, children: [header, _jsx("span", { role: "status", "data-testid": "walk-starting", style: { opacity: 0.6, fontSize: 13 }, children: "Starting the walk..." })] }));
    }
    // No walk: say so, give the reason, and offer only what can work (try again, or go back). The checks are not
    // shown, because a mark or a flag here would have nowhere to be saved.
    if (start.phase === 'failed') {
        return (_jsxs("div", { style: wrap, children: [header, _jsxs("div", { role: "alert", "data-testid": "walk-start-failed", 
                    // The card surface (which every host maps, light and dark) with the error colour on the border and the
                    // heading: a tinted fill would need a dark-mode pair the hosts do not all provide.
                    style: { display: 'grid', gap: 8, padding: 12, borderRadius: v('radius', '8px'), border: `1px solid ${v('error', '#a8322b')}`, background: v('card', 'transparent') }, children: [_jsx("strong", { style: { fontSize: 14, color: v('error', '#a8322b') }, children: "This walk did not start" }), _jsx("p", { style: { margin: 0, fontSize: 13 }, children: start.message }), _jsx("p", { style: { margin: 0, fontSize: 13, opacity: 0.8 }, children: "Nothing you mark or flag here would be saved, so the checks stay hidden until the walk starts." }), _jsxs("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }, children: [_jsx("button", { onClick: () => setAttempt((a) => a + 1), "data-testid": "walk-start-retry", style: { padding: '6px 14px', borderRadius: v('radius', '8px'), border: 'none', background: v('accent', '#9B251B'), color: v('accent-fg', '#fff'), cursor: 'pointer', fontSize: 13 }, children: "Try again" }), onExit ? (_jsx("button", { onClick: onExit, style: toolBtn(), children: "Back to walks" })) : null] })] })] }));
    }
    return (_jsxs("div", { style: wrap, children: [header, error ? (_jsx("p", { role: "alert", style: { margin: 0, color: v('error', '#a8322b'), fontSize: 13 }, children: error })) : null, surfaces.map((s) => {
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
                            const has = isFlagged(state, c.n);
                            const note = state.defects[c.n] ?? '';
                            const noted = has && note.trim().length > 0;
                            return (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', borderTop: `1px solid ${v('border', '#eee')}`, background: has ? (noted ? v('bad-bg', '#f6e5e1') : 'transparent') : 'transparent' }, children: [_jsxs("span", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.6 }, children: [c.n, "."] }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("span", { style: { fontSize: 13, color: noted ? v('error', '#a8322b') : v('fg', '#1a1a1a') }, children: [c.text, c.severity === 'blocker' ? (_jsx("span", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: v('error', '#a8322b'), border: `1px solid ${v('error', '#a8322b')}`, borderRadius: 4, padding: '0 4px', marginLeft: 6 }, children: "must-fix" })) : null] }), hasHelp(c.help) ? _jsx(CheckHelp, { n: c.n, help: c.help }) : null, has ? (_jsxs(_Fragment, { children: [_jsx("input", { value: note, onChange: (e) => setNote(c.n, e.target.value), onBlur: (e) => syncNote(c.n, e.target.value), placeholder: "What is wrong? This becomes the defect record.", "aria-label": `Defect note for check ${c.n}`, style: { display: 'block', width: '100%', marginTop: 6, padding: 6, fontSize: 13, borderRadius: v('radius', '7px'), border: `1px solid ${v('border', '#d0d0d0')}`, background: v('field-bg', '#fff'), color: v('fg', '#1a1a1a') } }), !noted ? (_jsx("p", { style: { margin: '4px 0 0', fontSize: 11, fontStyle: 'italic', opacity: 0.6 }, children: "Note required. Until you write what is wrong, this is not counted as a defect." })) : null] })) : null] }), _jsx("button", { onClick: () => toggleFlag(s.key, c.n), style: { fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: v('radius', '6px'), border: `1px solid ${has ? v('error', '#a8322b') : v('border', '#d0d0d0')}`, background: 'transparent', color: has ? v('error', '#a8322b') : v('fg', '#1a1a1a'), cursor: 'pointer', flex: 'none' }, children: has ? 'Clear' : 'Flag' })] }, c.n));
                        })] }, s.key));
            }), _jsxs("div", { style: { borderTop: `1px solid ${v('border', '#e4ddcd')}`, paddingTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, children: [_jsx("span", { style: { flex: 1, fontSize: 13, fontWeight: 600, color: verdictColor }, children: verdict.line }), _jsx("button", { onClick: submit, disabled: submitting, style: { padding: '8px 16px', borderRadius: v('radius', '8px'), border: 'none', background: v('accent', '#9B251B'), color: v('accent-fg', '#fff'), cursor: submitting ? 'default' : 'pointer' }, children: submitting ? 'Submitting...' : 'Submit walk' })] })] }));
}
