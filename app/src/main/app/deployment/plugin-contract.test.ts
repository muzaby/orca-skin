// ΔV2 — 플러그인 조립 계약 (0237 AC34·AC35·AC41·AC42·AC43).
//
// **음성 단독으로는 아무것도 잠기지 않는다.** "`bootstrap.ts` 에 mail 이 0건" 은 배선을 통째로
// 지워도 참이다(0198 D-010 과 같은 축). 그래서 이 파일의 음성 스윕마다 **같은 경로가 실제로
// 동작한다는 양성 단언**을 짝지었다 — 배포 fixture 가 3키만으로 서버 2개를 등록하고, 그 서버의
// 도구가 실제로 호출되며, 종료가 자원을 놓는다.

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { sourceFiles, stripCommentsAndStrings, toPosix } from '../../infra/source-scan'
import { RuntimeToolRegistry } from '../../features/extensions/runtime-tool-registry'
import { createPluginBinding, createPluginBindings } from './plugins'
import type { PluginBinding, PluginDeploymentDeps } from './plugins'
import type { AuthStatus, PluginAuth, PluginAuthBinder } from '../../contracts/auth'
import type { RuntimeToolServer } from '../../adapters/runtime-tools'

const MAIN_ROOT = join(__dirname, '..', '..')

// 주석만 걷는다 — 문자열 리터럴은 남긴다. import 지정자·SQL 식별자가 이 스윕의 대상이다.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

function pluginAuth(authId: string, origin: string, status: () => AuthStatus): PluginAuth {
  return {
    authId,
    origin,
    snapshot: () => ({
      authId,
      status: status(),
      verified: status() === 'valid',
      credentialRevision: 1
    }),
    request: () => Promise.reject(new Error('not used')),
    secret: () => `${authId}-user:${authId}-pass`,
    reportAuthFailure: () => undefined
  }
}

function server(id: string, disposed?: () => void): RuntimeToolServer {
  return {
    descriptor: { id, connectorId: id, tools: [{ name: 'do', description: 'd' }] },
    implementations: [
      {
        name: 'do',
        inputSchema: {},
        handler: async () => ({ content: [{ type: 'text' as const, text: id }] })
      }
    ],
    ...(disposed ? { dispose: disposed } : {})
  }
}

// Bootstrap 이 건네는 능력 그대로. **키가 셋이다** — 여기에 플러그인 이름이 등장하면 계약이
// 자란 것이다.
function deploymentDeps(registry: RuntimeToolRegistry): PluginDeploymentDeps {
  const binder: PluginAuthBinder = {
    bindForPlugin: (authId) => pluginAuth(authId, `https://${authId}.example.corp`, () => 'valid')
  }
  return { auth: binder, registry, logger: () => undefined }
}

describe('AC34 — 배포 계약 표면은 3키로 고정이다', () => {
  it('음성: PluginDeploymentDeps 에 플러그인 이름 슬롯이 없다', () => {
    const source = stripCommentsAndStrings(readFileSync(join(__dirname, 'plugins.ts'), 'utf8'))
    const block = source.slice(
      source.indexOf('interface PluginDeploymentDeps'),
      source.indexOf('createPluginBindings')
    )
    expect(block).not.toBe('')
    // 선언에 남아야 하는 키는 셋뿐이다.
    const keys = [...block.matchAll(/^\s{2}(\w+)\??:/gm)].map((match) => match[1])
    expect(keys.sort()).toEqual(['auth', 'logger', 'registry'])
    for (const name of ['mail', 'confluence', 'jira', 'pop3', 'socketFactory', 'password']) {
      expect(block.toLowerCase()).not.toContain(name.toLowerCase())
    }
  })

  it('양성: 그 3키만으로 서버 2개가 실제로 등록되고 도구가 호출된다', async () => {
    const registry = new RuntimeToolRegistry()
    const deps = deploymentDeps(registry)
    // 폐쇄망 배포가 쓰는 형태 — 파라미터가 아니라 **행**을 더한다.
    const bindings: PluginBinding[] = ['mail', 'confluence'].map((id) => {
      const auth = deps.auth.bindForPlugin(id)
      return createPluginBinding({ auth, server: server(id), registry: deps.registry })
    })
    for (const binding of bindings) binding.sync()

    const snapshot = registry.snapshot()
    expect([...snapshot.servers.keys()].sort()).toEqual(['confluence', 'mail'])
    const mail = snapshot.servers.get('mail')
    const called = await mail?.implementations[0].handler({})
    expect(called?.content[0]).toEqual({ type: 'text', text: 'mail' })
  })

  it('기본 배포는 binding 이 없다 (D-030)', () => {
    expect(createPluginBindings(deploymentDeps(new RuntimeToolRegistry()))).toEqual([])
  })
})

describe('AC35 — 컴포지션 루트는 플러그인을 모른다', () => {
  it('음성: bootstrap.ts 에 mail·pop3 식별자와 소켓 import 가 없다', () => {
    const source = stripCommentsAndStrings(
      readFileSync(join(MAIN_ROOT, 'app/bootstrap.ts'), 'utf8')
    )
    expect(source).not.toMatch(/\bmail/i)
    expect(source).not.toMatch(/\bpop3/i)
    expect(source).not.toContain('createPop3Socket')
  })

  it('음성: deployment/plugins.ts 도 특정 플러그인 모듈을 import 하지 않는다', () => {
    const source = stripCommentsAndStrings(readFileSync(join(__dirname, 'plugins.ts'), 'utf8'))
    expect(source).not.toContain('features/plugins/')
  })
})

describe('AC41 — 플러그인 자원은 bindForPlugin 하나로 들어온다', () => {
  it('양성: secret() 과 reportAuthFailure() 가 binding 을 통해 도달한다', () => {
    const registry = new RuntimeToolRegistry()
    let status: AuthStatus = 'valid'
    const reported: string[] = []
    const auth: PluginAuth = {
      ...pluginAuth('mail', 'pop3s://pop.example.corp:995', () => status),
      reportAuthFailure: () => reported.push('mail')
    }
    const binding = createPluginBinding({ auth, server: server('mail'), registry })
    binding.sync()
    expect(registry.snapshot().servers.size).toBe(1)

    // 전송이 자격증명 거부를 관측하면 강등을 보고하고, 다음 sync 가 도구를 회수한다.
    expect(auth.secret()).toBe('mail-user:mail-pass')
    auth.reportAuthFailure()
    status = 'expired'
    binding.sync()
    expect(reported).toEqual(['mail'])
    expect(registry.snapshot().servers.size).toBe(0)
    // 회수돼도 카탈로그 이름은 남는다 (0188 D-024).
    expect(binding.toolNames()).toHaveLength(1)
  })

  it('음성: AuthBinder 로는 bindForPlugin 에 도달하지 못한다', () => {
    const source = readFileSync(join(MAIN_ROOT, 'contracts/auth.ts'), 'utf8')
    expect(source).toContain("export type AuthBinder = Pick<AuthRuntime, 'bind'>")
    expect(source).toContain("export type PluginAuthBinder = Pick<AuthRuntime, 'bindForPlugin'>")
    // Harness·Usage·Connections 배포 factory 는 좁은 쪽을 받는다.
    for (const file of ['harness-runtime.ts', 'usage-fetcher.ts', 'connections.ts']) {
      const deps = stripCommentsAndStrings(readFileSync(join(__dirname, file), 'utf8'))
      expect(deps).toContain('AuthBinder')
      expect(deps).not.toContain('PluginAuthBinder')
    }
  })
})

describe('AC42·AC43 — 두 번째 SQLite 와 데이터 루트는 infra 가 소유한다', () => {
  it('음성: mail 슬라이스가 better-sqlite3 와 _migrations 를 직접 들지 않는다', () => {
    // **`stripCommentsAndStrings` 를 쓰지 않는다.** 그 헬퍼는 문자열 리터럴까지 지우는데,
    // 여기서 찾으려는 것(`from 'better-sqlite3'` · `CREATE TABLE … _migrations`)이 바로
    // 문자열 리터럴이다 — 쓰면 스윕이 **자기가 검사한다고 말한 것을 못 본다**(적대 검사에서
    // 실제로 침묵했다). 대신 주석만 걷어낸다.
    const offenders = sourceFiles(join(MAIN_ROOT, 'features/plugins/mail')).filter((file) => {
      const source = stripComments(readFileSync(file, 'utf8'))
      return /from\s+['"]better-sqlite3['"]/.test(source) || source.includes('_migrations')
    })
    expect(offenders.map((file) => toPosix(relative(MAIN_ROOT, file)))).toEqual([])
  })

  it('양성: Core DB 도 같은 여는 함수를 통과한다', () => {
    const core = stripCommentsAndStrings(readFileSync(join(MAIN_ROOT, 'infra/db/index.ts'), 'utf8'))
    expect(core).toContain('openSqliteConnection')
    expect(core).not.toContain('new Database(')
    const migrate = stripCommentsAndStrings(
      readFileSync(join(MAIN_ROOT, 'infra/db/migrate.ts'), 'utf8')
    )
    expect(migrate).toContain('applySqliteMigrations')
  })

  it('음성: 배포 계약·도구 옵션 어디에도 root 키가 없다', () => {
    const types = stripCommentsAndStrings(
      readFileSync(join(MAIN_ROOT, 'features/plugins/mail/types.ts'), 'utf8')
    )
    expect(types).not.toMatch(/readonly root\??:/)
    const tools = stripCommentsAndStrings(
      readFileSync(join(MAIN_ROOT, 'features/plugins/mail/tools.ts'), 'utf8')
    )
    expect(tools).not.toMatch(/readonly root\??:/)
  })
})

describe('AC45 — 종료가 자원을 놓고, 강등은 놓지 않는다', () => {
  it('dispose 는 서버의 dispose 까지 부르고 registry 에서 뺀다', () => {
    const registry = new RuntimeToolRegistry()
    const disposed = vi.fn()
    const binding = createPluginBinding({
      auth: pluginAuth('mail', 'pop3s://pop.example.corp:995', () => 'valid'),
      server: server('mail', disposed),
      registry
    })
    binding.sync()
    expect(registry.snapshot().servers.size).toBe(1)
    binding.dispose()
    expect(disposed).toHaveBeenCalledOnce()
    expect(registry.snapshot().servers.size).toBe(0)
  })

  it('Auth 강등(sync)은 dispose 를 부르지 않는다 — 재인증 1회로 돌아온다', () => {
    const registry = new RuntimeToolRegistry()
    const disposed = vi.fn()
    let status: AuthStatus = 'valid'
    const binding = createPluginBinding({
      auth: pluginAuth('mail', 'pop3s://pop.example.corp:995', () => status),
      server: server('mail', disposed),
      registry
    })
    binding.sync()
    status = 'expired'
    binding.sync()
    expect(disposed).not.toHaveBeenCalled()
    expect(registry.snapshot().servers.size).toBe(0)
    // 재인증하면 **같은 handler identity** 가 그대로 돌아온다 — 그것이 다음 턴의 런타임
    // 재spawn 을 막는 불변식이다. (registry 는 `copyServer` 로 descriptor·implementations 만
    // 복사하므로 객체 동일성이 아니라 handler 동일성으로 본다.)
    status = 'valid'
    binding.sync()
    expect(registry.snapshot().servers.get('mail')?.implementations[0].handler).toBe(
      binding.server.implementations[0].handler
    )
  })
})
