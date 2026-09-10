import { mkdtemp, mkdir, readFile, writeFile, rm, link, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi, type Mocked } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import type { ArtifactService } from '../../features/artifacts/service'
import type { ArtifactCatalog } from '../../features/artifacts/catalog'
import { CHANNELS } from '../../../shared/ipc'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (req?: unknown, event?: IpcMainInvokeEvent) => Promise<unknown>>(),
  save: vi.fn(),
  open: vi.fn(),
  reveal: vi.fn(),
  openPath: vi.fn(async () => '')
}))
vi.mock('electron', () => ({
  dialog: { showSaveDialog: mocks.save, showOpenDialog: mocks.open },
  shell: { showItemInFolder: mocks.reveal, openPath: mocks.openPath }
}))
vi.mock('../../infra/ipc/handle', () => ({
  handle: (
    channel: string,
    schema: { parse: (arg: unknown) => unknown },
    _policy: unknown,
    handler: (req: unknown, event: IpcMainInvokeEvent) => Promise<unknown>
  ) => mocks.handlers.set(channel, async (req, event) => handler(schema.parse(req), event!)),
  handlePlain: (
    channel: string,
    handler: (req: unknown, event: IpcMainInvokeEvent) => Promise<unknown>
  ) => mocks.handlers.set(channel, async (req, event) => handler(req, event!))
}))
import { registerArtifactHandlers } from './artifacts'

const dirs: string[] = []
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true })
  vi.clearAllMocks()
})
type TestService = Pick<
  ArtifactService,
  'listLatest' | 'status' | 'preview' | 'trash' | 'readForExport' | 'revealPath' | 'openFolderPath'
>
type TestCatalog = Pick<ArtifactCatalog, 'list' | 'setPinned'>
async function setup(): Promise<{
  service: Mocked<TestService>
  catalog: Mocked<TestCatalog>
  dest: string
  root: string
  trusted: ReturnType<typeof vi.fn<(event: IpcMainInvokeEvent) => boolean>>
  call(key: keyof typeof CHANNELS, req?: unknown): Promise<unknown>
}> {
  const dest = await mkdtemp(join(tmpdir(), 'orca-artifact-export-'))
  dirs.push(dest)
  const root = await mkdtemp(join(tmpdir(), 'orca-artifact-source-'))
  dirs.push(root)
  const service: Mocked<TestService> = {
    listLatest: vi.fn(() => []),
    status: vi.fn(async () => []),
    preview: vi.fn(async () => ({
      state: 'ready' as const,
      format: 'text' as const,
      content: 'selected source',
      mimeType: 'text/plain'
    })),
    trash: vi.fn(),
    readForExport: vi.fn(async (_s: string, id: string) => {
      if (id === 'gone') throw new Error('missing')
      return { filename: 'report.md', bytes: Buffer.from(id) }
    }),
    revealPath: vi.fn(async () => join(root, 'report.md')),
    openFolderPath: vi.fn(async () => root)
  }
  const event = {} as IpcMainInvokeEvent
  const catalog: Mocked<TestCatalog> = {
    list: vi.fn(() => []),
    setPinned: vi.fn(() => ({ ok: true }))
  }
  const trusted = vi.fn((candidate: IpcMainInvokeEvent) => candidate === event)
  registerArtifactHandlers(service, trusted, catalog)
  return {
    service,
    catalog,
    dest,
    root,
    trusted,
    call: (key: keyof typeof CHANNELS, req?: unknown) =>
      mocks.handlers.get(CHANNELS[key])!(req, event)
  }
}
describe('artifact IPC file actions', () => {
  it('lists the catalog and pins only the selected publication after validating the sender', async () => {
    const { catalog, call } = await setup()
    expect(await call('artifactCatalog', {})).toEqual([])
    expect(catalog.list).toHaveBeenCalledOnce()
    expect(
      await call('artifactSetPinned', {
        sessionId: 'owner',
        publicationId: 'original',
        pinned: false
      })
    ).toEqual({ ok: true })
    expect(catalog.setPinned).toHaveBeenCalledWith('owner', 'original', false)
    catalog.setPinned.mockClear()
    await expect(
      call('artifactSetPinned', {
        sessionId: 'owner',
        publicationId: 'original',
        pinned: false,
        path: 'C:/private'
      })
    ).rejects.toThrow()
    expect(catalog.setPinned).not.toHaveBeenCalled()
  })
  it('previews only the selected IDs and rejects renderer paths at the schema boundary', async () => {
    const { service, call } = await setup()
    expect(
      await call('artifactPreview', { sessionId: 'original', publicationId: 'older' })
    ).toMatchObject({ state: 'ready', content: 'selected source' })
    expect(service.preview).toHaveBeenCalledWith('original', 'older')
    service.preview.mockClear()
    await expect(
      call('artifactPreview', {
        sessionId: 'original',
        publicationId: 'older',
        path: 'C:/private/file.md'
      })
    ).rejects.toThrow()
    expect(service.preview).not.toHaveBeenCalled()
  })
  it('replaces an external hardlink destination without changing the managed original inode', async () => {
    const { root, dest, call } = await setup()
    const original = join(root, 'other-publication.md')
    const destination = join(dest, 'report.md')
    await writeFile(original, 'Preserve this publication')
    await link(original, destination)
    mocks.save.mockResolvedValue({ canceled: false, filePath: destination })
    expect(await call('artifactSave', { sessionId: 's', publicationIds: ['new bytes'] })).toEqual({
      outcome: 'completed',
      items: [{ publicationId: 'new bytes', outcome: 'saved' }]
    })
    expect(await readFile(destination, 'utf8')).toBe('new bytes')
    expect(await readFile(original, 'utf8')).toBe('Preserve this publication')
    expect(await readdir(dest)).toEqual(['report.md'])
  })
  it('cleans its temporary file on a failed rename and keeps the existing destination', async () => {
    const { dest, call } = await setup()
    const destination = join(dest, 'existing-directory')
    await mkdir(destination)
    await writeFile(join(destination, 'keep.md'), 'Existing file')
    mocks.save.mockResolvedValue({ canceled: false, filePath: destination })
    expect(
      await call('artifactSave', { sessionId: 's', publicationIds: ['new bytes'] })
    ).toMatchObject({
      outcome: 'completed',
      items: [{ publicationId: 'new bytes', outcome: 'failed' }]
    })
    expect(await readFile(join(destination, 'keep.md'), 'utf8')).toBe('Existing file')
    expect(await readdir(dest)).toEqual(['existing-directory'])
  })
  it.each([
    ['artifactCatalog', {}],
    ['artifactSetPinned', { sessionId: 's', publicationId: 'p', pinned: true }],
    ['artifactList', { sessionId: 's' }],
    ['artifactStatus', { sessionId: 's', publicationIds: ['p'] }],
    ['artifactPreview', { sessionId: 's', publicationId: 'p' }],
    ['artifactSave', { sessionId: 's', publicationIds: ['p'] }],
    ['artifactReveal', { sessionId: 's', publicationId: 'p' }],
    ['artifactTrash', { sessionId: 's', publicationId: 'p' }],
    ['artifactOpenFolder', undefined]
  ] as const)(
    'rejects an untrusted sender before any service or native action: %s',
    async (channel, request) => {
      const { service, catalog, trusted, call } = await setup()
      trusted.mockReturnValue(false)
      await expect(call(channel, request)).rejects.toThrow('forbidden')
      expect(trusted).toHaveBeenCalledOnce()
      for (const method of Object.values(service)) expect(method).not.toHaveBeenCalled()
      for (const method of Object.values(catalog)) expect(method).not.toHaveBeenCalled()
      for (const native of [mocks.save, mocks.open, mocks.reveal, mocks.openPath])
        expect(native).not.toHaveBeenCalled()
    }
  )
  it('uses fixed IDs, keeps same-name files, and reports a missing item separately', async () => {
    const { dest, service, call } = await setup()
    await writeFile(join(dest, 'report.md'), 'existing')
    mocks.open.mockResolvedValue({ canceled: false, filePaths: [dest] })
    expect(
      await call('artifactSave', { sessionId: 'original', publicationIds: ['one', 'gone', 'two'] })
    ).toEqual({
      outcome: 'completed',
      items: [
        { publicationId: 'one', outcome: 'saved' },
        { publicationId: 'gone', outcome: 'skipped', reason: 'missing' },
        { publicationId: 'two', outcome: 'saved' }
      ]
    })
    expect(await readFile(join(dest, 'report.md'), 'utf8')).toBe('existing')
    expect(await readFile(join(dest, 'report (1).md'), 'utf8')).toBe('one')
    expect(await readFile(join(dest, 'report (2).md'), 'utf8')).toBe('two')
    expect(service.readForExport.mock.calls).toEqual([
      ['original', 'one'],
      ['original', 'gone'],
      ['original', 'two']
    ])
  })
  it('does not read or copy on cancellation and rejects over-limit requests before a dialog', async () => {
    const { service, call } = await setup()
    mocks.open.mockResolvedValue({ canceled: true, filePaths: [] })
    expect(await call('artifactSave', { sessionId: 's', publicationIds: ['a', 'b'] })).toEqual({
      outcome: 'cancelled',
      items: []
    })
    expect(service.readForExport).not.toHaveBeenCalled()
    await expect(
      call('artifactSave', {
        sessionId: 's',
        publicationIds: Array.from({ length: 51 }, (_, i) => `${i}`)
      })
    ).rejects.toThrow()
    expect(mocks.open).toHaveBeenCalledTimes(1)
  })
  it('rejects exports into the canonical root and reveals only the verified original ID', async () => {
    const { root, service, call } = await setup()
    mocks.save.mockResolvedValue({ canceled: false, filePath: join(root, 'report.md') })
    expect(await call('artifactSave', { sessionId: 's', publicationIds: ['old'] })).toMatchObject({
      outcome: 'failed',
      reason: 'unsafe-destination'
    })
    expect(await call('artifactReveal', { sessionId: 's', publicationId: 'old' })).toEqual({
      ok: true
    })
    expect(service.revealPath).toHaveBeenCalledWith('s', 'old')
    expect(mocks.reveal).toHaveBeenCalledWith(join(root, 'report.md'))
  })
  it('reports native open failures instead of false success', async () => {
    const { call } = await setup()
    mocks.openPath.mockResolvedValueOnce('native failure')
    expect(await call('artifactOpenFolder')).toEqual({ ok: false, reason: 'open-failed' })
  })
})
