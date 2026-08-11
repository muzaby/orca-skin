# Backend Architecture — Persistence (2계층·DB·FTS)

> 이 문서의 독자: AI agent (1순위), 팀 동료 (2순위)
> 관련 문서: [../../ARCHITECTURE.md](../../ARCHITECTURE.md) (인덱스), [overview.md](./overview.md), [adapters.md](./adapters.md), [provider-runtime.md](./provider-runtime.md)
> 진실의 기준: **코드와 어긋날 경우 코드 우선** — 발견 시 사용자에게 보고.
> Decision rationale: [ADR-001](../../decisions/001-orca-db-session-ssot.md) — 왜 SDK jsonl 이 아니라 로컬 DB 가 대화의 진실인가.

## 1. 데이터 영속성 — 2 계층 모델 (사용자 결정)

### 1.1 현재 상태 (Phase 3++)

| 항목 | 위치 | 상태 |
|---|---|---|
| **electron-store** (`infra/settings-store.ts`) | `~/Library/Application Support/orca-settings/...` (OS별 userData) | ✅ 완료 (키 카탈로그 §1.2) |
| **로컬 SQLite DB** (`db/`) | `<userData>/orca.db` (better-sqlite3, WAL + foreign_keys) | ✅ Phase 3 완료 |
| **FTS5 전문 검색** | `messages_fts` 가상 테이블 (3 트리거로 `messages` 와 동기 유지) | ✅ Phase 3++ 완료 |
| **MCP 인증 비밀** | `orca-secrets` (electron-store) + safeStorage 암호화 | ✅ Phase 3++ 완료 |
| **첨부 / 산출물 디렉토리** | — | ❌ 미구현 (Future) |

### 1.2 electron-store 키 카탈로그

`app/src/main/infra/settings-store.ts` + `src/shared/protocol.ts` 의 `SettingsSchema` (zod 가 SSOT):

| 키 | 타입 | 기본값 | 용도 |
|---|---|---|---|
| `theme` | `'white' \| 'dark'` | `'white'` | Tweaks 테마 (2종) |
| `density` | `'compact' \| 'normal' \| 'comfortable'` | `'normal'` | Tweaks 밀도 |
| `sidebarCollapsed` | `boolean` | `false` | Sidebar 펼침 상태 |
| `sidebarWidth` | `number` | `248` | Sidebar 너비 (180–480, Phase 3+) |
| `lastBackend` | `Backend \| null` | `null` | 직전 활성 백엔드 (재시작 시 복원) |
| `lastSessionId` | `string \| null` | `null` | 재시작 후 세션 재개 |
| `windowBounds` | `{x, y, width, height} \| null` | `null` | BrowserWindow 위치·크기 복원 |
| `mcpEnabled` | `Record<string, boolean>` | `{}` | MCP 서버 on/off (키=name, 부재⇒true). mcp.json 정의와 분리. |
| `mcpMeta` | `Record<string, { description: string }>` | `{}` | MCP Orca 전용 메타 (순정 Claude 스키마 오염 방지). |
| `skillEnabled` | `Record<string, boolean>` | `{}` | Skill on/off (키=sourceId/name, 부재⇒true). |
| `authBypass` | `boolean` | `false` | 인증 게이트 우회 (디버그 패널 토글, DEV 전용 — security.md §1.7). 0157 에서 `ssoBypass` 에서 개명. |
| `language` | `string` | `'한국어'` | 선호 언어(LLM 응답 언어) — 시스템 프롬프트 `# User` 헤더로 매 턴 주입. `uiLocale` 과 별개. |
| `uiLocale` | `'ko' \| 'en'` | `'ko'` | UI 표시 언어(앱 크롬 로케일, 0096) — 렌더러 i18n 카탈로그 + 날짜/시간 포맷 로케일. 타임존은 설정 아님(항상 OS 로컬). |
| `accountInstructions` | `string` | `''` | 계정 지침 — 시스템 프롬프트 `# User` 헤더로 매 턴 주입. |
| `appFont` | `'sans' \| 'serif' \| 'mono'` | `'sans'` | 앱 전체 폰트 (`--font-app` 매핑). |
| `notifyOnComplete` | `boolean` | `false` | 턴 완료 시(창 비활성 한정) OS 네이티브 알림. |
| `spendingLimitUsd` | `number \| null` | `90` | 월간 지출 한도(USD) — 사용량 한도 바의 기준, null=무제한 (0079). |
| `scheduler` | `{ usageRecompute: { enabled, cron }; updateCheck: { enabled, intervalHours } }` | `usageRecompute.enabled: false` · `updateCheck: { true, 6 }` | 주기 실행 설정 — 사용량 recompute job (0091) + 자동 업데이트 확인 주기 (0156, 앱 시작 시각 anchor 간격이라 cron 이 아니다). 두 그룹은 각자 default 를 들고 그룹 단위로 병합된다(`settings-store.ts` `mergeGroup`). |

**검증 전략**:
- Read: `SettingsSchema.safeParse()` → 실패 시 `{}` fallback (깨진 디스크 데이터 복원). read 는 순수 — 마이그레이션·디스크 쓰기는 lazy 1회 + patch 시(0092, write-on-read 제거).
- Write: `SettingsPatchSchema.parse()` → 병합 → `SettingsSchema.parse()`

### 1.3 로컬 DB (Phase 3 도입 완료)

> **선택 이유**: better-sqlite3 — 동기 API (Main thread 직접 실행, worker thread 불필요), Electron 호환, 마이그레이션 자체 관리 용이 (Drizzle/Prisma ORM 의존 없이 SQL 파일 직접 관리).

#### 현재 스키마 (16 마이그레이션)

| 마이그레이션 | 내용 |
|---|---|
| `0001_initial.sql` | `sessions` + `messages` + `tool_calls` 테이블. WAL + foreign_keys pragma 설정. (`tool_calls` 는 `0004` 에서 제거) |
| `0002_projects.sql` | `projects` 테이블 + `sessions.project_id` FK (`ON DELETE SET NULL`). |
| `0003_messages_fts.sql` | `messages_fts` FTS5 가상 테이블 + INSERT/UPDATE/DELETE 3 트리거 (`messages` 와 동기 유지) + 기존 행 백필. |
| `0004_message_parts.sql` | `message_parts`(순서 보존 parts, provider-runtime.md §7) 테이블 + backfill, `tool_calls` DROP. `messages.content` 는 FTS5 text-cache 로 유지. |
| `0005_usage_events.sql` | `usage_events`(per-turn 사용량 원장) + 인덱스. (`0006` 에서 대체) |
| `0006_turn_usage.sql` | `usage_events` DROP → `turn_usage` + `turn_model_usage`(모델별 분해) 로 스키마 통일 (handoff 0002). 일/주/월 집계·컨텍스트 도넛 복원의 원장. |
| `0007_title_source.sql` | `sessions.title_source`(`'auto'` 기본) — 자동 제목 요약 vs 사용자 rename 보호 (handoff 0004). |
| `0008_provider_key.sql` | `sessions.provider_key`(nullable) — 마지막 턴에 사용된 provider key 기록 (handoff 0010). |
| `0009_message_complete.sql` | `messages.complete`(기본 1) — 중단/미완 어시스턴트 메시지 판별. |
| `0010_session_cwd.sql` | `sessions.cwd`(nullable) — 세션 작업 디렉토리 (workspace 격리, 0074~0075). |
| `0011_session_lineage.sql` | `session_lineage` 테이블 — Conversation Continuity fork/handoff 계보 (handoff 0051). |
| `0012_provider_limits.sql` | `provider_limits` 테이블 — provider별 월간 지출 한도 (0080~0082). |
| `0013_schedules.sql` | `schedule_runs` 테이블 — scheduler job 실행 이력 원장 (0091). |
| `0014_provider_usage_report_cache.sql` | `provider_usage_report_cache` 테이블 — 외부 권위 사용량 리포트 캐시 (0111). |
| `0015_pinned.sql` | 고정(pin) 섹션 지원 컬럼 (0129). |
| `0016_turn_model_context_window.sql` | `turn_model_usage.context_window`(nullable) — SDK 실측 컨텍스트 윈도 영속. 재로드 도넛 분모가 라이브와 같은 실측값을 쓰게 해 렌더러의 모델명 추측 목록을 걷어냈다 (0149). |

**마이그레이션 규칙**:
- `src/main/infra/db/migrations/NNNN_<name>.sql` (NNNN = 0으로 패딩된 일련번호)
- 한 번 머지된 마이그레이션은 절대 수정하지 않는다 (스키마 변경은 새 마이그레이션으로) — `app/scripts/check-migrations-appendonly.mjs` 가 CI·release 게이트에서 **기계 강제** (0087)
- 앱 시작 시 `infra/db/migrate.ts` 가 자동 실행. `_migrations` 메타 테이블로 실행 이력 추적.

#### 저장 대상 (현재 구현)

| 테이블 | 저장 내용 |
|---|---|
| `sessions` | sessionId, title, title_source, backend, provider_key, cwd, projectId, createdAt, updatedAt, lastMessagePreview |
| `messages` | sessionId FK, role, content(text — FTS5 text-cache), complete, createdAt, metadata(JSON) |
| `message_parts` | messageId FK, 순서 보존 parts (text/tool/reasoning …, provider-runtime.md §7) |
| `projects` | id, name, instructions, createdAt, updatedAt |
| `turn_usage` / `turn_model_usage` | per-turn 사용량 원장 + 모델별 분해 (토큰·cost_usd·context_window) |
| `provider_limits` | provider별 월간 지출 한도 (0080) |
| `session_lineage` | fork/handoff 계보 (0051) |
| `schedule_runs` | scheduler job 실행 이력 (0091) |
| `messages_fts` | FTS5 가상 테이블 (content + sessionId 인덱싱. rank 정렬. `toFtsMatch` 가 토큰마다 `*` wildcard 부착.) |

#### FTS5 검색

`db/queries.ts` 의 `toFtsMatch(q)` — 공백으로 토큰 분리 후 모든 토큰에 prefix wildcard `*` 부착 (예: `진행 중` → `"진행"* "중"*`). 결과는 FTS5 rank 정렬, LIMIT 적용.

#### PRAGMA · content 기록 시점 (0107 — 스트리밍 영속 핫패스)

- **`synchronous = NORMAL`** (WAL 공식 권장 조합, `infra/db/index.ts`). 기본 FULL 은 커밋마다 fsync 해 스트리밍 persist(동기 better-sqlite3, 버스 critical 구독자)가 이벤트 루프를 점유했다. **트레이드오프**: 앱 크래시는 무손실, 정전/OS 크래시 시에만 최근 커밋 롤백 가능(DB 무결성은 보존 — WAL 특성).
- **`messages.content`(FTS5 text-cache) 는 메시지 마감 시 1회 기록** — 스트리밍 중 블록마다 누적 전체를 재기록하면 `messages_au` 트리거가 매번 전체 재색인(응답 길이에 초선형). 마감 경계 = telemetry persist · `commitUserMessage` · chatCancel(`finalizeTurn`). 트랜스크립트 복원은 `message_parts` 만 쓰므로(loadParts) 화면 영향 없음.
- **finalize 이전 비정상 종료(크래시·adapter error·stall timeout)의 FTS 공백**은 `rebuildIncompleteMessageContent`(features/chat/recovery)가 복구 — 부팅(chat-recovery 스텝) + 해당 세션 다음 `chat:send` 초입, 둘 다 `recoverDanglingToolCalls` **이전** 실행(complete=0 이 대상 식별자).

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



## sessions.provider_key (0008, handoff 0010)

`0008_provider_key.sql` 은 `sessions.provider_key TEXT` nullable 컬럼을 추가한다. 이 값은 마지막 턴에 사용된 provider key 기록이며 세션의 adapter 잠금 제약은 기존 `sessions.backend` 가 담당한다. 자격 토큰은 평문·해시 어느 형태로도 DB 에 저장하지 않는다.
