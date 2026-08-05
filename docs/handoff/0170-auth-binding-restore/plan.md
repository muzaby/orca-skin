# Plan — 0170-auth-binding-restore

## 메타

| 항목 | 값 |
|---|---|
| slug | `0170-auth-binding-restore` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | 0157 의 "영속: 하지 않는다" 결정을 사용자 요청으로 뒤집는다 |
| 상태 | DRAFT → READY |

## 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "인증 시 엑세스토큰, id/passwd 가 **영속화 되지 않고 있다. 재시작시 인증정보를 다시 입력하고 연결해야함**" | 라이브 세션 요청 2026-08-05 |
| 명시 결정 | 복원 방식 = **자동 복원** — "앱을 다시 띄우면 저장된 자격증명으로 binding 을 자동 복원하고 connector 를 연결한다. 연결 해제하면 vault 까지 지우고, 서버가 401/403 을 주면 자동으로 무효화해 재입력을 요구한다" | 라이브 세션 선택지 응답 2026-08-05 |
| 추론 의도 | 요구의 대상은 **서비스 연결**(connector)이다 — "다시 입력하고 **연결**" 이 그 어휘다. 앱 로그인 게이트(application target)까지 자동 통과시키라는 요구로 읽지 않는다 | (추론임을 표기 — §범위에서 근거와 함께 좁힌다) |

## Context (왜)

Confluence 를 연결해 두어도 앱을 재시작하면 PAT·ID/비밀번호를 다시 입력해야 한다. 매일 앱을
켜는 사용자에게는 매일 반복되는 마찰이다.

## 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **전제 정정 — "영속화되지 않는다" 는 절반만 맞다.** 비밀은 **이미 디스크에 영구 저장된다**(`orca-secrets.json`, safeStorage 암호화). 사라지는 것은 **binding 레코드**뿐이고, 그것은 `Map` 이며 주석이 의도를 명시한다. 요구의 *목적*(재입력 없이 쓰기)은 그대로 유지하고, 고칠 지점을 binding 영속으로 정정한다 | `infra/config/secret-store.ts:10-11` · `features/auth-platform/bindings.ts:12-13,37` |
| **보안 관점에서 이 요구가 노출을 늘리는가** | **늘리지 않는다 — 오히려 줄인다.** vault 네임스페이스가 `authBindingPrefix(binding.id)` 이고 그 id 는 **매 실행 새로 만들어지는 랜덤 값**이라(`bind_${seq}_${random}`), 지금은 연결할 때마다 **복호화 가능한 비밀이 죽은 id 아래 쌓이고 영영 정리되지 않는다.** binding 을 영속하면 같은 id 를 재사용하므로 그 잔여물이 더 생기지 않는다 | `broker.ts:370,477,506` · `bindings.ts:41` · `credential-vault.ts:105` |
| 이미 있는 것 아닌가 | **없다** — `BindingStore` 는 순수 in-memory 이고 파일·DB 참조가 0이다. 다만 주석이 **"영속이 필요해지면 여기서만 바꾸면 된다"** 로 확장 지점을 미리 지정해 뒀다 | `bindings.ts:12-13` |
| 더 작은 해법이 있는가 | **있고, 그것을 택한다.** vault 키를 target 기준으로 바꿀 필요가 없다 — **binding id 자체를 영속하면 네임스페이스가 그대로 안정 키가 된다.** 비밀 저장 경로·vault 계약·IPC 를 하나도 건드리지 않는다 | `broker.ts:477` (`authBindingPrefix(bindingId)`) |
| 기존 채택 결정을 뒤집는가 | **뒤집는다 — 1건, 사용자 요청으로.** `bindings.ts:12-13` 의 "영속: 하지 않는다. 현행 SSO 동작을 승계한다." 근거였던 "현행 SSO 동작" 은 0157 이 SSO 를 전량 제거하면서 **더 이상 존재하지 않는다** — 승계 대상이 사라진 결정이다 | §기존 결정 표 |

- **사용자에게 올릴 것**: 없음(복원 방식은 2026-08-05 에 "자동 복원" 으로 결정).

## 자료조사

| # | 발견 / 제약 | 레퍼런스 |
|---|---|---|
| R1 | **비밀은 이미 영속된다.** `SecretStore` 는 `electron-store`(`orca-secrets.json`, `<userData>`)에 safeStorage 암호문을 쓴다. 재시작해도 값은 남는다 | `app/src/main/infra/config/secret-store.ts:10-29` |
| R2 | **binding 만 휘발한다.** `BindingStore.bindings` 는 `Map` 이고 파일 I/O 가 0. 헤더 주석이 "영속: 하지 않는다 … 필요해지면 여기서만 바꾸면 된다" 로 확장 지점을 지정한다 | `features/auth-platform/bindings.ts:12-13,37` |
| R3 | **vault 네임스페이스가 binding id 에서 파생된다.** `authBindingPrefix(binding.id)` — id 를 영속하면 네임스페이스도 안정된다(추가 마이그레이션 불필요) | `broker.ts:370,477,506` · `credential-vault.ts:105` |
| R4 | **binding id 는 실행마다 랜덤이다** — `bind_${++seq}_${random}`. 그래서 현행은 재시작마다 새 네임스페이스를 만들고 이전 것을 방치한다(§요구 비판적 검토 2행의 근거) | `bindings.ts:41` |
| R5 | **vault 는 부재와 복호화 실패를 구분해 준다** — `read()` 가 `found` / `missing` / `undecryptable` 3상태다. 키체인이 잠긴 것과 값이 없는 것을 다르게 다뤄야 "조용한 미인증 진행" 을 막는다 | `infra/auth/credential-vault.ts:20-24,62-64` |
| R6 | **connector 연결 지점은 `PluginHost.connect({connectorId, bindingId})` 하나다.** 자격증명이 만료됐으면 `connectors.connect` 가 `health!=='ready'` 를 돌려주고 `connect` 가 **throw** 하며 `cleanup` 이 돈다 | `features/auth-platform/plugin-host.ts:117-176` |
| R7 | **컴포지션 루트가 broker·pluginHost 를 모두 조립한다** — 복원 배선을 넣을 자리가 이미 한 곳이다. `features` 끼리 직접 참조하지 않는 규칙을 지킬 수 있다 | `app/bootstrap.ts:277-321` |
| R8 | **browser_session artifact 는 복원 불가**하다 — cookie jar 는 Electron session partition 에 있고 binding 이 들고 있는 것은 handle 뿐이다. 값 기반(`vault_credential`)만 복원 대상이다 | `bindings.ts` `AuthArtifactRef` · `infra/auth/browser-session-store.ts` |
| R9 | **앱 로그인 게이트는 `providersForTarget('application').length > 0` 로 켜진다.** 저장소 기본값에는 application provider 가 **0개**다(Confluence 는 `targets:['connector']`) — 그래서 이번 범위를 connector 로 좁혀도 사용자 요구는 전부 충족된다 | `broker.ts` `status()` · `modules/AGENTS.md` 의 경고 블록 |
| R10 | **게이트 베이스라인(직접 측정)**: `vitest run src/main/features/auth-platform/ src/main/infra/auth/` = **23파일 / 401 테스트** 통과 | 이번 세션 실행 |

## 인수 기준

> 공통 프로덕션 도달 경로(P): `app/bootstrap.ts` 부팅 → `AuthBroker.restore()` →
> (복원된 connector binding 마다) `PluginHost.connect(...)`.

| # | 인수 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 저장소에 기록된 connector binding 이 부팅 시 `list()` 에 **같은 id 로** 되살아난다 | `bindings.test.ts::"저장된 레코드를 같은 id 로 되살린다"` | `bootstrap` → `new BindingStore(clock, persistence)` |
| 2 | binding 이 만들어지거나(create) 상태가 바뀌거나(patch/setStatus) 제거되면(remove) **저장소에 즉시 반영**된다 | 〃`::"레코드 변경마다 저장소에 반영한다"` | 〃 |
| 3 | 영속 포트를 주입하지 않으면 종전대로 **메모리 전용**으로 동작한다 (기존 호출부·테스트 무변경) | 〃`::"영속 포트가 없으면 메모리 전용으로 동작한다"` | 기존 테스트 전량이 이 경로 |
| 4 | 저장된 레코드의 비밀이 vault 에 **있으면** 그 binding 은 `valid` 로 복원된다 | `broker.test.ts::"비밀이 남아 있는 binding 을 valid 로 복원한다"` | `broker.restore()` |
| 5 | 비밀이 **없으면**(`missing`) 그 레코드는 복원되지 않고 저장소에서도 사라진다 | 〃`::"비밀이 없는 레코드는 복원하지 않고 지운다"` | 〃 |
| 6 | 비밀이 **복호화 불가**(`undecryptable`, 키체인 잠김)면 레코드를 **버리지 않고** `unknown` 상태로 복원한다 | 〃`::"복호화 실패는 버리지 않고 unknown 으로 둔다"` | 〃 |
| 7 | `browser_session` artifact binding 은 복원 대상이 아니다 — 복원 후 목록에 없다 | 〃`::"browser_session binding 은 복원하지 않는다"` | 〃 |
| 8 | `application` target binding 은 복원 대상이 아니다 — 앱 게이트가 자동 통과되지 않는다 | 〃`::"application binding 은 복원하지 않는다 — 게이트를 건너뛰지 않는다"` | 〃 |
| 9 | 복원 뒤 컴포지션 루트가 connector binding 마다 `connect` 를 **한 번씩** 부른다 | `auth-restore.test.ts::"복원된 connector 마다 한 번씩 연결한다"` | `bootstrap` → `restoreConnections` |
| 10 | 연결이 실패(자격증명 만료 → `health!=='ready'`)하면 그 binding 을 **logout 시켜** 다음 화면에서 재입력을 받게 한다. 나머지 connector 는 계속 연결된다 | 〃`::"연결에 실패한 binding 은 정리하고 나머지는 계속 연결한다"` | 〃 |
| 11 | 복원·연결 중 예외가 나도 **부팅이 계속된다**(다른 부팅 단계가 실행된다) | 〃`::"복원이 실패해도 부팅을 막지 않는다"` | 〃 |
| 12 | 저장 파일에 **비밀 값이 들어가지 않는다** — 직렬화 결과에 `secret`·토큰 문자열이 0건이고 `artifact` 는 handle 만 담는다 | `binding-store-file.test.ts::"레코드에 비밀 값을 싣지 않는다"` | `infra/auth/binding-store-file.ts` |
| 13 | 손상된 저장 파일(형상 불일치·JSON 아님)을 만나도 **던지지 않고** 빈 목록으로 강등한다 | 〃`::"손상된 저장 내용은 빈 목록으로 강등한다"` | 〃 |
| 14 | 연결 해제(logout)하면 저장소에서도 그 레코드가 사라져 **다음 부팅에 되살아나지 않는다** | `broker.test.ts::"logout 한 binding 은 다음 부팅에 복원되지 않는다"` | `broker.logout()` → `BindingStore.remove` → 저장 |
| 15 | 사람 실기 — Confluence 를 연결한 뒤 앱을 재시작하면 **입력 없이** 연결 상태가 유지되고 `confluence_search` 가 바로 동작한다 | **사람 실기** — 실행 경로: `servers.ts` 등록 → `npm run dev` → 플러그인 탭에서 PAT 입력·연결 → 앱 종료 → 재실행 → 플러그인 탭 상태 확인 → 채팅에서 `confluence_search` | 도구 전체 경로 (P) |
| 16 | 사람 실기 — 서버에서 PAT 를 폐기한 뒤 재시작하면 연결이 **실패로 표시되고 재입력을 요구**한다 | **사람 실기** — 실행 경로: 위와 같되 재시작 전 Confluence 에서 PAT 폐기 | 〃 |

## 범위 / 비범위

- **범위**: `BindingStore` 영속 포트 · `infra/auth/binding-store-file.ts`(electron-store) ·
  `AuthBroker.restore()` · 컴포지션 루트의 복원·재연결 배선.
- **비범위**:
  - **`application` target 복원**(앱 로그인 게이트 자동 통과) — 아래 유예 표 참조.
  - `browser_session` 복원(R8 — cookie jar 가 binding 밖에 있다).
  - 만료 기간·주기적 재검증(사용자가 "자동 복원" 을 선택했고 만료 옵션은 배제했다).
  - 죽은 네임스페이스에 남은 **기존** 잔여 비밀 청소 — vault 는 네임스페이스 열거를 제공하지 않는다.

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| **`application` 복원** | **아니오 — 그리고 지금 넣는 쪽이 더 위험하다.** 앱 게이트는 `RootGate` 가 화면 전체를 막는 UX 경계라, 자동 통과는 사용자가 요청하지 않은 보안 성격의 변경이다. 지금 등록된 application provider 는 **0개**(R9)라 넣어도 효과가 없고, 필요해지면 `restore()` 의 필터 한 줄이다 |
| 기존 잔여 비밀 청소 | 아니오 — vault 에 네임스페이스 열거를 추가하면 언제든 가능. 이번 변경이 **새 잔여를 만들지 않게** 하는 것이 선결이다 |
| 만료·재검증 | 아니오 — 정책 값 추가 |
| **저장 파일 이름·레코드 형상** | **예 — 일방향에 가깝다.** 파일이 사용자 디스크에 남고 다음 버전이 읽는다. → **지금 확정**: `orca-auth-bindings`(electron-store), 레코드는 `AuthBindingInfo` 그대로(이미 IPC DTO 라 형상이 검증돼 있다), 미래 변경은 형상 검사 실패 시 **빈 목록 강등**(AC13)으로 흡수한다 |

## 의존 기술 / 전제

- `electron-store` — **이미 채택된 의존성**(`app/AGENTS.md §의존성 정책` 목록). 신규 의존성 0.
- 전제: safeStorage 가 같은 머신·같은 사용자에서 이전 암호문을 복호화한다. 아니면 AC6 의
  `undecryptable` 경로로 강등된다(전제가 틀려도 조용히 실패하지 않는다).

## 설계

### (1) `BindingStore` — 영속 포트 주입 (기존 동작 보존)

```ts
export interface BindingPersistence {
  load(): AuthBindingInfo[]
  save(records: readonly AuthBindingInfo[]): void
}
```

생성자 두 번째 인자로 **선택적** 주입. 없으면 종전과 동일한 순수 메모리 스토어다(AC3) — 기존
테스트·호출부가 무변경으로 통과한다. 레코드를 바꾸는 모든 경로(`create`·`setStatus`·`patch`·
`takeForRemoval`·`clear`)가 끝에 `save(this.list())` 를 부른다(AC2). **단일 지점으로 모은다** —
경로마다 저장을 흩뿌리면 하나를 빠뜨리는 순간 조용히 어긋난다.

### (2) `infra/auth/binding-store-file.ts` — 파일 구현 (레이어: infra)

`electron-store`(`name: 'orca-auth-bindings'`) 에 `AuthBindingInfo[]` 를 그대로 쓴다. **비밀은
들어가지 않는다** — `artifact` 는 handle 만 담는 구조라 필드를 지울 필요조차 없다(AC12 이 이를
단언으로 고정한다). 읽을 때 **형상 검사**를 거쳐 어긋나면 빈 목록으로 강등한다(AC13) — 손상된
파일 하나로 앱이 못 뜨는 것이 최악이다.

`features` 가 아니라 `infra` 에 두는 이유: DAG 상 `features → infra` 는 허용, 역방향은 금지다.
`BindingStore` 는 **포트만** 알고 electron-store 를 모른다.

### (3) `AuthBroker.restore()` — 비밀 존재를 확인하고 되살린다

```
load 된 레코드마다:
  target.kind !== 'connector'        → 버린다 (AC8 — 앱 게이트를 건너뛰지 않는다)
  artifact.kind !== 'vault_credential' → 버린다 (AC7 — cookie jar 는 복원 불가)
  vault.read(BINDING_SECRET_NAME):
    found         → status 'valid'   (AC4)
    undecryptable → status 'unknown' (AC6 — 키체인 잠김. 버리지 않는다)
    missing       → 레코드 폐기      (AC5 — 쓸 수 없는 binding 을 남기면 UI 가 거짓말을 한다)
```

살아남은 레코드로 `BindingStore` 를 채우고 **그 결과를 다시 save** 해 폐기분이 파일에서도
사라지게 한다. 반환값은 복원된 connector binding 목록 — 컴포지션 루트가 그것으로 재연결한다.

### (4) 컴포지션 루트 — 재연결 (`app/auth-restore.ts`)

```ts
export async function restoreConnections(deps: {
  restored: readonly RestoredConnectorBinding[]
  connect(input: { connectorId: string; bindingId: string }): Promise<void>
  logout(bindingId: string, cascade: boolean): Promise<unknown>
  logger: (message: string, meta?: Record<string, unknown>) => void
}): Promise<void>
```

**순수 오케스트레이션 함수로 떼어낸다** — `bootstrap.ts` 안에 인라인으로 두면 electron 부팅
없이는 테스트할 수 없다(0085 의 교훈: "게이트 판정부를 electron 비의존 순수 모듈로 분리하는
seam 까지 지정했어야 했다"). connect 실패는 그 binding 만 `logout` 시키고 나머지를 계속
연결한다(AC10). 전체를 `try/catch` 로 감싸 부팅을 막지 않는다(AC11).

| 신규 모듈 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `BindingPersistence` 포트 + 주입 (`bindings.ts`) | 저장 훅 | features | 순수 단위 — fake 포트 |
| `binding-store-file.ts` | electron-store 어댑터 + 형상 검사 | **infra** | 순수부(`parseBindingRecords`)를 떼어 단위 테스트. electron-store 자체는 미테스트 |
| `AuthBroker.restore()` | 비밀 확인 후 복원 | features | 기존 broker 테스트 하니스(fake vault) |
| `app/auth-restore.ts` `restoreConnections` | 재연결 오케스트레이션 | **app** | 순수 단위 — fake connect/logout |

## 기존 결정·규칙과의 관계

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **"영속: 하지 않는다. 인증 상태는 매 앱 실행마다 restore/재로그인부터 시작하는 현행 SSO 동작을 승계한다. 영속이 필요해지면 여기서만 바꾸면 된다."** | `features/auth-platform/bindings.ts:12-13` (코드 주석) | §설계 (1) 전체 | **뒤집음 (사용자 요청).** 근거 ⓐ 승계 대상이던 SSO 는 0157 이 전량 제거해 **더 이상 존재하지 않는다** ⓑ 주석 자신이 이 자리를 확장 지점으로 지정했고, 실제로 `bindings.ts` 한 파일 + 어댑터로 끝난다. 주석을 새 사실로 갱신한다 |
| **"secret 은 `ctx.vault` 에만. binding 결과·로그·renderer 응답에 값을 싣지 않는다"** | `modules/AGENTS.md §규칙` · AUTH-PLAT-008 | §설계 (2) 의 "비밀은 들어가지 않는다" | **유지** — 저장 대상은 `AuthBindingInfo`(이미 renderer 로 나가는 DTO)뿐이고 AC12 가 이를 단언한다 |
| **"`application` 은 UX 게이트이지 보안 경계가 아니다"** + "앱 로그인 게이트를 실수로 켜지 마라" | `modules/AGENTS.md` 경고 블록 · 0157 | §범위 비범위의 "application 복원 제외" | **유지** — 게이트 동작을 어느 방향으로도 바꾸지 않는다 |
| **"비밀은 `safeStorage` 로만 봉인한다"** | `app/AGENTS.md §보안 베이스라인` | §설계 (2) — 비밀 저장 경로 무변경 | **유지** — 이번 파일에는 비밀이 없고, 비밀은 종전대로 `SecretStore` 가 봉인한다 |
| **main 레이어 DAG (`features → infra`, 역방향 금지)** | `src/main/AGENTS.md` · `eslint.config.mjs` | §설계 (2) 의 "`infra` 에 두는 이유" | **유지** — 포트는 features, 구현은 infra, 조립은 app |
| **"복호화 실패와 부재의 구분 … 조용한 미인증 진행을 막는 것이 목적"** | `infra/auth/credential-vault.ts:7-10` (헤더 주석) | §설계 (3) 의 3분기 | **유지·활용** — 이 구분이 있어서 AC5/AC6 을 다르게 다룰 수 있다 |
| electron-store 채택 | `app/AGENTS.md §의존성 정책` | §의존 기술 | **유지** — 신규 의존성 0 |

## 파생 UX / 엣지케이스

- **부팅 지연**: connector 마다 `start()` 가 네트워크를 탄다. 사내망 밖(집·VPN 미접속)에서는
  타임아웃까지 기다릴 수 있다 → 재연결을 **부팅 블로킹 경로에 두지 않는다**(AC11).
- **자격증명 만료**: 서버가 PAT 를 폐기하면 `connect` 가 throw → 그 binding 을 logout →
  UI 가 "연결 안 됨" 으로 보이고 사용자가 재입력한다(AC10·AC16).
- **키체인 잠김**(macOS 로그인 직후 등): `undecryptable` → `unknown` 상태로 남긴다. 값이
  사라진 것이 아니므로 레코드를 지우면 안 된다(AC6).
- **다른 머신·다른 사용자로 파일 복사**: safeStorage 복호화가 실패해 같은 `unknown` 경로.
- **동시 연결 시도**: `PluginHost.connect` 가 이미 `activeByConnector` 로 중복을 거부한다 —
  복원 경로가 사용자 수동 연결과 겹쳐도 두 번째가 throw 하고 AC10 의 정리 경로를 탄다.
- **저장 파일 손상**(디스크 오류·수동 편집): 빈 목록 강등(AC13) — 앱은 뜨고 재입력만 받는다.

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| **부팅 경로 변경이라 회귀 시 앱이 안 뜰 수 있다** | 복원·재연결 전체를 `try/catch` 로 감싸 부팅을 막지 않는다(AC11). 순수 함수로 떼어 electron 없이 테스트한다 |
| 자동 복원이 "사용자가 모르는 사이 사내 서버에 요청" 으로 보일 수 있다 | 요청은 자격증명 검증(`/user/current`) 1회뿐이고, 사용자가 **명시적으로 연결한** connector 에 한한다. 연결 해제하면 레코드·vault 가 함께 지워진다(AC14) |
| 이 환경에서 **실제 부팅을 실기할 수 없다**(egress 차단으로 `npm run dev` 불가) | AC15·16 을 **사람 실기**로 명시하고, 그 외 전 경로를 단위 테스트로 덮는다 |
| 저장 파일 형상이 미래에 바뀌면 읽기 실패 | 형상 검사 + 빈 목록 강등(AC13). 파일 이름·형상을 지금 확정(§유예 표) |

- 되돌리기 어려운 결정: **저장 파일 이름·레코드 형상** — 위 유예 표에서 확정했다.
- Open Question: 없음.

## 영향 받는 파일

- `app/src/main/features/auth-platform/bindings.ts`(+`.test.ts`)
- `app/src/main/features/auth-platform/broker.ts`(+`broker.test.ts` 또는 신규 `broker-restore.test.ts`)
- `app/src/main/infra/auth/binding-store-file.ts`(신규, +`.test.ts`)
- `app/src/main/app/auth-restore.ts`(신규, +`.test.ts`)
- `app/src/main/app/bootstrap.ts` (배선)
- `docs/handoff/INDEX.md` · 본 plan

## 참고 문서

- `docs/arch/backend/security.md §1.4` (자격증명 모델) · `src/main/AGENTS.md` (레이어 DAG)
- `docs/handoff/0157-auth-plugin-platform/plan.md` (binding·vault 계약의 출처)
- IPC 변경: **없음** — `AuthBindingInfo` 형상도 그대로다

## 게이트

- `cd app && npm run lint && npm run typecheck`
- `./node_modules/.bin/vitest run src/main/features/auth-platform/ src/main/infra/auth/ src/main/app/`
  (인증 베이스라인 23파일 401테스트 — R10)

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 요구·결정을 원문 인용하고, "connector 범위" 는 추론으로 표기해 §범위에서 근거를 댔다.
- [x] 자료조사 — 10건 전부 `파일:라인`.
- [x] 의존 기술 — 신규 의존성 0(electron-store 는 채택 목록).
- [x] 파생 UX — 부팅 지연·만료·키체인 잠김·머신 이동·동시 연결·파일 손상.
- [x] 리스크 — 부팅 회귀를 1순위로 두고 AC11 + 순수부 분리로 완화.
- [x] 요구 비판적 검토 5문항 + **보안 문항 추가** — "영속화 안 됨" 전제를 정정하고도 요구를 줄이지 않았다(오히려 잔여 비밀 문제를 발견).
- [x] `검증 수단` 빈 칸 0 — AC15·16 은 "사람 실기 + 실행 경로" 명시.
- [x] 부정형/"불변" 기준 0 — AC3·AC8·AC12 도 "메모리 전용으로 동작한다"·"목록에 없다"·"0건" 이라는 측정 가능한 양성 단언.
- [x] AC 간 모순 점검 — AC4(valid 복원)·AC5(폐기)·AC6(unknown)은 vault 3상태로 배타적. AC1(복원)과 AC8(application 제외)은 target 종류로 갈린다. AC2(즉시 저장)와 AC3(포트 없으면 메모리)은 포트 유무로 배타적. AC14 는 AC2 의 `remove` 경로가 AC1 의 복원 입력을 지우는 것이라 **일관**한다.
- [x] 인용 수치 직접 측정 — 인증 베이스라인 23파일/401테스트(R10). 승계 0.
- [x] 신규 모듈 4개 전부 테스트 방법 기재 · electron 의존부(`electron-store`)에서 **순수부(`parseBindingRecords`)를 떼는 seam** 을 설계에 넣었다.
- [x] 전수 조사 N — `BindingStore` 의 레코드 변경 경로 **5곳**(`create`·`setStatus`·`patch`·`takeForRemoval`·`clear`)을 세어 저장 훅 대상으로 명시했다. vault 네임스페이스 파생 지점 3곳(`broker.ts:370,477,506`).
- [x] 각 AC 에 프로덕션 도달 경로 기재 (테스트가 유일 호출자인 AC 0개 — `restoreConnections` 는 `bootstrap` 이 부른다).
- [x] 사람 실기 AC15·16 의 실행 경로가 비범위에 막혀 있지 않다.
- [x] 선택적 필드 미지정 케이스 — 영속 포트 **미주입**(AC3) / 주입(AC1·2), vault `missing`(AC5) / `undecryptable`(AC6) / `found`(AC4) 3상태 전부.
- [x] 제약 필드 강제 지점 — 비밀 미포함은 `binding-store-file` 이 **쓰기 시점**에(AC12), 형상 검사는 **읽기 시점**에(AC13), target/artifact 필터는 `restore()` 가 **복원 시점**에 강제한다.
- [x] 미룬 항목 일방향 여부 답변 완료 — 파일 이름·레코드 형상을 **지금 확정**했다.
- [x] 관문 4 — 기존 결정 표 7행을 본문 문장과 짝지어 채웠고 인용 경로를 열어 확인했다. `[구현자 기입]`·`[검증자 기입]` 블록 있음.

---

## [구현자 기입] 설계 리뷰 (비판적)

- **동의**: "binding id 를 영속하면 vault 네임스페이스가 곧 안정 키가 된다" 는 관찰이 이 작업의
  크기를 결정했다 — 비밀 저장 경로·vault 계약·IPC 를 하나도 안 건드리고 끝났다.
- **이견 ①(해소됨)**: §설계 (2) 가 순수부(`parseBindingRecords`)와 electron-store 어댑터를
  **한 파일**에 두라고 읽혔는데, 그러면 테스트가 그 파일을 import 하는 순간 electron 을 로드하다
  죽는다(제약 환경 베이스라인). 실제로 처음에 그렇게 짜서 테스트가 즉시 실패했다 —
  `binding-records.ts`(순수) / `binding-store-file.ts`(어댑터)로 갈랐다. **plan 이 "seam 을
  지정했다" 고 적고도 파일 경계로는 안 그은 것**이 원인이다.
- **이견 ②**: plan R10 의 베이스라인 수치(12파일/219테스트)가 **틀렸다**. 실측은 23파일/401테스트다.
  설계 단계에서 바로잡아 plan 에 반영했다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | **새 binding id 가 복원된 id 와 충돌할 수 있다.** `bind_${seq}_${random}` 에서 `seq` 는 실행마다 0부터 다시 세므로, 복원된 `bind_1_x` 와 새로 만든 id 가 이론적으로 겹친다. 겹치면 새 binding 이 **남의 vault 네임스페이스를 물려받는다**(자격증명 오배정) | ✅ **구현함** — `create()` 가 미사용 id 가 나올 때까지 다시 뽑는다. `bindings.test.ts::"새 binding id 가 복원된 id 와 겹치지 않는다"` | 명백한 누락, 대가가 자격증명 오배정 → ✅ |
| 2 | `adopt()` 가 없으면 broker 가 복원 결과를 **저장소에 되쓸 방법이 없다** — 폐기한 레코드가 파일에 남아 다음 부팅에 또 되살아난다 | ✅ **구현함** — `adopt(records)` 가 메모리와 파일을 함께 맞춘다. `::"adopt 는 폐기분을 저장소에서도 지운다"` | 구현 세부 → ✅ |
| 3 | plan 이 vault 상태를 `missing` 이라 적었으나 실제 계약은 **`absent`** 다(`CredentialRead`) | ✅ **구현함** — 실제 이름으로 맞췄다. 타입 검사가 즉시 잡았다 | 구현 세부 → ✅ |
| 4 | 재연결을 `await` 하면 **부팅이 네트워크에 묶인다** — 사내망 밖에서는 connector `start()` 가 타임아웃까지 간다 | ✅ **구현함** — `void this.restoreAuthConnections(auth)` 로 부팅 경로에서 떼고, 내부를 `try/catch` 로 감쌌다 | 설계 §리스크가 요구한 것의 구현 형태 → ✅ |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `features/auth-platform/bindings.ts`(+`.test.ts`) · `features/auth-platform/broker.ts`(+`broker-restore.test.ts` 신규) · `infra/auth/binding-records.ts`(신규, +`.test.ts`) · `infra/auth/binding-store-file.ts`(신규) · `app/auth-restore.ts`(신규, +`.test.ts`) · `app/bootstrap.ts`(배선) |
| 게이트 결과 | lint **0 error**(warning 1 = 0102 베이스라인) · typecheck **3/3** · `vitest run features/auth-platform/ infra/auth/ app/auth-restore.test.ts` → **26파일 424/424**(베이스라인 23파일 401 대비 **+3파일 / +23테스트**) |
| 미테스트 표면 | `createBindingPersistence()`(electron-store 인스턴스화)는 이 환경에서 로드 불가라 **미테스트**다. 판단 로직은 전부 `binding-records.ts` 로 뺐으므로 남은 것은 `store.get/set` 위임 3줄이다 |
| 블로커 | 없음. **AC15·16(사람 실기) 미검증** — `npm run dev` 가 egress 차단으로 불가 |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| — | (verify/FAIL 시 신설) | | | |
