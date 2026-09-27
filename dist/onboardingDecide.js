// The one place the first-run auto-open decision is made. Every product mounts the same rule through
// useBeaconOnboarding, so the rule lives here once, pure and unit-tested, and never in a product.
import { shouldAutoOpenOnboarding, shouldAutoStartTour } from './onboardingStore.js';
import { parseVersion } from './whatsNew.js';
// What opens by itself on this visit, if anything. When both are due, What's new wins: it is once per
// upgrade, while an unfinished welcome comes back on a later visit anyway (the other order would lose
// that upgrade's What's new for good). "Don't show me this again" silences the welcome and every tour;
// it does not silence release notes, which are a separate courtesy a product can turn off with
// whatsNewOnUpgrade: false.
export function decideAutoOpen(news, state, steps, now = new Date(), policy = {}) {
    if (news?.shouldOpen && policy.whatsNewOnUpgrade !== false)
        return 'changelog';
    // No checklist declared (a What's-new-only surface, such as a marketing site): there is no welcome to open.
    if (steps.length && shouldAutoOpenOnboarding(state, steps, now, policy))
        return 'onboarding';
    return undefined;
}
// The running version when the product does not say: the newest changelog entry with a real version.
// A top "Unreleased" heading (fudemoji, ike) is skipped rather than silently disabling What's new.
export function newestParseableVersion(entries) {
    return entries.find((e) => parseVersion(e.version) !== null)?.version;
}
// Which declared autoStart tour, if any, should start now: the first one that has steps, is still due for this
// user (not finished, skipped or suppressed), and whose FIRST step's anchor is on the page. A tour starts where it
// begins, so an anchor further down its steps does not start it early. `hasAnchor` is injected so the rule stays
// pure (the hook passes a DOM query).
export function pickAutoStartTour(state, tours, hasAnchor) {
    return tours.find((t) => t.autoStart && t.steps.length > 0 && shouldAutoStartTour(state, t.id) && hasAnchor(t.steps[0].target));
}
