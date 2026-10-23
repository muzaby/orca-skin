import { shell } from 'electron'
import {
  CHANNELS,
  GlobalNativeResourcesSchema,
  GlobalNativeResourceTargetSchema,
  SetGlobalNativeResourceSchema
} from '../../../shared/protocol'
import type { Backend } from '../../../shared/ipc'
import type {
  NativeResource,
  NativeResources,
  SetGlobalNativeResourceResult
} from '../../../shared/native-resources'
import { extensionChoiceKey } from '../../adapters/common/extension-control'
import { handle } from '../../infra/ipc/handle'
import type { MutableExtensionControl } from '../extension-control'
import { harnessModule } from '../harnesses/registry'

export function registerExtensionCatalogHandlers(
  control: MutableExtensionControl,
  deps?: {
    openCodeSessions(): number
    plugins: {
      reconcile(): Promise<NativeResource[]>
      set(item: NativeResource, enabled: boolean): Promise<void>
    }
    change(action: () => Promise<void>): Promise<void>
  }
): void {
  const read = async (backend: Backend): Promise<NativeResources> => {
    const recorded = backend === 'opencode' ? ((await deps?.plugins.reconcile()) ?? []) : []
    const items = [...((await harnessModule(backend).globalResources?.()) ?? []), ...recorded]
    const choices = control.global(backend)
    return {
      state: 'disconnected',
      items: items.map((item) => {
        const choice =
          item.canToggle && !(backend === 'opencode' && item.kind === 'plugin')
            ? choices[extensionChoiceKey(item.kind, item.name)]
            : undefined
        return choice === undefined
          ? item
          : { ...item, enabled: choice, status: choice ? 'configured' : 'disabled' }
      })
    }
  }
  handle(CHANNELS.extensionCatalog, GlobalNativeResourcesSchema, 'reject', ({ backend }) =>
    read(backend)
  )
  handle(
    CHANNELS.extensionSetEnabled,
    SetGlobalNativeResourceSchema,
    'reject',
    async (request): Promise<SetGlobalNativeResourceResult> => {
      const catalog = await read(request.backend)
      const item = catalog.items.find(
        (item) => item.kind === request.kind && item.id === request.id
      )
      if (!item?.canToggle)
        throw new Error('이 항목은 Orca에서 전역 활성 상태를 제어할 수 없습니다.')
      if (request.backend === 'opencode' && item.kind === 'plugin') {
        if (!deps) throw new Error('OpenCode 플러그인 제어가 준비되지 않았습니다.')
        const sessions = deps.openCodeSessions()
        if (sessions > 0 && !request.confirmed)
          return { status: 'confirm', reason: 'opencode-restart', sessions }
        await deps.change(() => deps.plugins.set(item, request.enabled))
      } else
        control.setGlobal(
          request.backend,
          extensionChoiceKey(item.kind, item.name),
          request.enabled
        )
      // No server access here. Existing directory instances retain their captured choices.
      return { status: 'applied', resources: await read(request.backend) }
    }
  )
  handle(
    CHANNELS.extensionOpen,
    GlobalNativeResourceTargetSchema,
    'reject',
    async ({ backend, id, kind }) => {
      const catalog = await read(backend)
      if (!catalog.items.some((item) => item.kind === kind && item.id === id && item.canOpen))
        throw new Error('이 항목의 설정 위치를 열 수 없습니다.')
      const file = await harnessModule(backend).globalResourcePath?.(id, kind)
      if (!file) throw new Error('이 항목의 설정 위치를 열 수 없습니다.')
      if (kind === 'mcp') shell.showItemInFolder(file)
      else if (await shell.openPath(file)) throw new Error('플러그인 폴더를 열 수 없습니다.')
    }
  )
}
