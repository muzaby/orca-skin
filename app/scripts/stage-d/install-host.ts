import { ClaudeAdapter } from '../../src/main/adapters/claude/adapter'
import { AdapterRegistry } from '../../src/main/adapters/common/registry'
import { registerMiscHandlers } from '../../src/main/app/handlers/misc'
import { createPortTransport } from '../../src/main/app/host-port-server'
import { wrapPort, type ParentPort } from '../../src/main/app/host-runtime'
import { setIpcTransport } from '../../src/main/infra/ipc/transport'
import type { InstallStatus } from '../../src/shared/ipc'

const parent = (process as typeof process & { parentPort: ParentPort }).parentPort
const transport = createPortTransport()
setIpcTransport(transport)
let resume: (() => void) | undefined
const gate = (): Promise<void> =>
  new Promise((resolve) => {
    resume = resolve
  })
transport.handle('stage-d:advance', () => {
  resume?.()
  resume = undefined
})
let count = 0
const production = new ClaudeAdapter()
class FixtureAdapter extends ClaudeAdapter {
  override async *install(): AsyncGenerator<InstallStatus> {
    const generation = ++count
    if (generation === 1) {
      yield* production.install()
      return
    }
    for (let i = 0; i < 10_000; i++) yield { step: 'installing', log: 'line-' + i + '\n' }
    // A separate status flushes the batch before the fixture releases the next stage.
    yield { step: 'installing', progress: 0.5 }
    await gate()
    yield { step: 'installing', log: 'a'.repeat(65_536) + '\nsplit-' }
    yield { step: 'installing', log: 'line\n' }
    yield { step: 'installing', progress: 0.9 }
    await gate()
    yield { step: 'installing', log: 'generation-' + generation + '-end\n' }
    yield generation === 2
      ? { step: 'failed', error: 'fixture-error', done: true }
      : { step: 'complete', done: true }
  }
}
const registry = new AdapterRegistry([new FixtureAdapter()], null)
registerMiscHandlers({ registry } as Parameters<typeof registerMiscHandlers>[0])
parent.on('message', ({ ports }) => {
  if (!ports.length) return
  transport.connect(wrapPort(ports[0]), { clientId: 1, trusted: true })
  parent.postMessage('connected')
})
parent.postMessage('ready')
