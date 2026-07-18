// 로그 인제스트 핸들러 (0123 AC7) — renderer/preload 발 orca:log:emit 수신.
// 신뢰 경계: renderer 가 보낸 데이터는 내부 앱 코드라도 외부 입력으로 취급한다 —
// zod(LogInputSchema) + payload 크기 상한을 통과한 것만 emit 하고, 실패는 폐기 + warn 집계
// (RepeatSuppressor 가 60s 창으로 반복을 삼킨다). 공통 필드는 main 이 강제 부여(위조 방지).

import { CHANNELS } from '../../../shared/ipc'
import { LOG_IPC_PAYLOAD_MAX_BYTES } from '../../../shared/logging'
import { LogInputSchema } from '../../../shared/protocol'
import { on } from '../../infra/ipc/handle'
import { emitIngestedLog, getLogger } from '../../infra/log'

export function registerLogHandlers(): void {
  const log = getLogger().child('ipc')
  const rejected = (reason: string): void => {
    log.warn('ipc.payload.rejected', { channel: CHANNELS.logEmit, reason })
  }
  on(
    CHANNELS.logEmit,
    {
      safeParse: (raw: unknown) => {
        // 크기 상한을 스키마보다 먼저 — 초과 payload 는 파싱 비용도 들이지 않는다.
        try {
          if (JSON.stringify(raw).length > LOG_IPC_PAYLOAD_MAX_BYTES) {
            return { success: false as const, error: 'payload too large' }
          }
        } catch {
          return { success: false as const, error: 'payload not serializable' }
        }
        return LogInputSchema.safeParse(raw)
      }
    },
    (input, event) => {
      // sender 의 프로세스 구분은 wire 로 위조 가능하므로 채택하지 않는다 — renderer 프레임
      // (preload 포함 컨텍스트) 발신은 일괄 renderer, windowId 는 실제 sender 에서 부여.
      emitIngestedLog(input, { process: 'renderer', windowId: event.sender.id })
    },
    () => rejected('schema or size')
  )
}
