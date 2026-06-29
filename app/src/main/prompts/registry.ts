// 정책 레지스트리 — "어떤 정책 블록을, 어떤 순서로, 언제 켤지"의 메타데이터 단일 출처.
// 본문(텍스트)은 policies/*.md 에 두고, 여기서는 id·파일경로·tier·주입조건만 선언한다
// (가이드 5.4 — "텍스트가 아니라 언제 켤지만 선언"). 조립은 buildAppend, 로드는 loader 가 한다.
//
// 현재 Orca 정적 정책은 없다. PolicyBlock 의 tier:'conditional' + when 은 향후 블록
// (플랫폼/모드별)을 위한 메커니즘이며 buildAppend·테스트가 이 경로를 커버한다.

// 조건 평가 입력. startup-known 값만 담는다 (현재 platform). per-turn 조건(모드 등)이 필요한
// 블록이 추가되면 그 시점에 ctx 를 per-turn 으로 확장하고 router 배선을 옮긴다.
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

// 배열 순서 = 조립 순서. 변동성 낮은 stable 을 앞에 둬 변동성 계층(가이드 7장)을 강제한다.
export const POLICY_REGISTRY: PolicyBlock[] = []
