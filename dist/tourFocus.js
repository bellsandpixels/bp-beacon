// The coach-mark tour is a modal dialog, so Tab must not walk out of it onto page controls hidden under
// the scrim. This is the wrap rule the tour's key handler applies, kept pure so it is unit-tested without
// a DOM: given where focus is among the card's focusable controls, where should Tab go?
// Controls inside the card a keyboard user can reach.
export const TOUR_FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
// `current` is the index of the focused control among `count` focusables, or -1 when focus is on the card
// itself (or anywhere else). Returns the index to move focus to, or null to let the browser take the Tab
// normally because it stays inside the card.
export function trapFocusTarget(current, count, backwards) {
    if (count <= 0)
        return null;
    if (current < 0 || current >= count)
        return backwards ? count - 1 : 0;
    if (backwards && current === 0)
        return count - 1;
    if (!backwards && current === count - 1)
        return 0;
    return null;
}
