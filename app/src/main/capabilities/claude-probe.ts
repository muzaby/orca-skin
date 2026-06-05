// claude-code 정적 능력 서술자 (CapabilityProbe 구현).
//
// 두 SDK 미설치(provider-runtime.md §13) 상태라 probe 가 SDK 메서드를 import/호출해
// introspection 할 수 없다. 따라서 claude probe 는 **정적 서술자**(문서 지식 기반)를 반환한다.
// 각 필드는 출처([검증]=코드/SDK 에 실존, [미확인]=SDK 문서 추정)를 주석으로 남겨 audit trail
// 을 보존한다 — 두 SDK 설치 후 introspection 으로 검증 시 모순 필드만 정정한다.

import type { CapabilityProbe, ProviderDescriptor } from './types'

// claude-code 가 *지원하는* 능력의 단일 출처. SessionAdapter.describe() 도 이 const 를 반환해
// 서술자가 두 곳에서 어긋나지 않게 한다(drift 없는 단일 출처).
export const CLAUDE_DESCRIPTOR: ProviderDescriptor = {
  provider: 'claude-code',
  session: {
    // lifecycle
    continue: true, // SDK options.continue [검증]
    resume: true, // SDK options.resume [검증]
    fork: false, // forkSession 대응 [미확인]
    persistSessionFalse: true, // 새 채팅(sessionId=null) 비영속 시작 [검증]
    delete: true, // Orca DB hard delete (CASCADE) [검증]
    update: true, // 세션 rename/title [검증]
    // structure / control
    children: false, // session.children 대응 [미확인]
    summarize: false, // summarize 대응 [미확인]
    abort: true, // AbortController 중단 [검증]
    share: false, // share 대응 [미확인]
    init: true, // system/init(=session.updated) 이벤트 [검증]
    // context
    contextInjectionNoReply: true, // systemPrompt.append 무응답 컨텍스트 주입 [미확인 — 형식 추정]
    structuredOutput: true, // 대응 개념 존재, 형식 [미확인]
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
    sessionAbort: true, // AbortController.abort() [검증]
    denyInterrupt: true, // PermissionResultDeny.interrupt [검증]
    abortSignal: true // canUseTool 에 전달되는 abort signal [검증]
  }
}

// 정적 probe — discover() 는 인터페이스 호환(async)을 위해 Promise 로 const 를 감싼다.
export const claudeCapabilityProbe: CapabilityProbe = {
  provider: 'claude-code',
  discover(): Promise<ProviderDescriptor> {
    return Promise.resolve(CLAUDE_DESCRIPTOR)
  }
}
