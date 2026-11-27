# Plan — 0331-transcript-feedback-followup

> 0330 기준 사용자 피드백 중 **transcript** 항목을 받는 후속 handoff다. 우측 패널 항목은 [0332](../0332-right-panel-global-depth/plan.md)가 받는다(D-001).
> 절차 정본은 [`handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0331-transcript-feedback-followup` |
| 작성자 | Claude Code (V1·ΔV3·ΔV4·ΔV6) · Codex (ΔV1·ΔV2·ΔV5) |
| 일자 | 2026-11-26 · ΔV5·ΔV6 2026-11-27 |
| 매핑 | 0330 사용자 피드백(2026-11-26) · 형제 handoff 0332 · PR #656 소유자 리뷰(2026-11-26 — 1차 기준 `3f3646fb`, 2차 기준 `09d8b2ae`) · 0331~0333 사용자 실측(2026-11-27 — 기준 `c052c301`, §23) |
| 상태 | plan/READY (ΔV6) · 다음 Codex(r1.5) · 라운드 1 — 사용자 실측 4건을 사용자 요구 변경 ΔV로 받는다(§23). r1.4 자기보고 16/17은 이력으로 남고 독립 검증 횟수는 0이다. |
| V mode | `Delta V` |
| 기준 V | 0331 V1 + ΔV1~ΔV4 · ΔV4 설계 `4fbe492c` · 구현 근거 `98381394` |
| 이번 V revision | `ΔV6` · 빈 가상 행 · 본문·커서의 세대 재합류 · 워커 교체 중 조립 재시작 · 워커 실패 회복·진단 · 도구 간격 0324 이전 값 (§23). 직전 `ΔV5`(§22) |
| 유효 V | `V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4 + ΔV5 + ΔV6` |
| 기준 트리 | ΔV6: `c052c301`(r1.4 통합 결과). ΔV5: `98381394`. V1의 기준은 `18b5d5f`이다. |

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
| 리뷰 요구 | “계획 작성자(Claude)가 아래 동작을 결정하고, 각 결정에 구현 소유자와 통과 기준을 연결하면 같은 설계 커밋에서 해당 핸드오프를 READY로 전환해 주세요.” — 0331 4묶음(이력 조회·공통 뷰포트 · 큰 본문 자동 로드·Markdown · 하네스별 도구·오류 표시 · 아티팩트 카드)과 공통 모션 구분 | [PR #656 소유자 댓글](https://github.com/muzaby/orca-skin/pull/656#issuecomment-7189285486) · 반영 대조는 §20-A |
| 리뷰 요구(2차) | 0331 남은 보완 4건(일반 산출물 경로 · 워커 문서 예산과 인라인 노드 분할·스트리밍 종료점 · 하단 이동 중 이전 이력 도착 순서 · 범위 문구·`EP-2′`·`--perf` gate) | [PR #656 소유자 댓글(2차, `09d8b2ae` 기준)](https://github.com/muzaby/orca-skin/pull/656#issuecomment-7189285486) · 반영 대조 §21-A |
| 추가 명시 요구 | “최상단 도달은 이전 5턴의 자동 조회를 시작하고, 최상단을 넘어서려는 추가 상향 입력은 진행 중인 조회를 화면에 당김 동작으로 보여줍니다.” · “스피너가 보인 뒤에는 성공 또는 실패까지 당겨진 간격을 유지합니다.” · “스피너가 있던 영역을 이전 대화의 끝부분이 바로 채웁니다.” · 실패 시 “이전 대화를 불러오지 못했습니다.” 토스트 | 같은 댓글 ‘추가 사용자 요구’ · D-022 |
| 후속 요청 | “충족하지 못한 건에 대해 Handoff-plan 진행하라.” r1에서 남은 AC9′와 AC14′의 설계·실행 경로를 정한다. | 2026-11-27 사용자 요청 · r1 구현 보고 |
| 추론 의도 | 점 아이콘은 **공백뿐인 text가 만든 빈 메모 행**의 점이다. 공백 아닌 메모의 점·아이콘 없는 도구의 점은 유지한다 — 추론 | §8 R5: 빈 메모 행 높이 16px에 점 20px(`top-2.5`)이 다음 행 위로 겹친다 |
| 추론 의도 | 상단 머리의 오류 상태 ‘다시 시도’와 아래 끝(다음 부분·대화 끝·최신 대화로)은 피드백 대상이 아니라 유지한다 — 추론 | 피드백이 명시한 문구가 ‘이전 부분 보기’·‘대화 시작’뿐 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 피드백을 두 handoff로 나눈다 — transcript는 0331, 우측 패널(전역·트랜지션·depth·그리드 제거)은 0332 | 두 영역은 파일·검증 수단이 겹치지 않고 합치면 AC가 25를 넘는다(SKILL §5) | 설계자 · 사용자 “후속 핸드오프로 대응하라” | ACTIVE | — |
| D-002 | 한 화면 턴(사용자 입력 사이) 안에서 **보이는 내용 없이 이어지는 도구 호출**은 assistant 메시지 경계와 무관하게 한 도구 그룹이다. 보이는 내용 = 공백 아닌 text · 보이는 reasoning · 질문 · 오류 · 압축/분기 경계 · 서브에이전트 통지 | “도구 그룹으로 묶여있지 않는 사례 … 항상은 아님” — 원인 2개(§8 R1·R2) | 사용자 피드백 | ACTIVE | — |
| D-003 | 공백뿐인 text part는 보이는 내용이 아니다 — 세그먼트·메모·live 표시를 만들지 않는다. 앞 세그먼트가 text면 그 원문에 이어 붙인다 | R1·R5의 공통 원인. “dot 아이콘이 … 불필요하게 붙어서 출력 … 제거할 것” | 사용자 피드백 + 설계자 | ACTIVE | 0325 EP-2 ① `hasSegmentText = text !== ''` 대체 |
| D-004 | ‘메시지 본문 열기’ 버튼을 없앤다. 본문이 한 응답 한도(0329 D-007)를 넘어 참조로 온 메시지는 창이 자동으로 조각을 받아 정상 렌더한다. 받는 동안 그 자리에 스피너(버튼 아님), 실패하면 오류 문구 + 다시 시도 | “제거하고 정상 렌더링 할 것.” 실패 표시는 설계자 기본값 | 사용자 피드백 | ACTIVE | 0329 §10 본문 ‘본문 열기’ 버튼 대체 |
| D-005 | 상단 머리에서 ‘이전 부분 보기’·‘대화 시작’·당김 문구(‘이전 부분 불러오기’)를 없앤다. 로드 중 스피너는 유지한다. 머리 슬롯은 모든 상태에서 같은 높이다. 오류 상태의 ‘다시 시도’는 유지한다 | “버튼/상태 표시를 제거하라. 단 … 스피너 표시 정책은 유지.” 고정 높이는 0329 D-019 | 사용자 피드백 | SUPERSEDED | D-023 — 당김 공간을 머리와 따로 두고 스피너 위치를 정함(2차 리뷰 새 요구). 문구 제거·오류 재시도·머리 고정 높이는 D-023이 잇는다 |
| D-006 | 일반 보기·검색 보기의 위 끝 머리 슬롯이 뷰포트에 닿으면(스크롤바·휠·키·내용이 뷰포트보다 짧음) 이전 대화가 있을 때 자동으로 읽는다. 진행 중이면 더 요청하지 않는다 | “최상단 이동 시 이전 대화가 있는 경우 로드가 자동으로 트리거 돼야 함” | 사용자 피드백 | ACTIVE | 0329 D-003 “위 방향 한 조작에 한 번” 대체 |
| D-007 | 앞삽입·앵커 보정 중 화면이 깜빡이지 않는다 — 응답 commit 직전 프레임부터 정착까지 매 프레임 읽던 글줄의 화면 top 변화 ≤ 1px | “맞든 아니든 이런 플리커는 있어서는 안 됨.” 0329 AC3′는 정착 뒤만 쟀다 | 사용자 피드백 | ACTIVE | 0329 D-016 ±1px를 매 프레임으로 강화 |
| D-008 | 로드 단위는 5턴이다 — 세션 열기(최신)와 상단 로드(이전) 모두. 한 응답 한도(메시지 128·part 256·256 KiB)는 유지하고, 넘치면 같은 5턴 단위 잔여를 유휴 채움이 이어 읽는다. 단위가 끝나면 자동 연쇄를 멈춘다(최상단 자동 로드는 D-006) | “한 턴이 아닌 5개 턴으로 변경” + 답 “열기와 상단 로드 모두” | 사용자 피드백 + 질의 | ACTIVE | 0329 D-002(조회 단위 1턴) 대체 · D-009 범위를 같은 턴 → 같은 단위로 확장 |
| D-009 | 마크다운의 크기별 원문 표시를 전부 없앤다 — 블록·각주 문서·스트리밍 꼬리 50,000자 초과, 결과 노드 20,000개 초과, 표 2,000행 초과·열 500 초과·머리+한 행 50,000자 초과 모두 마크다운으로 그린다. 파싱 위치 임계(4,000자)와 표 200행 조각 분할은 유지 | 답 “셋 모두 제거” · 선택지 설명 “크기와 무관하게 항상 마크다운으로 그린다” | 질의 | ACTIVE | 0327 D-033 원문 표시 · D-045 노드 예산·열/행 원문 · D-035·D-054 꼬리 원문 대체 |
| D-010 | 연속 오류 턴의 인접 오류 버블 세로 간격은 모두 같다 | “상하 간격이 일관적이지 않고 점점 커짓는 경향” | 사용자 피드백 | ACTIVE | — |
| D-011 | Claude 투영의 도구 간격 — Code 도구 블록의 위·아래 간격을 같게(12px), 그룹 안 카드 사이를 4px로, Work 도구 행 사이를 8px로 줄인다 | “도구 간 상하 간격이 넓음 … 위쪽 마진이 아래쪽보다 좁음.” 수치는 설계자 기본값 | 사용자 피드백 | SUPERSEDED | D-033 — 사용자 실측 “너무 좁아짐. 324 이전을 참고할 것” |
| D-012 | 수정 도구 카드 머리의 +N/−M은 크기와 무관하게 표시한다 — Write는 내용 줄 수, Edit·MultiEdit·OpenCode patch는 창 동기 한도 안이면 창, 넘으면 워커가 같은 규칙으로 센다 | “+라인수 표시가 안 된 것을 발견. 수정할 것.” 원인 R11 | 사용자 피드백 | ACTIVE | — |
| D-013 | 아티팩트 카드 ‘파일 없음’은 코드 결함이 아니다 — dev 실행은 산출물 루트가 `artifacts/.dev`로 갈라져 운영 DB의 파일을 찾지 않는다. 코드 변경 없음 | “검토 필요.” 근거 R12 | 사용자 피드백 + 조사 | SUPERSEDED | D-019 — 루트 차이는 가능한 원인일 뿐이라 판정 조건으로 바꿈(리뷰) |
| D-014 | 기존 세션의 첫 본문 프레임에서 항상 최신 하단에 즉시 배치 | ΔV1의 최초 열기 규칙 | 사용자 피드백에 대한 ΔV1 해석 | SUPERSEDED | ΔV2 D-015. 실제로 보이는 시작 위치에서 이동할 때는 smooth 전환 |
| D-015 | 기존 세션을 열 때 준비된 본문은 부드럽게 나타난다. 이미 표시 중인 대상 세션의 위치가 목표 하단과 다르면 스크롤바와 본문이 함께 하단까지 연속 이동한다. 표시 중인 시작점이 없거나 이미 하단이면 그 자리에서 나타난다 | 오프셋 고정 시 보이는 점프 제거와 스크롤바 이동의 smooth 전환을 함께 충족 | 사용자 추가 피드백 | ACTIVE | D-014 대체. 앞삽입 중 읽던 글줄은 D-007 |
| D-016 | 위 끝 채움은 한 흐름이다 — 머리 슬롯이 뷰포트 안이면 경계 종류대로 1회 요청(같은 단위 잔여 또는 이전 5턴), 앞삽입·보정이 정착하면 다시 판정해 화면이 짧은 동안 이어 읽는다. 중복 방지는 방향별 진행 중 1개 + 같은 커서 재요청 0. 정지는 이력 끝·실패(자동 재요청 0, ‘다시 시도’만)·세션 전환 | 리뷰 “다음 5턴을 요청하는 조건, 같은 요청의 중복 방지 … 정지 조건을 한 흐름으로” | PR #656 리뷰 | ACTIVE | D-006·D-008 보완(§20-C) |
| D-017 | 앞삽입 중 읽던 글줄은 **같은 메시지·같은 part·같은 글자 위치**로 판정한다 — 매 프레임 그 글자의 top 변화 ≤ 1px이고, 처음 좌표 아래의 글자가 다른 메시지·다른 글이면 실패 | 리뷰 “좌표만 같고 내용이 바뀌는 경우도 검출” | PR #656 리뷰 | ACTIVE | D-007 보완(AC6′) |
| D-018 | 큰 본문의 단계별 담당: 조립·역직렬화 = 계산 워커(창은 base64 문자열만 보관) · Markdown 파싱 = 계산 워커(블록·표 200행 조각) · 화면 반영 = 창, 커밋당 hast 노드 ≤ 20,000. 완료 본문 text·reasoning과 스트리밍 확정 블록이 4,000자를 넘으면 워커 블록 경로로 그린다. 렌더러 작업 하나 ≤ 50ms(0324 예산) | 리뷰 “조립·역직렬화·Markdown 파싱·화면 반영을 누가 맡는지 … 분할 지점과 … 50ms 예산을 측정할 입력·구간” | PR #656 리뷰 | SUPERSEDED | D-025 — 워커 문서 분할·인라인 노드 분할·스트리밍 종료점 추가(2차 리뷰) |
| D-019 | 아티팩트 ‘파일 없음’ 판정 조건: (a) 레코드의 파일이 앱이 쓰는 루트에 있는데 실패하면 결함 · (b) 같은 DB를 다른 루트로 열어서만 재현되면 환경 차이 · (c) 파일이 실제로 없으면 `missing` 표시가 정답. 실패 시 data 호스트 로그에 확인한 루트 종류와 상대 경로를 남겨 사용자 사례를 가른다 | 리뷰 “첫 경우에도 실패하면 결함으로 처리하고, 루트 차이로만 재현되면 환경 차이로 기록” | PR #656 리뷰 | SUPERSEDED | D-026 — 일반 산출물(`category === 'file'`) 경로 추가(2차 리뷰) |
| D-020 | 그룹 경계는 하네스·이력 형태별로 검증한다 — Claude Code(실시간·로컬 저장 다중 메시지·네이티브 단일 메시지) · Claude Work(응답 경계 있음/없음) · OpenCode(탐색 도구만 묶음 유지, 화면에 안 그리는 reasoning·공백 text·메시지 경계는 묶음을 가르지 않음) | 리뷰 “기존 저장 이력(응답 경계 정보가 부족한 경우 포함)과 OpenCode 고유 도구 사례를 구분” | PR #656 리뷰 | ACTIVE | D-002 보완(AC1′ 매트릭스) |
| D-021 | 모션 다섯 가지를 구분한다 — 첫 표시 등장 · 보이는 시작 위치→하단 이동(부드러운 스크롤) · 앞삽입 보정(즉시, 부드러운 스크롤 금지) · 패널 열기·닫기에 따른 transcript 폭(같은 프레임, 0332) · 패널 깊이(0332). 앵커 보정 쓰기는 항상 즉시다 | 리뷰 “이 동작들을 구분해 두어야 부드러운 스크롤 때문에 이력 삽입 때 읽던 줄까지 움직이는 회귀를 막을 수 있습니다” | PR #656 리뷰 | ACTIVE | D-007·D-015 사이 경계 고정(§20-E) |
| D-022 | 최상단 당김·로딩: 최상단 도달은 이전 5턴 자동 조회를 시작한다(유지). 조회 중 최상단을 넘는 추가 상향 입력이 오면 본문이 부드럽게 아래로 밀려 당김 공간이 열리고 그 안에 스피너가 보인다. 스피너가 보인 뒤에는 성공·실패까지 간격을 유지한다 — 입력을 멈춰도 접히지 않고, 계속 입력해도 더 벌어지거나 같은 커서를 다시 조회하지 않는다. 이력이 끝났으면 조회·스피너·당김 0. 성공: 응답 반영 직전 글줄을 기록하고 당김 공간·스피너 제거 + 앞삽입 + 실제 스크롤바 보정을 같은 페인트에 반영해 스피너 자리를 이전 대화의 끝부분이 채운다. 실패: 스피너 제거, 실패한 요청마다 토스트 “이전 대화를 불러오지 못했습니다.” 1회, 당김 공간은 부드럽게 닫혀 당기기 전 위치로, 삽입·자동 재요청 0, 명시 재시도(머리 ‘다시 시도’)·세션 전환 폐기는 유지. 소유: 공통 `TranscriptViewport` = 당김·복귀·스크롤 보정(세 하네스 공통) · 이력 store = 조회 상태·중복 방지·실패 1회 통지 | 2차 리뷰 ‘추가 사용자 요구’ 원문(§2) | 사용자(리뷰 경유) | ACTIVE | D-006·D-007 보완 · 0329 D-016·D-022 당김 규칙 대체 |
| D-023 | 머리 슬롯은 상태(ready·loading·error·end)와 무관하게 같은 높이다. 당김 공간은 머리 위의 별도 영역이고 높이는 0과 당김 높이 사이에서만 변한다. 당기지 않은 로딩은 머리 슬롯 스피너, 당긴 로딩은 당김 공간 스피너(머리 스피너는 숨김) — 스피너는 늘 하나다. ‘이전 부분 보기’·‘대화 시작’·당김 문구 0, 오류는 머리 ‘다시 시도’ | 2차 리뷰 “D-005의 ‘모든 상태에서 같은 높이’ … 새 동작의 적용 구간을 명시” | PR #656 2차 리뷰 | ACTIVE | D-005 대체 |
| D-024 | 하단 이동(M2) 도중 이전 이력이 도착하면: M2 일시정지 → 응답 반영 직전 읽던 글줄 기준 앞삽입·즉시 보정(M3) → 사용자가 취소하지 않았을 때만 새 하단으로 M2 재개. 사용자의 상향 입력(휠·트랙패드 위·당김·스크롤바 위로·위쪽 키)은 하단 추종을 취소한다 | 2차 리뷰 “하단 이동 일시정지 → … → 사용자가 이동을 취소하지 않았을 때만 새 하단으로 재개” | PR #656 2차 리뷰 | ACTIVE | D-015·D-021 보완 |
| D-025 | 큰 본문: D-018(조립·파싱 = 워커, 반영 = 창, 커밋당 ≤ 20,000노드, 4,000자 초과 완료 본문·확정 블록 = 워커 블록 경로)에 셋을 더한다 — ① 워커 문서 등록 전 분할: 등록 단위 ≤ 8,000,000자(용량 32,000,000자의 ¼), 경계는 Markdown 블록, 블록 하나가 넘으면 줄 경계, 줄이 없으면 글자 경계 ② 커밋 분할은 깊이 제한 없이 자식 합이 예산을 넘는 요소로 내려가 인라인 노드까지 나눈다(문단 하나에 인라인 2만 개 초과 포함) ③ 스트리밍 측정 종료 = 마지막 입력 글자의 서식 적용이 끝난 시점 | 2차 리뷰 “등록 전 분할 방법 … 단일 문단 안의 인라인 노드가 2만 개를 넘는 경우 … 마지막 입력 글자까지 서식 적용이 끝난 시점에 종료” | PR #656 2차 리뷰 | ACTIVE | D-018 대체 |
| D-026 | 아티팩트 판정은 경로 두 종류 × 세 경우다. 관리형(`category !== 'file'`: `<root>/<artifactFileId>/<filename>`, 루트 = `~/.config/orcinus-orca/artifacts[/.dev]`)과 일반 산출물(`category === 'file'`: DB `inputSource` 절대 경로, 부모 = OS 임시 폴더 `tmpdir()/orcinus-orca`) 각각 (a) 정상 파일 → 열림, 실패면 결함 · (b) 실제 누락 → `missing` · (c) 루트·경로 불일치 → 관리형 `missing`, 일반 `unsafe-path`. (c)로만 재현되면 환경 차이(운영 DB를 dev 루트나 다른 프로필에서 연 경우). 실패 시 data 호스트 로그 `{ category, rootKind | reason, relativePath | basename }` 1줄 | 2차 리뷰 “같은 transcript 카드에서 두 경로가 모두 열릴 수 있으므로 각각 정상 파일 클릭, 실제 파일 누락, 루트 또는 경로 불일치를 검증” | PR #656 2차 리뷰 | ACTIVE | D-019 대체 |
| D-027 | 저장이 확인된 사용자 입력과 그 응답을 식별할 수 있는 최종 실패를 연결한다. 저장된 이력을 다시 받거나 대화를 재개해도 같은 실패는 그 입력 아래 한 번 보인다. | 연속 실패 사이 간격을 비교하려면 각 실패가 자기 위치에 남아야 한다. 세션 알림과 중단 상태의 기존 처리는 §22에 따른다. | D-010·AC9′와 r1 재현에 대한 설계 결정 | ACTIVE | D-010 보완 |
| D-028 | 창과 계산 워커 간에 큰 본문·파싱 결과를 분할 전달하고, 해당 창에서 화면 반영에 쓸 시간을 본문 간에 공유한다. | D-025의 20,000노드 상한 안에서도 50ms를 넘었다. 기존 원문·서식·선택과 문서 등록 한도는 유지한다. | AC14′ 이행 설계 | ACTIVE | D-025 보완 |
| D-029 | transcript 가상 행은 보이는 내용이 있는 블록에만 만든다. Work 응답의 `ended`·`unknown` 상태, 아직 답하지 않은 질문, 그리지 않는 reasoning, 보이는 도구가 없는 묶음, 세션 없는 산출물처럼 렌더가 비는 상태는 블록 모델이 행·간격을 만들지 않는다 | “공백 또한 data-index로 감싸져있음. 그러나 하위 엘레먼트가 없음” — 빈 행의 `pt-*` 여백이 연속 ‘응답 중단’ 간격을 바꾼다(§23-A 1) | 사용자 실측 2026-11-27 | ACTIVE | D-010 보완 |
| D-030 | 본문 참조·이전/이후 커서의 세대는 힌트이고 메시지 키가 정본이다. data 호스트는 세대가 다르면 같은 키를 현재 세대에서 찾아 응답하고 응답에 현재 세대·본문 총 바이트를 싣는다. 키가 현재 세대에 없을 때만 `stale`이다. 창은 세대가 바뀐 응답을 실패로 보지 않는다 — 본문은 첫 조각부터 현재 세대로 다시 읽고, 이력 창은 응답 세대를 받아들인다 | “메시지 본문을 불러오지 못했습니다 … 왜 이러는 건가?” — 색인된 메시지가 바뀌면 새 세대가 발행되고 이전 참조는 영구 `stale`이라 다시 시도도 실패한다(§23-A 2a) | 사용자 실측 + 조사 | ACTIVE | D-004 보완 |
| D-031 | 계산 워커 교체(워커 실패 처리·실행 중 diff 취소 교체)는 그 워커에 걸린 다조각 본문 조립을 사용자 실패로 만들지 않는다. 워커는 조립 상태가 없는 조각을 `worker-replaced`로 구별해 답하고, 창은 첫 조각부터 새 워커로 다시 읽는다. 재시작은 조립 1회당 D-030과 합쳐 2회까지, 넘으면 실패 | 실행 중 diff(pair) 취소가 워커를 교체하면 다음 조각이 `Invalid history body range`로 실패한다(§23-A 2b) | 조사(Chromium 재현) | ACTIVE | D-004·D-028 보완 |
| D-032 | 계산·Markdown·이미지 워커 실패는 창 수명 동안 영구 상태가 아니다. ① 연속 실패 한도(3)에 닿은 레인은 대기(2초 → 10초 → 60초 상한) 동안만 요청을 거부하고, 대기 뒤 첫 요청에서 새 워커를 만든다 ② 실패 상태에서 첫 성공이 오면 레인 회복 회차를 올리고, 워커 원인으로 원문에 머문 화면은 각 1회 자동 재요청한다 ③ 요청 단위 실패(계산 오류 포함)와 큰 본문 실패를 레인·종류·사유로 기록한다(같은 사유 연속은 1분에 1줄) ④ 10초 넘게 응답이 없는 요청은 진단 1줄(작업은 유지) ⑤ 원문 폴백은 실패가 지속되는 동안만이다 | “모든 도구 카드에서 … pretty format이 사라짐”(질의 답 “색만 없는 고정폭 코드”) · “마크다운 원문으로만 출력” — 최초 계기는 미재현, 영구 폴백 경로는 확정(§23-A 3a·5) | 사용자 실측 + 조사 | ACTIVE | 0324 상태표 “연속 3회 실패하면 창이 닫힐 때까지 요청하지 않음” 대체 |
| D-033 | 도구 간격은 0324 이전 값이다 — Code 도구 블록 위·아래 8px, 그룹 안 카드 사이 8px(`--chat-item-gap`), Work 도구 행 `py-2`(행 사이 16px) | “도구 상하 간 간격이 너무 좁아짐. 324 이전을 참고할 것.” · 질의 답 “0324 이전 값 전부” | 사용자 실측 + 질의 | ACTIVE | D-011 대체 |

### 갱신 메모

- 이번 턴에서 새로 추가된 결정: D-001~D-013(신규 handoff).
- 변경된 결정(앞선 handoff): 0329 D-002·D-003·D-016(당김 표시)·0329 §10 ‘본문 열기’ · 0327 D-033·D-035·D-045·D-054의 원문 표시 · 0325 EP-2 ① — 대체 근거는 각 행 `대체 관계`.
- 유지되는 앞선 결정: 0329 D-007(응답 한도) · D-019(고정 머리) · D-021(앵커 함수) · D-015(검색 보기 양방향, 위 끝만 D-006 적용) · 0327 D-019(4,000자 파싱 위치) · 0326 VP-16(증분 = 전체 재구성).
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-002↔AC1 · D-003↔AC1·AC2 · D-004↔AC3 · D-005↔AC4 · D-006↔AC5 · D-007↔AC6 · D-008↔AC7 · D-009↔AC8 · D-010↔AC9 · D-011↔AC10 · D-012↔AC11 · D-013↔§4(AC 없음 — 코드 변경 0) · D-001↔§6. ΔV2에서 D-015↔AC12로 갱신.
- ΔV3 추가 결정: D-016~D-021 · 대체: D-013 → D-019.
- **ΔV3 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-016↔AC5′·AC7 · D-017↔AC6′ · D-018↔AC14 · D-019↔AC13 · D-020↔AC1′·AC2 · D-021↔AC6′·AC12·AC15 · D-004↔AC3′(‘최신 대화로’ 경로 추가). D-013은 SUPERSEDED라 대조 대상 아님.
- ΔV4 추가 결정: D-022~D-026 · 대체: D-005 → D-023, D-018 → D-025, D-019 → D-026.
- **ΔV4 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-022↔AC16·AC5″·AC6″ · D-023↔AC4″ · D-024↔AC17·AC15′ · D-025↔AC14′ · D-026↔AC13′ · D-021↔AC15′(당김 열기·실패 닫기는 당김 공간 애니메이션 — 앵커 쓰기 아님). D-005·D-018·D-019는 SUPERSEDED.

- ΔV5의 ACTIVE 결정 대조는 D-010·D-027 ↔ AC9″, D-004·D-009·D-025·D-028 ↔ AC3′·AC8·AC14′다. 기존 결정의 폐기는 0건이다. §22의 두 재현 경로로 판정하며 AC 분모는 17이다.
- ΔV6 추가 결정: D-029~D-033 · 대체: D-011 → D-033(사용자 결정 변경). 0324 상태표의 워커 영구 차단 규칙은 D-032가 대체한다.
- **ΔV6 `ACTIVE 결정 ↔ AC` 대조**: 충돌 0 — D-029↔AC18 · D-030↔AC3″·AC19 · D-031↔AC3″ · D-032↔AC20·AC3″(g) · D-033↔AC10″ · D-010↔AC18(연속 ‘응답 중단’ 간격)·AC9″(회귀). D-011은 SUPERSEDED라 대조 대상 아님. AC 분모 17 → 20.

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

- **범위**: §2 명시 요구 중 기존 transcript 피드백, 추가 요구 D-015·D-022, 아티팩트 판정 조건과 진단 로그(D-026 — 관리형·일반 산출물), 큰 본문의 워커 조립·완료 본문 워커 블록 경로(D-025). (ΔV4 정정 — 구 문구 ‘아티팩트는 조사 결론만 — D-013’은 D-019·D-026으로 대체됐다)
- **비범위**: 우측 패널 5건(0332) · 아래 끝(다음 부분·대화 끝·최신 대화로) · OpenCode 도구 간격(D-011은 Claude 투영) · 계획·도구 본문·4,000자 이하 Markdown의 창 파싱(ΔV4 정정 — 완료 본문 4,000자 초과는 D-025로 범위 안) · 아티팩트 dev/prod 저장소 공유.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| 완료 본문 워커 이주 | 아니오 | 후보 표 유지 |
| dev에서 운영 산출물 열기 | 아니오 — 개발 격리 의도 | D-013 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 → **AC1′(ΔV3 §20-B)** | Code 투영에서 한 화면 턴 안 도구 A·B·C가 (a) 사이에 공백뿐 text, (b) assistant 메시지 경계(자동 연속 응답), (c) 중복 제거로 빈 도구 세그먼트를 두고 이어지면 **그룹 1개(헤더 “… 3개”)**다. 사이에 공백 아닌 text·보이는 reasoning·질문·오류·경계가 있으면 나뉜다 | 블록 모델: tools 블록 1개·`calls` = [A,B,C] / 분리 입력 5종은 블록 2개 · 렌더: `ClaudeToolGroup` 헤더 수 1 | 메시지 → `createClaudeBlockModel.advance` → `Timeline` → `ClaudeAssistantSegment` → `ClaudeToolGroup` |
| R-02 | AT-02 / AC2 → **AC2′(ΔV3 §20-B 표시 위치)** | Work 펼침 목록에서 공백뿐 text는 메모 행·점을 만들지 않고 `noteCount`에 들지 않는다. 공백 아닌 메모는 점과 함께 남는다 | `[data-work-note]` 0 · 셸 행 위 점 0 / 메모 입력은 1 | 메시지 → `createWorkProjector` → `ActivityDisclosure` |
| R-03 | AT-03 / AC3 → AC3′(ΔV3 §20-B) → **AC3″(ΔV6 §23-C)** | 본문 참조 메시지가 든 페이지를 열면 버튼 없이 자동으로 본문을 받아 원래 자리에 정상 렌더한다. 받는 동안 그 자리에 스피너(`button` 0), 실패하면 오류 문구 + ‘다시 시도’, 성공 뒤 이웃 메시지 순서 불변. 세션 전환 뒤 도착한 본문은 버린다 | 요청 1회·버튼 0·성공 본문 텍스트 / 실패 재시도 1회 / 전환 뒤 화면 불변 | 페이지 commit → `chatStore` 자동 본문 → `sessionApi.page(body)` → `RESOLVE_HISTORY_BODY` → 블록 → 렌더 |
| R-04 | AT-04 / AC4 → **AC4″(ΔV4 §21-C)** | 부분 이력 머리에 ‘이전 부분 보기’·‘대화 시작’·‘이전 부분 불러오기’ 문구·버튼이 없다(ready·end·당김 상태 텍스트 0·`button` 0). loading은 스피너만, error는 ‘다시 시도’ 버튼. 슬롯 높이는 네 상태 모두 같다 | 상태별 렌더 텍스트·버튼 수·클래스 | `useHistoryControls` → `TranscriptViewport` → `HistoryEdge` |
| R-05 | AT-05 / AC5 → AC5′(ΔV3 §20-B) → **AC5″(ΔV4 §21-C)** | 머리 슬롯이 뷰포트 안이면(`scrollTop ≤ 머리 높이` 또는 스크롤 불가) before = ready일 때 요청 1회. loading 중 0, end 0, error 0(버튼만), 슬롯 밖 0. 스크롤바 드래그로 닿아도 같다. 검색 보기 위 끝도 같다 | 스크롤 위치별 `request('before')` 호출 수 | 스크롤/commit → `TranscriptViewport` 상단 판정 → `controls.request` → `readPrevious`/`readSearchEdge` |
| R-06 | AT-06 / AC6 → AC6′(ΔV3 §20-B) → **AC6″(ΔV4 §21-C)** | 이전 5턴 앞삽입(행 높이가 추정 140px와 다른 행 포함)에서 응답 commit 직전 프레임부터 정착(연속 10프레임 무변화)까지 **매 프레임** 읽던 글줄 top 변화 ≤ 1px. 3 transcript 화면 · 자동 트리거(휠 없음)와 휠 트리거 둘 다 | Electron 실기 프레임 기록 — 프레임별 글줄 top | 실제 Chromium → production `TranscriptView` |
| R-07 | AT-07 / AC7 | 열기 첫 응답 = 최신 5턴(한도 안이면 5턴 전부, before `earlierTurn`). 한도 초과면 한도 직전까지 + before `withinUnit`, 유휴마다 같은 단위 잔여 1묶음, 5번째 턴 첫 메시지까지 채우면 before `earlierTurn`이고 자동 연쇄 0. 상단 로드 1회 = 이전 5턴 단위(같은 규칙). 5턴 미만이면 전부·before 없음 | data 응답 메시지 ID 목록·경계 종류·응답 수 / 창 자동 요청 수 | `sessionApi.page` → data `history-page` → 창 `readPrevious`·유휴 훅 |
| R-08 | AT-08 / AC8 (예산은 ΔV3 AC14) | 50,001자 블록 · 노드 20,001 · 표 2,001행 · 열 501 · 머리+한 행 50,001자 · 각주 문서 50,001자 · 스트리밍 꼬리 50,001자가 모두 hast로 렌더된다 — `data-md-block-raw`·`data-markdown-tail="final"` 0, 워커 결과에 `tooLarge` 형 없음 | 워커 파서 결과 형 · 블록 분류 `raw` false · 렌더 표지 | `computeClient` → 워커 `markdownBlock` → `VirtualMarkdownView`/`WorkerMarkdownTail` → `MarkdownHast` |
| R-09 | AT-09 / AC9 → AC9′(ΔV3 §20-B) → **AC9″(ΔV5 §22-A)** | 연속 오류 턴 6개(Code·Work · 저장된 error part · 응답 중단 status · 열기 후와 실시간 전송 후)에서 인접 오류 버블 사이 세로 거리가 모두 같다(±1px) | Electron 실기 DOM 거리 | production `TranscriptView` |
| R-10 | AT-10 / AC10 → AC10′(ΔV3 §20-B) → **AC10″(ΔV6 §23-C)** | Code: 도구 블록 위 간격(앞 블록 끝→도구 위) = 아래 간격(도구 끝→다음 블록 위) = 12px(±1). 그룹 안 카드 사이 4px. Work: 도구 행 사이 8px | Electron 실기 DOM 거리 + 블록 gap 값 | production `TranscriptView` |
| R-11 | AT-11 / AC11 → **AC11′(ΔV3 §20-B)** | Write 654줄 → 머리 “+654”. 400줄·64,000자를 넘는 Edit·MultiEdit·OpenCode patch도 워커 결과로 +N/−M 표시(계산 중 빈 칸 → 도착 후 표시). 수치는 동기 경로와 같은 규칙(`diffLines` 줄 수) | 카드 머리 텍스트 · 동기/워커 결과 대조 | `ToolCard`/OpenCode 파일 카드 → `toolDiffStat` → (초과) `computeClient` → 워커 |
| R-12 | AT-12 / AC12 (ΔV2) | 대상 세션의 표시 위치가 목표와 다르면 실제 본문·스크롤바가 중간 위치를 거쳐 최신 하단에 정착한다(오차 ≤ 1 CSS px). 처음 그리는 본문은 하단에서 등장한다. 점프·빈 프레임·이전 세션 재노출 0회. 사용자 입력 시 이동 취소, 축소 모션은 즉시 정착 | Electron `openFrames`에서 가시 글줄·실제 scrollTop·표시 진행률을 매 프레임 기록(§10-A) | 이력 목록 → `chatActions.loadSession` → 하네스 제어기 → 공통 뷰포트 |
| R-13 | AT-13 / AC13 (ΔV3) → **AC13′(ΔV4 §21-C)** | 아티팩트 미리보기 세 경우: (a) 레코드 파일이 서비스 루트에 있음 → 열림 · (b) 같은 레코드를 다른 루트의 서비스로 엶 → `missing` + 진단 로그(확인한 루트 종류·상대 경로) · (c) 파일 삭제 → `missing`. (a) 실패는 결함 | §20-B AC13 | 카드 클릭 → `openArtifactViewer` → `artifactApi.preview` → data `artifacts` 핸들러 → `ArtifactService.preview` → `own` → `inspect` |
| R-14 | AT-14 / AC14 (ΔV3) → **AC14′(ΔV4 §21-C · ΔV5 이행 §22-B)** | 큰 본문 자동 로드·Markdown 렌더 동안 렌더러 메인 스레드 장기 작업(> 50ms) 0건 — 입력 B1(4 MiB 단일 text)·B2(1 MiB 혼합 Markdown)·B3(50,001자 이상 스트리밍 꼬리) | §20-B AC14 · §20-D | 페이지 commit → 자동 본문 → 워커 `historyBody` → 블록 파이프라인 → `MarkdownHast` 분할 커밋 |
| R-15 | AT-15 / AC15 (ΔV3) → **AC15′(ΔV4 §21-C)** | 앞삽입 보정은 부드러운 스크롤을 쓰지 않는다 — 스크롤 컨테이너에 `scroll-behavior: smooth`가 걸려도, 하단 이동(AC12) 도중이어도 AC6′가 성립한다 | §20-B AC15 · §20-E | 공통 뷰포트 `writeScrollTop` 소유자별 쓰기 |
| R-16 | AT-16 / AC16 (ΔV4) | 최상단 당김·로딩 — 당김 열림·간격 유지·성공 시 같은 페인트 앞삽입·실패 시 토스트 1회와 원위치 복귀·이력 끝 무반응 | §21-C AC16 · §21-D | 실제 상향 휠 → `TranscriptViewport` 당김 영역 → 이력 store 조회 → 앞삽입/실패 통지 |
| R-17 | AT-17 / AC17 (ΔV4) | 하단 이동 중 이전 이력 도착: 일시정지 → 앵커 앞삽입 → 취소 없을 때만 새 하단으로 재개 · 사용자 상향 입력은 하단 추종 취소 | §21-C AC17 | 세션 열기 하단 이동(AC12) → 단위 채움 응답 → 공통 뷰포트 |
| R-18 | AT-18 / AC18 (ΔV6) | 세 transcript 화면의 모든 가상 행이 보이는 자식 요소를 가진다 — 빈 행 0. 연속 ‘응답 중단’ 6행(사이에 `ended`·`unknown`·이중 응답 섞임)의 인접 간격 차 ≤ 1px | §23-C AC18 | 메시지 → 블록 모델 → `Timeline` → `TranscriptViewport` 행 |
| R-19 | AT-19 / AC19 (ΔV6) | 이전·이후 이력 읽기 도중 세대가 바뀌어도 실패 토스트·오류 머리 0, 다음 5턴이 이어 붙는다 | §23-C AC19 | 상단 도달 → `readPrevious`/`readSearchEdge` → data `readCursor` → 앞삽입 |
| R-20 | AT-20 / AC20 (ΔV6) | 워커 레인이 연속 실패해도 대기 뒤 회복하고, 원문으로 떨어졌던 강조·Markdown·본문이 조작 없이 돌아온다. 요청 실패는 사유와 함께 기록된다 | §23-C AC20 | 워커 실패 → 레인 대기 → 새 워커 → 회복 알림 → 소비처 재요청 → 렌더 |

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
| Electron 실기 스크립트 | AC6″·AC9′·AC10′·AC12·AC14′·AC15′·AC16·AC17·ST-01 (ΔV4 갱신) | `xvfb-run -a node scripts/check-transcript-history.mjs`(기본 — `frames`·`framesWheel`·`framesUnit`·`framesSmoothCss`·`openFrames`·`unitOpen`·`pull*`·`entryPrepend`) · `--layout`(`workDot`·`errorRun`·`toolSpacing`·`editStat`) · `--perf`(`bigBody` B1~B5) | exit 1만 blocking · exit 3(바이너리 없음)은 환경 |
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

## 20. ΔV3 — PR #656 리뷰 보완

**판정: 리뷰 4묶음과 모션 구분을 모두 채택해 열거 원문으로 고정했다 — 기각 0.** 리뷰 기준은 `3f3646fb`, 반영 대상은 ΔV1·ΔV2를 포함한 유효 V다. 줄 번호는 기준 트리 `18b5d5f`, 검색은 `app/`에서 실행한다.

### 20-A. 리뷰 지적 ↔ 반영 대조

| 리뷰 지적(원문 요지) | 판정 | 반영 |
|---|---|---|
| 짧은 화면에서 다음 5턴 요청 조건·중복 방지·정지 조건을 한 흐름으로 | 채택 | D-016 · §20-C · AC5′ · EP-5′ |
| 같은 메시지의 같은 글줄 매 프레임 ±1px · 좌표만 같고 내용이 바뀌는 경우 검출 | 채택 | D-017 · AC6′ |
| ‘최신 대화로’ 복귀 경로의 본문 참조도 버튼 없이 | 채택 — `leaveSearch(latest)`가 `latest` 페이지를 받는다(`chatStore.ts:2729`) | AC3′ · EP-3′ |
| 큰 본문의 조립·역직렬화·파싱·반영 담당, 분할 지점, 50ms 측정 입력·구간 | 채택 — 지금은 조립·`JSON.parse`가 창에서 돈다(`deferredBody.ts:65,83`) | D-018 · §20-D · AC14 · EP-13 |
| Claude Code·Work 저장 이력(경계 부족 포함)과 OpenCode 고유 사례를 구분한 그룹 경계 | 채택 | D-020 · AC1′ 매트릭스 · EP-2′ |
| 점·간격·오류 간격·`+654`의 입력과 표시 위치를 짝지음 | 채택 | AC2′·AC9′·AC10′·AC11′ 표시 위치 표 |
| 아티팩트 실제 경로 추적과 세 경우 구분·판정 조건 | 채택 | D-019 · AC13 · EP-14 |
| 첫 표시·시작 위치 이동·앞삽입·패널 폭·깊이 모션 구분 | 채택 | D-021 · §20-E · AC15 · EP-15 |

### 20-B. AC 변경·추가 (CHANGED = 구 행 대체, 구 행은 §7에 포인터)

| AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC1′ (CHANGED) | 아래 **경계 매트릭스** 11행이 모두 기대 경계대로 그려진다 | 블록 모델 단위(행마다 입력 1) + 표시 위치 렌더 단언 | 메시지 → 블록 모델(Claude·OpenCode) → `Timeline` → 그룹 렌더 |
| AC2′ (CHANGED) | 매트릭스 w1에서 펼친 활동의 셸 행 아이콘 위 20px 안에 점 요소 0, w2에서 메모 점 1 | `WorkActivity.render.test.ts` + `--layout` `workDot` | 메시지 → `createWorkProjector` → `ActivityDisclosure` |
| AC3′ (CHANGED) | AC3에 경로 하나를 더한다 — 검색 보기에서 ‘최신 대화로’로 돌아와 받은 `latest` 페이지의 본문 참조도 버튼 없이 자동으로 받아 정상 렌더한다. 자동 시작 지점은 페이지를 반영하는 5곳 전부다 | 지점마다 store 테스트 1(§20-G EP-3′ 좌표) | 페이지·로드 응답 → 자동 본문 → `RESOLVE_HISTORY_BODY` |
| AC5′ (CHANGED) | §20-C 흐름표의 행마다 입력 1개로 요청 수·정지를 단언한다 — 짧은 화면 연쇄, 중복 0, 끝·실패·전환 정지 포함 | `TranscriptViewport.history.test.ts`·`useHistoryControls.test.ts`·store 테스트 | 스크롤/commit → `headInView` → store 관문 → `sessionApi.page` |
| AC6′ (CHANGED) | 앞삽입 전에 읽던 글줄 L = (메시지 ID, part 키, 글자 위치, 그 뒤 20자)을 잡는다. 응답 commit 직전 프레임부터 정착까지 매 프레임 ① L 글자의 top 변화 ≤ 1px ② 처음 좌표(x, y₀)의 `caretRangeFromPoint`가 같은 메시지·part·20자를 돌려준다. 둘 중 하나라도 어긋나면 실패 | Electron `frames`·`framesWheel`·`framesUnit`(단위 채움) — 프레임별 L 좌표·좌표 아래 글 기록 | 실제 Chromium → `TranscriptView` 3화면 |
| AC9′ (CHANGED) | 표시 위치 표의 AC9 행 | `--layout` `errorRun` | production `TranscriptView` |
| AC10′ (CHANGED) | 표시 위치 표의 AC10 행 | `--layout` `toolSpacing` | 같음 |
| AC11′ (CHANGED) | 표시 위치 표의 AC11 행 | `ToolCard.interaction.test.ts` + `--layout` `editStat` | 같음 |
| AC13 (NEW) | 아티팩트 미리보기: (a) 레코드 파일이 서비스 루트 `<root>/<artifactFileId>/<filename>`에 있으면 열린다 — 실패는 결함 · (b) 같은 DB 레코드를 다른 루트의 서비스로 열면 `missing`이고 data 호스트 로그에 `{ rootKind: 'dev'|'prod', relativePath }` 1줄 · (c) 파일을 지우면 `missing`. 화면은 기존 실패 안내(`artifacts.preview.failed`)이고 패널 공간을 만들지 않는다(0242 D-014) | `main/features/artifacts/service.test.ts` 세 경우(임시 루트 2개) · 로그 싱크 단언 · `artifactViewerStore` 실패 안내 단언 | 카드 → `openArtifactViewer` → `artifactApi.preview` → data `artifacts` 핸들러 → `ArtifactService.preview` → `own` → `inspect` |
| AC14 (NEW) | 입력 B1·B2·B3(§20-D)을 열고 마지막 블록이 반영될 때까지 렌더러 메인 스레드 `longtask`(> 50ms) 0건. 화면은 정상 Markdown(원문 대체 0 — AC8과 같이) | Electron `bigBody` — `PerformanceObserver('longtask')`(기존 `scripts/transcript-selection/probe.tsx:143` 방식) · `long-animation-frame`은 관측값으로 기록 | 자동 본문 → 워커 `historyBody` → 워커 `markdown` → `MarkdownHast` 분할 커밋 |
| AC15 (NEW) | 앞삽입·높이 보정 쓰기는 즉시다 — 스크롤 컨테이너에 CSS `scroll-behavior: smooth`를 주입해도, AC12 하단 이동 도중 앞삽입이 와도 AC6′가 성립한다. 부드러운 스크롤은 하단 이동·추종 소유자만 쓴다 | `writeScrollTop` 단위(소유자별 `behavior`) + Electron `framesSmoothCss` | 공통 뷰포트 `writeScrollTop` |

**경계 매트릭스(AC1′·AC2′)** — 한 화면 턴의 입력과 기대 경계·표시 위치.

| ID | 하네스·이력 형태 | 입력 | 기대 | 표시 위치 |
|---|---|---|---|---|
| c1 | Claude Code 실시간(메시지 1) | Bash A · text `"\n\n"` · Bash B · Read C | 그룹 1 — 헤더 “실행됨 명령 2개, 읽음 파일 1개” | transcript 행의 `ClaudeToolGroup` 헤더 버튼 1 |
| c2 | Claude Code 로컬 저장(자동 연속 응답 → 메시지 2, R2) | msg1: Bash A · msg2: Bash B | 그룹 1 | 같음 |
| c3 | Claude Code 네이티브(메시지 1로 합쳐짐 — `native-history-map.ts:208-224`) | c2와 같은 도구 | 그룹 1 | 같음 |
| c4 | 분리 기준 5종 | Bash A · {공백 아닌 text · 보이는 reasoning · Ask · error · compact} · Bash B | 각 입력마다 카드 2(헤더 0) | 카드 2 |
| w1 | Claude Work(응답 경계 있음) | 경계 begin · Bash A · text `"\n"` · Bash B · 경계 end | 활동 1 · 도구 2 · 메모 0 | 펼친 `[data-work-activity]` 안 `[data-work-note]` 0 |
| w2 | 같음 | Bash A · text “확인했다” · Bash B | 메모 1(점 1) | `[data-work-note]` 1 |
| w3 | Claude Work 저장 이력(경계 없음 — `hasResponseBoundary` false → Code 경로, `claudeBlocks.ts:887`) | msg1: Bash A · msg2: text `" "` · Bash B | `WorkToolTimeline` 1(세로선 1) | `[data-work-tools]` 1 |
| o1 | OpenCode | read A · text `"\n"` · read B | 탐색 묶음 1 | OpenCode 탐색 접기 행 1 |
| o2 | OpenCode | read A · reasoning(OpenCode 화면 비표시 — `openCodeBlocks.ts:471`) · read B | 탐색 묶음 1 | 같음 |
| o3 | OpenCode 고유 규칙 | read A · bash · read B | 행 3 — 탐색만 묶는 기존 설계(`toolGrouping.ts:6`) 유지 | 행 3 |
| o4 | OpenCode 한 턴 메시지 2 | msg1: read A · msg2: read B | 탐색 묶음 1(턴 단위 수집 `openCodeBlocks.ts:343-350` 유지) | 행 1 |

**표시 위치 표(AC2′·AC9′·AC10′·AC11′)** — 사용자가 본 화면의 요소와 입력을 짝짓는다. 표지가 없는 요소는 구현이 `data-*` 표지를 더한다.

| AC | 입력(진단 fixture) | 확인 위치 | 단언 |
|---|---|---|---|
| AC2′ | w1 펼침 | 셸 행 `[data-work-tool]`의 아이콘(`span[aria-hidden]`) 위쪽 20px 띠 | `.rounded-full` 점 요소 0 · w2는 메모 행 점 1 |
| AC9′ | 6턴 연속: Code — 저장된 error part 3턴 + 실시간 실패(`TurnErrorBanner`) 3턴 · Work — `응답 중단`(status `aborted`) 6턴 · 각각 열기 후·전송 후 | 오류 버블 표지 `[data-transcript-error]`(신규 — `ErrorCard`·`TurnErrorBanner`·status `aborted`/`failed` 행) 인접 쌍 | 거리(아래 top − 위 bottom) 최대 − 최소 ≤ 1px |
| AC10′ | Code: text → c1(펼침) → text · Work: w1 펼침 | Code: 앞 text bottom→그룹 top · 그룹 bottom→다음 text top · 그룹 안 카드 사이 · Work: `[data-work-tool]` 행 사이 | 12±1 · 12±1 · 4±1 · 8±1 |
| AC11′ | Write `content` 654줄(접힘) · Edit old/new 5,000줄씩(접힘) · OpenCode patch 15,000줄 | 카드 머리 `[data-focus-id="toggle"][aria-expanded="false"]`의 증감 span | “+654” · 워커 도착 뒤 동기 규칙과 같은 “+N −M” · 계산 중 빈 칸 |

### 20-C. 위 끝 채움 단일 흐름 (D-016)

관문 SSOT는 store의 `canRequestBefore(history, cursor)`(신규) 하나다 — viewport 판정·유휴 훅·버튼이 모두 이 함수를 지난다.

| # | 조건 | 동작 |
|---|---|---|
| F1 | 머리 슬롯 뷰포트 안(`scrollTop ≤ 머리 높이` 또는 `scrollHeight ≤ clientHeight`) ∧ before = ready ∧ 진행 중 요청 0 ∧ 앵커 보정 창 닫힘 | 경계 종류대로 1회: `withinTurn`·`withinUnit` = 같은 단위 잔여 · `earlierTurn` = 이전 5턴 |
| F2 | 머리 슬롯 밖 ∧ 경계 `withinTurn`·`withinUnit` ∧ 사용자 입력 없음 | 유휴 1회(단위 채움 — 0329 D-009 유휴 규칙) |
| F3 | 머리 슬롯 밖 ∧ 경계 `earlierTurn` | 요청 0 |
| F4 | 응답 성공 → 앞삽입 → 보정 정착 | F1부터 다시 판정 — 화면이 짧으면 채워지거나 끝날 때까지 연쇄 |
| F5 | before = loading | 요청 0 (중복 방지 ① — 방향별 진행 중 1개) |
| F6 | 요청하려는 커서 = 마지막으로 성공·진행한 커서 | 요청 0 (중복 방지 ② — 같은 커서 재요청 0, ‘다시 시도’만 예외) |
| F7 | before = end(경계 없음) | 정지 · 빈 고정 머리 |
| F8 | 응답 실패·세대 불일치·앞삽입 거절 | before = error · 자동 재요청 0(머리 안이어도) · ‘다시 시도’ 1회 = 요청 1 |
| F9 | 세션 전환·보기 닫기·검색 이탈 | 진행 중 응답 폐기(0329 세대) · 새 보기는 F1부터 |

### 20-D. 큰 본문 담당·분할·예산 (D-018)

| 단계 | 담당 | 분할 지점 | 근거 |
|---|---|---|---|
| 조각 수신 | 창 store | 64 KiB 조각마다 응답 1(기존) · 창은 base64 문자열만 보관 | `deferredBody.ts:55-79` |
| 조립·역직렬화 | 계산 워커 `historyBody`(신규 요청 종류) | 조각 전체를 워커에 넘겨 base64 → 바이트 → UTF-8(fatal) → `JSON.parse` → part 형 검사 → 구조화 복제로 반환 | 지금 창의 `atob`·문자별 `Uint8Array.from`·전체 `JSON.parse`(`:65,75,83`)가 4 MiB에서 50ms를 넘는다(측정은 AC14) |
| Markdown 파싱 | 계산 워커 `markdown` | `markdownDocumentBlocks` 블록마다 · 표는 200행 조각(유지) | 0327 D-033 분할 규칙 유지(원문 표시만 삭제 — D-009) |
| 화면 반영 | 창 | 블록마다 커밋 · 블록 하나의 hast가 크면 `MarkdownHast`가 커밋당 노드 ≤ 20,000(`MARKDOWN_COMMIT_MAX_NODES`, 신규)으로 자식 목록(최상위 → `ul`·`ol`·`tbody` 한 단계)을 나눠 다음 프레임에 잇는다 | 0327 M22c 60,003노드 62.9ms → 노드당 약 1.05µs, 20,000 ≈ 21ms |
| 완료 본문 | 창 → 워커 | Claude text·reasoning, OpenCode text, 스트리밍 확정 블록이 4,000자를 넘으면 워커 블록 경로(`VirtualMarkdownView`의 블록 처리 재사용, 안쪽 가상화 없음 — transcript 행 가상화가 바깥) | 0327 D-019 임계 · 후보 표 0327 D-026 승격 |

측정(AC14): 진단 fixture 세 입력 — **B1** 4 MiB 단일 text part(한국어, 64 KiB 경계에 걸친 글자 포함 — 0329 Q3 입력) · **B2** 1 MiB 혼합 Markdown(문단 3,000 · 코드 펜스 40 · 표 2,001행 · 열 600 한 행 표 · 항목 30,000 목록 · 각주) · **B3** 50,001자 이상으로 자라는 스트리밍 꼬리. 구간은 첫 `body` 응답 수신(B3은 첫 delta)부터 `data-md-block-pending` 0 + 10프레임 무변화까지다. Claude Code·OpenCode 화면에서 각 3회, `longtask` 0건이 통과다.

### 20-E. 모션 구분 (D-021)

| ID | 동작 | 소유 | 규칙 | AC |
|---|---|---|---|---|
| M1 | 기존 세션 첫 표시 | 공통 뷰포트 + 하네스 제어기 | 최신 하단에서 등장 — 스크롤 이동 0 | AC12 |
| M2 | 보이는 시작 위치 → 하단 | 같음(소유자 `claude`·`opencode`) | 실제 스크롤 컨테이너의 `scrollTo({ behavior: 'smooth' })` 연속 이동 · 사용자 입력이 오면 취소 | AC12 |
| M3 | 이전 이력 앞삽입·높이 보정 | 공통 뷰포트(소유자 `anchor`·`virtualizer`) | 같은 페인트에서 즉시 상쇄 — `scrollTo({ behavior: 'instant' })`(CSS `scroll-behavior`를 무시) · M2 도중이면 M2 목표만 갱신 | AC6′·AC15 |
| M4 | 패널 열기·닫기·폭 변경에 따른 transcript 폭 | `ChatTile` 레이아웃(0332) | 패널 폭과 같은 프레임·진행률 · 읽던 줄·하단 유지는 M3 보정 | 0332 AC11 |
| M5 | 패널 깊이 진입·복귀 | `RightPanelFrame` 콘텐츠 층(0332) | 패널 안 전환 · transcript 영향 0 | 0332 AC12 |

### 20-F. V 변경 (ΔV3)

| Node | provenance | 대체/출처 |
|---|---|---|
| R-01·R-02·R-03·R-05·R-06·R-09·R-10·R-11 / 같은 번호 AT | CHANGED (ΔV3) | §20-B 대체 행 |
| R-13·R-14·R-15 / AT-13~15 | NEW (ΔV3) | §20-B |
| SD-02 | CHANGED — 수명에 ‘워커 조립 → 블록 분할 커밋’ 단계 추가 | §20-D |
| AR-04 | NEW — 창 ↔ 계산 워커 `historyBody` 계약(요청·결과·취소) | EP-13 |
| AR-05 | NEW — data 호스트 산출물 미리보기 경로(소유·루트·진단 로그) | EP-14 |
| MD-08 | NEW — `MarkdownHast` 분할 커밋 | EP-13 |
| MD-09 | NEW — `writeScrollTop` 소유자별 쓰기 방식 | EP-15 |
| MD-04 | CHANGED — 위 끝 채움 흐름(F1~F9)과 관문 SSOT | §20-C |

| Pair | left ↔ right | requiredness | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|
| VP-01′ | R-01 ↔ AT-01 | REQUIRED | `claudeBlocks.test.ts` `AC1′ matrix c1-c4, w3` · `openCodeBlocks.test.ts`(신규 케이스) `AC1′ matrix o1-o4` · `Timeline.viewport.test.ts` `AC1′ group header count` | required — o2 입력의 숨은 reasoning 병합 분기 제거 변이(o2 red) · c2의 메시지 경계 병합 제거 변이(c2 red) | EP-1 · EP-2′ |
| VP-02′ | R-02 ↔ AT-02 | REQUIRED | `WorkActivity.render.test.ts` `AC2′ w1·w2` · `gate:… check-transcript-history.mjs --layout` `workDot` | not selected | EP-1 |
| VP-03′ | R-03 ↔ AT-03 | REQUIRED | VP-03 좌표 + store 테스트 `AC3′ resolves deferred bodies at every page commit`(지점 5 × 입력 1 — `leaveSearch(latest)` 포함) | required — 지점마다 자동 시작 제거 변이(그 지점 입력 red) | EP-3′(10) |
| VP-05′ | R-05 ↔ AT-05 | REQUIRED | `TranscriptViewport.history.test.ts` `AC5′ F1-F9`(행마다 입력 1) · `useHistoryControls.test.ts` `AC5′ F2·F3` | required — F6 같은 커서 검사 제거 변이(같은 커서 두 번 입력 red) | EP-5′(6) |
| VP-06′ | R-06 ↔ AT-06 | REQUIRED | `gate:… check-transcript-history.mjs` `frames`·`framesWheel`·`framesUnit` — 프레임마다 L 좌표·좌표 아래 글 | required — 내용 바꿔치기 변이: 앞삽입 응답의 첫 메시지 본문을 읽던 메시지와 같은 높이의 다른 글로 바꾼 fixture에서 ②가 red(좌표만 보는 판정은 green) | EP-6 |
| VP-09′·VP-10′·VP-11′ | R-09·R-10·R-11 ↔ AT | REQUIRED | 표시 위치 표의 시나리오(`errorRun`·`toolSpacing`·`editStat`) + 기존 단위 좌표 | VP-09 기존 등록 유지 | EP-9·EP-10·EP-11 |
| VP-28 | R-13 ↔ AT-13 | REQUIRED | `main/features/artifacts/service.test.ts` 신규 `AC13 (a) opens a file in the service root` · `(b) reports missing and logs the root kind for another root` · `(c) reports missing for a deleted file` · `artifactViewerStore.test.ts` `AC13 missing keeps the panel unchanged` | required — 진단 로그 호출 제거 변이((b) red) | EP-14(7) |
| VP-29 | R-14 ↔ AT-14 | REQUIRED | `gate:… check-transcript-history.mjs --perf` `bigBody`(B1·B2·B3 × 2화면 × 3회 · `longtask` 0) · `shared/compute/worker/historyBody.test.ts` `AC14 decodes a 4 MiB body across 64 KiB boundaries` · `MarkdownHast.test.ts` `AC14 commits at most 20,000 nodes per slice` | required — `historyBody`를 창 동기 조립으로 되돌린 변이가 B1에서 `longtask`를 내는지(방향 확인) | EP-13(10) |
| VP-30 | R-15 ↔ AT-15 | REQUIRED | `TranscriptViewport.history.test.ts` `AC15 anchor writes are instant even with smooth CSS` · `gate:… check-transcript-history.mjs` `framesSmoothCss` | required — `anchor` 쓰기를 `smooth`로 바꾼 변이(`framesSmoothCss` red) | EP-15(4) |
| VP-31 | AR-04 ↔ IT-04 | REQUIRED | `shared/compute/client.test.ts` 신규 `AC14 historyBody round trip, stale generation drop`(실제 워커 처리기) | not selected | EP-13 |
| VP-32 | AR-05 ↔ IT-05 | REQUIRED | `main/app/handlers/artifacts` 통합(신규 케이스) `AC13 preview over the data handler with two roots` | not selected | EP-14 |

### 20-G. §10 추가·대체 행

| V node / pair | 계약 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 · 제외 줄 | 실패 의미 |
|---|---|---|---|---|
| SD-02 / VP-03′ · **EP-3′**(EP-3 대체) | 페이지·로드 응답을 반영하는 모든 지점이 자동 본문을 시작한다 | 10자리 — EP-3 ①③④⑤⑥(5) + 반영 지점 5: `chatStore.ts:2076`(`loadSession` — `sessionApi.load`) · `:2473`(`openSearchHit`) · `:2729`(`leaveSearch` 최신 복귀) · `:2797`(`readSearchEdge`) · `:2841`(`readPrevious`) | EP-3 명령 + `rg -n "sessionApi\.(load\|page)\(\|\.page\(\{" src/renderer/src/features/chat/store/chatStore.ts` → 5 · 제외: `historyMetadata.ts:14`·`historyPanels.ts:196`(메타·패널 — transcript 메시지 아님) | 어느 경로에서는 본문이 비거나 버튼이 필요하다 |
| MD-04 / VP-05′ · **EP-5′**(EP-5 대체) | F1~F9 · 관문 SSOT `canRequestBefore` | 6자리 — EP-5 ①~⑤ + ⑥ store 관문(`readSearchEdge` `:2776` · `readPrevious` `:2829-2830`의 자동/수동 판정을 `canRequestBefore`로) | EP-5 명령 + `rg -n "beforeState === 'loading'\|automatic &&" src/renderer/src/features/chat/store/chatStore.ts` → 3줄(모두 ⑥) | 짧은 화면이 멈추거나 같은 커서를 두 번 읽는다 |
| AR-04·MD-08 / VP-29·VP-31 · **EP-13** | 조립·역직렬화 = 워커 · 파싱 = 워커 · 반영 = 창(커밋당 ≤ 20,000 노드) · 완료 본문 > 4,000자 = 워커 블록 경로 | 10자리 — ① `deferredBody.ts:65` 창 `atob` ② `:83` 창 `JSON.parse` ③ `chatStore.ts:2666` 호출(워커 결과 사용) ④ `protocol.ts` 요청·결과 `historyBody`(신규) ⑤ 워커 처리기(신규) ⑥ `AssistantSegment.tsx:43` ⑦ `opencode/transcript/Text.tsx:29` ⑧ `ReasoningBlock.tsx:38` ⑨ `MarkdownHast.tsx:22` 분할 커밋 ⑩ `StreamingMarkdown.tsx:84` 확정 블록(4,000자 초과면 워커 블록 경로 — B3의 꼬리가 확정되는 순간) | `rg -n "readDeferredParts\|atob\(\|JSON\.parse\(strings\|<Markdown\b\|toJsxRuntime\(" src/renderer/src/features/chat src/renderer/src/shared/ui/markdown --glob '!*.test.*'` → 19 · 운반 8(①②③⑥⑦⑧⑨⑩) + 신규 2(④⑤) · 제외 11: `historyMetadata.ts:22`·`historyPanels.ts:131`(메타·패널 조각) · `chatStore.ts:1`(import)·`deferredBody.ts:46`(선언) · `ArtifactPreviewContent.tsx:119`·`StreamingMarkdown.tsx:93`(4,000자 이하 경로) · `ApprovalCard.tsx:165`·`PlanTileContent.tsx:164`(계획 본문) · `KeyValueBody.tsx:38`(도구 본문) · `markdownBlocks.ts:4`·`StreamingMarkdown.tsx:39`(주석) | 큰 본문이 창을 50ms 넘게 잡는다 |
| AR-05 / VP-28·VP-32 · **EP-14** | (a)(b)(c) 판정 · 진단 로그 | 7자리 — ① `data-host/bootstrap.ts:694` 루트 선택 ② `service.ts:307` `preview`(실패 → 진단 로그, 신규) ③ `service.ts:324` `readExport`(`own`·`inspect`) ④ `files.ts:252` `parent(root/id)` ⑤ `files.ts:262` `inspect`(상대 경로·`lstat`) ⑥ 창 `artifactViewerStore.ts:48` `blocked` 안내 ⑦ 창 `artifactViewerStore.ts:109` `openArtifactViewer` 결과 뒤 공간 할당 | `rg -n "async preview\(\|private async readExport\(\|private async parent\(\|async inspect\(\|rootDir: join\(ooConfigDir\(\), 'artifacts'" src/main/features/artifacts/service.ts src/main/features/artifacts/files.ts src/main/app/data-host/bootstrap.ts` → 5(①~⑤) + `rg -n "function blocked\|export async function openArtifactViewer" src/renderer/src/features/chat/store/artifactViewerStore.ts` → 2(⑥⑦) · 제외 0 | 정상 루트의 파일도 못 열거나 사용자 사례를 가를 근거가 없다 |
| MD-09 / VP-30 · **EP-15** | `anchor`·`virtualizer` 소유자 쓰기는 `behavior: 'instant'` · `smooth`는 하단 이동·추종 소유자만 | 4자리 — ① `TranscriptViewport.tsx:91-99` 쓰기 함수(소유자 규칙) ② `:464` 앵커 ③ `:570` 가상화 보정 ④ `:847` 고정 앞삽입 하단 | `rg -n "writeScrollTop\(\|behavior: 'smooth'\|scroll-behavior\|scroll-smooth\|scrollTo\(\{" src/renderer/src/features/chat --glob '!*.test.*'` → 13 · 운반 5줄(①=`:91`·`:98`) · 제외 8: `:113`·`:877`(요소 드러내기) · `:416`(검색 위치 복원) · `useScrollAnchor.ts:94,105,138,148`(Claude 추종·진입 — M2) · `ScrollController.tsx:57`(OpenCode 진입 — M2) | 부드러운 스크롤이 앞삽입 보정에 섞여 읽던 줄이 흐른다 |

- **선언 경계(ΔV3 추가)**: 본문 참조를 받는 동안의 그룹 경계(참조 자리는 받기 전까지 묶음을 가른다 — `deferredBody.ts:28`) · 메타·패널 상세 조각의 창 디코드(EP-13 제외 2 — transcript 본문 아님) · 계획·도구 본문·4,000자 이하 Markdown의 창 파싱 · 사용자 실제 DB의 아티팩트 사례(진단 로그로 가른다 — 이 handoff의 기계 판정 범위 밖).
- 규칙 칸 ↔ 입력: EP-3′ 반영 지점 5 → VP-03′ 입력 5 · EP-5′ F1~F9 → VP-05′ 입력 9 · EP-13 분할 3단계 → VP-29 입력 B1·B2·B3 · EP-14 (a)(b)(c) → VP-28 입력 3 · EP-15 소유자 2(즉시)·2(부드러움 허용) → VP-30 입력 4.

### 20-H. 0332와 공통 동작 대조

| 대상 | 0331 문장 | 0332 문장 | 판정 |
|---|---|---|---|
| 패널 폭 변화 중 transcript 읽던 줄·하단 | M4 — 유지는 M3 보정(즉시) | 0332 EP-7 “하단을 보던 사용자는 하단, 위를 읽던 사용자는 같은 본문 글줄을 유지” | 일치 — 같은 뷰포트 보정이 담당 |
| 깊이 전환과 transcript | M5 — 영향 0 | 0332 D-009 “깊이 진입과 뒤로 가기는 패널 안에서” | 일치 |
| 렌더러 작업 예산 | AC14 50ms | 0332 §10-A “0324의 renderer 한 작업 50ms 예산” | 일치 |
| 산출물 열기 | AC13 — 실패면 패널 공간 0(0242 D-014) | 0332 AC14 — 성공일 때만 push | 일치 |

## 21. ΔV4 — PR #656 2차 리뷰 보완과 최상단 당김

**판정: 2차 리뷰의 남은 보완 4건과 새 사용자 요구(최상단 당김·로딩)를 모두 채택했다 — 기각 0.** 기준은 `09d8b2ae`, 줄 번호는 기준 트리 `18b5d5f`, 검색은 `app/`에서 실행한다.

### 21-A. 리뷰 지적 ↔ 반영 대조

| 리뷰 지적(원문 요지) | 판정 | 반영 |
|---|---|---|
| 일반 산출물(`category === 'file'`)은 `inspectOutputFile`이 `inputSource`·임시 폴더를 본다 — 두 경로 각각 정상·누락·불일치 검증 | 채택 | D-026 · AC13′ · EP-14′ |
| 워커 문서 예산 3,200만 자 — 더 큰 문서는 등록 전 분할(지금은 영영 대기: `client.ts:453-464` `available` 거짓이면 대기만) | 채택 | D-025 ① · AC14′ B5 · EP-13′ |
| 단일 문단 인라인 노드 2만 개 초과도 커밋 분할 | 채택 — 분할을 깊이 제한 없이 인라인까지 | D-025 ② · AC14′ B4 |
| 스트리밍 측정 종료 = 마지막 입력 글자 서식 적용 완료 | 채택 | D-025 ③ · AC14′ B3 |
| 하단 이동 중 이전 이력 도착 순서 · 사용자 상향 입력은 하단 추종 취소 | 채택 | D-024 · AC17 · EP-17 |
| §6 범위 문구 정정 · `EP-2′` 정의 · 운영 gate에 `--perf` | 채택 | §6(ΔV4 정정) · §21-F EP-2′ · 운영 gate 표(ΔV4 갱신) |
| 새 요구: 최상단 당김·로딩 · 소유자 연결 · D-005·AC4·AC5′·AC6′·AC15 적용 구간 | 채택 | D-022·D-023 · AC4″·AC5″·AC6″·AC15′·AC16 · EP-16 |

### 21-B. 당김 상태 (D-022·D-023)

당김 공간은 머리 위의 별도 요소(`[data-history-pull]`, 높이 `HISTORY_PULL_HEIGHT_PX = 48`)다. 상태는 공통 `TranscriptViewport`가, 조회는 이력 store가 갖는다.

| # | 상태·사건 | 동작 | 화면 |
|---|---|---|---|
| P1 | 최상단 도달 · before = ready | F1로 이전 5턴 1회 요청(당김 없음) | 머리 슬롯 스피너 |
| P2 | before = loading · `scrollTop = 0` · 상향 휠/트랙패드(`deltaY < 0`) | 당김 열기: 0 → 48px, 200ms ease-out · 그 입력의 기본 스크롤 막음 | 본문이 부드럽게 내려가고 당김 공간에 스피너(머리 스피너는 숨김) |
| P3 | 열림·유지 중 추가 상향 입력 | 높이 불변 · 요청 0(F5·F6) | 간격 유지 |
| P4 | 열림·유지 중 입력 멈춤 | 높이 불변 | 간격 유지 |
| P5 | before = end 또는 error · 상향 입력 | 당김 0 · 요청 0 | 변화 없음(error는 머리 ‘다시 시도’) |
| P6 | 성공 응답 반영 | 반영 직전 글줄 L 기록 → 같은 commit에서 당김 높이 0(전환 없음) + 앞삽입 + `anchor` 즉시 보정 → 같은 페인트 | 스피너 자리를 이전 대화의 끝부분이 채운다 · L 고정 |
| P6s | 성공이지만 앞삽입 높이 + 머리 < 48px | 부족분 d만큼 위쪽 여백을 같은 commit에 남겨 L 고정 → 다음 판정(F4)에서 더 읽거나 끝이면 d를 200ms로 닫는다 | 빈 프레임·본문 튐 0 |
| P7 | 실패(응답 실패·세대 불일치·앞삽입 거절) | 스피너 제거 · 토스트 1회(요청 번호당) · 당김 48 → 0, 200ms ease-out · 삽입 0 · 자동 재요청 0 | 본문이 당기기 전 위치로 돌아오고 머리에 ‘다시 시도’ |
| P8 | 세션 전환·보기 닫기 | 당김 즉시 0 · 진행 중 응답 폐기(0329 세대) | 새 세션은 당김 없이 시작 |
| P9 | 축소 모션 | P2·P7·P6s의 200ms 전환 생략 · 같은 최종 상태 | — |

### 21-C. AC 변경·추가

| AC | 동작 기준 | 검증 수단 | 프로덕션 도달 경로 |
|---|---|---|---|
| AC4″ (CHANGED — AC4 대체) | 머리 슬롯은 ready·loading·error·end에서 같은 높이 클래스, 문구 0(‘이전 부분 보기’·‘대화 시작’·당김 문구). 당기지 않은 loading은 머리 스피너 1, 당긴 loading은 당김 공간 스피너 1·머리 스피너 0. error는 ‘다시 시도’ 버튼 | `HistoryEdge.test.ts` 상태 4 × 당김 2 | `useHistoryControls` → `TranscriptViewport` → 당김 영역·`HistoryEdge` |
| AC5″ (CHANGED — AC5′ 대체) | AC5′(F1~F9)에 더해 당김 P2~P5는 요청을 만들지 않는다(진행 중 요청 1 유지). 추가 상향 입력이 없는 스크롤바·키보드·짧은 화면에서도 F1 자동 조회는 그대로다 | `TranscriptViewport.history.test.ts` F1~F9 + P2~P5(입력별 요청 수) | 스크롤/휠 → `headInView`·당김 → store 관문 |
| AC6″ (CHANGED — AC6′ 대체) | 측정 시작은 **응답 반영 직전 프레임**이다(당김 중이면 당겨진 위치 — 당김으로 본문이 움직이는 것은 정상). 그 프레임의 글줄 L(메시지·part·글자 위치·뒤 20자)이 정착까지 매 프레임 ① top 변화 ≤ 1 CSS px ② 처음 좌표의 글이 같다. 당김 공간 제거·앞삽입·스크롤바 보정이 같은 페인트 — 공간만 먼저 닫힌 프레임·빈 프레임·한 번 튐 = 실패 | Electron `frames`·`framesWheel`·`framesUnit`·`pullSuccess`(당김 뒤 성공) | 실제 Chromium → `TranscriptView` 3화면 |
| AC13′ (CHANGED — AC13 대체) | 경로 2 × 경우 3: 관리형 (a) 루트 안 정상 파일 → 열림 · (b) 삭제 → `missing` · (c) 다른 루트의 서비스(dev `.dev`) → `missing` / 일반 산출물 (a) 임시 폴더 안 정상 파일 → 열림 · (b) 삭제 → `missing` · (c) `inputSource` 부모가 현재 임시 폴더와 다름 → `unsafe-path`. (a) 실패는 결함, (c)로만 재현되면 환경 차이. 실패마다 진단 로그 1줄, 화면은 실패 안내·패널 공간 0 | `main/features/artifacts/service.test.ts` 6케이스(임시 루트·임시 폴더 주입) · 로그 싱크 · `artifactViewerStore` 안내 | 카드 → `openArtifactViewer` → `artifactApi.preview` → `ArtifactService.preview` → `own` → `inspect` 분기(`service.ts:268-270`) |
| AC14′ (CHANGED — AC14 대체) | 입력 B1~B5 각각 렌더러 메인 스레드 `longtask`(> 50ms) 0건이고 끝에 정상 Markdown이 보인다. **B4** 문단 하나에 인라인 노드 25,000개(인라인 코드·링크 교대) · **B5** 40,000,000자 Markdown 문서(등록 분할로 완료 — 영구 대기 0). 구간: B1·B2·B4·B5는 첫 `body` 응답부터 `data-md-block-pending` 0 + 10프레임 무변화까지, **B3은 마지막 delta의 마지막 글자까지 서식이 적용된 시점**까지 | Electron `--perf` `bigBody` B1~B5 × 2화면 × 3회 · `MarkdownHast.test.ts` 인라인 분할 · `markdownSegments.test.ts` 분할 경계 | 자동 본문 → 워커 `historyBody` → 문서 분할 등록 → 워커 `markdown` → 분할 커밋 |
| AC15′ (CHANGED — AC15 대체) | `anchor`·`virtualizer` 쓰기는 즉시다 — CSS `scroll-behavior: smooth` 주입·AC12 하단 이동 도중·당김 중에도 AC6″ 성립. 적용 구간: 당김 열기(P2)·실패 닫기(P7)·부족분 닫기(P6s)는 **당김 공간 높이 전환**이라 스크롤 쓰기가 아니다. 성공 반영의 당김 제거(P6)는 전환 없이 같은 페인트 | `writeScrollTop` 단위 + Electron `framesSmoothCss`·`pullSuccess` | 공통 뷰포트 |
| AC16 (NEW) | 실제 상향 휠·지연 응답으로: ① 당김 중간 프레임(높이 0과 48 사이) 존재 ② 스피너가 보인 뒤 입력 중단·연속 입력 모두 간격 48±1 유지·요청 1 ③ 성공: AC6″ + 이전 대화 마지막 메시지 아래 끝이 L이 든 블록 위 간격(머리·gap 규칙)과 맞닿음 ④ 실패: `reportError({ title: 'historyLoadFailed' })` 요청당 1회, 토스트 1, 당김 높이 0까지 중간 프레임 존재, 본문 첫 블록 top = 당기기 전 값 ±1, 삽입 0, 추가 요청 0 ⑤ 이력 끝: 당김·스피너·요청 0 ⑥ Claude Code·Claude Work·OpenCode 같은 결과 | Electron `pullHold`·`pullSuccess`·`pullFailure`·`pullEnd`·`pullShort`(P6s) 3화면 · store 테스트 `AC16 one failure report per request` | 휠 → `TranscriptViewport` → store `readPrevious`/`readSearchEdge` → 앞삽입·`reportError` |
| AC17 (NEW) | AC12 하단 이동 중 단위 채움 응답이 오면 ① 이동 일시정지(그 사이 `scrollTop` 진행 0) ② 반영 직전 글줄 기준 즉시 보정(AC6″ 성립) ③ 사용자가 취소하지 않았으면 새 하단으로 이동 재개, 하단 오차 ≤ 1px. 이동 중 사용자 상향 입력(휠·당김·스크롤바·위쪽 키)이 오면 하단 추종 취소 · 재개 0 | Electron `entryPrepend`(재개)·`entryCancel`(취소) | 세션 열기 → M2 → 단위 채움 → 공통 뷰포트 |

### 21-D. 큰 본문 분할 보완 (D-025)

| 지점 | 규칙 | 근거 |
|---|---|---|
| 문서 등록 | 등록 단위 = 연속 Markdown 블록 묶음 ≤ `MARKDOWN_DOC_SEGMENT_MAX_CHARS = 8,000,000`(신규 — `COMPUTE_DOC_MAX_CHARS` 32,000,000의 ¼, 다른 문서와 함께 상주 가능). 블록 하나가 넘으면 줄 경계로, 줄이 없으면 글자 경계로 자른다 | `client.ts:453-464` — `reserved + text.length <= capacity`가 거짓인 문서는 `available`이 영영 참이 되지 않는다 |
| 커밋 분할 | `MarkdownHast`가 hast를 커밋당 노드 ≤ 20,000으로 나눈다 — 자식 합이 예산을 넘는 요소는 그 요소의 자식(인라인 포함)으로 내려가 나누고, 앞 조각은 그대로 둔 채 다음 프레임에 이어 붙인다 | 문단 하나의 인라인 2만 개 초과(B4) |
| 스트리밍 종료 | B3 측정은 마지막 delta가 꼬리에 들어가 그 마지막 글자까지 hast로 렌더된 시점(`data-markdown-tail="parsed"`·파싱 길이 = 꼬리 길이)에 끝난다 | 2차 리뷰 |
| 선언 경계 | 줄·글자 경계로 자른 블록 조각은 조각마다 따로 파싱된다 — 조각 경계를 걸친 인라인 구문은 조각별로 그린다(블록 하나가 8,000,000자를 넘는 경우만) | 측정 입력 B5 |

### 21-E. V 변경 (ΔV4)

| Node | provenance | 대체/출처 |
|---|---|---|
| R-04·R-05·R-06·R-13·R-14·R-15 / 같은 번호 AT | CHANGED (ΔV4) | §21-C |
| R-16·R-17 / AT-16·AT-17 | NEW (ΔV4) | §21-C |
| SD-01 | CHANGED — 수명에 당김(P1~P9)과 하단 이동 중 앞삽입(D-024) 추가 | §21-B |
| AR-05 | CHANGED — 일반 산출물 경로 | EP-14′ |
| MD-10 | NEW — 당김 상태 기계(viewport) | EP-16 |
| MD-11 | NEW — 문서 분할 등록 | EP-13′ |

| Pair | left ↔ right | requiredness | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|
| VP-04″ | R-04 ↔ AT-04 | REQUIRED | `HistoryEdge.test.ts` `AC4″ four states × pulled` | not selected | EP-4 · EP-16 ⑨ |
| VP-05″ | R-05 ↔ AT-05 | REQUIRED | `TranscriptViewport.history.test.ts` `AC5″ F1-F9 and P2-P5` | required — P3에서 요청을 다시 부르는 변이(요청 2 red) | EP-5′ · EP-16 ①② |
| VP-06″ | R-06 ↔ AT-06 | REQUIRED | `gate:… check-transcript-history.mjs` `frames`·`framesWheel`·`framesUnit`·`pullSuccess` | required — 당김 제거를 앞삽입 다음 프레임으로 미루는 변이(`pullSuccess` red) | EP-6 · EP-16 ⑤ |
| VP-28′ | R-13 ↔ AT-13 | REQUIRED | `service.test.ts` `AC13′ managed (a)(b)(c) · output (a)(b)(c)` · 로그 싱크 | required — `inspect` 분기를 관리형으로 고정한 변이(일반 (a) red) | EP-14′ |
| VP-29′ | R-14 ↔ AT-14 | REQUIRED | `gate:… --perf` `bigBody` B1~B5 · `MarkdownHast.test.ts` `AC14′ splits 25,000 inline nodes` · `markdownSegments.test.ts` `AC14′ 40M chars register in segments ≤ 8M` | required — 분할 없이 통째 등록하는 변이(B5 영구 대기 → red) | EP-13′ |
| VP-30′ | R-15 ↔ AT-15 | REQUIRED | VP-30 좌표 + `pullSuccess` | VP-30 등록 유지 | EP-15 |
| VP-33 | R-16 ↔ AT-16 | REQUIRED | `gate:… check-transcript-history.mjs` `pullHold`·`pullSuccess`·`pullFailure`·`pullEnd`·`pullShort` 3화면 · `chatStore` 테스트 `AC16 one failure report per request`(실패 지점 4 × 입력 1) | required — 실패 닫기 전환 제거 변이(`pullFailure` 중간 프레임 red) · 요청당 1회 검사 제거 변이(같은 요청 두 번 보고 red) | EP-16(9) |
| VP-34 | R-17 ↔ AT-17 | REQUIRED | `gate:… check-transcript-history.mjs` `entryPrepend`·`entryCancel` | required — 일시정지 없이 이동 중 보정하는 변이(`entryPrepend`의 L red) · 취소 무시 변이(`entryCancel` 재개 red) | EP-17(4) |
| VP-35 | MD-10 ↔ UT-10 | REQUIRED | 신규 `historyPull.test.ts`(순수 상태 기계 P1~P9 — 상태 × 사건 입력 9) | not selected | EP-16 |

### 21-F. §10 추가·대체 행

| V node / pair | 계약 | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 · 제외 줄 | 실패 의미 |
|---|---|---|---|---|
| MD-02 / VP-01′ · **EP-2′**(정의 — §20-F가 참조) | 한 화면 턴의 도구 묶음: Claude는 EP-2 규칙, OpenCode는 화면에 안 그리는 reasoning·공백 text로만 갈린 tools 세그먼트를 `groupTools` 전에 합친다(탐색만 묶는 규칙 유지) | 7자리 — EP-2 ①~⑤(5) + ⑥ `openCodeBlocks.ts:473` reasoning 건너뛰기(합침 경계에서 투명) ⑦ `openCodeBlocks.ts:487` `groupTools` 입력(합친 calls) | EP-2 명령 + `rg -n "seg.kind === 'reasoning'\|groupTools\(" src/renderer/src/features/chat/harnesses/opencode/transcript/openCodeBlocks.ts` → 2 | o2(숨은 reasoning)·o1(공백 text)에서 탐색 묶음이 갈린다 |
| MD-11·MD-08 / VP-29′ · **EP-13′**(EP-13 대체) | EP-13 + 문서 분할 등록 + 인라인 커밋 분할 + 스트리밍 종료 표지 | 12자리 — EP-13 ①~⑩ + ⑪ `client.ts:450` `openDocument`(markdown 레인은 분할된 등록 단위만 받음 — 단위 > 8,000,000자는 등록 전 분할) ⑫ markdown 레인 등록 호출자의 분할: `VirtualMarkdownView.tsx:98`(`useComputeDocument`) · `WorkerMarkdownTail.tsx:41`(꼬리 문서) · 신규 완료 본문 블록 경로 | EP-13 명령 + `rg -n "openDocument\(\|useComputeDocument\(" src/renderer/src --glob '!*.test.*'` → 17 · 운반 3(`client.ts:450`·`VirtualMarkdownView.tsx:98`·`WorkerMarkdownTail.tsx:41`) + 신규 1 · 제외 14: `client.ts:84,147`(선언·레인 위임) · `useComputeDocument.ts:7,22`(공용 훅 — 호출자가 분할) · compute 레인(코드·diff) 10줄 `VirtualCodeView.tsx:149`·`useSmallDiffSyntax.ts:24`·`useDiffAxes.ts:36,44`·`DiffTable.tsx:207,357,366,367,385`·`FileDiffSection.tsx:349`(Markdown 아님 — 선언 경계) | 큰 문서가 영영 파싱되지 않거나 문단 하나가 창을 50ms 넘게 잡는다 |
| AR-05 / VP-28′ · **EP-14′**(EP-14 대체) | 경로 2 × 경우 3 · 진단 로그 | 10자리 — EP-14 ①~⑦ + ⑧ `service.ts:268-270` `inspect` 분기 ⑨ `files.ts:209-225` `inspectOutputFile`(부모 = 임시 폴더 검사) ⑩ `infra/config/temp-path.ts:8-9` 임시 폴더 | EP-14 명령 + `rg -n "private inspect\(\|export async function inspectOutputFile\|export const getTemporaryFilesPath" src/main` → 3 | 일반 산출물 정상 파일을 못 열거나 불일치를 결함으로 오판한다 |
| MD-10·SD-01 / VP-33·VP-35 · **EP-16** | P1~P9 · 소유 = viewport(당김·복귀·보정) · store(조회·중복·실패 1회) | 9자리 — ① 휠 `TranscriptViewport.tsx:732,735` ② 제스처 `historyGesture.ts:22,28` ③ 당김 상태 `TranscriptViewport.tsx:220,701,721-726,780`(구 당김 표시 → 상태 기계) ④ 당김 공간 렌더 `:938` 머리 영역 ⑤ 성공 같은 페인트 제거 — 앞삽입 캡처·복원(`:270-302`) ⑥ 실패 1회 통지 `chatStore.ts:2795`(before 방향만)·`:2851`·`:2863`·`:2874` ⑦ 토스트 제목 `shared/app-error.ts:4` `historyLoadFailed` + `ko`·`en` 문구 ⑧ 세션 전환 초기화 `TranscriptViewport.tsx:310` ⑨ 스피너 위치 `HistoryEdge.tsx:21,25,29,51` | `rg -n "pulling\|setPulling\|pullFrame\|consumedPull\|gesture\.wheel\|beforeState: 'error'\|\[stateKey\]: 'error'" src/renderer/src/features/chat --glob '!*.test.*'` → 24 + `rg -n "APP_ERROR_TITLES = \[" src/shared/app-error.ts` → 1 · 운반 24 · 제외 1: `TranscriptViewport.tsx:995`(아래 끝 — 비변경) | 당김이 접히거나 벌어지고, 성공 때 튀거나 실패 토스트가 없거나 겹친다 |
| SD-01 / VP-34 · **EP-17** | D-024 순서 | 4자리 — ① 하단 이동 드라이버(Claude `useScrollAnchor.ts:138` · OpenCode EP-12 이동 — 같은 공통 이동 함수) 일시정지·재개 ② 고정 앞삽입 분기 `TranscriptViewport.tsx:234,260,282,845,857` — 하단 이동 중이면 즉시 하단 점프가 아니라 L 앵커 ③ 보정 종료 콜백 `:295` → 재개 지점 ④ 취소 입력 `cancel()`(`:680-699`)·휠·키·pointerdown = 하단 추종 취소 | `rg -n "pinnedPrepend\|beginCorrection\(\|'smooth'" src/renderer/src/features/chat/components/transcript/TranscriptViewport.tsx src/renderer/src/features/chat/harnesses/claude/transcript/useScrollAnchor.ts src/renderer/src/features/chat/harnesses/opencode/transcript/ScrollController.tsx` → 8 · 운반 7 · 제외 1: `TranscriptViewport.tsx:98`(쓰기 함수 — EP-15 ①) | 하단 이동이 앞삽입을 덮어 읽던 줄이 튀거나 취소한 추종이 되살아난다 |

- **선언 경계(ΔV4 추가)**: compute 레인(코드·diff) 문서의 32,000,000자 초과 등록(기존 `unavailable` 경로 — Markdown 아님) · 8,000,000자를 넘는 단일 블록의 조각 경계 인라인(§21-D) · 아래 끝(after) 당김(요구는 최상단) · 검색 보기 after 방향 실패 토스트(위쪽 실패만 D-022).
- 규칙 칸 ↔ 입력: P1~P9 → VP-35 입력 9 · AC13′ 6경우 → VP-28′ 입력 6 · B1~B5 → VP-29′ 입력 5 · AC17 재개·취소 → VP-34 입력 2 · 실패 지점 4 → VP-33 store 입력 4.

### 21-G. 0332와 공통 동작 대조 (ΔV4)

| 대상 | 0331 | 0332 | 판정 |
|---|---|---|---|
| 당김 중 패널 열기·닫기 | 당김은 transcript 안 상단 영역 — 패널 폭 변화(M4)와 독립, L 유지는 M3 | EP-7 재배치 · 기존 검증 유지 | 일치(서로 다른 축) |
| 하단 이동 중 패널 폭 변화 | M2는 새 하단으로 목표 갱신 | EP-7 “하단을 보던 사용자는 하단” | 일치 |

## 22. ΔV5 — 연속 실패의 턴 귀속과 대용량 본문 성능

| 남은 기준 | 시작점 | 구현이 끝났을 때의 판정 |
|---|---|---|
| AC9″ (AC9′에서 구체화) | 실제 Electron에서 저장 3건 뒤 실시간 실패의 표시 수가 4→4→4였다. | 커밋이 확인된 세 번의 실패가 자기 입력에 붙어 4→5→6개가 된다. 이력을 다시 읽어도 각각 한 번이며 여섯 행의 인접 간격 차이는 1px 이하다. |
| AC14′ (판정 유지) | 기존 두 화면 × 다섯 입력 × 세 번의 실측에서 서식과 50ms 예산을 함께 충족한 경우는 2/30이었다. | 같은 30회 모두에서 끝까지 정상 Markdown을 표시하고 관측 구간의 장기 작업은 0건이다. 시간 제한 도달·측정 누락은 실패로 기록한다. |

r1의 WU-0가 발견한 §10 밖의 오류 귀속 경로는 EP-18에서 다룬다. 두 항목 모두 현재 실패를 포착하는 검사를 먼저 고정하고, 수정 뒤 같은 실제 화면에서 재측정한다. 두 항목은 독립적으로 진행할 수 있다. 이력 페이지·뷰포트 등 공통 파일이 바뀌면 같은 통합 버전에서 §22-C의 회귀 검사를 실행한다.

### 22-A. 연속 실패의 귀속과 복원 (AC9″)

**제품 계약 (§1~7).** 실패한 여섯 입력을 위에서 아래로 읽을 때 각 입력 다음에 그 실패를 한 번씩 볼 수 있다. 같은 질문을 다시 보내 같은 오류를 받아도 두 시도의 결과를 구별할 수 있다. 다른 세션을 열었다 돌아오거나, 오래된 질문 검색 결과에서 대화를 열거나, 앱을 재시작해도 당시 입력 바로 다음에서 같은 오류를 읽는다. 취소되어 입력창으로 돌아온 글, 접속 전 실패, 데이터 호스트 장애는 지금처럼 그 시점의 안내를 보여준다. 출처는 R-09·D-010, ΔV3 AC9′ 표시 위치 표, ΔV4 WU-0의 PLAN_GAP이다.


**현재 실증과 한계.** 기준 `98381394`에서 layout 21좌표 중 20개 통과. `errorRun`은 저장 형식 Code 6행의 다섯 인접 간격이 각각 160.171875px, Work 중단 6행은 각각 165.171875px다. `errorLive`는 매 전송 후 행 수 4→4→4, 마지막 이웃 간격 160.40625→208.28125→256.15625px다. 실제 Electron에서 production TranscriptView·store·reducer·카드를 거친 수치다. 이 fixture는 `app/scripts/transcript-layout/probe.tsx:78,221–248`에서 이력 객체를 만들고 user action에 임의 키 `latest<i>`를 주입한 뒤, sessionId와 ClassifiedError만 실은 오류를 보낸다. SDK 입력 소비, 에이전트/데이터 호스트, SQLite commit, 저장소를 닫고 다시 읽기를 거치지 않는다. 이 수치는 한 개 footer가 교체되는 화면 증거다. 아래 producer·writer 경로는 현 코드에서 추적했고, 실제 조립·재시작 결과와 변이 검출은 구현 단계에서 별도로 측정한다.

**AC9″ (CHANGED).**

1. Claude Code에서 저장 오류 3건을 열고 같은 형식·높이의 질문으로 소비 확인된 실제 응답 실패를 3번 더 낸다. 처음 3행, 커밋별 4→5→6행, 여섯 질문 각각과 바로 다음 오류 카드가 일대일이고 순서가 기대한 (session, owner, failure) 목록과 같다. 각 추가 후 현재 보이는 **모든** 인접 간격을 잰다. 완성된 6행의 다섯 `next.top − prev.bottom` 간격 범위 ≤1 CSS px. 다음 성공 입력 직후·재열기에서도 앞선 6개의 소유자와 순서·정규 간격을 확인한다. 완료된 6턴은 5턴 latest 한도를 준수해 필요한 이전 페이지를 연 뒤 검증한다. 필요한 경우 실제 뷰포트를 이동해 이웃 쌍을 함께 측정한다. 장문·상이한 카테고리 대조에서는 동일 간격 판정을 같은 높이 fixture에만 적용하고 ID·순서·내용을 따로 판정한다.
2. 기존 저장 형식 Claude Code 오류 6개와 Work `aborted` 6개는 각각 열기 후·다음 전송 후 6행, 같은 5쌍 ≤1px. Work 실제 실패도 owner가 같은 error와 failed 경계가 겹치면 한 번만 표시하고 실패 상세를 읽을 수 있다. OpenCode Code는 해당 provider 카드의 제목·본문을 보존하고 같은 오류의 라이브/재로드 개수·소유자·순서를 대조한다. 고정 픽셀 절댓값이나 OpenCode의 Claude 간격값은 판정에 넣지 않는다.
3. 두 세션 A/B, 동문 사용자·동문 오류, 중간 성공 턴, 묶음 입력과 steer, 마지막 턴 밖 검색 대상에 대해 저장/라이브/replay/재시작에서 같은 session·user·assistant·failure 키와 발생 시각, 분류·본문·retryable을 확인한다. 정상 입력과 다른 세션에는 오류 0. 구형 bare part는 현재 행에 그대로 한 번, 소유자 없는 실패는 기존 일시 배너 한 번·영속 추가 0. 전송 실패로 반환된 초안, 재시도 상태, 승인 중인 하위 도구, Work 중단·성공 경계가 기존처럼 작동한다.

**현재 경로와 설계 차이 (§8~9).**

| 관찰한 경계 (@98381394) | 이번 계약 |
|---|---|
| Claude SDK receipt echo → `claude/adapter.ts:1023`, result 오류는 `claude/map.ts:815–836`에서 telemetry **뒤에** error, query 예외는 `adapter.ts:1076`. OpenCode는 `v1/channel.ts:353–383`에서 submit 수락 뒤 prelude/prompt echo 및 버퍼 SSE 방출, `v1/map.ts:116–126,149–158`에서 assistant message.error와 session.error를 정규화한다. `channel.ts:464`에 이미 terminal일 때 중복 방지 분기가 있고 연결 실패는 `:496`에서 수락 전에도 올 수 있다. | 각 실행 응답이 열린 시점에 원래 submit/response와 큐 배치의 관계를 유지한다. provider가 주는 assistant/parent/native/receipt ID가 있으면 해당 응답/입력 바인딩에 쓴다. telemetry 뒤의 Claude error와 OpenCode 같은 응답의 두 terminal 통지는 하나의 응답 슬롯에서 같은 occurrence를 사용한다. 이미 닫힌 이전 응답과 다음 응답의 지연 신호가 구분되지 않으면 새 입력을 소유자로 삼지 않는다. 정상 child/tool 오류나 `MessageAbortedError`는 기존 도구/중단 흐름을 따른다. |
| `turn-coordinator.ts:179–206,405–430,532`은 confirmed 배치를 drain하고 **순서 있는 전체** `userMessageId(batch.ids)`를 생성한다. `await persist.commitUserMessage`의 결과가 있어야 `message.committed`를 relay한다. telemetry일 때는 persist 후 flush한다. `shared/model-output.ts`의 소비 확인 신호 다섯 종류에 error·telemetry는 없다. `message.received`는 별도 `i:` 영수증이다. | 요청별 응답 슬롯에 submit batch/response 인과관계와 DB commit 영수증을 각각 결합한다. 여러 prelude/steer가 동시에 confirm되어도 실행 prompt와 그 응답을 실제로 연 배치에만 귀속한다. 명시적으로 응답에 연결된 received user도 저장된 user 키와 대응이 입증될 때만 허용한다. 최신 user, 최근 완료한 assistant, `ids[0]`, prompt UUID, 시간·본문·카테고리·화면 선택·단순 sessionId, optimistic/submitted 상태는 귀속 근거가 아니다. 원인을 모호하게 만드는 admission/준비/연결 실패는 일시 안내로 남긴다. |
| `turn-coordinator.ts:563–610` 마지막 catch는 `forward.forward`로 직접 발행한다. `send.ts` 11곳·`enqueue.ts:103`에 검증/준비·상태 오류, `agent-host/bootstrap.ts:240`에 저장소 오류가 있다. `HOST_LOST`는 여러 세션에 직접 dispatch한다. | 확정된 실행에 귀속된 최종 coordinator catch는 정규 저장→중계 경로 한 곳으로 보낸다. backoff의 `turn.retrying`은 최종 실패가 아니다. 입력 전 오류·외부 catch·저장 실패·HOST_LOST·session 없는 terminal은 기존 target/toast/banner 및 초안 회수 정책을 따른다. 같은 `stream_error`도 출처에 따라 두 경로가 각각 가능하다. |
| `persistence-sender.ts:193–219`가 part용 assistant `messageKey`를 부여한 뒤 일반 오류는 `turn.event` notify한다. `data-host/persistence-receiver.ts:99,155`가 나중에 writer를 호출한다. agent-host 구독 순서만으로 SQLite 성공을 보장할 수 없다. `writer.ts:245,549`에서 assistant role을 확인하고 `{error}` part를 append한다. 기존 유일 키 `0036_message_key.sql`은 session·message 행 단위다. `queries.ts:144,565`, `dto.ts:58` 및 `ipc.ts:773,1606`은 occurrence를 전달하지 않는다. | assistant `messageKey`와 `ownerUserMessageKey`는 별도 필드다. user 행은 원래 입력 parts로 유지한다(`userMessageMatches`가 재전달 시 전체 parts를 비교). 아래 원자적 receipt를 사용한다. |
| `chatStore.ts:608,1188,1257`가 세션/terminal을 처리하고, `chatReducer.ts:1480`은 live를 닫고 `session.error` 한 칸을 교체한다. assistant merge는 `chatReducer.ts:826–862`, `lib/transcript/mergeKey.ts`에 error 병합키가 없다. Claude와 OpenCode Timeline 모두 footer에 배너를, 저장된 part는 각 AssistantSegment의 카드로 표시한다. | 성공 receipt가 있는 오류는 정확한 user 다음 assistant 그룹의 같은 occurrence에 upsert, 세션 footer에는 같은 ID를 중복 표시하지 않는다. 사용자 A가 실패한 후 B로 넘어간 상황에서 A의 중복 receipt가 도착해도 B의 스트림·대기·오류·하위 승인을 종료하지 않는다. 현 실행 첫 terminal에서는 기존 stream 폐기, TURN_END_RESET과 childApprovalState를 보존한다. retryable 표지·기존 transientHint, 번역된 category·본문, provider별 카드, 선택/스크롤 동작을 유지한다. 다른 출처의 진짜 일시 배너는 별도로 표시된다. |
| `native-projection.ts:72–85,100,157–192`는 frontier 이하에서 error를 sidecar로 취급하지 않는다. Claude native mapper는 error를 복원하지 않고 OpenCode native mapper는 가져온다. assistant 본문이 같다는 이유로 두 개를 합치면 서로 다른 실패도 합쳐진다. `reader.ts:78–121`가 local/native/archive를 투영하고, 인덱스 alias로 target 페이지를 찾는다. | 로컬 영속 오류는 원래 사용자와 assistant에 대응하는 native 위치에서 같은 발생 ID로 투영한다. OpenCode가 이미 보여주는 같은 native assistant의 동일 terminal은 검증 가능한 native 응답 ID/바인딩과 slot로 대응해 하나만 그린다. 단순 JSON/오류 문구·시간으로 합치지 않는다. 여러 prelude가 한 native ID로 합쳐져 대표 user가 바뀌는 구간은 저장한 입력 묶음의 순서·키로 펼쳐 오류를 원래 턴에 둔다. 대응이 불명확하면 그 구간의 로컬 user/assistant 쌍을 함께 표시하고, 다른 구간에 있는 native 전용 메시지·순서와 검색 alias를 보존한다. 단순 orphan tail 추가로 새 턴 뒤에 붙이지 않는다. |

**D-027의 데이터·수명 규칙.**

- 입력 바인딩이 확정된 응답에는 중복 terminal을 함께 처리할 실행/응답 토큰을 둔다. 처음 실패가 관측될 때 **호스트 한 곳에서 한 번** 불변 `failureId`와 `occurredAt`(epoch ms)를 발급한 뒤 같은 응답의 오류 재전달, UI 전송과 DB retry가 그 값을 공유한다. provider event에 불변 occurrence ID가 없어도 응답 슬롯 안에서 한 번만 발급한다. 새로운 실행은 같은 질문·같은 오류·같은 밀리초여도 새 ID다. 실패 수신 당시 입력 commit이 진행 중이면 원래 슬롯에 한정해 확인까지 순서를 보존한다. 취소·미확정 종료로 인과관계가 닫히면 안내로 마감한다. `turn_<seq>`, 임시 clientKey, 수신 당시 wall clock, SQLite AUTOINCREMENT msg/part ID를 공유 키로 쓰지 않는다.
- 데이터 호스트가 `(sessionId, failureId)` 유일성을 원자적으로 보장한다. 한 구현 형태는 append-only migration에서 소유 user·assistant·part FK가 있는 실패 영수증과 유일 제약을 두는 것이다. 같은 트랜잭션에서 session과 user/assistant 역할·키·원래 순서/소유를 검사하고, 기존 영수증 조회 혹은 assistant 행·error part·영수증을 함께 저장한다. 최초 receipt의 시각/본문·분류·retryable·소유 키는 불변이다. 동일 ID·동일 payload 재시도는 기존 영수증을 되돌린다. 불일치 충돌은 덮어쓰기 없이 실패한다. part만 만들어졌거나 영수증만 남는 상태는 없어야 한다. rollback 뒤 in-memory currentAssistantMessageId 등 writer 캐시는 무효화/복구한다. 영수증 응답이 유실되면 같은 ID로 재확인하고 호스트를 재시작한 뒤에도 기존 저장 한 건을 읽는다. 저장 자체가 실패했으면 기존 저장장애 안내·턴 종료가 한 번 일어나고 기록된 척하는 카드가 생기지 않는다.
- 승인받은 오류 request/ACK는 기존 turn 내 relay 순서를 지킨다. 성공한 DB 영수증의 session, ownerUserMessageKey, assistantMessageKey, failureId, occurredAt, ClassifiedError를 정규 live payload와 이력 DTO/part에 넣는다. 기존 IPC의 error·bare saved part·native-only odd payload는 읽을 수 있어야 한다. 구형 error는 기존 assistant/message와 part 순서로 표시한다. id/시간을 복원할 근거가 없는 데이터에 소급 생성하지 않는다. unrelated 일시 오류의 문구가 같아도 삭제하지 않는다. fork·archive의 기존 ID/part 복사와 새 세션 namespace를 존중한다.
- live/load 경합, `LOAD_SESSION`, `PREPEND_HISTORY`의 겹치는 메시지, `RESOLVE_HISTORY_BODY`의 parts 교체, 검색 target의 양방향 페이지 및 캐시 재열기에서 (session, failureId)로 한 건을 보인다. 확인 전의 오래된 page/body 응답이 ACK 뒤의 카드를 지우지 못하고, 저장된 오류/중복 ACK는 뒤의 활성 턴을 reset하지 않는다. 기존 5턴·128메시지·256parts·256KiB 페이지 및 64KiB body 단위를 유지한다. 기존 FTS로 **사용자 질문**을 찾아 local/native/archive locator → 해당 턴 target → 이전/이후 이력 → latest 재진입까지 확인한다. 오류 본문 자체의 전문검색은 R-09에 추가하지 않는다.

**검증 쌍 및 실행 순서 (§10).** VP-36은 CHANGED R-09의 REQUIRED 후속 쌍이다. VP-09′의 간격 판정·등록 변이·Code/Work 저장 대조군을 이어받고 입력 귀속과 재전달까지 판정한다. SD-03, AR-06, MD-12는 이 설계에서 NEW이며 VP-37~39가 각각 REQUIRED다. 기존 EP-9는 표시 간격을 계속 소유하고 EP-18이 오류의 생성·운반·복원을 맡는다. 아래 항목은 구현자가 추가·실행할 oracle이다. 현재 측정한 layout 20/21과 구분한다. 구현 전에는 실패 한 건의 provider 원본 입력, batch/user commit, sender/receiver 영수증, DB part, visible row를 같은 실행에서 대조해 최초 누락 경계를 기록한다. API 키 없이 provider SDK의 응답/로컬 transport만 대역으로 바꾸며 실제 adapter mapper·coordinator·host sender/receiver·SQLite 및 renderer event 경로를 통과시킨다. production 오류 mapper로부터 배우지 않는 독립 기대표 (S, user, assistant/응답, fault token, category, text, retryable)와 고정 시계를 둔다. DB를 닫고 다시 여는 검사는 메모리 store 재생성과 별도로 둔다.

| 쌍 | V 좌표·방향 | 필수 oracle과 실패 위치 |
|---|---|---|
| VP-36 | R-09 ↔ AT-09″ 사용자 표시, EP-18 + 기존 EP-9 | 기존 `errorRun` 두 fixture와 기존 4→4→4 재현을 보존한다. 직접 주입 무키 오류는 모호한 오류 대조군으로 저장 카드 3 + 일시 배너 1 = 총 4→4→4·신규 영속 0, 실제로 승인된 3회 실패는 별도 production 조립으로 3→4→5→6 및 여섯 행 각각의 입력 키·발생 ID·표시된 오류 본문, 각 단계 모든 인접 간격, 다음 성공·재열기·Work 중단을 Electron에서 확인한다. 무키 fixture에 가짜 owner를 덧씌워 실측을 통과시키지 않는다. |
| VP-37 | SD-03 ↔ ST-03 세션/프로세스, EP-18 | Claude result·예외(수락 전/후) 및 OpenCode message/session.error·접속 전 실패, 최종 catch·backoff·abort·host loss를 실제 소비/저장으로 조립한다. 동일 세션·같은 입력/오류·같은 시각의 서로 다른 시도 2건, 다른 세션 1건, grouped batch·prelude/steer·두 창 교차, active B 중 늦은 A 신호를 대조한다. row와 receipt 개수·owner·payload, 저장된 실제 reporter, live/영구 안내 구분, active stream/승인/초안/재시도 상태를 따로 assert한다. |
| VP-38 | AR-06 ↔ IT-06 원자성/이력, EP-18 | 실제 임시 SQLite와 host protocol을 사용한다. 최초 delivery·동시 중복·commit 후 응답 유실 재전송·기록 중간 예외/rollback·다른 owner로 ID 충돌에서 영수증/part 양쪽의 수·키·시각·콘텐츠를 조회한다. fresh store와 DB reopen, native frontier 앞/뒤 및 뒤의 정상 턴 추가 후 refresh, native/local fallback, archive/fork, 새 세션에 같은 key, 최신 5턴 밖으로 밀린 질문의 FTS→target/local·native·archive alias, 이전/이후와 deferred body 교체를 지난 뒤 원래 위치·동일 ID를 확인한다. |
| VP-39 | MD-12 ↔ UT-12 identity·reducer·렌더링, EP-18 | ordered batch 키를 단일 선두원소와 구분, assistant `a:`와 user `u:`의 role 검사, 서로 다른 ID의 동문 오류 2건/동일 ID 재전달 1건, 구형 id 없는 part·일시 error/동일 제목의 다른 카드·성공/abort·Work 실패 경계·OpenCode 카드의 marker, retryable hint·i18n, 취소와 child approval을 각각 판정한다. DOM 표지는 실제 카드/상태 텍스트·소유 user DOM과 같은 행에서 읽고 빈 marker만으로 통과시키지 않는다. |

| 단일 제거 및 방향 오류 | 자리 교환 (각 변이는 독립 실행) | 판별 결과 |
|---|---|---|
| consumer에서 error를 입력 소비 증거로 추가하거나 첫 배치원만 owner로 쓴다. catch를 직접 forward로 되돌린다. | 같은 text·동일 millisecond인 두 입력 A/B의 소유 role/key만 맞바꾸고, 별도 변이에서 session A/B만 맞바꾼다. | VP-37/39가 미승인 영속 1건, 누락, wrong owner/cross-session을 각각 검출. 개수와 같은 메시지 문자열이 그대로인 교환도 실패해야 한다. |
| sender에서 매 delivery 시 ID·시각 재발급, writer 유일/transaction 제거, DB 실패 시 UI를 먼저 발행, part ID merge 제거. | 서로 다른 두 실패의 occurrence ID만 교환한다. 별도로 retryable이 다른 두 오류의 payload/occurredAt만 교환한다. | VP-37/38/39에서 canonical receipt↔운반↔DB↔UI를 개별 입력 기준으로 비교. duplicate, rollback 잔여 행, phantom, 최초 시각 재작성, 두 distinct 실패 합침을 검출한다. |
| footer 한 칸 복구, failed Work 상태와 error 양쪽 표시, 구형 part 누락, native frontier 이전 오류 제외, 최신 snapshot으로 ACK 삭제, 중복 ACK로 활성 B reset. | 순서·개수·간격을 유지한 채 2·5번째 카드 **내용/소유**만 교환한다. 검색·native에서 A/B alias만 교환한다. | VP-36/38/39에서 실제 user↔카드, visible detail↔receipt, 선택 locator↔원래 턴, B live 상태가 각각 실패한다. |
| 기존 gap 1곳에 +8px 혹은 footer 예약 공백 추가, 중단 흐름을 durable error로 승격. | 같은 6행 fixture에서 서로 다른 두 gap 위치를 바꾸고, 기존 서로 다른 8/16/24px 간격을 쓰는 비오류 이웃 fixture에서도 교환한다. 균일한 동일 값 두 개의 교환은 관측 차이가 없어 변이로 집계하지 않는다. | VP-36으로 이관한 VP-09′의 검사가 개수·절대 순서뿐 아니라 이웃별 거리 벡터와 기존 정상/중단 대조를 잡는다. |

**EP-18 자리 전수.** `98381394` 저장소 루트에서 다음 표의 검색을 재실행했다. G1·G2는 기존 EP-9의 동일 술어를 현재 줄에 재매핑한 **21**자리다. 새 P/V/T/L은 각각 생성/오류 소비·표시/host 전달/이력 재조립의 개별 술어다. 서로 다른 술어의 수를 고유 코드 줄 수로 합산하지 않는다. 범위는 주어진 source 디렉터리와 파일에 한정된다. IPC 타입, queue/commit, projection/검색의 오류 이름 없는 일반 분기는 위 경계 표 및 VP-37/38의 실행 oracle로 이어진다. 구현에서 새로 생긴 receipt·키의 쓰기/읽기·전달은 그 **실제 식별자**로 main/shared/renderer 전역 검색 후 위치를 추가하고 같은 도구로 재검사한다.

| 분류 | 검색/AST 운반 후보/목록/제외 | 제외 이유 |
|---|---:|---|
| G1 블록 gap | 20/9/12/8 | Claude 7개·deferred 1개는 타입 선언. AST가 comment로 본 const gap 3개는 실제 할당이라 포함. |
| G2 프레임/여백 | 9/9/9/0 | 기존 Claude 범위에 대한 5 래퍼 + 4 예약 여백. |
| P main 오류 생성 | 26/24/20/6 | 정의·타입 2, mock 2, 저장 part·native 이력 part 생성 2(해당 소비는 V/T/L). 20곳은 runtime producer 19 + 공통 factory 본문 1. |
| V terminal·표시 | 30/6/23/7 | OAuth 도메인 1, import 3, 주석 1, 함수 선언 1, production Timeline에서 호출하지 않는 과거 Exchange 배너 1. AST comment로 분류한 switch/속성 접근도 값 운반 목록에 명시. |
| T host 프로토콜 | 8/8/8/0 | request/통지 및 writer 호출, user와 artifact 확인 대조 포함. |
| L 읽기·reducer 교체 | 20/11/16/4 | 함수 선언 4. local/native 투영, alias 복귀, optimistic/host lost, deferred·prepend·load 경계 포함. |

각 검색에서 미분류 0·목록만 0·종료 코드 0. 고정한 위치와 분류는 [기준선 자리 목록](evidence/site-inventory.json)에 있다. 저장소 루트에서 `node docs/handoff/0331-transcript-feedback-followup/evidence/check-sites.mjs errors`를 실행한다.

### 22-B. 대용량 본문 렌더링과 50ms 예산 (AC14′)

#### 제품 계약과 결정

**AC14′는 그대로 적용한다.** Claude Code와 OpenCode Code에서 과거 메시지를 열거나 스트리밍 응답을 받으면 문단·인라인·펜스·표·목록·각주를 끝까지 읽고 선택·복사하고 검색 결과로 이동할 수 있어야 한다. §21-C의 다섯 입력 각각에 대해 렌더러 메인 스레드에서 50ms를 넘는 작업이 0건이어야 한다. 측정에 걸리는 총시간, 평균 프레임, 워커 처리 시간, 노드 수 중 어느 것도 이 판정을 대신하지 않는다.

| 결정 | 이 계획에서의 효력 |
|---|---|
| D-009·AC8 | 크기로 원문 대체하지 않는다. 새로 연 완료 메시지에서 마크업을 먼저 원문으로 노출하지 않는다. 진행 중 꼬리에는 기존 증분 표시 계약을 적용하고 완료 표지는 마지막 소스 글자까지 파싱·화면 반영한 뒤에 낸다. |
| D-004·AC3′, D-025·AC14′, EP-13′ | 기존 자동 해소 진입점·세션/검색 소유권, UTF-8 검증, 4,000자 초과 완료 text/reasoning·스트리밍 확정 블록 워커 경로, Markdown 등록 ≤8,000,000 UTF-16 단위, 열린 등록 합 레인당 ≤32,000,000, 깊이에 관계없이 한 번에 HAST ≤20,000노드, 표 200행 조각을 유지한다. |
| D-028 (D-025 보완, 기술) | 큰 본문에서 창↔워커 전달, 파싱 결과 전달, 화면 적용 각각에 유한한 단위와 이전 단위 처리 확인을 둔다. 한 창의 모든 본문 조각은 같은 화면 적용 예산을 공유한다. 전체 등록·전체 트리 전송이 필요했던 부분만 바꾼다. |
| 0332 v2 실측 규칙 | 가시 행·관찰 등록 전의 DOM·앵커 좌표는 실제 기하로 측정한다. 기존 높이의 재사용은 동일 키·폭과 관찰 중인 노드가 확인될 때로 한정한다. 화면 아래에서 관찰 중인 overscan 행의 임시 추정값은 0332 §22-B가 실측과 구분해 관리한다. 실제 관찰 높이가 도착하면 갱신한다. Markdown 내부 포맷팅 최적화가 이 규칙의 예외를 만들지 않는다. |

D-028은 전송·커밋의 내부 이행 결정이다. 사용자에게 허용할 품질이나 유효 표본을 줄이는 결정은 포함하지 않는다. 예산을 충족하지 못하면 AC14′는 미충족으로 남는다. AC14′, INPUT 수, 반복 수, 전체 DOM, 선택·복사·검색 범위 또는 50ms 문턱을 바꾸려면 별도 명시 승인이 필요하다.

#### 기준선과 원인 확인

`98381394`의 0331 구현 보고를 기준으로 이전 전체 행렬은 30회 중 29회 최종 서식 일치, 그중 27회 장기 작업 발생, B3 두 회만 통과, B5 한 회 watchdog 종료였다. 완료된 29회에서 B1 57 + B2 347 + B3 33 + B4 280 + B5 180 = 897건이다. B5 별도 연장 관측은 257.312초에 40,000,000자의 2,443개 DOM 문단을 하나씩 원문과 대조했고 마지막 굵은 글씨와 pending 0을 확인했다. 이 별도 관측의 장기 작업 수는 첫 180.014초의 862건이다. 257초 전체의 성능 통과 또는 최신 커밋 재측정으로 합산하지 않는다.

`app/scripts/transcript-body/probe.tsx`의 현 fixture에서 B1 본문은 한국어 1,680,006 UTF-16 단위, 4,200,010 UTF-8바이트이며 JSON part는 4,200,037바이트다. B5는 원문 40,000,000 UTF-16 단위, 40,000,004 UTF-8바이트, JSON 40,004,915바이트다. 문자·인코딩 바이트·등록 합·DOM 노드를 별도로 기록한다. 계획 시점의 로컬 재계산은 fixture 크기에 관한 것이며 50ms 통과 근거는 아니다.

| 위치 (아래 경로의 기준은 저장소 루트) | 현재 비용 후보와 확인 방법 |
|---|---|
| `app/src/renderer/src/features/chat/lib/transcript/deferredBody.ts` → `shared/compute/worker/historyBody.ts` → `features/chat/store/chatStore.ts` (뒤 두 경로의 시작은 `app/src/renderer/src/`) | 64KiB raw 조각의 base64 배열을 창이 모두 모아 한 요청으로 전송한다. 워커가 fatal UTF-8·JSON·part 검사를 하고 전체 parts를 한 응답으로 복제한다. 요청·응답 양쪽 postMessage 호출, 창 message 수신과 store 적용을 구분해 잰다. |
| `features/chat/components/markdown/useMarkdownRows.ts` → `shared/compute/worker/handler.ts` → `shared/markdown/markdownSegments.ts` → `shared/compute/client.ts` | 65,536자 초과에서는 layout용 전체 source를 다시 전송하고 범위를 받아 모든 segment/row를 구성한다. 분할 등록 자체는 성공한다. layout 요청·결과 역직렬화·문서 open·markdown 작업과 대기를 분리한다. |
| `shared/compute/worker/markdown.ts`, `worker/markdown.worker.ts` → `features/chat/components/markdown/{MarkdownDocument,WorkerMarkdownTail}.tsx` → `shared/ui/markdown/{MarkdownHast,LongParagraphText}.tsx` | 워커가 블록 HAST 하나를 만들어 돌려준다. 창의 재귀 generator·행 묶음·긴 문단 줄바꿈은 이미 분할되어 있다. 수신, React render/commit, Range/DOMRect·style/layout, 페인트 전 작업과 이력 row 실측을 따로 추적한다. 임계시간 초과의 원인이 어느 하나라고 미리 단정하지 않는다. |
| `app/scripts/transcript-body/{probe.tsx,perf.mjs,electron-main.mjs}` | 실험 준비와 base64 인코딩은 시작 전에 하지만 창에 거대 fixture를 보유하며 즉시 해결되는 mock page를 쓴다. 변경마다 `querySelectorAll('strong')`를 수행하고 B3는 store.live를 직접 바꾼다. 현재 집계는 30개와 행별 flag/빈 배열을 보며 이벤트 지원·행 신원 집합·유실 검증이 없다. |

#### V와 단계별 이행

상속 기준은 0331 V1 + ΔV1~ΔV4의 VP-29′(R-14↔AT-14), VP-31(AR-04↔IT-04), EP-13′이다. R-14와 AT-14는 상속한다. 기존 VP-29′의 REQUIRED 판정에 VP-43을 REGRESSION으로 연결한다. VP-40은 CHANGED AR-04의 VP-31을 대체하고 기존 워커 왕복·취소·늦은 세대 폐기 단언을 이관한다. VP-41은 CHANGED MD-08·MD-11, VP-42는 CHANGED SD-02의 추가 경로이며 기존 VP-13 자동 본문 요청·교체와 VP-16 정상 HAST·위치·URL은 회귀로 유지한다. `app/src/renderer/src/`를 renderer 경로의 접두어로 쓴다.

| Pair | 수준·필요성 | 생산 경로 → 직접 oracle |
|---|---|---|
| VP-40 | AR-04 ↔ IT-04, REQUIRED | 실제 history body page → `readDeferredParts` → compute worker → 일반·검색 view reducer → 두 하네스. 워커 전송 방향별 max bytes/문자, in-flight 수, 등록 예약·해제, 재시작·취소 전후의 실제 부착 메시지/part/내용을 본다. |
| VP-41 | MD-08 ↔ UT-08(분할 커밋), MD-11 ↔ UT-11(등록·회복), REQUIRED | 실제 등록 큐 → markdown.worker → 실제 `MarkdownRowView`·`WorkerMarkdownTail`·`MarkdownHast`. 원천 누락/중복, 참조·소스 위치 및 각 React 커밋의 실제 증가분과 누적 결과를 독립 기대값과 대조한다. |
| VP-42 | SD-02 ↔ ST-02 (완료·선택·검색), REQUIRED | 페이지·검색 문맥·마지막 delta → store → 실제 TranscriptView → 최종 DOM → native Selection/클립보드·검색 결과. B1~B5 전체 서식, 세션 교체와 완료 중 pending을 본다. 기존 3하네스 AC3′/AC8 회귀도 실행한다. |
| VP-43 | R-14 ↔ AT-14, REGRESSION (VP-29′의 실기 강화) | 출하 경로를 쓰는 격리 Electron 30창 → Chromium Long Tasks 원시기록 + 창 밖 행렬 검사. 각 조합의 개별 완료·서식·관측 무결성·50ms 수치가 있어야 한다. |

1. **계측을 먼저 분리한다 (VP-43).** Electron main/별도 프로세스에서 자료·UTF-8 예상값·문단별 기대치를 만들어 둔다. 실제 `sessionApi.page` 경계에서 순번 있는 64KiB 응답을 IPC task로 전달한다. B3은 `ingestChatEvent` → 실제 delta coalescer/store → 화면 경로를 쓴다. B1·B2·B4·B5 시작은 첫 유효 body 응답이 창에 도착한 시각, B3 시작은 첫 delta가 창에 도착한 시각이다. 입력을 기다리는 동안 observer 등록/지원 확인을 끝낸다. 구간 내에 세션 해소, 첫 원문 전달과 워커 응답, 구문 적용·React commit·실제 레이아웃을 포함한다.
2. **워커 요청의 수명과 전송량을 먼저 묶는다 (VP-40).** `begin/append/finish/release` 역할을 기존 요청 id·lane·revision·AbortSignal에 연결한다. 한 작업당 다음 64KiB 분량은 이전 조각의 정상 수신 확인 뒤에 읽는다. base64 수신량 ≤ 87,384자/회, 원본 byte offset 연속, 마지막 done 및 ref.bytes 일치, fatal 디코더를 유지한다. 창에서 전체 JSON.parse, base64 전체 join, 본문 전체 postMessage를 하지 않는다. 워커에서 기존 JSON·part 의미 검사 후 작은 메타와 순번 있는 텍스트 구간을 반환한다. 비텍스트 field/part·부모 도구·서명·순서와 미완료 도구 정착을 보존한다. 공개 DB/IPC의 `AppMessagePart` 텍스트는 원문이다. 기존 저장 형식·과거 세션을 그대로 입력으로 쓴다.
3. **40M 원천과 32M 열린 등록은 서로 다른 수명으로 관리한다 (VP-40·41).** 큰 본문 원본은 데이터 호스트에 저장된 part와 이를 다시 읽는 기존 body 페이지를 정본으로 둔다. 세션/세대/메시지/part/수정판별 원천은 조각과 UTF-16 누계로 식별한다. 디코드 결과를 무제한 워커 Map에 두거나 40M 전체를 layout 요청으로 재복제하지 않는다. 실현 경로는 워커에서 한 번의 JSON 검사·레이아웃 뒤 **분할 가능한 스냅샷**(예: 워커에서 생성한 immutable Blob의 분할 목록과 길이/offset, 전송은 한 핸들씩)으로 내보내고 임시 JSON·디코드 문자열·표를 정리하는 것이다. Blob 자체를 원천 레지스트리 상한 우회에 쓰지 않는다. 행 전개 전에 필요한 범위만 읽고 실제 등록되는 text ≤8M, 레인 max 합 ≤32M, 창/워커 사이 문자열 message는 고정 크기로 받는다. 등록·행 정보도 가변 길이 배열 한 번으로 보내지 않는다. 이미 창에 있는 live source는 append delta와 reset/revision으로 워커에 반영한다. 기존 `AppMessagePart.text: string`을 읽는 입력 모델·특정 메시지 복사 등 기존 API는 원천 원문과 완전히 일치해야 한다. 기존 part 표현을 유지하는 구현은 크기가 제한된 전송 조각을 차례대로 합치되 이력 투영·공백 검사·Markdown 분할을 위해 매 업데이트마다 거대 문자열을 평탄화하거나 전체 스캔하지 않는다. 파생된 비공백 여부·텍스트 길이·part 키/offset을 `features/chat/lib/parts.ts`와 양 하네스의 블록 투영까지 전달한다. 공개 메시지에 핸들 문자열·빈 text를 넣는 지름길은 의미 단언 실패다.
4. **예약·재등록을 명시한다.** 가장 긴 블록은 Markdown 블록 → 줄 → 서로게이트 사이를 피한 문자 순서로 자른다. 경계 양쪽의 펜스 상태, 참조 정의·각주 번호와 역링크, 인라인 문맥은 워커의 문서 범위 색인으로 잇는다. 한 번에 한 활성 구간부터 등록하고 마운트된 DOM이 소스를 더 쓰지 않을 때 임차를 반환한다. 다른 열린 문서가 있는 경우 read/parse 크레디트를 제한하고 용량 회복 뒤 재개한다. 스냅샷 참조와 열린 등록 비용, 디코드·파싱 일시 최고 사용량, 처리 대기 결과는 별도 계수한다. 창이 닫힘·취소·revision 교체·worker 재시작 때 늦은 ack/응답을 버리고, 임차/크레디트/Blob 참조·이벤트 리스너를 1회 정리한다. 현재 소유자만 재조회·재생한다. 등록 후 매 블록마다 전체 소스 재전송이 없는지 실제 포트에서 본다.
5. **동일 파서 출력으로 작은 화면 작업을 만든다 (VP-41).** 분석 결과가 큰 블록은 워커 안에서 기존 unified/GFM·URL 변환·HTML 문자 처리 규칙으로 평가한다. 한 번에 건너가는 HAST 전체를 문서·revision·단조 순번·노드 위치를 가진 bounded `open/text/close` 등의 프레임으로 바꾼다. 단일 긴 text·속성/URL·코드 한 줄, 깊은 중첩과 넓은 형제에서도 한 프레임의 byte/노드 상한이 적용되어야 한다. 긴 속성은 쪼개 전송한 뒤 값이 완성된 시점에 한 번 적용한다. GFM 표는 유효한 동일 table/thead/tbody와 순서를 유지한다. 여러 각주·참조가 지연/경계를 가로질러도 같은 href/id를 얻는다. 열린 노드 스택의 무제한 재구성, 완료 prefix의 매 프레임 전체 재생·누적 prefix 대조를 없앤다. 스케줄러가 이미 적용한 접두부·sourceParts offset을 유지하고 다음 조각을 append한다.
6. **한 창에서 실제 커밋을 직렬화한다 (VP-41·42).** `MarkdownDocument`의 문서·table row·스트리밍 tail·긴 문단이 하나의 작업 큐를 쓴다. 렌더 시간, 노드, 텍스트 크기 중 먼저 도달한 상한에서 새 task/프레임에 양보한다. DOM 커밋 확인 뒤 다음 batch를 허용한다. 기존 20,000노드는 절대 상한이다. 초기 작업 크기는 기존 5ms 생성 예산·4096자 샘플을 출발점으로 하고 원본 B1~B5 실기에서 긴 React commit과 Chromium style/layout까지 측정해 더 잘게 잡는다. `Promise.resolve` 연쇄만으로 양보하거나 각 leaf마다 독립 rAF를 신청하면 한 프레임 합계가 초과할 수 있다. 실제 50ms PASS가 될 때까지 총량과 호출 횟수·최장 task를 함께 기록한다.
7. **CSS와 native 동작을 보존한다 (VP-42).** 이미 표시한 문단·인라인 일부를 잘라내는 내부 transcript 가상화를 쓰지 않는다. 별도 아티팩트의 `VirtualMarkdownView` 범위는 보존한다. 큰 일반 문단에서 이미 쓰는 `content-visibility:auto`와 측정된 줄 경계 묶음을 확장할 때 최종 DOM에는 원래 2,443개 `p`, 모든 자식과 텍스트가 동시에 존재해야 한다. B4 인라인의 임의 block/inline-block 삽입은 줄바꿈·link hit target·복사 개행을 바꿀 수 있다. 실제 너비·폰트·줄 경계에서만 묶고 공백/soft wrap·RTL/한글·코드와 링크 keyboard focus·가로 표 넘침을 원래 출력과 비교한다. 검색 이동과 native selection은 화면 밖 내용도 드러내야 한다. `hidden`/unmount/접힌 placeholder를 최종 콘텐츠로 인정하지 않는다. ResizeObserver 이전에 최초 row 및 앵커 위치에 필요한 실제 DOMRect를 유지한다. 같은 callback에 쓰기 없는 경우만 실측 결과를 재사용한다. 폭·폰트·새 DOM·revision 바뀌면 측정 캐시를 무효화한다. 0332 CDP에서 보인 실측 비용을 일괄 제거할 근거로 쓰지 않는다.

#### 실기 판정·관측 실패의 의미

`cd app && xvfb-run -a node scripts/check-transcript-history.mjs --perf`는 `{claude-code,opencode-code} × {B1,B2,B3,B4,B5} × {0,1,2}` 정확히 30창을 격리 실행한다. gate 내부에서 정상 표본을 고르거나 실패 행을 덮어쓰지 않는다. 진단 재실행/단일 fixture/observer 자기 검사는 별도 run id로 보존한다. 버전·SHA·OS·뷰포트·DPR·입력 크기·온전한 행 원문을 함께 남긴다.

| 입력 | 종점과 독립 기대값 |
|---|---|
| B1 | 실제 64KiB 경계에서 다중바이트 한글이 갈라지는 단일 text ≥4MiB. 한 문단 전체 텍스트·마지막 strong을 원문으로 대조한다. 긴 줄 wrapping 두 단위에 걸친 Selection을 잡고 기대 문자열과 실제 OS clipboard를 비교한다. |
| B2 | 1MiB 혼합 본문, 정확히 3,000개 기대 문단·40개 펜스·2,001 data행·600열 표·30,000항목·정상 각주와 backlink·마지막 strong. 개수와 함께 원천 fixture에서 만든 요소 순서·각 본문·대표 href/열별 정렬을 비교한다. |
| B3 | 첫 입력부터 누적 50,001자 이상. 마지막 delta의 실제 마지막 source offset = DOM `data-markdown-tail-parsed`이고 해당 글자까지 서식·텍스트 일치, pending/error 0. 먼저 표시된 prefix의 오래된 revision·raw tail·마지막 delta 전달만으로 완료 처리하면 실패한다. |
| B4 | 한 `p` 안에서 inline code 12,500개와 `https://example.org` 링크 12,500개가 원래 순서로 번갈아 있으며 각 항목의 텍스트·href와 최종 strong을 대조한다. 최초/중간/마지막 link focus·선택을 검사한다. |
| B5 | 40,000,000자 입력, 동시에 실제 DOM의 `p` 2,443개, 원천으로 산출한 모든 paragraph text 1:1 일치, 마지막 **완료** 서식과 pending/error 0. 40M을 8M 하나로 잘라 보여 주거나 추정 높이만 남기면 실패한다. |

B1·B2·B4·B5는 첫 body 응답부터 pending/error 없음 + 마지막 서식 및 완료 revision + 10번 연속 실제 프레임 무변화까지 잰다. B3은 첫 delta부터 마지막 글자 서식 반영까지를 포함하고 완료 뒤 10프레임도 보존한다. 관측기는 scoped MutationObserver가 모은 작은 상태 변화와 프레임 번호만 기록한다. `strong` 전체 탐색/XPath, 매 프레임 소스·전체 DOM 비교를 하지 않는다. 전체 DOM·각 문단 일치 검사는 종료 표지를 캡처한 뒤 독립 기대 자료로 분할 실행하고 첫글자/중간/마지막 누락, 실제 clipboard 불일치, 검색 실패 하나라도 있으면 해당 행 전체를 실패로 둔다. 검사를 늦춰 실행한 것을 제품 렌더 종점의 증거로 삼지 않도록 끝 시각 때 리비전·마지막 DOM 위치·미처리 수를 별도로 확인하고, 이후 뒤늦게 추가된 제품 콘텐츠는 종점 위반으로 처리한다.

`PerformanceObserver.supportedEntryTypes`에서 `longtask`를 확인하고 관측기 등록 실패·실패한 통제 양성 작업(별도 비계측 창에서 실제 >50ms task를 일으켜 사건 수신 확인)·관측 손실/중단·잘못된 타임스탬프는 실패로 기록한다. start/end는 유한하고 순서가 맞아야 한다. Chromium의 `startTime+duration>start && startTime<end`로 겹친 longtask를 반올림하거나 부분 길이로 잘라 빼지 않는다. 현 gate처럼 보고된 longtask 배열이 비어야 green이다. `long-animation-frame`은 보조 수치다. collector callback·takeRecords flush·종료 뒤 event-loop 턴에 걸쳐 끝에 걸친 작업도 수집한다. renderer 정지/timeout(B1~B4 180초, B5 600초, 런처 여유 15초), 중복·누락·다른 fixture·잘못된 행 shape, 누락된 필수 숫자/배열·semantic oracle는 실패다. 실행 불가(예: Electron 없음)는 환경 exit 3, 실행된 미충족은 exit 1, 정확히 30개가 모두 충족하면 exit 0이다.

장기 작업마다 원래 start/duration·해당 창/입력/run·시작/종료 단계·long frame script/forcedLayout과, 재현 진단에서 CDP trace의 task/React commit·style/layout·worker send/receive 시점을 함께 남긴다. 분류는 제품(전송/파서 결과/React·DOM/브라우저 레이아웃), 계측기(선택자·mock 공급·동기 로그), 둘이 겹침 또는 근거 부족으로 한다. 귀속 미확인도 초과 1건이다. 계측기 자체라면 측정기만 최소화한 후 **동일 제품·자료·전체 구간**에서 같은 형상·수치를 재측정한다. 무수집/무부하 통제 창의 차이만으로 특정 장기 작업을 빼지 않는다. 최종 정상본 30회에는 별도 진단의 강제 busy loop나 동기 trace 덤프를 주입하지 않는다.

#### §10 EP-19 — 자리별 규칙·실패 검출

| 자리군·pair | 실제 호출/수명과 직접 단언 | 등록 변이 → 실패 기준 |
|---|---|---|
| 수송·구간 / VP-40 | 페이지 요청과 응답 echo/offset/done/총 바이트, worker 송수신 및 해제 이벤트와 실제 `fromLoadedMessage`·`RESOLVE_HISTORY_BODY` 결과. 두 세션·같은 id 다른 generation·검색 전환·팝 캡처·재시도·취소·깨진 UTF-8·중간 chunk 누락을 각각 넣는다. | 64KiB 넘는 응답 허용 / 마지막 ack 전 store 반영 / 용량 반환 생략 / 옛 결과를 새 메시지에 적용 / 창의 동기 decode 복귀를 해당 자리마다 심는다. 크기·오류/부착 수·원천 원문·실기 B1 대조가 각기 red여야 한다. |
| 등록·구간 / VP-40·41 | 실제 `client.openDocument`/레인 worker의 register→job→release 순서와 피크. 32M 안팎/이미 예약 24M·32M/두 세션/8M보다 긴 한 줄·CRLF·surrogate 양쪽·경계 양쪽 펜스/각주. UTF-16 연속 범위가 원문[0,length)를 한 번씩 덮고 마지막까지 임차 회복. | 전체 40M 등록 / 예약 합에서 다른 doc 누락 / 중간 segment 중복·마지막 누락 / 분할 경계에서 의미 상태 초기화 / 체류 중 release 누락 → 실제 대기·합계·문단·href·pre/code 내용 assertion red. |
| 표시·사용 / VP-41·42 | 워커 결과와 실제 표·중첩 목록·인라인·코드·긴 prose의 commit 증가분을 관찰한다. 형제 leaf 여러 개가 함께 증가할 때 창 합과 실제 프레임을 잰다. 4,000/4,001 경계, 새 완료 메시지 첫 표시, 직전 세션의 늦은 응답·현재 세션 재활성·B3 마지막 delta까지 검사한다. | 배치마다 전체 HAST 전달 / 각 leaf 무제한 동시 commit / 마지막 글자 전 parsed 마킹 / 새 완료 메시지에 raw·잘린 DOM / 인라인 코드와 링크 뒤집기 → 포트 최대 크기·커밋 통계·정확한 DOM·50ms 중 대응 단언 red. |
| 사용 / VP-42 | 브라우저 실제 `Selection` + Electron native copy(시스템 clipboard sentinel을 원문 예상값으로 교체), 범위가 prose·코드/링크·sourcePart 경계를 가로지르게 한다. `search` 문맥 → `revealSearchRow`로 해당 메시지와 하이라이트를 확인한다. Electron `webContents.findInPage`의 실제 `found-in-page` 완료/일치 및 대상까지 이동 후 Range rect를 보조 검사로 쓴다. B5는 고정 fixture 마지막 ‘완료’ 및 별도 변형의 중간 유일 토큰, B2 각주/표·B4 링크를 확인한다. 기존 가상행 교체의 선택 취소 규칙을 보존한다. | 가운데 DOM 삭제 / 원문 없이 placeholder만 / part offset 교환 / 개행 삽입 / 검색 reveal의 실제 대상 교환 → 독립 전체 텍스트·OS clipboard·검색 도착·실제 좌표 red. |
| 실기 / VP-43 | 정체성 30개, 시작/끝+10 frame, 관측기 양성·원시 events·형상검사·기한·종료 코드. 실제 입력/마지막 marker 위변조를 포함한 행 단위 decoder/집계기를 순수 테스트한다. | observer off / 마지막 프레임 누락 / B5 끝 1문단 누락 / 동일 행 복제해 30개 / 결과 필드 제거 / 시작 전·종료 직전 걸치는 80ms 주입 / timeout을 정상 처리 각각 red. 원본 명령이 0으로 복구되는 것까지 기록한다. |

`app/src`와 `app/scripts`의 전체 생산·실기 원천에서 읽기·등록량·서식/위치·실기 결과를 운반하는 술어를 사용했다. 아래는 98381394에서 검사한 **AST 운반 발생 자리**다. 같은 줄이 여러 규칙을 운반하면 각 검색에서 센다. 이 수는 서로 다른 메서드 수가 아니다. 자리 목록의 `sites`는 해당 기준의 직접 검사와 연결한다. `excluded`는 다른 시나리오·패널/메타데이터이지 본문 생산 경로에서 제외된다는 뜻이다. 구체적으로 `history-index-queries:218,219`는 메타, `history-page:122`는 메타, 공용 schema 153·164는 panelDetail·metadata, history-panel-*는 패널용이다. ArtifactPreview는 아티팩트 보기, reporter·다른 probe는 자체 observer/표지다. CSS의 fragment wrapper는 실제 선택·글자 경계 규칙이므로 `unparsed` 운반을 포함한다. 계획된 새 begin/chunk/credit·적용 완료·계측 schema는 이 기준에 아직 없다. 구현 후 각 발행·전달·수신·해제·실제 커밋·필수 행 검사 자리를 동일 전수 범위에서 다시 검색해 해당 원천·검증 좌표를 추가한다. 기준선의 숫자에 새 코드까지 소급해 PASS를 매기지 않는다.

| 검색 | 검색 줄 | 운반 후보 | 자리 | 사유 제외 | 미분류 | 목록만 |
|---|---:|---:|---:|---:|---:|---:|
| 구간 | 82 | 59 | 52 | 7 | 0 | 0 |
| 사용 | 21 | 18 | 17 | 1 | 0 | 0 |
| 수송 | 51 | 32 | 24 | 8 | 0 | 0 |
| 등록 | 32 | 18 | 17 | 1 | 0 | 0 |
| 표시 | 49 | 31 | 30 | 1 | 0 | 0 |
| 실기 | 29 | 22 | 13 | 9 | 0 | 0 |

저장소 루트에서 `node docs/handoff/0331-transcript-feedback-followup/evidence/check-sites.mjs markdown`을 실행한다. 제품 코드를 재배치하면 검색 결과와 목록의 차이를 확인해 새 자리와 제외 사유를 기록한다. [검색·분류 목록](evidence/site-inventory.json)

부가 검색은 AST가 문자열 리터럴에 섞인 선택자·template literal·숫자 상한·비동기 완료 조건을 전부 해석하지 못하는 구간을 덮는다. 저장소 루트에서 `rg -n 'pending|complete|stable|takeRecords|supports|supportedEntryTypes|observer|budget|longtask|startTime|duration|selection|querySelector' app/scripts/transcript-body`, `rg -n 'postMessage|requestAnimationFrame|getBoundingClientRect|reserved|capacity|parseResponse|onComplete' app/src/renderer/src/{shared/compute,shared/ui/markdown,features/chat/components/markdown}`, `rg -n 'sourceParts|hasSegmentText|hasSegmentReasoning|isMainTextPart' app/src/renderer/src/features/chat/{lib,harnesses}`로 raw source와 사용자·harness 소유자를 확인한다. 바뀌는 실제 제어 지점은 VP-40~43의 해당 행에 추가한다. AST 미분류 0은 열린 Markdown 문법·성능 자체의 인증이 아니다.

**계획의 선언 경계.** AC14′ 성능 모집단은 §21-C에 이미 정의한 5개 입력 × 2개 화면 × 3회다. 임의 장비/모든 Markdown의 50ms 보장은 이 행렬로 추정하지 않는다. 유효한 기존 Markdown의 내용·의미는 입력 크기로 제외하지 않는다. 새 워커 프레임 종류·알 수 없는 타입/순번·끝나지 않은 open/close·다른 revision은 제품에서 해당 작업 오류/취소로 처리하고, 계측기에서는 결측/미완료를 실패로 본다. 범위 외 Claude Work도 기존 AC3′·AC8의 source와 pending·선택 회귀로 검사한다.

**운영 gate.** 작업 중에는 수송·임차·세션 교체·단일 B 재현과 변이별 red→복구를 쓰고, 최종 SHA에서 `app/AGENTS.md`·`app/src/renderer/AGENTS.md`에 따라 lint/typecheck, 직접 Vitest(실제 history worker/client/등록·MarkdownHast·StreamingMarkdown·chatStore·transcript selection/search/viewport), `node --test scripts/*.test.mjs`, `xvfb-run -a node scripts/check-transcript-selection.mjs` 및 `xvfb-run -a node scripts/check-transcript-history.mjs --perf`를 실행한다(모두 `app/` 기준). 기존 `check-transcript-history.mjs` 기본 동작과 0332 v2 최초/observer/앵커 위치도 동일 버전에서 회귀한다. 수치 조정값 근거와 actual payload/최대 커밋·잔여 longtask 귀속, 실패 행 원문을 구현 보고에 붙인다. 30행 전부 green 및 각 의미 단언/기존 정상 회귀 일치 전에는 VP-29′/AC14′를 닫지 않는다.

### 22-C. 구현 인계와 READY 대조

1. AC9″에서는 영속 가능한 실패와 일시 알림에 서로 구별되는 입력을 준다. 이전 자료를 읽는 호환 경로, 네이티브 이력 합류와 재시작을 포함해 §22-A의 SQLite·호스트 통합 검사와 `app/`의 `node scripts/check-transcript-history.mjs --layout`로 판정한다.
2. AC14′에서는 다섯 입력의 마지막 DOM과 원문을 확인한 뒤 두 화면의 30개 관측을 모두 집계한다. 단계별 계측이나 한 화면의 성공 기록은 최종 행렬과 분리해 남긴다.
3. 통합 트리에서 기존 이력 390건·검색 6건, 선택·복사와 인접 행 간격을 다시 확인한다. 공통 뷰포트를 바꾸면 [0332 §22](../0332-right-panel-global-depth/plan.md)의 모드별 패널 검사도 수행한다. 원래 통과한 다른 15개 AC는 기존 V·운영 게이트를 따른다.
4. §22-A·B의 현재 경로와 분모는 [자리 대조 명령](evidence/check-sites.mjs)으로 재현한다. 현재 기준선의 분류와 새로 구현할 오류 영수증·워커 전송 위치를 분리해 기록한다. 다음 단계는 Codex의 구현이며, 이 설계 턴은 독립 검증 횟수와 r1의 15/17 판정을 바꾸지 않는다.

## 23. ΔV6 — 0331~0333 사용자 실측 후속

**판정: 사용자 실측 5건 중 0331 몫 4건을 받는다.** 빈 행·본문 실패(두 경로)·간격은 원인을 재현했다. 도구 카드 색 없음·Markdown 원문은 "워커 실패가 창 수명 동안 영구 폴백으로 남는" 경로만 확정했고 최초 계기는 재현하지 못했다. 우측 패널 뒤로 가기 중복은 [0332 §23](../0332-right-panel-global-depth/plan.md)이 받는다. 기준 트리 `c052c301`, 재현 자료 [evidence/dv6](evidence/dv6/README.md).

### 23-A. 요구 원문 ↔ 판정

| # | 사용자 원문 (2026-11-27) | 판정 | 관측 | 반영 |
|---|---|---|---|---|
| 1 | “transcript에서 '응답 중단'이 연이어 나오는 케이스에 대해 줄바꿈공백이 해결되지 않음. Element 분석 시, 공백 또한 data-index로 감싸져있음. 그러나 하위 엘레먼트가 없음” | 현재 결함 — D-010 미충족 | Chromium 실측(`probe-results.json`): `claude-work:normal`·`abortTwice`의 `ended` 행 children 0·16px, `abortNoEnd`의 `unknown` 행 children 0·24px, `claude-code:pendingAsk` 행 children 0·16px. `Timeline.tsx:193`·`AskExchange.tsx:15`가 null을 그려도 행과 `pt-*`가 남는다. 기존 `errorRun`은 `aborted`만 써서 놓쳤다 | D-029 · AC18 · EP-20 |
| 2 | “어시스턴트 메시지를 렌더링하지 못하고 '메시지 본문을 불러오지 못했습니다. <다시 시도>' 안내 및 버튼 렌더링이 되고 있음. 왜 이러는 건가?” | 현재 결함 — 경로 2개 확정 | (a) SQLite(`stale-body.db.test.ts.txt`): 색인된 메시지 변경 → 새 세대 → 이전 참조 `stale`(`history-page.ts:142`) → `deferredBody.ts:91` throw → `chatStore.ts:2782` 실패. 다시 시도도 같은 참조라 영구 실패. (b) Chromium(`run-drop.mjs`): 실행 중 diff(pair) 취소 → `client.ts:470` 워커 교체 → 다음 조각 `Invalid history body range`(`historyBody.ts:35`). 실패 사유는 기록되지 않는다(`chatStore.ts:2780` catch) | D-030 · D-031 · D-032 ③ · AC3″ · AC19 · EP-21·22 |
| 3a | “read, edit 등등 모든 도구 카드에서 본문 내용에 대한 pretty format(확장자에 맞는 텍스트 폰트 지원, 셸 명령 등등)이 사라짐” · 질의 답 “색만 없는 고정폭 코드” | 경로 확정 · 계기 미재현 | 같은 트리를 Chromium에서 그리면 Read `.shiki` 1·`.line` 12, 큰 본문 3조각 뒤에도 강조 151건 정상. 색이 빠지는 경로: 강조 실패 → `useHighlightedHtml.ts:27` 무시 → 원문. 레인이 연속 3회 실패하면 창이 닫힐 때까지 전 요청 거부(`client.ts:204·572`). 요청 실패·거부는 기록되지 않는다 | D-032 · AC20 · EP-23 · WU-0 |
| 3b | “또한 도구 상하 간 간격이 너무 좁아짐. 324 이전을 참고할 것.” · 질의 답 “0324 이전 값 전부” | 사용자 결정 변경 | 0324 이전(`671ee43d~1`): 세그먼트 사이 `gap-[var(--chat-item-gap)]`=8px(`registries/assistant.tsx:14`), 그룹 안 카드 8px, Work 행 `py-2`. 현재: 도구 블록 12(`claudeBlocks.ts:564`) · 카드 `gap-g2`=4px(`ToolGroup.tsx:95`) · Work `py-1` 3곳 | D-033 · AC10″ · EP-10′ |
| 5 | “특정 세션에서 어시스턴트 답변이 마크다운 원문으로만 출력되는 현상 발견.” | 경로 확정 · 계기 미재현 | 4,000자 초과 본문은 워커 경로다. 요청 실패 시 `MarkdownDocument.tsx:169`가 `<pre data-md-block-error>`로 원문을 그리고 다시 요청하지 않는다(같은 폴백 `:276`·`SegmentedFence.tsx:130`·`VirtualMarkdownView.tsx:26`·`WorkerMarkdownTail.tsx:51`). Chromium 30절 장문은 `h2` 30·표 30·오류 0 | D-032 · AC20 · EP-23 · WU-0 |

- 재현하지 못한 계기(3a·5)는 추측으로 고치지 않는다. WU-0이 사용자 앱 로그의 `compute.worker.failed`와 D-032 ③④의 새 진단으로 계기를 찾고, 코드 결함이면 현재 결함으로 이번 라운드에서 고친다(§23-F).
- 2(b)는 3a·5와 같은 "워커 레인 수명" 문제다 — 워커 교체가 사용자 실패로 새어 나온다.

### 23-B. 제품 계약 (Part I 보완)

| 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| Work 응답이 `ended`·`unknown`으로 끝남 · Code 질문이 아직 미응답 | 블록 모델이 행을 만들지 않는다(D-029) | 빈 줄 없음. ‘응답 중단’ 행 사이 간격 일정 |
| 큰 본문 조회 전·중 세대 교체 | data 호스트가 키로 현재 세대에서 답한다 · 창은 첫 조각부터 다시 읽는다(D-030) | 스피너 → 현재 본문. 실패 문구 없음 |
| 큰 본문 조립 중 계산 워커 교체 | 워커 `worker-replaced` → 창이 처음부터 다시 읽는다(D-031) | 스피너 → 본문 |
| 재시작 3번째 · 호스트 불가 · 키 없음 · 형식 위반 | 실패 + 사유 로그 1줄 | 오류 문구 + ‘다시 시도’(새 조회 1회) |
| 이전·이후 이력 읽기 중 세대 교체 | 커서를 키로 재해석해 다음 5턴 응답 · 창이 응답 세대를 받아들인다 | 당김 스피너 → 앞삽입(AC6″ 보정 유지). 토스트 없음 |
| 워커 레인 연속 3회 실패 | 대기(2·10·60초) 동안 거부 → 다음 요청에 새 워커 | 대기 동안 원문 |
| 레인 회복(실패 뒤 첫 성공) | 회복 회차 +1 → 워커 원인 폴백 화면 각 1회 재요청 | 원문 → 구문 강조·Markdown·본문 |
| 도구 카드·Work 행 | 블록 위·아래 8px · 그룹 안 카드 8px · Work 행 `py-2` | 0324 이전 간격 |

**AC 분모 17 → 20**(AC18~AC20 추가, AC3·AC10은 CHANGED).

### 23-C. AC 변경·추가

| AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|
| **AC3″** (CHANGED — AC3′ 대체, AC3′의 (a) 자동 요청·스피너·버튼 0 (b) 실패 재시도 (c) 전환 뒤 폐기는 유지) | (d) 조회 전·중 세대가 바뀌면 실패 표시 0 — 첫 조각부터 현재 세대로 다시 읽어 현재 본문을 렌더한다 (e) 조립 중 워커가 교체되면 실패 0 — 처음부터 다시 읽어 렌더한다 (f) 재시작은 조립 1회당 2회까지, 3번째와 호스트 `unavailable`·키 없음·형식 위반만 오류 문구 + ‘다시 시도’, 다시 시도는 새 조회 1회 (g) 실패마다 사유(`stale`·`invalid`·`unavailable`·`cancelled`·`worker`·`churn`·`transport`) 로그 1줄 | 렌더 텍스트·`button` 수·`sessionApi.page` 질의 순서(offset 0 재등장)·로그 호출 인자 | 페이지 commit → 자동 본문 → `sessionApi.page(body)` → data `history-page` → 워커 `historyBody` → `RESOLVE_HISTORY_BODY` → 렌더 |
| **AC10″** (CHANGED — AC10′ 대체) | Code: 도구 블록 위 간격 = 아래 간격 = 8px(±1) · 그룹 안 카드 사이 8px(±1). Work: 도구 행 사이 16px(±1) | Electron 실기 DOM 거리 + 블록 gap 값 | production `TranscriptView` |
| **AC18** (NEW) | 세 transcript 화면에서 모든 `[data-index]` 행이 높이 > 0인 자식 요소를 가진다. 입력: Work `aborted` 6턴 사이에 `ended`·`unknown`·이중 응답(`aborted`+`ended`)을 섞은 6턴 · Code 미응답 질문 · §23-E EP-20 자리별 입력. 연속 ‘응답 중단’ 6행의 다섯 인접 간격 최대−최소 ≤ 1px | Electron `--layout` 새 시나리오 `errorRunMixed`·`pendingAsk` + 자리별 렌더 단위 테스트 | 메시지 → 블록 모델 → `Timeline` → `TranscriptViewport` |
| **AC19** (NEW) | 이전·이후 이력 읽기 도중 세대가 바뀌어도(색인된 메시지 변경·native 갱신) 실패 토스트·오류 머리 0, 다음 5턴이 앞삽입되고 AC6″ 보정이 유지된다. 일반·검색 보기 둘 다. 커서의 키가 현재 세대에 없으면 기존 실패(토스트 1회·다시 시도) | DB 커서 재해석 결과 · 창 `history.generation` 갱신·토스트 호출 0 · 앞삽입 메시지 ID | 상단 도달 → `readPrevious`/`readSearchEdge` → data `readCursor` → `PREPEND_HISTORY` |
| **AC20** (NEW) | 계산·Markdown 레인이 연속 3회 실패하면 대기(2초 → 10초 → 60초 상한) 뒤 다음 요청에서 새 워커를 만든다. 회복 뒤 원문으로 떨어졌던 Read 카드 강조·Edit diff 강조·4,000자 초과 Markdown 블록·스트리밍 꼬리·큰 본문이 조작 없이 강조·hast·본문으로 바뀐다(각 1회 재요청). 요청 실패마다 로그 1줄(레인·종류·사유, 같은 사유 연속은 1분에 1줄), 10초 무응답 진단 1줄 | 레인 상태 단위(가짜 시계) · 소비처 14자리 렌더 단위 · Electron `workerRecovery`(`.shiki`·`h2` 복원) | 워커 실패 → 레인 대기 → 새 워커 → 회복 회차 → 소비처 재요청 → 렌더 |

AC 검증 주의: AC18의 "자식 요소" 단언은 높이 > 0 양성 단언과 짝짓는다(빈 `div` 하나로 통과시키지 않는다). AC20의 회복 단언은 "재요청 1회"와 "회복 전 재요청 0"을 함께 본다(무한 재시도 방지).

### 23-D. V 변경 (ΔV6)

- 기준 V: 0331 V1 + ΔV1~ΔV5(§22, 설계 커밋 — 검증자 기입) · 기준 트리 `c052c301`.
- 변경이 시작되는 수준: R(사용자 관측)부터 MD까지 — 사용자 요구 변경 ΔV라 이후 verify 2회 동안 아래 NEW·CHANGED 노드 범위에서 확장 창이 다시 열린다.
- `SUPERSEDED` 이관: VP-10(AC10′) → VP-48(AC10″, 기존 `toolSpacing` 시나리오·등록 변이 없음 그대로 기대값만 교체) · VP-22 → VP-54(같은 좌표 파일, 기대 12 → 8). 폐기 증거 0.

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-03 · AT-03″ | R · AT | 큰 본문 자동 로드 + 세대·워커 교체 재시작 + 실패 사유 | CHANGED | AT-03′(ΔV3) |
| R-10 · AT-10″ | R · AT | 도구 간격 0324 이전 값 | CHANGED | AT-10′(ΔV3) |
| R-18 · AT-18 | R · AT | 빈 가상 행 0 · 연속 ‘응답 중단’ 간격 | NEW | — |
| R-19 · AT-19 | R · AT | 이력 커서 세대 재합류 | NEW | — |
| R-20 · AT-20 | R · AT | 워커 레인 회복·재요청·진단 | NEW | — |
| R-09 · AT-09″ | R · AT | 연속 실패 귀속·간격 | INHERITED | ΔV5 §22-A |
| R-14 · AT-14 | R · AT | 큰 본문 50ms | INHERITED | ΔV4·ΔV5 §22-B |
| SD-02 | SD | 큰 본문 수명 — 세대 재시작·워커 교체 재시작·사유 실패 | CHANGED | ΔV5 SD-02 |
| SD-04 | SD | 워커 레인 수명 — 정상 → 실패 → 대기 → 새 워커 → 회복 → 재요청 | NEW | — |
| AR-07 | AR | data `body`·커서의 키 재해석 ↔ 창 — `body` 응답에 `generation`·`bytes` | NEW | `shared/history-page.ts` 응답 스키마 |
| AR-08 | AR | 계산 클라이언트 회복 신호 ↔ 소비처 14자리 | NEW | — |
| AR-04 | AR | 본문 전송·워커 왕복 | INHERITED | ΔV5 VP-40 |
| MD-06 | MD | 블록·카드·행 간격 값 | CHANGED | ΔV3 MD-06 |
| MD-13 | MD | 가시 행 규칙 — 렌더가 비는 상태는 블록을 내보내지 않는다 | NEW | — |
| MD-14 | MD | 레인 상태 기계 — 실패 수·대기 일정·회복 회차·진단 | NEW | — |
| MD-15 | MD | 본문 조립 재시작 — 세대 변경·`worker-replaced`·상한 2 | NEW | — |

| Pair | left ↔ right | requiredness | production path | 직접 evidence oracle (자리별 좌표) | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|---|
| VP-44 | R-18 ↔ AT-18 | REQUIRED | 메시지 → 블록 모델 → `Timeline` → `TranscriptViewport` | `gate:xvfb-run -a node scripts/check-transcript-history.mjs --layout` 새 `errorRunMixed`(claude-work: `aborted` · `aborted`+`ended` · `aborted` · `unknown`(begin만) · `aborted` · `aborted`) — 모든 `[data-index]` 자식 높이 > 0 · ‘응답 중단’ 6행 다섯 간격 최대−최소 ≤ 1 · 새 `pendingAsk`(claude-code) 빈 행 0 | required — `Timeline.tsx:193` 경로로 `ended` 행을 되살린 변이가 `errorRunMixed` red | EP-20 |
| VP-45 | R-03 ↔ AT-03″ | REQUIRED | 페이지 commit → 자동 본문 → data → 워커 → 렌더 | `TranscriptViewport.body.test.ts` 새 `AC3″ renders the current generation after a generation change`(page 흉내: 둘째 조각 응답의 `generation`이 바뀜 → offset 0 재요청 → 본문 · 실패 UI 0) · `AC3″ survives a worker replacement`(실제 클라이언트 + 워커마다 새 상태, 실행 중 diff pair 취소 → `worker-replaced` → 재시작 → 본문) · `AC3″ fails on the third restart and logs churn` · `AC3″ shows retry only for unavailable`(입력: `unavailable`·키 없음 `stale`·형식 위반 각 실패 1·버튼 1) · `AC3″ logs one reason per failure`(로그 인자 사유 7종) | required — 재시작 분기 제거 변이(세대 변경 입력에서 실패 UI 1, red) | EP-21 · EP-22 |
| VP-46 | R-19 ↔ AT-19 | REQUIRED | 상단 도달 → `readPrevious`/`readSearchEdge` → data `readCursor` → 앞삽입 | `turn-page.db.test.ts` 새 `AC19 re-resolves a cursor by message key in a new generation`(색인된 메시지 변경 → `earlierTurn` 옛 커서 → ok·이전 5턴 ID · `withinUnit` 하한 재계산 · 키 삭제 → `stale`) · `history-port.integration.test.ts` 새 `AC19 prepend continues across a republish`(실제 포트 + store: 응답 세대 다름 → `history.generation` 갱신 · 토스트 0) · `history-search.test.ts` 새 `AC19 search edge adopts a new generation` | required — 창 `chatStore.ts:2971` 세대 비교를 되살린 변이(토스트 1, red) | EP-21 |
| VP-47 | R-20 ↔ AT-20 | REQUIRED | 워커 실패 → 대기 → 새 워커 → 회복 → 재요청 → 렌더 | `client.test.ts` 새 `AC20 recovers after the cool-down and announces recovery` · 소비처 렌더 단위(VP-52 표) · `gate:… check-transcript-history.mjs --layout` 새 `workerRecovery`(프로브가 첫 3개 워커를 시작 직후 죽이는 생성기로 클라이언트를 만든다 → Read 강조·4,000자 초과 Markdown이 원문 → 대기 뒤 `.shiki`·`h2` 복원) | required — 회복 회차 증가 제거 변이(`workerRecovery` 원문 유지, red) | EP-23 |
| VP-48 | R-10 ↔ AT-10″ | REQUIRED | Chromium → `TranscriptView` | 같은 스크립트 `--layout` `toolSpacing` 기대값 교체 — Code 위·아래 8±1 · 그룹 카드 사이 8±1 · Work 행 사이 16±1 | not selected — 직접 거리 단언 | EP-10′ |
| VP-49 | SD-02 ↔ ST-02 | REQUIRED (ΔV6 경로 추가 — VP-13·VP-42는 REGRESSION) | 실제 data 포트 → 창 store → 워커 → reducer | `history-port.integration.test.ts` 새 `AC3″ body resolves across a republish through the real data port`(실제 SQLite 색인 + 포트: 첫 조각 뒤 색인된 메시지 변경 → 세대 변경 응답 → 재시작 → 최종 parts = DB 현재 parts) | not selected | EP-21 |
| VP-50 | SD-04 ↔ ST-04 | REQUIRED | 레인 수명 전체 | `client.test.ts` 새 `AC20 lane lifecycle`(정상 → 실패 1·2 → 한도 → 대기 → 새 워커 → 성공 → 회복 → 다시 실패 시 대기 10초) · 취소 교체는 실패 수에 들지 않음 | not selected | EP-22 · EP-23 |
| VP-51 | AR-07 ↔ IT-07 | REQUIRED | 창 전송 → data handler → 색인 | `history-port.integration.test.ts` 새 `AC19 body and cursor replies carry the served generation`(zod 왕복: `body` 응답 `generation`·`bytes` · 늘어난 bytes 수용 · `bytes ≤ 0`·`nextOffset > bytes` → `Mismatched history reply`) | not selected | EP-21 |
| VP-52 | AR-08 ↔ IT-08 | REQUIRED | 계산 클라이언트 회복 회차 → 소비처 14자리 | §23-E EP-23 소비처 표의 자리별 좌표(자리마다 "실패 → 원문/빈칸 → 회복 → 재요청 1회 → 결과 표시" · 회복 전 재요청 0) | required — 자리마다 회복 의존 제거 변이 1개(14개), 각 자리 좌표 red | EP-23 |
| VP-53 | MD-13 ↔ UT-13 | REQUIRED | 블록 모델·`Timeline` | §23-E EP-20 자리별 좌표 | not selected — 자리별 양성·음성 입력 | EP-20 |
| VP-54 | MD-06 ↔ UT-06 | REQUIRED (VP-22 대체) | 블록 gap·카드·행 클래스 | `claudeBlocks.test.ts` `AC10″ tool block gap is 8 on both sides`(text→tools 8 · tools→text 8 · tools→ask 8 · text→text 16 유지) · `ToolGroup` 렌더 `AC10″ group cards use the item gap` · `WorkActivity.render.test.ts` `AC10″ work rows use py-2`(3자리) | not selected | EP-10′ |
| VP-55 | MD-14 ↔ UT-14 | REQUIRED | `createComputeClient` 레인 | `client.test.ts` 규칙 칸 분기 입력(§23-E EP-23 레인 표) | required — 대기 일정 상수 고정 변이(10초 단계 입력 red) | EP-23 |
| VP-56 | MD-15 ↔ UT-15 | REQUIRED | `readDeferredParts` | 새 `deferredBody.test.ts` 분기 입력(§23-E EP-21·22) | not selected | EP-21 · EP-22 |
| VP-57 | R-09 ↔ AT-09″ | REGRESSION | §22-A | VP-36~39 좌표 재실행 · `errorRun` 기존 fixture | not selected | EP-18(비변경) |
| VP-58 | R-14 ↔ AT-14 | REGRESSION | §22-B | VP-43 `--perf` 30창(레인·본문 경로 변경 영향) | not selected | EP-19(비변경) |
| VP-59 | AR-04 ↔ IT-04 | REGRESSION | 본문 전송 | VP-40 좌표 재실행 | not selected | EP-19(비변경) |

### 23-E. §10 추가·대체 행

모든 검색은 저장소 루트에서 실행하고 `node .agents/skills/handoff-verify/scripts/site_census.mjs --search "<검색>" --sites … --excluded …`로 미분류 0을 확인했다(2026-11-27, `c052c301`). 단일 파일 검색은 `rg -nH`를 쓴다 — 파일명이 빠지면 집계가 0줄이 된다.

**EP-20 · 빈 가상 행 (D-029 · MD-13 · VP-44·VP-53).** 검색 `rg -n 'return null' <claude·opencode transcript의 Timeline·AssistantSegment·AskExchange·ReasoningBlock·ToolGroup.tsx> app/src/renderer/src/features/chat/harnesses/common/transcript/ArtifactCards.tsx` → 11줄 · 자리 10 · 제외 1(`opencode/transcript/Timeline.tsx:251` `RetryStatus` — 대기 상태 안의 하위 줄, 행 전체가 아님). 규칙: 각 자리의 null 조건이 참인 입력에서 그 블록이 행으로 존재하지 않는다(블록 모델이 내보내지 않음). 고친 뒤 자리 줄이 남아 방어로만 남으면 그 조건 입력의 행 수로 판정한다.

| # | 자리 (`harnesses/` 기준) | null 조건 = 행 없음 입력 | 직접 oracle (새 테스트) | 실측 |
|---|---|---|---|---|
| 1 | `claude/transcript/Timeline.tsx:193` | Work 응답 `ended` · `unknown`(end 없음) · 대조 `aborted`는 행 1 | `claudeBlocks.test.ts` `AC18 emits no status block for ended or unknown` + VP-44 `errorRunMixed` | 빈 행 16·24px |
| 2 | `claude/transcript/AskExchange.tsx:15` | 미응답 질문(Code) · 대조 응답 질문은 행 1 | `Timeline.viewport.test.ts` `AC18 pending ask leaves no row` + VP-44 `pendingAsk` | 빈 행 16px |
| 3 | `claude/transcript/AskExchange.tsx:17` | 응답됐지만 항목 0인 질문 | 같은 파일 `AC18 answered ask without items leaves no row` | 미측정 |
| 4 | `claude/transcript/ReasoningBlock.tsx:26` | reasoning 항목 0 | `claudeBlocks.test.ts` `AC18 empty reasoning forms no block` | 빈 text reasoning은 행 없음(실측) |
| 5 | `claude/transcript/ReasoningBlock.tsx:28` | 공백뿐 reasoning | 같은 테스트 공백 입력 | 미측정 |
| 6 | `common/transcript/ArtifactCards.tsx:54` | 산출물 0 · 세션 ID 없음 | `claudeBlocks.test.ts`·OpenCode 블록 테스트 `AC18 artifacts block needs artifacts and a session` | 미측정 |
| 7 | `opencode/transcript/Timeline.tsx:197` | reasoning 세그먼트 | OpenCode 블록 테스트 `AC18 reasoning forms no row` | 행 없음(실측 `ocReasoning`) |
| 8 | `opencode/transcript/AssistantSegment.tsx:29` | reasoning 세그먼트(7과 같은 계약) | 7과 같은 좌표 | — |
| 9 | `opencode/transcript/AskExchange.tsx:11` | 답 없는 질문 | OpenCode `Timeline` 렌더 `AC18 unanswered ask leaves no row` | 미측정 |
| 10 | `opencode/transcript/ToolGroup.tsx:23` | 보이는 도구 0인 묶음 | OpenCode 블록 테스트 `AC18 tool group without visible tools forms no row` | 미측정 |

- 다음 블록의 gap은 건너뛴 블록이 없었던 것처럼 계산한다(예: 상태 행을 건너뛴 뒤의 meta). 이 규칙은 VP-44 간격 단언이 잠근다.
- 제외 근거(검색 밖): Claude `live` 블록은 `hasLive`(라이브 본문·추론이 있을 때만, `Timeline.tsx` `advance` 옵션)로 생성돼 비지 않는다.

**EP-21 · 세대 재합류 (D-030 · AR-07 · MD-15 · VP-45·46·49·51·56).** 검색 `rg -n '(\.generation\b|\bg !== gen\b|ref\.bytes|body_bytes)' app/src/main/features/history/history-page.ts app/src/renderer/src/features/chat/lib/transcript/deferredBody.ts app/src/renderer/src/shared/api/transport/session-load.ts app/src/renderer/src/features/chat/store/chatStore.ts` → 46줄 · 자리 15 · 제외 31 · 미분류 0.

| 자리 | 규칙 (분기) | 분기 입력 → 직접 oracle |
|---|---|---|
| `history-page.ts:78` 커서 세대 | 세대 다름 → 키를 현재 세대에서 찾음 · 있으면 그 이웃부터(방향 유지, `withinUnit` 하한은 현재 세대로 재계산) · 없으면 `stale` | 같은 세대 · 다른 세대+키 있음 · 다른 세대+키 없음 → VP-46 DB 테스트 3입력 |
| `history-page.ts:140`·`:142`·`:144`·`:153` 본문 | 세대 다름 → 키로 현재 세대 머리 · 범위·`done`은 현재 `body_bytes` 기준 · 응답에 `generation`·`bytes` · 키 없음 `stale` | 같은 세대 · 다른 세대+같은 bytes · 다른 세대+늘어난 bytes · 키 없음 → `turn-page.db.test.ts` 새 `AC3″ serves a body by key in the current generation` 4입력 |
| `deferredBody.ts:64`·`:75`·`:99`·`:100`·`:112` 창 조립 | 총 바이트는 첫 응답의 `bytes` · 응답 `generation`이 앞 조각과 다르면 워커 스트림을 닫고 offset 0부터 다시 · 재시작 상한 2(EP-22와 합산) · 3번째는 `churn` 실패 | 세대 불변 · 첫 조각 뒤 변경 · 연속 3회 변경 · bytes 증가 → VP-56 `deferredBody.test.ts` 4입력 |
| `session-load.ts:163`·`:164` 응답 검사 | `body` 응답의 범위·`done`을 응답 `bytes`로 검사(질의 `ref.bytes` 아님) · `generation`·`bytes` 형식 검사 | 늘어난 bytes 수용 · `nextOffset > bytes` 거부 → VP-51 |
| `chatStore.ts:2726` 본문 현재성 | 창 세대 == `ref.generation`을 요구하지 않는다 — 같은 세션·같은 열기 회차·같은 검색 회차·그 참조를 가진 메시지가 아직 있음만 본다 | 창 세대 갱신 뒤 진행 중 조립 유지 · 세션 전환 폐기 → VP-45 · 기존 `TranscriptViewport.body.test.ts` 5전환 |
| `chatStore.ts:2915` 검색 보기 가장자리 · `:2971` 일반 앞삽입 | 응답 세대가 다르면 실패가 아니다 — 보기·창의 `generation`과 가장자리 커서를 응답 값으로 바꾸고 앞삽입한다 | 같은 세대 · 다른 세대 → VP-46 포트·검색 테스트 |

- 제외 31줄 사유: 메타데이터 조각(`history-page.ts:122·124·125·134`, `session-load.ts:135·137·140·141`) · 검색 방문·대상·재개·캐시 위치(`history-page.ts:189·192·201·203`, `chatStore.ts:2497·2506·2512·2517·2532·2578·2581·2612·2630·2649·2659·3434·3435`) · 새 페이지가 만든 참조의 생산(`history-page.ts:281·292`)과 그 검사(`session-load.ts:129`) · 패널(`session-load.ts:145·150`) · 캐시 확인(`session-load.ts:158`).
- **선언 경계** — ① 키가 현재 세대에 없는 참조·커서(삭제, 보관 사본 `x:<index>` 재번호)는 기존 실패 경로다. ② 메타데이터 조각과 검색 방문·대상·`useCached`의 세대 불일치는 이번 계약 밖이며 동작을 확인하지 않았다. ③ 창이 이미 그린 메시지 사본이 현재 세대와 다를 수 있는 것은 지금과 같다(이번 변경은 실패 표시만 없앤다).
- IPC 계약 변경: `HistoryPageReplySchema` `body` 항에 `generation`·`bytes`를 더한다 → [`IPC_CONTRACT.md`](../../IPC_CONTRACT.md) 같은 PR 갱신, `check-doc-inventory.mjs --check`.

**EP-22 · 워커 교체 중 조립 (D-031 · MD-15 · VP-45·50·56).** 검색 `rg -n 'dropWorker\(\)|streams\.get|job = request\(' app/src/renderer/src/shared/compute/client.ts app/src/renderer/src/shared/compute/worker/historyBody.ts app/src/renderer/src/features/chat/lib/transcript/deferredBody.ts` → 5줄 · 자리 4 · 제외 1(`client.ts:268` 함수 정의).

| 자리 | 규칙 | 분기 입력 → 직접 oracle |
|---|---|---|
| `client.ts:285` 실패 교체 · `client.ts:470` 취소 교체 | 교체는 레인 워커 회차를 올린다. 취소 교체는 실패 수에 들지 않는다(EP-23) | 실패 교체 · 취소 교체 → VP-50 `AC20 lane lifecycle` |
| `historyBody.ts:24` 스트림 조회 | `offset > 0`인데 스트림이 없으면 `worker-replaced` 오류(형식 위반 `Invalid history body range`와 구별) | 스트림 없음+offset>0 · 범위 위반 → `historyBody.test.ts` 새 `AC3″ distinguishes a replaced worker from an invalid range` |
| `deferredBody.ts:105` 조각 요청 | `worker-replaced` → offset 0부터 다시(상한 2, EP-21과 합산) · 그 밖 오류 → `worker` 실패 | 교체 1회 · 교체 3회 · 형식 오류 → VP-56 · VP-45 `survives a worker replacement` |

- **선언 경계** — tokens 이어 계산(`resumeFrom`)이 워커 교체 뒤 어떻게 되는지는 이번 계약 밖이며 측정하지 않았다.

**EP-23 · 워커 레인 회복·재요청·진단 (D-032 · SD-04 · AR-08 · MD-14 · VP-47·50·52·55).**

레인 상태 — 검색 `rg -nH 'failures|blocked|onError' app/src/renderer/src/shared/compute/client.ts` → 12줄 · 자리 9(`:189`·`:204`·`:283`·`:284`·`:290`·`:313`·`:379`·`:388`·`:572`) · 제외 3(`:139` 옵션 타입 · `:188` 선언 · `:198` 초기값).

| 규칙 칸 분기 | 입력 → `client.test.ts` 좌표(가짜 시계) |
|---|---|
| 한도 미만 실패 → 다음 요청이 즉시 새 워커 | 실패 1·2 → 요청 성공 → `AC20 recreates below the limit` |
| 한도 도달 → 대기 2초 거부 → 그 뒤 첫 요청에 새 워커 | 1,999ms 거부 · 2,000ms 생성 → `AC20 waits 2s after the limit` |
| 연속 한도 2회째 10초 · 3회째 이후 60초 상한 | 각 경계 ±1ms → `AC20 grows the wait to 10s and caps at 60s` |
| 실패·거부 뒤 첫 성공 → 회복 회차 +1·알림 1회 | → `AC20 announces recovery once` |
| 실패 없이 성공 → 회복 알림 0 | → 같은 테스트 대조 입력 |
| 계산 오류 `ok:false` → 로그 1줄 · 실패 수 불변 | → `AC20 logs request errors without failing the lane` |
| 같은 사유 연속 → 1분에 1줄 | 59,999ms·60,000ms → `AC20 throttles repeated reasons` |
| 10초 무응답 → 진단 1줄 · 작업 유지 | 9,999ms·10,000ms → `AC20 reports a slow job` |

소비처 — 검색 `rg -n '(computeClient\(\)|client)\.request(<[^>]+>)?\(' app/src/renderer/src -g '!*.test.*' -g '!*.testfixture.*'` → 14줄 · 자리 14 · 제외 0. 규칙: 워커 원인으로 결과가 없거나 원문 폴백인 소비처는 레인 회복 회차가 바뀌면 1회 다시 요청한다. 취소·내용 변경은 기존대로다.

| 자리 (`app/src/renderer/src/` 기준) | 폴백 화면 | 직접 oracle (새 테스트, 실패 → 회복 → 결과 · 회복 전 재요청 0) |
|---|---|---|
| `shared/compute/useHighlightedHtml.ts:24` | 색 없는 코드(Read·펜스) | `CodeBlock` 렌더 `AC20 restores highlight after recovery` |
| `features/chat/hooks/useDiffSyntax.ts:33` | 색 없는 diff | `DiffBody.render.test.ts` `AC20 restores diff syntax after recovery` |
| `features/chat/hooks/useWindowTokens.ts:50` | 큰 코드 창 원문 | `VirtualCodeView.test.ts` `AC20 retries window tokens after recovery` |
| `features/chat/components/code/VirtualCodeView.tsx:40` | 큰 코드 색인 없음 | 같은 파일 `AC20 retries the code view after recovery` |
| `features/chat/components/markdown/MarkdownDocument.tsx:123` | Markdown 블록 원문 | `MarkdownDocument` 렌더 `AC20 replaces a raw block with hast after recovery` |
| `features/chat/components/markdown/SegmentedFence.tsx:74` | 나눈 펜스 원문 | `SegmentedFence.test.ts` `AC20 …` |
| `features/chat/components/markdown/WorkerMarkdownTail.tsx:92` | 꼬리 원문 | `WorkerMarkdownTail.test.ts` `AC20 …` |
| `features/chat/components/markdown/useMarkdownRows.ts:39` | 레이아웃 실패 원문 | `VirtualMarkdownView.test.ts` `AC20 …` |
| `features/chat/lib/transcript/deferredBody.ts:63` | 본문 실패(사유 `worker`) | `TranscriptViewport.body.test.ts` `AC20 retries a worker-failed body after recovery` |
| `features/chat/hooks/useDiffStat.ts:31` | 증감 수 빈칸 | `ToolCard.interaction.test.ts` `AC20 …` |
| `features/chat/hooks/useDiffLines.ts:24` | diff 로딩 고정 | `useDiffLines` 단위 `AC20 …` |
| `features/chat/hooks/useDiffViewWindow.ts:42` | 큰 diff 창 빈칸 | `DiffTable` 렌더 `AC20 …` |
| `features/chat/hooks/useDiffAnchor.ts:22` | diff 위치 없음 | `useDiffAnchor` 단위 `AC20 …` |
| `features/chat/hooks/useAttachments.ts:66` | 썸네일 없음(이미지 레인) | `useAttachments` 단위 `AC20 …` |

- 실패 의미: 레인이 회복돼도 한 자리가 재요청하지 않으면 그 화면만 원문으로 남는다 — VP-52의 자리별 변이가 그 차이를 잡는다. 회복 회차는 성공 응답이 실패 상태 뒤에 왔을 때만 오르므로 재요청 폭주는 없다(VP-55).

**EP-10′ · 간격 (D-033 · MD-06 · VP-48·54, EP-10 대체).** 검색 `rg -n '\? 12$|gap-g2 rounded-r6|relative py-1 pl-\[30px\]' app/src/renderer/src/features/chat/harnesses/claude/transcript` → 5줄 · 자리 5 · 제외 0: `claudeBlocks.ts:564`(도구 인접 gap 12 → 8 — `ClaudeBlockGap`에 8이 이미 있다) · `ToolGroup.tsx:95`(`gap-g2` → `gap-[var(--chat-item-gap)]`) · `WorkActivity.tsx:125`·`WorkToolTimeline.tsx:30`·`:101`(`py-1` → `py-2`). 직접 oracle은 VP-54 단위 + VP-48 실기.

- 규칙 칸 ↔ 입력 1:1: EP-20 10자리 × null 조건 입력(+대조) · EP-21 6행 분기 → 입력 3·4·4·2·2·2 · EP-22 3행 → 입력 2·2·3 · EP-23 레인 8분기 → 8입력, 소비처 14 → 14좌표 · EP-10′ 5자리 → 5단언.

### 23-F. 구현 순서와 인계

| WU | 내용 | 완료 판정 |
|---|---|---|
| WU-0 | **계기 수집.** D-032 ③④ 진단을 먼저 넣는다. 사용자에게 앱 로그(로그 폴더의 JSONL에서 `compute.worker.failed`·새 진단 줄)를 요청해 오류 문자열을 [구현자 기입]에 적는다. Electron에서 큰 본문 + Edit 카드 다수 + 4,000자 초과 Markdown 세션을 열고 스크롤해 실패 사유를 수집한다 | 계기를 찾으면 원인·재현 명령을 적고 코드 결함이면 이번 라운드에서 고친다(새 계약이 필요하면 PLAN_GAP). 못 찾으면 "미재현"과 시도 목록을 적고 D-032 회복으로 갈음한다 |
| WU-1 | EP-20 빈 행 | VP-44·53 |
| WU-2 | EP-10′ 간격 | VP-48·54 |
| WU-3 | EP-21 세대 재합류(data·IPC 스키마·창) + `IPC_CONTRACT.md` | VP-45·46·49·51·56 |
| WU-4 | EP-22 워커 교체 재시작 | VP-45·50·56 |
| WU-5 | EP-23 레인 회복·재요청 | VP-47·50·52·55 |
| WU-6 | 회귀 — VP-57~59 · 기존 이력 390·검색 6 · 선택·복사(`check-transcript-selection.mjs`) · 0332 모드별 패널 검사 | 같은 통합 SHA |

- 운영 gate: §7-A "현재 변경의 운영 gate" 전부 + `--layout`의 `errorRunMixed`·`pendingAsk`·`workerRecovery`·`toolSpacing`(새 기대) + `node scripts/check-doc-inventory.mjs --check`(IPC 계약). exit 3(Electron 없음)은 환경, exit 1만 blocking.
- 다음 주체는 Codex(r1.5)다. 이 설계 턴은 독립 검증 횟수(0)와 라운드(1)를 바꾸지 않는다. r1.4의 AC14′ 4/30 미충족은 VP-58로 계속 추적한다.

## READY self-review (ΔV6)

- 사용자 원문 5건 모두 §23-A에 판정·반영 위치가 있다 — 0331 4건, 0332 1건(0332 §23). 기각 0.
- 질의 답 3건을 Decision으로 보존했다: 배치(기존 handoff 갱신 — 이 절의 존재), 증상(D-032 근거), 간격(D-033). 뒤로 가기 답은 0332 D-016.
- D-011 → D-033 SUPERSEDED · 0324 워커 영구 차단 → D-032 대체 · `ACTIVE 결정 ↔ AC` 대조 충돌 0(§3 갱신 메모).
- 재현한 것(빈 행 4입력·`stale`·워커 교체)과 재현하지 못한 것(3a·5의 계기)을 나눴고, 후자는 WU-0과 회복 계약으로만 다룬다.
- 모든 NEW·CHANGED 노드에 같은 레벨 REQUIRED pair가 있다 — R-03·10·18·19·20 ↔ VP-45·48·44·46·47 · SD-02·04 ↔ VP-49·50 · AR-07·08 ↔ VP-51·52 · MD-06·13·14·15 ↔ VP-54·53·55·56. 영향받은 INHERITED 3개는 REGRESSION(VP-57~59).
- §10 자리 목록 5개를 `site_census.mjs`로 고정했다 — EP-20 10/11 · EP-21 15/46 · EP-22 4/5 · EP-23 9/12 + 14/14 · EP-10′ 5/5, 미분류 0.
- 규칙 칸 분기마다 입력이 있다(§23-E 마지막 목록). 선언 경계는 EP-21 ①②③ · EP-22 tokens 이어 계산 — 측정하지 않은 보호를 경계로 적지 않았다.
- AC 20개 ≤ 25. 수치 계약(간격 ±1px)은 Electron 실기로 잰다. 대기 일정(2·10·60초)과 진단 임계(10초·1분)는 설계자 기본값이며 가짜 시계 단위로 판정한다.

## READY self-review (V1 + ΔV1 + ΔV2 + ΔV3 + ΔV4)

- [x] ΔV4: 2차 리뷰 7건(보완 4 + 새 요구 1 + 정정 2) 모두 §21-A에 판정·반영 위치 — 기각 0.
- [x] ΔV4: D-005 → D-023, D-018 → D-025, D-019 → D-026 SUPERSEDED · D-022~D-026 ↔ AC 대조 충돌 0(§3 갱신 메모).
- [x] ΔV4: 새 요구의 적용 구간을 D-023·AC4″·AC5″·AC6″·AC15′에 적었다 — 측정 시작은 응답 반영 직전, 당김 움직임은 입력 이동.
- [x] ΔV4: §6 범위 문구·`EP-2′` 정의·운영 gate `--perf`를 고쳤다.
- [x] ΔV4: 규칙 칸 ↔ 입력 1:1(§21-F 마지막 줄) · AC 총 17.
- [x] ΔV4: 0332 공통 동작 대조(§21-G) 일치 · AC12·0332 AC11·AC12는 기존 검증 유지.

## READY self-review (V1 + ΔV1 + ΔV2 + ΔV3)

- [x] ΔV3: 리뷰 지적 8건 모두 §20-A에 판정·반영 위치가 있다 — 기각 0.
- [x] ΔV3: D-013 → D-019 SUPERSEDED 연결 · 새 결정 D-016~D-021 ↔ AC 대조 충돌 0(§3 갱신 메모).
- [x] ΔV3: CHANGED AC는 §7 구 행에 포인터를 남기고 §20-B가 대체한다 — AC 총 15(AC1~AC15).
- [x] ΔV3: 규칙 칸 ↔ 입력 칸 1:1(§20-G 마지막 줄) · 새 pair마다 좌표·§10.
- [x] ΔV3: 수치 계약(50ms·±1px·20,000노드)은 Electron 실기로 판정하고 20,000은 0327 M22c 비율로 근거를 적었다.
- [x] ΔV3: 0332와 공통 동작 4항목 일치(§20-H).

## V1 READY self-review (ΔV2 종합 판정 대기 — ΔV3에서 종합)

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

- 이력 페이지, 본문 세대와 워커, 도구 표시, 산출물 경로는 기존 소유자를 유지했다. SQLite에서 5턴을 찾아 이전 턴으로 넘어가는 경우와 Markdown이 정상 파싱되는 경우를 실제 저장·계산 경계에서 검사했다.
- **PLAN_GAP · AC9′ / EP-9.** 저장된 오류 6개의 이웃 간격은 Claude Code 160.171875px, 중단된 Work 6개는 165.171875px였다. Code에 저장된 오류 3개를 연 뒤 실제 입력과 실패를 3번 보내자 오류 표시 수가 4 → 4 → 4, 마지막 두 표시의 간격은 160.40625 → 208.28125 → 256.15625px였다. 이력이 있는 다른 사용자 입력 사이에 실패 표시가 남지 않는다. `chatReducer.ts`의 `case 'error'`는 `session.error` 한 칸을 갱신하고 `Timeline.tsx`는 footer에 배너 한 개를 그린다. 데이터 호스트의 `writer.ts`는 오류를 저장한다. §10의 gap·예약 여백 21곳을 바꾸어도 사라진 표시가 생기지 않는다. WU-0에 따라 라이브 실패를 어느 입력에 귀속시키고 이력 재수신시 어떻게 중복을 없앨지 설계자에게 돌린다. §3 결정과 승인 기준은 그대로 보존했다.
- EP-6에서는 같은 페인트의 DOM 글자 위치와 실제 글을 함께 비교했다. EP-12에서는 첫 화면의 하단과 캐시 재검증 뒤의 하단 이동을 따로 관측했다. 세부 측정은 아래 이력 표에 있다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약 / 지점 | 직접 확인한 운반 경로·관측 | 남긴 곳 |
|---|---|---|---|
| VP-01′·02′·17·18·22·26 | EP-1·2′·10 | `parts.test.ts`의 공백 세 경우, `segmentCache.test.ts` 200회 편집, store live selector, `claudeBlocks.test.ts` c1~c4와 w3의 전체·증분·앞삽입, `openCodeBlocks.test.ts` o1~o4와 메시지 경계 문단 복원. `blockModelCatchup.test.ts`의 세 하네스 500열 대조. Electron에서 11개 경계 입력을 실제 화면으로 모두 확인했다(c4의 5개 분리 입력 포함). c1 헤더는 “실행됨 명령 2개, 읽음 파일 1개”이며 Work 펼친 DOM에서 메모·점 0/1개를 구분했다. --layout은 21개 중 20개 통과, errorLive 1개 실패였다. | §10 자리 전체의 세부항별 변이 |
| VP-09′ | EP-9 | `check-transcript-history.mjs --layout`의 `errorRun`·`errorLive`가 같은 데이터에서 실시간 3건의 손실을 검출했다. | store 오류 귀속·재로딩시 중복 제거 계약 |
| VP-10′·11′·23 | EP-10·11 | 펼친 Code 그룹 실측 12 / 12 / 3.625px, Work 도구 행 7.25px. 접힌 헤더의 빈 상태에서 +654, +5000/−5000, OpenCode +15000으로 갱신됨. `ToolCard.interaction.test.ts`에서 큰 Write·Edit·MultiEdit가 워커를 거친다. | 모든 분기별 제거 sweep |
| VP-28′·32 | EP-14′ | `service.test.ts`의 실제 파일 2경로 × 3경우 및 `handlers/artifacts.test.ts`의 SQLite·두 서비스 루트로 preview를 호출했다. 실패 정보에는 비교 가능한 루트 종류, 상대 경로, 실패 이유가 남는다. | 개별 로그 필드별 변이 |
| VP-24·25 | 검색 보기·기존 Markdown 경계 | `history-search.test.ts`, `HistoryEdge.test.ts`, `ArtifactPreviewContent.virtual.test.ts`, `StreamingMarkdown` 스위트 | 아래 실측 결과에 포함 |

EP-1 기준 검색은 14줄로 재현했다. `site_census.py`에서 운반 후보 8, 열거 9(선언 1 포함), 제외 5, 미분류·목록에만 있는 자리 각 0이었다. 목록 밖에서 원문 보존을 운반하는 `blockKeys.ts:textPartGroups`도 고쳤다. 앞부분 공백은 출력 세그먼트를 만들지 않고 앞 문단에 붙은 공백은 다음 part의 글자 시작 오프셋을 이동시킨다. OpenCode의 별도 assistant 메시지 3개로 구성한 `Hello\n\nWorld`의 시작점은 0, 5, 6, 7이었다.

### 이력·스크롤 담당 구현 근거

| AC | V-pair·강제 지점 | 구현자가 관측한 결과 |
|---|---|---|
| AC4″ | VP-04″·19 · EP-4, EP-16⑨ | `HistoryEdge.test.ts`의 `AC4 four states`가 4상태 × 당김 유무에서 같은 높이 클래스와 실패 때만 재시도 버튼을 확인했다. 로딩 스피너는 머리와 당김 공간 중 한 곳에 나타난다. |
| AC5″ | VP-05″·20 · EP-5′, EP-16①② | `historyPull.test.ts`에서 머리 높이 32에 대해 0·31·32는 참, 33은 거짓이고 스크롤 불가면 참이다. `useHistoryControls.test.ts`는 단위 유휴, 입력 중 보류, 종료를 확인했다. `history-search.test.ts`는 일반/검색 커서가 성공 뒤 그대로 와도 두 번째 호출이 거부되고 실패는 재시도만 통과함을 확인했다. |
| AC6″ | VP-06″·20 · EP-6, EP-16⑤ | `TranscriptViewport.prepend.test.ts`는 측정 콜백이 돌아오기 전에 글자 앵커가 보정되고 rAF가 예약되지 않음을 확인했다. 같은 높이의 다른 문자로 원문을 바꾸는 Electron 변이는 원래 글줄 조회에서 실패했다. |
| AC7 | VP-07·12·14·15 · EP-7 | `turn-page.db.test.ts`에서 5턴 이하, 정확히 5턴, 큰 중간 턴이 든 12턴의 연속 페이지와 다음 5턴·남은 2턴을 대조했다. `history-port.integration.test.ts`는 검색 결과 위쪽 5턴과 위조 하한 거부, `withinUnit` 왕복을 확인했다. `useHistoryControls.test.ts`는 유휴 채움이 `earlierTurn`에서 멈춤을 확인했다. |
| AC12 | VP-27 · EP-12 | `openFrames`에서 이전 세션을 먼저 마운트하고 실제 `loadSession` 실행 전후를 읽었다. 최초 짧은 본문은 하단 0에서 불투명도가 중간값을 거쳤고 재검증 뒤 실제 하단 이동 중간 위치를 관측했다. `TranscriptViewport.history.test.ts`는 축소 모션에서 즉시 정착을 확인했다. |
| AC15′ | VP-30′ · EP-15 | `TranscriptViewport.history.test.ts`의 `AC15 anchor`에서 네 쓰기 소유자를 대조했다. 앵커·가상화기는 smooth 인자를 받아도 instant로 쓴다. 실제 Electron에서 이 쓰기를 smooth로 강제하면 원래 읽던 행이 사라져 판정이 실패했다. |
| AC16 | VP-33·35 · EP-16 | `historyPull.test.ts`가 최상단 이전/로딩/유지/종료를, `history-search.test.ts`의 `reports one earlier-history failure`가 검색 실패·세대 불일치·겹친 앞삽입·전송 실패에서 각각 통지 1회와 자동 재조회 0을 확인했다. 부족분 P6s는 실제 앞삽입 높이가 모자라면 같은 페인트에 min-height를 남기고 끝에 닿아 닫는다. Claude Code 별도 실측에서 성공 첫 프레임 48px와 기준 글줄 top 104.1875px가 보존된 뒤 간격이 41.53125 → 35.53125 → 0px로 줄었다. |
| AC17 | VP-34 · EP-17 | `entryPrepend`는 이동 중 단위 응답을 지연해 실제 스크롤바의 일시정지→앵커 보정→새 하단 이동을 확인한다. 개별 실측에서 Claude Code/OpenCode 최대 글줄 이동 0.266/0.157px, 두 하단 오차 0px였다. `entryCancel`은 실제 상향 휠을 보내 하단 추종 취소를 검사한다. |

**설계 대비 차이.** 색인의 턴 키는 첫 메시지의 ordinal이다. `unitFloor`는 바로 앞 턴을 최대 4번 색인 탐색하고, `pageHeaders`는 하한 ordinal부터 현재 ordinal까지 기본키 범위를 읽는다. 20만 메시지 한 턴도 별개 턴 수를 세려고 모든 메시지를 훑지 않는다. 만료는 출판 세대·세션 경계로, 공유는 요청별 커서의 하한 검사로, 재진입은 요청당 로딩/마지막 성공 커서로 검사했다. 다른 무효화 축은 열기/검색 세대이며 전환 뒤 이전 응답 폐기를 기존 store 스위트에서 확인했다.

**고장 심기.** SQLite 5턴을 1턴으로 축소, 8번째 커서 하한 검사 제거, 머리 경계 ≤를 <로 변경, 성공 커서 검사 제거, 앵커 쓰기를 smooth로 교체, 취소한 하단 추종 보존, 입력 중단 시 당김 닫기, 측정 콜백을 다음 rAF로 지연한 소스 변이 8개를 각각 전용 테스트가 검출했다. 실제 Electron에서는 같은 높이 다른 문자로 치환(원래 글줄 없음), 성공 시 당김 제거를 다음 페인트로 지연(48.234px 이동·원래 글자 불일치), 실패 닫기 전환 제거(중간 높이 0건), 즉시 보정을 smooth로 강제(원래 글줄 없음) 네 변이가 검출됐다. 8개 소스 변이의 명령 결과는 각각 1이었다. 두 smooth 검사는 다른 실행 경계에서 같은 규칙을 검사했다.

**실행 기록.** 단위·store·실제 IPC 8파일 86/86. 뷰포트 하네스·앞삽입·진입 3파일 46/46(일부 기존 스위트 중복). SQLite 20만 메시지 1,563페이지 복구를 포함한 20개 기존 테스트 전부 통과했고 추가한 큰 중간 턴의 5턴 묶음 테스트도 통과했다. 통합 실행에서 20만 메시지 케이스가 65.515초로 제한을 넘은 뒤 같은 입력과 새 5턴 케이스 별도 재실행 2/2, 두 테스트 합계 45.38초를 관측했다.

**추가 부정·보관 검증.** 진짜 뷰포트 콜백에서 첫 요청 1회, 추가 당김 두 번 뒤에도 1회, 종료·실패에서 추가 요청 0인 테스트를 추가했다(1/1). P3에 요청 호출을 주입하면 세 번 호출되어 이 테스트가 실패했다. 하단 이동 일시정지 쓰기를 생략, 이동을 전부 instant로 변경, 첫 위치를 임의 0으로 변경한 세 소스 변이도 모두 해당 이동 테스트에서 실패했다. 검색 앞쪽 실패 콜백을 같은 요청에 두 번 보내면 원본은 알림 1회, 로딩 상태 검사를 제거한 변이에서는 2회여서 전용 단언이 실패했다. 추가 다섯 변이를 합해 전용 소스 변이 13개/13개가 해당 단언으로 검출됐다. 갱신한 앞삽입·검색 스위트 70/70, 하단 고정인데 최초 배치가 끝나지 않은 시점의 F1 거부를 검증한 전용 입력도 통과했다. 복구·포크는 실제 열 턴을 넣어 열린 다섯 턴과 보관·포크의 처음/중간/마지막 메시지를 구분한 통합 시험 1/1을 통과했다.

**전체 Electron 매트릭스.** 초기 3화면×26시나리오×5회로 390건을 전부 수집하고 검색 6건도 확인했다. 첫 실행의 실패 32건 중 묶음 경계 조기 조회 15건(진입 중 top=0, 1,386px 콘텐츠·600px 화면), OpenCode 스크롤바를 직접 조작해 하단 고정을 풀지 못한 조건 10건, Chromium 휠 합쳐짐 5건, 유효 시간 안에 보내지 못한 후속 입력 1건, 첫 측정 프레임 이동 1건을 확인해 경계와 측정 준비를 수정했다. 수정 후 최초 배치에서 Claude Code·Work의 y=690/690, OpenCode의 y=703/703을 관측했고, 세 화면 모두 입력 전 0회·실제 Home으로 진입 후 earlierTurn 1회다. 별도 3화면에서 성공 직전 읽던 글씨, 마지막 추가 메시지의 메타 행까지 포함한 다음 행 간격, P6s 첫 프레임 및 여백 닫기, AC17 일시정지 및 재개에 모두 합격했다. AC17에서 고정 위치 쓰기·보정 시작·정착 뒤 하네스 쓰기를 각각 검사하며 3개 실측 레코드의 일시정지 쓰기를 제거하면 3개 모두 거부된다. 입력 연속성 기준은 Chromium 타임스탬프 200ms 미만이며 부하로 이를 넘은 표본을 버리고 같은 화면·사례를 다시 수집한다. 후속 전체 기본 명령은 26종 × 3화면 × 5회 = 390건과 검색 6건을 모두 수집했으며 수정 전 단일 실행 결과는 **382/390, 검색 6/6, exit 1**이었다. OpenCode에서 Home 기본 이동이 끝나지 않은 출발점 6회, AC12 검사에서 하단 도달 후 온 유휴 응답 1회, 진행 중 첫 프레임 +100px 1회가 남았다. 원본 기록에서 마지막 경우는 앵커 쓰기(1939px) 뒤 브라우저 compositor가 최종 네이티브 스크롤을 전달해 2039px가 된 경우였다. 정지 중의 실제 scroll 이벤트에서도 글자를 즉시 복원하도록 수정했다. 이 분기를 제거하자 단위 재현에서 90px 예상이 −10px가 되어 정확히 100px 차이로 실패했다. 입력 장치는 Home 후 0이 연속 세 프레임 확인된 뒤 시작하며, 시간상 AC12 이동이 이미 끝났으면 실제 중간 프레임·도착한 하단과 단위 반영 후 하단을 검사한다. AC17은 진행 중 응답·일시정지·재개를 계속 강제한다.

동일한 Electron 진입점과 판정으로 새 빌드에서 OpenCode openFrames, entryPrepend, pullEnd, expired, reverse, doublePrepend, frames, framesUnit, pullSuccess의 5회 전부 **45/45**를 통과했다. 앞서 실패한 모든 조합을 포함한다. 이 45개 원본 레코드를 같은 시도 번호의 새 레코드로 교체하고 최신 판정 함수로 전체를 다시 평가한 결과 **390/390**이었다. 이 단계에서는 원본 345건과 수정 후 45건을 합산했다.

**최종 단일 실행에서 이력 390/390과 검색 6/6이 통과했다.** 행 관찰 전후의 높이와 사각형 측정까지 통합한 소스에서 Electron 39.8.10으로 기본 명령을 실행했다. 세 화면의 26개 시나리오를 각각 5회 확인했고 폐기한 입력과 표준 오류 출력은 없었다. 이전에 실패한 8개 조합도 모두 통과했으며 종료 코드는 0이었다. 아래 표는 이 마지막 단일 실행의 측정값이다.

| 실제 프레임 지표 / CSS px | Claude Code | Claude Work | OpenCode |
|---|---:|---:|---:|
| AC6″·15′ frames·framesWheel·framesUnit·framesSmoothCss·pullSuccess 글줄 최대 이동 | 0.234375 | 0.234375 | 0.4375 |
| AC17 일시정지 중 entryPrepend 글줄 최대 이동 | 0.40625 | 0.40625 | 0.15625 |
| AC17 재개 후 하단 오차 | 0 | 0 | 0 |
| AC16 성공 시 직전 과거 메시지 마지막 행과 기존 첫 행 사이 간격 | 0 | 0 | 0 |
| AC16 P6s 응답 첫 프레임 글줄 이동 | 0 | 0 | 0 |

AC4″·5″·6″·7·12·15′·16·17의 최종 구현자 판정은 모두 **PASS**이다. 고장 심기 13개의 기존 소스 변이와 최종 compositor 실패 재현 제거까지 14/14를 검출했다. 별도 Electron 직접 주입 변이 4건도 모두 검출했다.

**별도 Electron 변이 범위.** 측정 rAF 지연·최초 위치 임의 설정·진입 instant·일시정지 제거·취소 무시는 원본 소스에 심어 해당 단위 렌더러 테스트가 검출했고, 같은 소스 변이를 각각 세 화면 Electron에서 재빌드하여 재실행하지는 않았다. 실제 Electron에 직접 주입한 네 경우와 수집 기록의 일시정지 삭제 결과는 위에 구분했다.

패널 너비/세션 교체 시 행 ref 재설정 비용을 보고 실제로 측정한 높이의 재사용을 복구했다. ResizeObserver 이벤트에서는 실제 border-box 치수를 사용하며, 처음 보는 행이나 앵커 보정 중인 행은 동기 측정을 유지한다. 알려진 높이 52px에서 동기 DOM 읽기 0회, observer의 새 실측 69px, 캐시 삭제 후 DOM 실측 71px를 검사한 케이스를 포함해 뷰포트 3스위트 48/48이 통과했다.

통합 가상 뷰포트 검사에서 관찰자가 아직 붙지 않은 행의 실제 높이는 42px였고 캐시는 30px였다. 같은 창의 ResizeObserver에 동일 키와 DOM 노드가 등록돼 있을 때만 이전 높이를 재사용하도록 고쳤다. 처음 나타난 행과 앵커 보정 중인 행은 실제 사각형을 읽는다. 한 콜백에서 높이와 위쪽 좌표가 모두 필요할 때에는 같은 사각형을 사용한다. 기존 호출 수 변이는 2회, 수정 후 1회였고, 관찰자의 높이가 그대로인 경우는 0회였다. 가상 뷰포트 관련 22파일 157/157이 통과했다.

마지막 두 뷰포트 파일이 들어간 빌드에서 Claude Code·Work 각각 openFrames, entryPrepend, entryCancel, frames, framesWheel, framesSmoothCss, framesUnit, pullSuccess를 다시 실행해 추가 **16/16**을 통과했다. 같은 빌드의 OpenCode 45/45와 합해 새 코드의 직접 실기 측정은 **61/61**이다.

레지스트리 통합 테스트가 실제 세 화면을 렌더할 때 OpenCode 타임라인의 새 진입 의도 selector를 모의 store가 내보내지 않아 단독 재현 1실패/2건이었다. 진입 의도가 비어 있는 같은 세션 상태로 selector를 실행하도록 모의를 보완했고, Claude Code·Work 및 OpenCode 공통 뷰포트 경유와 가상화·스크롤 쓰기 호출 위치 검사를 포함해 같은 파일 2/2가 통과했다.
### 0331 본문 — r1 근거

| AC / pair | 구현 및 관측 | 상태 |
| --- | --- | --- |
| AC3′ / VP-03′·VP-13 | `history-search.test.ts`의 `AC3′ resolves deferred bodies at every page commit` 5행(loadSession·openSearchHit·readSearchEdge·readPrevious·leaveSearch(latest))은 별도 입력 없이 각 1회 본문 요청 후 실제 part를 확인했다. `TranscriptViewport.body.test.ts`는 버튼 없는 로딩·실패 후 재시도·원래 이웃 순서와 세션/선택/게시 세대/참조 교체·commit 직전 전환을 확인했다. `main/app/data-host/history-port.integration.test.ts`는 SQLite 검색→실제 data 포트→창 store→64KiB 본문 조각→계산 워커 처리기→원래 위치의 전체 본문을 대조했다. | 기계 기준 충족 |
| AC8 / VP-08·VP-16·VP-21 | `worker/markdown.test.ts` 50,001자·2만 노드 초과 HAST, `markdownDocumentBlocks.test.ts` 2,001행·501열·큰 한 행·각주·큰 문단, `WorkerMarkdownTail.test.ts` 50,001자 끝까지 parsed, `client.test.ts` 실제 파서→크기→클라이언트, `ArtifactPreviewContent.virtual.test.ts` 실제 11회 표 요청을 렌더해 2,001행·표·헤더 1개와 기존 첫 행 DOM identity를 확인했다. HAST 마크업 동등성, unsafe URL·HTML·이미지 처리는 `MarkdownHast.fidelity.test.ts`에서 대조했다. | 기계 기준 충족 |
| AC14′ / VP-29′·VP-31 | `worker/historyBody.test.ts` 한국어 4 MiB UTF-8의 64 KiB 경계·치명적 UTF-8/part 오류. `client.test.ts` 실제 처리기 왕복, 취소 후 늦은 응답 폐기. `MarkdownHast.test.ts` 단일 문단 25,000 인라인 항목을 각 프레임에서 증가한 노드 수 ≤20,000으로 확인. `markdownSegments.test.ts` 40M자 원문 = 8M자 문서 5개, 블록·줄·서로게이트 경계 대조. | 단위·연동 통과. 아래 Electron 장기 작업 기준은 별도 |
| 운영 게이트 | 관련 8파일 120테스트, data 포트·아티팩트·HAST fidelity 3파일 18테스트, 렌더/표 5파일 40테스트, 공유 Markdown 레이아웃·워커·뷰 8파일 66테스트 통과. 실행별 스위트는 일부 겹친다. | 관측값 |

| 변이 | 관측 |
| --- | --- |
| EP-3′ loadSession의 LOAD_SESSION 커밋에서 자동 시작 제거 | 해당 5경로 테스트 중 loadSession 본문 없음, red |
| EP-3′ openSearchHit 커밋에서 자동 시작 제거 | openSearchHit 본문 없음, red |
| EP-3′ readSearchEdge 커밋에서 자동 시작 제거 | readSearchEdge 본문 없음, red |
| EP-3′ readPrevious 커밋에서 자동 시작 제거 | readPrevious 본문 없음, red |
| EP-3′ leaveSearch(latest) 커밋에서 자동 시작 제거 | leaveSearch(latest) 본문 없음, red |
| EP-13′ 8M자 분할 루프 제거 | B5 문서 범위 [0]이 [0,8M,16M,24M,32M]과 불일치, red. 최신 테스트가 실제 32M자 용량 클라이언트에서 8M × 5번 문서 등록·요청·해제를 확인(2테스트 PASS). 통째 등록 변이 1회 재실행에서 첫 lease.available이 false여서 red |

전수 자동 시작 5곳을 함께 제거한 별도 워크트리에서 서로 다른 5개 입력을 실행했다. 같은 실행의 문서 분할 변이까지 위 6개 테스트가 독립된 예상 단언에서 실패했다. 실제 클라이언트의 통째 등록 변이에서는 첫 문서 리스가 준비되지 않아 같은 단언이 실패했다.

Electron `bigBody` 초기 번들(Claude Code · 1차). 첫 `body` 응답(B3은 첫 delta)부터 마지막 `**완료**` 서식 확인 및 10프레임 정착까지 측정했다. B3에서는 DOM의 파싱 완료 길이도 최종 50,406자와 대조했다.

| 입력 | 완료 | 측정 시간 | 50ms 이상 longtask 수 | 작업 최댓값 |
| --- | --- | ---: | ---: | ---: |
| B1 한국어 4 MiB | 예 | 53.110초 | 360 | 885ms |
| B2 혼합 Markdown 1 MiB | 예 | 131.150초 | 122 | 3,816ms |
| B3 스트리밍 꼬리 50,406자 | 예 | 2.325초 | 11 | 888ms |
| B4 인라인 코드·링크 25,000개 | 예 | 49.605초 | 92 | 4,542ms |
| B5 40,000,000자 | 190초 기한 내 마지막 서식 확인 실패 | — | — | — |

초기 측정 후 긴 문단의 줄바꿈·복사와 레이아웃, 오래된 커밋의 자동 시작을 보완했다. 관련 3파일 67테스트가 통과했다.

중간 번들 Claude Code 재측정 — B1 12.504초, longtask 48건(최대 1,139ms), 마지막 서식 완료 및 실제 DOM Range의 줄 경계 선택·복사 원문 일치. B3 3.046초, 12건(최대 489ms), 마지막 50,406자 서식 완료. 같은 조건의 B5는 다시 190초 기한 안에 끝나지 않았다. 초기 번들의 OpenCode 1차 B1은 103.605초에 마크업 완료, 416건(최대 1,467ms)이었다.

후속 정상본에서 MarkdownHast/서식 동등성/스트리밍 3파일 28테스트가 통과했다. 8M자를 넘는 실제 꼬리 진입점이 먼저 레이아웃 워커를 부르고 두 문서(8M·8자)로 등록·요청하는 테스트도 통과했다. 관련 ESLint 오류·경고 0, git diff --check 통과.

VP-29의 동기 디코드 복귀 변이는 별도 워크트리에서 실제 Claude Code B1로 재현했다. 창에서 base64→UTF-8→JSON·part 조립을 수행한 측정 구간 638.8ms 전체가 Chromium longtask 1,234ms 안에 들었다. 정상본도 다른 렌더 작업에서 50ms를 넘으므로 이 변이로 AC14′ 전체를 통과 처리하지 않았다.

중간 측정에서도 50ms를 넘는 작업을 확인했다. 첫 Claude Code B1은 8.528초에 최종 마크업과 원문 길이·내용, 줄 경계 선택 복사 일치를 모두 확인했다. longtask 23건, 최대 665ms로 미달이다. 초기 OpenCode 1차 B2 120.472초/140건/2,780ms, B3 2.300초/11건/313ms, B4 29.175초/49건/1,554ms도 끝까지 서식을 확인했다. B5의 실제 클라이언트 용량과 등록 회복은 단위·연동 테스트에서도 확인했다.

Electron DOM의 실제 수량 검사를 추가하자 프레임 사이에서 일부 노드가 누락되는 현상을 재현했다. 한 B4 재현은 코드 12,316/12,500 · 링크 12,311/12,500, B2는 문단 2,902/3,000 · 목록 29,541/30,000 · 표 1,927/2,001행이었다. 원본 파서 출력은 3,000문단·30,000항목·표 형식을 보유했다. 앞 프레임과 다음 프레임이 같은 자식 배열을 공유하므로 React가 추가된 노드를 건너뛰었다. 부분 프레임을 불변으로 보존하는 회귀 단언이 변경 전 red, 수정 후 4파일 34테스트 green이다. 수정한 B4 실화면에서 코드 12,500·링크 12,500 모두 확인(19.915초, longtask 33건).

불변 배열로 수정한 B2는 65.263초에 실제 DOM의 3,000문단·40개 코드 펜스·2,001행 표·600열 표·30,000개 목록·각주와 최종 서식 전부 일치했다. longtask 88건(최대 1,920ms).

같은 번들의 B5는 180.014초 기한에 40M자 전체 서식을 확인하지 못했다. longtask 862건(최대 2,545ms). 앞선 실제 워커 포트 관측에서는 1개씩 문서를 열고 해제했으며 170.6초 기준 문단 2,249개까지 화면에 들어왔다.

180초 계측 이후에도 같은 실제 창에서 B5의 렌더를 계속 관측했다. 최종 257.312초에 대기 표지 0, 끝의 `**완료**` 정상 서식, 2,443/2,443 문단과 전체 40,000,000자 소스의 각 문단 원문 대조가 일치했다. 영구 등록 대기 없이 최종 표시된다는 조건은 실화면에서 확인했다. 50ms 예산은 앞선 180.014초 구간만으로도 862건(최대 2,545ms) 초과하므로 AC14′는 미달이다. 시간은 본문을 처음 열고 워커·렌더·검증까지 포함하는 별도 연장 관측이다.

수정 후 Claude Code에서 관측한 입력별 결과다. B1~B4는 전체 명령의 첫 실행이며, B5는 위의 연장 관측이다.

| 입력 | 화면 검증 | 소요 | 50ms 이상 작업 수 | 작업 최댓값 |
| --- | --- | ---: | ---: | ---: |
| B1 | 전체 원문 또는 기대한 서식 수량 일치 | 1.760초 | 2 | 69ms |
| B2 | 전체 원문 또는 기대한 서식 수량 일치 | 69.721초 | 55 | 7,377ms |
| B3 | 전체 원문 또는 기대한 서식 수량 일치 | 1.296초 | 6 | 174ms |
| B4 | 전체 원문 또는 기대한 서식 수량 일치 | 66.129초 | 102 | 3,687ms |
| B5 | 전체 원문, 2,443문단, 끝 서식 일치 | 257.312초 | 첫 180.014초에 862 | 2,545ms (해당 측정 구간) |

통합 회귀 7건을 개별 재현했다. 10KB 완료 Markdown이 워커 결과 전에는 빈 대기 표지로 남고 첫 노출이 실제 서식인지 fresh open·활성 세션 전환 경로에서 검사한다. B가 비활성일 때는 파싱 0, 활성 뒤 B의 굵은 글자·링크 및 뒤따르는 C 마커를 세 하네스에서 대조했다. 50,000자 펜스는 OpenCode text·Claude reasoning에서 라이브 렌더와 완료 워커 응답 후 모두 한 개의 pre/code와 50,000자 원문이 일치한다. 완료 중 새 본문을 원문으로 노출하는 변이에서는 해당 9개 pending/출력 단언이 모두 red, D-009 정상본은 세 파일 52/52 PASS였다. B5 watchdog을 10분으로 분리해 후속 측정이 257초짜리 실제 종점까지 계속되도록 했다. 완료 본문 캐시와 증분 스캔 테스트는 실제 렌더러의 스캐너를 감시하며 두 파일 3/3이 통과했다.

**전체 Electron 성능 측정은 30회 중 2회에서 AC14′를 충족했다.** `node scripts/check-transcript-history.mjs --perf`로 Claude Code·OpenCode에서 B1~B5를 각 3번 실행했다. 29/30회에서 마지막 서식과 원문을 확인했고 그중 27회에서 50ms 이상 작업이 발생했다. 나머지 2회는 모두 B3였다. B5는 6회 중 5회가 12.587~54.432초에 전체 서식을 표시했고, 1회는 당시 제한 시간인 190초에 도달했다. 마지막 서식까지 관측한 29회의 장기 작업은 총 897건이었다(B1 57, B2 347, B3 33, B4 280, B5 180). 전체 명령의 종료 코드는 1이다.

| 자기 상태 | V-pair | 해석 |
|---|---|---|
| SELF_BLOCKED | VP-09′ | WU-0 PLAN_GAP |
| SELF_BLOCKED | VP-29′ | 50ms 실기 조건의 재현과 측정 결과는 위 본문 표 참조 |
| SELF_BLOCKED | VP-01~08·10~28·30~35의 유효 revision | 위의 기능별 양성·음성 시험은 보존했다. §10 자리·path edge·규칙 칸의 모든 항을 독립적으로 변이시키지 않아 pair 단위 전수 자기확인은 보류했다. |

### r1.4 · B2 네이티브 검색 뒤 읽기 위치 복원 (VP-42)

`2034f86d` 정본에서 B2의 실제 네이티브 검색은 두 화면의 여섯 회 모두 한 곳을 찾았고 종료 시 대상은 화면 밖에 있었다. Claude Code 한 창에서 같은 번들을 CDP로 관찰했다. 낮은 CPU 우선순위로 처음 준비한 창은 180초에 Markdown 블록 하나가 남아 찾기를 시작하지 못했다. 별도 관찰 창은 본문 준비 기한만 600초로 두었다. 원문·전체 서식·30,000개 목록 항목·OS 클립보드·앱 검색 대상 확인 후 `findInPage('완료')`를 한 번만 호출했다. JS 스크롤 API는 실제 호출을 그대로 위임하며 인수·직전/직후 위치·스택을 저장했다. 브라우저 위치와 DOM Range는 읽기만 했다. [실제 CDP 및 found-in-page 원문](evidence/r2-b2-native-scroll-2034f86d.json)

앱의 행 검색은 `revealSearchRow`를 통해 스크롤을 831,094px에서 47px로 옮겼다. 그 뒤 네이티브 검색 진행 중 scroller는 다시 831,094px에 있었다. 요청 약 5.84초 후 행 ResizeObserver의 `measureElement` → `flushAnchorRestore` → `writeScrollTop(..., 'anchor')` 호출이 47px를 썼다. 최종 `found-in-page`는 요청 약 10.59초 후 일치 1, 활성 순번 1, 대상 y=831,530을 반환했다. 동일 마커의 Range y=831,530.375와 스크롤 47px는 최종 이벤트 뒤 1초·2초·3초에도 유지됐고 추가 JS 쓰기는 없었다. 창 높이는 600px였다. 판정기의 관찰을 늘려도 화면에 도착하지 않은 재현이다.

제품 후보 `7e88d298`에서 같은 B2 입력을 같은 Electron·Chromium 버전으로 연 Claude Code 한 창에서 동일한 CDP 절차를 실행했다. 앱의 검색 행은 y=872,205.25에 있던 끝 마커를 포함했고, 네이티브 요청 1회의 첫 결과가 y=498, DOM Range y=498.21875에 도착했다. `scrollTop=871764`는 3초 후에도 같았으며 요청 뒤에는 앱의 스크롤 쓰기가 관측되지 않았다. 앞선 원문·30,000개 목록 항목·클립보드 판정도 통과했다. 이는 수정 전후 단일 검색 비교이다. `317a79c3`에서 겹친 앞삽입·화면 축소 경계를 추가로 보완했으며, 통합 `abb3b364`의 30창 성능 인수는 별도 판정한다. [수정 후 CDP 원문](evidence/r2-b2-native-scroll-7e88d298.json)

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 기대를 깨뜨린 실행 | 결과 |
|---|---|---|
| 공백 원문 제거 / 캐시에서만 공백 제거 | `parts.test.ts`, `segmentCache.test.ts` | 독립 변이 각각 red |
| Claude 메시지 사이 도구 분리 / OpenCode 숨은 reasoning 뒤 분리 / 앞삽입 후 키 색인 누락 / 도구 소유자를 첫 메시지로 강제 | Claude·OpenCode 블록 모델의 행 수, 키와 결과 소유자 단언 | 독립 변이 4개 red |
| 대칭 gap 복원 제거 / 큰 Write 결과를 비움 | 블록 gap·접힌 헤더 검증 | 독립 변이 2개 red |
| preview 실패 기록 생략 / 임시 산출물을 관리형 경로로 고정 | `service.test.ts` 실파일 두 경로 | 독립 변이 2개 red |
| 이력 경계·커서·앵커·당김과 실패 닫기 | 이력 표의 소스 변이와 실제 Chromium 기록 | 해당 표 참조 |
| 자동 본문 시작 누락 / 워커 문서 분할 제거 | 본문 표의 경로별 행동 단언 | 해당 표 참조 |

표의 첫 네 행에 대한 등록 변이 10/10을 `mutate.py`로 실행하고 원본이 복구됨을 검사했다. 자동 본문 다섯 경로는 변이 빌드를 공유했다. 각 단언 실패는 별도로 확인했으며 독립 소스 변이 5개로 세지 않았다. §10 전체 분기는 열거·변이 미완으로, PLAN_GAP 귀환 시점의 수치다. 유효 EP 1~17의 자리 수는 8+7+10+3+6+7+12+9+21+5+5+3+12+10+4+9+4 = 135다(EP-12는 §10-A의 소유자 3행). 각 자리의 세부항, 형제 교환, 경로를 모두 전수 대조해 닫았다고 주장한 수는 0/135다. 위 기능별 검출 수는 이 전수 분자와 별도로 집계했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 관측과 후속 |
|---|---|
| 사용자 대면 문구·상태 | 머리 로딩과 당김 로딩은 해당 위치의 스피너 하나로 보인다. 오류 재시도와 이전 이력 실패 토스트에는 실제 호출 경로와 번역이 있다. |
| 정리 코드가 쓰는 소유자 | 본문과 문서 작업은 세션·세대·문서 리스로 취소한다. 세션 교체 뒤 도착한 예전 본문이 원래 행을 덮지 않는 시험이 있다. |
| 실패 전이·표시 | §20-C F5/F6, §21-B P7. 본문 실패에는 재시도, 이전 이력 실패에는 알림이 있다. 오류 버블 연속 전송의 표시 손실은 AC9의 설계 공백이다. |
| 늦은 응답 | 검색 종료·세션 전환·재진입과 같은 커서 중복 호출을 store 및 IPC로 확인했다. |

## [구현자 기입] 놓친 잠재 문제 + 대응

| 문제 | 대응·근거 |
|---|---|
| 합친 도구 그룹에서 뒤 메시지의 입력이나 응답이 유실될 수 있음 | 호출별 소유자를 유지하고 prepend 뒤에도 첫 키에서 조회하도록 했다. 소유자 변이가 red다. |
| 큰 Edit에서 동기 표시 예산 밖의 계산이 오래 걸림 | 줄 토큰이 전혀 겹치지 않을 때 두 줄 수로 워커 결과를 산출한다. 나머지는 기존 diff 계산을 쓴다. 5,000줄 전체 교체 실기와 워커 동등성 단언이 있다. |
| 큰 본문의 CPU와 브라우저 레이아웃 시간이 다름 | UTF-8 복원·워커 파싱·프레임별 DOM 반영·Chromium longtask를 별도로 기록했다. |

### 설계 대비 명시적 차이

`unitFloor`는 5번째 그룹의 전체 행을 집계하는 대신 바로 앞 턴을 찾는 제한된 색인 검색을 쓴다. 단위 하한과 wire 커서는 그대로다. 큰 파일의 접힌 헤더는 diff 본문 모델 전체 대신 줄 수만 돌려주는 계산 요청을 쓴다. UI 모델은 실제 워커 응답 후 갱신된다. 만료(세션·발행 세대), 공유(커서 하한·문서 리스), 재진입(동일 커서·동시 본문), 무효화(선택·문서 교체)의 구별 입력은 위 두 담당 표에 기록했다.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | SQLite 이력 조회·wire·store, 세 하네스의 렌더·앵커·도구 헤더, 공통 Markdown 워커와 뷰, 산출물 서비스·로거, Electron 측정기, 대응 테스트 및 아키텍처 문서 |
| 실행 명령 | `vitest run` 기능별 테스트, `xvfb-run -a node scripts/check-transcript-history.mjs` 및 `--layout`, `--perf`, `site_census.py`, `mutate.py`. |
| 관측한 게이트 산출 | Linux 최종 Vitest 10,965개 통과·예상 실패 1개·건너뜀 11개, Node 스크립트 1,178/1,178, 가드 5종, 타입 검사, 빌드와 두 호스트·preload 기동 통과. lint 오류 0·경고 15. 별도 Electron 게이트에서 이력 390/390·검색 6/6, 레이아웃 20/21, 본문 성능 2/30이었다. |
| 추가·수정 테스트의 subtree 규칙 | SQLite에 실제 이력, 데이터 포트와 워커에 실제 메시지, 렌더 하네스와 Electron에 실제 입력과 DOM. `git diff --check`를 수행했다. |
| V-pair 자기확인 / 강제 지점 전수 | §10·§20~21 유효 revision 기준 총 35쌍. 설계 귀환·부분 sweep을 반영하여 전수 SELF_PASS는 0쌍이다. |
| AC 자기보고와 합계 | 15/17 — AC1~8·10~13·15~17 충족. AC9′는 실시간 실패 귀속이 EP-9 밖인 PLAN_GAP. AC14′는 40M자 전체·2,443개 문단의 정상 표시를 확인했으나 50ms를 넘는 렌더러 작업이 남았다. 15 + 2 = 17. |
| 블로커 / 설계 질문 | 현재 세션의 여러 실패를 어떤 영속 턴과 연결하며, 저장 이력을 다시 읽을 때 어떤 ID로 화면의 기존 오류와 합치는가? |
| 대상 커밋 | `(r1.3 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 첫 구현 라운드다. 기존 트리에서 저장 오류와 실시간 오류의 표현이 다르며 실제 실패 전송으로만 4 → 4 → 4가 나타났다.
- WU-0와 AC9′가 §10 밖 원인의 설계 귀환을 지정했다. Electron 프레임 수와 50ms 예산은 Linux Chromium 실측으로 기록했다.
- 현재 라운드·impl 턴은 `r1`이다.

### r1.4 · AC9″의 실제 실패 카드와 재열기 (VP-36)

Linux에서 레이아웃 27좌표가 27/27 통과했다. `app`에서 Node 22, Claude Agent SDK 0.3.296 동봉 CLI와 OpenCode 1.18.27을 사용했다. `ORCINUS_ORCA_TEST_OPENCODE_EXE`에 실제 OpenCode 실행 파일을 지정하고 `xvfb-run -a node scripts/check-transcript-history.mjs --layout`을 실행한다. 종료 코드는 0이고 결과 JSON의 `records`에는 서로 다른 화면·시나리오 27개가 있다.

| 경계 | 입력과 관측 |
|---|---|
| 생성·저장·표시 | 실행마다 현재 소스의 agent/data 호스트를 빌드해 별도 Node worker와 포트로 연결한다. 격리된 홈·SQLite에서 공개 전송을 호출하고 로컬 모델이 실제 CLI 요청에 HTTP 오류를 반환한다. 창 포트가 받은 입력 커밋·오류 영수증·후속 이벤트와 data 호스트의 실제 페이지 응답을 Electron에 순서대로 전달한다. Chromium은 production store와 TranscriptView를 렌더한다. 발생 시각·ID, 직전의 실제 질문 블록과 카드가 속한 assistant 블록의 키, 표시된 분류·본문·재시도 안내를 매번 대조한다. |
| Claude Code·Work | 저장 실패 3건에서 시작해 세 차례의 실제 추가 실패 후 4→5→6건, 다음 성공 뒤 6건이었다. 두 호스트를 종료하고 같은 SQLite를 열어 최신 5턴에서 이전 2턴을 읽은 뒤에도 각각 같은 6건과 성공 답변이 남았다. 한 줄 질문·오류 fixture에서 모든 단계의 모든 이웃 간격이 206.671875 CSS px였다. 처음 두 오류는 질문과 오류 문구가 같고 발생 ID는 달랐다. |
| 기존 기록과 무소유 대조 | 구형 Claude Code 오류 6건·Work 중단 6건은 최초 열기와 다음 전송 뒤에도 6건이다. Code 다섯 간격은 각각 160.171875px, Work는 165.171875px였다. 소유자 없는 오류 3회는 저장 카드 3건과 일시 안내 1개로 4→4→4, 매회 store의 오류 메시지는 3건이었다. |
| Work 중복과 OpenCode 누락의 재현 | 수정 전 Work의 실제 응답 경계와 오류 상세가 두 assistant 행으로 갈라져 초기 6개·완성 12개가 표시됐다. 같은 응답 경계 ID로 저장·표시를 연결한 뒤 완성 6개다. OpenCode에서는 기존 세션의 403이 user 커밋 뒤 일시 오류로만 도착했다. 두 호스트를 종료한 뒤 읽은 SQLite에 해당 세션의 영수증·오류 part가 각각 0개였고 마지막 활동은 idle이었다. |
| OpenCode Code | 첫 요청의 모델 응답을 보류한 시점에 실제 초기 SQLite 페이지를 읽고 HTTP 403을 반환했다. 호스트 재기동 후 같은 세션에서 성공 1회, 이어진 HTTP 403 1회를 추가했다. 실제 창의 오류 개수는 0→1→1→2, 다시 두 호스트를 띄워 읽은 값은 2였다. 성공 입력 `u:accepted-2`의 앞뒤 입력 1·3에 서로 다른 영수증이 붙었다. OpenCode의 공급자 권한 거절 제목·403 안내가 보이고 재시도 안내는 없었다. |

격리 복사본에서 Claude ErrorCard 생산 코드를 매회 한 곳만 바꾸고 복원했다. 정상 대조의 실제 입력 화면과 SQLite 재열기 화면이 모두 통과했다.

| 독립 변이 | 실제 Electron 관측 |
|---|---|
| 두 번째와 다섯 번째 카드의 소유자 키 교환 | 라이브와 재열기 모두 실패. 행 수와 5개 간격은 정상 대조와 같았다. |
| 같은 두 카드의 표시 본문 교환 | 라이브와 재열기 모두 실패. 소유자 키·행 수·간격은 그대로였다. |
| 다섯 번째 카드 뒤 여백 8px 추가 | 라이브와 재열기 모두 실패. 앞의 네 간격은 206.671875px, 마지막은 214.671875px였다. |

### r1.4 · ΔV5 구현자 보고

**설계 리뷰.** 입력을 소비했다는 공급자 증거, 실제 사용자 행의 커밋, 그 응답의 오류 영수증을 차례로 연결한다. Work는 같은 응답의 시작·종료 경계 ID로 상태와 상세 카드를 연결한다. 본문은 데이터 호스트에서 64KiB씩 읽고 워커 수신 확인을 받은 뒤 다음 조각을 요청한다. 창에서는 이전 조각의 원천과 레이아웃을 재사용한다.

**강제 지점 전수와 V-pair 자기확인.**

| 쌍 | 변경한 경로 | 구현자가 확인한 결과 |
|---|---|---|
| VP-36·37 | Claude와 OpenCode 어댑터 → turn coordinator → 에이전트·데이터 호스트 → 저장 확인 → 화면 | 위 27개 레이아웃 좌표와 같은 세션의 성공 뒤 OpenCode 403을 확인했다. 저장하지 않는 오류의 사용자 안내도 따로 측정했다. |
| VP-38 | SQLite 영수증의 세션별 유일성, 실패 part, 열람·네이티브 투영·검색·페이지·분기·아카이브 | 원자성, ACK 유실 후 재전달, 충돌·롤백, 세션/입력 교환, 이력 재열기를 검사했다. 해당 하위 스위트는 33파일 258개를 통과했다. |
| VP-39 | reducer·store → 입력 그룹과 하네스별 카드 → 이력 재조립 | 이전 세 턴의 오류를 순서 밖으로 받는 경우, 자동 입력 후 첫 스트림, 구독자가 다음 입력을 여는 시점, 이력 앞삽입 이후의 Todo 시작점을 확인했다. 수정 전 다섯 회귀가 모두 실패했고 수정 뒤 관련 9파일 90개가 통과했다. |
| VP-40~43 | 본문 조각 → 워커 → Markdown 등록·레이아웃·HAST → 창의 프레임별 DOM 반영 → Chromium 실측 | 수신 확인과 취소, UTF-8 오류, 긴 문단·인라인·각주·표, 다중 part와 선택을 검사한다. 완료 서식, 원문, 선택·검색과 50ms의 판정은 각각 원시 행에서 읽는다. |

§10의 20개 검색을 최종 코드에서 다시 실행했다. 오류 9개 검색에서 검색 519줄·AST 후보 354줄·적용 401줄·제외 64줄, 본문 11개 검색에서 781·615·588·27줄이었다. 적용 수에는 AST 검색이 직접 포착하지 못한 명시적 소비 경로가 들어간다. 양쪽 모두 검색에만 남은 미분류와 목록에만 남은 항목은 각각 0줄이었다. 최초 하단 마운트, 재열기 영수증·보이는 카드, 분할 펜스, 각주, 찾기 좌표가 포함된다. [검색식과 파일별 적용·제외 목록](evidence/site-inventory.json)


**이번 라운드 수정의 잠금.** 서로 다른 결함을 실제 코드에 한 번씩 넣고 원래 단언이 실패하는지 확인했다.

| 변이 위치 | 실행한 소거·교환 | 관측 |
|---|---|---|
| 오류 생산과 영수증 전달 | error를 소비 확인으로 채택, 첫 입력만 owner로 사용, 최종 catch 직접 전달, 같은 occurrence 재발급·시간·owner 변경, 다른 native parent | 7/7 검출 |
| 저장과 이력 투영 | 원자성·유일성 제거, 재전달 충돌, 세션·owner·occurrence 교환, 네이티브 frontier·검색 alias, Work 경계, deferred 본문 | 15/15 검출 |
| 창의 오류 처리 | 세션/assistant 키, 묶음 순서, 삽입 위치·발생 병합, 다음 턴 상태, footer, prepend·hydrate·load, 카드 병합·Work 상태 | 13/13 검출. 최초 원형 검사에서 빠진 두 변이는 겹친 페이지와 앞삽입 직후 단언을 추가해 각각 다시 검출했다. |
| 실제 카드 배치 | 같은 높이인 두 카드의 owner·본문 교환, 간격 8px 추가 | 3/3 검출. 실제 DOM 수치는 위 VP-36 표에 기록했다. |
| 본문 조각 | 다음 offset 불일치, 세션/세대 검사 제거, 64KiB 초과 전송 허용, UTF-8 fatal 해제, 취소 후 워커 상태 유지, 등록 레이아웃 유실 | 7/7 검출. 창에서 과대 조각을 워커로 보내기 전 거절하는 단언과 정상 JSON 안의 손상 바이트를 추가했다. |
| Markdown 워커와 출력 | 순서·세대·전송 상한·문자 수·꼬리 델타·각주·해시·등록 레이아웃·프레임 표본 | 9/9 검출 |

위 다섯 코드 범위의 서로 다른 변이는 7+15+13+7+9=51개다. 최초 검사에서 놓친 4개의 재시도를 포함한 실행 기록 55개와 각 종료 코드를 보관했다. 실제 Electron 카드 소거 3개까지 54개를 검출했다. 3개 소거 각각의 사용자·본문·간격 관측은 위 VP-36 표에 있다. [코드 변이별 실제 결과](evidence/r1.4-mutations.tsv)


**Product/UX 파생 검토.** 오류의 분류·본문·재시도 표시는 원래 입력에서 읽힌다. 접속 전 오류와 취소된 입력은 기존 일시 안내·초안 처리 경로를 따른다. 새 턴의 첫 델타가 앞선 턴의 종료 처리로 사라지던 사례는 실제 store 구독 재진입으로 재현해 고쳤다.

**놓친 잠재 문제와 대응.** B5 CPU 프로파일에서 큰 본문의 블록 키 대조와 레이아웃 원문 비교가 워커 응답 콜백을 오래 점유했다. 기존 블록이 없으면 키 대조를 생략하고 원본 part의 이미 분할한 구간을 재사용한다. 이 진단의 소요 시간과 별도 실행한 30창 인수 결과는 따로 기록한다.

**구현 보고.** 첫 통합 실측은 고정 트리 `7a86f7db`, Electron 39.8.10/Chromium 142.0.7444.265에서 두 화면과 다섯 입력을 세 번씩 열었다. 교정 1건, 고유 표본 30건, 판정 1건을 [첫 실측 원문](evidence/r2-body-7a86f7db.ndjson)에 보관했다. 30건 중 1건이 모든 조건을 충족했다. 29건에서 완료 서식·원문·선택·OS 클립보드와 앱 검색을 확인했다. Claude Code의 B2 세 번째 표본은 watchdog으로 종료됐다. Chromium 찾기 결과와 화면의 마지막 강조 좌표는 14건에서 일치했다.

| 첫 실측의 입력 | 자료 | 관측된 장기 작업 | 최장 작업 |
|---|---|---:|---:|
| B1 | 한국어 장문 | 18 | 311ms |
| B2 | 3,000문단·40펜스·표·3만 목록·각주 | 1,342 | 675ms |
| B3 | 진행 중 응답에서 완료 메시지로 전환 | 1 | 51ms |
| B4 | 인라인 코드와 링크 12,500쌍 | 795 | 1,283ms |
| B5 | 4,000만 자, 최종 DOM 2,443문단 | 147 | 721ms |

완료 관측 29건 중 장기 작업 0건인 표본은 6건이었다. 위 합계 2,303건에는 관측값을 반환하지 못한 B2 표본을 세지 않았다. B3에서는 스트리밍 fixture가 완료 이벤트에서 다른 part 키를 사용했다. Chromium은 문서를 스크롤하기 전 찾기 좌표를 반환하기도 했다. 실제 part 키를 통일하고 검색이 연 저장 행의 revision·마지막 강조·10개 안정 프레임을 확인하도록 고쳤다. 스크롤 뒤에도 좌표가 어긋나면 Chromium에 같은 문구를 다시 요청해 실제 선택 영역과 비교한다.

등록 경계에서 끊어지던 최상위 코드 펜스는 한 `pre/code`로 이어진다. 실제 Chromium에서 8,000,068자 원문의 코드 8,000,023자가 한 블록에 들어갔고, 닫는 펜스 다음 줄의 강조와 원문 경계를 가로지른 선택·OS 복사를 확인했다. 참조 링크는 같은 문서의 첫 유효 정의를 등록 구간 양쪽에서 사용한다. 중복·이스케이프·여러 줄 제목과 원문 offset은 worker/renderer 회귀에서 대조했다. GFM 각주 사례는 8,000,162자에서 수정 전 0/4 참조였다. 수정 뒤 Chromium에서 참조 번호 1·2·1·3, 정의 3개가 담긴 끝 목록 1개, 되풀이 참조의 역링크 2개와 정의 본문의 실제 선택·OS 복사를 확인했다. 파싱을 실패시킨 일반 본문과 분할 펜스는 원문을 보존하고 뒤 행을 계속 표시한다. 두 실패 경로를 포함한 병합 스위트 5파일 29개가 통과했다.

B2를 별도 CDP 창에서 1회 기록했다. 목록이 2만→3만 행으로 자라는 중 702ms 작업에서 Blink paint 365.7ms, layout 88.5ms, prepaint 75.7ms가 관측됐다. 3만 행 뒤 797ms 작업에서는 레이아웃 객체 123,092개로 layout 373.3ms, prepaint 115.1ms, paint 93.0ms였다. 같은 구간의 작업 수를 인수 원문에서 빼지 않았다. [CDP 진단 원본](evidence/r2-b2-cdp-7a86f7db.json.gz)


중간 후보 `0b9c6fb2`에서는 1,200px 화면에 모두 들어가는 짧은 대화에서 첫 사용자와 첫 오류 카드가 표시되지 않는 제품 결함을 확인했다. 아홉 행 중 인덱스 2~8만 마운트된 상태가 15회 반복됐다. 같은 표본의 SQLite·재열기 페이지·화면 store에는 두 오류 영수증이 모두 남아 있었다. 실제 크기가 확인된 뒤 하단 시작 위치를 넘기도록 수정했다. 같은 자료·같은 1,200px 창에서 15/15회 인덱스 0~8과 두 오류가 첫 관측부터 표시됐다. 실제 CLI로 새로 만든 세션의 레이아웃은 [27/27](evidence/layout-2034f86d.json), 세 화면의 선택 검사는 [90/90](evidence/selection-2034f86d.json)이었다. 수정 전 후보의 성능 측정은 종료했다. 완료한 Claude B1~B4 네 행과 외부 종료 상태를 [중간 후보 원문](evidence/r2-body-candidate-0b9c6fb2-interrupted.ndjson) 및 [중단 기록](evidence/r2-body-candidate-0b9c6fb2-interrupted.json)에 보존했다.

B5와 같은 4,000만 자의 두 원문 part에 중간 고유 문구를 놓은 별도 사용성 검사는 2,443문단을 대조했다. Claude와 OpenCode에서 각각 한 실행은 1,221번 문단의 고유 단어 이동·선택·OS 복사를 확인했다. OpenCode의 뒤이은 실행은 네이티브 찾기가 화면을 지나쳐 재시도 후에도 목표가 화면 밖에 있어 실패했다. 중간 문단 소거와 마지막 강조 소거는 각 성공 회차에서 모두 검출됐다. 두 실행의 종료 코드는 각각 1이었다. [B5 추가 사용성 측정 원문](evidence/r2-b5-middle-search.json)

이력의 중간 후보에서 387/390, 검색 5/6이었다. OpenCode 검색 대상의 첫 배치 전에 이전 페이지를 당겨오고 예전 글줄 앵커가 검색 위치를 덮는 경합을 수정했다. OpenCode 실제 마우스·키보드 반복은 각각 20/20 통과했다. 휠 뒤 유휴 상태를 기다리는 검사에서는 Chromium의 실제 첫 idle이 2.00~2.03초 뒤에 왔다. 자동 조회를 제거한 변이는 수정한 검사에서 2/2 실패했다. `2034f86d`에서 세 화면의 이력 390/390과 검색 6/6 전부 통과했다. 단위 조회 150프레임의 최대 위치 차이는 0.421875px, 같은 글자 불일치는 0개였다. 관성·후속 휠의 입력 시간 조건을 벗어난 세 번의 시도와 사유도 원문에 남았다. [이력·검색 전체 실행](evidence/history-2034f86d.json.gz)

**읽기 위치 보정 전 본문 실측.** `2034f86d`의 고정 제품 트리에서 Linux Electron 39.8.10 / Chromium 142.0.7444.265, 1,000×600px, DPR 1로 두 하네스의 B1~B5를 각 세 번 실행했다. 양성 교정 1개, 고유 측정 30개, 전체 판정 1개를 보존했다. 완료 서식과 원문, 안정 프레임 10개, pending 0, 관측 손실 0은 30/30이었다. OS 복사와 앱 검색은 각각 29/30에서 확인했고 Chromium 찾기 도착은 23/30이었다. AC14′의 전체 판정은 2/30, 종료 코드 1이다. [30창 원본](evidence/r2-body-2034f86d.ndjson)

| 입력 | 원문·완료 서식 | OS 복사·앱 검색 | Chromium 찾기 도착 | 장기 작업 0건 | 장기 작업 합계 | 최장 |
|---|---:|---:|---:|---:|---:|---:|
| B1 | 6/6 | 6/6 | 6/6 | 0/6 | 19 | 316ms |
| B2 | 6/6 | 6/6 | 0/6 | 0/6 | 1,659 | 962ms |
| B3 | 6/6 | 6/6 | 6/6 | 2/6 | 10 | 384ms |
| B4 | 6/6 | 6/6 | 6/6 | 0/6 | 226 | 519ms |
| B5 | 6/6 | 5/6 | 5/6 | 0/6 | 124 | 671ms |
| 합계 | 30/30 | 29/30 | 23/30 | 2/30 | 2,038 | 962ms |

두 통과 표본은 Claude Code B3의 첫째·둘째 창이다. B2는 양 하네스 여섯 창 모두 Chromium이 일치 1개를 반환했으나 목표가 보이는 영역 밖에 남았다. Claude Code B5의 셋째 창은 29.77초에 4,000만 자·2,443개 문단의 완료를 확인한 뒤 네이티브 찾기 세 번째 요청이 응답 없이 만료됐다. 그 창은 OS 복사와 앱 검색의 최종 판정 필드도 남기지 못했다. 전체 표본을 판정에 포함했다.

**최종 본문 실측.** 같은 30창과 환경에서 `abb3b364`의 원문·서식·안정 프레임·pending·손실 판정은 30/30이었다. B2는 양 하네스의 6개 창에서 모두 실제 뷰포트의 검색 목표까지 도착했다. 전체 OS 복사, 앱 검색, Chromium 찾기는 각각 29/30이었다. 최종 판정은 4/30, 종료 코드 1이다. 원문의 양성 교정과 고유 30행을 다시 읽어 판정이 일치하는 것을 확인했다. [최종 측정 원본](evidence/r2-body-abb3b364.ndjson)

| 입력 | 원문·완료 서식 | OS 복사·앱 검색 | Chromium 찾기 도착 | 장기 작업 0건 | 장기 작업 합계 | 최장 |
|---|---:|---:|---:|---:|---:|---:|
| B1 | 6/6 | 6/6 | 6/6 | 0/6 | 28 | 469ms |
| B2 | 6/6 | 6/6 | 6/6 | 0/6 | 1,636 | 734ms |
| B3 | 6/6 | 6/6 | 6/6 | 4/6 | 6 | 132ms |
| B4 | 6/6 | 6/6 | 6/6 | 0/6 | 605 | 509ms |
| B5 | 6/6 | 5/6 | 5/6 | 0/6 | 69 | 371ms |
| 합계 | 30/30 | 29/30 | 29/30 | 4/30 | 2,344 | 734ms |

네 통과 표본은 B3의 Claude Code 세 창과 OpenCode Code 셋째 창이다. Claude Code B5의 첫째 창은 31.20초에 본문을 완료했고, 세 번째 네이티브 찾기 요청은 응답 없이 만료됐다. 그 창의 복사와 앱 검색 판정도 기록되지 않았다. 30개 원문에는 UTF-8 대체 문자가 없었고 최신 수집기로 다시 읽은 결과도 일치했다. 장기 작업 합계 2,344건과 응답 시간 초과로 AC14′는 미충족이다. 50ms 실기의 VP-29′·VP-43과 검색 종료가 확인되지 않은 VP-42는 SELF_BLOCKED다.


B2의 실제 단일 소스 part는 이미 `li > 텍스트`였다. 추가 part 표시를 걷어내는 후보는 그 경로에 효과가 없었다. 목록 항목별 `content-visibility:auto`를 적용한 앞선 진단 표본은 66.4초·장기 작업 301건이었다. 기존 CDP에서 1만→3만 항목 사이 Layout 총 10.13초 가운데 10.06초는 JavaScript 호출 구간 밖에서 기록됐다. 전체 목록의 마크업과 선택을 보존하면서 제거 가능한 반복 DOM 조회는 이 추적에서 확인되지 않았다.


최신 `abb3b364`의 별도 Electron 회귀에서 레이아웃 27/27과 실제 선택·복사 90/90을 확인했다. 두 검사 모두 종료 코드 0이고 고유 좌표의 차집합은 비었다. 새 읽기 위치 보정의 단위 회귀 6파일 73/73은 행·헤더 관찰기, native scroll 직후 앞삽입, 축소 후 범위 재확장, 명시적 진입 보정을 포함한다. [레이아웃 원본](evidence/layout-abb3b364.json) · [선택 원본](evidence/selection-abb3b364.json)


최신 뷰포트의 첫 이력 실행은 389/390, 검색 6/6이었다. 실패한 OpenCode `pullHold` 한 프레임에서 UTF-8 대시의 수신 바이트가 두 출력 조각으로 나뉘어 `��`로 기록됐다. stdout·stderr의 분할을 그대로 재현한 두 검사가 수정 전 실패했고 연속 UTF-8 디코딩을 적용한 뒤 수집기 스위트 16/16이 통과했다. 같은 제품으로 다시 실행한 결과는 이력 390/390, 검색 6/6, 폐기 0, 종료 코드 0이었다. 단위 조회 150프레임의 최대 위치 오차는 0.1875px, 주요 앵커 750프레임의 최대 오차는 0.234375px였고 같은 글자 불일치는 0이었다. [수집기 보정 전 원문](evidence/history-abb3b364.json.gz) · [최종 이력 원문](evidence/history-39ec253d.json.gz)


뷰포트의 최하단 초기 마운트와 시험용 스크롤 리스너 연결을 다룬 테스트를 수정했다. 관련 스위트는 각각 4/4와 8/8이었다. TypeScript 제네릭이 있는 가상화 훅을 이전 정규식이 놓쳤다. 호출식 AST로 가드를 보완해 실제 사용 위치를 검증하고 다른 파일에 일반·제네릭 호출을 심은 음성 대조를 검출했다.

`abb3b364`의 전체 Vitest는 종료 코드 0이다. 파일 1,169개 중 1,165개 통과·4개 건너뜀, 테스트 11,048개 중 11,036개 통과·예상 실패 1개·건너뜀 11개·예기치 않은 실패 0개였다. 실제 Claude CLI 8건을 포함한다. UTF-8 수집기 보정까지 포함한 Node 스크립트는 1,227/1,227이었다. CI의 가드 5개, 타입 검사, 번들 빌드, 에이전트·데이터 호스트와 preload 기동을 통과했다. 린트는 오류 0개·경고 15개였다.

**인수 자기보고.** ✅ 16 · ⚠️ 0 · ❌ 1 = 총 17. AC9″는 수락·저장·화면·재열기를 확인했다. AC14′는 50ms 예산과 B5의 한 검색 응답이 남았다. 독립 검증자는 INDEX의 구현 좌표를 기입한다.

**Review Signals.** r1.4는 r1.3과 같은 라운드의 구현 턴이다. §22-A의 저장 확인과 원래 입력 귀속을 공급자부터 재열기까지 대조했다. §22-B의 시간 예산은 각 행의 원래 장기 작업 배열을 기준으로 판정했다. 같은 높이의 카드 교환, 늦은 시점의 이력 요청, Chromium 찾기 좌표의 시점 차이는 마지막 DOM 개수나 요청 횟수만 확인하던 검사에서 잡히지 않았다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 발견 분류 | disposition | 상태 |
|---|---|---|---|---|---|---|
