import { describe, it, expect, vi, afterEach } from 'vitest'
import { join } from 'node:path'
import { toUnpackedPath, resolveBundledExecutable } from './claude-executable'

describe('toUnpackedPath', () => {
  it('app.asar 세그먼트를 app.asar.unpacked 로 리맵한다 (posix)', () => {
    expect(toUnpackedPath('/a/resources/app.asar/node_modules/x/claude')).toBe(
      '/a/resources/app.asar.unpacked/node_modules/x/claude'
    )
  })

  it('app.asar 세그먼트를 리맵한다 (win 백슬래시)', () => {
    expect(toUnpackedPath('C:\\a\\app.asar\\node_modules\\x\\claude.exe')).toBe(
      'C:\\a\\app.asar.unpacked\\node_modules\\x\\claude.exe'
    )
  })

  it('asar 를 안 담은 경로는 무변경', () => {
    expect(toUnpackedPath('/usr/local/bin/claude')).toBe('/usr/local/bin/claude')
  })
})

describe('resolveBundledExecutable', () => {
  const fakeRequire = (map: Record<string, string>): NodeRequire =>
    ({
      resolve: (spec: string): string => {
        const hit = map[spec]
        if (hit === undefined) throw new Error(`Cannot find module '${spec}'`)
        return hit
      }
    }) as unknown as NodeRequire

  it('asar 내부 해석 경로를 언팩 경로로 리맵한다 (win)', () => {
    const req = fakeRequire({
      '@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe':
        'C:\\app\\resources\\app.asar\\node_modules\\@anthropic-ai\\claude-agent-sdk-win32-x64\\claude.exe'
    })
    expect(resolveBundledExecutable(req, 'win32', 'x64')).toBe(
      'C:\\app\\resources\\app.asar.unpacked\\node_modules\\@anthropic-ai\\claude-agent-sdk-win32-x64\\claude.exe'
    )
  })

  it('비-asar(dev) 경로면 undefined 로 SDK 기본에 위임한다', () => {
    const req = fakeRequire({
      '@anthropic-ai/claude-agent-sdk-linux-x64/claude':
        '/repo/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude'
    })
    expect(resolveBundledExecutable(req, 'linux', 'x64')).toBeUndefined()
  })

  it('linux 는 glibc 실패 시 musl 변형을 시도한다', () => {
    const req = fakeRequire({
      '@anthropic-ai/claude-agent-sdk-linux-x64-musl/claude':
        '/a/app.asar/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64-musl/claude'
    })
    expect(resolveBundledExecutable(req, 'linux', 'x64')).toBe(
      '/a/app.asar.unpacked/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64-musl/claude'
    )
  })

  it('아무 변형도 해석 못 하면 undefined', () => {
    expect(resolveBundledExecutable(fakeRequire({}), 'win32', 'x64')).toBeUndefined()
  })
})

// AC35~AC37 (0215 ΔV4) — 해석 출처가 **번들 하나**임을 잠근다.
//
// 호스트 두 위치(PATH · ~/.local/bin)를 **존재시킨 채** 반환값을 본다. 그래야 해석 사슬을
// 0105 의 호스트-우선 순서로 되돌리는 변이가 red 가 된다 — 존재시키지 않으면 되돌려도
// 번들로 폴백해 조용히 통과한다.
describe('resolveClaudeExecutable — 번들 단일 출처', () => {
  const bin = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const HOME = process.platform === 'win32' ? 'C:\\Users\\u' : '/home/u'
  const PATH_DIR = process.platform === 'win32' ? 'C:\\tools' : '/opt/bin'
  const onPath = join(PATH_DIR, bin)
  const official = join(HOME, '.local', 'bin', bin)
  const specs = bundledSpecs()
  const origPath = process.env.PATH

  // 합성 함수는 인자 없이 process.platform/arch 를 그대로 탄다 — 후보 스펙도 같은 규칙으로 만든다.
  function bundledSpecs(): string[] {
    const pkg = '@anthropic-ai/claude-agent-sdk'
    const names =
      process.platform === 'linux'
        ? [`${pkg}-linux-${process.arch}`, `${pkg}-linux-${process.arch}-musl`]
        : [`${pkg}-${process.platform}-${process.arch}`]
    return names.map((n) => `${n}/${bin}`)
  }

  // 호스트 두 위치는 항상 존재한다고 답한다(변이 감지용). 번들 해석 결과만 인자로 바꾼다.
  const loadWith = async (resolved?: string): Promise<typeof import('./claude-executable')> => {
    vi.resetModules()
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p === onPath || p === official
    }))
    vi.doMock('node:os', () => ({ homedir: () => HOME }))
    vi.doMock('node:module', () => ({
      createRequire: () => ({
        resolve: (spec: string): string => {
          if (resolved !== undefined && specs.includes(spec)) return resolved
          throw new Error(`Cannot find module '${spec}'`)
        }
      })
    }))
    process.env.PATH = PATH_DIR
    return import('./claude-executable')
  }

  afterEach(() => {
    vi.doUnmock('node:fs')
    vi.doUnmock('node:os')
    vi.doUnmock('node:module')
    vi.resetModules()
    process.env.PATH = origPath
  })

  it('AC35 — 호스트 두 위치가 모두 있어도 그 경로를 고르지 않는다', async () => {
    const asar = join('C:\\app\\resources\\app.asar\\node_modules', 'x', bin)
    const mod = await loadWith(asar)
    const got = mod.resolveClaudeExecutable()
    expect(got).not.toBe(onPath)
    expect(got).not.toBe(official)
    expect(got).toBe(toUnpackedPath(asar))
  })

  it('AC36 — 패키징(asar)이면 app.asar.unpacked 경로를 돌려준다', async () => {
    const asar = '/a/resources/app.asar/node_modules/@anthropic-ai/x/claude'
    const mod = await loadWith(asar)
    const got = mod.resolveClaudeExecutable()
    expect(got).toContain('app.asar.unpacked')
    expect(got).not.toMatch(/[\\/]app\.asar[\\/]/)
  })

  it('AC37 — 비패키징(dev)이면 호스트가 있어도 undefined 로 SDK 기본에 위임한다', async () => {
    const mod = await loadWith('/repo/node_modules/@anthropic-ai/x/claude')
    expect(mod.resolveClaudeExecutable()).toBeUndefined()
  })

  it('AC37 — 번들 자체가 미해결이어도 호스트로 폴백하지 않는다', async () => {
    const mod = await loadWith(undefined)
    expect(mod.resolveClaudeExecutable()).toBeUndefined()
  })
})
