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
import { shareNativeResource, type NativeResourceSharing } from '../native-resource-sharing'
import type { ProjectResourceSync, ResourceRequest } from '../project-resource-sync'

export function registerSessionResourceHandlers(
  lookup: (sessionId: string) => GovernedLiveTurn | undefined,
  configuredResources: (sessionId: string) => Promise<NativeResource[] | undefined> = async () =>
    undefined,
  configuredPluginDirectory: (
    sessionId: string,
    id: string
  ) => Promise<string | undefined> = async () => undefined,
  configuredCommands?: (sessionId: string) => Promise<NativeCommand[] | undefined>,
  draftCommands: (
    request: DraftNativeResourcesRequest
  ) => Promise<NativeCommand[]> = async () => [],
  draftResources: (
    request: DraftNativeResourcesRequest
  ) => Promise<NativeResource[] | undefined> = async () => undefined,
  draftPluginDirectory: (
    request: DraftNativeResourcesRequest,
    id: string
  ) => Promise<string | undefined> = async () => undefined,
  configuredMcpFile: (
    request: { sessionId: string } | DraftNativeResourcesRequest,
    id: string
  ) => Promise<string | undefined> = async () => undefined,
  sharing?: NativeResourceSharing,
  projectSync?: ProjectResourceSync,
  preparedMcp?: import('../prepared-mcp-resources').PreparedMcpResources
): (request: ResourceRequest) => Promise<NativeResources> {
  const senders = new WeakSet<Electron.WebContents>()
  const observations = new WeakMap<GovernedLiveTurn, NativeResources>()
  const mutations = new Map<GovernedLiveTurn | string, Promise<void>>()
  const mutate = async (
    runtime: GovernedLiveTurn,
    action: () => Promise<NativeResources>,
    scope?: string
  ): Promise<NativeResources> => {
    if (scope && sharing?.run) return sharing.run(scope, action)
    const key = scope ?? runtime
    const result = (mutations.get(key) ?? Promise.resolve()).then(action)
    // The caller owns the rejection; the queue must allow the following operation to run.
    const tail = result.then(
      () => undefined,
      () => undefined
    )
    mutations.set(key, tail)
    try {
      return await result
    } finally {
      if (mutations.get(key) === tail) mutations.delete(key)
    }
  }
  const read = async (
    sessionId: string,
    runtime: GovernedLiveTurn | undefined,
    attempt = 0
  ): Promise<NativeResources> => {
    const revision = preparedMcp?.revision
    const [liveRead, configuredRead, commandsRead] = await Promise.allSettled([
      resourceQuery(async () => runtime?.nativeResources?.()),
      resourceQuery(() => configuredResources(sessionId)),
      resourceQuery(async () => configuredCommands?.(sessionId))
    ])
    if (lookup(sessionId) !== runtime)
      throw new Error('하네스 연결이 바뀌었습니다. 메뉴를 다시 열어 주세요.')
    if (runtime && preparedMcp?.revision !== revision) {
      if (attempt === 0) return read(sessionId, runtime, 1)
      return {
        state: 'disconnected',
        partial: true,
        configurationPending: true,
        items: (configuredRead.status === 'fulfilled' ? (configuredRead.value ?? []) : []).map(
          (item) => ({ ...item, canToggle: false })
        )
      }
    }
    const previous = runtime && observations.get(runtime)
    const fallback =
      previous?.generation && previous.generation === runtime?.providerGeneration
        ? previous
        : undefined
    let live =
      liveRead.status === 'fulfilled'
        ? liveRead.value
        : (fallback ??
          (runtime?.providerGeneration
            ? { state: 'connected' as const, generation: runtime.providerGeneration, items: [] }
            : undefined))
    if (live?.state !== 'connected') live = (await preparedMcp?.read({ sessionId })) ?? live
    if (runtime && liveRead.status === 'fulfilled' && live?.generation)
      observations.set(runtime, live)
    if (configuredRead.status === 'rejected' && live?.state !== 'connected' && !live?.items.length)
      throw new Error('하네스 목록을 불러오지 못했습니다. 다시 시도해 주세요.')
    const configured = configuredRead.status === 'fulfilled' ? (configuredRead.value ?? []) : []
    const pluginsAuthoritative =
      configuredRead.status === 'fulfilled' && configuredRead.value !== undefined
    const partial =
      liveRead.status === 'rejected' ||
      configuredRead.status === 'rejected' ||
      commandsRead.status === 'rejected' ||
      live?.partial === true
    const commands =
      live?.commands ?? (commandsRead.status === 'fulfilled' ? commandsRead.value : undefined)
    const items = new Map(
      configured.map((item) => [`${item.kind}:${item.id}`, { ...item, canToggle: false }])
    )
    for (const item of live?.items ?? []) {
      const key = `${item.kind}:${item.id}`
      if (item.kind === 'plugin' && pluginsAuthoritative && !items.has(key)) continue
      items.set(key, { ...items.get(key), ...item })
    }
    const value: NativeResources = {
      ...live,
      state: live?.state ?? 'disconnected',
      items: [...items.values()],
      ...(commands ? { commands } : {}),
      ...(partial ? { partial: true } : {}),
      ...(pluginsAuthoritative ? { pluginsAuthoritative: true } : {})
    }
    if (preparedMcp?.revision !== revision && !live?.generation)
      return {
        state: 'disconnected',
        partial: true,
        configurationPending: true,
        items: configured.map((item) => ({ ...item, canToggle: false }))
      }
    return projectSync?.decorate({ sessionId }, value) ?? value
  }
  const readRequest = async (request: ResourceRequest): Promise<NativeResources> => {
    if ('sessionId' in request) return read(request.sessionId, lookup(request.sessionId))
    const revision = preparedMcp?.revision
    const [items, commands] = await Promise.all([
      resourceQuery(() => draftResources(request)),
      resourceQuery(() => draftCommands(request))
    ])
    const prepared = await preparedMcp?.read(request)
    if (preparedMcp?.revision !== revision && !prepared?.generation)
      return {
        state: 'disconnected',
        partial: true,
        configurationPending: true,
        items: (items ?? []).map((item) => ({ ...item, canToggle: false }))
      }
    return {
      ...prepared,
      state: 'disconnected',
      ...(prepared ? { state: prepared.state } : {}),
      items: [
        ...new Map(
          [
            ...(items ?? []).map((item) => ({ ...item, canToggle: false })),
            ...(prepared?.items ?? [])
          ].map((item) => [`${item.kind}:${item.id}`, item])
        ).values()
      ],
      commands,
      ...(items !== undefined ? { pluginsAuthoritative: true } : {})
    }
  }
  handle(
    CHANNELS.sessionNativeResources,
    NativeResourcesRequestSchema,
    'reject',
    async (request, event): Promise<NativeResources> => {
      const { observation, ...scope } = request
      if (observation) {
        preparedMcp?.observe(event.sender.id, observation, scope)
        if (!senders.has(event.sender)) {
          senders.add(event.sender)
          const clear = (): void => {
            preparedMcp?.releaseSender(event.sender.id)
            projectSync?.releasePrefix(`${event.sender.id}:`)
          }
          event.sender.once('destroyed', clear)
          event.sender.on('render-process-gone', clear)
          event.sender.on('did-start-navigation', (_event, _url, inPlace, main) => {
            if (main && !inPlace) clear()
          })
        }
      }
      if (observation && projectSync) {
        const prefix = `${event.sender.id}:`
        const owner = prefix + observation.owner
        if (!observation.active) {
          projectSync.release(owner)
          return { state: 'disconnected', items: [] }
        }
        projectSync.observe(owner, scope, (resources) => {
          if (!event.sender.isDestroyed())
            event.sender.send(
              CHANNELS.sessionNativeResourcesChanged,
              'sessionId' in scope
                ? { sessionId: scope.sessionId, resources }
                : { scope, resources }
            )
        })
        return { state: 'disconnected', items: [] }
      }
      projectSync?.retry(scope)
      if (!('sessionId' in request)) {
        try {
          return await readRequest(scope)
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
    async (request): Promise<void> => {
      try {
        const sessionId = 'sessionId' in request ? request.sessionId : undefined
        const { id } = request
        const runtime = sessionId ? lookup(sessionId) : undefined
        if (request.kind === 'mcp') {
          const file = await resourceQuery(() => configuredMcpFile(request, id))
          if (!file || !isAbsolute(file)) throw new Error('unknown configuration')
          const resolved = await realpath(file)
          if (!(await stat(resolved)).isFile() || (sessionId && lookup(sessionId) !== runtime))
            throw new Error('configuration changed')
          shell.showItemInFolder(resolved)
          return
        }
        const directory = await resourceQuery(async () => {
          if (!('sessionId' in request)) return draftPluginDirectory(request, id)
          const { sessionId } = request
          const configured = await configuredResources(sessionId)
          if (configured !== undefined) return configuredPluginDirectory(sessionId, id)
          return (
            (await runtime?.nativePluginDirectory?.(id)) ??
            (await configuredPluginDirectory(sessionId, id))
          )
        })
        if (!directory || !isAbsolute(directory)) throw new Error('unknown installation')
        const resolved = await realpath(directory)
        if (!(await stat(resolved)).isDirectory() || (sessionId && lookup(sessionId) !== runtime))
          throw new Error('installation changed')
        const error = await shell.openPath(resolved)
        if (error) throw new Error('open failed')
      } catch {
        if (request.kind === 'mcp')
          throw new Error('MCP 설정 파일 위치를 열 수 없습니다. 파일 기반 설정을 확인해 주세요.')
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
      const scope = sharing?.scope(request.sessionId)
      return mutate(
        runtime,
        async () => {
          const live = await resourceQuery(async () => runtime.nativeResources?.())
          const current =
            live && (projectSync?.decorate({ sessionId: request.sessionId }, live) ?? live)
          if (
            current?.generation !== request.generation ||
            lookup(request.sessionId) !== runtime ||
            sharing?.scope(request.sessionId) !== scope
          )
            throw new Error('하네스 연결이 바뀌었습니다. 메뉴를 다시 열어 주세요.')
          if (
            !current.items.some(
              (item) => item.id === request.id && item.kind === request.kind && item.canToggle
            )
          )
            throw new Error('이 항목은 프로젝트별 제어를 지원하지 않습니다.')
          if (request.kind === 'plugin') {
            const installed = await resourceQuery(() => configuredResources(request.sessionId))
            if (
              installed &&
              !installed.some((item) => item.kind === 'plugin' && item.id === request.id)
            )
              throw new Error('이 플러그인은 현재 작업 경로에 설치되어 있지 않습니다.')
            if (
              lookup(request.sessionId) !== runtime ||
              sharing?.scope(request.sessionId) !== scope
            )
              throw new Error('하네스 연결이 바뀌었습니다. 메뉴를 다시 열어 주세요.')
          }
          return shareNativeResource(request, runtime, scope, sharing, lookup, read)
        },
        scope
      )
    }
  )
  return readRequest
}
