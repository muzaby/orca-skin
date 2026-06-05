// claude-code 정적 능력 서술자 (CapabilityProbe 구현).
//
// claude probe 는 **정적 서술자**(문서 지식 기반)를 반환한다. SDK 메서드를 import/호출해
// 런타임 introspection 하지는 않는다 — 능력은 세션별이 아니라 backend 별로 고정이고, 타입
// 시그니처로 확정되는 능력은 호출 없이도 spec 문서로 검증되기 때문이다. 각 필드는 출처 태그로
// audit trail 을 남긴다. 정본 근거: docs/spec/claude/agent-sdk/typescript.md.
//   [검증-타입]       SDK 타입 시그니처로 확정 (spec 문서 근거). 런타임 호출 불요.
//   [검증-런타임]     실제 구동/소비로 동작이 확인됨.
//   [미확인-런타임]   타입은 존재하나 런타임 동작/형식이 미검증 — 구동 검증 필요.
//   [N/A-claude]      Claude SDK 에 대응 개념 없음 (OpenCode 전용 능력).
//   [미확인-opencode] OpenCode SDK 미설치로 미정 — 설치 후 introspection 으로 확정 (보존).
//
// (구 주석의 "두 SDK 미설치" 일괄 전제는 Claude 축에선 부정확했다: Claude Agent SDK 타입은
//  리포에 버전관리된 spec 문서로 확정 가능하다. OpenCode 축만 여전히 미설치라 그쪽 미정 필드는
//  [미확인-opencode] 로 보존한다. provider-runtime.md §13 참조.)

import type { CapabilityProbe, ProviderDescriptor } from './types'

// claude-code 가 *지원하는* 능력의 단일 출처. SessionAdapter.describe() 도 이 const 를 반환해
// 서술자가 두 곳에서 어긋나지 않게 한다(drift 없는 단일 출처).
export const CLAUDE_DESCRIPTOR: ProviderDescriptor = {
  provider: 'claude-code',
  session: {
    // lifecycle
    continue: true, // SDK Options.continue [검증-런타임]
    resume: true, // SDK Options.resume [검증-런타임]
    fork: true, // SDK Options.forkSession (typescript.md:457) [검증-타입]
    persistSessionFalse: true, // 새 채팅(sessionId=null) 비영속 시작 [검증-런타임]
    delete: true, // Orca DB hard delete (CASCADE) [검증-런타임]
    update: true, // 세션 rename/title [검증-런타임]
    // structure / control
    children: false, // Claude SDK 에 대응 함수 없음 (OpenCode session.children 전용) [N/A-claude]
    summarize: false, // Claude SDK 에 대응 함수 없음 (OpenCode 전용) [N/A-claude]
    abort: true, // AbortController 중단 [검증-런타임]
    share: false, // Claude SDK 에 대응 함수 없음 (OpenCode 전용) [N/A-claude]
    init: true, // system/init(=session.updated) 이벤트 [검증-런타임]
    // context
    contextInjectionNoReply: true, // systemPrompt.append (typescript.md:484) 무응답 주입; 형식은 런타임 검증 필요 [미확인-런타임]
    structuredOutput: true, // Options.outputFormat json_schema (typescript.md:465) 타입 확정; 출력 형식 미검증 [검증-타입 / 형식 미확인-런타임]
    // revert (§5) — claude 대화 revert API 없음, file checkpoint 는 실험 beta 미연결.
    conversationRevert: false,
    conversationUnrevert: false,
    fileCheckpointCreate: false,
    fileCheckpointRestore: false
  },
  // §5 — claude 는 대화 revert API 가 없고 file checkpoint(실험 beta)도 미연결이라 전부 false.
  revert: {
    conversationRevert: false,
    conversationUnrevert: false,
    fileCheckpointCreate: false,
    fileCheckpointRestore: false
  },
  cancellation: {
    sessionAbort: true, // AbortController.abort() [검증-런타임]
    denyInterrupt: true, // PermissionResultDeny.interrupt [검증-런타임]
    abortSignal: true // canUseTool 에 전달되는 abort signal [검증-런타임]
  }
}

// 정적 probe — discover() 는 인터페이스 호환(async)을 위해 Promise 로 const 를 감싼다.
export const claudeCapabilityProbe: CapabilityProbe = {
  provider: 'claude-code',
  discover(): Promise<ProviderDescriptor> {
    return Promise.resolve(CLAUDE_DESCRIPTOR)
  }
}
