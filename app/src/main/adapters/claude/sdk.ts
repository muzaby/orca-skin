import type { Query, SDKMessage } from '@anthropic-ai/claude-agent-sdk'

let resolved: typeof import('@anthropic-ai/claude-agent-sdk') | undefined
let pending: Promise<typeof import('@anthropic-ai/claude-agent-sdk')> | undefined

/** Share the first import across history, tools, completions and live channels. */
export function loadClaudeSdk(): Promise<typeof import('@anthropic-ai/claude-agent-sdk')> {
  pending ??= import('@anthropic-ai/claude-agent-sdk')
    .then((sdk) => {
      resolved = sdk
      return sdk
    })
    .catch((error) => {
      pending = undefined
      throw error
    })
  return pending
}

type DeferredQuery = AsyncIterable<SDKMessage> &
  Pick<
    Query,
    | 'close'
    | 'reinitialize'
    | 'setModel'
    | 'setPermissionMode'
    | 'applyFlagSettings'
    | 'interrupt'
    | 'stopTask'
    | 'backgroundTasks'
    | 'mcpServerStatus'
    | 'toggleMcpServer'
    | 'supportedCommands'
    | 'reloadPlugins'
  >

/** Keep LiveTurn synchronous while SDK creation and its controls wait for the same import. */
export function deferClaudeQuery(
  create: (sdk: Awaited<ReturnType<typeof loadClaudeSdk>>) => Query
): DeferredQuery {
  if (resolved) return create(resolved)
  let closed = false
  let loaded: Query | undefined
  const ready = loadClaudeSdk().then((sdk) => {
    if (closed) throw new DOMException('Channel closed before SDK initialization', 'AbortError')
    loaded = create(sdk)
    return loaded
  })
  // Consumers observe the original failure through iteration/control; close may happen first.
  void ready.catch(() => undefined)
  return {
    async *[Symbol.asyncIterator]() {
      yield* await ready
    },
    close() {
      closed = true
      loaded?.close?.()
    },
    reinitialize: async () => (await ready).reinitialize(),
    setModel: async (...args) => (await ready).setModel(...args),
    setPermissionMode: async (...args) => (await ready).setPermissionMode(...args),
    applyFlagSettings: async (...args) => (await ready).applyFlagSettings(...args),
    interrupt: async () => (await ready).interrupt(),
    stopTask: async (...args) => (await ready).stopTask(...args),
    backgroundTasks: async (...args) => (await ready).backgroundTasks(...args),
    mcpServerStatus: async () => (await ready).mcpServerStatus(),
    toggleMcpServer: async (...args) => (await ready).toggleMcpServer(...args),
    supportedCommands: async () => (await ready).supportedCommands(),
    reloadPlugins: async () => (await ready).reloadPlugins()
  }
}
