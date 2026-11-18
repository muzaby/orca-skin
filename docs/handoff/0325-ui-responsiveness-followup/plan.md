# Plan — 0325-ui-responsiveness-followup

> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).
> 입력 자료(사용자 첨부 원문 그대로): [`input/0324-audit.ko.md`](input/0324-audit.ko.md)(감사) · [`input/0324-agent-requests.ko.md`](input/0324-agent-requests.ko.md)(후속 요청서). 본문의 `T01`~`T33`은 요청서의 ID다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0325-ui-responsiveness-followup` |
| 작성자 | Claude Code |
| 일자 | 2026-11-18 |
| 매핑 | 0324 감사(`ee8ac81`) 후속 — 요청서 T01–T33 · 셸 잔류 · 경계 회귀 · Windows 검증 |
| 상태 | READY (V1 rev 2) |
| V mode | `Baseline V` |
| 기준 V | `none` — 0324 의 노드는 INHERITED REGRESSION 으로만 참조한다(`0324:V1 rev 4.9@22a6d06`, `origin/main` 조상 확인) |
| 이번 V revision | `V1 rev 2` — PR #633 리뷰(사용자, 2026-11-18) 반영. 구현 전 규범 행 정정이라 Delta V 가 아니다. rev 1 = 설계 커밋 `(V1 rev 1 — 검증자 기입)` |
| 유효 V | `V1 rev 2` |

# Part I — Product & UX Contract

## 1. Context / 목표

- **해결하려는 문제**: 0324 가 셸·실행·저장을 호스트로 나눴지만, 창(renderer UI 스레드)에는 이력 길이·도구 출력 길이·diff 문자 수에 비례하는 일이 남았다(감사 판정). 그중 하나는 기능 실패다 — 빈 parts 메시지 200,000건 세션은 조립 중 `RangeError` 로 열리지 않는다(§8 R1).
- **완료 후 달라지는 것(단계 A)**: 세션 조립이 크기와 무관하게 성공한다. 스트리밍 delta·확정 메시지 하나가 하는 창의 일이 화면 밖 이력 길이와 무관해진다. diff·입력 장식·계산 캐시·썸네일·복사·경계 끌기는 상한 안에서 끝난다.
- **한 문장**: 긴 세션을 열고 답변을 받는 동안에도, 이력이 길다는 이유만으로 delta 하나·메시지 하나·입력 한 글자의 창 작업이 늘지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "핸드오프 324를 통해 main/agent/data/renderer/webworker 형태로 역할과 책임을 분리했다. 각 기능들의 이주작업도 진행했으나 여전히 많은 기능들이 제대로 이주되지 읺았다. 첨부는 진단결과 및 후속대응 요청서이다. 확인 후 대응하라" | 턴 1 |
| 명시 요구 | "Plan 까지만 진행하라" | 턴 2 |
| 명시 요구 | "리뷰코멘트 확인하라" — PR #633 리뷰: "단계 분할을 유지하되, **A의 두 반례를 수정하고 후속 후보 사이에 공유할 계약과 완료 기준을 명시한 뒤 READY로 진행**하기를 요청합니다" | 턴 3 · [PR #633 코멘트](https://github.com/muzaby/orca-skin/pull/633#issuecomment-6970300133) |
| 명시 요구(첨부) | "Windows 기준 측정을 먼저 시작하고 세션 조립 실패를 우선 수정한다" · 각 T 행의 요청·완료 기준 | 요청서 **전달 순서** · 각 절 |
| 추론 의도 | 요청서 전 항목을 현재 코드로 판정하고, 공개 계약·저장 형식·제품 흐름을 바꾸지 않으며 이 환경에서 기계 검증되는 항목을 단계 A 로 구현한다. 나머지는 단계 handoff 로 넘긴다 | 설계자 추론 — D-003 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 0325 는 첨부 감사·요청서의 T01–T33 · 셸 잔류 · 경계 회귀 · Windows 검증 전 항목을 받는다. 항목마다 현재 코드 판정과 처리 단계를 §6-B 표에 둔다 | "확인 후 대응하라" | 턴 1 | ACTIVE | — |
| D-002 | 이번 세션의 산출은 plan 까지다. 구현·검증은 하지 않는다 | "Plan 까지만 진행하라" | 턴 2 | ACTIVE | — |
| D-003 | 0325 V1 은 단계 A — 공개 IPC·저장 형식·제품 흐름을 바꾸지 않고 Linux 에서 기계 검증되는 9개 묶음(WU-1~WU-9)과 Windows 전후 기록(AC19)이다. 단계 B·C·D·E·W 는 INDEX `새 handoff 후보` 의 0325 행으로 넘긴다 | 요청서가 기능 영역별 담당 분리를 전제한다 · AC 25 상한(handoff-plan §5) · 0324 plan 은 한 handoff 로 580KB 가 됐다(§8) | 설계자 · 사용자 확인(PR #633 "단계 분할을 유지하되") | ACTIVE (사용자 확인 2026-11-18) | — |
| D-004 | 0324 의 D-007(50ms·160ms·5ms) · D-008(상한 없는 계산은 UI 스레드에 두지 않는다 — 남기려면 상한 상수와 그 상한의 비용) · D-009(워커 실패 시 UI 스레드 대체 계산 없음) · D-011(세션 본문 한 번 반영) · D-012 · D-014 · D-045 를 그대로 따른다 | 0324 §3 에서 ACTIVE | 0324 plan §3 | ACTIVE | — |
| D-005 | 세션 페이지·커서(최신 페이지 + 이전 페이지 커서, 단일 거대 메시지 본문 별도 인출)를 도입할지. 도입하면 이전 페이지를 어떻게 부르는지(위로 스크롤 자동/버튼)와 전체 이력이 필요한 우측 패널·작업 보드·검색 이동이 무엇을 보는지 | T01 "최초 요청을 최신 페이지와 이전 페이지 커서로 바꾼다" 가 0324 D-011 "앞부분부터 보이는 점진 표시는 하지 않는다" 와 충돌하고, `oo:session:load` 응답·행 ID 계약을 바꾼다 | 요청서 T01 · 설계자 | SUPERSEDED | D-022(도입 확정) · D-023(남은 OPEN 범위) |
| D-006 | Windows 목표 장비·주사율·배율과 허용치(입력→paint p95·최대, 누락·연속 누락 프레임, 50ms·160ms 구간 수) | "목표 장비의 허용치는 측정 전에 합의한다" · 성능 SLA 는 PRD §11 미정 항목(`app/AGENTS.md` 의존성 정책) | 요청서 Windows 절 | SUPERSEDED | D-024(기준선 수집) · D-025(허용치 판정) — PR #633 "기준선 수집과 허용치 결정을 분리하십시오" |
| D-007 | 세션 조각 상한을 셋으로 둔다 — 메시지 500 · part 500 · 직렬화 근사 문자 1,000,000. 상한을 넘는 메시지 하나는 혼자 한 조각이다. 크기 측정은 남은 예산을 넘는 순간 멈춘다 | part 만 세면 빈 parts 메시지가 한 조각에 무한히 든다(§8 R1). 1,000,000자·500건 구조화 복제 1.04ms, 같은 문자 5,000건 4.52ms(§8 M1) | 설계자(D-008 적용) | ACTIVE | 0324 AC16 의 part 상한을 보완 |
| D-008 | 인라인 diff 는 두 입력 문자 수 합을 먼저 본다 — `DIFF_INLINE_MAX_CHARS = 64,000` 을 넘으면 줄을 세지 않고 워커로 간다(머리 증감 없음). 줄 수는 합이 400 을 넘는 순간 세기를 멈춘다 | 한 줄 5,000,000자 두 입력이 400줄 상한을 통과해 UI 스레드 diff 를 탄다(§8 M2). 상한에서의 비용 4.72ms(§8 M3) | 설계자(D-008 적용) | ACTIVE (사용자 거부 가능 — 400줄 이하라도 64,000자 초과면 머리 증감이 없다) | 0324 D-014 를 보완 |
| D-009 | 도구 카드 머리 증감은 한 카드의 수정·파일 전부를 합산 예산으로 판정한다 — 줄 합 400 · 문자 합 64,000(전·후 본문 쌍) · patch 문자 합 1,000,000. 넘으면 머리 증감을 그리지 않는다 | MultiEdit 50개 × (200+200줄) 머리 계산 94.9ms(§8 M4) — 수정마다 상한 안이어도 합은 무제한이다 | 설계자(D-014 적용) | ACTIVE (사용자 거부 가능) | 0324 D-014 를 보완 |
| D-010 | 컴포저 초안이 `COMPOSER_DECORATION_MAX_CHARS = 20,000` 을 넘으면 장식(chip 배경)을 만들지 않는다. textarea 의 글자·커서·IME 는 그대로다 | 400,000자 초안이 장식 조각 100,000개를 동기 생성한다(§8 R3). 20,000자 최악 입력 1.27ms · 5,000조각(§8 M5) | 설계자(D-008 적용) | ACTIVE (사용자 거부 가능 — 큰 초안에서 chip 색이 없다) | — |
| D-011 | 계산 결과 크기는 워커가 응답에 싣는다. 캐시 상한을 넘는 단일 결과와 크기가 없는 결과는 캐시에 넣지 않고 기존 항목도 밀어내지 않는다 | `client.ts:116` 루프가 새 키에서 멈춰 상한보다 큰 최신 결과가 남는다 · `client.ts:107` 이 renderer 에서 결과를 순회해 크기를 센다 | 요청서 T15 · 설계자 | ACTIVE | 0324 AC14 를 보완 |
| D-012 | 전송용 썸네일을 만들지 못하면 그 첨부 뷰에 미리보기를 두지 않는다(원본 data URL 대체 금지). 원본 첨부는 그대로 보낸다. 썸네일은 한 전송에서 동시에 2개까지 만든다 | `imageThumb.ts:17·24·27` 이 실패 때 원본을 돌려줘 거대한 data URL 이 미리보기로 저장된다 · `useAttachments.ts:147` 동시 수 무제한 | 요청서 T21 | ACTIVE (사용자 거부 가능 — 실패 이미지는 썸네일 대신 파일 표시) | — |
| D-013 | 복사 문자열은 클릭할 때 만든다(Claude 도구 카드 본문 · Claude assistant 턴 메타 · 공통 user 턴 메타). 버튼 노출은 복사 문자열이 빈 문자열이 아닌 것과 같은 값인 `hasPartsText` 로 정한다 | `AssistantTurn.tsx:59` · `UserTurn.tsx:17` · `ToolCard.tsx:198` 이 렌더마다 만든다. OpenCode 메타는 이미 지연이다(`Timeline.tsx:176`) | 요청서 T12·T13 | ACTIVE | — |
| D-014 | 경계 끌기는 애니메이션 프레임마다 최대 1회, 그 프레임의 마지막 포인터 값으로 반영하고, 놓을 때 남은 값을 즉시 반영한다 | `useDragResize.ts:40` 이 mousemove 마다 `onChange` 로 store 에 쓴다 | 요청서 T26 | ACTIVE | — |
| D-015 | OpenCode 는 live 본문을 행 리프가 구독한다. Timeline 은 live 의 유무(text 비지 않음 · reasoning 공백 아님)만 구독하고, 행은 head·tail 을 이어 붙이지 않고 색인으로 읽는다. 행 순서·key·gap·streaming·본문은 지금과 같다. live 행과 확정 행은 같은 컴포넌트 형으로 그린다 | delta 마다 head 행 29,997개 복사·현재 exchange 확정 parts 1,000회 읽기(§8 R5). 같은 형이어야 완료 전환에서 DOM 이 바뀌지 않아 선택이 남는다(`Timeline.selection.test.ts:24`) | 감사 권장 1 · 요청서 T06 | ACTIVE | — |
| D-016 | Claude exchange 그룹화는 증분이다 — 바뀌지 않은 메시지로만 된 앞 exchange 는 이전 객체를 쓰고, 첫 변경 메시지가 든 exchange 부터 다시 묶으며, 다시 묶은 결과 중 내용이 같은 exchange·turn 은 이전 객체로 돌려준다. 옵션이 바뀌면 전부 다시 묶는다 | 마지막 메시지 하나 추가에 과거 exchange 9,999개를 새로 만든다(§8 R4) | 감사 권장 2 · 요청서 T04 | SUPERSEDED | D-027 — 재사용 경계 규칙("다음 exchange 시작 ≤ 첫 변경")이 숨는 user 메시지에서 틀렸다(§8 V2) |
| D-017 | ChatTile 의 `onRestoreSteerDraft` 는 `activeKey` 의존 `useCallback` 으로 안정화하고 Claude `Exchange` 비교자가 이 함수를 비교한다 | 렌더마다 새 람다라 `TranscriptView` 얕은 비교가 빗나가고, `Exchange` 비교자는 이 함수를 보지 않는다(`Exchange.tsx:76-85`) | 요청서 설계 항목 · 감사 memo 표 | ACTIVE | — |
| D-018 | Work 결과 선택기 · `reconcileSegments` · OpenCode head 증분 · Markdown 워커 파서 · 블록 가상화는 0325 에서 바꾸지 않고 지금의 캐시·memo 를 유지한다 | 감사 memo 표 "이주 중에는 보존 … 색인과 증분 갱신을 검증한 뒤 대체" — toolRunId 색인 계약이 단계 B 의 선행이다 | 감사 · 설계자 | ACTIVE | — |
| D-019 | 조건부·측정 우선 항목(T17·T18·T23·T28~T31·T33·셸 설정 승계·종료 로그)은 0325 에서 코드를 바꾸지 않고 단계 handoff 가 Windows 실측 뒤 이주 여부를 정한다 | "기존 결과 상한·memo가 있는 화면은 측정한 뒤 이주 여부를 정한다" | 요청서 산출물 절 | ACTIVE | — |
| D-020 | 첨부 두 문서를 이 폴더 `input/` 에 원문 그대로 둔다 | 구현자·검증자는 분리 환경이라 업로드 파일을 보지 못한다 | 설계자 | ACTIVE | — |
| D-021 | 단계 A 의 verify PASS 는 요청서 전체의 완료가 아니다. 후속 후보(B·C·D·E·W)마다 선행 계약·담당·대응 T·요청 사항·완료 근거·후속 handoff 링크를 §6-C 에 두고, 전체 완료는 §6-C 의 모든 행이 닫히거나 실측과 함께 현행 유지로 종결될 때다. B·E 의 ID 계약 · C 의 워커 규약 · W 의 기준선은 후속 구현 전에 합의할 수 있다 | "A의 PASS와 전체 요청의 완료를 구분하고, 후보별 선행 계약·담당·대응 T 번호·후속 handoff 링크를 추적해 주십시오. 특히 B와 E의 ID 계약, C의 워커 규약, W의 기준선은 후속 구현이 시작되기 전에 합의할 수 있습니다" | 사용자 PR #633 | ACTIVE | — |
| D-022 | 세션 페이지는 단계 E 의 확정 요구다 — 최신 페이지 · 이전 페이지 커서 · 거대 단일 본문 별도 인출. 첫 페이지가 준비된 뒤 한 번에 교체해 0324 D-011 의 원자적 전환을 보존한다 | "요청서가 명시한 최신 페이지·이전 커서·거대 단일 본문 별도 인출은 후속 요구로 확정하고 … 첫 페이지 준비 후 한 번에 교체하면 기존 원자적 전환을 보존할 수 있습니다" | 사용자 PR #633 | ACTIVE | D-005 대체(도입 여부) |
| D-023 | 이전 페이지를 불러오는 UX 와 아직 불러오지 않은 이력을 쓰는 소비자(우측 패널·작업 보드·검색 이동·복구)의 계약 | "D-005의 미결정 범위를 이전 페이지를 불러오는 UX와 미로딩 이력 소비자 계약으로 좁히십시오" | 사용자 PR #633 | **OPEN** — 단계 E | D-005 대체(남은 범위) |
| D-024 | Windows 기준선은 허용치와 무관하게 AC19 에서 모은다 — 같은 장비·같은 빌드 구성으로 `ee8ac81` 빌드와 단계 A 빌드의 입력→paint p95·최대, 누락·연속 누락 프레임, React commit·layout, `perf.stall` 을 Claude Code·Work·OpenCode 시나리오에서 기록한다 | "A의 AC19에서 동일 장비·빌드 조건으로 입력→paint p95/최대, 누락·연속 누락 프레임, React commit·layout을 수집하고 최종 허용치 판정을 W에 두십시오" | 사용자 PR #633 | ACTIVE | D-006 대체(기준선) |
| D-025 | Windows 목표 장비·주사율·배율의 허용치 판정 | 성능 SLA 는 PRD §11 미정 항목 · "최종 허용치 판정을 W에 두십시오" | 사용자 PR #633 | **OPEN** — 단계 W | D-006 대체(판정) |
| D-026 | 컴포저 스킬 토큰의 끝 구두점 다듬기는 후보 길이를 가장 긴 등록 스킬 이름으로 제한하고, 끝 문자 판정은 정규식이 아닌 문자 집합으로 한다. 결과는 지금과 같다 — 구두점으로 끝나는 등록 스킬도 인식한다. 리뷰의 입력(`/z` + 마침표 19,998개, 등록 `build`)은 회귀 케이스다 | 지금은 끝 문자를 하나씩 자르며 집합을 조회해 20,000자 토큰에서 조회 20,000회·174.8ms(§8 V1). 시제작은 조회 5회·0.10ms, 결과 표본 11건 불일치 0(§8 V5) | 사용자 PR #633 P1 · 설계자 | ACTIVE | D-010 을 보완(상한만으로는 비용이 묶이지 않는다) |
| D-027 | Claude exchange 그룹화는 증분이다 — 다음 exchange 시작이 첫 변경 지점보다 **작은** exchange 만 이전 객체로 재사용한다(같으면 그 경계 메시지가 숨거나 바뀌어 경계가 사라질 수 있어 직전 exchange 부터 다시 묶는다). 다시 묶은 결과 중 내용이 같은 exchange·turn 은 이전 객체로 돌려주고, 옵션이 바뀌면 전부 다시 묶는다 | `[질문 A, 답변 A, 질문 B, 답변 B]` 에서 질문 B 가 숨으면 전체 그룹화는 exchange 하나(답변 A·B 한 turn)인데 rev 1 규칙(`≤`)은 A 를 재사용해 병합을 놓친다(§8 V2) | 사용자 PR #633 P1 · 감사 권장 2 | ACTIVE | D-016 대체 |
| D-028 | 0324 의 AC22·AC23·AC52′ 실창 항목은 AC19 와 같은 실창 세션에서 수행하고 결과를 0324 의 원래 항목에도 기록한다 | "0324의 AC22·AC23·AC52′는 같은 실창 세션에서 수행하되 결과는 기존 소유 항목에도 기록합니다" | 사용자 PR #633 | ACTIVE | — |
| D-029 | 단계 D 의 "호스트 질의 계약 결정" 은 그 계약을 실제로 바꾸는 작업(T20 prefix·개수 질의 · T28 정렬·필터 페이지 · T30 출력 발췌)만의 선행 조건이다. 기존 상한으로 충분한 화면은 입력 크기와 실측값을 남겨 현행 유지로 종결할 수 있다 | "단계 전체에 적힌 '호스트 질의 계약 결정'은 그 계약을 실제로 바꾸는 작업의 선행 조건으로 한정하십시오" · "기존 상한으로 충분한 화면은 당시 입력 크기와 실측값을 남겨 현행 유지로 종결할 수 있어야 합니다" | 사용자 PR #633 | ACTIVE | — |

### 갱신 메모

- rev 1(턴 1·2)에서 추가된 결정: D-001~D-020.
- rev 2(턴 3 — "리뷰코멘트 확인하라", PR #633 리뷰)에서 추가된 결정: D-021~D-029. 리뷰 지적 4건은 실제 함수로 재현한 뒤 반영했다(§8 V1~V4).
- 변경된 결정: D-005 → D-022·D-023 · D-006 → D-024·D-025 · D-016 → D-027(설계 결함 정정). D-003 은 사용자 확인으로 "거부 가능" 표기를 거뒀다.
- 기존 ACTIVE 중 이번 턴에 언급되지 않았지만 유지되는 결정: D-001·D-002·D-004·D-007~D-015·D-017~D-020 · 0324 D-007·D-008·D-009·D-011·D-012·D-014·D-045(D-004 로 승계). 0324 D-011 은 D-022 의 원자적 교체로도 유지된다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0. D-001 ↔ §6-B(전 항목 판정) · D-002 ↔ 메타 상태·INDEX · D-003 ↔ AC1~AC19 범위 · D-004 ↔ AC3·AC6·AC9(현행 유지) · D-007 ↔ AC1·AC2 · D-008 ↔ AC11 · D-009 ↔ AC12 · D-010·D-026 ↔ AC14 · D-011 ↔ AC13 · D-012 ↔ AC17·AC18 · D-013 ↔ AC15 · D-014 ↔ AC16 · D-015 ↔ AC4·AC5·AC6 · D-027 ↔ AC7·AC8 · D-017 ↔ AC10 · D-018 ↔ AC9·§10 경계 B6·B9·B10 · D-019·D-029 ↔ §6-B·§6-C · D-020 ↔ 메타 · D-021 ↔ §6-C·INDEX · D-022 ↔ §6-C E 행 · D-024 ↔ AC19 · D-028 ↔ AC19·§19. OPEN D-023·D-025 는 AC 가 기대지 않는다(AC19 는 허용치 없이 기록만 요구).

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 — 감사 수치 5건을 실제 함수로 재현했다. 시간은 환경 차이로 감사의 0.3~0.5배다 | §8 R1~R5 |
| 이미 기존 코드가 충족하는가 | 일부 — Claude live 리프, 확정 Markdown 블록 캐시, patch 상한의 실측, 복사 버튼의 지연 문자열 지원은 이미 있다 | `PendingAssistant.tsx:10-18` · `markdownBlocks.ts:90` · 0324 plan B8 · `CopyIconButton.tsx:7` |
| 더 작은 해법이 있는가 | 타당 — T04·T06 은 워커 이주보다 창 안 증분 색인이 작다. 감사도 "작은 단건 변경은 renderer에서 처리"를 권한다. T01 단기는 조각 상한과 루프 조립으로 닫힌다 | 감사 §권장 이주 순서 2 |
| 선행 자료의 주장을 코드와 대조했는가 | 정정 2건 — `limits.ts:1-2` 는 수치 근거를 ADR 012 라 하지만 ADR 012 에 수치가 없다. IPC 계약의 조각 행은 "preload 가 모은다"지만 0324 D-058 뒤 조립은 renderer 전송층이다 | `grep -c '[0-9]ms' docs/decisions/012-execution-contexts.md` → 0 · `IPC_CONTRACT.md:266` |
| ACTIVE 결정·기존 채택 결정과 충돌하는가 | 해소 1 · 남음 1 — T01 장기 페이지는 첫 페이지를 한 번에 교체하면 0324 D-011 과 양립한다(D-022, 사용자 확인). T12 "접은 본문 해제"는 감사의 "접힘 상태는 DOM 수명과 독립적으로 보존"과 함께 설계해야 해 단계 B(D-018) | 0324 plan §3 · 감사 §이벤트별 표 · PR #633 |
| 요청서의 "W 가 맡는다" 를 단계 A 에서 하는가 | 하지 않는다 — W 로 옮겨도 R 의 DOM 반영·행 순회가 남는다. 단계 A 는 R 의 순회 자체를 줄인다. W 이주는 공통 요청 규약(단계 C) 뒤다 | 감사 §남은 경로 · 요청서 "공통 워커 요청 규약은 워커 담당자가 소유한다" |

- 사용자에게 올릴 결정: D-023(이전 페이지 UX · 미로딩 이력 소비자 계약 — 단계 E) · D-025(Windows 허용치 — 단계 W). 둘 다 단계 A 를 막지 않는다. D-003·D-005(도입 여부)·D-006(기준선)은 PR #633 으로 닫혔다.
- 코드 조사로 닫은 사실: §8 의 표 전부.

## 5. 동작 / 사용자 흐름

```text
[세션 열기·새로고침]
  → 데이터 호스트가 조각마다 예산 안에서 메시지를 잘라 보낸다(조각 사이 양보, 다음 조각만 측정)
  → renderer 전송층이 조각을 모아 인자 펼침 없이 한 벌로 조립한다
  → 스토어에 한 번 반영(0324 D-011) → 첫 화면
  ↘ 취소·창 닫힘 → 남은 조각 미전송·호출 거부 · 조각 누락 → 거부(부분 본문 없음)

[OpenCode 답변 스트리밍]
  → delta 가 live 에 붙는다 → live 행 리프만 다시 그린다
  → live 가 처음 생기거나 비워질 때만 현재 exchange 행을 다시 투영한다
  → 완료 → 같은 key·같은 컴포넌트 형의 확정 행(선택 유지)

[Claude 확정 메시지·도구 결과 도착]
  → 첫 변경 메시지가 든 exchange 부터(그 메시지가 경계면 직전 exchange 부터) 다시 묶는다 → 같은 내용의 exchange 는 이전 객체
  → 늦은 결과는 원래 호출 카드에(현행)

[도구 카드 머리·인라인 diff] → 문자 합 → 줄 합(조기 중단) → 카드 합산 예산 → 안: 증감·같은 렌더 diff / 밖: 증감 없음·워커 diff
[컴포저 입력] → 20,000자 이하: 장식 / 초과: 장식 없음(글자·커서·IME 그대로)
[복사 버튼 클릭] → 그때 복사 문자열을 만든다 → 클립보드
[경계 끌기] → 프레임마다 마지막 값 1회 반영 → 놓으면 남은 값 즉시 반영
[이미지 첨부 전송] → 썸네일 동시 2개 → 성공: 미리보기 / 실패: 미리보기 없음 · 원본은 그대로 전송
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 세션 로드 중 다른 세션 클릭 | `cancelLoad` → 호스트는 다음 조각부터 미전송 · 전송층은 늦은 조각 폐기 | 앞 세션 본문이 활성 세션을 덮지 않는다(현행 0324 AC17) |
| 로드 중 같은 세션에 live 도착 | 로드 결과로 캐시 실시간 상태를 덮지 않는다 | 진행 중 화면 유지(현행 0324 D-045) |
| OpenCode live 빈 값 → 값 | 현재 exchange 행 재투영 1회 | live 행 출현 |
| live 값 → 더 긴 값 | live 행 리프만 갱신 | 본문만 늘어난다 |
| live → 확정(완료) | live 비움 + 확정 part → 재투영 1회 | 같은 key·같은 형 → DOM 유지·선택 유지 |
| Claude 과거 메시지 교체(늦은 결과·산출물 연결) | 그 exchange 부터 재그룹, 같은 내용은 이전 객체 | 바뀐 카드만 다시 그린다 |
| 자동 피드 표시 토글 | 전부 재그룹(같은 내용 exchange 는 이전 객체) | 표시 규칙대로(현행) |
| 초안이 20,000자를 넘음 / 다시 내려옴 | 장식 끔 / 켬 | chip 배경 사라짐 / 다시 보임 |
| 끌기 중 mouseup | 예약 프레임 취소 + 마지막 값 즉시 반영 | 놓은 위치가 최종 폭 |
| 썸네일 실패 | 그 뷰에 미리보기 없음 | 버블에 파일 표시, 전송은 성공 |

### 파생 UX / 엣지케이스

- loading / empty / error: 세션 로드 실패·조각 누락은 지금처럼 거부한다. 워커 실패 diff 는 지금처럼 `failed` 다(0324 D-009).
- cancel / retry / close / restart: 세션 전환 취소·창 닫힘·호스트 재접속은 0324 계약 그대로다(AC3).
- concurrency / multi-session: delta 경로 `receiveDeltaBatch` 는 바꾸지 않는다(단계 B). OpenCode 리프는 활성 세션 live 만 구독한다(현행 선택자와 같은 키).
- keyboard / a11y / theme: 복사 버튼·끌기의 키보드 경로 변경 없음. 장식 층은 지금처럼 `aria-hidden` 이다.
- 외부환경: Windows 패키징 앱 실측은 AC19(사람)이고 허용치는 D-006 이다.

## 6. 범위 / 비범위

- **범위**: WU-1~WU-9 와 AC19(사람 기록). 공개 IPC 채널·응답 형상·DB·설정 변경 0.
- **비범위**: 단계 B·C·D·E·W(§6-B). 세션 전체 크기의 상한·페이지는 D-005 결정 뒤 단계 E 다.

| WU | 요청 ID | 내용 | AC |
|---|---|---|---|
| WU-1 | T01(단기) · T09 | 세션 조각 상한 셋 · 인자 펼침 없는 조립 | AC1~AC3 |
| WU-2 | T06 | OpenCode live 리프 구독 · head/tail 색인 | AC4~AC6 |
| WU-3 | T04 · 설계 항목 | Claude 증분 그룹화 · steer 복원 콜백 | AC7~AC10 |
| WU-4 | T10 · T14 | diff 문자 우선 상한 · 카드 합산 예산 | AC11·AC12 |
| WU-5 | T15 | 캐시 크기 워커 산출 · 과대 결과 미보관 | AC13 |
| WU-6 | T19 | 컴포저 장식 상한 | AC14 |
| WU-7 | T12 · T13 | 복사 문자열 클릭 시 계산 | AC15 |
| WU-8 | T26 | 경계 끌기 프레임 병합 | AC16 |
| WU-9 | T21(일부) | 썸네일 실패 시 원본 미보관 · 동시 2 | AC17·AC18 |

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 세션 페이지·커서(T01 장기) | **예 — 공개 응답 형상·행 ID·커서 계약** | 도입 확정(D-022) · UX·소비자 계약은 D-023 OPEN → 단계 E. ID 계약은 B 와 함께 후속 구현 전에 합의(§6-C) |
| 워커 요청 키를 문서 ID·revision 으로(T15 잔여) | 아니오 — renderer 내부 계약 | 단계 C |
| 호스트 prefix·정렬 페이지 질의(T20·T28~T30) | **예 — IPC 요청 인자** | 단계 D 설계 때 사용자 결정 |
| 블록 가상화·접은 본문 해제(T04·T12 잔여) | 아니오 | 단계 B |

### 6-A. 단계 지도

| 단계 | 항목 | 선행 | 다음 주체 |
|---|---|---|---|
| A (0325 V1) | WU-1~WU-9 · AC19(W 기준선 수집 포함) | — | Claude(비기능 구현) |
| W-기준선 | `ee8ac81` 빌드·단계 A 빌드의 같은 장비·같은 구성 실측(D-024) · 0324 AC22·AC23·AC52′ 같은 세션(D-028) | 없음 — 허용치와 무관 | 사람(AC19) |
| W-판정 | 기준선에 허용치를 적용한 합격 판정 | D-025 | 사람 |
| B | T02 · T03 · T04 잔여 · T05 · T06 잔여 · T07 · T11 · T12 잔여 · T16 · T17 · T18 · T25 | 메시지·행 ID·toolRunId 색인 계약 — E 와 공동 합의(§6-C) | Claude |
| C | T08 · T14 잔여 · T15 잔여 · T22 · T23 · T27 · T33(테마 재강조) | 공통 워커 요청 규약(요청서 "워커 담당자가 소유한다", §6-C) | Claude |
| D | T20 · T21 잔여 · T24 · T28 · T29 · T30 · T31 · T32 · T33(입력 높이 측정) · 셸 3항목 | 계약을 바꾸는 T20·T28·T30 만 호스트 질의 계약 결정(D-029) | Claude |
| E | T01 장기(세션 페이지·커서·단일 거대 본문 인출 — D-022 확정) | D-023 · B 와의 ID 계약 | Claude |

권장 순서는 A(+W-기준선 — AC19 가 `ee8ac81` 빌드도 함께 잰다) → B·E 의 ID 계약 합의 → B → C → D → E 이고, W-판정은 D-025 뒤다. 단계 A 의 PASS 는 요청서 전체의 완료가 아니다(D-021) — 전체 완료는 §6-C 의 행이 모두 닫히거나 실측과 함께 현행 유지로 종결될 때다.

### 6-B. 요청 항목별 판정 (`ee8ac81` = 이 브랜치 HEAD)

| ID | 현재 코드 판정 | 0325 처리 | 근거 |
|---|---|---|---|
| T01 | **실패 재현** — 200,000건이 한 조각, 조립의 `push(...)` 에서 `RangeError` | 단기: A WU-1 · 장기: E(D-022 확정 · D-023 OPEN) | §8 R1 · `data-host.ts:83` |
| T02 | 확인 — delta 마다 문자열 누적·entry 복제, sessions 가 바뀔 때마다 생성 중 키 filter+sort | B | `chatStore.ts:552-569` · `chatStore.ts:710` · `responseProgress.ts:20-22` |
| T03 | 확인 — 산출물 연결이 전체 메시지 `findIndex`, 취소 복원이 전체 `filter` | B | `chatReducer.ts:1043` · `chatReducer.ts:1107` · `chatStore.ts:898` |
| T04 | **재현** — 과거 99/999/9,999 exchange 를 새 객체로 만든다 | 그룹 참조: A WU-3 · 긴 단일 exchange 블록 가상화: B | §8 R4 |
| T05 | 확인 — Work 선택기가 호출마다 exchange 전부를 돈다(parse 는 WeakMap 캐시) | B(D-018) | `workToolResults.ts:38-71` |
| T06 | **재현** — head 행 297/2,997/29,997 복사, 확정 parts 10/100/1,000회 읽기 | live·색인: A WU-2 · 긴 선택 DOM 축소: B(실창 검증 선행) | §8 R5 · `Timeline.tsx:52` · `Timeline.tsx:64-75` |
| T07 | 확인 — 확정 블록 캐시는 있고 꼬리는 재분할·재파싱 | B | `markdownBlocks.ts:90-99` |
| T08 | 확인 — 행 번호를 전체 split·배열·join | C | `CodeBlock.tsx:85` |
| T09 | 확인 — 조각마다 schema 검증 후 누적 | 조각 크기 상한: A WU-1 · 구간 분리 측정: W | `session-load.ts:43-49`(전송층) |
| T10 | **측정** — MultiEdit 50 × (200+200줄) 머리 94.9ms | A WU-4 | §8 M4 · `toolMeta.ts:198-211` |
| T11 | 확인 — 열린 상세가 messages 를 구독해 task·자식 메시지를 전부 찾는다 | B | `InlineSubagentDetail.tsx:25-30` |
| T12 | 확인 — 연 카드는 접어도 본문 유지, 복사 문자열 렌더 중 계산 | 복사 지연: A WU-7 · 본문 해제·요약 W: B | `ToolCard.tsx:182` · `ToolCard.tsx:198` |
| T13 | 확인 — 턴 메타가 렌더 중 `turnCopyText` | A WU-7 | `AssistantTurn.tsx:59` · `UserTurn.tsx:17` |
| T14 | **측정** — 한 줄 5,000,000자 두 입력이 400줄 상한을 통과해 UI diff 6.52ms | 문자 우선·조기 중단: A WU-4 · patch W 파싱·가시 행: C | §8 M2 · `inline.ts:9-11` |
| T15 | 확인 — 상한보다 큰 최신 결과 잔류, renderer 크기 집계, 키에 본문 | 크기·미보관: A WU-5 · revision 키: C | `client.ts:106-118` · `protocol.ts:51-68` |
| T16 | 확인 — 버블 실측·rect 읽기 | B(실창) | `UserBubbleText.tsx:59` · `UserBubbleText.tsx:78` |
| T17 | 조건부 | B 측정 | 감사 · D-019 |
| T18 | 조건부 — 카드마다 interval | B 측정 | `elapsed.ts:30` |
| T19 | **측정** — 400,000자 20.0ms · 조각 100,000 | A WU-6 | §8 R3 |
| T20 | 확인 — 파일 후보를 전부 filter 한 뒤 8개 slice | D | `mentionAutocomplete.ts:51-59` |
| T21 | 확인 — 실패 시 원본 data URL 반환, 동시 수 무제한 | 실패·동시 수: A WU-9 · W 인코딩·픽셀 상한: D | `imageThumb.ts:17-27` · `useAttachments.ts:147` |
| T22 | **재현** — 50,000 추가 줄 → 50,000행 13.8ms(중앙값) | C | §8 R2 · `FileDiffSection.tsx:241-254` |
| T23 | 조건부 — 파일 상한 200 | C 측정 | `git-diff-parse.ts:18` |
| T24 | 확인 — ResizeObserver 마다 댓글 rect 재계산 | D | `PlanCommentOverlay.tsx:57` · `planCommentDom.ts:43` |
| T25 | 확인 — 보드 1-entry 캐시 · 배경 패널 재분류 · OpenCode stringify | B | `taskBoard.ts:100-109` · `model.ts:50-74` |
| T26 | 확인 — mousemove 마다 `onChange` | A WU-8 | `useDragResize.ts:40` |
| T27 | 확인 | C | `ArtifactPreviewContent.tsx` |
| T28 | 조건부 | D(정렬·페이지 = 계약 변경) | D-019 |
| T29 | 조건부 — 붙여넣은 JSON 동기 파싱 | D | `customProvider.ts:24` |
| T30 | 조건부 | D | D-019 |
| T31 | 조건부 — memo·일자 상한 있음 | D 측정 | `UsageTab.tsx:121-130` |
| T32 | 확인 — 로그마다 문자열 누적·강제 하단 이동 | D | `InstallerDialog.tsx:32` · `InstallerDialog.tsx:44` |
| T33 | 조건부 — 값마다 높이 쓰기·읽기 · 테마 변경 시 마운트된 코드 블록 재강조 | 테마 재강조 동시성: C · 입력 높이 측정: D(측정) | `AutoGrowTextarea.tsx:29-30` · `CodeBlock.tsx:39` · `:48`(테마가 강조 요청 키) |
| 셸 자산 조회 | 확인 — `app://` 요청마다 `existsSync`(가드 등록 count 2) | D | `index.ts:194` · `ui-thread-rules.mjs:207` |
| 셸 설정 승계·창 위치·종료 로그 | 확인 — 부팅 1회 동기 읽기 · 종료 flush(가드 등록) | D 측정 | `shell-state-file.ts:26` · `ui-thread-rules.mjs:165` |
| 경계 회귀 | 단계 A 는 채널·피어 메시지 변경 0 — 매 단계 gate 의 `check-ui-thread` 와 채널 소유 타입 검사가 본다 | 각 단계 gate · 원문 대조는 W | §7-A gate |
| Windows 통합 검증 | 이 환경은 Electron 바이너리를 받지 못한다(`app/AGENTS.md` 제약 환경) | 기준선: AC19(D-024) · 허용치 판정: W(D-025) | D-024 · D-025 |
| 0324 verify 미완료 AC22·AC23·AC52′ | 0324 보드 행이 소유(다음 주체 사람) | AC19 와 같은 실창 세션에서 수행 · 결과는 0324 항목에도 기록(D-028) | INDEX 0324 행 |

### 6-C. 후속 후보 추적 — A 의 PASS 와 전체 완료를 가른다 (D-021)

이 표는 후속 handoff 의 입력 계약이다. 0325 verify 가 판정하는 열거 원문이 아니며, 후속 handoff 를 만들면 마지막 칸에 링크를 적는다. 요청 사항·완료 근거 칸은 PR #633 리뷰의 문장을 그대로 옮겼다.

| 후보 | 대응 T | 선행 계약 (합의 시점) | 담당 | 요청 사항 | 완료 근거 | 후속 handoff |
|---|---|---|---|---|---|---|
| B · transcript·작업 상태 | T02·T03·T04 잔여·T05·T06 잔여·T07·T11·T12 잔여·T16·T17·T18·T25 · 감사 memo 설계 항목(비교자 단순화·`reconcileSegments`·Work 캐시 대체·OpenCode memo 테스트 확장) | 안정적인 메시지·행 ID · 낙관적 발화 확정 · 페이지 앞삽입 규칙 — E 와 공동, 후속 구현 전 | Claude(비기능) | toolRunId 로 늦은 결과가 원래 카드에 돌아가게 한다. OpenCode 확정 head(B6)·Claude 첫 변경 탐색(B8)·Work 결과 수집(B9)을 각각 추적한다. 긴 턴 블록 가상화(B10)·긴 선택(B5)·Markdown 꼬리·하위 작업 상세 포함 | 확정 결과 한 건에서 무관한 과거 메시지 방문 수와 새 행 할당 수를 따로 측정한다. 가시 영역이 고정되면 화면 밖 카드가 늘어도 마운트 DOM 수가 늘지 않는다. 앞삽입 전후 선택·펼침·앵커 유지 | 미생성 |
| C · 워커·Git·코드·산출물 | T08·T14 잔여·T15 잔여·T22·T23·T27·T33(테마 재강조) | 공통 워커 요청 규약 — 문서 ID·revision·옵션 기반 캐시 키 · 취소·오래된 응답 폐기 · 가시 범위 응답, 후속 구현 전 | Claude(비기능) | T22(5만 추가 줄 → 5만 표시 행)를 별도 검증 대상으로 둔다. T33 의 테마 재강조(C)와 입력 높이 측정(D)은 소유자를 나눈다 | 5만 줄 Git 파일을 펼쳐도 R 은 보이는 행만 구성하고, 같은 조건에서 스트리밍·타이핑 지연을 전후 비교한다. 좌우 보기·리뷰 좌표·전체 복사 보존 | 미생성 |
| D · 컴포저·패널·목록·셸 | T20·T21 잔여·T24·T28·T29·T30·T31·T32·T33(입력 높이)·셸 3항목 | 호스트 질의 계약 결정은 그 계약을 바꾸는 T20·T28·T30 만(D-029) | Claude(비기능) | 측정 조건별로 나눈다 — 메뉴 · 첨부 인코딩·픽셀 상한 · 계획 댓글의 DOM 측정 · 설치 로그 · 목록·설정·차트 · 셸 동기 I/O | 다중 이미지 즉시 전송 · 긴 계획서 폭 드래그 · 로그 폭주를 각각 검증한다. 기존 상한으로 충분한 화면은 당시 입력 크기와 실측값을 남겨 현행 유지로 종결할 수 있다 | 미생성 |
| E · 세션 페이지 | T01 장기 | B 와 ID 계약 · D-023(OPEN — 이전 페이지 UX · 미로딩 이력 소비자 계약) | Claude(비기능) | 최신 페이지 · 이전 커서 · 거대 단일 본문 별도 인출(D-022). 첫 페이지 준비 후 한 번에 교체해 원자적 전환을 보존한다 | 같은 첫 페이지에서 과거 이력만 늘려도 첫 paint 전 전송·검증·조립량은 페이지 예산 안이다. 복구·검색 이동·작업 보드·취소·늦은 live 이벤트를 함께 재생한다 | 미생성 |
| W · Windows 검증 | Windows 통합 검증 · 0324 AC22·AC23·AC52′ | 기준선: 없음(AC19 가 수집 — D-024) · 판정: D-025 | 사람 | 기준선 수집과 허용치 결정을 분리한다. 0324 AC22·AC23·AC52′ 는 같은 실창 세션에서 수행하고 결과를 기존 소유 항목에도 기록한다(D-028) | Claude Code·Work·OpenCode 에서 스트리밍과 입력·스크롤을 겹쳐 전후 기록을 비교한다 | 기준선 = 0325 AC19 · 판정 미생성 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 빈 parts 메시지 200,000건 세션이 열린다 — 조립 결과의 개수·순서(`createdAt` 열)가 원본과 같고 `RangeError` 가 없다. 전송층은 한 조각에 200,000건이 와도 조립한다 | VP-01 좌표 둘 — 데이터 호스트 `deliver` 가 보낸 조각 수 400·조립 결과 `toEqual` 원본 · 전송층 `load()` 가 200,000건 단일 조각·400조각 두 입력에서 resolve(개수·`createdAt` 순서) | `sessionApi.load` → `createSessionLoadClient.load` → `oo:session:load` → `deliver` → `oo:session:load-chunk` → 구독 → `assembleSession` |
| R-01 | AT-01 / AC2 | 조각마다 메시지 ≤ 500 · part ≤ 500 · `estimateWireChars` ≤ 1,000,000 이다. 그 상한을 넘는 메시지 하나는 혼자 한 조각이고 빈 조각은 없다. 조각 수는 세 예산이 함께 정한다 — 빈 메시지 1,001건 → 3조각(500·500·1) · part 250 메시지 10건 → 5조각 · 약 400,000 단위 메시지 3건 → 2조각(2·1). 조각 끝을 찾는 측정은 남은 예산을 넘는 순간 멈춘다 | UT-01: `nextSessionChunkEnd` 분기마다 입력(§7-A VP-03 e1~e12) · part 400개 × 5,000자 메시지(2,000,000자) 측정이 읽는 part 수 < 400 | `deliver` → `nextSessionChunkEnd` → `estimateWireChars` |
| R-01 | AT-01 / AC3 | 0324 AC15(조립 = `loadSession`) · AC16(part ≤ 500·단독 조각) · AC17(취소·창 닫힘 뒤 미전송, 늦은 조각 폐기, 누락 거부) · D-045(로드 중 도착한 live 를 덮지 않음)가 그대로다 | REGRESSION — VP-04·VP-05 의 기존 테스트 좌표 | 같다 + `chatStore.loadSession` |
| R-02 | AT-02 / AC4 | OpenCode 에서 live 행이 이미 있을 때 text·reasoning delta 를 반영하면 — (과거 exchange, 현재 확정 assistant) = (100, 10) · (1,000, 100) · (10,000, 1,000) · (10,000, 10) 에서 — head·tail 투영 0회, 확정 `parts` 읽기 0회, `head.rows` 순회 0회, `useLiveText`·`useLiveReasoning` 호출 0회이고 live 행 본문은 마지막 text 다 | IT-02: `Timeline.memo.test.ts` 확장 — 투영 spy · parts getter 계수 · `head.rows` Proxy 계수 · 렌더 텍스트 | `receiveDeltaBatch` → `live` → `useLiveTextFor(true)` → `OpenCodeTextSegment` → `OpenCodeText` |
| R-02 | AT-02 / AC5 | 같은 messages·live 에서 행 순서·key·gap·streaming·segment 본문(접두 + live 합성)이 지금 투영과 같다 | UT-02: `projection.golden.json` 전 케이스 + `projection.test.ts` 입력 + 분기 b1~b9 입력이 문자열 래퍼 `projectTimeline` 으로 지금 기대값과 `toEqual` | `projectTimelineHead` → `projectTimelineTail(presence)` → `materializeTimelineRows` |
| R-02 | AT-02 / AC6 | 선택 보존·완료 전환 선택 유지·스크롤 캡처·자동 피드 토글·숨긴 reasoning 이 그대로다. live 행이 같은 key 의 확정 행으로 바뀔 때 행 컴포넌트 형이 같다 | REGRESSION VP-09 기존 좌표 + VP-07 자리 6·7 신규 선택 테스트(완료 전환에서 DOM 노드 동일) | `OpenCodeTimelineRow` → `OpenCodeTextSegment` |
| R-03 | AT-03 / AC7 | 과거 exchange N(100/1,000/10,000) 뒤 assistant 메시지 하나를 추가하면 앞 N−1개 exchange 와 마지막 exchange 의 바뀌지 않은 Turn 은 이전 결과와 같은 참조다. 재사용 exchange 의 파생 user 메시지(자동 피드 제외로 만든 객체)도 이전 참조다 | UT-03: `createExchangeGrouper` 두 번 호출 → `toBe` 단언 · 계수 | `ClaudeTranscriptView` → grouper → `Exchange`(memo) |
| R-03 | AT-03 / AC8 | 과거 k 번째 메시지가 새 객체가 되면 그 메시지가 든 exchange 부터 다시 묶고, k 가 exchange 의 첫 메시지(경계)면 직전 exchange 부터 다시 묶는다. 다시 묶은 exchange 중 내용이 같은 것은 이전 참조다. 옵션 변경·세션 전환(첫 메시지 다름)·축소는 전부 다시 묶는다. 결과는 언제나 전체 그룹화와 같다 — `[질문 A, 답변 A, 질문 B, 답변 B]` 에서 질문 B 가 자동 피드만 남아 숨으면 결과는 exchange 1개 `{startIndex 0: user[질문 A] · assistant[답변 A, 답변 B]}` 다 | UT-03 분기 g1~g11 입력 — 매 호출 결과를 `groupExchanges` 전체 결과와 `toEqual` 대조 + 참조 단언 · g8 은 기대 그룹·메시지 순서를 리터럴로 단언 | 같다 |
| R-03 | AT-03 / AC9 | Work 결과 귀속(늦은 결과는 원래 exchange, 무관 exchange 맵 참조 유지)이 그대로다 | REGRESSION VP-13 — `workToolResults.test.ts` 7케이스 · `workActivity.performance.test.ts` | `ClaudeTranscriptView` → `createWorkToolResultSelector` |
| R-03 | AT-03 / AC10 | ChatTile 이 같은 `activeKey` 로 다시 렌더되면 같은 `onRestoreSteerDraft` 참조를 넘기고, `activeKey` 가 바뀌면 새 참조다. Claude `Exchange` 는 그 함수만 바뀌어도 다시 렌더한다. 세션 A 의 함수는 전환 뒤에도 A 의 초안에 복원한다 | IT-03: `ChatTile.workLifetime.test.ts` 확장(TranscriptView props 포착) · `Exchange` 비교자 단언 | `ChatTile` → `TranscriptView` → `Exchange` → `PendingSteerTurn` → `chatActions.restoreComposerDraft` |
| R-04 | AT-04 / AC11 | 두 입력 문자 합이 64,000 을 넘으면 줄을 세지 않고 UI 스레드 diff 를 하지 않는다(`useDiffLines` → 워커, 머리 증감 `null`). 넘지 않으면 줄을 세되 합이 400 을 넘는 순간 멈춘다 | UT-05: `withinDiffCap` 분기 c1~c5 · `countLinesUpTo` 조기 중단 · 한 줄 5,000,000자 → jsdiff 0회 | `ToolCard`·`DiffBody` → `toolDiffStat`·`useDiffLines` → `inline.ts` |
| R-04 | AT-04 / AC12 | MultiEdit 수정들·OpenCode 파일들의 머리 증감은 합산 예산으로 판정한다 — 줄 합 ≤ 400 · 쌍 문자 합 ≤ 64,000 · patch 문자 합 ≤ 1,000,000. 넘으면 `null`. 50 × (200+200줄) MultiEdit 는 jsdiff 0회다 | UT-06: `toolDiffStat`·`fileChanges` 분기 a1~a6 | `ToolCard` 머리 · OpenCode 파일 카드 머리 → `diffStatsWithinBudget` |
| R-05 | AT-05 / AC13 | 결과 크기는 워커 응답의 `size` 로 받는다(renderer 가 결과를 순회하지 않는다). 크기가 캐시 상한을 넘거나 없는 결과는 요청자에게 가지만 캐시에 넣지 않고 기존 항목도 그대로다 | UT-07: `client.test.ts` 분기 k1~k4 · IT-04: 실제 `handleMessage` 응답을 가짜 워커가 돌려주는 왕복 | 소비자 → `computeClient().request` → 워커 `handleMessage` → `receive` → `writeCache` |
| R-06 | AT-06 / AC14 | 초안이 20,000자를 넘으면 장식 토큰화를 하지 않고 chip span 을 만들지 않는다. 20,000자 이하는 결과가 지금과 같고, 스킬 토큰 하나의 등록 집합 조회는 (가장 긴 등록 이름 길이 + 1)회 이하다 — 등록 `build` 에서 `/z` + 마침표 19,998개(20,000자) 초안은 조회 ≤ 6회. 구두점으로 끝나는 등록 스킬(`deploy.`·`v1.2`)과 뒤 구두점을 뗀 인식(`/build.)` → `/build`)은 그대로다 | UT-08: `tokenizeComposerDecoration` 20,001자 → `[]`·`matchAll` 0회 · 20,000자 → 지금 결과 · 조회 계수 집합(`has` 계수) · IT: `ComposerDecorationLayer` span 0 | `ComposerInputController` → `ComposerDecorationLayer` → `tokenizeComposerDecoration` |
| R-07 | AT-07 / AC15 | Claude 도구 카드 본문 복사·Claude assistant 턴 메타·공통 user 턴 메타는 렌더 중 복사 문자열을 만들지 않고 클릭 때 만든다. 복사 결과 문자열과 버튼 노출 조건은 지금과 같다 | IT-05: 세 컴포넌트 렌더 → `copyText`·`turnCopyText` 호출 0 → 클릭 → 1회·클립보드 문자열 `toBe` 기존 계산 · 텍스트 없는 턴 버튼 0 | `AssistantTurn`·`UserTurn`·`ToolCard` → `MessageMeta`·`CopyIconButton` |
| R-08 | AT-08 / AC16 | 끌기 중 `onChange` 는 프레임마다 최대 1회, 그 프레임의 마지막 값으로 불린다. mouseup 에 남은 값이 있으면 즉시 1회 반영하고 예약 프레임을 취소한다. 놓은 뒤에는 값이 바뀌지 않는다 | UT-09: 훅 렌더 + 가짜 rAF — 분기 r1~r6 | `Sidebar`·`ColumnSeparator`·`RowSeparator` → `useDragResize` → store |
| R-09 | AT-09 / AC17 | 썸네일을 만들지 못하면(로드 실패·canvas 없음·인코딩 실패·경로 읽기 실패) 그 뷰에 `previewDataUrl` 이 없다. `onSend` 가 받는 첨부 배열은 입력과 같은 참조·내용이다 | UT-10: `buildAttachmentViews` 분기 t1~t7 · `submitComposerInput` 의 첨부 참조 단언 | `submitComposerInput` → `buildAttachmentViews` → `downscaleDataUrl` → `onSend` |
| R-09 | AT-09 / AC18 | 한 전송의 썸네일 준비는 동시에 2개까지 돈다. 결과 뷰 순서는 입력 순서다 | UT-10 분기 t8 — 지연 해소 순서를 뒤섞은 5개 입력 → 동시 최대 2 · 순서 | 같다 |
| R-10 | AT-10 / AC19 | 같은 Windows 장비·같은 배율·같은 빌드 구성으로 `ee8ac81` 빌드와 단계 A 빌드에서 §19 시나리오 7개를 각각 재생한 기록이 verify 에 첨부된다 — 시나리오별 입력→paint p95·최대, 누락·연속 누락 프레임, React commit·layout 시간, `perf.stall` 수·최댓값. Claude Code·Work·OpenCode 각각에서 스트리밍과 입력·스크롤을 겹친다. 0324 AC22·AC23·AC52′ 를 같은 세션에서 수행하고 0324 항목에도 기록한다. 허용치 판정은 D-025 뒤 단계 W 가 한다 | 사람 실기 — §19 시나리오·측정 방법 | 설치본(`perf.stall`) · 같은 커밋의 진단 빌드(trace·Profiler) |

### AC 검증 주의사항

- 기존 테스트 재사용: §8 의 "기존 테스트 존재 확인" 줄에 케이스명을 실제로 확인했다.
- 사람 실기 항목: AC19 하나 — 실제 Chromium 프레임·Electron 프로세스가 관측 대상이고 이 환경은 Electron 바이너리를 받지 못한다(`app/AGENTS.md` 제약 환경). 순수 로직은 AC1~AC18 이 덮는다.
- N회/총량 기준: AC4 의 "0회"는 live 행이 이미 있는 상태의 delta 렌더에서 센다(첫 출현 렌더는 재투영 1회가 계약이다). 투영의 production 호출부는 `Timeline.tsx` 의 `useMemo` 2곳이 전부다(`rg -n "projectTimeline(Head|Tail)\(" src/renderer/src --glob '!*.test.ts'` → 6건 = Timeline 2 · 정의 2 · 테스트용 래퍼 `projectTimeline` 2).
- 총량/0건 기준: AC4 의 `head.rows` 순회 0회는 iterator·`slice`·`concat`·`map`·`entries` 를 센다. 가시 항목의 색인 읽기(`rows.at(i)`)는 허용 대상이다(가시 수에 묶임).

## 7-A. V / Trace Matrix

- V mode 판정: 상속할 구현 V 가 없어 `Baseline V` 다. 0324 의 노드는 REGRESSION 으로만 참조한다(0321 선례 — 0320 노드를 같은 방식으로 둠).
- 기준 V 상속 근거: 없음. 0324 노드는 `0324:V1 rev 4.9@22a6d06` 출처의 INHERITED 노드로 둔다.
- `SUPERSEDED`로 분해한 pair의 AC·선택 적대 증거 이관: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 AC1·AC2 — 세션 열기 조각 상한·안전 조립 | NEW | — |
| AT-01 | AT | §7 AC1·AC2 | NEW | — |
| AR-01 | AR | §10 EP-1 — 데이터 호스트 `deliver` ↔ 전송층 조립의 조각 계약 | NEW | — |
| MD-01 | MD | §10 EP-1 — `nextSessionChunkEnd`·`estimateWireChars`·`assembleSession` | NEW | — |
| R-0324-05 | R | 0324 §7 AC15·AC16·AC17 | INHERITED | 0324:V1 rev 4.9 R-05 / AT-15·AT-16·AT-17 |
| SD-0324-45 | SD | 0324 D-045 — 진행 중 캐시 세션을 로드 결과로 덮지 않음 | INHERITED | 0324:V1 rev 4.9 D-045 · `chatStore.native-history.test.ts` |
| R-02 | R | §7 AC4·AC5 — OpenCode live 독립·행 동치 | NEW | — |
| AT-02 | AT | §7 AC4·AC5·AC6 | NEW | — |
| AR-02 | AR | §10 EP-2 — Timeline ↔ store 구독 경계 · 행 리프 · 행 색인 | NEW | — |
| MD-02 | MD | §10 EP-2 — `projectTimelineTail(presence)`·`materializeTimelineRows`·`timelineRows` | NEW | — |
| AR-OC-SEL | AR | OpenCode 선택 보존·완료 전환 Markdown 모드·스크롤 캡처 | INHERITED | 기존 테스트(§8) — 상속 V 없음 |
| R-03 | R | §7 AC7·AC8·AC10 — Claude 증분 그룹화·steer 콜백 | NEW | — |
| AT-03 | AT | §7 AC7~AC10 | NEW | — |
| MD-03 | MD | §10 EP-3 — `createExchangeGrouper` | NEW | — |
| AR-03 | AR | §10 EP-3b — ChatTile → TranscriptView → Exchange 의 steer 콜백 | NEW | — |
| MD-WORK | MD | Work 결과 귀속(`createWorkToolResultSelector`) | INHERITED | 기존 테스트(§8) — 상속 V 없음 |
| R-04 | R | §7 AC11·AC12 — diff 입력 상한 | NEW | — |
| AT-04 | AT | §7 AC11·AC12 | NEW | — |
| MD-05 | MD | §10 EP-4 — `withinDiffCap`·`countLinesUpTo`·`diffStatsWithinBudget` | NEW | — |
| MD-06 | MD | §10 EP-4 — 소비처 `toolDiffStat`·`fileChanges` | NEW | — |
| R-0324-04 | R | 0324 §7 AC10·AC11·AC12·AC14 | INHERITED | 0324:V1 rev 4.9 R-04 / AT-10·AT-11·AT-12·AT-14 |
| R-05 | R | §7 AC13 — 계산 캐시 크기·과대 결과 | NEW | — |
| AT-05 | AT | §7 AC13 | NEW | — |
| MD-07 | MD | §10 EP-5 — `writeCache`·`parseResponse` | NEW | — |
| AR-04 | AR | §10 EP-5 — client ↔ 워커 응답 `size` | NEW | — |
| R-06 | R | §7 AC14 — 컴포저 장식 상한 | NEW | — |
| AT-06 | AT | §7 AC14 | NEW | — |
| MD-08 | MD | §10 EP-6 — `tokenizeComposerDecoration` 상한 | NEW | — |
| AR-CMP-IME | AR | 장식 층의 IME·scroll 투영 | INHERITED | 기존 테스트(§8) — 상속 V 없음 |
| R-07 | R | §7 AC15 — 복사 지연 | NEW | — |
| AT-07 | AT | §7 AC15 | NEW | — |
| AR-05 | AR | §10 EP-7 — 세 컴포넌트 → 지연 복사 문자열 | NEW | — |
| R-08 | R | §7 AC16 — 끌기 프레임 병합 | NEW | — |
| AT-08 | AT | §7 AC16 | NEW | — |
| MD-09 | MD | §10 EP-8 — `useDragResize` | NEW | — |
| R-09 | R | §7 AC17·AC18 — 썸네일 | NEW | — |
| AT-09 | AT | §7 AC17·AC18 | NEW | — |
| MD-10 | MD | §10 EP-9 — `downscaleDataUrl`·`buildAttachmentViews` | NEW | — |
| R-10 | R | §7 AC19 — Windows 전후 기록 | NEW | — |
| AT-10 | AT | §7 AC19(사람) | NEW | — |

### Pair registry

규칙 칸의 분기 이름(b·g·c·a·k·d·y·r·t·e)은 §10 표의 같은 기호와 1:1 이다.

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | `oo:session:load` 요청 → `deliver` → 조각 통지 → 전송층 구독 → `assembleSession` → `load()` resolve | 신규 `main/app/data-host/session-load.bounds.test.ts:'빈 parts 200,000건은 조각 400개로 가고 조립 결과가 원본과 같다'`(리더 mock·`invokeChannel`·`fakeClient().sent`) · 신규 `renderer/src/shared/api/transport/session-load.test.ts:'200,000건을 한 조각·400조각으로 받아도 순서대로 조립한다'` | not selected — 직접 행동 단언(개수·순서·예외 없음) | EP-1 (10) |
| VP-02 | AR-01 ↔ IT-01 | REQUIRED | `deliver` 반복: 양보 → `nextSessionChunkEnd` → `client.send` → 머리 `chunked` | 같은 신규 `session-load.bounds.test.ts` — 자리 7: `'양보 뒤에만 다음 조각을 잰다 — 조각 1 뒤 취소면 조각 2 의 메시지를 읽지 않는다'`(parts getter 계수·`yieldTurn` 주입) · 자리 8: `'머리의 조각 수·메시지 수는 보낸 조각의 합이다'` | required — 자리 7 에 "측정을 양보 앞으로 옮김" 변이(취소 뒤 조각 2 읽기 > 0 이어야 red) | EP-1 자리 7·8·10 (3) |
| VP-03 | MD-01 ↔ UT-01 | REQUIRED | `nextSessionChunkEnd(messages, start)` → 비교 3종 → 단독 진행 → `estimateWireChars` 조기 반환 · `assembleSession` | `shared/data-host.test.ts` 신규 케이스 — e1 메시지 501번째 새 조각 · e2 part 합 501 새 조각 · e3 문자 예산 초과 새 조각 · e4 part 700 단독 · e5 문자 1,500,000 단독 · e6 빈 입력·`start = length` · e7 메시지 500·part 500·문자 = 예산 꼭 맞음은 같은 조각 · e8 part 400 × 5,000자 메시지 측정이 읽는 part 수 < 400(parts Proxy)·단독 · e9 `assembleSession` 200,000건 단일 조각 · e10 빈 메시지 1,001건 → 조각 크기 [500, 500, 1] · e11 part 250 메시지 10건 → 5조각 각 2건 · e12 약 400,000 단위 메시지 3건 → [2, 1]. 경계 입력은 `estimateWireChars` 의 실제 값으로 만든다(테스트가 규칙을 다시 구현하지 않는다) | required — 자리 1·2·3 각각 "비교 제거" 변이(e1·e2·e3 이 red) · 자리 9 "spread 복귀" 변이(e9 red) | EP-1 자리 1~6·9 (7) |
| VP-04 | R-0324-05 ↔ AT | REGRESSION | 0324 AC15~AC17 경로 그대로 | `main/app/data-host/session-load.test.ts:'조각 1 뒤에 취소하면 조각 2 부터 보내지 않고 취소로 답한다'` · `:'창 포트가 닫히면 남은 조각을 보내지 않는다'` · `:'조각 사이마다 한 번 양보하고, 첫 조각 앞에서는 양보하지 않는다'` · describe `'세션 본문은 조각으로 가고 조립 결과는 \`loadSession\` 과 같다 (AC15)'` · `renderer/src/shared/api/transport/session-load.test.ts:'취소하면 번호를 실어 통지하고, 그 요청의 늦은 조각을 버리며, 다른 요청은 정상이다'` · `:'조각이 빠진 응답은 거부한다 — 일부만 조립한 본문을 돌려주지 않는다'` · `:'끝난 요청의 번호로 온 조각은 다음 요청에 섞이지 않는다'` · `shared/data-host.test.ts` describe `'세션 조각 분할'` 기존 9케이스 | not selected — 기존 행동 단언 | EP-1 공유 |
| VP-05 | SD-0324-45 ↔ ST | REGRESSION | `chatStore.loadSession` → 응답 반영 판정 | `chatStore.native-history.test.ts:'finishes the loading state without replacing live data that arrived during a cold load'` · `:'keeps the cached screen during IPC and refreshes history without resetting model or panel state'` | not selected | 0 — 이번 변경이 이 판정 자리를 건드리지 않는다(EP-1 은 전송층까지) |
| VP-06 | R-02 ↔ AT-02 | REQUIRED | `receiveDeltaBatch` → `live.text` → `useLiveTextFor(true)` → `OpenCodeTextSegment` → `OpenCodeText` | `Timeline.memo.test.ts` 신규 `'re-renders only the live leaf for deltas once the live row exists, at every history size'` — (과거 exchange, 현재 확정 assistant) = (100,10)·(1,000,100)·(10,000,1,000)·(10,000,10), 투영 spy 0 · parts getter 0 · `head.rows` Proxy 순회 0 · `useLiveText`·`useLiveReasoning` mock 호출 0 · 렌더 텍스트 `'12345'` | not selected — 직접 계수 | EP-2 공유 |
| VP-07 | AR-02 ↔ IT-02 | REQUIRED | store `live` → 유무·본문 선택자 → `OpenCodeTimeline` 구독(유무 2) → tail 메모 → `timelineRows` → 가상 항목 → `OpenCodeTimelineRow` → `OpenCodeTextSegment` | 자리 2·3: 신규 `store/chatStore.liveSelectors.test.ts:'reports live presence and gated live text from the real store'`(fake DOM 하네스 + 실제 store, `useChatStore.setState` 로 live 를 `''`·`'a'`·`'  '`·`' x'` 로 바꿈 → 탐침 컴포넌트 출력) · 자리 4·5: VP-06 좌표(유무 변화 1회 = 투영 1회, 같은 유무 = 0회 · virtualizer mock 이 가시 범위의 `getItemKey`·`estimateSize` 를 부른다) · 자리 6·7: 신규 `Timeline.selection.test.ts:'keeps the same row component when a live row becomes the committed row of the same key'`(DOM 노드 동일성) | required — 자리 6 "live 행만 다른 컴포넌트로" 변이(같은 노드 단언 red) · 자리 4 "Timeline 이 `useLiveText` 직접 구독" 변이(VP-06 의 mock 호출 0 이 red) · 자리 3 `enabled` 무시 변이(탐침의 `useLiveTextFor(false)` 가 `''` 아님 → red) | EP-2 자리 2~7 (6) |
| VP-08 | MD-02 ↔ UT-02 | REQUIRED | `projectTimelineTail(head, presence)` 분기 b1~b9 → `materializeTimelineRows` · 판정 정본 `hasSegmentText`·`hasSegmentReasoning` | `projection.golden.test.ts:'matches original keys, gaps, tools, artifacts and incomplete rows %#'`(전 케이스, 문자열 래퍼) · 갱신 `:'keeps head rows and indexed positions stable as only the live tail changes, without eager copy text'`(presence 고정·text 만 변경 → tail 재투영 없이 index 안정) · 신규 `projection.test.ts` describe `'presence tail ≡ string tail'` b1~b9 각 1케이스 · 자리 1: `parts.test.ts` 신규 `'segment text/reasoning visibility is the single rule'`(`''`·`' '`·`'x'` 입력) | required — b1(병합)·b2(새 행) 판정 맞바꿈 변이 · 자리 1 `hasSegmentReasoning` 을 `!== ''` 로 바꾸는 변이(b5 red) | EP-2 자리 1·8·9·10 (4) |
| VP-09 | AR-OC-SEL ↔ IT | REGRESSION | 선택·스크롤 경로 그대로 | `Timeline.selection.test.ts:'keeps selected live content on completion, then resolves complete Markdown when selection clears'` · `ScrollController.interaction.test.ts:'captures the latest scroll once per frame and cancels the queued capture on unmount'` · `:'keeps jump-to-bottom pinned when an external click releases over a retained selection, then follows output'` · `projection.test.ts` 기존 케이스 전부 | not selected | EP-2 공유 |
| VP-10 | R-03 ↔ AT-03 | REQUIRED | `ClaudeTranscriptView` → `createExchangeGrouper` → `Exchange` · `ChatTile` → `onRestoreSteerDraft` | 신규 `turns.test.ts` describe `'createExchangeGrouper'`(AC7·AC8 단언) · VP-12 좌표(AC10) | not selected | EP-3·EP-3b 공유 |
| VP-11 | MD-03 ↔ UT-03 | REQUIRED | grouper 호출 → 즉시 반환 / 첫 변경 지점 → 재사용 수 → 재그룹 → 동치 복원 | 신규 `turns.test.ts` describe `'createExchangeGrouper'` — g1 같은 배열 → 같은 결과 참조 · g2 끝 추가 · g3 마지막 교체 · g4 중간 교체(뒤 exchange 동치 복원) · g5 옵션 변경 · g6 다른 세션 · g7 경계에 user 추가 · g8 `[질문 A, 답변 A, 질문 B, 답변 B]` → 질문 B 를 자동 피드만 가진 새 객체로 교체 → 결과 리터럴 `[{ startIndex: 0, turns: [user[질문 A], assistant[답변 A, 답변 B]] }]` · g9 선두 assistant exchange 안 변경 · g10 재그룹 exchange 안 바뀌지 않은 Turn 참조 · g11 경계 메시지를 보이는 user 그대로 교체 → 직전 exchange 도 다시 묶지만 동치 복원으로 이전 참조. 매 케이스 결과 `toEqual(groupExchanges(...))` | required — 자리 3 재사용 비교 `<`→`≤` 변이(g8 red) · 자리 6 동치 복원 제거 변이(g4·g10·g11 red) | EP-3 (7) |
| VP-12 | AR-03 ↔ IT-03 | REQUIRED | `ChatTile` 렌더 → `TranscriptView` props → `Exchange` 비교자 → `PendingSteerTurn` → 복원 | 신규 `ChatTile.workLifetime.test.ts:'passes a stable steer-restore callback per active session and rebinds it on switch'`(TranscriptView mock props 포착 → 같은 키 두 렌더 `toBe`, 키 변경 `not.toBe`, 호출 → `chatActions.restoreComposerDraft(키, 텍스트)`) · 신규 `Exchange` 비교자 단언 `'re-renders when only the steer-restore callback changes'` | required — 자리 1 의존성 배열 `[]` 변이 · 자리 2 비교 항 제거 변이 | EP-3b (6) |
| VP-13 | MD-WORK ↔ UT | REGRESSION | `createWorkToolResultSelector` 그대로 | `workToolResults.test.ts` describe `'Work session tool results by owning exchange'` 7케이스 · `workActivity.performance.test.ts:'measures 100 old exchanges plus 100 completed current messages over 100 tail updates'` | not selected | 0 — 선택기 코드는 바뀌지 않는다(D-018) |
| VP-14 | R-04 ↔ AT-04 | REQUIRED | `ToolCard` 머리 · `DiffBody` → `toolDiffStat`·`useDiffLines` → `inline.ts` | VP-15·VP-16 좌표 + 신규 `useDiffLines` 단언 `'routes a 64,001-char single-line pair to the worker'`(가짜 계산 클라이언트 요청 1회) | not selected | EP-4 공유 |
| VP-15 | MD-05 ↔ UT-05 | REQUIRED | `withinDiffCap` → 문자 합 → `countLinesUpTo` → jsdiff | `inline.test.ts` 신규 — c1 64,001자 1줄 → false·줄 세기 0(`diffModel.countLinesUpTo` spy) · c2 64,000자 400줄 → true · c3 `countLinesUpTo(1,000줄, 400)` → 401(조기 중단)·`withinDiffCap` 401줄 → false · c4 64,000 정확히 → 문자 통과 · c5 빈 둘 → true · 한 줄 5,000,000자 `diffLinesWithinCap` → `null` | required — 자리 3 문자 검사 제거 변이(c1 red) · 자리 2 조기 중단 제거 변이(c3 의 반환 401 단언 red) | EP-4 자리 1~5 (5) |
| VP-16 | MD-06 ↔ UT-06 | REQUIRED | `toolDiffStat`·`fileChanges` → `diffStatsWithinBudget` | `toolMeta.test.ts` 신규 — a1 합 안 → 합계 · a2 수정마다 200줄 × 3 → `null` · a3 쌍 문자 합 64,001 → `null` · a4 수정 0개 → `{0,0}` · `filePresentation.test.ts` 신규 — a5 patch 문자 합 1,000,001 → `null` · a6 쌍 + patch 섞임 합 안 → 합계 · 50 × (200+200줄) MultiEdit → jsdiff 0회(`vi.mock('diff')` 통과 spy — 동작은 원본 그대로) | required — 자리 6 MultiEdit 를 수정별 판정으로 되돌리는 변이(a2 red) · 자리 7 patch 합 제거 변이(a5 red) | EP-4 자리 6·7 (2) |
| VP-17 | R-0324-04 ↔ AT | REGRESSION | 0324 AC10 경로 | `inline.test.ts` describe `'diffLinesWithinCap'`·`'diffStatWithinCap'`·`'countLines'`·`'parsePatchWithinCap'` 기존 케이스 · `toolMeta.test.ts` 기존 401 케이스 | not selected | EP-4 자리 8 (1) — 나머지 자리는 공유 |
| VP-18 | R-05 ↔ AT-05 | REQUIRED | 소비자 → `request` → 워커 → `receive` → `writeCache` | VP-19·VP-20 좌표 | not selected | EP-5 공유 |
| VP-19 | MD-07 ↔ UT-07 | REQUIRED | `receive` → `writeCache(key, result, size)` | `client.test.ts` 신규 — k1 size ≤ 상한 → 캐시·LRU 그대로 · k2 size > 상한 → 요청자 resolve·`peek` undefined·기존 항목 유지 · k3 size 없음/음수/NaN → resolve·미보관 · k4 실행 중 취소 뒤 늦은 응답 size > 상한 → 미보관 | required — 자리 4 상한 비교 제거 변이(k2 red) · 자리 3 size 대신 0 을 넘기는 변이(k2 red) | EP-5 자리 2~5 (4) |
| VP-20 | AR-04 ↔ IT-04 | REQUIRED | 가짜 워커 → 실제 `handleMessage(diffLines)` → `receive` | 신규 `client.test.ts:'caches by the size the worker computed, without measuring on the UI thread'` — 가짜 워커가 실제 `handleMessage` 를 부르고, `protocol.resultSize` spy 호출이 총 1회(워커 처리기)·캐시 항목 크기 = 그 반환값 | not selected | EP-5 자리 1 (1) |
| VP-21 | R-0324-04 ↔ AT | REGRESSION | 0324 AC11·AC12·AC14 | `client.test.ts` describe `'캐시 (AC14)'`·`'취소 (AC11)'`·`'실패 (AC12)'` 기존 케이스 | not selected | EP-5 공유 |
| VP-22 | R-06 ↔ AT-06 | REQUIRED | `ComposerDecorationLayer` → `tokenizeComposerDecoration` | VP-23 좌표 + 신규 `ComposerDecorationLayer.test.ts:'renders no decoration spans for a draft over the cap'` | not selected | EP-6 공유 |
| VP-23 | MD-08 ↔ UT-08 | REQUIRED | 토큰화 첫 줄 상한 → 정규식 3종 → 스킬 토큰 끝 구두점 다듬기(후보 상한 = 최장 등록 이름 + 1) | `composerDecoration.test.ts` 신규 — d1 20,001자 → `[]`·`String.prototype.matchAll` spy 0 · d2 20,000자(`/build @file.ts ` 1,250회) → chip 2,500 · d3 빈 문자열 → `[]` · d4 등록 `{build}` · `/z` + 마침표 19,998개 → chip 0 · 조회(`has` 계수 집합) ≤ 6 · d5 등록 `{deploy., v1.2, build}` · `/deploy.` `/deploy..` `/v1.2.` `/build.)` → chip `/deploy.`·`/deploy.`·`/v1.2`·`/build` · d6 등록 이름 최장 64 · 20,000자 토큰 반복 → 조회 ≤ 토큰 수 × 65 · d4~d6 의 chip 결과는 현행 함수 결과와 같다(§8 V5 표본을 입력으로 쓴다) | required — 자리 2 비교 `>`→`>=` 변이(d2 red) · 상한 검사 제거 변이(d1 red) · 자리 4 후보 상한 제거 변이(d4 조회 계수 red) · 자리 4 끝 문자 집합에서 `.` 제거 변이(d5 red) | EP-6 (4) |
| VP-24 | AR-CMP-IME ↔ IT | REGRESSION | 장식 층 그대로 | `ComposerDecorationLayer.test.ts:'한글 IME 조합 중에도 마지막 skill decoration을 숨기지 않는다'` · `:'decoration을 독립 scroll container가 아닌 viewport projection으로 렌더한다'` · `:'textarea와 decoration이 같은 scrollbar gutter를 사용한다'` | not selected | EP-6 공유 |
| VP-25 | R-07 ↔ AT-07 | REQUIRED | 세 컴포넌트 → `MessageMeta`·`CopyIconButton` → 클릭 → 클립보드 | VP-26 좌표 + `CopyIconButton.lazy.test.ts:'computes copy text only on click and forwards the exact string to the clipboard'`(REGRESSION 겸) | not selected | EP-7 공유 |
| VP-26 | AR-05 ↔ IT-05 | REQUIRED | `AssistantTurn`·`UserTurn`·`ToolCard` 렌더 → 지연 함수 | 신규 `AssistantTurn.copy.test.ts`·`UserTurn.copy.test.ts`·`ToolCard.interaction.test.ts` 케이스 — y1 텍스트 턴: 렌더 중 spy 0 → 클릭 → 1회·문자열 동일 · y2 도구만·공백·자식 텍스트 턴: 버튼 0 · y3 연 도구 카드: 렌더 중 `copyText` 0 → 클릭 1 | required — 자리 2 에 `copyable` 대신 `true` 고정 변이(y2 red) · 자리 1 즉시 계산 복귀 변이(y3 red) | EP-7 (4) |
| VP-27 | R-08 ↔ AT-08 | REQUIRED | 세 소비처 → `useDragResize` → `onChange` | VP-28 좌표 | not selected | EP-8 공유 |
| VP-28 | MD-09 ↔ UT-09 | REQUIRED | mousedown → mousemove → 프레임 → `onChange` / mouseup → 반영·해제 | 신규 `shared/hooks/useDragResize.test.ts` — r1 한 프레임 3회 이동 → 1회·마지막 값 · r2 두 프레임 → 2회 · r3 mouseup 대기 값 → 즉시 1회·예약 취소 · r4 이미 반영 뒤 mouseup → 추가 0 · r5 mouseup 뒤 프레임 진행 → 0 · r6 `disabled` → 리스너 0 | required — 자리 1 에서 직접 `onChange` 복귀 변이(r1 red) · 자리 3 flush 제거 변이(r3 red) | EP-8 (4) |
| VP-29 | R-09 ↔ AT-09 | REQUIRED | `submitComposerInput` → `buildAttachmentViews` → `onSend` | VP-30 좌표 + 신규 `composerSubmit.test.ts:'sends the original attachment array even when a thumbnail fails'` | not selected | EP-9 공유 |
| VP-30 | MD-10 ↔ UT-10 | REQUIRED | `buildAttachmentViews(items, deps)` → 동시 상한 → `downscale` → 뷰 | 신규 `lib/attachmentViews.test.ts` — t1 성공 → 썸네일 · t2 `load` 실패 · t3 `canvas` 실패 · t4 `encode` 실패 → 미리보기 없음 · t5 비이미지 → `downscale` 0 · t6 경로 읽기 실패 → 미리보기 없음 · t7 성공 뷰의 미리보기가 원본 data URL 이 아님 · t8 5개 → 동시 최대 2·순서 유지 · `imageThumb.test.ts` 신규 — 실패 3갈래가 `{ ok:false }`(가짜 Image·canvas 주입) | required — 자리 2 실패를 원본 반환으로 되돌리는 변이(t2~t4 red) · 자리 3 상한 제거 변이(t8 red) | EP-9 (5) |
| VP-31 | R-10 ↔ AT-10 | REQUIRED | 같은 장비·구성의 두 빌드 × 시나리오 7개 × 하네스 3(Claude Code·Work·OpenCode) | 사람 실기 — §19 시나리오·측정 방법 · 기록 표(시나리오 × 빌드 × 지표 5) | not selected | 0 — 사람 실기 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app 로컬 확인 전부 | `app/**` 소스·테스트를 바꾼다 | `app/AGENTS.md` "로컬 확인" 목록 — 마이그레이션·문서 인벤토리·제품 이름·테스트 예산·프로세스 경계 가드 · lint · typecheck · 파일 필터 없는 vitest · `node --test scripts/*.test.mjs` · 빌드 + 두 스모크 | 이번 변경이 만든 실패 · 추가·수정 테스트 파일의 규칙 가드 위반 |
| 문서 링크·인벤토리 | `docs/IPC_CONTRACT.md`·`docs/arch/frontend/rendering.md`·`INDEX.md` 를 고친다 | `node scripts/check-doc-inventory.mjs --check` | 같다 |
| 커밋 trailer 파싱 | 메시지 버스 | `git log -1 --format='%(trailers:only=true)'` | 같다 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

### 재현·측정 (이번 세션, Linux · Node v22.23.5 · esbuild 번들로 실제 소스 함수 호출 · 1회 예열 후 9회)

| ID | 입력 | 관측 | 감사 대비 |
|---|---|---|---|
| R1 | 빈 parts 메시지 200,000건 → `splitSessionMessages` → `assembleSession` | 조각 1개(200,000건) · `RangeError: Maximum call stack size exceeded`. `push(...arr)` 120,000건 성공 · 150,000건 실패 | 같음 |
| R2 | 추가 줄 50,000 → `patchLinesToDiffLines` → `buildDiffHunks(3)` | 50,000행 · 중앙값 13.8ms(7.8–28.7) | 감사 44.3ms |
| R3 | `/build @file.ts ` × 25,000 = 400,000자 → `tokenizeComposerDecoration` | chip 50,000(조각 100,000) · 중앙값 20.0ms(19.3–32.5) | 감사 52.6ms |
| R4 | 과거 100/1,000/10,000 exchange 뒤 assistant 1건 추가 → `groupExchanges` | 내용 같은 새 객체 99/999/9,999 | 같음 |
| R5 | OpenCode head 고정 · live 만 변경 | `head.rows` 297/2,997/29,997 · 확정 assistant 10/100/1,000 뒤 delta 1회의 parts 읽기 10/100/1,000 | 같음 |
| M1 | `structuredClone`(포트 전송과 같은 알고리즘) | 1,000,000자·500건 1.04ms · 1,000,000자·5,000건 4.52ms · 빈 500건 0.14ms | — |
| M2 | 한 줄 5,000,000자 두 입력 | `withinDiffCap` true(400줄 통과) · `diffLinesWithinCap` 6.52ms | — |
| M3 | 64,178자·400줄 전부 다른 두 입력 | `diffLinesWithinCap` 4.72ms(최대 7.94) | **SUPERSEDED → V4** — 입력이 상한(64,000)을 넘었고 중앙값은 상한이 아니다(PR #633 P2) |
| M4 | MultiEdit 수정 1/10/50개 × (200+200줄) → `toolDiffStat` | 2.19 / 18.48 / 94.91ms | — |
| M5 | 20,000자·40,000자 `/build @file.ts ` 반복 → `tokenizeComposerDecoration` | 1.27ms(조각 5,000) · 1.48ms(조각 10,000) | **최악 입력이 아니었다 → V1** |

재현 스크립트는 저장소에 두지 않았다(스크래치). 같은 수치는 구현 턴의 UT 가 계수 단언으로 다시 잡는다(시간 단언은 두지 않는다 — 환경 의존).

### PR #633 리뷰 지적 검증 (rev 2 · 같은 환경 · 실제 소스 함수 + 시제작)

| ID | 지적 | 입력 | 관측 | 판정 |
|---|---|---|---|---|
| V1 | P1 · WU-6 | 등록 `{build}` · `/z` + 마침표 19,998개(20,000자) → 현행 `tokenizeComposerDecoration` | 등록 집합 조회 20,000회 · 5회 중앙값 174.8ms(172.3–179.2). 리뷰는 193.5–206.6ms | 재현 — 끝 문자를 하나씩 자르며 조회해 토큰 길이의 제곱 → D-026 |
| V2 | P1 · WU-3 g8 | `[질문 A, 답변 A, 질문 B, 답변 B]` → 질문 B 를 자동 피드만 가진 객체로 교체 | 전체 그룹화 `{0: user[질문 A] · assistant[답변 A, 답변 B]}`. rev 1 규칙(`≤`) 시제작은 다른 결과, `<` 시제작은 같은 결과 | 재현 — 경계 메시지가 숨으면 경계가 사라진다 → D-027 |
| V3 | P2 · §14 조각 수 | part 250 메시지 10건 → 현행 `splitSessionMessages` | 5조각. rev 1 §14 식 `⌈10/500⌉ + 0` = 1 | 재현 — 식이 part·문자 예산을 빠뜨렸다 → §14 정정 · e10~e12 |
| V4 | P2 · M3 | 정확히 64,000자·400줄 전부 다른 두 입력 → `diffLinesWithinCap` · 64,001자 · TO-BE 판정(문자 우선 → 줄 조기 중단) 시제작 | 현행: 31회 중앙값 3.88ms · 최대 6.24ms, 64,001자도 `withinDiffCap` `true`(줄만 본다). TO-BE 시제작: 64,000자 분기 중앙값 3.93ms·최대 6.76ms(결과 = 현행) · 64,001자 분기 최대 0.002ms · 한 줄 5,000,000자 ×2 분기 최대 0.000ms | 관측 최대값이지 보장 상한이 아니다(입력 꼴·장비 의존). 64,001자 분기의 jsdiff 0회는 시간 대신 VP-15 c1 계수로 잠근다 |
| V5 | D-026 시제작 | 후보 상한 판정 vs 현행 — 표본 11건(`/build.` · `/build...)` · `/deploy.` · `/deploy..` · `/v1.2` · `/v1.2.` · `/z`+마침표 50 · `/a.b.c` · `/:` · 혼합 2토큰 등) | 불일치 0 · V1 입력 조회 5회·31회 중앙값 0.104ms·최대 0.779ms · 최장 이름 64·토큰 303개(19,998자) 조회 16,665회·중앙값 0.927ms·최대 1.332ms | 결과 동일·비용 선형 — 구현 턴이 실제 코드로 다시 잰다 |

### 발견 / 제약

| 발견 / 제약 | 근거 |
|---|---|
| 조각 분할은 part 합만 센다 — part 0 메시지는 상한에 닿지 않는다 | `shared/data-host.ts:44-63` |
| 조립은 조각마다 `messages.push(...chunk.messages)` | `shared/data-host.ts:83` |
| 데이터 호스트는 전체 조각 배열을 먼저 만들고 보낸다(양보는 조각 사이) | `main/app/data-host/session-load.ts:73-83` |
| 세션 경로의 인자 펼침 중 세션 크기에 비례하는 것은 조립 1곳이다. 나머지는 상한에 묶인다(`diffDisplay.ts:37` ≤ `MAX_PATCH_FILE_LINES` 50,000 · OpenCode `retained` ≤ 2) | 아래 전수 S12 · `git-diff-parse.ts:212` · `ScrollController.tsx:148-157` |
| OpenCode Timeline 이 live 두 값을 구독하고 tail 메모가 그 값에 의존한다 | `Timeline.tsx:34-50` |
| tail 투영이 현재 exchange 의 확정 parts 를 `flatMap` 한 뒤 live part 를 붙여 `messageSegments` 로 다시 자른다 | `projection.ts:87-89` |
| `messageSegments` 는 연속 text 를 한 segment 로 합치고 빈 text·공백 reasoning 을 건너뛴다 | `parts.ts:563-574` |
| head 가 없을 때 live text 행(`initial:text`)은 `pending` 과 무관하게 text 로만 정한다 | `projection.ts:138-146` |
| OpenCode 스크롤 따라가기는 콘텐츠 `ResizeObserver` 로 동작한다(Timeline 재렌더에 기대지 않는다) | `ScrollController.tsx:186-188` |
| fake 렌더 하네스는 늘 루트부터 다시 그리고(bailout 없음) `useMemo` deps·rAF·`useSyncExternalStore` 를 흉내 낸다 | `renderHarness.testfixture.ts:7-9` · `:270-279` |
| Claude Timeline 은 렌더마다 `groupExchanges` 전체(messages·옵션 deps) | `claude/transcript/Timeline.tsx:36-39` |
| `visibleMessage` 는 자동 피드 text 를 뺀 user 메시지를 새 객체로 만든다 | `turns.ts:12-24` |
| `Exchange` 비교자는 `onRestoreSteerDraft` 를 비교하지 않는다 | `Exchange.tsx:76-85` |
| ChatTile 이 렌더마다 `onRestoreSteerDraft` 람다를 만든다 | `ChatTile.tsx:146-148` |
| 인라인 diff 상한은 줄 수만 본다(`countLines` 전체 스캔) | `inline.ts:9-11` · `diffModel.ts:58-63` |
| MultiEdit·OpenCode 파일 머리 증감은 항목마다 상한을 보고 합에는 상한이 없다 | `toolMeta.ts:198-211` · `filePresentation.ts:20-35` |
| patch 단건 파싱 상한 1,000,000 은 0324 에서 실측했다(1.30MB 10ms) | 0324 plan B8 |
| 캐시 기록이 renderer 에서 결과를 순회해 크기를 세고, 새 키에서 축출을 멈춘다 | `client.ts:106-118` · `protocol.ts:86-90` |
| 장식 층은 초안 전체를 토큰화하고 조각마다 span 을 만든다 | `ComposerDecorationLayer.tsx:28-66` |
| 스킬 토큰의 끝 구두점은 `while (!has(slice(1)) && /[.,!?;:)\]}]$/.test(text)) text = text.slice(0, -1)` 로 한 글자씩 자른다 — 조회·정규식이 토큰 길이만큼 반복된다 | `composerDecoration.ts:23-29` · §8 V1 |
| 복사 버튼은 지연 문자열을 이미 받는다 | `CopyIconButton.tsx:7` · `:21` |
| `hasPartsText` 는 "본문 text part 중 공백 아닌 것" — `turnCopyText(turn) !== ''` 와 같은 값이다(문자열 합의 공백 여부는 구성원 중 하나의 공백 여부와 같다) | `parts.ts:62-70` · `turns.ts:99-104` |
| 끌기 훅 소비처는 셋이다 | `Sidebar.tsx:65` · `PanelResizeSeparators.tsx:61` · `:85` |
| 썸네일은 DOM canvas 에서 만들고 실패 3갈래가 원본을 돌려준다 | `imageThumb.ts:17` · `:24` · `:27` |
| `onSend` 는 `buildAttachmentViews` 와 같은 `items` 배열을 받는다 | `composerSubmit.ts:40-41` |
| `limits.ts` 머리 주석의 수치 근거 링크(ADR 012)에 상한 수치·측정값이 없다 | `limits.ts:1-2` · `grep -c '[0-9]ms' docs/decisions/012-execution-contexts.md` → 0 |
| IPC 계약 조각 행이 "preload 가 모은다" — 조립은 renderer 전송층이다(0324 D-058) | `IPC_CONTRACT.md:266` · `renderer/src/shared/api/transport/session-load.ts:1-5` |

### 전수 조사 (`app/` 기준 · AS-IS)

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| S1 조각 분할·조립 자리 | `rg -n 'splitSessionMessages\|assembleSession\|SESSION_CHUNK_MAX_PARTS' src --glob '!*.test.ts'` | 8 | 정의 4 · 호스트 2 · 전송층 2 |
| S2 live 본문 구독 | `rg -n 'useLiveText\(\)\|useLiveReasoning\(\)' src/renderer/src --glob '!*.test.*'` | 7 | OpenCode Timeline 2 · Claude 리프 2 · 상태줄 1 · 정의 2 |
| S3 head 행 사용 | `rg -n 'head\.rows' src/renderer/src/features/chat/harnesses/opencode/transcript --glob '!*.test.ts'` | 4 | 복사 2(`projection.ts:72` · `Timeline.tsx:52`) · 끝 행 1 · 색인 1 |
| S4 그룹화 호출 | `rg -n 'groupExchanges\(\|createExchangeGrouper' src/renderer/src --glob '!*.test.ts'` | 3 | 정의 1 · Claude Timeline 1 · OpenCode head 1 |
| S5 steer 복원 콜백 | `rg -n 'onRestoreSteerDraft\|onRestoreDraft' src/renderer/src --glob '!*.test.*'` | 12 | ChatTile 1 · 계약 1 · Claude Timeline 3 · Exchange 3(비교자 0) · OpenCode 1 · PendingSteerTurn 3 |
| S6 diff 상한 | `rg -n 'withinDiffCap\|diffLinesWithinCap\|diffStatWithinCap\|countLines\(\|toolDiffStat\(\|parsePatchWithinCap\|DIFF_INLINE_MAX_LINES\|PATCH_INLINE_MAX_CHARS' src/renderer/src --glob '!*.test.ts'` | 22 | inline 정의·호출 · 소비처 5파일(`useDiffLines` · `ToolCard` · `filePresentation` · `toolMeta` · `unifiedDiffLines`) |
| S7 캐시 크기 | `rg -n 'resultSize\|writeCache\|cacheMax' src/renderer/src/shared/compute --glob '!*.test.ts'` | 8 | client 7 · protocol 정의 1 |
| S8 장식 토큰화 | `rg -n 'tokenizeComposerDecoration\|matchAll\(' src/renderer/src/features/chat/harnesses/common/composer --glob '!*.test.ts'` | 6 | 정의 1·정규식 3·층 2 |
| S9 복사 문자열 계산 | `rg -n 'turnCopyText\(\|copyText\(call\)' src/renderer/src --glob '!*.test.*'` | 5 | 정의 1 · 즉시 3(AssistantTurn·UserTurn·ToolCard) · 지연 1(OpenCode) |
| S10 끌기 | `rg -n 'useDragResize\(\|onChange\(' <훅·Sidebar·PanelResizeSeparators>` | 5 | 정의 1 · 직접 `onChange` 1 · 소비처 3 |
| S11 썸네일 | `rg -n 'downscaleDataUrl\|previewDataUrl' src/renderer/src --glob '!*.test.*'` | 4 | 정의 1 · import 1 · 호출 1 · 표시 1 |
| S12 세션 경로 인자 펼침 | `rg -n '\.push\(\.\.\.' src/shared/data-host.ts src/main/app/data-host/session-load.ts src/renderer/src/shared/api/transport/session-load.ts` | 1 | `data-host.ts:83` |

### 수치 / 전칭 표현 검산

- 재측정 수치: R1~R5 · M1~M5(위 표).
- 내역 합 = 총계: S5 12 = 1+1+3+3+1+3(PendingSteerTurn 3 은 prop 선언·구조 분해·호출).
- "유일한" 반례 검색: "투영의 production 호출부는 `Timeline.tsx` 두 곳" → `rg -n "projectTimeline(Head|Tail)\(" src/renderer/src --glob '!*.test.ts'` → 6건 = `Timeline.tsx:40` · `:45` + 정의 2(`projection.ts:29` · `:49`) + 래퍼 2(`projection.ts:71` · `:72`). 래퍼 `projectTimeline` 의 호출부는 테스트뿐이다(`rg -n "projectTimeline\(" src/renderer/src --glob '!*.test.ts'` → 정의 1).
- 문서 앵커 / 기존 테스트 케이스 존재 확인: VP-04·VP-05·VP-09·VP-13·VP-17·VP-21·VP-24·VP-25 의 케이스명을 `grep -n "it(\|describe("` 로 확인했다. `projection.golden.json` 실재(`projection.golden.test.ts:11-13`).

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: AR-01 · AR-02 · AR-03 · AR-04 · AR-05.
- 현재 책임 소유자: 데이터 호스트(조각 분할·전송) · renderer 전송층(조립) · renderer 표시 모델(그룹화·행 투영) · 계산 클라이언트(캐시) · 컴포넌트(복사·끌기·썸네일).
- 문제의 직접 원인: 입력 크기·이력 길이를 상한 없이 도는 동기 루프가 UI 스레드에 있다(§8 표).

```text
WU-1  oo:session:load → deliver: splitSessionMessages(전체, part 만) → [조각…] → send → 전송층 push(...조각) ✗RangeError
WU-2  delta → live.text → OpenCodeTimeline(useLiveText) → projectTimelineTail(flatMap 확정 parts + live) → [...head.rows, ...tail] → virtualizer
WU-3  messages 참조 변경 → groupExchanges(전체 재구성) → Exchange 비교자(exchangeEquals 로 내용 비교)
WU-4  ToolCard → toolDiffStat → 수정마다 countLines 전체 + jsdiff(합 무제한)
WU-5  worker 응답 → client.writeCache → resultSize(결과 순회) → 새 키는 상한 넘어도 잔류
WU-6  draft → useDeferredValue → tokenize(전체) → span × 조각 수
WU-7  render → turnCopyText / copyText 즉시
WU-8  mousemove → onChange → store set
WU-9  send → Promise.all(downscale 전부) → 실패면 원본 data URL
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: 같다.
- 변경 후 책임 소유자: 같다(프로세스·레이어 이동 없음). 바뀌는 것은 각 루프의 상한과 증분성이다.

```text
WU-1  deliver: for(start) { yield(첫 조각 제외) → end = nextSessionChunkEnd(messages, start) → send(slice) } → 머리(조각 수·메시지 수 = 보낸 합)
      전송층: assembleSession — 조각을 순서대로 loop push
WU-2  delta → live.text → OpenCodeTextSegment(useLiveTextFor(row.live)) → OpenCodeText
      OpenCodeTimeline: useHasLiveText·useHasLiveReasoning → tail = projectTimelineTail(head, presence) (유무가 바뀔 때만)
      rows = timelineRows(head, tail) → virtualizer 가 at(i) 로 읽음
WU-3  messages → grouper(이전 결과와 첫 변경 지점 비교) → 다음 시작 < 첫 변경인 앞 exchange 재사용 + 뒤 재그룹(새 상태) + 동치 복원 → Exchange(비교자 + steer 함수)
WU-4  withinDiffCap: 문자 합 > 64,000 → false / countLinesUpTo(401 에서 멈춤) · 카드 머리 = diffStatsWithinBudget(전 항목 합산)
WU-5  worker handleMessage → { result, size } → client.writeCache(key, result, size) → size 무효·과대 → 미보관
WU-6  tokenize: length > 20,000 → [] (정규식 안 돎)
WU-7  render → () => turnCopyText / () => copyText → 클릭 때 계산
WU-8  mousemove → 대기 값 + rAF 1개 → 프레임에 onChange(마지막) · mouseup → 취소 + 즉시 반영
WU-9  send → buildAttachmentViews(동시 2) → downscale { ok } → 실패면 미리보기 없음
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 그대로 | 그대로 — 프로세스·레이어 이동 0 | 공개 계약 보존(D-003) | 운영 gate `check-ui-thread` |
| data/control flow | 전체 분할 후 전송 · 전체 재그룹 · delta 마다 tail 투영 | 조각마다 측정·전송 · 증분 재그룹 · 유무 변화에만 투영 | 이력 길이 비례 일 제거 | VP-02 · VP-11 · VP-07 |
| state/contract | 조각 = part ≤ 500 · 행 = head+tail 복사본 · 워커 응답 = `{ id, ok, result }` | 조각 = 메시지·part·문자 상한 · 행 = 색인 접근 · 워커 응답 = `{ id, ok, result, size }` | D-007 · D-015 · D-011 | EP-1 · EP-2 · EP-5 |
| error/lifecycle | 취소는 조각 사이 확인 · 실패 썸네일은 원본 | 취소 확인 뒤에만 다음 조각 측정 · 실패 썸네일은 미리보기 없음 | 취소 뒤 불필요한 측정 0 · DB 비대 방지 | VP-02 자리 7 · VP-30 |
| test seam/관측점 | 시간·호출 수만 | parts getter·`head.rows` Proxy·`matchAll` spy·가짜 rAF·주입 deps | 계수 단언으로 재현 | 각 UT |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `src/shared/data-host.ts` | 조각 상한 상수 · `estimateWireChars` · `nextSessionChunkEnd` · `splitSessionMessages` · `assembleSession` | 메시지 배열 → 조각 끝 색인 / 조각들 → 세션 | 데이터 호스트 `session-load.ts` · 전송층 `session-load.ts` · 테스트 |
| `opencode/transcript/projection.ts` | head 투영(현행) · presence tail · `timelineRows` · 문자열 래퍼 | messages·presence → 행 | `Timeline.tsx` · 테스트 |
| `opencode/transcript/Timeline.tsx` | 유무 구독 · 가상화 · 행 리프 `OpenCodeTextSegment` | store → DOM | `TranscriptView` 레지스트리 |
| `lib/parts.ts` | `hasSegmentText`·`hasSegmentReasoning` — segment 유무 판정 정본 | 문자열 → 불리언 | `messageSegments` · chatStore 선택자 · projection 래퍼 |
| `store/chatStore.ts` | `useHasLiveText` · `useHasLiveReasoning` · `useLiveTextFor` | store → 값 | OpenCode Timeline |
| `lib/turns.ts` | `createExchangeGrouper`(신규) · `groupExchanges`(현행) | messages·옵션 → exchanges | Claude Timeline · OpenCode head · 테스트 |
| `shared/compute/{limits,diffModel,inline}.ts` | 문자 상한 · `countLinesUpTo` · `diffStatsWithinBudget` | 문자열 쌍·patch → 상한 판정·증감 | `toolMeta.ts` · `filePresentation.ts` · `useDiffLines.ts` |
| `shared/compute/{protocol,client}.ts` · `worker/handler.ts` | 응답 `size` · 캐시 기록 | 워커 결과 → 캐시 | 계산 소비자 |
| `harnesses/common/composer/composerDecoration.ts` | 장식 상한 | 초안 → 조각 | 장식 층 |
| `claude/transcript/toolCopyText.ts`(신규) | 도구 카드 복사 문자열(옮김) | `ToolCall` → 문자열 | `ToolCard` 의 지연 함수 |
| `lib/attachmentViews.ts`(신규) · `lib/imageThumb.ts` | 뷰 생성·동시 상한 · 썸네일 결과 | 첨부 → 뷰 | `useAttachments` |
| `shared/hooks/useDragResize.ts` | 프레임 병합 | 포인터 → `onChange` | 소비처 3 |

## 10. 계약 / 타입 / 강제 지점

검색 명령은 `app/` 에서 돌린다. "출력과 차집합 0"은 출력의 모든 줄이 목록의 어떤 자리에 속하고, 자리마다 줄이 1개 이상이라는 뜻이다.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 |
|---|---|---|---|---|---|---|
| **EP-1** · AR-01·MD-01 / VP-01~03 | 조각 상한 셋 · 단독 조각 · 측정 조기 중단 · 펼침 없는 조립 | `src/shared/data-host.ts` | 데이터 호스트 · 전송층 | 자리 10 — ① `nextSessionChunkEnd` 메시지 수 비교 ② 같은 함수 part 합 비교 ③ 같은 함수 문자 예산 비교(`estimateWireChars(m, 남은 예산)`) ④ 같은 함수 첫 메시지 단독 진행(빈 조각 금지) ⑤ `estimateWireChars` 예산 초과 즉시 반환 ⑥ `splitSessionMessages` = ① 반복 ⑦ `deliver` 조각마다 양보 뒤 `nextSessionChunkEnd` ⑧ `deliver` 머리 `chunked.chunks`·`messages` = 보낸 합 ⑨ `assembleSession` 루프 연결 ⑩ 전송층 `settle` → `assembleSession`(현행) | `rg -n "SESSION_CHUNK_MAX_(PARTS\|MESSAGES\|CHARS)\|estimateWireChars\|nextSessionChunkEnd\|splitSessionMessages\|assembleSession\|\.push\(\.\.\." src/shared/data-host.ts src/main/app/data-host/session-load.ts src/renderer/src/shared/api/transport/session-load.ts` → TO-BE: `.push(...` 0 · 나머지 줄은 ①~⑩ | 하나라도 빠지면 빈 parts·거대 메시지 세션이 다시 한 조각이 되거나 조립이 `RangeError` 를 낸다 |
| **EP-2** · AR-02·MD-02 / VP-06~08 | live 본문은 리프만 구독 · Timeline 은 유무만 · 행은 색인 접근 · live/확정 같은 형 · presence 투영 ≡ 문자열 투영 · 유무 판정 규칙은 `messageSegments` 와 한 정본 | `lib/parts.ts`(판정) · `opencode/transcript/projection.ts` · `store/chatStore.ts` | OpenCode Timeline | 자리 10 — ① `parts.ts` `hasSegmentText`(`!== ''`)·`hasSegmentReasoning`(`trim() !== ''`) — `messageSegments` 의 건너뛰기와 ②·⑩ 이 같은 함수를 쓴다 ② `chatStore.ts` `useHasLiveText`·`useHasLiveReasoning`(①) ③ `chatStore.ts` `useLiveTextFor(enabled)`(`enabled ? live.text : ''`) ④ `OpenCodeTimeline` 유무 구독·tail 메모 deps = head·presence·inflight ⑤ `timelineRows(head, tail)` 를 virtualizer `count`·`getItemKey`·`estimateSize`·항목 렌더가 읽음 ⑥ `OpenCodeTimelineRow` text segment → `OpenCodeTextSegment`(live·확정 공통) ⑦ `OpenCodeTextSegment` → `useLiveTextFor(row.live === true)` ⑧ `projectTimelineTail(head, presence)` 분기 b1~b9(직전 행 `head.rows.at(-1)` 포함) ⑨ `timelineRows`·`timelineRowIndex` 의 head 색인 접근(복사 없음) ⑩ `projectTimeline`·`materializeTimelineRows` 문자열 래퍼(유무는 ①) | 두 명령 — `rg -n "hasSegment(Text\|Reasoning)\|useLive(Text\|Reasoning)\(\|useHasLive(Text\|Reasoning)\|useLiveTextFor\|projectTimelineTail\(\|timelineRows\(\|head\.rows\|materializeTimelineRows\|OpenCodeTextSegment" src/renderer/src/features/chat/lib/parts.ts src/renderer/src/features/chat/harnesses/opencode/transcript --glob '!*.test.ts'` · `rg -n "useHasLive(Text\|Reasoning)\|useLiveTextFor" src/renderer/src/features/chat/store/chatStore.ts` → TO-BE: OpenCode 폴더의 `useLiveText(`·`useLiveReasoning(` 0 · `[...head.rows` 0 · `messageSegments` 의 건너뛰기 두 줄(`parts.ts:564` · `:568`)은 ① 호출로 바뀐다 | Timeline 이 본문을 구독하면 delta 마다 이력 길이 비례 투영·복사가 돌아온다. 형이 갈리면 완료 때 선택이 사라진다. 판정이 두 곳에 있으면 공백 reasoning 에서 행 key 가 갈린다 |
| **EP-3** · MD-03 / VP-10·11 | 증분 그룹화 결과 ≡ 전체 그룹화 · 재사용·동치 참조 | `lib/turns.ts` | Claude Timeline | 자리 7 — ① grouper 같은 입력(배열·옵션) 즉시 반환 ② 첫 변경 지점(참조 비교 루프) ③ 재사용 수 = 다음 exchange 시작이 첫 변경 지점보다 **작은** exchange(같으면 경계가 사라질 수 있어 재사용하지 않는다 — D-027) ④ 옵션 변경 → 전체 ⑤ 재그룹 시작 = 첫 비재사용 exchange 의 `startIndex`(없으면 0), 새 상태로 묶는다 ⑥ 동치 복원(같은 `startIndex` + `exchangeEquals` → 이전 exchange · `turnEquals` → 이전 Turn) ⑦ Claude Timeline 의 grouper 수명(`useState`)·`useMemo` deps | `rg -n "createExchangeGrouper\|groupExchanges\(" src/renderer/src --glob '!*.test.ts'` → TO-BE: `turns.ts` 의 정의·내부 호출(자리 ①~⑥) · Claude Timeline 1(grouper, 자리 ⑦) · OpenCode head 1(현행 — 증분 대상 아님, D-018) | 재사용 경계가 틀리면 바뀐 메시지가 옛 exchange 에 남아 화면이 낡는다(결과 ≡ 전체 그룹화 대조가 막는다) |
| **EP-3b** · AR-03 / VP-12 | steer 복원 콜백 참조 안정·비교 | `components/ChatTile.tsx` · `claude/transcript/Exchange.tsx` | ChatTile · Exchange | 자리 6 — ① ChatTile `useCallback(…, [activeKey])` ② Exchange 비교자 `prev.onRestoreSteerDraft === next.onRestoreSteerDraft` ③ Claude Timeline·Exchange 의 prop 선언·전달(현행) ④ OpenCode Timeline → `PendingSteerTurn` 전달(현행) ⑤ `PendingSteerTurn` prop 선언·호출(현행) ⑥ `harnesses/contracts.ts` prop 타입(현행) | `rg -n "onRestoreSteerDraft\|onRestoreDraft" src/renderer/src --glob '!*.test.*'` → AS-IS 12 · TO-BE 13(비교자 1 추가, ChatTile 줄 수 동일) | 함수가 바뀌어도 Exchange 가 재렌더하지 않으면 다른 세션 키를 캡처한 함수가 남는다 |
| **EP-4** · MD-05·MD-06 / VP-14~16 | 문자 우선 상한 · 줄 조기 중단 · 카드 합산 예산 | `shared/compute/limits.ts` · `inline.ts` | 도구 카드 머리 · 인라인 diff | 자리 8 — ① `limits.ts` 상한 셋(`DIFF_INLINE_MAX_LINES`·`DIFF_INLINE_MAX_CHARS` 신규·`PATCH_INLINE_MAX_CHARS`) ② `diffModel.ts` `countLines`(현행)·`countLinesUpTo(text, limit)`(신규) ③ `withinDiffCap` 문자 합 → `countLinesUpTo` ④ `diffLinesWithinCap` → ③ + 소비처 `useDiffLines`(`null` → 워커, 현행) ⑤ `diffStatsWithinBudget(sources)`(쌍 줄·문자 합 · patch 문자 합) · `diffStatWithinCap`(쌍 1개 래퍼) ⑥ `toolDiffStat` Write·Edit·MultiEdit → ⑤ ⑦ `fileChanges` → ⑤ ⑧ `parsePatchWithinCap` + 소비처 `unifiedDiffLines`(현행, B12) | `rg -n "withinDiffCap\|countLinesUpTo\|countLines\(\|diffLinesWithinCap\|diffStatsWithinBudget\|diffStatWithinCap\|DIFF_INLINE_MAX_(LINES\|CHARS)\|PATCH_INLINE_MAX_CHARS" src/renderer/src --glob '!*.test.ts'` | 한 자리라도 빠지면 한 줄 거대 입력·다수 수정 카드가 UI 스레드에서 상한 없이 돈다 |
| **EP-5** · MD-07·AR-04 / VP-18~20 | 워커가 낸 `size` 로만 캐시 · 과대·무효 미보관 | `shared/compute/protocol.ts` · `client.ts` | 계산 클라이언트 · 워커 | 자리 5 — ① `handleMessage` 성공 응답 `size: resultSize(result)` ② `parseResponse` size 읽기(숫자 아니면 `NaN`) ③ `receive` → `writeCache(key, result, size)` ④ `writeCache` 무효·`size > cacheMax` → 반환(기존 항목 유지) ⑤ client 는 `resultSize` 를 부르지 않음 | `rg -n "resultSize\|writeCache\(" src/renderer/src/shared/compute --glob '!*.test.ts'` → TO-BE: protocol 정의 1 · handler import·호출 2 · client `writeCache` 정의 1·호출 1 · client `resultSize` 0 | client 가 크기를 세면 결과 순회가 UI 스레드에 남는다. 비교가 빠지면 과대 결과가 캐시를 비운다 |
| **EP-6** · MD-08 / VP-22·23 | 장식 상한 · 스킬 토큰 조회 상한 | `shared/compute/limits.ts` · `composerDecoration.ts` | 장식 토큰화 | 자리 4 — ① `COMPOSER_DECORATION_MAX_CHARS` ② `tokenizeComposerDecoration` 첫 줄 `value.length > 상한 → []`(정규식 전) ③ `ComposerDecorationLayer` 유일 호출(현행) ④ 스킬 토큰 끝 구두점 다듬기 — 끝 구두점 구간을 문자 집합 `SKILL_TRAILING_PUNCTUATION` 으로 한 번 훑고, 후보 끝을 `min(토큰 길이, longestSkillNameLength(등록) + 1)` 부터 그 구간 시작까지만 조회(D-026) | `rg -n "tokenizeComposerDecoration\|COMPOSER_DECORATION_MAX_CHARS\|SKILL_TRAILING_PUNCTUATION\|longestSkillNameLength" src/renderer/src --glob '!*.test.ts'` | 비교가 정규식 뒤면 큰 초안의 동기 토큰화가 남는다. ④가 빠지면 상한 안 초안도 토큰 길이의 제곱으로 돈다(§8 V1) |
| **EP-7** · AR-05 / VP-25·26 | 복사 문자열 클릭 시 계산 · 노출 = `hasPartsText` | 각 컴포넌트 · `claude/transcript/toolCopyText.ts`(신규, `copyText` 이동) | Claude·공통 transcript | 자리 4 — ① `ToolCard` `text={() => copyText(call)}`(`copyText` 는 `toolCopyText.ts` 에서 import — 테스트가 spy 한다) ② `AssistantTurn` `text={copyable ? () => turnCopyText(turn) : ''}` ③ `UserTurn` 같은 형 ④ OpenCode 메타(현행 지연) | `rg -n "turnCopyText\(\|copyText\(call\)" src/renderer/src --glob '!*.test.*'` → AS-IS 5 · TO-BE 5(정의 1 + 호출 4 전부 `() =>` 안) | 즉시 계산이 남으면 긴 답변·출력이 복사 없이도 렌더마다 문자열을 만든다 |
| **EP-8** · MD-09 / VP-27·28 | 프레임 병합 · 놓을 때 반영 | `shared/hooks/useDragResize.ts` | 끌기 소비처 3 | 자리 4 — ① mousemove → 대기 값 + 프레임 예약(직접 `onChange` 없음) ② 프레임 콜백 → `onChange(대기 값)` 1회 ③ mouseup → 취소 + 대기 값 즉시 반영 + 리스너 해제 ④ 소비처 3곳 훅 경유(현행) | `rg -n "useDragResize\(\|onChange\(\|requestAnimationFrame\|cancelAnimationFrame" src/renderer/src/shared/hooks/useDragResize.ts src/renderer/src/app/Sidebar.tsx src/renderer/src/features/chat/harnesses/common/rightpanel/PanelResizeSeparators.tsx` | ①이 빠지면 mousemove 마다 store 쓰기 · ③이 빠지면 최종 폭이 마지막 포인터와 다르다 |
| **EP-9** · MD-10 / VP-29·30 | 실패 → 미리보기 없음 · 동시 2 · 순서 | `features/chat/lib/attachmentViews.ts` | 컴포저 전송 | 자리 5 — ① `downscaleDataUrl` 실패 3갈래 → `{ ok:false, reason }` ② `buildAttachmentViews` 실패 → `previewDataUrl` 없음 ③ 같은 함수 동시 상한 `THUMB_CONCURRENCY` ④ 같은 함수 결과 순서 = 입력 순서 ⑤ `useAttachments.buildAttachmentViews` → 위임(유일 경로) | `rg -n "downscaleDataUrl\|previewDataUrl\|THUMB_CONCURRENCY\|buildAttachmentViews" src/renderer/src/features/chat/lib/imageThumb.ts src/renderer/src/features/chat/lib/attachmentViews.ts src/renderer/src/features/chat/hooks/useAttachments.ts` (훅의 인터페이스·반환 줄은 자리 ⑤) | ①②가 빠지면 거대 원본이 transcript·DB 미리보기로 저장된다 |

**규칙 칸 분기 — UT 입력 칸과 1:1**

| 기호 | 규칙 | UT 입력(§7-A) |
|---|---|---|
| e1~e12 | 메시지 수 · part 합 · 문자 예산 넘으면 새 조각 / 단독 / 빈 입력 / 꼭 맞음 / 측정 조기 중단 / 단일 조각 조립 / 세 예산 각각이 정하는 조각 수(메시지 1,001 → 3 · part 10×250 → 5 · 문자 3×400,000 → 2) | VP-03 e1~e12 |
| b1 | `pending` · text 유무 · 직전 segment 가 text → 그 행을 live 로(접두 = 그 text, key 그대로) | VP-08 b1 |
| b2 | `pending` · text 유무 · 직전 segment 가 text 아님 → 새 행 key `${prefix}:${segments.length}:text`, 본문 `''` | VP-08 b2 |
| b3 | `pending` · reasoning 유무 · 직전 segment 가 reasoning → 합침(색인 불변) | VP-08 b3 |
| b4 | `pending` · reasoning 유무 · 직전이 reasoning 아님 → 숨은 segment 추가(뒤 text 색인 +1) | VP-08 b4 |
| b5 | 공백뿐인 live reasoning → segment 없음 | VP-08 b5 |
| b6 | `pending` 거짓 → live 무시(exchange 가 있을 때) | VP-08 b6 |
| b7 | exchange 0 · text 유무 → `initial:text` live 행(`pending` 무관, reasoning 무시) | VP-08 b7 |
| b8 | `pending` · live 없음 · 마지막 확정 text → `streaming` 참 | VP-08 b8 |
| b9 | `pending` 참 → meta 행 없음 | VP-08 b9 |
| g1~g11 | §7-A VP-11 — g8(경계 메시지가 숨어 경계가 사라짐 → 직전 exchange 부터) · g11(경계 메시지가 바뀌어도 보이는 user → 직전 exchange 를 다시 묶되 동치 복원) | VP-11 g1~g11 |
| c1~c5 | §7-A VP-15 | VP-15 c1~c5 |
| a1~a6 | §7-A VP-16 | VP-16 a1~a6 |
| k1~k4 | §7-A VP-19 | VP-19 k1~k4 |
| d1~d6 | §7-A VP-23 — d4(끝 구두점 긴 토큰의 조회 상한) · d5(구두점으로 끝나는 등록 스킬·뒤 구두점 떼기 유지) · d6(최장 이름 64 의 조회 상한) | VP-23 d1~d6 |
| y1~y3 | §7-A VP-26 | VP-26 y1~y3 |
| r1~r6 | §7-A VP-28 | VP-28 r1~r6 |
| t1~t8 | §7-A VP-30 | VP-30 t1~t8 |

- 자리 목록은 그 검색 출력과 차집합 0 이어야 한다. verify 발견은 이행 결함·현재 결함·확장 후보로 갈리고, 열거 원문에 없는 확장 후보는 verify 1·2회째에만 판정을 막는다.
- **선언 경계**(측정 근거와 함께):
  - B1 — 세션 전체 크기·메시지 수에는 상한이 없다. 첫 화면 전 처리량은 세션 크기에 비례한다(페이지는 D-005). R1 의 200,000건도 조립 후 `LOAD_SESSION` 이 전부 map 한다(`chatReducer.ts:1471`).
  - B2 — 조각 예산은 `estimateWireChars` 근사 단위다. 실제 복제 바이트와 다르다(M1 은 문자 기준 측정).
  - B3 — 상한을 넘는 단일 메시지는 그 크기 그대로 한 조각이다(별도 인출은 D-005).
  - B4 — 상한 이전 형상의 조각(한 조각 200,000건)이 와도 전송층은 조립만 견딘다. 받기 단계 schema 검사(`z.array(z.unknown())`)는 조각 크기에 비례한다(T09 구간 측정은 W).
  - B5 — 긴 선택(먼 두 행)의 DOM 범위는 그대로다(`Timeline.tsx:64-75`, 실창 검증 선행 — 단계 B).
  - B6 — 확정 메시지가 추가되면 OpenCode head 투영은 지금처럼 이력 전체를 다시 한다(D-018).
  - B7 — live 행 높이 변화에 따른 virtualizer 재렌더는 남는다. 그 렌더의 투영·parts 읽기·head 순회는 0 이다(AC4).
  - B8 — 첫 변경 지점 탐색은 메시지 참조 비교 최대 n 회다(할당 없음). 단계 B 가 추적한다(§6-C B 행).
  - B9 — Work 결과 선택기는 지금처럼 exchange 전부를 돈다(D-018).
  - B10 — 마지막 exchange 는 지금처럼 전부 마운트한다(블록 가상화 — 단계 B).
  - B11 — 상한 밖 입력의 본문 diff 는 워커가 계산하고 결과 행은 R 이 전부 그린다(가시 행 — 단계 C).
  - B12 — patch 단건 파싱 상한 1,000,000 은 0324 B8 그대로다.
  - B13 — 계산 요청 키는 지금처럼 본문을 포함한다(문서 ID·revision 키 — 단계 C).
  - B14 — 20,000자 이하 초안의 장식 DOM(최악 약 5,000 span)은 그대로다. DOM 비용은 W 에서 잰다.
  - B15 — 열어 둔 도구 카드 본문은 접어도 마운트된 채다(단계 B).
  - B16 — 끌기 중 transcript 재줄바꿈·실측은 프레임당 1회 폭 변경으로 줄 뿐 배치하지 않는다(T24 와 함께 단계 D).
  - B17 — 썸네일 축소·인코딩은 여전히 UI 스레드 canvas 다(워커 인코딩·픽셀 상한 — 단계 D).
- 열린 입력 집합을 판정하는 산출물: 해당 없음(검사기·스캐너를 만들지 않는다).
- 같은 규칙이 여러 레이어에 있다면: UI 스레드 상한은 `shared/compute/limits.ts` 한 곳(`DIFF_INLINE_MAX_CHARS`·`COMPOSER_DECORATION_MAX_CHARS` 추가), 조각 상한은 `shared/data-host.ts` 한 곳.
- `실패 의미`에 "다른 게이트가 막는다": MD-03 칸의 "전체 그룹화 대조가 막는다"는 VP-11 의 매 케이스 `toEqual(groupExchanges(…))` 단언이다(같은 pair 안).
- 선택적 필드의 의미: `TimelineRow` 의 `live?: true` — 없음 = 확정 행. 워커 응답 `size` — 숫자가 아니면 미보관(fail-safe: 결과는 전달).
- 외부 SDK 경계: 해당 없음.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/shared/data-host.ts` | 조각 계약 | `SESSION_CHUNK_MAX_MESSAGES = 500` · `SESSION_CHUNK_MAX_CHARS = 1_000_000` · `estimateWireChars(value, limit)`(명시 스택 반복, 문자열 값·키 길이 합 + 노드마다 2, 합이 `limit` 을 넘으면 즉시 반환) · `nextSessionChunkEnd(messages, start, limits?)` · `splitSessionMessages` 를 그 반복으로 · `assembleSession` 루프 연결 | 순수 단위 `shared/data-host.test.ts` |
| `app/src/main/app/data-host/session-load.ts` | 조각 전송 | `deliver` 가 전체 분할 대신 `for (start …)` 안에서 양보(첫 조각 제외) → `nextSessionChunkEnd` → `send(slice)`. 머리 `chunked` 는 보낸 조각 수·메시지 합 | 신규 `session-load.bounds.test.ts`(unit — 리더 `vi.mock`, `ctx.db` 는 `nativeHistory.compactLegacyRaw` 만 갖는 가짜, `invokeChannel` + `fakeClient`) |
| `app/src/renderer/src/features/chat/lib/parts.ts` | segment 유무 판정 정본 | `hasSegmentText(text)`(`!== ''`) · `hasSegmentReasoning(text)`(`trim() !== ''`) 추가 · `messageSegments` 의 두 건너뛰기를 이 함수 호출로(동작 불변) | `parts.test.ts` |
| `app/src/renderer/src/features/chat/store/chatStore.ts` | 구독 선택자 | `useHasLiveText` · `useHasLiveReasoning`(둘 다 위 판정) · `useLiveTextFor(enabled)` 추가(기존 `useLiveText`·`useLiveReasoning` 유지 — Claude 리프·상태줄이 쓴다) | 신규 `chatStore.liveSelectors.test.ts`(fake DOM + 실제 store) |
| `.../opencode/transcript/projection.ts` | 행 투영 | `TimelineLivePresence` · `projectTimelineTail(head, presence)`(확정 parts 만 `messageSegments`, 분기 b1~b9 로 live segment·행 표시) · `TimelineRow` segment 변형에 `live?: true` · `timelineRows(head, tail)`(`count`·`at`) · `materializeTimelineRows(rows, liveText)` · `projectTimeline(messages, live, options)` 는 head + presence tail + materialize | 순수 단위 `projection.test.ts` · `projection.golden.test.ts` |
| `.../opencode/transcript/Timeline.tsx` | 구독·가상화·행 리프 | 유무 구독 · tail 메모 deps 교체 · `rows = timelineRows(…)` · `OpenCodeTextSegment` 신설(live·확정 공통, `useLiveTextFor`) · `Math.min(...)`·`Math.max(...)` 는 그대로(≤ 2) | `Timeline.memo.test.ts` 확장 · `Timeline.selection.test.ts` 신규 케이스 |
| `.../features/chat/lib/turns.ts` | 그룹화 | `createExchangeGrouper()` — 이전 messages·옵션·결과를 클로저에 두고 §10 MD-03 자리 ①~⑥ | 순수 단위 `turns.test.ts` |
| `.../claude/transcript/Timeline.tsx` | 그룹화 호출 | `const [groupIncrementally] = useState(createExchangeGrouper)` → `useMemo(() => groupIncrementally(messages, { showAutomaticFeeds }), [...])` | 같다 |
| `.../claude/transcript/Exchange.tsx` | 비교자 | `prev.onRestoreSteerDraft === next.onRestoreSteerDraft` 추가 | 신규 비교자 단언(비교자 함수를 `memo` 객체의 `compare` 로 꺼내 직접 호출) |
| `.../components/ChatTile.tsx` | 콜백 안정 | `const restoreSteerDraft = useCallback((text) => chatActions.restoreComposerDraft(activeKey, text), [activeKey])` | `ChatTile.workLifetime.test.ts` 확장 |
| `.../shared/compute/limits.ts` | 상한 SSOT | `DIFF_INLINE_MAX_CHARS = 64_000` · `COMPOSER_DECORATION_MAX_CHARS = 20_000` · 머리 주석의 근거 링크를 0324 plan §8·B8 와 0325 plan §8 로 정정 | — |
| `.../shared/compute/diffModel.ts` | 줄 세기 | `countLinesUpTo(text, limit)` — `limit` 을 넘는 순간 `limit + 1` 반환. `countLines` 유지 | `inline.test.ts` |
| `.../shared/compute/inline.ts` | 상한 판정 | `withinDiffCap` 문자 합 우선 → `countLinesUpTo` · `diffStatsWithinBudget(sources: readonly ({ kind:'pair'; before; after } \| { kind:'patch'; lines: DiffLine[]; chars: number })[])` · `diffStatWithinCap` 은 쌍 1개 래퍼로 유지 | `inline.test.ts` |
| `.../features/chat/lib/toolMeta.ts` | 머리 증감 | Write·Edit·MultiEdit 를 `diffStatsWithinBudget` 한 번으로 | `toolMeta.test.ts` |
| `.../opencode/transcript/filePresentation.ts` | 파일 카드 머리 | 쌍 원천 + patch 원천(`chars = file.patch.length`)을 모아 `diffStatsWithinBudget` 한 번으로. patch 합이 상한을 넘으면 파싱 전에 `null` | `filePresentation.test.ts` |
| `.../shared/compute/{protocol,client}.ts` · `worker/handler.ts` | 응답 크기 | `WireResponse` 성공 변형에 `size: number` · `parseResponse` 가 size 를 읽음 · `handleMessage` 가 `resultSize` 로 채움 · `writeCache(key, result, size)` 무효·과대 미보관 · client 의 `resultSize` import 제거 | `client.test.ts` · `handler.test.ts` |
| `.../common/composer/composerDecoration.ts` | 장식 상한 · 스킬 토큰 조회 상한 | 첫 줄 `if (value === '' \|\| value.length > COMPOSER_DECORATION_MAX_CHARS) return []` · `SKILL_TRAILING_PUNCTUATION`(`. , ! ? ; : ) ] }` — 지금 정규식과 같은 집합) · `longestSkillNameLength(names)`(집합 identity 별 `WeakMap` 메모) · 스킬 루프는 끝 구두점 구간 시작 `p` 를 한 번 훑고 `end = min(토큰 길이, 최장 + 1)` 부터 `p` 까지만 `has(token.slice(1, end))`(§8 V5 시제작과 같은 꼴) | `composerDecoration.test.ts` · `ComposerDecorationLayer.test.ts` |
| `.../claude/transcript/{AssistantTurn,ToolCard}.tsx` · `.../common/transcript/UserTurn.tsx` · `.../claude/transcript/toolCopyText.ts`(신규) | 복사 지연 | 지연 함수 · `copyable = turn.messages.some((m) => hasPartsText(m.parts))` · `ToolCard.tsx:46-69` 의 `copyText` 를 새 모듈로 옮겨 export(같은 모듈 안 호출은 spy 가 보지 못한다) | 컴포넌트 렌더 테스트(fake DOM) |
| `.../shared/hooks/useDragResize.ts` | 프레임 병합 | 클로저의 `pending`·`frame` · rAF 예약 · mouseup flush·취소 | 신규 `useDragResize.test.ts`(fake DOM 하네스의 rAF) |
| `.../features/chat/lib/imageThumb.ts` | 썸네일 | 반환을 `Promise<{ ok: true; dataUrl: string } \| { ok: false; reason: 'load' \| 'canvas' \| 'encode' }>` 로 | 신규 `imageThumb.test.ts`(`Image`·`document.createElement` 스텁) |
| `.../features/chat/lib/attachmentViews.ts`(신규) | 뷰 생성 | `THUMB_CONCURRENCY = 2` · `buildAttachmentViews(items, { readAttachment, downscale, newId })` — 순서 보존 동시 상한 실행 | 신규 `attachmentViews.test.ts` |
| `.../features/chat/hooks/useAttachments.ts` | 위임 | `buildAttachmentViews` 가 위 모듈을 production deps 로 부른다 | `composerSubmit.test.ts` |
| `docs/IPC_CONTRACT.md` | 조각 행 | `oo:session:load-chunk` 행에 "조각 상한(메시지·part·문자)의 정본은 `shared/data-host.ts`" 를 더하고 "preload 가 모은다" 를 "renderer 전송층이 모은다" 로 정정 | 문서 인벤토리 gate |
| `docs/arch/frontend/rendering.md` | 렌더 정본 | §델타 경로에 OpenCode 리프(`OpenCodeTextSegment`)를, 교환 그룹화 문장에 Claude 증분 재사용(`createExchangeGrouper`)을 적는다 | 같다 |

### 테스트 가능성

- electron/DB 의존부와 분리: 데이터 호스트 핸들러 테스트는 리더(`features/history/reader`)를 `vi.mock` 하고 `ctx.db` 를 가짜로 둔다 — SQLite 를 열지 않아 unit 풀이다(`scripts/test-pools.mjs` 신호 없음).
- 기존 메커니즘 재사용: fake DOM 하네스의 rAF(`renderHarness.testfixture.ts:31-32` `FRAME_MS`)로 끌기 프레임을, `useMemo` deps 흉내로 Timeline 투영 횟수를 센다. 하네스는 bailout 이 없어 Timeline 이 매번 다시 그려지므로 AC4 계수는 production 보다 엄격하다.
- 순서 관측: VP-02 자리 7 은 `hooks.yieldTurn` 주입(현행 seam, `main/app/data-host/session-load.ts:37` · `:55`)과 메시지 `parts` getter 계수로 "양보 뒤 측정"을 본다.
- 실제 store 를 쓰는 선택자 테스트는 `installChatStoreHarness` + `useChatStore.setState` 관례(`chatStore.gitTriggers.test.ts:17-24`)를 따른다.

## 12. End-to-end 영향

### producer → consumer

```text
데이터 호스트 deliver → 조각 통지(형상 불변) → 전송층 조립 → chatStore.loadSession → transcript
store live → (OpenCode) OpenCodeTextSegment · (Claude) LiveText — 확정 messages → grouper / projection → 행
도구 입력 → toolDiffStat·fileChanges → 카드 머리 · useDiffLines → DiffBody
워커 → client 캐시 → CodeBlock·useDiffSyntax·useDiffLines
```

- producer 기준: 조각 형상 `{ requestId, seq, messages }` 와 응답 머리 형상은 그대로다 — 조각 개수만 달라진다.
- consumer 파생 규칙: 전송층은 조각 크기를 검사하지 않는다(B4) — 개수·순서·메시지 합만 본다(현행).
- 파생 가능한 합성값이 정본을 우회하지 않는가: `materializeTimelineRows` 는 테스트·래퍼 전용이고 화면은 리프가 store 의 live 를 직접 읽는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `useLiveText`·`useLiveReasoning` 의 Claude 리프·상태줄 | 그대로 둔다 — 새 선택자는 추가분 | AC6(VP-09) · Claude 렌더 테스트 |
| `projectTimelineTail` 을 부르는 테스트 2파일 | 인자 형상이 presence 로 바뀐다 — `Timeline.memo.test.ts`·`projection.golden.test.ts` 의 직접 호출을 새 계약으로 고친다(§7-A VP-08 "갱신") | AC5 |
| `Timeline.memo.test.ts:'projects the committed head once and the live tail six times without computing copy text'` | 단언 "tail 6회"는 이번 계약에서 "첫 렌더 1 + 유무 변화 1 = 2회"가 된다 — 0324 가 아니라 0325 D-015 가 정한 값이다. `turnCopyText` 미호출 단언은 그대로 둔다 | AC4 |
| `messageSegments` 소비처(Claude `AssistantMessage`·Work·OpenCode) | 건너뛰기 조건을 판정 함수 호출로 바꾸기만 한다(동작 불변) | `parts.test.ts` 기존 케이스 · AC5 golden |
| `diffStatWithinCap` 의 기존 테스트 | 쌍 1개 래퍼로 남아 400/401 단언이 그대로다 | AC11(VP-17) |
| `downscaleDataUrl` 호출부 1곳 | 반환 형상 변경 — `attachmentViews` 만 부른다 | AC17 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: grouper 는 Claude Timeline 마운트마다 하나(`useState`). Timeline 재마운트(세션 키 재마운트 정책)면 새 grouper 다.
- 취소/중단: 세션 로드 취소는 양보 뒤 확인 → 다음 조각 측정 전 반환(현행 의미 + 측정 생략). 끌기 mouseup 은 예약 프레임을 취소한다. 계산 클라이언트의 취소·늦은 응답 규칙은 그대로이고 늦은 응답의 캐시 기록만 size 규칙을 따른다(k4).
- 종료/quit/crash/renderer-gone: 변경 없음(0324 계약).
- retry/timeout/partial failure: 조각 누락은 지금처럼 거부. 썸네일 하나의 실패는 그 뷰만 미리보기 없음이고 전송은 계속된다.
- cleanup/rollback: 끌기 리스너는 mouseup 에서 해제(현행) + 프레임 취소.
- **다중 저장소 쓰기**: 해당 없음 — 이 산출물은 코드 변경이다. plan 판정의 사본은 이 `plan.md` 와 `INDEX.md` 0325 행·`새 handoff 후보` 0325 행 두 곳이며 설계 커밋 하나에서 함께 쓴다.

## 14. 성능 / 상한 / 최적화

- 조각: 불변식은 조각마다 세 예산 안(상한을 넘는 단일 메시지 조각 제외)이다. 조각 수는 세 예산이 함께 정하고, 탐욕 분할이라 조각 수 < M/500 + 2P/500 + 2C/1,000,000 + 1 이다(M = 메시지 수 · P = part 합 · C = `estimateWireChars` 합 — 예산 때문에 닫힌 조각은 그 조각과 다음 메시지의 합이 예산을 넘고, 각 메시지는 그 합에 최대 두 번 들어간다). 정확한 수는 e10~e12 가 잠근다(1,001 빈 메시지 → 3 · part 10×250 → 5 · 문자 3×400,000 → 2). 조각 하나의 측정은 남은 예산에서 멈추고 조각마다 매크로태스크 양보 1.
- OpenCode delta: 투영 0 · parts 읽기 0 · head 순회 0(AC4). live 유무 변화당 투영 1(현재 exchange 크기 비례 — B6 와 별개).
- Claude 커밋: 참조 비교 ≤ n · 재그룹은 첫 비재사용 exchange 부터 끝까지(보통 마지막 exchange 하나, 첫 변경이 경계면 그 앞 exchange 까지 둘).
- diff 머리: 카드당 jsdiff 입력 합 ≤ 64,000자·400줄. 상한 정확히 64,000자·400줄 전부 다른 입력의 관측은 31회 중앙값 3.88ms·최대 6.24ms(V4) — 장비·입력 꼴에 따른 관측값이지 보장 상한이 아니다. 64,001자는 jsdiff 0회(VP-15 c1).
- 장식: 토큰화 ≤ 20,000자 · 스킬 토큰마다 조회 ≤ 최장 이름 + 1(D-026). 시제작 관측은 V1 입력 최대 0.779ms · 최장 64 입력 최대 1.332ms(V5) — 구현 턴이 실제 코드로 다시 잰다. 20,000자 이하의 DOM span 비용은 W(B14).
- 캐시로 잃는 부수 효과: 과대 결과를 캐시하지 않으므로 같은 거대 입력의 재요청은 워커로 다시 간다(재계산). 결과 표시는 같다 — k2 가 요청자 resolve 를 단언한다.
- 복사 지연으로 잃는 부수 효과: 없음 — 클릭 때 같은 함수로 같은 문자열(y1).

## 15. 외부 구현 포트 / 문서 계약 (해당 시)

해당 없음 — 외부·배포가 구현하는 port/schema/config 를 바꾸지 않는다. `IPC_CONTRACT.md` 의 조각 행은 서술 정정(형상 불변)이다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 세션 본문 한 번 반영 | 0324 D-011 | §5 "스토어에 한 번 반영" · B1 · §6-C E 행 | 유지 — 단계 E 도 첫 페이지를 한 번에 교체해 유지한다(D-022) |
| 컴포저 장식 20,000자 상한 | 0325 D-010 | D-026 · EP-6 ④ | 유지 + 스킬 토큰 조회 상한 추가(상한만으로는 비용이 묶이지 않았다 — V1) |
| 조각 part 상한 500 | 0324 AC16 · `data-host.ts:12` | D-007 · EP-1 ②④ | 유지 + 메시지·문자 상한 추가 |
| 강조 32,000 · diff 400 · 머리 증감 미표시 | 0324 D-012 · D-014 | D-008 · D-009 | 유지 + 문자·합산 상한 추가 |
| 워커 실패 시 UI 대체 계산 없음 | 0324 D-009 | §5 파생 UX · B11 | 유지 |
| 진행 중 캐시 세션 보호 | 0324 D-045 · `app/AGENTS.md` 메모리 캐시 | AC3 · VP-05 | 유지 |
| 캐시 상한 4,000,000 · LRU | 0324 AC14 | D-011 · k1 | 유지 + 과대·무효 미보관 |
| live 리프 구독 · 불변 메시지 memo · 확정 블록 memo 유지 | 감사 memo 표 · 요청서 설계 항목 | D-015 · D-018 | 유지(OpenCode 에 리프 구독을 넓힘) |
| `reconcileSegments`·Work 캐시는 늦은 결과 귀속 검증 뒤 정리 | 요청서 설계 항목 | D-018 · B9 | 유지(0325 에서 안 건드림) |
| renderer 4-layer · feature 교차 금지 | `src/renderer/AGENTS.md` | §11 신규 파일 위치(`features/chat/lib/attachmentViews.ts` · `shared/compute`) | 유지 |
| 테스트 시간 예산·풀 분류 | `app/AGENTS.md` · `scripts/test-pools.mjs` | §11 테스트 seam(unit, 시간 단언 없음) | 유지 |
| 문서에 코드 수치 재서술 금지 | root `AGENTS.md` 원칙 4 | `rendering.md`·`IPC_CONTRACT.md` 갱신 — 수치 대신 정본 경로 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| presence 투영이 문자열 투영과 갈라진다 | AC5 — golden 전 케이스·분기 b1~b9 를 문자열 래퍼로 대조 |
| live → 확정 전환에서 선택이 사라진다 | D-015 같은 형 · VP-07 자리 6 변이 등록 |
| 증분 그룹화가 바뀐 메시지를 옛 exchange 에 남긴다 | VP-11 매 케이스 전체 그룹화와 `toEqual` |
| 조각 수가 늘어 양보 횟수가 늘고 전체 로드 시간이 길어진다 | 빈 메시지 500건 복제 0.14ms(M1) — 조각 400개의 양보 비용은 W 에서 잰다. 화면은 한 번 반영이라 중간 상태가 없다 |
| 큰 초안·큰 diff 사용자는 장식·머리 증감을 잃는다 | D-008·D-009·D-010 을 "사용자 거부 가능"으로 두고 W 실측 뒤 값 조정 |

- 되돌리기 어려운 결정: 없음 — 공개 계약·저장 형식 변경 0. 상수는 `limits.ts`·`data-host.ts` 한 곳.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/shared/data-host.ts` · `app/src/main/app/data-host/session-load.ts`
- `app/src/renderer/src/features/chat/store/chatStore.ts`
- `app/src/renderer/src/features/chat/harnesses/opencode/transcript/{projection.ts,Timeline.tsx,filePresentation.ts}`
- `app/src/renderer/src/features/chat/lib/{parts.ts,turns.ts,toolMeta.ts,imageThumb.ts,attachmentViews.ts}`
- `app/src/renderer/src/features/chat/harnesses/claude/transcript/{Timeline.tsx,Exchange.tsx,AssistantTurn.tsx,ToolCard.tsx,toolCopyText.ts}`
- `app/src/renderer/src/features/chat/harnesses/common/transcript/UserTurn.tsx`
- `app/src/renderer/src/features/chat/harnesses/common/composer/composerDecoration.ts`
- `app/src/renderer/src/features/chat/components/ChatTile.tsx` · `app/src/renderer/src/features/chat/hooks/useAttachments.ts`
- `app/src/renderer/src/shared/compute/{limits.ts,diffModel.ts,inline.ts,protocol.ts,client.ts,worker/handler.ts}`
- `app/src/renderer/src/shared/hooks/useDragResize.ts`
- 테스트: §7-A 의 신규·확장 좌표
- `docs/IPC_CONTRACT.md` · `docs/arch/frontend/rendering.md` · `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md` §better-sqlite3 ABI · 제약 환경 게이트 가이드 + "로컬 확인" 목록 · `src/renderer/AGENTS.md` · `src/main/AGENTS.md`.
- ABI/네트워크 등 환경 제약: Electron 바이너리 다운로드 차단 환경이면 `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` · 빌드 스모크와 DB 스위트는 `app/AGENTS.md` 서명으로 분리 보고.
- 기본 정적 게이트: `npm run lint` · `npm run typecheck`.
- 관련 테스트: 파일 필터 없는 `./node_modules/.bin/vitest run` · `node --test scripts/*.test.mjs` · 가드 다섯(`check-migrations-appendonly` · `check-doc-inventory --check` · `check-product-naming` · `check-test-budgets` · `check-ui-thread`) · `npx electron-vite build && node scripts/smoke-hosts.mjs && node scripts/smoke-preload.mjs out/preload`.
- 사람 실기(AC19 — W 기준선, D-024) — 같은 Windows 장비·주사율·배율, `ee8ac81` 빌드와 단계 A 빌드에서 각각:
  1. 빈 parts 200,000건 세션 픽스처 열기(이전 빌드는 실패 기대)
  2. OpenCode 긴 세션(과거 exchange 1,000+)에서 스트리밍 중 한글 타이핑·휠 스크롤
  3. Claude Code·Claude Work 긴 세션(도구 다수) 스트리밍 중 타이핑·스크롤
  4. MultiEdit 50개 카드 · 한 줄 5MB Edit 카드가 있는 세션 열기·스크롤
  5. 400,000자 붙여넣기 · `/z` + 마침표 20,000자 붙여넣기 후 타이핑·IME 조합
  6. 스트리밍 중 우측 패널·사이드바 경계 끌기
  7. 고해상도 이미지 5장 붙여넣기 → 즉시 전송
- 측정 방법(AC19): `perf.stall` 수·최댓값은 설치본 로그. 입력→paint p95·최대, 누락·연속 누락 프레임, layout 은 Chromium trace(Performance 패널), React commit 은 React Profiler — 둘 다 같은 커밋의 진단 빌드(프로덕션 모드 + React profiling + DevTools 허용, 배포하지 않음)에서 잰다. 기록은 시나리오 × 빌드 × 하네스 × 지표 표로 verify 에 첨부한다.
- 같은 실창 세션에서 0324 AC22·AC23·AC52′ 를 수행하고 결과를 0324 verify 항목에도 기록한다(D-028). 허용치 판정은 D-025 뒤 단계 W 다.

## READY self-review

- [x] Decision Ledger — D-001~D-029 · SUPERSEDED 3(D-005·D-006·D-016) · OPEN 2(D-023·D-025) · 사용자 거부 가능 4(D-008·D-009·D-010·D-012) · PR #633 원문 인용 8(D-003·D-021~D-025·D-028·D-029).
- [x] rev 2 반영 — 리뷰 지적 4건을 실제 함수로 재현(§8 V1~V4)한 뒤 규범 행을 고쳤다: AC2·AC8·AC14·AC19 · VP-03·VP-11·VP-23·VP-31 · EP-3 ③·EP-6 ④ · §14 · §6-A·§6-C.
- [x] Part I 만으로 완료 상태 이해 — §1 · §5 흐름 · §6 범위 표 · §7 AC1~AC19.
- [x] 조건절 보존 — 턴 1·2 원문 인용(§2), "측정한 뒤 이주 여부를 정한다" 원문(D-019).
- [x] Product/UX ↔ AC ↔ Technical Design — §5 의 8개 흐름이 AC1~AC18 과 §9 TO-BE 의 WU-1~WU-9 에 대응(도구 카드 흐름 = WU-4·WU-5, 이미지 흐름 = AC17·AC18).
- [x] AS-IS·TO-BE 같은 축 — §9 두 코드 블록이 WU-1~WU-9 같은 순서.
- [x] Delta 추적 — §9 Delta 5축 → VP·EP 열.
- [x] 사라진 책임 — 없음(이동·삭제 0, §9 Delta 책임 행).
- [x] 수치 실측 — R1~R5 · M1~M5 이번 세션 재실행 · S1~S12 이번 세션 검색.
- [x] AC 의 행동 단언·검증 수단·경로 — §7 표 19행 모두 세 칸.
- [x] Baseline V · 기준 V `none` · 0324 노드 INHERITED REGRESSION(R-0324-04·R-0324-05·SD-0324-45).
- [x] NEW 노드 REQUIRED pair — R-01~R-10 ↔ VP-01·06·10·14·18·22·25·27·29·31, AR·MD 노드 ↔ VP-02·03·07·08·11·12·15·16·19·20·23·26·28·30.
- [x] INHERITED → REGRESSION — VP-04·05·09·13·17·21·24.
- [x] 경로·분모·좌표 — §7-A 31행 · §10 10행(EP-1~EP-9 + EP-3b, 자리 10·10·7·6·8·5·4·4·4·5 = 63). pair 별 분모 합이 EP 자리 수와 같다(EP-1 = VP-02 3 + VP-03 7 · EP-2 = VP-07 6 + VP-08 4 · EP-4 = VP-15 5 + VP-16 2 + VP-17 1 · EP-5 = VP-19 4 + VP-20 1 · EP-6 = VP-23 4).
- [x] 규칙 칸 ↔ UT 입력 — §10 분기 표 e1~e12·b1~b9·g1~g11·c1~c5·a1~a6·k1~k4·d1~d6·y1~y3·r1~r6·t1~t8 전부 VP 입력 칸과 같은 기호.
- [x] 선언 경계 — B1~B17, 측정 근거 R1·M1·M3·M5·코드 줄.
- [x] INDEX 후보 표 겹침 — 0324 행 3개(`bootWhenReady` · `main.tsx` error boundary · `installOo`)는 이번 파일과 겹치지 않는다(`rg -n "installOo\|bootWhenReady" <§18 파일>` → 0).
- [x] 운영 gate — §7-A gate 표 · §19.
- [x] 사람 실기로 미룬 순수 로직 0 — AC19 만 사람.
- [x] structural proxy 단독 AC 0 — AC4 는 계수(행동), EP-2 ⑥ 변이로 형 동일성 확인.
- [x] "X 가 쓰인다" 장치의 방향 — VP-07 자리 3 변이(Timeline 이 본문 구독 → mock 호출 0 이 red) · VP-20 client `resultSize` 호출 0 단언.
- [x] 정책 파라미터 단위 — 조각 문자 = `estimateWireChars` 단위 · diff·장식 = UTF-16 길이 · 동시 = 개수.
- [x] 참조 구현 — 해당 없음.
- [x] 신규 계약 SSOT·강제·seam — §10 SSOT 열 · §11 seam 열.
- [x] 부팅/등록 변경의 기존 소비처 — §12 표 4행.
- [x] producer/consumer — §12.
- [x] 상한·총량 — §14.
- [x] 게이트 ↔ subtree AGENTS — §19 가 `app/AGENTS.md` 목록을 그대로 쓴다.
- [x] 교차검증 — §3 갱신 메모 `ACTIVE 결정 ↔ AC` 충돌 0.
- [x] 문장 규칙 — 표 위주 · 판정 먼저 · Part I/II 중복은 §6-B(판정)와 §8(근거) 로 나눔.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).

## [구현자 기입] 설계 리뷰

- (구현 턴에서 채운다)

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|

### 설계 대비 명시적 차이

- (구현 턴에서 채운다)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- (구현 턴에서 채운다)

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
