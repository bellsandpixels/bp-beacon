// The portal-backed WalkAdapter (T3 of the validation motion): the walk analog of createBeaconAdapter.
// It maps the WalkAdapter interface onto the client-portal walk API (the /api/walk/* endpoints), carrying
// the walk context (cohort / catalogue / build / env) internally and tracking the current walkId across
// start -> mark/flag/clear -> submit, so the interface methods stay minimal. Design-system-agnostic and
// backend-agnostic: the host supplies the endpoint (a same-origin forwarder, e.g. "/api/walk", or the
// portal URL directly) plus how the tester is authenticated (the portal magic-link). This is the ONE
// client implementation a portal-backed product wires once; the stub (createStubWalkAdapter) is for demos.
function mapSummary(r) {
    return {
        walkId: r.walkId ?? '',
        build: r.build ?? '',
        env: r.env ?? '',
        submittedOn: r.submittedOn,
        coverage: { walked: r.coverage?.walked ?? 0, total: r.coverage?.total ?? 0 },
        flagged: r.flagged ?? 0,
    };
}
function mapIssue(r) {
    return {
        id: r.id ?? '',
        reference: r.reference,
        checkRef: r.checkRef ?? 0,
        surfaceKey: r.surfaceKey,
        title: r.title ?? '',
        status: r.status ?? 'submitted',
        resolvedBuild: r.resolvedBuild,
        build: r.build ?? '',
    };
}
export function createWalkAdapter(cfg) {
    const doFetch = cfg.fetchImpl ?? fetch;
    const base = cfg.endpoint.replace(/\/$/, '');
    const identityUrl = cfg.identityEndpoint ?? '/api/me';
    let walkId;
    async function postJson(path, body) {
        const res = await doFetch(`${base}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({})));
        if (!res.ok)
            throw new Error(data.error || `Walk request failed (${res.status})`);
        return data;
    }
    async function getJson(path) {
        const res = await doFetch(`${base}${path}`, { credentials: 'include' });
        const data = (await res.json().catch(() => ({})));
        if (!res.ok)
            throw new Error(data.error || `Walk request failed (${res.status})`);
        return data;
    }
    function requireWalk() {
        if (!walkId)
            throw new Error('start() must be called before this walk action');
        return walkId;
    }
    async function identity() {
        if (cfg.resolveIdentity)
            return cfg.resolveIdentity();
        try {
            // identityEndpoint (default "/api/me") is an ORIGIN-ABSOLUTE path (the host's session endpoint), NOT
            // under the walk `base`: fetch it directly so it never becomes "<base>/api/me" (a same-origin forwarder
            // base like "/api/walk" would otherwise turn it into "/api/walk/api/me" and 404 -> always unauthenticated).
            const res = await doFetch(identityUrl, { credentials: 'include' });
            const me = (await res.json().catch(() => ({})));
            if (!res.ok)
                return { authenticated: false };
            const authenticated = me.authenticated ?? !!me.contactId;
            return { authenticated, name: authenticated ? (me.name ?? me.displayName) : undefined };
        }
        catch {
            return { authenticated: false };
        }
    }
    return {
        authenticate: async () => (cfg.authenticate ? cfg.authenticate() : identity()),
        identity,
        available: async () => {
            const id = await identity();
            if (!id.authenticated)
                return null;
            return { offered: true, build: cfg.build ?? '', env: cfg.env ?? '', catalogueId: cfg.catalogueId };
        },
        current: async () => {
            // Read-only: the caller's in-progress walk for THIS catalogue. Never creates one (unlike /start), so
            // asking "do I have a walk under way?" never forks a walk. A missing/empty walkId -> nothing under way.
            const r = await getJson(`/current?catalogueId=${encodeURIComponent(cfg.catalogueId)}`);
            const ip = r.inProgress;
            if (!ip || !ip.walkId)
                return null;
            return {
                walkId: ip.walkId,
                build: ip.build ?? '',
                env: ip.env ?? '',
                coverage: { walked: ip.coverage?.walked ?? 0, total: ip.coverage?.total ?? 0 },
                flagged: ip.flagged ?? 0,
            };
        },
        start: async () => {
            const r = await postJson('/start', {
                cohortId: cfg.cohortId,
                catalogueId: cfg.catalogueId,
                build: cfg.build,
                env: cfg.env,
                total: cfg.total,
            });
            walkId = r.walkId;
            return { walked: r.walked ?? {}, defects: r.defects ?? {} };
        },
        markWalked: async (surfaceKey, walked) => {
            await postJson('/mark', { walkId: requireWalk(), surfaceKey, walked });
        },
        flag: async ({ checkRef, note }) => {
            const r = await postJson('/flag', {
                walkId: requireWalk(),
                checkRef,
                note,
                title: cfg.titleForCheck?.(checkRef),
            });
            return { id: r.id ?? '', reference: r.reference ?? undefined };
        },
        clearFlag: async (checkRef) => {
            await postJson('/clear', { walkId: requireWalk(), checkRef });
        },
        submit: async () => {
            const r = await postJson('/submit', { walkId: requireWalk(), total: cfg.total });
            walkId = undefined;
            return mapSummary(r);
        },
        listMine: async () => {
            const r = await getJson('/mine');
            return (r.walks ?? []).map(mapSummary);
        },
        listMyIssues: async () => {
            const r = await getJson('/issues');
            return (r.issues ?? []).map(mapIssue);
        },
    };
}
