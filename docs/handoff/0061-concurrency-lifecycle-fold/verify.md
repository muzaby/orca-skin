# Verify — 0061-concurrency-lifecycle-fold

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 verify 는 0061(0051 §A.2 결정 2 해소 — `orchestration/concurrency.ts` 를 라이프사이클 자원으로 재분류해 `lifecycle/` 로 fold, `orchestration/` 이름은 Future 오케스트레이션용 예약)을 대조한다. 비기능 리팩터 = Claude 직접 수행(plan+impl+verify). 검증 중 **비판적 검토에서 도출한 F2(네이밍 미완)를 사용자 결정에 따라 verify 선조치로 해소**했다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0061-concurrency-lifecycle-fold` |
| 검증자 | Claude Code |
| 일자 | 2026-07-01 |
| 대상 커밋 | fold `188526d` + verify 선조치 리네임(본 검증 커밋) |
| 라운드 | 1 |
| 상태 | **PASS** (5/5 충족 + F2 리네임 선조치) |

## 비판적 검토 요약 (수석엔지니어 실무 관점)

> 사용자 요청: verify 진입 전 모듈화/추상화가 잘 됐는지 비판적 검토. 결과 = **동작 보존 이동으로서 구현 품질 높음.** 지적 5건 중 F2 를 사용자 결정으로 verify 에서 해소.

| # | 지적 | 처리 |
|---|---|---|
| 잘된 점 | git rename 최소 diff·클래스 로직 불변 / 새 헤더 주석이 두 "동시성" 개념 분리 / 빈 `orchestration/` 제거+문서예약(YAGNI) / 설계서 §A.2·§A.4·⑭·P1표 일관 갱신 | — |
| **F1** | 커밋 trailer `Agent: codex` 가 plan 의 "구현 주체 Claude"(비기능=Claude 직접)와 모순 → 메시지-버스 무결성 저해 | **본 검증 커밋 본문서 정정 명시**(과거 커밋 rewrite 없음). 아래 §위생 노트 |
| **F2** | 디렉토리는 fold 했으나 클래스/파일명은 여전히 `Concurrency` — `runtime-cap-policy.ts`(다른 동시성)와 한 폴더에 이름 충돌, 주석으로 봉합. 실체는 *프로젝트별 active turn 카운터*이고 객체를 보관/조회 안 하므로 `Registry` 도 부정확 | **사용자 결정(2026-07-01): verify 선조치로 리네임** → `ActiveTurnTracker`. 아래 §F2 리네임 |
| F3 | 두 카운터(active turn vs pool population)가 네이밍 구분 없이 `lifecycle/` 공존 | F2 리네임이 근본 완화(이제 `active-turn-tracker.ts` vs `runtime-cap-policy.ts`) |
| F4 | AGENTS.md L1 목록에서 `orchestration` 제거하며 `prompts` 추가 = plan AC #2 범위 밖(무해·타당한 정확도 수정) | 위생 노트 기록, 별도 조치 불요 |
| F5(경미) | active turn 카운트가 "라이프사이클 자원"인지 "admission/UX 입력"인지 판별식이 느슨 | admission/cap·소유자 Supervisor 가 이미 `lifecycle/` → fold 방어 가능. 철학적 지적으로만 기록 |

## F2 리네임 선조치 (기능↔명명 정합)

**원칙: main 프로세스 *내부 자원 회계 식별자*만 리네임. IPC/UX 경계 어휘("concurrency")는 보존 → AC5 "IPC 무변경" 유지.** 경계에서는 유저 대면 "동시 실행 경고"가 옳은 말이고, 리네임하면 preload/renderer/store/IPC 계약까지 번져 불변식을 깬다. 내부 기전만 active-turn 카운터라 그 이름을 이 모듈에 국한한다.

| before | after | 위치 |
|---|---|---|
| `lifecycle/concurrency.ts`(+`.test.ts`) | `lifecycle/active-turn-tracker.ts`(+`.test.ts`) | git rename |
| class `ConcurrencyRegistry` | class `ActiveTurnTracker` | active-turn-tracker.ts |
| type `ConcurrencyListener` | type `ActiveTurnCountListener` | active-turn-tracker.ts |
| interface `ConcurrencyGate` | interface `ActiveTurnGate` | turn-coordinator.ts:54 |
| dep 키 `concurrency` | `activeTurns` | turn-coordinator.ts deps·send.ts:401·turn-coordinator.test.ts |
| 필드 `concurrencyRegistry`·옵션/getter `concurrency` | `activeTurnTracker`·`activeTurns` | supervisor.ts:37/47/54/59·supervisor.test.ts |
| import `../lifecycle/concurrency` | `../lifecycle/active-turn-tracker` | router.ts:45·supervisor.ts:22 |

**보존(무변경)**: `CHANNELS.concurrencyEvent`(`orca:concurrency:event`)·`broadcastConcurrency`·`ConcurrencyEvent` 타입·preload `window.orca.concurrency`·renderer `concurrencyApi`/`concurrencyByProjectId`. onChange payload 시그니처 `(projectId, count)` 불변.

**리네임 후 잔여 grep**: `rg "ConcurrencyRegistry|ConcurrencyGate|ConcurrencyListener" app/src` = **0**. `rg "concurrency|Concurrency" app/src/main` = IPC 경계(`broadcastConcurrency`·`ConcurrencyEvent`·`CHANNELS.concurrencyEvent`) + 설명 주석 2건만 = 의도된 보존.

## 이름 선정 근거

`ActiveTurnTracker` 는 `Map<projectId, number>` 를 들고 `increment`/`decrement`/`getCount` + `onChange` 통지 → **active turn 을 세고 변화를 관찰·통지**한다. 객체를 보관/조회하지 않으므로 코드베이스의 `Registry`(=`SessionRuntimeRegistry`·`SessionRegistry`, 실 객체 보관·조회)와 구별. 단순 tally(`Counter`)를 넘어 상태 변화를 전파하는 성격이라 사용자가 `Tracker` 로 확정. 파티션 키(projectId)는 `getCount(projectId)` 시그니처가 이미 노출.

## 요구사항 충족 매트릭스 (plan AC)

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `orchestration/concurrency.ts`(+test) `lifecycle/` 이동·`orchestration/` 디렉토리 제거 | ✅ | fold 커밋 `188526d`; `ls app/src/main` 에 `orchestration/` 없음. verify 선조치로 `lifecycle/active-turn-tracker.ts`(+test) 로 추가 리네임 |
| 2 | import 3·주석 2·AGENTS.md 갱신 → `rg "orchestration/concurrency" app/src` 0건 | ✅ | `rg "orchestration/concurrency" app/src`=0·`rg "orchestration" app/src`=`AGENTS.md:29`(이름 예약 문맥) 1건만 |
| 3 | 설계서 §A.2 "fold + 이름 예약"으로 갱신·"동시성=orchestration" 잔재 grep 0 | ✅ | `orca_lifecycle_orchestration_design_draft_ko.md` §A.2(357)·⑭(299)·§A.3(379) fold+리네임 정합. 잔재 0 |
| 4 | eslint 경계 위반 0·`import/no-cycle` 0 | ✅ | lint green. `active-turn-tracker`=L1 domain(`src/main/*` 와일드카드) 유지, 이동/리네임에 경계 무변 |
| 5 | 게이트 green·동작/이벤트/DB/IPC/UX 무변경(순수 이동+경로 문자열) | ✅ | §게이트 — 618 passed. 리네임도 IPC 채널·payload·renderer 무변경(§F2 보존 확인). 클래스 로직·시그니처 불변 |

## 회귀 커버 확인

- `active-turn-tracker.test.ts`(구 concurrency.test) — 프로젝트별 카운트/이벤트 왕복. green.
- `supervisor.test.ts` — `ActiveTurnTracker` 를 Supervisor 가 소유하고 `activeTurns` getter 로 노출(동적 import 경로 갱신). green.
- `turn-coordinator.test.ts` — `activeTurns.increment`/`decrement` 짝 일치(정상 1/1·2attempt 2/2 = 누수 0). green.

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/typecheck:test/test | ✅ | — | green — test **618 passed** |
| 인수 기준 ↔ 코드 대조 | ✅ 증거(`파일:라인`·grep·테스트) | 이견 시 중재 | 5/5 |
| F2 리네임 기능↔명명 정합 | ✅ | ✅ 이름 확정(`ActiveTurnTracker`) | 반영 완료 |
| 레이어 경계 위반 0 | ✅ | — | boundaries·no-cycle 0(L1 내부 이동·리네임) |
| IPC 무변경(경계 어휘 보존) | ✅ grep | — | `concurrencyEvent`/`concurrencyApi` 무변경 |
| 문서 형식/링크/한국어 | ✅ | — | 설계서·AGENTS.md 정합 |
| 실환경 GUI 회귀(동시 query 경고 배지·자기 inflight 차감) | ✖ | ✅ | 사람 실측 대기 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm rebuild better-sqlite3 && npm run typecheck && npm test && npm run lint
typecheck : PASS (node + web + test tsconfig, 출력 0)
test      : 618 passed (82 files) — 2 suites(persist·send.runtime-resilience) 는
            electron 바이너리 미설치 환경 제약으로 import 불가(0050~0060 동일 계열, 변경 무관)
lint      : PASS (eslint --cache --fix, boundaries·no-cycle 0)
```

- **better-sqlite3 ABI 노트**: `npm install` postinstall 이 Electron 39 ABI 로 빌드 → vitest(Node 22) 에서 `Module did not self-register`. `npm rebuild better-sqlite3`(Node ABI)로 해소 후 618 green. 0039·0050 계열과 동일 환경 절차.
- 리네임 전(fold 단독 `188526d`)·후 게이트 결과 동일(618 passed) → 리네임이 동작 무변경임을 확인.

## 위생 노트

- **F1(trailer 정정)**: 본 핸드오프 impl 은 비기능 리팩터로 **Claude 소관**(plan+impl+verify 직접 수행, plan 메타·root AGENTS.md 커밋 프로토콜)이다. fold 커밋 `188526d` 의 `Agent: codex` trailer 는 **오기**다. 과거 커밋은 rewrite 하지 않고 본 검증 커밋 본문서 정정한다(메시지-버스 진실 원천 = 본 verify + 검증 커밋).
- **F4(prompts)**: fold 커밋이 `app/src/main/AGENTS.md` L1 목록에서 `orchestration` 제거와 함께 `prompts` 를 추가했다. `prompts/`(handoff `cdb0e04` 이후 존재)가 L1 목록에 누락돼 있던 것을 바로잡은 정확도 수정 — plan AC #2 범위 밖이나 무해·타당. 별도 조치 불요.

## 다음 액션

- `Next-Action: none` — 인수 5/5 + F2 해소. Future(`orchestration/` 재생성 = handoff/fork/continuity) 는 별도 트리거 시.
- 사람 확인 대기: 실환경 동시 query 경고 배지 시각검증 · PR 머지.
