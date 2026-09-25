// The ONE Beacon mount every product renders (decision #167, extends #165: #165 made first-run behaviour one
// hook, this makes the mount around it one component). A product passes the @bp/ui AppFrame and its
// parseChangelog as props, so @bp/beacon still imports nothing from @bp/ui (decision #108, the AppFrame is
// Tailwind-free and imports nothing from the Beacon; injecting keeps the dependency one-way). Everything the
// four hand-written mounts used to repeat lives here, once: parse the changelog, hash the user key,
// useBeaconOnboarding, spread its frame props into the AppFrame, render the tour. A product's mount becomes a
// thin declaration of its config and its slots, with no logic and no copied userKeyOf.
//
//   import { AppFrame, parseChangelog } from '@bp/ui/app-frame'
//   import { BeaconFrame } from '@bp/beacon'
//   <BeaconFrame appFrame={AppFrame} parseChangelog={parseChangelog}
//     product="ike" appName="Iké" version={version} changelogMarkdown={md} help={help}
//     whatsNewKey="date" steps={[]} userId={session.user?.id} enabled={inPond}
//     slots={{ renderFeedback, diagnostics }} />

import { useMemo, type ComponentType, type CSSProperties, type ReactNode } from 'react'
import { useBeaconOnboarding } from './useBeaconOnboarding.js'
import { userKeyOf } from './userKey.js'
import type { VersionedEntry } from './whatsNew.js'
import type { OnboardingAdapter, OnboardingPolicy, OnboardingStep, TourStep } from './onboardingTypes.js'

export interface BeaconFrameProps {
  // Injected from @bp/ui so @bp/beacon stays UI-agnostic (decision #108). The product passes its own real,
  // fully-typed AppFrame and parseChangelog; typed loosely here on purpose.
  appFrame: ComponentType<any>
  parseChangelog: (markdown: string) => VersionedEntry[]

  // Onboarding config, the hook's minus what BeaconFrame derives (entries from changelogMarkdown, userKey
  // from userId).
  product: string
  whatsNewKey?: 'version' | 'date'
  steps?: readonly OnboardingStep[]
  title?: string
  intro?: string
  manualComplete?: boolean
  tour?: { id: string; steps: readonly TourStep[] }
  policy?: OnboardingPolicy & { whatsNewOnUpgrade?: boolean }
  adapter?: OnboardingAdapter
  enabled?: boolean
  style?: CSSProperties

  // The stable, non-identifying user id; hashed to the store key. Omit for a per-browser key. A precomputed
  // userKey overrides it (a product that already hashes, or a test).
  userId?: string
  userKey?: string

  // AppFrame chrome forwarded on every product.
  appName?: string
  version?: string
  changelogMarkdown?: string
  help?: unknown

  // Product-specific AppFrame props: the feedback member or renderFeedback slot, renderWalk, diagnostics, and
  // anything else that mount needs. Spread last so a product owns its own chrome.
  slots?: Record<string, unknown>
}

export function BeaconFrame({
  appFrame: AppFrame,
  parseChangelog,
  product,
  whatsNewKey,
  steps,
  title,
  intro,
  manualComplete,
  tour,
  policy,
  adapter,
  enabled,
  style,
  userId,
  userKey,
  appName,
  version,
  changelogMarkdown,
  help,
  slots,
}: BeaconFrameProps): ReactNode {
  const entries = useMemo(
    () => parseChangelog(changelogMarkdown ?? ''),
    [parseChangelog, changelogMarkdown],
  )
  const resolvedKey = userKey ?? (userId !== undefined ? userKeyOf(userId) : undefined)
  const onboarding = useBeaconOnboarding({
    product,
    userKey: resolvedKey,
    version,
    entries,
    whatsNewKey,
    steps: steps ?? [],
    title,
    intro,
    manualComplete,
    tour,
    policy,
    adapter,
    enabled,
    style,
  })
  return (
    <>
      <AppFrame
        {...onboarding.frame}
        appName={appName}
        version={version}
        changelogMarkdown={changelogMarkdown}
        help={help}
        {...slots}
      />
      {onboarding.tour}
    </>
  )
}
