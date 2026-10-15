import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// The shared, design-system-agnostic Beacon VALIDATION-HUB pane, the walk analog of FeedbackPane. Themed
// entirely by --beacon-* CSS variables the host sets (neutral fallbacks), so a product themes it in its
// own palette without forking. This is the hub the tester reaches in one gesture: click Beacon, click
// Validation, authenticate once (adapter-owned), and the three zones are here: To do (walk this build),
// Completed (past walks + coverage), and My issues (raised issues + their disposition, incl. "Fixed in
// build X"). The assume-pass tap-to-tick walk SURFACE is a separate component (Phase B); starting a walk
// is delegated to onStartWalk so the host renders the surface. Scaffold: the hub + auth gate; the surface
// and live wiring land in Phase B. See the approved Beacon walk mocks.
import { useCallback, useEffect, useState } from 'react';
import { groupAssignments } from './walkList.js';
const v = (name, fallback) => `var(--beacon-${name}, ${fallback})`;
// How many walks a build group shows before "Show N more".
const GROUP_PAGE = 6;
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
export function WalkPane({ adapter, onStartWalk, onStartAssignment, notice, onDismissNotice }) {
    const [tab, setTab] = useState('todo');
    const [open, setOpen] = useState({});
    const [showAll, setShowAll] = useState({});
    const [identity, setIdentity] = useState(null);
    const [availability, setAvailability] = useState(null);
    const [inProgress, setInProgress] = useState(null);
    const [completed, setCompleted] = useState([]);
    const [issues, setIssues] = useState([]);
    const [assigned, setAssigned] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const loadHub = useCallback(async () => {
        setBusy(true);
        setError(null);
        try {
            const [avail, current, mine, myIssues, assignedList] = await Promise.all([
                adapter.available(),
                // Additive-only: the in-progress read just decides Start vs Resume, so its failure must degrade to
                // "Start walk", never blank the hub. Isolate it (unlike the other three, which gate the hub) so a
                // 404 - e.g. the current-walk endpoint not yet deployed (the API deploys by hand) - yields null.
                adapter.current().catch(() => null),
                adapter.listMine(),
                adapter.listMyIssues(),
                // Slice 4c: the assigned-walks list is OPTIONAL + isolated (like current()), so an adapter without
                // listAssigned, or a 404 on /available, degrades to no assigned list rather than blanking the hub.
                adapter.listAssigned ? adapter.listAssigned().catch(() => []) : Promise.resolve([]),
            ]);
            setAvailability(avail);
            setInProgress(current);
            setCompleted(mine);
            setIssues(myIssues);
            setAssigned(assignedList);
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
    const todo = groupAssignments(assigned);
    const offered = !!availability?.offered;
    const row = { display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${v('border', '#eee')}`, padding: '8px 0' };
    const mono = { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.65 };
    const startBtn = (primary) => ({
        padding: '5px 12px',
        borderRadius: v('radius', '8px'),
        border: primary ? 'none' : `1px solid ${v('border', '#d0d0d0')}`,
        background: primary ? v('accent', '#9B251B') : 'transparent',
        color: primary ? v('accent-fg', '#fff') : v('fg', '#1a1a1a'),
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
    });
    const tabs = [
        { key: 'todo', label: 'To do', count: assigned.length },
        { key: 'completed', label: 'Completed', count: completed.length },
        { key: 'issues', label: 'My issues', count: issues.length },
    ];
    return (_jsxs("div", { style: base, children: [error ? _jsx("p", { style: { margin: 0, color: v('error', '#9B251B'), fontSize: 13 }, children: error }) : null, offered && availability ? (_jsxs("div", { "data-testid": "walk-this-build", style: {
                    border: `1px solid ${v('border', '#d0d0d0')}`,
                    borderLeft: `3px solid ${v('accent', '#9B251B')}`,
                    borderRadius: v('radius', '10px'),
                    padding: 12,
                    display: 'grid',
                    gap: 6,
                }, children: [_jsx("span", { style: { ...mono, letterSpacing: '0.12em', textTransform: 'uppercase' }, children: inProgress ? 'Resume your walk' : 'Walk this build' }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("strong", { style: { fontFamily: v('serif', 'inherit') }, children: inProgress?.build || availability.build }), _jsxs("div", { style: mono, children: [inProgress?.env || availability.env, inProgress
                                                ? ` · ${inProgress.coverage.total > 0 ? `${inProgress.coverage.walked} / ${inProgress.coverage.total}` : inProgress.coverage.walked} walked${inProgress.flagged ? ` · ${inProgress.flagged} flagged` : ''}`
                                                : ''] })] }), _jsx("button", { onClick: () => (onStartWalk ? onStartWalk(availability) : undefined), disabled: !onStartWalk, style: { ...startBtn(true), padding: '8px 16px', fontSize: 13, cursor: onStartWalk ? 'pointer' : 'not-allowed' }, children: inProgress ? 'Resume walk' : 'Start walk' })] })] })) : null, notice ? (_jsxs("div", { role: "status", style: { display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: v('radius', '8px'), background: v('ok-bg', '#e7efe4'), color: v('ok', '#2f6d3a'), fontSize: 13 }, children: [_jsx("span", { style: { flex: 1 }, children: notice }), onDismissNotice ? (_jsx("button", { onClick: onDismissNotice, "aria-label": "Dismiss", style: { border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14 }, children: "\u00D7" })) : null] })) : null, _jsx("div", { role: "tablist", style: { display: 'flex', gap: 2, borderBottom: `1px solid ${v('border', '#e4ddcd')}` }, children: tabs.map((t) => (_jsxs("button", { role: "tab", "aria-selected": tab === t.key, onClick: () => setTab(t.key), style: {
                        padding: '6px 10px',
                        border: 'none',
                        borderBottom: `2px solid ${tab === t.key ? v('accent', '#9B251B') : 'transparent'}`,
                        background: 'transparent',
                        color: v('fg', '#1a1a1a'),
                        opacity: tab === t.key ? 1 : 0.65,
                        fontWeight: tab === t.key ? 600 : 400,
                        fontSize: 13,
                        cursor: 'pointer',
                        marginBottom: -1,
                    }, children: [t.label, ' ', _jsx("span", { style: { fontSize: 11, padding: '0 6px', borderRadius: 999, background: v('chip-bg', '#f0f0f0') }, children: t.count })] }, t.key))) }), tab === 'todo' ? (_jsxs("div", { style: { display: 'grid', gap: 10 }, children: [!assigned.length ? _jsx("span", { style: { fontSize: 13, opacity: 0.6 }, children: "Nothing assigned to you right now." }) : null, todo.inProgress.length ? (_jsxs("section", { style: { display: 'grid' }, children: [_jsx("span", { style: { ...mono, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }, children: "In progress" }), todo.inProgress.map((a) => (_jsxs("div", { style: row, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 13 }, children: a.catalogueId }), _jsxs("div", { style: mono, children: [a.build, a.env ? ` · ${a.env}` : ''] })] }), onStartAssignment ? (_jsx("button", { onClick: () => onStartAssignment(a), style: startBtn(true), children: "Resume" })) : null] }, a.id)))] })) : null, todo.groups.map((g, i) => {
                        // The newest build is unfolded; older builds start folded so the list stays short.
                        const isOpen = open[g.build] ?? i === 0;
                        const all = !!showAll[g.build];
                        const rows = all ? g.assignments : g.assignments.slice(0, GROUP_PAGE);
                        return (_jsxs("section", { style: { border: `1px solid ${v('border', '#e4ddcd')}`, borderRadius: v('radius', '10px'), padding: '0 10px' }, children: [_jsxs("button", { onClick: () => setOpen((o) => ({ ...o, [g.build]: !isOpen })), "aria-expanded": isOpen, style: { display: 'flex', width: '100%', alignItems: 'baseline', gap: 8, padding: '8px 0', border: 'none', background: 'transparent', color: v('fg', '#1a1a1a'), cursor: 'pointer', textAlign: 'left' }, children: [_jsx("span", { style: { opacity: 0.6, width: 10 }, children: isOpen ? '▾' : '▸' }), _jsx("strong", { style: { fontSize: 13 }, children: g.build }), _jsxs("span", { style: mono, children: [g.env ? `${g.env} · ` : '', g.assignments.length, " ", g.assignments.length === 1 ? 'walk' : 'walks'] })] }), isOpen ? (_jsxs(_Fragment, { children: [rows.map((a) => (_jsxs("div", { style: row, children: [_jsx("div", { style: { flex: 1, minWidth: 0, fontSize: 13 }, children: a.catalogueId }), onStartAssignment ? (_jsx("button", { onClick: () => onStartAssignment(a), style: startBtn(false), children: "Start" })) : null] }, a.id))), g.assignments.length > GROUP_PAGE ? (_jsx("button", { onClick: () => setShowAll((s) => ({ ...s, [g.build]: !all })), style: { border: 'none', background: 'transparent', color: v('accent', '#9B251B'), padding: '6px 0 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }, children: all ? 'Show fewer' : `Show ${g.assignments.length - GROUP_PAGE} more` })) : null] })) : null] }, g.build));
                    }), !offered && !assigned.length ? _jsx("span", { style: { fontSize: 13, opacity: 0.6 }, children: "No walk is offered for this build." }) : null] })) : null, tab === 'completed' ? (_jsx("div", { style: { display: 'grid' }, children: completed.length ? (completed.map((w) => (_jsx("div", { style: row, children: _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 13 }, children: w.build }), _jsxs("div", { style: { fontSize: 11, opacity: 0.6 }, children: [w.coverage.walked, " / ", w.coverage.total, " walked", w.flagged ? ` · ${w.flagged} flagged` : ''] })] }) }, w.walkId)))) : (_jsx("span", { style: { fontSize: 13, opacity: 0.6 }, children: "No completed walks yet." })) })) : null, tab === 'issues' ? (_jsx("div", { style: { display: 'grid' }, children: issues.length ? (issues.map((it) => (_jsxs("div", { style: row, children: [_jsxs("span", { style: { fontFamily: v('mono', 'ui-monospace, monospace'), fontSize: 11, opacity: 0.6 }, children: ["#", it.checkRef] }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 13 }, children: it.title }), _jsxs("div", { style: { fontSize: 11, opacity: 0.6 }, children: ["raised on ", it.build] }), it.resolution ? (_jsxs("div", { style: { fontSize: 12, opacity: 0.85, marginTop: 3 }, children: [_jsx("b", { children: it.resolutionKind === 'clarified' ? 'Clarified:' : 'Fixed:' }), " ", it.resolution] })) : null] }), _jsx("span", { style: {
                                fontFamily: v('mono', 'ui-monospace, monospace'),
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: it.resolvedBuild ? v('ok-bg', '#e7efe4') : v('chip-bg', '#f0f0f0'),
                                color: it.resolvedBuild ? v('ok', '#2f6d3a') : v('fg', '#1a1a1a'),
                                whiteSpace: 'nowrap',
                            }, children: it.resolvedBuild ? `${it.resolutionKind === 'clarified' ? 'Clarified' : 'Fixed'} ${it.resolvedBuild}` : STATUS_LABEL[it.status] })] }, it.id)))) : (_jsx("span", { style: { fontSize: 13, opacity: 0.6 }, children: "Nothing raised yet." })) })) : null] }));
}
