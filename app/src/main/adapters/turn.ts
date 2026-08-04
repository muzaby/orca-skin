// Extension 계층 — 백엔드 중립 확장(Extension) 타입. 어댑터 위에 세우는 "Orca 범용 데이터 계층"의
// 입력 데이터 모델이다 (설계검토 §9 1단계). 어떤 백엔드(claude / opencode …)로 가든 동일한
// 형태로 조립되고, 각 어댑터가 자기 형식으로 어댑트(adapt)한다.
//
// ※ 어휘 주의: 여기의 "Extension"(주입 묶음, 앱→백엔드, 세션 전)과 capabilities/ 의
//   "capability"(능력 탐지, 백엔드→앱, 세션 중)는 무관한 두 개념이다 (GLOSSARY §1/§2).
//
// 불변식: 여기 담기는 mcp 는 **미확장**(${VAR} 플레이스홀더 보유). 비밀 확장/복호화는 어댑터의
// 어댑트 시점에만 일어나며 이 구조체에는 절대 평문이 들어오지 않는다.

import type { ResolvedProviderSettings } from './provider-config'
import type { OrcaMcpConfig } from './mcp-config'
import type { RuntimeToolSnapshot } from './runtime-tools'
import type {
  ApprovalResolution,
  AttachmentSourceKind,
  AttachmentView,
  EffortLevel,
  PermissionAction,
  SkillInfo
} from '../../shared/ipc'
import type { NormalizedPermissionMode } from '../../shared/permission-mode'
import type { NormalizedHookSet } from './hooks'

// pending message flush 배치 계약 — 어댑터가 게이트 훅에서 회수(takeSteerFlush)하거나 턴
// 프롬프트/프렐류드(0067)로 받아 자기 입력 채널로 주입한다. 구조 페이로드(0067 AC5): 첨부
// 추출분은 어댑터가 content 블록으로 굽고, attachmentViews 는 커밋 시 표시/영속용으로 흐른다.
// 구현(PendingMessageQueue)은 features/chat 이지만 계약 타입은 어댑터 포트에 둔다.
export interface SteerFlush {
  ids: string[]
  text: string
  createdAt: number
  attachmentTexts?: ExtractedAttachmentText[]
  attachmentImages?: ExtractedAttachmentImage[]
  attachmentViews?: AttachmentView[]
}
export interface SteerFlushBatch extends SteerFlush {
  // stdin 주입 배치의 uuid — echo 상관키(주입 user 메시지의 uuid). 게이트 병합 배치는 신규
  // uuid, 턴 프롬프트/프렐류드 아이템 단위 배치는 item id 를 그대로 쓴다(renderer 정합).
  uuid: string
  attemptId?: string
  chainId?: string
}

// 턴 중단 영수증(0151 AC10) — SDK `Query.interrupt()` 가 돌려주는 `SDKControlInterruptResponse`
// 의 중립 형태. `stillQueued` = 이 인터럽트에서 살아남아 **여전히 실행될** 비동기 사용자 메시지
// uuid 목록(`sdk.d.ts:3487`).
//
// 두 가지를 엄격히 구분해야 한다:
//   `undefined`        = CLI 가 `interrupt_receipt_v1` capability 미보유(구형). 잔여 여부 **미상**.
//   `{stillQueued: []}` = 영수증은 왔고 uuid 기반 생존 메시지가 없음.
// 뭉개면 "잔여 없음" 을 오판한다.
//
// 주의: 목록에는 클라이언트가 보낸 적 없는 **내부 uuid**(cron 트리거·auto-resume continuation)가
// 섞인다. 소비자는 자기가 아는 uuid 와 교집합만 취하고 나머지는 무시해야 한다 — Orca 는
// 백그라운드 서브에이전트가 기본이라(0143) 내부 uuid 가 실제로 발생한다.
export interface InterruptReceipt {
  stillQueued: string[]
}

// 첨부 추출 결과 — 어댑터가 turn content 로 굽는 입력 계약(구 files/attachments 정의를 포트로 이관).
export interface ExtractedAttachmentText {
  id: string
  name: string
  mimeType: string
  sizeBytes?: number
  text: string
  charsOriginal: number
  charsIncluded: number
  truncated: boolean
  sourceKind: AttachmentSourceKind
}

export interface ExtractedAttachmentImage {
  id: string
  name: string
  mimeType: string
  sizeBytes?: number
  data: string
  sourceKind: AttachmentSourceKind
}

// SKILL.md 스캔 메타 DTO 를 그대로 재사용 (step 2 — 자산 가시화).
export type NormalizedSkillRef = SkillInfo

// 한 턴에 적용할 백엔드 중립 보조기능 묶음. 어댑터가 이를 받아 자기 query 옵션으로 굽는다.
export interface TurnExtensions {
  // 활성 MCP 서버 (미확장 ${VAR}). 0058 이후 Claude 런타임은 query options.mcpServers 가 아니라
  // plugin .mcp.json 렌더 경로로 소비한다. options.mcpServers 는 레거시 제거 대상으로 남겨둔다.
  mcp: OrcaMcpConfig
  // 인증된 내장 도구의 현재 메모리 snapshot. extensions feature가 조립하며, adapters는
  // backend별 SDK 옵션으로만 변환한다. 미주입은 기존 MCP 배포 경로를 그대로 유지한다.
  runtimeTools?: RuntimeToolSnapshot
  // SDK options.plugins 로 로드할 plugin root 목록 — Orca plugin(dist/plugins/orca) + 사용자
  // ~/.claude/skills 래퍼 plugin(dist/plugins/claude, 0117). 존재/매니페스트 검증은 어댑터
  // (adaptPlugins)가 root 별로 수행하므로 조립 측(ExtensionBuilder)은 fs 를 만지지 않는다.
  pluginRoots?: string[]
  // SKILL.md 메타 (가시화 목적). 현재 어댑트는 항상-on skills 경로가 구동하므로
  // 이 배열은 아직 옵션 생성을 구동하지 않는다 — 죽은 데이터가 아니라 "보여주기" 용도.
  skills: NormalizedSkillRef[]
  // 정규화된 Hook 핸들러 집합 (§6). 이번 PR 의 실런타임 경로는 {normalized:{}} 라 옵션 미주입.
  hooks: NormalizedHookSet
  // SDK 기본 시스템 프롬프트 뒤에 append 할 중립 텍스트 (구조화 헤더 # Orca/# User/# Project;
  // 프로젝트 name·지침은 # Project 섹션 안에 포맷화 — ExtensionBuilder 가 system-header 로 조립).
  systemPromptAppend?: string
}

// 장수명 채널(0067)에 이어붙이는 후속 턴 계약 — 어댑터가 라이브 setter(model/permissionMode) 적용
// 후 content 를 조립해 자기 입력 채널로 push 한다. effort/providerSettings/extensions 등 스폰-바인딩
// 옵션은 여기 없다(변경 시 respawn 경계 — 0067 설계).
export interface TurnContinuation {
  text: string
  attachmentTexts?: ExtractedAttachmentText[]
  attachmentImages?: ExtractedAttachmentImage[]
  // 이 턴 프롬프트의 echo 상관키(pending queue 아이템/배치 uuid) — 커밋 판정(0067 AC6).
  promptUuid?: string
  model?: string
  permissionMode?: NormalizedPermissionMode
}

// 한 턴 실행 요청. sendMessage 의 인자 증식(7개)을 단일 객체로 통합한다 (설계검토 §9 1단계).
export interface TurnRequest {
  sessionId: string | null
  // 0064 continuity — 이 턴이 분기 출발점으로 삼을 세션 id (fork/handoff 공통). sessionId
  // (resume=이어쓰기)와 달리 원본은 불변이고 백엔드가 **새 session id 를 발급**한다
  // (claude = query resume+forkSession). sessionId 는 null(새 세션 의미론 유지).
  forkFrom?: string
  // 0127 — 이 fork 턴이 핸드오프 도착 턴인가. 어댑터가 매퍼 컨텍스트(handoffArrival)로 전달해,
  // 압축 경계 이전의 승계 컨텍스트 usage(원본 세션 전체 이력)가 telemetry(도넛/경고·원장)를
  // 오염하지 않게 한다. 자동 연속 턴은 forkFrom 과 함께 이 플래그도 제거된다(chat-turn).
  handoff?: boolean
  text: string
  cwd: string
  signal?: AbortSignal
  extensions: TurnExtensions
  // subprocess env (orca.json 앱 전역 env 병합 결과). 확장 묶음이 아니라 자식
  // 프로세스 env 주입이라 TurnRequest 직속 — router 호출처(ipc/chat/send.ts)에서 조립한다.
  env?: Record<string, string>
  // main(ProviderSettingsService)이 해석 완료한 provider settings blob (handoff 0014).
  // 어댑터-네이티브 스키마 그대로이며 어댑터는 자기 query 옵션에 꽂기만 한다
  // (claude = options.settings flag + SDK 기본 settingSources 상속 — adaptSettings).
  providerSettings?: ResolvedProviderSettings
  // 해석 완료된 백엔드 모델 이름. family/provider key 어휘는 config 계층에서 소비한다.
  model?: string
  // 백엔드 중립 권한 승인 콜백 — ask_question·plan_review·tool_approval 세 종류를 단일
  // PermissionAction 으로 받아 ApprovalResolution(allow/deny 2분기)을 돌려준다. 어댑터가
  // 자기 SDK 의 권한 메커니즘(claude 는 canUseTool)으로 어댑트한다. router 가 broker
  // 에 바인딩해 주입하며, 미주입(opencode 등)이면 어댑터가 현행 자동 통과 동작을 유지.
  // signal: 어댑터(SDK)가 이 권한요청을 취소할 때 신호. 주어지면 router 가 턴 signal 과 합쳐
  // broker 에 묶어, SDK 취소 시 보류가 deny 로 깔끔히 해소되게 한다(canUseTool 무한 await 방지).
  requestApproval?: (action: PermissionAction, signal?: AbortSignal) => Promise<ApprovalResolution>
  // 이 턴의 권한 모드 (정규화 6종 — Composer 모드 버튼). 어댑터가 toClaudePermissionMode 로
  // 자기 query 옵션(SDK PermissionMode)으로 어댑트. 확장 묶음이 아니라 query-레벨 제어라
  // env/askUser 처럼 TurnRequest 직속.
  permissionMode?: NormalizedPermissionMode
  // Claude Code thinking effort. SDK Options.effort 로 per-turn 전달한다.
  effort?: EffortLevel
  // 게이트 훅 시점에 로컬 홀드 steer 를 병합 단일 배치로 회수한다(0060 D3·D4). 어댑터가 자기
  // 게이트(claude=PostToolBatch, 메인 루프 한정)에서 호출해 반환 배치를 자기 입력 채널로 주입
  // — 미주입(steer 미지원 백엔드)/빈 큐면 undefined(주입 없음). requestApproval 과 대칭인
  // 라이브-턴 제어 채널이라 TurnExtensions 가 아닌 TurnRequest 직속.
  takeSteerFlush?: () => SteerFlushBatch | undefined
  // 예약 롤백(0151 AC4) — 어댑터가 takeSteerFlush 로 회수한 배치를 자기 입력 채널이 **거부**했을
  // 때(closed stream / push 예외) 호출한다. 큐가 항목을 held 로 되돌려 다시 취소 가능해진다.
  // takeSteerFlush 와 짝이며, 미주입이면 어댑터는 실패를 삼킨다(fail-open 현행 유지).
  rollbackSteerFlush?: (batch: SteerFlushBatch) => void
  commitSteerFlush?: (batch: SteerFlushBatch) => boolean
  // 스폰 입력(프렐류드+본 프롬프트)의 로컬 스트림 수용 직후 전량 commit한다.
  canSubmitInitial?: () => boolean
  commitInitialSubmission?: () => boolean
  rollbackInitialSubmission?: () => void
  // 턴 중단 영수증 수신(0151 AC10·AC11) — 런타임이 interrupt() 를 호출한 뒤 결과를 여기로 올린다.
  // 잔여 uuid 와 자기 예약의 교집합 판정은 **컴포지션 루트**가 한다(features/sessions 가
  // features/chat 을 참조하지 않도록 — main/AGENTS.md 해소책 ③).
  onInterruptReceipt?: (receipt: InterruptReceipt | undefined) => void
  // 영수증은 늦게 도착할 수 있으므로 interrupt 발행 순간 큐/attempt를 동결한 수신자를 만든다.
  captureInterruptReceipt?: () => ((receipt: InterruptReceipt | undefined) => void) | undefined
  // 채널 화신이 종료/교체되는 순간의 상향 통지. app 계층이 해당 채널에 묶인 백그라운드
  // 작업을 합성 정착한다. token은 관측/멱등 키이며 chat 기능을 sessions가 직접 참조하지 않는다.
  onChannelRetired?: (channelToken: number) => void
  // 중단된 서브에이전트 타입 재호출 차단 술어(가이드 §6-A). turn.blockedSubagents 를 읽는다.
  isSubagentBlocked?: (subagentType: string | undefined) => boolean
  attachmentTexts?: ExtractedAttachmentText[]
  attachmentImages?: ExtractedAttachmentImage[]
  // 스폰 턴 프롬프트의 소비 상관키(0067 AC6) — TurnContinuation.promptUuid 와 대칭.
  // 소비 확정 앵커는 응답 시작(첫 모델 출력, 0069 — echo 불요, coordinator 소유).
  promptUuid?: string
  // 스폰 시 본 프롬프트 *앞에* 선적재할 이월 배치(0067 — 채널 사망 후 잔여 pending 재전달).
  // 각 배치는 자기 uuid 의 개별 user 메시지로 주입되고, 프롬프트와 함께 응답 시작에서
  // 개별 배치로 커밋된다(버블 구조 보존, 0069).
  preludes?: SteerFlushBatch[]
}
