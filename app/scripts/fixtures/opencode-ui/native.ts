import type { AgentEnvironment } from '../../../src/shared/ipc'
import { emptyBackgroundState } from '../../../src/shared/background-task'
import { useAgentStore } from '../../../src/renderer/src/shared/stores/agentStore'
import { useBackendStore } from '../../../src/renderer/src/features/backend/store/backendStore'

export const nativeCalls: { operation: string; args: unknown[] }[] = []
let settings = {
  theme: 'white',
  uiLocale: 'ko',
  transcriptTextSize: 'medium',
  transcriptWidth: 'medium',
  sidebarCollapsed: false,
  sidebarWidth: 248,
  appFont: 'sans',
  notifyOnComplete: false,
  spendingLimitUsd: 90
}
const agents: AgentEnvironment[] = ['claude', 'opencode'].map((adapter) => ({
  key: `${adapter}:fixture`,
  adapter: adapter as AgentEnvironment['adapter'],
  provider: `${adapter} fixture`,
  source: 'settings',
  supported: true,
  models: [
    {
      alias: '검증 모델',
      model: 'fixture',
      isCustom: true,
      isDefault: true,
      oneMillionContext: false
    }
  ]
}))

async function call(namespace: string, method: string, args: unknown[]): Promise<unknown> {
  nativeCalls.push({ operation: `${namespace}.${method}`, args })
  if (namespace === 'settings') {
    if (method === 'set') settings = { ...settings, ...(args[0] as object) }
    return settings
  }
  if (namespace === 'agent') return agents
  if (namespace === 'permission') {
    if (method === 'setMode') return (args[0] as { mode: string }).mode
    return undefined
  }
  if (namespace === 'git') {
    if (method === 'snapshot') return { status: { isRepo: false }, summary: null }
    return { isRepo: false }
  }
  if (namespace === 'chat') {
    if (method === 'backgroundState') return emptyBackgroundState()
    if (method === 'send') throw new Error('UI fixture는 실제 모델에 송신하지 않습니다.')
    return undefined
  }
  if (namespace === 'boot') return { status: 'ready', failures: [] }
  if (namespace === 'provider') return method === 'state' ? { providers: [] } : []
  if (namespace === 'files') {
    if (method === 'pickDirectory') return null
    if (method === 'pickAttachments')
      return [
        {
          path: 'C:/fixture/sample.md',
          name: 'sample.md',
          mimeType: 'text/markdown',
          sizeBytes: 12
        }
      ]
    return []
  }
  if (['skills', 'artifacts', 'project', 'mcp', 'session'].includes(namespace)) return []
  return undefined
}

export function installNativeFixture(): void {
  // IPC만 메모리 대역이다. 실파일·설정·인증·프로세스·외부 모델에 연결되는 메서드는 없다.
  window.orca = new Proxy(
    { platform: 'win32' },
    {
      get(target, namespace: string) {
        if (namespace === 'platform') return target.platform
        return new Proxy(
          {},
          {
            get(_target, method: string) {
              if (method.startsWith('on')) return () => () => {}
              if (namespace === 'files' && method === 'pathForFile')
                return () => 'C:/fixture/sample.md'
              return (...args: unknown[]) => call(namespace, method, args)
            }
          }
        )
      }
    }
  ) as typeof window.orca
  useAgentStore.setState({ agents, loaded: true, loading: false, error: null })
  useBackendStore.setState({
    active: 'opencode',
    list: [
      { id: 'opencode', installed: true },
      { id: 'claude', installed: true }
    ],
    loading: false
  })
}
