// 0291 — 가이드 §4 레시피(로그인 프리 OpenCode 연결)를 그대로 옮긴 가상 배포의 종단 검증.
//
// production 조립이 주입하는 것(`loginFreeHost`·augmenter·`parseHarnessRuntimeModels`·실제
// settings loader)을 빼지 않는다. 호스트 OpenCode 만 fake `HostHarnessPort` 로 바꾼다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { HostHarnessPort, HarnessListedModel } from '../../adapters/common/harness-config'
import type { LoginFreeDefinition } from '../../contracts/auth'
import type { RuntimeConfigAugmenters } from '../../features/harnesses/common/runtime-config'
import type { RuntimeModelContribution } from '../../features/harnesses/common/runtime-catalog'
import { CHANNELS } from '../../../shared/protocol'

const callbacks = vi.hoisted(() => new Map<string, () => unknown>())
const reported = vi.hoisted(() => vi.fn())

vi.mock('../../infra/ipc/handle', () => ({
  handle: vi.fn(),
  handlePlain: vi.fn((channel: string, callback: () => unknown) => callbacks.set(channel, callback))
}))
vi.mock('../../infra/ipc/send', () => ({
  sendInstallStatus: vi.fn(),
  setWireLog: vi.fn(),
  sendChatEvent: vi.fn()
}))
vi.mock('../../infra/ipc/wire-log', () => ({ setWireSink: vi.fn() }))
vi.mock('../../infra/error-report', () => ({ reportError: reported }))
vi.mock('../../infra/config/orca-config', () => ({ getOrcaConfig: () => ({}), appEnv: () => ({}) }))

const { createAuthRuntime } = await import('../../features/auth/runtime')
const { createMemoryGrantPersistence } = await import('../../features/auth/store')
const { createVault } = await import('../../infra/vault')
const { createHarnessRuntimeConfigService } =
  await import('../../features/harnesses/common/runtime-config')
const { createRuntimeModelCatalog, createRuntimeModelCatalogBridge } =
  await import('../../features/harnesses/common/runtime-catalog')
const { HarnessSettingsService } = await import('../../features/harnesses/common/settings')
const { listedModelsOf, runtimeModelsFromListing } =
  await import('../../features/harnesses/common/runtime-listing')
const { loadOpenCodeProviderSettings } = await import('../../adapters/opencode')
const { openCodeCatalog } = await import('../../adapters/opencode/v1/catalog')
const { parseHarnessRuntimeModels, parseHarnessSettingsModels } =
  await import('../harnesses/registry')
const startup = await import('../runtime-model-startup')
const { registerMiscHandlers } = await import('../handlers/misc')
const { resolveTurnProvider } = await import('../chat-turn/resolve-turn')
const { connectionList } = await import('../connection-views')
const { harnessRows } = await import('./connections')
const { stripCommentsAndStrings } = await import('../../infra/source-scan')
type HarnessConfigApiDeps = import('./harness-runtime').HarnessConfigApiDeps
type ConnectionDeploymentDeps = import('./connections').ConnectionDeploymentDeps
type ConnectionViewSource = import('../connection-views').ConnectionViewSource

// ── 가이드 §4 레시피 (문서 예제와 같은 코드) ─────────────────────────────────────
const OPENCODE_LLM: LoginFreeDefinition = {
  id: 'opencode-llm',
  label: 'OpenCode LLM',
  connect: {
    async run({ host, signal }) {
      const installed = await host.installed('opencode')
      if (!installed.installed) throw new Error('OpenCode가 설치되어 있지 않습니다.')
      const models = await host.listModels('opencode', 'corp', { signal })
      if (models.length === 0) throw new Error('corp provider 에 사용할 모델이 없습니다.')
      return models
    }
  }
}
const OPENCODE_CORP_KEY = 'opencode-corp'
const CONTRIBUTIONS: readonly RuntimeModelContribution[] = [
  {
    authId: OPENCODE_LLM.id,
    key: OPENCODE_CORP_KEY,
    harnessId: 'opencode',
    modelProviderId: 'corp'
  }
]
function createConfigApiAugmenters(deps: HarnessConfigApiDeps): RuntimeConfigAugmenters {
  return {
    [OPENCODE_CORP_KEY]: {
      async resolve() {
        const listing = listedModelsOf(deps.auth.connectionValue(OPENCODE_LLM.id))
        if (!listing) throw new Error('OpenCode 연결 결과가 없습니다.')
        return { runtimeEnv: {}, ...runtimeModelsFromListing(listing) }
      }
    }
  }
}
function connectionRows(deps: ConnectionDeploymentDeps): ConnectionViewSource[] {
  return harnessRows([
    {
      auth: deps.auth.bindLoginFreePlugin(OPENCODE_LLM.id),
      harnessModelProviderKey: OPENCODE_CORP_KEY,
      catalog: { icon: 'memory', title: { ko: 'OpenCode LLM', en: 'OpenCode LLM' } }
    }
  ])
}
// ────────────────────────────────────────────────────────────────────────────

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
beforeEach(() => {
  callbacks.clear()
  reported.mockClear()
})

interface AgentRow {
  key: string
  source?: string
  readOnly?: boolean
  models: Array<{ model: string | null; alias: string; variants?: string[] }>
  agents?: Array<{ name: string }>
  catalogError?: string
}

interface BootedApp {
  auth: import('../../contracts/auth').AuthRuntime
  catalog: import('../../features/harnesses/common/runtime-catalog').RuntimeModelCatalog
  augment: ReturnType<typeof vi.fn>
  start: () => Promise<void>
  agentList: () => Promise<AgentRow[]>
  row: () => import('../../../shared/ipc').ProviderInfo
  turn: (modelFamily: string) => ReturnType<typeof resolveTurnProvider>
}

function boot(host: HostHarnessPort): BootedApp {
  const root = mkdtempSync(join(tmpdir(), 'orca-0291-'))
  roots.push(root)
  const raw = new Map<string, string>()
  const { runtime: auth } = createAuthRuntime({
    definitions: [],
    loginFreeDefinitions: [OPENCODE_LLM],
    persistence: createMemoryGrantPersistence(),
    vault: createVault({
      get: (key) => raw.get(key),
      set: (key, value) => void raw.set(key, value),
      delete: (key) => void raw.delete(key)
    }),
    fetchImpl: vi.fn<typeof fetch>(),
    loginFreeHost: host
  })
  const augmenters = createConfigApiAugmenters({ auth })
  const augment = vi.spyOn(augmenters[OPENCODE_CORP_KEY]!, 'resolve')
  const settings = new HarnessSettingsService(
    { opencode: loadOpenCodeProviderSettings },
    root,
    parseHarnessSettingsModels
  )
  const harnessRuntime = createHarnessRuntimeConfigService({ settings, augmenters })
  const snapshotOf = startup.createRuntimeModelSnapshotReader(auth)
  const bridge = createRuntimeModelCatalogBridge({ contributions: CONTRIBUTIONS, snapshotOf })
  const reconcile = startup.createRuntimeModelReconcileSnapshot(bridge)
  const catalog = createRuntimeModelCatalog({
    parseModels: parseHarnessRuntimeModels,
    contributions: CONTRIBUTIONS,
    runtime: harnessRuntime,
    snapshotOf
  })
  const invalidateForAuth = startup.createRuntimeModelAuthInvalidator({
    invalidatedKeys: {},
    contributions: CONTRIBUTIONS,
    invalidate: (key) => harnessRuntime.invalidate(key, 'auth-change'),
    snapshotOf,
    reconcile
  })
  const connections = connectionRows({ auth, gateMembers: [], plugins: [] })
  const adapter = {
    catalog: async (entry: never, config: Record<string, unknown>) =>
      openCodeCatalog(entry, config),
    agentSpawnEnv: () => ({})
  }
  registerMiscHandlers({
    registry: {
      list: () => [{ id: 'claude' }, { id: 'opencode' }],
      get: (id: string) => (id === 'opencode' ? adapter : null)
    },
    harnessSettings: settings,
    runtimeModelCatalog: catalog,
    harnessRuntime,
    debugMock: { log: false },
    mcp: { resolver: () => () => undefined }
  } as never)
  const start = (): Promise<void> =>
    startup.startRuntimeModelCatalogAfterDeploy({
      invalidateSettings: () => settings.invalidateAll(),
      invalidateRuntime: () => harnessRuntime.invalidate(undefined, 'settings-deploy'),
      catalog,
      bridge,
      resumeAuth: startup.createRuntimeModelAuthResume({
        auth,
        onChange: startup.createRuntimeModelAuthChangeHandler({
          recordGateLogin: () => undefined,
          pushConnectionState: () => undefined,
          syncPlugins: () => undefined,
          invalidateForAuth,
          reconcileSnapshot: reconcile
        }),
        onGateChange: () => undefined,
        run: () => void auth.connectAll()
      })
    })
  const agentList = async (): Promise<AgentRow[]> =>
    (await callbacks.get(CHANNELS.agentList)!()) as AgentRow[]
  const row = (): import('../../../shared/ipc').ProviderInfo =>
    connectionList(auth, connections)[0]!
  const turn = (modelFamily: string): ReturnType<typeof resolveTurnProvider> =>
    resolveTurnProvider(
      {
        harnessSettings: settings,
        runtimeModelCatalog: catalog,
        harnessRuntime,
        db: { getSessionById: () => undefined },
        mcp: { resolver: () => () => undefined }
      } as never,
      {
        adapter: { id: 'opencode', ...adapter } as never,
        agentKind: 'code',
        sessionId: null,
        providerKey: OPENCODE_CORP_KEY,
        modelFamily
      }
    )
  return {
    auth,
    catalog,
    augment: augment as unknown as BootedApp['augment'],
    start,
    agentList,
    row,
    turn
  }
}

function fakeHost(models: () => HarnessListedModel[], installed = true): HostHarnessPort {
  return {
    installed: vi.fn(async () => ({ installed })),
    listModels: vi.fn(async () => models())
  }
}

const MODELS: HarnessListedModel[] = [
  { id: 'corp/gpt-x', name: 'GPT X', variants: ['high'] },
  { id: 'corp/mini' }
]

describe('OpenCode login-free connection deployment (0291 AT-02)', () => {
  it('연결 성공은 초록 행·읽기 전용 OpenCode 카드·턴 모델로 이어진다', async () => {
    const host = fakeHost(() => MODELS)
    const app = boot(host)
    await app.start()
    await vi.waitFor(() => expect(app.row().connection?.state).toBe('connected'))
    expect(app.row()).toMatchObject({ status: 'valid', kind: 'llm', authScheme: 'login-free' })
    expect(host.listModels).toHaveBeenCalledWith('opencode', 'corp', expect.anything())
    await vi.waitFor(() => expect(app.catalog.list()).toHaveLength(1))
    const rows = await app.agentList()
    const card = rows.find((entry) => entry.key === OPENCODE_CORP_KEY)!
    expect(card).toMatchObject({ source: 'runtime', readOnly: true })
    expect(card.catalogError).toBeUndefined()
    expect(card.models.map((model) => [model.model, model.alias, model.variants])).toEqual([
      ['corp/gpt-x', 'GPT X', ['high']],
      ['corp/mini', 'mini', []]
    ])
    expect(card.agents).toEqual([{ name: 'build' }, { name: 'plan' }])
    const resolved = await app.turn('corp/mini')
    expect(resolved).toMatchObject({ providerKey: OPENCODE_CORP_KEY, model: 'corp/mini' })
    // settings.json 없는 runtime 키는 설정 오류 보고를 내지 않는다(EP-07).
    expect(reported).not.toHaveBeenCalled()
  })

  it('설치되지 않은 호스트는 빨간 행이고 카드가 없다', async () => {
    const host = fakeHost(() => MODELS, false)
    const app = boot(host)
    await app.start()
    await vi.waitFor(() => expect(app.row().connection?.state).toBe('failed'))
    expect(app.row()).toMatchObject({
      status: 'none',
      connection: { state: 'failed', message: 'OpenCode가 설치되어 있지 않습니다.' }
    })
    expect(host.listModels).not.toHaveBeenCalled()
    expect(app.catalog.list()).toEqual([])
    expect((await app.agentList()).some((entry) => entry.key === OPENCODE_CORP_KEY)).toBe(false)
  })

  it('부팅 직후 확인 전에는 카드가 없고 확인이 끝나면 생긴다', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const host: HostHarnessPort = {
      installed: async () => ({ installed: true }),
      listModels: async () => {
        await gate
        return MODELS
      }
    }
    const app = boot(host)
    expect(app.row().connection).toEqual({ state: 'idle', message: null })
    await app.start()
    await vi.waitFor(() => expect(app.row().connection?.state).toBe('checking'))
    expect(app.catalog.list()).toEqual([])
    release()
    await vi.waitFor(() => expect(app.catalog.list()).toHaveLength(1))
  })

  it('같은 결과의 재연결은 augmenter를 다시 부르지 않는다', async () => {
    const app = boot(fakeHost(() => MODELS.map((model) => ({ ...model }))))
    await app.start()
    await vi.waitFor(() => expect(app.catalog.list()).toHaveLength(1))
    expect(app.augment).toHaveBeenCalledTimes(1)
    const pending = app.auth.connect(OPENCODE_LLM.id)
    // 재연결 확인 중에도 카드는 유지된다.
    expect(app.catalog.list()).toHaveLength(1)
    await pending
    await vi.waitFor(() => expect(app.row().connection?.state).toBe('connected'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(app.catalog.list()).toHaveLength(1)
    expect(app.augment).toHaveBeenCalledTimes(1)
  })

  it('다른 결과는 카드 모델을 교체하고 실패는 카드를 지운다', async () => {
    let models: HarnessListedModel[] = MODELS
    let fail = false
    const host: HostHarnessPort = {
      installed: async () => ({ installed: true }),
      listModels: async () => {
        if (fail) throw new Error('Provider not found: corp')
        return models
      }
    }
    const app = boot(host)
    await app.start()
    await vi.waitFor(() => expect(app.catalog.list()).toHaveLength(1))
    models = [{ id: 'corp/new', name: '새 모델' }]
    await app.auth.connect(OPENCODE_LLM.id)
    await vi.waitFor(() =>
      expect(app.catalog.list()[0]?.models.map((model) => model.model)).toEqual(['corp/new'])
    )
    expect(app.augment).toHaveBeenCalledTimes(2)
    fail = true
    await app.auth.connect(OPENCODE_LLM.id)
    await vi.waitFor(() => expect(app.catalog.list()).toEqual([]))
    expect(app.row()).toMatchObject({
      status: 'none',
      connection: { state: 'failed', message: 'Provider not found: corp' }
    })
  })
})

// ── Bootstrap 배선 가드 (EP-08 ③ · EP-14 ①) ────────────────────────────────────
// 호출의 객체 인자에서 이름 붙은 속성 값을 꺼낸다. 주석·문자열·import 는 배선이 아니다.
function callBodies(source: string, callee: string): string[] {
  const stripped = stripCommentsAndStrings(source)
  return [...stripped.matchAll(new RegExp(`${callee}\\s*\\(\\s*\\{`, 'g'))].map((match) => {
    const start = match.index! + match[0].length
    let depth = 1
    let end = start
    for (; end < stripped.length && depth > 0; end++) {
      if (stripped[end] === '{') depth++
      if (stripped[end] === '}') depth--
    }
    return stripped.slice(start, end - 1)
  })
}
function runCallbackBody(source: string): string | null {
  for (const body of callBodies(source, 'createRuntimeModelAuthResume')) {
    const match = /\brun\s*:\s*\(\s*\)\s*=>\s*\{/.exec(body)
    if (!match) continue
    let depth = 1
    let end = match.index + match[0].length
    for (; end < body.length && depth > 0; end++) {
      if (body[end] === '{') depth++
      if (body[end] === '}') depth--
    }
    return body.slice(match.index + match[0].length, end - 1)
  }
  return null
}
const CONNECT_ALL = /\bvoid\s+auth\.connectAll\s*\(\s*\)/
const HOST_ARG = /\bloginFreeHost\s*:\s*createHostHarnessPort\s*\(\s*this\.registry\s*\)/
const bootstrapSource = (): string => readFileSync(join(__dirname, '..', 'bootstrap.ts'), 'utf8')

describe('Bootstrap 로그인 프리 연결 배선 (0291 AC16)', () => {
  it('Bootstrap run 콜백이 리스너 설치 뒤 connectAll을 부른다', () => {
    const body = runCallbackBody(bootstrapSource())
    expect(body).not.toBeNull()
    expect(body).toMatch(CONNECT_ALL)
    expect(body).toMatch(/\bauthResume\.run\s*\(\s*\)/)
  })

  it('createAuthRuntime 호출은 서버 시작과 같은 호스트 능력을 넘긴다', () => {
    const calls = callBodies(bootstrapSource(), 'createAuthRuntime')
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) expect(call).toMatch(HOST_ARG)
  })

  it('가드는 누락·빈 함수·주석·문자열을 배선으로 세지 않는다', () => {
    const wrap = (run: string): string =>
      `createRuntimeModelAuthResume({ auth, run: () => { ${run} } })`
    expect(runCallbackBody(wrap('void authResume.run(); void auth.connectAll()'))).toMatch(
      CONNECT_ALL
    )
    for (const source of [
      wrap('void authResume.run()'),
      wrap(''),
      wrap('void authResume.run() /* void auth.connectAll() */'),
      wrap("void authResume.run(); log('void auth.connectAll()')"),
      'createRuntimeModelAuthResume({ auth, run: () => void authResume.run() }); void auth.connectAll()'
    ]) {
      expect(runCallbackBody(source) ?? '').not.toMatch(CONNECT_ALL)
    }
    expect(
      callBodies(
        'createAuthRuntime({ loginFreeHost: createHostHarnessPort(this.registry) })',
        'createAuthRuntime'
      )[0]
    ).toMatch(HOST_ARG)
    for (const source of [
      'createAuthRuntime({ definitions })',
      'createAuthRuntime({ loginFreeHost: {} })',
      'createAuthRuntime({ /* loginFreeHost: createHostHarnessPort(this.registry) */ })',
      "createAuthRuntime({ label: 'loginFreeHost: createHostHarnessPort(this.registry)' })"
    ]) {
      expect(callBodies(source, 'createAuthRuntime')[0]).not.toMatch(HOST_ARG)
    }
  })
})
