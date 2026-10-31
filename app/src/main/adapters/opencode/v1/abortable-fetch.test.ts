import { expect, it, vi } from 'vitest'
import { abortableFetch } from './abortable-fetch'

it('cancels a late body and throws the caller cancellation', async () => {
  const control = new AbortController()
  const cancelled = new Error('caller stopped')
  const gate = Promise.withResolvers<Response>()
  const transport = vi.fn<typeof fetch>(() => gate.promise)
  const cancel = vi.fn()
  const result = abortableFetch(transport, new Request('https://owned.test'), control.signal)
  control.abort(cancelled)
  gate.resolve(new Response(new ReadableStream({ cancel })))
  await expect(result).rejects.toBe(cancelled)
  expect(cancel).toHaveBeenCalledOnce()
  expect(new Request(transport.mock.calls[0][0]).signal.aborted).toBe(true)
})

it('does not start a cancelled request and returns an active response unchanged', async () => {
  const transport = vi.fn<typeof fetch>()
  await expect(
    abortableFetch(transport, new Request('https://owned.test'), AbortSignal.abort())
  ).rejects.toThrow()
  expect(transport).not.toHaveBeenCalled()
  const response = new Response('ok')
  transport.mockResolvedValue(response)
  expect(
    await abortableFetch(transport, new Request('https://owned.test'), new AbortController().signal)
  ).toBe(response)
})
