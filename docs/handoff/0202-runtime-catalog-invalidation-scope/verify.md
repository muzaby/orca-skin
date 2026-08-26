# Verify — runtime-catalog-invalidation-scope

## 메타

| 항목 | 값 |
|---|---|
| slug | `0202-runtime-catalog-invalidation-scope` |
| 검증자 | Claude Code |
| 일자 | 2026-08-26 |
| 대상 커밋/range | `70d65c1..72255c9` |
| 구현 전 plan 기준 | `70d65c1` (설계 2턴 = `de8d15b` → `70d65c1`) |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니다 — 설계 = Claude, 구현 = Codex(`Agent: codex`), 검증 = Claude |

## 0. 기준선 / plan 변경 확인

- **기준선이 diff로 성립한다.** 설계 커밋 `70d65c1`과 구현 커밋 `72255c9`가 갈려 있고, 구현 커밋의 `plan.md` diff는 `[구현자 기입]` 6절(+62/-52줄)뿐이다.
- Decision Ledger 변경: **없음** — `git diff 70d65c1..72255c9 -- plan.md`의 hunk 시작이 `@@ -468,68` 하나이고 §3은 468줄 위다.
- Product/UX Contract 변경: **없음** — Part I(§1~§7) 무변경.
- AC 변경: **없음** — AC1~AC15 원문 그대로. 채점은 이 원문으로 한다.
- 0198 D-008의 부분 SUPERSEDED 표기는 **설계 커밋**(`de8d15b`)에 있다 — 규범 정정이 구현과 섞이지 않았다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 폭 축소 | 편집 key 하나만 무효화 | `engine.ts:46-49`가 canonical 반환 → `:56`·`:68`·`:76` 3채널 → `:38`·`:39` 2 sink |
| D-002 drop+replay 결합 | 호출자가 replay를 잊을 자리가 없다 | `runtime-catalog.ts:158-164` — `invalidate`가 `reconcile(authId, snapshotOf(authId))`를 await |
| D-003 열거 캐시 전체 유지 | add/delete가 목록에 반영 | `engine.ts:37`·`bootstrap.ts:627` 둘 다 `invalidateAll()` 유지 |
| D-004 fetch 횟수 확장 | 명시 invalidate당 1회 | `invalidate` 1회 → contribution당 `resolve` 1회(§7 재측정) |
| D-005 읽기 경로 network 0 | 턴은 cache만 | `turn-setup.ts:89` `cached(selected.key)` 불변 |
| D-006 빈 cache 미노출 | 실패는 행 소멸로 수렴 | `models.ts:105` 필터 + AC6·AC7 테스트 |
| D-008 remaining verified → 재조정 | gate가 아니어도 부팅에서 붙는다 | `auth-resume.ts:213-218` → `bootstrap.ts:407-409` → `bridge.onSnapshot` → `catalog.reconcile` |

### end-to-end 흐름 — 두 축 모두 도달한다

```text
[편집 축]  엔진&모델 저장 → orca:engine:{add,update,delete}
  → assertMutable(canonical) → {add,update,delete}HarnessSettings
  → refreshHarnessSettings(ctx, canonical) → deploy → invalidateAll
  → harnessRuntime.invalidate(canonical) → await catalog.invalidate(canonical)
  → targets 0 → entries 불변 → misc.ts:43 merge → 플러그인 행 유지 ✅

[부팅 축]  Bootstrap.start → deployExtensions
  → startRuntimeModelCatalogAfterDeploy(await invalidate → await attach → resumeAuth)
  → authResume.run() → gate resume(true) → AuthChange → bootstrap.ts:647 ✅ (불변)
  → startRemaining() → resume(false) ×P → probeTargets 재조회
  → verified && valid 만 reconcileVerified(id) → bootstrap.ts:408
  → bridge.onSnapshot → reconcile → resolve → entries → onChange ✅ (신설)
```

- 실패분은 `login.ts:354`가 내는 즉시 `expired` 한 경로로만 간다 — D-008 통지는 성공분만 담는다(AC14 테스트로 잠김).
- 회복 축(`recoverExpired`)도 이미 도달한다 — `refresh`/`relogin` 성공이 `store.put()`(`store.ts:252` `verified = true`) → `credential-committed` → `bootstrap.ts:647`. §10 표 밖의 세 번째 구멍은 없다.

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 설계대로 | replay의 `resolve` reject는 `runtime-catalog.ts:129-131` catch가 `drop`으로 접고 `invalidate`는 reject하지 않는다 |
| false success 가능성 | 없음 | `invalidate`가 replay Promise를 await하고, 세대 fence(`:114`·`:130`)가 낡은 결과의 publish를 막는다 |
| partial failure/rollback | 잔여 없음 | 메모리 캐시만 만진다. 실패는 "행 없음"으로 수렴(D-006) |
| Product/UX의 A가 아닌 B를 구현했는가 | 아니다 | D-001·D-002·D-008 모두 §9 TO-BE 블록과 1:1 |
| 증상만 제거하고 상태가 남았는가 | 아니다 | `drop`이 `resolvedRevision`까지 지우고 replay가 같은 자리에서 다시 채운다 |
| 캐시 축소가 잃은 관측 | 있으나 대체됨 | CRUD의 전체 `harnessRuntime.invalidate`가 사라졌지만 `sourceRevision`(경로+mtime, `settings.ts:93`)이 key별로 miss를 만든다 — AC3 |
| 요청 worst-case 상한 | 늘지 않는다 | §7 재계산 |
| 재진입/경합 | 차단됨 | 연속 invalidate는 세대를 올려 이전 slot에 합류하지 않는다(`:102-110`) |
| `snapshotOf` 부작용 | 무해 | `bind().snapshot()`은 lazy-expiry(`runtime.ts:117-126`)라 `expired` change를 낼 수 있으나, 그 재진입 reconcile도 drop으로 수렴한다 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 70d65c1..72255c9
```

| 후보 | 판정 | 근거 |
|---|---|---|
| `ResumeAuthDeps`·`AuthResumeHandle` 미사용 export | **정상** | 정의 파일 내부 시그니처용 타입. `bootstrap.ts:402`가 구조적으로 만족 |
| `gateOpen` test-only | **오탐** | `auth-resume.ts:239`·`:246`이 같은 파일 안에서 부른다 |
| `affectedRuntimeModelAuthIds` test-only | **오탐** | `runtime-model-startup.ts:32`가 같은 파일 안에서 부른다 |
| `invalidateRuntimeModelsForAuth` test-only | **오탐** | `runtime-model-startup.ts:49`(`createRuntimeModelAuthInvalidator`) → `bootstrap.ts:470` |
| 형제 정책 비대칭 | **0건** | 스크립트 (없음) |
| 신규 등록값의 기존 소비처 | **회귀 없음** | `snapshotOf`·`reconcileVerified` 두 필수 필드가 늘었고 소비처 전수(`bootstrap.ts:481`·`:407`, 테스트 fake 전부)가 typecheck로 닫혔다 |
| producer ↔ consumer 파생 불일치 | **없음** | 두 소비처(`misc.ts:43`·`turn-setup.ts:54`)가 같은 `merge`를 지난다 — 다만 AC11이 그 사실을 단언하지 않는다(§13 D3) |
| 동일 규칙 중복 구현 | **SSOT 유지** | `canonicalProviderKey`(adapter 인지) ↔ `canonicalAgentKey`(trim+lower). `${adapter}-${provider}` 입력에 대해 같은 결과 — `settings-entries.ts:85`의 `providerKeyOf`가 provider를 이미 lowercase로 만들어 두 축이 갈리지 않는다 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 실재: `runtime-catalog.test.ts:207`(현 `:220`으로 의미 갱신됨)·`engine.runtime-catalog.test.ts:30`·`auth-resume.test.ts:346`(현 `:393` `P + 1` describe 3케이스) 전부 실재하고 green.
- 로컬 재구현 없음: 테스트가 `createRuntimeModelCatalog`·`createHarnessRuntimeConfigService`·`registerEngineHandlers`·`createAuthResume` **production 심볼**을 직접 부른다. 같은 이름의 로컬 사본은 0건.
- structural proxy만으로 통과한 AC: **없음** — AC4(인자 단언)는 AC1(행 존속, 실제 카탈로그 인스턴스)과 짝으로 있다.
- 동작 보존 추출 라운드인가: **아니오** — 동작이 바뀌는 라운드라 hunk 되돌림이 판정 근거가 된다.

### 이번 라운드 잠금 재측정 — 분모는 고친 hunk (r1이라 인용 변이 없음)

| # | 심은 변이(hunk 되돌림) | 검출 | 실패한 장치 |
|---|---|---|---|
| M-A | `engine.ts:38` `invalidate(key)` → `invalidate(undefined)` | ✅ | `engine.runtime-catalog.test.ts` **6케이스** |
| M-B | `engine.ts:39` `invalidate(key)` → `invalidate()` | ✅ | 같은 파일 **3케이스** |
| M-C | `assertMutable`이 canonical 대신 raw key 반환 | ✅ | 같은 파일 **2케이스**(add 채널은 미검출 — `providerKeyOf`가 이미 lowercase) |
| M-D | `runtime-model-startup.ts:83` `await` 제거 | ✅ | `runtime-model-startup.test.ts` **1케이스** |
| M-E | `invalidate`의 replay 2줄 제거 | ✅ | `runtime-catalog.test.ts` **4케이스** (typecheck·lint는 초록 — red가 잔여물이 아니다) |
| M-F | `inFlight` 합류가 generation 무시 | ✅ | `runtime-catalog.test.ts` **1케이스** |
| **M-G** | **`finally`의 slot 동일성 가드 → 무조건 delete** | **❌ 미검출** | **전체 스위트 2303/2303 green · typecheck 0 · eslint 0** |
| M-H | `auth-resume.ts:213-218` 통지 루프 제거 | ✅ | `auth-resume.test.ts` **1케이스** |
| M-I | `bootstrap.ts:407-409` 배선 **삭제** | ✅ | `typecheck:node` TS2345 — `reconcileVerified` 필수 필드 누락 |
| M-J | `bootstrap.ts:407-409` 배선 → **무동작 람다** | **❌ 미검출** | 전체 스위트 2303/2303 green · typecheck 0 |
| M-K | `bootstrap.ts:481` `snapshotOf` **삭제** | ✅ | `typecheck:node` TS2345 |
| M-M | 통지 루프의 `verified && valid` 필터 제거 | ✅ | `auth-resume.test.ts` **1케이스** |
| M-N | 성공 경로 세대 fence 제거(이 라운드가 옛 테스트를 대체한 자리) | ✅ | `runtime-catalog.test.ts` **2케이스** — 커버리지 회귀 없음 |

- **M-G 미검출은 §13 D1이다.** 되돌린 것이 이 라운드가 고친 hunk이고, 전체 스위트·정적 검사 어느 것도 반응하지 않는다.
- **M-G가 실제 결함을 만드는 것을 확인했다.** 임시 케이스(검증 후 삭제)로 재현 — invalidate 중 in-flight가 있는 상태에서 같은 세대 reconcile이 들어오면 가드 없이는 `resolve`가 **2회 기대에 3회**(`AssertionError: expected "vi.fn()" to be called 2 times, but got 3 times`)다. 즉 가드는 invalidate 직후 구간의 single-flight 합류(`coalesces concurrent verified events into one fetch`, `:101`)를 지키는데 그 구간을 보는 케이스가 없다.
- M-J 미검출은 **규칙 위반은 아니다**(hunk 삭제는 M-I가 typecheck로 잡는다). 다만 §10 7행이 "bootstrap 배선"을 강제 지점으로 세는데 그 지점은 *부재*만 닫혀 있고 *무동작*은 열려 있다 — §13 D2.
- `N회` 기준의 실제 관측 주체: `resolve` sink 호출 수(`runtime-catalog.test.ts:220`·`:259`), `pushConnectionState` fake 호출 수(`auth-resume.test.ts:393` describe).
- 순서 기준의 관측 훅: `startRuntimeModelCatalogAfterDeploy`의 5개 주입 인자(`runtime-model-startup.test.ts:12`) + await 정착(`:45`).

## 5. 요구사항 충족 매트릭스

| # | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | 다른 key CRUD 뒤에도 contribution 행이 남는다(3채널) | ✅ | `engine.runtime-catalog.test.ts` `preserves a different runtime contribution after %s` ×3 — 실제 카탈로그 `list()` = `['claude-corp']`. M-A가 red | `orca:engine:*` → `refreshHarnessSettings` → `agent:list` |
| AC2 | 같은 CRUD 뒤 turn 후보 해석이 살아 있다 | ✅ | 같은 케이스의 `runtime.cached('claude-corp')`가 정의됨(실제 `createHarnessRuntimeConfigService`) | `turn-setup.ts:89` |
| AC3 | 편집한 provider 자신은 재해석된다 | ✅ | `runtime-config.test.ts:126` `settings 파일 외부 편집(mtime 변화)이 cache miss 로 이어진다`. 더해 `harnessRuntime.invalidate(canonical)`가 실제로 그 key state를 지운다 — `states`는 `entry.key`(=`providerKeyOf`, lowercase) 키라 canonical과 일치 | 다음 턴의 `resolve` |
| AC4 | 무효화 폭이 편집 key를 넘지 않는다 | ✅ | `invalidates only the canonical edited key after %s` ×3 — 두 sink 모두 `'claude-corp'` 인자 단언. 입력이 `' CLAUDE-Corp '`라 정규화도 함께 잠근다 | 위와 같음 |
| AC5 | `invalidate(key)`가 같은 호출 안에서 재조정한다 | ✅ | `replays a valid snapshot inside the same invalidation` — `resolve` 2회·`list()` 1개·`onChange` 3회. M-E가 red | `engine.ts:39`·`runtime-model-startup.ts:83` |
| AC6 | snapshot invalid면 replay가 되살리지 않는다 | ✅ | `keeps invalidated entries absent when the current snapshot is unusable` — `resolve` 1회 유지·`list()` `[]` | 로그아웃·만료 뒤 CRUD |
| AC7 | replay의 fetch 실패가 호출자에게 던져지지 않는다 | ✅ | `contains replay fetch failures...` — `resolves.toBeUndefined()` + `list()` `[]` | CRUD 중 네트워크 실패 |
| AC8 | 인자 없는 `invalidate()`도 replay한다 | ✅ | `replays every contribution during a full invalidation` — 2 owner·`resolve` 4회·행 2개 | `runtime-model-startup.ts:83` |
| AC9 | 부팅 5단계가 전부 await된 채 순서 유지 | ✅ | `runtime-model-startup.test.ts:12` 순서 배열 + `:45` await 정착. M-D가 red | `bootstrap.ts:626` |
| AC10 | `invalidate` 1회당 contribution별 `resolve` 최대 1회 | ✅ | AC5(2회 = 초기1+replay1)·AC8(4회 = 초기2+replay2) 두 케이스가 상한을 센다 | 위 두 호출자 |
| AC11 | 두 읽기 소비처가 같은 key 집합을 본다 | **⚠️** | **AC가 적은 검증 수단이 없다** — `rg "\.merge\(" src/main --glob '*.test.ts'` = **1건**(`runtime-catalog.test.ts:37`, 무필터/필터 비교 아님). 두 소비처는 각각 다른 인스턴스로만 확인되고 CRUD 뒤 상태는 어느 쪽도 단언하지 않는다 | `misc.ts:43`·`turn-setup.ts:54` |
| AC12 | remaining probe의 verified가 부팅 안에서 재조정에 도달 | ✅ | `remaining probe 성공분만 별도 재조정하고 실패분은 제외한다` — sink가 `'healthy'`로 1회. M-H가 red. **단 production 경로는 `createAuthResume` seam까지만 잠긴다**(M-J) | `authResume.run()` → bridge |
| AC13 | 복원 절차 자기 방송은 `P + 1` 불변 | ✅ | `P + 1` describe 3케이스(`:393`·`:411`·`:427`)가 수정 없이 green. 통지 sink는 `pushConnectionState`를 부르지 않는다 | `auth.md §5.2` |
| AC14 | probe 실패분은 통지에 담기지 않는다 | ✅ | 같은 케이스가 `toHaveBeenCalledOnce()` + `'healthy'`만. M-M이 red | `login.ts:354` |
| AC15 | gate 축 불변·중복 통지 없음 | ✅ | `gate 성공은 AuthChange 경로만 쓰고 remaining 재조정과 중복하지 않는다` — sink 0회 | `auth-resume.ts:239` → `bootstrap.ts:647` |

- **합계 재측정**: `✅ 14 · ⚠️ 1 · ❌ 0 = 총 15`. 분모는 §7 표의 AC 행을 직접 세었다(AC1~AC15).
- **합계 사본 대조**: 구현자 본문 `15/15` ↔ 커밋 trailer `Criteria-Met: 15/15` ↔ INDEX 비고 `15/15` — **세 사본 일치**. 검증 결과와는 AC11 한 칸에서 갈린다(자기보고 ✅ ↔ 재측정 ⚠️).

### plan §10 강제 지점 표 — AC와 별개로 걸었다

| 계약/필드 | plan이 적은 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| 무효화 폭 = canonical key | 5 | `engine.ts:56`·`:68`·`:76`(3채널) + `:38`·`:39`(2 sink) | **5/5** ✅ |
| drop과 replay는 한 동작 | 3 | `runtime-catalog.ts:158` 본체 + `engine.ts:39` + `runtime-model-startup.ts:83` | **3/3** ✅ |
| 열거 캐시 전체 무효화 유지 | 2 | `engine.ts:37`·`bootstrap.ts:627` (`rg "invalidateAll\(\)"` 5건 중 정의·주석 3 제외) | **2/2** ✅ |
| read-only 실행은 cache만 | 1 | `turn-setup.ts:89` `cached(selected.key)` | **1/1** ✅ |
| 무효화된 key는 두 UI에서 미노출 | 3 | `models.ts:105` 필터 + `misc.ts:43` + `turn-setup.ts:54` | **3/3** ✅ |
| 부팅 순서 | 2 | helper 본체 `runtime-model-startup.ts:81-85` + `bootstrap.ts:626` | **2/2** ✅ |
| `verified` 전이 → 카탈로그 재조정 | 6 | `rg "markVerified\|emitVerifiedChange" src/main --glob '!*.test.ts'` **9건** = 주석 2 + 시그니처 2 + store 정의 1 + 코드 4(`login.ts:345`·`:355`·`auth-resume.ts:210`·`:239`), 신설 2(`auth-resume.ts:213-218`·`bootstrap.ts:407-409`) | **6/6** ✅ (신설 1건은 *무동작*이 열려 있다 — D2) |

- 합계 재측정: `5+3+2+1+3+2+6 = 22` — plan 합계·구현자 보고 `22/22`와 일치.
- 표에 없는데 같은 불변식이 필요한 지점: **없음**. 불변식의 주어(`verified` 전이)로 훑으면 회복 축(`refresh`/`relogin`)이 남는데, 그쪽은 `store.put()`이 `verified`를 올리고 `credential-committed`가 `bootstrap.ts:647`에 이미 도달한다 — 표 밖 구멍이 아니다.
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: **없음** — 재측정 대상 0.
- 구현자가 §10 밖에서 선조치했다고 보고한 1곳(`inFlight` generation slot)은 실재하고 옳다. 다만 그 hunk의 절반이 잠기지 않았다(D1).

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| `RUNTIME_MODEL_CONTRIBUTIONS` (`app/deployment/harness-runtime.ts`) | 타입 불변 — `RuntimeModelContribution` 필드 무변경, `typecheck:node` green | 배포가 관측하는 의미 2건 변화(CRUD가 안 지운다 · gate가 아니어도 붙는다). 배포 코드 변경 요구 0 | ✅ |
| `docs/guides/closed-network-extensions.md` | 갱신 불요 | 두 변화 모두 배포가 *작성*하는 표면이 아니라 *관측*하는 결과 | ✅ |
| `docs/arch/backend/auth.md §5.2` | 순서 블록에 1줄 추가(`:398`) | 방송 상한 `P + 1` 문장 무변경 — `git show`로 확인 | ✅ 구현 커밋과 함께 갔다 |

## 7. 숫자 / 음성 기준 / 상한 재측정

- `catalog.invalidate` production 호출: **2** (`engine.ts:39`·`runtime-model-startup.ts:83`) — plan과 일치.
- `harnessRuntime.invalidate` production 호출: **3** (`engine.ts:38`·`bootstrap.ts:472`·`:628`) — 일치.
- `cached(` 소비처: **1** (`turn-setup.ts:89`) — 일치.
- `merge(`/`isReadOnly(` 소비처: **5행** = 인터페이스 선언 1 + `misc.ts:43` + `turn-setup.ts:54`·`:88` + `engine.ts:46`. plan의 "4"는 선언을 뺀 수로 같은 집합이다.
- **plan §8의 "`runtime.resolve(` production 호출 1건"은 좁은 술어다** — `harnessRuntime.resolve`를 부르는 `turn-setup.ts:90`이 정규식(`runtime\.resolve\(`)에 안 걸린다. 카탈로그 replay 상한(AC10)의 분모는 여전히 `runtime-catalog.ts:113` 하나라 판정은 바뀌지 않는다.
- 내역 합 = 총계: §10 22 ✅ · AC 15 ✅ (§5).
- 요청 상한: replay 1회당 `|영향받은 contribution|`회. CRUD 축 targets = 0(=`assertMutable`이 contribution key를 먼저 던진다)이라 **실사용 요청 수는 늘지 않는다**.
- 부팅 fetch 상한: `|probe 성공 remaining authId|` × `|그 authId 소유 contribution|`, `resolvedRevision` 조기 반환이 authId당 1회로 묶는다. 현재 값 0 → 증가가 곧 수정이다.
- 부팅 방송: 복원 절차 자기 push는 `P + 1` 불변(AC13 3케이스). **행이 실제로 바뀌면 `onChange` → `pushConnectionState`가 remaining 축에도 붙는다** — plan §14의 "증가 0"은 *복원 절차가 스스로 내는* 수를 말하고, 이 항은 `auth.md §5.2`가 "부팅 방송 총량은 상수가 아니다"로 열어 둔 자리다. 결함 아님.
- 0건 게이트의 정당한 예외: 해당 없음 — 이번 라운드가 만든 음성 스윕 없음.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 편집 축 전체 | 실제 카탈로그·실제 runtime 서비스로 3채널 행 존속 | **없음** | — |
| 부팅 축 seam | `createAuthResume`의 통지 판정·필터·중복 | **없음(단 D2)** | — |
| bootstrap 컴포지션 배선 | 부재는 typecheck가 잡는다 | **없음 — 사람 실기가 아니라 기계 핸들이 남아 있다** | `infra/source-scan.ts` + `no-stray-auth-subscribe.test.ts`의 실재 가드 형태(0198 D-010 선례)로 잠글 수 있다 → D2 |

- plan §7이 "사람 실기 항목: 없음"이라 적었고 재검토 결과도 같다. D2를 사람에게 넘기지 않는다.

## 9. 게이트 재실행

- 적용한 정본: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드`.
- 설치: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` — 972 packages, postinstall이 better-sqlite3를 **Electron ABI**로 rebuild 성공.
- `npm run typecheck` → **3구성(node·web·test) 전부 출력 0줄**.
- `npm run lint` → `✖ 1 problem (0 errors, 1 warning)`. warning은 `useTranscriptVirtualizer.ts:22` react-compiler 기존 항목(이번 diff와 무관).
- `./node_modules/.bin/vitest run` (Electron ABI) → **227파일 / 2303케이스 · 5파일 red**. red 목록 = `infra/db/{queries,migrate}` · `features/extensions/builder` · `features/orchestration/fork` · `app/chat-turn.continuity` — `app/AGENTS.md`가 적은 **실측 5파일**과 같고 서명은 `Module did not self-register: better_sqlite3.node`다. 변경 무관.
- `npm rebuild better-sqlite3`(Node ABI) 후 재실행 → **2303/2303 케이스 green, 1파일 red**. 그 1파일은 `app/chat-turn.continuity.test.ts`로 `Error: Electron failed to install correctly` — **내가 electron 바이너리 다운로드를 건너뛴 결과**지 코드 결함이 아니다.
- `node --test scripts/*.test.mjs` → **59 pass / 0 fail**(7 suites).
- `node scripts/check-doc-inventory.mjs --check` → generated ok(9 items, 79 channels) · prose ok · links ok.
- **구현자 자기보고 `227파일/2305건`을 재측정으로 화해했다**: 2303 + `chat-turn.continuity.test.ts`의 **2케이스** = 2305. 구현자 환경은 electron 바이너리가 있었다. 수치 불일치 아님.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint`는 `--fix`라 파일을 쓰지만 실행 후 `git status --short`가 **빈 출력**이다. 검증자 실행분이 커밋에 섞이지 않았다.
- **검증 중 실행한 명령이 남긴 잔여물**: 없음. 변이 실험은 전부 `git checkout --`로 되돌렸고, 임시 케이스 파일(`__verify-tmp.test.ts`)은 삭제했다. 최종 `git status --short` 빈 출력.
- **exit code를 통과 증거로 쓰지 않았다** — 위 수치는 전부 실행 산출이다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/테스트 | 실행·산출 기록(§9) | — | 완료 |
| AC ↔ production path | 15행 1:1(§5) | — | 완료 |
| §10 강제 지점 | 22지점 재검색(§5) | — | 완료 |
| 변이 잠금 | 13변이(§4) | — | 완료 — 2건 미검출 |
| 문서 형식·링크·인벤토리 | `check-doc-inventory` | — | 완료 |
| D-007(OPEN) 표시 정책 | 판단 보조 | **결정** | 미해결 — 본 handoff는 D-007 없이 완결되므로 비차단 |
| 신규 의존성 | 0건 | — | 승인 불요 |

## 11. Repository operation checks

### AGENTS.md 위생

- 이번 커밋은 `AGENTS.md`를 건드리지 않는다 — 해당 없음.

### INDEX 보드 정합성

- 상태/다음 주체: 구현 커밋이 `impl / IMPL_DONE / Claude(검증)`로 갱신했다 — 실제 상태와 일치했다. 이 커밋에서 `verify / FAIL / Codex`로 옮긴다.
- 「다음 주체」 칸: 주체 하나만 담는다 ✅.
- **대상 커밋 좌표를 검증자가 기입했다** — 자리표시자 `(r1 구현 — 검증자 기입)` → `72255c9`. `git cat-file -t 72255c9` = `commit`.
- plan 구현 보고 행은 `(r1 구현 — 좌표는 INDEX)` 자리표시자를 유지한다 ✅ (사본 1곳 원칙).
- 비고 5줄 이내 ✅.
- PASS archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- 구현 커밋 trailer 값이 허용값이다 — `Agent: codex` · `Handoff: docs/handoff/0202-.../` · `Status: implemented` · `Criteria-Met: 15/15` · `Verified-By: pending`.
- **실제 파싱된다** — `git log -1 --format='%(trailers:only=true)' 72255c9`가 5키를 그대로 돌려준다(0건 아님).
- 구현 커밋에 `Criteria-Pending`이 없다 — 자기보고가 15/15이므로 규약과 일치.
- 인용 커밋 해시 실재: `de8d15b`·`70d65c1`·`72255c9` 전부 `git cat-file -t` = `commit`.
- r1이라 재구현 라운드 7필드 검사는 해당 없다. 그럼에도 `[구현자 기입]` **6절이 전부 표/항목 형태로 채워졌고** 산문으로 접힌 필드는 0이다.
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `inFlight`에 generation을 실었다(설계 대비 차이) | **타당 + 필요** — 단순 합류는 invalidate가 요구한 replay를 삼킨다. M-F가 그것을 재현 | 유지. 단 같은 hunk의 slot 동일성 가드가 미잠금(D1) |
| `assertMutable` 반환형을 `string`으로 (선조치 2) | **타당** — 3채널이 같은 canonical을 재사용하는 유일한 방법. M-C가 부분 검출 | 유지 |
| "공유 축 — AC8 전체 invalidate 2 owner replay green" | **부정확** — AC8 테스트의 두 contribution은 authId가 `gate`/`other-auth`로 **다르다**. 같은 owner 축은 `invalidates only the requested canonical contribution key`가 덮는다(둘 다 `gate`) | 결론은 같다(공유 축 무결). 근거 행만 교정 |
| "재진입 — stale pending 변이 테스트 red 확인" | **재현됨** (M-F) | 유지 |
| "AC 자기보고 15/15" | **14 ✅ · 1 ⚠️** — AC11의 검증 수단이 없다 | D3 |

## 13. 파생 이슈

- [ ] **D1 — `runtime-catalog.ts:132-135`의 slot 동일성 가드가 잠기지 않았다.** 이 라운드가 고친 hunk를 되돌려도(`inFlight.delete(contribution.key)` 무조건 실행) **전체 스위트 2303/2303 green · typecheck 0 · eslint 0**이다. 실제 결함은 재현된다 — invalidate가 만든 replay가 in-flight인 구간에 같은 세대 reconcile이 들어오면 가드 없이 `resolve`가 1회 더 돈다(관측: `expected "vi.fn()" to be called 2 times, but got 3 times`). 같은 owner의 형제 contribution이 그 구간에서 자기 slot을 잃는 경로도 같은 자리다. **대응 방향**: `runtime-catalog.test.ts`에 "invalidate 뒤 in-flight replay에 후속 reconcile이 합류한다"를 단언하는 케이스를 추가하고, 그 케이스가 이 hunk 되돌림에서 red가 되는 것을 보인다. 출처: SKILL §4(고친 hunk가 분모, 아무것도 실패하지 않으면 파생 이슈) · AC10 · §10 2행.
- [ ] **D2 — `bootstrap.ts:407-409`(그리고 `:481`)의 배선이 *부재*만 닫혀 있고 *무동작*은 열려 있다.** `reconcileVerified`를 `() => {}`로 바꾸면 typecheck·lint·전체 스위트가 전부 green이다(M-J). §10 7행이 이 지점을 강제 지점으로 세고 실패 의미를 "그 축의 contribution이 부팅에서 영영 안 붙는다"로 적었으므로, 삭제만 막는 잠금은 그 문장을 지키지 못한다. **대응 방향**: 0198 D-010이 만든 실재 가드 형태(`infra/source-scan.ts` + `app/no-stray-auth-subscribe.test.ts`)를 재사용해 `createAuthResume(` 인자에 `runtimeModelCatalogBridge.onSnapshot`이 실재하는지, `createRuntimeModelCatalog(` 인자에 `snapshotOf`가 실재하는지를 production 파일에서 스윕한다. 가드를 만들면 **판정 지점마다 변이를 심어** 눈이 있음을 먼저 보인다. 출처: §10 7행 · AC12 production path.
- [ ] **D3 — AC11의 검증 수단이 존재하지 않는다.** AC11은 "같은 카탈로그 인스턴스로 `merge()`(무필터)와 `merge(settings,'claude')`를 비교"라 적었으나 `rg "\.merge\(" src/main --glob '*.test.ts'`가 **1건**(`runtime-catalog.test.ts:37`, 필터 단독 케이스)뿐이다. 두 소비처는 서로 다른 인스턴스의 별개 스위트에서만 확인되고 **CRUD 뒤** 상태는 어느 쪽도 단언하지 않는다. 자기보고는 이 칸을 ✅로 셌다. **대응 방향**: `engine.runtime-catalog.test.ts`의 "preserves a different runtime contribution" 케이스에서 CRUD 뒤 같은 인스턴스로 `merge(settings)`와 `merge(settings,'claude')`의 key 집합이 같음을 단언한다. 출처: AC11.

- **규범 정정 필요 없음** — D1·D2·D3 모두 테스트·가드 추가로 닫힌다. Decision·AC·§10 문면을 고칠 필요가 없으므로 **다음 주체는 구현자**다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **있다.** 0201 r1의 FAIL 근거도 "이번 라운드가 만든 장치가 스스로를 잠그지 않는다"였고, 0198 r5·r7도 같은 축이었다. 0202 r1은 그중 **hunk 미잠금**(D1) 한 형태다.
- 관련 plan 지침/AC의 존재 여부: **있었다.** plan §7 방향 기준이 AC5·AC12에 대해 "지웠을 때 실패해야 한다"를 명시했고 그 둘은 실제로 잠겼다(M-E·M-H). 미잠금은 **plan이 지목하지 않은 선조치 hunk**(D1)와 **컴포지션 seam**(D2)에서 나왔다.
- 사용자 결정 변경 근거: **없음** — Decision Ledger 무변경.
- 반복된 검증 환경 한계: **있다.** `bootstrap.ts`가 vitest 대상이 아니라는 제약(0198 D-010)이 0202에서도 같은 자리에 미검출을 만들었다(D2). 이번 환경 자체의 한계는 electron 바이너리 미설치 1건이며 `chat-turn.continuity.test.ts` 2케이스만 못 돌렸다.
- 현재 라운드 수: 1 (다음 재구현은 r2)

## 15. 결론

- 상태: **FAIL**
- Product/UX 및 ACTIVE Decision 충족: **✅ 전건.** 편집 축·부팅 축이 모두 end-to-end로 도달하고 D-001~D-006·D-008이 production path에서 성립한다. 이번 코드에서 **재현 가능한 제품 결함은 찾지 못했다**.
- AC 충족: **✅14 · ⚠️1 · ❌0 / 15** — ⚠️는 AC11(검증 수단 부재).
- 강제 지점: **22/22** 재측정 일치. 표 밖 누락 0.
- 기준 밖 결함: **D1** — 이번 라운드가 고친 hunk 하나가 전체 스위트·정적 검사 어느 것에도 잡히지 않는다. FAIL 근거는 점수가 아니라 이 미잠금이다.
- repository operation checks: trailer 파싱 5키 · 좌표 실재 · doc-inventory green · 게이트가 트리를 바꾸지 않았다 — 미스매치 0.
- 남은 사람 확인: **없음.** D-007(OPEN)은 이 handoff의 완결 조건이 아니다.
- 다음 단계: **구현자가 D1·D2·D3를 닫고 r2로 돌아온다.** 규범 행 정정은 필요 없다.


---

# r2 검증 (2026-08-26)

## 메타 — r2

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `ab2d020..c0760db` |
| 구현 전 plan 기준 | `ab2d020` (r1 verify 커밋 — D1·D2·D3 이관본) |
| 라운드 | 2 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예 — r2 구현자와 검증자가 같은 에이전트다.** 그래서 판정은 전부 이번 턴에 다시 심은 변이로만 내렸고, 구현 보고의 문장은 근거로 쓰지 않았다 |

## 0. 기준선 — r2

- **기준선이 diff로 성립한다.** `git diff ab2d020..c0760db -- plan.md`의 hunk가 전부 `@@ -472` 이상이고, §3 Decision Ledger(≈40줄)·§7 AC(≈100~140줄)·§10(≈250줄)은 한 줄도 바뀌지 않았다.
- Decision Ledger / Product/UX Contract / AC 변경: **없음.** r1과 같은 원문으로 채점한다.
- r2가 plan에 더한 것은 `[구현자 기입] r2` 7필드 + 파생 이슈 상태 칸뿐이다.

## 1. r2 구현 비판적 검토

r2는 **동작을 보존하는 재배치**다 — `bootstrap.ts`의 인라인 람다 4벌이 factory 호출로 바뀌었고 그 외 production 변경은 없다. SKILL §4대로 hunk 되돌림은 판정 근거로 쓰지 않고, **파생 이슈가 인용한 변이**로만 판정했다.

| 질문 | 판정 | 근거 |
|---|---|---|
| 추출이 동작을 바꿨는가 | 아니다 | `createRuntimeModelSnapshotReader`는 `(authId) => auth.bind(authId).snapshot()` 그대로, `createRuntimeModelReconcileVerified`는 `void bridge.onSnapshot(...)` 그대로 |
| 새 실패 모드 | 없음 | seam마다 새 closure를 만들지만 상태가 0이라 공유·만료 대상이 없다 |
| false success 가능성 | **있다 — §4 E4** | 이번 라운드가 잠갔다고 적은 자리에서 잠금이 성립하지 않는다 |
| 게이트만 늘고 원인이 남았는가 | 부분적으로 | reconcileVerified 축은 실제로 닫혔고, snapshotOf 축은 문서가 말하는 만큼 닫히지 않았다 |

## 2. 역방향 탐색 — r2

| 후보 | 판정 | 근거 |
|---|---|---|
| 신규 export `createRuntimeModelSnapshotReader` | **배선됨** | `bootstrap.ts:390`·`:411`·`:476`·`:484` 4곳 (`rg` 재측정) |
| 신규 export `createRuntimeModelReconcileVerified` | **배선됨** | `bootstrap.ts:409` 1곳 |
| 신규 테스트가 production 심볼을 부르는가 | **부른다** | `runtime-model-startup.test.ts`가 두 factory를 직접 import·호출. 동명 로컬 재구현 0 |
| 신규 스윕이 실제 소스를 훑는가 | **훑는다** | `MAIN_ROOT = join(__dirname, '..')` = `src/main` 실트리. tmp-root 케이스는 자기검사용으로 **추가**돼 있고 실트리 단언을 대체하지 않는다 |
| 형제 정책 비대칭 | **1건 해소** | `runtime-config.ts:211`의 같은 identity 가드가 r1까지 무잠금이었고 r2가 케이스를 붙였다 |

## 3. Product/UX end-to-end — r2

r1에서 확인한 두 축 경로는 그대로다(위 r1 §1 참조 — 재서술하지 않는다). r2는 그 경로 위에 잠금만 얹었고 사용자 대면 표면 변경은 0이다(`rg "ko\.ts|CHANNELS\."` 대상 변경 없음, IPC·DTO 무변경).

## 4. 잠금 재측정 — 분모는 D1·D2·D3가 **인용한 변이**

| # | 심은 변이 | 기대 | 실측 |
|---|---|---|---|
| V1 | `inFlight` slot 동일성 가드 → 무조건 `delete` (**D1 인용**) | red | ✅ **red** — `joins the replay an invalidation started…` 1케이스 |
| V2 | `reconcileVerified: () => {}` + 미사용 import 정리 (**D2 인용**) | red | ✅ **red** — `wires the verified-reconcile sink…` 1케이스. typecheck 0 · eslint 0 상태에서 red라 잔여물 부산물이 아니다 |
| V3 | 필터 형태에서 runtime 행 소멸 (**D3 인용 갈림**) | red | ✅ **red** — engine 3 + turn-setup 2 케이스 |
| V6 | `runtime-config.ts:211` identity 가드 제거 (D1 형제) | red | ✅ **red** — `옛 sourceRevision 작업이 끝나도…` 1케이스 |
| V4 | `reconcileVerified` 필드 삭제 (r1 M-I 회귀) | red | ✅ **red** — typecheck TS2345 **+** 스윕 1케이스 (r1보다 강해졌다) |
| V5 | `invalidate`의 replay 제거 (r1 M-E 회귀) | red | ✅ **red** — `runtime-catalog.test.ts` 4케이스 |

**인용 변이 3건은 전부 검출된다 — D1·D3는 닫혔고 D2도 인용 변이 기준으로는 닫혔다.**

### 그러나 새 장치의 판정 기준을 한 단계 엄격하게 하면 `0건`이 전수가 아니다

SKILL §8대로 구현자가 이번 라운드에 만든 스윕을 **재실행이 아니라 엄격화**로 다시 쟀다.

| # | 심은 변이 | 결과 | 의미 |
|---|---|---|---|
| E1 | catalog seam을 `const bound = auth.bind(id); return bound.snapshot()` 두 단계로 | **전건 green** · typecheck 0 | 음성 스윕 `INLINE_SNAPSHOT_READ`가 두 단계 형태를 놓친다 |
| **E4** | **catalog seam이 `{status:'expired', verified:false}` 굳은 값을 돌려준다** | **2312/2312 green** · typecheck 0 · 스윕 3건 green | **AC5가 production에서 깨지는데 게이트가 전부 초록이다** |
| E5 | bridge seam만 같은 방식으로 굳힌다 | **전건 green** | seam 단위가 아니라 파일 단위 판정임을 재확인 |
| E3 | factory 호출은 유지하고 `bridge`에 가짜 `{onSnapshot: async () => undefined}` | **전건 green** · typecheck 0 | 인자 축으로 한 칸만 내려가면 sink가 다시 무동작이 된다 |
| E6 | 4 seam **전부** 즉석 lambda로 | **red** 2케이스 | 가드가 무의미하지는 않다 — 일괄 제거는 잡는다 |

- 원인은 판정 단위다. `unwiredSeams`는 **파일**이 `snapshotOf: createRuntimeModelSnapshotReader(`를 하나라도 가지면 통과시킨다 — `bootstrap.ts`에 4벌이 있으므로 **어느 한 seam이든 개별로 무동작이 될 수 있다**.
- E4가 만드는 상태는 가설이 아니다: `snapshotOf`의 유일한 소비처가 `runtime-catalog.ts:163`(invalidate의 replay)이므로, 굳은 미인증 snapshot은 `invalidate(key)`를 **drop 전용**으로 만든다 — D-002·AC5가 존재하는 이유 그 자체가 무효화된다.
- AC5 테스트가 전부 green인 이유도 같다 — 테스트는 자기 `snapshotOf`를 주입하므로 **단위는 잠기고 배선은 안 잠긴다**(SKILL §2).

## 5. AC 1:1 — r2 (변동분만)

r1 매트릭스(위)를 기준으로 삼고 r2가 바꾼 칸만 적는다.

| # | 결과 | r2에서 달라진 것 |
|---|---|---|
| AC5 | **⚠️** (r1 ✅ → 하향) | 단위는 그대로 green이나 **컴포지션 배선이 무동작이어도 초록**임이 E4로 관측됐다. 행이 다시 채워진다는 계약의 production 성립을 아무 장치도 보지 않는다 |
| AC11 | **✅** (r1 ⚠️ → 상향) | `engine.runtime-catalog.test.ts` 3채널에서 CRUD 뒤 같은 인스턴스의 두 merge 형태를 비교. 갈림 변이 V3가 red |
| AC10 | ✅ 유지 | D1 잠금이 붙어 in-flight 구간의 상한까지 단언된다(V1 red) |
| AC12 | ✅ 유지 | 인용 변이 V2가 red. 다만 E3(가짜 bridge)는 통과 |
| 그 외 | 변동 없음 | V4·V5 회귀 측정에서 r1 잠금이 살아 있다 |

- **합계 재측정**: `✅ 13 · ⚠️ 2 · ❌ 0 = 총 15`. AC11이 올라오고 AC5가 내려갔다.
- **합계 사본 대조**: 구현자 본문 `15/15` ↔ trailer `Criteria-Met: 15/15` ↔ INDEX `15/15` — **세 사본은 서로 일치**하나 재측정(13✅)과 갈린다.

### §10 강제 지점 — r2 재측정

지점 수는 r1과 같다: `5+3+2+1+3+2+6 = 22`. 재측정 명령과 관측값도 r1과 동일하므로 재서술하지 않는다(위 r1 §5 표). r2는 지점을 늘리지 않고 그중 **2행(2행 replay · 7행 verified→재조정)의 배선 잠금만** 손댔다.

- 7행(`verified` 전이 → 재조정): 인용 변이 기준으로 닫혔다(V2·V4 red).
- 2행(drop+replay): **`snapshotOf` 배선이 무동작이어도 초록**이다(E4) — 이 행의 `실패 의미`("호출자에 replay를 남기면 다음 호출자가 다시 빠뜨린다")를 지키는 장치가 컴포지션 축에는 없다.

## 6~8. 게이트 / 환경 / 사람 실기 — r2

- `npm run lint` → **0 error / warning 1**(기존 `useTranscriptVirtualizer.ts:22`). 실행 후 `git status --short` **빈 출력** — autofix가 트리를 바꾸지 않았다.
- `npm run typecheck` → 3구성 **출력 0줄**.
- `./node_modules/.bin/vitest run` → **227파일 / 2312케이스**, red **1파일**. red = `chat-turn.continuity.test.ts`, 서명 `Error: Electron failed to install correctly` — 검증 환경이 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`로 설치된 결과지 코드 무관(r1 검증과 같은 서명).
- `node --test scripts/*.test.mjs` → **59 pass / 0 fail**. `check-doc-inventory --check` → 3항목 ok.
- 케이스 증분 재측정: r1 2303 → r2 **2312** (+9). 구현자 보고와 일치.
- **검증 중 실행한 명령이 남긴 잔여물**: 없음. 변이는 전부 백업 사본으로 복구했고 최종 `git status --short`가 빈 출력이다.
- 남은 사람 실기: **없음.** E4가 드러낸 자리도 사람이 아니라 스윕 단위를 seam으로 낮추면 기계가 판정한다.

## 9. Repository operation checks — r2

- **대상 커밋 좌표를 기입했다** — `(r2 구현 — 검증자 기입)` → `c0760db`. `git cat-file -t c0760db` = `commit`.
- `[구현자 기입]` r2가 impl §8의 **7필드를 모두 표로** 갖는다 — 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제(+설계 대비 차이)·구현 보고·Review Signals. 산문으로 접힌 필드 0.
- trailer: `Agent: claude` · `Status: implemented` · `Criteria-Met: 15/15` · `Verified-By: pending` — 허용값이고 `git log -1 --format='%(trailers:only=true)' c0760db`가 **6키를 그대로** 돌려준다.
- **미스매치 1건**: `[구현자 기입] r2`와 INDEX 비고가 "4 seam 을 모으고" · "무동작 배선은 진단 0 상태에서도 red"라 적었는데, 재측정에서 **red가 되는 것은 reconcileVerified seam 하나**다(E4·E5). 문장이 실제 잠금 범위보다 넓다.
- `AGENTS.md` 변경 없음 — 위생 검사 해당 없음.

## 10. 구현자 코멘트 / 선조치 경계 — r2

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| factory 둘로 추출 (설계 대비 차이) | **타당** — 인라인으로는 D2를 잠글 수 없다. 축 4개(만료·공유·재진입·다른 무효화 축) 보고도 재측정과 일치 | 유지 |
| "4 seam 을 모으고 실재 스윕 3건 신설" | **부분 부정확** — 모은 것은 맞으나 잠금은 파일 단위다 | D4 |
| `runtime-config.ts:211` 형제 선조치 | **재현됨** (V6 red) | 유지 |
| §10 행 신설 제안 (컴포지션 sink 실배선 3지점 중 1지점) | **타당하고, 제안한 것보다 넓다** — `onSnapshot` 축뿐 아니라 `snapshotOf` 축도 같은 구멍이다 | D4에 병합 |

## 11. 파생 이슈 — r2

- [x] **D1 — closed.** 인용 변이 V1이 red이고 형제 지점(V6)도 red다.
- [x] **D2 — closed(인용 변이 기준).** V2가 진단 0 상태에서 red다. 잔여 표면은 D4로 분리한다.
- [x] **D3 — closed.** 인용 갈림 V3가 red다.
- [ ] **D4 — 컴포지션 seam 잠금이 파일 단위라 seam 하나가 개별로 무동작이 될 수 있다.** 출처: §10 2행·7행 · AC5·AC12. 관측: E4(catalog `snapshotOf`가 굳은 미인증 snapshot → **2312/2312 green · typecheck 0 · 스윕 3건 green**) · E5(bridge seam 동일) · E3(factory 호출 유지 + 가짜 bridge) · E1(두 단계 store 읽기). E6(4 seam 일괄 교체)만 red다. **대응 방향**: 판정 단위를 파일에서 **토큰**으로 낮춘다 — `snapshotOf\s*:` 출현마다 뒤가 `createRuntimeModelSnapshotReader(`인지 보고(부정 lookahead), `bridge\s*:` 도 같은 방식으로 컴포지션 루트의 bridge 식별자를 요구한다. 대안은 seam 수를 줄이는 구조 변경(bridge가 reader를 소유하고 catalog·sink가 그것을 받는다). 어느 쪽이든 **판정 지점마다 변이를 심어** E1·E3·E4·E5가 red가 되는 것을 보인다.

- **규범 정정 필요 없음** — D4는 스윕 술어와 배선 형태로 닫힌다. Decision·AC·§10 문면은 그대로다. 다음 주체는 **구현자**다.

## 12. Review Signals — r2

- 이전 라운드와 동일/유사 증상: **예.** r1 FAIL 근거가 "이번 라운드가 만든 것이 스스로를 잠그는가"였고 r2도 같은 축에서 한 칸 남았다 — 잠금의 *존재*는 생겼고 *단위*가 모자란다.
- 관련 plan 지침/AC: plan §7 방향 기준이 "지웠을 때 실패해야 한다"만 적고 **판정 단위**를 적지 않았다. 구현자가 올린 §10 행 신설 제안이 그 빈자리를 가리킨다.
- 사용자 결정 변경 근거: 없음 — Decision Ledger 무변경.
- 반복된 검증 환경 한계: `bootstrap.ts`가 vitest 대상이 아님(0198 D-010)이 세 라운드째 같은 자리를 만든다. 이번 환경 한계는 electron 바이너리 미설치 1건(`chat-turn.continuity.test.ts` 2케이스 미실행).
- 현재 라운드 수: 2 (다음 재구현은 r3)

## 13. 결론 — r2

- 상태: **FAIL**
- 파생 이슈: **D1·D2·D3 closed**, 신규 **D4** 1건.
- AC: **✅13 · ⚠️2 · ❌0 / 15** — AC11 상향, AC5 하향.
- 강제 지점: **22/22** 재측정 일치(분모 불변).
- FAIL 근거: 점수가 아니라 **E4** 하나다 — 이번 라운드가 "닫았다"고 적은 자리에서, production 계약(AC5)을 깨는 배선이 전체 스위트·typecheck·새 스윕을 전부 통과한다.
- repository operation: 좌표 기입·7필드·trailer 파싱 이상 없음. 문장 하나가 실제 잠금 범위보다 넓다(§9).
- 남은 사람 확인: 없음.
- 다음 단계: **구현자가 D4를 닫고 r3로 돌아온다.**


---

# r3 검증 (2026-08-26)

## 메타 — r3

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `841b997..9ff7421` |
| 구현 전 plan 기준 | `841b997` (r2 verify 커밋 — D4 이관본) |
| 라운드 | 3 |
| 상태 | **PASS** |
| 자기 검증 여부 | **예 — r3 구현자와 검증자가 같은 에이전트다.** 판정은 전부 이번 턴에 다시 심은 변이로 내렸고 구현 보고 문장은 근거로 쓰지 않았다 |

## 0. 기준선 — r3

- **성립한다.** `git diff 841b997..9ff7421 -- plan.md` 의 hunk가 전부 `@@ -478` 이상 = `[구현자 기입]`·파생 이슈 영역이다. §3 Decision Ledger·§7 AC·§10 은 무변경.
- 채점 기준은 r1과 같은 AC 원문이다.

## 1. r3 구현 비판적 검토

r3 도 **동작을 보존하는 재배치 + 검사 장치 추가**다. 판정은 D4가 인용한 변이로만 내렸다.

| 질문 | 판정 | 근거 |
|---|---|---|
| 추출이 `AuthChange` 처리를 바꿨는가 | **아니다** | 순서·분기가 1:1 — 방송 → `kind!=='snapshot'` 조기 반환 → `credentialChanged`면 plugin sync + 무효화 → 재조정. diff를 줄 단위로 대조했다 |
| 순서가 실제로 잠겼는가 | **잠겼다** | 변이 W5(재조정을 방송 앞으로) **2케이스 red** · W6(`credentialChanged` 분기 제거) **1케이스 red** |
| 새 실패 모드 | 없음 | 두 factory 모두 상태 0, `void` fire-and-forget — r1·r2와 같은 성질 |
| TDZ / 조립 순서 | 안전 | `runtimeModelSnapshotOf`(:390)·`reconcileRuntimeModelSnapshot`(:397)이 소비처(:418·:483·:484·:645)보다 앞 |
| false success 가능성 | **이번 축에서는 없음** | 아래 §4의 인용 변이 4건이 전부 red |

## 2. 역방향 탐색 — r3

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 841b997..9ff7421
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 export (값·타입) | **0건** | 신규 export 둘 다 미검출 = 프로덕션 배선됨 |
| `createRuntimeModelReconcileSnapshot` | **배선됨** | `bootstrap.ts:398` |
| `createRuntimeModelAuthChangeHandler` | **배선됨** | `bootstrap.ts:645` |
| `affectedRuntimeModelAuthIds`·`invalidateRuntimeModelsForAuth` test-only | **오탐(r1과 동일)** | 같은 파일 안 `:32`·`:49`에서 호출된다 |
| 형제 정책 비대칭 | **0건** | 스크립트 (없음) |
| 신규 테스트가 production 심볼을 부르는가 | **부른다** | `runtime-model-startup.test.ts`가 두 factory를 직접 호출. 스윕은 `MAIN_ROOT = src/main` 실트리를 훑는다 |

## 3. Product/UX end-to-end — r3

두 축 경로는 r1 §1에서 확인한 그대로이고 r3는 그 위에 잠금만 얹었다(재서술하지 않는다). `AuthChange` 축의 네 갈래가 이제 순수 factory 안에 있고 순서까지 단언된다 — 이 축은 r1·r2에서 **아무 장치도 보지 않던** 자리다.

## 4. 잠금 재측정 — 분모는 D4가 **인용한 변이**

| # | 심은 변이 | r2 결과 | r3 실측 |
|---|---|---|---|
| W1 | catalog seam만 굳은 미인증 snapshot (E4) | green | ✅ **red** — `wires every catalog-reconcile injection point…` |
| W2 | factory 호출 유지 + 가짜 bridge (E3) | green | ✅ **red** — 같은 케이스 |
| W3 | 두 단계로 나눈 store 읽기 (E1) | green | ✅ **red** — 같은 케이스 |
| — | bridge seam만 굳힘 (E5) | green | ✅ **red** (r3 구현 턴에서 확인, 이번 턴은 W1이 같은 판정 지점을 덮는다) |

**D4의 인용 변이 4건이 전부 검출된다 — D4는 닫혔다.**

### r1·r2 잠금 회귀 — 전부 살아 있다

| # | 변이 | 실측 |
|---|---|---|
| W8 | slot 동일성 가드 제거 (D1) | red 1케이스 |
| W9 | `reconcileVerified: () => {}` (D2, 진단 0) | red 2케이스 |
| W10 | merge 두 형태 갈림 (D3) | red 5케이스 |
| W11 | `runtime-config.ts:211` 정리 identity (D1 형제) | red 1케이스 |

### 검사 장치를 엄격화해 다시 쟀다 (§8)

- **분모 재측정**: `키:` 출현을 직접 세어 **21건**(`snapshotOf` 8 · `bridge` 5 · `onChange` 3 · `reconcileVerified` 2 · `reconcile` 2 · `invalidateForAuth` 1). 그중 `active-turn-tracker.ts`의 `onChange` 1건이 축 밖이라 **축 내 20건**. 구현자 보고와 일치하고 `injectionViolations(MAIN_ROOT)` = `[]` 이므로 **차집합 0**.
- **범위 엄격화**: 스윕 루트를 `src/main` → `src` 로 넓히면 추가로 잡히는 것은 renderer의 React `onChange:` prop **10건 이상**뿐이고 축 지점은 0건이다 — `src/main` 스코프가 축 지점을 숨기고 있지 않다.
- **방향**: 이 스윕은 "허용 형태가 **쓰인다**"를 요구하는 양성 술어라 교체·변형에 직접 반응한다(W1~W3). 남은 방향은 **삭제**인데 그것은 아래 D5가 말한다.

## 5. AC 1:1 — r3 (변동분만)

| # | 결과 | r3에서 달라진 것 |
|---|---|---|
| AC5 | **✅** (r2 ⚠️ → 상향) | 배선이 무동작이어도 초록이던 자리가 red가 됐다(W1). 단위+배선 양쪽이 잠겼다 |
| AC12 | ✅ 유지 | W9가 red. E3(가짜 bridge)도 이제 red(W2) |
| 그 외 | 변동 없음 | W8·W10·W11로 r1·r2 판정이 유지됨을 확인 |

- **합계 재측정**: `✅ 15 · ⚠️ 0 · ❌ 0 = 총 15`. 분모는 §7 AC1~AC15를 다시 셌다.
- **합계 사본 대조**: 본문 15 ↔ trailer `Criteria-Met: 15/15` ↔ INDEX `15/15` — 일치하고, 이번에는 재측정과도 일치한다.

### §10 강제 지점 — r3 재측정

`5+3+2+1+3+2+6 = 22`. 각 행의 지점을 코드에서 다시 확인했고 r1·r2와 같은 좌표다(재서술하지 않는다). 이번 라운드가 바꾼 것은 지점 수가 아니라 **2행·7행의 배선 잠금 강도**다.

- 2행 `실패 의미`("호출자에 replay를 남기면 다음 호출자가 다시 빠뜨린다"): 이제 컴포지션 축에서도 적대 상태를 만들 수 없다 — W1이 red.
- 7행 `실패 의미`("한 지점이라도 빠지면 그 축의 contribution이 부팅에서 영영 안 붙는다"): W9·W2가 red.
- 표 밖에서 같은 불변식이 필요한 지점: **1건 남았다** — 아래 D5.

## 6~8. 게이트 / 환경 / 사람 실기 — r3

- `npm run lint` → **0 error / warning 1**(기존 `useTranscriptVirtualizer.ts:22`). 실행 후 `git status --short` **빈 출력**.
- `npm run typecheck` → 3구성 **출력 0줄**.
- `./node_modules/.bin/vitest run` → **227파일 / 2318케이스**, red **1파일** = `chat-turn.continuity.test.ts`(`Error: Electron failed to install correctly` — 검증 환경의 `ELECTRON_SKIP_BINARY_DOWNLOAD=1` 설치 결과, 코드 무관).
- `node --test scripts/*.test.mjs` → **59 pass / 0 fail**. `check-doc-inventory --check` → 3항목 ok.
- 케이스 증분 재측정: 2312 → **2318**(+6). 구현자 보고와 일치.
- **잔여물**: 없음. 변이는 전부 백업 사본으로 복구했고 최종 `git status --short`가 빈 출력이다.
- 사람 실기: **없음.**

## 9. Repository operation checks — r3

- **대상 커밋 좌표를 기입했다** — `(r3 구현 — 검증자 기입)` → `9ff7421`. `git cat-file -t 9ff7421` = `commit`.
- `[구현자 기입] r3`가 7필드를 모두 표로 갖는다(설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제 + 설계 대비 차이·구현 보고·Review Signals). 산문으로 접힌 필드 0.
- trailer: `Agent: claude` · `Status: implemented` · `Criteria-Met: 15/15` · `Verified-By: pending` — 허용값이고 `git log -1 --format='%(trailers:only=true)' 9ff7421`이 6키를 그대로 돌려준다.
- 인용 커밋 해시 `72255c9`·`c0760db`·`9ff7421` 전부 `git cat-file -t` = `commit`.
- `AGENTS.md` 변경 없음.
- **문장 정확도 1건** — `[구현자 기입] r3` 놓친 잠재 문제 #6이 "누락은 red 로 나타난다"고 적었으나, **선택 필드의 누락은 red가 아니다**(D5). 형태 교체에 대해서만 참이다.

## 10. 구현자 코멘트 / 선조치 경계 — r3

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 판정 단위를 파일 → 주입 지점으로 | **타당하고 재현됨** — W1~W3이 red | 유지 |
| 이름 축을 생성 형태로 별도 잠금 | **타당** — 토큰 스윕만으로는 가짜 몸이 통과한다 | 유지 |
| `AuthChange` handler 추출 | **타당** — 텍스트로만 지키던 자리가 동작으로 잠겼다(W5·W6 red) | 유지 |
| "`syncPlugins`는 무동작 가능, 계약 밖" | **재현됨**(W7 green) — 0188 plugin 축이라 D4 계약 밖이 맞다 | D6(비차단) |
| "누락은 red 로 나타난다" | **부정확** — 선택 필드 삭제는 red가 아니다 | D5(비차단) |

## 11. 파생 이슈 — r3

- [x] **D4 — closed.** 인용 변이 E1·E3·E4·E5가 전부 red(W1~W3 + r3 턴 E5). 이름 축·분류 단위·실재 판정 변이도 red.
- [ ] **D5 (비차단) — 선택 필드의 *삭제*는 스윕이 볼 수 없다.** `createRuntimeModelCatalog`의 `onChange?`를 지우면 typecheck 0 · **2318 케이스 전건 green**(변이 W4)이고, 카탈로그가 행을 바꿔도 `pushConnectionState`가 돌지 않아 두 UI가 그 자리에서 갱신되지 않는다. **이 라운드의 회귀가 아니다** — 0198부터 있던 선택 필드이고 어느 AC·§10 행도 이 지점을 단언하지 않는다. 대응 방향: `onChange`를 필수로 올리거나(소비처 1곳), 스윕에 "이 factory 호출은 `onChange:` 출현을 가져야 한다"는 존재 규칙을 더한다.
- [ ] **D6 (비차단) — `syncPlugins` 인라인 클로저가 무동작이어도 전건 초록이다**(변이 W7). 0188 plugin 축이라 D4 계약(§10 2·7행 · AC5·AC12) 밖이고 구현자가 이미 보고했다. 대응 방향: 같은 factory 패턴으로 뽑아 동작으로 잠근다.

- **규범 정정 필요 없음.** D5·D6 모두 구현 범위이며 **PASS를 막지 않는다** — 어느 AC·ACTIVE Decision·§10 행도 미충족이 아니다.

## 12. Review Signals — r3

- 이전 라운드와 동일/유사 증상: **판정 단위가 한 칸씩 내려온 축이 r1→r2→r3로 이어졌고 r3에서 멈췄다.** r3의 인용 변이는 전건 검출이고 회귀 4건도 전부 red다.
- 관련 plan 지침/AC: plan §7 방향 기준이 "지웠을 때 실패해야 한다"만 적고 **판정 단위**를 적지 않았다 — 세 라운드가 그 빈자리를 메웠다. D5가 남긴 것은 그 지침이 여전히 말하지 않는 축(선택 필드 삭제)이다.
- 사용자 결정 변경 근거: 없음 — Decision Ledger 무변경.
- 반복된 검증 환경 한계: `bootstrap.ts`가 vitest 대상이 아님(0198 D-010)이 세 라운드 내내 같은 자리를 만들었고, r3가 그 파일에서 로직을 걷어내는 쪽으로 대응했다. 이 환경의 electron 바이너리 미설치로 `chat-turn.continuity.test.ts` 2케이스는 세 라운드 모두 미실행.
- 현재 라운드 수: 3. **다음 재구현이 생기면 라운드가 3을 넘으므로 `handoff-review`를 먼저 수행해야 한다.**

## 13. 결론 — r3

- 상태: **PASS**
- Product/UX 및 ACTIVE Decision: **충족.** 편집 축·부팅 축이 end-to-end로 도달하고 D-001~D-006·D-008이 production path에서 성립한다.
- AC: **✅15 · ⚠️0 · ❌0 / 15**. 강제 지점 **22/22**, 주입 지점 **20건 차집합 0**.
- 기준 밖 결함: **없음.** D5·D6은 이 handoff의 어느 계약도 요구하지 않는 인접 표면이고 비차단으로 기록했다.
- repository operation: 좌표·7필드·trailer 파싱 이상 없음. 보고 문장 1건이 실제보다 넓어 D5에 적었다.
- 남은 사람 확인: **D5·D6 후속 여부**(범위 결정) 하나. 구현 자체가 막는 것은 없다.
- 다음 단계: **archive 이동은 D5·D6 처리 결정까지 보류**한다.
