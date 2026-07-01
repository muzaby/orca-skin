# Verify — 0059-steer-queue-feedback

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 verify 는 0059(steer/queue enactment — 피드백 끼어들기 backend 기전 + renderer UX) + 파생 D1(렌더/영속 안정화)을 대조한다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0059-steer-queue-feedback` |
| 검증자 | Claude Code |
| 일자 | 2026-07-01 |
| 대상 커밋 | impl `a72e2bc`(Codex 원구현) + D1 `2feab72`(Claude) — INDEX/plan 기재 `7cefcbe` 는 Codex env hash(위생 노트 ①) |
| 라운드 | 1 |
| 상태 | **PASS** (12/14 충족 + 2 설계전환 보류) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰 — `chat:send` 중복을 암묵 steer 로 전환하지 않고 explicit `chat:steer` action path 로 분리 | **타당** — 명시 채널이 admission 정책 스왑(plan AC5)보다 계약이 선명하고 renderer 3상태 버튼과 결이 맞음 | AC5/AC8 을 "설계전환 보류"로 기록(FAIL 아님) |
| 놓친 문제 #1 pending optimistic ack 중복 → `clientRequestId` 재사용으로 replace | 타당·선조치 가능 범주 | 매트릭스 AC8 반영 |
| 놓친 문제 #2 feedbackMode 중단 버튼 → 단일 슬롯 3상태 토글 | 타당(사용자 피드백) | AC10 반영 |
| 놓친 문제 #3 pending renderer 오염 → `pendingSteer` transient(committed messages 미오염) | 타당 | AC11/AC13 반영 |
| 구현 체크리스트 미완 2건: `SteerQueuePolicy`+router 정책 스왑 · 게이트 green | 정책 스왑은 explicit 경로로 대체(보류), 게이트는 본 verify 가 재실행 | AC5 보류·게이트 §아래 |

## 요구사항 충족 매트릭스

> ① 기전(main+IPC) AC1~9 → ② UX(renderer) AC10~14. 1:1 대조·증거 첨부.

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | streaming-input `push`(+구 `onConsume`) | ✅ | `app/src/main/adapters/streaming-input.ts:22-25,56-61` `push`=queue.push+wake. (구 `onConsume` 은 0060 이 turn 경계로 대체 — 아래 D2/0060 verify) |
| 2 | 포트 `injectMessage`/`canSteer` + claude/mock 배선 | ✅ | 포트 확장·claude push 배선·mock no-op |
| 3 | `SteerQueue`(신규 L1 순수) | ✅ | `app/src/main/lifecycle/steer-queue.ts` — enqueue/cancel/pending/`drainForFlush`(multi→single `\n\n` 병합, `steer-queue.ts:49-58`). 단위 테스트 green |
| 4 | TurnCoordinator `steer`(drain→persist∥forward) | ✅ | `lifecycle/turn-coordinator.ts:98-115` `consumeSteerForInput` = drain→`persistSteerUserMessage`∥`forward(steer.flushed)` |
| **5** | **`SteerQueuePolicy` admission swap + router 정책 스왑** | ⚠️ **보류(설계전환)** | 구현자가 explicit `chat:steer` 채널로 전환 → admission 암묵 steer 미구현. impl 보고 `Criteria-Met 12/14` 명시. 기능은 explicit 경로로 end-to-end 동작 |
| 6 | enactment(L3) + `chat:steerCancel` | ✅(explicit 경로) | `ipc/chat/send.ts` `chat:steer`/`chat:steerCancel` 핸들러 + `turn-coordinator.ts:77-80` `cancelSteer` |
| 7 | 영속 규칙(pending 미영속·flush 시 user 1행·마이그레이션 0) | ✅ | `ipc/chat/persist.ts:49-64` `persistSteerUserMessage` — flush 시에만 appendMessage. 스키마 무변경 |
| 8 | IPC 계약(채널 `steer`/`steerCancel` + variant `steer.queued/flushed/cancelled`) | ✅ (카운트는 선조치로 정정) | 채널 rows `IPC_CONTRACT.md:34-35` + §3 variant `288-290`. **채널 수 카운트(총 52→54·chat 4→6) 미갱신분을 verify 선조치로 정정**(§위생) — `CHANNELS` 상수 실측 54/chat 6 과 일치 |
| 9 | 레이어 경계·무회귀(steer 미사용 경로 0 변경) | ✅ | `npm run lint`(boundaries·no-cycle) 통과. 신규 L1 `steer-queue` 하향 의존만 |
| 10 | 컴포저 feedbackMode(placeholder·토글·중단 복귀) | ✅ | `renderer/.../components/Composer.tsx` — 단일 슬롯 3상태 토글(입력 비면 stop 복귀) |
| 11 | pending 버블(연하게/기울임) | ✅ | `transcript/PendingSteerTurn.tsx:32` `text-body italic text-ink3`·맨 아래(`items-end`) |
| 12 | hover 취소 + draft 재주입 | ✅ | `PendingSteerTurn.tsx:17-29` `group/msg`+`group-hover/msg:` 스코프 격리 취소 버튼 → `cancelSteer(id)`→`onRestoreDraft` |
| 13 | flush(단일 user 턴, 정상 폰트) | ✅ (D1 재설계) | store `APPEND_COMMITTED_USER_MESSAGE`(즉시 일반 커밋 전환) — `flushedSteer` 오버레이 제거 |
| 14 | UX 무회귀·시각검증 | 사람 대기 | 폰트·multi→single·툴팁·hover 취소는 §책임 분리(시각 검증) |

### 파생 D1 (해결 확인)

| 항목 | 확인 |
|---|---|
| `flushedSteer`/`FlushedSteerState` 오버레이 개념 제거 | `rg 'flushedSteer|FlushedSteerState' app/src` **0건** |
| pending 항상 연회색/기울임·맨 아래 | `PendingSteerTurn.tsx:32` `italic text-ink3` |
| flush 경계 DB 정렬 `[응답-전][steer user][응답-후]` = 라이브·재로드 일치 | `persist.ts:49-64` — 진행 중 assistant `markMessageComplete`+reset 후 steer row append → 이후 파트는 `ensureAssistantMessage` 가 새 메시지로 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/typecheck:test/test | ✅ | — | green — test **618 passed** |
| 인수 기준 ↔ 코드 대조 | ✅ 증거(`파일:라인`) | 이견 시 중재 | 12/14 + 2 보류 |
| 레이어 경계 위반 0 | ✅ | — | boundaries·no-cycle 0 |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT 카운트 선조치 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 해당 없음(AGENTS.md 무변경) |
| 제품 의도 부합(explicit chat:steer 로 AC5 전환) | ✖ 보조 | ✅ 결정 | **사용자 확인 권고** — 설계전환 승인 여부 |
| Open Question(큐 소비 시점 interrupt vs sequential) | ✖ | ✅ | 0060 이 관찰-경계 flush 로 방향 확정 |
| UI/UX 시각 검증(pending 폰트·flush 위치·재시작 후 동일 렌더·hover 취소 재주입) | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm rebuild better-sqlite3 && npm run lint && npm run typecheck && npm run typecheck:test && npm test
lint      : PASS (eslint --cache --fix, 출력 0)
typecheck : PASS (node + web + test tsconfig 3종)
test      : Test Files 2 failed | 82 passed (84) / Tests 618 passed (618)
  - 실패 2 suite: persist.test.ts · send.runtime-resilience.test.ts
    → "Electron failed to install correctly" (electron 바이너리 미설치, import 단계 실패)
    → 0050~0058 동일 환경 제약, 본 변경과 무관(0 test = 어서션 실패 아님)
$ npx vitest run steer-queue.test turn-coordinator.test streaming-input.test
  Test Files 3 passed (3) / Tests 19 passed (19)
```

## 위생 검토

- **verify 선조치 (Claude 문서 수정)**: `docs/IPC_CONTRACT.md` §2 채널 수 카운트를 실측과 정합화 —
  `총 52 채널`→`총 54`, 분포 `chat 4`→`chat 6`(`send·event·cancel·stopSubagent·steer·steerCancel`).
  0059 가 `chat:steer`+`chat:steerCancel` 2채널을 추가하며 rows·§3 variant 는 갱신했으나 카운트 숫자만
  뒤처진 AC8 미충족분. `src/shared/ipc.ts` `CHANNELS` 실측(54/chat 6)과 일치 확인.
- 키/토큰/이메일/IP 패턴: 변경 문서(IPC_CONTRACT 카운트 2곳)에 비밀 혼입 없음.
- **위생 노트 ①**: INDEX/plan 대상 커밋 `7cefcbe`(Codex env) → 본 브랜치 실 impl `a72e2bc`(+D1 `2feab72`). 기존 다수 핸드오프 동형.

## PHASES.md 정합성

- 0059 행을 lifecycle P1 시리즈(0050~0058) 형식으로 승격. 커밋 `a72e2bc`(+D1 `2feab72`) 기재.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: plan AC5(`SteerQueuePolicy` admission swap)가 explicit `chat:steer` 로 대체될 여지를
  설계 시점에 열어두지 않아, 구현 전환이 "인수 기준 미달"처럼 보이게 됨. 향후 admission↔explicit 는
  설계에서 택일해 AC 를 확정하는 게 낫다.
- 구현 단계: IPC_CONTRACT 채널 rows·variant 는 갱신하면서 카운트 숫자를 놓침(기계적 누락). §6 절차의
  "총 채널 수 동시 갱신"을 impl 게이트로 강제할 장치가 없음(관례 의존).
- 검증 단계: 이번 verify 는 코드·테스트·게이트를 대조했으나 renderer UX(pending 폰트·flush 위치·재시작
  후 동일 렌더)는 시각 검증 범위라 판정 불가 — 사람 확인으로 분리.

## 결론 / 다음 단계

- **상태: PASS** — 인수 12/14 충족 + 2 설계전환 보류(AC5 admission swap · AC8 카운트=선조치로 해소).
  파생 D1 해결 확인. 게이트 green(test 618). → PHASES 승격.
- 사람 확인 대기: explicit `chat:steer` 설계전환 승인 · renderer UX 시각 검증 · PR 머지.
- 후속: steer flush **경계 교정**은 파생 D2 → 별도 핸드오프 `0060-steer-flush-boundary`(본 verify 와 동시 검증).
