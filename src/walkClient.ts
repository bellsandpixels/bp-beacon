// The portal-backed WalkAdapter (T3 of the validation motion): the walk analog of createBeaconAdapter.
// It maps the WalkAdapter interface onto the client-portal walk API (the /api/walk/* endpoints), carrying
// the walk context (cohort / catalogue / build / env) internally and tracking the current walkId across
// start -> mark/flag/clear -> submit, so the interface methods stay minimal. Design-system-agnostic and
// backend-agnostic: the host supplies the endpoint (a same-origin forwarder, e.g. "/api/walk", or the
// portal URL directly) plus how the tester is authenticated (the portal magic-link). This is the ONE
// client implementation a portal-backed product wires once; the stub (createStubWalkAdapter) is for demos.

import type {
  WalkAdapter,
  WalkAssignmentSummary,
  WalkAvailability,
  WalkIdentity,
  WalkInProgress,
  WalkIssue,
  WalkStartOptions,
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
  // The device platform this walk runs on (web | android | ios), stamped on the walk so its flags dedup per
  // platform (decision #155 slice 3: iOS and Android walks of the same check are SEPARATE defects). A web pane
  // passes 'web'; a native SDK passes its own. Omitted -> the portal defaults it (web), byte-for-byte the
  // previous request for callers that do not set it.
  platform?: string
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
  resolution?: string
  resolutionKind?: 'fixed' | 'clarified'
  build?: string
}
interface CurrentResponse {
  inProgress?: {
    walkId?: string
    build?: string
    env?: string
    coverage?: { walked?: number; total?: number }
    flagged?: number
  } | null
}
// GET /available (Slice 4b): the caller's open cohort assignments. `build` is the version label (the endpoint
// $expands the build record); `env` is the canonical sandbox|prod.
interface AssignmentResponse {
  id?: string
  catalogueId?: string
  build?: string
  env?: string
  ring?: number
  status?: string
}
function mapAssignment(a: AssignmentResponse): WalkAssignmentSummary {
  return {
    id: a.id ?? '',
    catalogueId: a.catalogueId ?? '',
    build: a.build ?? '',
    env: a.env,
    ring: a.ring,
    status: a.status,
  }
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
    resolution: r.resolution,
    resolutionKind: r.resolutionKind,
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
      // identityEndpoint (default "/api/me") is an ORIGIN-ABSOLUTE path (the host's session endpoint), NOT
      // under the walk `base`: fetch it directly so it never becomes "<base>/api/me" (a same-origin forwarder
      // base like "/api/walk" would otherwise turn it into "/api/walk/api/me" and 404 -> always unauthenticated).
      const res = await doFetch(identityUrl, { credentials: 'include' })
      const me = (await res.json().catch(() => ({}))) as { authenticated?: boolean; name?: string; displayName?: string; contactId?: string }
      if (!res.ok) return { authenticated: false }
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
    current: async (): Promise<WalkInProgress | null> => {
      // Read-only: the caller's in-progress walk for THIS catalogue. Never creates one (unlike /start), so
      // asking "do I have a walk under way?" never forks a walk. A missing/empty walkId -> nothing under way.
      const r = await getJson<CurrentResponse>(`/current?catalogueId=${encodeURIComponent(cfg.catalogueId)}`)
      const ip = r.inProgress
      if (!ip || !ip.walkId) return null
      return {
        walkId: ip.walkId,
        build: ip.build ?? '',
        env: ip.env ?? '',
        coverage: { walked: ip.coverage?.walked ?? 0, total: ip.coverage?.total ?? 0 },
        flagged: ip.flagged ?? 0,
      }
    },
    start: async (opts?: WalkStartOptions): Promise<WalkState> => {
      // Default: this adapter's own (current-build) catalogue. With opts (B2), launch a SPECIFIC assigned
      // walk: the assignment's catalogue/build/env/total override the adapter default, and assignmentId is
      // sent so the backend binds bp_WalkAssignmentId (B1) - the link that closes the loop. assignmentId is
      // included ONLY when present, so a plain current-build start is byte-for-byte the previous request.
      const r = await postJson<StartResponse>('/start', {
        cohortId: cfg.cohortId,
        catalogueId: opts?.catalogueId ?? cfg.catalogueId,
        build: opts?.build ?? cfg.build,
        env: opts?.env ?? cfg.env,
        total: opts?.total ?? cfg.total,
        ...(opts?.assignmentId ? { assignmentId: opts.assignmentId } : {}),
        // #155 slice 3: the walk's device platform, so its flags dedup per platform. Included ONLY when the
        // host set it, so a caller that does not pass platform sends a byte-for-byte previous request.
        ...(cfg.platform ? { platform: cfg.platform } : {}),
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
    // The tester's ASSIGNED walks (Slice 4c): the cohort's open assignments minus the completed ones. The
    // server enforces the cohort scope; this just maps the list. A missing/empty response -> no assignments.
    listAssigned: async (): Promise<WalkAssignmentSummary[]> => {
      const r = await getJson<{ assignments?: AssignmentResponse[] }>('/available')
      return (r.assignments ?? []).map(mapAssignment)
    },
  }
}
