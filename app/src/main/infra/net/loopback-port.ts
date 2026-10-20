import { createServer } from 'node:net'

/** Reserve an ephemeral loopback port, releasing the probe before the caller binds it. */
export function allocateLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const listener = createServer()
    listener.once('error', reject)
    listener.listen(0, '127.0.0.1', () => {
      const address = listener.address()
      listener.close((error) => {
        if (error) reject(error)
        else if (address && typeof address !== 'string') resolve(address.port)
        else reject(new Error('전용 포트를 할당하지 못했습니다.'))
      })
    })
  })
}
