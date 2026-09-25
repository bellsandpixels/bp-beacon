// "What's new since your last visit": given the changelog entries a product already shows in its What's
// new panel, the running version, and the version the user last saw, decide which entries are new to them
// and whether What's new should open by itself. Pure, so every product (and the app-frame) shares one rule.
//
// The rule:
//   - First visit ever (no last-seen version): do NOT open. A brand-new user gets the first-run welcome,
//     not a history of releases they never saw. Record the version.
//   - Upgrade (current > last seen): open ONCE with the entries newer than last seen, up to current.
//   - Same version, a downgrade, or an unparseable version: do not open.
// The caller records the current version as seen (adapter.markVersionSeen) once it has decided, so the
// panel opens once per upgrade, not on every visit.
// Parse "1.2.3", "v0.5.1865", "1.2.3-beta.1" (the suffix is ignored) into numeric parts. Returns null when
// there is no leading numeric part, so a label like "Unreleased" never compares as a version.
export function parseVersion(version) {
    const m = /^\s*v?(\d+(?:\.\d+)*)/i.exec(version);
    if (!m || !m[1])
        return null;
    return m[1].split('.').map((n) => Number(n));
}
// -1 / 0 / 1, missing trailing parts count as 0 (1.2 == 1.2.0). Null when either side is unparseable.
export function compareVersions(a, b) {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (!pa || !pb)
        return null;
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const x = pa[i] ?? 0;
        const y = pb[i] ?? 0;
        if (x !== y)
            return x < y ? -1 : 1;
    }
    return 0;
}
export function whatsNewSinceLastVisit(entries, currentVersion, lastSeenVersion) {
    if (!lastSeenVersion)
        return { entries: [], shouldOpen: false, firstVisit: true };
    const direction = compareVersions(currentVersion, lastSeenVersion);
    if (direction === null || direction <= 0)
        return { entries: [], shouldOpen: false, firstVisit: false };
    const fresh = entries.filter((e) => {
        const afterSeen = compareVersions(e.version, lastSeenVersion);
        const notAhead = compareVersions(e.version, currentVersion);
        return afterSeen !== null && afterSeen > 0 && notAhead !== null && notAhead <= 0;
    });
    // An upgrade whose entries are all unparseable or absent still counts as "something changed", but with
    // nothing to show there is no reason to interrupt the user.
    return { entries: fresh, shouldOpen: fresh.length > 0, firstVisit: false };
}
// An ISO date (YYYY-MM-DD) compares correctly as text; anything else is treated as no date at all, so a
// prose date never sorts wrong silently.
function isoDate(date) {
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}
// The newest ISO date among the entries. They arrive newest first, but a hand-edited log may not be sorted.
export function newestEntryDate(entries) {
    let best;
    for (const e of entries) {
        const d = isoDate(e.date);
        if (d && (!best || d > best))
            best = d;
    }
    return best;
}
// The same rule keyed by the entry DATE instead of the version, for a product whose deploy pipeline rewrites
// the top heading's version on every build (client-portal stamps Major.Minor.<run number> into it): the label
// moves while the note does not, so "newer than last seen" must compare dates, or What's new would reopen
// after every deploy showing the same note. The marker recorded as seen is the newest date. An entry without
// an ISO date is never new.
export function whatsNewSinceLastVisitByDate(entries, currentDate, lastSeenDate) {
    if (!lastSeenDate)
        return { entries: [], shouldOpen: false, firstVisit: true };
    const current = isoDate(currentDate);
    const seen = isoDate(lastSeenDate);
    if (!current || !seen || current <= seen)
        return { entries: [], shouldOpen: false, firstVisit: false };
    const fresh = entries.filter((e) => {
        const d = isoDate(e.date);
        return !!d && d > seen && d <= current;
    });
    return { entries: fresh, shouldOpen: fresh.length > 0, firstVisit: false };
}
