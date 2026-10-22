import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { NativeResource } from '../../../shared/native-resources'
import type { ClaudePluginCatalog } from './plugin-catalog'
import { readClaudeProjectSettings, type ClaudeProjectSettings } from './project-settings'

/** Frozen startup defaults plus live project overrides. Never reloads global defaults. */
export class ClaudeProjectReconciliation {
  private applied: ClaudeProjectSettings
  constructor(
    private readonly deps: {
      cwd: string
      root: string
      configDirSpecified?: boolean
      plugins: ClaudePluginCatalog
      list(): Promise<NativeResource[]>
      set(
        id: string,
        enabled: boolean,
        kind: NativeResource['kind'],
        persist: boolean,
        guard: () => boolean
      ): Promise<void>
    }
  ) {
    this.applied = this.read()
  }
  private read(): ClaudeProjectSettings {
    return readClaudeProjectSettings(this.deps.cwd, this.deps.root, this.deps.configDirSpecified)
  }
  private desired(item: NativeResource, next: ClaudeProjectSettings): boolean {
    if (item.kind === 'plugin') {
      if (
        JSON.stringify(next.plugins[item.name]) === JSON.stringify(this.applied.plugins[item.name])
      )
        return item.enabled
      const flag = next.plugins[item.name]
      return flag === undefined
        ? (this.deps.plugins.defaults[item.name] ?? false)
        : flag === true || Array.isArray(flag) || (typeof flag === 'object' && flag !== null)
    }
    const changed = (key: 'disabledMcp' | 'enabledMcp' | 'disabledProjectMcp'): boolean =>
      next[key].includes(item.id) !== this.applied[key].includes(item.id)
    if (
      !changed('disabledMcp') &&
      !changed('enabledMcp') &&
      !(item.source === 'project' && changed('disabledProjectMcp'))
    )
      return item.enabled
    if (
      next.disabledMcp.includes(item.id) ||
      (item.source === 'project' && next.disabledProjectMcp.includes(item.id))
    )
      return false
    // enabledMcpServers is native opt-in for default-off servers, not a universal allow list.
    if (this.applied.enabledMcp.includes(item.id) || next.enabledMcp.includes(item.id))
      return next.enabledMcp.includes(item.id)
    return true
  }
  preview(items: NativeResource[]): NativeResource[] {
    const next = this.read()
    return items.map((item) => ({ ...item, enabled: this.desired(item, next) }))
  }
  async reconcile(
    revision: string,
    isIdle: () => boolean
  ): Promise<'applied' | 'pending' | 'restart-required'> {
    const next = this.read()
    if (next.revision !== revision || !isIdle()) return 'pending'
    if (next.revision === this.applied.revision) return 'applied'
    if (
      next.structure !== this.applied.structure ||
      JSON.stringify(next.approvedProjectMcp) !== JSON.stringify(this.applied.approvedProjectMcp) ||
      next.approveAll !== this.applied.approveAll
    )
      return 'restart-required'
    const current = await this.deps.list()
    const changes = current.filter((item) => this.desired(item, next) !== item.enabled)
    // Decide whether the whole change can be applied before making any SDK mutation.
    for (const key of new Set([
      ...Object.keys(this.applied.plugins),
      ...Object.keys(next.plugins)
    ])) {
      if (JSON.stringify(next.plugins[key]) === JSON.stringify(this.applied.plugins[key])) continue
      const plugin = this.deps.plugins.installations.find((entry) => entry.key === key)
      if (!plugin) return 'restart-required'
      if (!changes.some((item) => item.kind === 'plugin' && item.name === key)) continue
      const manifest = JSON.parse(
        readFileSync(join(plugin.path, '.claude-plugin/plugin.json'), 'utf8')
      )
      if (manifest.mcpServers || existsSync(join(plugin.path, '.mcp.json')))
        return 'restart-required'
    }
    if (changes.some((item) => item.kind === 'mcp' || !item.canToggle)) return 'restart-required'
    const guard = (): boolean => isIdle() && this.read().revision === revision
    for (const item of changes) {
      if (!guard()) return 'pending'
      await this.deps.set(item.id, this.desired(item, next), item.kind, false, guard)
    }
    if (!guard()) return 'pending'
    this.applied = next
    return 'applied'
  }
}
