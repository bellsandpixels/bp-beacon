#!/usr/bin/env node
// Keep the committed dist/ honest (cp-beacon-ci-dist-sync). Consumers import dist/ as plain JS with no build step
// (toudai and fudemoji through a submodule, client-portal through a copy), so a src/ change merged without a
// rebuilt dist/ ships nothing, silently. This rebuilds src/ into a scratch directory with the repo's own tsconfig
// and compares it to the committed dist/ file by file, with line endings normalized (Windows tsc writes CRLF, the
// repo stores LF, and that is not a content change). It fails on a content diff, a file missing from dist/, or a
// stale file left in dist/ that the build no longer emits.
//
// Usage: node scripts/check-dist.mjs        (exit 0 in sync, 1 out of sync, 2 build error)
// No em dashes (house rule).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const rel = (base, p) => relative(base, p).split(sep).join('/')
const normalize = (s) => s.replace(/\r\n/g, '\n')

const scratch = mkdtempSync(join(tmpdir(), 'beacon-dist-'))
try {
  try {
    const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
    execFileSync(process.execPath, [tsc, '-p', join(root, 'tsconfig.json'), '--outDir', scratch], { stdio: 'inherit' })
  } catch {
    console.error('check-dist: the build failed, so dist/ cannot be verified.')
    process.exit(2)
  }

  const built = new Map(walk(scratch).map((p) => [rel(scratch, p), p]))
  const committed = new Map(walk(dist).map((p) => [rel(dist, p), p]))
  const problems = []
  for (const [file, p] of built) {
    const mine = committed.get(file)
    if (!mine) problems.push(`missing from dist/: ${file}`)
    else if (normalize(readFileSync(p, 'utf8')) !== normalize(readFileSync(mine, 'utf8'))) problems.push(`stale in dist/: ${file}`)
  }
  for (const file of committed.keys()) if (!built.has(file)) problems.push(`not emitted by the build (delete it): dist/${file}`)

  if (problems.length) {
    console.error(`check-dist: FAIL. dist/ is out of sync with src/ (${problems.length}):`)
    for (const p of problems) console.error(`  ${p}`)
    console.error('Fix: npm run build, then commit only the dist/ files whose content changed.')
    process.exit(1)
  }
  console.log(`check-dist: dist/ is in sync with src/ (${built.size} files).`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
