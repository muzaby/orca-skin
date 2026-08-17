# Verify — 0190-simplify-188-189-cleanup

> 검증 절차는 [`handoff-verify/SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0190-simplify-188-189-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-08-17 |
| 대상 커밋/range | `9fe21e8..c8fe300` (구현 4커밋: `0283dc4` · `6b63b49` · `ddebfcf` · `8bbd595`) |
| 구현 전 plan 기준 | `9fe21e8` |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예 — 설계·구현·검증이 모두 Claude.** §0 의 기준선 잠금과 전 항목 재측정으로 자기 증명을 막았다 |

## 0. 기준선 / plan 변경 확인

- **기준선이 diff 로 성립하는가**: **예.** 설계 커밋 `9fe21e8` 이 구현 4커밋과 분리돼 있어
  §0 의 자기 증명 방지 장치가 실제로 작동한다.
- 구현 커밋이 `plan.md` 를 변경했는가: **예, `8bbd595` 하나.** 변경 내용을 전수 확인했다:
  - §5 "상태와 전이" 의 S2 서술을 `[구현 턴 정정]` 인용구로 교체 — **초안 주장을 지운 것이
    아니라 인용해 보존하고 보류 근거를 붙였다.** 기준 완화가 아니다.
  - `[구현자 기입]` 5개 절 추가(설계 리뷰 · 강제 지점 전수 · Product/UX 파생 · 놓친 문제 ·
    구현 보고 · Review Signals). 전부 구현자 소관 surface.
- **AC 변경: 없음.** §7 의 AC 표(AC1~AC17) 는 `git diff 9fe21e8..HEAD` 에서 **한 줄도 바뀌지
  않았다**. 구현자가 자기 산출에 맞춰 기준을 재작성하지 않았다.
- **Decision Ledger 변경: 없음.** D-001~D-009 전부 원문 유지.
- Product/UX Contract 변경: §5 의 위 1건뿐이고 방향이 "보류 = 기준을 더 보수적으로" 다.
- **채점에 사용할 원 기준**: `9fe21e8` 시점의 §7 AC 17건 + Decision Ledger D-001~D-009.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path | 판정 |
|---|---|---|---|
| D-001 · D-002 · D-003 (품질 항목만, 사용자 관측 불변) | wire·renderer·i18n 무변경 | — | ✅ `git diff --name-only 9fe21e8..HEAD -- src/shared/ipc.ts src/renderer src/shared/i18n` → **0 파일** |
| D-004 (F1 = 타입을 내린다) | `HarnessRuntimeConfig` 가 adapters, 조립부가 그 옆 | `turn-setup.ts` → `adapters/harness-config.ts` | ✅ 타입 하강 + `prepared-config.ts` 삭제 |
| D-005 (배포 빈 factory 유지) | 선언된 확장점 보존 | `app/deployment/*` | ✅ 유지 — **단 AC8 과 충돌한다, §12 D2** |
| D-006 (두 술어 통합 금지) | `crossesProviderBoundary`·`runtimeEnvChangedSinceSpawn` 분리 유지 | `runtime-boundary.ts` | ✅ 둘 다 별도 함수로 생존 |
| D-007 (P3~P6 되돌리지 않음) | 대가형 비용 유지 | — | ✅ 해당 diff 없음 |
| D-008 (레시피 정본 = 가이드) | 소스는 불변식만 | 폐쇄망 배포자 | ✅ AC14·AC15 |
| D-009 (0188 D-017 → SUPERSEDED) | Ledger 정합 | `0188/plan.md` | ✅ 두 행 모두 확인 (아래) |

`0188/plan.md` 실측 — D-017 행 상태 칸 `SUPERSEDED` + 대체 칸에 승계 근거, D-042 행 대체 칸에
`D-017 을 대체 (0190 정리)`. **양방향 표기가 둘 다 있다.**

### end-to-end 흐름 (b 턴 경로 — 이번 변경의 주 무대)

```text
settings 해석 (HarnessSettingsService.resolve — 내부 blob 참조 안정)
  → HarnessRuntimeConfigService.resolve  (config 객체 cache)
  → adapters/harness-config.prepareHarnessConfig
       · withEnvBlockHoisted → WeakMap memoize
       · harnessEnvFingerprint  ← 계산 1회
       → PreparedHarnessConfig{providerSettings, env, runtimeEnvFingerprint, envFingerprint}
  → send.ts:293 / continuation.ts:91  이 TurnRequest.envFingerprint 를 채운다
  → SessionRuntime.recordSpawn  →  req.envFingerprint ?? 재계산
  → respawnInputs → runtime-boundary 술어 3종 → decideRespawn
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| memoize 가 판정 fast path 를 실제로 복원하는가 | **한다** | 술어는 **외피가 아니라 내부 blob** 을 본다(`spawned.settings === resolved.settings`, `runtime-boundary.ts:24`). `withoutEnvBlock` 이 내부 blob 을 키로 캐시하므로 `HarnessSettingsService.resolve` 가 cache hit 마다 **새 외피 객체**를 만들어도(`settings.ts` 실측) `next.settings` 는 같은 참조다. 두 층 캐시가 둘 다 필요하고 둘 다 맞다 |
| E1 이 spawn 기록 축을 망가뜨리는가 | **아니다 — 구현이 설계 결함을 잡았다** | plan §9 TO-BE 는 `runtimeEnvFingerprint`(해석 실패 시 `undefined`)를 실으라고 적혀 있었다. 그대로 했다면 `spawnedFingerprint === undefined` 가 되어 `runtimeEnvChangedSinceSpawn` 이 **영구 no-op** — 해석 실패 턴에 뜬 채널이 이후 어떤 env 변화에도 respawn 하지 않는다. `envFingerprint`(항상 정의)를 분리해 막았고 회귀 2건이 고정한다. **선조치 후 보고로 올바른 갈래** |
| false success 가능성 | **없음** | `env` 는 얕은 복사로 넘어가고 fingerprint 는 키 정렬 후 접으므로 두 값이 어긋날 수 없다. 회귀 `env 얕은 복사본의 fingerprint 가 원본과 같다` 가 이것을 단언 |
| 최적화가 재검증/취소/만료 관측을 잃었는가 | **아니다** | E1~E3 는 전부 *중복 계산* 제거다. E3 는 `describe()` 가 호출마다 `methods.map(methodDescriptor)` + `fields.map(f=>({...f}))` 로 **새로 할당**하므로(`runtime.ts:57,211` 실측) 재복사를 지워도 공유 상태 aliasing 이 생기지 않는다 |
| 증상만 지우고 상태가 남았는가 | **아니다** | R2 는 도출을 합칠 뿐 vault 쓰기 순서를 건드리지 않는다 |
| Product/UX 의 A 가 아닌 B 를 구현했는가 | **아니다** | 관측 표면 diff 0 |
| 출력/요청 worst-case 상한 | **증가 없음** | 전부 제거형. memoize 는 `WeakMap` 이라 상한이 원본 blob 수명에 묶인다 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 9fe21e8..HEAD
```

| 후보 | 판정 | 근거 |
|---|---|---|
| `adjustedSettingsCache`(외피 WeakMap)가 죽은 캐시인가 | **정상** | augmenter 재해석 턴에는 외피가 새로 오지만 정적/캐시 턴에는 `HarnessRuntimeConfigService` 가 **같은 config 객체**를 돌려주므로(`runtime-config.ts` `cached.config`) 외피 캐시도 실제로 hit 한다. 두 층 모두 세입자가 있다 |
| `createMemoryGrantPersistence` 테스트 전용 | **정상 + 주석 정정됨** | 구현자가 "영속 없이도 앱은 뜬다" 라는 **틀린 주석**을 실측으로 정정했다(실제 폴백은 `store-file.ts` 내부). 코드가 아니라 사실 기술이 문제였고 그것을 고쳤다 |
| 배포 factory·deps 타입 테스트 전용 | **정상** | D-005 가 보호하는 **선언된 배포 확장점**. 기본 빌드가 비어 있는 것이 설계 |
| `respawn-inputs.ts` 신규 — 프로덕션 배선 | **배선됨** | `runtime-entry.ts`(최초 턴)·`chat-turn-continuation.ts`(연속 턴) **양쪽**이 호출한다. 테스트 전용 아님 |
| 형제 정책 비대칭 (최초 턴 ↔ 연속 턴) | **해소됨** | 이 변경의 목적이 그것이다 — 7필드를 손으로 두 벌 적던 것을 한 함수로. 다음 축 추가 시 한쪽만 갱신되는 회귀가 구조적으로 막힌다 |
| `vaultKeysOf` producer↔consumer 파생 불일치 | **없음** | sweep("살아 있다")과 delete("지운다")가 **같은 함수**를 쓴다. 이 구간 최고 위험 항목이 실제로 닫혔다 |
| 동일 규칙 중복 (`AUTH_KINDS`) | **SSOT 로 수렴** | `ProviderAuthKindSchema` 하나. 값 5개 동일 확인(`api-key`·`password`·`pat`·`oauth`·`browser-session`) |
| `evaluateGate` 진리표 변화 | **동치** | 이전 `(alwaysRequired‖blocked)‖members>0`, 이후 `alwaysRequired‖blocked‖members>0`. 호출자는 `createGate` 1곳뿐(전수 `rg`)이고 `blocked` 의 `passed` 게이팅은 그대로 |

## 4. 기존 테스트 / semantic 검증 확인

- **structural proxy 만으로 통과시킨 AC: 없음.**
  - AC11 은 `@ts-expect-error` **6건**이고, `tsconfig.test.json` 이 `src/main/**` 를 포함하므로
    컴파일러가 강제한다. **미사용 `@ts-expect-error` 는 그 자체가 TS 오류**이므로 typecheck
    green 은 "그 호출들이 실제로 컴파일 실패한다" 를 뜻한다 — 구조적 사실이 아니라 능력 폐쇄의 증거다.
  - AC14 의 "```ts 0건" 은 proxy 지만 의미 목표(가이드에 대응 절 존재)를 §6 에서 따로 확인했다.
- AC1 의 `N회` 관측 주체: 지점 grep 이 아니라 **`prepareHarnessConfig` 안의 계산 1회 + sink 폴백**
  구조로 센다. 프로덕션 `harnessEnvFingerprint` 호출은 정의 1 + 호출 2(계산 1 · 폴백 1)뿐이고
  폴백은 `req.envFingerprint` 부재 시에만 실행된다 — 주입 경로에서는 도달하지 않는다.
- plan 이 인용한 기존 테스트 실제 존재: `connection-views.test.ts` **8건**, gate 스위트, `runtime.test.ts` 전건 green.

## 5. 요구사항 충족 매트릭스

**독립 재측정 결과. 구현자 자기보고를 증거로 쓰지 않았다.**

| # | 기준 | 결과 | 검증 증거 (이번 턴 재현) |
|---|---|---|---|
| AC1 | fingerprint spawn 당 1회 | ✅ | `rg harnessEnvFingerprint src/main` → 정의 1 + 프로덕션 호출 2(계산·폴백). 채우는 지점 `send.ts:293`·`continuation.ts:91` 실측 |
| AC2 | 전달값 == 재계산값 | ✅ | `session-runtime.ts:355` `req.envFingerprint ?? harnessEnvFingerprint(req.env)`. 회귀 `env 얕은 복사본의 fingerprint 가 원본과 같다` |
| AC3 | 같은 입력 = 같은 참조 + 술어 false | ✅ | `harness-config.test.ts` §`같은 입력이면 같은 참조를 돌려준다` 4건 (`Object.is`). 내부 blob 캐시가 술어 fast path 를 실제로 먹인다(§2) |
| AC4 | 실제로 바뀐 턴은 여전히 true | ✅ | `원본 blob 이 다르면 다른 참조를 준다` |
| AC5 | `ProviderInfo.auth` 필드 동치 + 원본 무오염 | ✅ | `describe()` 가 호출마다 신규 할당(`runtime.ts:57·211`) → aliasing 없음. `connection-views.test.ts` 8건 green |
| AC6 | vault 키 도출 한 함수 | ✅ | `vaultKeysOf` 정의 1 + **프로덕션 호출 4/4**(`store.ts:177` sweep · `store.ts:266` delete · `login.ts:517` kept · `login.ts:518` names) + `store-vault-keys.test.ts` 5건 |
| AC7 | 재사용 치환 후 동치 | ✅ | 해당 스위트 전건 green, typecheck 0 |
| AC8 | 프로덕션 호출자 0 심볼 제거 | ⚠️ **부분** | `mergeEnvLayers` `rg`=**0** · `prepared-config` `rg`=**0** (파일 삭제). **3건 잔존**: `credentialRevision`·`PluginBinding.server`·`harnessModelProviderKey`. 잔존 근거는 타당하나 **AC8 자체가 D-005 와 모순**이었다 — §12 D2 |
| AC9 | 단순화 후 관측 동작 불변 | ⚠️ **부분** | AC9 가 열거한 7건(S1·S3·S5·S6·S7·S9·S12) 중 **적용 3(S3·S9·S12) · 이월 4(S1·S5·S6·S7)**. 적용분은 동작 동치 확인(gate 진리표 §3, `login.reauth` 라우팅) |
| AC10 | `AuthStore` authId 축이 한 자료구조 | ❌ **미충족** | `store.ts` 실측 — `grants`(Map:97) · `verified`(Set:103) · `revisions`(Map:117) · `expirySettled`(Set:121) **4개 그대로**. S1 이월 |
| AC11 | 배포가 인증 lifecycle 에 도달 불가 | ✅ | `auth: AuthBinder` **4/4**(`connections:24`·`harness-runtime:48`·`usage-fetcher:23`·`plugins:68`) + `@ts-expect-error` **6건**, 컴파일러 강제(§4) |
| AC12 | 조립부가 adapters + boundaries 통과 | ✅ | `adapters/**` → `features/` import **0건** · `npm run lint` **0 error** |
| AC13 | 두 채널 우선순위 characterization | ✅ | `harness-config.test.ts` §`두 채널 결정표 — characterization (0190 AC13)` 3건 + §`env 우선순위` 4층 순서 단언 |
| AC14 | 레시피 정본 하나 | ✅ | `app/deployment/**` ` ```ts ` **0건**. 가이드에 대응 절 실재(§3-c augmenter `:511` · §5-b usage `:778`) |
| AC15 | 드리프트 3건 정정 | ✅ | 가이드 `secretFor` **0건** · augmenter 예제가 실제 export `createConfigApiAugmenters(deps: HarnessConfigApiDeps)` 와 일치 · usage 매퍼 `toSnapshot` 1가지 |
| AC16 | wire·UI 계약 불변 | ✅ | `ipc.ts`·`renderer`·`i18n` 변경 **0 파일** |
| AC17 | 게이트 green | ✅ | §9 |

**독립 채점: ✅ 14 · ⚠️ 2 · ❌ 1.**

> **구현자 자기보고 산술 오류(과소 보고)**: 보고는 `13/17` 인데 같은 표가 `AC1~AC7 · AC11~AC17`
> = **14건**을 ✅ 로 열거한다. 17 − (부분 2 + 미충족 1) = **14**. 0187 r1·0189 r1 은 과대
> 보고였고 이번은 반대 방향이다 — 어느 쪽이든 내역 합과 총계를 맞추지 않은 같은 형태다.

### plan §10 강제 지점 표 — AC 와 별개로 걷는다

| 계약 | plan 이 적은 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| fingerprint spawn 당 1회 | ①조립 ②spawn 기록 ③`turn-setup`계열 ④`continuation` (4) | ①`harness-config.ts` 계산 1회 ②`session-runtime.ts:355` 폴백 ③`send.ts:293` ④`continuation.ts:91` | **4/4** ✅ |
| 같은 입력 = 같은 참조 | ①memoize ②술어 (2) | ①`harness-config.test.ts` 4건 ②`runtime-boundary.ts:24` fast path 실경로 확인 | **2/2** ✅ |
| 배포는 lifecycle 도달 불가 | ①~④ deps 4종 ⑤부정 테스트 (5) | ①~④ `auth: AuthBinder` 4곳 ⑤`@ts-expect-error` 6건 | **5/5** ✅ |
| `adapters` ↛ `features` | `adapters/**` 전 파일 | import 0건 + lint 0 error | **통과** ✅ |
| Grant → vault 키 한 함수 | ①sweep ②`deleteVaultKeys` ③`discardKeys` kept ④ names (4) | 네 지점 모두 `vaultKeysOf` 호출 | **4/4** ✅ |
| 레시피 정본은 가이드 | ①~⑤ 배포 5파일 ⑥가이드 절 (6) | 5파일 ```ts 0건 + 가이드 §3-c·§5-b 실재 | **6/6** ✅ |
| wire 불변 | ①`ipc.ts` ②renderer ③동치 단언 (3) | 0 파일 · 0 파일 · 8건 green | **3/3** ✅ |

- **표에 없는데 같은 불변식이 필요한 지점**: 없음. 특히 `vaultKeysOf` 는 `rg` 전수로 5번째
  도출 지점이 남아 있지 않음을 확인했다.
- **강제 지점 전수 25/25 — 이 축은 완전하다.** 미충족 3건은 전부 *제거·통합 범위* 쪽이고
  불변식 강제 쪽이 아니다.

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `app/deployment/*` deps (배포 구현 포트) | 가이드 §1.1 표가 `AuthBinder` 로 갱신됨 | 가이드 예제가 전부 `deps.auth.bind(...)` 로 시작 → `bind` 하나로 레시피 성립 | ✅ |
| `docs/arch/backend/auth.md` 구조 서술 | `AuthBinder` = `Pick<AuthRuntime,'bind'>` 명시 | lifecycle 소유자(IPC 핸들러·부팅 복원) 명시 | ✅ |

> **plan 의 AC14 전제 1건이 사실과 달랐다(무해).** plan §7 주의사항은 "`usage-fetcher` 예제는
> **가이드에 없던 것**이라 삭제가 아니라 이동이어야 한다" 고 적었다. 실측하면 가이드 `:778`
> 에 0186 부터 `createUsageFetcher` 레시피가 **이미 있었고** 소스 쪽이 드리프트한 사본이었다
> (그래서 plan §8 이 `mapCorpUsageSnapshot`↔`toSnapshot` 을 드리프트로 셌다 — 두 서술이 서로
> 모순이었다). 소스 사본 삭제가 옳고 가이드 쪽이 더 풍부하다. **결과는 맞고 전제가 틀렸다.**

## 7. 숫자 / 음성 기준 / 상한 재측정

- `vaultKeysOf` 호출 **4** — 재측정 일치.
- `auth: AuthBinder` **4** — 재측정 일치.
- `@ts-expect-error` **6** — 재측정 일치.
- `mergeEnvLayers` / `prepared-config` `rg` **0 / 0** — 재측정 일치.
- 가이드 `secretFor` **0** — 재측정 일치.
- 테스트 **157 파일 / 1,563 케이스** — 재측정 일치(§9).
- **내역 합 ≠ 총계 1건**: AC 자기보고 13 vs 실제 14 (§5).
- 0건 게이트가 정당한 예외를 지웠는가: **아니다.** AC14 의 "```ts 0건" 이 지운 것은 전부
  가이드에 대응 절이 있는 사본이고, plan §17 이 남기라고 지정한 불변식 4종(secret 분리 ·
  매핑 소유·fail-closed · 조용한 미인증 금지 · 닫힌 closure)은 `harness-runtime.ts` 주석에
  **명시적으로 보존**됐다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| respawn 판정 조립 | `respawnInputs` 가 electron 비의존 순수 함수 + 구조적 `SpawnRecord` 라 전부 단위 검증 가능 | 없음 | — |
| spawn 입력 조립·fingerprint | `adapters/harness-config` 가 `node:crypto` 만 물어 vitest 로 전부 열림 | 없음 | — |
| 배포 능력 경계 | 컴파일러가 강제 | 없음 | — |
| Electron 부팅 · 실제 로그인 왕복 | DB·electron 로드 5스위트는 이 환경에서 불가 | **남는다** | 네트워크 개방 환경/CI(windows-latest)에서 `npm run dev` → 로그인 → 연결 탭 확인 |

“UI/electron 이라서” 로 넘긴 순수 로직은 **없다**.

## 9. 게이트 재실행

`app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` 를 정본으로 따랐다.
`npm test` 는 **쓰지 않았다**(DB 동작 검증이 필요한 변경이 아니고 ABI 를 뒤집는다).

```bash
cd app && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci      # 이 컨테이너는 fresh clone — node_modules 부재
npm run typecheck
npm run lint
./node_modules/.bin/vitest run src/main src/shared
node scripts/check-doc-inventory.mjs --check
```

**관측한 실행 산출 (exit code 아님):**

| 명령 | 관측 |
|---|---|
| `typecheck` | node·web·test **3분할 전부 error 0** |
| `lint` | **0 error · 1 warning** — `useTranscriptVirtualizer.ts:22` `react-hooks/incompatible-library`. renderer 파일이고 이번 diff 는 renderer 를 **0 파일** 건드렸다 → 기존 베이스라인 |
| `vitest run src/main src/shared` | **157 파일 중 152 통과 · 1,563 케이스 중 1,521 통과** |
| `check-doc-inventory --check` | counts ok(9 items · 76 channels) · prose ok · links ok |

- **환경 기인 실패 분리 — 추정이 아니라 집합으로 증명했다.** red 5파일 / 42케이스를 그대로
  두지 않고 `app/AGENTS.md` 가 실측으로 열거한 5파일만 지정해 재실행했더니
  **`Test Files 5 failed (5)` · `Tests 42 failed | 1 passed (43)`** — 전체 실행의 실패 수와
  **정확히 일치**한다. 즉 실패 집합 = 문서화된 ABI 베이스라인 집합이고 그 밖의 red 는 0이다.
  서명도 일치: `Module did not self-register: better_sqlite3.node` ·
  `Electron failed to install correctly`.
- **게이트가 작업 트리를 바꿨는가**: **아니다.** `lint` 는 `--fix` 라 파일을 쓰므로
  (`app/AGENTS.md` 경고) 실행 전후 `git status --porcelain` 을 비교했고 **실행 후 트리가 비어
  있다** — autofix 산출물이 0이고, 검증자가 고친 코드를 검증자가 채점하는 일이 없다.
- **검증 중 실행한 명령의 잔여물**: `npm ci` 가 만든 `app/node_modules` (gitignore 대상,
  추적 파일 0). 그 외 없음.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 완료 |
| AC ↔ production path 1:1 | 에이전트 대조 완료 (§5) |
| 레이어/계약/문서 링크 | 기계 검증 완료 (boundaries · doc-inventory links) |
| AGENTS 위생 | 해당 없음 — 이번 diff 는 `AGENTS.md` 를 건드리지 않았다 |
| **AC10/AC8/AC9 이월을 수용할 것인가** | **사람 결정** — §13 D1 |
| UI 시각 품질 · Electron 실기 | 사람/CI |

## 11. Repository operation checks

### INDEX 보드 정합성

- 단계 `impl` · 상태 `IMPL_DONE` · 다음 주체 `Claude(검증)` — 검증 착수 시점 상태와 일치. ✅
- 대상 커밋 `9fe21e8`·`0283dc4`·`6b63b49`·`ddebfcf`·`8bbd595` — **git log 와 전부 일치.** ✅
- PASS archive 이동: FAIL 이므로 해당 없음.

### Commit / reference 정합성

- trailer 허용값: `Agent: claude` · `Handoff: docs/handoff/0190-.../` ·
  `Status: implemented|partial` · `Criteria-Met`/`Criteria-Pending` · `Verified-By: pending`
  — root `AGENTS.md` 표와 일치하고 trailer 블록 내부 빈 줄 없음. ✅
- 삭제한 `features/harnesses/prepared-config.ts` 의 살아 있는 소비처: **0건** (`rg` 전수). ✅
- **❗ 죽은 커밋 참조 1건**: `plan.md:496`·`:529` 가 `55cdbfe`(3군 단순화)를 가리키는데
  `git cat-file -t 55cdbfe` → `Not a valid object name`. 실제 해시는 **`8bbd595`** 다
  (구현 보고를 그 커밋에 넣으며 amend 된 자기 참조). INDEX 는 옳고 plan 만 낡았다. §13 D3.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| AC1 설계 정정 — `envFingerprint` 신규 필드 분리 | **타당, 그리고 실제 회귀를 막았다.** 구현 세부 갈래(선조치 후 보고)가 맞다. plan §9 TO-BE 가 두 축을 뭉갠 것이 원인 | 수용 |
| R6 미적용(`import/no-cycle` 근거) + 틀린 주석 정정 | **타당.** 순환 근거를 실측으로 확인. 8줄 클로저를 접으려 새 모듈을 만들지 않은 판단도 0188 제안서와 정합 | 수용 |
| `LoginService.reauth` 제거 — `runtime.reauth` 5건이 계약 커버 | **타당.** `AuthRuntime.reauth` → `begin` 라우팅 확인 | 수용 |
| AC8 3건 보류 | **결론 타당, 그러나 AC 쪽 결함이다** — §13 D2 | 파생 이슈 |
| AC9·AC10 이월(위험 배분) | **엔지니어링 판단은 합리적.** 다만 AC 를 못 지킨 것은 사실이고 범위 축소는 결정권자 몫이다 — 구현자가 AC 를 고치지 않고 **보고만** 한 것은 규칙대로다 | **파생 이슈 · 사람 결정** |

## 13. 파생 이슈

- [ ] **D1 — AC10 미충족 (+ AC9 4/7 이월). 사람 결정 필요.**
  `AuthStore` 의 authId 축 4 컬렉션이 그대로다. 이월 근거("0188 이 10라운드로 원자성·만료를
  고친 자리라 같은 커밋에 구조 변경을 얹으면 회귀 원인이 갈리지 않는다")는 **합리적이고
  코드 근거도 맞다**. 그러나 범위를 줄이는 것은 설계자/사용자 결정이다. 두 갈래:
  ⓐ 이월 수용 → AC9·AC10 을 후속 handoff(`0191`)로 옮기고 0190 은 나머지로 종료,
  ⓑ 이번 라운드에서 S1·S5~S7 구현.
  **해결안으로 위장하지 않는다 — 어느 쪽인지 사용자가 정한다.**
- [ ] **D2 — AC8 이 ACTIVE Decision D-005 와 모순이었다 (plan 결함).**
  AC8 은 `PluginBinding.server`·`harnessModelProviderKey` 제거를 요구하는데, D-005 는 "문서화된
  배포 확장점은 지우지 않는다" 를 못 박는다. 구현자는 Decision 을 우선해 보류했고 **그 우선순위가
  옳다**(Decision > AC). 남은 `credentialRevision` 은 성격이 또 달라 — 배포 확장점이 아니라
  **테스트 27건의 유일한 관측 창**이다. AC8 은 성격이 다른 셋을 한 줄에 묶었다.
  → AC8 을 세 갈래로 갈라 재작성하거나, D-005 적용 범위를 AC8 에 명시한다.
- [ ] **D3 — `plan.md:496`·`:529` 의 `55cdbfe` 가 존재하지 않는 커밋.** 실제 `8bbd595`.
  구현 보고의 "대상 커밋" 은 다음 라운드가 기준선을 잡는 좌표라 죽은 참조를 남기지 않는다.
- [ ] **D4 — 자기보고 산술: `13/17` → `14/17`.** 같은 표가 열거한 ✅ 는 14건이다(§5).
  과소 보고라 무해하지만 내역 합과 총계를 맞추지 않은 형태는 0187 r1·0189 r1 과 같다.

## 14. Review Signals — 사실만

- **이전 라운드와 동일/유사 증상**: 자기보고 `Criteria-Met` 과 실제 채점의 불일치가
  0187 r1(과대) · 0189 r1(과대) · 0190 r1(**과소**) 세 라운드 연속으로 관측된다.
  `handoff-impl` 이 r5 에서 "관측값을 함께 적어라" 를 신설했고 **개별 행의 관측값은 이번에
  실제로 다 붙었다**(강제 지점 25/25 를 검증자가 재측정해 전부 일치). 어긋난 것은 행이
  아니라 **행의 합계**다.
- **관련 plan 지침/AC 존재**: `handoff-verify` §7 이 "내역 합 = 총계인지 본다" 를 갖는다.
  검증자 쪽에는 있고 구현자 쪽 자기보고 절차에는 합계 검산 항목이 없다.
- **plan 자체의 결함이 이번 라운드 미충족의 일부를 만들었다**: AC8 ↔ D-005 모순(D2),
  AC1 의 두 축 혼동(구현자가 잡음), AC14 주의사항의 사실 오류(§6). 세 건 모두 READY
  self-review 체크리스트가 `[x]` 로 통과한 항목 아래에서 났다.
- **사용자 결정 변경 근거**: 없음. 이번 라운드에 Decision 변경 없음.
- **반복된 검증 환경 한계**: better-sqlite3 / electron 바이너리 부재로 5스위트 상시 red.
  이번에는 `npm ci` 가 성공해 나머지 152 파일을 실제로 돌렸고, 실패 집합이 문서화된
  베이스라인과 **집합으로 일치**함을 재실행으로 증명했다.

## 15. 결론

- **상태: FAIL (라운드 1)**
- **Product/UX 및 ACTIVE Decision: 충족.** 사용자 관측 변화 0(wire·renderer·i18n 0 파일),
  D-001~D-009 전부 보존. **제품 위험은 이 라운드에 없다.**
- **AC: ✅ 14 · ⚠️ 2 · ❌ 1.** FAIL 사유는 **AC10 미충족과 AC9 의 4/7 이월** 하나뿐이며,
  성격은 *결함*이 아니라 **범위 미완**이다.
- **강제 지점: 25/25 전부 닫힘.** 불변식 축은 완전하다 — 특히 Grant→vault 키 4지점 통합
  (이 구간 최고 위험 항목)과 배포 능력 폐쇄가 컴파일러/테스트로 실제 강제된다.
- **기준 밖 중대 결함: 없음.** 역방향 탐색에서 미배선·테스트 전용 신규 심볼·형제 비대칭·
  SSOT drift 전부 음성. E1 의 설계 결함은 구현자가 선조치로 막았다.
- **repository operation: 죽은 커밋 참조 1건(D3).** INDEX·trailer·링크는 정합.
- **남은 사람 확인**: ⓐ **D1 의 이월 수용 여부(범위 결정)** ⓑ Electron 실기(CI/사람).
- **다음 단계**: 사용자가 D1 을 정한 뒤 — ⓐ 면 AC9·AC10 을 후속 handoff 로 이관하고 0190 종료,
  ⓑ 면 재구현 라운드 2. D2~D4 는 어느 쪽이든 정리한다.
