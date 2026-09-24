import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// The shared, design-system-agnostic Beacon FIRST-RUN pane: a welcome card plus a "get started" checklist
// the product declares. Themed entirely by --beacon-* CSS variables (neutral fallbacks), like FeedbackPane
// and WalkPane. The user always has two ways out: "Skip for now" (the pane may come back later while the
// checklist is unfinished) and a "Don't show me this again" toggle (nothing opens by itself again).
// Whether to show the pane automatically is the host's call via shouldAutoOpenOnboarding; the pane itself
// renders whenever it is mounted, so a user can always reopen it by hand.
import { useEffect, useId, useState } from 'react';
import { isChecklistDone } from './onboardingStore.js';
const v = (name, fallback) => `var(--beacon-${name}, ${fallback})`;
const buttonBase = {
    font: 'inherit',
    fontSize: 13,
    padding: '7px 12px',
    borderRadius: v('radius', '8px'),
    cursor: 'pointer',
};
const primaryButton = {
    ...buttonBase,
    background: v('accent', '#2563eb'),
    color: v('accent-fg', '#fff'),
    border: '1px solid transparent',
};
const quietButton = {
    ...buttonBase,
    background: 'transparent',
    color: v('fg', 'inherit'),
    border: `1px solid ${v('border', 'rgba(127,127,127,.35)')}`,
};
export function OnboardingPane({ adapter, steps, title = 'Welcome', intro, onClose, onStartTour, manualComplete = false, }) {
    const [state, setState] = useState(null);
    const [error, setError] = useState(null);
    const toggleId = useId();
    useEffect(() => {
        let live = true;
        adapter
            .load()
            .then((s) => live && setState(s))
            .catch(() => live && setError('Could not load your progress.'));
        return () => {
            live = false;
        };
    }, [adapter]);
    async function run(fn) {
        setError(null);
        try {
            setState(await fn());
        }
        catch {
            setError('That did not save. Try again.');
        }
    }
    async function skip() {
        try {
            await adapter.skip();
        }
        catch {
            // Skipping must never trap the user in the pane; close even if the record did not save.
        }
        onClose();
    }
    const done = state ? steps.filter((s) => state.completed.includes(s.id)).length : 0;
    const allDone = state ? isChecklistDone(state, steps) : false;
    return (_jsxs("div", { style: { display: 'grid', gap: 14, color: v('fg', 'inherit'), fontFamily: v('font', 'inherit') }, children: [_jsxs("header", { style: { display: 'grid', gap: 6 }, children: [_jsx("h2", { style: { margin: 0, fontSize: 18, fontWeight: 600 }, children: title }), intro ? _jsx("p", { style: { margin: 0, fontSize: 14, opacity: 0.85 }, children: intro }) : null] }), steps.length ? (_jsxs("section", { "aria-label": "Get started", style: { display: 'grid', gap: 8 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.7 }, children: [_jsx("span", { children: "Get started" }), _jsxs("span", { "aria-live": "polite", children: [done, " of ", steps.length, " done"] })] }), _jsx("div", { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": steps.length, "aria-valuenow": done, "aria-label": "Checklist progress", style: { height: 4, borderRadius: 2, background: v('border', 'rgba(127,127,127,.25)'), overflow: 'hidden' }, children: _jsx("div", { style: {
                                width: `${steps.length ? (done / steps.length) * 100 : 0}%`,
                                height: '100%',
                                background: v('accent', '#2563eb'),
                                transition: 'width .2s ease',
                            } }) }), _jsx("ul", { style: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }, children: steps.map((step) => {
                            const ticked = !!state?.completed.includes(step.id);
                            return (_jsxs("li", { "data-beacon-onboarding-step": step.id, style: {
                                    display: 'grid',
                                    gridTemplateColumns: 'auto 1fr auto',
                                    gap: 10,
                                    alignItems: 'start',
                                    padding: v('pad', '10px'),
                                    border: `1px solid ${v('border', 'rgba(127,127,127,.25)')}`,
                                    borderRadius: v('radius', '8px'),
                                    background: v('field-bg', 'transparent'),
                                }, children: [manualComplete ? (_jsx("input", { type: "checkbox", checked: ticked, disabled: ticked || !state, "aria-label": `Mark "${step.title}" done`, onChange: () => void run(() => adapter.completeStep(step.id)), style: { marginTop: 2 } })) : (_jsx("span", { "aria-hidden": "true", style: { width: 16, textAlign: 'center', color: v('accent', '#2563eb') }, children: ticked ? '✓' : '○' })), _jsxs("div", { style: { display: 'grid', gap: 2 }, children: [_jsxs("span", { style: { fontSize: 14, textDecoration: ticked ? 'line-through' : 'none', opacity: ticked ? 0.6 : 1 }, children: [step.title, !manualComplete ? _jsx("span", { style: visuallyHidden, children: ticked ? ' (done)' : ' (to do)' }) : null] }), step.description ? _jsx("span", { style: { fontSize: 12, opacity: 0.7 }, children: step.description }) : null] }), step.action && !ticked ? (_jsx("button", { type: "button", style: quietButton, onClick: step.action.onClick, children: step.action.label })) : (_jsx("span", {}))] }, step.id));
                        }) })] })) : null, error ? (_jsx("div", { role: "alert", style: { fontSize: 12, color: v('error', '#b91c1c') }, children: error })) : null, _jsxs("footer", { style: { display: 'grid', gap: 10 }, children: [_jsx("div", { style: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }, children: allDone ? (_jsx("button", { type: "button", style: primaryButton, onClick: onClose, children: "Done" })) : (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", style: quietButton, onClick: () => void skip(), children: "Skip for now" }), onStartTour ? (_jsx("button", { type: "button", style: primaryButton, onClick: onStartTour, children: "Show me around" })) : null] })) }), _jsxs("label", { htmlFor: toggleId, style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, opacity: 0.8, cursor: 'pointer' }, children: [_jsx("input", { id: toggleId, type: "checkbox", checked: !!state?.suppressed, disabled: !state, onChange: (e) => {
                                    const suppressed = e.currentTarget.checked;
                                    void run(() => adapter.setSuppressed(suppressed));
                                } }), "Don't show me this again"] })] })] }));
}
const visuallyHidden = {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
};
