import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { scanOffenders, stripCommentsAndStrings } from '../infra/source-scan'
import { ArtifactCatalog } from '../features/artifacts/catalog'

const mocks = vi.hoisted(() => ({
  options: vi.fn(),
  register: vi.fn(),
  tool: vi.fn(),
  broadcast: vi.fn(),
  close: vi.fn()
}))
vi.mock('electron', () => ({
  app: { getVersion: () => 'test' },
  shell: { trashItem: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: {},
  net: {},
  session: {},
  safeStorage: {}
}))
vi.mock('../infra/settings-store', () => ({ SettingsStore: class {} }))
vi.mock('../features/artifacts/service', () => ({
  ArtifactService: class {
    constructor(options: unknown) {
      mocks.options(options)
    }
    close = mocks.close
  }
}))
vi.mock('../features/artifacts/tool', () => ({ createArtifactToolServer: mocks.tool }))
vi.mock('./handlers/artifacts', () => ({ registerArtifactHandlers: mocks.register }))
vi.mock('../infra/ipc/send', () => ({ broadcastChatEvent: mocks.broadcast }))
import { Bootstrap } from './bootstrap'

describe('artifact composition wiring', () => {
  it('keeps publication entry in the explicit model tool', () => {
    const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[/\\]$/, '')
    // BackgroundController의 publish 포트는 renderer event relay이며 artifact publication이 아니다.
    // 그 명시 예외 외에는 변수명과 관계없이 publish 우회를 계속 잡는다.
    expect(
      scanOffenders(
        root,
        (source) => /\.publish\s*\(/u.test(source),
        new Set(['background-controller.ts'])
      )
    ).toEqual(['features/artifacts/tool.ts'])
    const sources = [
      '../features/artifacts/tool.ts',
      '../features/artifacts/service.ts',
      './bootstrap.ts'
    ].map((path) => stripCommentsAndStrings(readFileSync(new URL(path, import.meta.url), 'utf8')))
    expect(sources.join('\n')).not.toMatch(/\b(?:watch|watchFile|chokidar)\s*\(/u)
  })
  it('owns one registry entry, ID handlers, and publication-only notification', () => {
    const add = vi.fn()
    const server = { descriptor: { id: 'orca_artifacts' } }
    mocks.tool.mockReturnValue(server)
    const bootstrap = Object.create(Bootstrap.prototype) as {
      registerArtifacts(ctx: unknown): void
      isTrustedArtifactSender: () => boolean
    }
    bootstrap.isTrustedArtifactSender = () => true
    const catalogItems = [{ publicationId: 'catalog-publication' }]
    const queries = {
      listCatalog: vi.fn(() => catalogItems),
      setPinned: vi.fn(() => true)
    }
    bootstrap.registerArtifacts({ db: { artifacts: queries }, runtimeTools: { add } })
    expect(mocks.options).toHaveBeenCalledWith(
      expect.objectContaining({ queries, rootDir: expect.stringMatching(/artifacts[/\\]\.dev$/) })
    )
    expect(add).toHaveBeenCalledWith(server)
    expect(mocks.register).toHaveBeenCalledWith(
      mocks.tool.mock.calls[0]![0],
      bootstrap.isTrustedArtifactSender,
      expect.any(ArtifactCatalog)
    )
    const catalog = mocks.register.mock.calls[0]![2] as ArtifactCatalog
    expect(catalog.list()).toBe(catalogItems)
    expect(queries.listCatalog).toHaveBeenCalledOnce()
    expect(catalog.setPinned('catalog-session', 'catalog-publication', true)).toEqual({ ok: true })
    expect(queries.setPinned).toHaveBeenCalledWith('catalog-session', 'catalog-publication', true)
    const publish = mocks.tool.mock.calls[0]![1] as (sessionId: string, artifact: unknown) => void
    const artifact = { publicationId: 'p' }
    publish('original-session', artifact)
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: 'artifact.published',
      sessionId: 'original-session',
      artifact
    })
    const source = stripCommentsAndStrings(
      readFileSync(new URL('./bootstrap.ts', import.meta.url), 'utf8')
    )
    expect(source).toMatch(
      /private\s+register\(ctx:\s*RouterContext\):\s*void\s*\{\s*this\.registerArtifacts\(ctx\)/
    )
    expect(source).toMatch(/void\s+this\.artifacts\?\.close\(\)/)
  })
})
