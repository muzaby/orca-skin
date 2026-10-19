import {
  CHANNELS,
  NativeResourcesRequestSchema,
  SetNativeResourceSchema
} from '../../../shared/protocol'
import type { NativeResources, SetNativeResource } from '../../../shared/native-resources'
import type { GovernedLiveTurn } from '../../contracts/ports'
import { handle } from '../../infra/ipc/handle'

export function registerSessionResourceHandlers(
  lookup: (sessionId: string) => GovernedLiveTurn | undefined
): void {
  handle(
    CHANNELS.sessionNativeResources,
    NativeResourcesRequestSchema,
    'reject',
    async ({ sessionId }): Promise<NativeResources> => {
      const runtime = lookup(sessionId)
      const result = (await runtime?.nativeResources?.()) ?? {
        state: 'disconnected' as const,
        items: []
      }
      if (lookup(sessionId) !== runtime)
        throw new Error('하네스 연결이 바뀌었습니다. 메뉴를 다시 열어 주세요.')
      return result
    }
  )
  handle(
    CHANNELS.sessionSetNativeResource,
    SetNativeResourceSchema,
    'reject',
    async (request: SetNativeResource): Promise<NativeResources> => {
      const runtime = lookup(request.sessionId)
      if (!runtime?.setNativeResource) throw new Error('실행 중인 하네스에 연결되어 있지 않습니다.')
      const current = await runtime.nativeResources?.()
      if (current?.generation !== request.generation || lookup(request.sessionId) !== runtime)
        throw new Error('하네스 연결이 바뀌었습니다. 메뉴를 다시 열어 주세요.')
      if (
        !current.items.some(
          (item) => item.id === request.id && item.kind === request.kind && item.canToggle
        )
      )
        throw new Error('이 항목은 세션별 제어를 지원하지 않습니다.')
      await runtime.setNativeResource(request)
      const result = (await runtime.nativeResources?.()) ?? {
        state: 'disconnected' as const,
        items: []
      }
      if (lookup(request.sessionId) !== runtime)
        throw new Error('하네스 연결이 바뀌었습니다. 메뉴를 다시 열어 주세요.')
      return result
    }
  )
}
