# Plan — 0005-title-completion-fixes

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0005-title-completion-fixes` |
| 작성자 | Claude Code |
| 일자 | 2026-06-10 |
| 매핑 | 0004-auto-session-title 후속 버그수정 (PHASES 행 없음 — 0004 행에 귀속) |
| 상태 | READY |
| 구현 주체 | **Claude** (비기능 작업 — 구현 주체 분담 규칙 첫 적용, `../AGENTS.md` 참조) |

## Context (왜)

0004-auto-session-title 구현(커밋 `ba36b8d`)에 대한 사용자 피드백 3건의 반영:

1. **지정 모델 미사용** — `CLAUDE_TITLE_MODEL = 'claude-haiku-4-5'` 는 *API* 별칭이라 Claude Code CLI 가 해석하지 못한다. CLI 원문 미러(`docs/spec/claude/cli-reference.md` `--model` 행) 기준 허용값은 *별칭(`haiku`/`sonnet`/`opus`) 또는 전체 모델명*. 게다가 `isLikelyModelSelectionError` regex 폴백(`/model|haiku|not found|unknown|invalid/i`)이 조용히 model 없이 재시도해 오설정이 은폐됐다.
2. **지정 환경변수 미사용** — `runCompletion()` 의 `settingSources: []` 가 사용자/프로젝트/로컬 settings 로드를 차단해 settings 의 env 가 title completion 서브프로세스에 적용되지 않았다. SDK 원문 미러(`docs/spec/claude/agent-sdk/typescript.md` `settingSources` 행) 기준 기본값은 "모든 소스 로드"이고, `sendMessage` 경로는 이 필드를 명시하지 않는다.
3. **호출 경로 비정제** — `complete()` 가 model 을 `CompleteRequest.model` 필드 대신 별도 두 번째 위치 인자(side-channel)로 `runCompletion(req, model)` 에 전달. `sendMessage` 의 "단일 요청 객체 → 단일 query" 패턴과 비교해 비정제.

사용자 결정(2026-06-10):
- 모델 상수는 **`'haiku'`** 로 변경.
- `settingSources` 필드는 **제거** (SDK 기본 동작 사용).
- 폴백은 **유지하되 regex 분류 제거**: 1차 `'haiku'` 시도 → 비-abort 실패 시 model 생략으로 1회 재시도해 provider default 모델에 이관. 첫 실패는 `console.warn` 로깅(은폐 방지).
- 본 건 같은 **리팩토링·버그수정은 Claude 가 핸드오프 문서를 만들어 직접 구현**한다 (신규 워크플로우 규칙 — 루트 `AGENTS.md`·`docs/handoff/AGENTS.md`·`docs/git-template.md` 에 동시 반영).

## 인수 기준 (Acceptance Criteria)

1. `CLAUDE_TITLE_MODEL === 'haiku'` (CLI 가 해석하는 별칭).
2. `runCompletion` 의 `Options` 에 `settingSources` 키 부재 (SDK 기본 = 모든 소스 로드, `sendMessage` 와 정합).
3. model 전달이 `CompleteRequest.model` 단일 채널 — `runCompletion` 은 `(req: CompleteRequest)` 단일 인자만 받는다.
4. 재시도 경로: 1차 `req.model ?? 'haiku'` → 비-abort 실패 시 `console.warn` 로깅 후 model 생략 1회 재시도(default 모델 이관). `isLikelyModelSelectionError` 함수 삭제. abort 시에는 재시도 없이 throw(기존 graceful degrade 는 router 책임 유지).
5. 구현 주체 분담 규칙(기능=Codex / 리팩토링·버그수정=Claude)이 루트 `AGENTS.md` "협업 워크플로우", `docs/handoff/AGENTS.md` 역할 표, `docs/git-template.md` 작성 규칙에 반영.
6. 게이트 통과: `cd app && npm run lint && npm run typecheck && npm test`.

## 범위 / 비범위

- **범위**: `claude-code.ts` 의 `complete`/`runCompletion` 경로 정리 + 워크플로우 규칙 문서화.
- **비범위**: 0004 의 나머지 구현(DB 쿼리·title 순수 함수·renderer 구독 — 품질 검토 결과 양호, 무변경). router 의 `generateTitle` 트리거·타임아웃(무변경). opencode 어댑터.

## 설계

- `complete(req)`: `{ ...req, model: req.model ?? CLAUDE_TITLE_MODEL }` 로 1차 시도 → catch 에서 `req.signal?.aborted` 면 rethrow, 아니면 warn 로깅 + `{ ...req, model: undefined }` 로 재시도.
- `runCompletion(req)`: options 는 `...(req.model ? { model: req.model } : {})`. `settingSources` 줄 삭제. 나머지(`maxTurns: 1`·`tools: []`·`allowedTools: []`·`persistSession: false`·cwd·abortController) 유지.
- 재사용: 기존 abort 배선·`assistantText()` 그대로.

## 영향 받는 파일

- `app/src/main/adapters/claude-code.ts` (유일한 코드 변경)
- `AGENTS.md`(루트) · `docs/handoff/AGENTS.md` · `docs/git-template.md` (규칙)
- `docs/handoff/INDEX.md` (행 추가)

## 참고 문서

- `docs/spec/claude/cli-reference.md` (`--model` 허용값)
- `docs/spec/claude/agent-sdk/typescript.md` (`settingSources` 기본값)
- `docs/handoff/0004-auto-session-title/plan.md` (기준 2 모델 폴백 가드 — 본 작업으로 구체화)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 없음 — `complete` 경로는 SDK `query()` 의존(electron/SDK 비의존 순수 로직 아님). 순수 로직(`title.ts`)은 0004 테스트가 커버.

---

## [Claude 기입] 구현 체크리스트

- [x] `CLAUDE_TITLE_MODEL = 'haiku'`
- [x] `settingSources: []` 제거
- [x] `runCompletion(req)` 단일 인자화 + `isLikelyModelSelectionError` 삭제 + 재시도 = 비-abort 실패 1회(warn 로깅)
- [x] 워크플로우 규칙 3개 문서 반영
- [x] 게이트 통과 (lint / typecheck / test)

## [Claude 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/main/adapters/claude-code.ts`, `AGENTS.md`, `docs/handoff/AGENTS.md`, `docs/git-template.md`, `docs/handoff/{INDEX.md,0005-title-completion-fixes/**}` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (283 passed) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | `c13bd44` |
