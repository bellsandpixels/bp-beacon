// Where the coach-mark card sits relative to its highlighted target. Pure (rects in, position out) so the
// geometry is unit-tested without a DOM. Prefers below the target, then above, then whichever side has
// more room, and always clamps inside the viewport with a margin so the card is never cut off on a phone.
export const TOUR_GAP = 12;
export const TOUR_MARGIN = 16;
const clamp = (n, min, max) => Math.max(min, Math.min(n, Math.max(min, max)));
export function placeTourCard(target, card, viewport) {
    const maxLeft = viewport.width - card.width - TOUR_MARGIN;
    const maxTop = viewport.height - card.height - TOUR_MARGIN;
    if (!target) {
        return {
            top: clamp((viewport.height - card.height) / 2, TOUR_MARGIN, maxTop),
            left: clamp((viewport.width - card.width) / 2, TOUR_MARGIN, maxLeft),
            side: 'center',
        };
    }
    const left = clamp(target.left + target.width / 2 - card.width / 2, TOUR_MARGIN, maxLeft);
    const below = target.top + target.height + TOUR_GAP;
    const above = target.top - TOUR_GAP - card.height;
    const roomBelow = viewport.height - TOUR_MARGIN - below;
    const roomAbove = above - TOUR_MARGIN;
    if (roomBelow >= card.height)
        return { top: below, left, side: 'below' };
    if (roomAbove >= 0)
        return { top: above, left, side: 'above' };
    // Neither side fits whole: take the roomier side and clamp so the card stays on screen.
    return roomBelow >= roomAbove
        ? { top: clamp(below, TOUR_MARGIN, maxTop), left, side: 'below' }
        : { top: clamp(above, TOUR_MARGIN, maxTop), left, side: 'above' };
}
