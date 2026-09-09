import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from 'electron'

const network = vi.hoisted(() => ({
  request: vi.fn(),
  fetch: vi.fn(),
  browserSession: { allowNTLMCredentialsForDomains: vi.fn() }
}))
vi.mock('electron', () => ({
  net: network,
  session: { fromPartition: () => network.browserSession },
  BrowserWindow: class {}
}))

import { sendOnce } from './net-request'
import { netFetch } from './net-fetch'
import { createSender, ResponseTooLargeError } from './transport'
import { BrowserSessionStore } from '../browser-session'

class FakeRequest extends EventEmitter {
  setHeader = vi.fn()
  write = vi.fn()
  end = vi.fn()
  abort = vi.fn(() => this.emit('error', new Error('aborted')))
}

function respond(request: FakeRequest, headers: Record<string, string[]> = {}): EventEmitter {
  const response = Object.assign(new EventEmitter(), { statusCode: 200, headers })
  request.emit('response', response)
  return response
}

describe('Chromium single request boundaries', () => {
  let request: FakeRequest
  beforeEach(() => {
    vi.clearAllMocks()
    request = new FakeRequest()
    network.request.mockReturnValue(request)
  })

  it('preserves bytes, credentials, body and removes its abort listener after success', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const session = {} as Session
    const result = sendOnce({
      url: 'https://corp.invalid/file',
      method: 'POST',
      headers: { authorization: 'fake' },
      body: 'input',
      session,
      credentials: 'include',
      signal: controller.signal
    })
    const response = respond(request)
    response.emit('data', Buffer.from([0, 255]))
    response.emit('data', Buffer.from([10]))
    response.emit('end')
    expect((await result).body).toEqual(Buffer.from([0, 255, 10]))
    expect(network.request).toHaveBeenCalledWith(
      expect.objectContaining({ session, credentials: 'include', redirect: 'manual' })
    )
    expect(request.setHeader).toHaveBeenCalledWith('authorization', 'fake')
    expect(request.write).toHaveBeenCalledWith('input')
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    controller.abort()
    expect(request.abort).not.toHaveBeenCalled()
  })

  it.each<Record<string, string[]>>([{}, { 'content-length': ['1'] }])(
    'aborts at the first excessive chunk, without waiting for end: %j',
    async (headers) => {
      const result = sendOnce({ url: 'https://corp.invalid/file', maxBytes: 3 })
      const rejected = expect(result).rejects.toBeInstanceOf(ResponseTooLargeError)
      const response = respond(request, headers)
      response.emit('data', Buffer.from([1, 2]))
      expect(request.abort).not.toHaveBeenCalled()
      response.emit('data', Buffer.from([3, 4]))
      expect(request.abort).toHaveBeenCalledOnce()
      await rejected
      response.emit('data', Buffer.alloc(20))
      response.emit('end')
      expect(request.abort).toHaveBeenCalledOnce()
    }
  )

  it('rejects declared excessive content before consuming body data', async () => {
    const result = sendOnce({ url: 'https://corp.invalid/file', maxBytes: 3 })
    const rejected = expect(result).rejects.toBeInstanceOf(ResponseTooLargeError)
    respond(request, { 'Content-Length': ['4'] })
    expect(request.abort).toHaveBeenCalledOnce()
    await rejected
  })

  it('allows exactly the byte limit and keeps redirect facts without following the redirect', async () => {
    const first = sendOnce({ url: 'https://corp.invalid/file', maxBytes: 3 })
    const response = respond(request)
    response.emit('data', Buffer.from([1, 2, 3]))
    response.emit('end')
    expect((await first).body).toEqual(Buffer.from([1, 2, 3]))
    const redirected = sendOnce({ url: 'https://corp.invalid/old', maxBytes: 0 })
    request.emit('redirect', 302, 'GET', 'https://elsewhere.invalid/new', { location: ['/new'] })
    expect(await redirected).toEqual({
      facts: { status: 302, headers: { location: 'https://elsewhere.invalid/new' } },
      body: null
    })
    expect(request.abort).toHaveBeenCalledOnce()
  })

  it('settles request and response errors and cancellation once', async () => {
    const controller = new AbortController()
    const result = sendOnce({ url: 'https://corp.invalid/file', signal: controller.signal })
    const rejected = expect(result).rejects.toThrow('취소')
    const response = respond(request)
    controller.abort()
    response.emit('error', new Error('late response error'))
    response.emit('end')
    await rejected
    expect(request.abort).toHaveBeenCalledOnce()
  })

  it('handles an already aborted signal and absorbs late request errors', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = sendOnce({ url: 'https://corp.invalid/file', signal: controller.signal })
    const error = await result.catch((reason: unknown) => reason)
    expect(error).toEqual(expect.objectContaining({ message: expect.stringContaining('취소') }))
    expect(() => request.emit('error', new Error('late cancellation error'))).not.toThrow()
    expect(request.end).not.toHaveBeenCalled()
  })

  it.each(['request', 'response'] as const)(
    'preserves the first %s error and detaches cancellation',
    async (source) => {
      const controller = new AbortController()
      const remove = vi.spyOn(controller.signal, 'removeEventListener')
      const result = sendOnce({ url: 'https://corp.invalid/file', signal: controller.signal })
      const failure = new Error('transport failed')
      const rejected = expect(result).rejects.toBe(failure)
      const response = respond(request)
      ;(source === 'request' ? request : response).emit('error', failure)
      response.emit('end')
      await rejected
      expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
      controller.abort()
      expect(request.abort).not.toHaveBeenCalled()
    }
  )

  it.each(['binary', 'text'] as const)(
    'forwards the authenticated %s budget through the real netFetch manual branch',
    async (responseType) => {
      const sender = createSender(netFetch)
      const result = sender.send(
        { url: 'https://corp.invalid/file', method: 'GET', headers: {} },
        undefined,
        { responseType, maxBytes: 3 }
      )
      const rejected = expect(result).rejects.toBeInstanceOf(ResponseTooLargeError)
      const response = respond(request)
      response.emit('data', Buffer.from([1, 2, 3, 4]))
      // Assert before end: a post-buffer check cannot satisfy this contract.
      expect(request.abort).toHaveBeenCalledOnce()
      response.emit('end')
      await rejected
      expect(network.request).toHaveBeenCalledWith(
        expect.objectContaining({ credentials: 'omit', redirect: 'manual' })
      )
      expect(network.fetch).not.toHaveBeenCalled()
    }
  )

  it('enforces the same receive budget through the cookie session and preserves allowed bytes', async () => {
    const store = new BrowserSessionStore()
    store.register({ sessionGroup: 'test', allowedOrigins: ['https://corp.invalid'] })
    const handle = store.acquire('test')
    const result = store.send(
      handle,
      { url: 'https://corp.invalid/file', method: 'GET', headers: {} },
      { responseType: 'binary', maxBytes: 3 }
    )
    const rejected = expect(result).rejects.toBeInstanceOf(ResponseTooLargeError)
    const response = respond(request)
    response.emit('data', Buffer.from([1, 2, 3, 4]))
    expect(request.abort).toHaveBeenCalledOnce()
    await rejected
    expect(network.request).toHaveBeenCalledWith(
      expect.objectContaining({ session: network.browserSession, credentials: 'include' })
    )

    request = new FakeRequest()
    network.request.mockReturnValue(request)
    const accepted = store.send(
      handle,
      { url: 'https://corp.invalid/file', method: 'GET', headers: {} },
      { responseType: 'binary', maxBytes: 3 }
    )
    const next = respond(request)
    next.emit('data', Buffer.from([0, 255, 1]))
    next.emit('end')
    expect(await accepted).toMatchObject({
      status: 200,
      body: '',
      bodyBytes: Buffer.from([0, 255, 1])
    })
    await expect(
      store.send(handle, { url: 'https://elsewhere.invalid/file', method: 'GET', headers: {} })
    ).rejects.toThrow('origin')
    expect(network.request).toHaveBeenCalledTimes(2)
  })
})
