export declare const TOUR_FOCUSABLE = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])";
export declare function trapFocusTarget(current: number, count: number, backwards: boolean): number | null;
export declare function shouldRetrapFocus(targetInCard: boolean, targetInOtherDialog: boolean): boolean;
export declare function hasOtherOpenDialog(card: unknown, dialogs: readonly unknown[]): boolean;
