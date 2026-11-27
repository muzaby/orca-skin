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
import { resourceChoiceKey } from '../../adapters/common/extension-control'
import { handle } from '../../infra/ipc/handle'
import type { MutableExtensionControl } from '../extension-control'
import { harnessModule } from '../harnesses/registry'
import { shellServices } from '../../infra/shell-services'

interface CatalogInputs {
  items: NativeResource[]
  live: { sessionId: string; items?: NativeResource[] }[]
}

function projectCatalog(catalog: CatalogInputs, choices: Record<string, boolean>): NativeResources {
  return {
    state: catalog.live.length ? 'connected' : 'disconnected',
    items: catalog.items.map((item) => {
      const key = resourceChoiceKey(item)
      const selected = item.canToggle ? (choices[key] ?? item.selected ?? item.enabled) : undefined
      const states = catalog.live.map(({ sessionId, items }) => {
        const actual = items?.find((candidate) =>
          item.managedSource
            ? candidate.managedSource?.kind === item.managedSource.kind &&
              candidate.managedSource.sourceId === item.managedSource.sourceId
            : !candidate.managedSource && candidate.kind === item.kind && candidate.id === item.id
        )
        return {
          sessionId,
          status: actual?.status ?? ('configured' as const),
          ...(actual?.controlReason
            ? { reason: actual.controlReason }
            : !actual
              ? { reason: items ? '이 세션에 미등록' : '실행 상태를 확인할 수 없습니다' }
              : {})
        }
      })
      const status =
        states.length &&
        states.every(
          (s) => s.status === states[0].status && (s.status !== 'configured' || !s.reason)
        )
          ? states[0].status
          : item.status
      const pendingSessions = states.filter(
        (s) =>
          selected !== undefined &&
          (selected ? s.status !== 'enabled' && s.status !== 'connected' : s.status !== 'disabled')
      ).length
      return {
        ...item,
        selected,
        status,
        enabled: ['connected', 'enabled'].includes(status),
        ...(states.length ? { observations: states, pendingSessions } : {})
      }
    })
  }
}
export function registerExtensionCatalogHandlers(
  control: MutableExtensionControl,
  changed: (backend: Backend) => void = () => undefined,
  managed: () => Promise<NativeResource[]> = async () => [],
  observations: (
    backend: Backend
  ) => Promise<{ sessionId: string; items?: NativeResource[] }[]> = async () => []
): void {
  const discover = async (backend: Backend): Promise<CatalogInputs> => {
    const [native, injected, live] = await Promise.all([
      harnessModule(backend).globalResources?.(),
      managed(),
      observations(backend)
    ])
    return { items: [...(native ?? []), ...injected], live }
  }
  const read = async (backend: Backend): Promise<NativeResources> =>
    projectCatalog(await discover(backend), control.global(backend))
  handle(CHANNELS.extensionCatalog, GlobalNativeResourcesSchema, 'reject', ({ backend }) =>
    read(backend)
  )
  handle(
    CHANNELS.extensionSetEnabled,
    SetGlobalNativeResourceSchema,
    'reject',
    async (request): Promise<SetGlobalNativeResourceResult> => {
      const catalog = await discover(request.backend)
      const item = catalog.items.find(
        (item) =>
          item.kind === request.kind &&
          item.id === request.id &&
          item.managedSource?.kind === request.managedSource?.kind &&
          item.managedSource?.sourceId === request.managedSource?.sourceId
      )
      if (!item?.canToggle)
        throw new Error('이 항목은 Orcinus orca에서 전역 활성 상태를 제어할 수 없습니다.')
      await control.setGlobal(request.backend, resourceChoiceKey(item), request.enabled)
      changed(request.backend)
      return {
        status: 'applied',
        resources: projectCatalog(catalog, control.global(request.backend))
      }
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
      if (kind === 'mcp') await shellServices().call('external.showItemInFolder', file)
      else if (await shellServices().call('external.openPath', file))
        throw new Error('플러그인 폴더를 열 수 없습니다.')
    }
  )
}
