// 로그인 게이트 (0181 → 0188 독립) — **Auth 상태를 앱 접근 조건으로 소비하는 정책 feature**.
//
// Auth 의 내부 lifecycle 이 아니다. 그래서 `features/auth` 안이 아니라 여기 산다 —
// **Auth 는 자신이 gate 에 쓰이는지 모른다**(0188 D-007). membership 은 배포가 정하고
// (`app/deployment/gate-auth.ts`), 여기는 주입된 `BoundAuth` 들의 snapshot 만 읽는다.
//
// 판정 자체는 계속 **순수 함수**다. electron·fs·network 의존 0 이라 vitest 대상.
//
// ── 진리표 ───────────────────────────────────────────────────────────────────
// | 빌드 | kind:'gate' 선언 | grant 상태                   | 판정 |
// |---|---|---|---|
// | prod | 0개              | —                            | **통과** ← OSS/기본 배포가 잠기지 않게 하는 안전장치 |
// | prod | N개              | 하나도 인증 안 됨             | 차단 |
// | prod | N개              | 일부만 valid+verified        | 차단 ← 로그인이 체인이라 멤버 하나만 풀려도 인증이 아니다 |
// | prod | N개              | **복원만 됨(미로그인)**       | **차단** ← 기록은 인증이 아니다. 로그인 화면에서 한 번 통과해야 한다 |
// | prod | N개              | 전부 valid + **verified**    | 통과 |
// | **DEV** | **0개**       | —                            | **차단** ← 로그인 화면을 항상 볼 수 있어야 한다 |
// | 둘 다 | N개(또는 DEV)    | (무관) bypass ON             | 통과 |
//
// ── DEV 는 왜 항상 게이트인가 (0089 → 0130 → 0181 복원) ────────────────────
// 게이트 화면은 **개발 중에 계속 보고 고쳐야 하는 화면**이다. "선언 0 → 통과" 를 DEV 에도
//적용하면 폐쇄망 실값이 없는 개발 환경에서 그 화면에 **도달할 방법이 사라진다** — 0181 이 처음
// 그렇게 만들었고, 우회 토글을 켜도 우회할 게이트가 없어 아무 일도 일어나지 않았다.
//
// 그래서 DEV 는 게이트를 항상 세우고 **`authBypass` 토글이 유일한 탈출구**다(디버그 패널이
// 로그인 화면에도 마운트되는 이유 — 우회 스위치가 게이트 뒤에 있으면 손이 닿지 않는다).
// prod 는 그대로다: 선언이 0개면 통과, 그래야 OSS 빌드가 잠기지 않는다(AC14 의 대상).
//
// 게이트는 **UX 게이트이지 보안 경계가 아니다** — 인증 전에도 main IPC 는 열려 있다.

import type { ProviderGateState } from '../../../shared/ipc'
import type {
  AuthDefinition,
  AuthStatus,
  BoundAuth,
  GateAuthDefinition
} from '../../contracts/auth'

export interface GateMember {
  authId: string
  status: AuthStatus
  // **이번 실행에서 실제 로그인을 거쳤는가.** `status` 만으로는 부족하다 — grant 는 디스크에서
  // 복원되는 *기록*이고, 특히 `kind:'session'` grant 는 vault 도 만료도 없이 기록만으로
  // `valid` 가 된다. 그래서 한 번 로그인에 성공하면 그 providerId 는 영구히 통과 상태가 됐다
  // (사용자 보고: "성공한 provider id 가 bypass 와 같은 현상").
  //
  // 재시작 뒤 다시 참이 되는 길은 **로그인 화면의 평소 로그인 하나뿐**이다. 쿠키·통합 인증이
  // 살아 있으면 IdP 가 폼 없이 곧장 `doneUrlPrefix` 로 보내 창이 열리자마자 닫히므로, 그것이
  // 곧 자동 로그인이다 — 여기에 별도 검증 경로를 만들지 마라(사용자 결정 2026-08-11).
  verified: boolean
}

export interface GateInput {
  // 배포가 필수로 지정한 Auth 들의 현재 상태. 지정이 0 이면 빈 배열.
  members: readonly GateMember[]
  // `Settings.authBypass` — DEV 전용 우회. prod 빌드에서 켜져도 게이트만 지나갈 뿐
  // 자격증명이 생기지는 않는다(요청은 여전히 미인증으로 실패한다).
  bypass: boolean
  // 선언이 0개여도 게이트를 세운다(DEV). **호출부가 `import.meta.env.DEV` 를 넣는다** —
  // 이 모듈이 직접 읽으면 순수성이 깨지고 테스트가 빌드 모드에 묶인다.
  alwaysRequired?: boolean
  // 확인할 수 없는 gate 선언이 있다 — bypass 외에는 통과하지 않는다(0188 D-007 fail-closed).
  blocked?: boolean
}

export function evaluateGate(input: GateInput): ProviderGateState {
  const required = input.alwaysRequired === true || input.members.length > 0
  if (!required) return { required: false, passed: true, bypassed: false }
  if (input.bypass) return { required: true, passed: true, bypassed: true }
  // 선언이 0개인 DEV 에서는 통과할 방법이 bypass 뿐이다 — `every` 는 빈 배열에 true 를 주므로
  // 멤버 수를 함께 본다(안 그러면 DEV 게이트가 즉시 열려 원래 문제로 되돌아간다).
  //
  // `verified` 를 함께 보는 이유는 `GateMember.verified` 주석 참조 — **복원된 grant 는 통과
  // 근거가 아니다**. 실행마다 로그인을 한 번 거쳐야 열린다(쿠키가 살아 있으면 창이 즉시 닫힌다).
  // 확인할 수 없는 선언이 있으면 나머지가 전부 통과해도 열지 않는다 — "열려는 있는데 아무나
  // 통과하는" 상태를 만들지 않는다.
  const passed =
    input.blocked !== true &&
    input.members.length > 0 &&
    input.members.every((member) => member.status === 'valid' && member.verified)
  return { required: true, passed, bypassed: false }
}

// ── 앱 접근 정책 ──────────────────────────────────────────────────────────────
//
// 배포가 고른 Auth 들과 dev 우회 토글만 받는다. **`valid` 뿐 아니라 `verified` 까지** 보는
// 이유는 `GateMember.verified` 주석에 있다 — 복원된 기록은 통과 근거가 아니다.
//
// `probe` 없는 정의는 여기 오면 안 된다. 타입(`GateAuthDefinition`)이 compile time 에 막고,
// 부팅 composition 이 runtime 에서도 fail-closed 한다(0188 D-007). 그럼에도 방어적으로,
// membership 이 비어 있는데 `alwaysRequired` 면 통과하지 않는다(아래 `passed` 의 length 검사).
export interface Gate {
  state(): ProviderGateState
}

export interface CreateGateDeps {
  members: readonly BoundAuth[]
  // 확인할 수 없는 gate 선언의 수. 0 이 아니면 gate 는 required 이면서 **통과하지 않는다**
  // (bypass 는 여전히 유효 — dev 탈출구까지 막으면 화면에 도달할 방법이 사라진다).
  blockedMembers?: number
  // dev 게이트 우회 — 읽는 시점의 값이어야 하므로 getter 다(설정은 런타임에 바뀐다).
  bypass: () => boolean
  // DEV 빌드는 선언이 0개여도 게이트를 세운다(로그인 화면 도달성). 컴포지션 루트가
  // `import.meta.env.DEV` 를 넣는다 — prod 번들에서는 false 로 접힌다.
  alwaysRequired?: boolean
}

export function createGate(deps: CreateGateDeps): Gate {
  return {
    state(): ProviderGateState {
      const members = deps.members.map((auth) => {
        const snapshot = auth.snapshot()
        return {
          authId: auth.authId,
          status: snapshot.status,
          verified: snapshot.verified
        }
      })
      return evaluateGate({
        members,
        bypass: deps.bypass(),
        ...(deps.alwaysRequired || (deps.blockedMembers ?? 0) > 0 ? { alwaysRequired: true } : {}),
        ...((deps.blockedMembers ?? 0) > 0 ? { blocked: true } : {})
      })
    }
  }
}

// ── gate membership 의 runtime fail-closed (0188 D-007) ───────────────────────
//
// 타입(`GateAuthDefinition`)이 compile time 에 `probe` 를 강제하지만 두 구멍이 남는다:
//   ① 배포가 `as` 로 타입을 우회한 경우
//   ② 그 선언이 등록 검사에서 떨어져(`AuthRegistry`) bind 되지 않는 경우
//
// 둘 다 **게이트를 통과시키지 않는다**. 세우지 않는 것이 아니라 통과시키지 않는 것이 차이다 —
// 멤버에서 빼면 `members.length === 0` 이 되어 prod 에서 gate 가 required:false 로 열린다.
// 그래서 `blocked` 를 함께 돌려주고, 호출부가 그것을 gate 를 **닫아 두는 근거**로 쓴다.
export interface GateMemberSelection {
  members: BoundAuth[]
  // 확인할 수 없는 gate 선언. 하나라도 있으면 gate 는 통과하지 않는다.
  blocked: { authId: string; reason: 'missing_probe' | 'unregistered' }[]
}

export function selectGateMembers(
  definitions: readonly GateAuthDefinition[],
  tryBind: (authId: string) => BoundAuth | null
): GateMemberSelection {
  const members: BoundAuth[] = []
  const blocked: GateMemberSelection['blocked'] = []
  for (const definition of definitions) {
    // 런타임 값으로도 확인한다 — 타입은 `as` 로 뚫린다.
    if (!(definition as AuthDefinition).probe) {
      blocked.push({ authId: definition.id, reason: 'missing_probe' })
      continue
    }
    const bound = tryBind(definition.id)
    if (!bound) {
      blocked.push({ authId: definition.id, reason: 'unregistered' })
      continue
    }
    members.push(bound)
  }
  return { members, blocked }
}
