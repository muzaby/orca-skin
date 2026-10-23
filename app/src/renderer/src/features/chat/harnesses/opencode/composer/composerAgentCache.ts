import type { NativeComposerCatalog } from '../../../../../../../shared/native-resources'

type Agents = NativeComposerCatalog['agents']

/** Renderer lifetime, with an explicit revision only for global plugin changes. */
export class ComposerAgentCache {
  private value?: Agents
  private revision = 0
  private readonly listeners = new Set<() => void>()
  get = (): Agents | undefined => this.value
  getRevision = (): number => this.revision
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  accept(value: Agents, revision = this.revision): Agents | undefined {
    if (revision !== this.revision) return this.value
    if (this.value === undefined) {
      this.value = value
      this.publish()
    }
    return this.value
  }
  reset(revision: number): boolean {
    if (revision <= this.revision) return false
    this.revision = revision
    this.value = undefined
    this.publish()
    return true
  }
  private publish(): void {
    for (const listener of this.listeners) listener()
  }
}

export const composerAgentCache = new ComposerAgentCache()
