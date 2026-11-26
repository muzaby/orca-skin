# Plan — 0331-transcript-feedback-followup

> 0330 기준 사용자 피드백 중 **transcript** 항목을 받는 후속 handoff다. 우측 패널 항목은 [0332](../0332-right-panel-global-depth/plan.md)가 받는다(D-001).
> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0331-transcript-feedback-followup` |
| 작성자 | Claude Code (V1) · Codex (ΔV1·ΔV2 추가 요구) |
| 일자 | 2026-11-26 |
| 매핑 | 0330 사용자 피드백(2026-11-26) · 형제 handoff 0332 |
| 상태 | DRAFT — 추가 요구와 직전 계획 리뷰 보완을 합친 뒤 READY 재판정 |
| V mode | `Delta V` |
| 기준 V | 0331 V1 + ΔV1 (`9a7bc5a5`, 기존 세션 첫 화면) |
| 이번 V revision | `ΔV2` — 최초 배치와 보이는 스크롤 이동 |
| 유효 V | `V1 + ΔV1 + ΔV2` |
| 기준 트리 | `18b5d5f`(0330 verify 3의 앱 코드) |

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 실제 사용에서 transcript가 도구를 묶지 못하고, 큰 응답을 버튼 뒤에 숨기며, 이전 대화를 버튼·제스처로만 불러오고 그때 화면이 깜빡인다. 간격·줄 수 표시·크기별 원문 표시도 어긋난다.
- 완료 후 달라지는 것: 도구는 한 묶음으로, 큰 응답은 자동으로 정상 렌더된다. 기존 세션은 최신 5턴의 하단으로 열린다. 화면에 보이는 위치를 옮겨야 하면 부드럽게 이동하고 최상단에 닿으면 이전 5턴이 자동으로 깜빡임 없이 붙는다. 마크다운은 크기와 무관하게 마크다운이다.
- 성공을 사용자 관점에서 한 문장으로: 스크롤만 하면 대화 전체를 끊김·깜빡임·버튼 없이 읽을 수 있고, 도구·간격·줄 수가 일관되게 보인다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | “어시스턴트 메시지 버블에서 도구 그룹으로 묶여있지 않는 사례 발견. 항상은 아님.” | 사용자 피드백 2026-11-26 |
| 명시 요구 | “세션을 열었을 때, 어시스턴트의 답변이 '메시지 본문 열기' 버튼으로 대체돼있는 경우 발견. 왜 도입했는지? 제거하고 정상 렌더링 할 것.” | 같음 |
| 명시 요구 | “transcript 최상단 이동 시 '이전 부분 보기', '대화 시작' 버튼/상태 표시를 제거하라. 단 현재 출력되는 이전 대화 로드에 대한 스피너 표시 정책은 유지.” | 같음 |
| 명시 요구 | “transcript 최상단 이동 시 이전 대화가 있는 경우 로드가 자동으로 트리거 돼야 함. 또한 로드 시 본문 재렌더링 과정에서 플리커 발생 … 맞든 아니든 이런 플리커는 있어서는 안 됨.” | 같음 |
| 명시 요구 | “work 모드 … 도구 그룹이 펼쳐졌을 때 … 셸 아이콘 바로 위에 dot 아이콘이 모호한 위치에서 불필요하게 붙어서 출력 … 제거할 것.” | 같음 |
| 명시 요구 | “응답 중단(에러) 메시지가 연속된 턴으로 출력할 경우, 에러 메시지버블 상하 간격이 일관적이지 않고 점점 커짓는 경향성 발견. 수정할 것.” | 같음 |
| 명시 요구 | “도구 사용 시, 도구 간 상하 간격이 넓음. 그리고 위쪽 마진이 아래쪽보다 좁음.” | 같음 |
| 명시 요구 | “아티팩트 카드 클릭 시, 파일이 없어 에러가 발생 … 운영 db를 dev 환경에서 실행한 것이라 실패한 것일 수 있음. 검토 필요.” | 같음 |
| 명시 요구 | “'업데이트됨' 도구에서 몇 라인이 추가/삭제 됐는지 표시 안되고 있음. E.g., '업데이트됨 <파일명> +654'” | 같음 |
| 명시 요구 | “세션 열기 시 로드(렌더링)하는 본문 단위를 한 턴이 아닌 5개 턴으로 변경. 웹워커 5000라인? 이내만 마크다운 표시 정책 제거.” | 같음 |
| 명시 요구 | 질의 답 — 5턴: “열기와 상단 로드 모두” · 마크다운: “셋 모두 제거”(선택지 설명 “크기와 무관하게 항상 마크다운으로 그린다”) | 이번 턴 AskUserQuestion |
| 추가 명시 요구 | “기존 세션을 열때 메시지 로드 후 메시지 오프셋으로 화면을 고정하는데 플리커처럼 동작함. 이것도 제거.” | 사용자 추가 피드백 2026-11-26 |
| 추가 명시 요구 | “모든 gui 상태 변화는 트랜지션( smooth) 으로 렌더링 … 시작위치 고정을 위해 스크롤 바 위치 변경 움직임 까지도.” | 사용자 추가 피드백. 앱 공통 기준은 [디자인 시스템 §7](../../arch/frontend/design-system.md#앱-전체-gui-전환-원칙) |
| 추론 의도 | 점 아이콘은 **공백뿐인 text가 만든 빈 메모 행**의 점이다. 공백 아닌 메모의 점·아이콘 없는 도구의 점은 유지한다 — 추론 | §8 R5: 빈 메모 행 높이 16px에 점 20px(`top-2.5`)이 다음 행 위로 겹친다 |
| 추론 의도 | 상단 머리의 오류 상태 ‘다시 시도’와 아래 끝(다음 부분·대화 끝·최신 대화로)은 피드백 대상이 아니라 유지한다 — 추론 | 피드백이 명시한 문구가 ‘이전 부분 보기’·‘대화 시작’뿐 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 피드백을 두 handoff로 나눈다 — transcript는 0331, 우측 패널(전역·트랜지션·depth·그리드 제거)은 0332 | 두 영역은 파일·검증 수단이 겹치지 않고 합치면 AC가 25를 넘는다(SKILL §5) | 설계자 · 사용자 “후속 핸드오프로 대응하라” | ACTIVE | — |
| D-002 | 한 화면 턴(사용자 입력 사이) 안에서 **보이는 내용 없이 이어지는 도구 호출**은 assistant 메시지 경계와 무관하게 한 도구 그룹이다. 보이는 내용 = 공백 아닌 text · 보이는 reasoning · 질문 · 오류 · 압축/분기 경계 · 서브에이전트 통지 | “도구 그룹으로 묶여있지 않는 사례 … 항상은 아님” — 원인 2개(§8 R1·R2) | 사용자 피드백 | ACTIVE | — |
| D-003 | 공백뿐인 text part는 보이는 내용이 아니다 — 세그먼트·메모·live 표시를 만들지 않는다. 앞 세그먼트가 text면 그 원문에 이어 붙인다 | R1·R5의 공통 원인. “dot 아이콘이 … 불필요하게 붙어서 출력 … 제거할 것” | 사용자 피드백 + 설계자 | ACTIVE | 0325 EP-2 ① `hasSegmentText = text !== ''` 대체 |
| D-004 | ‘메시지 본문 열기’ 버튼을 없앤다. 본문이 한 응답 한도(0329 D-007)를 넘어 참조로 온 메시지는 창이 자동으로 조각을 받아 정상 렌더한다. 받는 동안 그 자리에 스피너(버튼 아님), 실패하면 오류 문구 + 다시 시도 | “제거하고 정상 렌더링 할 것.” 실패 표시는 설계자 기본값 | 사용자 피드백 | ACTIVE | 0329 §10 본문 ‘본문 열기’ 버튼 대체 |
| D-005 | 상단 머리에서 ‘이전 부분 보기’·‘대화 시작’·당김 문구(‘이전 부분 불러오기’)를 없앤다. 로드 중 스피너는 유지한다. 머리 슬롯은 모든 상태에서 같은 높이다. 오류 상태의 ‘다시 시도’는 유지한다 | “버튼/상태 표시를 제거하라. 단 … 스피너 표시 정책은 유지.” 고정 높이는 0329 D-019 | 사용자 피드백 | ACTIVE | 0329 D-016의 당김 표시 대체 |
| D-006 | 일반 보기·검색 보기의 위 끝 머리 슬롯이 뷰포트에 닿으면(스크롤바·휠·키·내용이 뷰포트보다 짧음) 이전 대화가 있을 때 자동으로 읽는다. 진행 중이면 더 요청하지 않는다 | “최상단 이동 시 이전 대화가 있는 경우 로드가 자동으로 트리거 돼야 함” | 사용자 피드백 | ACTIVE | 0329 D-003 “위 방향 한 조작에 한 번” 대체 |
| D-007 | 앞삽입·앵커 보정 중 화면이 깜빡이지 않는다 — 응답 commit 직전 프레임부터 정착까지 매 프레임 읽던 글줄의 화면 top 변화 ≤ 1px | “맞든 아니든 이런 플리커는 있어서는 안 됨.” 0329 AC3′는 정착 뒤만 쟀다 | 사용자 피드백 | ACTIVE | 0329 D-016 ±1px를 매 프레임으로 강화 |
| D-008 | 로드 단위는 5턴이다 — 세션 열기(최신)와 상단 로드(이전) 모두. 한 응답 한도(메시지 128·part 256·256 KiB)는 유지하고, 넘치면 같은 5턴 단위 잔여를 유휴 채움이 이어 읽는다. 단위가 끝나면 자동 연쇄를 멈춘다(최상단 자동 로드는 D-006) | “한 턴이 아닌 5개 턴으로 변경” + 답 “열기와 상단 로드 모두” | 사용자 피드백 + 질의 | ACTIVE | 0329 D-002(조회 단위 1턴) 대체 · D-009 범위를 같은 턴 → 같은 단위로 확장 |
| D-009 | 마크다운의 크기별 원문 표시를 전부 없앤다 — 블록·각주 문서·스트리밍 꼬리 50,000자 초과, 결과 노드 20,000개 초과, 표 2,000행 초과·열 500 초과·머리+한 행 50,000자 초과 모두 마크다운으로 그린다. 파싱 위치 임계(4,000자)와 표 200행 조각 분할은 유지 | 답 “셋 모두 제거” · 선택지 설명 “크기와 무관하게 항상 마크다운으로 그린다” | 질의 | ACTIVE | 0327 D-033 원문 표시 · D-045 노드 예산·열/행 원문 · D-035·D-054 꼬리 원문 대체 |
| D-010 | 연속 오류 턴의 인접 오류 버블 세로 간격은 모두 같다 | “상하 간격이 일관적이지 않고 점점 커짓는 경향” | 사용자 피드백 | ACTIVE | — |
| D-011 | Claude 투영의 도구 간격 — Code 도구 블록의 위·아래 간격을 같게(12px), 그룹 안 카드 사이를 4px로, Work 도구 행 사이를 8px로 줄인다 | “도구 간 상하 간격이 넓음 … 위쪽 마진이 아래쪽보다 좁음.” 수치는 설계자 기본값 | 사용자 피드백 | ACTIVE | — |
| D-012 | 수정 도구 카드 머리의 +N/−M은 크기와 무관하게 표시한다 — Write는 내용 줄 수, Edit·MultiEdit·OpenCode patch는 창 동기 한도 안이면 창, 넘으면 워커가 같은 규칙으로 센다 | “+라인수 표시가 안 된 것을 발견. 수정할 것.” 원인 R11 | 사용자 피드백 | ACTIVE | — |
| D-013 | 아티팩트 카드 ‘파일 없음’은 코드 결함이 아니다 — dev 실행은 산출물 루트가 `artifacts/.dev`로 갈라져 운영 DB의 파일을 찾지 않는다. 코드 변경 없음 | “검토 필요.” 근거 R12 | 사용자 피드백 + 조사 | ACTIVE | — |
| D-014 | 기존 세션의 첫 본문 프레임에서 항상 최신 하단에 즉시 배치 | ΔV1의 최초 열기 규칙 | 사용자 피드백에 대한 ΔV1 해석 | SUPERSEDED | ΔV2 D-015. 실제로 보이는 시작 위치에서 이동할 때는 smooth 전환 |
| D-015 | 기존 세션을 열 때 준비된 본문은 부드럽게 나타난다. 이미 표시 중인 대상 세션의 위치가 목표 하단과 다르면 스크롤바와 본문이 함께 하단까지 연속 이동한다. 표시 중인 시작점이 없거나 이미 하단이면 그 자리에서 나타난다 | 오프셋 고정 시 보이는 점프 제거와 스크롤바 이동의 smooth 전환을 함께 충족 | 사용자 추가 피드백 | ACTIVE | D-014 대체. 앞삽입 중 읽던 글줄은 D-007 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-013(신규 handoff).
- 변경된 결정(앞선 handoff): 0329 D-002·D-003·D-016(당김 표시)·0329 §10 ‘본문 열기’ · 0327 D-033·D-035·D-045·D-054의 원문 표시 · 0325 EP-2 ① — 대체 근거는 각 행 `대체 관계`.
- 유지되는 앞선 결정: 0329 D-007(응답 한도) · D-019(고정 머리) · D-021(앵커 함수) · D-015(검색 보기 양방향, 위 끝만 D-006 적용) · 0327 D-019(4,000자 파싱 위치) · 0326 VP-16(증분 = 전체 재구성).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-002↔AC1 · D-003↔AC1·AC2 · D-004↔AC3 · D-005↔AC4 · D-006↔AC5 · D-007↔AC6 · D-008↔AC7 · D-009↔AC8 · D-010↔AC9 · D-011↔AC10 · D-012↔AC11 · D-013↔§4(AC 없음 — 코드 변경 0) · D-001↔§6. ΔV2에서 D-015↔AC12로 갱신.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 도구 그룹 누락의 원인 | 원인 2개 — 공백 text 분절(R1)과 메시지 경계(R2) | `parts.ts:113` `text !== ''` · `persistence-sender.ts:213` 텔레메트리마다 메시지 키 재발급 → `claudeBlocks.ts:491` 메시지별 블록 |
| ‘본문 열기’는 왜 도입했나 | 0329 D-007 응답 한도(256 KiB·part 256)를 넘는 **한 메시지**를 페이지에 담지 못해 참조로 보내고 사용자가 열게 했다 | `history-page.ts:246-257` · 0329 plan §10 본문 · 긴 에이전트 턴의 assistant 메시지 하나가 part 256을 넘기 쉽다 |
| 상단 자동 로드는 이미 되는가 | 아니오 — 머리에서 **추가** 휠·PageUp/Home·버튼만 요청한다 | `TranscriptViewport.tsx:702-738` `canConsumeScroll` 실패 때만 · 스크롤바 드래그는 요청 0 |
| 플리커 원인 | 측정 보정이 다음 프레임 rAF로 미뤄져 어긋난 프레임이 한 번 그려진다(H1). 가상 행 위치 반영의 비동기 재렌더(H2)는 구현 첫 단계에서 프레임 기록으로 확인한다 | `TranscriptViewport.tsx:472-482` `scheduleAnchorRestore` = `requestAnimationFrame` |
| 점 아이콘 원인 | 공백 text가 Work 메모 행을 만든다 — 행 내용 높이 0 + `py-2`에 점이 `absolute top-2.5 h-5`라 다음(셸) 행 위로 겹친다 | `WorkActivity.tsx:121-133` · `workActivity.ts:337-340` |
| 도구 간격 원인 | 도구 블록 위 8px, 다음 블록 16px — “위쪽 < 아래쪽” 그대로다 | `claudeBlocks.ts:559-566` · 마크다운 첫/끝 margin 0(`typography.ts:2`) |
| 연속 오류 간격 원인 | 미재현 — 간격을 만드는 자리를 전수 고정하고(§10 EP-9) 구현 첫 단계가 실측으로 가른다 | 블록 gap 자리 39줄 · footer `pt-*` · 예약 여백 `TranscriptViewport.tsx:885-898` |
| 줄 수 미표시 원인 | 창 동기 한도(400줄·64,000자)를 넘으면 `null` | `inline.ts:41-48` · 654줄 Write → `null` |
| 아티팩트 ‘파일 없음’ | **코드 결함 아님**(D-013) | `data-host/bootstrap.ts:694` 루트 `~/.config/orcinus-orca/artifacts/.dev`(DEV) · `files.ts:263-269` `relativePath = <id>/<파일명>` |
| 더 작은 해법 | 5턴은 창의 연쇄 요청 대신 data 호스트 조회 범위로 낸다 — 열기 첫 응답이 5턴이라 앞삽입 4회·깜빡임이 없다 | §9 |
| ACTIVE·채택 결정 충돌 | 0329·0327·0325 결정 일부를 사용자 결정으로 대체(§3 대체 관계) · 0324 D-008 “상한 없는 계산을 UI 스레드에 두지 않는다”와 D-009가 긴장한다(§17) | 0327 plan D-033·D-045 |

- 사용자에게 올릴 결정: 없음(이번 턴 질의로 닫음 — D-008·D-009).
- 코드 조사로 닫은 사실: R1~R12(§8).

## 5. 동작 / 사용자 흐름

```text
세션 열기
  → 최신 5턴 표시(한도 초과면 한도 직전까지 → 유휴마다 같은 단위 잔여)
  → 큰 본문 메시지: 그 자리 스피너 → 자동 조각 수신 → 정상 렌더
  → 위로 스크롤해 머리 슬롯이 보임 → 머리 스피너 → 이전 5턴 앞삽입(깜빡임 0)
  → 대화 시작에 닿으면 머리는 빈 고정 슬롯(문구 0)
  ↘ 이전 대화 실패: 머리 ‘다시 시도’ · 본문 실패: 그 자리 오류 + ‘다시 시도’
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 기존 세션 열기 | 캐시 또는 `latest`로 최신 5턴 진입 | 실제로 표시 중인 대상 세션의 시작 위치가 있으면 부드럽게 하단으로 이동. 처음 그리는 본문은 하단에서 등장(AC12) |
| 첫 응답이 5턴을 다 담지 못함 | 유휴마다 `withinUnit` 1회 | 위쪽에 같은 단위 메시지가 깜빡임 없이 붙는다 |
| 머리 슬롯이 뷰포트 안 · before = ready | `earlierTurn` 1회(이전 5턴) | 머리 스피너 → 앞삽입, 읽던 글줄 고정 |
| 머리 슬롯 안 · before = loading | 요청 0 | 스피너 유지 |
| before = end | 요청 0 | 빈 고정 슬롯 |
| before = error | 자동 요청 0 | ‘다시 시도’ 버튼 |
| 메시지에 본문 참조 | 페이지 반영 직후 자동 본문 요청 | 스피너 → 본문 |
| 본문 요청 실패 | 자동 재요청 0 | 오류 문구 + ‘다시 시도’ |
| 세션 전환·세대 변경 중 응답 도착 | 지각 응답 버림(0329 세대 규칙) | 다른 세션 화면 불변 |

### 파생 UX / 엣지케이스

- loading / empty / error: 위 표. 이력이 5턴 미만이면 첫 응답이 전부다.
- cancel / retry / close / restart: 세션 전환은 진행 중 이력·본문 요청 결과를 버린다(0329 세대). 재시도는 버튼 1회 = 요청 1회.
- concurrency / multi-session: 비활성 세션은 자동 요청 0(`readPrevious`의 활성 키 조건 유지).
- keyboard / a11y: 머리 스피너는 `role="status"`·접근성 이름 ‘대화 불러오는 중…’. 본문 스피너도 같다. 오류 ‘다시 시도’는 버튼.
- 큰 입력: 마크다운은 크기와 무관하게 파싱하므로 큰 블록은 워커 점유가 길어진다(§14).

## 6. 범위 / 비범위

- **범위**: §2 명시 요구 중 기존 transcript 피드백과 추가 요구 D-015(아티팩트는 조사 결론만 — D-013).
- **비범위**: 우측 패널 5건(0332) · 아래 끝(다음 부분·대화 끝·최신 대화로) · OpenCode 도구 간격(D-011은 Claude 투영) · 완료 본문의 창 동기 `<Markdown>` 파싱(후보 표 0327 D-026 행 — 표시 정책이 아니라 파싱 위치) · 아티팩트 dev/prod 공유.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 완료 본문 워커 이주 | 아니오 | 후보 표 유지 |
| dev에서 운영 산출물 열기 | 아니오 — 개발 격리 의도 | D-013 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | Code 투영에서 한 화면 턴 안 도구 A·B·C가 (a) 사이에 공백뿐 text, (b) assistant 메시지 경계(자동 연속 응답), (c) 중복 제거로 빈 도구 세그먼트를 두고 이어지면 **그룹 1개(헤더 “… 3개”)**다. 사이에 공백 아닌 text·보이는 reasoning·질문·오류·경계가 있으면 나뉜다 | 블록 모델: tools 블록 1개·`calls` = [A,B,C] / 분리 입력 5종은 블록 2개 · 렌더: `ClaudeToolGroup` 헤더 수 1 | 메시지 → `createClaudeBlockModel.advance` → `Timeline` → `ClaudeAssistantSegment` → `ClaudeToolGroup` |
| R-02 | AT-02 / AC2 | Work 펼침 목록에서 공백뿐 text는 메모 행·점을 만들지 않고 `noteCount`에 들지 않는다. 공백 아닌 메모는 점과 함께 남는다 | `[data-work-note]` 0 · 셸 행 위 점 0 / 메모 입력은 1 | 메시지 → `createWorkProjector` → `ActivityDisclosure` |
| R-03 | AT-03 / AC3 | 본문 참조 메시지가 든 페이지를 열면 버튼 없이 자동으로 본문을 받아 원래 자리에 정상 렌더한다. 받는 동안 그 자리에 스피너(`button` 0), 실패하면 오류 문구 + ‘다시 시도’, 성공 뒤 이웃 메시지 순서 불변. 세션 전환 뒤 도착한 본문은 버린다 | 요청 1회·버튼 0·성공 본문 텍스트 / 실패 재시도 1회 / 전환 뒤 화면 불변 | 페이지 commit → `chatStore` 자동 본문 → `sessionApi.page(body)` → `RESOLVE_HISTORY_BODY` → 블록 → 렌더 |
| R-04 | AT-04 / AC4 | 부분 이력 머리에 ‘이전 부분 보기’·‘대화 시작’·‘이전 부분 불러오기’ 문구·버튼이 없다(ready·end·당김 상태 텍스트 0·`button` 0). loading은 스피너만, error는 ‘다시 시도’ 버튼. 슬롯 높이는 네 상태 모두 같다 | 상태별 렌더 텍스트·버튼 수·클래스 | `useHistoryControls` → `TranscriptViewport` → `HistoryEdge` |
| R-05 | AT-05 / AC5 | 머리 슬롯이 뷰포트 안이면(`scrollTop ≤ 머리 높이` 또는 스크롤 불가) before = ready일 때 요청 1회. loading 중 0, end 0, error 0(버튼만), 슬롯 밖 0. 스크롤바 드래그로 닿아도 같다. 검색 보기 위 끝도 같다 | 스크롤 위치별 `request('before')` 호출 수 | 스크롤/commit → `TranscriptViewport` 상단 판정 → `controls.request` → `readPrevious`/`readSearchEdge` |
| R-06 | AT-06 / AC6 | 이전 5턴 앞삽입(행 높이가 추정 140px와 다른 행 포함)에서 응답 commit 직전 프레임부터 정착(연속 10프레임 무변화)까지 **매 프레임** 읽던 글줄 top 변화 ≤ 1px. 3 transcript 화면 · 자동 트리거(휠 없음)와 휠 트리거 둘 다 | Electron 실기 프레임 기록 — 프레임별 글줄 top | 실제 Chromium → production `TranscriptView` |
| R-07 | AT-07 / AC7 | 열기 첫 응답 = 최신 5턴(한도 안이면 5턴 전부, before `earlierTurn`). 한도 초과면 한도 직전까지 + before `withinUnit`, 유휴마다 같은 단위 잔여 1묶음, 5번째 턴 첫 메시지까지 채우면 before `earlierTurn`이고 자동 연쇄 0. 상단 로드 1회 = 이전 5턴 단위(같은 규칙). 5턴 미만이면 전부·before 없음 | data 응답 메시지 ID 목록·경계 종류·응답 수 / 창 자동 요청 수 | `sessionApi.page` → data `history-page` → 창 `readPrevious`·유휴 훅 |
| R-08 | AT-08 / AC8 | 50,001자 블록 · 노드 20,001 · 표 2,001행 · 열 501 · 머리+한 행 50,001자 · 각주 문서 50,001자 · 스트리밍 꼬리 50,001자가 모두 hast로 렌더된다 — `data-md-block-raw`·`data-markdown-tail="final"` 0, 워커 결과에 `tooLarge` 형 없음 | 워커 파서 결과 형 · 블록 분류 `raw` false · 렌더 표지 | `computeClient` → 워커 `markdownBlock` → `VirtualMarkdownView`/`WorkerMarkdownTail` → `MarkdownHast` |
| R-09 | AT-09 / AC9 | 연속 오류 턴 6개(Code·Work · 저장된 error part · 응답 중단 status · 열기 후와 실시간 전송 후)에서 인접 오류 버블 사이 세로 거리가 모두 같다(±1px) | Electron 실기 DOM 거리 | production `TranscriptView` |
| R-10 | AT-10 / AC10 | Code: 도구 블록 위 간격(앞 블록 끝→도구 위) = 아래 간격(도구 끝→다음 블록 위) = 12px(±1). 그룹 안 카드 사이 4px. Work: 도구 행 사이 8px | Electron 실기 DOM 거리 + 블록 gap 값 | production `TranscriptView` |
| R-11 | AT-11 / AC11 | Write 654줄 → 머리 “+654”. 400줄·64,000자를 넘는 Edit·MultiEdit·OpenCode patch도 워커 결과로 +N/−M 표시(계산 중 빈 칸 → 도착 후 표시). 수치는 동기 경로와 같은 규칙(`diffLines` 줄 수) | 카드 머리 텍스트 · 동기/워커 결과 대조 | `ToolCard`/OpenCode 파일 카드 → `toolDiffStat` → (초과) `computeClient` → 워커 |
| R-12 | AT-12 / AC12 (ΔV2) | 대상 세션의 표시 위치가 목표와 다르면 실제 본문·스크롤바가 중간 위치를 거쳐 최신 하단에 정착한다(오차 ≤ 1 CSS px). 처음 그리는 본문은 하단에서 등장한다. 점프·빈 프레임·이전 세션 재노출 0회. 사용자 입력 시 이동 취소, 축소 모션은 즉시 정착 | Electron `openFrames`에서 가시 글줄·실제 scrollTop·표시 진행률을 매 프레임 기록(§10-A) | 이력 목록 → `chatActions.loadSession` → 하네스 제어기 → 공통 뷰포트 |

### AC 검증 주의사항

- 기존 테스트 재사용: `HistoryEdge.test.ts`·`TranscriptViewport.body.test.ts`·`scripts/transcript-history/scenarios.mjs` `states`는 지금 문구·버튼을 단언하므로 **새 기대로 고친다**(구 기대 유지는 이행 결함).
- 사람 실기 항목: 없음. AC6·AC9·AC10·AC12는 레이아웃이라 jsdom이 아니라 Electron 실기 스크립트로 잰다 — 에이전트가 띄울 수 있는 목표 런타임이다(Electron 바이너리 없으면 exit 3 → 그 AC는 미판정, 환경 서명으로 분리).
- N회 기준: AC5 “요청 1회”의 sink는 `controls.request` — 호출부 `TranscriptViewport.tsx` 안 휠·키·상단 판정 셋(§10 EP-5). AC7 응답 수 sink는 `sessionApi.page` — 창 호출부 `readPrevious`·`readSearchEdge`·`loadSession`·`openSearchHit`(§10 EP-7).
- 0건 기준: AC4 문구 0은 렌더 텍스트를 상태별로 단언한다(키 존재 검색이 아니다). AC8 `raw` 0은 입력 7종 각각의 양성(hast 렌더) 단언과 짝짓는다.

## 7-A. V / Trace Matrix

- V1은 Baseline V다. ΔV1은 R-12·AT-12와 VP-27을 추가하고 SD-01·ST-01의 열기 구간(VP-12)을 확장한다. ΔV2는 같은 R-12·AT-12·SD-01·ST-01 및 VP-12·27의 기준을 아래와 같이 갱신한다.
- 기준 V 상속 근거: 없음. 회귀 노드는 앞선 plan·테스트를 출처로 `INHERITED` 표기한다.
- `SUPERSEDED` 이관: 해당 없음(Baseline).
- 변경이 시작되는 수준: Baseline이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01~R-11 | R | §7 각 행 | NEW | — |
| R-12 · AT-12 | R · AT | 최초 표시 및 시작 위치에서 하단까지의 전환 | CHANGED (ΔV2) | ΔV1 AC12 · 0326 D-057·D-074 |
| AT-01~AT-11 | AT | §7 각 행 | NEW | — |
| R-R1 | R | 검색 보기 양방향 읽기·최신 합류·아래 끝 버튼 | INHERITED | 0329 D-015 · `history-search.test.ts` |
| R-R2 | R | 4,000자 이하는 창 파싱, 초과는 워커 | INHERITED | 0327 D-019 · `StreamingMarkdown`·`ArtifactPreviewContent` |
| SD-01 | SD | 최신 5턴 하단 진입(최초 표시 또는 smooth 이동) → 단위 채움 → 최상단 자동 → 앞삽입 → 시작 | CHANGED (ΔV2) | §5 · §10-A |
| SD-02 | SD | 큰 본문 수명: 페이지 반영 → 자동 요청 → 스피너 → 교체/오류·재시도 → 세대 폐기 | NEW | §5 |
| AR-01 | AR | data `session/page` 5턴 단위 — `latest`·`earlierTurn`·`withinUnit` 조회 범위·경계·커서 | NEW | §9·§10 EP-7 |
| AR-02 | AR | 창 store ↔ history port — 단위 유휴 채움 판정·자동 본문 요청 | NEW | §9·§10 EP-3·EP-7 |
| AR-03 | AR | 워커 `markdown` 결과 계약 = hast만 | NEW | 0327 D-033 원문 계약 대체 |
| AR-R1 | AR | 증분 블록 모델 = 전체 재구성 | INHERITED | 0326 VP-16 · `blockModelCatchup.test.ts` |
| MD-01 | MD | 세그먼트 공백 text 투명 규칙 | NEW | §10 EP-1 |
| MD-02 | MD | Code 투영 턴 안 도구 연속 병합 | NEW | §10 EP-2 |
| MD-03 | MD | 머리 슬롯 렌더(스피너·오류만) | NEW | §10 EP-4 |
| MD-04 | MD | 상단 도달 판정 + 같은 프레임 앵커 보정 | NEW | §10 EP-5·EP-6 |
| MD-05 | MD | 마크다운 블록 분류·파서·꼬리의 원문 폴백 제거 | NEW | §10 EP-8 |
| MD-06 | MD | 블록 간격 값 | NEW | §10 EP-9·EP-10 |
| MD-07 | MD | 수정 도구 증감 수 | NEW | §10 EP-11 |

### Pair registry

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | 메시지 → 블록 모델 → `Timeline` → `ClaudeToolGroup` | 신규 `claudeBlocks.test.ts` `AC1 groups a tool run across whitespace text, message boundary and deduplicated segment` — 입력 (a)(b)(c) 각각 tools 블록 1개 · 분리 입력 5종(공백 아닌 text·reasoning·Ask·error·compact) 각각 2개 · 신규 `Timeline.viewport.test.ts` `AC1 renders one group header for a cross-message tool run` | not selected — 직접 행동 단언 | EP-1(8) · EP-2(5) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | 메시지 → `createWorkProjector` → `ActivityDisclosure` | 신규 `workActivity.test.ts` `AC2 whitespace text forms no note between tools`(`noteCount` 0 · 공백 아닌 메모 입력은 1) · `WorkActivity.render.test.ts` `AC2 renders no note dot above the shell row`(`[data-work-note]` 0) | not selected | EP-1(8) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | 페이지 commit → 자동 본문 → `RESOLVE_HISTORY_BODY` → 렌더 | `TranscriptViewport.body.test.ts` 고침 `AC3 loads a deferred body without a button and renders it in place`(버튼 0·요청 1·본문 텍스트·이웃 순서) · `AC3 shows retry only after a failed body`(실패 → 버튼 1 → 재요청 1) · `AC3 drops a body that arrives after a session switch` | required — 자동 요청 호출 제거 변이(EP-3 ②)가 버튼 0 단언만으로 green이 되지 않음을 본다(요청 1·본문 텍스트 단언) | EP-3(9) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | `useHistoryControls` → `HistoryEdge` | `HistoryEdge.test.ts` 고침 `AC4 renders no label in ready, end and pull`(상태 3 × 텍스트 0·버튼 0) · `AC4 renders only a spinner while loading` · `AC4 keeps retry in error` · `AC4 keeps one height class in every state` | not selected | EP-4(3) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | 스크롤/commit → 상단 판정 → `controls.request` | 신규 `TranscriptViewport.history.test.ts` `AC5 requests once when the head enters the viewport` — 입력: scrollTop 0 · 머리 높이 정확히 · 머리 높이 +1(요청 0) · 스크롤 불가 내용 · before = loading/end/error 각 0 · 검색 보기 위 끝 | required — 판정 비교 `≤`→`<` 변이(머리 높이 정확히 입력 red) | EP-5(5) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | Chromium 실기 → `TranscriptView` 3화면 | `gate:xvfb-run -a node scripts/check-transcript-history.mjs` 신규 시나리오 `frames`(자동 트리거)·`framesWheel` — 프레임별 top 변화 최대 ≤ 1px, 3화면 × 5회 | required — EP-6 ① 보정을 rAF로 되돌린 변이가 `frames`를 red로 만드는지(H1 방향 확인) | EP-6(7) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | `sessionApi.page` → data → 창 | `turn-page.db.test.ts` 신규 `AC7 latest returns five turns` · `AC7 continues the unit with withinUnit and stops at earlierTurn` · `AC7 earlierTurn reads the previous five turns` · `AC7 fewer than five turns returns all` · 창 `useHistoryControls.test.ts` 신규 `AC7 idle fill continues withinUnit and stops at earlierTurn` | required — 단위 하한 조회의 OFFSET을 0으로 바꾼 변이(1턴으로 회귀) | EP-7(12) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | 워커 → 블록/꼬리 → `MarkdownHast` | 신규 `shared/compute/worker/markdown.test.ts` `AC8 parses beyond 50,000 chars and 20,000 nodes` · `markdownDocumentBlocks.test.ts` 고침 `AC8 never marks a block raw`(입력 7종 중 블록 5종) · 신규 `WorkerMarkdownTail.test.ts` `AC8 parses a 50,001-char tail` · `ArtifactPreviewContent.virtual.test.ts` 고침 `AC8 renders a 2,001-row table as one table` | not selected — 입력 7종 양성 단언 | EP-8(9) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | Chromium → `TranscriptView` | `gate:xvfb-run -a node scripts/check-transcript-history.mjs --layout` 신규 시나리오 `errorRun`(Code·Work × 저장·실시간 · 6턴) — 인접 거리 최대−최소 ≤ 1px | required — 구현이 찾은 원인 자리를 되돌린 변이가 `errorRun`을 red로 만드는지 | EP-9(21) |
| VP-10 | R-10 ↔ AT-10 | REQUIRED | Chromium → `TranscriptView` | 같은 스크립트 `--layout` 신규 `toolSpacing` — Code 위·아래 12±1 · 그룹 카드 사이 4±1 · Work 행 사이 8±1 | not selected | EP-10(5) |
| VP-11 | R-11 ↔ AT-11 | REQUIRED | `ToolCard` → `toolDiffStat` → 워커 | `toolMeta.test.ts` 신규 `AC11 counts a 654-line Write as +654` · 신규 `ToolCard.interaction.test.ts` `AC11 shows a worker stat for an oversized Edit`(계산 중 빈 칸 → 도착 후 `+N −M`) · `filePresentation` 신규 `AC11 oversized OpenCode patch` | required — Write 분기 제거 변이(+654 red) | EP-11(5) |
| VP-12 | SD-01 ↔ ST-01 | REQUIRED | 열기 → 단위 채움 → 최상단 자동 → 앞삽입 → 시작 | `gate:… check-transcript-history.mjs` 신규 `unitOpen`(열기 첫 화면 메시지 = 최신 5턴 · 자동 요청 연쇄가 단위에서 멈춤 · 최상단 자동 앞삽입 · 시작 도달 뒤 요청 0) | not selected | EP-5 · EP-7 · EP-12(열기부터 단위 채움까지 `openFrames`로 관측) |
| VP-13 | SD-02 ↔ ST-02 | REQUIRED | 페이지 → 자동 본문 → 교체 | `history-port.integration.test.ts` 고침 `AC3 resolves a deferred body without user action`(data 포트 실제 조각 · 창 store) | not selected | EP-3 |
| VP-14 | AR-01 ↔ IT-01 | REQUIRED | 창 transport → data handler → 색인 | `history-port.integration.test.ts` 신규 `AC7 five-turn unit over the history port`(zod 왕복 · `withinUnit` 커서 왕복 · 위조 커서 `invalid`) | required — `readCursor`의 하한 검사 제거 변이(위조 하한 입력 red) | EP-7 |
| VP-15 | AR-02 ↔ IT-02 | REQUIRED | store ↔ port | `history-search.test.ts` 신규 `AC7 search view top reads a five-turn unit` · VP-13 좌표 | not selected | EP-3 · EP-7 |
| VP-16 | AR-03 ↔ IT-03 | REQUIRED | `computeClient` → 워커 → 결과 | `shared/compute/client.test.ts` 신규 `AC8 markdown result carries hast for an oversized block`(실제 워커 처리기 · 결과 크기 계산 `resultSize`) | not selected | EP-8 |
| VP-17 | MD-01 ↔ UT-01 | REQUIRED | `segmentForPart`·`messageSegments`·`segmentCache` | `parts.test.ts` 신규 `D-003 whitespace text is transparent`(분기 3: 앞 text → 이어붙임 원문 보존 · 앞 tools → 0 · 앞 없음 → 0) · `segmentCache.test.ts` 신규 `D-003 incremental equals messageSegments with whitespace parts`(무작위 200열 대조) · `chatStore.liveSelectors.test.ts` 신규 `D-003 whitespace live text is not live` | required — 이어붙임 분기 제거 변이(“Hello\n\nWorld” 원문 red) | EP-1 |
| VP-18 | MD-02 ↔ UT-02 | REQUIRED | 블록 모델 전체·증분 | VP-01 좌표 + `blockModelCatchup.test.ts` VP-16에 메시지 경계 도구 열 생성 추가 | required — 증분 경로 한 곳만 병합하는 변이(EP-2 ③만 제거)가 VP-16 대조에서 red | EP-2 |
| VP-19 | MD-03 ↔ UT-03 | REQUIRED | `HistoryEdge` | VP-04 좌표 | not selected | EP-4 |
| VP-20 | MD-04 ↔ UT-04 | REQUIRED | 상단 판정·보정 | VP-05 좌표 + 신규 `TranscriptViewport.history.test.ts` `AC6 restores the anchor inside the measurement callback`(rAF 미호출 상태에서 scrollTop 보정 완료) | required — 보정 경로를 rAF로 되돌린 변이 | EP-5 · EP-6 |
| VP-21 | MD-05 ↔ UT-05 | REQUIRED | 블록 분류·파서·꼬리 | VP-08 좌표 | not selected | EP-8 |
| VP-22 | MD-06 ↔ UT-06 | REQUIRED | 블록 gap 값 | 신규 `claudeBlocks.test.ts` `AC10 tool block gap is symmetric`(text→tools 12 · tools→text 12 · tools→ask 12) | not selected | EP-10 |
| VP-23 | MD-07 ↔ UT-07 | REQUIRED | 증감 수 | VP-11 좌표 + `inline.test.ts` 신규 `AC11 worker count equals the sync count at the budget edge`(400줄 경계 양쪽) | not selected | EP-11 |
| VP-24 | R-R1 ↔ AT-R1 | REGRESSION | 검색 보기 | `history-search.test.ts` 기존 전부 green · 아래 끝 버튼 렌더(`HistoryEdge.test.ts` after) | not selected | 0 — 아래 끝 비변경 |
| VP-25 | R-R2 ↔ AT-R2 | REGRESSION | 파싱 위치 | `StreamingMarkdown`·`ArtifactPreviewContent.virtual.test.ts` 기존 4,000자 경계 green | not selected | 0 — 임계 비변경 |
| VP-26 | AR-R1 ↔ IT-R1 | REGRESSION | 증분 = 전체 | `blockModelCatchup.test.ts` `VP-16 * matches every full block after 500 sequences` | not selected | EP-2 |
| VP-27 | R-12 ↔ AT-12 | REQUIRED | 실제 `loadSession` → 하네스 진입 → 공통 뷰포트 → 가시 본문 | `check-transcript-history.mjs` 기본 `openFrames`. §10-A 입력별 중간 프레임·내용·종점·취소 확인 | 이동 거리가 있는 경로를 순간 이동으로 바꾸거나 첫 배치를 임의의 맨 위에서 시작시키면 각각 실패 | EP-12 |

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app subtree | `app/**` 변경 | `app/AGENTS.md` 로컬 확인 목록 전부(가드 6종·lint·typecheck·필터 없는 vitest·`node --test scripts/*.test.mjs`·build+smoke 2종) | 이번 변경이 유발한 실패 · 변경 파일의 가드 위반 |
| Electron 실기 스크립트 | AC6·AC9·AC10·AC12·ST-01 | `xvfb-run -a node scripts/check-transcript-history.mjs` · `--layout` | exit 1만 blocking · exit 3(바이너리 없음)은 환경 |
| 문서 인벤토리 | IPC·요청 종류 변경 | `node scripts/check-doc-inventory.mjs --check` | 재생성 누락 |
| repository | handoff 산출물 | INDEX 행·trailer 파싱 | 현재 변경만 |

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| R1 공백 text가 세그먼트를 만든다 — `text !== ''` | `app/src/renderer/src/features/chat/lib/parts.ts:113-115,150-153` |
| R2 assistant 메시지 키는 텔레메트리(턴 끝 `result`)마다 새로 발급된다 — 자동 연속 응답은 사용자 입력 없이 새 메시지가 되어 한 화면 턴에 메시지가 여럿이다 | `main/app/agent-host/persistence-sender.ts:195-213` · `main/adapters/claude/map.ts:797-799` |
| R2′ Code 투영은 메시지마다 세그먼트 → 블록을 만든다. Work 투영은 턴 단위라 이미 메시지를 넘어 묶는다 | `claudeBlocks.ts:491-603`(Code) · `:614-750`(Work) |
| R3 본문 참조는 메시지 하나가 응답 한도(256 KiB·part 256)를 넘을 때만 생긴다 | `main/features/history/history-page.ts:239-257` |
| R4 상단 요청은 머리에서 추가 휠·PageUp/Home·버튼만 | `TranscriptViewport.tsx:702-756` · `HistoryEdge.tsx:43-57` |
| R5 Work 메모 행: 점 `absolute top-2.5 h-5`, 행 `py-2`, 내용이 빈 마크다운이면 행 높이 16px | `WorkActivity.tsx:121-138` |
| R6 앵커 보정: 측정 콜백 → `scheduleAnchorRestore` → `requestAnimationFrame` | `TranscriptViewport.tsx:472-482,505-538` |
| R7 색인 조회 범위가 한 턴 — `turn=?` | `main/infra/db/history-index-queries.ts:129-142` |
| R7′ 색인 `turn` = 턴 첫 메시지의 `ordinal`(연속 정수 아님) · 턴 = user 시작 교환 | `history-index-queries.ts:328-331` · `shared/history-turn.ts:1-6` · 색인 `history_turn_order(session_id,generation,turn,ordinal)` |
| R8 마크다운 원문 폴백 7종 | `worker/markdown.ts:16,22` · `markdownDocumentBlocks.ts:29,47-52,73` · `WorkerMarkdownTail.tsx:73,89-97` · `VirtualMarkdownView.tsx:54-57,75` |
| R9 간격: tools 8 · 그 밖 16 · 첫 블록 24 · 마크다운 첫/끝 margin 0 | `claudeBlocks.ts:559-566` · `shared/ui/markdown/typography.ts:2` |
| R10 그룹 카드 사이 `gap-[var(--chat-item-gap)]`(8px) · Work 행 `py-2` | `ToolGroup.tsx:96` · `tokens.css:210` · `WorkToolTimeline.tsx:31` |
| R11 증감 수는 창 동기 한도(400줄·64,000자) 밖이면 `null` · 워커 `diffView` 모델이 `added`·`removed`를 센다 | `shared/compute/inline.ts:32-49` · `shared/compute/diffView.ts:70-92` |
| R12 산출물 루트: DEV `~/.config/orcinus-orca/artifacts/.dev`, 운영 `…/artifacts` · DB `relativePath = <id>/<파일명>` | `main/app/data-host/bootstrap.ts:692-694` · `main/features/artifacts/files.ts:263-269` · `infra/config/paths.ts:28-30` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 세그먼트 판정·병합 자리 | `rg -n "hasSegmentText\|segmentForPart\(\|extendSegment\(" app/src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*'` | 14 | 운반 9줄(8자리) · import 3 · 함수 선언 2(EP-1) |
| 본문 참조 소비 자리 | `rg -n "deferredBody\|DeferredBody\|openHistoryBody\|deferredBlock\|splitDeferred" app/src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*'` | 49 | 요청·표시 운반 10줄 · 형·보유·검증·import 39(유지) — EP-3 |
| Code 메시지 블록 생성 호출 | `rg -n "buildCodeMessageBlocks\(" …/claudeBlocks.ts` | 4 | 선언 1 · 호출 3(전체 · 증분 2) |
| 블록 gap 자리 | `rg -n "gap:\|const gap\|gap\b.*=.*\?" claudeBlocks.ts openCodeBlocks.ts deferredBody.ts` | 39 | 타입 선언 13 · 값 26 |
| `withinTurn` 자리 | `rg -n "withinTurn" app/src --glob '!*.test.*' --glob '!*.testfixture.*'` | 14 | wire 3 · data 4 · 창 7 |

### 수치 / 전칭 표현 검산

- “본문 참조는 단독 초과 메시지에서만”: `history-page.ts:244` `if (messages.length && fitsAlone) break` — 이웃이 있으면 참조 대신 응답을 끊는다. 반례 0.
- “Work는 메시지를 넘어 묶는다”: `buildWorkTurnBlocks`가 `turnMessages` 전체를 `projector`에 넘긴다(`claudeBlocks.ts:650`). Code는 `buildCodeMessageBlocks(m, …)` 메시지 단위 3호출.
- 문서 앵커: 0329 D-002·D-003·D-007·D-009·D-015·D-016·D-019 · 0327 D-019·D-033·D-035·D-045·D-054 — 각 plan의 `^| D-0..` 행으로 확인.
- 기존 테스트: `HistoryEdge.test.ts`·`TranscriptViewport.body.test.ts`·`deferredBody.test.ts`·`blockModelCatchup.test.ts`(`VP-16 %s`)·`turn-page.db.test.ts`·`history-port.integration.test.ts` 존재 확인.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01·SD-02·AR-01~03.
- 이력: `loadSession` → `page(latest)` → data가 최신 **한 턴**(R7) → 같은 턴 잔여만 유휴 채움(`withinTurn`) → 머리 추가 휠/버튼으로 `earlierTurn` 한 턴.
- 본문: 단독 초과 메시지 → 참조 → `DeferredBody` 버튼 → `openHistoryBody`.
- 보정: 앞삽입 commit 전 앵커 캡처 → 측정 콜백 → rAF 다음 프레임 보정(R6).
- 세그먼트: part 순회 → 공백 text도 세그먼트(R1) → Code 메시지별 블록(R2′).

```text
loadSession → page(latest: 1턴) → PREPEND/OPEN → blockModel(메시지별) → Viewport
머리 추가 휠 → page(earlierTurn: 1턴) → 측정 → rAF → 보정
DeferredBody 버튼 → openHistoryBody → RESOLVE_HISTORY_BODY
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 변경 후 책임: data가 5턴 단위 조회·경계를 소유(AR-01), 창은 단위 채움 판정만(AR-02). 자동 본문은 store가 페이지 반영 직후 시작한다. 상단 판정·보정은 `TranscriptViewport`가 같은 프레임 안에서 끝낸다.

```text
loadSession → page(latest: 5턴, 한도 안) ─(한도 초과)→ 유휴 page(withinUnit) … → earlierTurn 경계에서 정지
머리 슬롯 뷰포트 진입 → page(earlierTurn: 5턴) → 측정 콜백 안 보정(같은 프레임) → paint
페이지 반영 → 본문 참조마다 자동 page(body) → 스피너 → RESOLVE_HISTORY_BODY
part 순회 → 공백 text 투명 → Code 턴 단위 도구 병합 → ClaudeToolGroup
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 조회 단위 | 1턴 | 5턴 + `withinUnit` 이어 읽기 | D-008 | AR-01 / VP-07·VP-14 · `history-page.ts`·`history-index-queries.ts` |
| 상단 트리거 | 추가 휠·키·버튼 | 머리 슬롯 뷰포트 진입 | D-006 | MD-04 / VP-05 · `TranscriptViewport.tsx` |
| 보정 시점 | rAF 다음 프레임 | 측정 콜백 안(같은 프레임) | D-007 | MD-04 / VP-06·VP-20 |
| 머리 표시 | 문구·버튼 | 스피너·오류 재시도만 | D-005 | MD-03 / VP-04 · `HistoryEdge.tsx` |
| 본문 | 버튼 | 자동 · 스피너 · 실패 재시도 | D-004 | SD-02 / VP-03·VP-13 · `chatStore.ts`·`DeferredBody.tsx` |
| 세그먼트 | 공백 text 세그먼트 · Code 메시지별 | 공백 투명 · Code 턴 단위 도구 병합 | D-002·D-003 | MD-01·MD-02 / VP-17·VP-18 |
| 마크다운 | 원문 폴백 7종 | 폴백 0 · `tooLarge` 형 삭제 | D-009 | AR-03·MD-05 / VP-08·VP-16 |
| 간격 | 8/16 비대칭 | 12/12 · 4px · Work 8px | D-011 | MD-06 / VP-10·VP-22 |
| 증감 수 | 한도 밖 `null` | Write 줄 수 · 그 밖 워커 | D-012 | MD-07 / VP-11·VP-23 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `shared/history-page.ts` | `HISTORY_TURN_UNIT = 5` · `withinUnit` 요청·경계 zod | wire 형 | main·renderer transport |
| `main/features/history/history-page.ts` | 단위 하한 계산·조회·경계·커서 | 요청 → 응답 | data handler |
| `main/infra/db/history-index-queries.ts` | `unitFloor`·범위 `pageHeaders` | SQL | history-page |
| `renderer/…/store/chatStore.ts` | 단위 유휴 채움 판정 · 자동 본문 | 상태 | 훅·컴포넌트 |
| `renderer/…/components/transcript/TranscriptViewport.tsx` | 상단 판정 · 같은 프레임 보정 | DOM | Timeline 2종 |
| `renderer/…/lib/parts.ts`·`segmentCache.ts` | 공백 투명 규칙(SSOT = `appendsSegment` 판정 함수 1개) | part → 세그먼트 | 블록 모델 3종·store |
| `renderer/…/harnesses/claude/transcript/claudeBlocks.ts` | Code 턴 단위 도구 병합 | 메시지 → 블록 | Timeline |

## 10. 계약 / 타입 / 강제 지점

자리 목록의 줄 번호는 기준 트리 `18b5d5f` 기준이다. 검색 명령은 `app/`에서 실행한다.

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 · 제외 줄(사유) | 실패 의미 |
|---|---|---|---|---|---|---|
| MD-01 / VP-17·VP-01·VP-02 · **EP-1** | 공백 text 투명: 공백뿐 text part는 앞 세그먼트가 text면 원문에 이어 붙고, 아니면 세그먼트를 만들지 않는다. live text 유무도 같은 판정 | `parts.ts` 판정 함수 1개(`hasSegmentText` = `text.trim() !== ''` + 이어붙임 분기) | 창 | 8자리 — ① `parts.ts:113` 판정 정의 ② `parts.ts:130` `messageSegments` 세그먼트 산출 ③ `parts.ts:133` 병합/새 세그먼트 분기 ④ `parts.ts:152` text 분기 ⑤ `segmentCache.ts:182` 증분 산출 ⑥ `segmentCache.ts:192` 증분 병합 ⑦ `chatStore.ts:3440` live text ⑧ `openCodeBlocks.ts:296` + `projection.ts:38`(OpenCode text 행·live — 한 자리 문장 2항) | `rg -n "hasSegmentText\|segmentForPart\(\|extendSegment\(" src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*'` → 14 · 제외 5: `chatStore.ts:85`·`openCodeBlocks.ts:16`·`projection.ts:2`(import) · `parts.ts:138`·`:146`(선언 — 규칙은 ③④가 운반) | 공백 text가 도구를 가르거나 빈 메모 점을 만든다. 이어붙임을 빼면 “Hello”+“\n\n”+“World”가 붙어 문단이 사라진다 |
| MD-02 / VP-18·VP-01 · **EP-2** | Code 투영: 한 화면 턴의 연속 assistant 메시지에서 보이는 내용 없이 이어지는 tools 세그먼트는 블록 1개(키 = 첫 도구 블록 키) | `claudeBlocks.ts` 턴 병합 함수 1개(신규 `mergeTurnToolRuns`) | 창 | 5자리 — ① `:901` 전체 재구성 메시지 루프 ② `:1198` 증분 추가 경로 ③ `:1387` 증분 앞삽입 경로 ④ `:559-566` 블록 gap(병합 블록 gap = 첫 블록 gap) ⑤ `registerToolOwners`(`:591-603`) 소유 블록 키 = 병합 블록 키(결과 갱신 제자리 경로 `updateToolBlockInPlace`) | `rg -n "buildCodeMessageBlocks\(\|registerToolOwners\(" src/renderer/src/features/chat/harnesses/claude/transcript/claudeBlocks.ts` → 8 · 운반 4(`:557`·`:901`·`:1198`·`:1387`) + 식 자리 ④ · 제외 4: `:491`·`:598`(선언) · `:673`·`:716`(Work — 이미 턴 단위, R2′) | 자동 연속 응답의 도구가 따로 그려진다. ⑤를 빼면 늦은 결과가 병합 블록을 갱신하지 못한다 |
| SD-02 / VP-03·VP-13 · **EP-3** | 본문 참조는 버튼 없이 자동 요청 · 진행 중 스피너 · 실패만 재시도 버튼 · 세대 폐기 | `chatStore.ts` 자동 본문 함수(신규 `resolveDeferredBodies`) | 창 | 9자리 — ① `chatStore.ts:2646` `openHistoryBody`(요청·반영 — 검색 줄 `:2646,2662,2674,2675,2882`) ② 페이지 반영 지점마다 자동 시작(신규 — 검색 밖, `rg -n "^function (loadSession\|readPrevious\|readSearchEdge\|openSearchHit)" src/renderer/src/features/chat/store/chatStore.ts`로 4함수): `loadSession` · `readPrevious` · `readSearchEdge` · `openSearchHit` ③ `DeferredBody.tsx:6,16` 표시(스피너·오류·재시도) ④ `claude/transcript/Timeline.tsx:160` ⑤ `opencode/transcript/Timeline.tsx:181` ⑥ `UserMessage.tsx:28` | `rg -n "deferredBody\|DeferredBody\|openHistoryBody\|deferredBlock\|splitDeferred" src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*'` → 49 · 운반 10줄(①5·③2·④⑤⑥) · 제외 39: 형·보유·검증(`session-load.ts:127-130` · `chatReducer.ts` 13줄 · `heldParts.ts:102` · `deferredBody.ts:18-39` · `claudeBlocks.ts:2-5,498,621-631` · `openCodeBlocks.ts:2-5,318-334`) · import 4줄 — 참조 블록 생성은 그대로다 | 버튼이 남거나, 사용자가 누를 때까지 본문이 비어 있다 |
| MD-03 / VP-04 · **EP-4** | 머리: ready·end·당김 문구 0 · loading 스피너만 · error 재시도 · 고정 높이 | `HistoryEdge.tsx` | 창 | 3자리 — ① `HistoryEdge.tsx:10-16` 문구 표(before·pull 키 삭제) ② `:36-42` end 문구 분기 ③ `:43-57` 버튼·스피너 분기(before 방향만 — after는 비변경) | `rg -n "historyBefore\|historyStart\|historyPull" src/renderer/src --glob '!**/resources/*'` → `HistoryEdge.tsx` 3 · i18n 키 `ko.ts:910-915`·`en.ts` 같은 키는 사용처 0이면 삭제 | 문구·버튼이 남거나 상태 전환이 글줄을 민다 |
| MD-04 / VP-05·VP-20 · **EP-5** | 상단 판정: 머리 슬롯이 뷰포트 안(`scrollTop ≤ 머리 높이` 또는 `scrollHeight ≤ clientHeight`)이고 before = ready면 요청 1회. 판정 시점 = 사용자 스크롤 · commit 뒤 앵커 정착 · 머리 높이 변경 | `TranscriptViewport.tsx` 판정 함수 1개(신규 `headInView`) | 창 | 5자리 — ① 요청 관문 `request`(`:702-729` — `:720` `controls.request`, `canConsumeScroll` 판정을 `headInView`로) ② 휠(`:733`) ③ 키(`:755`) ④ `onScroll`(`:757-767` — 신규 호출) ⑤ commit 뒤 정착(보정 종료 콜백 `beginCorrection` 완료 · `settleInterruptedLayout` — 신규 호출) | `rg -n "request\(direction\|controls\.request\|\.request\('before'" src/renderer/src/features/chat/components/transcript/TranscriptViewport.tsx` → 3(`:720`·`:733`·`:755`) + 신규 호출 2(④⑤) · 제외: `HistoryEdge.tsx` 오류 버튼(EP-4 ③) | 최상단에 닿아도 아무 일도 안 일어나거나 같은 위치에서 요청이 반복된다 |
| MD-04 / VP-06·VP-20 · **EP-6** | 같은 프레임 보정: 앞삽입 측정 콜백(ResizeObserver)·commit layout effect 안에서 보정을 끝내고, 가상 행 위치 반영을 같은 프레임에 동기 반영한다(`flushSync` 또는 측정값 선반영) | `TranscriptViewport.tsx` | 창 | 7자리 — ① `scheduleAnchorRestore`(`:472-482`) — 보정 창 안에서는 rAF 없이 즉시 ② 행 측정 RO(`:537`) ③ 머리 RO(`:821`) ④ 뷰포트·footer RO(`:832`) ⑤ commit layout effect(`:853`) ⑥ 그려진 앵커 위치 layout effect(`:918-919` — 주석 “size observer can run a frame before React commits the new row transform”) ⑦ `useVirtualizer` 행 위치 재렌더(`:560-`) — 측정 변경을 같은 프레임에 반영(H2) | `rg -n "scheduleAnchorRestore\(\)\|flushAnchorRestore\(\)" src/renderer/src/features/chat/components/transcript/TranscriptViewport.tsx` → 8 · `:475`·`:480`은 ① 내부 · ⑦은 검색 밖 식 자리 · 제외: `settleInterruptedLayout` rAF(`:486-491` — 정착 판정, 보정 아님) · `pullFrame`(`:723-724` — 삭제 대상, EP-4) | 앞삽입 뒤 한 프레임 이상 본문이 튄다 |
| AR-01·AR-02 / VP-07·VP-14·VP-15 · **EP-7** | 5턴 단위: `latest`·`earlierTurn`의 조회 하한 = 시작 턴부터 별개 턴 5개째 · 응답 한도 직전에서 끊기면 before = `withinUnit`(커서에 하한) · 단위 끝 다음은 `earlierTurn` · 창은 `withinTurn`·`withinUnit`만 유휴 채움 | `shared/history-page.ts` `HISTORY_TURN_UNIT` | data·창 | 12자리 — data: ① `history-index-queries.ts:129` 범위 조회(하한 인자) ② 신규 `unitFloor`(별개 턴 5개째 — `GROUP BY turn ORDER BY turn DESC LIMIT 1 OFFSET 4`, 색인 `history_turn_order`) ③ `history-page.ts:30` `edge`(하한 → `withinUnit`) ④ `:50`·`:63` `readCursor`(8번째 값·하한 검사) ⑤ `:155` latest 하한 ⑥ `:202` 조회 호출(하한 전달) / wire: ⑦ `shared/history-page.ts:72,94,96` 요청·경계 / 창: ⑧ `chatStore.ts:2793` 검색 보기 질의 ⑨ `:2830` 자동 판정 ⑩ `:2837-2838` 질의 종류 ⑪ `useHistoryControls.ts:45` 유휴 조건 ⑫ `idleSearchDirection.ts:12` | `rg -n "withinTurn\|pageHeaders\|index\.latest" src --glob '!*.test.*' --glob '!*.testfixture.*'` → 18 · 운반 15 · 제외 3: `history-page.ts:88`(패널 `latest` — 본문 아님) · `:201`·`idleSearchDirection.ts:13`(after 방향 — 비변경) | 열기·상단 로드가 1턴이거나 단위 밖으로 자동 연쇄한다 |
| AR-03·MD-05 / VP-08·VP-16·VP-21 · **EP-8** | 원문 폴백 0 · `markdown` 결과 = `{ hast }` | `shared/compute/protocol.ts:150` | 창·워커 | 9자리 — ① `worker/markdown.ts:16` 글자 상한 ② `:22` 노드 상한 ③ `markdownDocumentBlocks.ts:29` 블록 `raw` ④ `:47-52` 표 행·열·한 행 `raw`(검색 줄 `:48`·`:52`) ⑤ `:73` 각주 문서 `raw` ⑥ `WorkerMarkdownTail.tsx:73` 꼬리 제출 상한 ⑦ `:89`·`:96-97` 꼬리 `final` ⑧ `VirtualMarkdownView.tsx:54`(+표시 `:75`) `tooLarge` 폴백 ⑨ `protocol.ts:150,291` 결과 형·크기 | `rg -n "tooLarge\|MARKDOWN_BLOCK_MAX_CHARS\|MARKDOWN_HAST_MAX_NODES\|MARKDOWN_TABLE_MAX_ROWS\|raw: true\|raw: source.length" src/renderer/src --glob '!*.test.*' --glob '!*.testfixture.*'` → 23 · 운반 13 · 제외 10: import 4(`markdownDocumentBlocks.ts:3,6`·`WorkerMarkdownTail.tsx:5`·`worker/markdown.ts:7`) · `limits.ts:24,25,38` 선언(사용처 0이면 삭제) · `artifactFeedback.ts:17`·`ko.ts:845`·`en.ts:841`(산출물 파일 크기 — 다른 계약) | 큰 블록·표·꼬리가 원문으로 보인다 |
| MD-06 / VP-09 · **EP-9** | 연속 오류 턴 간격 일정 — 간격을 만드는 자리 전수 | 블록 모델 gap · Timeline 래퍼 | 창 | 21자리 — `claudeBlocks.ts` 값 11(`:559,654,760,791,879,947,1058,1146,1354,1430,1572`) · `deferredBody.ts:24` · `claude/transcript/Timeline.tsx:31,96,101,106,155`(래퍼 5) · `TranscriptViewport.tsx:885,898,990,991`(예약 여백 4줄) | `rg -n "gap:\|const gap\|gap\b.*=.*\?" src/renderer/src/features/chat/harnesses/claude/transcript/claudeBlocks.ts src/renderer/src/features/chat/lib/transcript/deferredBody.ts` → 20 + `rg -n "reserveSpacerPx\|pt-\[(8\|16\|24)px\]\|gaps\[" src/renderer/src/features/chat/harnesses/claude/transcript/Timeline.tsx src/renderer/src/features/chat/components/transcript/TranscriptViewport.tsx` → 9 · 제외 8: 타입 선언(`claudeBlocks.ts:67,78,95,103,111,122,128` · `deferredBody.ts:15`) · `openCodeBlocks.ts`는 비범위(D-011) | 오류 턴이 이어질수록 간격이 달라진다. 구현 첫 단계가 실측으로 원인 자리를 지목하고 `[구현자 기입]`에 적는다 |
| MD-06 / VP-10·VP-22 · **EP-10** | 도구 간격 12/12 · 그룹 4px · Work 8px | `claudeBlocks.ts` gap · 컴포넌트 클래스 | 창 | 5자리 — ① `claudeBlocks.ts:559-566` gap 식 — tools 앞 12 · 직전 블록이 tools인 블록 12(검색 줄 `:564`) ② 형·표: `ClaudeBlockGap`·`deferredBody.ts:15`에 12 · `Timeline.tsx:31` `12: 'pt-[12px]'` ③ `ToolGroup.tsx:95` 카드 사이 `gap-g2`(4px) ④ `WorkToolTimeline.tsx:30,37,101,105` 행 `py-1`·아이콘 `top-1.5` ⑤ `WorkActivity.tsx:125,130` 메모 행 같은 값 | `rg -n "seg.kind === 'tools'\|chat-item-gap\|py-2 pl-\[30px\]\|top-2\.5" src/renderer/src/features/chat/harnesses/claude/transcript` → 13 · 제외 5: `WorkActivity.tsx:39`·`ToolGroup.tsx:46`·`AssistantTurn.tsx:44`(그룹 밖 `--chat-item-gap`) · `claudeBlocks.ts:517`(중복 제거 필터) · `claudeBlocks.test.ts:406`(테스트) | 위·아래가 다시 갈리거나 행 아이콘이 어긋난다 |
| MD-07 / VP-11·VP-23 · **EP-11** | 증감 수: Write = 내용 줄 수(동기 한도 밖이면 워커) · 그 밖 한도 밖은 워커 `diffView` 모델의 `added`·`removed` | `shared/compute/inline.ts` | 창·워커 | 5자리 — ① `toolMeta.ts:188-191` Write ② `:192-196` Edit ③ `:197-207` MultiEdit ④ `opencode/transcript/filePresentation.ts:23` ⑤ `ToolCard.tsx:160,201-206` 표시(비동기 결과) | `rg -n "diffStatsWithinBudget\|toolDiffStat" src/renderer/src --glob '!*.test.*'` → 11 · 운반 5(`toolMeta.ts:190,195,207`·`filePresentation.ts:23`·`ToolCard.tsx:160`) · 제외 6: import 3(`toolMeta.ts:10`·`ToolCard.tsx:11`·`filePresentation.ts:1`) · 선언·내부(`toolMeta.ts:184`·`inline.ts:32,76`) | 큰 수정 카드에 줄 수가 없다 |

- 자리 목록은 위 검색 출력과 차집합 0이어야 한다 — 구현자·검증자는 `site_census.mjs`로 미분류를 센다.
- **선언 경계**: OpenCode 도구 간격(EP-10 비대상 — D-011) · 아래 끝(after) 머리 · 완료 본문의 창 동기 `<Markdown>` 파싱 시간(D-009는 표시 정책 — 파싱 위치 비변경) · Electron 바이너리 없는 환경의 AC6·AC9·AC10·AC12(exit 3, 미판정).
- 열린 입력 집합: 해당 없음 — 마크다운 블록 분류는 폴백을 없애는 쪽이라 새 판정 형태를 만들지 않는다.
- 같은 규칙 여러 레이어: 공백 판정은 `parts.ts` 하나를 Claude·OpenCode·store가 import한다(EP-1). 5턴 수치는 `shared/history-page.ts` 하나를 data·창이 import한다.
- `실패 의미`에 “다른 게이트가 막는다”: 해당 없음.
- 선택적 필드: `HistoryEdge.kind`에 `withinUnit` 추가 — 구 창이 받으면 zod 실패(같은 빌드 안이라 혼용 없음). 커서 8번째 값은 `withinUnit` 커서에만 있다.

## 10-A. EP-12 — 세션 열기와 시작 위치 고정 (ΔV2)

**시작점과 종점.** 사용자가 다른 기존 세션을 선택한 시점부터 기록한다. 목표는 대상 세션 최신 5턴의 하단이다. 대상 세션 본문을 처음 그릴 때는 하단에 배치하고 같은 자리에서 부드럽게 드러낸다. 캐시나 초기 응답으로 이미 보이는 대상 본문의 위치와 새 하단이 다르면 현재 실제 위치에서 하단으로 한 번의 연속된 스크롤을 수행한다. 이전 세션의 오프셋이나 화면에 보이지 않은 저장 위치로 먼저 옮겨 애니메이션을 만들면 실패다.

| 소유자 | 구현 계약 |
|---|---|
| `chatStore.loadSession` · `entryPolicy` | 활성 세션·진입 원인·세대를 제공한다. 명시적 열기의 목적지는 하단이며 재마운트·재검증·검색 결과 이동에는 기존 목적지를 사용한다. |
| `TranscriptViewport.writeScrollTop` · `scrollCorrection` · 두 하네스 제어기 | 실제 스크롤 컨테이너 한 곳이 보이는 출발점부터 이동한다. Claude의 최초 배치와 OpenCode의 `Timeline.initialOffset`·`ScrollController`가 같은 이동을 중복 실행하지 않게 한다. 이동 중 재측정·지연 본문으로 목표가 바뀌면 현재 위치에서 이어간다. 휠·터치·키보드·스크롤바 드래그 및 세션 변경은 이전 이동을 취소한다. |
| 공통 뷰포트의 앞삽입 보정 | 이전 턴이 붙어 읽던 글줄의 문서 좌표만 바뀌면 같은 페인트에서 변위를 상쇄한다(AC6 ±1px). 읽는 위치가 그대로인 사용자에게 별도 스크롤 여행을 만들지 않는다. |

**Electron 판정.** 기존 probe는 로드를 기다린 뒤 마운트한다. `openFrames`는 마운트된 화면에서 세션을 열기 전부터 기록한다. Claude Code·Claude Work·OpenCode 각각에서 캐시 없는 첫 표시, 이미 표시한 캐시 뒤 지연 재검증, 긴 참조 본문 교체와 유휴 채움을 검사한다.

- 가시 출발점이 없거나 이동 거리 0이면 첫 본문은 하단에서 나타난다. 준비된 본문은 추가 페이지·워커 완료를 기다리지 않으며 AC3의 본문별 스피너를 허용한다. 본문 가시 표지와 표시 진행률의 중간값을 확인한다. 짧은 대화의 스크롤 오프셋은 0이다.
- 이동 거리가 충분한 고정 높이 사례에서는 실제 `scrollTop`에 출발값·종료값 사이의 표본이 있고 목표를 향해 진행해야 한다. 중간 글줄도 그 스크롤 위치에 맞아야 하며 빈 화면·역방향 튐·별도 스크롤바 흉내는 실패다. 정착 시 하단 오차는 1 CSS px 이내다. 지연 응답으로 높이가 바뀌는 사례에서는 새 목표로 이어지는지 확인한다.
- 위로 읽기 시작하면 그 뒤의 측정이나 메시지가 화면을 하단으로 끌어내리지 않아야 한다. A에서 B로 전환하면 A의 지연 응답이 B의 화면을 바꾸지 않아야 한다. 축소 모션에서는 중간 이동 없이 같은 종점이다. 실기 미실행·필수 프레임 누락은 미판정이다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/renderer/src/features/chat/lib/parts.ts` | 공백 투명 | `hasSegmentText` → `trim` · `messageSegments`에서 공백 text는 앞이 text일 때만 이어붙임 | 순수 단위 |
| `…/lib/segmentCache.ts` | 같은 규칙 증분 | 재구성 루프에 같은 분기 · 공백 part는 span 없이 건너뜀 | 순수 단위 + 대조 |
| `…/harnesses/claude/transcript/claudeBlocks.ts` | Code 턴 병합·gap | `mergeTurnToolRuns`(턴의 메시지 블록 목록에서 인접 tools 블록 합침) · 3호출 경로 공통 적용 · 소유 키 갱신 · gap 12 | 순수 단위 + VP-16 대조 |
| `…/harnesses/claude/transcript/{ToolGroup,WorkToolTimeline,WorkActivity,Timeline}.tsx` | 간격 | EP-10 클래스 | Electron |
| `…/components/transcript/HistoryEdge.tsx` | 머리 | 문구 제거 · 스피너 `role=status` · 오류 재시도 | 렌더 단위 |
| `…/components/transcript/TranscriptViewport.tsx` | 상단 판정·보정 | `headInView` · 같은 프레임 보정 · 당김 상태 삭제 | jsdom 단위 + Electron |
| `…/lib/transcript/historyGesture.ts` | 제스처 | `consumedPull`·당김 상태 정리(요청 판정은 `headInView`) | 순수 단위 |
| `…/store/chatStore.ts` | 단위 채움·자동 본문 | `withinUnit` 자동 · `resolveDeferredBodies` | store 단위 |
| `…/hooks/useHistoryControls.ts`·`lib/idleSearchDirection.ts` | 유휴 조건 | `withinUnit` 포함 | 훅 단위 |
| `…/harnesses/common/transcript/DeferredBody.tsx` | 본문 자리 | 버튼 → 스피너/오류 표시(자동 요청은 store) | 렌더 단위 |
| `app/src/shared/history-page.ts` | wire | `HISTORY_TURN_UNIT` · `withinUnit` | zod 단위 |
| `app/src/main/features/history/history-page.ts`·`app/src/main/infra/db/history-index-queries.ts` | 단위 조회 | `unitFloor` · 범위 `pageHeaders` · 경계·커서 | DB 통합 |
| `…/shared/compute/worker/markdown.ts`·`protocol.ts`·`limits.ts` | 폴백 제거 | 상한 검사·`tooLarge` 삭제 · 상수 삭제 | 워커 단위 |
| `…/features/chat/lib/markdownDocumentBlocks.ts`·`components/markdown/{WorkerMarkdownTail,VirtualMarkdownView}.tsx` | 폴백 제거 | `raw` 분기·꼬리 `final` 삭제(`raw` 필드는 열린 펜스 등 다른 용도 없으면 삭제) | 단위 |
| `…/lib/toolMeta.ts`·`shared/compute/inline.ts`·`…/opencode/transcript/filePresentation.ts`·`ToolCard.tsx` | 증감 수 | Write 줄 수 · 초과는 워커 결과 훅(신규 `useDiffStat`) | 단위 + 렌더 |
| `app/scripts/transcript-history/scenarios.mjs`·`probe.tsx`·`check-transcript-history.mjs` | 실기 | `frames`·`framesWheel`·`unitOpen`·`openFrames`·`--layout`(`errorRun`·`toolSpacing`) · `states` 기대 갱신 | Electron |
| `docs/IPC_CONTRACT.md`·`docs/arch/frontend/rendering.md`·`state.md`·`design-components.md` | 문서 | 5턴 단위·`withinUnit` · 머리·본문 표시 · 원문 폴백 삭제 | 인벤토리 가드 |

### 테스트 가능성

- 순수 seam: 공백 판정·병합(`parts.ts`) · 턴 병합(`mergeTurnToolRuns` export) · `unitFloor`(DB 통합) · 상단 판정(`headInView(metrics)` 순수 함수로 분리).
- 기존 메커니즘 재사용: 증감 수 워커 경로는 `diffView` 모델(`diffView.ts:70-92`)의 합계를 쓴다 — 결과에 합계가 없으면 `diffView` 결과에 `totals`를 더한다(창 동기 경로와 같은 함수).
- 순서 관측: 프레임 기록은 probe가 rAF마다 글줄 top·`writes` 로그(기존 `traceAnchorMeasurement`)를 남긴다.

## 12. End-to-end 영향

```text
data 색인 → history-page(5턴·withinUnit) → zod → transport → chatStore(PREPEND·자동 본문) → blockModel(공백 투명·턴 병합) → Viewport(상단 판정·같은 프레임 보정) → 화면
```

- producer 기준: data가 단위 하한·경계 종류를 정한다. 창은 경계 종류만 보고 유휴 채움을 정한다(턴 수를 세지 않는다).
- consumer 파생 규칙: `withinTurn`·`withinUnit` = 자동, `earlierTurn` = 상단 진입만.
- 합성값 우회: 없음.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| 검색 보기 `target`·`visit` 응답 | 오름차순 조회는 1턴 그대로(D-015) · 위 끝 `earlierTurn`만 5턴 | AC7 · VP-24 |
| 패널 요약 `latest`(`history-page.ts:88`) | 비변경 | — |
| `historyComplete`·참조 보유(`chatReducer.ts`) | 자동 본문이 참조를 비우는 시점만 빨라짐 | AC3 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: 페이지 반영 직후 자동 본문 요청 — 참조당 1회, 진행 중 중복 0.
- 취소/중단: 세션 전환 → 0329 세대 규칙으로 응답 폐기. 자동 본문도 `openGeneration` 대조.
- retry/timeout/partial: 본문 실패 → 그 자리 재시도 버튼(자동 재요청 0). 이력 실패 → 머리 재시도.
- cleanup: 당김 rAF·상태 삭제(EP-4·EP-6).
- **다중 저장소 쓰기**: 해당 없음(창 상태만). 문서 산출물 사본: `plan.md` + `INDEX.md` 행.

## 14. 성능 / 상한 / 최적화

- 새 출력의 원천 상한 × 배치 상한: 응답당 256 KiB·128·256 그대로. 열기 첫 응답이 1턴 → 최대 5턴분으로 늘어도 상한 안이다.
- 새 요청 수: 열기 1 + 단위 잔여 유휴 k(= 5턴 최소 연속 분할 − 1) · 상단 진입 1회당 1 + k. 자동 본문은 참조 메시지 수 × ⌈bytes/64 KiB⌉ 조각.
- 마크다운 폴백 제거의 비용: 0327 실측 — 50,000자 문단 197ms·목록 98ms(워커) · 노드 60,003개 창 반영 62.9ms · 각주 1.16M자 2.9s(워커)·창 185ms. 상한이 없으므로 큰 블록의 창 반영 시간도 상한이 없다(§17).
- 캐시/호출 축소로 잃는 효과: 없음.

## 15. 외부 구현 포트 / 문서 계약

- 해당 없음(배포·플러그인 포트 비변경). `IPC_CONTRACT.md` session/page 행만 갱신.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 조회 단위 1턴 | 0329 D-002 | D-008 · AC7 · EP-7 | 변경(사용자 결정) |
| 위 방향 한 조작에 한 번 | 0329 D-003 | D-006 · AC5 | 변경(사용자 결정) |
| 같은 턴 안에서만 자동 | 0329 D-009 | D-008 · EP-7 ⑧⑩ | 변경 — 같은 단위로 확장 |
| 당김 표시 → 스피너 · ±1px | 0329 D-016 | D-005 · D-007 · AC4 · AC6 | 변경 — 당김 표시 삭제 · ±1px 매 프레임 |
| 고정 머리 슬롯 | 0329 D-019 | D-005 · AC4 | 유지 |
| 응답 한도 | 0329 D-007 | D-008 | 유지 |
| 검색 보기 양방향 | 0329 D-015 | AC5(위 끝만) · VP-24 | 유지 |
| 원문 표시·노드 예산·꼬리 원문 | 0327 D-033·D-045·D-035·D-054 | D-009 · AC8 · EP-8 | 변경(사용자 결정) |
| 4,000자 파싱 위치 | 0327 D-019 | §6 · VP-25 | 유지 |
| 상한 없는 계산을 UI 스레드에 두지 않는다 | 0324 D-008 | D-009 · §14 | 긴장 — 사용자 결정 우선, §17 |
| `hasSegmentText = text !== ''` | 0325 EP-2 ① | D-003 · EP-1 | 변경 |
| 증분 = 전체 재구성 | 0326 VP-16 | EP-2 · VP-26 | 유지 |
| dev/prod 데이터 격리 | `app/AGENTS.md` DB 정책 | D-013 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 큰 마크다운 블록의 창 반영이 길어진다(D-009 ↔ 0324 D-008) | 사용자 결정. 블록 가상화·표 200행 조각 단계 반영은 유지 — 조각마다 창 반영이 나뉜다 |
| 큰 블록이 워커를 오래 점유해 다른 가시 요청(강조·diff)이 기다린다 | 0327 D-043 레인 규칙 그대로 · 가시 우선순위 유지 |
| 같은 프레임 보정을 위해 `flushSync`가 렌더 비용을 앞당긴다 | 앞삽입 보정 창 안에서만 동기화 |
| 공백 투명이 “\n”만 든 의도적 줄바꿈을 지운다 | 앞이 text면 이어붙여 원문 보존 · 앞이 도구면 마크다운에서도 빈 줄이라 표시 차이 0 |

- 되돌리기 어려운 결정: `withinUnit` 요청·경계 종류(같은 빌드 내부 IPC — 저장 형식 아님).
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/renderer/src/features/chat/**`(§11) · `app/src/renderer/src/shared/compute/**` · `app/src/shared/history-page.ts` · `app/src/main/features/history/history-page.ts` · `app/src/main/infra/db/history-index-queries.ts` · `app/scripts/transcript-history/*`·`check-transcript-history.mjs`
- `docs/IPC_CONTRACT.md` · `docs/arch/frontend/{rendering,state,design-components}.md` · `docs/generated/inventory.md`(재생성)

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/renderer/AGENTS.md` · `app/src/main/AGENTS.md`.
- ABI/네트워크: DB 통합(`turn-page.db.test.ts`·`history-port.integration.test.ts`)은 Node ABI 필요 · Electron 실기는 바이너리 필요(없으면 exit 3).
- 기본 정적 게이트: `npm run lint && npm run typecheck`.
- 관련 테스트: VP 좌표 파일 + 필터 없는 `./node_modules/.bin/vitest run`.
- IMPL_DONE 전: `app/AGENTS.md` 로컬 확인 목록 전부 + `xvfb-run -a node scripts/check-transcript-history.mjs`(기본·`--layout`).
- 사람 실기: 없음.

## V1 READY self-review (ΔV2 종합 판정 대기)

- [x] Decision Ledger가 이번 턴 결정·질의 답과 앞선 결정의 대체를 보존한다 — D-001~D-013 · 대체 관계 열.
- [x] Part I만으로 완료 상태가 보인다 — §1·§5·§7.
- [x] 조건절·제거/유지를 재해석하지 않았다 — “스피너 표시 정책은 유지”→D-005, “맞든 아니든”→D-007 매 프레임.
- [x] 사용자 결정과 조사 사실을 갈랐다 — 질의 2건(D-008·D-009), 조사 R1~R12.
- [x] 수치·전칭·앵커·기존 테스트를 실측했다 — §8 검산.
- [x] 저장소 규칙·후보 표 겹침 확인 — 0327 D-026 행(완료 본문 파싱 위치)은 비범위로 유지, 0329 NX1(`aria-busy`)은 EP-4 ③과 겹침 → 머리 슬롯의 `aria-busy`는 스피너 `role=status`로 대체하며 AC4 단언에 포함.
- [x] 각 AC가 행동 단언·검증·경로를 가진다.
- [x] Baseline V · NEW node마다 REQUIRED pair · 회귀 INHERITED 3개 REGRESSION.
- [x] pair마다 path·§10·좌표 · 적대 증거는 proxy·방향 확인이 필요한 pair만.
- [x] 규칙 칸 분기 ↔ 입력: EP-1(3분기 → VP-17 입력 3) · EP-5(뷰포트 안 2조건·상태 4 → VP-05 입력 8) · EP-7(한도 안/초과/5턴 미만 → VP-07 4케이스) · EP-3(성공/실패/전환 → VP-03 3케이스).
- [x] 선언 경계 §10 · 열린 입력 집합 해당 없음.
- [x] 운영 gate 열거.
- [x] 사람 실기 0 · 수치 AC는 Electron 실기.
- [x] structural proxy 단독 AC 없음 — AC4·AC8의 0건은 상태·입력별 양성 렌더와 짝.
- [x] “X가 쓰인다” 장치: EP-1 이어붙임·EP-6 보정·EP-7 하한은 제거 변이 등록.
- [x] 배타 상태: 머리 상태는 기존 union `ready|loading|error|end` 유지.
- [x] 신규 계약 SSOT·강제·seam — §10·§11.
- [x] 부팅/등록 변경 소비처 — §12 표.
- [x] producer/consumer — §12.
- [x] 상한·총량 — §14.
- [x] 게이트 명령이 `app/AGENTS.md`와 충돌하지 않는다.
- [x] ACTIVE ↔ AC 대조 — §3 갱신 메모.
- [x] 산출물 문장 규칙.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은 [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **구현 첫 단계(WU-0)**: EP-6 H1/H2와 EP-9 원인 자리, EP-12의 최초 본문 노출 시점을 Electron 프레임·DOM 기록으로 먼저 가르고 결과를 아래 `설계 리뷰`에 적는다 — 원인이 §10 자리 목록 밖이면 `PLAN_GAP`이다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: …
- 이견 / 현실성 문제: …
- ACTIVE Decision과 충돌하는 설계 발견: …

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|

- §10 자리 목록 밖에서 본 운반 자리: …
- 직전 verify 고장 이력의 `못 잡음` 행: 해당 없음(첫 라운드)

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|

- **분모 검산**: …
- **덮개 회귀**: …

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

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: …

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
| **추가·수정 테스트의 subtree 규칙** | … |
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
