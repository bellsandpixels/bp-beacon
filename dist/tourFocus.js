// The tour's Tab trap: focus wraps around the card's controls in both directions and never walks out onto
// the page under the scrim. Also: the tour is not the only modal a host can show. A dialog opened ON TOP of
// it (the "New" dialog, a delete confirm) owns focus and the click surface while it is up; the two
// predicates below decide when the tour should yield to one instead of re-trapping onto itself.
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
// Whether a focus change that landed outside the tour card should be re-trapped back onto it. False when
// the focus moved into a dialog the host opened over the tour (recognized by any OTHER aria-modal element
// on the page): that dialog is its own modal and owns focus while it is up, so re-trapping would swallow
// every keystroke meant for it (seen on the Studio "New" dialog: its title field auto-focuses on open, the
// tour's old unconditional re-trap yanked focus straight back, and the title was lost until "Skip for now").
// Re-trap only when focus drifted onto the bare page (a script, an assistive-tech jump) with no other
// dialog claiming it.
export function shouldRetrapFocus(targetInCard, targetInOtherDialog) {
    return !targetInCard && !targetInOtherDialog;
}
// Whether some OTHER dialog (not the tour's own card) is open on the page right now, given every
// aria-modal element currently mounted and the tour card among them (or null before/after it mounts).
// Strict identity, not containment: a dialog never nests inside the tour card or vice versa in practice, and
// keeping this a plain `!==` check keeps it honest about that.
export function hasOtherOpenDialog(card, dialogs) {
    return dialogs.some((el) => el !== card);
}
