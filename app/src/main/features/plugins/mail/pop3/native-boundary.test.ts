import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { scanOffenders } from '../../../../infra/source-scan'

const MAIN_ROOT = join(__dirname, '..', '..', '..', '..')
const ALLOWED = new Set(['pop3-socket.ts'])
const RAW_SOCKET_IMPORT = /from\s+['"]node:(?:net|tls)['"]/

describe('POP3 native boundary', () => {
  it('node:net/node:tls imports are isolated to infra/net/pop3-socket.ts', () => {
    const offenders = scanOffenders(MAIN_ROOT, (source) => RAW_SOCKET_IMPORT.test(source), ALLOWED)
    expect(offenders).toEqual([])
  })

  it('the allowed boundary contains both native transports', () => {
    const source = readFileSync(join(MAIN_ROOT, 'infra/net/pop3-socket.ts'), 'utf8')
    expect(source).toMatch(/node:net/)
    expect(source).toMatch(/node:tls/)
  })

  it('the protocol allowlist never admits DELE', () => {
    const source = readFileSync(join(MAIN_ROOT, 'infra/net/pop3-session.ts'), 'utf8')
    const declaration = source.match(/const ALLOWED_COMMANDS = new Set\(\[([^\]]+)\]\)/)?.[1]
    expect(declaration).toBeDefined()
    expect(declaration).not.toMatch(/['"]DELE['"]/)
  })
})
