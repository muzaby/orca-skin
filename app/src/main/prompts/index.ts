// 정책(시스템 프롬프트 append) 관리 모듈 배럴. 관리는 여러 조각(.md 본문 · registry 조건 ·
// JSON 룩업), 주입은 한 덩어리(buildAppend 의 단일 문자열). 정본 가이드: docs/arch/backend/system-prompt.md.

export { buildAppend } from './buildAppend'
export { loadPolicies } from './loader'
export { POLICY_REGISTRY } from './registry'
export type { BuildContext, PolicyBlock, PolicyTier } from './registry'
export { getPlatformHint } from './platformHints'
