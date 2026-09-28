// The single auto-open rule every product shares: What's new wins over the welcome, "Don't show me this
// again" silences the welcome but not release notes, and a top "Unreleased" heading never disables it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideAutoOpen, newestParseableVersion, pickAutoStartTour } from './onboardingDecide.js'
import { emptyOnboardingState } from './onboardingStore.js'
import type { OnboardingStep } from './onboardingTypes.js'

const steps: OnboardingStep[] = [{ id: 'a', title: 'A' }]
const T0 = new Date('2026-09-24T12:00:00Z')
const news = (shouldOpen: boolean) => ({ entries: shouldOpen ? [{ version: '2.0.0' }] : [], shouldOpen, firstVisit: false })

test('first run, no upgrade: the welcome opens', () => {
  assert.equal(decideAutoOpen(news(false), emptyOnboardingState(), steps, T0), 'onboarding')
})

test("both due: What's new wins", () => {
  assert.equal(decideAutoOpen(news(true), emptyOnboardingState(), steps, T0), 'changelog')
})

test('welcome finished, upgrade: What\'s new; nothing otherwise', () => {
  const done = { ...emptyOnboardingState(), completed: ['a'] }
  assert.equal(decideAutoOpen(news(true), done, steps, T0), 'changelog')
  assert.equal(decideAutoOpen(news(false), done, steps, T0), undefined)
})

test('"Don\'t show me this again" silences the welcome, not the release notes', () => {
  const off = { ...emptyOnboardingState(), suppressed: true }
  assert.equal(decideAutoOpen(news(false), off, steps, T0), undefined)
  assert.equal(decideAutoOpen(news(true), off, steps, T0), 'changelog')
})

test('a product can turn release notes off; the welcome still runs', () => {
  assert.equal(decideAutoOpen(news(true), emptyOnboardingState(), steps, T0, { whatsNewOnUpgrade: false }), 'onboarding')
})

test('no version to compare (news null): only the welcome rule applies', () => {
  assert.equal(decideAutoOpen(null, emptyOnboardingState(), steps, T0), 'onboarding')
})

test("no steps declared (What's new only): never asks to open the welcome, still opens release notes", () => {
  assert.equal(decideAutoOpen(news(false), emptyOnboardingState(), [], T0), undefined)
  assert.equal(decideAutoOpen(news(true), emptyOnboardingState(), [], T0), 'changelog')
})

test('newest parseable version skips an Unreleased heading', () => {
  assert.equal(newestParseableVersion([{ version: 'Unreleased' }, { version: '1.2' }, { version: '1.1' }]), '1.2')
  assert.equal(newestParseableVersion([{ version: '0.9.0' }]), '0.9.0')
  assert.equal(newestParseableVersion([{ version: 'Unreleased' }]), undefined)
  assert.equal(newestParseableVersion([]), undefined)
})

// pickAutoStartTour: a declared autoStart tour runs once, by itself, when its first anchor is on the page.
const editorTour = { id: 'editor', autoStart: true, steps: [{ target: 'body', title: 'Write' }, { target: 'publish', title: 'Publish' }] }
const onPage = (...targets: string[]) => (t: string) => targets.includes(t)

test('an autoStart tour starts when its first anchor is on the page', () => {
  assert.equal(pickAutoStartTour(emptyOnboardingState(), [editorTour], onPage('body'))?.id, 'editor')
})

test('an anchor further down the tour does not start it early', () => {
  assert.equal(pickAutoStartTour(emptyOnboardingState(), [editorTour], onPage('publish')), undefined)
})

test('a finished, skipped or suppressed tour never auto-starts again', () => {
  const s = emptyOnboardingState()
  assert.equal(pickAutoStartTour({ ...s, tours: { editor: 'completed' } }, [editorTour], onPage('body')), undefined)
  assert.equal(pickAutoStartTour({ ...s, tours: { editor: 'skipped' } }, [editorTour], onPage('body')), undefined)
  assert.equal(pickAutoStartTour({ ...s, suppressed: true }, [editorTour], onPage('body')), undefined)
})

test('a tour without autoStart, or without steps, is never picked', () => {
  const s = emptyOnboardingState()
  assert.equal(pickAutoStartTour(s, [{ ...editorTour, autoStart: false }], onPage('body')), undefined)
  assert.equal(pickAutoStartTour(s, [{ id: 'empty', autoStart: true, steps: [] }], () => true), undefined)
})

test('the first due tour in declaration order wins', () => {
  const other = { id: 'other', autoStart: true, steps: [{ target: 'body', title: 'Other' }] }
  const s = { ...emptyOnboardingState(), tours: { editor: 'completed' as const } }
  assert.equal(pickAutoStartTour(s, [editorTour, other], onPage('body'))?.id, 'other')
})
