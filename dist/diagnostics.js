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
export function gatherWebContext(cfg) {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const route = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
    return {
        appName: cfg.appName,
        appVersion: cfg.appVersion,
        env: cfg.env,
        platform: 'web',
        osMajor: osMajorFromUA(nav?.userAgent),
        route,
        locale: nav?.language ?? '',
    };
}
