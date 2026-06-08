# Backend Architecture — Persistence (2계층·DB·FTS)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 최종 업데이트: 2026-06-04 (BACKEND_ARCHITECTURE.md 분해 — docs/ARCHITECTURE.md 인덱스 참조)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [overview.md](./overview.md), [adapters.md](./adapters.md), [provider-runtime.md](./provider-runtime.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.

## 1. 데이터 영속성 — 2 계층 모델 (사용자 결정)

### 1.1 현재 상태 (Phase 3++)

| 항목 | 위치 | 상태 |
|---|---|---|
| **electron-store** (`settings/store.ts`) | `~/Library/Application Support/orca-settings/...` (OS별 userData) | ✅ 완료 (9 키 — §1.2) |
| **로컬 SQLite DB** (`db/`) | `<userData>/orca.db` (better-sqlite3, WAL + foreign_keys) | ✅ Phase 3 완료 |
| **FTS5 전문 검색** | `messages_fts` 가상 테이블 (3 트리거로 `messages` 와 동기 유지) | ✅ Phase 3++ 완료 |
| **MCP 인증 비밀** | `orca-secrets` (electron-store) + safeStorage 암호화 | ✅ Phase 3++ 완료 |
| **첨부 / 산출물 디렉토리** | — | ❌ 미구현 (Future) |

### 1.2 electron-store 의 9 키 카탈로그

`app/src/main/settings/store.ts` + `src/shared/ipc.ts` 의 `Settings` 타입:

| 키 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `theme` | `'classic' \| 'dark' \| 'cool'` | `'classic'` | Tweaks 테마 |
| `density` | `'compact' \| 'normal' \| 'comfortable'` | `'normal'` | Tweaks 밀도 |
| `sidebarCollapsed` | `boolean` | `false` | Sidebar 펼침 상태 |
| `sidebarWidth` | `number` | `248` | Sidebar 너비 (180–480, Phase 3+) |
| `lastBackend` | `Backend \| null` | `null` | 직전 활성 백엔드 (재시작 시 복원) |
| `lastSessionId` | `string \| null` | `null` | 재시작 후 세션 재개 |
| `windowBounds` | `{x, y, width, height} \| null` | `null` | BrowserWindow 위치·크기 복원 |
| `mcpEnabled` | `Record<string, boolean>` | `{}` | MCP 서버 on/off (키=name, 부재⇒true). mcp.json 정의와 분리. |
| `mcpMeta` | `Record<string, { description: string }>` | `{}` | MCP Orca 전용 메타 (순정 Claude 스키마 오염 방지). |

**검증 전략**:
- Read: `SettingsSchema.safeParse()` → 실패 시 `{}` fallback (깨진 디스크 데이터 복원)
- Write: `SettingsPatchSchema.parse()` → 병합 → `SettingsSchema.parse()`

### 1.3 로컬 DB (Phase 3 도입 완료)

> **선택 이유**: better-sqlite3 — 동기 API (Main thread 직접 실행, worker thread 불필요), Electron 호환, 마이그레이션 자체 관리 용이 (Drizzle/Prisma ORM 의존 없이 SQL 파일 직접 관리).

#### 현재 스키마 (5 마이그레이션)

| 마이그레이션 | 내용 |
|---|---|
| `0001_initial.sql` | `sessions` + `messages` + `tool_calls` 테이블. WAL + foreign_keys pragma 설정. (`tool_calls` 는 `0004` 에서 제거) |
| `0002_projects.sql` | `projects` 테이블 + `sessions.project_id` FK (`ON DELETE SET NULL`). |
| `0003_messages_fts.sql` | `messages_fts` FTS5 가상 테이블 + INSERT/UPDATE/DELETE 3 트리거 (`messages` 와 동기 유지) + 기존 행 백필. |
| `0004_message_parts.sql` | `message_parts`(순서 보존 parts, provider-runtime.md §7) 테이블 + backfill, `tool_calls` DROP. `messages.content` 는 FTS5 text-cache 로 유지. |
| `0005_usage_events.sql` | `usage_events`(per-turn 사용량 원장 — `session_id` `ON DELETE SET NULL`·`model`·`created_at`·input/output/cache 토큰·`cost_usd`) + `created_at`/`session_id` 인덱스. 시간·모델별 집계(1일/주/월)와 세션 최신 행에서 컨텍스트 도넛/패널 복원. |

**마이그레이션 규칙**:
- `src/main/db/migrations/NNN_<name>.sql` (NNN = 0으로 패딩된 일련번호)
- 한 번 머지된 마이그레이션은 절대 수정하지 않는다 (스키마 변경은 새 마이그레이션으로)
- 앱 시작 시 `db/migrate.ts` 가 자동 실행. `schema_version` 테이블로 실행 이력 추적.

#### 저장 대상 (현재 구현)

| 테이블 | 저장 내용 |
|---|---|
| `sessions` | sessionId, title, backend, projectId, createdAt, updatedAt, lastMessagePreview |
| `messages` | sessionId FK, role, content(text), createdAt, metadata(JSON) |
| `tool_calls` | messageId FK, toolUseId, name, input, output, isError, durationMs |
| `projects` | id, name, instructions, createdAt, updatedAt |
| `messages_fts` | FTS5 가상 테이블 (content + sessionId 인덱싱. rank 정렬. `toFtsMatch` 가 토큰마다 `*` wildcard 부착.) |

#### FTS5 검색

`db/queries.ts` 의 `toFtsMatch(q)` — 공백으로 토큰 분리 후 모든 토큰에 prefix wildcard `*` 부착 (예: `진행 중` → `"진행"* "중"*`). 결과는 FTS5 rank 정렬, LIMIT 적용.

#### 1.4 계층 2 — 파일 시스템 (Future)

| 저장 대상 | 경로 패턴 |
|---|---|
| 큰 산출물 (첨부 파일, 모델 생성 md / 코드 / 이미지) | `<userData>/artifacts/<sessionId>/<uuid>.<ext>` |

- `app.getPath('userData')` 기준
- DB 에는 경로·해시·크기만 저장 (Blob 직접 저장 금지)
- 메시지/세션 삭제 시 DB CASCADE + 후처리로 파일 삭제 (GC 전략 — 신규 OQ)

#### 어댑터 외부 저장과의 관계

- 어댑터별 외부 저장 (claude-code 의 `~/.claude/projects/<cwd>/<sessionId>.jsonl` 등) 은 **단방향 동기화 소스** 로만 취급.
- **Orca 로컬 DB 가 진실의 기준** — IPC 이벤트 흐름 (`InflightTurn` 상태 머신, runtime-ipc.md §1.1) 을 통해 DB 에 실시간 persist. 외부 jsonl 직접 읽기 없음.

#### 백업 전략

- DB 파일 1개 + `<userData>/artifacts/` 디렉토리 = 단일 export/import 단위
- export 형식: TBD (zip / tar.gz / DB dump)

---

