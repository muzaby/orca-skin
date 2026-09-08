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
| **게시 원본 파일** | `~/.config/orca/artifacts` (개발 profile은 `.dev` 하위) | 명시적 publisher의 HTML/Markdown 보관 |

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

사용량 SQL은 `infra/db/usage-queries.ts`의 `UsageQueries`가 소유하며 `DbQueries.usage`로 접근한다. 같은 SQLite 연결과 transaction을 공유한다. `UsageTracker`는 이 사용량 객체만 받아 telemetry 기록·집계·발신을 맡는다. 세션 복원 조립은 `features/history/reader.ts`, row의 IPC 변환은 `infra/ipc/dto.ts`에 있다. `app/handlers/session.ts`는 입력 검증·조회 호출·현재 활동 상태 결합을 맡는다.

#### 현재 스키마

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
| `0014_provider_usage_report_cache.sql` | `provider_usage_report_cache` 테이블 — provider 당 1행의 원격 사용량 스냅샷. `report_json` 은 `{ baselineUsable, raw }` 봉투이고 스칼라 3종(`quota_{limit,used,remaining}_usd`)이 한도·기준선 경로를 싸게 만든다. 원격 fetcher 를 주입한 배포에서만 채워진다 (0111, 0186). |
| `0015_pinned.sql` | 고정(pin) 섹션 지원 컬럼 (0129). |
| `0016_turn_model_context_window.sql` | `turn_model_usage.context_window`(nullable) — SDK 실측 컨텍스트 윈도 영속. 재로드 도넛 분모가 라이브와 같은 실측값을 쓰게 해 렌더러의 모델명 추측 목록을 걷어냈다 (0149). |
| `0017_session_extra_dirs.sql` | `sessions.extra_dirs`(nullable JSON 배열) — 세션 출생 시 고정한 추가 참조 경로. |
| `0018_managed_worktrees.sql` | `managed_worktrees` — Orca가 생성한 Git worktree의 저장소·경로·branch·base OID와 nullable 세션 연결. |

**마이그레이션 규칙**:
- `src/main/infra/db/migrations/NNNN_<name>.sql` (NNNN = 0으로 패딩된 일련번호)
- 한 번 머지된 마이그레이션은 절대 수정하지 않는다 (스키마 변경은 새 마이그레이션으로) — `app/scripts/check-migrations-appendonly.mjs` 가 CI·release 게이트에서 **기계 강제** (0087)
- 앱 시작 시 `infra/db/migrate.ts` 가 자동 실행. `_migrations` 메타 테이블로 실행 이력 추적.

#### 저장 대상 (현재 구현)

`0022_session_agent_kind.sql`의 `sessions.agent_kind`는 `coding|work` 출생값이다. 기존 행과 종류를 생략한 신규 insert의 기본값은 Coding이다. 재개는 DB 값을 읽고 fork/handoff는 원본 종류를 계승한다. 준비 중에는 live lease가 같은 역할을 맡으며, 종류 충돌은 큐 적재 전에 거부한다. 해제된 lease를 보존하는 별도 초안 레지스트리는 없다.

Work의 표시 경계는 `message_parts`에 `response_boundary` JSON으로 저장한다. `begin`과 `end`는 수신 구간 ID를 공유하고 `end.outcome`은 `ended|aborted|failed|unknown`이다. `ended`는 수신 구간 종료를 뜻하며 작업 성공 판정이 아니다. writer는 begin이 속한 메시지 주소에 end를 추가하므로 telemetry 이후에도 marker만 있는 새 메시지를 만들지 않는다. 이 part는 FTS 본문·모델 컨텍스트·복사 텍스트에 합류하지 않는다. crash로 end가 없으면 불완전 구간으로 복원한다.

| 테이블 | 저장 내용 |
|---|---|
| `sessions` | sessionId, title, title_source, backend, agent_kind, provider_key, cwd, projectId, createdAt, updatedAt, lastMessagePreview |
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

#### 1.4 계층 2 — 게시 원본 파일

`features/artifacts`가 게시 파일 검증·보관·상태·휴지통을 소유한다. 본문은 `~/.config/orca/artifacts/<artifactFileId>/<filename>`, 개발 profile은 같은 루트의 `.dev/<artifactFileId>/<filename>`에 둔다. DB의 `artifact_files`는 profile 상대 경로·초기 hash/크기·휴지통 이동 이력을 저장하며 세션 FK를 갖지 않는다. `session_artifacts`는 세션별 게시 참조이고 같은 SQLite 연결의 `DbQueries.artifacts`가 transaction을 소유한다.

- 도구는 완성된 로컬 HTML/HTM/MD 파일을 읽어 게시 원본으로 복사한다. 입력 workspace 파일을 이동하거나 삭제하지 않는다. 일반 readRoots의 앱 설정/런타임 경로는 게시 입력 권한에 포함하지 않는다.
- 게시 성공은 파일과 세션 publication 확정이다. 실제 publisher tool_result 영수증과 원래 tool_call을 검증한 뒤 그 메시지에 artifact part를 연결한다. 중간 종료로 연결이 없더라도 우측 목록에 게시를 보존한다.
- 파일은 외부에서 수정·삭제될 수 있다. missing/unavailable은 실제 상태 조회 결과이며 영속 삭제 플래그가 아니다. 게시 당시 hash를 불변 백업 보장이나 현재 소실 판정에 사용하지 않는다.
- fork는 기존 메시지 복사 transaction 안에서 자식 publication과 part ID를 복제하고 같은 artifactFileId를 참조한다. 대화 삭제는 해당 참조만 제거하며 마지막 참조가 없어도 파일을 자동 삭제하지 않는다.
- 사용자 삭제는 OS 휴지통 이동이다. 게시 기록은 보존하며 `lastTrashedAt`는 과거 행위일 뿐 현재 파일 없음의 원인을 단정하지 않는다. 이동 후 DB 기록 실패는 별도로 보고한다.
- 새 요청이 만든 임시/실패 파일만 정리한다. 전역 orphan scan·자동 GC는 없다. 종료는 신규 commit을 차단하며 강제 프로세스 종료 때 미등록 파일이 남을 수 있다.

공개 계약은 [IPC_CONTRACT.md](../../IPC_CONTRACT.md#26-a-산출물-게시-파일), 설계 근거와 검증 기준은 [게시 도구 계획](../../handoff/0223-artifact-publisher/plan.md)에 있다.

#### 어댑터 외부 저장과의 관계

- 어댑터별 외부 저장 (claude-code 의 `~/.claude/projects/<cwd>/<sessionId>.jsonl` 등) 은 **단방향 동기화 소스** 로만 취급.
- **Orca 로컬 DB 가 진실의 기준** — IPC 이벤트 흐름 (`TurnCoordinator` — `features/chat/turn-coordinator.ts`, runtime-ipc.md §1.1) 을 통해 DB 에 실시간 persist. 외부 jsonl 직접 읽기 없음.

#### 백업 전략

- 앱 데이터 전체 백업은 해당 profile의 DB와 게시 원본 폴더를 함께 보존해야 한다. 현재 앱 내 전체 백업/복원 기능은 없다.
- export 형식: TBD (zip / tar.gz / DB dump)

---



## sessions.provider_key (0008, handoff 0010)

`0008_provider_key.sql` 은 `sessions.provider_key TEXT` nullable 컬럼을 추가한다. 이 값은 마지막 턴에 사용된 provider key 기록이며 세션의 adapter 잠금 제약은 기존 `sessions.backend` 가 담당한다. 자격 토큰은 평문·해시 어느 형태로도 DB 에 저장하지 않는다.
