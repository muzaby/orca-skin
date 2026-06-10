# Verify — 0004-auto-session-title

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0004-auto-session-title` |
| 검증자 | Claude Code |
| 일자 | 2026-06-10 |
| 대상 커밋 | `ba36b8d` (위생 노트 ① 참조) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 새 세션 첫 턴 완료 후 정확히 1회 트리거, resume 제외 | ✅ | `router.ts:604` — `case 'telemetry'` 종료부에서 `maybeStartTitleGeneration` 호출. `router.ts:284` `isNewSession = (parsed.data.sessionId == null)` 로 resume 배제, `router.ts:87·286·627` `titleGenerationStarted` 1회 가드. 판정 순수함수 `title.ts:37` `shouldGenerateTitle` + `title.test.ts:26-89` (새 세션○ / resume× / 재진입× / user rename× / sessionId 미발급× / 빈 입력×) |
| 2 | 어댑터가 저가 모델 내부 default + 비대화형 1-shot(단일 턴·도구 제한·resume/콜백 미주입) + 모델 폴백 | ✅ | `claude-code.ts:41` `CLAUDE_TITLE_MODEL='claude-haiku-4-5'` (모델 ID 는 claude-api 레퍼런스로 현행 유효 교차확인). `claude-code.ts:144-151` `complete()` — `req.model ?? CLAUDE_TITLE_MODEL`, 모델 선택성 오류 시 model 키 생략 재시도(`isLikelyModelSelectionError`) → model 미상이 실패 원인이 되지 않음. `claude-code.ts:160-168` options = `maxTurns: 1` + `tools: []` + `allowedTools: []` + `settingSources: []` + `persistSession: false`, `resume`/`canUseTool`/MCP/skills/hooks 미주입 (옵션명은 설치 SDK `sdk.d.ts` 의 `Options` 필드로 확인 — `tools`:46 · `maxTurns`:75 · `allowedTools`:1211 · `persistSession`:1376 · `settingSources`:1698). router 는 model 을 넘기지 않음(`router.ts:646-650`). mock 스텁 `mock.ts` `complete() → 'Mock 자동 제목'` (결정적) |
| 3 | `title_source` 컬럼 + 사용자 rename 보호 | ✅ | `0007_title_source.sql` (`TEXT NOT NULL DEFAULT 'auto'`, 신규 파일 — 머지된 마이그레이션 무수정), `migrate.ts` 등록. `queries.ts:121-124` `updateSessionTitleAuto` = `WHERE … AND title_source != 'user'` + `title_source='auto'` set. `queries.ts:161-164` `renameSession` 이 `title_source='user'` set. 이중 가드: `router.ts:645` complete 호출 전 `getTitleSource === 'user'` 재확인 |
| 4 | 생성 실패 시 graceful degrade | ✅ | `router.ts:642-643` 30s `AbortController` 타임아웃, `router.ts:655` catch → `console.warn('[session-title] …')` 만 — 채팅 `error` 이벤트 미발행, 절단 제목 유지. 빈 응답은 `normalizeTitle → null` 로 조기 종료(`router.ts:652-653`) |
| 5 | 생성 제목 정규화 | ✅ | `title.ts:28-35` `normalizeTitle` — 공백/개행 정규화 + trim + 대칭 따옴표 9쌍 제거 + 말미 마침표 제거 + 60자 절단 + 빈 값 `null`. `title.test.ts:4-18` 케이스 3종 |
| 6 | renderer 라이브 반영 (전-창 push) | ✅ | `router.ts:239-243` `broadcastSessionTitle` — `webContents.getAllWebContents()` 루프(`cost:summaryEvent` 동형). `ipc.ts:24` `CHANNELS.sessionTitleEvent` + `:89` 페이로드 타입. `preload/index.ts:76-80` `orca.session.onTitle` 구독/해제. ① 사이드바: `useSessions.ts:38-42` 행 in-place patch. ② 활성 세션 헤더: `useChat.ts:159-165` 캐시 title 동기화 + `RENAME_SESSION` dispatch (DB flush 없음 — main 이 이미 영속) |
| 7 | 순수 로직 단위 테스트 | ✅ | `src/main/title/title.ts` (electron 비의존 순수 모듈) + `title.test.ts` — normalizeTitle 3 · titlePrompt 1 · shouldGenerateTitle 3 블록(케이스 6) |
| 8 | DB 쿼리 단위 테스트 | ✅ | `queries.test.ts:204-258` — better-sqlite3 `:memory:` + 0001~0007 마이그레이션 선례 그대로. `getTitleSource`(기본 auto/미존재 null) · `updateSessionTitleAuto`(auto 행 갱신○/user 행 보호×) · `renameSession`(`title_source='user'` set) 3 케이스 |
| 9 | IPC 계약·게이트 | ✅ | `IPC_CONTRACT.md` §2 총 37→38 + §2.7 `orca:session:titleEvent` 행 + `rename` 행에 `title_source='user'` 명기 (session 5→6). 실측: `CHANNELS` 상수 38개 == 문서 38. `docs/AGENTS.md` 인벤토리의 stale "총 33 채널" → 38 정정. 게이트 전부 통과(아래) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 전부 통과 (아래 출력) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 9/9 충족 (위 매트릭스) |
| 레이어 경계 위반 0 | ✅ | — | `npm run lint`(boundaries 포함) 통과. renderer 변경은 preload 구독 + features/sessions·features/chat hook 내부 — cross-feature import 없음 |
| 문서 형식/링크/한국어 | ✅ | — | IPC_CONTRACT §2/§2.7·docs/AGENTS.md 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 패턴 매치 0 (handoff 0004·title/·claude-code.ts) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 — 단 사용자 결정(Haiku 고정·첫 턴 1회·옵션 1 교체 방식)은 plan 에 명시돼 있고 구현이 그대로 따름 |
| Open Questions | ✖ | ✅ | 해당 없음 — PRD §11/TRD §15 미정 항목 비접촉 |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 — 첫 턴 후 사이드바 행·활성 헤더 제목이 새로고침 없이 교체되는지 GUI 수동 확인 (mock 어댑터 `'Mock 자동 제목'` 으로 디버그 패널 검증 가능) |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 |

## 게이트 재실행 결과

```
$ cd app && npm run lint && npm run typecheck && npm test
lint      : PASS (eslint --cache --fix, boundaries 포함 — 위반 0)
typecheck : PASS (tsc --noEmit, node + web 양쪽)
test      : PASS — Test Files 41 passed (41) / Tests 283 passed (283)
```

> 검증 환경 노트: 최초 실행에서 better-sqlite3 7건 실패는 검증 컨테이너의 Node ABI 불일치
> (`NODE_MODULE_VERSION 140 vs 127`) — 구현 결함 아님. `npm rebuild better-sqlite3` 후 283/283 통과.
> Codex 보고(283 PASS)와 일치.

## 위생 검토

- 키/토큰/이메일/IP 패턴 스캔: 매치 0.
- **① 대상 커밋 해시 불일치**: plan/INDEX 기재 `9c4f1a1` 은 이 저장소에 존재하지 않는 해시(Codex 로컬 환경의 rebase 전 해시로 추정 — 0002 `4213cad`·0003 `78f1601` 과 동일 패턴). 실 구현 커밋은 `ba36b8d` (`app/**` 458 insertions 포함). INDEX 의 대상 커밋을 `ba36b8d` 로 정정.
- **② 구현 커밋 type 표기**: `ba36b8d` 제목이 `docs(handoff): …` 이나 실제로는 전체 기능 구현을 담음 — 규약상 `feat(session): …` 가 적절했다. trailer(`Agent: codex`·`Status: implemented`·`Criteria-Met: 9/9`·`Verified-By: pending`)는 규약 준수. 차회 구현 커밋부터 type 정합 권고 (기능 영향 없음 — 노트만).
- plan 대비 미세 일탈 없음 — 모델 폴백을 "정적 키 생략" 대신 "실패 시 키 생략 재시도" 로 구현했으나 기준 2 의 요지(model 미상이 실패 원인이 되지 않음)를 동일하게 충족.

## PHASES.md 정합성

- 페이즈 표에 "세션 자동 제목 생성" 행 승격 (커밋 `ba36b8d`).
- Future Scope 의 "자동 제목 생성 (요약)" 항목 제거.
- INDEX.md `0004` 행: `verify/PASS`, 다음 주체 `—`, 대상 커밋 `ba36b8d` 정정 + 위생 노트 ①.

## 결론 / 다음 단계

- **상태: PASS** — 인수 기준 9/9 충족, 게이트 3종 통과, 레이어 경계 위반 0, 신규 의존성 0.
- PHASES 표 승격 완료. PR 은 사용자 명시 요청 시에만 생성.
- 사람 잔여 확인: UI/UX 시각 검증(첫 턴 후 제목 라이브 교체) + 제품 의도 최종 판단.
