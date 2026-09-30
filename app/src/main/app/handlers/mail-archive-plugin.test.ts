import { beforeEach, expect, it, vi } from 'vitest'
import type { IpcMainInvokeEvent } from 'electron'
import { CHANNELS } from '../../../shared/ipc'
import type { MailArchivePlugin } from '../../features/plugins/mail-archive/plugin'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: IpcMainInvokeEvent, value: unknown) => Promise<unknown>>()
}))
vi.mock('electron', () => ({
  ipcMain: {
    handle: (
      channel: string,
      handler: (event: IpcMainInvokeEvent, input: unknown) => Promise<unknown>
    ) => mocks.handlers.set(channel, handler)
  }
}))
vi.mock('../../infra/log/registry', () => ({
  getLogger: () => ({ child: () => ({ warn: vi.fn() }) })
}))
import { registerMailArchivePluginHandlers } from './mail-archive-plugin'

beforeEach(() => mocks.handlers.clear())
it('validates each real IPC schema, rejects untrusted senders, and forwards only approved session/scope/evidence inputs', async () => {
  const plugin = {
    state: vi.fn().mockResolvedValue({ registered: false }),
    setScope: vi.fn().mockResolvedValue(null),
    resolve: vi.fn().mockResolvedValue({ state: 'forbidden' })
  } as unknown as MailArchivePlugin
  const trusted = { sender: { id: 1 } } as IpcMainInvokeEvent,
    foreign = { sender: { id: 2 } } as IpcMainInvokeEvent
  registerMailArchivePluginHandlers(plugin, (event) => event.sender.id === 1)
  const cases = [
    [CHANNELS.mailArchivePluginState, { sessionId: 'saved' }, plugin.state],
    [CHANNELS.mailArchiveSetScope, { sessionId: 'saved', sourceIds: ['source'] }, plugin.setScope],
    [
      CHANNELS.mailArchiveResolveEvidence,
      { sessionId: 'saved', id: '00000000-0000-4000-8000-000000000001' },
      plugin.resolve
    ]
  ] as const
  for (const [channel, input, method] of cases) {
    const handler = mocks.handlers.get(channel)!
    await expect(handler(foreign, input)).rejects.toThrow('forbidden')
    expect(method).not.toHaveBeenCalled()
    await expect(handler(trusted, { ...input, scope: 'spoof' })).rejects.toBeDefined()
    expect(method).not.toHaveBeenCalled()
    await handler(trusted, input)
    expect(method).toHaveBeenCalledOnce()
  }
  await expect(
    mocks.handlers.get(CHANNELS.mailArchiveSetScope)!(trusted, {
      sessionId: 'saved',
      sourceIds: ['source'],
      sentAfter: 100,
      sentBefore: 50
    })
  ).rejects.toBeDefined()
  expect(plugin.state).toHaveBeenCalledWith('saved')
  expect(plugin.resolve).toHaveBeenCalledWith('saved', '00000000-0000-4000-8000-000000000001')
})
