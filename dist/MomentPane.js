import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// The shared, design-system-agnostic first-time MOMENT explainer: a small modal the Beacon opens the first time
// the user does something that needs explaining (see moments.ts). Themed entirely by --beacon-* CSS variables
// with neutral fallbacks, like OnboardingPane. Accessible: role="dialog" + aria-modal, labelled by its title,
// focus lands on the close button, and Escape or the backdrop closes it. A repeating moment carries a
// "Don't show this again" checkbox; a once-only moment needs none (closing it is final).
import { useEffect, useId, useRef, useState } from 'react';
import { momentParagraphs } from './moments.js';
const v = (name, fallback) => `var(--beacon-${name}, ${fallback})`;
export function MomentPane({ moment, onClose }) {
    const [dontShow, setDontShow] = useState(false);
    const okRef = useRef(null);
    const titleId = useId();
    // The latest checkbox value for the Escape handler, without re-binding it on every toggle.
    const dontShowRef = useRef(dontShow);
    dontShowRef.current = dontShow;
    useEffect(() => {
        okRef.current?.focus();
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose(dontShowRef.current);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (_jsx("div", { "data-beacon-moment": moment.id, onMouseDown: (e) => {
            if (e.target === e.currentTarget)
                onClose(dontShow);
        }, style: {
            position: 'fixed',
            inset: 0,
            zIndex: v('moment-z', '60'),
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            overflowY: 'auto',
            padding: '10vh 16px',
            background: v('moment-scrim', 'rgba(15,17,21,.4)'),
            backdropFilter: 'blur(4px)',
        }, children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, style: {
                width: '100%',
                maxWidth: 448,
                boxSizing: 'border-box',
                display: 'grid',
                gap: 12,
                padding: 24,
                color: v('fg', '#111'),
                fontFamily: v('font', 'inherit'),
                background: v('bg', v('field-bg', '#fff')),
                border: `1px solid ${v('border', 'rgba(127,127,127,.35)')}`,
                borderRadius: v('radius', '8px'),
                boxShadow: '0 12px 32px rgba(0,0,0,.18)',
            }, children: [moment.label ? (_jsx("p", { style: { margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: v('accent', '#2563eb') }, children: moment.label })) : null, _jsx("h2", { id: titleId, style: { margin: 0, fontSize: 20, fontWeight: 600 }, children: moment.title }), momentParagraphs(moment.body).map((p) => (_jsx("p", { style: { margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.85 }, children: p }, p))), _jsxs("div", { style: { marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: moment.repeat ? 'space-between' : 'flex-end', gap: 12, flexWrap: 'wrap' }, children: [moment.repeat ? (_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, opacity: 0.85 }, children: [_jsx("input", { type: "checkbox", checked: dontShow, onChange: (e) => setDontShow(e.target.checked) }), "Don't show this again"] })) : null, _jsx("button", { ref: okRef, type: "button", onClick: () => onClose(dontShow), style: {
                                font: 'inherit',
                                fontSize: 14,
                                fontWeight: 600,
                                padding: '8px 16px',
                                borderRadius: v('radius', '8px'),
                                cursor: 'pointer',
                                background: v('accent', '#2563eb'),
                                color: v('accent-fg', '#fff'),
                                border: '1px solid transparent',
                            }, children: moment.ok ?? 'Got it' })] })] }) }));
}
