import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TlsOptions } from 'node:tls'

const native = vi.hoisted(() => ({ net: vi.fn(), tls: vi.fn() }))
vi.mock('node:net', async (original) => ({
  ...(await original<typeof import('node:net')>()),
  connect: native.net
}))
vi.mock('node:tls', () => ({ connect: native.tls }))
import { createPop3Socket } from './pop3-socket'

beforeEach(() => {
  vi.clearAllMocks()
  native.net.mockReturnValue({})
  native.tls.mockReturnValue({})
})

describe('POP3 socket security', () => {
  it.each([
    { rejectUnauthorized: false },
    { checkServerIdentity: () => undefined },
    { secureContext: {} },
    { pskCallback: () => undefined },
    { minVersion: 'TLSv1' },
    { minVersion: 'TLSv1.1' },
    { ciphers: 'ALL:@SECLEVEL=0' },
    { host: 'attacker.test' },
    { socket: {} }
  ])('refuses verification or destination overrides: %o', (tlsOptions) => {
    expect(() =>
      createPop3Socket({
        host: 'mail.test',
        port: 995,
        tls: true,
        tlsOptions: tlsOptions as TlsOptions
      })
    ).toThrow()
    expect(native.tls).not.toHaveBeenCalled()
  })

  it('sets verified TLS, DNS SNI, and TLS version defaults while allowing private CA', () => {
    createPop3Socket({ host: 'mail.test', port: 995, tls: true, tlsOptions: { ca: 'private-ca' } })
    expect(native.tls).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'mail.test',
        port: 995,
        servername: 'mail.test',
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        ca: 'private-ca'
      })
    )
  })

  it('does not send an IP literal as SNI', () => {
    createPop3Socket({ host: '127.0.0.1', port: 995, tls: true })
    expect(native.tls.mock.calls[0][0]).not.toHaveProperty('servername')
  })

  it('uses the explicit verified server name for IP endpoints', () => {
    createPop3Socket({ host: '127.0.0.1', port: 995, tls: true, servername: 'mail.test' })
    expect(native.tls.mock.calls[0][0]).toMatchObject({
      servername: 'mail.test',
      rejectUnauthorized: true
    })
  })
})
