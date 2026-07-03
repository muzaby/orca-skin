// PermissionModeController — 세션 중 권한 모드 전환의 런타임 seam (provider-runtime.md §3).
//
// 권한 모드는 turn-local 이 아니라 **세션 수준** 상태다(대화 전체 속성 — renderer 의
// ChatState.permissionMode 도 세션 단위). 따라서 sessionId 로 키잉한 Map 에 보유하고,
// 다음 턴/라이브 전환 양쪽이 같은 SSOT 를 읽게 한다.
//
// 한계 고지(PR② 시점): 본 클래스는 §3 의 인터페이스·세션 상태 컨테이너를 코드로 앵커하고
// Vitest 로만 운동되는 seam 이다. router/adapter 와이어링과 라이브 `Query.setPermissionMode`
// 위임은 PR③(스트리밍 입력 전환)에서 덧댄다 — RevertManager(§5) 가 머지된 선례와 동일 패턴.

import type { NormalizedPermissionMode } from '../../../shared/permission-mode'

export class PermissionModeController {
  // 키 = sessionId, 값 = 그 세션의 현재 권한 모드. 프로세스 메모리에만 보존(영속 안 함) —
  // sessionAllowedTools(router.ts:94) 와 동일한 세션-스코프 메모리 맵 패턴.
  private readonly modes = new Map<string, NormalizedPermissionMode>()

  // 미설정 세션이 돌려받을 기본 모드. 현 앱 기본(chatReducer 초기값 'plan')과 호환되도록 'plan' 기본.
  constructor(private readonly defaultMode: NormalizedPermissionMode = 'plan') {}

  // 세션의 현재 모드. 미설정 시 생성자 기본값.
  getCurrentMode(sessionId: string): NormalizedPermissionMode {
    return this.modes.get(sessionId) ?? this.defaultMode
  }

  // 세션 모드 설정. §3 인터페이스가 async(라이브 전환은 PR③ 에서 `Query.setPermissionMode`
  // 호출이 더해진다)라 Promise 를 반환한다.
  async setMode(sessionId: string, mode: NormalizedPermissionMode): Promise<void> {
    this.modes.set(sessionId, mode)
  }

  // 세션 삭제 시 정리(메모리 누수 방지). router 의 세션 delete 경로에서 호출 예정(PR③ 와이어).
  forget(sessionId: string): void {
    this.modes.delete(sessionId)
  }
}
