// The portal-backed WalkAdapter (T3 of the validation motion): the walk analog of createBeaconAdapter.
// It maps the WalkAdapter interface onto the client-portal walk API (the /api/walk/* endpoints), carrying
// the walk context (cohort / catalogue / build / env) internally and tracking the current walkId across
// start -> mark/flag/clear -> submit, so the interface methods stay minimal. Design-system-agnostic and
// backend-agnostic: the host supplies the endpoint (a same-origin forwarder, e.g. "/api/walk", or the
// portal URL directly) plus how the tester is authenticated (the portal magic-link). This is the ONE
// client implementation a portal-backed product wires once; the stub (createStubWalkAdapter) is for demos.

import type {
  WalkAdapter,
  WalkAvailability,
  WalkIdentity,
  WalkIssue,
  WalkState,
  WalkSummary,
} from './walkTypes.js'

export interface WalkAdapterConfig {
  // Base of the walk API. Web products use a same-origin forwarder (e.g. "/api/walk") that relays to the
  // portal; a direct integration uses the portal base (e.g. "https://clientportal.bells-and-pixels.com/api/walk").
  endpoint: string
  // The tester's cohort (the walk's isolation anchor). The portal re-checks live membership on every call.
  cohortId: string
  // Which catalogue this build ships (e.g. "trial-wizard").
  catalogueId: string
  // The build the walk runs on (the version-pill string) and the ring; stamped on the walk + its flags.
  build?: string
  env?: string
  // The catalogue's surface count (M), sent at start/submit so coverage N/M is honest server-side.
  total?: number
  // Reuse the host's sign-in (e.g. the portal magic-link). Omitted -> authenticate() just resolves identity.
  authenticate?: () => Promise<WalkIdentity>
  // Resolve the current identity without prompting. Omitted -> GET identityEndpoint (default "/api/me").
  resolveIdentity?: () => Promise<WalkIdentity>
  identityEndpoint?: string
  // Optional: the catalogue check text for a flagged check, so the intake row reads well ("Check 27" otherwise).
  titleForCheck?: (checkRef: number) => string | undefined
  // Injectable for tests; defaults to the global fetch. Credentials ride so the portal session reaches the API.
  fetchImpl?: typeof fetch
}

interface StartResponse extends WalkState {
  walkId?: string
}
interface SummaryResponse {
  walkId?: string
  build?: string
  env?: string
  submittedOn?: string
  coverage?: { walked?: number; total?: number }
  flagged?: number
}
interface IssueResponse {
  id?: string
  reference?: string
  checkRef?: number
  surfaceKey?: string
  title?: string
  status?: WalkIssue['status']
  resolvedBuild?: string
  build?: string
}

function mapSummary(r: SummaryResponse): WalkSummary {
  return {
    walkId: r.walkId ?? '',
    build: r.build ?? '',
    env: r.env ?? '',
    submittedOn: r.submittedOn,
    coverage: { walked: r.coverage?.walked ?? 0, total: r.coverage?.total ?? 0 },
    flagged: r.flagged ?? 0,
  }
}
function mapIssue(r: IssueResponse): WalkIssue {
  return {
    id: r.id ?? '',
    reference: r.reference,
    checkRef: r.checkRef ?? 0,
    surfaceKey: r.surfaceKey,
    title: r.title ?? '',
    status: r.status ?? 'submitted',
    resolvedBuild: r.resolvedBuild,
    build: r.build ?? '',
  }
}

export function createWalkAdapter(cfg: WalkAdapterConfig): WalkAdapter {
  const doFetch = cfg.fetchImpl ?? fetch
  const base = cfg.endpoint.replace(/\/$/, '')
  const identityUrl = cfg.identityEndpoint ?? '/api/me'
  let walkId: string | undefined

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) throw new Error((data as { error?: string }).error || `Walk request failed (${res.status})`)
    return data
  }
  async function getJson<T>(path: string): Promise<T> {
    const res = await doFetch(`${base}${path}`, { credentials: 'include' })
    const data = (await res.json().catch(() => ({}))) as T & { error?: string }
    if (!res.ok) throw new Error((data as { error?: string }).error || `Walk request failed (${res.status})`)
    return data
  }
  function requireWalk(): string {
    if (!walkId) throw new Error('start() must be called before this walk action')
    return walkId
  }

  async function identity(): Promise<WalkIdentity> {
    if (cfg.resolveIdentity) return cfg.resolveIdentity()
    try {
      const me = await getJson<{ authenticated?: boolean; name?: string; displayName?: string; contactId?: string }>(identityUrl)
      const authenticated = me.authenticated ?? !!me.contactId
      return { authenticated, name: authenticated ? (me.name ?? me.displayName) : undefined }
    } catch {
      return { authenticated: false }
    }
  }

  return {
    authenticate: async () => (cfg.authenticate ? cfg.authenticate() : identity()),
    identity,
    available: async (): Promise<WalkAvailability | null> => {
      const id = await identity()
      if (!id.authenticated) return null
      return { offered: true, build: cfg.build ?? '', env: cfg.env ?? '', catalogueId: cfg.catalogueId }
    },
    start: async (): Promise<WalkState> => {
      const r = await postJson<StartResponse>('/start', {
        cohortId: cfg.cohortId,
        catalogueId: cfg.catalogueId,
        build: cfg.build,
        env: cfg.env,
        total: cfg.total,
      })
      walkId = r.walkId
      return { walked: r.walked ?? {}, defects: r.defects ?? {} }
    },
    markWalked: async (surfaceKey, walked) => {
      await postJson('/mark', { walkId: requireWalk(), surfaceKey, walked })
    },
    flag: async ({ checkRef, note }) => {
      const r = await postJson<{ id?: string; reference?: string }>('/flag', {
        walkId: requireWalk(),
        checkRef,
        note,
        title: cfg.titleForCheck?.(checkRef),
      })
      return { id: r.id ?? '', reference: r.reference ?? undefined }
    },
    clearFlag: async (checkRef) => {
      await postJson('/clear', { walkId: requireWalk(), checkRef })
    },
    submit: async (): Promise<WalkSummary> => {
      const r = await postJson<SummaryResponse>('/submit', { walkId: requireWalk(), total: cfg.total })
      walkId = undefined
      return mapSummary(r)
    },
    listMine: async (): Promise<WalkSummary[]> => {
      const r = await getJson<{ walks?: SummaryResponse[] }>('/mine')
      return (r.walks ?? []).map(mapSummary)
    },
    listMyIssues: async (): Promise<WalkIssue[]> => {
      const r = await getJson<{ issues?: IssueResponse[] }>('/issues')
      return (r.issues ?? []).map(mapIssue)
    },
  }
}
