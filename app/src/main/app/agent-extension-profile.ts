import { readFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import type { AgentKind } from '../../shared/agent-kind'
import { resolveAgentProfile } from '../features/agents/profiles'
import type { ExtensionProfile } from '../features/extensions/builder'

export async function prepareAgentExtensionProfile(
  kind: AgentKind,
  workProfilePluginPath: string
): Promise<ExtensionProfile> {
  const profile = resolveAgentProfile(kind)
  const extensionProfile: ExtensionProfile = {
    agentInstructions: profile.instructions,
    agentProfileKey: profile.key
  }
  if (kind !== 'work') return extensionProfile

  try {
    if (!workProfilePluginPath || !isAbsolute(workProfilePluginPath))
      throw new Error('Work profile plugin requires an absolute application resource path')
    const [manifest, style] = await Promise.all([
      readFile(join(workProfilePluginPath, '.claude-plugin', 'plugin.json'), 'utf8'),
      readFile(join(workProfilePluginPath, 'output-styles', 'work.md'), 'utf8')
    ])
    if (JSON.parse(manifest).name !== 'orcinus-orca-work-profile' || !style.trim())
      throw new Error('Invalid Work profile plugin resource')
  } catch (cause) {
    throw new Error('Work 프로필 리소스를 읽을 수 없습니다. 앱 설치 상태를 확인해 주세요.', {
      cause
    })
  }
  return { ...extensionProfile, pluginRoots: [workProfilePluginPath] }
}
