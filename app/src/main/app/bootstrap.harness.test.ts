// 0264 EP02 — Bootstrap의 실제 constructor/start가 하네스 조립부에 넘기는 값을 검증한다.
// 인증·DB·IPC 경계는 격리하고, runtime catalog 생성 다음 경계에서 부팅을 멈춘다.
// adapter/settings/runtime/catalog factory와 native parser는 원본을 실행한다.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { app } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthRuntime, AuthSecretReader, AuthSnapshot } from '../contracts/auth'
import type { AdapterRegistry } from '../adapters/common/registry'

const fixture = vi.hoisted(() => ({
  root: '',
  userData: '',
  stop: new Error('fixture: harness composition reached'),
  settings: {
    nativeExtensionChoices: {
      claude: { 'plugin:test@market': false },
      opencode: { 'mcp:docs': true }
    },
    authBypass: false,
    harnesses: {
      claude: { instructions: 'Claude instructions' },
      opencode: { instructions: 'OpenCode instructions', executablePath: 'opencode-fixture.exe' }
    }
  }
}))

vi.mock('electron', () => ({
  app: { getVersion: () => 'test', getPath: () => fixture.userData },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {},
  net: {},
  session: {},
  safeStorage: {},
  shell: {},
  powerMonitor: {},
  webContents: { getAllWebContents: () => [] }
}))
vi.mock('../infra/settings-store', () => ({
  SettingsStore: class {
    getAll(): typeof fixture.settings {
      return fixture.settings
    }
  }
}))
vi.mock('../infra/config/secret-store', () => ({ SecretStore: class {} }))
vi.mock('../infra/config/paths', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../infra/config/paths')>()),
  orcaConfigDir: () => fixture.root
}))
vi.mock('../infra/db', () => ({ initDb: () => ({}), getDbConnection: () => null }))
vi.mock('../features/chat/recovery', () => ({
  recoverSessionHistory: () => ({ toolResultsWritten: 0 })
}))
vi.mock('./handlers/settings', () => ({
  registerSettingsReadHandler: vi.fn(),
  registerSettingsHandlers: vi.fn()
}))
vi.mock('./handlers/providers', () => ({ registerConnectionHandlers: vi.fn() }))
vi.mock('./daily-gate', () => ({ startDailyGate: () => ({ dispose: vi.fn() }) }))
vi.mock('./deployment/plugins', () => ({ createPluginBindings: () => [] }))
vi.mock('./deployment/connections', () => ({ createConnectionSources: () => [] }))
vi.mock('./auth-resume', () => ({ createAuthResume: () => ({ resuming: () => false }) }))
vi.mock('./deployment/usage-fetcher', () => ({
  createUsageFetcher: () => {
    throw fixture.stop
  }
}))
vi.mock('./deployment/harness-runtime', () => ({
  AUTH_INVALIDATED_HARNESS_KEYS: {},
  DIRECT_CREDENTIAL_AUTH_IDS: [],
  RUNTIME_MODEL_CONTRIBUTIONS: [
    { authId: 'fixture', key: 'claude-fixture', harnessId: 'claude', modelProviderId: 'fixture' }
  ],
  createRuntimeConfigAugmenters: () => ({
    'claude-fixture': {
      resolve: async () => ({
        runtimeEnv: { ANTHROPIC_MODEL: 'runtime-explicit' },
        availableModels: ['runtime-listed']
      })
    }
  })
}))

import { Bootstrap } from './bootstrap'
import * as harnesses from './harnesses/registry'
import * as runtimeConfigs from '../features/harnesses/common/runtime-config'
import * as runtimeCatalogs from '../features/harnesses/common/runtime-catalog'
import { netFetch } from '../infra/net/net-fetch'

const bootstraps: Bootstrap[] = []
beforeEach(() => {
  fixture.root = mkdtempSync(join(tmpdir(), 'orca-bootstrap-harness-'))
  fixture.userData = join(fixture.root, 'user-data')
})
afterEach(() => {
  for (const bootstrap of bootstraps.splice(0)) bootstrap.shutdown()
  vi.restoreAllMocks()
  rmSync(fixture.root, { recursive: true, force: true })
})

function createBootstrap(): Bootstrap {
  const bootstrap = new Bootstrap(() => true)
  bootstraps.push(bootstrap)
  return bootstrap
}

describe('Bootstrap harness composition callers', () => {
  it('initializes its actual adapter registry with user data, live preferences and Chromium fetch', () => {
    const create = vi.spyOn(harnesses, 'createAdapterRegistry')
    const getPath = vi.spyOn(app, 'getPath')
    const bootstrap = createBootstrap()
    expect(create).toHaveBeenCalledOnce()
    expect(getPath).toHaveBeenCalledExactlyOnceWith('userData')
    const options = create.mock.calls[0][0]
    expect(options.dataDirectory).toBe(fixture.userData)
    expect(options.fetchImpl).toBe(netFetch)
    expect(options.extensionControl?.global('claude')).toEqual(
      fixture.settings.nativeExtensionChoices.claude
    )
    expect(options.extensionControl?.global('opencode')).toEqual(
      fixture.settings.nativeExtensionChoices.opencode
    )
    expect(options.preferences('claude')).toBe(fixture.settings.harnesses.claude)
    expect(options.preferences('opencode')).toBe(fixture.settings.harnesses.opencode)
    const prior = fixture.settings.harnesses.claude
    fixture.settings.harnesses.claude = { instructions: 'Updated Claude instructions' }
    expect(options.preferences('claude')).toBe(fixture.settings.harnesses.claude)
    fixture.settings.harnesses.claude = prior

    const registry = (bootstrap as unknown as { registry: AdapterRegistry }).registry
    expect(registry).toBe(create.mock.results[0].value)
    expect(registry.list().map((entry) => entry.id)).toEqual(['claude', 'opencode'])
    expect(registry.getActiveId()).toBe('claude')
  })

  it('start forwards its real settings service and runtime parser into the catalog', async () => {
    const directory = join(fixture.root, 'sources', 'settings', 'claude', 'fixture')
    mkdirSync(directory, { recursive: true })
    writeFileSync(
      join(directory, 'settings.json'),
      JSON.stringify({ env: { ANTHROPIC_DEFAULT_SONNET_MODEL: 'settings-native' } })
    )
    const settingsFactory = vi.spyOn(harnesses, 'createHarnessSettingsService')
    const runtimeFactory = vi.spyOn(runtimeConfigs, 'createHarnessRuntimeConfigService')
    const catalogFactory = vi.spyOn(runtimeCatalogs, 'createRuntimeModelCatalog')
    const parse = vi.spyOn(harnesses, 'parseHarnessRuntimeModels')
    const snapshot: AuthSnapshot = {
      authId: 'fixture',
      status: 'valid',
      verified: true,
      credentialRevision: 1
    }
    const bootstrap = createBootstrap()
    const auth = {
      bind: () => ({ snapshot: () => snapshot }),
      // 카탈로그 reader 는 두 체계를 `snapshot(authId)` 로 읽는다(0291).
      snapshot: () => snapshot,
      currentStep: () => null
    } as unknown as AuthRuntime
    vi.spyOn(
      bootstrap as unknown as {
        createAuthStack(): { auth: AuthRuntime; secretReader: AuthSecretReader }
      },
      'createAuthStack'
    ).mockReturnValue({ auth, secretReader: { read: () => null } })

    await expect(bootstrap.start()).rejects.toBe(fixture.stop)
    expect(settingsFactory).toHaveBeenCalledExactlyOnceWith()
    expect(runtimeFactory).toHaveBeenCalledOnce()
    const settings = settingsFactory.mock.results[0].value
    expect(settings.list('claude')[0].models[0].model).toBe('settings-native')
    expect(runtimeFactory.mock.calls[0][0].settings).toBe(settings)
    expect(catalogFactory).toHaveBeenCalledOnce()
    const options = catalogFactory.mock.calls[0][0]
    expect(options.parseModels).toBe(harnesses.parseHarnessRuntimeModels)
    expect(options.runtime).toBe(runtimeFactory.mock.results[0].value)
    expect(options.snapshotOf('fixture')).toBe(snapshot)

    const catalog = catalogFactory.mock.results[0].value
    await catalog.reconcile('fixture', snapshot)
    expect(parse).toHaveBeenCalledOnce()
    expect(parse.mock.calls[0][0]).toMatchObject({
      harnessId: 'claude',
      runtimeEnv: { ANTHROPIC_MODEL: 'runtime-explicit' }
    })
    expect(catalog.list()[0].models.map((model) => model.model)).toEqual([
      'runtime-listed',
      'runtime-explicit'
    ])
    expect(catalog.list()[0].models.find((model) => model.isDefault)?.model).toBe(
      'runtime-explicit'
    )
  })
})
