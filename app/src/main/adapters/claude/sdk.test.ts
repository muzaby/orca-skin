import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => {
  vi.doUnmock('@anthropic-ai/claude-agent-sdk')
  vi.resetModules()
})
it('shares one cold import across consumers and first-use controls', async () => {
  vi.resetModules()
  const gate = Promise.withResolvers<void>(),
    query = vi.fn(),
    setModel = vi.fn(async () => {})
  const sdk = { query, createSdkMcpServer: vi.fn() }
  query.mockReturnValue({
    setModel,
    close: vi.fn(),
    async *[Symbol.asyncIterator]() {
      yield { type: 'result' }
    }
  })
  const factory = vi.fn(async () => {
    await gate.promise
    return sdk
  })
  vi.doMock('@anthropic-ai/claude-agent-sdk', factory)
  const { loadClaudeSdk, deferClaudeQuery } = await import('./sdk')
  const a = loadClaudeSdk(),
    b = loadClaudeSdk()
  expect(a).toBe(b)
  const handle = deferClaudeQuery((loaded) => loaded.query({ prompt: 'hello', options: {} }))
  const control = handle.setModel('sentinel-model')
  expect(query).not.toHaveBeenCalled()
  gate.resolve()
  await Promise.all([a, b, control])
  expect(factory).toHaveBeenCalledOnce()
  expect(query).toHaveBeenCalledOnce()
  expect(setModel).toHaveBeenCalledWith('sentinel-model')
  const messages: unknown[] = []
  for await (const message of handle) messages.push(message)
  expect(messages).toEqual([{ type: 'result' }])
})
it('closing before the import completes prevents query creation and rejects iteration', async () => {
  vi.resetModules()
  const gate = Promise.withResolvers<void>(),
    query = vi.fn()
  vi.doMock('@anthropic-ai/claude-agent-sdk', async () => {
    await gate.promise
    return { query }
  })
  const { deferClaudeQuery } = await import('./sdk')
  const handle = deferClaudeQuery((sdk) => sdk.query({ prompt: 'hello', options: {} }))
  handle.close()
  gate.resolve()
  await expect(handle[Symbol.asyncIterator]().next()).rejects.toMatchObject({ name: 'AbortError' })
  expect(query).not.toHaveBeenCalled()
})
