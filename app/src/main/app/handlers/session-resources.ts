import {
  CHANNELS,
  NativeResourcesRequestSchema,
  OpenNativePluginSchema,
  SetNativeResourceSchema
} from '../../../shared/protocol'
import type {
  DraftNativeResourcesRequest,
  NativeCommand,
  NativeResource,
  NativeResources,
  SetNativeResource
} from '../../../shared/native-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { handle } from '../../infra/ipc/handle'
import { resourceQuery } from '../../adapters/common/resource-query'
import { shell } from 'electron'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute } from 'node:path'

export function registerSessionResourceHandlers(
  lookup: (sessionId: string) => GovernedLiveTurn | undefined,
  configuredResources: (sessionId: string) => Promise<NativeResource[]> = async () => [],
  configuredPluginDirectory: (
    sessionId: string,
    id: string
  ) => Promise<string | undefined> = async () => undefined,
  configuredCommands?: (sessionId: string) => Promise<NativeCommand[] | undefined>,
  draftCommands: (request: DraftNativeResourcesRequest) => Promise<NativeCommand[]> = async () => []
): void {
  const read = async (
    sessionId: string,
    runtime: GovernedLiveTurn | undefined
  ): Promise<NativeResources> => {
    const [liveRead, configuredRead, commandsRead] = await Promise.allSettled([
      resourceQuery(async () => runtime?.nativeResources?.()),
      resourceQuery(() => configuredResources(sessionId)),
      resourceQuery(async () => configuredCommands?.(sessionId))
    ])
    if (lookup(sessionId) !== runtime)
      throw new Error('하네스 연결이 바뀌었습니다. 메뉴를 다시 열어 주세요.')
    const live = liveRead.status === 'fulfilled' ? liveRead.value : undefined
    if (configuredRead.status === 'rejected' && !live)
      throw new Error('하네스 목록을 불러오지 못했습니다. 다시 시도해 주세요.')
    const configured = configuredRead.status === 'fulfilled' ? configuredRead.value : []
    const partial =
      liveRead.status === 'rejected' ||
      configuredRead.status === 'rejected' ||
      commandsRead.status === 'rejected'
    const commands =
      live?.commands ?? (commandsRead.status === 'fulfilled' ? commandsRead.value : undefined)
    const items = new Map(
      configured.map((item) => [`${item.kind}:${item.id}`, { ...item, canToggle: false }])
    )
    for (const item of live?.items ?? []) {
      const key = `${item.kind}:${item.id}`
      items.set(key, { ...items.get(key), ...item })
    }
    return {
      ...live,
      state: live?.state ?? 'disconnected',
      items: [...items.values()],
      ...(commands ? { commands } : {}),
      ...(partial ? { partial: true } : {})
    }
  }
  handle(
    CHANNELS.sessionNativeResources,
    NativeResourcesRequestSchema,
    'reject',
    async (request): Promise<NativeResources> => {
      if (!('sessionId' in request)) {
        try {
          return {
            state: 'disconnected',
            items: [],
            commands: await resourceQuery(() => draftCommands(request))
          }
        } catch {
          throw new Error('하네스 목록을 불러오지 못했습니다. 다시 시도해 주세요.')
        }
      }
      const { sessionId } = request
      const runtime = lookup(sessionId)
      return read(sessionId, runtime)
    }
  )
  handle(
    CHANNELS.sessionOpenNativePlugin,
    OpenNativePluginSchema,
    'reject',
    async ({ sessionId, id }): Promise<void> => {
      try {
        const runtime = lookup(sessionId)
        const directory = await resourceQuery(
          async () =>
            (await runtime?.nativePluginDirectory?.(id)) ??
            (await configuredPluginDirectory(sessionId, id))
        )
        if (!directory || !isAbsolute(directory)) throw new Error('unknown installation')
        const resolved = await realpath(directory)
        if (!(await stat(resolved)).isDirectory() || lookup(sessionId) !== runtime)
          throw new Error('installation changed')
        const error = await shell.openPath(resolved)
        if (error) throw new Error('open failed')
      } catch {
        throw new Error('플러그인 설치 폴더를 열 수 없습니다. 설치 상태를 확인해 주세요.')
      }
    }
  )
  handle(
    CHANNELS.sessionSetNativeResource,
    SetNativeResourceSchema,
    'reject',
    async (request: SetNativeResource): Promise<NativeResources> => {
      const runtime = lookup(request.sessionId)
      if (!runtime?.setNativeResource) throw new Error('실행 중인 하네스에 연결되어 있지 않습니다.')
      const current = await resourceQuery(async () => runtime.nativeResources?.())
      if (current?.generation !== request.generation || lookup(request.sessionId) !== runtime)
        throw new Error('하네스 연결이 바뀌었습니다. 메뉴를 다시 열어 주세요.')
      if (
        !current.items.some(
          (item) => item.id === request.id && item.kind === request.kind && item.canToggle
        )
      )
        throw new Error('이 항목은 세션별 제어를 지원하지 않습니다.')
      await runtime.setNativeResource(request)
      return read(request.sessionId, runtime)
    }
  )
}
