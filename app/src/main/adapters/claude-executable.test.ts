import { describe, it, expect, vi, afterEach } from 'vitest'
import { join } from 'node:path'
import {
  toUnpackedPath,
  findOnPath,
  officialInstallPath,
  resolveBundledExecutable
} from './claude-executable'

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

describe('findOnPath', () => {
  it('PATH 디렉토리에서 claude 실행 파일을 찾는다 (posix)', () => {
    const exists = (p: string): boolean => p === '/opt/bin/claude'
    const env = { PATH: '/usr/bin:/opt/bin' } as NodeJS.ProcessEnv
    expect(findOnPath(env, 'linux', exists)).toBe('/opt/bin/claude')
  })

  it('win 은 claude.exe 를 세미콜론 구분자로 찾는다', () => {
    // join 의 구분자는 호스트(Node) 소관 — 여기서 검증하는 건 파일명(.exe)과 PATH 분리자(;).
    const target = join('C:\\tools', 'claude.exe')
    const exists = (p: string): boolean => p === target
    const env = { PATH: 'C:\\sys;C:\\tools' } as NodeJS.ProcessEnv
    expect(findOnPath(env, 'win32', exists)).toBe(target)
  })

  it('없으면 undefined', () => {
    const env = { PATH: '/usr/bin' } as NodeJS.ProcessEnv
    expect(findOnPath(env, 'linux', () => false)).toBeUndefined()
  })

  it('PATH 미설정이면 undefined', () => {
    expect(findOnPath({} as NodeJS.ProcessEnv, 'linux', () => true)).toBeUndefined()
  })
})

describe('officialInstallPath', () => {
  it('~/.local/bin/claude 존재 시 그 경로 (posix)', () => {
    const exists = (p: string): boolean => p === '/home/u/.local/bin/claude'
    expect(officialInstallPath('linux', '/home/u', exists)).toBe('/home/u/.local/bin/claude')
  })

  it('~/.local/bin/claude.exe 존재 시 그 경로 (win)', () => {
    const target = join('C:\\Users\\u', '.local', 'bin', 'claude.exe')
    const exists = (p: string): boolean => p === target
    expect(officialInstallPath('win32', 'C:\\Users\\u', exists)).toBe(target)
  })

  it('없으면 undefined', () => {
    expect(officialInstallPath('linux', '/home/u', () => false)).toBeUndefined()
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

describe('resolveClaudeExecutable 우선순위', () => {
  // node:fs/os 를 주입해 PATH·공식 위치를 동시에 만족시켜도 PATH 가 이기는지(순서) 검증.
  const origPath = process.env.PATH
  const loadWith = async (opts: {
    exists: (p: string) => boolean
    home: string
    path: string
  }): Promise<typeof import('./claude-executable')> => {
    vi.resetModules()
    vi.doMock('node:fs', () => ({ existsSync: opts.exists }))
    vi.doMock('node:os', () => ({ homedir: () => opts.home }))
    process.env.PATH = opts.path
    return import('./claude-executable')
  }

  afterEach(() => {
    vi.doUnmock('node:fs')
    vi.doUnmock('node:os')
    vi.resetModules()
    process.env.PATH = origPath
  })

  it('PATH 와 공식 위치가 둘 다 있으면 PATH 를 먼저 쓴다', async () => {
    const onPath = '/opt/bin/claude'
    const official = '/home/u/.local/bin/claude'
    const mod = await loadWith({
      exists: (p) => p === onPath || p === official,
      home: '/home/u',
      path: '/opt/bin'
    })
    expect(mod.resolveClaudeExecutable()).toBe(onPath)
  })

  it('PATH 미해결 시 공식 위치로 폴백한다', async () => {
    const official = '/home/u/.local/bin/claude'
    const mod = await loadWith({
      exists: (p) => p === official,
      home: '/home/u',
      path: '/opt/bin'
    })
    expect(mod.resolveClaudeExecutable()).toBe(official)
  })

  it('PATH·공식 모두 미해결이면 undefined(테스트 환경 = native pkg 미설치)로 SDK 기본에 위임', async () => {
    const mod = await loadWith({ exists: () => false, home: '/home/u', path: '/opt/bin' })
    expect(mod.resolveClaudeExecutable()).toBeUndefined()
  })
})
