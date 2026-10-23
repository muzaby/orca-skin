import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { NativeResource, OpenCodeDisabledPlugin } from '../../../../shared/native-resources'
import {
  nativeFileMutations,
  type FileMutationCoordinator
} from '../../../infra/config/file-mutation'
import { openCodePluginId, openCodePluginInstallation } from './plugin-installation'
import {
  insertPluginEntry,
  pluginEntries,
  pluginSpec,
  removePluginEntry,
  type PluginEntry
} from './openCodePluginConfig'

export interface PluginRecordStore {
  get(): OpenCodeDisabledPlugin[]
  set(records: OpenCodeDisabledPlugin[]): void
}

export function openCodeGlobalConfigFiles(env = process.env, home = homedir()): string[] {
  const root = join(env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode')
  return ['config.json', 'opencode.json', 'opencode.jsonc'].map((file) => join(root, file))
}

export async function effectiveOpenCodePlugins(
  env = process.env,
  home = homedir()
): Promise<{
  file?: string
  entries: PluginEntry[]
}> {
  let result: { file?: string; entries: PluginEntry[] } = { entries: [] }
  for (const file of openCodeGlobalConfigFiles(env, home)) {
    try {
      const entries = pluginEntries(await readFile(file, 'utf8'))
      if (entries) result = { file, entries }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return result
}

export async function openCodeGlobalPluginFingerprint(
  env = process.env,
  home = homedir()
): Promise<string> {
  const { entries } = await effectiveOpenCodePlugins(env, home)
  return JSON.stringify(entries)
}

/** A single instance is shared by navigation, toggles and the external-file watcher. */
export class OpenCodeGlobalPlugins {
  private tail: Promise<unknown> = Promise.resolve()
  constructor(
    private readonly records: PluginRecordStore,
    private readonly env = process.env,
    private readonly home = homedir(),
    private readonly mutations: Pick<FileMutationCoordinator, 'mutate'> = nativeFileMutations
  ) {}

  private run<T>(action: () => Promise<T>): Promise<T> {
    const task = this.tail.catch(() => undefined).then(action)
    this.tail = task
    return task
  }

  reconcile(): Promise<NativeResource[]> {
    return this.run(async () => {
      const declared = new Set(
        (await effectiveOpenCodePlugins(this.env, this.home)).entries.map(pluginSpec)
      )
      const records = this.records.get()
      const kept: OpenCodeDisabledPlugin[] = []
      const items: NativeResource[] = []
      for (const record of records) {
        const spec = pluginSpec(record.entry)
        if (declared.has(spec)) continue
        const installation = await openCodePluginInstallation(spec, this.home, this.env)
        if (!installation) continue
        kept.push(record)
        items.push({
          id: record.id,
          name: spec.split(/[?#]/)[0].split(/[\\/]/).filter(Boolean).at(-1) ?? 'Plugin',
          kind: 'plugin',
          enabled: false,
          status: 'disabled',
          canToggle: true,
          canOpen: false
        })
      }
      if (kept.length !== records.length) this.records.set(kept)
      return items
    })
  }

  set(item: NativeResource, enabled: boolean): Promise<void> {
    return this.run(async () => {
      const before = this.records.get().find((record) => record.id === item.id)
      const effective = await effectiveOpenCodePlugins(this.env, this.home)
      const index = effective.entries.findIndex(
        (entry) => openCodePluginId(pluginSpec(entry)) === item.id
      )
      const original = enabled
        ? before
        : index >= 0 && effective.file
          ? {
              id: item.id,
              file: effective.file,
              entry: effective.entries[index],
              index
            }
          : undefined
      if (!original)
        throw new Error('OpenCode 플러그인 설정이 변경되었습니다. 목록을 다시 열어 주세요.')
      if (!(await openCodePluginInstallation(pluginSpec(original.entry), this.home, this.env)))
        throw new Error('OpenCode 플러그인 설치 위치를 확인할 수 없습니다.')
      if (enabled && effective.file !== original.file)
        throw new Error('OpenCode 플러그인 설정 파일이 변경되었습니다.')
      const replaceRecord = (record?: OpenCodeDisabledPlugin): void => {
        this.records.set([
          ...this.records.get().filter((value) => value.id !== item.id),
          ...(record ? [record] : [])
        ])
      }
      try {
        await this.mutations.mutate(original.file, (latest) => {
          if (latest === undefined) throw new Error('OpenCode 플러그인 설정 파일이 없습니다.')
          const entries = pluginEntries(latest)
          if (!entries) throw new Error('OpenCode 플러그인 설정이 변경되었습니다.')
          const found = entries.findIndex(
            (entry) => openCodePluginId(pluginSpec(entry)) === item.id
          )
          if (enabled)
            return found >= 0 ? latest : insertPluginEntry(latest, original.entry, original.index)
          if (found < 0) throw new Error('OpenCode 플러그인 설정이 변경되었습니다.')
          replaceRecord({ ...original, entry: entries[found], index: found })
          return removePluginEntry(latest, found)
        })
      } catch (error) {
        if (!enabled) replaceRecord(before)
        throw error
      }
      if (enabled) replaceRecord()
    })
  }
}
