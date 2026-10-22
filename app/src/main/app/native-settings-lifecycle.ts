/** Accept no new saves, drain accepted saves, then retire runtime owners and their files. */
export function nativeSettingsShutdown(deps: {
  freeze(): void
  drain(): Promise<void>
  shutdown(): void
  cleanup(): Promise<void>
}): () => Promise<void> {
  let pending: Promise<void> | undefined
  return () => {
    pending ??= (async () => {
      deps.freeze()
      await deps.drain()
      deps.shutdown()
      await deps.cleanup()
    })()
    return pending
  }
}

export function registerNativeSettingsQuit(
  app: {
    on(event: 'before-quit', listener: (event: { preventDefault(): void }) => void): unknown
    quit(): void
  },
  prepare: () => Promise<void> | undefined,
  failed: () => void
): void {
  let drained = false
  let draining = false
  app.on('before-quit', (event) => {
    if (drained) return
    if (draining) {
      event.preventDefault()
      return
    }
    const pending = prepare()
    if (!pending) return
    event.preventDefault()
    draining = true
    void pending.catch(failed).finally(() => {
      drained = true
      app.quit()
    })
  })
}
