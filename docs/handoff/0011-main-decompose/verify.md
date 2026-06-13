# Verify — 0011-main-decompose (PASS r1)

> 검증자: Claude Code · 일자: 2026-06-11 · 대상 커밋: `5e835f7`

## 요구사항 충족 매트릭스

| # | 인수 기준 | 판정 | 증거 |
|---|---|---|---|
| 1 | router.ts 컴포지션 루트화 (≤250줄) | ✅ | `app/src/main/ipc/router.ts` 139줄 — 의존성 생성·부팅·등록 위임만 |
| 2 | 도메인 핸들러 분리 + 현행 검증·실패 동작 보존 | ✅ | `ipc/handlers/{session,project,mcp,misc}.ts` — safeParse 폴백/`.parse` reject 패턴 원형 유지 (각 파일 주석 명시) |
| 3 | chat 파이프라인 분리 | ✅ | `ipc/chat/{turn-registry,send,persist,title-generation,approvals}.ts` |
| 4 | TurnRegistry sessionId 키잉 + pending 승격 + 동시 턴 허용 + 중복 거부 | ✅ | `turn-registry.ts` (bySession + pendingByOwner + promote/finish), `send.ts` duplicate 가드 + 루프 내 `session.updated` 승격 |
| 5 | cancel/setMode 세션 키 조회 · respond approvalId→턴 매핑, 와이어 무변경 | ✅ | `send.ts` handleChatCancel, `approvals.ts` turnsByApproval + makeSetModeHandler. `shared/{ipc,protocol}.ts` diff 0 |
| 6 | getSessionById 추가 + N+1 교체 2곳 | ✅ | `db/queries.ts` getSessionByIdStmt, `send.ts` resolveTurnAgent, `handlers/session.ts` sessionLoad. `listSessions(1000)` 잔존 0 (grep) |
| 7 | closeDb will-quit 와이어 | ✅ | `main/index.ts` `app.on('will-quit')` |
| 8 | crypto 이동 — config→mcp import 0 | ✅ | `config/crypto.ts` (git rename), `secret-store.ts` 상대 import. `grep "mcp/" src/main/config` 0건 |
| 9 | 레거시 이전 삭제 + 부팅 단순화 | ✅ | `mcp/migrate.ts`·`config/migrate-sources.{ts,test.ts}` 삭제, `router.start()` 에서 호출 2건 제거 |
| 10 | turn-registry 단위 테스트 | ✅ | `turn-registry.test.ts` 6 케이스 |
| 11 | 게이트 | ✅ | lint ✅ / typecheck ✅ / test **351/351 (48 files)** / electron-vite build ✅ (better-sqlite3 Node ABI 재빌드 후 — 0010 동일 절차) |
| 12 | IPC 카탈로그 무변경 + overview.md 동기화 | ✅ | CHANNELS diff 0 (39 유지). `arch/backend/overview.md` §3 트리·§3.1 부트·§4 표 갱신 |

## 검증 책임 분리

| 항목 | 에이전트 | 사람 |
|---|---|---|
| 게이트 4종 + 인수 1:1 대조 | ✅ 위 표 | 이견 시 중재 |
| GUI 회귀 (chat 송수신·승인 카드·취소·제목 생성) | ✖ 헤드리스 | ✅ 수동 (mock 시나리오 `full` 권장) |
| 동시 세션 턴 실기 검증 | ✖ (스테이지 3 renderer 외피 후 가능) | ✅ 스테이지 3 후 |

## 위생

- 비밀/토큰/개인정보 추가 0 (grep). 신규 의존성 0. 레이어 경계 해당 없음(main).
- 와이어(`shared/`)·preload·renderer 변경 0 — 스테이지 1 범위 준수.
