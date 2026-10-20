import { createServer } from 'node:net'
import { expect, it } from 'vitest'
import { allocateLoopbackPort } from './loopback-port'

it('releases an OS-assigned loopback port before returning it to the caller', async () => {
  const port = await allocateLoopbackPort()
  expect(port).toBeGreaterThan(0)
  const listener = createServer()
  try {
    await new Promise<void>((resolve, reject) => {
      listener.once('error', reject)
      listener.listen(port, '127.0.0.1', resolve)
    })
    expect(listener.address()).toMatchObject({ address: '127.0.0.1', port })
  } finally {
    await new Promise<void>((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve()))
    )
  }
})
