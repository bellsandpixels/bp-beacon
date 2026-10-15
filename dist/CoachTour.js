import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// The shared Beacon COACH-MARK TOUR: a spotlight on one element at a time with a short card beside it.
// Hosts mark the elements with data-beacon-tour="<target>" and pass the steps; a step whose anchor is not
// on the page is passed over. Themed by --beacon-* variables like the other panes. Every step offers
// Back / Next, "Skip tour" (Esc does the same), and the same "Don't show me this again" toggle as the
// welcome pane. Finishing or skipping records the tour as done so it never auto-starts again; whether to
// start it automatically is the host's call via shouldAutoStartTour.
//
// Kept in its own module (and the "@bp/beacon/tour" subpath) so a product can lazy-load it: a product
// that never runs a tour ships none of it.
//
// Two defects fixed here (toudai tdi-q4-studio-tour-overlay-scoped, seen live on the B&P Studio):
//   1. A step's anchor was only ever checked at mount (the `live` filter below). If the surface or editor it
//      points at closed later (a Delete from the editor lands on the Recycle bin), the tour kept showing its
//      spotlight and scrim over whatever replaced it. Fixed by watching the current step's anchor for the
//      rest of the tour, not just once at the start, and withdrawing (closing unrecorded, like the existing
//      no-anchors-at-all case) the moment it is gone.
//   2. The document-wide focus trap assumed the tour was the only modal on the page: any focus landing
//      outside the card was yanked straight back onto it. A dialog the host opens on top of the tour (the
//      Studio "New" dialog, which auto-focuses its title field on open) got its focus stolen back instantly,
//      so typing never reached it until "Skip for now" closed the tour. Fixed by recognizing any OTHER open
//      aria-modal dialog and standing down for it entirely (no re-trap, no click-shield) while it is open.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { placeTourCard } from './tourPlacement.js';
import { TOUR_FOCUSABLE, hasOtherOpenDialog, isDialogShown, shouldRetrapFocus, trapFocusTarget } from './tourFocus.js';
import { tourAnchorSelector } from './tourAnchor.js';
const v = (name, fallback) => `var(--beacon-${name}, ${fallback})`;
const SPOT_PAD = 6;
const OTHER_DIALOG_SELECTOR = '[aria-modal="true"]';
function findAnchor(root, target) {
    return root.querySelector(tourAnchorSelector(target));
}
function prefersReducedMotion() {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    catch {
        return false;
    }
}
export function CoachTour({ adapter, tourId, steps, onClose, root }) {
    const scope = root ?? (typeof document !== 'undefined' ? document : undefined);
    // The steps whose anchors are on the page when the tour starts.
    const [live] = useState(() => (scope ? steps.filter((s) => findAnchor(scope, s.target)) : []));
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState(null);
    const [place, setPlace] = useState(null);
    const [state, setState] = useState(null);
    // Whether a dialog the HOST opened (the "New" dialog, a delete confirm) is currently up on top of the
    // tour. While one is, the tour stands down entirely: see the render guard near the bottom.
    const [otherDialogOpen, setOtherDialogOpen] = useState(false);
    const cardRef = useRef(null);
    const ending = useRef(false);
    const titleId = useId();
    const toggleId = useId();
    const step = live[index];
    useEffect(() => {
        let on = true;
        adapter
            .load()
            .then((s) => on && setState(s))
            .catch(() => undefined);
        return () => {
            on = false;
        };
    }, [adapter]);
    const end = useCallback(async (outcome) => {
        if (ending.current)
            return;
        ending.current = true;
        try {
            await adapter.finishTour(tourId, outcome);
        }
        catch {
            // Never trap the user in the tour because the record did not save.
        }
        onClose(outcome);
    }, [adapter, tourId, onClose]);
    // Close without recording an outcome, so the tour is free to run again on a later visit: used when there
    // is nothing left on the page to show it against, never when the user chose to skip it.
    const withdraw = useCallback(() => {
        if (ending.current)
            return;
        ending.current = true;
        onClose('skipped');
    }, [onClose]);
    // No anchors on the page at all: nothing to show. Withdraw unrecorded.
    useEffect(() => {
        if (!live.length)
            withdraw();
    }, [live.length, withdraw]);
    // The current step's anchor can disappear mid-tour: the surface or editor it points at just closed (a
    // Delete from the editor lands on the Recycle bin, say). Watch for that for as long as this step is
    // showing and withdraw the moment it happens, rather than keep the spotlight and scrim floating over
    // whatever surface replaced it. A MutationObserver on the document body, checked at most once a frame,
    // mirrors the pattern useBeaconOnboarding's auto-start watch uses for the opposite direction (an anchor
    // APPEARING); this one watches for one DISAPPEARING.
    useEffect(() => {
        if (!step || !scope || typeof document === 'undefined' || typeof MutationObserver === 'undefined')
            return;
        const stillThere = () => Boolean(findAnchor(scope, step.target));
        if (!stillThere()) {
            withdraw();
            return;
        }
        let frame = 0;
        const observer = new MutationObserver(() => {
            if (frame)
                return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                if (!stillThere())
                    withdraw();
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
            observer.disconnect();
            if (frame)
                cancelAnimationFrame(frame);
        };
    }, [step, scope, withdraw]);
    // Whether some other aria-modal dialog is open right now, checked the same rAF-throttled way. Recomputed
    // on every mutation so the tour stands back down the instant such a dialog opens and comes right back the
    // instant it closes, at the step and position it left off at.
    useEffect(() => {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined')
            return;
        const check = () => {
            const dialogs = Array.from(document.querySelectorAll(OTHER_DIALOG_SELECTOR));
            setOtherDialogOpen(hasOtherOpenDialog(cardRef.current, dialogs));
        };
        check();
        let frame = 0;
        const observer = new MutationObserver(() => {
            if (frame)
                return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                check();
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
            observer.disconnect();
            if (frame)
                cancelAnimationFrame(frame);
        };
    }, []);
    // Measure the anchor and place the card; re-measure on scroll and resize.
    const measure = useCallback(() => {
        if (!step || !scope)
            return;
        const el = findAnchor(scope, step.target);
        const r = el?.getBoundingClientRect();
        const nextRect = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
        setRect(nextRect);
        const card = cardRef.current;
        const size = card ? { width: card.offsetWidth, height: card.offsetHeight } : { width: 300, height: 160 };
        setPlace(placeTourCard(nextRect, size, { width: window.innerWidth, height: window.innerHeight }));
    }, [step, scope]);
    useLayoutEffect(() => {
        if (!step || !scope)
            return;
        findAnchor(scope, step.target)?.scrollIntoView?.({
            block: 'center',
            inline: 'nearest',
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
        measure();
    }, [step, scope, measure]);
    // Focus the card once it is placed (a visibility:hidden card cannot take focus), so Esc and the arrow
    // keys work from the first step without a click. Not while another dialog is open: that dialog owns focus.
    const placed = place !== null;
    useEffect(() => {
        if (placed && !otherDialogOpen)
            cardRef.current?.focus({ preventScroll: true });
    }, [step, placed, otherDialogOpen]);
    // Keep focus inside the card while the tour runs: if anything moves it onto the page underneath (a
    // script, an assistive-tech jump), bring it back, so the modal promise of aria-modal holds. But not when
    // focus moved into a dialog the host opened on top of the tour instead: that dialog is its own modal and
    // owns focus while it is up (see tourFocus.ts, shouldRetrapFocus).
    useEffect(() => {
        if (!step)
            return;
        const onFocusIn = (e) => {
            const card = cardRef.current;
            if (!card || !(e.target instanceof Node))
                return;
            const targetInCard = card.contains(e.target);
            const targetEl = e.target instanceof Element ? e.target : e.target.parentElement;
            const hostDialog = targetEl?.closest(OTHER_DIALOG_SELECTOR);
            const targetInOtherDialog = Boolean(hostDialog && !targetInCard && isDialogShown(hostDialog));
            if (shouldRetrapFocus(targetInCard, targetInOtherDialog))
                card.focus({ preventScroll: true });
        };
        document.addEventListener('focusin', onFocusIn);
        return () => document.removeEventListener('focusin', onFocusIn);
    }, [step]);
    useEffect(() => {
        if (!step)
            return;
        const onMove = () => measure();
        window.addEventListener('resize', onMove);
        window.addEventListener('scroll', onMove, true);
        return () => {
            window.removeEventListener('resize', onMove);
            window.removeEventListener('scroll', onMove, true);
        };
    }, [step, measure]);
    const last = index >= live.length - 1;
    const next = () => (last ? void end('completed') : setIndex((i) => i + 1));
    const back = () => setIndex((i) => Math.max(0, i - 1));
    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            void end('skipped');
        }
        else if (e.key === 'ArrowRight') {
            next();
        }
        else if (e.key === 'ArrowLeft') {
            back();
        }
        else if (e.key === 'Tab') {
            // Wrap Tab and Shift+Tab around the card's own controls instead of leaving the dialog.
            const card = cardRef.current;
            if (!card)
                return;
            const controls = Array.from(card.querySelectorAll(TOUR_FOCUSABLE));
            const current = controls.indexOf(document.activeElement);
            const target = trapFocusTarget(current, controls.length, e.shiftKey);
            if (controls.length === 0) {
                e.preventDefault();
            }
            else if (target !== null) {
                e.preventDefault();
                controls[target]?.focus();
            }
        }
    }
    // Stand down entirely while a dialog the host opened is on top: no card to swallow Tab or Esc, no
    // click-shield to swallow a click meant for the dialog below it. The tour reappears, at the same step, the
    // moment that dialog closes (the effects above keep running; only the render output pauses).
    if (!step || otherDialogOpen)
        return null;
    const quiet = {
        font: 'inherit',
        fontSize: 13,
        padding: '6px 10px',
        borderRadius: v('radius', '8px'),
        background: 'transparent',
        color: 'inherit',
        border: `1px solid ${v('border', 'rgba(127,127,127,.35)')}`,
        cursor: 'pointer',
    };
    return (_jsxs("div", { style: { position: 'fixed', inset: 0, zIndex: v('tour-z', '2147483000') }, children: [_jsx("div", { "aria-hidden": "true", style: { position: 'absolute', inset: 0 } }), rect ? (_jsx("div", { "aria-hidden": "true", "data-beacon-tour-spotlight": "", style: {
                    position: 'absolute',
                    top: rect.top - SPOT_PAD,
                    left: rect.left - SPOT_PAD,
                    width: rect.width + SPOT_PAD * 2,
                    height: rect.height + SPOT_PAD * 2,
                    borderRadius: v('radius', '8px'),
                    boxShadow: `0 0 0 9999px ${v('tour-scrim', 'rgba(0,0,0,.55)')}`,
                    outline: `2px solid ${v('accent', '#2563eb')}`,
                    pointerEvents: 'none',
                    transition: prefersReducedMotion() ? 'none' : 'all .2s ease',
                } })) : (_jsx("div", { "aria-hidden": "true", style: { position: 'absolute', inset: 0, background: v('tour-scrim', 'rgba(0,0,0,.55)') } })), _jsxs("div", { ref: cardRef, role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, tabIndex: -1, onKeyDown: onKeyDown, style: {
                    position: 'absolute',
                    top: place?.top ?? 0,
                    left: place?.left ?? 0,
                    visibility: place ? 'visible' : 'hidden',
                    width: 'min(320px, calc(100vw - 32px))',
                    boxSizing: 'border-box',
                    display: 'grid',
                    gap: 10,
                    padding: 14,
                    borderRadius: v('radius', '8px'),
                    background: v('tour-bg', v('bg', '#fff')),
                    color: v('fg', '#111'),
                    fontFamily: v('font', 'system-ui, sans-serif'),
                    border: `1px solid ${v('border', 'rgba(127,127,127,.35)')}`,
                    boxShadow: '0 8px 30px rgba(0,0,0,.25)',
                    outline: 'none',
                }, children: [_jsxs("div", { style: { fontSize: 11, opacity: 0.65 }, children: [index + 1, " of ", live.length] }), _jsx("div", { id: titleId, style: { fontSize: 15, fontWeight: 600 }, children: step.title }), step.body ? _jsx("div", { style: { fontSize: 13, opacity: 0.85 }, children: step.body }) : null, _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("button", { type: "button", style: { ...quiet, border: 'none', paddingLeft: 0, opacity: 0.8 }, onClick: () => void end('skipped'), children: "Skip tour" }), _jsx("span", { style: { flex: 1 } }), index > 0 ? (_jsx("button", { type: "button", style: quiet, onClick: back, children: "Back" })) : null, _jsx("button", { type: "button", onClick: next, style: { ...quiet, background: v('accent', '#2563eb'), color: v('accent-fg', '#fff'), border: '1px solid transparent' }, children: last ? 'Finish' : 'Next' })] }), _jsxs("label", { htmlFor: toggleId, style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, opacity: 0.8, cursor: 'pointer' }, children: [_jsx("input", { id: toggleId, type: "checkbox", checked: !!state?.suppressed, disabled: !state, onChange: (e) => {
                                    const suppressed = e.currentTarget.checked;
                                    adapter
                                        .setSuppressed(suppressed)
                                        .then(setState)
                                        .catch(() => undefined);
                                } }), "Don't show me this again"] })] })] }));
}
