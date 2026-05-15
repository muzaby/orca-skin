import type { Backend, InstallStatus } from '../../shared/ipc'
import type { AdapterRegistry } from '../adapters/registry'

export class Installer {
  constructor(private readonly registry: AdapterRegistry) {}

  async *start(backend: Backend): AsyncIterable<InstallStatus> {
    const adapter = this.registry.get(backend)
    if (!adapter) {
      yield {
        step: 'failed',
        error: `Unknown backend: ${backend}`,
        done: true
      }
      return
    }

    for await (const ev of adapter.install()) {
      yield ev
    }

    await this.registry.refreshInstallState()
  }
}
