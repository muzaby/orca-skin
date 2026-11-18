# Plan — 0326-transcript-incremental-model

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력: [0325 plan §6-C B 행 · §6-D](../0325-ui-responsiveness-followup/plan.md) · 0325 첨부 [`input/0324-agent-requests.ko.md`](../0325-ui-responsiveness-followup/input/0324-agent-requests.ko.md)(요청서 — 본문의 `T02`~`T25`) · [`input/0324-audit.ko.md`](../0325-ui-responsiveness-followup/input/0324-audit.ko.md)(감사).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0326-transcript-incremental-model` |
| 작성자 | Claude Code |
| 일자 | 2026-11-18 |
| 매핑 | 0325 후속 단계 B — 요청서 T02·T03·T04 잔여·T05·T06 잔여·T07·T11·T12 잔여·T16·T17·T18·T25 · 감사 memo 설계 항목 |
| 상태 | READY (V1) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0325·0324 노드는 INHERITED REGRESSION 으로만 참조(`0325:V1 rev 4 + ΔV1` — 설계 `5923d9a`·`211afa7`, 브랜치 `ccr-da0cf78b-aemqjb` · `0324:V1 rev 4.9@22a6d06`) |
| 이번 V revision | `V1` |
| 유효 V | `V1` |
| 구현 착수 조건 | 0325 verify PASS 뒤(D-003). 이 plan 의 AS-IS 는 0325 r1 구현 `52b5272` 다(r2 가 D2 를 닫으면 구현자가 차이를 [구현자 기입] 설계 리뷰에 적는다) |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 확정 이벤트 한 건(도구 시작·결과·텍스트 완료)마다 창이 화면 밖 이력 전체를 다시 읽는다. 10,000 exchange 세션에서 한 건에 Work 결과 19.5ms · OpenCode head 재투영 36.8ms(행 40,996개 전부 새 객체) · OpenCode 패널 21.0ms · 작업 보드 5.0ms · 하위 작업 요약 5.5ms 가 든다(§8 M1). 메시지에는 번호가 없어 다시 열 때 같은 메시지를 알아보는 기준이 자리·시각뿐이다(§8 F1·F2).
- **완료 후 달라지는 것**: 메시지마다 번호가 있고 에이전트 호스트가 붙인다 — 창과 데이터 호스트에 같은 번호가 같은 시점에 가고, 다시 열기·재시작 뒤에도 같다. 확정 이벤트 한 건에 창이 읽는 메시지는 바뀐 메시지뿐이고, 바뀌지 않은 exchange·행·카드·패널 행은 같은 객체로 남는다. 긴 단일 exchange·긴 선택·접은 카드·사용자 버블·스트리밍 펜스는 보이는 만큼만 일한다.
- **보장하지 않는 것**: 참조 배열 복사(B2)·첫 로드와 앞삽입의 전체 투영(B3 — 단계 E)·loose list·긴 문단 꼬리 파싱(B9 — 단계 C 워커 뒤)·T17·T18 이주(B12 — W 판정 뒤).
- **한 문장**: 긴 세션에서 답변이 이어져도 창은 바뀐 메시지만 읽고, 다시 열어도 펼친 카드는 그대로다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 325에서 지정했던 새 핸드오프 후보를 이어서 진행한다(핸드오프 325 후속). docs/handoff/index.md, docs/handoff/0325.../input/*.md 요구사항을 참고하면 더욱 명확하다" | 턴 1 |
| 명시 요구 | 후속 단계 선택 = "B (Recommended)" | 턴 1 질의 답 |
| 명시 요구 | 분할 질의 답 = "B 전체 하나로" | 턴 1 질의 답 |
| 명시 요구 | 메시지 번호 질의 — "Agent process가 번호를 붙이면 안되는건가?" → 최종 "D. 에이전트 부여 (Recommended)" | 턴 1 질의 답(4회 설명 뒤) |
| 명시 요구(첨부) | 요청서 B 행 T 들의 요청·완료 기준 · "세션 페이지·행 ID·도구 ID 계약은 세션/Transcript/우측 패널 담당자가 공유한다" · "순수 delta, 확정 메시지 추가, 과거 도구 결과 수정, 페이지 앞삽입을 다른 갱신으로 처리한다" | 요청서 전달 순서 · 이벤트 절 |
| 추론 의도 | 0325 §6-C B 행의 완료 근거(R store · R 하네스 투영 · R viewport)를 이 handoff 의 AC 로 닫는다. 워커가 소유할 일(T07 파서·T12 요약)과 측정 우선 항목(T17·T18)은 선행 조건을 따른다 | 설계자 — D-023·D-024·D-025 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 0326 은 0325 후속 단계 B 다 — §6-C B 행의 대응 T 전부와 감사 memo 설계 항목(비교자 단순화·`reconcileSegments`·Work 캐시 대체·OpenCode memo 테스트 확장)을 받는다 | "B (Recommended)" | 턴 1 질의 답 | ACTIVE | — |
| D-002 | B 를 나누지 않고 한 handoff 로 둔다 — AC 25 상한을 넘는다(§7 AC1~AC30) | "B 전체 하나로" — 제안한 B1(모델 증분)·B2(viewport) 분할을 거절 | 턴 1 질의 답 | ACTIVE | — |
| D-003 | 이번 산출은 plan(READY)까지다. 구현 착수는 0325 verify PASS 뒤다 | 0325 가 아직 PASS 전이고(설계 당시 IMPL_DONE → verify 1회째 RETURN_TO_PLAN → ΔV1 READY · r2 대기) B 가 같은 파일(`chatStore.ts`·`turns.ts`·두 Timeline·`projection.ts`)을 바꾼다. 질의 본문에 고지했고 이의 없음 | 설계자 · 턴 1 질의 본문 | ACTIVE | — |
| D-004 | 메시지 번호는 **에이전트 호스트가 붙인다**. 번호는 이벤트와 함께 창과 데이터 호스트에 가고, 데이터 호스트가 메시지 행에 저장하며, 세션 로드는 그 번호를 돌려준다 | "D. 에이전트 부여" — 번호가 두 곳에 동시에 도착해 임시 번호·대응표가 없고 재로드·재시작 뒤에도 같다. B(data+통지)는 상관 키가 에이전트에만 있어 D 를 포함하고, C(data만)는 다시 열 때 이 창에서 받은 메시지가 다시 그려진다 | 턴 1 질의 답 | ACTIVE | — |
| D-005 | 번호 공간은 접두로 나눈다 — `a:`(에이전트 발급 assistant) · `u:`(사용자 커밋) · `m:`(번호 없는 로컬 행의 DB id) · `n:`(로컬 행이 묶이지 않은 원본 메시지) · `x:`(복구 보관본) · `r:`(창이 이벤트 번호 없이 만든 메시지) · `c:`(하위 작업 대화 합성). 세션 안에서 유일하다 | 옛 행·앱 밖 원본·창 합성 메시지에도 고정 번호가 있어야 한다(질의 D 위험 표 "번호 충돌 — 접두로 공간을 나눔") | 설계자(D-004 적용) | ACTIVE | — |
| D-006 | 메시지 경계의 정본은 에이전트 번호다 — writer 와 창 reducer 는 번호가 바뀌면 새 메시지를 만든다. 결과적으로 라이브 묶음과 재로드 묶음이 같다 | 지금 경계는 writer(사용자 커밋·턴 끝 마감, `writer.ts:182-199`)와 reducer(마지막이 user 면 새 메시지, `chatReducer.ts:793-801`)가 따로 정한다. 질의 D 위험 표 "경계 규칙을 에이전트 한 곳에 두고 … 라이브 묶음 = 재로드 묶음 대조" | 설계자 · 턴 1 질의 위험 표 | ACTIVE | — |
| D-007 | 원본 투영 메시지의 번호 — 묶인 로컬 행 중 가장 앞(가장 작은 DB id) 행의 번호를 쓰되 앞 메시지가 이미 쓴 번호는 건너뛴다. 묶인 행에 번호가 없으면 `m:`, 묶인 행이 없으면 `n:<원본 id>` 다 | 로컬 행 하나가 원본 메시지 여럿에 묶일 수 있다(`native-projection.ts:51-61` `localTargets`) — 같은 번호가 둘이 되면 안 된다 | 설계자 | ACTIVE | — |
| D-008 | 공개 계약 변경은 다섯이다 — 창으로 가는 이벤트 8종의 `messageKey` · `message.committed.messageKey` · 피어 `turn.commitUser` 배치의 `messageKey` · `LoadedMessage.id`(필수) · 마이그레이션 `0036_message_key.sql`(nullable 열 + 부분 유일 색인). 저장 형식은 열 하나 추가이고 옛 행은 그대로 읽힌다 | D-004 의 비용(질의 D 비용 행). `IPC_CONTRACT.md`·`docs/arch/backend/provider-runtime.md §2`·`persistence.md` 를 같은 변경에서 고친다 | 턴 1 질의 답 · 설계자 | ACTIVE | — |
| D-009 | 창의 메시지 변경 기록 — reducer·store 가 새 `messages` 배열을 만들 때마다 (이전 배열, 첫 변경 색인)을 배열 키 side-table 에 남기고, 소비자는 자기가 마지막으로 본 배열에서 지금 배열까지의 첫 변경 색인을 그 기록으로 얻는다. 기록이 없거나 끊기면 전체(0)로 본다 | 첫 변경 탐색이 참조 비교 n 회다(0325 B8). 기록 없음 = 전체라 기록 누락은 느려질 뿐 틀리지 않는다 | 설계자 | ACTIVE | — |
| D-010 | 이 handoff 의 "방문"은 메시지 객체의 `parts` 읽기, "할당"은 새 exchange·turn·행·도메인 출력 객체다. 참조 배열 복사(`slice`·`concat`)는 세지 않는다 | 20,000 메시지 배열 복사 0.085ms · 200,000 0.96ms(§8 M1). 0325 D-032 "확정 이벤트 한 건의 전체 이력 순회" 의 판정 단위를 고정한다 | 설계자 | ACTIVE (사용자 거부 가능 — 배열 복사까지 없애려면 영속 자료구조로 `messages` 형을 바꿔야 한다) | — |
| D-011 | 작업 상태 파생(작업 보드·하위 작업 요약·자식 대화·완료 통지 설명·배경 패널 결과·모델·OpenCode 패널 프로세스·작업 맥락 출처·도구 결과)은 세션 transcript 색인에서 읽는다. 색인은 변경 기록으로 바뀐 접미만 철회·재적용하고, 도메인마다 revision 을 둬 그 도메인이 바뀌지 않은 이벤트에는 소비자가 재계산하지 않는다 | 지금 9개 함수가 배열마다 전체를 접는다(§8 S5 26줄) — WeakMap 캐시는 새 배열마다 빗나간다(§8 M1) | 감사 권장 2 · 요청서 T11·T25 · 설계자 | ACTIVE | — |
| D-012 | OpenCode 행 key 는 exchange 첫 메시지 번호 + segment 종류별 순번(`<id>:<kind>:<n>`)이다. 시각·중복 순번(`role:createdAt:occurrence`)을 쓰지 않는다 | 중복 순번은 앞 exchange 를 전부 세야 해 head 증분을 막고(`projection.ts:46-52`), 앞삽입에서 밀린다(감사 "동일 시각의 이전 페이지가 추가될 때 안정성 검증"). 종류별 순번이면 reasoning 이 앞에 생겨도 live text 행 key 가 남는다(0325 B19) | 설계자 · 감사 | ACTIVE | — |
| D-013 | Claude `Exchange`·`Turn` 은 `id`(첫 메시지 번호)를 갖는다. React key · 가상화 key · Work 결과 맵 키는 `id` 다. `startIndex` 는 그룹화 내부 값으로 남는다 | 지금 key 가 배열 색인이라 앞삽입에서 전부 다시 마운트된다(`Timeline.tsx:92`·`:120` · `useTranscriptVirtualizer.ts:27`) | 감사 · 요청서 T04 · 설계자 | ACTIVE | — |
| D-014 | 비교자 단순화 — grouper·OpenCode head 는 내용이 같은 exchange·turn·행을 같은 객체로 돌려주므로 `Exchange`·`AssistantTurn` memo 는 그 prop 을 참조로 비교한다 | "Exchange/AssistantTurn 사용자 정의 비교자 — 증분 모델 도입 후 단순화 … 이전 행의 참조를 유지하면 얕은 비교로 충분해진다" | 감사 memo 표 | ACTIVE | — |
| D-015 | `reconcileSegments` 를 메시지 분절 캐시로 대체한다 — 메시지의 parts 가 앞을 유지한 채 늘면 마지막 segment 부터만 다시 자르고 앞 segment 는 이전 객체다. 결과는 `messageSegments(전체)` 와 같다 | 지금 바뀐 메시지마다 parts 전체를 다시 자른 뒤 대조한다(`AssistantMessage.tsx:31-33` · `workActivity.ts` 같은 쌍). 감사 "toolRunId → 소유 행 색인과 증분 갱신을 검증한 뒤 대체" | 감사 memo 표 · 요청서 설계 항목 | ACTIVE | — |
| D-016 | delta 반영 — 한 묶음 안의 같은 세션·같은 종류 연속 delta 는 문자열을 한 번 이어 붙이고 세션 항목을 한 번 바꾼다. 생성 중 세션 키(sessions 변경마다 filter+sort)는 현행 유지로 종결한다 | 세션 1,000개에서 0.148ms(§8 M2) — 0325 D-043 "조건부 항목은 입력 크기·실측으로 현행 유지 종결" | 요청서 T02 · 0325 D-043 | ACTIVE | — |
| D-017 | 긴 마지막 exchange 블록 가상화 — Claude 마지막 exchange 의 블록이 `TAIL_VIRTUALIZE_MIN_BLOCKS = 200` 을 넘으면 마지막 `TAIL_LIVE_BLOCKS = 40` 블록만 지금처럼 그리고 앞 블록은 가상화한다. 예약 공간·스크롤 앵커·대기 표시·steer·오류·fork 는 가상화하지 않은 뒤쪽에 그대로 있다 | "단일 exchange 가 긴 경우 그 내부도 블록 단위로 가상화한다. 현재 턴 고정·fork·선택 유지". 0102 의 "가상 head + 비가상 tail" 을 tail 안에 한 번 더 적용하면 0008 앵커 계약을 건드리지 않는다 | 요청서 T04 · 0325 B10 · 설계자 | ACTIVE (사용자 거부 가능 — 200·40 은 W 실측 뒤 조정) | — |
| D-018 | 펼침 상태는 DOM 수명과 독립이다 — Claude 도구 카드·하위 작업 행·Work 활동 묶음의 펼침은 세션별 store 에 `<메시지 번호>/<블록 key>` 로 남는다 | 가상화로 언마운트됐다 돌아와도 펼침이 남아야 한다 — 감사 "복사·포커스·접힘 상태는 DOM 수명과 독립적으로 보존". 지금은 컴포넌트 `useState`(`ToolCard.tsx:71`) | 감사 · 설계자 | ACTIVE | — |
| D-019 | 접은 본문 해제 — 한 번 연 Claude 도구 카드는 닫힘 전환이 끝나면(`transitionend`, 동작 줄이기 설정이면 즉시) 본문을 언마운트한다. 다시 열면 다시 그린다. 복사는 클릭 때 계산(0325 D-013)이라 그대로다 | "접힘 애니메이션 뒤 무거운 본문을 해제한다. 전체 복사 보존" — 지금 `wasOpened` 가 본문을 계속 둔다(`ToolCard.tsx:74`·`:150`) | 요청서 T12 | ACTIVE | — |
| D-020 | OpenCode 긴 선택 — 보존 선택 범위가 `SELECTION_MOUNT_MAX_ROWS = 300` 행을 넘으면 양 끝 행·가시 행·앵커만 마운트한다. 그 선택에서 복사하면 복사 이벤트 안에서 범위 행을 동기로 마운트해 브라우저 기본 복사가 전 범위 DOM 을 읽게 한 뒤 다음 프레임에 되돌린다 | "긴 선택은 논리 범위를 보존하고 복사·키보드 선택·드래그를 검증한 뒤 DOM 범위를 줄인다". 모델 원문으로 복사하면 렌더 텍스트와 달라진다(§4) | 요청서 T06 · 0325 B5 | ACTIVE (사용자 거부 가능 — 300 은 W 실측 뒤 조정 · 키보드 선택 확장은 실창 확인) | — |
| D-021 | 사용자 버블 측정 일괄 — 버블들의 크기 변화 통지는 공유 `ResizeObserver` 하나로 받고 다음 프레임에 한 번 모아 읽는다(버블당 읽기 ≤ 1). 읽기 단계가 끝난 뒤 상태를 쓴다. (내용, 폭, 글자 배율)이 같으면 이전 판정을 쓴다 | "프레임별 읽기/쓰기 일괄 처리 … 폭별 높이 캐시를 검토한다. 사용자가 위로 읽는 중 강제 하단 이동은 금지한다" — 지금 버블마다 관찰자·`getComputedStyle`(`UserBubbleText.tsx:52-67`) | 요청서 T16 | ACTIVE | — |
| D-022 | Markdown 꼬리 — 꼬리가 닫히지 않은 펜스 코드 하나뿐이면 remark 파싱 없이 같은 DOM 의 코드 블록으로 그린다. 펜스가 닫히거나 완료되면 지금 경로다 | 열린 펜스 꼬리 20,000자 5.35ms · 100,000자 27.5ms(§8 M3). 스트리밍 중 강조 생략은 이미 있다(`StreamingMarkdown.tsx:10-11`) | 요청서 T07 · 설계자 | ACTIVE | — |
| D-023 | T07 의 워커 파서 상태·블록 ID 와 T12 의 워커 요약·미리보기, T05·T11 의 "W 또는 증분 색인" 중 W 는 단계 C 의 공통 워커 요청 규약 뒤다. B 는 R 증분 색인으로 같은 목표(무관 방문 0)를 닫는다 | 요청서 "Markdown·Git·산출물이 쓰는 공통 워커 요청 규약은 워커 담당자가 소유한다" · 0325 §6-A C 선행 | 요청서 전달 순서 · 0325 §6-A | ACTIVE (사용자 거부 가능) | — |
| D-024 | T17·T18 은 0325 D-019 대로 측정 우선 항목이다 — 코드를 바꾸지 않고 측정 입력과 실창 시나리오(§19 S7·S8)를 더한다. 이주·현행 유지 판정은 W 판정(0325 D-025) 뒤다 | 0325 D-019 "조건부·측정 우선 항목(T17·T18·…)은 … 단계 handoff 가 Windows 실측 뒤 이주 여부를 정한다" · 허용치 OPEN | 0325 D-019 · D-025 | ACTIVE | — |
| D-025 | 측정 스크립트 `scripts/measure-ui-inputs.mjs` 에 B 입력(J1~J8)을 더한다 — 0325 AC19 와 같은 장비에서 B 전후를 함수로 잰다 | 0325 D-042 의 측정 규약을 잇는다 | 설계자 · 0325 D-042 | ACTIVE | — |
| D-026 | 0325 D-004(0324 D-007·D-008·D-009·D-011·D-012·D-014·D-045 승계) · D-015 · D-021 · D-022 · D-030 · D-033 · D-034 · D-035 · D-043 을 따른다. 0325 D-023(이전 페이지 UX·미로딩 소비자)·D-025(허용치)는 OPEN 이고 이 handoff 는 기대지 않는다 | 0325 §3 ACTIVE | 0325 plan §3 | ACTIVE | — |
| D-027 | 단계 E 와의 공유 계약은 D-004·D-005·D-007(번호) · D-012·D-013(행 key) · D-009(변경 기록 — 앞삽입은 첫 변경 0 으로 기록)이다. 앞삽입에서 기존 메시지의 번호·행 key 는 그대로고 객체는 새로 만든다 | 요청서 "세션 페이지·행 ID·도구 ID 계약은 … 공유한다" · 0325 §6-C "B·E 의 ID 계약 … 후속 구현 전 합의" | 요청서 · 0325 D-021 | ACTIVE | — |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-027(Baseline). 사용자 결정 = D-001·D-002·D-004. D-003 은 질의 본문 고지.
- 변경된 결정: 없음(새 handoff). 0325 의 결정은 D-026 으로 승계한다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-026 의 0325 목록 · 0325 D-019(→ D-024).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-004·D-005·D-006·D-007·D-008 ↔ AC1~AC6 · D-009 ↔ AC7·AC8 · D-010 ↔ AC9·AC11·AC14·AC17 의 "방문 0" 정의 · D-011 ↔ AC17~AC20 · D-012 ↔ AC15·AC16 · D-013·D-027 ↔ AC10 · D-014 ↔ AC12 · D-015 ↔ AC13 · D-016 ↔ AC21 · D-017 ↔ AC22 · D-018 ↔ AC23 · D-019 ↔ AC24 · D-020 ↔ AC25 · D-021 ↔ AC26 · D-022 ↔ AC27 · D-023·D-024 ↔ §6 비범위·AC29(측정만) · D-025 ↔ AC28 · D-026 ↔ AC30 · D-001·D-002 ↔ §6 범위(T 전부 대응 — §6 표). D-003 ↔ 메타·INDEX. AC 가 D-006 반대(경계를 둘이 따로 정함)를 요구하는 곳 없음 — AC1·AC4·AC5 를 나란히 읽었다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | 타당 — 확정 이벤트 한 건의 비용이 이력 길이에 비례함을 실제 함수로 쟀다 | §8 M1 |
| 이미 충족됐는가 | 일부 — Claude 그룹 참조 유지·OpenCode live 리프는 0325 가 닫았다. Work 선택기·하위 작업 요약·자식 대화는 메시지·배열 WeakMap 캐시가 있으나 새 배열마다 전체를 돈다 | `workToolResults.ts:38-71` · `parts.ts:327-336` · 0325 AC4·AC7 |
| 더 작은 해법이 있는가 | 일부 — 생성 중 세션 키는 측정값이 작아 현행 유지(D-016). 번호는 renderer 부여(A)가 작지만 사용자가 D 를 골랐다(D-004) | §8 M2 · 턴 1 질의 |
| 선행 자료와 코드가 맞는가 | 정정 1 — 0325 §6-C B 행 "toolRunId 로 늦은 결과가 원래 카드에 돌아가게 한다" 는 이미 렌더 시 짝짓기로 성립한다(늦은 결과는 마지막 메시지에 붙고 카드는 toolRunId 로 찾는다). 남은 일은 그 짝짓기가 전체를 도는 비용이다 | `chatReducer.ts:1091-1100` · `workToolResults.test.ts:'joins a result beyond a confirmed user boundary only to its original call'` |
| 기존 결정과 충돌하는가 | 해소 2 — 0325 D-019(T17·T18 측정 우선)는 D-024 로 따른다. 0102 "가상 head + 비가상 tail" 과 0008 예약 앵커는 tail 안의 같은 분할로 보존한다(D-017) | 0325 plan §3 · `Timeline.tsx:47-50` |
| 긴 선택을 모델 원문으로 복사하면 되는가 | 안 된다 — 행 본문은 Markdown 원문이고 브라우저 복사는 렌더 텍스트다(`**굵게**` → "굵게"). 복사 순간에 범위를 마운트한다(D-020) | `Timeline.tsx:64-75` |
| 메시지 경계가 지금 일치하는가 | 일치하지 않는 경로가 있다 — writer 는 턴 끝(`telemetry`)에 마감하고 reducer 는 마지막이 user 일 때만 새 메시지를 만든다. 사용자 메시지 없이 다음 턴이 시작되면 라이브는 한 메시지, 재로드는 두 메시지다. D-006 이 번호로 맞춘다 | `writer.ts:515-519` · `chatReducer.ts:793-801` |

- 사용자에게 올릴 결정: 없음(D-001·D-002·D-004 는 이번 턴에 받음). "사용자 거부 가능" 표기: D-010·D-017·D-020·D-023.
- 코드 조사로 닫은 사실: §8 표 전부.

## 5. 동작 / 사용자 흐름

```text
에이전트 호스트: 이벤트 → 번호 붙임(새 메시지면 새 번호) ─┬→ 데이터 호스트: 그 번호로 행에 저장
                                                          └→ 창: 그 번호의 메시지에 붙임
창: messages 새 배열 + 변경 기록(이전 배열, 첫 변경)
   → Claude grouper / OpenCode head / transcript 색인: 첫 변경부터만 다시 묶음 → 바뀐 exchange·행·패널 행만 새 객체
   → 가상화: 화면 밖 exchange·(긴 마지막 exchange 의) 앞 블록은 마운트하지 않음 · 펼침은 store 에 남음
다시 열기: DB 로드(같은 번호) → key 가 같은 컴포넌트는 그대로 → 펼친 카드 유지
```

### 상태와 전이

| 상태 | 진입 | 표시 / 동작 | 종료 |
|---|---|---|---|
| 확정 이벤트 반영 | 도구 시작·결과·텍스트 완료·응답 경계·압축·하위 작업 | 바뀐 메시지가 든 exchange·행·카드·패널 행만 다시 그림 | 다음 이벤트 |
| 사용자 발화 커밋 | 낙관 표시(턴 첫 발화) 또는 echo 커밋 | 같은 번호 `u:<요청 id>` — 낙관 → 확정에서 다시 그리지 않음 | — |
| 다시 열기(캐시) | 세션 전환 후 복귀 · 원본 동기화 | DB 이력으로 교체하되 번호가 같은 exchange·행은 같은 key | 다음 로드 |
| 긴 마지막 exchange | 블록 > 200 | 앞 블록 가상화 · 뒤 40 블록과 대기·steer·오류는 그대로 | 다음 전송(그 exchange 가 head 로 감) |
| 긴 보존 선택(OpenCode) | 선택 범위 > 300 행 | 양 끝·가시·앵커만 마운트 · 복사 순간 전 범위 마운트 | 선택 해제 |
| 도구 카드 닫힘 | 연 카드를 닫음 | 닫힘 전환 뒤 본문 언마운트 | 다시 엶 |

### 파생 UX / 엣지케이스

- 라이브에서 이벤트 번호 없이 창이 만든 메시지(턴 끝 대기 텍스트 커밋 · fork 경계선)는 `r:` 번호라 재로드 뒤 다시 그려진다(B5).
- 원본 동기화가 라이브 메시지 하나를 원본 메시지 여럿으로 나누면 첫 메시지만 라이브 번호를 잇는다(D-007 · B6).
- 오류 이벤트는 writer 만 part 로 저장하고 창은 배너로 보인다(현행). 재로드에 그 part 가 든 메시지가 생겨도 번호가 새것이라 기존 key 와 겹치지 않는다(B7).

## 6. 범위 / 비범위

- **범위**: WU-1~WU-13. 공개 계약 변경은 D-008 다섯 가지뿐이다. 제품 흐름(무엇을 언제 보이는가)은 바뀌지 않고, 바뀌는 것은 다시 그리는 범위와 번호다.
- **비범위**: 단계 C(워커 규약·T07 파서·T12 요약 — D-023) · 단계 D · 단계 E(세션 페이지·앞삽입 생산자·미로딩 소비자 — 0325 D-022·D-023) · W 판정(T17·T18 이주 — D-024).

| WU | 요청 ID | 내용 | 런타임 소유자(위치) | AC |
|---|---|---|---|---|
| WU-1 | T03 선행 · B/E 공유 | 메시지 번호 — 에이전트 발급 · 저장 · 로드 · 창 사용 | agent(`persistence-sender`·coordinator) · data(writer·reader·마이그레이션) · R(reducer) | AC1~AC6 |
| WU-2 | T03 | 창 변경 기록 · 번호·toolRunId 색인 · reducer/store 조회 | R(`messageLog` · reducer · store) | AC7·AC8 |
| WU-3 | T04 그룹 · T05 · 설계 항목 | Claude grouper 증분 · id key · Work 결과 증분 · 비교자 단순화 · 분절 캐시 | R(`turns` · `workToolResults` · `segmentCache` · Timeline · Exchange · AssistantTurn · AssistantMessage · WorkActivity) | AC9~AC13 |
| WU-4 | T06 head · B19 | OpenCode head 증분 · 번호 key · 종류별 순번 | R(`projection` · Timeline) | AC14~AC16 |
| WU-5 | T11 · T25 | transcript 색인 · 도메인 revision · 소비자 9종 전환 | R(`transcriptIndex` · 패널·행·보드 소비자) | AC17~AC20 |
| WU-6 | T02 | 같은 종류 delta 묶음 반영 | R(`chatStore.receiveDeltaBatch`) | AC21 |
| WU-7 | T04 잔여 · B10 | 긴 마지막 exchange 블록 가상화 | R(Claude Timeline · `tailBlocks`) | AC22 |
| WU-8 | T12 일부 · 감사 | 펼침 상태 store | R(`disclosureStore` · ToolCard · AgentTaskRow · WorkActivity) | AC23 |
| WU-9 | T12 잔여 · B15 | 접은 본문 해제 | R(ToolCard) | AC24 |
| WU-10 | T06 잔여 · B5 | OpenCode 긴 선택 DOM 축소 · 복사 순간 마운트 | R(OpenCode Timeline) | AC25 |
| WU-11 | T16 | 사용자 버블 측정 일괄 | R(`bubbleMeasure` · UserBubbleText) | AC26 |
| WU-12 | T07(R) | 열린 펜스 꼬리 직접 렌더 | R(`markdownBlocks` · StreamingMarkdown) | AC27 |
| WU-13 | Windows 비교 · T17·T18 측정 | 측정 스크립트 J1~J8 · 실창 시나리오 | 개발 도구(`app/scripts/`) · 사람 | AC28·AC29 |

| 요청 ID | 0326 처리 | 남는 것 |
|---|---|---|
| T02 | WU-6 · 생성 중 세션 키 현행 유지(D-016) | — |
| T03 | WU-1·WU-2 | — |
| T04 잔여 | WU-3(그룹 첫 변경) · WU-7(블록 가상화) | 앞삽입 전체 재그룹 비용(B3 — E) |
| T05 | WU-3(R 증분) · 마운트 제한은 WU-7 의 Work 블록 | W 이주(D-023) |
| T06 잔여 | WU-4(head) · WU-10(선택) | 키보드 선택 확장 실창(AC29) |
| T07 | WU-12(열린 펜스) | loose list·긴 문단 꼬리(B9 — C 워커) |
| T11 | WU-5 | W 이주(D-023) |
| T12 잔여 | WU-8·WU-9 | 요약·미리보기 W(D-023) |
| T16 | WU-11 | 실창(AC29 S5) |
| T17·T18 | 측정만(D-024 · AC29 S7·S8) | 이주 판정(W) |
| T25 | WU-5 | — |
| 감사 memo 설계 항목 | 비교자(WU-3 AC12) · `reconcileSegments`(AC13) · Work 캐시(AC11) · OpenCode memo 테스트 확장(AC14) | — |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 같은 턴 이벤트 열을 흘리면 창이 만든 메시지 목록과 데이터 호스트가 저장해 다시 읽은 목록의 (번호, role, part type 열)이 같다. 열 = 사용자 발화 → reasoning → text → 도구 시작·결과 → 중간 steer 커밋 → 도구 → 턴 끝 → 사용자 커밋 없이 이어진 연속 턴의 텍스트 → 늦은 하위 작업 통지 | ST-01: 공유 고정 입력 `src/shared/message-identity.testfixture.ts`(번호 없는 이벤트 열 · 번호 붙은 기대 열 · 기대 메시지 목록 리터럴) — main 쪽: 송신기가 기대 열과 같게 번호를 붙이고 writer→reader 가 기대 목록 · renderer 쪽: reducer 가 기대 열로 기대 목록 | 버스 `turn.event` → `onTurnEvent`(번호) → 피어 `turn.event` → `HistoryWriter` → `loadSession` / `relay` → `oo:chat:event` → `chatReducer` |
| R-01 | AT-01 / AC2 | 세션 로드의 모든 메시지는 번호가 있고 세션 안에서 유일하다. 번호 있는 행 = 그 번호 · 번호 없는 옛 행 = `m:<DB id>` · 묶인 행 없는 원본 메시지 = `n:<원본 id>` · 행 하나가 원본 여럿에 묶이면 첫 원본만 그 번호, 나머지는 `n:` · 복구 보관본 = 저장된 번호 또는 `x:<순번>` | UT-02: `reader.test.ts`·`native-projection.test.ts` 신규 — 분기 i1~i7 입력 | `loadSession` → `localMessages` · `projectNativeHistory` · `recoveryArchive` |
| R-01 | AT-01 / AC3 | 에이전트 호스트는 part 를 만드는 이벤트 8종(`response.boundary`·`message.reasoning`·`tool.call.started`·`message.completed`·`tool.call.completed`·`error`·`session.compacted`·`subagent.task`)에 그 턴의 현재 번호를 붙인다. 현재 번호가 없으면 `a:<uuid>` 를 새로 만든다. 사용자 커밋·`telemetry`·턴 끝에서 현재 번호를 비운다. 질문 답의 도구 완료(버스 밖 송신)에도 같은 번호를 붙인다. 사용자 커밋 번호는 배치 첫 요청 id 로 `u:<id>`, 받은 입력(`input.received`)은 `u:` + 그 입력의 uuid(없으면 원본 id, 없으면 새 uuid)다 | UT-01: `persistence-sender.test.ts` 신규 k1~k8 · `turn-coordinator.test.ts` 신규 k9·k10 | `bus.emit('turn.event')` → `onTurnEvent`/`relay` · `flushAskAnswers` · `commitConsumed`/`input.received` → `commitUserMessage` + `message.committed` |
| R-01 | AT-01 / AC4 | writer 는 번호가 현재 메시지 번호와 다르면 현재 메시지를 마감하고 그 번호로 새 행을 만든다. 번호를 열에 저장한다. 번호 없는 이벤트는 지금 경계를 쓴다. 마이그레이션은 nullable 열과 (세션, 번호) 부분 유일 색인을 더하고 옛 DB 가 그대로 열린다 | UT-04: `writer.test.ts` 신규 w1~w5 · `migrate.test.ts` 신규 w6 · `check-migrations-appendonly` | `HistoryWriter.persistEvent` → `ensureAssistantMessage` → `db.appendMessage` |
| R-01 | AT-01 / AC5 | 창 reducer 는 이벤트 번호가 마지막 assistant 메시지 번호와 같을 때만 그 메시지에 붙이고, 다르면 그 번호로 새 메시지를 만든다. 번호 없는 이벤트·창 합성은 지금 규칙(마지막이 assistant 면 붙임)이고 새 메시지면 `r:` 번호다. 낙관 사용자 메시지와 그 echo 는 같은 번호다. 세션 로드는 `LoadedMessage.id` 를 그대로 쓴다 | UT-03: `chatReducer.messageId.test.ts` 신규 r1~r8 | `RECV_EVENT` → `appendAssistantPart(messages, part, messageKey)` · `APPEND_COMMITTED_USER_MESSAGE` · `LOAD_SESSION` |
| R-01 | AT-01 / AC6 | 캐시 세션을 다시 열어 같은 번호의 이력이 오면 Claude exchange key · OpenCode 행 key 가 바뀌지 않고, 열어 둔 Claude 도구 카드는 열린 채다(같은 컴포넌트 인스턴스) | IT-01: `ChatTile.reopen.test.ts` 신규 — 실제 store `loadSession` 경로(`sessionApi` 가짜) + fake DOM 하네스 | `loadSession` → `LOAD_SESSION(preserveLocalState)` → TranscriptView → key |
| R-02 | AT-02 / AC7 | reducer·store 가 `messages` 를 새 배열로 바꾸는 모든 자리는 (이전 배열, 첫 변경 색인)을 기록한다. 기록한 색인은 실제 첫 변경 색인 이하다. `changedFrom(이전, 지금)` 은 그 사이 기록의 최솟값이고, 기록이 없거나 64 단계를 넘거나 지금이 이전의 후손이 아니면 0 이다 | UT-05: `messageLog.test.ts` 신규 l1~l7 · reducer 전 사례 sweep `chatReducer.messageLog.test.ts`(사례마다 기록 색인 ≤ 실제 첫 변경) | `chatReducer` 쓰기 자리 → `commitMessages` → side-table |
| R-02 | AT-02 / AC8 | 산출물 소유 탐색(`output.captured` · 결과의 게시 영수증) · 커밋 멱등 판정 · 미확정 버블 회수(`message.cancelled` · `DROP_UNCOMMITTED_USER`) · 완료 통지 멱등(`subagent.task`) · 완료 작업 호출 탐색은 번호·toolRunId·응답 id 색인으로 찾는다 — 10,000 메시지에서 관계없는 메시지의 `parts` 읽기 0 | IT-02: `chatReducer.messageIndex.test.ts`·`chatStore.cancelled.test.ts` 신규 — parts getter 계수 | reducer `output.captured`·`tool.call.completed`·`APPEND_COMMITTED_USER_MESSAGE`·`DROP_UNCOMMITTED_USER`·`subagent.task`·`markCompletedAgentTask` · store `message.cancelled`·`hasCommittedClientId` |
| R-03 | AT-03 / AC9 | Claude 확정 이벤트 한 건(마지막 메시지 교체·끝 추가)에서 grouper 는 첫 변경 지점 앞 메시지를 읽지 않는다(배열 색인 읽기 0). 재사용 경계는 이분 탐색이다. 결과는 언제나 `groupExchanges` 전체와 같다(0325 g1~g14 유지) | UT-06: `turns.test.ts` describe `'createExchangeGrouper'` 신규 g15~g18 · 배열 Proxy 색인 계수 | `ClaudeTranscriptView` → grouper → `changedFrom` |
| R-03 | AT-03 / AC10 | exchange·turn 의 `id` 는 첫 메시지 번호다. head 가상 항목 key · tail key · 가상화 측정 key · Work 결과 맵 키 · turn key 는 `id` 다. 앞삽입(앞에 메시지 k 개)을 grouper 에 주면 기존 exchange 의 `id` 가 같고 결과 ≡ 전체이며, 렌더하면 기존 exchange 컴포넌트가 다시 마운트되지 않는다 | UT-06 g19 · IT-03: `Timeline.keys.test.ts` 신규 — fake DOM 하네스 노드 동일성 | `ClaudeTranscriptView` → `useTranscriptVirtualizer` → `Exchange` key |
| R-03 | AT-03 / AC11 | Work 결과 선택기는 첫 변경 지점부터의 메시지만 읽는다. 새 결과 한 건이 앞 exchange 의 호출이면 그 exchange 의 맵만 새 객체고 나머지 맵·바깥 맵 참조는 같다(바깥은 바뀐 맵이 있으면 새 객체). 결과는 지금 선택기와 같다 | UT-07: `workToolResults.test.ts` 신규 v1~v6 · 기존 7케이스 | `ClaudeTranscriptView` → `createWorkToolResultSelector(exchanges, change)` |
| R-03 | AT-03 / AC12 | `Exchange`·`AssistantTurn` memo 는 exchange·turn prop 을 참조로 비교한다. grouper 는 `exchangeEquals` 참이면 같은 참조, 거짓이면 다른 참조를 돌려준다(전수 g14 확장) | UT-06 g20 · IT-04: `Exchange.memo.test.ts` 신규 | grouper → `Exchange` memo → `AssistantTurn` memo |
| R-03 | AT-03 / AC13 | 메시지 분절 캐시 — parts 가 앞을 유지한 채 늘면(같은 번호의 메시지가 새 객체) 마지막 segment 이전의 segment 와 그 ToolCall 은 이전 객체이고 새로 읽는 part 는 마지막 segment 시작 이후뿐이다. parts 가 앞에서 바뀌면 전체를 다시 자른다. 결과는 `messageSegments` 와 같다. `reconcileSegments` 는 production 호출 0 이다 | UT-08: `segmentCache.test.ts` 신규 s1~s6 · 무작위 property(2,000 열) | `AssistantMessage` · `createWorkProjector` → `segmentsFor` |
| R-04 | AT-04 / AC14 | OpenCode 확정 이벤트 한 건에서 head 투영은 첫 변경 지점이 든 exchange 부터만 다시 투영한다 — (과거 exchange, 현재 확정 assistant) = (1,000, 10)·(10,000, 10)에서 관계없는 메시지 `parts` 읽기 0, 앞 exchange 의 행은 같은 참조. 결과는 전체 투영과 같다 | UT-09: `projection.test.ts` 신규 o1~o5 · IT-05: `Timeline.memo.test.ts` 신규 — parts getter 계수 · 행 참조 | `OpenCodeTimeline` → `createTimelineHeadProjector` |
| R-04 | AT-04 / AC15 | OpenCode 행 key 는 `<exchange 첫 메시지 번호>` 접두 + `:<kind>:<종류별 순번>` 이다. live text 행이 있고 현재 exchange 에 확정 text 가 없을 때 reasoning 이 처음 유효해지면 live text 행 key 가 그대로이고 같은 DOM 노드라 그 행 안의 선택이 남는다(0325 p2 의 key 변화 해소). 확정 text 와 합쳐진 live 행(p3)은 지금처럼 live 본문이 새 행으로 간다 | IT-06: `Timeline.selection.test.ts` 신규 — p2′ 노드 동일·`Selection` 유지 · p3 기대 | `projectTimelineTail` → `OpenCodeTimelineRow` |
| R-04 | AT-04 / AC16 | 기존 골든·투영 테스트의 기대는 key 만 새 규칙으로 바뀌고 나머지 필드(행 순서·kind·gap·streaming·segment)는 같다 | UT-10: `projection.golden.test.ts` — 골든 key 를 규칙 변환표로 바꾼 기대와 `toEqual` | `projectTimeline`(문자열 래퍼) |
| R-05 | AT-05 / AC17 | transcript 색인은 첫 변경 지점 이후 메시지만 철회·재적용한다 — 확정 이벤트 한 건의 `parts` 읽기 = 바뀐 메시지 수. 도메인 뷰 9종은 언제나 전체 계산 함수와 같다 | UT-11: `transcriptIndex.test.ts` 신규 x1~x9 · 무작위 이벤트 열 property(500 열 × 40 단계) — 단계마다 9종 `toEqual` 전체 함수 | store `messages` → `transcriptIndexFor` |
| R-05 | AT-05 / AC18 | 도메인 revision — 이벤트가 그 도메인 part 를 더하거나 철회하지 않으면 그 도메인 revision 과 뷰 참조가 같다(Bash 결과 → 작업 보드·하위 작업 요약·배경 모델 불변 · Task 도구 → 프로세스 행 불변 등 9×4 표) | UT-11 x10 — 도메인 × 이벤트 종류 표 | 같다 |
| R-05 | AT-05 / AC19 | 열린 하위 작업 상세는 그 부모의 자식 대화·요약만 구독한다 — 다른 부모의 자식 이벤트·무관 도구 결과에 다시 렌더 0, 자기 부모의 자식 이벤트에 1. 접으면 구독이 없다 | IT-07: `InlineSubagentDetail.test.ts` 신규 — 실제 store + 렌더 계수 | `InlineSubagentDetail` → `useTranscriptView('childMessage', id)` |
| R-05 | AT-05 / AC20 | 패널·행 소비자(작업 보드 · Claude 배경 패널 · OpenCode 패널 · 에이전트 행 · 완료 통지 행 · 하위 작업 타일 · 작업 맥락)는 색인 뷰를 읽는다 — 9개 전체 함수의 production 호출 0. 무관 이벤트에 소비자 재계산 0, 바뀐 Bash 호출만 프로세스 행 새 객체(출력 문자열 변환은 그 호출에만). 작업 보드의 모듈 1칸 캐시는 없다 | IT-08: 소비자별 렌더·계산 계수 테스트 · `rg` 음성 + 양성 대조(§10 EP-5) | 각 소비자 → `useTranscriptView` |
| R-06 | AT-06 / AC21 | 한 묶음의 같은 세션·같은 종류 연속 delta 는 문자열 결합 1회·세션 항목 교체 1회다. 다른 종류·다른 세션이 끼면 거기서 끊는다. 결과 live 값·BEGIN_TURN·라우팅은 지금과 같다 | UT-12: `chatStore.deltaBatch.test.ts` 신규 b1~b6 | `coalescer` → `receiveDeltaBatch` |
| R-07 | AT-07 / AC22 | Claude 마지막 exchange 의 블록이 200 을 넘으면 마지막 40 블록과 대기·steer·오류는 지금처럼 그리고 그 앞 블록은 가상화한다 — 가시 범위 고정에서 앞 블록을 1,000 → 5,000 으로 늘려도 마운트 블록 수가 같다. 200 이하는 지금 DOM 과 같다. fork 아이콘·예약 공간은 마지막 assistant 턴에 그대로 있다 | UT-13: `tailBlocks.test.ts` 신규 t1~t6 · IT-09: `Timeline.tailVirtual.test.ts` 신규(virtualizer 가짜 가시 범위) | `ClaudeTranscriptView` → `tailBlocks` → 두 번째 virtualizer |
| R-07 | AT-07 / AC23 | 펼침 상태는 store 에 있다 — Claude 도구 카드·하위 작업 행·Work 활동 묶음을 연 뒤 언마운트·재마운트해도 열려 있다. 세션별로 갈리고 세션을 지우면 함께 지운다 | IT-10: `disclosureStore.test.ts`·`ToolCard.interaction.test.ts` 신규 | 컴포넌트 → `useDisclosure(key)` |
| R-07 | AT-07 / AC24 | 연 Claude 도구 카드를 닫으면 닫힘 전환이 끝난 뒤 본문이 언마운트된다(동작 줄이기면 즉시). 전환 중 다시 열면 본문이 남는다. 복사 버튼 결과는 그대로다 | IT-11: `ToolCard.interaction.test.ts` 신규 — `transitionend` 디스패치 · matchMedia 가짜 | `ToolCard` |
| R-08 | AT-08 / AC25 | OpenCode 보존 선택이 300 행 이하면 지금처럼 범위 전체를 마운트한다. 넘으면 양 끝·가시·앵커만 마운트한다. 그 상태에서 복사 이벤트가 오면 그 핸들러 안에서 범위 전체를 동기로 마운트하고 다음 프레임에 되돌린다 | IT-12: `Timeline.selection.test.ts` 신규 — `rangeExtractor` 결과 · 복사 핸들러 안 마운트 수 | `OpenCodeTimeline` → `rangeExtractor` · `onCopy` |
| R-09 | AT-09 / AC26 | 같은 프레임에 크기가 바뀐 버블 N 개는 다음 프레임에 한 번 측정된다 — `getComputedStyle`·`scrollHeight` 읽기 버블당 ≤ 1, 상태 쓰기는 모든 읽기 뒤. (내용, 폭, 글자 배율)이 같은 버블은 읽기 0 | UT-14: `bubbleMeasure.test.ts` 신규 m1~m5(가짜 RO·rAF·요소) | `UserBubbleText` → `useBubbleOverflow` → `bubbleMeasure` |
| R-10 | AT-10 / AC27 | 스트리밍 꼬리가 닫히지 않은 펜스 코드 하나뿐이면 remark 파싱 없이 그린다 — DOM 은 같은 꼬리를 `Markdown` 으로 그린 결과와 같다(펜스 문자·길이·언어·들여쓰기 0~3 · 꼬리 앞 빈 줄). 그 밖의 꼬리는 지금 경로다 | UT-15: `markdownBlocks.test.ts` 신규 f1~f7 · `StreamingMarkdown.fence.test.ts` renderToString 대조 | `StreamingMarkdown` → `openFenceTail` |
| R-11 | AT-11 / AC28 | 측정 스크립트가 J1~J8 을 결정적으로 만들고 0325 규약(예열 1 · 9회 중앙값·최대 · N/A 두 갈래)으로 잰다 | UT-16: `measure-ui-inputs.test.mjs` 신규 j1~j3 | `node scripts/measure-ui-inputs.mjs --src <트리>` |
| R-11 | AT-11 / AC29 | 사람 실기 — §19 S1~S8 을 같은 Windows 장비에서 0326 전·후 빌드로 기록한다(값 또는 `N/A(사유)`). T17·T18 은 S7·S8 측정만 하고 판정은 W 다 | 사람 실기 — §19 | 설치본 · 진단 빌드 · `measure-ui-inputs.mjs` |
| R-0325-02·R-0325-03·R-0324-05·AR-PERSIST·AR-OC-SEL | AT(REGRESSION) / AC30 | REGRESSION — 0325 AC4~AC10·AC20·AC21 · 0324 AC15~AC17·D-045 · 저장 경로(writer·응답 경계·질문 답·백그라운드 기록·원본 이력) 기존 테스트가 그대로 통과한다 | §7-A VP-32~VP-36 기존 좌표 | 같다 |

### AC 검증 주의사항

- 사람 실기 항목: AC29 하나 — 실제 Chromium 레이아웃·스크롤·선택·paint 가 관측 대상이다. 가상화 범위·복사 마운트·측정 횟수·key 동일성은 AC22~AC26 이 fake DOM 하네스로 기계 검증한다.
- N회/총량 기준: "방문 0" 은 D-010 의 정의(메시지 `parts` getter)로 센다. 배열 색인 읽기 계수(AC9)는 배열 Proxy 의 숫자 키 `get` 이다.
- 같은 결과 대조: AC9·AC11·AC13·AC14·AC17 은 매 단계 전체 계산 함수(`groupExchanges`·현행 선택기·`messageSegments`·문자열 래퍼 `projectTimeline`·현행 9개 함수)와 `toEqual` 한다 — 현행 함수는 테스트 oracle 로 남는다(production 호출 0 은 AC20 · §10 EP-5).
- AC 수 30 은 handoff-plan §5 의 25 상한을 넘는다 — D-002(사용자 "B 전체 하나로").

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 구현 V 가 없어 `Baseline V` 다. 0325·0324 의 노드는 INHERITED REGRESSION 으로만 참조한다(0325 가 0324 를 둔 방식).
- 기준 V 상속 근거: 없음. 0325 노드 출처는 `0325:V1 rev 4 + ΔV1`(설계 `5923d9a`·`211afa7` · r1 구현 `52b5272`, 브랜치 `ccr-da0cf78b-aemqjb` — `main` 병합 뒤 검증자가 좌표를 교정한다). ΔV1 은 §10 검색 명령만 고쳐 AC·자리·oracle 이 같다 — VP-32·VP-33 의 인용 케이스는 그대로다.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 AC1~AC6 — 메시지 번호 | NEW | — |
| AT-01 | AT | §7 AC1~AC6 | NEW | — |
| SD-01 | SD | §10 EP-1~EP-4 — 같은 이벤트 열의 라이브 목록 = 재로드 목록 | NEW | — |
| AR-01 | AR | §10 EP-1 — 에이전트 발급 → 피어 저장 스트림·창 중계 | NEW | — |
| MD-01 | MD | §10 EP-1 — 발급·비움 규칙 | NEW | — |
| MD-02 | MD | §10 EP-3 — 로드 번호 규칙 | NEW | — |
| MD-03 | MD | §10 EP-4 — 창 reducer 번호 사용 | NEW | — |
| MD-04 | MD | §10 EP-2 — writer 경계·마이그레이션 | NEW | — |
| AR-02 | AR | §10 EP-4 ⑪ — 다시 열기 key 유지 | NEW | — |
| R-02 | R | §7 AC7·AC8 | NEW | — |
| AT-02 | AT | §7 AC7·AC8 | NEW | — |
| MD-05 | MD | §10 EP-5 — 변경 기록 | NEW | — |
| AR-03 | AR | §10 EP-6 — reducer·store 색인 조회 | NEW | — |
| R-03 | R | §7 AC9~AC13 | NEW | — |
| AT-03 | AT | §7 AC9~AC13 | NEW | — |
| MD-06 | MD | §10 EP-7 ①~③ — grouper 증분·id | NEW | — |
| AR-04 | AR | §10 EP-7 ④~⑦ — Claude Timeline key 배선 | NEW | — |
| MD-07 | MD | §10 EP-8 — Work 결과 증분 | NEW | — |
| AR-05 | AR | §10 EP-7 ⑧⑨ — memo 참조 비교 | NEW | — |
| MD-08 | MD | §10 EP-9 — 분절 캐시 | NEW | — |
| R-04 | R | §7 AC14~AC16 | NEW | — |
| AT-04 | AT | §7 AC14~AC16 | NEW | — |
| MD-09 | MD | §10 EP-10 ①~④⑦ — OpenCode head projector·key 규칙 | NEW | — |
| AR-06 | AR | §10 EP-10 ⑤⑥ — OpenCode Timeline 배선·선택 | NEW | — |
| R-05 | R | §7 AC17~AC20 | NEW | — |
| AT-05 | AT | §7 AC17~AC20 | NEW | — |
| MD-10 | MD | §10 EP-11 ①~⑤ — transcript 색인 | NEW | — |
| AR-07 | AR | §10 EP-11 ⑥~⑨ — 소비자 전환 | NEW | — |
| R-06 | R | §7 AC21 | NEW | — |
| AT-06 | AT | §7 AC21 | NEW | — |
| MD-11 | MD | §10 EP-12 — delta 묶음 | NEW | — |
| R-07 | R | §7 AC22~AC24 | NEW | — |
| AT-07 | AT | §7 AC22~AC24 | NEW | — |
| MD-12 | MD | §10 EP-13 ①② — `tailBlocks` | NEW | — |
| AR-08 | AR | §10 EP-13 ③~⑥ — tail 앞 블록 가상화 | NEW | — |
| AR-09 | AR | §10 EP-14 — 펼침 store 소비 | NEW | — |
| AR-10 | AR | §10 EP-15 — 접은 본문 해제 | NEW | — |
| R-08 | R | §7 AC25 | NEW | — |
| AT-08 | AT | §7 AC25 | NEW | — |
| AR-11 | AR | §10 EP-16 — OpenCode 긴 선택 | NEW | — |
| R-09 | R | §7 AC26 | NEW | — |
| AT-09 | AT | §7 AC26 | NEW | — |
| MD-13 | MD | §10 EP-17 — 버블 측정 일괄 | NEW | — |
| R-10 | R | §7 AC27 | NEW | — |
| AT-10 | AT | §7 AC27 | NEW | — |
| MD-14 | MD | §10 EP-18 — 열린 펜스 꼬리 | NEW | — |
| R-11 | R | §7 AC28·AC29 | NEW | — |
| AT-11 | AT | §7 AC28·AC29(사람) | NEW | — |
| MD-15 | MD | §10 EP-19 — 측정 입력 J1~J8 | NEW | — |
| R-0325-02 | R | 0325 AC4~AC6·AC20·AC21 — OpenCode live 독립·유무 전이 | INHERITED | 0325:V1 rev 4 R-02 / AT-02 |
| R-0325-03 | R | 0325 AC7~AC10 — Claude 증분 그룹화·steer 콜백 | INHERITED | 0325:V1 rev 4 R-03 / AT-03 |
| R-0324-05 | R | 0324 AC15~AC17 · D-045 — 세션 조각 조립·취소·진행 중 캐시 보존 | INHERITED | 0324:V1 rev 4.9 R-05 · SD D-045 |
| AR-PERSIST | AR | 저장 경로 — 응답 경계·질문 답·백그라운드 기록·원본 이력·사용자 커밋 순서 | INHERITED | 기존 테스트(§8 S9) — 상속 V 없음 |
| AR-OC-SEL | AR | OpenCode 선택 보존·스크롤 캡처 | INHERITED | 0325 AR-OC-SEL(기존 테스트) |

### Pair registry

규칙 칸의 분기 이름(k·w·i·r·l·g·v·s·o·x·b·t·m·f·j)은 §10 규칙 칸 표의 같은 기호와 1:1 이다. "fake DOM 하네스" = 기존 `renderer/src/shared/ui/renderHarness.testfixture.ts`(0325 §8 — 루트부터 다시 그리고 `useMemo`·rAF·`useSyncExternalStore` 를 흉내 낸다). Claude 도구 카드 테스트는 `harnesses/claude/transcript/ToolCard.interaction.test.ts`(있음) 에 더한다.

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 사용자 발화 → 에이전트 번호 → 창 목록 / DB 행 → 재로드 목록 → 다시 열기 key | VP-02·VP-03·VP-07 좌표 | not selected — 하위 pair 가 edge 마다 덮는다(아래 VP-02 edge 대응) | EP-1~EP-4 공유 |
| VP-02 | SD-01 ↔ ST-01 | REQUIRED | `bus.emit('turn.event')` → `onTurnEvent`(번호) → 피어 `turn.event` → `persistence-receiver` → `HistoryWriter` → `loadSession` ‖ `relay` → `chatReducer` | 신규 `main/app/message-identity.integration.test.ts:'라이브 번호 열과 재로드 목록이 고정 입력의 기대와 같다'`(실제 `createPersistenceSender` + 실제 receiver·writer·reader, DB) · 신규 `renderer/src/features/chat/reducer/chatReducer.messageIdentity.test.ts:'같은 번호 열을 reducer 에 넣으면 고정 입력의 기대 목록이다'` — 둘 다 `src/shared/message-identity.testfixture.ts` 의 기대 리터럴과 대조. 열 = §7 AC1 의 9단계(연속 턴 = 사용자 커밋 없는 두 번째 턴 · 늦은 통지 = `telemetry` 뒤 `subagent.task`) | required — 송신기 쪽 "`telemetry` 비움 제거" 변이(연속 턴 텍스트가 앞 메시지에 붙어 기대 목록 개수 red) · reducer 쪽 "번호 무시 — 마지막이 assistant 면 붙임" 변이(같은 단계 red) | EP-1 ⑥ · EP-2 ③ · EP-4 ② (3) |
| VP-03 | AR-01 ↔ IT-01a | REQUIRED | 버스 3 송출 자리 → `onTurnEvent` → `relay` 큐 → 창 · `flushAskAnswers` → 창·피어 | 신규 `persistence-sender.test.ts:'part 를 만드는 8종에 같은 번호를 붙여 저장과 화면에 같이 보낸다'`(8종 각 1 이벤트 · 피어 `notify` 와 `send` 인자의 `messageKey` 동일) · `:'확인을 기다리는 산출물 이벤트 뒤 줄 선 중계도 번호를 싣는다'` · `:'질문 답의 도구 완료는 화면 이벤트와 답 묶음에 같은 번호를 싣는다'` | required — EP-1 ③ "relay 가 번호 없는 사본을 보냄" 변이(큐 케이스 red) · EP-1 ④ 번호 제거 변이(질문 답 케이스 red) | EP-1 ③④⑤ (3) |
| VP-04 | MD-01 ↔ UT-01 | REQUIRED | 발급 상태 → 8종 판정 → 새 번호 / 현재 번호 → 비움 3자리 · 사용자 번호 2자리 | `persistence-sender.test.ts` 신규 k1~k8 · `features/chat/turn-coordinator.test.ts` 신규 k9·k10(§10 규칙 칸). uuid 는 주입한 결정적 생성기 | required — k5 `commitUserMessage` 비움 제거 · k6 `telemetry` 비움 제거 · k7 `finalizeTurn` 비움 제거 변이 각각 red · k9 `ids[0]` 를 `ids.at(-1)` 로 맞바꾸는 변이(2개 id 배치 입력) red | EP-1 ①~⑪ (11) |
| VP-05 | MD-02 ↔ UT-02 | REQUIRED | `loadParts` 행 → `localMessages` / `projectNativeHistory` / `recoveryArchive` → `LoadedMessage.id` | 신규 `reader.test.ts`·`native-projection.test.ts` i1~i7 + 유일성 단언(모든 로드 결과 `new Set(ids).size === length`) | required — i4 "이미 쓴 번호 건너뛰기" 제거 변이(중복 → 유일성 red) · i2 `m:` 를 `n:` 로 맞바꾸는 변이 red | EP-3 ①~⑥ (6) |
| VP-06 | MD-04 ↔ UT-04 | REQUIRED | `persistEvent` 8 case → `ensureAssistantMessage(turn, sid, key)` → `appendMessage({ messageKey })` · `commitUserMessage` | 신규 `writer.test.ts` w1~w5 · `infra/db/migrate.test.ts` 신규 w6(0035 까지 적용한 DB 에 0036 → 옛 행 `message_key` null · 같은 세션 같은 번호 두 번째 삽입 거부 · 다른 세션 같은 번호 허용) | required — w2 "번호가 달라도 현재 메시지에 붙임" 변이 red · EP-2 ④ 8 case 중 하나의 번호 인자 제거 변이(그 case 입력이 든 w4 red) | EP-2 ①~⑧ (8) |
| VP-07 | MD-03 ↔ UT-03 | REQUIRED | `RECV_EVENT` 7 case · `COMMIT_PENDING_TEXT` · `APPEND_COMMITTED_USER_MESSAGE` · `LOAD_SESSION` · fork 초안 · 자식 대화 합성 → `Message.id` | 신규 `chatReducer.messageId.test.ts` r1~r8 | required — r2 번호 비교 제거 변이 red · r5 낙관 번호를 `r:` 로 바꾸는 변이 red | EP-4 ①~⑩ (10) |
| VP-08 | AR-02 ↔ IT-01 | REQUIRED | `chatActions.loadSession`(캐시) → `sessionApi.load` 가짜(같은 번호·새 객체) → `LOAD_SESSION(preserveLocalState)` → Claude/OpenCode TranscriptView → key → 컴포넌트 | 신규 `components/ChatTile.reopen.test.ts:'reopening a cached session keeps exchange/row keys and an open tool card'` — Claude: `data-app-exchange` 노드 동일 · `aria-expanded="true"` 유지 · OpenCode: `data-timeline-key` 목록·노드 동일 | required — EP-4 ⑥ `LOAD_SESSION` 이 `m.id` 대신 `r:` 새 번호를 쓰는 변이(노드 동일 red) | EP-4 ⑥⑪ (2) |
| VP-09 | R-02 ↔ AT-02 | REQUIRED | reducer·store 쓰기 → 기록 → 소비자 `changedFrom` · 조회 → 색인 | VP-10·VP-11 좌표 | not selected | EP-5·EP-6 공유 |
| VP-10 | MD-05 ↔ UT-05 | REQUIRED | `commitMessages(base, next, from)` → side-table → `changedFrom(prev, next)` | 신규 `lib/messageLog.test.ts` l1~l7 · 신규 `chatReducer.messageLog.test.ts:'every messages write records a change no later than the first actual difference'` — EP-5 ③ 의 기록 자리마다 1 사례(ⓐ~ⓖ 7 자리 — ⓐ 는 새 메시지·붙임 두 사례), 사례마다 `recorded ≤ firstDiff(prev, next)` 와 `changedFrom` 값 단언 | required — l3 hop 상한 제거 변이(65 단계 사슬에서 0 이 아닌 값 → red) · EP-5 ③ 한 자리의 `from` 을 `next.length - 1` 로 고정하는 변이(그 자리 사례 red) | EP-5 ①② · ③ⓐ~ⓖ (9) |
| VP-11 | AR-03 ↔ IT-02 | REQUIRED | reducer `output.captured`·`tool.call.completed`(+`appendOwnedArtifact`)·`APPEND_COMMITTED_USER_MESSAGE`·`DROP_UNCOMMITTED_USER`·`subagent.task`·`markCompletedAgentTask` · store `message.cancelled`·`hasCommittedClientId` → `messagePosition`·`toolCallOwner`·`responseOwner`·`noticeOwner` | 신규 `chatReducer.messageIndex.test.ts` — 10,000 메시지(마지막 exchange 가 소유) · parts getter 계수기 · 자리마다 1 케이스: 소유 조회 결과 메시지 = 그 호출 메시지 · 관계없는 메시지 getter 0 · 신규 `chatStore.cancelled.test.ts:'recovers uncommitted bubbles by id without scanning history'`(실제 store `ingestChatEvent`) | required — EP-6 ⑤ 소유 조회를 `findIndex` 로 되돌리는 변이(getter 0 red) · EP-6 ⑧ 멱등 판정 제거 변이(echo 이중 버블 → 메시지 수 red) · EP-6 ⑩ 통지 멱등을 `some` 으로 되돌리는 변이(getter 0 red) | EP-6 ①~⑫ (12) |
| VP-12 | R-03 ↔ AT-03 | REQUIRED | `ClaudeTranscriptView` → grouper → Work 선택기 → `Exchange` → `AssistantTurn` → `AssistantMessage`/`WorkActivity` | VP-13~VP-17 좌표 | not selected | EP-7~EP-9 공유 |
| VP-13 | MD-06 ↔ UT-06 | REQUIRED | grouper(messages, options) → `changedFrom` → 이분 탐색 재사용 → 재그룹 → 동치 복원 → `id` | `turns.test.ts` describe `'createExchangeGrouper'` 신규 g15~g20 + 기존 g1~g14(0325) — 매 호출 `toEqual(groupExchanges(...))` | required — EP-7 ① 을 0325 참조 비교 루프로 되돌리는 변이(g15 배열 색인 읽기 0 단언 red) · EP-7 ② 이분 탐색 경계 `<`→`<=` 변이(0325 g8 입력 red) · EP-7 ③ `id` 를 마지막 메시지 번호로 맞바꾸는 변이(g19 red) | EP-7 ①②③ (3) |
| VP-14 | AR-04 ↔ IT-03 | REQUIRED | `ClaudeTranscriptView` → head 항목 key·tail key → `useTranscriptVirtualizer.getItemKey` → `Exchange` turn key → Work 결과 `get(id)` | 신규 `harnesses/claude/transcript/Timeline.keys.test.ts` — t-k1 앞삽입 3 메시지 렌더 → 기존 `data-app-exchange` 노드 동일 · t-k2 가상화 `getItemKey` 반환 = id 목록 · t-k3 Work 결과가 id 로 붙음(그 exchange 의 카드에 결과 표시) | required — EP-7 ④ head key 를 `startIndex` 로 되돌리는 변이(t-k1 red) · EP-7 ⑥ 변이(t-k2 red) · EP-7 ⑦ `get(startIndex)` 변이(t-k3 red) | EP-7 ④⑤⑥⑦ (4) |
| VP-15 | MD-07 ↔ UT-07 | REQUIRED | `createWorkToolResultSelector()(exchanges, change)` → 첫 변경 exchange 부터 parse → 소유 맵 → 바뀐 맵만 새 객체 | `workToolResults.test.ts` 기존 7 + 신규 v1~v6 — 매 단계 결과 `toEqual` 현행 선택기(테스트 안의 사본 `legacyWorkToolResults`) | required — EP-8 ④ 늦은 결과를 현재 exchange 맵에 넣는 변이(v3 red) · EP-8 ② 시작 지점을 0 으로 고정하는 변이(v1 의 parse 계수 red) | EP-8 ①~⑤ (5) |
| VP-16 | AR-05 ↔ IT-04 | REQUIRED | grouper 결과 → `Exchange` memo(참조) → `AssistantTurn` memo(참조) | 신규 `Exchange.memo.test.ts:'skips render when the grouper returns the same exchange object and renders when content changes'` · g20(전수: `exchangeEquals ⇔ ===`) | required — EP-7 ⑧ 비교자를 `() => true` 로 바꾸는 변이(내용 변경 렌더 red) · grouper 동치 복원 제거 변이(g20 red) | EP-7 ⑧⑨ (2) |
| VP-17 | MD-08 ↔ UT-08 | REQUIRED | `segmentsFor(message)` → 같은 번호 이전 결과 · parts 접두 참조 비교 → 마지막 segment 시작부터 재분절 | 신규 `lib/segmentCache.test.ts` s1~s6 · property(시드 고정 2,000 열 · 단계마다 `toEqual(messageSegments(parts))` · 마지막 앞 segment `toBe`) · 신규 `AssistantMessage.render.test.ts`(production 호출 경로) | required — EP-9 ① "접두 확인 없이 마지막 segment 부터" 변이(s4 앞 part 교체 입력 red) · EP-9 ② `reconcileSegments` 복귀는 `rg` 양성 단언(§10 EP-9 검색 출력에 `reconcileSegments(` production 0) | EP-9 ①~④ (4) |
| VP-18 | R-04 ↔ AT-04 | REQUIRED | `OpenCodeTimeline` → head projector → tail → 행 → 선택 | VP-19·VP-20 좌표 | not selected | EP-10 공유 |
| VP-19 | MD-09 ↔ UT-09·UT-10 | REQUIRED | `createTimelineHeadProjector()(messages, options, change)` → 재사용 entry → 재투영 → 행 key | `projection.test.ts` 신규 o1~o5 · `projection.golden.test.ts` 갱신(UT-10 — key 변환표 `goldenKeyMap` 으로 기대를 바꾼 뒤 `toEqual`) · 0325 b1~b9 유지 | required — EP-10 ② 재사용 경계 하나 앞당기는 변이(o2 결과 ≡ 전체 red) · EP-10 ④ 종류별 순번을 전체 순번으로 되돌리는 변이(o4 red) | EP-10 ①②③④⑦ (5) |
| VP-20 | AR-06 ↔ IT-05·IT-06 | REQUIRED | store `messages` → `OpenCodeTimeline`(projector `useState`) → `timelineRows` → 가상 항목 → `OpenCodeTimelineRow` | `Timeline.memo.test.ts` 신규 `'re-projects only from the changed exchange on a committed event'`(IT-05 — parts getter 계수 · 앞 행 참조) · `Timeline.selection.test.ts` 신규 `'keeps the live text row and its selection when reasoning first appears before it'`(IT-06 p2′ — 노드 동일 · `getSelection().toString()` 유지) · `'moves live text to a new row when committed text precedes it'`(p3) | required — EP-10 ⑤ Timeline 이 매 렌더 `projectTimelineHead` 를 부르는 변이(IT-05 getter 0 red) | EP-10 ⑤⑥ (2) |
| VP-21 | R-05 ↔ AT-05 | REQUIRED | store → 색인 → 뷰 → 소비자 | VP-22·VP-23 좌표 | not selected | EP-11 공유 |
| VP-22 | MD-10 ↔ UT-11 | REQUIRED | `transcriptIndexFor(messages)` → `changedFrom` → 접미 철회 → 재적용 → revision → 뷰 | 신규 `lib/transcriptIndex.test.ts` x1~x10 · property(시드 고정 500 열 × 40 단계 — 이벤트 종류 = reducer 기록 자리 ⓐ~ⓖ(EP-5 ③) + 앞삽입 + 전체 교체, 단계마다 뷰 9종 `toEqual` 현행 함수 · 계수 = 바뀐 메시지 수) | required — EP-11 ② 철회 제거 변이(x3 교체 입력에서 옛 결과 잔류 → red) · EP-11 ④ 한 도메인 revision 을 매 이벤트 올리는 변이(x10 표 red) | EP-11 ①~⑤ (5) |
| VP-23 | AR-07 ↔ IT-07·IT-08 | REQUIRED | 소비자 9종 → `useTranscriptView(domain, arg)` → 렌더 | 신규 `InlineSubagentDetail.test.ts`(IT-07 — 부모 A 열림: A 자식 이벤트 렌더 1 · B 자식 이벤트 0 · Bash 결과 0 · 접음 뒤 구독 0) · 신규 `rightpanel/panelConsumers.test.ts`(IT-08 — 소비자별 렌더 계수 · 프로세스 행 참조) · §10 EP-11 ⑧ 음성 검색 + ⑦ 양성 검색 | required — EP-11 ⑦ 한 소비자를 현행 함수로 되돌리는 변이(그 소비자 계수 red · ⑧ 검색 출력 1 → red) | EP-11 ⑥~⑨ (4) |
| VP-24 | R-06 ↔ AT-06 · MD-11 ↔ UT-12 | REQUIRED | coalescer → `receiveDeltaBatch(events)` → 묶음 → live | 신규 `store/chatStore.deltaBatch.test.ts` b1~b6 — 세션 항목 교체 계수(`setState` 가로채기 아님 — 반환 sessions 의 항목 참조 변화 수) · 결과 live `toEqual` 현행(테스트 사본) | required — EP-12 ② 묶음 끊기 조건에서 종류 비교 제거 변이(b3 red) | EP-12 ①~④ (4) |
| VP-25 | R-07 ↔ AT-07 | REQUIRED | Claude tail → 블록 → 앞 가상화 · 펼침 store · 본문 해제 | VP-26~VP-28 좌표 | not selected | EP-13~EP-15 공유 |
| VP-26 | MD-12 ↔ UT-13 · AR-08 ↔ IT-09 | REQUIRED | `tailBlocks(exchange, policy)` → 길이 ≤ 200 → 현행 / > 200 → 앞(가상) + 뒤 40 + 대기·steer·오류 | 신규 `lib/tailBlocks.test.ts` t1~t6 · 신규 `Timeline.tailVirtual.test.ts`(virtualizer 가짜가 가시 범위 고정 — 앞 블록 1,000·5,000 에서 마운트 블록 수 같음 · 200 에서 `data-tail-virtual` 0 · fork 버튼·`min-h-[50cqh]` 가 마지막 assistant 턴에) | required — EP-13 ② 임계 비교 `>`→`>=` 변이(t2 200 정확히 red) · EP-13 ④ 뒤쪽 40 블록을 가상 쪽에 넣는 변이(fork 버튼 위치 red) | EP-13 ①~⑥ (6) |
| VP-27 | AR-09 ↔ IT-10 · AR-10 ↔ IT-11 | REQUIRED | 컴포넌트 → `useDisclosure(key, initial)` → store · `ToolCard` 닫힘 → `transitionend` → 본문 언마운트 | 신규 `store/disclosureStore.test.ts` · `ToolCard.interaction.test.ts` 신규 `'keeps a tool card open across unmount'`·`'unmounts the body after the close transition and keeps the copy result'`·`'keeps the body when reopened mid-transition'`·`'unmounts immediately with reduced motion'` · `AgentTaskRow`·`WorkActivity` 펼침 유지 케이스 | required — EP-14 ② `useState` 복귀 변이(언마운트 케이스 red) · EP-15 ① `transitionend` 처리 제거 변이(본문 언마운트 케이스 red) | EP-14 ①~⑤ · EP-15 ①~③ (8) |
| VP-28 | R-08 ↔ AT-08 · AR-11 ↔ IT-12 | REQUIRED | 보존 선택 → `rangeExtractor` → 마운트 · `onCopy` → 동기 마운트 → 기본 복사 → 다음 프레임 복귀 | `Timeline.selection.test.ts` 신규 `'mounts the whole retained range up to 300 rows'`·`'mounts endpoints, visible rows and anchor beyond 300 rows'`·`'mounts the full range inside the copy handler and restores on the next frame'` | required — EP-16 ① 상한 비교 제거 변이(301 행 케이스 red) · EP-16 ② 복사 핸들러의 동기 마운트 제거 변이(핸들러 안 마운트 수 red) | EP-16 ①②③ (3) |
| VP-29 | R-09 ↔ AT-09 · MD-13 ↔ UT-14 | REQUIRED | RO 통지 → `bubbleMeasure` 대기열 → rAF → 읽기 일괄 → 쓰기 일괄 → `UserBubbleText` | 신규 `lib/bubbleMeasure.test.ts` m1~m5 · 신규 `UserBubbleText.measure.test.ts`(production 컴포넌트 · 가짜 RO 통지 → 읽기 계수) | required — EP-17 ③ 쓰기를 읽기 사이에 끼우는 변이(m3 순서 로그 red) · EP-17 ④ 캐시 키에서 폭 제거 변이(m4 red) | EP-17 ①~⑤ (5) |
| VP-30 | R-10 ↔ AT-10 · MD-14 ↔ UT-15 | REQUIRED | `StreamingMarkdown` → `advanceStableBlocks` → `openFenceTail(tail)` → `StreamingFence` / `Markdown` | `markdownBlocks.test.ts` 신규 f1~f7 · 신규 `components/markdown/StreamingMarkdown.fence.test.ts`(renderToString — 빠른 경로 HTML === `Markdown` 경로 HTML, f1~f7 각각 · remark 파싱 spy 0) | required — EP-18 ① 닫힘 펜스를 열린 것으로 보는 변이(f3 red) · 들여쓰기 4칸 허용 변이(f5 red) | EP-18 ①②③ (3) |
| VP-31 | R-11 ↔ AT-11 · MD-15 ↔ UT-16 | REQUIRED | `measure-ui-inputs.mjs` J1~J8 → 요약 · 사람 §19 | `scripts/measure-ui-inputs.test.mjs` 신규 j1~j3 · 사람 실기 §19 S1~S8 | not selected — 직접 값 단언 | EP-19 (3) |
| VP-32 | R-0325-02 ↔ AT | REGRESSION | 0325 VP-06~VP-09·VP-32 경로 | `Timeline.memo.test.ts:'re-renders only the live leaf for presence-preserving deltas once the live row exists, at every history size'` · `:'re-projects once per presence transition with string-projection keys and keeps surviving row nodes'`(p2 기대는 AC15 로 바뀐다 — key 유지. 그 케이스의 p2 기대를 AC15 기대로 갱신하고 p1·p3 은 그대로) · `chatStore.liveSelectors.test.ts` describe `'reasoning presence is updated per chunk'` · `Timeline.selection.test.ts:'keeps the same row component when a live row becomes the committed row of the same key'` | not selected | 0 — 이 경로의 자리는 EP-10 이 소유 |
| VP-33 | R-0325-03 ↔ AT | REGRESSION | 0325 VP-10~VP-13 경로 | `turns.test.ts` describe `'createExchangeGrouper'` g1~g14 · `ChatTile.workLifetime.test.ts:'passes a stable steer-restore callback per active session and rebinds it on switch'` · `workToolResults.test.ts` 기존 7케이스 · `workActivity.performance.test.ts:'measures 100 old exchanges plus 100 completed current messages over 100 tail updates'` | not selected | 0 — EP-7·EP-8 공유 |
| VP-34 | R-0324-05 ↔ AT | REGRESSION | 0324 AC15~AC17 · D-045 | `main/app/data-host/session-load.test.ts` describe `'세션 본문은 조각으로 가고 조립 결과는 \`loadSession\` 과 같다 (AC15)'` · `chatStore.native-history.test.ts:'finishes the loading state without replacing live data that arrived during a cold load'` · `shared/data-host.test.ts` describe `'세션 조각 분할'` | not selected | 0 — 조각·조립 자리는 바뀌지 않는다(번호는 메시지 필드라 조각 경계와 무관) |
| VP-35 | AR-PERSIST ↔ IT | REGRESSION | writer·receiver·sender 기존 경로 | `writer.test.ts` 전 케이스 · `writer.ask.test.ts`·`writer.background.test.ts`·`writer.native-history.test.ts`·`writer.received.test.ts`·`writer.artifacts.test.ts` · `main/app/response-boundary.integration.test.ts` · `persistence-receiver.test.ts` · `persistence-sender.test.ts` 기존 케이스 · `native-projection.test.ts`·`reader.test.ts` 기존 케이스 | not selected | 0 — 자리는 EP-1~EP-3 이 소유 |
| VP-36 | AR-OC-SEL ↔ IT | REGRESSION | 0325 VP-09 | `Timeline.selection.test.ts:'keeps selected live content on completion, then resolves complete Markdown when selection clears'` · `ScrollController.interaction.test.ts:'captures the latest scroll once per frame and cancels the queued capture on unmount'` | not selected | 0 — EP-16 공유 |

- VP-01 edge 대응: 발급(VP-03·VP-04) → 저장(VP-06) → 로드(VP-05) → 창 사용(VP-07) → 다시 열기(VP-08) — 종단 동치는 VP-02 가 두 쪽을 같은 리터럴로 묶는다.
- 두 pair 를 한 행에 묶은 행은 왼쪽 노드 순서대로 `a`·`b` 로 부른다 — VP-24a R-06↔AT-06 · VP-24b MD-11↔UT-12 · VP-26a MD-12↔UT-13 · VP-26b AR-08↔IT-09 · VP-27a AR-09↔IT-10 · VP-27b AR-10↔IT-11 · VP-28a R-08↔AT-08 · VP-28b AR-11↔IT-12 · VP-29a R-09↔AT-09 · VP-29b MD-13↔UT-14 · VP-30a R-10↔AT-10 · VP-30b MD-14↔UT-15 · VP-31a R-11↔AT-11 · VP-31b MD-15↔UT-16. 같은 행의 두 pair 는 좌표·§10 분모를 공유하고 판정은 따로 낸다. R-07(VP-25)는 VP-26·VP-27 좌표로 닫는다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 로컬 확인 전부 | `app/**` 소스·테스트·마이그레이션·스크립트를 바꾼다 | `app/AGENTS.md` "로컬 확인" — `check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` · `check-ui-thread` · lint · typecheck · 파일 필터 없는 vitest · `node --test scripts/*.test.mjs` · 빌드 + 두 스모크 | 이번 변경이 만든 실패 · 추가·수정 테스트 파일의 규칙 가드 위반 |
| DB 스위트 | 마이그레이션·writer·reader 를 바꾼다 — 실제 SQLite 실행이 oracle 이다 | io 풀 스위트(`writer*.test.ts`·`migrate.test.ts`·`message-identity.integration.test.ts`) — 제약 환경에서는 `npm rebuild better-sqlite3`(Node ABI) 뒤 실행, 불가면 CI(windows-latest) 결과를 증거로 둔다 | 같다 |
| 문서 계약 | 이벤트·로드 응답·DB 열이 바뀐다(D-008) | `docs/IPC_CONTRACT.md` · `docs/arch/backend/provider-runtime.md §2` · `docs/arch/backend/persistence.md` · `docs/arch/frontend/rendering.md` 갱신 · `node scripts/check-doc-inventory.mjs --check` | 같다 |
| 커밋 trailer 파싱 | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 같다 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 재현·측정 (이번 세션, Linux · Node v22.23.5 · esbuild 로 실제 소스 함수를 번들해 호출 · 1회 예열 뒤 9회 중앙값 / 최대)

입력: exchange 마다 user(text) + assistant(text · Bash 호출 · 결과), 10번째마다 Task 호출 + 자식 Read + 결과. 확정 이벤트 = 마지막 assistant 에 part 하나(reducer `appendAssistantPart` 와 같은 꼴). 측정 스크립트는 scratchpad 에 두었고 커밋하지 않는다 — 같은 입력은 WU-13 의 J1~J8 이 커밋된 스크립트로 다시 만든다.

| ID | 대상 | 1,000 exchange | 10,000 exchange | 100,000 exchange | 의미 |
|---|---|---|---|---|---|
| M1a | 참조 배열 `slice` | 0.002 / 0.005 ms | 0.085 / 0.716 | 0.960 / 5.157 | D-010 경계 B2 |
| M1b | Claude grouper(0325 증분) | 0.112 / 0.176 | 0.498 / 2.686 | 5.104 / 9.375 | 첫 변경 참조 비교 n 회(0325 B8) |
| M1c | Work 결과 선택기 | 2.155 / 4.276 | **19.456** / 28.796 | **343.5** / 624.6 | 전 exchange·메시지 순회(0325 B9) |
| M1d | OpenCode head 재투영 | 4.005 / 7.565 · 행 4,096 · 같은 참조 0 | **36.84** / 71.71 · 행 40,996 · 같은 참조 0 | — | 확정 이벤트마다 전부 새 행(0325 B6) |
| M1e | 작업 보드 `taskBoardFromMessages` | 0.426 / 0.531 | 5.029 / 6.963 | 116.9 / 136.6 | 새 배열 = 캐시 무효 |
| M1f | 하위 작업 요약 `subagentTasksFromMessages` | 0.889 / 1.714 | 5.506 / 7.387 | 151.5 / 186.9 | 같다 |
| M1g | 배경 패널 결과 `transcriptResultsByToolUseId` | 0.184 / 0.245 | 4.120 / 6.093 | 96.86 / 363.1 | 같다 |
| M1h | 배경 모델 `persistedBackgroundModels` | 0.204 / 0.731 | 0.444 / 0.479 | 9.034 / 9.990 | 같다 |
| M1i | OpenCode 패널 `sessionPanelModel` | 1.945 / 5.811 | **20.97** / 83.02 | **405.2** / 551.3 | 전 part 평탄화 + 출력 문자열화 |
| M1j | 완료 통지 설명 `subagentTaskDescription`(행마다) | 0.202 / 0.318 | 0.267 / 0.331 | 5.930 / 8.808 | 캐시 없음 × 표시 행 수 |
| M1k | reducer `output.captured` 소유 탐색 | 0.096 / 0.248 | 0.491 / 0.565 | 9.190 / 11.68 | `findIndex` 전체 |

| ID | 대상 | 값 | 의미 |
|---|---|---|---|
| M2 | 생성 중 세션 키 `generatingSessionKeys` | 세션 10: 0.002 · 100: 0.011 · 1,000: 0.148 ms | D-016 현행 유지 근거 |
| M3 | Markdown 꼬리 렌더(실제 react-markdown + remark-gfm, `renderToString`) | 열린 펜스 20,000자 5.35 / 13.93 · 100,000자 27.54 / 50.14 · 긴 문단 20,000자 9.06 / 19.51 · 100,000자 62.96 / 87.97 · loose list 20,000자 **84.33** / 141.3 · 100,000자 **451.5** / 558.5 · `advanceStableBlocks`(+1자) 0.07~0.27 ms | D-022(펜스) · B9(목록·문단 — C) |
| M4 | parts 접두 참조 비교 · parts 배열 복사 | 1,000: 0.033 · 0.012 ms · 10,000: 0.210 · 0.072 · 100,000: 0.276 · 1.041 | 분절 캐시 접두 확인(B4) — reducer 가 이미 parts 를 복사한다 |
| M5 | 바깥 `Map` 복사(`new Map(m)`, exchange 수 칸) | 1,000: 0.125 / 0.963 · 10,000: 1.792 / 2.275 · 100,000: 15.31 / 26.37 ms | Work 바깥 맵은 복사하지 않는다(EP-8 ⑤) |

### 발견 / 제약 (코드)

| ID | 발견 | 근거 |
|---|---|---|
| F1 | 창 `Message` 와 공개 `LoadedMessage` 에 번호가 없다 — 필드는 role·createdAt·parts·incomplete(·`clientId` 라이브 전용) | `chatReducer.ts:227-235` · `shared/ipc.ts:1612-1617` |
| F2 | 행 key — Claude exchange = 배열 색인 `startIndex`, OpenCode = `role:createdAt[:occurrence:n]` | `claude/transcript/Timeline.tsx:92`·`:120` · `useTranscriptVirtualizer.ts:27` · `opencode/transcript/projection.ts:46-52` |
| F3 | 턴 이벤트는 에이전트 호스트가 데이터 호스트와 창에 함께 보내고 창은 저장을 기다리지 않는다. 버스 구독 순서 = 저장 송신(critical) → 제목 → 중계, 둘이 같은 `ev` 객체를 받는다 | `execution-model.md:47-49` · `agent-host/bootstrap.ts:510-514` |
| F4 | 버스 송출 자리는 셋이다 — 조정자 `emit` · 정착 `emitTurn` · 종료 `emit` | `rg -n "emit\('turn.event'" src/main --glob '*.ts' --glob '!*.test.ts'` → 3 (`turn-coordinator.ts:107` · `chat-turn/index.ts:50` · `agent-host/bootstrap.ts:852`) |
| F5 | 질문 답의 도구 완료는 버스를 타지 않는다 — 송신기가 창에 직접 보내고 피어에는 `turn.askAnswers` 로 보낸다 | `persistence-sender.ts:168-205` |
| F6 | DB 번호는 데이터 호스트가 저장할 때 만든다. 사용자 커밋 번호는 `message.committed.messageId` 로 창에 오지만 창이 읽지 않는다. assistant 번호는 창에 오지 않는다 | `writer.ts:94-121`·`:191-199` · `turn-coordinator.ts:185-201` · `chatStore.ts:862-875` |
| F7 | assistant 메시지 시각은 writer `Date.now()` 와 reducer `Date.now()` 가 따로 찍는다 | `writer.ts:197` · `chatReducer.ts:796` |
| F8 | writer 가 part 를 만드는 case 는 8종(`ensureAssistantMessage` 호출), reducer 가 part 를 붙이는 case 는 7종 + 로컬 1(`COMMIT_PENDING_TEXT`). 차이는 `error`(writer 만 part) | `rg -n "ensureAssistantMessage\(turn" src/main/features/history/writer.ts` → 9 = 정의 1 + 호출 8 · `rg -n "appendAssistantPart\(state" src/renderer/src/features/chat/reducer/chatReducer.ts` → 8 |
| F9 | writer 경계는 사용자 커밋·`telemetry`·턴 끝에서 마감, reducer 경계는 "마지막이 user 면 새 메시지" 다 | `writer.ts:148`·`:182-186`·`:515-519` · `chatReducer.ts:793-801` |
| F10 | 창이 Message 객체 리터럴을 만드는 자리는 다섯이다 — 새 assistant · 커밋 user · 로드 · fork 경계선 · 자식 대화 합성 | `rg -n "role: '(assistant|user)'( as const)?,\|role: m\.role" src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*'` → 7 = 5 + `turns.ts` Turn 리터럴 2 |
| F11 | 사용자 커밋 경로는 둘 — 큐 배치(`commitConsumed`, 배치 `ids`) · 받은 입력(`input.received`, `ids: []`) | `turn-coordinator.ts:177-203` · `:368-389` |
| F12 | 원본 투영은 로컬 행 하나를 원본 메시지 여럿에 묶을 수 있다(`localTargets: Map<행, 원본 색인[]>`). 복구 보관본은 번호 없는 `LoadedMessage[]` JSON 이다 | `native-projection.ts:51-61` · `native-recovery.ts:20-22` · `reader.ts:86` |
| F13 | `NativeHistoryMessage extends LoadedMessage { id: string }` — 어댑터의 원본 id 다 | `adapters/common/native-history.ts:18-22` |
| F14 | reducer 의 전체 탐색 — 산출물 소유 `findIndex` 2 · 커밋 멱등 `some` 1 · 미확정 버블 `filter` 1 · 완료 작업 역탐색 1. store 의 `message.cancelled` 버블 `filter` 1 · `hasCommittedClientId` `some` 1 | `chatReducer.ts:941-961`·`:1043`·`:1107`·`:2159` · `chatStore.ts:482-486`·`:907-913` |
| F15 | Work 선택기는 매 호출 전 exchange·turn·메시지를 돌며(파싱은 메시지 WeakMap) 소유 맵을 다시 만든다 | `workToolResults.ts:38-71` |
| F16 | 바뀐 메시지는 `messageSegments(parts 전체)` 뒤 `reconcileSegments` 로 참조를 복원한다(Claude 공통 · Work 투영) | `AssistantMessage.tsx:31-33` · `workActivity.ts` import |
| F17 | `messages` 를 구독하는 컴포넌트·훅 11곳, 전체 파생 함수 9종의 정의·호출 26줄(14파일) | `rg -n "\(s\) => s\.messages\)\|\(state\) => state\.messages\)" src/renderer/src --glob '!*.test.*'` → 11 · §10 EP-11 ⑧ 검색 → 26 |
| F18 | 작업 보드 캐시는 모듈 전역 1칸이라 세션·타일이 같은 칸을 덮는다 | `taskBoard.ts:100-109` |
| F19 | Claude 마지막 exchange 는 항상 비가상 tail 로 전부 마운트되고 그 안의 메시지·segment key 는 색인이다 | `Timeline.tsx:47-50`·`:110-128` · `AssistantTurn.tsx:52-54` · `AssistantMessage.tsx:39-41` |
| F20 | Claude 도구 카드 펼침은 컴포넌트 `useState` 이고 한 번 연 본문은 닫아도 남는다. OpenCode 는 행 key 로 된 `TimelineDisclosureContext` 를 쓴다 | `ToolCard.tsx:71-74`·`:150` · `opencode/transcript/Timeline.tsx:97` |
| F21 | OpenCode 보존 선택은 양 끝 사이 모든 색인을 가상화 범위에 넣는다 | `opencode/transcript/Timeline.tsx:64-75` |
| F22 | 사용자 버블은 버블마다 `ResizeObserver` · `getComputedStyle` · `scrollHeight` 를 layout effect 안에서 읽고 바로 상태를 쓴다 | `UserBubbleText.tsx:52-67` |
| F23 | 스트리밍 꼬리는 매 delta `<Markdown source={tail}>` 로 다시 파싱된다. 꼬리는 열린 펜스·loose list 에서 나뉘지 않는다 | `StreamingMarkdown.tsx:22-37` · `markdownBlocks.ts:5-11` |
| F24 | 경과 시간은 카드마다 `setInterval(1000)` 이고 계획 승인 카드는 계획 Markdown 을 버튼과 같은 렌더에서 그린다 — T17·T18 은 바꾸지 않는다(D-024) | `shared/ui/elapsed.ts:28-31` · `ApprovalCard.tsx:160-165` |
| F25 | delta 반영은 이벤트마다 세션 탐색·문자열 결합·항목 spread 다(묶음당 `sessions` 복사 1) | `chatStore.ts:550-573` |

### 전수 조사 (`app/` 기준 · AS-IS)

| ID | 대상 | 검색/방법 | N | 의미 |
|---|---|---|---:|---|
| S1 | 버스 송출 | `rg -n "emit\('turn.event'" src/main --glob '*.ts' --glob '!*.test.ts'` | 3 | F4 |
| S2 | writer part 생성 case | `rg -n "ensureAssistantMessage\(turn" src/main/features/history/writer.ts` | 9 | 정의 1 + 호출 8 — EP-2 ④ 분모 8 |
| S3 | reducer part 붙이기 | `rg -n "appendAssistantPart\(state" src/renderer/src/features/chat/reducer/chatReducer.ts` | 8 | EP-4 ③④ 분모(7 이벤트 + `COMMIT_PENDING_TEXT`) |
| S4 | 창 Message 리터럴 | F10 명령 | 5 | EP-4 ⑤~⑧ 분모 |
| S5 | 전체 파생 함수 정의·호출 | `rg -n "subagentTasksFromMessages\(\|childMessageForParentToolRunId\(\|subagentTaskDescription\(\|taskBoardForMessages\(\|taskBoardFromMessages\(\|transcriptResultsByToolUseId\(\|persistedBackgroundModels\(\|sessionPanelModel\(\|createTaskContextSourceSelector\b" src/renderer/src --glob '!*.test.*'` | 26 | 14파일 — EP-11 ⑦⑧ |
| S6 | `messages` 구독 | F17 명령 | 11 | `ChatTile` 1(Transcript 로 전달) · `ProjectLandingPage` 1(`length` 만 — 무관) · 파생 소비자 9 |
| S7 | `startIndex` 사용(테스트 제외) | `rg -n "startIndex" src/renderer/src --glob '!*.test.*' --glob '!*.json'` | 26 | turns 15 · Claude Timeline 4 · Exchange 2 · virtualizer 2 · Work 1 · `useAttachments` 2(무관 — 첨부 색인) |
| S8 | reducer `messages` 쓰기 | `rg -n "^\s+messages[,:]\|let messages = \|const messages = \|messages = append" src/renderer/src/features/chat/reducer/chatReducer.ts` | 21 | 형 선언·초기값 5 + 쓰기 16줄 = EP-5 ③ 7 자리 |
| S9 | 저장 경로 기존 테스트 | `ls src/main/features/history/writer*.test.ts src/main/app/data-host/persistence-receiver.test.ts src/main/app/agent-host/persistence-sender.test.ts src/main/app/response-boundary.integration.test.ts` | 9 | VP-35 |

### 수치 / 전칭 표현 검산

- S8 21 = 형 선언·초기값 5(`:329` `ChatState` · `:542` 초기값 · `:804`·`:832`·`:2178` 매개변수) + 쓰기 16줄. 쓰기 16줄 = `appendAssistantPart` 호출 8 + `appendOwnedArtifact` 호출 2(`:1054`·`:1114`) + `correctPlanToolInput` 호출 1(`:1215`) + `tool.call.completed` 반환 1(`:1129`) + `APPEND_COMMITTED_USER_MESSAGE` 1(`:944`) + `DROP_UNCOMMITTED_USER` 1(`:959`) + `LOAD_SESSION` 2(`:1490`·`:1571`) → 기록 자리 7(EP-5 ③ ⓐ~ⓖ — 도우미 3 + 인라인 4). store 의 `messages` 쓰기는 fork 초안 1(`chatStore.ts:1618` — 새 세션이라 이전 배열이 없다).
- S7 26 = 15 + 4 + 2 + 2 + 1 + 2.
- "버스 송출은 셋": S1 → 3(`--glob '*.ts'` 없이 돌리면 `src/main/AGENTS.md:79` 문서 줄이 하나 더 잡힌다). "Message 리터럴은 다섯": F10 출력 7줄 중 Turn 리터럴 2 를 뺀 5.
- 기존 테스트 이름은 `rg -n "^\s*(describe|it)\("` 로 확인했다 — VP-32~VP-36 의 인용 케이스 전부(0325 plan §7-A 의 인용과 같은 문자열).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
에이전트 호스트  어댑터 이벤트 → bus → 송신기(피어 notify) → 중계(창)
데이터 호스트    writer: 사용자 커밋·telemetry·턴 끝 = 경계 · ensureAssistantMessage → DB id(창 모름)
창              reducer: 마지막이 user 면 새 메시지(번호 없음) · messages 새 배열
                Claude: grouper(참조 비교 n) → Work 선택기(전체) → Exchange(startIndex key, 비교자 순회) → AssistantMessage(전체 재분절 + reconcile)
                OpenCode: projectTimelineHead(전체 · occurrence 스캔) → 행(role:createdAt key)
                패널·행·보드: 9 함수 × 새 배열마다 전체 접기
                tail exchange: 전부 마운트 · 도구 카드 펼침 = useState · 한 번 연 본문 유지
                OpenCode 긴 선택: 범위 전부 마운트 · 버블: 개별 RO + 즉시 측정 · 열린 펜스 꼬리: 매 delta remark
```

### TO-BE

```text
에이전트 호스트  bus → 송신기: 8종에 현재 번호(a:uuid · 비움 3자리) → 피어 + 같은 ev 로 중계 · 질문 답도 번호 · 사용자 커밋 u:<id>
데이터 호스트    writer: 번호가 바뀌면 새 행(번호 저장) · reader: 번호 → LoadedMessage.id (m:/n:/x: 규칙)
창              reducer: 번호가 다르면 새 메시지 · commitMessages(base, next, from) 기록 · 색인(번호 → 위치 · toolRunId → 소유)
                Claude: grouper(changedFrom · 이분 탐색) → Work 선택기(첫 변경부터) → Exchange(id key · 참조 비교) → segmentsFor(접두 재사용)
                       tail exchange 블록 > 200 → 앞 블록 가상화 + 뒤 40 블록 그대로
                OpenCode: head projector(첫 변경 exchange 부터 · id key · 종류별 순번)
                패널·행·보드: transcriptIndexFor(messages) → 도메인 뷰(revision) → useTranscriptView
                펼침 = disclosureStore · 닫힘 전환 뒤 본문 해제 · 긴 선택 = 끝점·가시 + 복사 때 마운트 · 버블 = 공유 RO + rAF 일괄 · 열린 펜스 = 직접 코드 블록
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 메시지 경계를 writer·reducer 가 따로 | 에이전트 번호가 정본 — 둘은 따른다 | D-006 | VP-02·VP-04 |
| data/control flow | 확정 이벤트마다 전체 재투영 | 변경 기록으로 첫 변경부터 | D-009·D-011 | VP-10·VP-13·VP-15·VP-19·VP-22 |
| state/contract | 번호 없음 · key = 색인·시각 | 번호(이벤트·로드·DB) · key = 번호 | D-004·D-008·D-012·D-013 | VP-05~VP-08·VP-14·VP-19 |
| error/lifecycle | 다시 열기·가상화로 펼침 소실 | 펼침 store · 번호 같은 key | D-018 · D-004 | VP-08·VP-27 |
| test seam/관측점 | 시간·호출 수 | parts getter 계수 · 배열 Proxy · 렌더 계수 · 공유 고정 입력 · property | AC 정의(D-010) | 각 UT·IT |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `src/shared/message-id.ts`(신규) | 번호 접두 상수 · 생성 함수 7(`assistantMessageId`·`userMessageId`·`localRowMessageId`·`nativeOnlyMessageId`·`archivedMessageId`·`rendererMessageId`·`childMessageId`) · `PART_EVENT_TYPES`(8종 정본) | 원천 id → 번호 문자열 | 송신기 · 조정자 · writer · reader · reducer · store · `parts.ts` |
| `src/shared/message-identity.testfixture.ts`(신규) | 종단 고정 입력(번호 없는 열 · 번호 열 · 기대 목록 리터럴) | — | main ST · renderer ST |
| `main/app/agent-host/persistence-sender.ts` | 번호 발급 상태(턴별) · 8종 도장 · 질문 답 도장 · 비움 | 턴 이벤트 → 번호 붙은 이벤트 | 버스 구독(조립 `agent-host/bootstrap.ts`) |
| `main/features/chat/turn-coordinator.ts` | 사용자 커밋 번호 2경로 | 배치·받은 입력 → `messageKey` | 조정자 실행 루프 |
| `main/features/history/writer.ts` · `infra/db/{queries,types}.ts` · `migrations/0036_message_key.sql` | 번호 경계 · 번호 저장 · 로드 행에 번호 | 이벤트 → 행 | 데이터 호스트 receiver |
| `main/features/history/{native-projection,reader,native-recovery}.ts` | `LoadedMessage.id` 규칙 | 행·원본·보관본 → 번호 | `loadSession` |
| `renderer/.../lib/messageLog.ts`(신규) | 변경 기록 · `changedFrom` · `messagePosition` · `toolCallOwner` | 배열 → 기록·색인 | reducer · store · grouper · projector · 색인 · 선택기 |
| `renderer/.../lib/transcriptIndex.ts`(신규) | 접미 철회 색인 · 도메인 뷰 9 · revision | messages → 뷰 | store 훅 `useTranscriptView` |
| `renderer/.../lib/segmentCache.ts`(신규) | 메시지 분절 캐시(`segmentsFor`) | 메시지 → segment | `AssistantMessage` · `workActivity` |
| `renderer/.../lib/tailBlocks.ts`(신규) | 마지막 exchange 블록 목록 · 분할 | exchange·정책 → 블록 | Claude Timeline |
| `renderer/.../store/disclosureStore.ts`(신규) | 세션별 펼침 상태 | key → 불리언 | ToolCard · AgentTaskRow · WorkActivity |
| `renderer/.../lib/bubbleMeasure.ts`(신규) | 공유 RO · rAF 일괄 측정 · 캐시 | 요소 → 넘침 판정 | `UserBubbleText` |
| `renderer/.../lib/markdownBlocks.ts` · `components/markdown/StreamingMarkdown.tsx` | `openFenceTail` · 빠른 경로 | 꼬리 → 펜스 | StreamingMarkdown |

## 10. 계약 / 타입 / 강제 지점

검색 명령은 `app/` 에서 돌린다. "출력과 차집합 0"은 출력의 모든 줄이 목록의 어떤 자리에 속하고 자리마다 줄이 1개 이상이라는 뜻이다. 번호(D-005) 접두와 생성 함수의 정본은 `src/shared/message-id.ts` 하나다 — 다른 파일이 `'a:'`·`'u:'` 같은 접두 문자열을 직접 쓰지 않는다(EP-1 ① 의 음성 검색).

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| **EP-1** · AR-01·MD-01 / VP-03·VP-04 | 에이전트가 part 를 만드는 8종에 턴의 현재 번호를 붙이고 정해진 3자리에서 비운다 · 사용자 커밋 번호 2경로 | `src/shared/message-id.ts` · `persistence-sender.ts` · `turn-coordinator.ts` | 에이전트 호스트 | 자리 11 — ① `message-id.ts` 접두 상수 7 · 생성 함수 7 · `PART_EVENT_TYPES`(8종 정본 — writer·reducer 가 같은 목록을 쓴다) ② 송신기 `TurnState.messageKey`(턴별 현재 번호) · 주입 `newId`(조립이 `crypto.randomUUID` 를 넘긴다 — 기본값 없음) ③ `onTurnEvent` — 8종이면 `ev.messageKey = state.messageKey ??= assistantMessageId(newId())` 를 피어 `notify`·`request` 전에 ④ `relay`(큐 포함)는 같은 `ev` 객체를 보낸다(현행 꼴 — 사본을 만들지 않는다) ⑤ `flushAskAnswers` — 창으로 보내는 `tool.call.completed` 와 `turn.askAnswers` 묶음에 ③ 과 같은 번호 ⑥ `onTurnEvent` 의 `telemetry` → 피어 송신 뒤 `state.messageKey = undefined` ⑦ `commitUserMessage` → 요청 전에 비우고 배치의 `messageKey` 를 피어 `turn.commitUser` 로 ⑧ `finalizeTurn` → 상태 삭제(비움) ⑨ 조정자 `commitConsumed` → `messageKey = userMessageId(batch.ids[0])` 를 커밋 배치와 `message.committed` 에 ⑩ 조정자 `input.received` → `messageKey = userMessageId(ev.uuid ?? ev.nativeMessageId ?? newId())` 를 같은 두 곳에 ⑪ 형 — `shared/ipc.ts` 의 8종 이벤트 `messageKey?: string` · `message.committed.messageKey: string` · 피어 프로토콜의 `turn.commitUser` 배치·`turn.askAnswers` 묶음 `messageKey` | 두 명령 — `rg -n "messageKey\|PART_EVENT_TYPES\|assistantMessageId\|userMessageId" src/main/app/agent-host src/main/features/chat src/shared/message-id.ts src/shared/ipc.ts src/shared/peer-protocol.ts --glob '!*.test.ts'` → 출력과 ①~⑪ 차집합 0 · 음성 두 패턴 — ``rg -n '`(a\|u\|m\|n\|x\|r\|c):\$\{' src --glob '!*.test.*' --glob '!*.testfixture.*' --glob '!src/shared/message-id.ts'`` · `rg -n "'(a\|u\|m\|n\|x\|r\|c):' \+" src --glob '!*.test.*' --glob '!src/shared/message-id.ts'` → 둘 다 0(AS-IS 도 0 — 넓은 따옴표 패턴은 `attachments.ts:83` 의 드라이브 비교 `'c:'` 를 잡아 쓰지 않는다) | ③ 이 빠지면 창과 DB 가 다른 경계를 쓴다. ⑥⑦⑧ 중 하나가 빠지면 사용자 커밋·턴 끝 뒤의 답이 앞 메시지에 붙는다(VP-02 red). ④ 가 사본을 보내면 큐 뒤 중계가 번호 없이 간다 |
| **EP-2** · MD-04 / VP-06 | writer 경계 = 번호 · 번호 저장 · 로드 행에 번호 | `features/history/writer.ts` · `infra/db/{queries,types}.ts` · `migrations/0036_message_key.sql` | 데이터 호스트 | 자리 8 — ① `0036_message_key.sql` — `ALTER TABLE messages ADD COLUMN message_key TEXT` · `CREATE UNIQUE INDEX idx_messages_session_key ON messages(session_id, message_key) WHERE message_key IS NOT NULL` ② `MessageInsert.messageKey?` · `appendMessage` 가 열에 쓴다 ③ `ensureAssistantMessage(turn, sessionId, messageKey?)` — 번호가 있고 `turn.currentAssistantMessageKey` 와 다르면 `finalizeTurn` 뒤 새 행(번호 저장), 없거나 같으면 현행 ④ 8 case(`response.boundary`·`message.reasoning`·`tool.call.started`·`message.completed`·`tool.call.completed`·`error`·`session.compacted`·`subagent.task`)가 `ev.messageKey` 를 ③ 에 넘긴다 ⑤ `commitUserMessage` → `persistUserMessage(…, batch.messageKey)` 가 열에 쓴다 ⑥ 질문 답 저장(receiver `turn.askAnswers` → writer)이 묶음의 번호를 ③ 에 ⑦ `TurnContext.currentAssistantMessageKey`(contracts) · receiver 초기값 `null` · `finalizeTurn` 이 비운다 ⑧ `loadParts` SELECT 에 `m.message_key` → `LoadedPartRow.message_key` | 두 명령 — `rg -n "message_key\|messageKey\|currentAssistantMessageKey" src/main/features/history src/main/infra/db src/main/app/data-host src/main/contracts --glob '!*.test.ts'` → 출력과 ①~⑧ 차집합 0(①은 마이그레이션 파일) · `rg -n "ensureAssistantMessage\(turn, turn\.dbSessionId" src/main/features/history/writer.ts` → 8 이고 8줄 모두 세 번째 인자 | ③ 이 번호를 보지 않으면 연속 턴의 답이 DB 에서 앞 메시지에 붙는다(라이브와 갈림). 유일 색인이 없으면 같은 번호 두 행이 생겨 로드 번호가 겹친다 |
| **EP-3** · MD-02 / VP-05 | 로드 메시지마다 세션 안에서 유일한 번호 | `features/history/{native-projection,reader,native-recovery}.ts` · `shared/ipc.ts` | 데이터 호스트 | 자리 6 — ① `LoadedMessage.id: string`(필수) ② `localMessages` → `row.message_key ?? localRowMessageId(row.message_id)` ③ `projectNativeHistory` — 원본 메시지마다 묶인 로컬 행(가장 작은 DB id 부터) 중 아직 안 쓴 번호 → 없으면 그 행의 `m:` → 묶인 행 없으면 `nativeOnlyMessageId(원본 id)` ④ 같은 함수 끝의 orphan·frontier 뒤 `localMessages` — ② 의 후보가 이미 쓰였으면 `uniqueMessageId(후보, used)`(후보 + `#2`·`#3`…) ⑤ `recoveryArchive` → `message.id ?? archivedMessageId(순번)` 을 ④ 와 같은 `used` 로 ⑥ `reader.loadSession` 이 ③④⑤ 에 같은 `used` 집합을 넘긴다 | `rg -n "localRowMessageId\|nativeOnlyMessageId\|archivedMessageId\|uniqueMessageId\|message_key" src/main/features/history --glob '!*.test.ts'` → 출력과 ②~⑥ 차집합 0 · `rg -n "interface LoadedMessage" -A 7 src/shared/ipc.ts` → `id: string` 1(①) | ③④ 의 `used` 가 빠지면 한 로드에 같은 번호가 둘이다 — React key 충돌·Work 결과 칸 덮어쓰기 |
| **EP-4** · MD-03·AR-02 / VP-07·VP-08 | 창 메시지마다 번호 · 번호가 다르면 새 메시지 | `reducer/chatReducer.ts` · `store/chatStore.ts` · `lib/parts.ts` | 창 | 자리 11 — ① `Message.id: string`(필수) ② `appendAssistantPart(messages, part, messageKey?)` — 마지막이 assistant 이고 (`messageKey` 없음 또는 `last.id === messageKey`)면 붙이고, 아니면 `id = messageKey ?? rendererMessageId()` 새 메시지 ③ 7 이벤트 case(`message.reasoning`·`response.boundary`·`message.completed`·`tool.call.started`·`tool.call.completed`·`session.compacted`·`subagent.task`)가 `ev.messageKey` 를 넘긴다 ④ `COMMIT_PENDING_TEXT` 는 번호 없이 ② ⑤ `APPEND_COMMITTED_USER_MESSAGE` — `id = action.messageKey ?? (action.clientId ? userMessageId(action.clientId) : rendererMessageId())` ⑥ `LOAD_SESSION` 두 갈래 `id: m.id` ⑦ store fork 경계선 `id: rendererMessageId()` ⑧ `deriveChildMessage` → `id: childMessageId(parentToolRunId)` ⑨ store 낙관 전송(턴 첫 발화)이 `clientId` 로 ⑤ 를 거친다(현행 경로) ⑩ store `message.committed` → `messageKey: ev.messageKey` ⑪ 다시 열기 — `LOAD_SESSION(preserveLocalState)` 뒤 TranscriptView key 가 `id`(EP-7 ④ · EP-10 ③ 과 같은 자리를 이 pair 는 다시 열기 입력으로 관측) | `rg -n "rendererMessageId\|userMessageId\|childMessageId\|messageKey\|role: '(assistant\|user)'( as const)?," src/renderer/src/features/chat --glob '!*.test.*' --glob '!*.testfixture.*'` → 출력과 ①~⑩ 차집합 0 · `rg -n "appendAssistantPart\(state" src/renderer/src/features/chat/reducer/chatReducer.ts` → 8줄 중 7줄이 `ev.messageKey`, 1줄(`COMMIT_PENDING_TEXT`)은 번호 없음 | ② 가 번호를 보지 않으면 라이브 묶음이 재로드와 갈린다(VP-02 red). ⑤ 가 낙관·echo 에 다른 번호를 주면 확정 순간 버블이 다시 마운트된다 |
| **EP-5** · MD-05 / VP-10 | 변경 기록 · `changedFrom` | `lib/messageLog.ts`(신규) | reducer · 소비자 | 자리 9 — ① `commitMessages(base, next, from)` — `next !== base` 면 `WeakMap<Message[], { base; from }>` 에 기록하고 `next` 반환 ② `changedFrom(prev, next)` — `prev === next` 면 `next.length`, 아니면 `next` 에서 기록을 따라 `prev` 에 닿을 때까지 `from` 최솟값. 기록 없음·`MESSAGE_LOG_MAX_HOPS = 64` 초과 → 0 ③ reducer 기록 자리 7 — ⓐ `appendAssistantPart`(붙임 `length-1` · 새 메시지 `length`) ⓑ `appendOwnedArtifact`(소유 위치) ⓒ `correctPlanToolInput`(바꾼 메시지 위치) ⓓ `APPEND_COMMITTED_USER_MESSAGE`(`length`) ⓔ `DROP_UNCOMMITTED_USER`(지운 위치 — 없으면 같은 배열 반환) ⓕ `LOAD_SESSION` 보존 갈래(0) ⓖ `LOAD_SESSION` 전체 갈래(0) | `rg -n "commitMessages\(\|changedFrom\(\|MESSAGE_LOG_MAX_HOPS" src/renderer/src/features/chat --glob '!*.test.*'` → 출력과 ①②③ⓐ~ⓖ + 소비자 호출(EP-6·EP-7·EP-8·EP-10·EP-11 의 자리) 차집합 0 · S8 명령 → 쓰기 16줄이 ⓐ~ⓖ 안에서만 새 배열을 만든다(도우미 3 + 인라인 4) | ⓐ~ⓖ 하나의 `from` 이 실제보다 크면 소비자가 바뀐 메시지를 건너뛰어 화면이 낡는다 — 매 자리 "기록 ≤ 실제 첫 변경" 사례가 막는다(VP-10). 기록이 빠지면 느려질 뿐(0 = 전체) |
| **EP-6** · AR-03 / VP-11 | 번호 → 위치 · toolRunId → 소유 메시지 · 응답 id → 소유 메시지 · 완료 통지 toolRunId 색인과 그 조회 | `lib/messageLog.ts` | reducer · store | 자리 12 — ① `messagePosition(messages, id)` ② `toolCallOwner(messages, toolRunId)`(부모 없는 `tool_call` 의 메시지 번호) ③ `responseOwner(messages, responseId)`(`response_boundary` 의 메시지 번호) ④ `noticeOwner(messages, toolRunId)`(`subagent_notice` 의 메시지 번호) — 넷 다 `changedFrom` 으로 이전 배열의 색인을 넘겨받아 접미만 다시 세운다 ⑤ reducer `output.captured` 소유(`:1043`) ⑥ reducer `tool.call.completed` 게시 영수증 소유(`:1107`) ⑦ `appendOwnedArtifact` 가 `messages.map` 대신 복사 + 한 칸 교체(`:851`) ⑧ reducer `APPEND_COMMITTED_USER_MESSAGE` 멱등 판정(`:926` → `messagePosition(userMessageId(clientId))`) ⑨ reducer `DROP_UNCOMMITTED_USER` 위치(`:959`) ⑩ reducer `subagent.task` 통지 멱등(`:1292` → `noticeOwner`) ⑪ reducer `markCompletedAgentTask` 호출 탐색(`:2159` → `toolCallOwner`) ⑫ store `message.cancelled` 미확정 버블(`:908`)·`hasCommittedClientId`(`:485`) → `messagePosition` | `rg -n "messages( \?\? \[\])?\)?\.(some\|filter\|findIndex\|find\|every\|flatMap\|map)\(\|findToolCallPart\(" src/renderer/src/features/chat/reducer/chatReducer.ts src/renderer/src/features/chat/store/chatStore.ts` → AS-IS 11줄 · TO-BE 2줄 — `chatReducer.ts` `LOAD_SESSION` 의 `action.session.messages.map`(B1) · `chatStore.ts` 이어하기 자격의 사용자 수 `filter`(사용자 동작 1회 — 확정 이벤트 경로 아님) · `rg -n "messagePosition\(\|toolCallOwner\(\|responseOwner\(\|noticeOwner\(" <같은 두 파일>` → ⑤~⑫ | 하나라도 전체 탐색으로 남으면 그 이벤트가 이력 길이에 비례한다(M1k) |
| **EP-7** · MD-06·AR-04·AR-05 / VP-13·VP-14·VP-16 | grouper 첫 변경 = 기록 · 이분 탐색 재사용 · `id` · key · memo 참조 비교 | `lib/turns.ts` · Claude transcript | Claude Timeline | 자리 9 — ① grouper 가 `changedFrom(previousMessages, messages)` 로 첫 변경을 얻는다(참조 비교 루프 없음) ② 재사용 수 = `previous` 의 `startIndex` 에서 "다음 exchange 시작 < 첫 변경" 마지막 위치를 이분 탐색(0325 D-030 의 `<` 그대로) · grouper 가 `exchangesChangedFrom` 기록(결과 배열 → 재사용 수)을 남긴다 ③ `Exchange.id`·`Turn.id` = 첫 메시지 `id` ④ Claude Timeline head 항목 key·tail key = `exchange.id` ⑤ `Exchange` 안 `UserTurn`·`AssistantTurn` key = `turn.id` ⑥ `useTranscriptVirtualizer.getItemKey` = `head[index]?.id` ⑦ Work 결과 조회 `workResults?.get(exchange.id)`(head·tail) ⑧ `Exchange` memo 가 `prev.exchange === next.exchange` ⑨ `AssistantTurn` memo 가 `prev.turn === next.turn` | 세 명령 — `rg -n "changedFrom\|exchangesChangedFrom\|id:" src/renderer/src/features/chat/lib/turns.ts` → ①②③ · `rg -n "startIndex\|exchangeEquals\(\|turnEquals\(" src/renderer/src/features/chat/harnesses/claude/transcript/Timeline.tsx src/renderer/src/features/chat/harnesses/claude/transcript/Exchange.tsx src/renderer/src/features/chat/harnesses/claude/transcript/AssistantTurn.tsx src/renderer/src/features/chat/hooks/useTranscriptVirtualizer.ts` → 0 · `rg -n "\.id\b" <같은 네 파일>` → ④~⑨ | ① 이 루프로 남으면 0325 B8 이 그대로다. ④~⑦ 중 하나가 색인이면 앞삽입에서 그 층이 다시 마운트된다. ⑧⑨ 가 참조 비교인데 grouper 가 동치 객체를 새로 만들면 다시 렌더된다(g20 이 막는다) |
| **EP-8** · MD-07 / VP-15 | Work 결과 증분 · 복사 없는 바깥 조회 | `lib/workToolResults.ts` | Claude Timeline | 자리 5 — ① 선택기 입력 `(exchanges)` — 첫 변경 exchange 는 `exchangesChangedFrom(이전, 지금)`(EP-7 ②) ② 그 exchange 부터의 메시지만 parse(메시지 WeakMap 유지) — 기여(호출·결과)를 접미 철회 후 재적용 ③ 소유 맵 `toolRunId → exchange id` ④ 결과의 최신 값이 바뀐 toolRunId 의 소유 exchange 와 다시 묶은 exchange 의 칸만 새 `WorkToolResults` 객체 ⑤ 바깥 = `WorkToolResultsLookup { get(id) }` — 안쪽 Map 을 제자리 갱신하고 바뀐 칸이 있을 때만 조회 객체를 새로 만든다(복사 없음). 바뀐 칸이 없으면 이전 조회 객체 | `rg -n "exchangesChangedFrom\|WorkToolResultsLookup\|ownerOf\|retract" src/renderer/src/features/chat/lib/workToolResults.ts` → ①~⑤ | ② 가 0 부터면 0325 B9 그대로(M1c). ④ 가 늦은 결과를 지금 exchange 에 넣으면 원래 카드에 결과가 안 붙는다. ⑤ 가 바깥을 복사하면 10,000 exchange 에서 1.79ms(§8 M5) |
| **EP-9** · MD-08 / VP-17 | 메시지 분절 캐시 · `reconcileSegments` 대체 | `lib/segmentCache.ts`(신규) | Claude 공통 · Work 투영 | 자리 4 — ① `createSegmentCache().segmentsFor(message)` — 같은 `message.id` 의 이전 (parts, segments, 결과 맵, toolRunId → segment 위치) 가 있고 `parts` 접두가 참조로 같으면: 마지막 segment 시작 part 부터 다시 자르고, 새 part 중 `tool_result` 가 앞 segment 의 최상위 `tool_call` 을 가리키면 그 segment 를 새 객체로(그 ToolCall 만 새 객체) 바꾼다. 접두가 다르면 전체를 다시 자른다. 결과 맵은 새 part 의 결과만 더한다 ② `AssistantMessage` 가 `useSegmentCache()`(컴포넌트 수명) 로 ① 을 부른다 ③ `createWorkProjector` 가 같은 캐시를 쓴다 ④ `reconcileSegments` 정의·호출 삭제(`parts.reconcile.test.ts` 의 참조 유지 단언은 `segmentCache.test.ts` s1~s3 이 잇는다) | `rg -n "segmentsFor\|createSegmentCache\|useSegmentCache\|reconcileSegments" src/renderer/src --glob '!*.test.*'` → TO-BE: `reconcileSegments` 0 · 나머지 줄 = ①②③ | ① 이 뒤 `tool_result` 를 앞 segment 에 반영하지 않으면 앞 도구 카드가 "실행 중" 에 머문다(s3). 접두 확인이 없으면 `correctPlanToolInput` 의 앞 part 교체를 놓친다(s4) |
| **EP-10** · MD-09·AR-06 / VP-19·VP-20 | OpenCode head 증분 · 번호 key · 종류별 순번 | `opencode/transcript/projection.ts` · `Timeline.tsx` | OpenCode Timeline | 자리 7 — ① `createTimelineHeadProjector()(messages, options)` — `changedFrom` 으로 첫 변경을 얻고 그 메시지가 든 exchange(경계면 직전 exchange — 0325 D-030 과 같은 `<`)부터 다시 투영한다 ② 앞 exchange 의 entry·행은 이전 객체 · 행 색인 `index` 는 접미만 다시 세운다 ③ exchange 접두 = 첫 메시지 `id`(occurrence 맵 없음) ④ segment 행 key = `${prefix}:${kind}:${같은 종류 순번}` — tools·ask·error 등 비텍스트 행과 meta·artifacts·incomplete 행은 현행 접미 규칙을 종류 순번으로 바꾼다 ⑤ `OpenCodeTimeline` 이 projector 를 `useState` 로 들고 `useMemo([messages, showAutomaticFeeds])` 로 부른다 ⑥ tail 투영 `projectTimelineTail(head, presence)` 은 ③④ key 를 쓴다(API 그대로) ⑦ 문자열 래퍼 `projectTimeline` 과 골든 변환표 `goldenKeyMap`(테스트) | `rg -n "createTimelineHeadProjector\|occurrence\|changedFrom\|:\$\{kind\}\|kindOrdinal" src/renderer/src/features/chat/harnesses/opencode/transcript --glob '!*.test.ts'` → TO-BE: `occurrence` 0 · 나머지 = ①~⑦ | ① 이 전체면 0325 B6 그대로(M1d). ③ 이 시각 기반이면 앞삽입에서 key 가 밀린다. ④ 가 전체 순번이면 reasoning 첫 출현에서 live text key 가 바뀐다(p2′ red) |
| **EP-11** · MD-10·AR-07 / VP-22·VP-23 | transcript 색인 · 도메인 revision · 소비자 전환 | `lib/transcriptIndex.ts`(신규) · `store/chatStore.ts` 훅 | 창 | 자리 9 — ① `transcriptIndexFor(messages)` — 이전 배열의 색인을 `changedFrom` 으로 넘겨받는다(넘겨준 배열의 색인은 버린다 — 다시 물으면 새로 만든다) ② 접미 철회 — 첫 변경 이후 위치의 기여를 위치 역순으로 걷어낸다(키마다 위치 순 스택) ③ 재적용 — 첫 변경부터 지금 끝까지 메시지마다 기여를 넣는다 ④ 도메인 revision 9 — `toolResults` · `subagentTasks(nested 여부 2칸)` · `childMessage` · `taskBoard` · `backgroundResults` · `backgroundModels` · `panelProcesses` · `taskContextSources` · `noticeDescription` — 그 도메인 키에 기여가 들거나 나간 때만 +1 ⑤ 뷰 — revision 이 같으면 이전 뷰 객체(배열·맵·요약). 뷰 값은 현행 함수와 같다 ⑥ store 훅 `useTranscriptView(domain, arg?)` — 활성 세션 `messages` 의 색인에서 그 도메인(·arg) 뷰를 `useSyncExternalStore` 선택자로 읽는다 ⑦ 소비자 9 — `useTaskBoard` · `useTaskContext` · OpenCode `tiles.tsx`·`AgentViews.tsx` · Claude `CanonicalBackgroundContent` · `LegacySubAgentTile`(2) · `AgentTaskRow` · `SubagentNoticeRow` · `InlineSubagentDetail` ⑧ 9개 현행 함수는 production 에서 지운다 — 현행 구현은 `lib/transcriptIndex.legacy.testfixture.ts` 로 옮겨 property 의 oracle 로만 쓴다(메시지 하나의 기여를 계산하는 조각 `resultMap`·`partsToolCalls`·`toolCallFromPart` 는 `parts.ts` 에 남아 색인과 oracle 이 함께 쓴다) ⑨ `taskBoard.ts` 모듈 1칸 캐시 삭제 | 두 명령 — 음성 S5 명령에 `--glob '!*.testfixture.*'` 를 더해 → TO-BE 0 · 양성 `rg -n "useTranscriptView\(" src/renderer/src --glob '!*.test.*'` → ⑦ 의 10 파일이 각각 1줄 이상 | ② 가 빠지면 교체·삭제된 메시지의 결과가 남는다(x3). ④ 가 무관 이벤트에 오르면 소비자가 매번 다시 그린다(x10). ⑧ 이 남으면 그 소비자는 M1 의 비용 그대로다 |
| **EP-12** · MD-11 / VP-24 | 같은 세션·같은 종류 연속 delta 묶음 | `store/chatStore.ts` `receiveDeltaBatch` | 창 | 자리 4 — ① 묶음 안에서 (세션 키, 종류)가 같은 연속 이벤트를 한 run 으로 모은다(부모 있는 delta 는 지금처럼 건너뛴다) ② run 마다 문자열을 한 번 이어 붙인다(`join('')`) ③ run 마다 세션 항목을 한 번 바꾼다 ④ `shouldBeginTurn` 은 run 의 첫 이벤트로 판정한다(지금 이벤트마다 판정하지만 첫 이벤트 뒤에는 거짓 — 결과 같음) | `rg -n "receiveDeltaBatch\|shouldBeginTurn\|join\(''\)" src/renderer/src/features/chat/store/chatStore.ts` → ①~④ | ① 이 종류를 보지 않으면 text·reasoning 이 섞인다(b3). ④ 를 run 안에서 다시 판정하면 BEGIN_TURN 이 두 번 돈다 |
| **EP-13** · MD-12·AR-08 / VP-26 | 긴 마지막 exchange 앞 블록 가상화 | `lib/tailBlocks.ts`(신규) · Claude `Timeline.tsx` | Claude Timeline | 자리 6 — ① `tailBlocks(exchange, policy)` — 블록 = user 턴 1 · (code 투영) 메시지 segment 마다 1 · (work 투영) `createWorkProjector` 노드마다 1 · 턴 산출물·메타 1 — key = `${message.id}:${segment 위치}` / 노드 key / `${turn.id}:meta` ② `TAIL_VIRTUALIZE_MIN_BLOCKS = 200` · `TAIL_LIVE_BLOCKS = 40` — 블록 수 > 200 이면 분할 ③ 앞 블록은 두 번째 virtualizer(측정 key = 블록 key · overscan 6) ④ 뒤 40 블록 + `PendingAssistant`·`PendingSteerTurn`·`TurnErrorBanner`·fork·예약 공간은 지금 `Exchange` tail 경로 그대로 ⑤ 블록 경계가 메시지 중간이면 그 메시지는 앞뒤로 나뉘어 그려진다 — 같은 segment 캐시(EP-9)를 공유 ⑥ 200 이하는 지금 DOM(`data-tail-virtual` 0) | `rg -n "tailBlocks\|TAIL_VIRTUALIZE_MIN_BLOCKS\|TAIL_LIVE_BLOCKS\|data-tail-virtual" src/renderer/src/features/chat --glob '!*.test.*'` → ①~⑥ | ② 비교가 틀리면 짧은 턴도 가상화돼 0008 앵커가 바뀐다. ④ 가 가상 쪽으로 가면 fork·대기 표시가 화면 밖에서 언마운트된다 |
| **EP-14** · AR-09 / VP-27 | 펼침 상태 DOM 독립 | `store/disclosureStore.ts`(신규) | Claude 공통 | 자리 5 — ① `useDisclosure(key, initial)` · `setDisclosure` — 세션 키별 `Map<string, boolean>` ② Claude `ToolCard` `open` = `useDisclosure(\`${messageId}/${toolRunId}\`, detailBody)` ③ `AgentTaskRow` `expanded` ④ `WorkActivity` `ActivityDisclosure` 펼침(노드 key) ⑤ 세션 엔트리 삭제(`dropSession`·`invalidateSessionCache`)가 그 세션 칸을 지운다 | `rg -n "useDisclosure\|setDisclosure\|clearDisclosures" src/renderer/src/features/chat --glob '!*.test.*'` → ①~⑤ · 음성 `rg -n "useState\((detailBody\|false)\)" src/renderer/src/features/chat/harnesses/claude/transcript/ToolCard.tsx src/renderer/src/features/chat/harnesses/common/transcript/AgentTaskRow.tsx` → 펼침 용도 0 | ②~④ 가 `useState` 면 가상화·다시 열기에서 펼침이 사라진다 |
| **EP-15** · AR-10 / VP-27 | 닫힘 전환 뒤 본문 해제 | `harnesses/claude/transcript/ToolCard.tsx` | ToolCard | 자리 3 — ① 닫으면 `bodyMounted` 를 유지하다 본문 래퍼 `onTransitionEnd`(`grid-template-rows`)에서 `false` ② `prefers-reduced-motion: reduce` 면 닫는 즉시 `false` ③ 전환 중 다시 열면 `true` 유지 | `rg -n "bodyMounted\|onTransitionEnd\|prefers-reduced-motion\|wasOpened" src/renderer/src/features/chat/harnesses/claude/transcript/ToolCard.tsx` → TO-BE: `wasOpened` 0 · 나머지 ①②③ | ① 이 빠지면 0325 B15 그대로. ③ 이 빠지면 빠른 재열기에서 본문이 깜박인다 |
| **EP-16** · AR-11 / VP-28 | OpenCode 긴 선택 DOM 축소 · 복사 순간 마운트 | `opencode/transcript/Timeline.tsx` | OpenCode Timeline | 자리 3 — ① `rangeExtractor` — 보존 선택 범위 행 수 ≤ `SELECTION_MOUNT_MAX_ROWS = 300` 이면 범위 전체, 넘으면 양 끝 행 + 기본 범위 + 앵커 ② 스크롤 루트 `onCopy` — 보존 선택이 축소 상태면 `flushSync` 로 범위 전체를 마운트(기본 복사 동작이 그 DOM 을 읽는다) ③ 다음 프레임에 축소 상태로 되돌린다 | `rg -n "SELECTION_MOUNT_MAX_ROWS\|onCopy\|flushSync\|rangeExtractor" src/renderer/src/features/chat/harnesses/opencode/transcript/Timeline.tsx` → ①②③ | ① 이 상한을 안 보면 0325 B5 그대로. ② 가 비동기면 복사에 중간 행이 빠진다 |
| **EP-17** · MD-13 / VP-29 | 버블 측정 일괄 | `lib/bubbleMeasure.ts`(신규) · `UserBubbleText.tsx` | 공통 transcript | 자리 5 — ① 공유 `ResizeObserver` 하나 · 등록/해제 ② 통지 → 대기 집합 + rAF 1개 예약 ③ 프레임 — 대기 요소마다 `getComputedStyle`·`scrollHeight` 를 먼저 다 읽고 그 뒤 판정 콜백(상태 쓰기)을 부른다 ④ 캐시 키 = (`textContent` 길이·해시, `clientWidth`, `--transcript-text-scale`) — 같으면 읽지 않고 이전 판정 ⑤ `UserBubbleText` 가 `useBubbleOverflow(contentRef)` 로 ①~④ 를 쓴다(개별 RO 없음) | `rg -n "new ResizeObserver\|getComputedStyle\|useBubbleOverflow\|requestAnimationFrame" src/renderer/src/features/chat/lib/bubbleMeasure.ts src/renderer/src/features/chat/harnesses/common/transcript/UserBubbleText.tsx` → TO-BE: `UserBubbleText.tsx` 의 `new ResizeObserver` 0 · `getComputedStyle` 는 접은 뒤 스크롤 판정 1줄(현행 `:78`)만 | ③ 이 읽기·쓰기를 섞으면 버블마다 강제 레이아웃이다(m3). ④ 에서 폭이 빠지면 폭이 바뀌어도 넘침 판정이 낡는다 |
| **EP-18** · MD-14 / VP-30 | 열린 펜스 꼬리 직접 렌더 | `lib/markdownBlocks.ts` · `components/markdown/StreamingMarkdown.tsx` | StreamingMarkdown | 자리 3 — ① `openFenceTail(tail)` — 꼬리 첫 비공백 줄이 0~3칸 들여쓴 펜스(``` 또는 ~~~ 3개 이상)이고 같은 문자·같은 길이 이상의 닫는 줄이 없으면 `{ fence, info, code }`, 아니면 `null` ② StreamingMarkdown — ① 이 값이면 `StreamingFence`(같은 `CodeBlock` · 같은 typography 래퍼 · 스트리밍 컨텍스트)로 그린다 ③ ① 이 `null` 이면 지금 `<Markdown source={tail}>` | `rg -n "openFenceTail\|StreamingFence" src/renderer/src --glob '!*.test.*'` → ①②③ | ① 이 닫힌 펜스를 열린 것으로 보면 닫는 줄이 코드로 보인다(f3) |
| **EP-19** · MD-15 / VP-31 | 측정 입력 J1~J8 | `scripts/measure-ui-inputs.mjs` | 사람(AC29)·`node --test` | 자리 3 — ① 입력 생성 J1~J8(§19 표 크기) ② 결정성 ③ 0325 요약·N/A 규약 재사용 | `rg -n "^export function \(J\|j\)[0-9]\|J[1-8]" scripts/measure-ui-inputs.mjs` → ①~③ | 입력이 실행마다 달라지면 전후 비교가 입력 차이를 잰다 |

**규칙 칸 분기 — UT 입력 칸과 1:1**

| 기호 | 규칙 | UT 입력(§7-A) |
|---|---|---|
| k1 | 8종 각각의 첫 이벤트 → 새 `a:` 번호 · 같은 턴 다음 8종 → 같은 번호 | VP-04 k1 — 8종을 한 번씩 이어 보냄 · 결정적 `newId` 가 1회만 불림 |
| k2 | 8종이 아닌 이벤트(`message.delta`·`telemetry`·`session.updated`·`permission.requested`·`output.captured`)는 번호를 붙이지 않는다 | VP-04 k2 |
| k3 | 두 턴은 따로 번호를 갖는다 | VP-04 k3 — 턴 A·B 교차 |
| k4 | 확인 대기 산출물 이벤트(`tool.call.completed` 게시 영수증)에도 번호 · 줄 선 중계도 같은 번호 | VP-04 k4 |
| k5 | `commitUserMessage` 뒤 다음 8종 → 새 번호 | VP-04 k5 |
| k6 | `telemetry` 뒤 다음 8종 → 새 번호 | VP-04 k6 |
| k7 | `finalizeTurn` 뒤 같은 turn 객체로 다시 오면 새 상태·새 번호 | VP-04 k7 |
| k8 | 질문 답 — 창 `tool.call.completed` 와 `turn.askAnswers` 에 현재 번호(현재 번호가 없으면 새로 만든다) | VP-04 k8 |
| k9 | 큐 배치 커밋 → `u:<ids[0]>` (id 2개 배치) — 커밋 배치와 `message.committed` 같은 값 | VP-04 k9 |
| k10 | 받은 입력 → `u:<uuid>` · uuid 없으면 `u:<nativeMessageId>` · 둘 다 없으면 `u:<newId()>` | VP-04 k10 — 세 입력 |
| w1 | 번호 없는 이벤트 열 → 지금 행 구성과 같다 | VP-06 w1 |
| w2 | 같은 턴에서 번호가 바뀌면 앞 행 마감(`complete=1`·content 동기화) 뒤 새 행 | VP-06 w2 |
| w3 | 번호가 같으면 같은 행 | VP-06 w3 |
| w4 | 8 case 각각이 번호를 저장한다 | VP-06 w4 — 8 case 각 1 |
| w5 | 사용자 커밋 번호가 행에 저장된다 · 질문 답 결과가 그 번호의 행에 간다 | VP-06 w5 |
| w6 | 마이그레이션 — 옛 행 null · 같은 세션 같은 번호 두 번째 거부 · 다른 세션 같은 번호 허용 · null 여러 개 허용 | VP-06 w6 |
| i1 | 번호 있는 로컬 행 → 그 번호 | VP-05 i1 |
| i2 | 번호 없는 로컬 행 → `m:<id>` | VP-05 i2 |
| i3 | 묶인 행 없는 원본 메시지 → `n:<원본 id>` | VP-05 i3 |
| i4 | 로컬 행 하나가 원본 둘에 묶임 → 첫 원본은 행 번호, 둘째는 `n:` | VP-05 i4 |
| i5 | orphan 메시지의 후보가 이미 쓰임 → `후보#2` | VP-05 i5 |
| i6 | 복구 보관본 — 번호 있으면 그 번호, 없으면 `x:<순번>` | VP-05 i6 |
| i7 | 모든 로드 결과 번호 유일 | VP-05 i7 — i1~i6 결과 전부 |
| r1 | 번호 같은 이벤트 연속 → 같은 메시지 | VP-07 r1 |
| r2 | 마지막이 assistant 인데 번호가 다름 → 새 메시지(사용자 메시지 없이 이어진 연속 턴) | VP-07 r2 |
| r3 | 마지막이 user → 번호로 새 메시지 | VP-07 r3 |
| r4 | 번호 없는 `COMMIT_PENDING_TEXT` — 마지막 assistant 에 붙음 / 마지막이 user 면 `r:` 새 메시지 | VP-07 r4 — 두 입력 |
| r5 | 낙관 사용자 메시지 `u:<clientId>` → echo(`messageKey` 같음) 는 무변경 | VP-07 r5 |
| r6 | steer echo(낙관 없음) → `messageKey` 번호 | VP-07 r6 |
| r7 | `LOAD_SESSION` → `id` 보존 · fork 경계선 `r:` · 자식 대화 `c:<parent>` | VP-07 r7 — 세 입력 |
| r8 | 앞의 메시지 객체는 같은 참조(붙임은 마지막만 교체) | VP-07 r8 |
| l1 | 기록 1단계 → 그 `from` | VP-10 l1 |
| l2 | 기록 3단계 → 최솟값 | VP-10 l2 |
| l3 | 65 단계 사슬 → 0 | VP-10 l3 |
| l4 | `prev === next` → `next.length` | VP-10 l4 |
| l5 | 기록 없는 배열 → 0 | VP-10 l5 |
| l6 | `prev` 가 사슬에 없음(다른 계보 — fork 초안) → 0 | VP-10 l6 |
| l7 | 색인(EP-6 ①②③) 이 접미만 다시 세운다 — 끝 추가에서 앞 메시지 `parts` 읽기 0 · 결과 = 처음부터 세운 색인 | VP-10 l7 |
| g15 | 끝 교체·끝 추가에서 grouper 의 배열 색인 읽기는 첫 변경 이후뿐(배열 Proxy) · 10,000 exchange | VP-13 g15 |
| g16 | 이분 탐색 재사용 수 = 0325 선형 재사용 수(전수 g14 입력) | VP-13 g16 |
| g17 | 기록 없는 배열(다른 계보) → 전체 재그룹 · 결과 ≡ 전체 | VP-13 g17 |
| g18 | `exchangesChangedFrom` = 재사용 수 | VP-13 g18 |
| g19 | 앞삽입 k=1·3 → 기존 exchange `id` 같음 · 결과 ≡ 전체 · `id` = 첫 메시지 번호 | VP-13 g19 |
| g20 | 전수(g14 입력) — 같은 `id` 의 이전·지금 exchange 에서 `exchangeEquals ⇔ ===` · turn 도 같음 | VP-13 g20 |
| v1 | 끝 결과 추가 → parse 한 메시지 = 바뀐 메시지뿐 | VP-15 v1 |
| v2 | 같은 exchange 안 결과 → 그 칸만 새 객체 | VP-15 v2 |
| v3 | 앞 exchange 호출의 늦은 결과(뒤 exchange 메시지에 붙음) → 앞 exchange 칸만 새 객체 · 지금 exchange 칸 그대로 | VP-15 v3 |
| v4 | 결과가 든 메시지가 교체되어 결과가 사라짐 → 그 칸에서 빠짐(철회) | VP-15 v4 |
| v5 | 바뀐 칸 없음 → 같은 조회 객체 | VP-15 v5 |
| v6 | 전체 교체(기록 없음) → 결과 ≡ 현행 선택기 | VP-15 v6 |
| s1 | 같은 parts → 같은 segment 배열 | VP-17 s1 |
| s2 | text 덧붙임 → 마지막 text segment 만 새 객체 | VP-17 s2 |
| s3 | 뒤 `tool_result` 가 앞 tools segment 의 호출을 가리킴 → 그 segment·그 ToolCall 만 새 객체 · 형제 호출 같은 참조 | VP-17 s3 |
| s4 | 앞 part 교체(`correctPlanToolInput` 꼴) → 전체 재분절 · 결과 ≡ | VP-17 s4 |
| s5 | 부모 있는 text·reasoning·tool_call 은 건너뜀(현행) | VP-17 s5 |
| s6 | 다른 메시지 번호 → 캐시 칸이 섞이지 않는다 | VP-17 s6 |
| o1 | 끝 추가 → 앞 exchange 행 같은 참조 · 관계없는 메시지 `parts` 읽기 0 | VP-19 o1 |
| o2 | 경계 메시지(exchange 첫 메시지)가 바뀜 → 직전 exchange 부터 · 결과 ≡ 전체 | VP-19 o2 |
| o3 | 표시 옵션 변경 → 전체 | VP-19 o3 |
| o4 | 같은 exchange 에 reasoning·text·tools 가 섞인 순서에서 key = 종류별 순번 | VP-19 o4 |
| o5 | 같은 시각 exchange 둘 → key 충돌 없음(번호가 다름) | VP-19 o5 |
| x1~x9 | 도메인 9종 각각 — 무작위 열 단계마다 뷰 `toEqual` 현행 함수(x1 toolResults … x9 noticeDescription) | VP-22 x1~x9 |
| x10 | 도메인 × 이벤트 표 — 이벤트 4종(Bash 결과 · Task 호출 · TaskCreate 결과 · text 완료) × 도메인 9 에서 revision 변화 여부가 표의 기대와 같다 | VP-22 x10 — 36칸 |
| b1 | 같은 세션 text delta 3 → 결합 1·항목 교체 1 | VP-24 b1 |
| b2 | 같은 세션 text 2·reasoning 2·text 1 → run 3 | VP-24 b2 |
| b3 | 종류가 바뀌면 끊긴다 — text 뒤 reasoning 이 text 에 붙지 않는다 | VP-24 b3 |
| b4 | 세션 A·B 교차 → run 4 · 각 세션 결과 = 현행 | VP-24 b4 |
| b5 | 첫 delta 가 턴을 연다 → BEGIN_TURN 1회 | VP-24 b5 |
| b6 | 부모 있는 delta 섞임 → 건너뜀 · run 이 그 지점에서 끊기지 않는다 | VP-24 b6 |
| t1 | 블록 199·200 → 분할 없음 | VP-26 t1 |
| t2 | 블록 201 → 앞 161 · 뒤 40 | VP-26 t2 |
| t3 | code 투영 · 한 메시지 1,000 segment → 블록 key 유일 · 메시지 중간 분할 | VP-26 t3 |
| t4 | work 투영 노드 key 를 블록 key 로 | VP-26 t4 |
| t5 | 마지막 assistant 턴 메타·fork 는 뒤쪽에 | VP-26 t5 |
| t6 | 다음 전송으로 그 exchange 가 head 가 되면 블록 분할이 없어진다(exchange 단위 가상화) | VP-26 t6 |
| m1 | 같은 프레임 통지 3 버블 → 읽기 각 1 · rAF 1 | VP-29 m1 |
| m2 | 다른 프레임 통지 → 프레임마다 | VP-29 m2 |
| m3 | 읽기 단계가 끝난 뒤 쓰기(순서 로그 `R,R,R,W,W,W`) | VP-29 m3 |
| m4 | 폭만 바뀜 → 다시 읽음 · 아무것도 안 바뀜 → 읽기 0 | VP-29 m4 |
| m5 | 해제한 요소 → 대기에서 빠짐 · 공유 RO 의 `unobserve` | VP-29 m5 |
| f1 | ```` ```ts ```` + 코드(닫힘 없음) → 값 | VP-30 f1 |
| f2 | `~~~~` 4개 열림 + `~~~` 3개 줄 → 닫힘 아님 → 값 | VP-30 f2 |
| f3 | 닫힘 줄 있음 → `null` | VP-30 f3 |
| f4 | info 없음 · 들여쓰기 3칸 → 값 | VP-30 f4 |
| f5 | 들여쓰기 4칸 → `null`(들여쓰기 코드) | VP-30 f5 |
| f6 | 펜스 앞에 다른 내용 → `null`(꼬리가 펜스로 시작하지 않음) | VP-30 f6 |
| f7 | 빈 줄 뒤 펜스 → 값 | VP-30 f7 |
| j1 | J1~J8 크기·개수 = §19 표 | VP-31 j1 |
| j2 | 같은 인자 → 같은 산출 바이트 | VP-31 j2 |
| j3 | 없는 함수 → `N/A(함수 없음)` · 던짐 → `N/A(실패: …)` | VP-31 j3 |

- 자리 목록은 그 검색 출력과 차집합 0 이어야 한다. verify 발견은 이행 결함·현재 결함·확장 후보로 갈리고, 열거 원문에 없는 확장 후보는 verify 1·2회째에만 판정을 막는다.
- **선언 경계**(측정 근거와 함께):
  - B1 — 첫 로드·전체 교체(`LOAD_SESSION`)는 grouper·head·색인이 전부 다시 만든다(기록 0 = 전체). 페이지는 단계 E(0325 D-022).
  - B2 — 참조 배열 복사(reducer `slice`·grouper `concat`·Timeline `head = exchanges.slice(0, -1)`)는 남는다 — 20,000 메시지 0.085ms · 200,000 0.96ms(§8 M1a · D-010).
  - B3 — 앞삽입은 기록 0 이라 전체 재그룹 1회다. 기존 exchange 의 `id`·key·컴포넌트는 남고 객체는 새것이다(`startIndex` 가 밀려 `exchangeEquals` 거짓 — D-027). 페이지 예산 안 투영은 E.
  - B4 — 분절 캐시의 parts 접두 참조 비교는 O(part 수)다 — 10,000 part 0.21ms · 100,000 0.28ms(§8 M4). part 필드 읽기는 0 이다.
  - B5 — `r:` 번호 메시지(대기 텍스트 커밋·fork 경계선)와 연속 실행 도착 메시지(`materializeContinuityArrival` 복사본)는 재로드에서 DB 번호(`m:`)로 바뀌어 그 메시지만 다시 그려진다.
  - B6 — 원본 동기화가 라이브 메시지 하나를 원본 여럿으로 나누면 첫 원본만 라이브 번호다(D-007 · i4).
  - B7 — `error` part 는 writer 만 만든다(창은 배너). 재로드에서 그 part 가 든 메시지가 새로 나타날 수 있다 — 번호가 새것이라 기존 key 와 겹치지 않는다.
  - B8 — 변경 기록 64 단계를 넘는 간격(렌더 없이 64번 넘게 쓴 경우)은 전체로 계산한다(l3).
  - B9 — loose list·긴 문단 꼬리는 지금처럼 매 delta 파싱한다 — loose list 20,000자 84.33ms · 긴 문단 20,000자 9.06ms(§8 M3). 워커 파서는 단계 C 뒤(D-023).
  - B10 — 도메인 revision 이 오른 이벤트에서 그 도메인 뷰는 그 도메인 항목 수에 비례해 다시 만든다(작업 보드 항목·하위 작업 수) — 메시지 방문은 0 이다. J5 가 항목 수별로 잰다.
  - B11 — 마지막 exchange 블록 200 이하는 지금처럼 전부 마운트한다(D-017).
  - B12 — T17(승인 카드 계획 본문)·T18(카드별 1초 타이머)은 바꾸지 않는다 — `ApprovalCard.tsx:160-165` · `elapsed.ts:28-31`(D-024).
  - B13 — 축소된 긴 선택에서 Shift+방향키 확장은 마운트된 행 사이에서만 움직인다(실창 AC29 S4 에서 기록).
  - B14 — 확정 text 와 합쳐진 live 행(p3)에 reasoning 이 처음 생기면 live 본문은 새 행으로 가고 그 안의 선택은 풀린다(현행 — 0325 B19 중 p3 몫).
  - B15 — Work 바깥 조회 객체는 스냅샷이 아니다 — 이전에 받은 조회 객체도 지금 칸 값을 읽는다(칸 값은 불변 객체라 렌더 중 바뀌지 않는다).
- 열린 입력 집합을 판정하는 산출물: 해당 없음(검사기·스캐너를 만들지 않는다).
- 같은 규칙이 여러 레이어에 있다면: 번호 접두·생성·8종 목록은 `src/shared/message-id.ts` 한 곳(main·renderer 공유). 변경 기록·위치 색인은 `lib/messageLog.ts` 한 곳. 펜스 판정은 `markdownBlocks.ts` 의 기존 `FENCE_RE` 를 `openFenceTail` 이 함께 쓴다.
- `실패 의미`에 "다른 게이트가 막는다": EP-7 의 "g20 이 막는다" 는 같은 pair(VP-13·VP-16) 안의 전수 단언이다.
- 선택적 필드의 의미: 이벤트 `messageKey?` — 없음 = 번호 없는 이벤트(창 `r:`·writer 현행 경계). `LoadedMessage.id`·`Message.id` 는 필수다(리터럴이 빠뜨리면 `typecheck` 가 잡는다 — 창 테스트 리터럴 수는 구현자가 0325 S13 처럼 세어 보고한다).
- 외부 SDK 경계: 해당 없음(어댑터 출력 이벤트는 번호가 없고 송신기가 붙인다).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `src/shared/message-id.ts`(신규) | 번호 정본 | 접두 7 · 생성 함수 7 · `PART_EVENT_TYPES` · `rendererMessageId` 는 모듈 단조 카운터(`r:<n>`) | 순수 — `message-id.test.ts` |
| `src/shared/ipc.ts` · `src/shared/peer-protocol.ts` | 형 | 8종 `messageKey?` · `message.committed.messageKey` · `LoadedMessage.id` · 피어 `turn.commitUser` 배치·`turn.askAnswers` 묶음 `messageKey` | `typecheck` + EP-1 ⑪ 검색 |
| `src/shared/message-identity.testfixture.ts`(신규) | 종단 고정 입력 | 번호 없는 이벤트 열 · 결정적 `newId` 열 · 번호 붙은 기대 열 · 기대 메시지 목록(번호·role·part type) 리터럴 | main·renderer ST 가 import |
| `main/app/agent-host/persistence-sender.ts` | 발급 | `TurnState.messageKey` · `deps.newId` · `onTurnEvent` 8종 도장·`telemetry` 비움 · `flushAskAnswers` 도장 · `commitUserMessage` 비움·전달 · `finalizeTurn` | `persistence-sender.test.ts` — 가짜 `link`·`send` (기존 seam) |
| `main/app/agent-host/bootstrap.ts` | 조립 | `createPersistenceSender({ …, newId: () => crypto.randomUUID() })` | 스모크 `smoke-hosts.mjs` |
| `main/app/data-host/persistence-stream.testfixture.ts` | 테스트 조립 | 결정적 `newId` 주입 | — |
| `main/features/chat/turn-coordinator.ts` | 사용자 번호 | `commitConsumed`·`input.received` 의 `messageKey` | `turn-coordinator.test.ts`(기존 seam) |
| `main/contracts/turn.ts` | 형 | `currentAssistantMessageKey?: string \| null`(없음 = 현재 번호 없음 — 테스트 리터럴 21파일을 바꾸지 않는다) | `typecheck` |
| `main/infra/db/migrations/0036_message_key.sql`(신규) · `queries.ts` · `types.ts` | 저장 | 열·부분 유일 색인 · `appendMessage`·`loadParts` | `migrate.test.ts` · DB 스위트 |
| `main/features/history/writer.ts` · `app/data-host/persistence-receiver.ts` | 경계 | `ensureAssistantMessage(…, messageKey)` · 8 case · 사용자 커밋 · 질문 답 · receiver 초기값 | `writer.test.ts`(DB) |
| `main/features/history/native-projection.ts` · `reader.ts` · `native-recovery.ts` | 로드 번호 | `localMessages`·`projectNativeHistory`·보관본 · `used` 집합 | `native-projection.test.ts`(순수) · `reader.test.ts` |
| `main/app/message-identity.integration.test.ts`(신규) | ST(main 쪽) | 실제 sender + receiver + writer + reader(DB) | io 풀 |
| `renderer/.../reducer/chatReducer.ts` | 창 번호 · 기록 · 색인 조회 | EP-4 · EP-5 ③ · EP-6 ⑤~⑪ | `chatReducer.messageId/messageLog/messageIndex/messageIdentity.test.ts` |
| `renderer/.../store/chatStore.ts` | store | `message.committed` 번호 전달 · `message.cancelled`·`hasCommittedClientId` 색인 · `receiveDeltaBatch` run · `useTranscriptView` · 세션 삭제 시 펼침 비움 | `chatStore.deltaBatch/cancelled.test.ts` |
| `renderer/.../lib/messageLog.ts`(신규) | 기록·위치 색인 | EP-5 ①② · EP-6 ①~④ | 순수 |
| `renderer/.../lib/turns.ts` | grouper | EP-7 ①②③ · `exchangesChangedFrom` | `turns.test.ts` |
| `renderer/.../lib/workToolResults.ts` | Work 결과 | EP-8 · `WorkToolResultsLookup` | `workToolResults.test.ts` |
| `renderer/.../lib/segmentCache.ts`(신규) · `lib/parts.ts` · `lib/workActivity.ts` · `harnesses/common/transcript/AssistantMessage.tsx` | 분절 | EP-9 · `reconcileSegments` 삭제 · `parts.reconcile.test.ts` 삭제(단언은 s1~s3 로 이관) | `segmentCache.test.ts` |
| `renderer/.../harnesses/claude/transcript/{Timeline,Exchange,AssistantTurn}.tsx` · `hooks/useTranscriptVirtualizer.ts` | key · memo · tail 블록 | EP-7 ④~⑨ · EP-13 ③④⑤⑥ | `Timeline.keys/tailVirtual.test.ts` · `Exchange.memo.test.ts` |
| `renderer/.../lib/tailBlocks.ts`(신규) | 블록 목록 | EP-13 ①② | 순수 |
| `renderer/.../harnesses/opencode/transcript/{projection.ts,Timeline.tsx}` | head projector · key · 긴 선택 | EP-10 · EP-16 | `projection*.test.ts` · `Timeline.memo/selection.test.ts` |
| `renderer/.../lib/transcriptIndex.ts`(신규) · `lib/transcriptIndex.legacy.testfixture.ts`(신규 — 현행 9함수 사본) | 색인·뷰 | EP-11 ①~⑤⑧ | property |
| 소비자 10파일(EP-11 ⑦) · `lib/taskBoard.ts`·`lib/canonicalBackground.ts`·`lib/taskContext.ts`·`opencode/rightpanel/model.ts`·`lib/parts.ts` | 전환 | 현행 함수 삭제 · `useTranscriptView` | `InlineSubagentDetail.test.ts` · `panelConsumers.test.ts` |
| `renderer/.../store/disclosureStore.ts`(신규) · `ToolCard.tsx` · `AgentTaskRow.tsx` · `WorkActivity.tsx` | 펼침 · 본문 해제 | EP-14 · EP-15 | `disclosureStore.test.ts` · `ToolCard.interaction.test.ts`(Claude) · `AgentTaskRow.render.test.ts` |
| `renderer/.../lib/bubbleMeasure.ts`(신규) · `UserBubbleText.tsx` | 측정 일괄 | EP-17 | 가짜 RO·rAF |
| `renderer/.../lib/markdownBlocks.ts` · `components/markdown/StreamingMarkdown.tsx` | 펜스 꼬리 | EP-18 · `StreamingFence` | `markdownBlocks.test.ts` · renderToString |
| `app/scripts/measure-ui-inputs.mjs` · `.test.mjs` | 측정 | J1~J8 | `node --test` |
| 문서 — `docs/IPC_CONTRACT.md` · `docs/arch/backend/provider-runtime.md` · `docs/arch/backend/persistence.md` · `docs/arch/frontend/rendering.md` | 계약 서술 | 이벤트 `messageKey` · `LoadedMessage.id` · `messages.message_key` · transcript 증분 모델·가상화 | `check-doc-inventory --check` |

### 테스트 가능성

- main 쪽 DB 를 쓰는 oracle(VP-02 main 반쪽 · VP-06)은 io 풀이다. 제약 환경에서 better-sqlite3 바인딩이 없으면 `npm rebuild better-sqlite3`(Node ABI)로 돌리고, 불가하면 서명을 적고 CI 결과를 증거로 둔다(`app/AGENTS.md`).
- renderer 의 "방문 0" 은 parts getter 계수기(메시지를 `Object.defineProperty(m, 'parts', { get })` 로 감싼다)와 배열 Proxy(숫자 키 `get`)로 센다 — 0325 VP-06 과 같은 seam.
- 공유 고정 입력은 `src/shared/` 에 두어 main·renderer 테스트가 같은 리터럴을 읽는다(경계 lint: shared 는 양쪽에서 import 가능).
- `useTranscriptView` 는 실제 store + fake DOM 하네스로 렌더 계수를 센다(0325 `chatStore.liveSelectors.test.ts` 와 같은 꼴).

## 12. End-to-end 영향

### producer → consumer

| 값 | producer | 정규화 / 상태 | consumer |
|---|---|---|---|
| 이벤트 `messageKey` | 송신기 `onTurnEvent`·`flushAskAnswers` | 같은 `ev` 객체 | 피어 → writer · 중계 → reducer |
| `message.committed.messageKey` | 조정자 `commitConsumed`·`input.received` | — | store → reducer `APPEND_COMMITTED_USER_MESSAGE` |
| `messages.message_key` | writer | DB 열 | `loadParts` → reader |
| `LoadedMessage.id` | reader | 조각 전송(필드 하나 — 0325 조각 예산은 `estimateWireChars` 가 문자열 길이로 센다) | 전송층 조립 → `LOAD_SESSION` |
| 변경 기록 | reducer 7 자리 | side-table | grouper · head projector · Work 선택기 · 색인 · 위치 색인 |
| 도메인 뷰 | 색인 | revision | 소비자 10파일 |

### 부팅/등록/초기화 변경 시 기존 소비처

| 바뀐 것 | 기존 소비처 전수 | 영향 |
|---|---|---|
| `createPersistenceSender` 의 필수 `newId` | `rg -n "createPersistenceSender\(" src --glob '!*.test.ts'` → 정의 1 · `agent-host/bootstrap.ts:236` · `persistence-stream.testfixture.ts:58` | 둘 다 넘긴다 — 빠지면 `typecheck` |
| `TurnContext.currentAssistantMessageKey?` | 초기화 자리 `persistence-receiver.ts:45` · `chat-turn/turn-context.ts:52` · 테스트 리터럴 21파일(`rg -l "currentAssistantMessageId" src --glob '*.test.ts'`) | 선택적 필드라 테스트 리터럴은 그대로 · receiver 는 `null` 을 넣는다 |
| `LoadedMessage.id` 필수 | 생산 3함수(EP-3) · `NativeHistoryMessage extends LoadedMessage`(이미 `id: string` — 어댑터 원본 id) | 어댑터 출력의 `id` 는 원본 id 그대로다. 투영이 앱 번호로 바꿔 내보낸다(F13) — 어댑터 코드는 바뀌지 않는다 |
| `Message.id` 필수 | 창 리터럴 5(F10) · 테스트 리터럴(구현자가 센다) | 빠지면 `typecheck:web` |
| 변경 기록 side-table | 새 값 — 없으면 0(전체) | 기록이 생기는 시점이 늦어도 소비자는 전체로 계산한다(틀리지 않음) |

## 13. Lifecycle / 오류 / 정리

| 상황 | 동작 |
|---|---|
| 데이터 호스트 저장 실패 | 현행 — 턴 오류. 창은 이미 그 번호로 그렸고 재로드에는 그 행이 없다(번호가 사라질 뿐 다른 메시지와 겹치지 않는다) |
| 같은 세션 같은 번호 재삽입(재전송·재시작 복구) | 부분 유일 색인이 거부한다 → writer 는 `INSERT` 실패를 저장 실패로 낸다. 정상 경로에서는 번호가 턴마다 새 uuid 라 일어나지 않는다 — w6 이 색인을, k3 이 턴별 새 번호를 잠근다 |
| 에이전트 호스트 재시작 | 송신기 상태가 새로 생긴다 — 새 턴부터 새 번호(k7) |
| 세션 삭제·캐시 무효화 | `dropSession`·`invalidateSessionCache` 가 펼침 칸을 지운다(EP-14 ⑤) · 색인·기록은 WeakMap 이라 배열과 함께 사라진다 |
| 긴 선택 복사 | 핸들러 안 동기 마운트 → 다음 프레임 되돌림. 핸들러가 던지면 rAF 복귀는 그대로 예약된다(`try/finally`) |
| 닫힘 전환 중 unmount | 본문 해제 예약이 없다(상태가 컴포넌트에 있다) — 다시 마운트되면 store 의 닫힘 상태로 본문 없이 그린다 |

## 14. 성능 / 상한 / 최적화

| 경로 | AS-IS(§8) | TO-BE 한 이벤트 비용 | 근거 |
|---|---|---|---|
| Claude grouper | 0.498ms @10,000 (참조 비교 n) | O(바뀐 exchange) + 배열 복사 | EP-7 ①② · B2 |
| Work 결과 | 19.5ms @10,000 | O(바뀐 메시지 part) · 바깥 복사 0 | EP-8 |
| OpenCode head | 36.8ms @10,000 | O(바뀐 exchange 행) | EP-10 |
| 패널·보드 9종 | 0.4~21ms @10,000 · 9~405ms @100,000 | O(바뀐 메시지 part) + 도메인이 바뀐 때만 O(그 도메인 항목) | EP-11 · B10 |
| reducer 소유 탐색 | 0.49ms @10,000 | O(바뀐 메시지 part) | EP-6 |
| 열린 펜스 꼬리 | 5.35ms @20,000자 · 27.5ms @100,000자 | 파싱 0 + 코드 문자열 갱신 | EP-18 |
| worst-case | — | 색인 접미 철회는 첫 변경 이후 메시지 수에 비례 — 전체 교체·앞삽입은 B1·B3(전체 1회) | — |

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

- 해당 없음 — 플러그인·외부 구현자 포트를 바꾸지 않는다. 어댑터는 번호를 만들지 않는다(송신기가 붙인다). 문서 계약은 §11 마지막 행 4개다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 관계 | 본문 근거 |
|---|---|---|
| 0325 D-030·D-033(증분 그룹화·파생 메시지 캐시) | 유지 — 첫 변경만 기록에서 얻는다 | EP-7 ① · g1~g14 REGRESSION |
| 0325 D-015·D-034(OpenCode live 리프·유무 전이) | 유지 · p2 기대만 AC15 로 바뀐다(key 유지 = 0325 B19 의 단계 B 몫) | VP-32 · EP-10 ④ |
| 0325 D-018("Work 선택기·`reconcileSegments`·OpenCode head 증분 … 0325 에서 바꾸지 않는다") | 완료 — 단계 B 에서 바꾼다 | EP-8 · EP-9 · EP-10 |
| 0325 D-019(T17·T18 측정 우선) | 유지 | D-024 · B12 |
| 0324 D-011(세션 본문 한 번 반영) | 유지 — 번호는 메시지 필드 | VP-34 |
| 0324 D-045(진행 중 캐시를 로드로 덮지 않음) | 유지 | VP-34 |
| `execution-model.md` "턴 이벤트에 순번은 없다" | 유지 — 번호는 메시지 단위지 이벤트 순번이 아니다 | EP-1 |
| `main/AGENTS.md` 버스 구독 순서(저장 송신 → 제목 → 중계) | 유지 — 도장은 첫 구독자 안에서 찍혀 중계가 같은 객체를 받는다 | EP-1 ③④ |
| `app/AGENTS.md` 머지된 마이그레이션 수정 금지 | 새 파일 `0036_message_key.sql` | EP-2 ① |
| `native-projection.ts:30` "identity 를 텍스트·시각으로 추론하지 않는다" | 유지 — 번호는 바인딩과 행 번호로만 고른다 | EP-3 ③ |
| renderer `AGENTS.md` 디자인 계약 | 새 시각 요소 없음 — 가상화·해제는 같은 컴포넌트. 카탈로그 갱신 없음 | §11 |

## 17. 리스크 / 트레이드오프

| 리스크 | 영향 | 대응 |
|---|---|---|
| writer 경계 변경으로 저장 회귀 | 재로드 메시지 묶음이 달라짐 | 번호 없는 열은 현행 경계(w1) · VP-02 종단 동치 · VP-35 기존 저장 테스트 |
| 변경 기록 `from` 과대 | 화면이 낡음(조용한 결함) | 기록 자리마다 "기록 ≤ 실제" 사례(VP-10) · 소비자마다 "결과 ≡ 전체" property |
| 색인 철회 누락 | 지운·바꾼 메시지의 결과가 패널에 남음 | x3 · property 의 교체·삭제 이벤트 |
| 블록 가상화가 0008 앵커를 건드림 | 스트리밍 중 스크롤 튐 | 뒤 40 블록과 예약 공간을 지금 경로로 둔다(EP-13 ④) · 200 이하 무변경 · 실창 S3 |
| 복사 순간 대량 마운트 | 복사 1회에 수백 행 렌더 | 300 행 초과 선택에서만 · 사용자 동작 1회 · 실창 S4 기록 |
| AC 30개(상한 초과) | verify 범위가 넓다 | D-002 사용자 결정 · pair 가 WU 단위로 독립 |

## 18. 영향 받는 파일 / 문서

§11 표가 정본이다. 새 파일 13(`message-id.ts` · `message-identity.testfixture.ts` · `0036_message_key.sql` · `message-identity.integration.test.ts` · `messageLog.ts` · `segmentCache.ts` · `tailBlocks.ts` · `transcriptIndex.ts` · `transcriptIndex.legacy.testfixture.ts` · `disclosureStore.ts` · `bubbleMeasure.ts` 와 각 테스트 — 테스트 파일은 §7-A 좌표). 삭제 2(`reconcileSegments` 정의 · `parts.reconcile.test.ts`).

## 19. 게이트

| 단계 | 명령 (`app/`) | 비고 |
|---|---|---|
| 루프 | `npm run lint && npm run typecheck` · 관련 스위트 `./node_modules/.bin/vitest run <파일>` | ABI 중립 |
| 마지막(IMPL_DONE 전) | `app/AGENTS.md` "로컬 확인" 전부 + 파일 필터 없는 vitest + `node --test scripts/*.test.mjs` + `npx electron-vite build && node scripts/smoke-hosts.mjs && node scripts/smoke-preload.mjs out/preload` | DB 스위트는 §11 테스트 가능성 |
| 문서 | `node scripts/check-doc-inventory.mjs --check` | §11 문서 4개 |

### 사람 실기 — AC29 (Windows · 0325 §19 규약을 따른다)

같은 장비·주사율·배율에서 0326 직전 커밋 빌드와 0326 빌드를 비교한다. 칸은 값 또는 `N/A(사유)`. 진단 빌드(trace·Profiler)와 설치본(`perf.stall`)을 따로 적는다(0325 D-042).

| ID | 시나리오 | 조작 | 기록 |
|---|---|---|---|
| S1 | 사용자의 가장 긴 Claude Code·Work·OpenCode 세션 | 답변 스트리밍 중 한글 타이핑 + 휠 스크롤 30초 | 입력→paint p95·최대 · 50ms·160ms 구간 수 · `perf.stall` |
| S2 | 다시 열기 | 마지막 답변의 도구 카드 2개를 펼친 채 다른 세션 → 복귀 · 원본 동기화 뒤 한 번 더 | 펼침 유지 여부(전·후) |
| S3 | 블록 200 초과 단일 exchange | 위로 끝까지·아래로 끝까지 · 스트리밍 중 하단 따라가기 · fork 버튼 · 앞 블록 텍스트 드래그 선택 | 튐·빈 공간·선택 유지 관찰 · 마운트 DOM 수 |
| S4 | OpenCode 300 행 초과 선택 | 드래그 선택 → 복사 → 메모장에 붙여넣기(전·후 바이트 비교) · Shift+↓ 10회 | 복사 동일 여부 · 키보드 확장 범위(B13) |
| S5 | 사용자 버블 | 글자 배율 3단계 변경 · 패널 폭 드래그 · 긴 발화 접기/펼치기 · 위로 읽는 중 새 답변 | 레이아웃 시간 · 강제 하단 이동 없음 |
| S6 | 긴 코드 블록 스트리밍 | 100,000자 코드 응답 요청 | 프레임 시간 · 완료 전후 모양 |
| S7 | T17 계획 승인 카드(측정만) | Work 에서 긴 계획(20,000자) 승인 대기 | 카드 표시까지 commit 시간 |
| S8 | T18 실행 중 카드(측정만) | 하위 작업 10·50개 동시 실행 | paint·스크립트 시간 · 타이머 수 |

| J | 함수 재측정 입력(`measure-ui-inputs.mjs`) | 트리에 있는 쪽을 잰다 |
|---|---|---|
| J1 | 10,000 exchange(§8 입력) 끝 part 1개 — grouper + Work 결과 | 옛 트리: 현행 선택기 · 새 트리: 증분 |
| J2 | 같은 입력 — OpenCode head 투영 | 같다 |
| J3 | 같은 입력 — 패널 파생 9종 | 옛: 현행 함수 · 새: `transcriptIndexFor` 갱신 |
| J4 | 같은 입력 — OpenCode 패널 프로세스 | 같다 |
| J5 | 작업 보드 항목 100·1,000 — TaskUpdate 결과 1건 | B10 |
| J6 | 한 메시지 10,000 part 에 part 1개 — 분절 | 옛: `messageSegments`+`reconcileSegments` · 새: `segmentsFor` |
| J7 | 꼬리 — 열린 펜스 20,000·100,000자 · loose list 20,000자 · 긴 문단 20,000자 | 펜스는 새 트리에서 `openFenceTail` 경로 |
| J8 | delta 묶음 — 세션 3 × delta 300 | `receiveDeltaBatch` 대응 순수 함수 |

## READY self-review

- [x] Decision Ledger — 사용자 결정 3(D-001·D-002·D-004)과 설계 결정이 ACTIVE 로 있다. SUPERSEDED·OPEN 없음(0325 OPEN D-023·D-025 는 기대지 않음 — D-026).
- [x] Part I 만으로 완료 상태가 읽힌다 — §1 "완료 후 달라지는 것" · §5 상태 표.
- [x] 조건절 보존 — "Agent process가 번호를 붙이면 안되는건가?" → D-004 원문 인용 · "B 전체 하나로" → D-002.
- [x] Product/UX → AC → Technical Design — §6 WU 표의 AC 열과 §11 행이 WU 마다 대응한다(WU-1 ↔ AC1~AC6 ↔ EP-1~EP-4).
- [x] AS-IS·TO-BE 같은 축 — §9 두 블록과 Delta 표 5축.
- [x] 사라진 책임 — `reconcileSegments`(삭제, EP-9 ④) · 현행 9함수(테스트 사본으로 이동, EP-11 ⑧) · 작업 보드 1칸 캐시(삭제, EP-11 ⑨) · `wasOpened`(대체, EP-15).
- [x] 수치·전칭 실측 — §8 M1~M5 · S1~S9 를 이번 세션 명령으로 셌고 오차 3건(S1 문서 줄 · S2 정의 줄 · F17 `ProjectLandingPage`)을 고쳤다.
- [x] AC 마다 행동 단언·검증 수단·프로덕션 경로 — §7 30행.
- [x] Baseline V — 상속 V 없음 · 0325/0324 는 INHERITED REGRESSION(VP-32~VP-36).
- [x] NEW node 마다 같은 레벨 REQUIRED pair — R 11·SD 1·AR 11·MD 15 노드가 VP-01~VP-31 에 있다(두 pair 를 묶은 행은 `a`·`b` — §7-A 표 아래).
- [x] 영향받은 INHERITED 는 REGRESSION — 0325 R-02·R-03 · 0324 R-05 · 저장 경로 · OpenCode 선택.
- [x] pair 마다 경로·§10 분모·좌표 — §7-A. 선택 적대 증거는 0/전수·참조 동일성 단언 pair 에 등록했다.
- [x] 규칙 칸 분기 ↔ UT 입력 — §10 규칙 표 k·w·i·r·l·g·v·s·o·x·b·t·m·f·j 가 VP 입력과 같은 기호다.
- [x] 선언 경계 — B1~B15, 수치가 있는 경계는 §8 측정을 인용했다. 열린 입력 판정 산출물 없음.
- [x] INDEX 후보 표 겹침 — `childMessageForParentToolRunId`(0314 → 0316 승격 완료) · `chatStore.ts` `sessionBusy`(0308 → 0319 승격 완료) 두 행 모두 닫혔다(`INDEX.md` 후보 표 14·20행).
- [x] 운영 gate — §7-A gate 표 4행 · 관련 없는 기존 실패는 0325 기준선(vitest 22 — Windows 전용 분기)과 차집합으로 분리한다.
- [x] 사람 실기로 미룬 순수 로직 없음 — AC29 는 레이아웃·스크롤·선택·paint 만.
- [x] structural proxy 단독 없음 — "방문 0" AC 는 모두 "결과 ≡ 전체" 와 짝이다(AC9·AC11·AC13·AC14·AC17).
- [x] 신규 계약 SSOT·강제·seam — `message-id.ts` · `messageLog.ts` · `transcriptIndex.ts` · §10 · §11.
- [x] 부팅/등록 변경 소비처 전수 — §12 표(송신기 생성 2 · TurnContext 초기화 2 · 리터럴 21).
- [x] producer/consumer — §12 표.
- [x] one-way door — 마이그레이션·공개 필드(D-008) · worst-case §14.
- [x] 게이트 명령 = `app/AGENTS.md` 현행.
- [x] `ACTIVE 결정 ↔ AC` 대조를 §3 갱신 메모에 적었다.
- [x] 문장 규칙 — 표 위주 · 판정 먼저.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **모든 impl 턴(재구현·사용자 요구 변경)이 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드와 표의 열을 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다: 빠진 필드는 조사하지 않은 것과 구분되지 않는다(impl §9).

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: … (Part I/II의 정확한 절 인용)
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

> `§10`의 `언제 강제` 칸은 **하나의 불변식이 성립해야 하는 지점 목록**이다. 한 지점만 닫아도
> 대표 경로 AC는 통과하므로 게이트 green은 전수를 뜻하지 않는다.
> **각 행의 `재현 명령 / 관측`은 이번 턴에 실제로 실행한 것만 적는다** — 산출물에서 표식을 다시
> 찾지 못하면 그 행은 닫힌 것이 아니다.
> **그 관측이 구조적 proxy·0건/전수 스윕·배선 존재 oracle이고 이번 턴에 장치를 만들거나 고쳤다면,
> 등록된 결함을 심어 실패하는지 먼저 확인한다** — 눈이 없는 장치의 `0건`은 전수의 증거가 아니다.
> 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개는 oracle 종류와 무관하게 돌린다(impl §3 sweep). 그 밖의 직접 oracle에는 mutation을 더 발명하지 않는다.
> **`전건`·`미분류 0`·`잔여 0` 행의 관측은 차집합이다** — 총계·합계는 그 주장을 반증할 수 없다(impl §9).
> **`닫은 지점`은 §10 항목이 아니라 §10이 고정한 자리로 세고, 기록된 자리 검색 명령을 다시 돌린 출력과 목록의 차집합을 적는다** — 목록이 없거나 출력과 갈리거나 술어가 불변식의 주어가 아니거나 범위가 지적이 인용한 파일로 좁으면 `PLAN_GAP`이다(impl §2).
> **닫은 자리마다 직접 oracle 좌표(`파일:테스트명` / 실패 의미 red를 관측한 `gate:<명령>`)를 적는다** — typecheck·코드 읽기·일회성 실측만 있는 자리는 `남긴 곳`에 적고 세지 않는다(impl §2).
> **좌표는 그 테스트의 실행 구간(들어간 곳 → 관측한 곳, mock한 path 구성요소 제외) 안의 자리만 닫는다** — 안쪽 export로 들어가거나 한쪽 끝을 mock하거나 내부 상태만 단언하거나 production 조립이 주입하는 의존성을 빼 다른 분기를 탄 테스트가 건너뛴 자리는 `남긴 곳`이다. 운반 값을 기본값·빈 값·형제와 같은 값으로만 준 좌표, 자리 규칙이 적은 분기 중 입력이 없는 분기가 있는 좌표도 그 자리를 닫지 않는다(impl §2).
> **`§10이 적은 지점`은 그 pair의 §10 자리 전부다** — 재구현 턴에도 지목된 자리만 적지 않고, 닫지 않은 자리는 `남긴 곳`에 남긴다(impl §9).
> **`운반 항 · 구별 값 · 관측`은 닫힘으로 센 행마다 그 자리가 넘기는 항, 테스트의 구별 입력, 좌표가 관측하는 곳을 적는다** — 셋 중 하나가 빠진 항은 `남긴 곳`이고, 호출·분기를 바꾼 변이의 red로 인자 항을 채우지 않는다(`docs/handoff/AGENTS.md §공통 V`).

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-… | … | `commit·revoke·expiry·401` (4) | 4/4 | `rg …` → 4건 · commit → `a.test.ts:'…'` · revoke → … | commit: `key`(형제와 다른 값 → 저장 결과 단언) · … / 운반 항 없음 | — |

- §10 자리 목록 밖에서 본 운반 자리: 없음 / … → 분류(impl §7): 목록 미고정 → PLAN_GAP · 현재 결함 → 선조치 또는 PLAN_GAP · 확장 후보 → 확장 창이 열려 있으면 PLAN_GAP 가능, 닫혔으면 보고 · 비귀속 → 별도 finding
- 직전 verify 고장 이력의 `못 잡음` 행: 없음 / ID → 잡은 테스트 `파일:테스트명`(재실행 결과) 또는 `동치` 근거·확인 실행 — 분류가 이행·현재 결함이거나 설계자가 채택한 확장 행은 이번 턴에 닫는다. 후보 표로 간 행과 `경계` 행은 제외

**V-pair 자기확인** — 구현자의 `SELF_PASS`는 독립 검증의 `PASS`가 아니다. 이전 라운드 상태를 유지로 옮기는 행도 좌표를 인용하고, 좌표 없이 났던 `SELF_PASS`는 이번 턴에 재판정한다(impl §2).

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-… | REQUIRED / REGRESSION | SELF_PASS / SELF_BLOCKED | `파일:테스트명` … | required — 결과 / not selected — 직접 oracle 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

> **열거 sweep**: 열거 항목(§10 자리·path edge·규칙 칸 분기·등록 변이)마다 기본 변이 1개(제거 — 계약이 다른 형제 슬롯이 있으면 맞바꿈을 더함)를
> 심어 red인지 본다(impl §3, 하네스 `.agents/skills/handoff-verify/scripts/mutate.py`). 그 위에 pair가 선택한 적대 증거·
> 파생 이슈의 인용 변이·이번 턴에 만든 구조적 proxy·0건/전수·배선 oracle의 민감도를 심는다. 규칙 칸 분기와 여러 항을 적은
> §10 자리 문장의 항은 그것을 구현한 diff 자리(조건·조기 반환·후보를 합치는 항)마다 제거 변이를 심어 찾는다. 그 밖의 hunk에는 mutation을
> 새로 발명하지 않는다. mutation이 없다는 이유만으로 현재 FAIL 범위를 늘리지 않는다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| `파일:줄` — 무엇을 어떻게 바꿨는가(제거 / 형제와 맞바꿈) | `sweep — §10 자리 / path edge / 규칙 칸 분기(diff 자리)` / `재앵커 — 원 ID` / `VP-… 선택 증거` / `D<N> 인용 변이` / `구조·전수·배선 oracle 민감도` | red / green / 최초 | `<케이스명>` 외 N건 | 잠김 / **잠금 없음 — 테스트 추가** / 동치 — 근거·확인 실행 |

- **분모 검산**: `선택 증거 N · 인용 변이 M · 새 oracle K · sweep S = 표 행 T` — sweep S는 열거 항목 수와 같아야 한다. 행이 없는 claim은 `SELF_PASS`·`closed`로 적지 않는다(impl §9).
- **덮개 회귀**: 이전 라운드에 red였는데 이번에 green인 행 0건 / N건 → 사유와 함께 적는다. 분모는 직전 verify 고장 이력의 `잡음` 행 중 하한 ④와 같은 범위이고, 원문이 옮겨 갔으면 재앵커한 행이다. 장치를 교체·삭제했으면 구 장치가 잡던 자리가 새 장치의 하한이다(impl §3).

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | … | … |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 재배치 없음 / … | … |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | … / **표에 없음** | … |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | … | … |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | … | … |

> 범위 밖이라 이번에 고치지 않더라도 **적는다** — 적지 않으면 그 선택지가 존재한 적도 없게 된다.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | … | ✅ 선조치(구현 세부) / 📝 **plan 수정 제안**(설계가 틀렸다는 증거) / ⚠️ 보고만(제품·AC·Decision·의존성) | … |

> 가운데 갈래가 구현 턴의 핵심 산출이다 — plan을 고치는 것은 설계자 책임이지만, **고쳐야
> 한다는 증거를 만드는 것은 구현자만 할 수 있다.** 무엇이 틀렸는지·코드에서 무엇을 봤는지·
> 어느 절을 어떻게 바꿔야 하는지를 함께 적는다.

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 없음 / …

> 차이가 있으면 **대체물이 갖고 원본이 갖지 않던 실패 모드를 축마다 한 줄씩** 적고, 그 축에서 다시 확인한
> AC·§10 행을 관측과 함께 남긴다. 한 축만 적은 보고는 나머지 축도 조사한 것처럼 보인다(impl §7).

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | … / 해당 없음 + 근거 | … |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | … / 해당 없음 + 근거 | … |
| 재진입 | … / 해당 없음 + 근거 | … |
| 다른 무효화 축 | … / 해당 없음 + 근거 | … |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | … |
| 실행 명령 | … |
| **관측한 게이트 산출**(exit code 아님 · 마지막 수정 뒤 실행) | `ci.yml` 단계 전부의 로컬 대응(파일 필터 없는 테스트) — 테스트 N파일 / M케이스 · error·warning 수 · 돌리지 못한 단계와 이유 · 기준선 분리 근거(변경 전 실패 집합과 차집합 ∅ + 환경 원인, `docs/handoff/AGENTS.md §판정 범위와 운영 gate`) |
| **추가·수정 테스트의 subtree 규칙** | `git diff --name-only`로 뽑은 테스트 파일 N · 규칙별 위반 0(app: 시간 예산·호스트 격리·풀 분류) · 그 파일들의 규칙 가드 실패 0 — 테스트를 건드리지 않았으면 `해당 없음` |
| V-pair 자기확인 | `SELF_PASS N / SELF_BLOCKED M`; pair별 상세는 위 표 |
| 강제 지점 전수 | N/M |
| **AC 자기보고**(`Criteria-Met`) | N/M — 각 AC 옆에 **이번 턴에 재현한 관측값**을 적는다. 표식을 다시 찾지 못한 AC는 ✅로 세지 않는다 |
| **합계 검산** | `✅ N · ⚠️ M · ❌ K = 총 T` — 분모를 다시 세고 **이 줄을 쓴 뒤** 커밋 trailer를 적는다. 분모가 바뀌었으면(AC 분할·추가) 그 사실을 적고 이전 라운드 합계와 직접 비교하지 않는다 |
| 블로커 / 역질문 | … |
| 대상 커밋 | `(r<N> 구현 — 좌표는 INDEX)` — 자기 환경의 해시를 적지 않는다. 좌표 정본은 `INDEX.md` 한 곳이고 검증자가 채운다 |

## [구현자 기입] Review Signals — 사실만

> 원인 분류(A~F)와 지침 변경은 `handoff-review`가 한다.

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 없음 / …
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: …
- 반복해서 부딪히는 환경 한계: 없음 / …
- 현재 라운드·impl 턴: `rN` / `rN.k` (verify 3·6회째 FAIL/RETURN_TO_PLAN 또는 verify 없는 impl 턴 3 초과면 — 사용자 요구 변경 턴 제외 — 다음 재구현 전에 `handoff-review`. verify 9회째가 PASS가 아니면 `verify/CLOSED` 종료)

---

## [검증자 기입] 파생 이슈

> `출처`에는 위반한 **pair·Decision·AC·§10·현재 산출물 gate**를 적는다. `PLAN_GAP`은 구현자 권한 밖의 Decision·AC·V node/pair·§10·oracle 정정 요구이며 하나라도 있으면 다음 주체는 설계자다.
> `발견 분류`는 이행(열거 원문 위반·plan 내부 불일치) · 현재(원본 동작 결함) · 확장(열거 밖 잠금 공백) · 경계 · 비귀속이다. 확장은 verify 1·2회째에만 `PLAN_GAP`이고 이후에는 `NEXT_HANDOFF(확장)`로 INDEX 후보 표에 간다(`docs/handoff/AGENTS.md §판정 범위와 운영 gate`).

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
