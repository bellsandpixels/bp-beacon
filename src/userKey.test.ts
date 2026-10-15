import { test } from 'node:test'
import assert from 'node:assert/strict'
import { userKeyOf } from './userKey.js'

test('userKeyOf is deterministic', () => {
  assert.equal(userKeyOf('user@example.com'), userKeyOf('user@example.com'))
})

test('userKeyOf separates different ids', () => {
  const a = userKeyOf('alice@example.com')
  const b = userKeyOf('bob@example.com')
  assert.notEqual(a, b)
})

test('userKeyOf is base36 (no identifying characters leak)', () => {
  for (const id of ['user@example.com', 'A VERY long Id 12345', '日本語', '']) {
    assert.match(userKeyOf(id), /^[0-9a-z]+$/)
  }
})

test('userKeyOf handles the empty id stably', () => {
  // djb2 seed is 5381; the empty id hashes to that seed, base36.
  assert.equal(userKeyOf(''), (5381).toString(36))
})

test('userKeyOf never returns the raw id', () => {
  const id = 'jason@bellsandpixels.com'
  assert.notEqual(userKeyOf(id), id)
  assert.ok(!userKeyOf(id).includes('@'))
})
