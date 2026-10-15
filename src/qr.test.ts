// The local QR encoder behind "continue on another device". The golden matrices below were captured from
// the `qrcode` npm package (forced byte mode and mask); the encoder was also proven module-for-module
// against it across 44 strings x 4 ECC levels x 8 masks, so these pin that agreement in-repo.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { qrMatrix } from './qr.js'

const WALK_URL =
  'https://clientportal.bells-and-pixels.com/testing/walk/?assignment=67f3fa1e-a0c1-f111-aaad-000d3a5a0932&catalogue=prospect-journey&build=2.7.6.13&cohort=611c6517-93c1-f111-aaad-6045bd0754e4'

const toRows = (m: boolean[][]) => m.map((row) => row.map((d) => (d ? '1' : '0')).join(''))
const versionOf = (m: boolean[][]) => (m.length - 17) / 4

test('picks the smallest version that fits', () => {
  assert.equal(qrMatrix('HELLO WORLD').length, 21) // v1 at M (byte mode)
  assert.equal(versionOf(qrMatrix(WALK_URL)), 10) // the reference picks v10 at M
  assert.equal(versionOf(qrMatrix('x'.repeat(14), { ecc: 'M' })), 1) // v1-M holds 14 bytes
  assert.equal(versionOf(qrMatrix('x'.repeat(15), { ecc: 'M' })), 2)
  assert.equal(versionOf(qrMatrix('x'.repeat(2331), { ecc: 'M' })), 40)
  assert.throws(() => qrMatrix('x'.repeat(2332), { ecc: 'M' }), RangeError)
  assert.throws(() => qrMatrix('a', { mask: 8 }), RangeError)
})

test('function patterns: finders, timing, dark module', () => {
  for (const text of ['a', WALK_URL]) {
    const m = qrMatrix(text)
    const n = m.length
    for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]] as const) {
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
          assert.equal(m[y0 + dy]![x0 + dx], d !== 2, `finder at ${x0},${y0}`)
        }
      }
    }
    for (let i = 8; i < n - 8; i++) {
      assert.equal(m[6]![i], i % 2 === 0, 'timing row')
      assert.equal(m[i]![6], i % 2 === 0, 'timing column')
    }
    assert.equal(m[n - 8]![8], true, 'dark module')
  }
})

const GOLDEN: { text: string; ecc: 'L' | 'M' | 'Q' | 'H'; mask: number; rows: string[] }[] = [
  { text: 'HELLO WORLD', ecc: 'M', mask: 2, rows: ['111111100000101111111', '100000100101001000001', '101110101110101011101', '101110101010101011101', '101110101010101011101', '100000101101001000001', '111111101010101111111', '000000001010000000000', '101111100011001111100', '011000010111111101100', '101100110000111001110', '011101001111110011100', '100010110110110000101', '000000001110100001000', '111111100101001000110', '100000101110010101111', '101110101001000100101', '101110101000111111000', '101110101100100100100', '100000100010110011100', '111111101011100010110'] },
  { text: 'café ✓', ecc: 'Q', mask: 5, rows: ['111111101110001111111', '100000101001101000001', '101110100010101011101', '101110100000101011101', '101110100100001011101', '100000100110101000001', '111111101010101111111', '000000000011000000000', '010000111110110000011', '111010011110010110100', '010100101111000111110', '010001000010001011111', '110001101111101111011', '000000001111100011101', '111111101011111010010', '100000100011001011011', '101110100011000100101', '101110100101111010100', '101110100101110110011', '100000101111111100000', '111111100100100110010'] },
  { text: 'bp', ecc: 'L', mask: 0, rows: ['111111100010101111111', '100000100000101000001', '101110101010001011101', '101110100000101011101', '101110100101101011101', '100000100111001000001', '111111101010101111111', '000000001010000000000', '111011111010111000100', '011111011111010101001', '001011100011011100111', '011110011101110111011', '000011101001011100101', '000000001110001000111', '111111101000100010011', '100000101100001000111', '101110101000101010101', '101110100001010101010', '101110101101011101101', '100000101001110111010', '111111101011011101111'] },
]

test('golden matrices match the reference encoder exactly', () => {
  for (const g of GOLDEN) assert.deepEqual(toRows(qrMatrix(g.text, { ecc: g.ecc, mask: g.mask })), g.rows, g.text)
})

test('auto mask is deterministic and yields a valid symbol of the same version', () => {
  const a = qrMatrix(WALK_URL)
  assert.deepEqual(a, qrMatrix(WALK_URL))
  const forced = Array.from({ length: 8 }, (_, k) => toRows(qrMatrix(WALK_URL, { mask: k })).join('\n'))
  assert.ok(forced.includes(toRows(a).join('\n')), 'auto result equals one of the 8 forced masks')
})
