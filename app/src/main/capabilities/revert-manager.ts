// RevertManager — 되돌리기 의미 분리의 런타임 seam (provider-runtime.md §5).
//
// **conversation revert ≠ file revert. 절대 병합 금지.** 대화/메시지 상태 되돌리기와 파일 변경
// snapshot/복원은 별개 개념·별개 capability 라 단일 revert() 로 합치지 않는다 — 메서드를 4개로
// 분리하고 각자 자기 cap 을 가드한다.
//
// 한계 고지(정직한 dead-code): claude 는 §5 의 4 cap 이 전부 false 라 오늘 모든 메서드가 throw
// 하고 호출자도 없다. 본 클래스는 §5 의 의미 분리를 코드로 앵커하고 테스트로만 운동되는 seam 이며,
// 실제 동작 경로는 conversation revert(OpenCode session.revert) 또는 file checkpoint(Claude
// 실험 beta)를 지원하는 백엔드가 cap=true 서술자를 줄 때 활성화된다.

import type { RevertCapabilities } from './types'

export class RevertManager {
  constructor(private readonly caps: RevertCapabilities) {}

  private guard(cap: keyof RevertCapabilities, label: string): void {
    if (!this.caps[cap]) {
      throw new Error(`이 백엔드는 ${label} 을(를) 지원하지 않습니다.`)
    }
  }

  // 대화/메시지 상태를 지정 지점으로 되돌린다(파일 변경과 무관).
  async revertConversation(messageId: string): Promise<void> {
    this.guard('conversationRevert', '대화 되돌리기')
    throw new Error(`revertConversation 미구현 (seam) — messageId=${messageId}`)
  }

  // 직전 conversation revert 를 취소(redo)한다.
  async unrevertConversation(): Promise<void> {
    this.guard('conversationUnrevert', '대화 되돌리기 취소')
    throw new Error('unrevertConversation 미구현 (seam)')
  }

  // 파일 변경 snapshot 을 생성한다(대화 상태와 무관).
  async createFileCheckpoint(): Promise<string> {
    this.guard('fileCheckpointCreate', '파일 체크포인트 생성')
    throw new Error('createFileCheckpoint 미구현 (seam)')
  }

  // 파일을 지정 checkpoint 로 복원한다(대화 상태와 무관).
  async restoreFileCheckpoint(checkpointId: string): Promise<void> {
    this.guard('fileCheckpointRestore', '파일 체크포인트 복원')
    throw new Error(`restoreFileCheckpoint 미구현 (seam) — checkpointId=${checkpointId}`)
  }
}
