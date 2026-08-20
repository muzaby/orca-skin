// 카탈로그 view 조립 (0188 — 구 `ProviderPlatform.list()`/`state()`).
//
// ── 왜 wire 를 그대로 두는가 ─────────────────────────────────────────────────
// 내부 책임을 갈랐다고 화면과 wire 를 **동시에** 바꾸지 않는다. renderer 는 여전히 한 DTO 에서
// `gate|llm|service` 분류·인증 상태·노출 도구를 함께 받는다(`shared/ipc` 의 `ProviderInfo` ·
// `ProviderPlatformState`). 여기서 app 레이어가 정적인 view source 를 조립해 그 DTO 로 매핑한다.
//
// **renderer 에 새 `connection` kind 를 추가하지 않는다** — UI/UX 불변 범위를 넘어 기존 그룹·
// wire 계약을 바꾸는 일이다(0188 D-029·D-030). 호환 매핑은 아래 `WIRE_KIND` 하나에 있다.
//
// ── 이 타입은 registry 가 아니다 ─────────────────────────────────────────────
// `ConnectionViewSource` 는 **renderer view 조립용**이며 `AuthDefinition` 에 들어가지 않는다.
// behavior contribution registry 도 아니다 — Bootstrap 이 만든 객체 참조를 배열로 묶는 것이라
// 별도 cross-reference validator 가 필요 없다(참조가 곧 무결성이다).
//
// label·origin·인증 방식 입력 필드는 `auth.describe()` 에서, 상태는 `auth.snapshot()` 에서
// 읽어 **중복 선언하지 않는다**.

import type { ProviderInfo, ProviderKind, ProviderPlatformState } from '../../shared/ipc'
import type { AuthRuntime, BoundAuth } from '../contracts/auth'
import type { Gate } from '../features/gate'
import type { HarnessModelProviderKey } from '../features/harnesses/runtime-config'

// 이 모듈은 **읽기만** 한다 — 선언 설명과 현재 단계. `AuthRuntime` 전체를 받으면 view 조립이
// 인증을 시작하거나 해제할 수 있게 된다(0190).
type AuthDescriber = Pick<AuthRuntime, 'describe'>
type AuthStepReader = Pick<AuthRuntime, 'describe' | 'currentStep'>

export type ConnectionViewSource =
  | { category: 'gate'; auth: BoundAuth }
  | {
      category: 'harness'
      auth: BoundAuth
      harnessModelProviderKey: HarnessModelProviderKey
    }
  | {
      category: 'plugin'
      auth: BoundAuth
      // **cached descriptor 에서 나온 완전 도구 이름**이다. Auth 가 invalid 여도 비우지 않는다 —
      // 현재 화면은 연결이 끊겨도 도구 이름을 보여 주고 `status` 로 비활성을 안내한다.
      // active registry 목록으로 이 값을 만들면 그 UX 가 깨진다(0188 D-024).
      toolNames(): readonly string[]
    }
  | { category: 'usage'; auth: BoundAuth }

// 기존 row 의 표시 의미를 하나만 유지하는 compatibility 매핑. 신규 도메인 코드 안쪽에서는
// `ProviderKind` 를 쓰지 않는다 — 이 표가 유일한 접점이다.
const WIRE_KIND: Record<ConnectionViewSource['category'], ProviderKind> = {
  gate: 'gate',
  harness: 'llm',
  plugin: 'service',
  usage: 'service'
}

function toolsOf(source: ConnectionViewSource): string[] {
  return source.category === 'plugin' ? [...source.toolNames()] : []
}

export function connectionInfo(auth: AuthDescriber, source: ConnectionViewSource): ProviderInfo {
  const descriptor = auth.describe(source.auth.authId)
  const snapshot = source.auth.snapshot()
  return {
    id: descriptor.authId,
    label: descriptor.label,
    kind: WIRE_KIND[source.category],
    origin: descriptor.origin,
    // `describe()` 가 이미 method·field 를 새로 할당해 돌려준다(`features/auth/runtime.ts`
    // `methodDescriptor`). 여기서 다시 깊은 복사하면 `providerList`/`providerState` invoke 와
    // **모든 `pushConnectionState()` 방송**마다 같은 사본을 두 벌 만든다 — 배열만 복사해
    // `readonly` 를 벗긴다(0190).
    auth: [...descriptor.methods],
    status: snapshot.status,
    activeAuthKind: snapshot.activeMethod ?? null,
    principal: snapshot.principalId ?? null,
    expiresAt: snapshot.expiresAt ?? null,
    tools: toolsOf(source)
  }
}

export function connectionList(
  auth: AuthDescriber,
  sources: readonly ConnectionViewSource[]
): ProviderInfo[] {
  return sources.map((source) => connectionInfo(auth, source))
}

export function connectionState(
  auth: AuthStepReader,
  gate: Gate,
  sources: readonly ConnectionViewSource[],
  // 부팅 복원 진행 여부 (0194). 계산은 `app/auth-resume.ts` 가 소유하고 여기서는 **싣기만**
  // 한다 — 재계산하면 판정이 두 벌이 된다.
  resuming: boolean
): ProviderPlatformState {
  return {
    gate: gate.state(),
    providers: connectionList(auth, sources),
    step: auth.currentStep(),
    resuming
  }
}

// view source 배열의 위생. **AuthId 가 중복되면 안 된다** — 하나의 Auth 를 Harness 와 Usage 가
// 함께 쓰더라도 `BoundAuth` 만 각 factory 에 재사용하고 GUI row 를 feature 수만큼 복제하지
// 않는다(0188 D-029). 위반은 부팅 진단으로 남긴다(선언 하나만 떨어뜨리는 registry 와 달리
// 여기는 배포 배선 실수이므로 조용히 고치지 않는다).
export function duplicateConnectionAuthIds(
  sources: readonly ConnectionViewSource[]
): readonly string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const source of sources) {
    if (seen.has(source.auth.authId)) duplicates.add(source.auth.authId)
    seen.add(source.auth.authId)
  }
  return [...duplicates]
}
