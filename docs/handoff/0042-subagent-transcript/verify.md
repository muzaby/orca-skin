# Verify — 0042-subagent-transcript

## 메타

| 항목 | 값 |
|---|---|
| slug | `0042-subagent-transcript` |
| 검증자 | Claude Code |
| 일자 | 2026-06-25 |
| 대상 커밋 | `383f3c1`·`0ea6dff`·`bf8b6a5`(0042 코드) — HEAD `a674588` (INDEX 기재 Codex env `47d9206` 미도달 = 위생 노트 ①) |
| 라운드 | 1 |
| 상태 | PASS |

## 요구사항 충족 매트릭스

> plan 의 인수 기준(Part A 1~5 · Part B 6~10)을 1:1 로 대조. 증거는 현재 브랜치 코드(`파일:라인`) + 게이트 출력.

### Part A — 백엔드 데이터모델

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | claude-map 가 `parent_tool_use_id` 캡처 → `tool.call.started/completed` 에 `parentToolRunId`, 최상위는 생략 | ✅ | `adapters/claude-map.ts:131` `readParentToolRunId`(빈문자/공백 → undefined), assistant tool_use `:266`·user tool_result `:293` 에 `...(parentToolRunId !== undefined ? { parentToolRunId } : {})`. 테스트 `claude-map.test.ts` "parentToolRunId 가 있는 child 도구는 메인 도구 목록에서 제외" |
| 2 | `tool_call`/`tool_result` AppMessagePart 에 동일 필드 추가 + persist/복원 보존(무회귀) | ✅ | `shared/ipc.ts:715·723` AppMessagePart optional `parentToolRunId`. persist `ipc/chat/persist.ts`(payload spread 보존), 복원 `lib/parts.ts:86·99·147·160`(`partFromRow` payload spread). 필드 부재 시 기존 평면 렌더 동일 |
| 3 | reducer 가 부모 Task `toolRunId` 키잉 child 로 분기, 메인에 child 평면 혼입 안 됨 | ✅ | `lib/parts.ts:168` `childMessageForParentToolRunId`, `:189` `subagentTasksFromMessages`(`:197` 최상위만 카운트·`:206` child 카운트 분리), `messageSegments`/`partsToolCalls` 가 `parentToolRunId` 보유 파트를 메인에서 제외(`:416` `if (p.parentToolRunId !== undefined) continue`) |
| 4 | IPC_CONTRACT §3·§6 동기화 | ✅ | `docs/IPC_CONTRACT.md:288·289`(`tool.call.started/completed` parentToolRunId 행), `:285`(message.completed) |
| 5 | claude-map 매핑 + reducer child 분기 단위테스트 | ✅ | `claude-map.test.ts`·`parts.test.ts`("parentToolRunId 가 있는 child 도구…" 등) — 5파일 83 테스트 green |

### Part B — 렌더러 UI

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 6 | Task 전용 카드(`agent_task` kind) + 진행/완료 구분 | ✅ | `transcript/registry.ts` `agent_task` 등록·`AgentTaskRow.tsx`(0043 에서 전담 행으로 진화), `shared/ipc.ts:74` `'subagent_task'` kind. 진행/완료 구분 `AgentTaskRow.tsx:44` |
| 7 | 중단 카드(`turn.aborted`/incomplete/도구 에러) 상태 시각 구분 | ✅ | `AgentTaskRow.tsx:14` `PREFIX`(running/completed/aborted/failed)·`:53` `isBad`·`:87` `text-bad`. mock `subagent_task_aborted`(`MOCK_SCENARIO_IDS`) |
| 8 | 우측 패널 child 트랜스크립트(메인 컴포넌트 재사용) + 펼침→타일 활성화 | ✅ | `rightpanel/SubAgentTileContent.tsx`(`childMessageForParentToolRunId` → 메인 `AssistantMessage`/`ToolGroup`/`ToolCard` 재사용), 활성화 `AgentTaskRow.tsx:70` `chatActions.openSubagentTask`, store `chatStore.ts setRightPanelTileActive` |
| 9 | 뒤로가기 리스트 ↔ 상세 2-뷰 | ✅ | `SubAgentTileContent.tsx`(카드 목록 ↔ 선택 Task 상세, `:163` role=button 카드·뒤로가기 네비) |
| 10 | 서브에이전트 없는 턴 무회귀 + 우측 패널(0034) 무회귀 + 게이트 | ✅ | `parentToolRunId` 부재 시 기존 경로 동일(기준 2·3). lint(boundaries 0)·typecheck·test green(아래) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | PASS (502/502 실행분, 아래) |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 첨부 | 이견 시 중재 | 10/10 충족 |
| 레이어 경계 위반 0 | ✅ | — | lint green(boundaries) |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT 동기화 |
| 제품 의도 부합(이미지 6~8) | ✖ 보조 | ✅ 결정 | 사람 확인 대기 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ npm run typecheck   # node + web + test
✅ tsc --noEmit (3 프로젝트) 통과

$ npm run lint        # eslint (boundaries 포함)
✅ 통과 (레이어 경계 위반 0)

$ npm test            # vitest run (better-sqlite3 Node ABI 재빌드 후)
Test Files  2 failed | 67 passed (69)
     Tests  502 passed (502)
```

- **502/502 통과.** 2개 실패 *파일*(`ipc/chat/persist.test.ts`·`ipc/chat/send.runtime-resilience.test.ts`)은 **모듈 import 단계**에서 `electron` 바이너리 미설치(`getElectronPath` throw)로 차단 — 네트워크로 electron 바이너리 다운로드가 막힌 환경 제한이며 0019 계열과 동형. 테스트 본문 미실행이지 단언 실패 아님. 서브에이전트 영속 로직은 `subagent-settlement.test.ts`·`parts.test.ts`·`claude-map.test.ts`(83 green)가 별도 커버.
- 1차 실행 시 `db/queries.test.ts` 12-red 는 better-sqlite3 dual-ABI(`Module did not self-register`) — `npm rebuild better-sqlite3`(Node ABI) 후 green. 0019 계열, 변경 무관.

## 위생 검토

- AGENTS.md 변경 없음(문서 변경 = `docs/IPC_CONTRACT.md` 한정). 키/토큰/이메일/IP 패턴 스캔 결과 0.
- `git diff --check` clean(공백/충돌 마커 0), 대상 파일 console.log/debugger/FIXME 0, 작업 트리 clean.
- IPC 채널 수: 코드 `CHANNELS` 50 = `IPC_CONTRACT.md` "총 50 채널" 일치.

## PHASES.md 정합성

- 페이즈 표에 "서브에이전트 transcript (handoff `0042-subagent-transcript`)" 행 승격(커밋 `a674588`).

## 결론 / 다음 단계

- **상태: PASS** → PHASES 승격. 다음=—(종료).
- 사람 확인 대기: 이미지 6~8 양식 시각 검증·우측 패널 child 트랜스크립트 실기·실환경 `parent_tool_use_id` 캡처(후속 0043/0044 가 양식·메타 보강).
