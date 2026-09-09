// 세션별 마지막으로 정착한 권한 선택. send/live/계획 승인에서 기록하고 자동 후속 요청이 읽는다.
// 모델·종류 정책과 SDK 전환은 호출부가 적용한다.

import { DEFAULT_PERMISSION_MODE } from '../../../shared/permission-mode'
import type { NormalizedPermissionMode } from '../../../shared/permission-mode'

export class PermissionModeController {
  // 키 = sessionId, 값 = 그 세션의 현재 권한 모드. 프로세스 메모리에만 보존(영속 안 함) —
  // sessionAllowedTools(router.ts:94) 와 동일한 세션-스코프 메모리 맵 패턴.
  private readonly modes = new Map<string, NormalizedPermissionMode>()

  // 미설정 요청의 선호값. 실행 전에 shared 모델·종류 정책을 거친다.
  constructor(private readonly defaultMode: NormalizedPermissionMode = DEFAULT_PERMISSION_MODE) {}

  // 세션의 현재 모드. 미설정 시 생성자 기본값.
  getCurrentMode(sessionId: string): NormalizedPermissionMode {
    return this.modes.get(sessionId) ?? this.defaultMode
  }

  // 적용된 선택을 인메모리에 기록한다.
  async setMode(sessionId: string, mode: NormalizedPermissionMode): Promise<void> {
    this.modes.set(sessionId, mode)
  }

  // 세션 삭제 시 인메모리 기록을 정리한다.
  forget(sessionId: string): void {
    this.modes.delete(sessionId)
  }
}
