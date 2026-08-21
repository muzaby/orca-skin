# Plan — 0194-auth-refresh-and-resume-window

## 메타

| 항목 | 값 |
|---|---|
| slug | `0194-auth-refresh-and-resume-window` |
| 작성자 | Claude Code |
| 일자 | 2026-08-20 |
| 매핑 | 0193 후속 |
| 상태 | DRAFT → READY → IMPL_DONE (r1) → verify/FAIL (r1) → IMPL_DONE (r2) → verify/FAIL (r2) → IMPL_DONE (r3) → verify/FAIL (r3) → IMPL_DONE (r4) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 0193 의 자동 재로그인이 **세 자리에서 도달하지 못한다** — OAuth 는 refresh token 을 쓰지 않고, 부팅 시점에 이미 만료된 grant 는 후보에서 빠지며, 복원이 메인 셸 뒤에서 돈다.
- 완료 후 달라지는 것: OAuth 는 창 없이 refresh 로 살아나고, 앱 종료 중 만료된 grant 도 회복을 시도하며, 복원이 끝날 때까지 전체화면 스피너가 유지된다.
- 성공을 사용자 관점에서 한 문장으로: 스피너가 사라지면 모든 연결 판정이 이미 끝나 있다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "probe 실패시 재로그인 시도는 session browser, oauth 에서도 유효하다. oauth의 경우 refresh token이 있는 경우(유효한 경우) refresh 로직을 수행해야 하며, refresh token이 없거나 만료된 경우 재로그인을 수행한다. refresh 인터페이스 및 없을 수 있다. exchange 출력 인터페이스가 없을 수 있다." | 라이브 세션 2026-08-20 |
| 명시 요구 | "다만 직전 구현까지는 위 경우 expired상태가 되어 재로그인을 수행하지 않는다는 보고가 있다. 맞다면 이 부분 또한 수정 범위다." | 같음 |
| 명시 요구 | "이 모든 작업은 로그인 게이트 통과 이후 gui에서 inflight 애니메이션이 출력되는 동안에 수행돼야 한다. gui가 없어지거나 inflight 애니메이션 출력 전에 수행되면 안 됨." | 같음 |
| 명시 결정 | 대기 화면·refresh 만료 판정·시도 예산·회복 범위 4문항 응답 | 같음 (§3 D-008·D-009·D-010·D-011) |
| 추론 의도 | D-012 하나 — refresh 에는 `methods[0]` 게이트를 적용하지 않는다 | §3 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 대상은 gate 통과 후 **나머지(비-gate) Auth** 다 | gate 자신도, 로그인 흐름 내부 probe 도 아니다 | 0193 사용자 선택 | ACTIVE | — |
| D-002 | 재로그인은 Auth 당 **최대 3회** | 로그인이 내부에 probe 를 포함한다 | 0193 사용자 선택 | ACTIVE | — |
| D-003 | 로그인은 `methods` 의 **첫 번째** 방식으로 | 사용자 원문 "로그인 시도는 methods에서 첫번째로" | 0193 사용자 원문 | ACTIVE | — |
| D-004 | `probe_failed` 가 아닌 결과는 **즉시 중단** | 사용자가 창을 닫았는데 다시 열지 않는다 | 0193 사용자 선택 | ACTIVE | — |
| D-005 | probe 는 **병렬**, 재로그인은 **순차** | 로그인 창이 동시에 여러 개 뜨지 않게 | 0193 사용자 선택 | ACTIVE | — |
| D-006 | `methods[0]` 가 입력형이면 **재로그인**하지 않는다 | 입력 없는 `begin` 은 전역 `input-required` step 만 만든다 | 0193 사용자 선택 | ACTIVE | — |
| D-007 | "복원된 grant 는 통과 근거가 아니다 / 별도 검증 경로를 만들지 마라" 를 유지한다 | refresh 결과도 평소와 **같은 커밋 경로**(`settleGrant`)의 probe 를 통과해야 한다 | `features/gate/index.ts:43-51` | ACTIVE | — |
| D-008 | 게이트 통과 후 복원이 도는 동안 **전체화면 스피너**(`BootScreen`)로 전환한다 | 사용자 선택. 게이트는 통과했으므로 로그인 랜딩이 남지 않는다 | 사용자 선택 2026-08-20 | ACTIVE | — |
| D-009 | refresh 만료 판정은 **선언이 주면 쓰고, 없으면 시도**. `TokenValue.refreshExpiresAt?` 신설 | 값이 있고 지났으면 왕복 0회, 없으면(대다수) 시도 후 실패로 판정 | 사용자 선택 2026-08-20 | ACTIVE | — |
| D-010 | refresh 는 **1회**, 실패하면 재로그인 루프(D-002 의 3회)로 넘어간다 | 같은 refresh token 을 반복해도 결과가 같다 | 사용자 선택 2026-08-20 | ACTIVE | — |
| D-011 | 회복 대상은 `status === 'expired'` **만**이다 | `unknown` 은 키체인 문제라 창만 반복해 뜨고, `none` 은 연결한 적 없는 서비스다 | 사용자 선택 2026-08-20 | ACTIVE | — |
| D-012 | refresh 에는 `autoReloginable`(=`methods[0]` 방식) 게이트를 **적용하지 않는다** — grant 기준으로만 판정한다 | **추론**. D-006 의 이유절("전역 입력 폼")이 refresh 에 성립하지 않는다 — refresh 는 창·폼·step 을 만들지 않는다 | 설계자 추론 | ACTIVE | — |
| D-013 | refresh 실패에 새 `ProviderFailureReason` 멤버를 만들지 않는다 | `AuthRuntime.refresh` 가 `'refreshed' \| 'unsupported' \| 'failed'` 를 돌려주고 IPC 에 노출하지 않는다. 이 결과의 소비자는 `auth-resume.ts` 하나다 | 설계자 판단 | ACTIVE | — |
| D-014 | refresh 응답에 **새 refresh token 이 없으면 보내던 값을 그대로 유지**한다 — 옛 키 참조가 아니라 **값을 새 세대 키로 옮겨 적는다**. 만료도 함께 옮기되 응답이 준 만료가 이긴다. **갱신 경로에만** 적용하고 최초 로그인·재인증에는 적용하지 않는다 | RFC 6749 §6 은 새 refresh token 발급을 선택으로 둔다 — "없음" 으로 커밋하면 갱신 한 번에 회복 능력을 잃는다(r1 D1). 옛 키를 공유하면 커밋 실패 시 정리가 살아 있는 grant 의 자리를 지운다 | 사용자 선택 2026-08-20 (r1 검증 후) | ACTIVE | — |

### 갱신 메모

- 이번 턴 신규: D-008 ~ D-013. 0193 의 D-001 ~ D-007 은 **전건 ACTIVE 유지**이고 SUPERSEDED 는 0건이다.
- **r2 신규: D-014.** r1 검증이 찾은 D1 에 대한 사용자 결정이다. 기존 결정을 바꾸지 않고 D-007("refresh 도 같은 커밋 경로")의 미정의 구석 하나를 채운다 — SUPERSEDED 0건 유지.
- D-006 은 유지된다. D-012 는 그 결정을 바꾸지 않고 *refresh 라는 다른 동작*에 이유절이 성립하지 않음을 적은 것이다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. `D-008`("전체화면 스피너") ↔ `AC13`·`AC16` 일치 · `D-009`("없으면 시도") ↔ `AC8` 일치 · `D-010`("refresh 1회") ↔ `AC6` 일치 · `D-011`("expired 만") ↔ `AC1`·`AC3` 일치 · `D-012`("grant 기준") ↔ `AC7` 일치 · `D-002`("3회") ↔ `AC6`("login 3회") 일치 · `D-001`("나머지만") ↔ `AC19` 일치 · `D-007`("같은 경로") ↔ `AC10` 일치 · `D-013`("wire 미노출") ↔ `AC17`(늘어나는 wire 필드가 `resuming` 하나) 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 지적 3건이 전부 코드에서 재현됐다 | §8 Research 표 3행 |
| 이미 기존 코드가 충족하는가 | 아니오 | `refreshKey` 비-테스트 참조 **7곳** 전부가 쓰기·삭제·타입이고 값을 읽어 쓰는 곳이 0이다 (§8 전수 조사) |
| 더 작은 해법이 있는가 | 요구 2 는 필터 한 줄이 아니다 | 만료 grant 는 probe 를 낼 수 없다 — `policy.ts:68-70` 이 `grantStatus !== 'valid'` 를 거부하므로 후보 배열을 두 갈래로 갈라야 한다 |
| 선행 자료의 주장을 코드와 대조했는가 | **정정 1건** | 0193 plan §7 이 인용한 `auth-resume.test.ts:213·231` 은 현재 `:319`(describe)·`:320`·`:337` 이다. 이번 세션에서 다시 셌다 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 충돌 0 | D-012 는 D-006 의 적용 대상을 늘리지 않고 refresh 에 이유절이 없음을 적는다 |

- 사용자에게 올릴 결정: **D-012 하나**. 반대로 하려면 `refreshOnce` 앞에 `autoReloginable` 한 줄을 더하면 된다.
- 코드 조사로 닫은 사실: 후보 필터가 `status==='valid'` 인 것(`auth-resume.ts:161`) · `reloginDemoted` 가 같은 배열을 도는 것(`:172`) · `RootGate` 가 `gate.passed` 즉시 전환하는 것(`RootGate.tsx:34`) · `TokenValue.refreshToken` 은 이미 있고 vault 에 쓰이는 것(`login.ts:762-763`).

## 5. 동작 / 사용자 흐름

```text
게이트 로그인 완료 (또는 부팅 복원으로 게이트가 이미 열림)
  → [화면] 전체화면 스피너 — AppLayout 은 아직 마운트되지 않는다        ← 신설
  → 나머지 Auth 중 status==='valid' 인 것만 병렬 probe
      → 성공: verified                                    (기존과 동일)
      ↘ 실패: expired 강등 + 즉시 push                     (기존과 동일)
  → 회복 패스 (순차): status==='expired' 인 나머지 Auth 전부
      = 방금 강등된 것 + 부팅 시점에 이미 만료였던 것        ← 후자가 신설
      ① refresh 가능하면 1회 → 성공이면 끝. 창이 뜨지 않는다  ← 신설
      ② 불가/실패면 재로그인 최대 3회                        (기존과 동일)
  → [화면] 스피너 해제 → AppLayout                          ← 신설
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 게이트 통과 | `resuming=true` 를 `passed:true` 와 **같은 push 에** 싣는다 | 로그인 화면이 전체화면 스피너로 바뀐다 |
| 복원 중 OAuth refresh 성공 | grant 교체 + `credential-committed` | 창이 뜨지 않고 스피너만 계속 돈다 |
| 복원 중 browser-session 재로그인 | 로그인 창이 스피너 위에 뜬다 | 창이 깜빡이고 닫힌 뒤 스피너가 이어진다 |
| 복원 종료 (성공·실패·시도 0건) | `resuming=false` | 스피너가 사라지고 메인 셸이 뜬다 |
| 복원 배치가 예외로 끝남 | `finally` 가 `resuming=false` 로 만든다 | 스피너에 잠기지 않는다 |
| bypass 로 `passed:true` 인데 gate 선언 미검증 | `gateOpen()` 이 false 라 `resuming=false` | 스피너에 잠기지 않는다 |
| 부팅 시점에 이미 만료된 OAuth grant | probe 없이 refresh → 실패 시 재로그인 | 지금은 아무 일도 안 일어나던 자리다 |
| 부팅 시점 만료인데 `methods[0]` 가 입력형 | refresh 만 시도하고 재로그인은 안 한다 (D-006·D-012) | 입력 폼이 뜨지 않는다 |

### 파생 UX / 엣지케이스

- loading: 전체화면 스피너 하나뿐이다. `BootScreen` 을 재사용하고 라벨만 파라미터화한다 — 새 화면을 만들지 않는다.
- retry: refresh 1 + 재로그인 3. Auth 사이는 순차라 창이 동시에 두 개 뜨지 않는다.
- cancel: 사용자가 재로그인 창을 닫으면 `cancelled` 로 그 Auth 의 회복이 끝난다(D-004). 스피너는 다음 Auth 로 넘어간다.
- concurrency: probe 는 병렬 유지. refresh·재로그인만 순차다.
- a11y: `BootScreen` 이 이미 `role="status"`·`aria-busy`·`sr-only` 문구·`motion-reduce:animate-none` 을 갖는다.
- 폐쇄망: 망에 못 나가면 refresh 도 재로그인도 실패한다 — 예산 소진 후 강등 상태로 끝나고 스피너가 해제된다.

## 6. 범위 / 비범위

- **범위**: refresh 계약·구현·회복 루프 배선 · 만료 grant 회복 · 복원 대기 창(wire 1필드 + 순수 프레임 셀렉터) · `auth.md §5.2` · `IPC_CONTRACT.md`.
- **비범위**: gate Auth 자신의 refresh·재로그인(D-001) · `unknown`·`none` 회복(D-011) · 백오프/지수 대기 · 로그인 창 타임아웃 단축(현재 5분) · refresh 의 IPC 노출(D-013) · 배포 선언에 실제 refresh endpoint 채우기(`AUTH_DEFINITIONS = []` 이라 세입자 0).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| refresh 재시도 횟수 상향 | 아니오 — 내부 상수 하나 | 필요해지면 후속 |
| `unknown`(vault 복호화 실패) 회복 | 아니오 — 같은 루프의 조건 한 줄 | D-011 로 이번엔 제외 |
| `TokenValue.refreshExpiresAt` 의 이름 | **예 — 배포가 구현하는 공개 계약** | **지금 확정**(D-009) |
| `AuthMethod.oauth.refresh` 의 시그니처 | **예 — 배포가 구현하는 공개 계약** | **지금 확정**(§10) |
| `ProviderPlatformState.resuming` 의 이름 | **예 — wire 계약** | **지금 확정**(§10) |

## 7. Acceptance Criteria — 제품 계약

> 사람 실기 항목은 없다. `auth-resume.ts`·`connection-views.ts`·신설 프레임 셀렉터는 electron 을 물지 않고, `login.ts`·`store*.ts` 는 이미 fake 포트로 테스트된다.

| # | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | 부팅 시점에 `status==='expired'` 인 나머지 Auth 는 probe 없이 회복 대상이 된다 | 단위 — 처음부터 expired 인 Auth 1건에서 `refresh` 또는 `login` 호출 ≥1 | `bootstrap.ts:404` → `resumeRemainingOnce` → 회복 패스 |
| AC2 | probe 후보가 0건이어도 회복 패스는 돈다 | 단위 — probe 후보 0 + expired 1 → `login` ≥1 (현재 코드는 `auth-resume.ts:163` 조기 반환으로 0회) | 같음 |
| AC3 | probe 대상 필터는 불변이다 — expired 인 것에 `auth.resume` 을 부르지 않는다 | 단위 — 그 authId 에 대한 `resume` 호출 0회 | 같음 |
| AC4 | refresh 가 가능하면 **재로그인보다 먼저** 시도한다 | 단위 — 순서 로그에서 `refresh:x` 가 `login:x:1` 앞 | 회복 패스 |
| AC5 | refresh 성공이면 그 Auth 는 `valid`+`verified` 가 되고 `login` 을 **한 번도** 부르지 않는다 | 단위 — `login` 0회 + `snapshot()` 단언 | 같음 |
| AC6 | refresh 는 Auth 당 **1회**다 — 실패하면 두 번째 refresh 없이 재로그인 3회로 넘어간다 | 단위 — `refresh` 1회 · `login` 3회 | 같음 (D-010·D-002) |
| AC7 | grant 가 `token` + `refreshKey` 보유가 아니면 `refresh` 를 부르지 않는다 | 단위 — session grant · secret grant · refreshKey 없는 token **3케이스** 각 0회 | 같음 (D-012 — 판정은 grant 기준) |
| AC8 | `refreshExpiresAt` 이 지났으면 부르지 않고, **미선언이면 시도한다** | 단위 — 2케이스(지남 → 0회 / 미선언 → 1회) | 같음 (D-009) |
| AC9 | 선언이 `refresh` 를 구현하지 않으면 `unsupported` 로 접고 재로그인으로 넘어간다 | 단위 — `login` ≥1 + refresh 결과가 `'unsupported'` | 같음 |
| AC10 | refresh 로 받은 토큰은 **probe 를 통과해야만** 커밋된다 — 실패면 옛 grant 가 그대로다 | 단위(`login.test.ts`) — probe 거부 → `store.get()` 이 옛 grant, `vault.set` 0회 | `LoginService.refresh` → `settleGrant` |
| AC11 | refresh 커밋은 access·refresh **둘 다 새 세대 키**에 쓴다 | 단위(`login.test.ts`) — `vault.set` 2회, 두 키 모두 옛 키와 다름 | `absorbToken` 재사용 |
| AC12 | `Grant.refreshExpiresAt` 이 영속·재파싱을 왕복한다 | 단위(`store-parse.test.ts`) — round-trip 단언 | 부팅 `AuthStore.restore` |
| AC13 | `resuming===true` 인 동안 메인 셸이 아니라 전체화면 스피너가 선택된다 | 단위 — 순수 셀렉터에 `{bootPhase:'ready', passed:true, resuming:true}` → 스피너 프레임 | `RootGate.tsx` 가 이 셀렉터만 읽는다 |
| AC14 | 게이트가 열린 순간 `resuming` 은 `passed:true` 와 **같은 push 에** 실린다 | 단위 — gate 통과 change 직후 동기적으로 `resuming()===true`. **두 구독자 등록 순서를 뒤집은 케이스도 함께 단언한다** | `auth.subscribe` → `pushConnectionState` |
| AC15 | 배치가 끝나면 `resuming` 이 false 가 된다 — 성공·실패·후보 0건·**예외** 4경로 | 단위 4케이스 | 같음 |
| AC16 | 게이트가 열리지 않았으면 `resuming` 은 false 다 — bypass 로 `passed:true` 인 빌드가 스피너에 잠기지 않는다 | 단위 1케이스 | `gateOpen()` 이 bypass 를 보지 않는 기존 성질 |
| AC17 | `connectionState()` 가 `resuming` 을 채우고 wire 타입에 **필수** 필드로 있다 | 단위(`connection-views.test.ts`) + typecheck 3/3 | `handlers/providers.ts` invoke·push |
| AC18 | 부팅 방송은 `P + K + 1` 이다 — **`P` = probe 후보가 있으면 1, 없으면 0**(batch push 는 후보가 있을 때만 나간다) · `K` = 즉시 강등 수 · 복원 종료 push 1회는 **시도 유무와 무관하게** 붙는다 | 단위 — 방송 상한 describe 의 **3케이스**가 `2`(P=1·K=0) · `4`(P=1·K=2) · `1`(P=0·K=0) 을 단언한다. **"기존 테스트 무수정 통과" 를 기준으로 쓰지 않는다**(r3 D4 — 대리 기준은 코드가 정당하게 횟수를 바꾸면 자동으로 거짓이 된다) | 같음 (D-008 — `resuming:true` 를 거두는 push) |
| AC19 | gate Auth 는 refresh·재로그인 대상이 아니다 | 단위 — gate 만 만료시키고 `refresh`·`login` 각 0회 | 회복 패스가 `remainingDefinitions` 만 돈다 |
| AC20 | **§15 가 이름 붙인 문서 전부**가 갱신된다 — `docs/arch/backend/auth.md §5.2`(refresh 단계·회복 대상·갱신 커밋 필드 규칙) · `docs/guides/closed-network-extensions.md §3-b`(배포가 채우는 `refresh`·`refreshToken` 예제) · `docs/IPC_CONTRACT.md`(`resuming`) | 문서 대조 + `check-doc-inventory --check` 차이 0. **AC 의 문서 목록과 §15 의 목록은 한 목록이다**(r3 D8 — 두 벌이라 §15 에만 있던 guide 가 두 라운드 동안 채점 밖이었다) | 문서 |
| AC21 | refresh 응답에 refresh token 이 없으면 옛 값이 **새 세대 키**로 승계된다 — 옛 키는 정리되고 2회차 갱신이 다시 성공한다 | 단위(`login.test.ts`) — 값 동일 · `refreshKey` ≠ 옛 키 · 옛 키 금고에서 사라짐 · 2회차 `refresh()` = `refreshed` | `LoginService.refresh` → `tokenCandidate` |
| AC22 | 승계 시 `refreshExpiresAt` 도 grant 에 실린다 — 응답이 새 만료를 주면 그것이 이긴다 | 단위 — 4케이스(승계 시 옛 만료 · 응답 만료가 이김 · 회전이면 만료 없음 · 회전+만료면 그 값) | 같음 |
| AC23 | 갱신이 실패하면 옛 access·refresh 가 **둘 다** 산다 — probe 거부 경로와 **금고 쓰기 실패 경로 모두** | 단위 2케이스 — 후자가 옛 키 참조 승계를 배제하는 근거다 | `settleGrant` 되돌리기 |

### AC 검증 주의사항

- 기존 테스트 재사용: 방송 상한 describe 가 `auth-resume.test.ts` 에 실재하고 **P=1 인 2케이스**(K=0 / K=2)를 갖는다. **0193 plan 이 적은 `:213`·`:231` 은 현재 좌표가 아니다** — 설계 세션에서 다시 셌다. AC18 이 요구하는 **P=0 케이스는 그 describe 에 없다** — 지금은 다른 describe(`부팅 시점에 이미 만료된 grant`)에만 있어, 상한의 정본이 `P` 항을 스스로 증명하지 못한다.
- AC18 의 관측 지점: fake `pushConnectionState` 의 **호출 횟수**다. 세 케이스가 `P`·`K` 를 각각 독립으로 움직여 세 항을 가른다 — **P 만 0 으로 내린 케이스가 없으면 batch push 를 무조건으로 만들어도 상한이 초록**이다(r3 D12 가 그 자리였다).
- N회 기준의 관측 지점: fake `AuthRuntime` 의 `refresh`·`login` **호출 횟수**다. 호출 지점 grep 이 아니다.
- 순서 기준의 관측 지점: 기존 fake 의 `enter:`/`exit:`/`login:` 로그 배열(`:83`·`:108` 관례)에 `refresh:` 를 같은 방식으로 잇는다.
- AC14 는 structural proxy 를 쓰지 않는다 — "구독자 순서와 무관" 을 주석으로 적는 대신 **테스트에서 실제로 뒤집어** 두 순서 모두 단언한다.
- 부정형 AC(AC3·AC5·AC7·AC8·AC16·AC19)는 각각 짝이 되는 정상 동작 AC(AC1·AC4·AC6·AC13)가 같은 파일에 있다.
- 총량/0건 기준: AC18 이 잠그는 것은 **회복이 로그인 창을 열지 않은 경로**의 방송 총량이다. 재로그인이 실제로 도는 경로는 로그인 자체가 내는 change 가 더해져 `P + K + 1` 을 넘고, 그 총량은 AC 로 잠그지 않는다(0187 D2 의 "통지 1회" 가 달성 불가였던 선례).

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| 후보 필터가 `status==='valid' && !verified` 라 만료 grant 가 빠진다 | `app/src/main/app/auth-resume.ts:156-162` |
| `reloginDemoted` 가 **같은 배열**을 돌아 만료였던 것은 회복 대상이 아니다 | `app/src/main/app/auth-resume.ts:172` |
| 후보 0건이면 회복 전에 조기 반환한다 | `app/src/main/app/auth-resume.ts:163` |
| 이미 시계상 만료된 grant 는 probe 전에 `settleExpiry` 로 반환된다 | `app/src/main/features/auth/login.ts:303-306` |
| 만료 grant 는 요청 자체가 거부되므로 probe 를 낼 수 없다 | `app/src/main/features/auth/policy.ts:68-70` |
| refresh token 은 vault 에 쓰이기만 하고 읽히지 않는다 | `app/src/main/features/auth/login.ts:762-763` (쓰기) · 읽는 곳 0 |
| `TokenValue` 에 `refreshToken?` 은 이미 있다 — 없는 것은 **만료 시각과 진입점**이다 | `app/src/main/contracts/auth.ts:92-97` |
| oauth `AuthMethod` 는 `authorize` 만 갖는다 | `app/src/main/contracts/auth.ts:154-164` |
| 새 자격증명 커밋 규칙(새 키 2개 → grant 저장이 커밋)이 이미 한 곳에 있다 | `app/src/main/features/auth/login.ts:458-512` `settleGrant` · `:729-768` `absorbToken` |
| `RootGate` 가 `gate.passed` 즉시 `AppLayout` 으로 전환한다 | `app/src/renderer/src/app/RootGate.tsx:34-45` |
| 복원은 push 구독자보다 **뒤에** 등록된 구독자가 시작한다 | `app/src/main/app/bootstrap.ts:367`(push) · `:401-403`(onGateChange) |
| `gateOpen()` 은 bypass 를 보지 않는다 | `app/src/main/app/auth-resume.ts:80-86` |
| `BootScreen` 이 이미 a11y 를 갖춘 전체화면 스피너다 | `app/src/renderer/src/app/boot/BootScreen.tsx:34-40` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `refreshKey` 비-테스트 참조 | `rg -n "refreshKey" src/main --glob '!*.test.ts'` | 7 | `contracts/auth.ts:188`(타입) · `login.ts:737·748·762·763`(쓰기 4) · `store-parse.ts:44`(파싱) · `store.ts:22`(sweep). **값을 읽어 쓰는 곳 0** |
| `createAuthResume` 호출부 | `rg "createAuthResume" src --glob '!*.test.ts'` | 1 | `bootstrap.ts:394` — deps 추가 시 고칠 곳 1 |
| `connectionState(` 호출부 | `rg "connectionState\(" src/main --glob '!*.test.ts'` | 1 | `bootstrap.ts:361` — 인자 추가 시 고칠 곳 1 |
| `ProviderPlatformState` 소비처 | `rg "ProviderPlatformState" src` | main·preload·renderer 3층 | 필수 필드 추가는 typecheck 가 전수 지목한다 |
| `AuthMethod` union 멤버 | `contracts/auth.ts:154-164` | 5 | `api-key`·`password`·`pat`·`oauth`·`browser-session`. refresh 는 `oauth` 1종에만 붙는다 |
| `Grant` union 멤버 | `contracts/auth.ts:186-189` | 3 | `secret`·`token`·`session`. refresh 는 `token` 1종에만 성립한다 |
| `ProviderFailureReason` 멤버 | `shared/ipc.ts:1296-1306` | 8 | D-013 로 **늘리지 않는다** |
| `AuthRuntime` 메서드 | `contracts/auth.ts:345-365` | 10 | `refresh` 로 11이 된다 |
| `auth-resume.test.ts` 기존 케이스 | `rg "^  it\(|^  it\.each" src/main/app/auth-resume.test.ts` | 33 | 0193 r2 보고와 일치 |

### 수치 / 전칭 표현 검산

- 재측정 수치: `AuthMethod` 5 · `Grant` 3 · `ProviderFailureReason` 8 · `AuthRuntime` 10 · `refreshKey` 참조 7 · 기존 테스트 33케이스.
- 내역 합 = 총계: `refreshKey` = contracts 1 + login 4(`:737`·`:748`·`:762`·`:763`) + store-parse 1 + store 1 = **7**. `rg -c` 합계도 7 로 일치한다.
- "유일한/항상" 반례 검색: "refresh token 을 읽는 곳이 없다" 는 `vaultKeysOf`(`store.ts:22`)가 유일한 읽기인데 그것은 **키 목록 도출**이지 값 읽기가 아니다. `vault.read(` 호출부 중 refresh 키를 넘기는 곳 0건.
- 문서 앵커 확인: `docs/arch/backend/auth.md` 의 `### 5.2 부팅 복원 순서` 가 실재한다(`:350`).
- 기존 테스트 케이스 존재 확인: `describe('createAuthResume — 방송 상한 1 + K (0187 D2 승계)')` `:319`, 케이스 `:320`·`:337`. **0193 plan 의 `:213`·`:231` 은 stale 좌표다.** (설계 시점 스냅샷이다 — describe 명과 좌표는 r3·r4 에서 바뀌었고 현재 기준은 §7 AC18 이 갖는다.)

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 현재 책임 소유자: `app/auth-resume.ts` 가 순서·병렬성·방송 합치기·재로그인 정책을 갖는다. 자격증명 lifecycle 은 `features/auth` 다.
- entry → flow → consumer: `bootstrap.run()` → `authResume.run()`/`onGateChange` → `resumeRemainingOnce` → 후보 필터 → `Promise.all(resume)` → `pushConnectionState` → `reloginDemoted(candidates)`.
- 오류/정리 경로: 재로그인 throw 는 catch 해 그 Auth 만 중단한다. 배치 자체의 종료를 관측하는 소비자는 없다.
- 직접 원인 3가지: ⓐ 후보 배열 하나가 probe 대상과 회복 대상을 겸해 만료 grant 가 빠진다 ⓑ OAuth 회복 수단이 재로그인뿐이다 ⓒ 배치 종료가 화면에 도달하지 않는다.

```text
bootstrap → void authResume.run()
  → gate 순차 resume ──→ gate 통과
  → subscribe#1 pushConnectionState        ← {passed:true} 가 여기서 나간다
  → subscribe#2 onGateChange → startRemaining()
       → candidates = remaining.filter(probe && valid && !verified)
       → candidates.length === 0 → return          ← 만료된 것은 여기서 사라진다
       → Promise.all(resume ×N) → push → reloginDemoted(candidates)
renderer: RootGate — gate.passed 즉시 AppLayout    ← 위 전부가 메인 셸 뒤에서 돈다
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 책임 소유자: **그대로** `app/auth-resume.ts` 다. refresh 의 *가능 판정과 실행*만 `features/auth` 로 내려간다 — 그것은 자격증명 lifecycle 이다.
- entry → flow → consumer: 위와 같되 후보 배열을 **probe 대상**과 **회복 대상**으로 가르고, 회복 대상마다 refresh 1회를 재로그인 앞에 둔다. 배치 종료는 `resuming()` 파생값으로 화면에 도달한다.
- 오류/취소 경로: refresh throw 도 재로그인 throw 와 같은 취급(그 Auth 만 중단). `remainingSettled` 는 `finally` 에서 세운다.
- 유지하는 메커니즘: `Promise.all` 병렬 probe · `emitVerifiedChange:false` 배치 · `remainingResume ??=` 1회성 · attempt fence · `settleGrant` 커밋 규칙 · `gateOpen()`.
- **제거하는 메커니즘 없음.** `candidates.length===0` 조기 반환은 **삭제가 아니라 probe 블록 안으로 이동**한다.

```text
bootstrap → void authResume.run()
  → gate 순차 resume ──→ gate 통과
  → resuming() = !remainingSettled && gateOpen(...)   ← 파생값. 구독자 순서와 무관
  → subscribe#1 pushConnectionState                   ← {passed:true, resuming:true}
  → subscribe#2 onGateChange → startRemaining()
       → probeTargets = remaining.filter(probe && valid && !verified)
       → if (probeTargets.length > 0) { Promise.all(resume ×N); push }   ← P + K (P=0|1)
       → recoverExpired(remaining)                    ← 전체를 다시 훑는다
            for each (status==='expired') 순차:
               ① refreshOnce  (grant 기준 · 1회)
               ② reloginOnce  (methods[0] 기준 · 3회)
            시도 ≥1 이면 push
       → finally { remainingSettled = true; push }     ← 스피너 해제
renderer: RootGate → rootFrame({bootPhase, bootError, gate, resuming})
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | 구현/검증 연결 |
|---|---|---|---|---|
| 회복 대상 | probe 후보 배열(= 한때 `valid` 였던 것) | `remainingDefinitions` 중 그 시점 `expired` 인 전부 | 만료 grant 는 probe 를 낼 수 없어 후보에 못 들어간다 | `auth-resume.ts` · AC1·AC3 |
| 조기 반환 | 후보 0건 → 회복까지 건너뜀 | probe 블록만 건너뛰고 회복은 돈다 | 만료만 있는 부팅이 통째로 무시된다 | `auth-resume.ts` · AC2 |
| OAuth 회복 수단 | 재로그인뿐(창이 뜬다) | refresh 1회 → 실패 시 재로그인 3회 | D-010 | `login.ts`·`auth-resume.ts` · AC4~AC9 |
| 계약(선언) | oauth = `{kind,label,present,authorize}` | `+ refresh?(refreshToken): Promise<TokenValue>` | 배포가 구현할 진입점이 없었다 | `contracts/auth.ts` · AC9 |
| 계약(값) | `TokenValue{token,expiresAt?,refreshToken?,principalId?}` | `+ refreshExpiresAt?` · `Grant.token` 에도 보관 | D-009 | `contracts/auth.ts`·`store-parse.ts` · AC8·AC12 |
| 포트 | `AuthRuntime` 10 메서드 | `+ refresh(authId): Promise<AuthRefreshResult>` | 회복 패스가 app 레이어라 포트를 거쳐야 한다 | `contracts/auth.ts`·`runtime.ts` · AC5 |
| wire | `ProviderPlatformState{gate,providers,step}` | `+ resuming: boolean` (필수) | 화면이 배치 종료를 알아야 한다 | `shared/ipc.ts`·`connection-views.ts` · AC17 |
| 화면 판정 | `RootGate.tsx` 안의 4갈래 if 사슬 | **순수 셀렉터** + 얇은 컴포넌트 | 판정을 사람 실기로 미루지 않는다 | `app/rootFrame.ts` · AC13 |
| 대기 화면 | 없음 | `BootScreen` 재사용(라벨 파라미터화) | D-008. 새 컴포넌트를 만들지 않는다 | `BootScreen.tsx` · AC13 |
| error/lifecycle | 재로그인 throw catch | 동일 + refresh throw · `remainingSettled` 는 `finally` | 예외 하나로 앱이 스피너에 잠기면 안 된다 | `auth-resume.ts` · AC15 |
| test seam/관측점 | `enter:`/`exit:`/`login:` 로그 + 호출 수 | `+ refresh:` 로그 + `resuming()` 동기 관측 | 순서·횟수·화면 판정을 전부 단위로 | `auth-resume.test.ts`·`rootFrame.test.ts` |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `app/auth-resume.ts` | 복원 순서 · 병렬성 · 방송 합치기 · **회복 정책(refresh 먼저, 그다음 재로그인)** · `resuming()` | `ResumeAuthDeps` → `AuthResumeHandle` | `app/bootstrap.ts:394` (유일) |
| `features/auth/login.ts` | Auth 하나의 확인·로그인·**refresh 가능 판정과 실행** | `authId` → `AuthStep` / `AuthRefreshResult` | `runtime.ts` 를 통해 |
| `features/auth/store.ts` | grant·vault 접근. `refreshSecret(authId)` 신설 | `authId` → `string \| null` | 같은 slice |
| `app/connection-views.ts` | Auth → GUI DTO 조립 | `+ resuming: boolean` | `bootstrap.ts:361` |
| `renderer/app/rootFrame.ts` | 최상위 프레임 선택 **순수 판정** | `{bootPhase,bootError,gate,resuming}` → frame | `RootGate.tsx` (유일) |

## 10. 계약 / 타입 / 강제 지점

| 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| 회복 대상 = 그 시점 `status==='expired'` | `auth-resume.ts` | 회복 루프 | ① 회복 패스 진입 필터 ② **매 시도 직전**(기존 `demoted`) — **2지점** | 해제한 연결이 되살아나거나 사용자의 로그인이 덮인다 |
| refresh 가능 판정 = grant 가 `token` + `refreshKey` 존재 + `refreshExpiresAt` 미경과 + 선언이 `refresh` 구현 | `features/auth/login.ts` **한 곳** | `LoginService.refresh` | 진입 시 1지점 | 판정이 두 벌이면 `auth-resume` 과 `login` 이 갈린다. **`auth-resume` 은 결과만 본다** |
| refresh 1회 · 재로그인 3회 | `auth-resume.ts` 상수 2개 | 회복 루프 | 루프 조건 — **2지점** | 창·왕복이 예산을 넘는다 |
| refresh 결과는 probe 통과 후에만 커밋 | `settleGrant`(기존) | `absorbToken` 재사용 | 커밋 시 1지점 | 죽은 토큰이 `verified` 로 커밋된다 |
| refresh 커밋은 access·refresh 둘 다 **새 세대 키** | `absorbToken`(기존) | 같음 | 같음 1지점 | 부분 적용 자격증명 창이 열린다 |
| `refreshExpiresAt` 영속 | `tokenCandidate` + `store-parse.ts` | 커밋·파서 | ① **커밋 쓰기**(`tokenCandidate` — grant 에 싣는 곳) ② 부팅 파싱 — **2지점** (r2 정정: r1 은 "직렬화는 자동" 이라 적어 producer 를 세지 않았고 그 지점에 눈이 없었다) | 재시작하면 만료 정보를 잃고 죽은 refresh 로 왕복한다 |
| refresh 미회전 시 값 승계 (D-014) | `LoginService.refresh` **한 곳** | 갱신 커밋 | `tokenCandidate` 호출 직전 — **1지점** | 갱신 한 번에 회복 능력을 잃고 두 번째 만료부터 로그인 창만 남는다 |
| **grant 조립은 필드를 빠뜨릴 수 없다** (r3 신설 D7 · **r4 정정 1→3**) | `Grant` 갈래별 조립 리터럴 | 최초 로그인·재인증·갱신 커밋 | `compact<T>` 리터럴 — ① `secretCandidate` ② `tokenCandidate` ③ `absorb` 의 `session` case — **3지점**. 분모는 `Grant` union 갈래 수이고 `rg -c "kind: 'secret'\|kind: 'token'\|kind: 'session'" src/main/contracts/auth.ts` 로 센다 | 안 닫힌 갈래는 `GrantBase` 에 필드가 늘어도 조용히 통과하고, 라운드마다 다른 필드로 재발한다(D1 `refreshToken` → D7 `principalId`) |
| **`compact` 인자는 필수 키에 `undefined` 를 받지 않는다** (r4 신설 — D14) | `shared/obj.ts` `compact` 시그니처 **한 곳** | 위 행의 3지점 전부 | 시그니처 **1지점** — 필수 키는 `T[K]` 를, 선택 키만 `null`/`undefined` 를 받는다 | `Partial<T>` 는 필수 키에도 `undefined` 를 허용한다. `vaultKey: undefined` 가 typecheck 를 통과하고 `as T` 가 그것을 감춰 런타임에만 드러난다(r3 VF1) |
| `resuming` = `!remainingSettled && gateOpen(...)` | `auth-resume.ts` **파생 함수 1개** | 소비자 | ① 조립 push(`bootstrap.ts`) ② 조립 invoke(`handlers/providers.ts`) ③ `rootFrame()` 판정 — **3지점** (r3 정정: r1 은 조립을 1지점으로 셌다) | 별도 플래그면 push 순서에 따라 메인 셸이 한 프레임 번쩍인다 |
| `remainingSettled` 는 `finally` 에서 | `auth-resume.ts` | 배치 | 종료(성공·실패·throw) 1지점 | 예외 하나로 앱이 스피너에 영구히 잠긴다 |
| 판정·상태의 문서 사본 | `plan.md` + `INDEX.md` | 설계자·구현자·검증자 | 상태를 바꾸는 **모든** 커밋 — **2지점** | 두 사본이 서로 다른 말을 한다 |

- 같은 규칙이 여러 레이어에 있는가: **`resuming` 하나다.** main 은 `connectionState()` 에서, renderer 는 `rootFrame()` 에서 읽는데 **둘 다 파생값을 소비만** 하고 재계산하지 않는다. 계산은 `auth-resume.ts` 한 곳이다.
- **`resuming` 을 파생값으로 두는 것이 이 설계의 핵심이다.** 별도 boolean 플래그면 `bootstrap.ts:367`(push)과 `:401`(onGateChange) 두 구독자의 등록 순서에 정답이 생기고, 순서가 뒤집히면 `{passed:true, resuming:false}` 가 한 번 나가 메인 셸이 한 프레임 뜬다. `gateOpen()` 은 store 를 동기로 읽으므로 게이트가 열린 change 시점에 이미 true 이고, 그래서 **어느 구독자가 먼저든 같은 값**이 나간다.
- `gateOpen()` 재사용이 bypass 잠김(AC16)도 함께 닫는다 — bypass 는 `gateOpen` 을 보지 않는다(`auth-resume.ts:78-79` 의 기존 근거).
- 선택적 필드의 `true/false/undefined` 의미: `TokenValue.refreshExpiresAt` `undefined` = **만료를 모른다 → 시도한다**(D-009). fail-open 이 아니다 — 실패하면 재로그인으로 이어져 결말이 같다. `AuthMethod.oauth.refresh` `undefined` = `'unsupported'` = 현재 동작.
- 외부 SDK 경계: 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/contracts/auth.ts` | 계약 | `TokenValue.refreshExpiresAt?` · `Grant.token.refreshExpiresAt?` · oauth `AuthMethod.refresh?` · `AuthRuntime.refresh` · `AuthRefreshResult` | 타입 |
| `app/src/main/features/auth/login.ts` | 인증 lifecycle | `LoginService.refresh(authId)` — 가능 판정 → `store.refreshSecret` → `openAttempt` → 선언 `refresh()` → **`absorbToken` 재사용** | 순수(기존 fake 포트) |
| `app/src/main/features/auth/store.ts` | grant·vault | `refreshSecret(authId)` — `grant.refreshKey` 를 읽는다. **`grant.expiresAt` 을 보지 않는다**(access 가 만료된 그 순간이 refresh 를 쓰는 때다), `refreshExpiresAt` 만 본다 | 순수 |
| `app/src/main/features/auth/store-parse.ts` | 영속 형상 | `parseGrant` token 분기에 `refreshExpiresAt` | 순수 |
| `app/src/main/features/auth/runtime.ts` | 포트 배선 | `refresh: (authId) => login.refresh(authId)` | — |
| `app/src/main/app/auth-resume.ts` | 복원·회복 정책 | probe/회복 배열 분리 · `recoverExpired` · `refreshOnce` · `resuming()` · `remainingSettled` | 순수(electron 미의존 유지) |
| `app/src/main/app/connection-views.ts` | GUI DTO | `connectionState(auth, gate, sources, resuming)` | 순수 |
| `app/src/main/app/bootstrap.ts` | 배선 | `authResume` 를 `pushConnectionState` 클로저보다 먼저 만들어 `resuming` 을 주입 — **선언 순서 조정 1건** | 기존 배선 |
| `app/src/shared/ipc.ts` | wire | `ProviderPlatformState.resuming: boolean` | typecheck |
| `app/src/renderer/src/app/rootFrame.ts` **신설** | 프레임 판정 | 순수 셀렉터 | 단위 |
| `app/src/renderer/src/app/RootGate.tsx` | 셸 | 셀렉터 호출로 축약 | — |
| `app/src/renderer/src/app/boot/BootScreen.tsx` | 대기 화면 | `screenLabel?`·`srLabel?` optional prop. **기본값 = 현재 값**이라 `data-screen-label` DOM 마커가 회귀하지 않는다 | — |
| `app/src/renderer/src/features/providers/hooks/useProviderGate.ts` | 구독 | `resuming: state?.resuming ?? false` | — |
| `docs/arch/backend/auth.md` §5.2 · `docs/IPC_CONTRACT.md` | 현재 상태 서술 | refresh 단계 · 회복 대상 확대 · `resuming` 필드 | 문서 대조 |

설계 스케치(형태만 — 구현자가 파일 관례에 맞춘다):

```ts
// auth-resume.ts
const MAX_RELOGIN_ATTEMPTS = 3   // 기존
const MAX_REFRESH_ATTEMPTS = 1   // 신설 (D-010)

let remainingSettled = false
const resuming = (): boolean =>
  !remainingSettled && gateOpen(deps.auth, deps.gateDefinitions)
```

- 회복 후보 수집: probe batch 뒤 `deps.remainingDefinitions` 를 **다시** 훑어 `snapshot().status === 'expired'` 인 것을 모은다. probe 후보 배열을 재사용하지 않는다(그것이 AS-IS 의 결함이다).
- 순차 루프: `for … of` + `await` (D-005). refresh 도 그 안에 있다.
- Auth 하나의 순서: `refreshOnce`(가능하면 1회) → 결과가 `'refreshed'` 면 return → 아니면 `reloginOnce`(기존, 최대 3회).
- refresh 게이트: **`autoReloginable` 을 적용하지 않는다**(D-012). 가능 판정은 `LoginService.refresh` 가 소유하고 여기서는 결과만 본다.
- 재로그인 게이트: 기존 `autoReloginable` 그대로(D-006).
- 종료: `resumeRemainingOnce` 전체를 `try/finally` 로 감싸 `remainingSettled = true` + `pushConnectionState()`.

```ts
// contracts/auth.ts — 배포가 구현할 진입점
| {
    kind: 'oauth'
    label: string
    present: Presentation
    authorize(ctx: AuthCtx): Promise<OAuthStart>
    // refresh_token grant. 미구현이면 만료 시 재로그인만 남는다.
    // PKCE·state 는 이 흐름에 없으므로 `AuthCtx` 를 받지 않는다.
    refresh?(refreshToken: string): Promise<TokenValue>
  }
```

### 테스트 가능성

- electron/DB 의존부 분리: **불필요** — `auth-resume.ts`·`connection-views.ts`·`store-parse.ts` 는 이미 순수이고 이 작업이 그 성질을 유지한다.
- 신설 `rootFrame.ts` 는 **별도 파일**이다. `RootGate.tsx` 안에 두면 React·electron preload 를 물어 vitest 대상에서 벗어난다(`app/src/main/AGENTS.md` P29 와 같은 이유).
- 기존 메커니즘 재사용 적합성: fake `AuthRuntime`(`auth-resume.test.ts:36-220`)에 `refresh` 를 더한다. 기존 33케이스는 grant 형상이 refresh 불가라 **`refresh` 를 부르지 않는다** — AC18 의 관측 지점과 같은 성질이다.
- 순서 관측: 기존 `log` 배열에 `refresh:<id>` 를 같은 방식으로 적는다.
- `resuming()` 은 동기 함수라 배치 진행 중 임의 시점에 호출해 단언할 수 있다.

## 12. End-to-end 영향

### producer → consumer

```text
LoginService.refresh(성공) → absorbToken → settleGrant(probe) → store.put
  → onSnapshot('credential-committed') → bootstrap 구독자
  → pushConnectionState + plugin.sync() + harnessRuntime.invalidateForAuth
```

- producer 기준: refresh 성공은 **기존 수동 로그인과 완전히 같은 이벤트**를 낸다 — 소비자가 새 분기를 배우지 않는다.
- consumer 파생 규칙: `resuming` 하나가 늘고, 그것을 읽는 곳은 `rootFrame()` 하나다.
- 파생 가능한 합성값이 정본을 우회하는가: 아니다 — `resuming` 은 renderer 가 재계산할 수 없는 값이라 wire 로만 온다. `passed && !resuming` 같은 합성을 renderer 가 임의로 만들지 않도록 셀렉터 한 곳에 가둔다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `bootstrap.ts:367` 구독자(plugin sync · harness invalidate) | refresh 성공 1건당 `credential-committed` 1회 — 도구 재sync 가 **의도된 결과**다 | AC5 |
| `app/connection-views.ts:87-97` | 인자 1개 추가. 호출부 1곳(`bootstrap.ts:361`) | AC17 |
| `useProviderGate` 소비자(`RootGate`·`GateFrame`) | `resuming` 필드 1개 추가. 게이트 화면 자체는 불변 | AC13 |
| `preload/index.ts:225·234-237` | payload 형상만 넓어진다 — 채널·시그니처 불변 | AC17 |
| `docs/IPC_CONTRACT.md` `provider:state` 행 | 필드 1개 서술 추가. **채널 수 불변** | AC20 |
| `AuthStore.restore` 고아 sweep(`vaultKeysOf`) | `refreshExpiresAt` 은 키가 아니라 값이라 sweep 대상 집합이 바뀌지 않는다 | AC12 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `resumeRemainingOnce` 안. `remainingResume ??=` 가 refresh 까지 **1회성**으로 묶는다.
- 취소/중단: refresh 실패 → 재로그인으로. 재로그인은 `probe_failed` 외 전부 중단(D-004). 상태가 `expired` 가 아니게 되면 중단.
- 종료/quit: 회복 중 앱이 종료되면 남은 시도는 사라진다 — 카운터는 메모리 지역 변수라 디스크에 중간 상태가 없다.
- retry/timeout: 로그인 창 타임아웃은 `SessionRunner` → `cancelled` 로 접히므로 D-004 로 중단된다. refresh 는 `probeOk` 의 `PROBE_TIMEOUT_MS` 를 탄다.
- cleanup/rollback: refresh 가 실패하면 `settleGrant` 가 `rejected` 를 돌려주고 **아무것도 쓰지 않는다** — 옛 grant·옛 vault 키가 그대로다(AC10).
- **화면 잠김 방지**: `remainingSettled` 는 `finally` 에 있다. refresh/login 의 개별 throw 는 이미 catch 되지만, 후보 수집이나 `snapshot()` 에서 던지는 경우까지 `finally` 가 덮는다.
- **다중 저장소 쓰기**: 이 작업이 새로 만드는 쓰기는 없다. refresh 커밋은 `settleGrant`(`login.ts:458-512`)의 "새 키에 쓰고 grant 저장이 곧 커밋" 규칙을 그대로 탄다 — access·refresh **둘 다** 새 세대 키라 `new-access + old-refresh` 혼합 상태가 생길 자리가 없다(`login.ts:755-757` 의 기존 근거). **문서 사본**: 이 handoff 의 판정은 `plan.md` 본문과 `docs/handoff/INDEX.md` 두 곳에 산다 — 상태·다음 주체를 **두 곳 모두** 같은 커밋에서 갱신한다.

## 14. 성능 / 상한 / 최적화

- 새 요청 수의 `원천 상한 × 배치 상한`: 나머지 Auth **N** × (refresh **1** + 로그인 **3**) = 최대 `4N` 시도. 각 로그인이 내부 probe 1회를 포함하므로 probe 총 상한은 `N × 4`(refresh 의 커밋 probe 1 + 로그인 3).
- refresh 는 창을 열지 않는다 — **성공하면 벽시계가 오히려 줄어든다**(창 왕복 → 요청 1회).
- 시간 상한: Auth 1건당 최악은 `refresh 1회 + 정상 종료 로그인 2회 + 창 타임아웃 1회(≈5분) + probe 15초 ×3`(`login.ts:64` `PROBE_TIMEOUT_MS`). **타임아웃은 연속으로 날 수 없다** — `SessionRunner` 가 `cancelled` 로 접어(`runner.ts:54-61`) D-004 로 그 자리에서 중단하므로 그 Auth 의 마지막 시도다.
- **D-008 이 바꾼 것**: 이 시간 동안 사용자는 메인 셸 대신 스피너를 본다. 부팅 자체는 여전히 막히지 않는다(`bootstrap.ts:404` `void`) — DB 초기화·설정·UsageTracker 는 그대로 진행되고, 지연되는 것은 **화면 전환 하나**다.
- 캐시/호출 축소로 잃는 부수 효과: 없음 — 이 작업은 호출을 늘리는 쪽이다.

## 15. 외부 구현 포트 / 문서 계약

배포가 구현할 표면이 **2개 늘어난다**. 둘 다 optional 이라 기존 선언은 컴파일이 그대로다.

- port: `AuthMethod.oauth.refresh?(refreshToken: string): Promise<TokenValue>` · `TokenValue.refreshExpiresAt?: number`(epoch ms).
- 구현 문서(= AC20 의 목록): `docs/guides/closed-network-extensions.md §3-b`(유일한 oauth 예제) · `docs/arch/backend/auth.md §5.2` · `docs/IPC_CONTRACT.md`. **이 목록과 AC20 은 한 목록이다** — 두 벌이면 한쪽에만 있는 문서가 채점 밖으로 샌다(r3 D8).
- **shape 검증**: 문서 예제를 실제 `app/deployment/auth-definitions.ts` 에 채워 `npm run typecheck` 3/3 을 통과시킨 뒤 되돌린다 (0181 5단계-e · 0182 AC11 · 0183 선례).
- **semantics 검증**: `refresh` 가 던지면 `'failed'`, `undefined` 면 `'unsupported'`, 성공해도 probe 실패면 커밋되지 않음 — 3의미를 contract 성격의 단위 테스트로 잠근다(AC9·AC10).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 0193 D-001 ~ D-007 | `docs/handoff/0193-…/plan.md §3` | §3 승계 표 | **전건 유지** |
| "복원된 grant 는 통과 근거가 아니다 · 별도 검증 경로를 만들지 마라" | `features/gate/index.ts:43-51` | §10 refresh 커밋 행 | **유지** — refresh 도 `settleGrant` 의 probe 를 통과해야 커밋된다 |
| "게이트가 먼저" 순서 규칙 | `app/auth-resume.ts:8-14` | §9 TO-BE | 유지 — 회복은 gate 통과 후에만 돈다 |
| 방송 상한 (0187 D2) | `auth.md §5.2` (**정본 1벌**) | §7 AC18 · §9 Delta | **변경 — `P + K + 1`.** probe 단계는 `P + K` 로 그대로다 — `P` = 후보가 있으면 1, 없으면 0 이고 0193 의 조기 반환이 이미 그랬다. `1 + K` 라 적던 문면이 후보가 있는 경우만 적은 것이다(r3 D12). 여기에 복원 종료 push 1회가 항상 붙는다: D-008 의 대기 화면은 `resuming:true` 를 거두는 push 없이 걷히지 않는다 |
| "인증 코어는 제품 정책을 모른다"(0188) | `app/auth-resume.ts:3-6` | §9 책임 소유자 | 유지 — 회복 *정책*은 app 에, refresh *가능 판정과 실행*은 lifecycle 이라 `features/auth` 에 둔다 |
| 새 값은 새 키에, grant 저장이 커밋 (0190 r8) | `login.ts:449-462` | §13 다중 저장소 쓰기 | 유지 — `absorbToken` 을 재사용하고 규칙을 다시 적지 않는다 |
| 채널을 둘로 쪼개지 않는다 (구 auth 의 2벌 동기화 버그) | `shared/ipc.ts:110-113` | §11 wire 변경 | **유지** — 새 채널 0개, `provider:state` payload 만 넓힌다 |
| main 레이어 DAG (app → 전부, feature 교차 금지) | `app/src/main/AGENTS.md` | §11 변경 파일 | 유지 — `auth-resume`(app) → `contracts/auth` 포트만 본다 |
| renderer 4-layer (`app/` → features·shared) | `app/src/renderer/AGENTS.md` | §11 `rootFrame.ts` | 유지 — `app/` 안에 둔다 |
| "reducer·순수 변환기·파생 셀렉터는 단위 테스트와 함께" | `app/src/renderer/AGENTS.md §테스트` | §11 `rootFrame.ts` 분리 | 유지 — 그래서 셀렉터를 별도 파일로 뺀다 |
| 문서에 코드 수치를 적지 않는다 | `docs/AGENTS.md §작성 규칙 2` | §11 문서 변경 | 유지 — 채널 수를 적지 않고 `check-doc-inventory` 로 확인한다 |
| `auth-resume.ts` 는 electron 을 물지 않는다 | `app/auth-resume.ts:33-34` | §11 테스트 가능성 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 전체화면 스피너가 최악 수 분 유지된다 (D-008 의 직접 비용) | 사용자가 이 트레이드오프를 알고 선택했다. `probe_failed` 외 결말은 즉시 중단(D-004)이고, browser-session 재로그인 중에는 실제 로그인 창이 떠 있어 대기가 설명된다 |
| 배치가 예외로 끝나면 스피너에 영구히 잠긴다 | `remainingSettled` 를 `finally` 에 둔다(§10 강제 지점) |
| bypass 빌드가 스피너에 잠긴다 | `gateOpen()` 재사용으로 구조적으로 불가 (AC16) |
| `refreshExpiresAt` 미선언이 대다수라 죽은 refresh 로 왕복 1회를 쓴다 | D-009 가 선택한 비용. 실패하면 곧바로 재로그인이라 결말이 같다 |
| `AuthMethod` 에 optional 메서드를 늘려 배포 계약이 넓어진다 | optional 이라 기존 선언은 컴파일 그대로. 미구현 = `unsupported` = 현재 동작 |
| D-012 가 추론이다 | 반대로 하려면 `refreshOnce` 앞에 `autoReloginable` 한 줄. **구현 착수 전 사용자 확인 대상** |
| refresh 성공 후 `credential-committed` 가 도구 재sync 를 유발한다 | 의도된 결과다 — 죽은 토큰으로 만든 도구를 새 토큰으로 갈아야 한다 |

- 되돌리기 어려운 결정: **3건**(`AuthMethod.oauth.refresh` 시그니처 · `TokenValue.refreshExpiresAt` 이름 · `ProviderPlatformState.resuming` 이름). 전부 §6 표에서 "지금 확정" 으로 올렸다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/contracts/auth.ts`
- `app/src/main/features/auth/{login,store,store-parse,runtime}.ts` (+ 각 `.test.ts`)
- `app/src/main/app/{auth-resume,connection-views,bootstrap}.ts` (+ `auth-resume.test.ts`·`connection-views.test.ts`)
- `app/src/shared/ipc.ts`
- `app/src/renderer/src/app/{rootFrame.ts(신설),rootFrame.test.ts(신설),RootGate.tsx}`
- `app/src/renderer/src/app/boot/BootScreen.tsx`
- `app/src/renderer/src/features/providers/hooks/useProviderGate.ts`
- `docs/arch/backend/auth.md` (§5.2)
- `docs/IPC_CONTRACT.md`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md §레이어 DAG` · `app/src/renderer/AGENTS.md §테스트`.
- ABI/네트워크 제약: 이번 변경은 DB 를 타지 않는다. **`npm test` 를 쓰지 않는다.**
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck` (ABI 중립).
- 관련 테스트: `./node_modules/.bin/vitest run src/main/app/auth-resume.test.ts src/main/app/connection-views.test.ts src/main/features/auth src/renderer/src/app` (pretest 우회).
- 전체 확인: `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs --check`.
- 알려진 환경 실패: `src/main/app/chat-turn.continuity.test.ts` 가 electron 미설치로 0건 수집(`app/AGENTS.md §제약 환경 게이트 가이드`). 변경과 무관하게 분리 보고한다.
- 사람 실기: 없음.

## READY self-review

- [x] Decision Ledger 가 0193 의 D-001~D-007 을 ACTIVE 로 보존하고 이번 턴 D-008~D-013 을 더했다. SUPERSEDED 0건.
- [x] Part I 만 읽어도 완료 상태를 알 수 있다 — §5 흐름·전이표가 구현 방식 없이 서술된다.
- [x] 조건절·이유절을 재해석하지 않았다. 사용자 원문 3문장을 §2 에 그대로 인용했다.
- [x] Product/UX 의 각 동작이 AC·Technical Design 에 연결된다(§9 Delta 의 각 행이 AC 를 갖는다).
- [x] AS-IS·TO-BE 가 같은 축(회복 대상·조기 반환·회복 수단·계약·wire·화면 판정·lifecycle·seam)으로 있다.
- [x] AS-IS 에서 사라진 책임 없음 — 조기 반환은 **삭제가 아니라 이동**임을 §9 에 명시했다.
- [x] 수치·전칭 표현·문서 앵커·기존 테스트 인용을 실측했다. **승계하지 않고 다시 세어 0193 의 stale 좌표 1건을 찾았다** — `auth-resume.test.ts:213`·`:231` → 현재 `:319`(describe)·`:320`·`:337`.
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 화면 판정을 `rootFrame.ts` 로 떼어 단위 대상으로 내렸다.
- [x] semantic 목표를 structural proxy 로만 검증하지 않는다 — AC14 는 "주석에 적는다" 가 아니라 **구독자 순서를 실제로 뒤집어** 단언한다.
- [x] 신규 계약(refresh port · `refreshExpiresAt` · `resuming`)마다 SSOT·강제 지점·테스트 seam 이 §10·§11 에 있다.
- [x] 부팅/등록 변경의 기존 소비처를 §12 에서 전수 확인했다(6행).
- [x] producer/consumer 양쪽 의미를 §12 에서 확인했다.
- [x] 상한(`4N` 시도 · 최악 벽시계)과 one-way door 3건을 계산했다.
- [x] 게이트 명령이 `app/AGENTS.md` 현재 지침과 충돌하지 않는다(`npm test` 미사용, `vitest run` 직접 호출).
- [x] 본문 완성 후 교차검증했고 `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 관측으로 적었다(충돌 0, 9쌍 대조).
- [x] 산출물 문장 규칙 — 판정 먼저, 주장 한 줄에 관측 하나, 표 한 칸 3줄. Part I 은 관측 결과, Part II 는 경로·계약으로 갈랐다.
- [x] **(r4 재게이트) 정정한 AC18 을 §5 AC 게이트로 다시 걸었다** — 행동 단언(`P + K + 1`)이 `P`·`K` 를 각각 움직이는 3케이스로 관측되고, 대리 기준("기존 테스트 무수정 통과")을 쓰지 않으며, `N회` 의 관측 지점(fake push 호출 수)을 적었다. r3 이 빠뜨린 것은 **조건부 항 `P`** 하나였고 저장소의 기존 케이스가 그것을 반증했다.

### 구현 착수 전 확인이 필요한 1건

- **D-012** — refresh 에 `methods[0]` 게이트를 적용하지 않는 것은 설계자 추론이다. 반대로 하려면 `refreshOnce` 앞에 `autoReloginable(definition)` 한 줄을 더한다.

---

## [구현자 기입] 설계 리뷰 (r1 — 2026-08-20)

plan 의 Decision·Technical Design 은 코드로 그대로 옮겨졌다. **AC 20건 중 19건 충족, 1건(AC18)은
기준 자체가 성립 불가**임을 아래에서 증거와 함께 보고한다. 선조치 2건·plan 수정 제안 2건이다.

| # | 발견 | 처리 | 근거 |
|---|---|---|---|
| I1 | **§8 전수 조사가 `connectionState(` 호출부를 1로 셌는데 실제는 2다.** 빠진 하나가 `handlers/providers.ts:41` 의 **invoke** 경로 — renderer 가 창을 열자마자 부르는 첫 스냅샷이다. 여기서만 `resuming:false` 를 주면 복원 중에 열린 창이 곧바로 메인 셸을 띄우고 **그 뒤에서 로그인 창이 뜬다**(0194 가 없애려는 바로 그 상태) | **선조치** — `ConnectionHandlerDeps.resuming: () => boolean` 추가, `bootstrap.ts` 가 같은 ref 를 준다 | typecheck 가 지목했다(`TS2554`). 회귀는 `providers.test.ts` 의 `첫 스냅샷에도 복원 진행 여부를 싣는다` |
| I2 | **`absorbToken` 을 그대로 재사용하면 실패한 refresh 가 화면에 뜬다.** 그 경로의 `rejected` 는 `settled()` → `fail()` → `emit()` 으로 **전역 `failed` step** 을 낸다 — 사용자가 시작하지도 않은 조용한 갱신이 "인증을 확인하지 못했습니다" 를 띄운다 | **선조치** — `tokenCandidate()` 를 분리(기존 `secretCandidate` 와 같은 꼴)하고 `refresh` 는 `settleGrant` 의 3분기를 직접 접는다. "둘 다 새 키에" 규칙은 여전히 **한 곳**이다 | `login.ts:735` `tokenCandidate` · `absorbToken` 이 그것을 부른다 |
| I3 | **AC18 은 성립할 수 없다.** "기존 `1 + K` 2케이스가 무수정 통과" 를 요구하는데, D-008 이 요구하는 대기 화면은 `resuming` 이 거짓이 될 때 push 가 있어야 걷힌다. 두 케이스는 `gateDefinitions: []` 이라 `gateOpen()` 이 참 → `resuming:true` 가 **이미 방송된 상태**다. push 하지 않으면 스피너가 영영 안 걷힌다 | **plan 수정 제안** — §7 AC18 을 "**probe 단계** 방송은 `1 + K` 로 불변이고 복원 종료 push 1회가 항상 더해진다" 로 정정 | `auth-resume.test.ts:320`·`:337` 기대값 1→2 · 3→4. 종료 push 는 0193 의 조건부 `attempted` push 를 **대체**하므로 시도가 있는 경로는 증가 0 |
| I4 | **§10 의 `resuming` 강제 지점이 2가 아니라 3이다.** `connectionState()` 조립 지점이 곧 한 곳이라고 적었는데, 그 함수의 호출부가 push·invoke 둘이다 | **plan 수정 제안** — §10 `resuming` 행의 지점을 3으로(조립 push · 조립 invoke · `rootFrame`) | I1 과 같은 뿌리. 전수는 아래 표에서 `14/14` 로 닫았다 |

### 설계 대비 명시적 차이

- **`MAX_REFRESH_ATTEMPTS = 1` 상수를 만들지 않았다.** §11 스케치는 상수를 뒀지만, 값이 1인 루프는 첫 회차에서 항상 반환해 죽은 코드가 된다. 대신 `refreshOnce` 를 **루프 없는 단일 호출**로 썼다 — 루프가 없는 것이 곧 상한이라 구조적으로 2회가 불가능하다(`M7` 로 검출 확인).
- **`BootScreen` 을 `screenLabel?`·`srLabel?` 문자열이 아니라 `label?: 'boot' | 'resuming'` variant 로 열었다.** 문자열을 받으면 `tr()` 호출이 화면 바깥으로 새어 i18n 조회가 두 곳이 된다. 기본값이 `'boot'` 라 기존 호출부의 `data-screen-label` DOM 이 그대로다.

## [구현자 기입] 강제 지점 전수 (§10 대조) — `14/14`

> 각 행의 관측은 **결함을 심어 그 지점을 지키는 테스트가 실패하는 것을 확인**한 결과다(§3).
> 15개 변이 전건 검출, 놓친 지점 0. 변이 스크립트는 스크래치에서 돌리고 트리는 원복했다
> (`grep -rn "unusedFinally\|settleRemaining" src/` → 0건으로 확인).

| 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|
| 회복 대상 = 그 시점 `expired` | 진입 필터 · 매 시도 직전 (2) | 2/2 | `M1`(진입 필터 제거) → `게이트 통과 후 나머지를 확인한다` 실패 · `M2`(1회차로 축소) → `시도 사이에 상태가 'none' 가 되면…` 실패 | — |
| refresh 가능 판정 (한 곳) | `LoginService.refresh` 진입 (1) | 1/1 | 하위 4판정에 각각 심었다 — `M3`(token) · `M4`(authKind) · `M5'`(토큰 부재) · `M6`(`refreshExpiresAt`) 전건 검출 | — |
| refresh 1회 · 재로그인 3회 | 루프 조건 (2) | 2/2 | `M7`(refresh 2회) → `재로그인은 순차다` 실패 · 재로그인 3회는 0193 `M1` 이 이미 잠금 | — |
| refresh 결과는 probe 통과 후에만 커밋 | 커밋 (1) | 1/1 | `M8`(거부를 성공으로) → `새 토큰이 probe 를 통과하지 못하면 옛 grant 가 그대로다` 실패 | — |
| refresh 커밋은 새 세대 키 2개 | 커밋 (1) | 1/1 | `M9`(refresh 키 미생성) → `access·refresh 둘 다 새 세대 키에` 실패 | — |
| `refreshExpiresAt` 영속 | 부팅 파싱 (1) | 1/1 | `M10`(파싱 제거) → `token grant 의 refresh 좌표와 만료가 왕복한다` 실패 | — |
| `resuming` 파생 | §10 은 2로 적었다 — **실제 3** (I4) | 3/3 | `M11`(조립 push) → `복원 진행 여부를 그대로 싣는다` · `M12`(조립 invoke) → `첫 스냅샷에도…` · `M13`(`rootFrame`) → `복원이 진행 중이면 통과 후에도 대기한다` | — |
| `remainingSettled` 는 `finally` | 배치 종료 (1) | 1/1 | `M14'`(정상 종료 경로로 이동) → `배치가 예외로 끝나도 거둬진다` 실패 | — |
| 판정·상태의 문서 사본 | `plan.md` + `INDEX.md` (2) | 2/2 | 이 커밋이 둘 다 갱신 — 갱신 후 다시 읽어 확인(`grep "0194" docs/handoff/INDEX.md` → `impl`·`IMPL_DONE`) | — |

- §10 에 없는데 같은 불변식이 필요했던 지점: **1건** — `connectionState` 의 invoke 호출부(I1·I4). 위에서 닫았고 §10 수정을 제안한다.
- **차집합**: §10 이 적은 13지점 ∖ 닫은 14지점 = **0**. 닫은 14 ∖ §10 의 13 = **1**(invoke 경로).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | ✅ | `boot.resumingLabel`·`boot.resumingSr` 2건(ko/en). 소비자는 `BootScreen({label:'resuming'})` 이고 `RootGate` 가 `gate.resuming` 일 때 그것을 넘긴다 — producer 만 만들고 끝나지 않았다 |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ 전건 있다 | refresh 성공/실패·복원 종료·예외 종료·bypass 4행이 §5 표에 이미 있다 |
| 실패가 화면에서 "아무 일도 안 일어남" 으로 보이지 않는가 | ✅ | refresh 실패는 재로그인으로 이어지고, 전건 실패해도 대기 화면이 걷히며 강등 상태가 카탈로그에 보인다. **조용한 refresh 실패가 전역 `failed` step 을 띄우지 않는 것도 의도다**(I2) — 사용자가 시작하지 않은 동작이다 |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | ✅ | `refresh` 도 `openAttempt` 로 세대를 연다. 도는 사이 사용자가 직접 로그인/해제하면 `superseded` 라 커밋되지 않고, 회복은 `'unsupported'` 로 접어 **재로그인으로 넘어가지 않는다**(넘어가면 사용자의 로그인을 덮는다) |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `resumeRemainingOnce` 가 던지면 `run()` 도 reject 하고, `bootstrap.ts:411` 은 `void authResume.run()` 이라 **unhandled rejection** 이 된다 | ⚠️ **보고만** — 0193 이전부터 있던 성질이고 이번 변경이 넓히지 않았다. `finally` 덕에 대기 화면은 반드시 걷힌다(회귀 있음). 잡을지는 범위 밖 | `auth-resume.ts` 헤더가 "던지지 않는다" 를 계약으로 적었지만 `tryBind`/`snapshot` 은 그 보장 밖이다 |
| 2 | 대기 화면이 최악 수 분 유지될 수 있다(로그인 창 타임아웃 ≈5분) | ⚠️ **보고만** — D-008 이 선택한 비용이고 plan §17 에 이미 적혀 있다. 타임아웃은 `cancelled` 로 접혀 연속으로 나지 않는다 | 진행 표시가 스피너뿐이라, 어떤 Auth 를 기다리는지는 화면에 없다 |
| 3 | `handlers/providers.test.ts` 는 이번 턴 전까지 **핸들러 본체를 한 번도 부르지 않았다**(deps 를 `{}` 로 넘겨 채널 등록만 단언) | ✅ **선조치** — mock 이 핸들러를 잡아 두게 하고 invoke 결과를 단언하는 케이스를 추가했다 | 그래서 I1 이 typecheck 로만 잡혔다. 이제 `M12` 가 검출한다 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **23 파일 · +916/−101** — main 12(계약·auth 4·app 4·wire 1·handlers 1) · renderer 6(신설 `rootFrame.ts`·`RootGate`·`BootScreen`·hook·i18n 2) · 문서 2 · 신설 테스트 1 |
| 신규 의존성 | 0 |
| 계약 변경 | `TokenValue.refreshExpiresAt?` · `Grant.token.refreshExpiresAt?` · oauth `AuthMethod.refresh?` · `AuthRuntime.refresh` + `AuthRefreshResult` · `ProviderPlatformState.resuming` · `ConnectionHandlerDeps.resuming`. **신규 IPC 채널 0** |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출** | typecheck **node·web·test 3/3, error 0** · lint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22` = 0102 베이스라인, 이번 변경과 무관) · vitest **1,997/1,997 케이스 · 204/205 파일** · scripts **49/49**(suites 7) · doc-inventory **차이 0 · 링크 전건 해석** |
| 환경 기인 실패 | **1파일** — `app/chat-turn.continuity.test.ts` 가 **0건 수집**(`Electron failed to install correctly`). `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 로 설치한 결과이고 변경과 무관하다. DB 로드 4스위트는 `npm rebuild better-sqlite3`(Node ABI) 후 **전부 green** — 그전 42 red 가 0 이 됐다 |
| 강제 지점 전수 | **14/14** (§10 이 적은 13 + invoke 경로 1) |
| 적대 검증 | 변이 **15건 전건 검출 · 놓친 지점 0**. 첫 시도의 `M5` 는 런타임 무변화(`as … & never`)라 무효였고 `M5'` 로 다시 심어 검출을 확인했다 |
| 테스트 | **+37 케이스** (1,960 → 1,997) — auth-resume +15(33→48) · login +11(27→38) · rootFrame +7(신설) · store-parse +2 · connection-views +1 · providers handler +1 |
| **AC 자기보고** | 아래 표 |
| 블로커 / 역질문 | **D-012 는 사용자 확인 없이 ACTIVE 대로 구현했다**(refresh 에 `methods[0]` 게이트 미적용). 되돌리려면 `auth-resume.ts` 의 `refreshOnce` 앞 한 줄이다 |
| 대상 커밋 | `ee11eab` — `git show ee11eab --oneline` 으로 실재 확인 |

### AC 자기보고 — 이번 턴에 재현한 관측

| AC | 판정 | 관측 |
|---|---|---|
| AC1 | ✅ | `probe 후보가 아니어도 회복 대상이다` — `loginsOf(log,'wiki')` = `['login:wiki:1']` |
| AC2 | ✅ | `probe 후보가 0건이어도 회복 패스는 돈다` — `enter:` 0건인데 wiki·jira 각 로그인 1회. `M15` 검출 |
| AC3 | ✅ | `만료된 것에는 probe 를 묻지 않는다` — `log` 에 `enter:wiki` 없음 |
| AC4 | ✅ | `refresh 가 재로그인보다 먼저다` — `log` = `['refresh:wiki','login:wiki:1']` |
| AC5 | ✅ | `refresh 가 성공하면 로그인을 한 번도 부르지 않는다` — `log` = `['refresh:wiki']` + snapshot `{status:'valid',verified:true}` |
| AC6 | ✅ | `it.each` 2케이스(`failed`·`unsupported`) — `refresh:wiki` 1건 · `login:wiki:1..3`. `M7` 검출 |
| AC7 | ✅ | 3케이스(refreshKey 없음 · session grant · `authKind:'browser-session'` token) 모두 `calls` = `[]`. `M3`·`M4`·`M5'` 검출 |
| AC8 | ✅ | 3케이스 — 지남 → 0회 · 미선언 → 1회 · 미래 → 1회. `M6` 검출 |
| AC9 | ✅ | `선언이 refresh 를 구현하지 않으면 unsupported 다` |
| AC10 | ✅ | `새 토큰이 probe 를 통과하지 못하면 옛 grant 가 그대로다` — `vaultKey` = 옛 키 · `secretOf` = `'old-access-value'`. `M8` 검출 |
| AC11 | ✅ | `access·refresh 둘 다 새 세대 키에` — 두 키 모두 옛 키와 다르고 값이 `new-access`/`new-refresh`. `M9` 검출 |
| AC12 | ✅ | `token grant 의 refresh 좌표와 만료가 왕복한다` + `숫자가 아니면 그 필드만 빠진다`. `M10` 검출 |
| AC13 | ✅ | `rootFrame` 7케이스, 그중 `복원이 진행 중이면 통과 후에도 대기한다`. `M13` 검출 |
| AC14 | ✅ | `게이트가 열린 그 change 에서 이미 참이다` — 구독자 등록 **두 순서 모두** `seen.every(Boolean)` |
| AC15 | ✅ | `배치가 끝나면 거둬진다` 3경로 + `예외로 끝나도 거둬진다` 1경로 = **4/4**. `M14'` 검출 |
| AC16 | ✅ | `게이트가 열리지 않았으면 거짓이다` — gate probe 실패 후 `resuming()` = false |
| AC17 | ✅ | `복원 진행 여부를 그대로 싣는다`(조립) + `첫 스냅샷에도…`(invoke) + typecheck 3/3. `M11`·`M12` 검출 |
| AC18 | ⚠️ | **기준 정정 필요(I3).** probe 단계 상한은 불변임을 신규 케이스 `만료됐어도 입력형이면…` 이 단언한다(probe 방송 0 + 종료 push 1 = 1). 다만 기존 2케이스는 **무수정 통과하지 못했다** — 1→2·3→4 로 갱신했고 사유를 테스트 주석에 남겼다 |
| AC19 | ✅ | `gate Auth 는 refresh 대상도 아니다`(refresh 0회) + 기존 `gate Auth 의 복원 실패는 재로그인하지 않는다`(login 0회) |
| AC20 | ✅ | `auth.md §5.2`(흐름도 2줄 · 규칙표 2행 추가 · 대기 화면 문단) · `IPC_CONTRACT.md`(`resuming` 필드 + invoke/push 동일값 주석) · `check-doc-inventory --check` 차이 0 |

**합계 검산**: ✅ **19** · ⚠️ **1** · ❌ **0** = 총 **20**. §7 의 AC 행을 다시 세어 20 확인(`grep -c "^| AC" plan.md` 에서 §4 의 `ACTIVE…` 행 1개를 뺀 값). 분모 변경 없음(r1).

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: **부분적으로 예.** `resuming` 의 "한 값이 여러 소비 지점에서 성립해야 한다" 는 0193 의 `attempted`(방송 판정 지점 전수)와 같은 축이다 — 이번에도 설계가 지점을 하나 적게 셌다(I4).
- 그것을 막았어야 할 plan 지침·AC 가 있었는가: **§8 전수 조사 표**가 담당이었고 걸리지 않았다. 원인은 그 행의 `N` 을 **grep 을 실제로 돌리지 않고** 적은 것이다(`connectionState(` 1 → 실제 2). 같은 표의 `refreshKey` 행은 실제로 돌려 7을 얻었고 정확했다.
- 반복되는 환경 한계: electron 미설치(`chat-turn.continuity` 0건 수집) — 0193 r1·r2 와 같은 서명. `npm rebuild better-sqlite3` 로 DB 스위트는 회복 가능.
- 현재 라운드: **1**.

## [구현자 기입] r2 — D1 승계 (2026-08-20)

r1 검증의 **D1·D2 를 닫았다.** D3·D4·D5·D6 은 손대지 않았다 — 이번 라운드는 `login.ts` 의 갱신
경로 한 곳만 만진다. AC 분모가 **20 → 23** 으로 바뀌었다(AC21~AC23 신설, D-014 를 잠근다).

### 무엇을 바꿨나

`LoginService.refresh` 가 `tokenCandidate` 를 부르기 직전에 승계 한 단계를 넣는다
(`login.ts:381-400`). **`tokenCandidate` 는 손대지 않았다** — "access·refresh 둘 다 새 키에"
규칙이 계속 한 곳이다.

| 응답 | 결과 |
|---|---|
| `refreshToken` 있음 | 그대로 회전 — 새 값·새 만료가 새 세대 키에 |
| `refreshToken` 없음 | **보내던 값 + 옛 만료**를 새 세대 키에. 응답이 만료를 줬으면 그것이 이긴다 |

- 보낼 값은 이미 `store.refreshSecret(authId)` 로 손에 있다(`:369`) — 금고를 다시 읽지 않는다.
- **옛 키 참조를 승계하지 않는 이유가 되돌리기다.** `settleGrant` 의 `discardKeys(candidate.grant)`
  (`:545`·`:560`, `keep` 인자 없음)는 "새 자격증명이 이름 붙인 자리는 전부 버려도 된다" 를
  전제한다. 옛 키를 공유하면 **커밋 실패가 살아 있는 grant 의 refresh 자리를 지운다**.
- **최초 로그인·재인증에는 승계가 없다.** 새 인가라 옛 refresh token 은 다른 계보이고, 이미
  폐기됐을 수 있는 값을 새 자격증명이 물고 가면 안 된다. 코드 주석에 남겼다.

### 설계 대비 명시적 차이

- **r1 verify 의 D1 서술을 한 군데 좁혔다.** "갱신이 실패하는 순간 되돌리기가 그 자리를 지운다" 로
  적었으나, `settleGrant` 는 **probe 거부에서는 `discardKeys` 를 부르지 않는다**(`:518-520` — 아무것도
  쓰지 않았으므로). 옛 키 공유의 실제 위험 경로는 **금고 쓰기 실패와 영속 실패 2곳**이다. AC23 이
  두 경로를 모두 단언한다.

### 강제 지점 전수 (§10 대조) — 이번 라운드가 연 지점 `3/3`

> 각 행의 관측은 **결함을 심어 그 지점을 지키는 케이스가 실패하는 것을 확인**한 결과다(skill §3).
> 변이 4건 전건 검출, 심고 원복 후 `git status --short` 빈 출력 + 46/46 green 재확인.

| 계약/필드 | §10 지점 | 닫은 지점 | 재현 명령 / 관측 |
|---|---|---|---|
| refresh 미회전 시 값 승계 (D-014, r2 신규) | 커밋 직전 1 | 1/1 | `M16`(`carried` → `token`) → 승계 4케이스 실패 · `M17`(옛 키 참조 승계) → 4케이스 실패, 그중 금고 쓰기 실패 케이스가 `expected null to be 'old-refresh-value'` |
| `refreshExpiresAt` 영속 (r2 정정 1 → 2) | ① 커밋 쓰기 ② 부팅 파싱 | 2/2 | `M18`(승계 만료 제거) → 1케이스 실패 · `M19`(`tokenCandidate` 의 쓰기 4줄 제거) → **3케이스 실패**. **`M19` 는 r1 에서 330/330 을 통과하던 변이다** — D2 가 여기서 닫힌다 |
| 판정·상태의 문서 사본 | `plan.md` + `INDEX.md` (2) | 2/2 | 갱신 후 다시 읽어 확인 — `grep -c "^| AC[0-9]* |"` §7 = **23** · `grep "0194" docs/handoff/INDEX.md` → `impl`·`IMPL_DONE (r2)` |

- **§10 전체**: plan 이 적은 **15지점**(r2 정정 후) ∖ 실제 닫힌 **16지점** = 0. 닫힌 16 ∖ plan 15 = **1**
  (`connectionState` invoke 호출부 — r1 I4 가 이미 보고했고 §10 `resuming` 행은 D4 와 함께 정정 대기).
- 이번 라운드가 건드리지 않은 12지점은 r1 상태 유지 — 전체 스위트가 green 으로 지킨다.

### Product/UX 파생 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 사용자가 관측하는 것이 달라졌는가 | ✅ 좋은 쪽으로 | 두 번째 부팅부터 뜨던 로그인 창이 사라진다. 새 문구·새 화면은 0건 |
| 이번 실패 경로가 Part I 상태 전이표의 어느 행인가 | ✅ 기존 행 | 승계 실패는 "복원 중 OAuth refresh 성공/실패" 두 행 안이다 — 새 행이 필요 없다 |
| 실패가 "아무 일도 안 일어남" 으로 보이는가 | ✅ 아니오 | 승계가 실패해도 재로그인으로 이어지고 대기 화면이 걷힌다(r1 그대로) |
| 조용히 나빠지는 상태가 남는가 | ✅ 없어졌다 | r1 은 "refresh token 없음" 이 (가) 원래 안 쓰는 서비스 · (나) 잃어버린 서비스 두 뜻이었다. 승계가 (나) 를 만드는 경로를 없앤다 |

### 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 회전하는 서버가 응답에서 새 refresh token 을 **빠뜨리면** 승계한 옛 값은 이미 죽은 값이다 | ⚠️ **보고만** — 다음 갱신이 실패하고 재로그인으로 이어져 r1(즉시 창)보다 나쁘지 않다 | 앱이 서버 정책을 알 방법이 없다. D-014 가 선택한 비용 |
| 2 | `refreshSecret` 이 `undecryptable` 을 `null` 로 접어 `'unsupported'` 가 된다 — 키체인 문제와 "refresh 없음" 이 같은 결말이다 | ⚠️ **보고만** — D-011 이 `unknown` 회복을 이미 범위 밖으로 뒀다 | `store.ts:481` `read.state === 'found'` |

### 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | **5** — `login.ts`(승계) · `contracts/auth.ts`(포트 의미) · `login.test.ts`(+8) · `auth.md §5.2` · `plan.md` |
| 신규 의존성 | 0 |
| 계약 변경 | **타입 변경 0.** `AuthMethod.oauth.refresh?` 의 **의미**만 명시했다 — 새 refresh token 을 돌려주지 않아도 되고 그 경우 앱이 보내던 것을 유지한다 |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node --test "scripts/*.test.mjs"` · `node scripts/check-doc-inventory.mjs --check` |
| **관측한 게이트 산출** | typecheck **node·web·test 3/3, error 0** · lint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22` = 0102 베이스라인) · vitest **205 파일 · 2,005 케이스 · 1,963 pass** · scripts **49/49**(suites 7) · doc-inventory **차이 0 · 링크 전건 해석** |
| 환경 기인 실패 | **5파일 42케이스** — `chat-turn.continuity` · `extensions/builder` · `orchestration/fork` · `db/migrate` · `db/queries`. 서명 `Module did not self-register` ×6 · `Electron failed to install` ×1. `app/AGENTS.md` 가 적은 알려진 5파일과 같은 집합이고 r1 검증 실측과 동일하다 |
| 게이트의 트리 변경 | **없다** — `npm run lint` 는 `--fix` 지만 실행 전후 `git status --short` 가 같은 5파일이다 |
| 테스트 | **+8 케이스** (1,997 → 2,005) — `login.test.ts` 38 → 46 |
| 적대 검증 | 변이 **4건 전건 검출**(`M16`~`M19`) · 놓친 지점 0 |
| 강제 지점 | 이번 라운드 신규·정정 **3/3** · 전체 **16/16** |
| 블로커 / 역질문 | **D4 는 여전히 사람 결정 대기다** — AC18·§16·§10 `resuming` 행 정정은 설계자 몫이라 이번 라운드에 손대지 않았다 |
| 대상 커밋 | `7c60433` |

### AC 자기보고 — 이번 턴에 재현한 관측

| AC | 판정 | 관측 |
|---|---|---|
| AC1~AC17 · AC19 · AC20 | ✅ 유지 | r1 관측 그대로. 이번 변경은 `login.ts` 의 갱신 경로 한 곳이고 전체 스위트가 green |
| AC18 | ❌ **미충족 유지** | 기준이 D-008 과 모순이다(D4). 정정 전까지 원 기준으로는 통과할 수 없다 |
| AC21 | ✅ | `응답에 refresh token 이 없으면 옛 값을 새 세대 키로 옮긴다` — `refreshOf` = `'old-refresh-value'` · `refreshKey` ≠ 옛 키 · 옛 키 2개 금고에서 사라짐. `승계한 뒤에도 다시 갱신할 수 있다` — 2회차 `refreshed` · `calls` = 같은 값 2회. `M16`·`M17` 검출 |
| AC22 | ✅ 4케이스 | `승계할 때 옛 만료도 함께 옮긴다`(9,999) · `응답이 만료만 새로 주면 그 값이 이긴다`(50,000) · `회전 응답은 만료를 물려받지 않는다`(undefined) · `회전 응답이 만료를 주면 보관한다`(77,000). `M18`·`M19` 검출 |
| AC23 | ✅ 2케이스 | `probe 가 거부하면 옛 access 와 옛 refresh 가 둘 다 그대로 산다` + `금고 쓰기가 실패해도 옛 refresh 가 산다`. 후자가 `M17` 을 `expected null to be 'old-refresh-value'` 로 검출한다 |

**합계 검산**: ✅ **22** · ⚠️ **0** · ❌ **1** = 총 **23**. §7 의 AC 행을 다시 세어 분모 23 확인
(`awk '/^## 7\. Acceptance/,/^### AC 검증/' plan.md | grep -cE "^\| AC[0-9]+ \|"` → 23).
**분모가 r1 의 20 에서 바뀌었다**(AC21~AC23 신설) — r1 합계 `19/20` 과 직접 비교하지 않는다.

### Review Signals — 사실만

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가**: 예. "설계가 지점을 적게 셌다" 가 0193
  `attempted` → 0194 r1 `resuming`(I4) → 이번 `refreshExpiresAt` producer 로 3연속이다. 이번 뿌리는
  §10 6행의 "직렬화는 자동" 이라는 문장이 **쓰기 지점을 세지 않게 만든 것**이다.
- **그것을 막았어야 할 plan 지침·AC**: §15 "semantics 검증" 이 `failed`·`unsupported`·커밋 거부
  3의미만 열거했다. "성공했는데 refresh token 이 없다" 는 네 번째 경우가 목록에 없었다.
- **사용자 결정 변경 근거**: D-014 는 r1 검증이 올린 D1 에 대한 사용자 선택이다(2026-08-20).
  기존 결정을 바꾸지 않아 SUPERSEDED 0건 유지.
- **반복되는 환경 한계**: electron 미설치 + better-sqlite3 ABI 로 5파일 42케이스 red. r1 과 동일.
- 현재 라운드: **2**.

---

## [구현자 기입] r3 — 세 뿌리를 닫는다 (2026-08-21)

verify r2 가 막은 6건(AC18 · D3 · D4 · D5 · D7 · D8 · D9)을 **개별 결함이 아니라 뿌리 3개**로 묶어
닫았다. r1 이 D1(`refreshToken` 유실)을 닫자 r2 에서 D7(`principalId` 유실)이 나온 것이 근거다 —
verify 자신이 "같은 문장의 다른 필드" 라고 적었다.

| 뿌리 | 무엇이 잘못됐나 | 낳은 결함 |
|---|---|---|
| **R1** | 갱신이 새 grant 를 **응답에서 새로 조립**했다 — 빈 객체에 `...ifPresent()` 누적 | D1 · D7 · 앞으로의 모든 `Grant` 필드 |
| **R2** | 커밋 테스트가 **필드를 골라서** 단언했다 | D2(330/330 통과) · D9(338/338 통과) · D7 이 두 라운드 통과 |
| **R3** | 같은 사실이 **여러 사본**으로 살았다 | D3(상한 3벌) · D5(`resuming` 2벌) · D8(문서 목록 2벌) · AC18/D4(불변식 대신 대리 기준) |

### 무엇을 바꿨나

**S1 — 조립을 delta 로 (R1 → D7).** `tokenCandidate` 가 `previous?: Grant` 를 받고, grant 를
**필드를 전부 적은 리터럴 하나**로 만든다(`login.ts:839-853`). `compact()` 의 인자 타입이
`Record<keyof T, unknown> & Partial<T>` 이라 **전 필드를 요구**한다 — `Grant` 에 필드를 더하면 이
리터럴에서 컴파일이 깨진다. `previous` 는 `refresh` 만 넘기므로(`:407`) D-014 의 "갱신 경로에만"
이 호출부로 지켜진다. 필드 규칙은 `principalId` 승계 · `expiresAt` 응답 전용 · `refreshExpiresAt`
짝 조건이다.

**S2 — 단언을 grant 통째로 (R2 → D2·D7·D9).** 신규 describe `LoginService — 커밋 grant 전체 형상`
4케이스가 `store.get()` 을 `toEqual` 로 통째 단언한다(`login.test.ts:826-927`). 키 이름은 계약이
아니므로(r8) 새 세대 키는 `expect.any(String)` 으로 받는다. **필드 이름을 몰라도 빠진 필드가
잡히고**, 있으면 안 되는 필드(`expiresAt` 승계)도 같은 단언이 잡는다.

**S3 — 사본 삭제 (R3 → D3·D5·D8).**

| 대상 | 조치 | 관측 |
|---|---|---|
| D3 | `auth-resume.ts` 헤더와 `bootstrap.ts` 주석에서 **횟수 문장을 뺐다**. 정본은 `auth.md §5.2` + 테스트 describe | `rg "1 \+ K" src/ \| rg -v "\.test\."` → `login.ts:297`·`:330` 2건. 둘 다 **probe 단계** 상한을 0187 근거로 인용하는 문장이고 `auth.md §5.2`("probe 단계는 `1 + K`")와 일치한다 — 거짓이 아니라 남긴다 |
| D5 | `RootFrame` 에 `'waiting-resume'` 을 더해 셀렉터가 라벨까지 고른다 | `rg resuming src/renderer/src/app/RootGate.tsx` → **1건**(`:35` 셀렉터 입력). `:42` 는 frame 비교라 `resuming` 을 읽지 않는다 |
| D8 | guide §3-b 예제에 `refresh` 갈래와 `exchange` 의 `refreshToken` 을 넣었다. **AC20 이 §15 의 문서 목록을 그대로 인용**하게 바꿔 두 목록을 하나로 합쳤다 | `sed -n '434,495p' docs/guides/closed-network-extensions.md` — `async refresh(refreshToken)` · `refreshToken: body.refresh_token` · `refreshExpiresAt` 문단 |

**AC18/§16/§10 정정 (D4).** AC18 의 기준을 대리 기준("기존 2케이스 무수정 통과")에서 불변식
(`1 + K + 1`)으로 바꿨다. §16 행을 `유지` → `변경`, §10 `resuming` 행을 `2` → `3`, §15 문서 목록을
AC20 과 한 목록으로 맞췄다. **근거**: D-008(사용자 결정)이 요구하는 대기 화면은 `resuming:true` 를
거두는 push 없이 걷히지 않는다. **provenance**: 이 정정안을 사용자에게 3안(정정 / 코드 되돌리기 /
AC18 삭제)으로 제시했고 정정안이 담긴 계획을 승인받았다(2026-08-21).

### 설계 대비 명시적 차이

- **§10 에 행 1개를 신설했다** — "갱신 커밋이 옛 grant 필드를 잃지 않는다". verify r2 가 "표에 없는데
  같은 불변식이 필요한 지점" 으로 지목한 자리다. plan 기재 합계가 **16 → 17** 이 된다.
- **`bootstrap.ts:404-405` 를 "종료 push 서술 추가" 가 아니라 "상한 사본 삭제" 로 처리했다.**
  verify D3 의 대응 방향은 서술 추가였다. 사본을 3벌로 유지하면 다음 변경에서 또 갈린다 — 정본
  1벌(`auth.md §5.2`)로 줄이는 쪽을 골랐다.
- **D6 은 손대지 않았다** — verify 가 "보고만" 으로 남긴 항목이다.

### 강제 지점 전수 (§10 대조) — `17/17`

| # | 계약/필드 | 지점 | 현재 좌표 | 재현 명령 |
|---|---|---|---|---|
| 1 | 회복 대상 = `expired` | 2/2 | `auth-resume.ts:180` `continue` · `:116` 재로그인 루프 머리 | `sed -n '116p;180p' app/src/main/app/auth-resume.ts` |
| 2 | refresh 가능 판정 한 곳 | 1/1 | `login.ts:369`·`:371`·`:374` + `refreshSecret` 만료 판정이 한 함수 안(`:362-374`) | `sed -n '362,374p' app/src/main/features/auth/login.ts` |
| 3 | refresh 1회 · 재로그인 3회 | 2/2 | `refreshOnce`(`:154`) 루프 부재 · `MAX_RELOGIN_ATTEMPTS`(`:50`)+루프(`:116`) | `rg -n "MAX_RELOGIN_ATTEMPTS\|const refreshOnce" app/src/main/app/auth-resume.ts` |
| 4 | probe 통과 후에만 커밋 | 1/1 | `login.ts:408` `settleGrant` | `sed -n '408p' app/src/main/features/auth/login.ts` |
| 5 | 새 세대 키 2개 | 1/1 | `tokenCandidate.writeVault`(`:859-871`) | `sed -n '859,871p' app/src/main/features/auth/login.ts` |
| 6 | `refreshExpiresAt` 영속 | 2/2 | ① 커밋 쓰기 `login.ts:850` ② 부팅 파싱 `store-parse.ts:45` | `sed -n '850p' …/login.ts; sed -n '45p' …/store-parse.ts` |
| 7 | 미회전 시 값 승계 (D-014) | 1/1 | `login.ts:396-406` `const carried` — `tokenCandidate` 직전 1지점 | `sed -n '396,406p' app/src/main/features/auth/login.ts` |
| 8 | **갱신 커밋 필드 규칙 (r3 신설)** | 1/1 | `login.ts:839-853` `compact<TokenGrant>` 리터럴 | 아래 MV1~MV5 |
| 9 | `resuming` 파생 | 3/3 | `bootstrap.ts:367` · `handlers/providers.ts:47` · `rootFrame.ts:36` | `rg -n "connectionState\(\|resuming" 세 파일` |
| 10 | `remainingSettled` 는 `finally` | 1/1 | `auth-resume.ts:214-218` | `sed -n '214,218p' app/src/main/app/auth-resume.ts` |
| 11 | 판정·상태의 문서 사본 | 2/2 | `plan.md:11` 메타 `→ IMPL_DONE (r3)` · `INDEX.md:21` 행 `` `IMPL_DONE` (r3) `` | `rg -n "IMPL_DONE.{0,2} \(r3\)" docs/handoff/INDEX.md docs/handoff/0194-*/plan.md` → 2파일 |

- **합계 검산**: 2+1+2+1+1+2+1+1+3+1+2 = **17**. plan 기재 17 ∖ 닫힌 17 = **0** · 닫힌 17 ∖ plan
  17 = **0**. r2 의 16 과 직접 비교하지 않는다(§10 에 행 1개 신설 + `resuming` 2→3 정정).

### 이번 턴에 만든 검사 장치의 눈 — 판정 지점마다 하나씩 심었다

| 변이 | 심은 곳 | 관측 산출 | 판정 |
|---|---|---|---|
| MV1 `principalId` 승계 제거 | `login.ts:852` | `vitest run src/main/features/auth src/main/app` → **2 실패** (전체 형상 2케이스) | ✅ D7 에 눈 있음 |
| MV2 `refreshExpiresAt` 쓰기 제거 | `login.ts:850` | **5 실패** — r1 에서는 330/330 통과였다 | ✅ D2 회귀 잠김 |
| MV3 짝 조건 제거 | `login.ts:850` | **1 실패**(최초 로그인 짝 케이스) — r2 에서는 338/338 통과였다 | ✅ D9 에 눈 생김 |
| MV4 `expiresAt` 승계 추가 | `login.ts:846` | **1 실패**(미회전 전체 형상) | ✅ 해로운 승계도 잡힌다 |
| MV5 `Grant` 에 더미 필드 추가 | `contracts/auth.ts` | `typecheck:node` → `login.ts:839 error TS2345` | ✅ **타입이 전수를 강제한다**(R1 이 닫혔다는 증거) |
| MV6 셀렉터 안에서 두 읽기 의미 재현 | `rootFrame.ts:34` | `vitest run src/renderer/src/app` → **2 실패**(신규 2케이스) | ✅ D5 조합이 잠김 |

- 여섯 건 모두 실행 후 원복했다. 복원 확인: 변이 흔적 grep **0건**(`zzProbe`) · 세 좌표 재확인
  (`login.ts:850`·`:852` · `rootFrame.ts:34`) · 관련 18파일 **281/281** 재green · typecheck error 0.
- **눈을 심지 못한 곳**: D3·D8 은 문서/주석이라 기계 장치가 없다. D8 의 눈은 **AC20 이 파일을
  이름으로 갖는 것**이고(그래서 §15 와 한 목록으로 합쳤다), D3 의 눈은 **사본을 지운 것**이다 —
  갈릴 사본이 없으면 갈릴 수 없다. `RootGate` 자체는 컴포넌트 테스트가 없다(`src/renderer/AGENTS.md`
  — "UI 자체는 시각 검증으로 갈음한다"). 그래서 D5 는 셀렉터 케이스 + grep 1건으로 닫았다.

### Product/UX 파생 검토

- **사용자가 보는 변화 1건**: `bootPhase !== 'ready'` + `resuming:true` 조합에서 스피너 라벨이
  "연결 복원" → 기본 부팅 라벨로 바뀐다(D5 가 지적한 오작동의 수정). 그 조합은 게이트 통과 전이라
  복원이 아직 시작되지 않은 상태다.
- **D7 이 고친 것의 화면 위치**: 설정 → 연결 상세의 계정 식별자(`ProviderDetail.tsx:93`). 갱신
  이후 사라지던 것이 유지된다. 사이드바 신원은 게이트 provider 만 읽으므로 영향 없다(verify r2 §1).
- **새로 만든 사용자 대면 문자열 0건.** `waiting-resume` 은 프레임 이름이고 라벨은 기존
  `BootScreen label="resuming"` 을 그대로 쓴다.
- **실패가 "아무 일도 안 일어남" 으로 보이는 경로 0건** — 이번 변경은 실패 경로를 만들지 않는다.

### 놓친 잠재 문제 + 대응

1. **`compact()` 가 `0`·`''` 를 드롭하는가** — 아니다. `!= null` 이라 `ifPresent` 와 같은
   semantics 다. `createdAt: 0` 인 경우가 실제로 없지만 규칙은 같게 뒀다.
2. **`previous` 를 넘기는 호출부가 늘면 승계가 새 경로로 샌다** — 현재 호출부 2곳
   (`rg -n "tokenCandidate\(" app/src/main/features/auth/login.ts` → `:407` refresh · `:806`
   absorbToken)이고 후자는 넘기지 않는다. 이 사실이 타입으로 강제되지는 않는다(optional 인자) →
   파생 이슈로 남긴다.
3. **`login.ts:297`·`:330` 의 `1 + K` 인용** — probe 단계 상한 인용이라 여전히 참이다. 다만 D3 와
   같은 축의 사본이므로 다음에 상한이 바뀌면 이 두 줄이 후보다.

**보고만 (범위 밖, 검증자 판단 대상)**: ① `previous` 가 optional 이라 "갱신 경로에만" 이 타입이
아니라 호출부 관례로 지켜진다 — 현재 호출부 2곳(`login.ts:407` refresh · `:806` absorbToken)이고
후자는 넘기지 않는다. ② `login.ts:297`·`:330` 의 상한 인용 2건.

### 구현 보고

**변경 파일 12** (`git diff --stat`): 코드 9(`login.ts`·`login.test.ts`·`obj.ts`·`auth-resume.ts`·
`auth-resume.test.ts`·`bootstrap.ts`·`rootFrame.ts`·`rootFrame.test.ts`·`RootGate.tsx`) + 문서 3
(`auth.md`·`closed-network-extensions.md`·`plan.md`). **신규 파일 0 · 신규 의존성 0 · 신규 채널 0.**

**관측한 게이트 산출** (exit code 아님) — `app/AGENTS.md §better-sqlite3 ABI` 를 따랐고 `npm test`
는 쓰지 않았다:

- typecheck — node·web·test **3/3, error 0**.
- lint — **0 error / 1 warning** (`useTranscriptVirtualizer.ts:22`, 0102 베이스라인).
- vitest 전체 — **205 파일 · 2,011 케이스**, `1,969 pass / 42 fail` (r2 2,005 → +6: login +4 ·
  rootFrame +2).
- vitest 관련 — `features/auth`·`auth-resume`·`connection-views`·`handlers/providers`·
  `renderer/src/app` = **18 파일 / 281 케이스 전건 green** (r2 275 → +6).
- scripts — `# tests 49 # suites 7 # pass 49 # fail 0`.
- doc-inventory — `generated doc ok (9 items, 76 channels)` · `prose ok` · `links ok` · 차이 0.

**환경 기인 실패 분리 — 차집합 0.** 42 red 의 5파일을 `app/AGENTS.md:135` 의 알려진 집합과 실제로
빼 봤다: 내 실패 ∖ 알려진 = **0줄**, 알려진 ∖ 내 실패 = **0줄**. 서명은 `Module did not
self-register` ×6 · `Electron failed to install` ×1.

**게이트가 트리를 바꿨는가** — 아니다. `npm run lint`(`--fix`) 재실행 전후 `git diff | md5sum` 이
같은 값(`8e152708…`)이다.

### AC 자기보고 — 이번 턴에 재현한 관측

| # | 결과 | 이번 턴 관측 |
|---|---|---|
| AC1~AC17 · AC19 | ✅ 유지 | 관련 18파일 **281케이스 전건 green**. 실행 변경은 `tokenCandidate` 조립부와 `rootFrame` 마지막 분기뿐이다 |
| **AC18** | ✅ **정정 기준으로 충족** | `auth-resume.test.ts:353` `toHaveBeenCalledTimes(2)`(K=0 → `1+0+1`) · `:371` `(4)`(K=2 → `1+2+1`) · `:739` 시도 0건 케이스. describe 명도 `1 + K + 1` 로 맞췄다(`:337`) |
| **AC20** | ✅ **확대된 목록으로 충족** | `auth.md §5.2` 갱신(+필드 규칙 문단) · `closed-network-extensions.md §3-b` 갱신(`refresh` 갈래) · `IPC_CONTRACT.md` 기존 `resuming` 유지 · doc-inventory 차이 0 |
| AC21~AC23 | ✅ 유지 | `login.test.ts` 미회전 승계 describe 전건 green (50케이스, r2 46 → +4) |

- **합계 검산**: `✅ 23 · ⚠️ 0 · ❌ 0 = 총 23`. 분모는
  `awk '/^## 7\. Acceptance/,/^### AC 검증/' plan.md | grep -cE "^\| AC[0-9]+ \|"` → **23**.
  r2 와 분모가 같다(AC 신설·분할 0건, AC18·AC20 은 **기준 문면만** 바뀌었다).

### Review Signals — 사실만

- **같은 축의 재발이 세 라운드 연속이었다.** r1 D1(`refreshToken`) → r2 D7(`principalId`) 은 같은
  조립부의 다른 필드다. r3 는 필드가 아니라 조립 방식을 바꿨고, 그 강제를 타입에 뒀다(MV5).
- **막았어야 할 plan 지침**: §10 이 필드별 지점을 세었을 뿐 "조립이 전수인가" 를 묻지 않았다.
  §15 "semantics 검증" 은 3의미만 열거했고 r2 가 4번째, r3 가 5번째("응답이 옛 grant 의 다른 필드를
  말하지 않는다")를 더했다.
- **대리 기준이 라운드 2개를 썼다.** AC18 의 "기존 테스트 무수정 통과" 는 r1·r2 두 라운드 내내
  ❌ 였고, 실제 결함이 아니라 기준 자체가 코드와 모순이었다.
- **반복된 검증 환경 한계**: electron 미설치 + better-sqlite3 ABI 로 5파일 42케이스 red — r1·r2·
  0193 과 같은 서명.
- 현재 라운드 **3**. **다음 재구현이 라운드 4이고, 그것은 `handoff-review` 진입 조건이다.**

## [구현자 기입] r4 — 조건부 항과 전수 강제 (2026-08-21)

### 설계 리뷰 (r4)

| # | 발견 | 처리 | 근거 |
|---|---|---|---|
| I8 | **AC18 정정이 세 라운드 연속 틀렸다.** r3 이 `1 + K + 1` 로 고쳤는데 batch push 는 `probeTargets.length > 0` 일 때만 나간다 | **plan 수정 제안 → 승인 → 별도 커밋**(`23ac69f`) | `auth-resume.ts:201` 의 조건 · `auth-resume.test.ts:750` 이 후보 0건에서 `1` 을 단언 |
| I9 | **§10 의 grant 조립 행이 1지점으로 적혀 있다.** `GrantBase` 를 세 갈래가 공유하는데 눈은 token 에만 있었다 | 같음 — `1 → 3` 정정 | `Grant` union 갈래 수 3(`rg -c "kind: 'secret'\|kind: 'token'\|kind: 'session'" src/main/contracts/auth.ts`) |
| I10 | **§10 에 `compact` 시그니처 행이 없다.** "전수 강제를 타입에 뒀다" 는 주장이 실제로는 키 존재만 덮었다 | 같음 — 행 신설 | r3 VF1: `vaultKey: undefined` 가 `typecheck:node` error 0 으로 통과 |
| I11 | **`1 + K` 문면 사본이 설계자가 센 2건보다 많다.** D11 은 `login.ts:297`·`:330` 2건을 지목했는데 전수는 `runtime.test.ts:268` 을 포함해 3건이고, 테스트 describe·주석까지 세면 9건이다 | **선조치**(구현 세부 — 문면 통일) | `rg "1 \+ K" app/src/ docs/arch/ docs/guides/ docs/decisions/ docs/*.md` |

### 무엇을 바꿨나

**축 1 — 방송 상한 문면의 조건부 항 (D12·D11).** 불변식을 한 문장으로 올렸다: **"부팅 방송 횟수를
적는 문장은 batch push 의 조건(probe 후보가 있을 때만)을 함께 적거나, 정본을 가리키고 숫자를 적지
않는다."** 그 문장이 성립해야 할 지점을 전수로 찾아 함께 닫았다.

| 지점 | 처리 |
|---|---|
| `auth.md:365-368` (정본) | `probe 단계는 1 + K` → `P + K` (`P` 정의 포함) · 총합 `P + K + 1` 명시 |
| `auth.md:356` (§5.2 흐름 블록) | `성공한 verified 변화는 마지막 full-state push 한 번` → `확인할 후보가 있었으면 …` |
| `auth.md:306` (형제 절 §4.5) | `방송 상한(§5.2 `1 + K`)도 함께 무너진다` → 숫자를 빼고 `강등 항 K 가 두 배가 된다` |
| `auth-resume.test.ts:337-341` describe + 헤더 주석 | `1 + K + 1` → `P + K + 1` + 세 항을 정의하는 헤더 주석 |
| `auth-resume.test.ts` it·주석 3곳 | `1 + K` 인용 → `P=1·K=0` / `P=1·K=2` / `P=0·K=0` |
| `auth-resume.test.ts` **신규 케이스** | `probe 후보가 0건이면 batch push 자체가 없다 — P=0·K=0` |
| `login.ts:302` · `:335` | 상한 사본 제거 — 정본(`auth.md §5.2`) 가리키기 · `강등 항 K 를 2K 로` |
| `runtime.test.ts:268` | 같음 (D11 이 세지 않은 3번째 사본) |

**축 2 — grant 조립 전수 강제 (D13).** 불변식은 **"grant 조립 리터럴은 필드를 빠뜨릴 수 없다"**
이고, 성립해야 할 지점은 `Grant` union 갈래 수만큼이다. r3 이 닫은 token 외에 secret
(`login.ts:608`)·session(`:788`)을 같은 `compact<T>` 형식으로 바꿨다. `SecretGrant`·`SessionGrant`
별칭을 `TokenGrant` 옆에 뒀다.

**축 3 — `compact` 가 강제하는 범위 (D14).** 인자 타입을 `Record<keyof T, unknown> & Partial<T>`
에서 `CompactSource<T>` 로 좁혔다. 필수 키는 `T[K]` 를, 선택 키만 `null`/`undefined` 를 받는다.
**`-?` 로는 쓸 수 없다** — homomorphic 매핑의 `-?` 는 값 타입의 `undefined` 까지 벗겨 선택 키에
`undefined` 를 넘기는 정상 호출 8건이 깨졌다(실측). 그래서 필수/선택 키 union 을 명시적으로
갈랐다. **union 분배(`T extends unknown`)도 함께 넣었다** — 없으면 `keyof (A | B)` 가 공통 키만
내어 `compact<Grant>` 같은 호출에서 전수 강제가 갈래 수만큼 조용히 느슨해진다(실측).

**축 4 — `compact` 자기 테스트 (D15).** `src/shared/obj.test.ts` 신설. 런타임 semantics 6케이스 +
`@ts-expect-error` 음성 타입 3케이스(필수 키 `undefined` · 키 누락 · union 갈래)로 `typecheck:test`
가 게이트가 된다. 같은 수단의 선례는 `deployment-wiring.test.ts` 다.

**축 5 — 조립 결과의 전체 형상 (D13 의 런타임 짝).** r3 은 token 갈래에만 `toEqual` 전체 형상
단언을 뒀다(D7). secret·session 은 커밋된 grant 를 아무도 보지 않았으므로 2케이스를 더했다 —
타입은 *빠뜨림*을, 이 단언은 *결과물*을 본다.

### 설계 대비 명시적 차이

1. **`compact` 의 시그니처를 plan §10 이 적은 것보다 한 갈래 더 좁혔다.** §10 신설 행은 "필수
   키는 `T[K]`, 선택 키만 `null`/`undefined`" 까지만 요구한다. union 분배는 그 행에 없는데,
   없으면 같은 행의 강제가 union 호출에서 무너져 넣었다. 행의 목적 안이라 선조치로 처리했다.
2. **테스트를 2개 파일에 더했다** — plan §11 은 `obj.test.ts` 를 예상하지 않았다(D15 는 검증자가
   "보고만" 으로 남긴 항목이다). D14 로 `compact` 를 고치는 턴이라 §3 의 "이번 턴에 만든 장치는
   눈을 먼저 보인다" 가 걸린다고 판단했다.
3. **D16 은 코드 변경이 아니다** — 이번 보드 커밋의 trailer 에서 `Criteria-*` 를 뺀다.

### 강제 지점 전수 (§10 대조) — `20/20`

| # | 계약/필드 | 지점 | 현재 좌표 | 재현 명령 |
|---|---|---|---|---|
| 1 | 회복 대상 = `expired` | 2/2 | `auth-resume.ts:180` `continue` · `:118` 재로그인 루프 머리 | `sed -n '118p;180p' app/src/main/app/auth-resume.ts` |
| 2 | refresh 가능 판정 한 곳 | 1/1 | `login.ts:367-379` 4판정이 한 함수 안 | `sed -n '367,379p' app/src/main/features/auth/login.ts` |
| 3 | refresh 1회 · 재로그인 3회 | 2/2 | `refreshOnce`(`:154`) 루프 부재 · `MAX_RELOGIN_ATTEMPTS`(`:50`)+루프(`:116`) | `rg -n "MAX_RELOGIN_ATTEMPTS\|const refreshOnce" app/src/main/app/auth-resume.ts` |
| 4 | probe 통과 후에만 커밋 | 1/1 | `login.ts:413` `settleGrant` | `sed -n '413p' app/src/main/features/auth/login.ts` |
| 5 | 새 세대 키 2개 | 1/1 | `tokenCandidate.writeVault`(`:867-876`) | `sed -n '867,876p' app/src/main/features/auth/login.ts` |
| 6 | `refreshExpiresAt` 영속 | 2/2 | ① 커밋 쓰기 `login.ts:858` ② 부팅 파싱 `store-parse.ts:45` | `sed -n '858p' …/login.ts; sed -n '45p' …/store-parse.ts` |
| 7 | 미회전 시 값 승계 (D-014) | 1/1 | `login.ts:401-411` `const carried` | `sed -n '401,411p' app/src/main/features/auth/login.ts` |
| 8 | **grant 조립 3지점 (r4 정정 1→3)** | 3/3 | `login.ts:608` secret · `:788` session · `:847` token | `rg -n "compact<SecretGrant>\|compact<SessionGrant>\|compact<TokenGrant>" app/src/main/features/auth/login.ts` → 3줄 (분모 = `Grant` union 갈래 3) |
| 9 | **`compact` 인자 시그니처 (r4 신설)** | 1/1 | `obj.ts:48` `source: CompactSource<T>` | `rg -n "source: CompactSource<T>" app/src/shared/obj.ts` → 1줄 |
| 10 | `resuming` 파생 | 3/3 | `bootstrap.ts:367` · `handlers/providers.ts:47` · `rootFrame.ts:36` | `rg -n "resuming" 세 파일` |
| 11 | `remainingSettled` 는 `finally` | 1/1 | `auth-resume.ts:216` (`finally` 블록 안 — `:213` 이 `} finally {`) | `sed -n '213,219p' app/src/main/app/auth-resume.ts` |
| 12 | 판정·상태의 문서 사본 | 2/2 | `plan.md:11` 메타 `→ IMPL_DONE (r4)` · `INDEX.md:21` 행 `` `IMPL_DONE` (r4) `` | `rg -c "IMPL_DONE.{0,2} \(r4\)" docs/handoff/INDEX.md docs/handoff/0194-*/plan.md` → **2파일**(1줄·2줄 — plan.md 의 둘째 줄은 이 행이 인용한 문면이다) |

- **합계 검산**: 2+1+2+1+1+2+1+3+1+3+1+2 = **20**. plan 기재 20 ∖ 닫힌 20 = **0** · 닫힌 20 ∖
  plan 20 = **0**. r3 의 17 과 직접 비교하지 않는다 — §10 에서 1행이 `1→3` 으로 정정됐고 1행이
  신설됐다(17 − 1 + 3 + 1 = 20).
- **표에 없는데 같은 불변식이 필요한 지점 — 0건.** 프로덕션 `compact` 호출부는 전수 3곳뿐이다
  (`rg -n "= compact<" app/src/main app/src/shared app/src/renderer | grep -v '\.test\.'` → **3줄, 전부
  `login.ts`** — 위 8행의 세 좌표와 같다).

### 이번 턴에 만든 검사 장치의 눈 — 판정 지점마다 하나씩 심었다

**타입 장치**(`CompactSource`) — 판정 지점 4개를 세어 각각 심었다.

| 변이 | 심은 곳 | 관측 산출 | 판정 |
|---|---|---|---|
| MV-A `GrantBase` 에 `zzTenant?: string` 추가 | `contracts/auth.ts:192` 아래 | `typecheck:node` → 깨진 좌표 **3개**(`login.ts:608`·`:788`·`:847`) | ✅ 전수 강제 — r3 은 1개였다(D13) |
| MV-B `vaultKey: undefined` (secret) | `login.ts:610` | `error TS2322: Type 'undefined' is not assignable to type 'string'` | ✅ 필수 키 값 건전성 |
| MV-C `vaultKey: undefined` (token) | `login.ts:849` | 같은 오류 | ✅ 같음 |
| MV-D `sessionGroup: undefined` (session) | `login.ts:790` | 같은 오류 | ✅ 같음 |
| MV-E 키 자체 삭제(session 의 `expiresAt` 줄) | `login.ts:794` | `error TS2345` — 인자 형상 불일치 | ✅ 키 존재 |
| **거짓 양성 확인** | — | 선택 키에 `undefined`/`null` 을 넘기는 정상 호출은 typecheck error **0** | ✅ 실사용을 막지 않는다 |
| MV-K r3 시그니처(`Record & Partial`)로 되돌리기 | `obj.ts:48` | `typecheck:test` → `obj.test.ts(46,5) error TS2578: Unused '@ts-expect-error'` | ✅ 음성 타입 테스트가 회귀를 잡는다 |
| MV-L union 분배 제거 | `obj.ts:42-44` | `typecheck:test` → `obj.test.ts(67,5) TS2578` | ✅ union 갈래 강제에 눈이 있다 |

- **MV-K 가 가른 것**: r3 판으로 되돌리면 *필수 키 `undefined`* 지시자만 unused 가 되고 *키 누락*
  지시자는 그대로다 — `Record<keyof T, unknown>` 이 존재는 이미 강제했기 때문이다. r3 이 못 본
  판정 지점은 **값 건전성 하나**였다는 뜻이고, D14 의 서술과 일치한다.

**런타임 장치**(`obj.test.ts` · 조립 형상 · 방송 상한) — 판정 지점 6개.

| 변이 | 심은 곳 | 관측 산출 | 판정 |
|---|---|---|---|
| MV-F `compact` 판정을 truthy 로 | `obj.ts:52` | `obj.test.ts` **1 실패** (0·''·false 유지 케이스) | ✅ |
| MV-G `compact` 가 null 통과 | `obj.ts:52` | **1 실패** | ✅ |
| MV-H `ifPresent` 판정을 truthy 로 | `obj.ts:10` | **1 실패** | ✅ |
| MV-I `isRecord` 가 배열 통과 | `obj.ts:15` | **1 실패** | ✅ |
| MV-M secret 조립이 `expiresAt` 을 싣는다 | `login.ts:615` | `login.test.ts` **2 실패** | ✅ 전체 형상이 초과 키를 잡는다 |
| MV-N session 조립이 `principalId` 를 떨어뜨린다 | `login.ts:796` | **1 실패** | ✅ 누락도 잡는다 |
| MV-J batch push 를 무조건으로 (`P` 항 제거) | `auth-resume.ts:202` 블록 | `auth-resume.test.ts` **3 실패** — 그중 하나가 **상한 describe 안의 신규 P=0 케이스**다 | ✅ 정본이 스스로 `P` 를 증명한다 |

- 열세 건 모두 실행 후 원복했다. 복원 확인: `git status --short` 가 의도한 7파일만 · `typecheck`
  3/3 error 0 · 관련 55파일 **519/519** 재green · 변이 흔적 grep(`zzTenant`) **0건**.
- **눈을 심지 못한 곳**: `auth.md` 문면 3곳은 산문이라 기계 장치가 없다. 이 축의 눈은 **사본을
  없앤 것**이다 — `rg "1 \+ K" app/src/ docs/arch/ docs/guides/ docs/decisions/ docs/*.md` 가
  **0건**이고, 남은 `P + K + 1` 2건은 정본(`auth.md:368`)과 테스트 describe(`:337`·`:341`)뿐이다.

### Product/UX 파생 검토 (r4)

- **사용자가 관측하는 것은 달라지지 않는다.** 이번 변경은 전부 타입·주석·테스트·문서다. 유일한
  실행 경로 변경은 secret·session grant 조립을 `ifPresent` 누적에서 `compact` 로 바꾼 것인데,
  두 함수의 semantics 가 같아(`!= null` 드롭) **키 집합도 삽입 순서도 같다**. 신규 전체 형상
  2케이스가 그것을 단언한다.
- **새로 만든 사용자 대면 문자열 0건** — 소비자 없는 producer 가 생길 자리가 없다.
- **이번에 만든 실패 경로 0건** — Part I 상태 전이표에 더할 행이 없다.
- **`useProviderGate.ts:75` 의 `state?.resuming ?? false` 는 §10 어느 행에도 없는 기본값 판정이다.**
  그 자체에는 테스트가 없지만(`useProviderGate` 테스트 파일 부재), 결과는 잠겨 있다 —
  `state === null` 이면 `gate` 도 null 이고 `rootFrame` 이 `gate === null` 을 `resuming` 보다 먼저
  본다(`rootFrame.ts:35`). `rootFrame.test.ts:47`(`게이트 미판정이면 resuming 이어도 그냥 대기다`)
  가 그 조합을 단언한다. **보고만** — 파생 이슈 D18.

### 놓친 잠재 문제 + 대응 (r4)

| # | 문제 | 대응 |
|---|---|---|
| S6 | **`compact` 의 `as T` 는 여전히 런타임 `null` 을 감춘다.** 타입이 막는 것은 *리터럴*이고, 런타임에 `null` 이 든 값이 들어오면 그 키는 드롭된 채 `T` 로 캐스팅된다 | 세 호출부가 전부 리터럴이라 현재 도달 경로가 없다. 넓히지 않고 `obj.ts` 주석에 범위를 적었다 |
| S7 | **union 분배가 없으면 강제가 갈래 수만큼 샌다** — `compact<Grant>` 가 `vaultKey` 를 요구하지 않았다(실측) | 선조치 — `T extends unknown` 분배 + 음성 타입 케이스 1건 |
| S8 | **verify r3 §4 의 재측정 1건이 재현되지 않는다.** `rg "\.resuming" src/renderer/src` 는 `3371df2` 시점에도 **5줄 / 4파일**이다(`git grep` 로 커밋본에서 확인) | 그 관측이 뒷받침한 §10 행(3지점)은 여전히 옳다 — 5줄 중 3줄은 `BootScreen` 지역 변수와 i18n 키다. 관측 자체의 오류라 파생 이슈 D17 로 올린다 |
| S9 | **`Grant` 갈래가 늘면 §10 8행의 분모가 조용히 바뀐다.** 지금은 `rg -c` 가 세지만 새 갈래를 `compact` 없이 조립하면 그 명령이 4를 내고 `compact<` 는 3에 머문다 | 두 수를 **함께** 세는 것이 재현 명령이다(위 표 8행). 자동 게이트로 굳히는 것은 범위 밖 — 보고만 |

### 구현 보고 (r4)

- **변경 파일 7개**: `app/src/shared/obj.ts` · `app/src/shared/obj.test.ts`(신규) ·
  `app/src/main/features/auth/login.ts` · `login.test.ts` · `runtime.test.ts` ·
  `app/src/main/app/auth-resume.test.ts` · `docs/arch/backend/auth.md`. (plan.md 의 규범 행 정정은
  **별도 커밋** `23ac69f` — `handoff-plan/SKILL.md` 마무리.)
- **게이트 — 관측한 산출**(exit code 아님). 정본은 `app/AGENTS.md §better-sqlite3 ABI · 제약 환경
  게이트 가이드`. `npm test` 미사용.
  - `npm run lint` — **0 errors, 1 warning**. 그 1건은 `useTranscriptVirtualizer.ts:22`
    (`react-hooks/incompatible-library`)로 이번 변경과 무관하다. **실행 전후 `git status --short`
    동일** — `--fix` 가 트리를 바꾸지 않았다.
  - `npm run typecheck` — node·web·test **3/3, error 0**.
  - `vitest run` 전체 — **206 파일 · 2,024 케이스**, `1,982 pass / 42 fail`.
  - `vitest run` 관련(auth · main/app · renderer/app · shared) — **55 파일 / 519 케이스 전건 green**
    (1파일은 아래 ABI 기인이라 로드 실패).
  - `node --test scripts/*.test.mjs` — `# tests 49 # pass 49 # fail 0`.
  - `check-doc-inventory --check` — `generated doc ok (9 items, 76 channels)` · `prose ok` ·
    `links ok` · 차이 0.
- **환경 기인 실패 분리 — 차집합 양방향 0줄.** 42 red 의 5파일을 `app/AGENTS.md` 의 알려진 집합과
  실제로 뺐다(`comm -23` **0줄** · `comm -13` **0줄**). 서명 확인:
  `Module did not self-register: better_sqlite3.node`.
- **케이스 증가 검산**: r3 2,011 → r4 2,024 = **+13**. 내역 = `obj.test.ts` 10 · `auth-resume.test.ts`
  P=0 케이스 1 · `login.test.ts` 조립 형상 2. 합 13 ✅.

### AC 자기보고 — 이번 턴에 재현한 관측

| # | 결과 | 이번 턴 관측 |
|---|---|---|
| AC1~AC17 · AC19 · AC21~AC23 | ✅ 유지 | 실행 경로 변경이 secret·session 조립 2곳뿐이고 semantics 동일. 관련 **55파일 519케이스** 전건 green |
| **AC18** | ✅ **정정 기준(`P + K + 1`)으로 충족** | 상한 describe 3케이스 — `auth-resume.test.ts:357` `(2)`(P=1·K=0) · `:375` `(4)`(P=1·K=2) · **신규** `:390` `(1)`(P=0·K=0). MV-J(batch push 무조건화)가 그 3케이스 중 신규 1건 포함 3건을 실패시킨다 |
| AC20 | ✅ 유지 + 정본 정정 | `auth.md §5.2` 방송 상한 문면을 코드에 맞췄다(`:356`·`:365-368`) · 형제 절 `:306` · `closed-network-extensions.md §3-b`·`IPC_CONTRACT.md` 무변경 · `check-doc-inventory --check` 차이 0 |

- **합계 검산**: `✅ 23 · ⚠️ 0 · ❌ 0 = 총 23`. 분모 재계수:
  `awk '/^## 7\. Acceptance/,/^### AC 검증/' plan.md | grep -cE "^\| AC[0-9]+ \|"` → **23**.
  r3 과 분모가 같다(AC 신설·분할 0건).
- **강제 지점 20/20** — 위 전수표. r3 의 17 과 분모가 다르다(1행 `1→3` 정정 + 1행 신설).

### Review Signals — 사실만 (r4)

- **이번에 닫은 불변식이 이전 라운드와 같은 축인가: 예, 둘 다.** ① *횟수 문면*은 D3(r3) → D11·D12(r4)
  로 4라운드째다. ② *"지점을 적게 셌다"* 는 0193 `attempted` → r1 `resuming`(I4) → r2
  `refreshExpiresAt` producer(D2) → r3 grant 조립(D13) → r4 `1 + K` 사본 3건 중 2건만 지목(I11)
  으로 **5연속**이다.
- **그것을 막았어야 할 지침이 있었고 이번에 걸렸다.** review round 13 이 `handoff-impl/SKILL.md §2`
  에 넣은 "네가 §10 에 행을 신설하면 지점 수도 전수 검색으로 세고 검색 명령을 함께 적는다" 가
  I9·I10 을 만들었고, `handoff-plan/SKILL.md` 의 "고쳐 쓴 AC 행은 §5 AC 게이트를 다시 통과시킨다"
  가 AC18 재게이트 줄을 만들었다. **두 지침 다 r4 가 첫 적용이다.**
- **걸리지 않은 것**: D11 이 사본을 2건으로 셌는데 실제 3건이었다. 검증자의 전수도 같은 종류의
  누락을 낸다는 뜻이고(S8 의 `\.resuming` 오관측이 같은 축), 지침은 구현자에게만 전수 명령을
  요구한다.
- **반복된 환경 한계**: electron 미설치 + better-sqlite3 ABI 로 5파일 42케이스 red — r1·r2·r3·0193
  과 같은 서명. 차집합 양방향 0줄.
- 현재 라운드 **4**. `handoff-review` 는 라운드 4 진입 전에 수행됐다(round 13, `efb874e`).

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | **refresh 응답이 새 refresh token 을 주지 않으면 회복 능력을 영구히 잃는다.** `tokenCandidate` 가 `refreshKey` 를 만들지 않고(`login.ts:806-809`) `discardKeys(previous, …)`(`:549`)가 옛 refresh 키를 지운다 | verify r1 §13 — 실측 3관측(`'refreshed'` 반환 · 새 grant `refreshKey` = `undefined` · 2회차 `'unsupported'`) | **사용자 결정 대기.** ⓐ 새 값이 없으면 옛 `refreshKey` 승계 ⓑ 선언이 반드시 되돌려주도록 계약 문서에 명시 — 검증자가 고르지 않는다 | **해결 확인 (verify r2)** — 검증자가 심은 `MV1`(만료 우선순위)·`MV2`(승계 무조건화)가 각각 1건·2건을 실패시킨다 |
| D2 | **`refreshExpiresAt` 쓰기 경로에 눈이 없다.** `tokenCandidate` 의 `ifPresent('refreshExpiresAt', …)` 4줄을 지워도 `vitest run src/main/features/auth src/main/app` 이 **330/330 통과**한다 | verify r1 §9 적대 검증 | 회귀 1건(로그인/refresh 커밋이 grant 에 값을 싣는지) + §10 6행에 producer 지점 추가 | **해결 확인 (verify r2)** — r1 이 330/330 을 통과시킨 그 변이를 검증자가 다시 심으니 **3케이스 실패**(`MV4`) |
| D3 | **`auth-resume.ts:20-21` 모듈 헤더가 거짓이 됐다** — "재로그인이 0건이면 상한은 그대로" 인데 종료 push 는 `finally` 에서 무조건 나간다(`:217`). `auth.md §5.2` 만 갱신돼 두 사본이 갈렸다 | verify r1 §7 | 헤더 주석을 `1 + K + 1` 로 정정 · `bootstrap.ts:404-405` 도 종료 push 를 서술 | **해결 (r3)** — 헤더·`bootstrap.ts` 주석의 횟수 사본을 **삭제**했다. 정본 1벌(`auth.md §5.2`)+테스트 describe. 잔여 인용 2건(`login.ts:297`·`:330`)은 probe 단계 상한이라 참 |
| D4 | **AC18·§16 이 shipped 코드와 모순인 채로 남아 있다.** D-008 이 요구하는 대기 화면은 `resuming:true` 를 거두는 push 없이 걷히지 않는다 | 구현 보고 I3·I4 + verify r1 §5 | **설계자 몫.** 사용자 결정(D-008) > 설계자 AC 이므로 AC18·§16·§10 `resuming` 행(2→3)을 정정 | **해결 (r3)** — AC18 기준을 `1 + K + 1` 불변식으로 · §16 행 `유지`→`변경` · §10 `resuming` `2`→`3` · §15↔AC20 문서 목록 통합. 사용자에게 3안 제시 후 정정안 승인(2026-08-21) |
| D5 | **renderer 가 `resuming` 을 셀렉터 밖에서 한 번 더 읽는다**(`RootGate.tsx:42`). §12 는 "읽는 곳은 `rootFrame()` 하나" 였다. `bootPhase !== 'ready'` + `resuming:true` 에서 부팅 스피너가 "연결 복원" 라벨을 단다 | verify r1 §3 | 라벨 선택도 `rootFrame` 반환값으로 내리거나, 현 동작을 의도로 적고 케이스를 추가 | **해결 (r3)** — `RootFrame` 에 `'waiting-resume'` 신설, 라벨 선택을 셀렉터로 내렸다. `RootGate.tsx` 의 `resuming` 참조 **1건**(셀렉터 입력)뿐 · 신규 2케이스가 MV6 로 실패한다 |
| D6 | **unhandled rejection 노출이 넓어졌다** — `recoverExpired` 가 `remainingDefinitions` 전체에 `demoted()` 를 부르고 후보 0건 조기 반환이 사라졌다. 구현 보고의 "이번 변경이 넓히지 않았다" 를 정정한다 | verify r1 §12 | `finally` 덕에 화면 잠김은 없다 — 보고만, 처리는 범위 밖 | 보고만 |
| D7 | **갱신 커밋이 옛 grant 의 `principalId` 를 잃는다.** 응답이 그 필드를 다시 말하지 않으면 새 grant 에서 사라진다 — D1 과 **같은 문장의 다른 필드**다 | verify r2 §1~3 — 스크래치 실측(`'kim@corp'` → `AFTER REFRESH principalId = undefined`) | 소비자는 `runtime.ts:141` → `connection-views.ts:74` `principal` → `ProviderDetail.tsx:93` (표시 전용, 게이트는 D-001 로 대상 밖). **승계 범위를 `Grant` 필드 전수로 올릴지**가 결정 지점이다 | **해결 (r3)** — 전수 승계가 아니라 **필드별 규칙**으로 닫았다(`expiresAt` 승계는 해롭다). 조립을 delta 로 바꿔 `Grant` 에 필드가 늘면 컴파일이 깨진다(MV5) · MV1 이 2케이스를 실패시킨다 |
| D8 | **배포가 읽는 유일한 oauth 예제가 `refresh` 포트를 모른다.** `docs/guides/closed-network-extensions.md` §3-b 는 "`authorize(ctx)` **하나만** 채운다" 이고 예제 `exchange` 도 `{token, expiresAt}` 만 돌려준다 | verify r2 §11 — plan §15 가 지시한 문서인데 r1·r2 모두 갱신 0(`git log -- <file>` 최근 커밋 3건이 전부 0194 이전) | 그 절에 `refresh?`·`refreshToken`·`refreshExpiresAt` 을 더한다. 갱신 없이는 실제 배포에서 0194 의 창 없는 회복이 켜지지 않는다 | **해결 (r3)** — §3-b 에 `refresh` 갈래 · `exchange` 의 `refreshToken` · `refreshExpiresAt` 문단을 더했다. **AC20 이 §15 의 문서 목록을 인용**하게 바꿔 두 목록을 하나로 합쳤다(채점 밖으로 새던 뿌리) |
| D9 | **`refreshKey`↔`refreshExpiresAt` 짝 불변식에 눈이 없다.** `tokenCandidate` 주석은 "짝으로만 싣는다" 인데 조건을 지워도 `vitest run src/main/features/auth src/main/app` 이 **338/338 통과** | verify r2 §6 `MV3` | 동작 결과는 안 바뀐다(`refreshSecret` 이 `refreshKey === undefined` 를 먼저 접는다) — 케이스 1건을 더하거나 주석의 계약 표현을 낮춘다 | **해결 (r3)** — 최초 로그인 응답이 `refreshExpiresAt` 만 주는 케이스를 더했다(`login.test.ts:883`). MV3(짝 조건 제거)이 **1건 실패** — r2 에서는 338/338 통과였다 |
| D10 | **`tokenCandidate(previous)` 를 넘기는 호출부가 늘면 승계가 갱신 밖으로 샌다.** 인자가 optional 이라 "갱신 경로에만" 이 타입이 아니라 호출부 관례로 지켜진다 | r3 구현 §놓친 잠재 문제 → verify r3 확인 | 현재 호출부 2곳(`login.ts:407` refresh · `:806` absorbToken)이고 후자는 넘기지 않는다. `최초 로그인은 옛 grant 에서 아무것도 승계하지 않는다` 케이스가 결과는 잠근다 | 보고만 |
| D11 | **`login.ts:297`·`:330` 이 `1 + K` 를 인용한다.** 지금은 참이다(probe 단계 상한) — D3 와 같은 축의 사본이다 | r3 구현 §S3 → verify r3 확인 | D12 가 상한 문면을 고치는 김에 이 두 줄도 함께 본다 | **해결 (r4)** — 전수는 **3건**이었다(`runtime.test.ts:268` 추가). 셋 다 숫자 사본을 지우고 정본을 가리키게 했다. `rg "1 \+ K" app/src/ docs/arch/ docs/guides/ docs/decisions/ docs/*.md` → **0건** |
| D12 | **AC18 의 정정된 문면이 코드와 어긋난다.** "부팅 방송은 `1 + K + 1` 이다" 인데 batch push 는 `probeTargets.length > 0` 일 때만 나간다(`auth-resume.ts:201-210`) | verify r3 §5·§7 — `auth-resume.test.ts:750` 이 후보 0·K=0 에서 `toHaveBeenCalledTimes(1)` 을 단언한다. `1+K+1 = 2` 가 아니다 | 문면을 **`(probe 후보 있으면 1, 없으면 0) + K + 1`** 로 고친다. 검증수단 칸의 "시도 0건 케이스도 **같은 값**" 도 함께 고친다(1 ≠ 2). `auth.md §5.2:365` 의 "probe 단계는 `1 + K` 다" 도 같은 축이니 함께 정확히 한다 | **해결 (r4)** — AC18·§16·§7 주의사항을 `P + K + 1` 로 정정(설계 커밋 `23ac69f`)하고 정본 `auth.md:365-368`·흐름 블록 `:356`·형제 절 `:306`·테스트 describe 를 함께 고쳤다. **상한 describe 안에 P=0 케이스를 신설**해 정본이 `P` 항을 스스로 증명한다 — MV-J(batch push 무조건화)가 그것을 실패시킨다 |
| D13 | **전수 강제가 grant 조립 3지점 중 1곳에만 닫혔다.** `GrantBase` 는 세 갈래가 공유하는데 눈은 token 에만 있다 | verify r3 §6 `VF3` — `GrantBase` 에 `zzTenant?` 를 더하니 깨진 좌표가 **`login.ts(839,39)` 하나**다. `:605` secret · `:783` session 은 통과한다 | 두 지점도 같은 방식으로 닫거나, 닫지 않는 이유를 §10 에 적는다. r3 가 올린 불변식("조립은 필드를 빠뜨릴 수 없다")의 나머지 지점이다 | **해결 (r4)** — `compact<SecretGrant>`(`login.ts:608`)·`compact<SessionGrant>`(`:788`)로 닫았다. MV-A(`GrantBase` 에 필드 추가)가 깨는 좌표가 **1개 → 3개**다. §10 행도 `1→3` 으로 정정했다 |
| D14 | **`compact()` 가 필수 필드도 드롭한다 — 타입이 막지 못한다.** `Partial<T>` 가 필수 키에도 `undefined` 를 허용한다(`exactOptionalPropertyTypes` 미설정) | verify r3 §6 `VF1`·`VF2` — `vaultKey: undefined` 가 `typecheck:node` **error 0** 으로 통과하고, 런타임에서만 7건이 실패한다 | r3 의 주장은 "전수 강제를 **타입**에 뒀다" 인데 지금은 키 존재만 타입이 보고 값 건전성은 테스트가 본다. 필수/선택을 가르는 시그니처로 좁히거나, 주장을 실제 범위로 낮춘다 | **해결 (r4)** — `CompactSource<T>` 로 좁혔다. VF1 재현(`vaultKey: undefined`)이 이제 `TS2322` 이고 세 갈래 전부에서 그렇다(MV-B·C·D). `@ts-expect-error` 음성 케이스가 회귀를 상주 감시한다 — MV-K(r3 시그니처 복원)가 `TS2578` 로 깨진다 |
| D15 | **`compact` 자기 테스트가 없다 — "0·'' 는 유지한다" 계약에 눈이 없다** | verify r3 §1~3 — `src/shared/` 에 `obj.test.ts` 부재 | 케이스 1건이면 닫힌다. 기존 `ifPresent`·`isRecord` 도 같은 상태라 신규 회귀는 아니다 | **해결 (r4)** — `src/shared/obj.test.ts` 신설(런타임 6 + 음성 타입 3 = 9케이스, 세 함수 전부). MV-F~MV-I 가 판정 지점 4개에서 각각 1건씩 실패한다 |
| D16 | **보드 커밋에 `Criteria-Met` 이 붙었다.** root `AGENTS.md` 표는 `Criteria-*` 를 구현 커밋만으로 정한다 | verify r3 §9 — `193b5eb` trailer 7줄에 `Criteria-Met: 23/23`. r2 의 같은 성격 커밋 `b9b05c4` 는 4줄이었다 | 다음 보드 커밋부터 `Criteria-*` 를 빼거나, 규칙을 바꾸려면 root `AGENTS.md` 에서 바꾼다 | **해결 (r4)** — r4 보드 커밋의 trailer 에서 `Criteria-*` 를 뺐다. 규칙(root `AGENTS.md`)은 바꾸지 않았다 |
| D17 | **verify r3 §4 의 `resuming` 재측정이 재현되지 않는다.** "`rg "\.resuming" src/renderer/src` → `RootGate.tsx:35` 1건" 이라 적혔는데 같은 커밋에서 **5줄 / 4파일**이다 | r4 구현 §S8 — `git grep -n "\.resuming" 3371df2 -- app/src/renderer/src` 가 `3371df2` 시점에도 5줄을 낸다 | 그 관측이 뒷받침한 §10 행(`resuming` 3지점)은 **여전히 옳다** — 5줄 중 3줄은 `BootScreen.tsx:19`·`:20` 지역 변수와 `GateLogin.tsx:96` i18n 키다. 실제 wire 필드 독자는 `RootGate.tsx:35`(transport)·`useProviderGate.ts:75`(기본값) 2곳이다. 관측 자체의 오류라 다음 verify 가 같은 명령을 그대로 쓰지 않게 적는다 | 보고만 |
| D18 | **`useProviderGate.ts:75` 의 `state?.resuming ?? false` 는 §10 어느 행에도 없는 기본값 판정이다** — `useProviderGate` 테스트 파일이 없어 그 줄 자체에는 눈이 없다 | r4 구현 §Product/UX 파생 검토 | **결과는 잠겨 있다**: `state === null` 이면 `gate` 도 null 이고 `rootFrame` 이 `gate === null` 을 `resuming` 보다 먼저 본다(`rootFrame.ts:35`). `rootFrame.test.ts:47`(`게이트 미판정이면 resuming 이어도 그냥 대기다`)이 그 조합을 단언한다 | 보고만 |
