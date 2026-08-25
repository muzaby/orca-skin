# Verify — 0199-simplify-0198-cleanup

> 검증 절차는 [`SKILL.md`](../../../.agents/skills/handoff-verify/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0199-simplify-0198-cleanup` |
| 검증자 | Claude Code |
| 일자 | 2026-08-25 |
| 대상 커밋/range | `2eecb58..be76207` |
| 구현 전 plan 기준 | `2eecb58` (설계 커밋) |
| 라운드 | 1 |
| 상태 | **FAIL** |
| 자기 검증 여부 | 설계·구현·검증 모두 Claude — 세션은 갈렸다(설계·구현 `01LRh1Ri…`, 검증 본 세션) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: **아니오**. `git diff --stat 2eecb58..be76207 -- docs/handoff/` 가 0줄이다.
- **기준선이 diff로 성립하는가**: **부분 성립**. plan 커밋과 구현 커밋은 갈렸지만, plan 커밋 `2eecb58` 이 이미 `[구현자 기입]` 3절·§17 되돌린 것 2건·§19 게이트 결과·메타 `IMPL_DONE (r1)` 을 담고 있다 — 코드가 이미 쓰인 뒤 AC 가 커밋됐다.
- 따라서 **"AC 가 구현에 맞춰 재작성되지 않았다"를 diff로 확인할 수 없다.** 아래는 `2eecb58` 의 AC 원문을 그대로 채점 기준으로 고정한 결과다.
- Decision Ledger 변경: 없음(D-001~D-007 신규, 구현 커밋이 건드리지 않음).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음(구현 커밋 기준). 최초 작성 시점의 자기 증명 여지는 위에 적었다.
- 채점에 사용할 원 기준: `2eecb58:docs/handoff/0199-simplify-0198-cleanup/plan.md` §7 AC1~AC8 · §10 강제 지점 12행.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 | 사용자 대면 동작·wire shape 변화 0 | wire ✅ (`app/src/shared/` diff 0줄) · 동작 ❌ (§2 D1) |
| D-003 | 병합 규칙을 카탈로그가 소유 | `misc.ts:42` · `turn-setup.ts:54` → `catalog.merge` → `mergeAgentEnvironments` |
| D-004 | 행 조립 1자리 | `runtime-catalog.ts:112` · `models.ts:86` → `toAgentEnvironment` (`models.ts:61`) |
| D-005 | key 정규화 어휘 하나 | `canonicalProviderKey` 제거 — **전제가 거짓이다** (§2 D1) |
| D-006 | 목록 무효화 구독을 store 가 소유 | `useAgents.ts:11` · `useEngines.ts:30` → `agentStore.subscribeAgents` (`agentStore.ts:46`) |
| D-007 | 부팅 순서·`auth.subscribe` 좌표 불변 | `no-stray-auth-subscribe.test.ts` 9 테스트·18 단언 base↔head 동일 |

### end-to-end 흐름

```text
Gate 인증 성공
  → catalog.reconcile → runtime.resolve → toAgentEnvironment(entry, {source:'runtime', readOnly:true})
  → orca:agent:list  : misc.ts  → catalog.merge(settings)              → EngineCard / Composer
  → 턴 셋업          : turn-setup.ts → catalog.merge(settings, adapter) → spawn 입력
  → 인증 해제/실패    → bumpGenerations + drop → onChange → 두 UI 갱신
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ❌ **가드가 fail-open 으로 바뀐다** | D1 — `assertMutable` 우회 |
| false success 가능성 | ⚠️ | D1 의 우회는 예외 없이 성공한다 |
| partial failure/rollback | 무영향 | `drop`/`bumpGenerations` 분리가 AS-IS 3경로와 동치 |
| Product/UX 의 A 가 아닌 B | 무 | Composer 효과 재작성은 4경우 분석상 동치(§4 W1) |
| 증상만 제거하고 상태가 남았는가 | 무 | `EngineCard` 죽은 조건 제거는 렌더 결과 불변 |
| 최적화가 잃은 관측 | 무 | `merge` 는 AS-IS 와 같은 Map 1개 + filter |
| 출력/요청 worst-case | 불변 | 구독 왕복은 여전히 2 (plan §14 자기보고와 일치) |

### D1 — `assertMutable` 의 read-only 판정이 우회 가능해졌다 (D-001 위반)

**판정: ❌ 결함.** `engine.ts` 가 `canonicalProviderKey(key, ['claude'])` 를 떼고 raw key 를 `isReadOnly` 에 넘긴다. D-005 는 "두 함수가 같은 값을 낸다"는 0198 관측을 근거로 삼았는데, **그 관측은 바깥 공백 입력류에서만 참이다.**

재현(임시 vitest 파일, 5 단언 전건 통과 — 파일은 검증 후 제거):

| 관측 | 값 |
|---|---|
| `canonicalProviderKey_AS_IS('claude-  corp', ['claude'])` | `'claude-corp'` |
| `canonicalAgentKey('claude-  corp')` | `'claude-  corp'` |
| AS-IS `catalog.isReadOnly(canonicalProviderKey(...))` | **true** (막힘) |
| HEAD `catalog.isReadOnly('claude-  corp')` | **false** (안 막힘) |
| `deleteHarnessSettings('claude-  corp', root)` | provider 디렉토리 `corp` 를 **실제로 지운다** |

- 안쪽 공백을 지우는 것은 `providerKeyOf` 의 `provider.trim()` 이다(`provider-key.ts:11`) — `canonicalAgentKey` 에는 그 항이 없다.
- 하류가 같은 provider 로 수렴한다: `parseHarnessSettingsKey` → `normalizeProvider` 가 `trim().toLowerCase()` 한다(`settings-write.ts:40`).
- IPC 가 key 를 제약하지 않는다: `UpdateEngineSchema`/`DeleteEngineSchema`/`ReadEngineSchema` 모두 `key: z.string().min(1)`(`protocol.ts:393-400`). `engineAdd` 는 `providerKeyOf` 를 지나므로 무관하다.
- 충돌 상태는 가정이 아니라 설계된 상태다 — `mergeAgentEnvironments` 주석과 `turn-setup.runtime-catalog.test.ts` 의 `uses the runtime row for execution when a settings key collides` 가 그 상태를 만든다.
- 삭제된 단위 테스트 이름이 그 항을 명시했다: `canonicalProviderKey 는 read-only 판정 전에 casing과 **공백**을 정규화한다`(`provider-key.test.ts`, base 기준).

렌더러는 `agent.key` 를 그대로 보내므로 화면 조작으로는 도달하지 않는다. 도달면은 **main 프로세스 가드 자체**이고, 0198 D-008 이 fail-closed 로 세운 판정이 비-canonical key 에서 fail-open 이 된다.

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 2eecb58..be76207
```

| 후보 | 판정 | 근거 |
|---|---|---|
| 미사용 값 export | 없음 | 스크립트 1a 공백 |
| 테스트 전용 참조 | 없음 | 스크립트 2 공백 |
| 형제 정책 비대칭 | 없음 | 스크립트 3 공백 |
| 신규 등록값(`merge`)의 소비처 | 전수 갱신 | 구현 1 + stub 3, `typecheck` 0 error |
| producer ↔ consumer 파생 | 일치 | `ParsedModel` 5필드 ≡ `AgentModelView` 5필드 → 런타임 행의 `.map` 은 항등 복사 |
| 동일 규칙 중복 구현 | SSOT 유지 | `scanOffenders` 재사용이 `sourceFiles`+`stripCommentsAndStrings` 사본을 없앤다 |
| **§18 미기재 변경** | ⚠️ D4 | `claude/available-models.ts`·`claude/model-parser.ts` 가 §9·§11·§18 어디에도 없다 |

D4 의 두 파일은 **동작 보존이다**: `isRecord` 본문(`obj.ts:15`)이 인라인 검사와 문자 그대로 같고, `FAMILY_ORDER`(`['sonnet','opus','haiku']`)가 옛 `DISPLAY_ORDER` 와 같은 값이다. 결함은 동작이 아니라 **영향 범위 신고 누락**이다.

## 4. 기존 테스트 / semantic 검증 확인

- plan 이 인용한 기존 테스트는 전부 실재한다: `no-stray-auth-subscribe.test.ts`(9 테스트·18 단언) · `runtime-catalog.test.ts`(13 테스트·21 단언) · `turn-setup.runtime-catalog.test.ts`(3 테스트) · `modelSelection.test.ts` · `available-models.test.ts` · `model-parser.test.ts`.
- **동작 보존 재배치 라운드다.** hunk 되돌림은 동치 코드로 돌아갈 뿐이라 판정에 쓰지 않았다(SKILL §4). r1 이라 인용 변이도 없다 — 대신 §10 각 행과 **이번 라운드가 새로 만든 표면**에 소거/반전 변이를 심어 측정했다.
- **심은 변이 15건 중 검출 11 · 미검출 4.** 미검출 4건은 아래.

| 변이 | 대상 | 결과 |
|---|---|---|
| M-1 | `merge` 가 `isReadOnly` 술어를 안 넘김 | ✅ `turn-setup.runtime-catalog.test.ts` red |
| M-2 | `merge` settings측 adapter 필터 소거 (**본 라운드 신설항**) | ❌ 미검출 |
| M-3 | `merge` runtime측 adapter 필터 소거 (AS-IS 에도 있던 항) | ❌ 미검출 |
| M-4 | stub 에서 `merge` 제거 | ✅ `TS2741` (`runtime-model-startup.test.ts:23`) |
| M-5 | `toAgentEnvironment` 가 provenance 무시 | ✅ `runtime-catalog.test.ts` red |
| M-6 | `isReadOnly` 가 canonical 정규화 없이 비교 | ✅ 2파일 red |
| M-7 | 제거가 `onChange` 미발화 | ✅ `runtime-catalog.test.ts` red |
| M-8 | Composer 효과 분기 반전 | ❌ 미검출 |
| M-9 | stray `auth.subscribe(` 주입 | ✅ `no-stray-auth-subscribe.test.ts` red |
| M-10 | 부팅 helper 2번째 호출부 주입 | ✅ 같은 파일 red |
| M-11 | `RUNTIME_MODEL_CONTRIBUTIONS.` 변형 주입 | ✅ 3파일 red |
| M-12 | `markDefaultModel` 소거 | ✅ `available-models`·`model-parser` red |
| M-13 | 비배열 `availableModels` 거부 소거 | ✅ `runtime-catalog`·`available-models` red |
| M-14 | `selectionExists` 항상 참 | ✅ `modelSelection.test.ts` red |
| M-15 | `merge` 의 adapter-미지정 분기가 settings 를 **전부 버림** | ❌ 미검출 |

### D2 — production `catalog.merge` 의 `orca:agent:list` 분기가 잠금 밖이다

**판정: ❌ 관측 부족(본 라운드가 만든 것).** M-15 는 Engine 화면과 Composer 가 읽는 목록에서 settings 행을 전부 없애는 변이인데 **215파일 전체가 초록**이다(비-베이스라인 실패 0).

- 원인: 이 라운드가 병합 규칙을 `misc.ts` 에서 `catalog.merge` 로 옮기면서, 그 경로를 덮던 `misc.runtime-catalog.test.ts` 가 production `merge` 대신 **같은 이름의 로컬 재구현**을 stub 으로 세웠다(`misc.runtime-catalog.test.ts:45-46`).
- 그 stub 은 `misc.ts` 가 `catalog.merge` 를 *부른다*는 것만 잠근다. 무엇을 돌려주는지는 잠그지 않는다 — SKILL §2 가 말하는 형태다.
- production `merge` 를 실제로 지나는 테스트는 `turn-setup.runtime-catalog.test.ts` 하나이고, 그것은 **항상 adapter 를 넘긴다**. `adapter === undefined` 분기는 어떤 테스트도 실행하지 않는다.
- plan §10 2행이 이 불변식의 장치로 `misc.runtime-catalog.test.ts` 를 적었다 — 그 장치는 이 축에 눈이 없다.

### W1 — Composer 효과 재작성이 잠금 밖이다 (결함 아님)

M-8(`if (modelFamily != null) return` → `== null`)이 미검출이다. `modelSelection.test.ts` 는 추출된 순수 함수만 덮고 `Composer.tsx` 의 분기 구조는 덮지 않는다. 4경우(선택 없음 / 원천 소멸 / provider 만 복원 / 정상)를 직접 대조해 AS-IS 와 **동치임을 확인**했으므로 결함으로 세지 않고 관측 부족으로 남긴다.

### W2 — 카탈로그 부재 시 폴백이 AS-IS 와 다르다 (프로덕션 미도달)

`?? settings` 는 `mergeAgentEnvironments` 의 canonical dedupe 를 건너뛴다. AS-IS 는 카탈로그가 없어도 그 Map 을 지났다. 프로덕션에서는 도달하지 않는다 — `bootstrap.ts:676` 이 `runtimeModelCatalog` 를 항상 넘긴다.

### D3 — plan §13 의 "컴파일 에러" 주장이 사실이 아니다

**판정: ❌ 문서 정확성.** §13 은 `invalidateHarnessForAuth` 가 `const` 라 "미초기화 접근이 **컴파일 에러**가 된다"고 적었다. 실제 사용처는 `onChange` **클로저 안**이고, TypeScript 는 그 형태를 잡지 않는다.

- 재현: 클로저에서 뒤의 `const` 를 쓰는 최소 파일에 `tsc --noEmit --strict` → **exit 0**.
- 같은 형태의 런타임: `ReferenceError - Cannot access 'used' before initialization`.
- 즉 얻은 것은 빌드 실패가 아니라 **최초 auth change 에서의 런타임 크래시**다. AS-IS 의 `?.` 무음 no-op 보다 낫지만 §13 이 적은 메커니즘은 아니다.

## 5. 요구사항 충족 매트릭스

| # | 기준 | 결과 | 검증 증거 |
|---|---|---|---|
| AC1 | 사용자 대면 동작·wire shape 변화 0 | ❌ | wire ✅(`app/src/shared/` diff 0줄) · 동작 ❌(D1: `engineUpdate/Delete/Read` 의 read-only 판정이 바뀐다) |
| AC2 | 0198 강제 지점 테스트 삭제 0 | ✅ | `no-stray…` 9테스트/18단언 · `runtime-catalog` 13테스트/21단언 — base↔head 동일 |
| AC3 | `mergeAgentEnvironments` 직접 소비처 0 | ✅ | production 참조는 정의(`models.ts:95`)와 `runtime-catalog.ts:141` 뿐 |
| AC4 | 행 조립 자리 1 | ✅ | `adapter: .*harnessId` → `models.ts:66` 1건. 엄격화(`source:`/`readOnly:` 리터럴)해도 production 은 `models.ts` 뿐 |
| AC5 | `canonicalProviderKey` 부재 | ✅ | `grep -rn canonicalProviderKey src` → 0건 |
| AC6 | 목록 무효화 구독 1자리 | ✅ | `agentStore.ts:47` 1건 |
| AC7 | 부팅 시퀀스·`auth.subscribe` 좌표 불변 | ✅ | 가드 green + M-9·M-10 이 red 를 냄 |
| AC8 | 게이트 전건 통과 | ✅ | §9 |

- **합계 재측정**: ✅7 · ⚠️0 · ❌1 = **총 8**. 자기보고 `8/8`(plan `[구현자 기입]` · trailer `Criteria-Met: 8/8`) — **불일치**.
- **합계 사본 대조**: 본문 8 ↔ trailer `8/8` ↔ INDEX 비고(AC 수치 미기재) — 분모는 갈리지 않았고 값만 갈린다.

### plan §10 강제 지점 표 — AC와 별개로 걷는다

| # | plan 이 적은 강제 지점 | 확인 결과 |
|---|---|---|
| 1 | `merge` 가 인터페이스 필수 멤버 | ✅ M-4 `TS2741` |
| 2 | 병합이 collide settings 행을 숨긴다 (`misc.runtime-catalog.test.ts`) | ⚠️ **장치가 축에 눈이 없다** — D2 |
| 3 | 턴 셋업이 같은 병합을 본다 | ✅ M-1 |
| 4 | 행 조립이 `source`·`readOnly` 를 채운다 | ✅ M-5 |
| 5 | `isReadOnly` 가 양쪽 key 를 canonical 로 맞춘다 | ✅ M-6 |
| 6 | 자동 행 제거가 `onChange` 를 발화 | ✅ M-7 |
| 7 | Auth listener 설치 파일 유일성 | ✅ M-9 |
| 8 | 부팅 helper 호출부 유일성 2심볼 | ✅ M-10 |
| 9 | contribution 선언 무변형 통과 | ✅ M-11 |
| 10 | Composer 선택 소멸 감지 | ✅ M-14 (다만 Composer 효과 자체는 W1) |
| 11 | `normalizeAvailableModels` 가 default 를 정한다 | ✅ M-12 |
| 12 | 카탈로그가 비배열 `availableModels` 를 거부 | ✅ M-13 |

- **합계: ✅11 · ⚠️1 = 12.** 자기보고 `12/12` — 행 11개는 재측정과 일치하고 2행에서 갈린다.
- 표에 없는데 같은 불변식이 필요한 지점: **`assertMutable` 의 key 정규화**(D1). D-005 를 실행하는 자리인데 §10 에 행이 없어 아무도 걷지 않았다.

## 6. 외부 포트 / 문서 계약

해당 없음. `RUNTIME_MODEL_CONTRIBUTIONS`·augmenter 계약 불변(plan §15) — `merge` 는 인터페이스 내부 추가라 폐쇄망 배포가 채우는 표면이 아니다.

## 7. 숫자 / 음성 기준 / 상한 재측정

- vitest 총수: **215파일 · 2,109 케이스**(본 환경). plan §19 의 `2,111` 과 2건 차이는 **ABI red 파일의 수집 실패**로 전액 설명된다 — `chat-turn.continuity.test.ts` 는 정적 `it(` 2개인데 등록 0이다. 2,109 + 2 = 2,111 → **plan 수치가 맞다**.
- AC2 가 인용한 수치는 트리와 다르다: `no-stray…` 는 18 단언(plan 은 `4 단언`), `runtime-catalog.test.ts` 는 13 테스트(plan 은 `15 테스트`). **기준("삭제되지 않는다")은 충족**이고 인용 수치만 어긋난다.
- `provider-key.test.ts` 4 → 3 테스트: AC5 가 예고한 감소와 같은 사실이다.
- 0건 게이트의 정당한 예외 보존: `productionCallers` 의 `runtime-model-startup.ts` 면제가 basename 집합으로 그대로 남았다.
- 요청 상한: 구독 왕복 2 유지(plan §14 자기보고와 일치, 변이 불필요 — 코드상 hook 2개가 각자 구독).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| 사용자 대면 동작 | 순수 로직·IPC 핸들러·카탈로그를 vitest 로 전건 | **없음** — 이 라운드는 시각 변경이 0이다 |
| `EngineCard` 렌더 | `canMutate` 가드 안이라 `!canMutate` 가 항상 false 임을 코드로 확인 | 없음 |

## 9. 게이트 재실행

- 실행 명령: `npm run typecheck` · `./node_modules/.bin/eslint ./src ./scripts` · `./node_modules/.bin/vitest run --reporter=json` · `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs --check`.
- **관측한 산출**(exit code 아님):
  - typecheck 3분할 — `error TS` **0건**.
  - eslint — **0 error · 1 warning**(`useTranscriptVirtualizer.ts:22`, 본 변경 무관·plan §19 가 예고).
  - vitest — **215파일 / 2,109 케이스 · 2,067 pass · 42 fail**.
  - scripts — **49/49 pass**.
  - doc-inventory — `generated doc ok (9 items, 76 channels)` · prose ok · links ok.
- 환경 기인 분리: 42 red 는 **5파일 전건**(`chat-turn.continuity` · `builder` · `fork` · `migrate` · `queries`)이고 서명은 `Module did not self-register: better_sqlite3.node` 다 — `app/AGENTS.md §better-sqlite3` 의 실측 5파일과 **정확히 같은 집합**이다. 변경 무관.
- **자기 게이트의 false success 1건**: 첫 실행에서 `--reporter=basic` 이 vitest 4 에서 로드 실패해 **케이스 0건 실행 · exit 0** 이 나왔다. 기본 리포터로 재실행해 위 산출을 얻었다.
- 게이트가 작업 트리를 바꿨는가: **없음**. `npm run lint`(`--fix`)를 피해 `eslint` 를 직접 돌렸고, 각 변이는 `git checkout` 으로 되돌렸다. 최종 `git status --short` 공백.
- 검증 중 잔여물: 임시 `src/main/zz-verify0199-tmp.test.ts` 는 측정 후 삭제했다. `node_modules/` 는 본 환경에 없어 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` 로 설치했다(추적 대상 아님).

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 결과 |
|---|---|
| lint/typecheck/테스트 | 에이전트 실행·산출 관측 — §9 |
| AC ↔ production path | 에이전트 1:1 대조 — §5 |
| 강제 지점 12행 | 에이전트 변이 재측정 — §5 |
| 레이어/계약/링크 | 에이전트 — `boundaries` lint 0 error · doc-inventory links ok |
| D1 의 처리 방향 | **사람 결정 불필요** — D-001 이 이미 "동작 변화 0" 을 정했다. 구현 정정 사안 |
| 제품 의도 / Open Question | 해당 없음 |
| UI 시각 품질 | 해당 없음(시각 변경 0) |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

해당 없음 — 이번 range 는 `AGENTS.md` 를 건드리지 않는다(`git diff --stat 2eecb58..be76207` 21파일 전부 `app/src/**`).

### INDEX 보드 정합성

- 상태 / 다음 주체: `impl/IMPL_DONE (r1)` · `Claude (검증)` — 실제와 일치했다. 「다음 주체」 칸은 주체 하나만 담는다 ✅.
- **대상 커밋 좌표: `—` 였다.** `docs/handoff/AGENTS.md §INDEX.md 운영` 은 구현자가 `(rN 구현 — 검증자 기입)` 을 남기라고 한다. 검증자가 `be76207` 로 기입했다(`git cat-file -t be76207` → `commit`).
- 비고 5줄 이내: 충족(4문장, 링크로 상세 위임).
- PASS 시 archive 이동: 해당 없음(FAIL).

### Commit / reference 정합성

- trailer 허용값 ✅ — `Agent: claude` · `Status: implemented` · `Criteria-Met: 8/8` · `Verified-By: pending`. 구현 주체가 Claude 인 것은 root `AGENTS.md` 가 리팩토링에 허용한 형태다.
- trailer 파싱 ✅ — `git log -1 --format='%(trailers:only=true)' be76207` 이 7키를 그대로 돌려준다.
- 인용 해시 실재 ✅ — `2eecb58` · `be76207` 둘 다 `git cat-file -t` 가 `commit`.
- **`[구현자 기입]` 필드 수: 3/7 — 미충족(D5).** impl §8 은 *설계 리뷰 · 강제 지점 전수 · **이번 라운드 수정의 잠금** · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals* 7개를 요구하고 "해당 없는 필드도 지우지 말고 `해당 없음`으로 남긴다"고 적는다. plan 에는 강제 지점 전수·구현 보고·놓친 잠재 문제 3개뿐이다.
- 이동/삭제한 reference·script: `canonicalProviderKey` 외 삭제 없음. `sourceFiles`·`stripCommentsAndStrings` 는 `infra/source-scan.ts` 에 살아 있고 다른 두 가드가 소비한다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| §17 "되돌린 것 2건" — 잠금이 반박했다 | **타당** | M-12·M-13 이 같은 red 를 재현했다. 되돌림이 옳다 |
| §17 "채택하지 않은 8건" | **타당** | D-002/D-007 선과 일치. 되풀이 방지 기록으로 유지 |
| `[구현자 기입]` "12/12 전건 green" | **부분 불일치** | 재측정 11✅·1⚠️ — §10 2행의 장치가 축에 눈이 없다 |
| `[구현자 기입]` "AC 8/8 충족" | **불일치** | 재측정 7✅·1❌ |
| §13 "미초기화 접근이 컴파일 에러" | **사실 아님** | D3 |

## 13. 파생 이슈

- [ ] **D1 — `assertMutable` 의 key 정규화 복원.** `engine.ts:46` 이 raw key 를 `isReadOnly` 에 넘겨 `'claude-  corp'` 류가 read-only 가드를 지난다. 하류 `normalizeProvider` 가 공백을 지워 같은 provider 에 도달한다. **(규범 정정 필요)** — D-005 의 근거 문장("두 함수는 같은 값을 낸다")이 거짓이므로 Decision 행과 §10 신설(“read-only 판정 전 key 정규화”)이 함께 필요하다.
- [ ] **D2 — `catalog.merge` 의 `adapter === undefined` 분기에 잠금을 세운다.** M-15(settings 전량 폐기)·M-2(신설 필터 소거)가 미검출이다. `misc.runtime-catalog.test.ts` 가 production `merge` 를 지나게 하거나, 실 카탈로그로 `orca:agent:list` 를 덮는 테스트를 세운다.
- [ ] **D3 — plan §13 문장 정정.** 클로저 사용은 컴파일 에러가 아니라 런타임 `ReferenceError` 다(`tsc --noEmit --strict` exit 0 재현). **(규범 정정 필요)**
- [ ] **D4 — plan §9·§11·§18 에 `claude/available-models.ts`·`claude/model-parser.ts` 를 기재한다.** 동작은 보존됐으나 영향 범위 신고가 빠졌다. **(규범 정정 필요)**
- [ ] **D5 — `[구현자 기입]` 을 impl §8 의 7필드로 채운다.** 특히 빠진 `이번 라운드 수정의 잠금` 이 D2·W1 이 드러난 축이다.
- [ ] D6 — AC2 인용 수치 정정(`4 단언` → 18 · `15 테스트` → 13). 기준 자체는 충족이다.
- [x] D7 — INDEX `대상 커밋` 에 `be76207` 기입(본 검증 턴에서 처리).

> W1(Composer 효과 잠금 부재)·W2(카탈로그 부재 폴백)는 결함이 아니라 관측 부족·미도달이라 이슈로 올리지 않고 §4 에 남긴다.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: **없음**(r1). 다만 D2 는 0198 이 여러 라운드에 걸쳐 배운 "테스트가 production symbol 을 지나는가" 축과 같다.
- 관련 plan 지침/AC 의 존재: **있었다.** plan §7 "AC 검증 주의사항" 이 "음성 스윕만으로 배선을 잠갔다고 읽지 마라" 고 스스로 적었고, AC3~AC6 은 전부 음성 술어다 — 그 경고가 가리킨 실재 축(§10 2행)이 실제로 비어 있었다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: better-sqlite3 ABI 로 DB 5파일 42케이스가 red. 0180·0198 과 같은 집합이다.
- 현재 라운드 수: 1.

## 15. 결론

- 상태: **FAIL**.
- Product/UX 및 ACTIVE Decision: D-003·D-004·D-006·D-007 충족. **D-001 미충족**(D1) · **D-005 전제 거짓**(D1).
- AC 충족: **✅7 · ❌1 / 8** — 자기보고 `8/8` 과 갈린다.
- 강제 지점: **✅11 · ⚠️1 / 12** — 자기보고 `12/12` 와 갈린다.
- 기준 밖 결함: D1(가드 fail-open) · D2(신설 표면 잠금 부재) · D3(§13 주장 오류) · D4(영향 범위 누락).
- repository operation: INDEX 대상 커밋 미기입(검증자 처리) · `[구현자 기입]` 3/7 필드.
- 남은 사람 확인: **없음**.
- 다음 단계: D1·D3·D4 가 `규범 정정 필요` 를 달았으므로 **다음 주체는 설계자**다. 규범 행 정정 후 D1·D2·D5 구현.
