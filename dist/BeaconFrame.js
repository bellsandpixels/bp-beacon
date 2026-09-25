import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// The ONE Beacon mount every product renders (decision #167, extends #165: #165 made first-run behaviour one
// hook, this makes the mount around it one component). A product passes the @bp/ui AppFrame and its
// parseChangelog as props, so @bp/beacon still imports nothing from @bp/ui (decision #108, the AppFrame is
// Tailwind-free and imports nothing from the Beacon; injecting keeps the dependency one-way). Everything the
// four hand-written mounts used to repeat lives here, once: parse the changelog, hash the user key,
// useBeaconOnboarding, spread its frame props into the AppFrame, render the tour. A product's mount becomes a
// thin declaration of its config and its slots, with no logic and no copied userKeyOf.
//
//   import { AppFrame, parseChangelog } from '@bp/ui/app-frame'
//   import { BeaconFrame } from '@bp/beacon'
//   <BeaconFrame appFrame={AppFrame} parseChangelog={parseChangelog}
//     product="ike" appName="Iké" version={version} changelogMarkdown={md} help={help}
//     whatsNewKey="date" steps={[]} userId={session.user?.id} enabled={inPond}
//     slots={{ renderFeedback, diagnostics }} />
import { useMemo } from 'react';
import { useBeaconOnboarding } from './useBeaconOnboarding.js';
import { userKeyOf } from './userKey.js';
export function BeaconFrame({ appFrame: AppFrame, parseChangelog, product, whatsNewKey, steps, title, intro, manualComplete, tour, policy, adapter, enabled, style, userId, userKey, appName, version, changelogMarkdown, help, slots, }) {
    const entries = useMemo(() => parseChangelog(changelogMarkdown ?? ''), [parseChangelog, changelogMarkdown]);
    const resolvedKey = userKey ?? (userId !== undefined ? userKeyOf(userId) : undefined);
    const onboarding = useBeaconOnboarding({
        product,
        userKey: resolvedKey,
        version,
        entries,
        whatsNewKey,
        steps: steps ?? [],
        title,
        intro,
        manualComplete,
        tour,
        policy,
        adapter,
        enabled,
        style,
    });
    return (_jsxs(_Fragment, { children: [_jsx(AppFrame, { ...onboarding.frame, appName: appName, version: version, changelogMarkdown: changelogMarkdown, help: help, ...slots }), onboarding.tour] }));
}
