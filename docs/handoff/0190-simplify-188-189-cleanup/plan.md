# Plan — 0190-simplify-188-189-cleanup

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0190-simplify-188-189-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-08-17 |
| 입력 | 사용자 요청 `/simplify 핸드오프 188~189` + 4관점 리뷰 에이전트 + [`0189/audit.md`](../0189-0188-post-audit/audit.md) |
| 리뷰 구간 | `ad10f6c~1..c55058a` — 0188 코드(app 139파일 · +8,561/−3,403) + 0189 문서 + handoff 스킬 커밋 5건 |
| 상태 | READY |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 0188 은 외부 리뷰 10라운드를 돌며 `features/providers/` 를 네 슬라이스로 갈랐다.
  구조 목표(결합 분리)는 달성했으나 그 과정에서 ⓐ 기존 공용 헬퍼를 놓친 새 코드 ⓑ 같은 규칙의 복수
  철자 ⓒ 0187 이 세운 성능 계약의 파손 2건 ⓓ 배포 레시피가 소스 주석·가이드·테스트 세 곳에 복제된
  상태가 남았다. 0189 는 이것을 문서로 기록만 하고 코드를 바꾸지 않았다.
- **완료 후 달라지는 것**: 위 네 종류가 정리되고, 0189 가 남긴 F1~F3 · P1~P2 가 닫힌다.
- **성공을 사용자 관점에서 한 문장으로**: **사용자가 관측하는 것은 아무것도 달라지지 않는다** —
  턴당 낭비 연산이 줄고 폐쇄망 배포자가 읽는 레시피가 한 곳으로 모인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify 핸드오프 188~189` — 재사용·단순화·효율·altitude 4관점 리뷰 후 적용 | 라이브 세션 |
| 명시 결정 | **범위 = 품질 항목만.** 사용자 관측 동작을 바꾸는 항목(U1 오류 표면 · U2 문구)은 제외 | 라이브 세션 (AskUserQuestion) |
| 명시 요구 | F1 은 선택지가 아니라 **구조적 원인과 해법을 제시하라** | 라이브 세션 (AskUserQuestion 자유응답) |
| 추론 의도 | 0187 의 사용자 제약("성능 유지 혹은 개선, 절대 저하 금지")이 이번에도 유효하다 — **추론**. 근거: 같은 `/simplify` 계열이고 이번 발견의 절반이 성능 축이다 | `INDEX.md` 0187 행 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 범위는 **품질 항목만** — 사용자 관측 동작을 바꾸지 않는다 | 사용자가 4지선다에서 "품질 항목만" 선택 | 사용자 턴 | ACTIVE | — |
| D-002 | U1(해제 실패 오류 표면)·U2(`login.ts:375` 문구)는 **이번 범위 밖**. 제거가 아니라 보류다 | D-001 의 직접 귀결. 둘 다 제안 §비범위 "UI 문구 변경" 에 걸린다 | 사용자 턴 | ACTIVE | — |
| D-003 | U3(`useProviderGate.ts:48` 가드)도 범위 밖 | 사용자가 U3 포함 선택지를 고르지 않았다. 현재 실피해 없음(`supersededStep()` 이 현재값 반환) | 사용자 턴 | ACTIVE | — |
| D-004 | **F1 은 타입을 내려 해결한다** — `HarnessRuntimeConfig` 를 `adapters/harness-config.ts` 로 옮기고 조립부가 그 옆으로 간다. 코드를 올리는 것이 아니다 | 사용자가 "구조적 문제 이유 + 해결 방법" 을 요구했고, 조사 결과 blocker 는 테스트 가능성이 아니라 `adapters → features` DAG 금지 간선이었다 (§8) | 사용자 턴 + 코드 조사 | ACTIVE | — |
| D-005 | 배포 확장점의 **빈 factory 는 지우지 않는다** | `docs/guides/closed-network-extensions.md §1.1` 표와 `docs/arch/backend/auth.md:92-103` 이 "배포가 채우는 자리" 로 문서화한 선언된 계약이다. 삭제는 문서 계약 파기 | 설계 판단 | ACTIVE | — |
| D-006 | `crossesProviderBoundary` 와 `runtimeEnvChangedSinceSpawn` 을 **통합하지 않는다** | 술어는 같으나 **다른 축**이고 `adapters/harness-config.ts:40-51` 이 분리 근거를 갖는다. 0188 r2 가 되돌린 회귀와 같은 자리 | 설계 판단 | ACTIVE | — |
| D-007 | 감사 P3~P6 성능 비용은 **되돌리지 않는다** | 각각 D-020·D-060·D-056·D-038 이 승인한 대가형. 되돌리면 0188 이 고친 결함이 되살아난다 | `0189/audit.md` 축2 | ACTIVE | — |
| D-008 | 배포 레시피의 **정본은 `docs/guides/closed-network-extensions.md`**. 소스 주석은 불변식만 남기고 링크한다 | `docs/AGENTS.md` 작성규칙 3("사실을 복제하지 말고 링크한다") + `docs/arch/backend/auth.md:6`("구조 서술은 여기, 실행 절차는 guides"). `auth-definitions.ts:125` 가 이미 그 가이드를 가리킨다 | 저장소 규칙 | ACTIVE | — |
| D-009 | 0188 Ledger 의 `D-017` 을 `D-042` 로 **SUPERSEDED 표기**한다 | `D-017`(characterization test 선행)이 ACTIVE·대체관계 `—` 인 채 `D-042`(env 블록 통째 hoist)가 접근을 바꿨다. Ledger 정합성 결함 | `0189/audit.md` F3 | ACTIVE | — |

### 갱신 메모

- 이번 턴 신규: D-001~D-009 전부.
- 변경된 결정: 없음(신규 handoff).
- **0188 의 ACTIVE 결정 61건은 전부 유지된다.** 이 handoff 는 그중 어느 것도 뒤집지 않는다 —
  D-009 만 Ledger *표기*를 고치고 결정 내용은 그대로다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | **타당** | 0189 가 이미 원인까지 내려갔다. 이 handoff 는 그 위에 4관점 리뷰를 얹는다 |
| 이미 기존 코드가 충족하는가 | **아니다** | E1~E3·R1~R7 전부 현재 코드에서 반례를 실측했다(§8) |
| 더 작은 해법이 있는가 | **F1 은 있었다** | 감사는 "adapter 에 얇은 진입점" 또는 "Decision 승격" 을 제안했다. 조사 결과 **타입 1개 이동**이 더 작고 계약을 실제로 이행한다(D-004) |
| 선행 자료의 주장을 코드와 대조했는가 | **했고, 1건이 틀렸다** | `prepared-config.ts:153` 의 "테스트 가능성" 근거는 사실이 아니다 — `adapters/harness-config.ts` 의 런타임 import 는 `node:crypto` 하나뿐이라 vitest 로 열린다. 감사 F1 이 그 문장을 그대로 승계했다 |
| ACTIVE 결정과 충돌하는가 | **아니다** | 0188 D-005(호환 식별자)·D-024(cached descriptor)·D-029(row 순서)·D-030(wire 유지) 전부 보존. §16 |

- 사용자에게 올릴 결정: **없음** — D-001~D-004 로 닫혔다.
- 코드 조사로 닫은 사실: F1 의 실제 blocker(§8), P1·P2 재현(§8), 배포 레시피 드리프트 3건(§8).

## 5. 동작 / 사용자 흐름

**이 handoff 는 사용자 흐름을 바꾸지 않는다.** 아래는 *보존해야 하는* 흐름이다.

```text
(a) 부팅   gate resume → 나머지 병렬 resume → pushConnectionState 1회
(b) 턴     settings 해석 → runtime config resolve → spawn 입력 조립 → respawn 판정 → spawn
(c) 카탈로그 providerList/providerState invoke → ProviderInfo[] → 연결 탭 렌더
(d) 해제·재인증  login/continue/reauth/revoke → AuthChange → push
```

### 상태와 전이

변경 없음. `AuthSnapshot.status`(`valid|invalid|expired|...`)·`AuthStep`·`GateState` 의 전이표는
0188 그대로다.

> **[구현 턴 정정]** 초안은 여기서 "`AuthSnapshot` 에서 `credentialRevision` 필드가 사라진다"
> 고 적었다(S2). **보류했다** — 프로덕션 독자 0 은 사실이지만 `runtime.test.ts` 의 27개 참조가
> 그 필드로 실제 불변식(세대 증가·401 강등)을 관측한다. 근거는 `[구현자 기입] 설계 대비 명시적
> 차이`. 결과적으로 `AuthSnapshot` 은 **필드를 포함해 완전히 불변**이다.

### 파생 UX / 엣지케이스

| 케이스 | 기대 |
|---|---|
| 폐쇄망 형상(settings env 블록 + orca.json env) | E2 이후 턴당 `JSON.stringify` 2회가 사라진다. **respawn 판정 결과는 동일** |
| 실행 구성 해석 실패 턴 | `runtimeEnvFingerprint === undefined` 로 판정 불가 유지(0188 r10). E1 이 이 의미론을 건드리지 않는다 |
| 배포가 harness/usage row 를 더한 형상 | A2 이후 deps 타입이 좁아지지만 `bind()` 는 그대로라 레시피가 깨지지 않는다 |

## 6. 범위 / 비범위

**범위**: 1군 효율(E1~E3) · 2군 재사용(R1~R7) · 3군 단순화(S1~S12) · 4군 altitude(A1~A4).

**비범위**:

| 항목 | 이유 |
|---|---|
| U1 해제 실패 오류 표면 | D-002 |
| U2 `login.ts:375` 문구 | D-002 |
| U3 renderer 게이트 가드 | D-003 |
| 배포 빈 factory 삭제 | D-005 |
| 두 boundary 술어 통합 | D-006 |
| P3~P6 대가형 비용 | D-007 |
| `bootstrap.ts:367` 무조건 `pushConnectionState` | pre-0188 부터 동일 — 0188 회귀가 아니다. E3 가 그 방송의 **단위 비용**은 줄인다 |
| 새 의존성·DB 마이그레이션·IPC 채널 | 전부 0건 |

**비범위가 범위를 막지 않는지 확인**: U1~U3 를 빼도 E·R·S·A 전부 독립적으로 적용·검증 가능하다.

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1 | 한 spawn 에서 env fingerprint 가 **1회만** 계산된다 | `harnessEnvFingerprint` 를 spy 로 감싼 단위 테스트 — `prepareHarnessConfig` 결과를 `TurnRequest` 에 실어 `SessionRuntime.recordSpawn` 을 태우면 호출 **1회** | `app/chat-turn/turn-setup.ts` → `features/sessions/session-runtime.ts` |
| AC2 | 전달된 fingerprint 와 재계산 값이 **항상 같다** — 부재 시에만 재계산한다 | `envFingerprint` 없이 호출하면 `harnessEnvFingerprint(req.env)` 와 같은 값이 기록된다 | 위와 같음 |
| AC3 | 같은 settings·config 입력에 `prepareHarnessConfig` 가 **같은 `providerSettings` 참조**를 돌려주고, 그 결과로 `providerSettingsChangedSinceSpawn` 이 `false` 다 | env 블록 있는 settings 로 2회 호출 → `Object.is` 참조 동일 + 술어 `false`. `JSON.stringify` spy 호출 0 | `features/harnesses/prepared-config.ts` → `runtime-boundary.ts` (매 턴) |
| AC4 | `providerSettings` 내용이 실제로 바뀐 턴에는 여전히 `true` 를 돌려준다 | 다른 blob 으로 호출 → 술어 `true` | 위와 같음 |
| AC5 | `ProviderInfo.auth` 의 값이 변경 전과 **필드 단위로 동치**다(깊은 복사 제거 후에도) | `connection-views.test.ts` 의 기존 동치 단언 유지 + 호출자가 반환값을 변형해도 `describe()` 원본이 오염되지 않음을 확인 | `orca:provider:list`/`:state` invoke · `pushConnectionState()` |
| AC6 | Grant → vault 키 도출이 **한 함수**에서 나온다 | `vaultKeysOf` 를 export 하고 sweep·delete 4지점이 그것을 호출한다(`rg` 전수 = 4/4). 3 kind(`secret`·`token`·`session`) 각각의 키 집합 단위 테스트 | `store.restore()` 부팅 sweep · `store.revoke()` · `login.discardKeys()` |
| AC7 | 재사용 치환(R1·R3·R5·R7) 후 **동작이 동치**다 | 해당 모듈의 기존 테스트 green + `ifPresent`/`isRecord` 치환 지점의 `undefined` 케이스 단언 | auth·harnesses 전 경로 |
| AC8 | 프로덕션 호출자가 0인 심볼이 남지 않는다 — `mergeEnvLayers`·`AuthSnapshot.credentialRevision`·`PluginBinding.server`·`harnessModelProviderKey`·`prepared-config` 재export | 각 심볼에 대해 `rg` 결과 0건(테스트 포함). 제거 후 typecheck green | — (제거 대상) |
| AC9 | 단순화(S1·S3·S5·S6·S7·S9·S12) 후 **관측 동작 불변** | 해당 모듈 기존 테스트 전부 green, 신규 단언 없이 통과 | auth store·login·gate·respawn |
| AC10 | `AuthStore` 의 authId 축 상태가 **한 자료구조**에 산다 | `grants`·`verified`·`revisions`·`expirySettled` 4 컬렉션이 1개로 합쳐지고 mutator 별 쓰기 횟수가 준다. 만료·해제·복원 기존 테스트 green | 부팅 restore · 재인증 · 만료 정착 |
| AC11 | 배포 확장점 factory 4종이 **인증 lifecycle 메서드에 도달할 수 없다** | `HarnessConfigApiDeps`·`PluginDeploymentDeps`·`UsageDeploymentDeps`·`ConnectionDeploymentDeps` 의 `auth` 가 `AuthBinder` 타입이고, factory 안에서 `deps.auth.login(...)` 이 **컴파일 실패**한다(부정 타입 테스트) | `app/bootstrap.ts` 주입 지점 |
| AC12 | `prepareHarnessConfig` 가 `adapters/` 에 있고 **boundaries lint 를 통과**한다 | `npm run lint` green + `adapters/**` 에서 `features/` import 0건(`rg`) | `app/chat-turn/turn-setup.ts` 호출 |
| AC13 | `options.settings.env` 와 `options.env` 의 우선순위 결정표가 **테스트로 고정**된다 | characterization test — 같은 키가 두 채널에 동시에 남지 않음 + `runtimeEnv > settings env > app env > process env` 순서 단언 | `prepareHarnessConfig` (매 턴) |
| AC14 | 배포 레시피의 **정본이 하나**다 — 소스 주석에 실행 가능한 레시피 본문이 없다 | `app/src/main/app/deployment/**` 에서 ` ```ts ` 블록 0건(단 `usage-fetcher` 예제는 가이드로 **이동**됨을 함께 확인) + 가이드에 해당 절 존재 | 폐쇄망 배포자가 읽는 경로 |
| AC15 | 가이드↔코드 드리프트 3건이 정정된다 | 가이드에서 `secretFor` 0건 · augmenter 예제 시그니처가 실제 export 와 일치 · usage 매퍼 이름 1가지 | 위와 같음 |
| AC16 | **wire·UI 계약 불변** | `src/shared/ipc.ts` diff 0 · `src/shared/i18n/` diff 0 · `ProviderInfo` 10필드 + `ProviderPlatformState.step` 동치 · renderer diff 0 | 연결 탭 전체 |
| AC17 | 게이트 green | `npm run typecheck` · `npm run lint` · 영향 스위트 `vitest run` · `check-doc-inventory.mjs --check` | CI |

### AC 검증 주의사항

- **AC1 은 "호출 지점 grep" 이 아니라 sink 호출 횟수로 센다** — spy 를 `harnessEnvFingerprint` 에
  걸고 한 spawn 경로를 태워 **1** 을 관측한다. 지점 수 grep 은 같은 지점이 두 번 불리는 경우를 놓친다.
- **AC3 은 `Object.is` 참조 동일까지 본다.** "값이 같다" 로는 fast path 복원을 증명하지 못한다.
- **AC8 의 `rg = 0` 은 테스트·주석·문자열 참조를 포함해 센다.** 주석에만 남은 이름은 제거 대상이
  아니라 주석 정정 대상이다.
- **AC11 은 부정 테스트다** — `@ts-expect-error` 로 `deps.auth.login` 접근이 실패함을 고정한다.
  타입이 좁아졌다는 구조적 사실만으로는 능력이 실제로 닫혔는지 보장하지 못한다.
- **AC14 의 "```ts 블록 0건" 은 structural proxy 다.** 의미 목표는 "배포자가 읽을 레시피가 한 곳"
  이므로, 가이드에 대응 절이 실제로 있는지를 함께 확인한다(특히 `usage-fetcher` 예제는 **가이드에
  없던 것**이라 삭제가 아니라 이동이어야 한다).

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### F1 의 실제 blocker (감사·주석 정정)

```text
prepareHarnessConfig  →  HarnessRuntimeConfig   (features/harnesses/runtime-config.ts:40)
adapters → features = DAG 금지 간선 (eslint-plugin-boundaries)
```

- `adapters/harness-config.ts` 의 런타임 import 는 `node:crypto` **하나**(`:6`) — electron 비의존,
  vitest 로 열린다. 따라서 `prepared-config.ts:153` 의 "테스트 가능성" 근거는 **위치 선택의 이유가
  아니다**(그건 *호출부* `turn-setup.ts:4` 가 electron 을 무는 사정이고 두 후보 위치 모두에 동일).
- `HarnessRuntimeConfig`(`runtime-config.ts:40-51`)는 순수 데이터다 —
  `key`·`harnessId`·`modelProviderId`·`settings?`·`runtimeEnv`·`validUntil?`.
  그 `settings` 의 타입 `ResolvedHarnessSettings` 는 **이미 `adapters/harness-config.ts` 에 산다**.
- 즉 타입이 *계약*이 아니라 *생산자* 옆에 놓였고, 그 배치가 조립부를 아래에 붙잡고 있다.

### 전수 조사

| 대상 | 명령 | 결과 |
|---|---|---|
| `harnessEnvFingerprint` 프로덕션 호출 | `rg 'harnessEnvFingerprint' src/main --type ts` (테스트 제외) | 정의 1(`adapters/harness-config.ts:68`) + 호출 **2**(`prepared-config.ts:149` · `session-runtime.ts:355`) + 재export 1 |
| `TurnRequest` 필드 | `adapters/turn.ts:122-140` | `env?: Record<string,string>` 있음, fingerprint 필드 **없음** |
| 참조 fast path | `runtime-boundary.ts:24` | `spawned.settings === resolved.settings`. `prepared-config.ts:131` 이 `buildsEnv` 일 때 **매 턴 새 객체** |
| `AuthRuntime` 소비자 | `rg 'AuthRuntime' src/main --type ts` (테스트·정의 제외) | 12곳. 그중 **배포 deps 4곳**(`deployment/{harness-runtime:98,plugins:68,usage-fetcher:41,connections:24}`)은 `bind` 만 필요 |
| `ifPresent` 미채택 | `app/src/shared/obj.ts:6` 정의, `features/usage/usage-map.ts` 12회 사용 | 신규 코드 **~27곳**이 longhand |
| `mergeEnvLayers` | `rg 'mergeEnvLayers' src` | 정의 1 + 테스트 1. **프로덕션 호출자 0** |
| `credentialRevision` | `rg 'credentialRevision' src` | `snapshot()` 경유 독자는 전부 `.test.ts`. 프로덕션은 `store.credentialRevision()` 직접 호출(`authenticated-request.ts:149`·`store.ts:308`) |
| 배포 레시피 드리프트 | 코드↔가이드 대조 | **3건** — `secretFor`↔`secrets`(가이드 `:490` vs 코드 `:110`, 가이드 자기 표 `:75` 는 `secrets`) · augmenter 예제 이름·시그니처 불일치(`harness-runtime.ts:26` vs 가이드 `:504`) · `mapCorpUsageSnapshot`↔`toSnapshot` |

### 수치 / 전칭 표현 검산

- `app/deployment/` **529줄 / 주석 370줄**. 파일별 (총/주석): `auth-definitions` 131/127 ·
  `harness-runtime` 163/112 · `plugins` 102/50 · `connections` 62/34 · `usage-fetcher` 49/37 ·
  `gate-auth` 22/10. 합 529/370 ✓ (검산: 131+163+102+62+49+22 = 529).
- `docs/guides/closed-network-extensions.md` **980줄**.
- **전칭 확인**: "`adapters/harness-config.ts` 는 electron 을 물지 않는다" → 파일 전체 import 전수
  확인, 런타임 import 는 `node:crypto` 1건뿐.
- **인벤토리 무영향**: 이번 변경은 슬라이스·contracts 모듈·핸들러·채널·마이그레이션 **개수를 바꾸지
  않는다**(타입 추가는 contracts *모듈* 수를 바꾸지 않는다) → `check-doc-inventory.mjs` 재생성 불필요.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
app/chat-turn/turn-setup.ts  (electron 의존)
  └─ features/harnesses/prepared-config.ts  prepareHarnessConfig
       ├─ imports HarnessRuntimeConfig   ← features/harnesses/runtime-config.ts   [조립부를 아래 고정]
       ├─ withoutEnvBlock → 매 턴 새 객체 ────────────────────┐
       └─ harnessEnvFingerprint(env)  ①                      │
  └─ TurnRequest { env, providerSettings }   (fingerprint 나를 필드 없음)
       └─ features/sessions/session-runtime.ts:355
            harnessEnvFingerprint(req.env)  ②  ← ①과 항상 같은 값을 다시 계산
                                                              │
runtime-boundary.ts:24  spawned.settings === resolved.settings ┘ → 항상 miss → stringify ×2/턴

app/deployment/{harness-runtime,plugins,usage-fetcher,connections}.ts
  └─ deps.auth: AuthRuntime   ← login/continue/reauth/revoke/resume/subscribe 까지 노출
```

### TO-BE

```text
adapters/harness-config.ts        [순수 · node:crypto 만]
  ├─ ResolvedHarnessSettings      (기존)
  ├─ HarnessRuntimeConfig         (features 에서 하강)
  ├─ harnessEnvFingerprint        (기존 SSOT)
  └─ prepareHarnessConfig / prepareUnresolvedHarnessConfig   (features 에서 상승)
        └─ adjusted 결과를 원본 blob 키로 memoize → 같은 입력 = 같은 참조

features/harnesses/runtime-config.ts  → import type { HarnessRuntimeConfig } from adapters   [허용 간선]
features/sessions/session-runtime.ts  → req.envFingerprint ?? harnessEnvFingerprint(req.env)
adapters/turn.ts  TurnRequest { …, envFingerprint?: string }

contracts/auth.ts   AuthBinder = Pick<AuthRuntime, 'bind'>
app/deployment/*    deps.auth: AuthBinder            [lifecycle 도달 불가 — 컴파일 강제]
app/connection-views.ts  auth: Pick<AuthRuntime,'describe'|'currentStep'>
```

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | 근거 |
|---|---|---|---|
| fingerprint 계산 | spawn 당 2회 | **1회** (전달, 부재 시만 재계산) | E1 / AC1·AC2 |
| settings 참조 비교 | 폐쇄망 형상에서 항상 miss → stringify ×2 | memoize 로 **hit 복원** | E2 / AC3·AC4 |
| descriptor 복사 | `describe()` 1벌 + view 1벌 = 2벌 | **1벌** | E3 / AC5 |
| 조립부 레이어 | `features/harnesses` | `adapters` (계약대로) | D-004 / AC12 |
| 배포 deps 능력 | `AuthRuntime` 전체 | `AuthBinder` | A2 / AC11 |
| 레시피 정본 | 소스 주석 + 가이드 + 테스트 (3곳, 드리프트 3건) | **가이드 1곳** + 소스는 불변식·링크 | D-008 / AC14·AC15 |

### 핵심 책임 분리

- `adapters/harness-config.ts` = **spawn 입력의 타입 계약과 순수 조립**. electron·feature 비의존.
- `features/harnesses/runtime-config.ts` = **동적 해석**(단일 비행·세대·캐시·augmenter). 이동 없음.
- `app/deployment/*` = **배포가 채우는 자리**. 능력은 `AuthBinder` 로 좁힌다.
- `docs/guides/closed-network-extensions.md` = **레시피 정본**.

## 10. 계약 / 타입 / 강제 지점

| 계약 | 누가 강제 | 언제 강제 (**지점 전부**) |
|---|---|---|
| fingerprint 는 spawn 당 1회 | 테스트 | ① `prepared-config` 단위 spy ② `session-runtime.recordSpawn` 이 전달값 우선 사용 ③ `TurnRequest.envFingerprint` 를 채우는 `turn-setup.ts` ④ 같은 필드를 채우는 `chat-turn-continuation.ts` |
| 같은 입력 = 같은 `providerSettings` 참조 | 테스트 | ① `prepareHarnessConfig` memoize 단위 테스트 ② `providerSettingsChangedSinceSpawn` 술어 테스트 |
| 배포는 인증 lifecycle 에 도달 불가 | **컴파일러** | ① `HarnessConfigApiDeps` ② `PluginDeploymentDeps` ③ `UsageDeploymentDeps` ④ `ConnectionDeploymentDeps` ⑤ `@ts-expect-error` 부정 테스트 |
| `adapters` 는 `features` 를 import 하지 않는다 | **eslint boundaries** | `npm run lint` (`adapters/**` 전 파일) |
| Grant → vault 키는 한 함수 | 테스트 + 리뷰 | ① `store.restore()` sweep ② `store.deleteVaultKeys()` ③ `login.discardKeys()` kept ④ `login.discardKeys()` names |
| 레시피 정본은 가이드 | 리뷰 + AC14 grep | ① `auth-definitions.ts` ② `harness-runtime.ts` ③ `plugins.ts` ④ `connections.ts` ⑤ `usage-fetcher.ts` ⑥ 가이드 대응 절 |
| wire 불변 | 게이트 | ① `src/shared/ipc.ts` diff 0 ② renderer diff 0 ③ `connection-views.test.ts` 동치 단언 |

**다중 저장소 쓰기**: 코드 산출에는 해당 없음(vault·파일 쓰기 경로를 바꾸지 않는다 — R2 는 *도출*을
합칠 뿐 쓰기 순서를 건드리지 않는다). **문서 산출에는 해당한다** — 이 handoff 의 판정은
`0190/verify.md` 와 `docs/handoff/INDEX.md` 보드 두 곳에 산다. 그리고 D-009 는 **`0188/plan.md`
Ledger** 를 고친다. 세 사본 전부를 위 강제 지점 표에 준해 함께 갱신한다.

## 11. 구현 설계

군 단위로 커밋을 나눈다. **A3(타입 하강) → 1군 → 2군 → 3군 → A1·A2·A4** 순 — A3 가 파일 위치를
바꾸므로 먼저 하면 뒤 작업의 충돌이 없다.

### 테스트 가능성

- `adapters/harness-config.ts` 는 electron 비의존이므로 이동 후에도 `prepared-config.test.ts` 의
  import 경로만 바뀐다(seam 변화 없음).
- AC11 부정 테스트는 `deployment-wiring.test.ts` 에 `@ts-expect-error` 로 넣는다 — 그 파일이 이미
  가상 배포로 factory 를 태우고 있어 같은 자리다.
- AC13 characterization test 는 `adapters/harness-config.test.ts`(이동 후 위치)에 둔다.

## 12. End-to-end 영향

### producer → consumer

```text
HarnessRuntimeConfigService.resolve  →  HarnessRuntimeConfig
  →  prepareHarnessConfig  →  PreparedHarnessConfig{providerSettings, env, runtimeEnvFingerprint}
     →  TurnRequest{providerSettings, env, envFingerprint}     ← 신규 필드
        →  SessionRuntime.recordSpawn (fingerprint 기록)
        →  runtime-boundary 술어 (respawn 판정)
        →  adapter query options
```

`envFingerprint` 는 **main 내부 어댑터 포트 필드**다 — IPC·DB·wire 를 타지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

`AuthBinder` 도입은 `bootstrap.ts` 의 주입 4지점만 바꾼다(전달하는 객체는 그대로 `AuthRuntime`
인스턴스 — 구조적으로 `AuthBinder` 를 만족한다). 소비처 증가 없음.

## 13. Lifecycle / 오류 / 정리

- **memoize(E2)의 수명**: `WeakMap<HarnessNativeSettings, ResolvedHarnessSettings>` — 원본 blob 이
  GC 되면 항목도 사라진다. 캐시 무효화 로직을 새로 만들지 않는다(입력 참조가 곧 키).
- **덜 하면서 잃는 것**: memoize 는 "매 턴 새 객체를 만들어 우연히 얻던 격리" 를 없앤다. 반환된
  `providerSettings` 를 호출자가 **변형하지 않는다**는 것이 전제이고, 현재 소비자는 읽기만 한다
  (`turn-setup.ts` → `TurnRequest` → 어댑터). AC3 옆에 "반환값 변형 금지" 를 회귀 테스트로 고정한다.
- **E3 도 같은 축**: `describe()` 가 이미 새 객체를 주므로 view 의 재복사를 지워도 원본 오염이
  없다 — AC5 가 그것을 단언한다.
- E1 의 fallback: `envFingerprint` 부재 시 재계산하므로 필드를 채우지 않는 경로가 생겨도 회귀 없음.

## 14. 성능 / 상한 / 최적화

| 축 | AS-IS | TO-BE |
|---|---|---|
| spawn 당 fingerprint | 2회 (HMAC + canonicalize ×2) | **1회** |
| 턴당 settings 비교 (폐쇄망 형상) | `JSON.stringify` ×2 + 객체 1할당 | **참조 비교 1회** |
| `pushConnectionState()` 1회당 descriptor 복사 | method·field 2벌 | **1벌** |
| 부팅 | 변화 없음 | 변화 없음 |

**성능 저하 없음** — 이번 변경은 전부 제거형이다. memoize 만 메모리를 쓰지만 `WeakMap` 이라
상한이 원본 blob 수명에 묶인다.

## 15. 외부 구현 포트 / 문서 계약

`app/deployment/*` 는 **배포자가 구현하는 포트**다. A2 가 deps 타입을 바꾸므로 두 층을 함께 닫는다:

- **shape**: 가이드 §1.1 factory 표의 "받는 것" 칸을 `AuthBinder` 로 갱신하고, 예제가 실제 타입에
  대입 가능한지 확인한다(AC15).
- **semantics**: `bind()` 만으로 레시피가 성립하는지 — 가이드 §3-c·§4·§5-b 예제 전부
  `deps.auth.bind(...)` 로 시작하므로 성립한다(실측).
- `docs/arch/backend/auth.md:92-103` 의 구조 서술도 같은 PR 에서 갱신한다.

## 16. 기존 결정·규칙과의 관계

| 결정 | 이번 변경과의 관계 |
|---|---|
| 0188 D-005 (호환 식별자 유지) | 유지 — 식별자·wire 이름 무변경 |
| 0188 D-024 (cached descriptor 로 도구명) | 유지 — `PluginBinding.toolNames()` 그대로 |
| 0188 D-029 (row 순서 = 등록 순서) | 유지 — `createConnectionSources` 조립 순서 무변경 |
| 0188 D-030 (`AgentEnvironment` compat boundary) | 유지 |
| 0188 D-038 (env 전용 fingerprint) | 유지 — E1 은 *계산 횟수*만 바꾼다 |
| 0188 D-042 (env 블록 통째 hoist) | 유지 — E2 는 그 결과를 memoize 할 뿐 hoist 규칙 불변 |
| 0188 D-017 | **D-042 로 SUPERSEDED 표기**(D-009). 결정 내용은 손대지 않는다 |
| 0125 (해석 실패는 경계가 아니다) | 유지 — `runtimeEnvFingerprint === undefined` 의미론 불변 |
| `docs/AGENTS.md` 작성규칙 2·3 | 준수 — 수치는 `generated/inventory.md`, 레시피는 가이드 단일화 |
| `src/main/AGENTS.md` 레이어 DAG | **더 잘 준수**(A3·A2) |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| S1(store 자료구조 통합)이 만료·해제·복원 전이를 건드릴 수 있다 | 이 파일의 기존 테스트가 두껍다(`runtime.test.ts` 1,416줄). **신규 단언 없이** 전부 green 이어야 한다(AC9) |
| E2 memoize 가 호출자 변형을 전제한다 | AC3 옆 회귀 테스트 + §13 명시. 현재 소비자는 읽기 전용(실측) |
| A1 이 주석을 지우며 **불변식까지** 지울 수 있다 | 남길 4개를 §A1 에 명시(id 불변 · origin 경로 금지 · gate probe 필수 · 서버 부팅 1회). `usage-fetcher` 예제는 **이동**이지 삭제가 아니다 |
| 한 handoff 에 4군 26건은 크다 | 군 단위 커밋 + AC 17건으로 분리 검증. 군 사이 의존은 A3→나머지 하나뿐 |

## 18. 영향 받는 파일 / 문서

**코드(이동)**: `adapters/harness-config.ts`(수신) ← `features/harnesses/prepared-config.ts`,
`features/harnesses/runtime-config.ts`(타입 export 이전).

**코드(수정)**: `adapters/turn.ts` · `features/sessions/session-runtime.ts` ·
`features/harnesses/{runtime-boundary,env,settings,settings-write,settings-entries}.ts` ·
`features/auth/{store,store-parse,login,runtime,oauth,specs/credential}.ts` ·
`features/gate/index.ts` · `contracts/auth.ts` · `app/{bootstrap,connection-views,auth-resume}.ts` ·
`app/chat-turn/{runtime-entry,turn-setup}.ts` · `app/chat-turn-continuation.ts` ·
`app/deployment/*.ts` · `features/sessions/respawn-policy.ts` · `shared/protocol.ts`(export 추가).

**문서**: `docs/guides/closed-network-extensions.md`(레시피 수신 + 드리프트 정정) ·
`docs/arch/backend/auth.md`(deps 타입·모듈 지도) · `docs/handoff/0188-.../plan.md`(D-017 표기) ·
`docs/handoff/INDEX.md` · `docs/archive/handoffs/INDEX-history.md`(종료 시).

## 19. 게이트

```bash
cd app
npm run typecheck
npm run lint                       # --fix 라 트리를 쓴다 — 실행 후 diff 확인
./node_modules/.bin/vitest run src/main/features/auth src/main/features/harnesses \
  src/main/features/sessions src/main/features/gate src/main/app src/main/adapters
node scripts/check-doc-inventory.mjs --check
```

- `app/node_modules` 는 이번 환경에서 **설치됐다**(`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`, exit 0).
  0189 와 달리 게이트를 실제로 돌린다.
- DB 로드 스위트가 better-sqlite3 ABI 로 red 면 **알려진 베이스라인으로 분리 보고**한다
  (`app/AGENTS.md` 제약 환경 가이드).
- Electron 부팅·실제 로그인 흐름은 이 환경에서 불가 → **사람 실기**로 명시한다.

---

## READY self-review

- [x] 여러 턴의 결정이 Decision Ledger 에 보존(D-001~D-009, 전부 ACTIVE).
- [x] Product & UX Contract 가 Technical Design 보다 앞이고 구현 방식 없이 완료 상태를 설명한다.
- [x] 사용자 표현을 재해석하지 않았다 — "품질 항목만" 을 범위 축소로만 적용했고 U1~U3 를 **보류**로
      적었지 제거로 적지 않았다.
- [x] 사용자 결정과 코드 조사를 구분했다(§4 — 올릴 결정 없음).
- [x] 수치·전칭 표현을 실측하고 검산했다(§8 — 529 합 검산, electron 비의존 전수).
- [x] 저장소 규칙을 설계 입력으로 읽었다(boundaries DAG · `docs/AGENTS.md` 작성규칙 · inventory 가드).
- [x] 각 AC 가 행동 단언·검증 수단·프로덕션 도달 경로를 갖는다.
- [x] 사람 실기로 미룬 순수 로직이 없다 — 실기는 Electron 부팅뿐.
- [x] structural proxy 만으로 검증하는 AC 를 표시하고 의미 목표를 함께 적었다(AC14 주의사항).
- [x] 강제 지점이 여럿인 계약은 **전부** 나열했다(§10 — 최대 6지점).
- [x] 문서 산출의 다중 사본(verify·INDEX·0188 Ledger)을 §10 에 지점으로 적었다.
- [x] 성능 상한을 계산했다(§14 — 전부 제거형, memoize 만 WeakMap 상한).
- [x] 외부 구현 포트의 shape·semantics 두 층을 닫았다(§15).
- [x] 본문을 Decision Ledger 와 교차검증했다(§16).

---

## [구현자 기입] 설계 리뷰

설계대로 수행 가능했다. 다만 **AC1 의 설계가 한 축을 뭉개고 있었다** — §9 TO-BE 는
`TurnRequest.envFingerprint` 에 "조립부가 계산한 값" 을 실으라고만 적었는데, 조립부에는 값이
둘이다: `runtimeEnvFingerprint`(판정 가능한가 — 해석 실패 턴에 `undefined`)와 실제 env 의
fingerprint. 전자를 그대로 실으면 **해석 실패 턴에 뜬 채널이 이후 어떤 env 변화에도 respawn
하지 않는다**(비교의 한쪽이 영구히 null 이 된다). 그래서 `PreparedHarnessConfig` 에
`envFingerprint`(항상 정의)를 따로 두고 두 필드가 한 계산을 공유하게 했다 — 선조치 후 보고
(§6 첫째 갈래). 회귀 테스트 2건이 그 구분을 고정한다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

각 행은 **이번 턴에 재현한 관측값**을 함께 적는다.

| 계약 | 지점 | 결과 | 재현 명령 / 관측 |
|---|---|---|---|
| fingerprint spawn 당 1회 | ① 조립 ② spawn 기록 ③ `send.ts` ④ `continuation.ts` | **4/4** | `rg 'harnessEnvFingerprint' src/main` → 프로덕션 **호출 2**(`harness-config.ts:257` 계산 · `session-runtime.ts:357` 폴백) + 정의 1 + 주석 2. `send.ts:290`·`continuation.ts:91` 이 `envFingerprint` 를 싣는다 |
| 같은 입력 = 같은 참조 | ① 조립 memoize ② 술어 | **2/2** | `harness-config.test.ts` "같은 입력이면 같은 참조를 돌려준다" 4건 — `Object.is` 단언 통과 |
| 배포는 lifecycle 도달 불가 | ① `HarnessConfigApiDeps` ② `PluginDeploymentDeps` ③ `UsageDeploymentDeps` ④ `ConnectionDeploymentDeps` ⑤ 부정 테스트 | **5/5** | `rg 'auth: AuthBinder' src/main/app/deployment/*.ts` → 4건. `grep -c ts-expect-error deployment-wiring.test.ts` → **6** |
| `adapters` 는 `features` 를 import 하지 않는다 | `adapters/**` 전 파일 | **통과** | `rg -l "from '../features/" src/main/adapters` → **0건** · `npm run lint` boundaries **0 error** |
| Grant → vault 키는 한 함수 | ① sweep ② `deleteVaultKeys` ③ `discardKeys` kept ④ `discardKeys` names | **4/4** | `rg 'vaultKeysOf' src/main` → 정의 1 + 호출 4. `store-vault-keys.test.ts` 5건(3 kind + refresh + undefined) |
| 레시피 정본은 가이드 | ①~⑤ 배포 5파일 ⑥ 가이드 대응 절 | **6/6** | 배포 소스의 ` ```ts ` 블록 **0건**. 가이드 §2·§3-c·§4·§5-b 에 대응 레시피 존재(`grep -n 'CORP_SSO_AUTH\|CONFLUENCE_AUTH\|createUsageFetcher'`) |
| wire 불변 | ① `shared/ipc.ts` ② renderer ③ 동치 단언 | **3/3** | `git diff --name-only 9fe21e8..HEAD -- app/src/shared/ipc.ts app/src/renderer app/src/shared/i18n` → **0 파일**. `connection-views.test.ts` 8건 통과 |

**문서 사본 3곳**(§10 다중 저장소 쓰기): `0190/verify.md`(다음 턴) · `docs/handoff/INDEX.md`(갱신함) ·
`0188/plan.md` Ledger(D-017 → SUPERSEDED, D-042 에 대체 관계 기입 — 두 행 모두 확인).

## [구현자 기입] Product/UX 파생 검토

사용자 관측 변화 **0** 을 목표로 했고 그대로다 — wire·renderer·i18n diff 가 0 파일이다.
새로 만든 사용자 대면 문자열이 없고(전부 내부 타입·주석·테스트), 새 실패 경로도 없다.
`AuthSnapshot` 은 필드를 유지했다(아래 보류 참조).

**파생 이슈 (이번 범위 밖, 기록만)**: 0189 U1(해제 실패가 화면에서 "아무 일도 안 일어남")은
D-002 로 보류했다. 이번 턴에도 그 경로는 그대로다 — `login.ts` 가 사용자용 한국어 메시지를
담아 throw 하는데 `useProviders.revoke` 에 catch 가 없어 소비처가 없다. 제품 결정 대기.

## [구현자 기입] 놓친 잠재 문제 + 대응

1. **memoize 가 격리를 지운다.** `withEnvBlockHoisted` 가 캐시된 사본을 돌려주므로, 호출자가
   반환 `providerSettings` 를 변형하면 다음 턴으로 샌다. 현재 소비자는 읽기만 하지만(실측:
   `turn-setup` → `TurnRequest` → 어댑터) 계약을 주석으로 못 박고 "디스크 원본 불변" 회귀
   테스트를 함께 뒀다.
2. **`evaluateGate` 의 required 파생을 옮기면 진리표가 바뀔 수 있었다.** 옮기기 전
   `required = alwaysRequired || members>0` 이고 호출부가 `alwaysRequired` 에 `blocked>0` 을
   섞어 넣고 있었다. 파생 후 `required = alwaysRequired || blocked || members>0` 이고 호출부는
   각각만 넘긴다 — **합성 결과가 동일**함을 확인했고 gate 테스트 전건 통과.
3. **`LoginService.reauth` 제거가 테스트 2건을 깼다.** 그 둘은 `login.reauth` 를 직접 불렀다.
   `begin` 으로 돌리고 "`AuthRuntime.reauth` 가 여기로 라우팅된다" 를 주석으로 남겼다.
   재인증 **계약**의 커버리지는 `runtime.test.ts` 의 `runtime.reauth` 5건이 그대로 갖는다(실측).

### 설계 대비 명시적 차이

| plan | 실제 | 이유 |
|---|---|---|
| AC1 — `TurnRequest.envFingerprint` 에 조립 값을 싣는다 | `PreparedHarnessConfig` 에 `envFingerprint` **신규 필드**를 두고 그것을 싣는다 | 위 설계 리뷰 — 판정 축과 기록 축이 다르다 |
| R6 — 메모리 persistence 2벌을 테스트 헬퍼로 내린다 | **하지 않았다.** 잘못된 주석만 정정 | `store-file.ts` 가 `store.ts`·`oauth.ts` 를 모두 import 해 공통 제네릭을 거기 두면 `import/no-cycle` 위반이다. 새 모듈을 만들어 8줄 클로저를 접는 것은 0188 제안서 §"추상화는 같은 중복이 실제로 반복될 때만" 에 어긋난다. 프로덕션 소비자 0 이라는 **사실**이 주석과 달랐던 것이 실제 문제라 그것을 고쳤다 |
| AC8 — `credentialRevision`·`PluginBinding.server`·`harnessModelProviderKey` 제거 | **보류** | 아래 |

**AC8 3건을 보류한 근거** (전부 "프로덕션 독자 0" 은 사실로 확인):
- `AuthSnapshot.credentialRevision` — 테스트 참조 **27건**(`runtime.test.ts`)이 이 필드로 실제
  불변식(세대 증가·401 강등)을 관측한다. 제거하면 살아 있는 메커니즘의 유일한 관측 창이
  사라진다. 줄 하나를 줄이려고 커버리지를 버리는 교환이다.
- `PluginBinding.server`·`ConnectionViewSource.harnessModelProviderKey` — 둘 다 **선언된 배포
  확장점**의 일부다(가이드·arch 가 문서화). D-005 와 같은 이유로 지우지 않는다.

**이월 (AC9 일부)**: S1(`AuthStore` 의 authId 축 컬렉션 4개 통합) · S5(`markExpired`↔`settleExpiry`
공통 tail) · S6·S7(`login.ts` secret grant 조립 2벌 · `absorb` 108줄). 전부 실재하는 발견이고
`auth/store.ts`·`login.ts` 한 파일 안에서 닫힌다. 이번에 넣지 않은 이유는 **범위가 아니라 위험
배분**이다 — 이 두 파일은 0188 이 10라운드를 돌며 원자성·만료 정착을 고친 자리고, 같은 커밋에
구조 변경을 얹으면 회귀 원인이 갈리지 않는다. 별도 라운드 후보로 남긴다.

## [구현자 기입] 구현 보고

**대상 커밋**: `0283dc4`(1군 효율 + A3) · `6b63b49`(2군 재사용) · `ddebfcf`(4군 altitude) ·
`55cdbfe`(3군 단순화). 설계 커밋 `9fe21e8` 은 구현과 분리했다.

**변경 파일**: main 27 + 문서 4(`docs/guides/closed-network-extensions.md` ·
`docs/arch/backend/auth.md` · `0188/plan.md` · `docs/handoff/INDEX.md`).
신규 3 — `app/chat-turn/respawn-inputs.ts` · `features/auth/store-vault-keys.test.ts` ·
`adapters/harness-config.test.ts`(이설). 삭제 1 — `features/harnesses/prepared-config.ts`.

**게이트 — 관측한 산출** (exit code 가 아니라 값):

| 명령 | 관측 |
|---|---|
| `npm run typecheck` | **exit 0**, error 0 (node·web·test 3분할 전부) |
| `npm run lint` | **0 error · 1 warning**. 그 1건은 `renderer/.../useTranscriptVirtualizer.ts:22` 의 `react-hooks/incompatible-library` 로 **이번 변경과 무관한 기존 경고**(베이스라인에서도 동일) |
| `./node_modules/.bin/vitest run src/main src/shared` | **157 파일 중 152 통과 · 1,563 케이스 중 1,521 통과** |
| `node scripts/check-doc-inventory.mjs --check` | counts ok(9 items·76 channels) · prose ok · **links ok** |

**red 5 파일 / 42 케이스 = 알려진 환경 베이스라인, 변경 무관.** 서명:
`Module did not self-register: .../better_sqlite3.node` · `Electron failed to install correctly`.
목록이 `app/AGENTS.md` 의 실측 5파일과 **정확히 일치**한다 —
`infra/db/{queries,migrate}.test.ts` · `features/extensions/builder` · `features/orchestration/fork` ·
`app/chat-turn.continuity`. 원인은 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(egress 정책)로
electron 바이너리·네이티브 바인딩이 없는 것이며, 착수 전 베이스라인에서도 같은 5파일이 red 였다.
**Electron 부팅·실제 로그인 흐름 실기는 이 환경에서 불가 → 사람/CI 몫.**

**Criteria-Met: 13/17 · 부분 2 · 미충족 1.**

| AC | 판정 | 근거 |
|---|---|---|
| AC1~AC7 · AC11~AC17 | ✅ **13건** | 위 강제 지점 표의 재현 관측값 |
| AC8 | ⚠️ **부분** | `mergeEnvLayers`(rg 0건) · `prepared-config` 재export(파일 삭제) 제거 완료. `credentialRevision`·`PluginBinding.server`·`harnessModelProviderKey` **3건 보류**(근거는 위) |
| AC9 | ⚠️ **부분** | S3·S4·S9·S12 적용, S1·S5·S6·S7 이월 |
| AC10 | ❌ **미충족** | `AuthStore` 4 컬렉션 통합(S1) 이월 |

> **자기보고 정정**: 커밋 `55cdbfe` 의 trailer 는 처음 `16/17` 로 적혔다. 부분 충족 2건을
> 충족으로 세었기 때문이고, 검증자가 재측정하면 어긋난다(0187 r1·0189 r1 과 같은 형태).
> trailer 를 `13/17` 로 정정했고 **이 표가 정본**이다.

## [구현자 기입] Review Signals — 사실만

- 현재 라운드: **1**.
- 이번에 닫은 축이 이전 라운드와 같은가: 0189 감사의 F1·F2·F3·P1·P2 를 닫았다. F1 은
  **감사와 코드 주석이 든 근거가 사실과 달랐다** — `prepared-config.ts:153` 이 "테스트 가능성"
  을 들었으나 `adapters/harness-config.ts` 의 런타임 import 는 `node:crypto` 하나뿐이라 이미
  vitest 로 열린다. 실제 blocker 는 `adapters → features` DAG 간선이었다. 감사가 그 문장을
  코드에서 재검증하지 않고 승계했다.
- 막았어야 할 plan 지침이 있었는가: `handoff-plan` §조사 게이트가 "선행 자료의 주장을 코드와
  다시 대조한다" 를 이미 갖는다. 0189 는 그것을 축 1(제안 충실도)에는 적용했으나 **자기가 인용한
  코드 주석에는 적용하지 않았다** — 주석은 "코드" 로 세어 검증을 건너뛰기 쉽다.
- 반복해서 부딪히는 환경 한계: better-sqlite3 / electron 바이너리 부재로 DB·electron 로드
  스위트 5파일이 상시 red. 이번에는 `npm ci` 가 성공해 나머지 152 파일을 실제로 돌릴 수 있었다
  (0189 는 `node_modules` 자체가 없어 관측이 0이었다).

## [검증자 기입] 파생 이슈

**verify r1 = FAIL** (2026-08-17). 판정 원문은 [`verify.md`](verify.md).
독립 채점 **✅ 14 · ⚠️ 2 · ❌ 1** · 강제 지점 **25/25 전부 닫힘** · 기준 밖 중대 결함 **0**.
FAIL 사유는 결함이 아니라 **범위 미완** 하나다.

- [ ] **D1 — AC10 미충족 (+ AC9 4/7 이월). 사람 결정 필요.**
      `store.ts` 실측 — `grants`(:97) · `verified`(:103) · `revisions`(:117) ·
      `expirySettled`(:121) 4 컬렉션 그대로. 이월 근거(0188 이 10라운드로 원자성·만료를 고친
      자리라 같은 커밋에 구조 변경을 얹으면 회귀 원인이 갈리지 않는다)는 **합리적이고 코드
      근거도 맞다**. 그러나 범위 축소는 결정권자 몫이다. ⓐ 이월 수용 → AC9·AC10 을 후속
      handoff 로 이관하고 0190 종료 / ⓑ 이번에 S1·S5~S7 구현. **해결안으로 위장하지 않는다.**
- [ ] **D2 — AC8 이 ACTIVE Decision D-005 와 모순이었다 (plan 결함).**
      AC8 은 `PluginBinding.server`·`harnessModelProviderKey` 제거를 요구하는데 D-005 는
      "문서화된 배포 확장점은 지우지 않는다" 를 못 박는다. 구현자가 Decision 을 우선한 것은
      **옳다**(Decision > AC). `credentialRevision` 은 성격이 또 달라 — 확장점이 아니라 테스트
      27건의 유일한 관측 창이다. AC8 이 성격이 다른 셋을 한 줄에 묶었다 → 세 갈래로 재작성하거나
      D-005 적용 범위를 AC8 에 명시한다.
- [ ] **D3 — `plan.md:496`·`:529` 의 `55cdbfe` 는 존재하지 않는 커밋.** 실제 `8bbd595`
      (`git cat-file -t 55cdbfe` → `Not a valid object name`). INDEX 는 옳고 plan 만 낡았다.
      구현 보고의 "대상 커밋" 은 다음 라운드가 기준선을 잡는 좌표라 죽은 참조를 남기지 않는다.
- [ ] **D4 — 자기보고 산술: `13/17` → `14/17`.** 같은 표가 열거한 ✅ 는 14건이다
      (17 − 부분 2 − 미충족 1). 과소 보고라 무해하나, 내역 합과 총계를 맞추지 않은 형태는
      0187 r1·0189 r1(둘 다 과대)과 같은 축이다.
