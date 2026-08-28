# cowork ↔ Orca — 축별 대조와 적용 후보

Orca 쪽 정본은 코드다. 이 문서는 대조 시점(2026-08-28)의 관측이며, 인용한 경로가 바뀌면
코드가 이긴다.

## 1. 축별 대조

| 축 | cowork | Orca | 판정 |
|---|---|---|---|
| 그룹 요약 | 활동 종류별 절 + 카운트 + `· N 노트` | `toolGroupSegments` 가 동사별 카운트 절을 같은 양식으로 만든다 | **이미 일치** — `· N 노트` 만 없다 |
| 중간 텍스트 | 런 안으로 강등 | `messageSegments` 가 만나는 순서대로 최상위 Markdown 으로 승격 → **텍스트마다 도구 그룹이 쪼개진다** | **최대 격차** |
| 사고 | 첫 것만 pill, 나머지는 런 안 노트 | `ReasoningBlock` 이 매번 테두리 있는 `<details>` 카드 | 시각 비중 과다 |
| 행 라벨 | 도구 메타 문장(`Added task: {subject}`·`Started task`) | `toolDescription` 이 `description` 을 우선 → TaskCreate 는 긴 문장, **TaskUpdate 는 도구 이름** | 라벨 품질 격차 |
| `activeForm` | 미사용(`Started task` 고정) | 미사용 — `subject` 도 작업 목록 파생만 읽는다 | 재료는 이미 있다 |
| 실패 | 행 안 `Error` 섹션에만, 재시도 행이 뒤따른다 | 그룹 요약 동사를 `text-bad` 로 강조 | Orca 가 더 강하게 드러낸다 |
| 산출물 | 클릭 가능한 행 + 턴 끝 카드 + 미리보기 패널 | 없음 — `Write` 는 diff 본문만 | 미구현 |
| 사이드패널 3섹션 | 셋 다 채워짐 | `진행 상황` 만 데이터, `출력`·`컨텍스트` 는 빈 자리 | 0204 D-022 가 남긴 자리 |
| 접근성 | 메시지 heading · `aria-setsize/posinset` · pill `aria-live` | 실행 중 표기 위주 | 보강 여지 |

**Orca 쪽 정본 경로**

| 대상 | 경로 |
|---|---|
| 세그먼트 분절 | [`lib/parts.ts`](../../../../app/src/renderer/src/features/chat/lib/parts.ts) `messageSegments` |
| 그룹 요약 | [`lib/toolMeta.ts`](../../../../app/src/renderer/src/features/chat/lib/toolMeta.ts) `toolGroupSegments` |
| 그룹/행 렌더 | [`transcript/ToolGroup.tsx`](../../../../app/src/renderer/src/features/chat/components/transcript/ToolGroup.tsx) · [`ToolCard.tsx`](../../../../app/src/renderer/src/features/chat/components/transcript/ToolCard.tsx) |
| 사고 | [`transcript/ReasoningBlock.tsx`](../../../../app/src/renderer/src/features/chat/components/transcript/ReasoningBlock.tsx) |
| 턴 묶음 | [`lib/turns.ts`](../../../../app/src/renderer/src/features/chat/lib/turns.ts) `groupTurns` |
| Task 파생 | [`lib/taskBoard.ts`](../../../../app/src/renderer/src/features/chat/lib/taskBoard.ts) · [`shared/task-tool.ts`](../../../../app/src/shared/task-tool.ts) |

## 2. 적용 후보

우선순위는 격차의 크기 순이고, 채택 여부는 별도 handoff 의 결정이다.

1. **텍스트 강등 규칙.** `messageSegments` 에 "첫 텍스트·마지막 텍스트만 본문, 그 사이의 텍스트와
   모든 사고는 직전 도구 세그먼트의 노트로 흡수" 를 넣는다. 이것만으로 턴이 세 덩어리로 정리되고
   그룹 파편화가 사라진다.
2. **Task 도구 전용 행 라벨.** 도구 렌더 registry 에 task kind 를 더해 `TaskCreate → 작업 추가:
   {subject}`, `TaskUpdate → status 별 문구`. 파서는 `shared/task-tool.ts` 에 이미 있다.
3. **MCP 도구 라벨 폴백.** 도구 이름 대신 서버가 준 설명 문장을 쓴다. cowork 도 영어 혼재를
   그대로 노출한다.
4. **산출물 축.** 파일을 만드는 도구의 결과를 (a) 클릭 가능한 행 (b) 턴 끝 카드 (c) 사이드패널
   `출력` 로 3중 투영한다 — 빈 자리 두 개를 채우는 가장 자연스러운 재료다.

### 구현상 걸림돌

강등 경계는 **턴 단위**인데 `messageSegments` 는 **메시지 단위**다. 한 턴이 텍스트↔도구마다
여러 assistant 메시지로 갈리므로(`groupTurns`), 메시지 안에서만 판단하면 *모든* 메시지의 마지막
텍스트가 결론으로 승격된다. 판정을 턴 층으로 올리거나 "이 메시지가 턴의 마지막인가 · 앞선
메시지에 도구 호출이 있었나" 두 비트를 내려야 한다.

## 3. 이 캡처로 못 가른 것

| 미결 | 왜 못 가르나 | 결정이 필요한 이유 |
|---|---|---|
| 강등이 일어나는 **시점** | 최종 스냅샷 하나로는 스트리밍 중 순서를 볼 수 없다 | 낙관 승격 후 강등 / 낙관 강등 후 승격 중 어느 쪽이냐에 따라 사용자가 보는 화면이 다르다 |
| 도구 행의 **기본 펼침** 여부 | 캡처에서 19행이 전부 펼쳐져 있었다 — 기본값인지 사용자가 연 것인지 구분되지 않는다 | 기본 펼침이면 대화록이 매우 길어진다 |
| 노트 분류의 **DOM 근거** | 사고/텍스트가 같은 클래스·같은 글리프다 — 문체로만 갈랐다 | 자동 분류를 구현하려면 파트 종류를 원천에서 받아야 한다 |

Orca 관점의 판단은 하나만 적어 둔다 — 스트리밍 시점 문제는 **낙관 승격 후 강등**이 append-only
파트 모델에서 단조롭고, "런은 자기가 열린 뒤의 것만 삼킨다"는 형태가 서문 면제를 자동으로 낳는다
([01 문서 §4](01-턴-렌더링-모델.md)).
