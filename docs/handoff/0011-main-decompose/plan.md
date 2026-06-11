# Plan — 0011-main-decompose

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 비기능(리팩토링) 작업 — Claude 직접 구현.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0011-main-decompose` |
| 작성자 | Claude Code |
| 일자 | 2026-06-11 |
| 매핑 | 단계적 아키텍처 리팩토링 스테이지 1/3 (백엔드) |
| 상태 | READY |

## Context (왜)

`src/main/ipc/router.ts` 가 1,070줄 모놀리스로 IPC 등록·zod 검증·턴-로컬 상태(InflightTurn)·DB persist·권한 중재·제목 생성이 한 클래스에 혼재한다 (`app/AGENTS.md` 원칙 5의 400줄 분해 가이드 위반). 추가로:

- 턴 레지스트리가 `Map<WebContents, InflightTurn>`(창당 1턴) — Phase 4 멀티세션(동시 세션 턴)의 구조적 차단점.
- `listSessions(1000).find()` N+1 패턴 2곳 (`router.ts:260` resolveTurnAgent · `:808` sessionLoad) — `getSessionById` prepared statement 부재.
- `config/secret-store.ts` → `mcp/crypto.ts` 역방향 import (config↔mcp 패키지 순환).
- 정식 배포 전용 1회성 레거시 이전 코드(`mcp/migrate.ts`, `config/migrate-sources.ts`) 잔존 — 부팅 시퀀스 복잡화. **사용자 결정(2026-06-11): 제거.**
- `db/closeDb()` 미사용 export — 종료 시 WAL 정리 미수행.

## 인수 기준 (Acceptance Criteria)

1. `ipc/router.ts` 는 컴포지션 루트(의존성 생성 + 부팅 + 등록 위임)만 남는다 — 250줄 이하.
2. 도메인 핸들러가 `ipc/handlers/{session,project,mcp,misc}.ts` 로 분리되고, 각 핸들러의 **현행 검증·실패 동작이 보존**된다 (검증 패턴 통일은 스테이지 2 범위).
3. chat 턴 파이프라인이 `ipc/chat/{turn-registry,send,persist,title-generation,approvals}.ts` 로 분리된다.
4. 턴 레지스트리가 sessionId 키잉으로 전환된다: `Map<sessionId, InflightTurn>` + 창당 1개의 새-채팅 pending 슬롯, `session.updated` 시 sessionId 키로 승격. 같은 세션 중복 send 는 error 이벤트로 거부, **서로 다른 세션의 동시 턴은 허용**.
5. `chatCancel` 은 페이로드 `sessionId` 로, `permissionSetMode` 는 페이로드 `sessionId` 로, `permissionRespond` 의 부수효과(sessionAllowedTools·deny+interrupt abort)는 approvalId→턴 매핑으로 동작한다 (event.sender 키잉 제거). 와이어 스키마 무변경.
6. `DbQueries.getSessionById(id)` prepared statement 가 추가되고 `resolveTurnAgent`·`sessionLoad` 의 `listSessions(1000).find()` 가 교체된다.
7. `closeDb()` 가 `app.on('will-quit')` 에 와이어된다.
8. `mcp/crypto.ts` → `config/crypto.ts` 이동 — config→mcp import 0, mcp→config 단방향만.
9. `mcp/migrate.ts` + `config/migrate-sources.ts`(+ 테스트) 삭제, 부팅 시퀀스에서 두 이전 호출 제거.
10. 신규 단위 테스트: turn-registry(pending 승격·동시 턴·같은 세션 중복 거부·finish 정리).
11. 게이트 통과: `npm run lint` · `npm run typecheck` · `npm test`(기존 349+ 그린 유지) · `npm run build`.
12. IPC 채널 카탈로그 무변경(39 유지) — 와이어 동작 동형. 문서: `arch/backend/overview.md` 모듈 트리·부팅 시퀀스 갱신.

## 범위 / 비범위

- **범위**: `src/main/**` 구조 분해 + 턴 키잉 + DB statement + 레거시 제거 + backend/overview.md 동기화.
- **비범위**: IPC 채널 추가/삭제(스테이지 2), 검증 패턴 통일(스테이지 2), renderer 변경(스테이지 3), 어댑터(`adapters/`)·extensions/deploy/runtime 내부 변경.

## 설계

- 핸들러 공유 의존성은 `ipc/context.ts` 의 `RouterContext` 인터페이스로 주입 — 싱글톤 필드 직접 참조 제거.
- DTO 변환(`previewOf`/`toSessionListItem`/`toProject`/`partFromRow`)은 `ipc/dto.ts` 로.
- `ipc/chat/approvals.ts` 의 `ApprovalCoordinator` 가 기존 `InteractionBroker`(`ask/broker.ts` — 무변경) + `sessionAllowedTools` + `Map<approvalId, InflightTurn>` 을 소유.
- 재사용(무변경): `ask/broker.ts`, `title/title.ts`, `usage/usageMap.ts`, `runtime-events/*`, `adapters/*`, `extensions/*`.

## 영향 받는 파일

- `app/src/main/ipc/router.ts` (분해) → 신규 `ipc/{context,dto}.ts`, `ipc/handlers/{session,project,mcp,misc}.ts`, `ipc/chat/{turn-registry,send,persist,title-generation,approvals}.ts`
- `app/src/main/db/queries.ts` (+getSessionById), `app/src/main/index.ts` (closeDb 와이어)
- `app/src/main/config/crypto.ts` (이동), `app/src/main/config/secret-store.ts` (import 경로)
- 삭제: `app/src/main/mcp/{crypto,migrate}.ts`, `app/src/main/config/migrate-sources.{ts,test.ts}`
- `docs/arch/backend/overview.md`

## 참고 문서

- `docs/arch/backend/overview.md` §3 (프로세스 구조 — 갱신 대상)
- `docs/arch/backend/provider-runtime.md` §3 (PermissionBridge — 동작 보존 대상)
- `docs/IPC_CONTRACT.md` (채널 무변경 확인)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test` + `npm run build`.
- 신규 테스트: `ipc/chat/turn-registry.test.ts`.

---

## [Claude 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `ipc/router.ts`(1,070→139줄 컴포지션 루트) · 신규 `ipc/{context,dto}.ts` + `ipc/handlers/{session,project,mcp,misc}.ts` + `ipc/chat/{turn-registry,send,persist,title-generation,approvals}.ts` · `db/queries.ts`(+getSessionById) · `db` close 와이어(`main/index.ts` will-quit) · `mcp/crypto.ts`→`config/crypto.ts` · 삭제 `mcp/migrate.ts`·`config/migrate-sources.{ts,test.ts}` · `docs/arch/backend/overview.md` §3/§3.1/§4 동기화 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` |
| 게이트 결과 | lint ✅ / typecheck ✅ / test ✅ (351 passed, 48 files — turn-registry 6 신규) / build ✅ |
| 비고 | better-sqlite3 는 Node ABI 재빌드 후 전체 그린 (0010 검증과 동일 절차). 인수 5의 `permissionSetMode` 는 세션 키 조회로 전환되며 구현상 `turn.dbSessionId === sessionId` 비교가 레지스트리 키 조회로 대체됨(동치). |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 기입) |
