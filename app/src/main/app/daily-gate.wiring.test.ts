import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { stripCommentsAndStrings } from '../infra/source-scan'

const source = readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')
const code = stripCommentsAndStrings(source)

describe('bootstrap daily gate wiring', () => {
  it('starts the daily gate once and disposes it at shutdown', () => {
    expect(code.match(/\bstartDailyGate\s*\(/g)).toHaveLength(1)
    expect(code.match(/this\.dailyGate\?\.dispose\s*\(/g)).toHaveLength(1)
    const shutdown = code.slice(code.indexOf('shutdown(): void'))
    expect(shutdown).toContain('this.dailyGate?.dispose()')
    expect(shutdown.indexOf('this.dailyGate?.dispose()')).toBeLessThan(shutdown.indexOf('return'))
  })

  it.each([
    ['powerMonitor', 'resume'],
    ['powerMonitor', 'unlock-screen'],
    ['app', 'browser-window-focus']
  ])('registers and unregisters %s %s with the boundary check callback', (owner, event) => {
    for (const method of ['on', 'off']) {
      expect(
        source.match(new RegExp(`^\\s*${owner}\\.${method}\\('${event}', check\\)`, 'gm'))
      ).toHaveLength(1)
    }
  })

  it('connects the existing Auth change consumer to the live gate login recorder', () => {
    expect(code).toMatch(
      /recordGateLogin:\s*\(authId, revision\)\s*=>\s*gate\.noteLoginCommit\(authId, revision\)/
    )
  })
})
