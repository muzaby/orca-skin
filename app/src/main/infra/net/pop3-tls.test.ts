import { createServer, type TLSSocket } from 'node:tls'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createPop3Socket } from './pop3-socket'
import { createPop3Session } from './pop3-session'

// Public localhost-only test material, not a deployment certificate or credential.
const cert = readFileSync(join(__dirname, 'fixtures/pop3-test-cert.pem'))
const key = readFileSync(join(__dirname, 'fixtures/pop3-test-key.pem'))

describe('real local POP3 TLS connection', () => {
  it('uses the configured CA and speaks POP3 through the production socket factory', async () => {
    const sockets = new Set<TLSSocket>()
    const received: string[] = []
    const server = createServer({ key, cert }, (socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
      socket.on('error', () => undefined)
      socket.write('+OK local test\r\n')
      let pending = ''
      socket.on('data', (chunk) => {
        pending += chunk.toString('utf8')
        let delimiter: number
        while ((delimiter = pending.indexOf('\r\n')) >= 0) {
          const command = pending.slice(0, delimiter)
          pending = pending.slice(delimiter + 2)
          received.push(command)
          if (command === 'UIDL') socket.write('+OK\r\n1 local-id\r\n.\r\n')
          else socket.write('+OK\r\n')
        }
      })
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('missing test listener')
    const session = createPop3Session(
      {
        host: '127.0.0.1',
        port: address.port,
        tls: true,
        tlsOptions: { ca: cert },
        user: 'test-user',
        password: 'test-password',
        connectTimeoutMs: 3000,
        timeoutMs: 3000
      },
      createPop3Socket
    )
    try {
      await session.login()
      expect(await session.uidls()).toEqual([{ messageNumber: 1, uidl: 'local-id' }])
      await session.quit()
      expect(received).toEqual(['USER test-user', 'PASS test-password', 'UIDL', 'QUIT'])
    } finally {
      session.destroy()
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
    }
  })
})
