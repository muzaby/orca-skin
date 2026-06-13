# app/ — 코딩 에이전트용 가이드

이 디렉토리는 **Orca v1 의 실제 구현체** (electron-vite + React/TypeScript) 가 사는 곳이다. 현재 단계는 **Phase 3++** — 로컬 SQLite SSOT + 세션 히스토리 + DOM Architecture + 4-layer Feature 아키텍처 + MCP/Skill 통합 + uv Python 런타임 + provider 표준화 리팩토링(부분). **전체 페이즈 이력은 [`../docs/PHASES.md`](../docs/PHASES.md)** 로 분리했다 (이 파일은 영속 작업 지침이지 changelog 가 아니다).

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

**main / preload 핵심 경로** (채널 전수·계약은 [`../docs/IPC_CONTRACT.md`](../docs/IPC_CONTRACT.md)):

| 경로                          | 책임                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `src/main/ipc/router.ts`      | IPC 라우팅 + zod 검증 + `NormalizedEvent` → DB persist (turn-local 상태)                       |
| `src/main/adapters/`          | claude-code 어댑터 — `claude-code.ts`(query) · `claude-map.ts`(SDK→`NormalizedEvent`) · `claude-adapt.ts`(outbound). opencode 는 future |
| `src/main/db/`                | better-sqlite3 singleton + WAL + 마이그레이션 러너 + prepared statements                       |
| `src/main/mcp/`               | 파일-백드 MCP 모델 (`mcp.json` + safeStorage 비밀 + 대칭 변환기 `toClaudeConfig`/`toOpencodeConfig`) |
| `src/main/deploy/`            | `ExtensionDeployer` + `StandardConformance` (sources → `dist/<engine>/` 렌더)                  |
| `src/main/runtime/`           | uv 격리 Python 런타임 (멱등 초기화 상태기계 + SDK env 주입)                                    |
| `src/main/settings/store.ts`  | `electron-store` + zod                                                                         |
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
- **SSOT 는 DB.** claude-code `resume` 은 컨텍스트 유지용일 뿐 메시지 출처는 DB. 삭제는 hard delete (CASCADE).
- **메모리 캐시**: `chatStore` 의 `sessions: Record<sessionId, …>` 외피가 캐시 역할 흡수(handoff 0013) — 본 적 있는 세션 재진입은 IPC 없이 `activeKey` 전환. 무효화는 삭제 시 `invalidateSessionCache(id)`(엔트리 drop). 크기 제한 없음 (LRU cap 은 Future Scope).
- 스키마 · FTS5 · WAL 상세 → [`../docs/arch/backend/persistence.md`](../docs/arch/backend/persistence.md).

## 스타일링

- Tailwind v4 + **시맨틱 토큰 우선** (`bg-bg`, `text-ink`, `border-border`). raw hex 대신 토큰.
- 새 토큰은 `styles/tokens.css` 의 `@theme` 에 추가하고 **세 테마 스코프(classic/dark/cool) 전부**에 대응값을 채운다.
- 인라인 `style` 은 동적 계산값에만 (드래그 좌표, `width %`, grid template 등). 정적 값은 Tailwind 클래스로.
- **그룹 스코프 격리** (버그 방지 핵심): 자체 hover 를 가진 컴포넌트는 익명 `group` 대신 `group/<이름>` + `group-hover/<이름>:` 를 쓴다. 익명 `group-hover:` 는 상위 `.group` (예: `AssistantMessage`) 까지 매칭되어 형제 인스턴스가 함께 hover 되는 버그가 난다 (메시지 hover → 그 안 모든 코드블럭 카피버튼 동시 노출). 예: `CodeBlock` = `group/codeblock` (`features/chat/components/markdown/CodeBlock.tsx`), `SessionRow` = `group/session` (`features/sessions/components/SessionRow.tsx`).
- DOM 마커 체계 (`app-frame-*` 구조 클래스 + `data-behavior`/`data-state`/`data-axis`/`data-context`/`data-platform`) → [`../docs/arch/frontend/dom-architecture.md`](../docs/arch/frontend/dom-architecture.md). 새 CSS 파일/규칙은 추가하지 않고 Tailwind 유틸(arbitrary value 포함) 로 표현한다.

## 의존성 정책

- TRD §2 Stack 표 **밖**의 패키지 추가는 **사용자 승인 필수** + PR 설명에 _왜_ 명시.
- 이미 채택 (도입 시점만 자유): React, react-markdown, shiki, electron-store, zod, vitest, playwright, Tailwind v4, better-sqlite3@12, react-router-dom v7. 템플릿 동봉(사전 승인): `@electron-toolkit/{utils,preload}`.
- **uv 바이너리 동봉**: npm 이 아닌 빌드 산출물. `scripts/fetch-uv.mjs` → `resources/bin/<plat>-<arch>/`(gitignore) → electron-builder `extraResources`. Python 은 첫 실행 시 `uv python install 3.12`, 격리 위치 `<userData>/runtime`. 상세 → [`../docs/PHASES.md`](../docs/PHASES.md) (uv 런타임 행).
- 미정 항목 (PRD §11 / TRD §15 — 단독 결정 금지): 마크다운 라이브러리 최종 결정 · 패키징/서명/자동업데이트 · 텔레메트리 · 라이센스 · 성능 SLA · 기본 백엔드.

## 빌드 / 실행

| 스크립트                  | 동작                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`             | electron-vite dev (HMR). `predev` 가 `fetch-uv`(멱등) 선행 + 부팅 시 런타임 자동 `ensure()` (`[runtime] …` 로깅) |
| `npm run build`           | `tsc --noEmit && electron-vite build` → `out/`                                                 |
| `npm run build:{win,mac,linux}` | electron-builder 플랫폼 배포 산출                                                        |
| `npm run typecheck`       | `tsc --noEmit` (node + web tsconfig 분리)                                                      |
| `npm run lint` / `format` | ESLint (boundaries 포함) / Prettier                                                            |
| `npm test`                | `vitest run` — 순수 함수 단위 (electron 비의존). `test:watch` = watch                          |
| `npm run fetch-uv`        | uv 바이너리 배치 (이미 있으면 스킵 — `--force`/`UV_FORCE` 강제)                                |
| `npm run prepare-runtime` | GUI 없이 Python 런타임 헤드리스 사전 준비 (CI 워밍 / 사전 다운로드)                            |

## 에이전트 원칙 (app 고유)

일반 원칙(트랜스크립트·PRD/TRD 우선, Open Questions 단독 결정 금지, 언어 규약)은 [`../AGENTS.md`](../AGENTS.md) 를 따른다. 여기엔 app 작업에만 적용되는 것만 둔다:

1. **TRD 먼저, 코드 나중.** 본 디렉토리 1차 사양은 `../docs/TRD.md`. TRD 와 코드가 충돌하면 사용자에게 묻고, TRD 갱신과 코드 변경은 같은(또는 짝) PR 로.
2. **레이어 경계를 지켜라.** `boundaries` 위반은 `npm run lint` error. cross-feature 흐름이 필요하면 pages/ 또는 app/ 에서 props 로 전달한다.
3. **스타일은 Tailwind + 시맨틱 토큰**, **Electron 보안 옵션은 항상 명시**(위 블록), **새 의존성은 사용자 확인**.
4. **테스트 동반.** 어댑터 정규화 · reducer · IPC 스키마 · 순수 변환기는 단위 테스트와 함께 작성 (UI 는 시각 검증으로 갈음).
5. **단일 파일 분해 가이드.** `.tsx`/`.ts` 는 하나의 응집된 책임을 지킨다. (1) 한 파일에 **5개 이상 React 컴포넌트** 가 모이고 그중 일부가 다른 레이어/슬롯에 속할 수 있거나, (2) **400줄 초과** 면 분해를 검토한다. 단일 컴포넌트의 응집 구현(예: `HighlightedTextarea`, `chatReducer`)은 예외. 분해 시 새 파일은 **해당 레이어·feature 디렉토리**(`features/<X>/components|hooks/` · `shared/ui/`)에 둬 4-layer 경계를 보존한다. 수치(5개·400줄)는 *경고 트리거* 이지 절대 규칙이 아니다 — 리뷰에서 "왜 한 파일에 두었는가" 설명을 요구하는 시그널.
6. **`package.json` 메타데이터는 템플릿 기본값.** 도메인 PR 에서 `name`/`productName`/`description`/`author` + `electron-builder.yml` 갱신.
