import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// The shared, design-system-agnostic Beacon VALIDATION-HUB pane, the walk analog of FeedbackPane. Themed
// entirely by --beacon-* CSS variables the host sets (neutral fallbacks), so a product themes it in its
// own palette without forking. This is the hub the tester reaches in one gesture: click Beacon, click
// Validation, authenticate once (adapter-owned), and the three zones are here: To do (walk this build),
// Completed (past walks + coverage), and My issues (raised issues + their disposition, incl. "Fixed in
// build X"). The assume-pass tap-to-tick walk SURFACE is a separate component (Phase B); starting a walk
// is delegated to onStartWalk so the host renders the surface. Scaffold: the hub + auth gate; the surface
// and live wiring land in Phase B. See the approved Beacon walk mocks.
import { useCallback, useEffect, useState } from 'react';
const v = (name, fallback) => `var(--beacon-${name}, ${fallback})`;
// Reporter-facing disposition labels. A resolved issue is a DISTINCT "Fixed in build X" state (never a
// bare Closed): that is rendered from WalkIssue.resolvedBuild, ahead of this map.
const STATUS_LABEL = {
    submitted: 'Submitted',
    triaging: 'Triaging',
    accepted: 'Accepted',
    routed: 'Routed',
    declined: 'Declined',
    duplicate: 'Duplicate',
    parked: 'Parked',
    closed: 'Closed',
};
function Zone({ label, children }) {
    return (_jsxs("section", { style: { display: 'grid', gap: 8 }, children: [_jsx("div", { style: {
                    fontFamily: v('mono', 'ui-monospace, monospace'),
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    opacity: 0.65,
                }, children: label }), children] }));
}
export function WalkPane({ adapter, onStartWalk }) {
    const [identity, setIdentity] = useState(null);
    const [availability, setAvailability] = useState(null);
    const [inProgress, setInProgress] = useState(null);
    const [completed, setCompleted] = useState([]);
    const [issues, setIssues] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const loadHub = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const [avail, current, mine, myIssues] = await Promise.all([
                adapter.available(),
                // Additive-only: the in-progress read just decides Start vs Resume, so its failure must degrade to
                // "Start walk", never blank the hub. Isolate it (unlike the other three, which gate the hub) so a
                // 404 - e.g. the current-walk endpoint not yet deployed (the API deploys by hand) - yields null.
                adapter.current().catch(() => null),
                adapter.listMine(),
                adapter.listMyIssues(),
            ]);
            setAvailability(avail);
            setInProgress(current);
            setCompleted(mine);
            setIssues(myIssues);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load your walks.');
        }
        finally {
            setBusy(false);
        }
    }, [adapter]);
    useEffect(() => {
        let live = true;
        adapter
            .identity()
            .then((id) => {
            if (!live)
                return;
            setIdentity(id);
            if (id.authenticated)
                void loadHub();
        })
            .catch(() => live && setIdentity({ authenticated: false }));
        return () => {
            live = false;
        };
    }, [adapter, loadHub]);
    async function signIn() {
        setBusy(true);
        setError(null);
        try {
            const id = await adapter.authenticate();
            setIdentity(id);
            if (id.authenticated)
                await loadHub();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Could not sign you in.');
        }
        finally {
            setBusy(false);
        }
    }
    const base = {
        color: v('fg', '#1a1a1a'),
        padding: v('pad', '16px'),
        fontFamily: v('font', 'inherit'),
        display: 'grid',
        gap: 16,
    };
    // Unauthenticated: the sign-in gate (one click, adapter-owned).
    if (identity && !identity.authenticated) {
        return (_jsxs("div", { style: base, children: [_jsxs("div", { style: { display: 'grid', gap: 4 }, children: [_jsx("strong", { style: { fontFamily: v('serif', 'inherit') }, children: "Sign in to your tester walk" }), _jsx("span", { style: { fontSize: 13, opacity: 0.7 }, children: "One click and your walks, coverage, and issue status are here." })] }), error ? _jsx("p", { style: { margin: 0, color: v('error', '#9B251B'), fontSize: 13 }, children: error }) : null, _jsx("button", { onClick: signIn, disabled: busy, style: {
                        padding: '8px 16px',
                        borderRadius: v('radius', '8px'),
                        border: 'none',
                        background: v('accent', '#9B251B'),
                        color: v('accent-fg', '#fff'),
                        cursor: busy ? 'default' : 'pointer',
                        justifySelf: 'start',
                    }, children: busy ? 'Signing in...' : 'Send magic link' })] }));
    }
    // Loading identity or hub.
    if (!identity || (busy && !completed.length && !issues.length && !availability)) {
        return _jsx("div", { style: base, children: _jsx("span", { style: { opacity: 0.6, fontSize: 13 }, children: "Loading your walk..." }) });
    }
    return (_jsxs("div", { style: base, children: [error ? _jsx("p", { style: { margin: 0, color: v('error', '#9B251B'), fontSize: 13 }, children: error }) : null, _jsx(Zone, { label: "To do", children: availability?.offered ? (_jsxs("div", { style: {
                        border: `1px solid ${v('border', '#d0d0d0')}`,
                        borderLeft: `3px solid ${v('accent', '#9B251B')}`,
                        borderRadius: v('radius', '10px'),
                        padding: 12,
                        display: 'grid',
                        gap: 8,
                    }, children: [_jsx("strong", { style: { fontFamily: v('serif', 'inherit') }, children: inProgress ? 'Resume your walk' : 'Walk this build' }), _jsxs("span", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 12, opacity: 0.8 }, children: [(inProgress?.build || availability.build), " (", inProgress?.env || availability.env, ")"] }), inProgress ? (_jsxs("span", { style: { fontSize: 12, opacity: 0.75 }, children: ["In progress:", ' ', inProgress.coverage.total > 0
                                    ? `${inProgress.coverage.walked} / ${inProgress.coverage.total} walked`
                                    : `${inProgress.coverage.walked} walked`, inProgress.flagged ? ` · ${inProgress.flagged} flagged` : '', " \u00B7 picks up where you left off"] })) : null, _jsx("button", { onClick: () => (onStartWalk && availability ? onStartWalk(availability) : undefined), disabled: !onStartWalk, style: {
                                padding: '6px 12px',
                                borderRadius: v('radius', '8px'),
                                border: 'none',
                                background: onStartWalk ? v('accent', '#9B251B') : v('border', '#d0d0d0'),
                                color: v('accent-fg', '#fff'),
                                cursor: onStartWalk ? 'pointer' : 'not-allowed',
                                justifySelf: 'start',
                            }, children: inProgress ? 'Resume walk' : 'Start walk' })] })) : (_jsx("span", { style: { fontSize: 13, opacity: 0.6 }, children: "No walk is offered for this build." })) }), _jsx(Zone, { label: "Completed", children: completed.length ? (completed.map((w) => (_jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${v('border', '#eee')}`, paddingTop: 8 }, children: _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 13 }, children: w.build }), _jsxs("div", { style: { fontSize: 11, opacity: 0.6 }, children: [w.coverage.walked, " / ", w.coverage.total, " walked", w.flagged ? ` · ${w.flagged} flagged` : ''] })] }) }, w.walkId)))) : (_jsx("span", { style: { fontSize: 13, opacity: 0.6 }, children: "No completed walks yet." })) }), _jsx(Zone, { label: "My issues", children: issues.length ? (issues.map((it) => (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${v('border', '#eee')}`, paddingTop: 8 }, children: [_jsxs("span", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.6 }, children: ["#", it.checkRef] }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 13 }, children: it.title }), _jsxs("div", { style: { fontSize: 11, opacity: 0.6 }, children: ["raised on ", it.build] })] }), _jsx("span", { style: {
                                fontFamily: v('mono', 'ui-monospace, monospace'),
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: it.resolvedBuild ? v('ok-bg', '#e7efe4') : v('chip-bg', '#f0f0f0'),
                                color: it.resolvedBuild ? v('ok', '#2f6d3a') : v('fg', '#1a1a1a'),
                                whiteSpace: 'nowrap',
                            }, children: it.resolvedBuild ? `Fixed ${it.resolvedBuild}` : STATUS_LABEL[it.status] })] }, it.id)))) : (_jsx("span", { style: { fontSize: 13, opacity: 0.6 }, children: "Nothing raised yet." })) })] }));
}
