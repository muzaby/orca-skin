// Extension 계층 — 백엔드 중립 확장(Extension) 타입. 어댑터 위에 세우는 "Orca 범용 데이터 계층"의
// 입력 데이터 모델이다 (설계검토 §9 1단계). 어떤 백엔드(claude-code / opencode …)로 가든 동일한
// 형태로 조립되고, 각 어댑터가 자기 형식으로 어댑트(adapt)한다.
//
// ※ 어휘 주의: 여기의 "Extension"(주입 묶음, 앱→백엔드, 세션 전)과 capabilities/ 의
//   "capability"(능력 탐지, 백엔드→앱, 세션 중)는 무관한 두 개념이다 (GLOSSARY §1/§2).
//
// 불변식: 여기 담기는 mcp 는 **미확장**(${VAR} 플레이스홀더 보유). 비밀 확장/복호화는 어댑터의
// 어댑트 시점에만 일어나며 이 구조체에는 절대 평문이 들어오지 않는다.

import type { OrcaMcpConfig } from '../mcp/schema'
import type {
  ApprovalResolution,
  PermissionAction,
  PermissionMode,
  SkillInfo
} from '../../shared/ipc'
import type { NormalizedHookSet } from './hooks'

// SKILL.md 스캔 메타 DTO 를 그대로 재사용 (step 2 — 자산 가시화).
export type NormalizedSkillRef = SkillInfo

// 한 턴에 적용할 백엔드 중립 보조기능 묶음. 어댑터가 이를 받아 자기 query 옵션으로 굽는다.
export interface TurnExtensions {
  // 활성 MCP 서버 (미확장 ${VAR}). 어댑터가 resolver 로 확장 후 자기 형식으로 어댑트.
  mcp: OrcaMcpConfig
  // SKILL.md 메타 (가시화 목적). 현재 어댑트는 항상-on skills 경로가 구동하므로
  // 이 배열은 아직 옵션 생성을 구동하지 않는다 — 죽은 데이터가 아니라 "보여주기" 용도.
  skills: NormalizedSkillRef[]
  // 정규화된 Hook 핸들러 집합 (§6). 이번 PR 의 실런타임 경로는 {normalized:{}} 라 옵션 미주입.
  hooks: NormalizedHookSet
  // SDK 기본 시스템 프롬프트 뒤에 append 할 중립 텍스트 (프로젝트 지침 + PY_AGENT_RULES).
  systemPromptAppend?: string
}

// 한 턴 실행 요청. sendMessage 의 인자 증식(7개)을 단일 객체로 통합한다 (설계검토 §9 1단계).
export interface TurnRequest {
  sessionId: string | null
  text: string
  cwd: string
  signal?: AbortSignal
  extensions: TurnExtensions
  // uv 런타임 인프라 — 확장 묶음이 아니라 자식 프로세스 env 주입. 그래서 extensions 가 아닌
  // TurnRequest 직속이다 (router 호출처에서 runtime.getEnv() 로 조립, 빌더 우회).
  env?: Record<string, string>
  // 백엔드 중립 권한 승인 콜백 — ask_question·plan_review·tool_approval 세 종류를 단일
  // PermissionAction 으로 받아 ApprovalResolution(allow/deny 2분기)을 돌려준다. 어댑터가
  // 자기 SDK 의 권한 메커니즘(claude-code 는 canUseTool)으로 어댑트한다. router 가 broker
  // 에 바인딩해 주입하며, 미주입(opencode 등)이면 어댑터가 현행 자동 통과 동작을 유지.
  requestApproval?: (action: PermissionAction) => Promise<ApprovalResolution>
  // 이 턴의 권한 모드 (Composer 모드 버튼). 어댑터가 자기 query 옵션으로 어댑트.
  // 확장 묶음이 아니라 query-레벨 제어라 env/askUser 처럼 TurnRequest 직속.
  permissionMode?: PermissionMode
}
