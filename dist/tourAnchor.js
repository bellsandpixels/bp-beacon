// The one selector for a tour anchor, shared by CoachTour (which spotlights it) and useBeaconOnboarding (which
// watches for it to auto-start a tour). Its own tiny module so the hook can use it without pulling in the
// lazily loaded tour code.
export function tourAnchorSelector(target) {
    const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(target) : target.replace(/["\\]/g, '\\$&');
    return `[data-beacon-tour="${esc}"]`;
}
