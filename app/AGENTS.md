# app/ — 코딩 에이전트용 가이드

이 디렉토리는 **Orca v1 의 실제 구현체** (electron-vite + React/TypeScript) 가 사는 곳이다. 현재 단계는 **Phase 3++** — 로컬 SQLite SSOT + 세션 히스토리 + DOM Architecture + 4-layer Feature 아키텍처 + MCP/Skill 통합 + provider 표준화 리팩토링(부분). **전체 페이즈 이력은 [`../docs/PHASES.md`](../docs/PHASES.md)** 로 분리했다 (이 파일은 영속 작업 지침이지 changelog 가 아니다).

> **정본 우선.** 아키텍처 상세 — 모듈 트리·Provider 합성 순서·DOM 마커 체계·IPC 카탈로그·보안 근거 — 의 SSOT 는 `../docs/` 다. 본 문서는 **app 디렉토리에서 코드를 짤 때의 작업 규칙**만 담는다. 본문과 SSOT 가 어긋나면 `../docs/` 와 코드가 진실이다.

## 스택 스냅샷

| 항목     | 값                                                              |
| -------- | -------------------------------------------------------------- |
| 빌드     | electron-vite (main/preload/renderer 3-config) + electron-builder |
| Electron | 39.x (`frame: false` + macOS `titleBarStyle: 'hidden'`)        |
| React    | 19.x                                                           |
| TypeScript | 5.x (strict, target ES2022)                                  |
| 스타일   | Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first `@theme`)      |
| DB       | better-sqlite3@^12 (`<userData>/orca.db`, WAL)                 |
| 스케줄링 | croner (`main` 프로세스 in-app cron, 앱 실행 중만 발화) |
| 라우팅   | react-router-dom v7 (`app://` 커스텀 스킴 + BrowserRouter)     |

## 모듈 레이아웃

**렌더러 4-layer** — 의존은 한 방향만 허용하며 ESLint `boundaries` v6 (`boundaries/dependencies`) 로 빌드 시 강제된다:

```
app/         → pages · features · shared      (셸: Provider 합성 · router · AppLayout)
pages/       → features · shared              (조립만 — Context 읽기 + features 배치. 로직 0)
features/<X>/ → shared + 동일 feature 내부     (도메인 로직. 다른 feature → 차단)
shared/      → shared 내부만                  (범용 atom. 도메인 로직 0)
```

전체 디렉토리 트리 · 슬롯별 책임 · App.tsx Provider 합성 순서는 [`../docs/arch/frontend/layers.md`](../docs/arch/frontend/layers.md) 가 정본이다 (여기 사본을 두면 드리프트한다). cross-feature 데이터가 필요하면 역방향/타-feature import 대신 **pages/ 또는 app/ 에서 props 로 전달**한다.

**main 레이어 경계** — main 프로세스는 **feature 수직 슬라이스 + adapters 한정 ports&adapters + 얇은 infra + app composition root** 로 구성된다(handoff 0062, ports 정리 0063). DAG 는 하향 한 방향만:

```
app        → 전부                                        (컴포지션 루트 — 부팅 배선·핸들러 등록·턴 셋업)
features/<X>/ → 같은 feature · contracts · adapters · infra · shared  (수직 슬라이스 — 교차 feature 차단)
contracts  → contracts · adapters · infra · shared       (턴/버스/런타임 타입 계약)
adapters   → adapters · adapter-impl · infra · shared     (SessionAdapter 포트 & 구현)
infra      → infra · shared                              (DB·bus·config·ipc 헬퍼)
shared     → shared 내부만                               (순수 타입/상수/zod, 런타임 의존 0)
```

하향 의존만 + feature 끼리 교차 import 금지를 `eslint-plugin-boundaries`(v6) + `import/no-cycle` 로 강제(`eslint.config.mjs` 의 `src/main/**`·`src/shared/**` 블록). 레이어·슬라이스 매핑·작업 규칙 정본은 [`src/main/AGENTS.md`](src/main/AGENTS.md).

**main / preload 핵심 경로** (채널 전수·계약은 [`../docs/IPC_CONTRACT.md`](../docs/IPC_CONTRACT.md)):

| 경로                          | 책임                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `src/main/app/`               | 컴포지션 루트 — `bootstrap.ts`(부팅 배선·버스 구독 순서) · `chat-turn.ts`(턴 셋업) · `handlers/*`(도메인 IPC — `update`·`engine` 포함) · `context.ts`(RouterContext) · `boot-report.ts`(부팅 진단, 0077) · `updater.ts`(electron-updater 자동 업데이트, 0084~0086) · `builtin-resources.ts`(번들 스킬 리소스 해석, 0078) |
| `src/main/adapters/`          | claude 어댑터 — `claude.ts`(query) · `claude-map.ts`(SDK→`NormalizedEvent`) · `claude-adapt.ts`(outbound) + 포트(`types`·`turn`·`provider-config`…). mock 은 dev, opencode 는 future |
| `src/main/features/`          | 수직 슬라이스 (9) — `chat`(턴 오케스트레이션) · `sessions`(런타임 거버넌스) · `approvals` · `usage` · `history`(persist) · `providers` · `extensions`(MCP·skill·deploy·seed) · `orchestration`(대화 연속성 fork/handoff, 순수 로직) · `scheduler`(croner 주기 실행, 0091) |
| `src/main/contracts/`         | 공유 타입 계약 — `turn`(`TurnContext`) · `bus-events` · `ports` · `session-state`               |
| `src/main/infra/`             | 얇은 인프라 — `db`(better-sqlite3+WAL+마이그레이션) · `bus`(TypedBus) · `config`(orca.json·secret) · `ipc`(handle/send/dto) · `settings-store`(+`settings-migration`) · `cron`(croner 래퍼) · `errors` · `vars` |
| `src/shared/{ipc,protocol}.ts`| `CHANNELS` 상수 + 순수 TS 타입 / zod 스키마 (main 전용)                                        |

> 레이아웃에서 벗어나려면 사용자에게 먼저 확인하고, TRD §1.2 와 코드를 동시에 갱신한다.

## 보안 베이스라인

`BrowserWindow` 생성 시 아래를 **명시**한다 — 스캐폴드 기본값을 신뢰하지 말 것. 템플릿은 이미 올바르나 변경 시 반드시 유지한다:

```ts
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,  // 필수
    nodeIntegration: false,  // 필수
    sandbox: true,           // 필수
    preload: join(__dirname, '../preload/index.js')
  }
})
```

- **CSP** (`src/renderer/index.html`): Google Fonts 만 허용 — `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com`.
- **외부 URL 로드 금지** — `webContents.setWindowOpenHandler` 로 차단 + OS 기본 브라우저 위임. DevTools 자동 오픈은 dev 빌드 한정.
- 앱은 비밀을 저장하지 않는다 — OAuth/API 키는 호스트 CLI 가 관리, MCP 인증값만 `safeStorage`.
- 근거 · credential 모델 상세 → [`../docs/arch/backend/security.md`](../docs/arch/backend/security.md).

## DB · 캐시 정책 (app 고유)

- `better-sqlite3@^12` raw + prepared statements. 12.x 메이저 = Electron 39 V8 ABI 호환 (11.x 비호환, Windows prebuild 포함). ORM 미도입 — Drizzle 재검토는 Phase 4.
- **DB 위치** `<userData>/orca.db` (`app.getPath('userData')` 단일 출처). 부팅 PRAGMA `journal_mode=WAL` + `foreign_keys=ON`.
- **마이그레이션** `NNNN_<name>.sql` (4자리 zero-pad). **머지된 마이그레이션 파일은 절대 수정 금지** — 변경은 새 파일로. SQL 은 vite `?raw` 로 main 번들에 인라인. 상태는 `_migrations(name PK, applied_at)` 메타.
- **SSOT 는 DB.** claude `resume` 은 컨텍스트 유지용일 뿐 메시지 출처는 DB. 삭제는 hard delete (CASCADE).
- **메모리 캐시**: `chatStore` 의 `sessions: Record<sessionId, …>` 외피가 캐시 역할 흡수(handoff 0013) — 본 적 있는 세션 재진입은 IPC 없이 `activeKey` 전환. 무효화는 삭제 시 `invalidateSessionCache(id)`(엔트리 drop). 크기 제한 없음 (LRU cap 은 Future Scope).
- 스키마 · FTS5 · WAL 상세 → [`../docs/arch/backend/persistence.md`](../docs/arch/backend/persistence.md).

## 스타일링

- Tailwind v4 + **시맨틱 토큰 우선** (`bg-bg`, `text-ink`, `border-border`). raw hex 대신 토큰.
- 새 토큰은 `styles/tokens.css` 의 `@theme` 에 추가하고 **두 테마 스코프(white/dark) 전부**에 대응값을 채운다(white=루트 `@theme` 기본값, dark=`[data-theme='dark']`).
- 인라인 `style` 은 동적 계산값에만 (드래그 좌표, `width %`, grid template 등). 정적 값은 Tailwind 클래스로.
- **그룹 스코프 격리** (버그 방지 핵심): 자체 hover 를 가진 컴포넌트는 익명 `group` 대신 `group/<이름>` + `group-hover/<이름>:` 를 쓴다. 익명 `group-hover:` 는 상위 `.group` (예: `AssistantMessage`) 까지 매칭되어 형제 인스턴스가 함께 hover 되는 버그가 난다 (메시지 hover → 그 안 모든 코드블럭 카피버튼 동시 노출). 예: `CodeBlock` = `group/codeblock` (`shared/ui/markdown/CodeBlock.tsx`), `SessionRow` = `group/session` (`features/sessions/components/SessionRow.tsx`).
- DOM 마커 체계 (`app-frame-*` 구조 클래스 + `data-behavior`/`data-state`/`data-axis`/`data-context`/`data-platform`) → [`../docs/arch/frontend/dom-architecture.md`](../docs/arch/frontend/dom-architecture.md). 새 CSS 파일/규칙은 추가하지 않고 Tailwind 유틸(arbitrary value 포함) 로 표현한다.

## 의존성 정책

- TRD §2 Stack 표 **밖**의 패키지 추가는 **사용자 승인 필수** + PR 설명에 _왜_ 명시.
- 이미 채택 (도입 시점만 자유): React, react-markdown(+remark-gfm), shiki, electron-store, zod, zustand@5, vitest, Tailwind v4, better-sqlite3@12, react-router-dom v7, croner, electron-updater@6, diff, `@tanstack/react-virtual`@3(transcript 가상화, 0102). 템플릿 동봉(사전 승인): `@electron-toolkit/{utils,preload}`. (playwright 는 TRD 채택 목록에 있으나 아직 미설치 — 도입 시 devDependency 추가.)
- 미정 항목 (PRD §11 / TRD §15 — 단독 결정 금지): 마크다운 라이브러리 최종 결정 · 코드 서명(현재 unsigned NSIS) · 텔레메트리 · 라이센스 · 성능 SLA · 기본 백엔드. (패키징=electron-builder NSIS·자동 업데이트=electron-updater 는 0084~0089 로 채택 완료.)

## 빌드 / 실행

| 스크립트                  | 동작                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`             | `predev` 에서 better-sqlite3 Electron ABI 보장 후 electron-vite dev (HMR). |
| `npm run build`           | `prebuild` 에서 better-sqlite3 Electron ABI 보장 후 `npm run typecheck && electron-vite build` → `out/` |
| `npm run build:{win,mac,linux}` | electron-builder 플랫폼 배포 산출                                                        |
| `npm run typecheck`       | `tsc --noEmit` 3분할 — `typecheck:node`(tsconfig.node) + `typecheck:web`(tsconfig.web) + `typecheck:test`(tsconfig.test — main 테스트 타입) |
| `npm run lint` / `format` | ESLint (boundaries 포함, `./src` + `./scripts`) / Prettier                                     |
| `npm test`                | `pretest` 에서 better-sqlite3 Node ABI 보장 후 `vitest run` + `node --test "scripts/*.test.mjs"`(스크립트 4종 단위 테스트). `test:watch` = watch |
| `npm run release:{patch,minor,major}` | `npm version <bump>` — package.json+lock bump·커밋·`v*` 태그 원샷 (release.yml 트리거, 0088) |

> `better-sqlite3` 네이티브 모듈은 Electron 런타임 ABI 와 plain Node/Vitest ABI 를 동시에 만족할 수 없다. `scripts/ensure-sqlite-abi.mjs` 가 `pretest`(Node)·`predev`/`prebuild`/`postinstall`(Electron) 진입점에서 현재 target ABI 를 멱등 보장한다. 수동 `npm rebuild better-sqlite3` 를 게이트 통과 절차로 요구하지 않는다.

`scripts/` 에는 ABI 보장 외 릴리스 위생 스크립트 3종이 있다 (각각 `*.test.mjs` 동반, `npm test` 가 자동 실행):

- `check-migrations-appendonly.mjs` — 머지된 마이그레이션 파일 수정 금지(아래 DB 정책)를 **기계 강제** (CI·release 게이트).
- `validate-release-version.mjs` — `v*` 태그 ↔ `package.json` 버전 일치 검증 (release.yml fail-fast).
- `validate-dist.mjs` — 릴리스 산출물(installer/latest.yml/blockmap) sha512 재계산 검증.

## CI / 릴리스 (0087~0089)

| 워크플로우 | 트리거 | 동작 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `main` push (paths `app/**`) + 수동 dispatch | windows-latest · Node 22 — `npm ci` → 마이그레이션 append-only 가드 → lint → typecheck → test. 브랜치 CI 없음(로컬 게이트로 대체, 0088) |
| `.github/workflows/release.yml` | `v*` 태그 push (수동 dispatch = 항상 dry-run) | 버전 검증(fail-fast) → 게이트 → NSIS `build:win` → **draft** GitHub Release 게시(installer·latest.yml·blockmap) → sha512 검증 |

- 릴리스 절차·수동 체크리스트·롤백 정본은 [`../docs/guides/release-operations.md`](../docs/guides/release-operations.md).
- 현재 채널: Windows unsigned NSIS + GitHub Releases (draft = 수동 배포 게이트). 인앱 자동 업데이트는 electron-updater (`src/main/app/updater.ts`, 0084~0086).

## 에이전트 원칙 (app 고유)

일반 원칙(트랜스크립트·PRD/TRD 우선, Open Questions 단독 결정 금지, 언어 규약)은 [`../AGENTS.md`](../AGENTS.md) 를 따른다. 여기엔 app 작업에만 적용되는 것만 둔다:

1. **TRD 먼저, 코드 나중.** 본 디렉토리 1차 사양은 `../docs/TRD.md`. TRD 와 코드가 충돌하면 사용자에게 묻고, TRD 갱신과 코드 변경은 같은(또는 짝) PR 로.
2. **레이어 경계를 지켜라.** `boundaries` 위반은 `npm run lint` error. cross-feature 흐름이 필요하면 pages/ 또는 app/ 에서 props 로 전달한다.
3. **스타일은 Tailwind + 시맨틱 토큰**, **Electron 보안 옵션은 항상 명시**(위 블록), **새 의존성은 사용자 확인**.
4. **테스트 동반.** 어댑터 정규화 · reducer · IPC 스키마 · 순수 변환기는 단위 테스트와 함께 작성 (UI 는 시각 검증으로 갈음).
5. **단일 파일 분해 가이드.** `.tsx`/`.ts` 는 하나의 응집된 책임을 지킨다. (1) 한 파일에 **5개 이상 React 컴포넌트** 가 모이고 그중 일부가 다른 레이어/슬롯에 속할 수 있거나, (2) **400줄 초과** 면 분해를 검토한다. 단일 컴포넌트의 응집 구현(예: `HighlightedTextarea`, `chatReducer`)은 예외. 분해 시 새 파일은 **해당 레이어·feature 디렉토리**(`features/<X>/components|hooks/` · `shared/ui/`)에 둬 4-layer 경계를 보존한다. 수치(5개·400줄)는 *경고 트리거* 이지 절대 규칙이 아니다 — 리뷰에서 "왜 한 파일에 두었는가" 설명을 요구하는 시그널.
6. **`package.json` 메타데이터는 실값이다** (0089 에서 정리 — name=`orca`·description·author·homepage). **버전은 수동 편집하지 않는다** — `npm run release:{patch,minor,major}` 가 bump·커밋·태그를 원샷 처리한다 (SemVer pre-1.0 정책은 `../docs/guides/release-operations.md`).
