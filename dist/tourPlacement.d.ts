export interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}
export interface Size {
    width: number;
    height: number;
}
export interface CardPlacement {
    top: number;
    left: number;
    side: 'below' | 'above' | 'center';
}
export declare const TOUR_GAP = 12;
export declare const TOUR_MARGIN = 16;
export declare function placeTourCard(target: Rect | null, card: Size, viewport: Size): CardPlacement;
