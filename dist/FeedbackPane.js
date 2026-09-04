import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// The shared, design-system-agnostic Beacon feedback form. Self-contained (no design-system dependency):
// every colour/spacing token is a CSS variable the host sets (with a neutral fallback), so a product themes
// it in its own palette without forking the component. Renders the kind toggle (Issue/Idea), title,
// details, the consent gate + an inspect of exactly what auto-context would ride, and submits through the
// injected FeedbackAdapter. Submit-only + anonymous: no reports list.
//
// "Issue" is the reporter-facing label for a bug (owner rename); the wire kind stays 'bug'.
import { useState } from 'react';
const v = (name, fallback) => `var(--beacon-${name}, ${fallback})`;
const KINDS = [
    { value: 'bug', label: 'Issue' },
    { value: 'idea', label: 'Idea' },
];
export function FeedbackPane({ adapter, gatherContext, resolveIdentity, onDone }) {
    const [kind, setKind] = useState('bug');
    const [title, setTitle] = useState('');
    const [details, setDetails] = useState('');
    // Reporter contact (R6). Prefilled once from the host-known identity when available; the reporter can
    // edit or clear it. `prefill` is captured on mount so the "from your account" hint shows only while the
    // field still holds the untouched prefill.
    const [prefill] = useState(() => resolveIdentity?.() ?? '');
    const [contact, setContact] = useState(prefill);
    // Default ON, still declinable (owner ruling 2026-08-29): diagnostics are pre-attached so a triager can
    // reproduce a report, and the reporter can untick to file a content-only report. Disclosed +
    // inspectable ("What's included?"); the D3 allow-list is unchanged (no id, no study data, ever).
    const [consent, setConsent] = useState(true);
    const [showIncluded, setShowIncluded] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);
    const canSend = title.trim().length >= 3 && !busy;
    async function send() {
        setBusy(true);
        setError(null);
        try {
            const result = await adapter.submit({ kind, title: title.trim(), details: details.trim(), consent, contact: contact.trim() });
            setDone({ reference: result.reference });
            onDone?.(result);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not send that. Please try again.');
        }
        finally {
            setBusy(false);
        }
    }
    if (done) {
        return (_jsxs("div", { style: { color: v('fg', '#1a1a1a'), padding: v('pad', '16px'), fontFamily: v('font', 'inherit') }, children: [_jsxs("p", { style: { margin: 0 }, children: ["Thanks - your ", kind === 'bug' ? 'issue' : 'idea', " was sent."] }), done.reference ? _jsxs("p", { style: { margin: '8px 0 0', opacity: 0.7 }, children: ["Reference: ", done.reference] }) : null] }));
    }
    const included = showIncluded && gatherContext ? gatherContext() : null;
    return (_jsxs("div", { style: { color: v('fg', '#1a1a1a'), padding: v('pad', '16px'), fontFamily: v('font', 'inherit'), display: 'grid', gap: 12 }, children: [_jsx("div", { role: "tablist", "aria-label": "Feedback kind", style: { display: 'flex', gap: 8 }, children: KINDS.map((k) => (_jsx("button", { role: "tab", "aria-selected": kind === k.value, onClick: () => setKind(k.value), style: {
                        padding: '6px 12px',
                        borderRadius: v('radius', '8px'),
                        border: `1px solid ${v('border', '#d0d0d0')}`,
                        background: kind === k.value ? v('accent', '#9B251B') : 'transparent',
                        color: kind === k.value ? v('accent-fg', '#fff') : v('fg', '#1a1a1a'),
                        cursor: 'pointer',
                    }, children: k.label }, k.value))) }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 13, opacity: 0.8 }, children: "Title" }), _jsx("input", { value: title, onChange: (e) => setTitle(e.target.value), placeholder: kind === 'bug' ? 'What went wrong?' : "What's your idea?", maxLength: 200, style: { padding: 8, borderRadius: v('radius', '8px'), border: `1px solid ${v('border', '#d0d0d0')}`, background: v('field-bg', '#fff'), color: v('fg', '#1a1a1a') } })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 13, opacity: 0.8 }, children: "Details" }), _jsx("textarea", { value: details, onChange: (e) => setDetails(e.target.value), rows: 4, maxLength: 5000, style: { padding: 8, borderRadius: v('radius', '8px'), border: `1px solid ${v('border', '#d0d0d0')}`, background: v('field-bg', '#fff'), color: v('fg', '#1a1a1a'), resize: 'vertical' } })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 13, opacity: 0.8 }, children: "How can we reach you? (optional)" }), _jsx("input", { type: "email", value: contact, onChange: (e) => setContact(e.target.value), placeholder: "you@example.com", maxLength: 200, autoComplete: "email", style: { padding: 8, borderRadius: v('radius', '8px'), border: `1px solid ${v('border', '#d0d0d0')}`, background: v('field-bg', '#fff'), color: v('fg', '#1a1a1a') } }), prefill.length > 0 && contact === prefill ? (_jsx("span", { style: { fontSize: 11, opacity: 0.6 }, children: "Filled from your account. Edit or clear it if you like." })) : null] }), _jsxs("div", { style: { display: 'grid', gap: 4 }, children: [_jsxs("label", { style: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }, children: [_jsx("input", { type: "checkbox", checked: consent, onChange: (e) => setConsent(e.target.checked) }), _jsx("span", { children: "Include basic diagnostics (app version, screen, device type, OS, language) to help us investigate." })] }), gatherContext ? (_jsx("button", { type: "button", onClick: () => setShowIncluded((s) => !s), style: { justifySelf: 'start', background: 'none', border: 'none', color: v('accent', '#9B251B'), cursor: 'pointer', padding: 0, fontSize: 12 }, children: showIncluded ? 'Hide' : "What's included?" })) : null, included ? (_jsx("pre", { style: { margin: 0, fontSize: 11, opacity: 0.75, whiteSpace: 'pre-wrap', background: v('inspect-bg', '#f4f4f4'), padding: 8, borderRadius: v('radius', '8px') }, children: JSON.stringify(included, null, 2) })) : null] }), error ? _jsx("p", { style: { margin: 0, color: v('error', '#9B251B'), fontSize: 13 }, children: error }) : null, _jsx("button", { onClick: send, disabled: !canSend, style: {
                    padding: '8px 16px',
                    borderRadius: v('radius', '8px'),
                    border: 'none',
                    background: canSend ? v('accent', '#9B251B') : v('border', '#d0d0d0'),
                    color: v('accent-fg', '#fff'),
                    cursor: canSend ? 'pointer' : 'not-allowed',
                    justifySelf: 'start',
                }, children: busy ? 'Sending...' : 'Send' })] }));
}
