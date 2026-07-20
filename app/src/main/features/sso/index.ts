import type { SsoProviderModule } from '../../contracts/sso'
import { SSO_MODULE_REGISTRATION } from './modules'

/**
 * SSO 모듈 통합 계약 (0130 — 0099 정적 usage provider 계약과 동형):
 *
 * - SSO 모듈은 opt-in 확장이다. 신규 Orca 설치의 등록 모듈은 null — 로그인 게이트가
 *   없고 prod 게이트는 자동 통과한다(현행 동작 보존).
 * - 활성화는 `modules/<name>/` 아래 모듈 추가 + `modules/index.ts` 배럴 한 줄 export.
 *   SsoService·IPC 핸들러·RootGate·LoginView 등 코어 코드는 회사/모듈명 분기 없이
 *   `SsoProviderModule | null` 만 소비한다 — 활성화를 위해 코어를 수정하지 않는다.
 * - 모듈 단일(배열 아님): 한 빌드 = 한 회사 로그인. 복수 사내 서비스 패스스루는
 *   모듈의 login() 내부에서 체인으로 조합한다.
 * - 체인 내부(OAuth 변형·사내 토큰·CLI 호출·재시도)는 프레임워크 개념이 아니다 —
 *   프레임워크는 SsoContext 를 주고 SsoLoginOutcome 만 소비한다(contracts/sso.ts).
 */
export const SSO_MODULE: SsoProviderModule | null = SSO_MODULE_REGISTRATION
