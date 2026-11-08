# Plan — 0299-concurrency-notice-turn-end-flicker

## 메타

| 항목 | 값 |
|---|---|
| slug | `0299-concurrency-notice-turn-end-flicker` |
| 작성자 | Claude Code |
| 일자 | 2026-11-07 (V1) · 2026-11-08 (ΔV1·ΔV2) |
| 매핑 | 버그수정(비기능) — 구현 주체 Claude |
| 상태 | READY (ΔV2) |
| V mode | `Baseline V` + `Delta V` |
| 기준 V | V1 `(검증자 기입 — 브랜치 커밋 28cffb4)` · ΔV1 `(검증자 기입 — 브랜치 커밋 75e1ab4)` — 둘 다 `main` 미병합 |
| 이번 V revision | `ΔV2` — 사용자 용어 정렬(D-011)·worktree 격리 결정(D-012). D-010 철회 |
| 유효 V | `V1 + ΔV1 + ΔV2` — 구현은 §7-B(유효 registry)와 Part II만 따른다 |

> **읽는 법.** Part I·Part II는 유효 V 기준으로 고쳐 썼다. V1·ΔV1 원문은 위 커밋에 있다.
> §7-A는 V1 처분, §7-C는 ΔV2가 ΔV1에서 바꾼 것만 적는다. V1·ΔV1은 구현·검증 전이라 이관할 실행 증거가 없다.

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 같은 작업경로의 다른 세션이 응답 중이 아닌데도, 보고 있는 세션의 응답이 끝날 때마다 경고 패널이 잠깐 나타났다 사라진다.
- 구조 원인(§8 R-01~R-08): 경고는 "같은 작업경로에서 응답 중인 세션 수"(main이 보냄)에서 "보고 있는 세션이 응답 중이면 1"(화면이 앎)을 빼서 정한다. 두 값은 다른 경로·다른 시점으로 도착하고 맞춰 주는 장치가 없다.
- 같은 구조가 만드는 증상(하네스 무관): 응답 종료 때 오탐(보고된 깜빡임) · Stop·즉시 보내기 직후 오탐 · 다른 세션이 응답 중일 때 보고 있는 세션에서 보내면 경고가 잠깐 사라짐(OpenCode 서버 준비 동안 길어짐).
- 완료 후 달라지는 것: 경고는 main이 보낸 "이 작업경로에서 지금 응답 중인 세션 목록"과 "보고 있는 세션이 누구인지"만으로 정해진다. 화면의 응답 중 표시와 도착 순서는 판정에 들어가지 않는다. worktree 격리 세션은 경고와 무관하다.
- 성공을 사용자 관점에서 한 문장으로: 같은 작업경로의 다른 세션이 응답하는 동안에만 경고가 끊김 없이 보이고, 혼자 작업하거나 격리 세션에서 작업할 때는 한 번도 보이지 않는다.

## 1-A. 용어 (D-011)

| 용어 | 뜻 | 코드 대응 |
|---|---|---|
| 작업경로 | 세션을 시작한 폴더. 같은 작업경로에 세션을 여러 개 열 수 있다 | 시작 폴더 경로로 식별되는 프로젝트 `projectId`(`project-binding.ts:6-28`, `persistence.md:124`) |
| 세션 | 대화 하나(왼쪽 목록의 한 줄) | Orca Session(`GLOSSARY`) |
| 보고 있는 세션 | 지금 컴포저에 띄운 세션. 앱은 창 하나에 컴포저 하나라 한 번에 하나다 | `sessions[activeKey]`(`index.ts:89,197`) |
| 응답 중 | 보낸 메시지에 어시스턴트가 답을 만드는 동안. 백그라운드 서브에이전트 대기·예약 수신 대기는 응답 중이 아니다 | 코드의 "턴" = 세션 하나의 응답 한 번(`TurnCoordinator.run`, listen 제외) |
| 격리 세션 | 앱이 만든 worktree에서 도는 세션 — 원본 작업경로와 분리된 공간 | `managed_worktrees` row가 묶인 세션 · 화면 `ChatState.worktree`·`worktreeIsolation` |
| 경고 패널 | 컴포저 위 "같은 프로젝트에서 다른 작업이 실행 중입니다" | `Composer.tsx:266-275` |
| 경고 조건 | 보고 있는 세션이 격리 세션이 아니고, 같은 작업경로를 쓰는 **다른 비격리 세션**이 응답 중일 때 | D-011·D-012 |

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "오픈코드 컴포저로 세션 시작 시, 어시스턴트의 답변이 끝날때(턴종료), 컴포저 상단에 같은 경로에서 1개 이상의 세션이 동작하는 경우에 대한 경고 패널이 떴다가 바로 사라진다. … 왜 이러현상이 매번 발생하는지 분석하고 원인 획인하라" | 라이브 세션 2026-11-07 |
| 명시 요구 | "Claude에서도 발상할수있는 구조적인 문제라면 구조적인 문제자체를 해결하도록 설계하라" | 라이브 세션 2026-11-08 |
| 명시 요구 | "현재 같은 작업경로에서 세션을 여러개 열 수 있다. 다만 깉은 경로에서 여러 세션이 열리면 컴포저 위에 경고패널이 안내되고 있다." · 경고 조건 확인 질문에 "1번 맞음" | 라이브 세션 2026-11-08 |
| 명시 요구 | "worktree는 격리된 공간으로 보기때문에 경고 패널 출력하지 말것. plan 갱신해" | 라이브 세션 2026-11-08 |
| 추론 의도 | 격리 세션은 원본 작업경로와 다른 공간이므로 양방향으로 경고와 무관하다 — 보고 있는 세션이 격리면 경고 없음, 격리 세션의 응답은 원본 작업경로 세션에 경고를 만들지 않음 | D-012 "격리된 공간" |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 응답 종료 때 경고가 깜빡이는 원인을 확인하고 없앤다 | 원문: "왜 이러현상이 매번 발생하는지 분석하고 원인 획인하라" | 사용자 2026-11-07 | ACTIVE | — |
| D-002 | 경고는 차단하지 않고, ×는 에피소드 단위다 | 기존 채택 동작 | `Composer.tsx:167-178` · `ko.ts:1099-1100` | ACTIVE | — |
| D-003 | 범위는 같은 원인의 모든 증상이다 — 응답 정상 종료·오류·중단·Stop·즉시 보내기·핸드오프 새 세션·시작 시 누락 | 한 판정식이 모든 경로에서 같은 방식으로 틀린다 | 설계(추론) | ACTIVE | — |
| D-004 | 하네스 무관하게 고친다 | 원인이 공통 코드에 있다(§8 R-05) | 설계 | ACTIVE | — |
| D-005 | 지연·디바운스로 가리지 않는다 | 진짜 경고를 늦추고 원인을 남긴다 | 설계 | ACTIVE | — |
| D-006 | 백그라운드 서브에이전트 대기·예약 수신 대기(listen)는 응답 중으로 세지 않는다 | 0143 결정 유지 | `turn-coordinator.ts:320-323` | ACTIVE | — |
| D-007 | IPC payload `{ projectId; count }` 유지 | — | V1 설계 | SUPERSEDED | D-009 |
| D-008 | 구조 원인 자체를 없앤다. 도착 순서·화면 표시 동기화에 기대는 보정을 쓰지 않는다 | 원문: "구조적인 문제라면 구조적인 문제자체를 해결하도록 설계하라" | 사용자 2026-11-08 | ACTIVE | — |
| D-009 | 보고 있는 세션 제외를 **신원**으로 한다. main은 작업경로별 응답 중 세션 신원 목록 `{ projectId; turns: ActiveTurnRef[] }`을 보내고 `count`는 없앤다. 화면의 응답 중 표시(`inflight`·`responding`·transport)는 판정 입력이 아니다 | 목록은 통째로 오고 신원 비교는 순서와 무관하다. `count`를 없애야 산술 판정이 다시 생기지 않는다 | 설계(D-008 이행) | ACTIVE | D-007 대체 |
| D-010 | 같은 세션을 다른 창에서 볼 때 그 세션의 응답도 자기로 본다 | 전제 오류 — 앱은 창이 하나라 그런 경우가 없다(`index.ts:89,197`) | ΔV1 설계 | SUPERSEDED | 철회(D-011 용어 정렬) |
| D-011 | 경고 조건 = 보고 있는 세션 말고 같은 작업경로의 다른 세션이 **응답 중**일 때. 열려 있기만 한 세션은 세지 않는다. 용어는 §1-A | 원문: "같은 작업경로에서 세션을 여러개 열 수 있다 … 경고패널이 안내되고 있다" + 확인 질문 "1번 맞음" | 사용자 2026-11-08 | ACTIVE | — |
| D-012 | worktree 격리 세션은 격리된 공간이다. (a) 보고 있는 세션이 격리 세션이면 경고 패널을 표시하지 않는다 (b) 격리 세션의 응답은 원본 작업경로 세션의 경고에 세지 않는다 (c) worktree 소실로 원본 경로로 복구된 세션은 다시 비격리다 | 원문: "worktree는 격리된 공간으로 보기때문에 경고 패널 출력하지 말것". (b)·(c)는 같은 이유("격리된 공간")를 반대쪽·복구 상태에 적용 | 사용자 2026-11-08 ((b)·(c) 설계 적용) | ACTIVE | — |

### 갱신 메모

- 이번 턴(ΔV2)에서 새로 추가된 결정: D-011(사용자) · D-012(사용자, (b)·(c)는 같은 이유의 적용).
- 변경된 결정: D-010 → 철회(SUPERSEDED). 사용자 지적 "같은 세션에서 동시에 두 턴... (x)" — 그 전제의 경우가 앱에 없다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001~D-006·D-008·D-009.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-002 ↔ §11(× 로직 미변경) · D-003 ↔ AC1~AC7 · D-004 ↔ AC14 · D-005 ↔ §9 TO-BE(타이머 없음) · D-006 ↔ AC11 · D-008 ↔ AC1~AC7·AC15~AC17의 "모든 도착 순서" · D-009 ↔ AC12·AC13 · D-011 ↔ AC6(응답 중인 다른 세션만) · D-012 (a) ↔ AC15 · (b) ↔ AC16 · (c) ↔ AC17.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 원인은 판정 구조다 | §8 R-01·R-04·R-09 |
| 이미 기존 코드가 충족하는가 | 아니오. 격리 세션도 원본 작업경로 프로젝트로 묶여 경고 대상이다 | `Composer.tsx:171` · `send.ts:340-348`(격리도 `preparedSourceCwd`로 프로젝트 바인딩) |
| 더 작은 해법이 있는가 | V1(순서 보정)은 IPC 도착 순서 전제와 화면 표시 전이 자리 추적이 남는다 — D-008이 배제 | §8 R-10 |
| 선행 자료의 주장을 코드와 대조했는가 | `IPC_CONTRACT.md:473` "Composer는 자기 inflight를 차감해" — 이 계약 문장이 구조 원인이다 | §8 R-11 |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | D-007·D-010만 대체. 격리 세션 판정은 기존 표시 정본(`managed_worktrees` row)을 그대로 쓴다 | §16 |

- 사용자에게 올릴 결정: 없음. D-012 (b)·(c)는 "격리된 공간"의 적용이며 사용자가 다르게 원하면 바꾼다.
- 코드 조사로 닫은 사실: 원인·증상·하네스 무관·산술 패턴 1곳·양쪽이 공유하는 신원(R-12~R-14)·격리 판정의 정본(R-17~R-20).

## 5. 동작 / 사용자 흐름

```text
main:   어떤 세션이 응답을 시작 → 그 세션이 비격리면 작업경로 목록에 {세션 신원} 추가
        새 세션 id 확정 → 신원 보강 / 응답 끝 → 목록에서 제거 (바뀔 때마다 목록을 통째로 전송)
        격리 세션의 응답은 어느 작업경로 목록에도 넣지 않는다
화면:   보고 있는 세션이 격리 세션 → 경고 없음
        아니면 다른 세션 수 = 최신 목록 − 보고 있는 세션과 같은 신원 → 0보다 크면 경고
  → 목록·채팅 이벤트·사용자 조작이 어떤 순서로 도착해도 결과가 같다
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 혼자 작업, 보고 있는 세션의 응답이 끝남(정상·오류·중단) | 목록에서 빠지기 전후 모두 자기 신원이라 제외 | 경고 없음 (AS-IS: 잠깐 표시) |
| 혼자 작업, Stop·즉시 보내기 | 같음 | 경고 없음 (AS-IS: 잠깐 표시) |
| 새 세션 첫 응답(세션 id 확정 전후) | 만들 때 쓴 임시 키로 일치, 확정 뒤에도 기억 | 경고 없음 |
| 같은 작업경로의 다른 세션 응답 중 + 보고 있는 세션에서 보냄(준비 대기 포함) | 다른 세션 항목은 계속 남음 | 경고 계속 표시 (AS-IS: 잠깐 사라짐) |
| 같은 작업경로의 다른 세션 응답 중 + 보고 있는 세션 응답 종료·Stop | 같음 | 경고 계속 표시 |
| 다른 세션 응답 끝 | 그 항목이 빠짐 | 경고 사라짐 |
| 같은 작업경로의 다른 세션이 열려 있기만 함 | 목록에 없음 | 경고 없음 (D-011) |
| 보고 있는 세션이 격리 세션(기존·첫 응답·랜딩에서 격리 켬) | 화면이 격리 판정 | 경고 없음 (D-012 a) |
| 격리 세션이 응답 중 + 원본 작업경로의 비격리 세션을 봄 | main이 목록에 넣지 않음 | 경고 없음 (D-012 b) |
| 격리 세션의 worktree가 사라져 원본 경로로 복구됨 | 이후 비격리로 계상·판정 | 같은 작업경로 규칙을 따름 (D-012 c) |

### 파생 UX / 엣지케이스

- loading / empty / error: 해당 없음 — 문구·스타일 불변.
- cancel / retry / close / restart: 재시도 중 목록 항목이 빠졌다 들어와도 자기 신원이라 무관. 앱 재시작·화면 reload 직후 목록은 다음 변경 때 온다(§10 B-3, 기존 동작).
- concurrency / multi-session: 왼쪽 목록의 다른 세션이 같은 작업경로에서 응답 중이면 경고. 대기열(`newChatQueue`)에 있는 아직 안 보낸 새 대화는 응답 중이 아니다.
- fork/핸드오프 새 세션: 화면·main 모두 비격리로 시작한다(§8 R-20) — 같은 작업경로 규칙을 따른다.
- keyboard / a11y / theme / 외부환경: 해당 없음.

## 6. 범위 / 비범위

- **범위**: IPC payload를 신원 목록으로 교체 · main 신원 계상과 격리 세션 제외 · 화면의 새 세션 임시 키 보존 · 신원·격리 판정 순수 함수와 selector · Composer 판정 교체 · worktree 복구 때 격리 의도 해제 · 계약 문서 · 테스트.
- **비범위**: 경고 문구(“같은 프로젝트에서…”)·디자인 · × 에피소드 로직(`Composer.tsx:172-178`, 코드 미변경) · 기동 직후 목록 초기 조회(§10 B-3) · 프로젝트 재바인딩 불일치(§10 B-4) · fork/핸드오프의 격리 상속(§10 B-6).

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 기동 시 목록 초기 조회 | 아니오 — 목록 형태라 조회 하나를 더하면 된다 | 후속 후보 |
| 경고 문구 "프로젝트" → "작업경로" | 아니오 — i18n 문자열 | 사용자 요청 시 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 혼자 작업, 응답 정상 종료 — 새 세션(id 확정 포함)·기존 세션 모두, 세 경로(사용자 조작·채팅 이벤트·목록)의 **모든 인터리빙**의 모든 접두에서 경고 판정 false | ST-02 P1·P2 | `TurnCoordinator` → tracker → `broadcastConcurrency` / `sendChatEvent` → `chatStore` → `Composer` |
| R-01 | AT-01 / AC2 | 응답이 오류·중단으로 끝나도 AC1과 같다 | ST-02 P3·P4 | 같음 |
| R-02 | AT-02 / AC3 | Stop — `cancel`을 보낸 뒤 어느 위치에 두어도(새 세션 id 확정 전 포함) false | ST-02 P5·P6 | `cancel()` → `chatCancel` → `interruptResponse` |
| R-02 | AT-02 / AC4 | 즉시 보내기 — 응답 중단 → 이어지는 응답 동안 false | ST-02 P7 | `chatSteerSendNow` → post-turn flush |
| R-01 | AT-01 / AC5 | main 예외·시작 전 중단·재시도 경로에서 목록 항목이 빠지고 남지 않는다 | IT-03 예외·재시도 케이스 | `turn-coordinator.ts` inner `finally` |
| R-03 | AT-03 / AC6 | 같은 작업경로의 다른 비격리 세션이 응답 중이면 모든 인터리빙의 모든 접두에서 판정 = 최신 목록에 자기 아닌 항목 존재(oracle은 fixture 태그) — 보고 있는 세션의 응답 시작·종료·Stop 중에도 | ST-02 O1~O3 | 같음 |
| R-01 | AT-01 / AC7 | 핸드오프 새 세션도 AC1과 같다 | ST-02 P8 | `startHandoff()` → `sendNewChatPayload` |
| — | UT-04 / AC8 | tracker `begin/confirm/end/turns` 규칙 | UT-04 | `active-turn-tracker.ts` |
| — | UT-05·07 / AC9 | 신원 판정(N1~N3)·화면 격리 판정(I1) 순수 함수 규칙 | UT-05 · UT-07 | `concurrencyNotice.ts` |
| — | UT-06 / AC10 | `activeTurnRef(turn)` 규칙 | UT-06 | `active-turn-ref.ts` |
| — | IT-03 / AC11 | 실제 coordinator·tracker·핸들러가 P1·P2·P5·P7 목록 열을 fixture 그대로 내고, send가 격리 여부에 따라 계상 프로젝트를 넘긴다(E3). listen은 항목을 만들지 않는다 | IT-03 · `send.worktree.test.ts` 추가 케이스 · `turn-coordinator.test.ts:'listen 턴은 activeTurns 회계에 계상하지 않는다'` 갱신 | E0~E3 |
| — | IT-04 / AC12 | 화면이 목록을 저장하고(S1) 새 세션 엔트리에 임시 키를 남기며(S2·S3) id 확정 뒤에도 유지하고(S4) selector가 격리면 0을 내고(S5) 복구 patch가 격리 의도를 내리며(S6) Composer는 `useOtherProjectTurnCount(projectId) > 0`으로만 판정한다(C1) | IT-04 | `chatStore.ts` · `chatReducer.ts` · `Composer.tsx` |
| — | — / AC13 | `IPC_CONTRACT.md §2.12-b`·`runtime-ipc.md` ActiveTurnTracker 행이 신원 목록 payload, "보고 있는 세션은 신원으로 제외, 산술 금지", "격리 세션 응답은 목록에 없음"을 서술한다 | `node scripts/check-doc-inventory.mjs --check` + 문장 대조 | 문서 |
| R-01~04 | AT-01~04 / AC14 | 실제 앱에서 OpenCode·Claude 각각: 새 세션 첫 응답 종료 5회·기존 세션 응답 종료 3회·Stop 3회에 패널 미출현 · 같은 작업경로 다른 세션 응답 중 새 세션 시작(준비 대기 포함) 동안 패널 유지·종료 후 소멸 · 격리 세션을 볼 때 원본 경로 세션이 응답 중이어도 미출현 · 원본 경로 세션을 볼 때 격리 세션이 응답 중이어도 미출현 | 사람 실기 — 페인트·실제 IPC는 vitest 밖(§10 B-1·B-2) | 실제 Electron |
| R-04 | AT-04 / AC15 | 보고 있는 세션이 격리 세션(worktree 표시 있음 · 랜딩/첫 응답에서 격리 켬)이면 같은 원본 경로의 다른 세션이 응답 중이어도 모든 인터리빙·접두에서 false | ST-02 W1·W2 | `chatStore` S5 → `Composer` |
| R-04 | AT-04 / AC16 | 격리 세션의 응답은 원본 작업경로 목록에 들어가지 않는다 — 신규 격리·격리 재개 모두 | IT-03 E3 케이스 · ST-02 W3 | `send.ts` E3 → `runTurnWithContinuations` → coordinator E0 |
| R-04 | AT-04 / AC17 | worktree 소실로 복구된 세션은 다시 비격리다 — main은 목록에 넣고, 화면은 복구 patch 뒤 같은 작업경로 규칙으로 판정 | ST-02 W4 · IT-03 복구 케이스 · UT-08 | `prepareTurnWorktree` recovered → E3 · `chatReducer` S6 |
| — | UT-08 / AC18 | main 격리 판정 규칙(P1~P3) | UT-08 | `prepare-worktree.ts` · `worktrees/service.ts` |

### AC 검증 주의사항

- 기존 테스트 재사용: `turn-coordinator.test.ts:1337` listen 비계상 · `send.worktree.test.ts`(`runTurnWithContinuations` mock 인자 관측) · `prepare-worktree.test.ts` 분기 케이스 실재 확인.
- 사람 실기 항목: 깜빡임은 페인트 현상이다. 판정이 순서와 무관하다는 논리는 ST-02 전수 인터리빙이 덮는다.
- 순서 기준: 이번 계약은 순서를 요구하지 않는다. "모든 순서에서 같은 결과"를 인터리빙 전수로 관측한다(§11).
- 총량 기준: 해당 없음.

## 7-A. V1 처분 (ΔV1에서 확정)

| V1 node | 처분 | 대체 node / 폐기 근거 |
|---|---|---|
| R-01 · R-02 · R-03 / AT-01~03 | CHANGED | §7-B 같은 ID |
| SD-01 순서 계약 | SUPERSEDED | SD-02 |
| AR-01 main 해제 순서 | SUPERSEDED | AR-03 |
| AR-02 renderer `ownTurnOpen` | SUPERSEDED | AR-04 |
| MD-01 tracker 토큰 규칙 | SUPERSEDED | MD-04 |
| MD-02 `count−own` 판정 | SUPERSEDED | MD-05 |
| MD-03 reducer `ownTurnOpen` | SUPERSEDED — 폐기 | 화면 응답 중 표시가 판정 입력에서 빠진다(D-009) |

| V1 pair | 처분 | AC·선택 적대 증거 이관 |
|---|---|---|
| VP-01~03 | CHANGED | §7-B 같은 ID |
| VP-04 | → VP-14 | "AS-IS 순서 변형 → true" → VP-14 음성 대조 |
| VP-05 | → VP-15 | "end를 emit 뒤로" — 폐기: 순서가 계약이 아니다. VP-15는 `confirm` 누락·빈 ref 변이 |
| VP-06 | → VP-16 | "responding 맞바꿈" → VP-16 구별 입력 |
| VP-07 | → VP-17 | 규칙 입력 승계 + `confirm`·순서 분기 |
| VP-08 | → VP-18 | 신원 함수로 대체 |
| VP-09 | 폐기 | 대상 필드 없음 |

## 7-B. 유효 V / Trace Matrix (ΔV1 + ΔV2)

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance (ΔV2 기준) | 출처 / 대체 |
|---|---|---|---|---|
| R-01 | R | §5 1·3행 — 혼자 작업 응답 종료 경고 없음, 모든 도착 순서 | INHERITED (용어만 정렬) | ΔV1 |
| R-02 | R | §5 2행 — Stop·즉시 보내기 경고 없음 | INHERITED (용어만 정렬) | ΔV1 |
| R-03 | R | §5 4~7행 — 같은 작업경로의 다른 비격리 세션이 응답 중일 때만 끊김 없이 경고 | CHANGED | ΔV1 R-03(D-010 제거·D-011 조건 명시) |
| R-04 | R | §5 8~10행 — 격리 세션은 경고와 무관(D-012) | NEW | — |
| AT-01~04 | AT | §7 AC14 + ST-02 | AT-03 CHANGED · AT-04 NEW | ΔV1 |
| SD-02 | SD | §9 TO-BE — 판정 = 보고 있는 세션이 격리면 F, 아니면 f(최신 목록, 보고 있는 세션 신원). 도착 순서 무관 | CHANGED | ΔV1 SD-02 |
| ST-02 | ST | 세 경로 인터리빙 전수 재생(P·O·W) | CHANGED | ΔV1 ST-02 + W1~W4 |
| AR-03 | AR | §10 main 신원 목록(E0~E3) + payload | CHANGED | ΔV1 AR-03 + E3(격리 제외) |
| IT-03 | IT | main 목록 열·send 계상 프로젝트 | CHANGED | ΔV1 IT-03 |
| AR-04 | AR | §10 화면 신원·격리(S1~S6·C1) | CHANGED | ΔV1 AR-04 + S5 격리·S6 |
| IT-04 | IT | 스토어·reducer·Composer | CHANGED | ΔV1 IT-04 |
| MD-04 | MD | §10 tracker(T1~T4) | INHERITED | ΔV1 |
| MD-05 | MD | §10 신원 판정(N1~N3) | INHERITED | ΔV1(N2 입력 라벨만 정정) |
| MD-06 | MD | §10 `activeTurnRef`(A1) | INHERITED | ΔV1 |
| MD-07 | MD | §10 화면 격리 판정(I1) | NEW | — |
| MD-08 | MD | §10 main 격리 판정(P1~P3) | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED (ΔV2: S5 경로 공유 → 회귀 포함) | 사용자 전송 → main 응답 → tracker 목록 · 채팅 이벤트 → IPC → `chatStore` → `Composer` → `Notice` | AC14 실기 + ST-02 P1~P4·P8 | not selected — ST-02가 판정을 직접 관측 | 0 — 운반 자리는 VP-14~22가 고정. AT는 페인트·실제 IPC |
| VP-02 | R-02 ↔ AT-02 | REQUIRED (같음) | Stop/즉시 보내기 → `cancel`/IPC → `interruptResponse` → … → `Notice` | AC14 실기 + ST-02 P5~P7 | not selected | 0 — 같음 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 다른 비격리 세션 응답 → 목록 → `Composer` | AC14 실기 + ST-02 O1~O3 | not selected | 0 — 같음 |
| VP-20 | R-04 ↔ AT-04 | REQUIRED | 격리 판정(main E3 · 화면 S5) → 목록/selector → `Composer` | AC14 실기 + ST-02 W1~W4 + IT-03 E3 | not selected | 0 — 같음 |
| VP-14 | SD-02 ↔ ST-02 | REQUIRED | fixture 세 열(L·C·K) → 인터리빙 → 실제 `chatStore`(`send`·`startHandoff`·`cancel`·`ingestChatEvent`·concurrency 핸들러) → `otherProjectTurnCount` | 신규 `app/src/renderer/src/features/chat/store/chatStore.concurrency.order.test.ts` — 경로별 모든 인터리빙·접두에서 판정 = oracle · fixture 연결은 IT-03 동등 단언(SD-1) | **required** — 장치 민감도: 같은 인터리빙에 AS-IS 공식(`목록 길이 − (sessionResponding?1:0) > 0`, 격리 무시)을 적용하면 P1 오탐·O2 누락·W1 오탐이 각각 1개 이상 나와야 한다 | SD-1~SD-2 (2) |
| VP-15 | AR-03 ↔ IT-03 | REQUIRED | `send.ts` 준비 → `isolated ? null : boundProjectId` → `runTurnWithContinuations` → `coordinator.run({ sharedPathProjectId })` → `begin(turn, sharedPathProjectId, activeTurnRef(turn))` → `session.updated` → `promote` → `confirm` → `finally end` → tracker 이벤트 → (bootstrap) `broadcastConcurrency` | 신규 `app/src/main/app/chat-turn/concurrency-identity.test.ts`(E0~E2·목록 열) · `send.worktree.test.ts` 추가 케이스(E3 — mock된 `runTurnWithContinuations`의 넷째 인자 관측) · `turn-coordinator.test.ts` 갱신 | **required** — `confirm` 누락(E1 제거)·빈 ref(E0)·격리 무시(E3에서 항상 `boundProjectId`) 변이가 각각 red | E0~E3 (4) |
| VP-16 | AR-04 ↔ IT-04 | REQUIRED | `concurrencyApi.onEvent` → `concurrencyByProjectId` · 새 세션 `send`/`startHandoff` → `entry.clientKey` → id 확정 · `session.updated` 복구 patch → `worktreeIsolation=false` · → `otherProjectTurnCount`(격리면 0) → `useOtherProjectTurnCount` → `Composer` → `<Notice>` | 신규 `app/src/renderer/src/features/chat/store/chatStore.concurrency.test.ts`(S1~S5) · 신규 `app/src/renderer/src/features/chat/reducer/chatReducer.worktreeIsolation.test.ts`(S6) · 신규 `app/src/renderer/src/features/chat/components/Composer.concurrency.test.ts`(C1) | **required** — Composer가 플래그 산술로 돌아가거나 selector가 격리를 빼먹으면 red: §10 C1·S5 구별 입력 | S1~S6·C1 (7) |
| VP-17 | MD-04 ↔ UT-04 | REQUIRED | `ActiveTurnTracker.begin/confirm/end/turns` | `active-turn-tracker.test.ts` 개정 + `supervisor.test.ts:197-198` 갱신 | not selected | T1~T4 (4) |
| VP-18 | MD-05 ↔ UT-05 | REQUIRED | `ownTurnIdentity` · `isOwnTurn` · `otherProjectTurns` | 신규 `app/src/renderer/src/features/chat/lib/concurrencyNotice.test.ts` | not selected | N1~N3 (3) |
| VP-19 | MD-06 ↔ UT-06 | REQUIRED | `activeTurnRef(turn)` | 신규 `app/src/main/features/chat/active-turn-ref.test.ts` | not selected | A1 (1) |
| VP-21 | MD-07 ↔ UT-07 | REQUIRED | `displayedSessionIsolated(session)` | `concurrencyNotice.test.ts`(VP-18과 같은 파일) | not selected | I1 (1) |
| VP-22 | MD-08 ↔ UT-08 | REQUIRED | `prepareTurnWorktree` → `isolated` → `prepareTurnExecution` 반환 · `WorktreeService.hasManagedWorktree` | `app/src/main/app/chat-turn/prepare-worktree.test.ts` 추가 케이스 · `app/src/main/features/worktrees/service.test.ts` 추가 케이스 | not selected — 분기별 입력이 직접 oracle | P1~P3 (3) |

## 7-C. ΔV2 변경 요약 (ΔV1 대비)

| 대상 | 변경 | 이유 |
|---|---|---|
| D-010 · R-03의 "같은 세션 다른 창" · N2 입력 라벨 | 철회·제거 | 전제 오류(창 1개) — 사용자 지적 |
| R-04 · AT-04 · VP-20 | NEW | D-012 |
| SD-02 · ST-02 · VP-14 | CHANGED — 격리 판정, W1~W4, 음성 대조에 W1 | D-012 |
| AR-03 · IT-03 · VP-15 | CHANGED — E3(격리면 계상 프로젝트 null), 옵션명 `boundProjectId` → `sharedPathProjectId` | D-012 (b)·(c) |
| AR-04 · IT-04 · VP-16 | CHANGED — S5 격리면 0, S6 복구 patch가 격리 의도 해제 | D-012 (a)·(c) |
| MD-07 · VP-21 / MD-08 · VP-22 | NEW | 격리 판정 SSOT(화면·main) |
| AC6 · AC9 · AC11~AC14 | CHANGED | 위 반영 |
| AC15~AC18 | NEW | D-012 |
| 확장 창 | 이 ΔV2의 NEW·CHANGED 노드는 다음 verify 2회 동안 그 범위에서 확장 후보를 연다 | `docs/handoff/AGENTS.md §판정 범위와 운영 gate` |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| lint + typecheck | `app/**` 수정, IPC 타입 변경 | `cd app && npm run lint && npm run typecheck` | 현재 변경이 유발한 error |
| 관련 vitest | main·renderer·shared 테스트 추가·수정 | `./node_modules/.bin/vitest run src/main/features/sessions src/main/features/chat src/main/features/worktrees src/main/app/chat-turn src/renderer/src/features/chat src/shared/ipc-documentation.test.ts` | 현재 변경이 유발한 red. DB 로드 스위트 bindings 실패는 환경 기준선 |
| 테스트 예산·풀 | 새 테스트 파일 | `node scripts/check-test-budgets.mjs` + vitest unit guard | 새 파일의 위반 |
| 문서 인벤토리 | `docs/**` 수정 | `node scripts/check-doc-inventory.mjs --check` | 새 수치·깨진 링크 |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건 |

---

# Part II — Technical Design (유효 V)

> Part II는 코드 용어를 쓴다. **턴** = 세션 하나의 응답 한 번(`TurnContext`·`TurnCoordinator.run`), **프로젝트** = 작업경로(§1-A).

## 8. Research — 현재 코드와 계약

| # | 발견 / 제약 | 근거 |
|---|---|---|
| R-01 | 경고 판정 = `projectConcurrencyCount − (inflight ? 1 : 0) > 0`. `inflight` = `useChatResponding()` = `s.inflight \|\| s.activityTransport === 'listening'` | `Composer.tsx:127,166,171` · `chatStore.ts:2248-2255` |
| R-02 | 화면 `inflight`는 main terminal 수신과 `CANCEL_CHAT`에서 false, `BEGIN_TURN`·핸드오프 draft 생성에서 true. 비-delta 이벤트는 즉시 store 반영 | `chatReducer.ts:589-599,879,1131-1137,1289-1304,1404-1408` · `chatStore.ts:1632-1638` · `eventCoalescer.ts` |
| R-03 | count는 coordinator `increment`(스트림 시작 직후)·`decrement`(스트림 루프 `finally`)마다 즉시 브로드캐스트 | `turn-coordinator.ts:323,550` · `bootstrap.ts:1110-1113` |
| R-04 | 실측 순서(실제 coordinator + tracker + 버스 relay, 일회성 스크래치): `count=1` → `message.completed` → `telemetry` → `turn.ended` → `count=0`, 판정 `[F,F,T,T,F]` | 스크래치 vitest(커밋 안 함, V1 §8 R-04) |
| R-05 | 두 하네스 모두 terminal 배치가 `[…, telemetry, turn.ended]`이고 같은 coordinator를 지난다 | OpenCode `map.ts:245-277` · Claude `adapter.ts:945-965` |
| R-06 | 화면은 IPC 메시지마다 store를 갱신하고 commit한다. `Notice`에는 전환 효과가 없다 | React 19.2.8 · zustand 5.0.14 · `Notice.tsx:29-33` |
| R-07 | Stop: `cancel()`이 `CANCEL_CHAT`을 먼저 적용하고, main `interruptResponse`는 count 감소 전에 `turn.aborted`를 보낸다 | `chatStore.ts:1372-1392` · `chat-turn/index.ts:110-120` |
| R-08 | 시작 시 누락: `BEGIN_TURN`이 send 즉시 `inflight=true`를 세우고 count는 main 준비(OpenCode 서버 기동·세션 생성) 뒤 오른다 → 다른 세션 1건이 있으면 `1−1=0` | `chatStore.ts:1120` · `turn-coordinator.ts:319-323` · `channel.ts:330-385` |
| R-09 | 산술 판정 패턴은 저장소에 한 곳뿐이다 | `rg -n "\? 1 : 0\)\|- \((inflight\|busy\|responding\|listening)" src/renderer/src -g '!*.test.*'` → 2건 중 판정은 `Composer.tsx:171` 1건(나머지는 `StatusLine.tsx:35` 숫자 포맷) |
| R-10 | 화면 응답 중 표시가 오르는 자리는 사용자 send 밖에도 있다 — 핸드오프 draft 직접 대입, main발 스트림 이벤트의 `shouldBeginTurn`(배치·단건). 표시 기반 설계는 이 자리를 전부 따라가야 한다 | `chatStore.ts:1632-1638` · `:540-542` · `:731-734` |
| R-11 | 계약 문서가 구조 원인을 서술한다: "Composer는 자기 inflight를 차감해 경고 표시 여부를 판정한다" | `IPC_CONTRACT.md:473` |
| R-12 | 새 세션 send 두 경로 모두 엔트리를 `draftKey`로 두고 payload `clientKey: draftKey`를 보낸다 | `chatStore.ts:1006,1032,1061-1063` · `:1617,1630,1643-1647` |
| R-13 | main 턴은 새 세션이면 `isNewSession=true`·`dbSessionId=null`·`queueKey=clientKey`, 기존 세션이면 `dbSessionId=sessionId`로 시작한다. 연속 턴은 `isNewSession=false`·`queueKey` 없음 | `turn-context.ts:170-172,207,213-243` · `admission.ts:97-110` |
| R-14 | id 확정(승격)은 엔트리 객체를 그대로 `sessionId` 키로 옮긴다 | `chatStore.ts:584-626` |
| R-15 | `registry.promote`는 대기 중 새 턴만 한 번 승격하고 `dbSessionId`를 쓰지 않는다 | `session-registry.ts:27-31` · `writer.ts:309-312` |
| R-16 | count 소비자는 Composer 하나다. 업데이트 gate는 lease를 읽는다 | `rg concurrencyByProjectId` · `bootstrap.ts:920-929` |
| R-17 | 격리 세션도 원본 폴더(`preparedSourceCwd`)로 프로젝트에 묶여 지금은 같은 작업경로로 센다 | `send.ts:298-305,340-348` |
| R-18 | 격리의 main 정본 = 세션에 묶인 `managed_worktrees` row. 신규 격리는 준비 결과 `managed`, 재개 격리는 `passthrough`로 오며 row만이 격리를 말한다. 소실 복구는 row를 지우고 `recovered`를 낸다 | `prepare-worktree.ts:39-131` · `worktrees/service.ts:230-247` · `reader.ts:72-78` |
| R-19 | 화면의 격리 신호 = `worktree`(main 표시 정본, 재개·확정 후) · `worktreeIsolation`(랜딩 선택, 엔트리에 남음). 복구 patch는 `worktree: null`을 보낸다 | `chatReducer.ts:317,358,965,1347,1359` · `send.ts:327-332` |
| R-20 | fork·핸드오프 draft는 `initialChatState` + `cwd`만 받아 화면 격리 신호가 꺼져 있고, main은 `worktreeIsolation` 없는 요청이라 `passthrough` — 양쪽 모두 비격리 | `chatStore.ts:1520-1528` · `prepare-worktree.ts:88-99` |
| R-21 | coordinator에 이르는 경로는 `send.ts:650` → `runTurnWithContinuations` → `coordinator.run` 3곳뿐이다. `boundProjectId` 옵션은 계상에만 쓰인다 | `rg -n "runTurnWithContinuations\(\|coordinator\.run\(" src/main -g '!*.test.ts'` → 5건(정의 `post-turn.ts:47` + 호출 4) · `turn-coordinator.ts:208-211,323,550` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 산술 판정 패턴 | R-09 검색 | 1 | 교체 대상 |
| 새 세션 payload(`clientKey`) | `rg -n "clientKey: draftKey" src/renderer/src -g '!*.test.*'` | 2 | S2·S3 |
| 새 세션 payload(`sessionId: null`) | `rg -n "sessionId: null," src/renderer/src -g '!*.test.*'` | 4 | payload 2 + 비송신 2(`composerCatalogState.ts:242`·`chatReducer.ts:494`) |
| `ConcurrencyEvent`·`concurrencyByProjectId` 사용처 | `rg -n "concurrencyByProjectId\|ConcurrencyEvent" src` | 17 | 타입 6 + main send 2 + store 4 + 테스트 fixture 5 |
| tracker 호출 | `rg -n "activeTurns\.(increment\|decrement\|begin\|confirm\|end)\(" src/main -g '!*.test.ts'` | 2 | 323·550 → 변경 후 3(E0~E2) |
| coordinator 진입 | R-21 검색 | 5 | 정의 1 + 호출 4(send 1 + post-turn 3) — E3 한 곳이 전부를 덮는다 |
| `boundProjectId` 옵션 테스트 참조 | `rg -c "boundProjectId" src/main -g '*.test.ts'` | 58 | 옵션명 변경 시 기계적 치환 대상(8파일) |
| 격리 신호 소비 | `rg -n "worktreeIsolation\|worktree:" src/renderer/src/features/chat/reducer/chatReducer.ts` | 9 | 정의 2·초기 2·patch 병합 1·경로 변경 1·토글 1·로드 2 |

### 수치 / 전칭 표현 검산

- "한 곳뿐"(R-09)·"호출 4건"(R-21)·"새 세션 경로 2개"(R-12) — 검색 출력으로 재확인.
- "격리 판정 정본"(R-18): `getManagedWorktreeBySession` 사용처 = `reader.ts:75`·`service.ts:240,250` 3곳, 모두 row 유무로 격리를 본다.
- 문서 앵커·기존 테스트: `IPC_CONTRACT.md:469 §2.12-b` · `runtime-ipc.md:25` · `turn-coordinator.test.ts:1337` · `post-turn.schedules.test.ts` · `send.worktree.test.ts:69`(post-turn mock) · `prepare-worktree.test.ts` · `chatStore.test.ts:1423` 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-02, AR-03, AR-04.
- 책임: main은 프로젝트별 응답 중 **개수**만 안다(격리 세션 포함). 화면은 그 개수에서 **자기 응답 중 표시**를 뺀다.
- 경로: tracker `increment/decrement` → `{projectId, count}` → `concurrencyByProjectId[p] = count` → `count − (responding?1:0) > 0`.
- 직접 원인: 개수에는 "누구"가 없어서 자기 몫을 다른 경로의 표시로 추정한다. 격리 여부도 반영되지 않는다.

```text
main 개수(격리 포함) ──(concurrency 채널)──┐
                                          ├─ 산술 → 두 입력의 상대 시점에 결과가 좌우됨
화면 응답 중 표시 ←(chat 채널·사용자 조작)─┘
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 책임: main은 프로젝트별 **응답 중 비격리 세션의 신원 목록**을 안다. 화면은 보고 있는 세션의 신원과 격리 여부를 안다. 판정은 둘의 집합 연산이다.
- main: send가 준비 결과로 격리를 정하고 `sharedPathProjectId = isolated ? null : boundProjectId`를 넘긴다(E3). coordinator가 `begin(turn, sharedPathProjectId, activeTurnRef(turn))`(null이면 계상 안 함) · `confirm(turn, ev.sessionId)` · `finally end(turn)`. 바뀔 때마다 tracker가 `{ projectId, turns }`를 만든다.
- 화면: 새 세션 엔트리에 `clientKey = draftKey`(id 확정 뒤에도 유지). 판정 = `displayedSessionIsolated(엔트리) ? 0 : otherProjectTurns(최신 turns, ownTurnIdentity(엔트리))`를 한 번의 store 읽기로 계산. 복구 patch(`worktree: null`)는 `worktreeIsolation`도 내린다.
- 유지: 브로드캐스트 경로·× 에피소드·listen 비계상. 제거: `count` 필드, 판정의 `useChatResponding` 의존, 격리 세션의 프로젝트 계상.

```text
main:  준비 → isolated? ─예→ 계상 안 함
                       └아니오→ {sid|null, draftKey|null}[] ──(concurrency 채널, 통째 교체)──┐
화면:  보고 있는 엔트리 {sessionId, clientKey, worktree, worktreeIsolation} ──────────────────┤
       격리면 0 / 아니면 신원 제외 개수 > 0  (응답 중 표시·채팅 이벤트는 판정에 쓰지 않음)  ┘
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 자기 몫 = 화면 표시, 격리 미반영 | 자기 몫 = 신원 일치, 격리 = main row·화면 표시 정본 | 다른 시점 값 혼합 제거 · D-012 | AR-03·AR-04 / VP-15·16 |
| data/control flow | 개수 산술 | 격리 제외 + 신원 제외 | 도착 순서 무관 | SD-02 / VP-14 |
| state/contract | `{ projectId; count }` | `{ projectId; turns: ActiveTurnRef[] }` · coordinator 옵션 `sharedPathProjectId` | 신원 없이는 자기 제외 불가 · 옵션 의미 명시 | AR-03 / VP-15 |
| error/lifecycle | Stop이 표시만 먼저 내림 · 복구 반영 없음 | Stop 무관 · 복구 시 양쪽 비격리 전환 | D-012 (c) | VP-14 W4 · VP-22 |
| test seam | 인라인 식 | 순수 함수 4개(N1~N3·I1) + main 격리 함수 + selector + 인터리빙 재생 | 순서 무관 전수 관측 | MD-05·07·08 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `src/shared/ipc.ts` | `ActiveTurnRef`·`ConcurrencyEvent` 타입 | 계약 | main·preload·renderer |
| `main/app/chat-turn/prepare-worktree.ts` | 준비 결과에 `isolated` 포함(P1·P2) | 준비 입력 → 결과 | `send.ts` |
| `main/features/worktrees/service.ts` | `hasManagedWorktree(sessionId)`(P3) | row 유무 | `prepare-worktree.ts`(포트) |
| `main/app/chat-turn/send.ts` | E3 — 계상 프로젝트 결정 | 준비 결과 → `runTurnWithContinuations` | IPC 핸들러 |
| `main/features/sessions/active-turn-tracker.ts` | 토큰별 ref·프로젝트 목록·이벤트 | `begin/confirm/end/turns` | supervisor · coordinator(포트) |
| `main/features/chat/active-turn-ref.ts`(신규) | 턴 → ref | 순수 | coordinator |
| `main/features/chat/turn-coordinator.ts` | E0~E2 | `ActiveTurnGate` 포트 | post-turn |
| `main/app/bootstrap.ts` | tracker 이벤트 → `broadcastConcurrency` | pass-through | 부팅 |
| renderer `features/chat/lib/concurrencyNotice.ts`(신규) | N1~N3·I1 | 순수 | store selector |
| renderer `chatStore.ts` | 목록 저장·엔트리 `clientKey`·selector/hook | — | Composer |
| renderer `chatReducer.ts` | S6 복구 patch → `worktreeIsolation=false` | action → state | store |
| renderer `Composer.tsx` | `useOtherProjectTurnCount(projectId) > 0` | hook | 페이지 |

## 10. 계약 / 타입 / 강제 지점

계약 타입(`src/shared/ipc.ts`):

```ts
export interface ActiveTurnRef {
  sessionId: string | null   // 확정된 세션 id. 새 세션 확정 전 null
  clientKey: string | null   // 새 세션이 태어난 화면 draft 키. 기존 세션·이어지는 응답은 null
}
export interface ConcurrencyEvent {
  projectId: string
  turns: ActiveTurnRef[]     // 그 작업경로에서 응답 중인 비격리 세션 전부(begin 순서). 비면 []
}
```

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| AR-03 / VP-15 | 응답 중 비격리 세션 신원 목록 | `active-turn-tracker.ts` | main | **E0** `turn-coordinator.ts` 스트림 시작 직후(현 323) `begin(turn, sharedPathProjectId, activeTurnRef(turn))` — `policy.countsAsActive`일 때만 · **E1** `registry.promote` 직후(현 471) `confirm(turn, ev.sessionId)` · **E2** inner `finally`(현 550) `end(turn)` · **E3** `send.ts` `runTurnWithContinuations` 호출(현 650-711)의 계상 인자 = `preparedExecution.isolated ? null : boundProjectId` — 4자리 | `rg -n "activeTurns\.(begin\|confirm\|end\|increment\|decrement)\(\|sharedPathProjectId" src/main -g '!*.test.ts'` → E0~E2 3건 + `sharedPathProjectId` 전달 자리(send·post-turn 3·coordinator) | E0 ref 누락 → 자기 응답이 다른 세션으로 잡힘 · E1 누락 → 재생성 엔트리가 새 세션 첫 응답을 남으로 봄 · E2 누락 → 항목 고착 · E3 누락 → 격리 세션 응답이 원본 경로 세션에 경고 |
| MD-04 / VP-17 | tracker 규칙 | 같음 | main | **T1** `begin` · **T2** `confirm` · **T3** `end` · **T4** `turns` — 4자리 | `rg -n "^\s+(begin\|confirm\|end\|turns)\(" src/main/features/sessions/active-turn-tracker.ts` → 4건 | 아래 규칙 칸 |
| MD-06 / VP-19 | 턴 → ref | `active-turn-ref.ts` | main | **A1** `activeTurnRef` — 1자리 | `rg -n "^export function activeTurnRef" src/main/features/chat/active-turn-ref.ts` → 1건 | 아래 규칙 칸 |
| MD-08 / VP-22 | main 격리 판정 | `prepare-worktree.ts` · `worktrees/service.ts` | main | **P1** `prepareTurnWorktree` 결과 `isolated`(분기마다) · **P2** `prepareTurnExecution`이 `ready` 결과에 `isolated`를 실어 반환 · **P3** `WorktreeService.hasManagedWorktree(sessionId)` — 3자리 | `rg -n "isolated\|hasManagedWorktree" src/main/app/chat-turn/prepare-worktree.ts src/main/features/worktrees/service.ts` | 재개 격리를 비격리로 오판 → 원본 경로 경고 · 복구를 격리로 오판 → 경고 누락 |
| AR-04 / VP-16 | 화면 신원·격리·목록 | `chatStore.ts` · `chatReducer.ts` | renderer | **S1** concurrency 핸들러(현 2212-2216)가 `ev.turns`를 그대로 저장 · **S2** 새 세션 `send()` 엔트리(현 1047-1063)에 `clientKey: draftKey` · **S3** `startHandoff()` draft 엔트리(현 1632-1647)에 `clientKey: draftKey` · **S4** `promotePendingNewChat`(현 616-621) 엔트리 객체 이동 — 코드 변경 없음, 운반 자리 · **S5** `otherProjectTurnCount(state, projectId)` — 보고 있는 엔트리가 격리면 0, 아니면 신원 제외 개수 + `useOtherProjectTurnCount` · **S6** `chatReducer` `session.updated`(현 965) — patch에 `worktree` 키가 있고 값이 `null`이면 `worktreeIsolation: false` · **C1** `Composer.tsx` 판정(현 166-171) — 7자리 | `rg -n "clientKey: draftKey\|concurrencyByProjectId\|otherProjectTurnCount\|useOtherProjectTurnCount\|\[sessionId\]: entry" src/renderer/src -g '!*.test.*'` + `rg -n "worktreeIsolation" src/renderer/src/features/chat/reducer/chatReducer.ts` | S1 변형 → 잘못된 목록 · S2/S3 누락 → 새 세션 id 확정 직후 자기 응답을 남으로 봄 · S5 격리 누락 → 격리 세션에서 경고 · S6 누락 → 복구 세션의 경고 누락 · C1 산술 복귀 → 구조 재발 |
| MD-05 / VP-18 | 신원 판정 | `concurrencyNotice.ts` | renderer | **N1** `ownTurnIdentity` · **N2** `isOwnTurn` · **N3** `otherProjectTurns` — 3자리 | `rg -n "^export function" src/renderer/src/features/chat/lib/concurrencyNotice.ts` → 4건(N1~N3·I1) | 아래 규칙 칸 |
| MD-07 / VP-21 | 화면 격리 판정 | 같음 | renderer | **I1** `displayedSessionIsolated` — 1자리 | 위 검색의 I1 | 아래 규칙 칸 |
| SD-02 / VP-14 | 순서 무관 | `app/src/shared/concurrency-order.testfixture.ts`(신규) | 테스트 | **SD-1** IT-03이 P1·P2·P5·P7 목록 열 = fixture K 단언 · **SD-2** ST-02가 fixture로 인터리빙 전수 재생 — 2자리 | `rg -n "CONCURRENCY_ORDER" app/src -g '*.test.ts'` → 두 테스트 파일 | fixture가 실제 main 열과 갈라지면 재생이 거짓 green |

### 규칙 칸 ↔ UT 입력 칸

| 자리 | 규칙(분기) | UT 입력 — 각 분기로 가는 입력 |
|---|---|---|
| T1 `begin(token, projectId, ref)` | (a) projectId null/undefined → 무변화·이벤트 없음 (b) 새 토큰 → 끝에 추가·이벤트 (c) 이미 보유 → 무변화 | (a) `begin(t1, null, r1)` (b) `begin(t1,'p1',r1)`·`begin(t2,'p1',r2)` → `[r1]`·`[r1,r2]` (c) `begin(t1,'p1',r1)` 두 번 → 이벤트 1회 |
| T2 `confirm(token, sessionId)` | (a) 보유 & ref.sessionId null → 채움(clientKey 유지)·이벤트 (b) 보유 & 이미 있음 → 무변화 (c) 미보유 → 무변화 | (a) `{null,'draft:a'}` → `confirm(t,'s1')` → `{s1,'draft:a'}` (b) `{s1,null}` → `confirm(t,'s1')`·`confirm(t,'s2')` → 이벤트 없음 (c) `confirm(t9,'s1')` |
| T3 `end(token)` | (a) 보유 → 제거·이벤트(마지막이면 `turns: []`) (b) 미보유 → 무변화 (c) 다른 토큰·순서 보존 | (a) `begin(t1)`→`end(t1)` → `{p1, []}` (b) `end(t9)`·두 번째 `end(t1)` (c) t1·t2·t3 후 `end(t2)` → `[r1,r3]` |
| T4 `turns(projectId)` | null/undefined → `[]` · 미존재 → `[]` · begin 순서 · 반환값 변경이 내부에 영향 없음 | `turns(null)`·`turns('px')`·`turns('p1')` 후 반환 배열 `push` → 재조회 불변 |
| A1 `activeTurnRef(turn)` | (a) 새 세션 확정 전 → `{null, queueKey}` (b) 기존 세션 → `{dbSessionId, null}` (c) 이어지는 응답(`isNewSession=false`, queueKey 없음) → `{dbSessionId, null}` (d) 새 세션 queueKey 없음 → `{null, null}` | (a) `{isNewSession:true, dbSessionId:null, queueKey:'draft:a'}` (b) `{false,'s1','s1'}` (c) `{false,'s1',undefined}` (d) `{true,null,undefined}` |
| P1 `prepareTurnWorktree` → `isolated` | (a) 신규 + 격리 켬 → `managed` → true (b) 신규 + 격리 끔 → `passthrough` → false (c) 재개 + 소실 복구 → `recovered` → false (d) 재개 + row 있음 → `passthrough` → true (e) 재개 + row 없음 → false | 기존 `prepare-worktree.test.ts` 분기 케이스에 `isolated` 단언 추가 — (d)는 fake `hasManagedWorktree: () => true`, (e)는 `false` |
| P2 `prepareTurnExecution` | `ready` 결과의 `isolated` = P1 결과 | managed·passthrough(row 없음) 두 입력 → true·false |
| P3 `hasManagedWorktree(sessionId)` | row 있음 → true · 없음 → false | fake db `getManagedWorktreeBySession` → row / null |
| E3 `send.ts` | `isolated` true → 계상 인자 null · false → `boundProjectId` | `send.worktree.test.ts`: 신규 격리(`worktreeIsolation:true`) → `runTurnWithContinuations` 넷째 인자 null · 신규 비격리 → `'p1'` · 재개 격리(row) → null · 재개 복구 → `'p1'` |
| N1 `ownTurnIdentity(entry)` | 엔트리 없음 → `{null,null}` · `{ entry.session.sessionId, entry.clientKey ?? null }` | `undefined` · draft `{null,'draft:a'}` · 확정 `{s1,'draft:a'}` · 로드 `{s1,null}` |
| N2 `isOwnTurn(ref, own)` | (a) sessionId 같고 null 아님 → T (b) clientKey 같고 null 아님 → T (c) null끼리는 불일치 → F (d) 다른 id → F | (a) `{s1,null}`/`{s1,null}` (b) `{null,'draft:a'}`/`{s1,'draft:a'}`(id 확정 경합) (c) `{null,null}`/`{null,null}` (d) `{s1,null}`/`{s2,null}` · 엔트리 재생성: `{s1,'draft:a'}`/`{s1,null}` → T |
| N3 `otherProjectTurns(refs, own)` | 자기 아닌 항목 수 | `[]`→0 · `[own]`→0 · `[own, other]`→1 · `[other, other2]`→2 |
| I1 `displayedSessionIsolated(session)` | (a) `worktree` 있음 → T (b) `worktreeIsolation` true → T (c) 둘 다 없음 → F | (a) `{worktree:{…}, worktreeIsolation:false}` (b) `{null, true}` (c) `{null, false}` |
| S1~S6 | 위 §10 표 | S1: `{p1,[r]}` → `[r]`, 이어 `{p1,[]}` → `[]` · S2: 새 세션 `send` → `sessions[draftKey].clientKey === payload.clientKey` · S3: `startHandoff` → 같음 · S4: `session.updated(s1)` → `sessions.s1.clientKey === draftKey` · 기존 세션 `send` → 미기록 · S5: 엔트리 비격리 + `[other]` → 1, 같은 목록 + 엔트리 `worktree` 있음 → 0, `worktreeIsolation` true → 0 · S6: 시작 `worktreeIsolation:true` → patch `{worktree:null}` → false · patch `{worktree:{…}}` → true 유지 · patch `{cwd}`만 → true 유지 |
| C1 Composer | `useOtherProjectTurnCount(projectId) > 0`만 쓴다 | (자기 항목만, responding false) → 없음 — **AS-IS면 표시** · (다른 항목만, responding true) → 있음 — **AS-IS면 숨김** · (자기+다른, responding true) → 있음 · (다른 항목, 엔트리 격리) → 없음 · (빈 목록) → 없음 |
| ST-02 경로 | P1~P8·W1~W3 모든 인터리빙·접두 F · O1~O3 = oracle(최신 K에 `other` 태그) · W4 = 복구 patch 적용 후에만 oracle | §11 fixture 표 |

- **선언 경계**:
  - B-1 페인트: vitest는 프레임을 그리지 않는다. 깜빡임 부재는 AC14로만 본다.
  - B-2 bootstrap 전달: `bootstrap.ts:1110-1113`의 onChange → `broadcastConcurrency`는 변환 없는 pass-through이고 electron을 import해 vitest가 로드하지 못한다(`src/main/AGENTS.md` P29). 이벤트 생성은 T4가 맡는다. 전달은 AC14가 덮는다.
  - B-3 기동 직후: 앱 재시작·화면 reload 직후 목록은 다음 변경 때 온다 — 경고 누락 가능(깜빡임 아님), 기존 동작.
  - B-4 프로젝트 재바인딩: `send.ts:349`에서 다른 projectId로 바인딩되면 화면 키와 갈린다 — 기존 동작.
  - B-5 새 세션 payload에 `clientKey`가 없으면(현재 0경로, §8) 확정 전 신원이 맞지 않는다 — S2·S3 불변식이 막는다.
  - B-6 fork·핸드오프의 격리 상속: 격리 세션에서 파생한 세션도 양쪽 모두 비격리로 시작한다(R-20). 파생 세션의 격리 상속은 이번 결정 밖이다.
  - B-7 `LOAD_SESSION` `preserveLocalState` 분기는 `worktree: action.session.worktree ?? state.worktree`로 이전 표시를 남긴다(`chatReducer.ts:1472`). 복구는 같은 재개 send에서 S6 patch가 먼저 내리므로 이 분기만으로 격리가 남는 경로는 측정 범위에 없다 — 기존 동작.
- 열린 입력 집합 판정 산출물: 해당 없음.
- 같은 규칙의 SSOT: 신원 일치 `isOwnTurn`, ref 생성 `activeTurnRef`, 화면 격리 `displayedSessionIsolated`, main 격리 `prepareTurnWorktree.isolated` — 각 한 곳.
- "다른 게이트가 막는다" 기재: 해당 없음.
- 선택적 필드: `ActiveTurnRef` 두 필드는 `null` 허용 필수(`undefined` 금지). 엔트리 `clientKey?: string`은 새 세션 엔트리만 갖는다. 준비 결과 `isolated`는 `rejected` 외 모든 분기에 필수 boolean.
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/ipc.ts` | 계약 | `ActiveTurnRef` 추가, `ConcurrencyEvent.count` → `turns` | typecheck |
| `app/src/main/app/chat-turn/prepare-worktree.ts` | P1·P2 | `PrepareTurnWorktreeResult` 비-rejected 분기에 `isolated` · 재개 `passthrough`는 `worktrees.hasManagedWorktree(sessionId)` · `prepareTurnExecution` `ready`에 `isolated` · `worktrees` 포트 Pick에 메서드 추가 | UT-08 |
| `app/src/main/features/worktrees/service.ts` | P3 | `hasManagedWorktree(sessionId): boolean` = `db.getManagedWorktreeBySession(sessionId) !== null` | UT-08 |
| `app/src/main/app/chat-turn/send.ts` | E3 | `runTurnWithContinuations(…, preparedExecution.isolated ? null : boundProjectId)`. 프로젝트 바인딩(`bindStartingProject`)·세션 행 기록은 그대로 | IT-03 |
| `app/src/main/app/chat-turn/post-turn.ts` · `turn-coordinator.ts` | 옵션명 | `boundProjectId` → `sharedPathProjectId`(의미: 이 응답을 계상할 작업경로, 격리면 null). 테스트 8파일 58곳 기계적 치환 | 회귀 |
| `app/src/main/features/sessions/active-turn-tracker.ts` | T1~T4 | `Map<object, { projectId; ref }>`. `begin/confirm/end/turns`. 변화 때만 onChange(`ConcurrencyEvent`) | UT-04 |
| `app/src/main/features/chat/active-turn-ref.ts`(신규) | A1 | 순수 함수 | UT-06 |
| `app/src/main/features/chat/turn-coordinator.ts` | E0~E2 | `ActiveTurnGate`를 `begin/confirm/end`로. 323·471 뒤·550 | IT-03 |
| `app/src/main/app/bootstrap.ts` | 전달 | `new ActiveTurnTracker((ev) => { broadcastConcurrency(ev); this.updateStateChanged() })` | B-2 |
| `app/src/renderer/src/features/chat/lib/concurrencyNotice.ts`(신규) | N1~N3·I1 | 순수 함수. 엔트리·세션은 구조적 타입으로 받아 store 순환 import를 피한다 | UT-05·07 |
| `app/src/renderer/src/features/chat/store/chatStore.ts` | S1~S5 | `SessionEntry.clientKey?: string` · `concurrencyByProjectId: Record<string, readonly ActiveTurnRef[]>` · S2·S3 · `otherProjectTurnCount`(export, 순수, 격리면 0) · `useOtherProjectTurnCount` · `useProjectConcurrencyCount` 삭제 | IT-04 |
| `app/src/renderer/src/features/chat/reducer/chatReducer.ts` | S6 | `session.updated` patch에 `worktree: null`이 있으면 `worktreeIsolation: false` | IT-04 |
| `app/src/renderer/src/features/chat/components/Composer.tsx` | C1 | `concurrencyActive = useOtherProjectTurnCount(projectId) > 0`. `inflight`(responding)의 다른 사용처는 그대로 | IT-04 |
| `app/src/shared/concurrency-order.testfixture.ts`(신규) | SD-1·SD-2 | `CONCURRENCY_ORDER` — 아래 표. 자리표시 `$draft`(store가 만든 draftKey)·`$sid`·`$other`(태그 `other`) | — |
| `app/src/main/app/chat-turn/concurrency-identity.test.ts`(신규) | IT-03 | 새 세션 P1: coordinator 단위(`isNewSession:true, dbSessionId:null, queueKey:'draft:a'`, 스크립트 `[session.updated s1, message.completed, telemetry, turn.ended]`, 실제 tracker) · 기존 세션 P2·Stop P5·즉시 보내기 P7: `post-turn.schedules.test.ts` 형태 실핸들러 fixture(`new RuntimeSupervisor({ activeTurns: new ActiveTurnTracker(로그) })`, `sharedPathProjectId 'p1'`) · `sharedPathProjectId null`이면 이벤트 0건(AC16) · 예외·시작 전 중단·재시도 → AC5 · 각 열 = fixture K | E0~E2 · SD-1 |
| `app/src/main/app/chat-turn/send.worktree.test.ts` | IT-03 E3 | §10 E3 입력 4건 | E3 |
| `app/src/main/app/chat-turn/prepare-worktree.test.ts` · `worktrees/service.test.ts` | UT-08 | §10 P1~P3 입력 | P1~P3 |
| `app/src/renderer/src/features/chat/store/chatStore.concurrency.order.test.ts`(신규) | ST-02 | `chatStore.test.ts` 형태 `window.api` mock(concurrency 핸들러 캡처). 경로마다 L·C·K 인터리빙 전수(열 내부 순서 보존 + 제약) → 실제 `send`/`startHandoff`/`cancel`/`ingestChatEvent`/핸들러 → 접두마다 `otherProjectTurnCount(getState(),'p1') > 0` = oracle. 음성 대조: AS-IS 공식 → P1 오탐 ≥1·O2 누락 ≥1·W1 오탐 ≥1 | SD-2 |
| `app/src/renderer/src/features/chat/store/chatStore.concurrency.test.ts`(신규) | IT-04 S1~S5 | §10 입력 | S1~S5 |
| `app/src/renderer/src/features/chat/reducer/chatReducer.worktreeIsolation.test.ts`(신규) | IT-04 S6 | §10 입력 | S6 |
| `app/src/renderer/src/features/chat/components/Composer.concurrency.test.ts`(신규) | IT-04 C1 | `Composer.activity.test.ts`처럼 `renderToStaticMarkup`. chatStore mock은 `...original`로 `useOtherProjectTurnCount`·`useChatStore`를 실물로 두고 `useChatStore.setState`로 엔트리·목록을 시드. `useChatResponding`은 §10 C1 구별 값으로 덮는다 | C1 |
| `active-turn-tracker.test.ts` · `supervisor.test.ts:197-198` · `turn-coordinator.test.ts` | 갱신 | 새 API·옵션명 | UT-04 · 회귀 |
| `active-turn-ref.test.ts` · `concurrencyNotice.test.ts`(신규) | UT-06·05·07 | §10 입력 | A1 · N1~N3 · I1 |
| store 테스트 fixture 5곳(`chatStore.test.ts:384,497` · `chatStore.testHarness.ts:77` · `chatStore.extraDirs.test.ts:28` · `chatStore.worktreeIsolation.test.ts:35`) | 타입 | 빈 객체 유지 — 값 타입만 바뀐다 | typecheck |
| `docs/IPC_CONTRACT.md:473` · `docs/arch/backend/runtime-ipc.md:25` | AC13 | payload 표기 교체 + "보고 있는 세션은 신원으로 제외 — 응답 중 표시로 산술하지 않는다" + "격리(worktree) 세션의 응답은 목록에 넣지 않는다" | 인벤토리 게이트 |

### ST-02 fixture (`CONCURRENCY_ORDER`)

L = 사용자 조작, C = 채팅 채널, K = concurrency 채널 목록. 공통 제약: C·K의 모든 단계는 L의 첫 동작 뒤. `turn.aborted`(Stop)는 `cancel` 뒤. `K0`·`pre`는 L 앞에 적용하는 초기 상태다.

| 경로 | 초기 상태 | L | C | K |
|---|---|---|---|---|
| P1 새 세션 정상 | — | `send(새)` | `session.updated($sid)` · `telemetry` · `turn.ended` | `[{null,$draft}]` · `[{$sid,$draft}]` · `[]` |
| P2 기존 정상 | — | `send($sid)` | `telemetry` · `turn.ended` | `[{$sid,null}]` · `[]` |
| P3 기존 오류 | — | `send($sid)` | `error` | P2와 같음 |
| P4 기존 스트림 중단 | — | `send($sid)` | `turn.aborted` | P2와 같음 |
| P5 기존 Stop | — | `send($sid)` · `cancel` | `turn.aborted` | P2와 같음 |
| P6 새 세션 확정 전 Stop | — | `send(새)` · `cancel` | `session.updated($sid)` · `telemetry` | P1과 같음 |
| P7 즉시 보내기 | — | `send($sid)` | `turn.aborted` · `chat.activity(listening)` · `telemetry` · `chat.activity(idle)` | `[{$sid,null}]` · `[]` · `[{$sid,null}]` · `[]` |
| P8 핸드오프 새 세션 | — | `startHandoff` | P1과 같음 | P1과 같음 |
| O1 다른 세션 + 기존 정상 | K0 `[{$other}]` | `send($sid)` | `telemetry` | `[{$other},{$sid,null}]` · `[{$other}]` · `[]` |
| O2 다른 세션 + 새 세션 시작~종료 | K0 `[{$other}]` | `send(새)` | `session.updated($sid)` · `telemetry` | `[{$other},{null,$draft}]` · `[{$other},{$sid,$draft}]` · `[{$other}]` · `[]` |
| O3 다른 세션 + Stop | K0 `[{$other}]` | `send($sid)` · `cancel` | `turn.aborted` | `[{$other},{$sid,null}]` · `[{$other}]` |
| W1 격리 세션을 봄 + 원본 경로 세션 응답 | pre: 엔트리 `worktree` 있음 · K0 `[{$other}]` | `send($sid)` | `telemetry` | `[]` (격리 응답은 목록에 없음, 다른 세션 종료만) |
| W2 랜딩에서 격리 켜고 새 세션 | pre: `worktreeIsolation:true` · K0 `[{$other}]` | `send(새)` | `session.updated($sid)` · `session.updated($sid, worktree 표시)` · `telemetry` | `[]` |
| W3 비격리 세션을 봄 + 격리 세션 응답 | pre: 엔트리 비격리 | `send($sid)` | `telemetry` | `[{$sid,null}]` · `[]` (격리 세션 항목 없음 — main E3) |
| W4 격리 세션 복구 | pre: 엔트리 `worktree` 있음·`worktreeIsolation:true` · K0 `[{$other}]` | `send($sid)` | `session.updated($sid, worktree:null)` · `telemetry` | `[{$other},{$sid,null}]` · `[{$other}]` |

- 인터리빙 수는 경로마다 C(|C|+|K|, |K|) 이하(P7 최대 70) — 전수 실행 가능하다.
- 기대값: P·W1~W3은 전부 F. O는 접두마다 "최신 K에 `other` 태그 항목 있음". W4는 "복구 patch 적용됨 ∧ 최신 K에 `other` 있음" — 모두 신원·격리 함수와 독립인 oracle이다.

### 테스트 가능성

- 순수 파일: `concurrencyNotice.ts` · `active-turn-ref.ts` · `active-turn-tracker.ts` · `prepare-worktree.ts`(포트 주입) — electron·React 비의존.
- 기존 메커니즘 재사용: `post-turn.schedules.test.ts:229`는 계상 인자를 `null`로 넘긴다 — 새 파일은 `'p1'`. `send.worktree.test.ts:69`는 `runTurnWithContinuations`를 mock해 인자를 관측할 수 있다. `chatStore.test.ts:1423`에서 concurrency 핸들러를 꺼낸다.
- 순서 관측: 순서를 단언하지 않는다. ST-02가 모든 순서를 돌린다.

## 12. End-to-end 영향

### producer → consumer

```text
send(E3 격리 판정 ← P1~P3) → post-turn → coordinator(E0~E2) → tracker(T1~T4) → bootstrap → broadcastConcurrency → preload → concurrencyApi
  → chatStore.concurrencyByProjectId(S1) ─┐
send/startHandoff(S2·S3) → entry.clientKey → id 확정(S4) ─┤
session.updated 복구 patch(S6) → worktreeIsolation ────────┴→ otherProjectTurnCount(S5, I1·N1~N3) → Composer(C1) → Notice
```

- producer 기준: `turns` = 그 순간 그 작업경로에서 응답 중인 비격리 세션 전부의 신원.
- consumer 파생 규칙: 보고 있는 세션이 격리면 0, 아니면 `turns` 중 `isOwnTurn`이 false인 항목 수.
- 합성값 우회: `count`가 사라져 개수 산술 경로가 없다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 변경 시 영향 | 회귀 AC |
|---|---|---|
| `bootstrap.ts:1110-1113` onChange → `broadcastConcurrency` + `updateStateChanged` | 인자 형태만 바뀐다. gate는 lease를 읽는다(R-16) | AC14 |
| preload `concurrency.onEvent` · renderer `api/ipc.ts:225` | 타입 통과 | typecheck |
| `activeTurns` 참조 통합 테스트 6파일 · `boundProjectId` 참조 테스트 8파일 | API·옵션명 반영 | vitest gate |
| `prepareTurnWorktree` 호출자 `send.ts`·테스트 | 결과에 필드 추가 | AC18 · typecheck |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `runtime.send` 직후 E0. 재시도 attempt마다 E0↔E2 왕복. 격리 응답은 E0이 계상하지 않는다(T1a).
- 세션 확정: E1은 대기 중 새 턴에서 한 번만 의미가 있다(T2a).
- 취소/중단: Stop·즉시 보내기는 coordinator 루프 종료 → E2. 판정은 그 시점과 무관.
- 복구: 재개 send에서 worktree 소실 → main `recovered` → 비격리 계상(P1c) · 화면 patch `worktree:null` → `worktreeIsolation=false`(S6).
- 종료/crash/renderer-gone: 예외로 루프를 나오면 E2. renderer-gone은 lease 정리 → turn abort → E2.
- cleanup: 토큰 항목은 E2에서 삭제. 프로젝트 목록이 비면 `turns: []` 이벤트 후 내부 키 삭제.
- 다중 저장소 쓰기: 판정 사본 = `plan.md`·`verify.md`·`INDEX.md`. 코드 쪽은 해당 없음(격리 판정은 읽기만).

## 14. 성능 / 상한 / 최적화

- 이벤트 크기: 작업경로의 응답 중 비격리 세션 수 × ref 2필드. 상한은 runtime cap(`bootstrap.ts:1116` `capacity: 5`)과 lease 수.
- 이벤트 수: 응답당 begin 1 · confirm ≤1 · end 1. 격리 응답은 0.
- 추가 조회: 재개 send마다 `getManagedWorktreeBySession` 1회(prepared statement, `queries.ts:678`).
- selector 비용: 렌더마다 목록 순회(수 개). 원시값 반환이라 불필요한 재렌더 없음.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음 — 외부 구현자 없음. IPC 계약 문서만 갱신(AC13).

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 경고 = 비차단·에피소드 닫기 | `Composer.tsx:167-178` · `ko.ts:1099-1100` | §5 · §11 | 유지 |
| listen 비계상(0143) | `turn-coordinator.ts:320-323` | E0 · AC11 | 유지 |
| `inflight`는 라이브 경로에서 화면 소유 | `chatReducer.ts:1242-1245` | 판정이 `inflight`를 읽지 않음 | 유지(무관해짐) |
| IPC "자기 inflight 차감" · payload `{projectId; count}` | `IPC_CONTRACT.md:473` | AC13 | 변경 — D-009 |
| 격리 표시 정본 = `managed_worktrees` row, 소실 시 row 삭제 후 원본 폴백 | `reader.ts:72-78` · `service.ts:230-247` (0210·0211) | P1·P3·S6 | 유지 — 같은 정본을 경고 판정에도 쓴다 |
| `worktree` patch 세 상태(부재·null·객체) 키 유무 판정 | `chatReducer.ts:962-965`(0211 D-022) | S6 | 유지 — null만 격리 의도 해제 |
| 시작 폴더로 프로젝트 바인딩(격리 포함) | `send.ts:340-348` · `persistence.md:124` | E3 | 유지 — 바인딩은 그대로, 경고 계상만 제외 |
| `clientKey` 영속 금지 | `ipc.ts:961-963` · `contracts/turn.ts:71-73` | 화면 메모리·IPC 목록에만 둔다 | 유지 |
| main 레이어 DAG · renderer 4-layer | `src/main/AGENTS.md` · `src/renderer/AGENTS.md` | `app/chat-turn` → `features/worktrees` 포트 · `features/chat` ↔ `features/sessions` 포트 | 유지 |
| V1·ΔV1 설계 | 이 plan | §7-A·§7-C | 대체·갱신 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| payload 변경(one-way door) | 소비자가 Composer 하나인 내부 IPC(R-16). 문서 동시 갱신(AC13) |
| 랜딩에서 격리를 켜 두기만 해도 경고가 사라진다 | D-012 (a) — 격리 공간에서 시작할 의도이므로 원본 경로 세션과 충돌하지 않는다 |
| 기동 직후 목록 부재(B-3) | 기존 동작. 목록 형태라 초기 조회 하나를 더하면 닫힌다(§6 후속) |
| 옵션명 변경으로 테스트 58곳 치환 | 기계적 치환. 의미가 "계상할 작업경로(격리면 null)"로 바뀌어 이름을 맞춘다 |

- 되돌리기 어려운 결정: IPC payload 형태 — 내부 계약이라 같은 PR에서 양쪽이 바뀐다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/ipc.ts` · `app/src/shared/concurrency-order.testfixture.ts`(신규)
- `app/src/main/app/chat-turn/prepare-worktree.ts`(+test) · `send.ts` · `send.worktree.test.ts` · `post-turn.ts` · `concurrency-identity.test.ts`(신규)
- `app/src/main/features/worktrees/service.ts`(+test)
- `app/src/main/features/sessions/active-turn-tracker.ts`(+test) · `supervisor.test.ts`
- `app/src/main/features/chat/active-turn-ref.ts`(+test, 신규) · `turn-coordinator.ts`(+test)
- `app/src/main/app/bootstrap.ts` · `boundProjectId` 참조 테스트 8파일
- `app/src/renderer/src/features/chat/lib/concurrencyNotice.ts`(+test, 신규)
- `app/src/renderer/src/features/chat/store/chatStore.ts` · `chatStore.concurrency.test.ts`·`chatStore.concurrency.order.test.ts`(신규) · store 테스트 fixture 5곳
- `app/src/renderer/src/features/chat/reducer/chatReducer.ts` · `chatReducer.worktreeIsolation.test.ts`(신규)
- `app/src/renderer/src/features/chat/components/Composer.tsx` · `Composer.concurrency.test.ts`(신규)
- `docs/IPC_CONTRACT.md` · `docs/arch/backend/runtime-ipc.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크 제약: 제약 환경은 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts`. DB 로드 스위트 bindings 실패는 기준선.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: §7-C 운영 gate 표.
- 사람 실기: AC14(OpenCode·Claude, 격리 2건 포함).

## READY self-review

- 결정 보존: ACTIVE D-001~D-006·D-008·D-009·D-011·D-012 · SUPERSEDED D-007(→D-009)·D-010(철회) · OPEN 0.
- 사용자 문장: §2 원문 인용. "1번 맞음" → D-011 · "worktree는 격리된 공간 … 경고 패널 출력하지 말것" → D-012 (a), (b)·(c)는 같은 이유의 적용으로 표시.
- 용어: §1-A 정의를 Part I 전체에 적용. Part II는 코드 용어(턴·프로젝트)를 §1-A 대응으로 쓴다.
- AS-IS/TO-BE 같은 축: §9 Delta 5행 → §11 파일·AC. 사라진 책임: `count`·표시 차감·격리 세션 계상 = 삭제.
- 실측: R-17~R-21 검색과 파일:줄, §8 전수 조사 8행.
- V: 유효 registry — NEW 4(R-04·MD-07·MD-08·AT-04)·CHANGED 9·INHERITED 5, 모든 pair REQUIRED. §7-C에 ΔV2 변경과 확장 창.
- 규칙 칸 ↔ 입력 칸: T1~T4·A1·P1(5)·P2(2)·P3(2)·E3(4)·N1~N3·I1(3)·S1~S6·C1(5) 모두 입력 있음.
- 적대 증거: VP-14(AS-IS 공식 음성 대조, W1 포함)·VP-15(`confirm` 누락·빈 ref·격리 무시)·VP-16(산술 복귀·격리 누락 구별 입력)만 선택.
- 선언 경계 B-1~B-7 — 근거 파일:줄과 함께.
- INDEX 후보 표 겹침: 0행.
- 사람 실기로 미룬 순수 로직 없음.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | … | … | … | … | … |

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드)

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED | … | … | … |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| … | … | 최초 | … | … |

- **분모 검산**: …
- **덮개 회귀**: 해당 없음(첫 라운드)

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | … | … |

### 설계 대비 명시적 차이

- …

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … | … |
| 재진입 | … | … |
| 다른 무효화 축 | … | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출** | … |
| V-pair 자기확인 | … |
| 강제 지점 전수 | … |
| **AC 자기보고**(`Criteria-Met`) | … |
| **합계 검산** | … |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: …
- 그것을 막았어야 할 plan 지침·AC가 있었는가: …
- 반복해서 부딪히는 환경 한계: …
- 현재 라운드·impl 턴: `r1`

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |
