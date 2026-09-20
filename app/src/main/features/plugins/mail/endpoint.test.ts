import { describe, expect, it } from 'vitest'
import { mailOrigin, mailSessionConfig, parseMailOrigin, resolveMailEndpoint } from './auth'

describe('mail endpoint is a single copy carried by the auth origin', () => {
  it('applies the port and TLS defaults in exactly one place', () => {
    expect(resolveMailEndpoint({ host: 'pop.example.corp' })).toEqual({
      host: 'pop.example.corp',
      port: 995,
      tls: true
    })
    expect(resolveMailEndpoint({ host: 'pop.example.corp', tls: false })).toEqual({
      host: 'pop.example.corp',
      port: 110,
      tls: false
    })
    expect(resolveMailEndpoint({ host: 'pop.example.corp', port: 1995 }).port).toBe(1995)
  })

  it.each([
    { host: 'pop.example.corp' },
    { host: 'pop.example.corp', tls: false },
    { host: 'pop.example.corp', port: 1995 },
    { host: '::1' },
    { host: '::1', tls: false, port: 1110 }
  ])('round-trips %j through the origin without losing a coordinate', (input) => {
    expect(parseMailOrigin(mailOrigin(input))).toEqual(resolveMailEndpoint(input))
  })

  it.each([
    'pop3s://user:pw@pop.example.corp:995',
    'pop3s://:pw@pop.example.corp:995',
    'pop3s://pop.example.corp:995/inbox',
    'pop3s://pop.example.corp:995?q=1',
    'pop3s://pop.example.corp:995#f',
    'pop3s://pop.example.corp',
    'https://pop.example.corp:995',
    'imaps://pop.example.corp:993'
  ])('refuses %s as a mail origin', (origin) => {
    expect(() => parseMailOrigin(origin)).toThrow('invalid mail endpoint')
  })

  it('refuses to author an origin that would carry credentials in its host', () => {
    expect(() => mailOrigin({ host: 'user:pw@pop.example.corp' })).toThrow('invalid mail endpoint')
  })

  it('builds a session config from the origin plus transport settings only', () => {
    const timeouts = { commandMs: 100, connectMs: 100 }
    expect(mailSessionConfig('pop3://pop.example.corp:110', { timeouts })).toEqual({
      host: 'pop.example.corp',
      port: 110,
      tls: false,
      timeouts
    })
  })
})
