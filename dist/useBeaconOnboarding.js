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
import { createLocalOnboardingStore, isChecklistDone } from './onboardingStore.js';
import { decideAutoOpen, newestParseableVersion } from './onboardingDecide.js';
import { parseVersion, whatsNewSinceLastVisit } from './whatsNew.js';
// The tour is its own chunk: a product that never starts one ships none of it.
const LazyCoachTour = lazy(() => import('./tour.js'));
export function useBeaconOnboarding(config) {
    const { product, userKey, entries, steps, title, intro, manualComplete, tour, policy, enabled = true, style } = config;
    const override = config.adapter;
    const adapter = useMemo(() => override ?? createLocalOnboardingStore({ product, userKey }), [override, product, userKey]);
    const version = (config.version && parseVersion(config.version) ? config.version : undefined) ?? newestParseableVersion(entries);
    const [state, setState] = useState(null);
    const [autoOpen, setAutoOpen] = useState();
    const [newVersions, setNewVersions] = useState();
    const [touring, setTouring] = useState(false);
    // Decide after mount (never during render: storage is client-only and must not affect SSR), then
    // record the version as seen so What's new opens once per upgrade, not every visit.
    useEffect(() => {
        if (!enabled)
            return;
        let live = true;
        void (async () => {
            try {
                const loaded = await adapter.load();
                const news = version ? whatsNewSinceLastVisit(entries, version, loaded.lastSeenVersion) : null;
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
    }, [adapter, version, entries, enabled]);
    const startTour = useCallback(() => setTouring(true), []);
    const offer = enabled && !!state && !isChecklistDone(state, steps);
    const renderOnboarding = useMemo(() => offer
        ? ({ onClose }) => (_jsx("div", { style: style, children: _jsx(OnboardingPane, { adapter: adapter, steps: steps, title: title, intro: intro, manualComplete: manualComplete, onClose: onClose, onStateChange: setState, onStartTour: tour
                    ? () => {
                        onClose();
                        setTouring(true);
                    }
                    : undefined }) }))
        : undefined, [offer, adapter, steps, title, intro, manualComplete, tour, style]);
    const tourNode = touring && tour ? (_jsx("div", { style: style, children: _jsx(Suspense, { fallback: null, children: _jsx(LazyCoachTour, { adapter: adapter, tourId: tour.id, steps: tour.steps, onClose: () => setTouring(false) }) }) })) : null;
    return {
        frame: enabled ? { autoOpen, newVersions, renderOnboarding } : {},
        tour: tourNode,
        state,
        adapter,
        startTour,
    };
}
