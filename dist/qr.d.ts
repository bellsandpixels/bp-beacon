export type QrEcc = 'L' | 'M' | 'Q' | 'H';
/**
 * The module matrix (true = dark), size x size, rows = y. Byte mode (UTF-8), smallest version 1..40 that
 * fits at `ecc` (default 'M'). `mask` forces a mask 0..7; omitted = lowest-penalty mask (standard N1..N4
 * rules). Throws if the text does not fit version 40.
 */
export declare function qrMatrix(text: string, opts?: {
    ecc?: QrEcc;
    mask?: number;
}): boolean[][];
