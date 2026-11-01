import { fileFingerprints, FingerprintWatch } from '../../../infra/config/fingerprint-watch'

/** OpenCode supplies its semantic plugin fingerprint and discovery invalidation barrier. */
export class OpenCodeGlobalWatch extends FingerprintWatch {
  constructor(deps: {
    files: string[]
    fingerprint(): Promise<string>
    dirty?(): void
    changed(revision: number): void
    extensionsChanged?(): void
    failed(error: unknown): void
  }) {
    let previous: string | undefined
    let current: string | undefined
    let revision = 0
    let initializing = true
    super({
      ...deps,
      fingerprint: async () => {
        const initial = initializing
        initializing = false
        current = await deps.fingerprint()
        if (initial) previous = current
        return deps.extensionsChanged
          ? JSON.stringify([current, await fileFingerprints(deps.files)])
          : current
      },
      changed: () => {
        if (current !== previous) {
          previous = current
          deps.changed(++revision)
        }
        deps.extensionsChanged?.()
      }
    })
  }
}
