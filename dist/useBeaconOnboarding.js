import { jsx as _jsx } from "react/jsx-runtime";
// The ONE first-run wiring every product mounts (owner ruling 2026-09-24: the primary Beacon surfaces are
// fudemoji, toudai and ike, and this functionality is written once, not three times with variations).
//
// A product passes its config and spreads the result into the @bp/ui AppFrame:
//
//   const onboarding = useBeaconOnboarding({ product: 'toudai', entries, steps, tour })
//   <AppFrame {...onboarding.frame} ... />
//   {onboarding.tour}
//
// Everything else is here: the store, the seen version, what opens by itself (What's new after an
// upgrade, the welcome on a first run), the "New" tags, the welcome pane with its Skip and "Don't show
// me this again", and the lazily loaded coach-mark tour. @bp/ui stays free of this package: the hook
// returns plain props that AppFrame's renderOnboarding / autoOpen / newVersions accept structurally.
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { OnboardingPane } from './OnboardingPane.js';
import { tourAnchorSelector } from './tourAnchor.js';
import { createLocalOnboardingStore, isChecklistDone } from './onboardingStore.js';
import { decideAutoOpen, newestParseableVersion, pickAutoStartTour } from './onboardingDecide.js';
import { newestEntryDate, parseVersion, whatsNewSinceLastVisit, whatsNewSinceLastVisitByDate, } from './whatsNew.js';
// The tour is its own chunk: a product that never starts one ships none of it.
const LazyCoachTour = lazy(() => import('./tour.js'));
export function useBeaconOnboarding(config) {
    const { product, userKey, entries, steps, title, intro, manualComplete, tour, tours, policy, enabled = true, style } = config;
    const override = config.adapter;
    const adapter = useMemo(() => override ?? createLocalOnboardingStore({ product, userKey }), [override, product, userKey]);
    const whatsNewKey = config.whatsNewKey ?? 'version';
    const version = whatsNewKey === 'date'
        ? newestEntryDate(entries)
        : ((config.version && parseVersion(config.version) ? config.version : undefined) ?? newestParseableVersion(entries));
    const [state, setState] = useState(null);
    const [autoOpen, setAutoOpen] = useState();
    const [newVersions, setNewVersions] = useState();
    // The running tour's id (the welcome's or a declared one), null when none is.
    const [touring, setTouring] = useState(null);
    // Decide after mount (never during render: storage is client-only and must not affect SSR), then
    // record the version as seen so What's new opens once per upgrade, not every visit.
    useEffect(() => {
        if (!enabled)
            return;
        let live = true;
        void (async () => {
            try {
                const loaded = await adapter.load();
                const news = !version
                    ? null
                    : whatsNewKey === 'date'
                        ? whatsNewSinceLastVisitByDate(entries, version, loaded.lastSeenVersion)
                        : whatsNewSinceLastVisit(entries, version, loaded.lastSeenVersion);
                const open = decideAutoOpen(news, loaded, steps, new Date(), policy);
                const marked = version && loaded.lastSeenVersion !== version ? await adapter.markVersionSeen(version) : loaded;
                if (!live)
                    return;
                setState(marked);
                setNewVersions(news?.shouldOpen ? news.entries.map((e) => e.version) : undefined);
                setAutoOpen(open);
            }
            catch {
                // A store that cannot load must never break the product: offer nothing this visit.
            }
        })();
        return () => {
            live = false;
        };
        // steps/policy are config literals in practice; re-deciding on their identity would re-run every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adapter, version, whatsNewKey, entries, enabled]);
    // Keep the hook's copy live too, so the Get started entry retires the moment the last step is done.
    useEffect(() => {
        if (!enabled || !adapter.subscribe)
            return;
        return adapter.subscribe((s) => setState(s));
    }, [adapter, enabled]);
    const allTours = useMemo(() => [...(tour ? [tour] : []), ...(tours ?? [])], [tour, tours]);
    const startTour = useCallback((id) => {
        const target = id ?? tour?.id;
        if (target && allTours.some((t) => t.id === target))
            setTouring(target);
    }, [tour, allTours]);
    // Auto-start: while an autoStart tour is still due and no tour is running, watch the page for its first anchor
    // and start it the moment it appears (the editor opening, say). One MutationObserver, checked at most once a
    // frame, disconnected as soon as a tour starts or none is due any more. Client-only, like the rest.
    const autoTours = useMemo(() => (tours ?? []).filter((t) => t.autoStart), [tours]);
    useEffect(() => {
        if (!enabled || !state || touring || !autoTours.length || typeof document === 'undefined')
            return;
        const hasAnchor = (target) => document.querySelector(tourAnchorSelector(target)) !== null;
        const due = autoTours.filter((t) => pickAutoStartTour(state, [t], () => true));
        if (!due.length)
            return;
        const check = () => {
            const pick = pickAutoStartTour(state, due, hasAnchor);
            if (pick)
                setTouring(pick.id);
            return Boolean(pick);
        };
        if (check() || typeof MutationObserver === 'undefined')
            return;
        let frame = 0;
        const observer = new MutationObserver(() => {
            if (frame)
                return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                if (check())
                    observer.disconnect();
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
        return () => {
            observer.disconnect();
            if (frame)
                cancelAnimationFrame(frame);
        };
    }, [enabled, state, touring, autoTours]);
    const offer = enabled && !!state && !isChecklistDone(state, steps);
    const renderOnboarding = useMemo(() => offer
        ? ({ onClose }) => (_jsx("div", { style: style, children: _jsx(OnboardingPane, { adapter: adapter, steps: steps, title: title, intro: intro, manualComplete: manualComplete, onClose: onClose, onStateChange: setState, onStartTour: tour
                    ? () => {
                        onClose();
                        setTouring(tour.id);
                    }
                    : undefined }) }))
        : undefined, [offer, adapter, steps, title, intro, manualComplete, tour, style]);
    const active = touring ? allTours.find((t) => t.id === touring) : undefined;
    const tourNode = active ? (_jsx("div", { style: style, children: _jsx(Suspense, { fallback: null, children: _jsx(LazyCoachTour, { adapter: adapter, tourId: active.id, steps: active.steps, onClose: () => setTouring(null) }, active.id) }) })) : null;
    return {
        frame: enabled ? { autoOpen, newVersions, renderOnboarding } : {},
        tour: tourNode,
        state,
        adapter,
        startTour,
    };
}
