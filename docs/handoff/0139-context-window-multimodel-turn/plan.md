# Plan — 0139-context-window-multimodel-turn

> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0139-context-window-multimodel-turn` |
| 작성자 | Claude Code |
| 일자 | 2026-07-22 |
| 매핑 | PHASES "현재 작업 중" |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "sonnet5 사용 중, 도구·서브에이전트를 쓰는 긴 턴에서 도넛 컨텍스트 윈도우가 200k 로 반환된다. 수석 엔지니어 관점에서 비판적으로 검토하라" + "도구 사용 시 200k 로 바뀌고 이후 도구 없이 대화해도 복원되지 않는다" + "제목 생성 haiku 가 덮어쓰는 것 같으니 검토하라"(+실증: available model 에서 haiku 제거 시 현상 소멸) + 수정 방향 질의에 **"메인 모델을 승격하는 것만 구현"** 선택 | 라이브 세션 요청 (2026-07-22) |
| 명시 제약 | **"메인은 세션 진행 중에도 사용자에 의해 언제든 바뀔 수 있으니 주의하라"** | 라이브 세션 요청 |
| 추론 의도 | 제목 haiku 오염 벡터 차단(B: 타이밍/cwd 격리)은 CLI 집계 동작 추정 의존이라 사람 실기 확인 후 별도 검토 — 이번엔 결정론적 분모 승격(A)만. (추론 — 사용자가 A 만 명시 선택) | (근거) 수정 방향 질의 응답 |

## Context (왜)

컨텍스트 도넛 분모는 `contextWindowOf(telemetry)` 가 ① top-level `contextWindow` ② `modelUsage[model].contextWindow` ③ 모델명 휴리스틱 순으로 해석한다(0134). 그런데 `claude-map.ts` 의 top-level 승격이 **`modelUsage` 키가 정확히 1개일 때만** 일어난다. 도구·서브에이전트(다른 모델) 또는 동시 실행 제목 haiku 로 `result.modelUsage` 에 키가 2개 이상이면 top-level `model`/`contextWindow` 가 **둘 다 미설정** → 렌더러가 `contextWindowFor(undefined)` = **200k** 로 붕괴한다. 더구나 `modelUsage` 는 **턴 누적**(`claude-map.ts:432` 주석)이라, 한 번 haiku 가 섞이면 그 세션의 이후 모든 result 가 다중 키를 유지 → **200k 고착, 도구 없는 순수 대화로도 복원 불가**(사용자 2차 증상). 실증(사용자): available model 에서 haiku 제거 시 현상 소멸.

핵심: 필요한 데이터(`modelUsage[main].contextWindow`)는 이미 전달된다. 빠진 건 "여러 모델 중 무엇이 메인인가"뿐이고, 그건 **마지막 non-child assistant(`parent_tool_use_id` 없음)의 `message.model`** 로 결정론적으로 안다. 이번 턴 메인 모델의 window 를 멀티모델 턴에서도 top-level 로 승격해 분모 붕괴/고착을 끊는다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| top-level 승격이 `models.length === 1` 게이트에만 걸림 → 멀티모델 턴 미승격 | `app/src/main/adapters/claude-map.ts` result 정규화 `models.length===1` 분기 |
| `modelUsage`·`model` 은 **턴 누적** — result 값 유지 → haiku 키 세션 잔류(고착) | `app/src/main/adapters/claude-map.ts:432` 주석 |
| 렌더러 분모 진입점 `contextWindowOf` ①②③ 우선순위 — top-level 만 채워지면 자동 정답(무변경) | `app/src/renderer/src/features/chat/lib/contextWindow.ts:35-43` |
| child(서브에이전트) assistant 판별 = `parent_tool_use_id` (readParentToolRunId) | `app/src/main/adapters/claude-map.ts` assistant 분기 |
| 복원 경로는 `primaryModel(modelRows)`(최다 input_tokens)로 이미 메인 판정 — 라이브 경로만 포기(일관성 결함) | `app/src/main/features/usage/usage-map.ts:41` |
| 제목 생성 `complete()` 는 `persistSession:false`+resume 없음+telemetry 폐기(코드상 격리) — 그러나 실증상 haiku 제거 시 현상 소멸 → 메인 턴 result.modelUsage 에 haiku 유입(동시 실행 cwd 공유 등 CLI 집계 추정) | `app/src/main/adapters/claude.ts:246-268` · `bootstrap.ts:462`(maybeStart on session.updated) · 사용자 실증 |
| `contextWindow` DB 미영속 → 복원은 휴리스틱 폴백 | `app/src/main/features/usage/subscriber.ts:39-47` · `usage-map.ts` |

## 인수 기준 (Acceptance Criteria)

1. `MapContext` 에 턴-스코프 `mainModel?: string` 필드가 추가되고, assistant 분기에서 **non-child(`parentToolRunId===undefined`)** 이며 `message.model` 이 비지 않은 문자열일 때만 `ctx.mainModel` 을 갱신한다(child/서브에이전트 제외).
2. result 정규화가 top-level 승격 대상 `primary` 를 선택한다: 단일 모델이면 그 모델, 멀티모델이면 `ctx.mainModel` 이 `modelUsage` 에 실제 존재할 때 그 모델. 어느 경우도 아니면 미승격(렌더러 폴백). `primary` 확정 시 `out.model` + (window 존재 시)`out.contextWindow` 를 승격한다.
3. 멀티모델 턴(메인 sonnet-5 + child haiku)에서 정규화 telemetry 의 `model==='claude-sonnet-5'`·`contextWindow===1_000_000`.
4. 누적 `modelUsage` 에 haiku 가 남은 **순수 대화 턴**(메인 sonnet-5, child 없음)도 `contextWindow===1_000_000` (200k 고착 방지).
5. 세션 중 모델 전환 — 이번 턴 메인이 haiku 면 `contextWindow===200_000` (이번 턴 메인 추종, 세션 캐시 아님).
6. 메인 모델이 `modelUsage` 에 없으면 미승격(`model`/`contextWindow` 모두 undefined) → 렌더러 휴리스틱 폴백.
7. 렌더러 `contextWindowOf` 무변경, 기존 소비자·복원 경로 무회귀. `contextWindow.test.ts` 의 오해 소지 케이스(top-level 부재=폴백) 재정의 + 승격 케이스 추가.
8. 게이트: `npm run lint` 0 error + `npm run typecheck` 3분할 0 + vitest 순수 스위트 green(DB 로드 스위트는 electron ABI egress 베이스라인 분리).

## 범위 / 비범위

- **범위**: AC1~8. `claude-map.ts`(MapContext·assistant 캡처·result 승격) + 테스트(claude-map·contextWindow) + 문서 동기(provider-runtime §8 주석).
- **비범위**:
  - **B: 제목 haiku 오염 차단**(maybeStart 타이밍 `telemetry`-only 이동 / 제목 query cwd 격리) — 사용자가 A 만 선택. CLI 집계 동작 추정 의존이라 A 적용 후 사람 실기(메인 턴 raw modelUsage 로그)로 벡터 확인 뒤 별도 핸드오프.
  - **분자 스냅샷 child 오염 가드**(`lastAssistantUsage` 갱신에 non-child 가드 추가) — 2차 관찰. 실무상 메인 assistant 가 말미라 대개 자가 교정. 범위 밖(분모 승격만).
  - **contextWindow DB 영속** — 0134 에서 비범위 유지(휴리스틱 폴백이 현행 모델 커버).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 의존: 기존 `assignNums`·`readParentToolRunId`·SDK result `modelUsage[].contextWindow`(0134). **신규 의존성 없음.**
- 전제: `MapContext` 는 턴 1회 생성(`claude-map.ts:29`)이라 `ctx.mainModel` 은 자동으로 턴-스코프 = 세션 중 모델 변경 매 턴 추종(사용자 제약 충족).

## 설계

- **`MapContext`**: `mainModel?: string` 추가(턴-스코프, 세션 캐시 금지 명시 주석).
- **assistant 분기**: child 판별 직후 `if (parentToolRunId === undefined && typeof m?.model === 'string' && m.model !== '') ctx.mainModel = m.model`.
- **result 정규화**(`normalizeResultTelemetry`): `ctx` 스코프 밖 순수 함수이므로 `mainModel?: string` 파라미터를 추가하고 호출부 `normalizeResultTelemetry(r, ctx.mainModel)`. 승격 분기를 `primary = models.length===1 ? models[0] : (mainModel && modelUsage[mainModel] ? mainModel : undefined)` 로 일반화, `primary` 확정 시 `out.model`/`out.contextWindow` 승격.
- 재사용: `assignNums`·`readParentToolRunId`·기존 테스트 헬퍼(`ctx()`/`sdk()`).
- 레이어: adapters 내부 변경 — 경계 무영향.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **순수 대화 턴 + 누적 haiku**: 메인 sonnet-5 캡처 → 1M 승격(고착 해소).
- **모델 전환 턴**: 이번 턴 메인 모델 추종(sonnet-5↔haiku 분모 즉시 전환).
- **메인 미판정**(assistant 없는 result / 메인이 modelUsage 부재): 미승격 → 렌더러 폴백(기존 동작 보존, 회귀 아님).
- **복원 경로**: 무변경(usage-map `primaryModel` + 휴리스틱).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 제목 haiku 오염 벡터 자체는 미해결(B 비범위) | 분모 승격은 벡터 무관하게 도넛을 정정 — 오염 유입이 남아도 표시는 정답. 벡터 차단은 실기 후 별도 검토 |
| 메인 판정이 `message.model` 정확도에 의존 | non-child 마지막 값 사용 + modelUsage 존재 가드 — 부정확/부재 시 안전하게 미승격(폴백) |

- 되돌리기 어려운 결정: 없음(additive).
- 단독 결정 금지 항목: 없음(신규 의존성 0, PRD §11/TRD §15 비저촉).

## 영향 받는 파일

- `app/src/main/adapters/claude-map.ts` (+ `claude-map.test.ts`)
- `app/src/renderer/src/features/chat/lib/contextWindow.test.ts`
- `docs/arch/backend/provider-runtime.md` (§8 주석)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck` + vitest 순수 스위트.
- 신규 테스트: 어댑터 정규화(멀티모델 승격·누적 고착 방지·모델 전환·메인 부재 방어) + 렌더러 폴백/승격.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구/제약(모델 가변)/추론(B 비범위)을 가르고 라이브 세션으로 인용.
- [x] 자료조사 — 모든 발견에 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호 1~8, 검증 가능.
- [x] 의존 기술 — 신규 의존성 0, ctx 턴-스코프 전제 명시.
- [x] 파생 UX — 순수턴/전환/미판정/복원 펼침.
- [x] 리스크 — B 비범위·판정 정확도와 완화책.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 버그수정 = Claude 직접 구현).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 전체. `ctx` 턴-스코프라 사용자 제약("메인 가변")이 별도 코드 없이 충족된다.
- 이견 없음. 단 구현 중 확인: `normalizeResultTelemetry` 는 `ctx` 비접근 순수 함수라 승격 로직을 그 안에 두면 `ctx` 참조 불가 — **`mainModel` 파라미터 전달**로 해소(설계 §result 정규화대로).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 초판에서 승격 블록이 `ctx.mainModel` 을 직접 참조 → `normalizeResultTelemetry` 스코프 밖 `ReferenceError` (vitest 6 fail) | ✅ `mainModel?: string` 파라미터 추가 + 호출부 `ctx.mainModel` 전달로 수정, 재실행 68/68 green | vitest 1차 실패 로그 |

## [구현자 기입] 구현 체크리스트

- [x] MapContext `mainModel` 필드
- [x] assistant non-child 모델 캡처
- [x] result 승격 일반화(mainModel 파라미터)
- [x] claude-map 테스트 4종 + 기존 2종 제목 정정
- [x] contextWindow 렌더러 테스트 재정의 + 승격 케이스
- [x] provider-runtime §8 주석 동기

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/adapters/{claude-map.ts,claude-map.test.ts}` · `app/src/renderer/src/features/chat/lib/contextWindow.test.ts` · `docs/arch/backend/provider-runtime.md` |
| 실행 명령 | `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`(postinstall electron ABI 실패 = egress 베이스라인) → `npm rebuild better-sqlite3`(Node ABI) → `npm run lint` → `npm run typecheck` → `./node_modules/.bin/vitest run` → `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint ✅ 0 error(1 pre-existing warning = TanStack Virtual) / typecheck ✅ 3분할 0 / vitest ✅ **1104/1104**(`chat-turn.continuity` 1파일 로드 실패 = electron egress 베이스라인) / scripts ✅ 25/25 |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `0b2b84a` |
