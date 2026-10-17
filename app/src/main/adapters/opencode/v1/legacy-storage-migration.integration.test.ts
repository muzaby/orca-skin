import { describe, expect, it, vi } from 'vitest'
import { buildSync } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

vi.setConfig({ testTimeout: 120000, hookTimeout: 120000 })
describe('OpenCode legacy migration with the installed SQLite ABI', () => {
  it('preserves native rows/resources and rolls back interrupted writes without reinstalling SQLite', () => {
    const cwd = process.cwd()
    const req = createRequire(join(cwd, 'package.json'))
    mkdirSync(join(cwd, '.tmp'), { recursive: true })
    const output = mkdtempSync(join(cwd, '.tmp', 'native-migration-test-'))
    try {
      const file = join(output, 'fixture.cjs')
      buildSync({
        entryPoints: [
          join(cwd, 'src/main/adapters/opencode/v1/legacy-storage-migration.testfixture.ts')
        ],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        external: ['better-sqlite3'],
        outfile: file
      })
      let runtime = process.execPath
      const env = { ...process.env }
      try {
        execFileSync(runtime, ['-e', "require('better-sqlite3')(':memory:').close()"], {
          cwd,
          stdio: 'ignore',
          windowsHide: true
        })
      } catch {
        runtime = req('electron') as string
        env.ELECTRON_RUN_AS_NODE = '1'
      }
      const result = JSON.parse(
        execFileSync(runtime, [file], {
          cwd,
          env,
          encoding: 'utf8',
          windowsHide: true,
          timeout: 110000,
          maxBuffer: 4 * 1024 * 1024
        }).trim()
      ) as { checks: string[] }
      expect(result.checks).toEqual([
        'plain tree/todo/journal preserved; injected rollback; source unchanged; native deletion preserved',
        'schema/workdir/ambiguous source/active lock/identity conflicts preserve both databases',
        'partial marker write observes rollback and permits safe retry',
        'foreign-message part relation cannot contaminate an existing native session',
        'historical journal events survive after their projection rows were removed',
        'ambiguous committed marker never revives a deleted native session',
        'unfinished source is busy without target writes',
        'embedded legacy tool-output reference remains explicitly incomplete',
        'snapshot worktree mismatch is incomplete; conflict preserves native resource; verified Git object copied to native root'
      ])
    } finally {
      rmSync(output, { recursive: true, force: true })
    }
  })
})
