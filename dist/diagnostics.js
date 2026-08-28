// Gathers the consented, allow-listed web diagnostics (BeaconContext, D3). The host supplies its app
// identity (appName / appVersion / env); the SDK derives ONLY the coarse browser fields (platform, OS
// major, route path, locale). Nothing else is read - no stable id, no IP, no full user-agent, no state.
// The same object the pane shows under "what's included" and the adapter sends, so the inspect view can
// never drift from what is actually sent.
// Coarse OS family + major only (never the full user-agent). Best-effort; unknown devices yield ""
// (dropped downstream), never a raw UA string.
export function osMajorFromUA(ua) {
    if (!ua)
        return '';
    let m = ua.match(/Android\s+(\d+)/);
    if (m)
        return `Android ${m[1]}`;
    m = ua.match(/(?:iPhone OS|CPU OS)\s+(\d+)/);
    if (m)
        return `iOS ${m[1]}`;
    m = ua.match(/Mac OS X\s+(\d+)[._](\d+)/);
    if (m)
        return `macOS ${m[1]}`;
    if (/Windows NT 10/.test(ua))
        return 'Windows 10+';
    if (/Windows/.test(ua))
        return 'Windows';
    if (/Linux/.test(ua))
        return 'Linux';
    return '';
}
// Coarse OS FAMILY only (the bucket behind osMajor's version detail). Best-effort; unknown yields ""
// (dropped downstream). Order matters: Android UAs also contain "Linux", and iPadOS reports "Mac OS X",
// so the mobile families are tested before the desktop ones.
export function osFromUA(ua) {
    if (!ua)
        return '';
    if (/Android/.test(ua))
        return 'android';
    if (/iPhone|iPad|iPod/.test(ua) || /(?:iPhone OS|CPU OS)\s+\d/.test(ua))
        return 'ios';
    if (/Windows/.test(ua))
        return 'win';
    if (/Mac OS X|Macintosh/.test(ua))
        return 'mac';
    if (/Linux|X11/.test(ua))
        return 'linux';
    return '';
}
// Coarse form FACTOR only (never a model or screen dimensions). Best-effort; unknown yields ""
// (dropped downstream). Tablet signals are tested before phone signals (an Android tablet UA has no
// "Mobile" token; a phone does), and desktop is the fallback for a UA with no mobile/tablet marker.
export function deviceFromUA(ua) {
    if (!ua)
        return '';
    // Tablets first: iPad, or Android WITHOUT the "Mobile" token (Android phones always carry "Mobile").
    if (/iPad/.test(ua))
        return 'tablet';
    if (/Android/.test(ua))
        return /Mobile/.test(ua) ? 'phone' : 'tablet';
    if (/iPhone|iPod/.test(ua))
        return 'phone';
    // Generic mobile marker (Windows Phone, older webkits) with no desktop OS token.
    if (/Mobi|Windows Phone/.test(ua))
        return 'phone';
    return 'desktop';
}
export function gatherWebContext(cfg) {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const route = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
    const ua = nav?.userAgent;
    return {
        appName: cfg.appName,
        appVersion: cfg.appVersion,
        env: cfg.env,
        platform: 'web',
        device: deviceFromUA(ua),
        os: osFromUA(ua),
        osMajor: osMajorFromUA(ua),
        route,
        locale: nav?.language ?? '',
    };
}
