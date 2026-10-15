// A small QR Code encoder (ISO/IEC 18004), byte mode only. Beacon ships no runtime dependencies, so the
// "continue on another device" QR for a walk URL is encoded here, locally: the walk URL (which carries an
// assignment and cohort id) is never sent to a third-party QR image service. Modelled on Nayuki's
// qrcodegen and proven module-for-module against the `qrcode` npm package. Pure, no React; the caller
// renders the matrix (e.g. as SVG rects).
const ECC_ORDINAL = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
// Per ECC level (L, M, Q, H), indexed by version (index 0 unused).
const ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
const at = (row, i) => row[i];
/** Raw data modules (bits) available in a version, after all function patterns. */
function numRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
        const numAlign = Math.floor(ver / 7) + 2;
        result -= (25 * numAlign - 10) * numAlign - 55;
        if (ver >= 7)
            result -= 36;
    }
    return result;
}
function numDataCodewords(ver, e) {
    return Math.floor(numRawDataModules(ver) / 8) - at(ECC_CODEWORDS_PER_BLOCK[e], ver) * at(NUM_ERROR_CORRECTION_BLOCKS[e], ver);
}
// --- Reed-Solomon over GF(2^8), primitive polynomial 0x11D ---
function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}
function rsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            result[j] = gfMul(result[j], root);
            if (j + 1 < degree)
                result[j] = result[j] ^ result[j + 1];
        }
        root = gfMul(root, 0x02);
    }
    return result;
}
function rsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
        const factor = b ^ result.shift();
        result.push(0);
        divisor.forEach((coef, i) => (result[i] = result[i] ^ gfMul(coef, factor)));
    }
    return result;
}
/** Split data into blocks, append each block's ECC, and interleave (ISO 18004 section 7.6). */
function addEccAndInterleave(data, ver, e) {
    const numBlocks = at(NUM_ERROR_CORRECTION_BLOCKS[e], ver);
    const blockEccLen = at(ECC_CODEWORDS_PER_BLOCK[e], ver);
    const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const divisor = rsDivisor(blockEccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
        const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
        k += dat.length;
        const ecc = rsRemainder(dat, divisor);
        if (i < numShortBlocks)
            dat.push(0); // placeholder so every block has the same length
        blocks.push(dat.concat(ecc));
    }
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block, j) => {
            // skip the placeholder byte in short blocks
            if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks)
                result.push(block[i]);
        });
    }
    return result;
}
// --- Matrix construction ---
class Grid {
    ver;
    size;
    modules;
    isFunction;
    constructor(ver) {
        this.ver = ver;
        this.size = ver * 4 + 17;
        this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
        this.isFunction = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    }
    get(x, y) {
        return this.modules[y][x];
    }
    setFn(x, y, dark) {
        this.modules[y][x] = dark;
        this.isFunction[y][x] = true;
    }
}
function alignmentPositions(ver) {
    if (ver === 1)
        return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    const result = [6];
    for (let pos = ver * 4 + 10; result.length < numAlign; pos -= step)
        result.splice(1, 0, pos);
    return result;
}
function drawFormatBits(g, ecc, mask) {
    const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++)
        rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) !== 0;
    // first copy, around the top-left finder
    for (let i = 0; i <= 5; i++)
        g.setFn(8, i, bit(i));
    g.setFn(8, 7, bit(6));
    g.setFn(8, 8, bit(7));
    g.setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++)
        g.setFn(14 - i, 8, bit(i));
    // second copy, split between the top-right and bottom-left finders
    for (let i = 0; i < 8; i++)
        g.setFn(g.size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++)
        g.setFn(8, g.size - 15 + i, bit(i));
    g.setFn(8, g.size - 8, true); // the dark module
}
function drawVersionBits(g) {
    if (g.ver < 7)
        return;
    let rem = g.ver;
    for (let i = 0; i < 12; i++)
        rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (g.ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
        const dark = ((bits >>> i) & 1) !== 0;
        const a = g.size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        g.setFn(a, b, dark);
        g.setFn(b, a, dark);
    }
}
function drawFunctionPatterns(g, ecc) {
    const n = g.size;
    for (let i = 0; i < n; i++) {
        g.setFn(6, i, i % 2 === 0); // timing
        g.setFn(i, 6, i % 2 === 0);
    }
    // finders with their separators (the 9x9 area, clipped at the edges)
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const d = Math.max(Math.abs(dx), Math.abs(dy));
                const x = cx + dx;
                const y = cy + dy;
                if (x >= 0 && x < n && y >= 0 && y < n)
                    g.setFn(x, y, d !== 2 && d !== 4);
            }
        }
    }
    const pos = alignmentPositions(g.ver);
    const last = pos.length - 1;
    pos.forEach((ax, i) => {
        pos.forEach((ay, j) => {
            // skip the three that would overlap the finders
            if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0))
                return;
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++)
                    g.setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
            }
        });
    });
    drawFormatBits(g, ecc, 0); // reserve the format area; redrawn once the mask is known
    drawVersionBits(g);
}
/** Place codeword bits in the zigzag order: two-column strips, right to left, skipping the timing column. */
function drawCodewords(g, data) {
    let i = 0;
    for (let right = g.size - 1; right >= 1; right -= 2) {
        if (right === 6)
            right = 5;
        for (let vert = 0; vert < g.size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j;
                const upward = ((right + 1) & 2) === 0;
                const y = upward ? g.size - 1 - vert : vert;
                if (!g.isFunction[y][x] && i < data.length * 8) {
                    g.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
                    i++;
                }
            }
        }
    }
}
function applyMask(g, mask) {
    for (let y = 0; y < g.size; y++) {
        for (let x = 0; x < g.size; x++) {
            let invert;
            switch (mask) {
                case 0:
                    invert = (x + y) % 2 === 0;
                    break;
                case 1:
                    invert = y % 2 === 0;
                    break;
                case 2:
                    invert = x % 3 === 0;
                    break;
                case 3:
                    invert = (x + y) % 3 === 0;
                    break;
                case 4:
                    invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
                    break;
                case 5:
                    invert = ((x * y) % 2) + ((x * y) % 3) === 0;
                    break;
                case 6:
                    invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
                    break;
                default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
            }
            if (!g.isFunction[y][x] && invert)
                g.modules[y][x] = !g.modules[y][x];
        }
    }
}
// --- Mask penalty (N1 runs, N2 2x2 blocks, N3 finder-like patterns, N4 dark balance) ---
const N1 = 3;
const N2 = 3;
const N3 = 40;
const N4 = 10;
function penaltyScore(g) {
    const n = g.size;
    let result = 0;
    const line = (read) => {
        let runColor = false;
        let runLen = 0;
        const history = [0, 0, 0, 0, 0, 0, 0];
        // history[0] is the latest run; the light border counts as part of the first run
        const addHistory = (len) => {
            if (history[0] === 0)
                len += n;
            history.pop();
            history.unshift(len);
        };
        const countPatterns = () => {
            const h = history;
            const m = h[1];
            const core = m > 0 && h[2] === m && h[3] === m * 3 && h[4] === m && h[5] === m;
            return (core && h[0] >= m * 4 && h[6] >= m ? 1 : 0) + (core && h[6] >= m * 4 && h[0] >= m ? 1 : 0);
        };
        for (let i = 0; i < n; i++) {
            if (read(i) === runColor) {
                runLen++;
                if (runLen === 5)
                    result += N1;
                else if (runLen > 5)
                    result++;
            }
            else {
                addHistory(runLen);
                if (!runColor)
                    result += countPatterns() * N3;
                runColor = read(i);
                runLen = 1;
            }
        }
        // terminate with the light border
        if (runColor) {
            addHistory(runLen);
            runLen = 0;
        }
        runLen += n;
        addHistory(runLen);
        result += countPatterns() * N3;
    };
    for (let y = 0; y < n; y++)
        line((x) => g.get(x, y));
    for (let x = 0; x < n; x++)
        line((y) => g.get(x, y));
    for (let y = 0; y < n - 1; y++) {
        for (let x = 0; x < n - 1; x++) {
            const c = g.get(x, y);
            if (c === g.get(x + 1, y) && c === g.get(x, y + 1) && c === g.get(x + 1, y + 1))
                result += N2;
        }
    }
    let dark = 0;
    for (const row of g.modules)
        for (const m of row)
            if (m)
                dark++;
    const total = n * n;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * N4;
    return result;
}
// --- Public API ---
/**
 * The module matrix (true = dark), size x size, rows = y. Byte mode (UTF-8), smallest version 1..40 that
 * fits at `ecc` (default 'M'). `mask` forces a mask 0..7; omitted = lowest-penalty mask (standard N1..N4
 * rules). Throws if the text does not fit version 40.
 */
export function qrMatrix(text, opts = {}) {
    const ecc = opts.ecc ?? 'M';
    const e = ECC_ORDINAL[ecc];
    if (opts.mask !== undefined && !(Number.isInteger(opts.mask) && opts.mask >= 0 && opts.mask <= 7)) {
        throw new RangeError('QR mask must be an integer 0..7');
    }
    const bytes = new TextEncoder().encode(text);
    // smallest version whose data capacity fits: mode (4) + count (8 or 16) + 8 bits per byte
    let ver = 1;
    for (;; ver++) {
        if (ver > 40)
            throw new RangeError('Text too long for a QR code');
        const bitsNeeded = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8;
        if (bitsNeeded <= numDataCodewords(ver, e) * 8)
            break;
    }
    // bit stream: mode, char count, data, terminator, byte pad, alternating pad bytes
    const bits = [];
    const push = (val, len) => {
        for (let i = len - 1; i >= 0; i--)
            bits.push((val >>> i) & 1);
    };
    push(0b0100, 4);
    push(bytes.length, ver <= 9 ? 8 : 16);
    for (const b of bytes)
        push(b, 8);
    const capacityBits = numDataCodewords(ver, e) * 8;
    push(0, Math.min(4, capacityBits - bits.length));
    push(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11)
        push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++)
            b = (b << 1) | bits[i + j];
        data.push(b);
    }
    const g = new Grid(ver);
    drawFunctionPatterns(g, ecc);
    drawCodewords(g, addEccAndInterleave(data, ver, e));
    let mask = opts.mask;
    if (mask === undefined) {
        let best = Infinity;
        for (let m = 0; m < 8; m++) {
            applyMask(g, m);
            drawFormatBits(g, ecc, m);
            const p = penaltyScore(g);
            if (p < best) {
                best = p;
                mask = m;
            }
            applyMask(g, m); // XOR again undoes it
        }
    }
    applyMask(g, mask);
    drawFormatBits(g, ecc, mask);
    return g.modules;
}
