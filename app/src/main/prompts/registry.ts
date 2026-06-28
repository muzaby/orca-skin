// 정책 레지스트리 — "어떤 정책 블록을, 어떤 순서로, 언제 켤지"의 메타데이터 단일 출처.
// 본문(텍스트)은 policies/*.md 에 두고, 여기서는 id·파일경로·tier·주입조건만 선언한다.
// 0049 PR-B 에서 uv Python runtime 정책을 제거해 현재 정적 정책은 0개다.

export interface BuildContext {
  /** 실행 플랫폼 — 조건부 블록 판별 입력 (process.platform). */
  platform: NodeJS.Platform
}

export type PolicyTier = 'stable' | 'conditional'

export interface PolicyBlock {
  /** 고유 id — loader 의 본문 Map 키이자 정합 검증 단위. */
  id: string
  /** 본문 파일 경로 (레지스트리 기준 상대 — 진단/추적용. 로드 자체는 loader 의 정적 import). */
  file: string
  tier: PolicyTier
  /** conditional 일 때만. ctx 평가가 true 면 주입한다. */
  when?: (ctx: BuildContext) => boolean
}

export const POLICY_REGISTRY: PolicyBlock[] = []
