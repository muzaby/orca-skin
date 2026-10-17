import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHANNELS, type AgentEnvironment } from '../../../shared/ipc'
import {
  importedProviders,
  serializeProviderDraft
} from '../../../renderer/src/features/engine/harnesses/opencode/v1/customProvider'
import { OpenCodeAdapter } from '../../adapters/opencode/v1/adapter'
import {
  loadOpenCodeProviderSettings,
  parseOpenCodeModels
} from '../../adapters/opencode/v1/settings'
import { HarnessSettingsService } from '../../features/harnesses/common/settings'
import { createHarnessRuntimeConfigService } from '../../features/harnesses/common/runtime-config'
import { createRuntimeModelCatalog } from '../../features/harnesses/common/runtime-catalog'
import { parseHarnessRuntimeModels } from '../harnesses/registry'
import { RUNTIME_MODEL_CONTRIBUTIONS } from '../deployment/harness-runtime'
import { registerEngineHandlers } from './engine'
import { registerMiscHandlers } from './misc'
import { resolveTurnProvider } from '../chat-turn/resolve-turn'

const fixture = vi.hoisted(() => ({
  root: '',
  callbacks: new Map<string, (req?: unknown) => unknown>()
}))
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    name: string,
    _schema: unknown,
    _policy: unknown,
    callback: (req?: unknown) => unknown
  ) => fixture.callbacks.set(name, callback),
  handlePlain: (name: string, callback: () => unknown) => fixture.callbacks.set(name, callback)
}))
vi.mock('electron', () => ({ BrowserWindow: {}, Notification: {} }))
vi.mock('../../infra/ipc/send', () => ({
  sendChatEvent: vi.fn(),
  sendInstallStatus: vi.fn(),
  setWireLog: vi.fn()
}))
vi.mock('../../infra/ipc/wire-log', () => ({ setWireSink: vi.fn() }))
vi.mock('../../infra/log', () => ({
  getLogger: () => ({ child: () => ({ warn: vi.fn(), debug: vi.fn() }) }),
  setConsoleMirror: vi.fn()
}))
vi.mock('../../infra/log/registry', () => ({
  getLogger: () => ({ child: () => ({ warn: vi.fn() }) })
}))
vi.mock('../../infra/config/orca-config', () => ({ getOrcaConfig: () => ({}), appEnv: () => ({}) }))
vi.mock('../../infra/config/paths', async (original) => ({
  ...(await original<typeof import('../../infra/config/paths')>()),
  orcaConfigDir: () => fixture.root
}))

afterEach(() => {
  vi.unstubAllEnvs()
  if (fixture.root) rmSync(fixture.root, { recursive: true, force: true })
  fixture.callbacks.clear()
})

it('imports fields, saves an independent document and lists/resolves only its model without a server', async () => {
  fixture.root = mkdtempSync(join(tmpdir(), 'orca-engine-scope-'))
  const globalRoot = join(fixture.root, 'global')
  vi.stubEnv('XDG_CONFIG_HOME', globalRoot)
  mkdirSync(join(globalRoot, 'opencode'), { recursive: true })
  const source = JSON.stringify({
    model: 'other/extra',
    instructions: ['global.md'],
    provider: {
      local: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Local',
        options: { baseURL: 'https://example.test/v1', timeout: 8000 },
        models: { first: { name: 'First', limit: { context: 1234 } }, removed: { name: 'Removed' } }
      },
      other: {
        npm: '@ai-sdk/openai-compatible',
        options: { baseURL: 'https://other.test/v1' },
        models: { extra: { name: 'Extra' } }
      }
    }
  })
  const globalFile = join(globalRoot, 'opencode', 'opencode.json')
  writeFileSync(globalFile, source)
  const acquire = vi.fn(),
    fetchImpl = vi.fn(),
    deployExtensions = vi.fn(async () => {})
  const adapter = new OpenCodeAdapter({ acquire, installed: vi.fn(), close: vi.fn() }, fetchImpl)
  const makeSettings = (): HarnessSettingsService =>
    new HarnessSettingsService(
      { opencode: loadOpenCodeProviderSettings },
      fixture.root,
      (_, config) => parseOpenCodeModels(config)
    )
  let settings = makeSettings()
  const register = (): ReturnType<typeof createHarnessRuntimeConfigService> => {
    const runtime = createHarnessRuntimeConfigService({ settings, augmenters: {} })
    // Bootstrap injects the runtime catalog too; without it agent:list skips the merge branch.
    const runtimeModelCatalog = createRuntimeModelCatalog({
      parseModels: parseHarnessRuntimeModels,
      contributions: RUNTIME_MODEL_CONTRIBUTIONS,
      runtime,
      snapshotOf: () => {
        throw new Error('the default deployment declares no runtime model contributions')
      }
    })
    registerEngineHandlers({
      deployExtensions,
      harnessSettings: settings,
      harnessRuntime: runtime,
      runtimeModelCatalog
    })
    registerMiscHandlers({
      registry: { list: () => [{ id: 'opencode' }], get: () => adapter },
      harnessSettings: settings,
      harnessRuntime: runtime,
      runtimeModelCatalog,
      debugMock: { log: false },
      mcp: { resolver: () => () => undefined }
    } as never)
    return runtime
  }
  let runtime = register()
  const call = async (channel: string, req?: unknown): Promise<unknown> =>
    fixture.callbacks.get(channel)!(req)
  const imported = (await call(CHANNELS.engineImportUserSettings, { engine: 'opencode' })) as {
    settingsJson: string
  }
  const drafts = importedProviders(imported.settingsJson)
  const draft = drafts[0]
  draft.models = [draft.models[0]]
  const serialized = serializeProviderDraft(draft)
  await call(CHANNELS.engineAdd, {
    engine: 'opencode',
    provider: draft.id,
    settingsJson: serialized
  })
  const stored = JSON.parse(
    readFileSync(join(fixture.root, 'sources/settings/opencode/local/settings.json'), 'utf8')
  )
  expect(stored).toEqual(JSON.parse(serialized))
  expect(Object.keys(stored.provider)).toEqual(['local'])
  expect(stored.provider.local.models).toEqual({ first: { name: 'First' } })
  expect(stored.provider.local.options).toEqual({ baseURL: 'https://example.test/v1' })
  expect(stored.instructions).toBeUndefined()
  await call(CHANNELS.engineAdd, {
    engine: 'opencode',
    provider: drafts[1].id,
    settingsJson: serializeProviderDraft(drafts[1])
  })
  for (let pass = 0; pass < 2; pass++) {
    const list = (await call(CHANNELS.agentList)) as AgentEnvironment[]
    expect(
      list.find((row) => row.key === 'opencode-local')?.models.map((model) => model.model)
    ).toEqual(['local/first'])
    expect(
      list.find((row) => row.key === 'opencode-other')?.models.map((model) => model.model)
    ).toEqual(['other/extra'])
    // The catalog's failure fallback keeps the same model names; only native catalog output has
    // agents and no catalog error.
    expect(
      list
        .map((row) => [row.key, row.catalogError, row.agents?.map((agent) => agent.name)])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    ).toEqual([
      ['opencode-local', undefined, ['build', 'plan']],
      ['opencode-other', undefined, ['build', 'plan']]
    ])
    const selected = await resolveTurnProvider(
      {
        harnessSettings: settings,
        harnessRuntime: runtime,
        db: { getSessionById: () => undefined },
        mcp: { resolver: () => () => undefined }
      } as never,
      {
        adapter,
        agentKind: 'code',
        sessionId: null,
        providerKey: 'opencode-local',
        modelFamily: 'local/first'
      }
    )
    expect(selected.model).toBe('local/first')
    settings = makeSettings()
    runtime = register()
  }
  expect(readFileSync(globalFile, 'utf8')).toBe(source)
  expect(acquire).not.toHaveBeenCalled()
  expect(fetchImpl).not.toHaveBeenCalled()
  expect(deployExtensions).not.toHaveBeenCalled()
})
