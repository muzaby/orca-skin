import { useEffect, useState } from 'react'
import type { McpServer } from '../../../../../shared/ipc'
import { mcpApi } from '../../../shared/api/ipc'
import { reportError } from '../../../shared/errors'

/** Keep the last catalog while revalidating on entry and each menu opening. */
export function useComposerMcp(active: boolean, open: boolean): McpServer[] {
  const [servers, setServers] = useState<McpServer[]>([])
  useEffect(() => {
    if (!active) return
    let cancelled = false
    void Promise.resolve()
      .then(() => mcpApi.list())
      .then((items) => {
        if (!cancelled) setServers(items)
      })
      .catch((error) => {
        if (!cancelled)
          reportError({
            event: 'chat.composer.mcp-load-failed',
            scope: 'chat',
            title: 'loadFailed',
            error
          })
      })
    return () => {
      cancelled = true
    }
  }, [active, open])
  return servers
}
