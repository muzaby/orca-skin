# Plan — 0004-auto-session-title

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0004-auto-session-title` |
| 작성자 | Claude Code |
| 일자 | 2026-06-10 |
| 매핑 | PHASES "자동 제목 생성 (요약)" Future Scope 행 승격 예정 |
| 상태 | READY |

## Context (왜)

현재 세션 제목은 **첫 user 메시지를 60자로 단순 절단**한 값이다
(`router.ts:455` `previewOf(turn.pendingUserText, 60)`). 메시지가 길거나 코드
덩어리·붙여넣기로 시작하면 제목이 무의미한 앞 60자가 되어, 사이드바 "최근 대화"
목록에서 세션을 식별하기 어렵다.

사용자 결정(2026-06-10 질의):
- **모델 = Haiku 고정** (`claude-haiku-4-5`). 별도 1회 completion. 제목은 짧아
  고성능 모델 불필요, 저비용·고속.
- **시점 = 첫 턴 완료 후 1회**. 첫 user↔assistant 교환이 끝난 직후 한 번만
  생성하고 고정.

요약 제목은 사용자 식별성을 크게 높이면서, Haiku 1-shot 이라 비용·지연 영향이
미미하다.

### nav 표시 타임라인 (옵션 1 — "교체" 방식, 명시)

세션 행 **생성 시점**(`router.ts:451` `session.updated`=claude init, 턴 *초반*)과
제목 **요약 시점**(`telemetry`=턴 *종료*)은 분리돼 있다. 본 작업은 **기존 행을
지우거나 미루지 않고 in-place 로 제목만 교체**한다:

```
첫 메시지 전송
  → (init) insertSession(title = previewOf(프롬프트, 60), title_source='auto')  ← nav 에 즉시 표시
  → assistant 응답 스트리밍
  → (telemetry, 첫 턴 종료) Haiku 1-shot 제목 생성 (fire-and-forget)
  → 브로드캐스트 → nav 행 title 이 요약 제목으로 in-place 교체 (기준 6)
```

→ **사용자는 첫 메시지 직후 잘린-프롬프트 제목으로 행을 즉시 본다**(현행 UX 보존).
요약은 그 위에 덧칠하는 *교체*일 뿐, 신규 등장이 아니다. 생성 실패 시엔 교체가
안 일어나 잘린 제목이 그대로 남는다(기준 4).

> **명시 비범위 (옵션 2 아님)**: "제목 생성 전까지 nav 목록에 추가하지 않는다"는
> 접근은 **채택하지 않는다**. 행 생성을 telemetry 까지 미루면 ① 응답 진행 중인
> 활성 세션이 nav 에서 사라지고, ② 생성 실패 시 행이 영영 안 뜨며, ③ 그 사이
> 도착하는 messages/parts 의 FK 부모가 없어진다. 행은 init 에 즉시 만들고 제목만
> 나중에 교체한다.

## 인수 기준 (Acceptance Criteria)

> verify 가 1:1 로 대조하는 **검증 가능한** 항목.

1. **새 세션 첫 턴 완료 후 제목 자동 생성**: 새 채팅(`sessionId=null`)의 첫
   `telemetry`(턴 종료) 이벤트 처리 직후, 그 세션에 대해 제목 요약이 **정확히
   1회** 트리거된다. resume 경로(기존 `sessionId`)에서는 트리거되지 않는다.

2. **어댑터가 저가 모델을 선택 + 비대화형 1-shot**: 제목 생성은 별도 completion
   이며, **router 는 model 을 강제하지 않는다** — 각 어댑터가 자기 "title 용 저가
   모델"을 내부 default 로 고른다(claude → `claude-haiku-4-5`). 활성 세션을
   **resume 하지 않는다**(컨텍스트·세션 모델 오염 0). 활성 턴의 권한 콜백·MCP·
   skills·hooks 를 주입하지 않는다. 또한 **CLI 내장 도구(Read/Bash 등)가 실행되지
   않도록 단일 턴 제한(`maxTurns: 1` 상당) + 도구 제한 옵션을 명시**한다 —
   콜백을 안 넣는 것만으로는 내장 도구가 차단되지 않는다(정확한 옵션명은 구현 시
   `/claude-api` 로 확인).

   **모델 해석 우선순위(폴백 가드)**: ① `opts.model`(명시 호출) → ② 어댑터의 저가
   모델 default → ③ **저가 모델을 모르거나 환경적으로 못 쓰면 model 옵션을 생략**해
   provider 의 default/현재 실행 모델로 진행한다. 어떤 경우에도 model 미상이
   **제목 생성 실패의 원인이 되지 않는다**(기준 4 graceful degrade 와 결합).

3. **제목 출처 구분 — 사용자 rename 보호**: `sessions` 테이블에 제목 출처 컬럼
   (`title_source`: `'auto' | 'user'`, default `'auto'`)을 도입한다. 자동 요약은
   `title_source != 'user'` 인 세션만 갱신하고, 사용자가 명시적으로 rename 한
   세션(`handleSessionRename`)은 `title_source='user'` 로 표기되어 **자동 요약이
   절대 덮어쓰지 않는다**.

4. **생성 실패 시 graceful degrade**: 제목 요약 호출이 실패/타임아웃/빈 응답이면
   기존 `previewOf` 절단 제목을 그대로 유지하고, 에러는 `console.warn` 로깅에
   그친다(턴 결과·채팅 흐름에 영향 0). 채팅 `error` 이벤트로 surface 하지 않는다.

5. **생성 제목 정규화**: 생성된 제목은 trim + 개행/연속공백 정규화 + 최대 60자
   절단 + 양끝 따옴표 제거. 빈 문자열이면 갱신하지 않는다(기준 4 로 폴백).

6. **renderer 라이브 반영**: 생성된 제목이 main→renderer 브로드캐스트로 전달되어,
   별도 새로고침 없이 ① 사이드바 "최근 대화" 행과 ② 현재 활성 세션 헤더 title 이
   갱신된다. `cost:summaryEvent` 와 동형의 전-창 push 패턴을 따른다.

7. **순수 로직 단위 테스트**: 제목 정규화 함수(기준 5)와 "생성해야 하는가" 판정
   (기준 1·3: 새 세션 여부 × title_source × 1회 가드)을 electron 비의존 순수
   함수로 분리하고 vitest 케이스를 추가한다.

8. **DB 쿼리 단위 테스트**: `updateSessionTitleAuto`(user 보호 조건 포함)·
   `getTitleSource`·`renameSession`(`title_source='user'` set) 을 기존
   `queries.test.ts` 선례(better-sqlite3 `:memory:` + 마이그레이션 적용)대로
   vitest 케이스로 검증한다 — GUI 수동 검증으로 갈음하지 않는다.

9. **IPC 계약·게이트**: 신규 채널은 `docs/IPC_CONTRACT.md` 에 동시 반영(총 채널 수
   37→38 갱신). `docs/AGENTS.md` 문서 인벤토리의 IPC_CONTRACT 행에 남은 stale
   채널 수("총 33 채널")도 함께 정정한다. `cd app && npm run lint && npm run
   typecheck && npm test` 전부 통과.

## 범위 / 비범위

- **범위**: 새 세션 첫 턴 후 Haiku 1-shot 제목 요약, `title_source` 컬럼 +
  마이그레이션, 자동/수동 제목 충돌 방지, 생성 제목의 renderer 라이브 반영, 순수
  함수·DB 쿼리 단위 테스트.
- **비범위**:
  - 초반 N턴 재생성·주제 변화 추적(사용자가 "1회"로 결정 — 명시 비범위).
  - 기존 세션 백필(정식 배포 전이라 과거 dev 행 불필요 — `0004_message_parts`
    선례와 동일 원칙).
  - 사용자 설정 토글(자동 제목 on/off)·모델 선택 UI(후속 가능, 본 작업은 고정).
  - opencode 어댑터의 `complete()` *구현*(claude-only; 단 seam·router 는 provider
    중립이라 opencode 도입 시 `complete()` 만 구현하면 동일 트리거에 붙는다 — A안).
    opencode `session.summarize` 는 컨텍스트 compaction(claude `/compact` 류)이라
    제목 생성과 무관 → opencode 도 동일하게 저가 모델 1-shot 으로 처리.
  - **알려진 엣지(의도된 수용)**: 첫 턴이 `telemetry` 도달 전에 에러로 끝나면 그
    세션의 제목 생성 기회는 영구 소실된다(이후 턴은 resume 경로라 기준 1 에서
    제외). 절단 제목이 유지되므로 기준 4 의 degrade 방향과 동일 — 재시도 로직을
    추가하지 않는다.

## 설계

### 접근

1. **어댑터 seam — 비대화형 1-shot completion (provider 중립)**: `SessionAdapter`
   에 `complete(opts: { prompt: string; model?: string; cwd?: string; signal?:
   AbortSignal }): Promise<string>` 를 추가한다. **`model` 은 optional** — router
   는 넘기지 않고, 각 어댑터가 자기 "title 용 저가 모델"을 내부 default 로
   결정한다("저가 모델" 지식을 어댑터에 캡슐화 → opencode 어댑터도 `complete()` 만
   구현하면 router 변경 없이 동일 트리거에 붙는다). claude 구현은 기존 `query()`
   를 **string prompt + `model: model ?? 'claude-haiku-4-5'`** 로 호출하되
   `resume`·`canUseTool`·MCP·skills·hooks 를 **주입하지 않고**, **단일 턴 제한
   (`maxTurns: 1` 상당) + 도구 제한**으로 내장 도구 실행을 차단한 뒤, `assistant`
   메시지의 첫 text 블록을 모아 result 까지 소비한 뒤 반환한다(스트리밍 입력 모드
   불필요 — 단발성). LiveTurn 경로와 분리해 기존 `sendMessage` 불변식에 영향 0.
   - 재사용: `query`(`@anthropic-ai/claude-agent-sdk`), `claudeToNormalized` 는
     쓰지 않고 SDK 메시지에서 text 만 직접 추출(경량).
   - **cwd**: 어댑터에 defaultCwd 류 상태는 **없다**(cwd 는 턴마다 `req.cwd` 로
     받는 구조). `complete` 는 `opts.cwd` 를 받아 그대로 SDK 에 넘기고, **미지정이면
     `cwd` 키를 생략**해 SDK default 로 진행한다. router 는 해당 턴에 사용한 cwd 를
     `InflightTurn` 에 보관해 넘긴다(없으면 생략).
   - **HAIKU 상수 위치**: 저가 모델 ID 는 router 가 아니라 claude 어댑터 모듈
     상수로 둔다(provider 중립 router 유지).
   - **모델 폴백(기준 2)**: 어댑터가 저가 모델 ID 를 **해석할 수 없거나**(상수
     미정·환경변수 미설정 등) 해당 모델 사용이 제약되면, `query()` 옵션에서
     `model` 키를 **생략**해 provider default/현재 모델로 진행한다. `model: undefined`
     를 명시하는 것과 키 자체를 빼는 것이 SDK 상 동치인지 `/claude-api` 로
     확인하되, 안전하게 **키 생략** 경로를 택한다. model 미상으로 인한 throw 금지.

2. **트리거 — `telemetry` case 종료부**: `router.persist` 의 `case 'telemetry'`
   끝(턴 종료, `router.ts:587` reset 직전/직후)에서, "새 세션 첫 턴" 판정이 참이면
   **fire-and-forget** 비동기로 제목 생성을 킥한다(턴 응답 흐름을 블록하지 않음).
   - "첫 턴" 판정: 이 턴이 새 채팅이었는지(`turn.pendingProjectId !== undefined`
     로는 부족 → 진입 시 `turn.isNewSession = (parsed.data.sessionId == null)`
     플래그를 `InflightTurn` 에 기록) + 제목 생성 1회 가드.
   - 제목 소스 텍스트: 첫 user 메시지 = `handleChatSend` 진입 시 보관한
     `parsed.data.text`(이미 `turn.pendingUserText` 로 흐르나 init 후 null 화되므로
     별도 `turn.firstUserText` 에 보존).

3. **생성 + 영속 + 브로드캐스트** (`generateTitle` private 메서드):
   - 가드: `db.getTitleSource(sessionId) !== 'user'` (사용자 rename 우선).
   - `adapter.complete({ prompt: titlePrompt(firstUserText), cwd, signal })` —
     **model 은 넘기지 않는다**(어댑터 내부 default 가 저가 모델 선택, 설계 1).
     `signal` 은 타임아웃 가드(예: `AbortSignal.timeout` 류)로 묶어 행잉 방지
     (기준 4).
   - 응답 → `normalizeTitle()` (순수, 기준 5). 빈 값이면 종료(폴백).
   - `db.updateSessionTitleAuto(sessionId, title)` — `title_source != 'user'`
     조건부 UPDATE + `title_source='auto'` set.
   - 전-창 브로드캐스트 `CHANNELS.sessionTitleEvent`(`{ sessionId, title }`).

4. **DB — `0007_title_source.sql`**:
   ```sql
   ALTER TABLE sessions ADD COLUMN title_source TEXT NOT NULL DEFAULT 'auto';
   ```
   - `DbQueries`: `getTitleSource(id): 'auto'|'user'|null`,
     `updateSessionTitleAuto(id, title)`(`WHERE id=? AND title_source!='user'`,
     `title_source='auto'`), `renameSession` 을 `title_source='user'` set 으로
     확장. `SessionInsert`/`insertSession` 은 default 'auto' 라 무변경.
   - **머지된 마이그레이션 수정 금지** → 신규 `0007_` 파일.

5. **renderer 반영**:
   - preload: `orca.onSessionTitle(cb)` 구독 노출(기존 `onCostSummary` 패턴).
   - `useSessions`: 이벤트 수신 시 목록 refresh(또는 해당 행 patch).
   - `useChat`: 활성 세션(`state.sessionId === ev.sessionId`)이면
     `dispatch({ type: 'RENAME_SESSION', ... })` + 캐시 title 동기화(기존
     `renameSession` 로직 재사용 — 단 DB flush 는 하지 않음. 이미 main 이 영속).

### 레이어 경계 준수

- main 전용(어댑터·router·db·tracker)·shared(채널·타입)·renderer(preload 구독 +
  features/chat·features/sessions hook). 새 cross-feature import 없음.
- 순수 함수(`normalizeTitle`, `titlePrompt`, "should generate" 판정)는 main 측
  유틸 모듈(`src/main/title/` 신설 또는 `adapters` 인접)에 두고 vitest 대상.

## 영향 받는 파일

- `app/src/main/db/migrations/0007_title_source.sql` (신규)
- `app/src/main/db/queries.ts` — `getTitleSource`·`updateSessionTitleAuto`·
  `renameSession` 확장 + prepared statements
- `app/src/main/db/queries.test.ts` — 신규 쿼리 3종 케이스(기준 8)
- `app/src/main/db/types.ts` — 필요 시 row 타입
- `app/src/main/adapters/types.ts` — `SessionAdapter.complete` 추가
- `app/src/main/adapters/claude-code.ts` — `complete()` 구현
- `app/src/main/adapters/mock.ts` — `complete()` 스텁(결정적 더미 제목 반환 —
  디버그 패널 시나리오에서 식별 용이)
- `app/src/main/title/title.ts` (신규) — `normalizeTitle`·`titlePrompt`·
  `shouldGenerateTitle` 순수 함수
- `app/src/main/title/title.test.ts` (신규) — vitest
- `app/src/main/ipc/router.ts` — `InflightTurn.{isNewSession,firstUserText,cwd}` +
  `telemetry` case 트리거 + `generateTitle` + 브로드캐스트 + `handleSessionRename`
  의 `title_source='user'` 경유
- `app/src/shared/ipc.ts` — `CHANNELS.sessionTitleEvent` + 페이로드 타입
- `app/src/preload/index.ts` (+ `index.d.ts`) — `orca.onSessionTitle`
- `app/src/renderer/src/.../sessionApi` 또는 chat api — 구독 배선
- `app/src/renderer/src/features/sessions/hooks/useSessions.ts` — 이벤트 → refresh
- `app/src/renderer/src/features/chat/hooks/useChat.ts` — 활성 세션 title 반영
- `docs/IPC_CONTRACT.md` — 신규 채널 + 총 채널 수(37→38)
- `docs/AGENTS.md` — 문서 인벤토리 IPC_CONTRACT 행의 stale 채널 수 정정(기준 9)

## 참고 문서

- `docs/TRD.md §7.1`(어댑터 외부 계약)
- `docs/arch/backend/provider-runtime.md`(SessionAdapter·NormalizedEvent·
  Telemetry §8)
- `docs/arch/backend/persistence.md`(마이그레이션 규약·`sessions` 스키마)
- `docs/IPC_CONTRACT.md`(§6 변경 절차 — **반드시 동시 갱신**)
- 모델 ID(`claude-haiku-4-5`)·query 옵션(`model`·단일 턴 제한·도구 제한)은
  `/claude-api` 스킬(claude-api 레퍼런스)로 교차 확인 후 구현.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구:
  - `title.test.ts` — `normalizeTitle`(따옴표 제거·공백 정규화·60자 절단·빈 값)
    3~5 케이스, `shouldGenerateTitle`(새 세션 × title_source × 1회 가드) 3~4
    케이스.
  - `queries.test.ts` — `updateSessionTitleAuto`(auto 행 갱신 ○ / user 행 갱신 ×)·
    `getTitleSource`·`renameSession` 후 `title_source='user'` 케이스. 기존
    `queries.test.ts` 의 better-sqlite3 `:memory:` + 마이그레이션 선례 그대로
    (vitest 에서 정상 구동 확인됨 — GUI 수동 검증 갈음 불가).

## 열린 항목 (구현 전 합의 불요 — 기본값 채택)

- 제목 언어: 첫 user 메시지 언어를 따르도록 프롬프트 지시(한국어 입력→한국어
  제목). 길이 ≤ 60자, 따옴표·마침표 없이.
- Haiku 모델 ID 핀: `claude-haiku-4-5` (claude 어댑터 내부 default). 구현 시
  `/claude-api` 로 현행 최신 Haiku ID 재확인(레퍼런스가 다르면 그쪽 우선, plan 의
  가정보다 사실이 우선).

---

## [Codex 기입] 구현 체크리스트

- [x] `0007_title_source.sql` 마이그레이션 + queries 3종 + `queries.test.ts` 케이스
- [x] `SessionAdapter.complete` 인터페이스 + claude/mock 구현(단일 턴·도구 제한 포함)
- [x] `src/main/title/` 순수 함수 + vitest
- [x] router `telemetry` 트리거 + `generateTitle` + 브로드캐스트
- [x] `handleSessionRename` → `title_source='user'`
- [x] shared 채널 + preload 구독 + renderer(useSessions/useChat) 반영
- [x] `IPC_CONTRACT.md`(37→38) + `docs/AGENTS.md` stale 채널 수 정정
- [x] 게이트 통과 (lint / typecheck / test)

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/db/**`, `app/src/main/title/**`, `app/src/main/adapters/**`, `app/src/main/ipc/router.ts`, `app/src/shared/{ipc,protocol}.ts`, `app/src/preload/**`, `app/src/renderer/src/shared/api/ipc.ts`, `app/src/renderer/src/features/{sessions,chat}/hooks/**`, `docs/IPC_CONTRACT.md`, `docs/AGENTS.md` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint PASS / typecheck PASS / test PASS (283 tests) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | 4e7ae11 |
