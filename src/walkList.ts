// The walk hub's To-do list shape, kept pure so it is testable without React. A tester can hold a dozen or
// more assigned walks across several builds; one flat list of "Start walk" rows was hard to scan (owner,
// 2026-10-06). So the list leads with the walk the tester already has under way, then groups the rest by
// build, newest build first; the hub folds older builds and shows each group a few rows at a time.

import type { WalkAssignmentSummary } from './walkTypes.js'

export interface WalkBuildGroup {
  build: string
  env?: string
  assignments: WalkAssignmentSummary[]
}

export interface WalkTodo {
  inProgress: WalkAssignmentSummary[]
  groups: WalkBuildGroup[]
}

/** Compare two Major.Minor.Patch.Build strings numerically, newest first. Non-numeric parts sort last. */
export function compareBuildsDesc(a: string, b: string): number {
  const pa = a.split('.').map((x) => Number.parseInt(x, 10)).map((n) => (Number.isFinite(n) ? n : -1))
  const pb = b.split('.').map((x) => Number.parseInt(x, 10)).map((n) => (Number.isFinite(n) ? n : -1))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? -1
    const y = pb[i] ?? -1
    if (x !== y) return y - x
  }
  return 0
}

/** Split the assigned walks into the ones under way and the rest grouped by build (newest first). */
export function groupAssignments(assigned: WalkAssignmentSummary[]): WalkTodo {
  const inProgress = assigned.filter((a) => a.status === 'in_progress')
  const byBuild = new Map<string, WalkBuildGroup>()
  for (const a of assigned) {
    if (a.status === 'in_progress') continue
    const g = byBuild.get(a.build) ?? { build: a.build, env: a.env, assignments: [] }
    g.assignments.push(a)
    byBuild.set(a.build, g)
  }
  const groups = [...byBuild.values()].sort((x, y) => compareBuildsDesc(x.build, y.build))
  return { inProgress, groups }
}
