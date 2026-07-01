# Plan — 0061-concurrency-lifecycle-fold

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 본 plan 은 0051 §A.2 **결정 2**(출시 `orchestration/` 코드명 유지·리네임 연기)를 해소하는 **동작 보존 리팩터**다 — `orchestration/concurrency.ts` 를 라이프사이클 자원으로 재분류해 `lifecycle/` 로 접고, `orchestration/` 이름은 진짜 오케스트레이션(handoff/fork/continuity, Future)이 착지할 자리로 예약한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0061-concurrency-lifecycle-fold` |
| 작성자 | Claude Code |
| 일자 | 2026-07-01 |
| 매핑 | PHASES 행(0052~0060 lifecycle P1 시리즈의 택소노미 마감) / PR (요청 시) |
| 상태 | DRAFT → READY |
| 구현 주체 | **Claude** (비기능 리팩터 — plan→impl→verify 직접 수행) |
| 선행 | `0051-lifecycle-taxonomy-refinement`(택소노미 정본, 결정 2) · `0055-runtime-resource-governance`(ConcurrencyRegistry 소유 Supervisor 이관, 파일 미이동=결정 2 준수) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 0051 구현" → 비판적 검토로 P1 전부 착지 확인 후, 잔여 중 **`orchestration/` 리네임(결정 2 해소)** 을 0061 범위로 선택. 이어 목표 구조 = **concurrency→lifecycle 폴딩 + `orchestration/` 이름 예약** 확정. | 라이브 세션(2026-07-01, AskUserQuestion 3연속 응답) |
| 명시 요구 | 새 핸드오프 문서를 만들면 **문서만 만들고 멈춘다**(코드 impl 은 후속 트리거). | 라이브 세션(2026-07-01) |
| 추론 의도 | 이 리팩터로 0052~0060 이 완성한 라이프사이클 P1 시리즈의 **개념↔코드 정합**을 마감하고, `orchestration/` 이름이 나중 진짜 오케스트레이션에 재사용될 수 있게 비워둔다. | 설계자 해석(0051 §A.2 판별식 적용) |

## Context (왜)

0051 §A.2 는 **동시성(cap/LRU/idle-close/registry)이 세는 유닛 = SessionRuntime = 자원**이므로 "세션 간 동시성"은 오케스트레이션이 아니라 **§2 리소스/프로세스 라이프사이클**이라고 교정했다. 판별식: *없으면 리소스가 샌다 → 라이프사이클 / 없으면 작업이 안 엮인다 → 오케스트레이션*. `ConcurrencyRegistry`(프로젝트별 turn count)는 전자다.

당시 결정 2 는 리스크 회피로 **코드명(`orchestration/`)을 유지하고 문서만 정제**했다(리네임은 별도 핸드오프). 0055 가 소유를 `RuntimeSupervisor`(`lifecycle/`)로 이관했으나 **파일은 결정 2 준수로 `orchestration/` 에 남겼다**(`app/src/main/lifecycle/supervisor.ts:13` 주석). 그 결과:

- `orchestration/` 디렉토리 안에는 **진짜 오케스트레이션이 하나도 없다** — 라이프사이클 자원 `concurrency.ts` 만 있다.
- 진짜 오케스트레이션 = "Orca Session 을 가로질러 인과적으로 엮기 = handoff/fork/continuity"(0051 §A.4)는 **아직 코드가 없는 Future**.

본 핸드오프가 결정 2 를 해소한다: `concurrency.ts` 를 소유자(Supervisor)가 사는 `lifecycle/` 로 접고, 빈 `orchestration/` 를 제거하며, 그 이름은 Future Continuity 착지 시 재생성하도록 문서에 예약한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 결정 2 원문("출시 `orchestration/` 코드명 유지·문서만 정제·리네임은 별도 핸드오프") + 판별식 | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A.2 · `@docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md`(리스크 표) |
| 진짜 오케스트레이션 = handoff 뿐(Future 서비스 층), 자원/프로세스로 환원 안 되는 유일 층 | `@docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A.2·§A.4 |
| `orchestration/` 현재 구성원 = `concurrency.ts` + `concurrency.test.ts` **둘뿐** | `app/src/main/orchestration/concurrency.ts` · `app/src/main/orchestration/concurrency.test.ts` |
| `concurrency.ts` 는 순수 leaf(import 0, `ConcurrencyRegistry` 클래스만) → `lifecycle/` 이동 시 순환 위험 0 | `app/src/main/orchestration/concurrency.ts:1-27` |
| 소유자 `RuntimeSupervisor` 는 이미 `lifecycle/` 에 있고 `ConcurrencyRegistry` 를 생성자 주입 사용 | `app/src/main/lifecycle/supervisor.ts:13,21` |
| `orchestration/concurrency` import 사이트 = **3곳**(supervisor·router·supervisor.test) | `app/src/main/lifecycle/supervisor.ts:21` · `app/src/main/ipc/router.ts:45` · `app/src/main/lifecycle/supervisor.test.ts:216` |
| `orchestration` 문자열 언급 = 위 3 import + 주석 2곳(turn-coordinator:52·supervisor:13) + `app/src/main/AGENTS.md:23`(L1 목록) | `rg orchestration app/src` |
| **eslint 무변경**: L1 은 와일드카드 `{ type: 'domain', pattern: 'src/main/*', mode: 'folder' }` 로 매핑 — 이동/제거된 폴더 자동 L1 유지. config 에 `orchestration` 리터럴 없음 | `app/eslint.config.mjs:120` · `app/src/main/AGENTS.md`(레이어 매핑 표) |
| 동시성 카운트 경로 회귀 커버 = `supervisor.test.ts`(동적 import 로 ConcurrencyRegistry 검증) | `app/src/main/lifecycle/supervisor.test.ts:216` |

## 인수 기준 (Acceptance Criteria)

1. `app/src/main/orchestration/concurrency.ts` → `app/src/main/lifecycle/concurrency.ts` 이동(+`concurrency.test.ts` 동반 이동), `app/src/main/orchestration/` 디렉토리 제거.
2. import 3곳(supervisor `'./concurrency'`·router `'../lifecycle/concurrency'`·supervisor.test 동적 import) + 주석 2곳(turn-coordinator:52·supervisor:13) + `app/src/main/AGENTS.md` L1 목록에서 `orchestration` 제거 갱신 → `rg "orchestration/concurrency" app/src` **0건**.
3. 설계서 §A.2 결정 2 서술이 "fold + 이름 예약(Future Continuity 시 재생성)"으로 갱신. 코드/문서에서 `orchestration` 잔여 참조가 **"이름 예약" 문맥만** 남고 "동시성=orchestration" 잔재 0(grep 모순 0).
4. eslint 무변경으로 레이어 경계 위반 0 — `concurrency`(L1 domain)·`import/no-cycle` 0.
5. 게이트 `npm run lint && npm run typecheck && npm test` green. 동작·이벤트·DB·IPC·UX 무변경(순수 파일 이동 + 경로 문자열).

## 범위 / 비범위

- **범위**: `concurrency.ts`(+test) `lifecycle/` 이동 · `orchestration/` 제거 · import 3/주석 2/AGENTS.md 1 갱신 · 설계서 §A.2 결정 2 정합.
- **비범위(후속·Future)**: 진짜 오케스트레이션(handoff/fork/continuity) 코드 신설 · `orchestration/` 즉시 재생성(YAGNI) · 0051 잔여 seam 활성화(스트리밍 입력 포트·cap 수치=Open Question) · Conversation Continuity 구현.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 사용: `lifecycle/supervisor.ts`·`ipc/router.ts`·`eslint.config.mjs` 와일드카드 L1 매핑.
- 전제: `concurrency.ts` 는 leaf 라 이동해도 순환·타입 회귀 없음(자료조사 근거).
- **신규 의존성 0.**

## 설계

- **파일 이동 + 경로 문자열 갱신**뿐인 동작 보존 리팩터. `ConcurrencyRegistry` 클래스 로직·시그니처 불변.
- 재사용: 소유자 `RuntimeSupervisor`(`lifecycle/supervisor.ts`) 와 코로케이션 — 같은 레이어(L1)·같은 디렉토리라 `import { ConcurrencyRegistry } from './concurrency'`.
- 레이어 경계: `lifecycle/`·`orchestration/` 모두 L1 domain(`src/main/*` 와일드카드) → 이동해도 L1 유지, `router.ts`(L3 ipc)→`lifecycle`(L1) 하향 의존 정상. eslint 손댈 것 없음.
- `orchestration/` 이름 예약은 **문서로만**: 설계서 §A.2 결정 2 를 "해소됨"으로 갱신하고, 진짜 오케스트레이션이 생길 때 신설한다고 명시.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

N/A — main 프로세스 내부 리팩터, 런타임 동작·렌더러·IPC 무변경.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 0051 이 채택한 결정 2("코드명 유지")를 뒤집음 | 사용자가 본 세션에서 명시적으로 리네임(fold)로 결정 — 원칙 3(문서 결정 임의변경 금지) 준수, **사용자 명시 결정으로 기록**. 설계서 §A.2 를 "해소됨"으로 동시 갱신. |
| `orchestration/` 를 지금 재생성하지 않아 빈 이름이 됨 | 의도적(YAGNI). 진짜 오케스트레이션(Continuity) 착지 시 신설. 예약 사실을 설계서 §A.2·§A.4 에 명시. |

- 되돌리기 쉬움(파일 이동 + 경로 문자열). 리스크 낮음.
- 단독 결정 금지 항목: 없음(범위 내 전부 사용자 확정 또는 기계적).

## 영향 받는 파일

- `app/src/main/orchestration/concurrency.ts` → `app/src/main/lifecycle/concurrency.ts` (이동)
- `app/src/main/orchestration/concurrency.test.ts` → `app/src/main/lifecycle/concurrency.test.ts` (이동)
- `app/src/main/lifecycle/supervisor.ts` (import:21 + 주석:13)
- `app/src/main/ipc/router.ts` (import:45)
- `app/src/main/lifecycle/supervisor.test.ts` (동적 import:216)
- `app/src/main/lifecycle/turn-coordinator.ts` (주석:52)
- `app/src/main/AGENTS.md` (L1 목록:23)
- `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` (§A.2 결정 2)

## 참고 문서

- `docs/etc/orca_lifecycle_orchestration_design_draft_ko.md` §A.2·§A.4 (택소노미·결정 2·Future 오케스트레이션)
- `docs/handoff/0051-lifecycle-taxonomy-refinement/plan.md` (결정 2 정본)
- `docs/handoff/0055-runtime-resource-governance/plan.md` (소유 이관·파일 미이동=결정 2 준수)
- `app/src/main/AGENTS.md` (L1 레이어 매핑)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 없음 — 기존 `concurrency.test.ts`·`supervisor.test.ts` 가 이동 후 동일 커버. `rg "orchestration/concurrency" app/src` 0건 확인.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션(2026-07-01) 3연속 결정 인용, 추론은 추론으로 표기.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…§`·`rg`).
- [x] 인수 기준 — 5개 번호·검증 가능(이동·grep 0건·문서 정합·경계 0·게이트).
- [x] 의존 기술 — 신규 의존성 0, leaf 이동 전제 근거.
- [x] 파생 UX — N/A 명시(내부 리팩터·동작 무변경).
- [x] 리스크 — 결정 2 뒤집기·이름 예약을 완화책과 함께, 단독 결정 금지 항목 없음.
