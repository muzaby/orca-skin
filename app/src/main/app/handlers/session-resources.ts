import type {
  DraftNativeResourcesRequest,
  NativeCommand,
  NativeResource,
  NativeResources
} from '../../../shared/native-resources'
import { CHANNELS, NativeResourcesRequestSchema } from '../../../shared/protocol'
import { resourceQuery } from '../../adapters/common/resource-query'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { handle } from '../../infra/ipc/handle'
import type { ProjectResourceSync, ResourceRequest } from '../project-resource-sync'

export function registerSessionResourceHandlers({
  lookup,
  configuredResources = async () => undefined,
  configuredCommands,
  draftCommands = async () => [],
  draftResources = async () => undefined,
  projectSync,
  preparedMcp
}: {
  lookup: (sessionId: string) => GovernedLiveTurn | undefined
  configuredResources?: (sessionId: string) => Promise<NativeResource[] | undefined>
  configuredCommands?: (sessionId: string) => Promise<NativeCommand[] | undefined>
  draftCommands?: (request: DraftNativeResourcesRequest) => Promise<NativeCommand[]>
  draftResources?: (request: DraftNativeResourcesRequest) => Promise<NativeResource[] | undefined>
  projectSync?: ProjectResourceSync
  preparedMcp?: import('../prepared-mcp-resources').PreparedMcpResources
}): (request: ResourceRequest) => Promise<NativeResources> {
  const senders = new WeakSet<Electron.WebContents>()
  const observations = new WeakMap<GovernedLiveTurn, NativeResources>()
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
  return readRequest
}
