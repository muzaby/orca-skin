import { describe, expect, it } from 'vitest'
import { buildSync } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

describe('OpenCode 1.x native CLI interoperability', () => {
  it.skipIf(!process.env.ORCA_TEST_OPENCODE_EXE)(
    'creates, migrates and reopens the same native ID with a terminal followup and unchanged native config',
    () => {
      const cwd = process.cwd()
      const req = createRequire(join(cwd, 'package.json'))
      mkdirSync(join(cwd, '.tmp'), { recursive: true })
      const output = mkdtempSync(join(cwd, '.tmp', 'native-cli-test-'))
      try {
        const file = join(output, 'fixture.cjs')
        buildSync({
          stdin: {
            contents:
              "import { runNativeStorageFixture } from './src/main/app/harnesses/opencode/native-storage.testfixture'; runNativeStorageFixture(fetch)",
            resolveDir: cwd,
            sourcefile: 'native-storage-runtime.test.ts',
            loader: 'ts'
          },
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
            timeout: 300000,
            maxBuffer: 4 * 1024 * 1024
          }).trim()
        )
        expect(result).toMatchObject({
          nativeIdPreserved: true,
          terminalFollowupImported: true,
          nativeConfigUnchanged: true,
          customXdgAndDatabase: true,
          auxiliarySessionRemoved: true,
          legacyMigratedAndTerminalResumed: true,
          externalModelRequests: 0
        })
        expect(result.modelRequests).toBeGreaterThan(0)
      } finally {
        rmSync(output, { recursive: true, force: true })
      }
    },
    330000
  )
})
