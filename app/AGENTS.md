# app/ — 코딩 에이전트용 가이드

이 디렉토리는 **Orca v1 의 실제 구현체** (electron-vite + React/TypeScript) 가 사는 곳이다. 이 파일은 **영속 작업 지침이지 changelog 가 아니다** — 완료 이력은 `git log`, 진행 중 작업은 [`../docs/handoff/INDEX.md`](../docs/handoff/INDEX.md).

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
| `src/main/app/`               | 컴포지션 루트 — `bootstrap.ts`(부팅 배선·버스 구독 순서) · `chat-turn/`(턴 셋업 — 한 클로저였던 `handleChatSend` 를 단계별 모듈로 분해. 진입점 `index.ts`(배럴) · 순서 `send.ts` · 순수 판정 `admission.ts` · 순수 조립 `turn-context.ts`·`continuation.ts` · `resolve-turn`·`runtime-entry`·`enqueue`·`turn-request`·`approval`·`post-turn`·`busy-reserve`·`turn-setup`·`deps`) + `chat-turn-continuation.ts`(자동 연속 턴) · `handlers/*`(도메인별 IPC 핸들러 — 목록·개수는 디렉토리가 진실) · `context.ts`(RouterContext) · `boot-report.ts`(부팅 진단, 0077) · `updater.ts`+`updater-feed.ts`(자동 업데이트 + object storage/GHE 피드, 0084~0086·0133) · `builtin-resources.ts`(번들 스킬 리소스 해석, 0078) |
| `src/main/adapters/`          | claude 어댑터 — `claude.ts`(query) · `claude-map.ts`(SDK→`NormalizedEvent`) · `claude-adapt.ts`(outbound) + 포트(`types`·`turn`·`harness-config`…). mock 은 dev, opencode 는 future |
| `src/main/features/`          | 수직 슬라이스 — `approvals` · `chat`(턴 오케스트레이션) · `extensions`(MCP·skill·deploy·seed) · `history`(persist) · `orchestration`(대화 연속성 fork/handoff, 순수 로직) · **`auth`**(인증 lifecycle) · **`gate`**(앱 접근 정책) · **`harnesses`**(settings·Model·실행 구성) · **`plugins`**(제품 기능 단위, 0188) · `scheduler`(croner 주기 실행, 0091) · `sessions`(런타임 거버넌스) · `usage` |
| `src/main/contracts/`         | 공유 타입 계약 — `turn`(`TurnContext`) · `bus-events` · `ports` · `session-state` · **`auth`**(0188 — `AuthDefinition`·`AuthMethod`·`Grant`·`BoundAuth`·`AuthSecretReader`. 소비 슬롯 없음) |
| `src/main/infra/`             | 얇은 인프라 — `db`(better-sqlite3+WAL+마이그레이션) · `bus`(TypedBus) · `config`(orca.json·secret) · `ipc`(handle/send/dto) · `net`(**`net-fetch`/`net-request`/`net-response`/`transport` = 유일한 원격 전송 스택**. 0180 에서 `infra/auth/` → `infra/net/` 이설) · `vault`·`browser-session`(+`-policy`)·`loopback-callback`(0181 — provider 자격증명·cookie jar·OAuth 콜백) · `log`(중앙 LogManager·JSONL·redact, 0123/0124) · `settings-store`(+`settings-migration`) · `cron`(croner 래퍼) · `errors` · `vars` |
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
- 비밀은 `safeStorage` 로만 봉인한다 — MCP 인증값 + provider vault(`infra/vault.ts`, 0181). raw secret 이 **나가는** 예외 **3곳**(MCP `.mcp.json` · LLM `--settings` argv · **LLM `Options.env`**, 0181)은 `../docs/arch/backend/security.md §1.4-b` 의 경계표에 고정돼 있다 — 표 밖의 신규 노출 금지.
- **main 에서 Node 전역 `fetch` 를 쓰지 않는다** (0173/0174). 전역 `fetch(` 를 부를 수 있는 파일은 `infra/net/net-fetch.ts` 하나뿐이고, 소비자는 `typeof fetch` 포트로 **주입받는다**(기본값 금지 — 기본값은 곧 조용한 Node 스택 복귀). 위반은 `infra/net/no-node-fetch.test.ts` 가 잡는다. Chromium 스택을 무는 파일은 `net-fetch`·`net-request`·`browser-session` 셋뿐이다 — 근거·`redirect:'manual'` 의미차 → `../docs/arch/backend/security.md` §1.8·§1.9.
- 근거 · credential 모델 상세 → [`../docs/arch/backend/security.md`](../docs/arch/backend/security.md).

## DB · 캐시 정책 (app 고유)

- `better-sqlite3@^12` raw + prepared statements. 12.x 메이저 = Electron 39 V8 ABI 호환 (11.x 비호환, Windows prebuild 포함). ORM 미도입 — Drizzle 재검토는 Phase 4.
- **DB 위치** `<userData>/orca.db` (`app.getPath('userData')` 단일 출처). 부팅 PRAGMA `journal_mode=WAL` + `foreign_keys=ON`. **dev/prod 데이터 격리**: `import.meta.env.DEV`(정확히 `npm run dev`)면 `index.ts` 가 부팅 전 `userData` 를 sibling `orca-dev` 로 리디렉션한다(`devUserDataDir`, `infra/config/paths.ts`) — DB·WAL·마이그레이션 백업·secret-store 가 실제 설치본과 통째로 분리된다. prod 번들에선 dead-code 제거.
- **마이그레이션** `NNNN_<name>.sql` (4자리 zero-pad). **머지된 마이그레이션 파일은 절대 수정 금지** — 변경은 새 파일로. SQL 은 vite `?raw` 로 main 번들에 인라인. 상태는 `_migrations(name PK, applied_at)` 메타.
- **SSOT 는 DB.** claude `resume` 은 컨텍스트 유지용일 뿐 메시지 출처는 DB. 삭제는 hard delete (CASCADE).
- **메모리 캐시**: `chatStore` 의 `sessions: Record<sessionId, …>` 외피가 캐시 역할 흡수(handoff 0013) — 본 적 있는 세션 재진입은 IPC 없이 `activeKey` 전환. 무효화는 삭제 시 `invalidateSessionCache(id)`(엔트리 drop). 크기 제한 없음 (LRU cap 은 Future Scope).
- 스키마 · FTS5 · WAL 상세 → [`../docs/arch/backend/persistence.md`](../docs/arch/backend/persistence.md).

## 스타일링 · renderer 규칙

Tailwind 시맨틱 토큰 · 그룹 스코프 격리(`group/<이름>`) · 단일 파일 분해 가이드 ·
4-layer 의존 방향은 [`src/renderer/AGENTS.md`](src/renderer/AGENTS.md) 가 갖는다.

## 의존성 정책

- TRD §2 Stack 표 **밖**의 패키지 추가는 **사용자 승인 필수** + PR 설명에 _왜_ 명시.
- 이미 채택 (도입 시점만 자유): React, react-markdown(+remark-gfm), shiki, electron-store, zod, zustand@5, vitest, Tailwind v4, better-sqlite3@12, react-router-dom v7, croner, electron-updater@6, diff, `@tanstack/react-virtual`@3(transcript 가상화, 0102), i18next/react-i18next(0096, devDeps), recharts(설정 사용량 차트, 0112), Confluence storage→markdown 변환 3종(`cheerio`·`turndown`·`turndown-plugin-gfm`, 0160 승인 — **0188 이설**: `features/plugins/confluence/`), undici(devDeps). 템플릿 동봉(사전 승인): `@electron-toolkit/{utils,preload}`. (playwright 는 TRD 채택 목록에 있으나 아직 미설치 — 도입 시 devDependency 추가.)
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

### better-sqlite3 ABI · 제약 환경 게이트 가이드 (에이전트 필독)

`better-sqlite3` 네이티브 모듈은 **Electron 런타임 ABI** 와 **plain Node/Vitest ABI** 를 동시에 만족할 수 없다(한 번에 하나). `scripts/ensure-sqlite-abi.mjs` 가 `pretest`(Node = `npm rebuild better-sqlite3`)·`predev`/`prebuild`/`postinstall`(Electron = `electron-builder install-app-deps`) 진입점에서 현재 target ABI 를 멱등 보장한다. 수동 `npm rebuild better-sqlite3` 를 게이트 통과 절차로 요구하지 않는다.

**어떤 명령이 ABI 를 뒤집는가 — 코드 수정 루프에서 필히 구분.** ABI 를 바꾸는 것은 **오직 pre/post 훅이 붙은 4개 명령**뿐이다:

| 명령 | 훅 | 결과 ABI |
|---|---|---|
| `npm install` / `npm ci` | `postinstall` | **Electron** (단, better-sqlite3 자체 install 이 Node-ABI prebuilt 를 먼저 깔 수 있음 → 아래 주의) |
| `npm run dev` / `npm run build` | `predev` / `prebuild` | **Electron** |
| `npm test` | `pretest` | **Node** |

- **`npm run lint`·`npm run typecheck`·`npm run format` 은 pre/post 훅이 없고 네이티브 바이너리를 로드하지도 않는다 → 완전 ABI-중립.** 아무리 자주 돌려도 ABI 를 뒤집지 않고 rebuild 도 유발하지 않는다. **코드 수정 루프의 기본 게이트는 이 둘(lint + typecheck)로 삼는다.**
  - 다만 **`lint` 는 `--fix` 라 파일을 쓴다**(`format` 도 마찬가지). ABI 는 안 건드리지만 **작업 트리는 바꾼다** — autofix 는 물론 줄바꿈 정규화까지 포함이다. 남의 변경을 검증하는 턴이라면 실행 후 트리 변화를 확인하고 자기 실행분을 커밋에 섞지 않는다. `typecheck` 만 완전 읽기 전용이다.
- **ABI 마찰의 실체**: `npm test` 가 ABI 를 **Node** 로 뒤집는다. 그 직후 `npm run dev`/`build` 를 하면 다시 **Electron** 재빌드가 필요한데, egress 차단 환경에선 이 재빌드가 403 으로 막혀 **빌드가 실패**한다. 즉 lint/typecheck/format 이 아니라 **`npm test` → build 순서**가 원인이다.
- **DB 를 실제로 실행하지 않는 로직 테스트는 ABI 를 안 뒤집고** 돌린다: `pretest` 를 우회해 `./node_modules/.bin/vitest run <suite>`(비-DB 스위트는 네이티브 미로드) 또는 `node --test scripts/*.test.mjs` 를 직접 호출한다. `npm test` 는 **DB 동작을 실제로 봐야 할 때만** 의도적으로 쓴다.
- **`npm install` 후 `npm run dev` 가 Node-ABI 에 고착되던 버그(수정됨)**: npm 의 prebuild-install 이 바이너리를 Node-ABI 로 되돌려도 orca 마커는 `{target:electron}` 이라, 예전 fast-path 가 마커만 보고(binary-blind) 재빌드를 건너뛰었다. 이제 `ensure-sqlite-abi.mjs` 의 electron 판정이 **실제 로드 프로브**(plain Node 에서 로드되면 Node-ABI → 재빌드)를 겸해, 네트워크만 열려 있으면 `dev`/`build` 가 자동으로 Electron 재빌드로 자가 치유한다. (핸드오프 0104.)

**제약 환경(egress 차단) 주의 — 에이전트가 헛발질하기 쉬운 지점.** 에이전트 실행 환경은 electron 바이너리·헤더 다운로드가 **403 으로 차단**되곤 한다. 그러면 `postinstall`/`predev`/`prebuild`(Electron ABI)이 실패해 `npm ci`/`npm test`/`npm run build` 가 exit 1 을 낸다. 그럼에도 **node_modules 는 설치되어 lint·typecheck·순수(비-DB) vitest 는 정상 동작**하고, `better_sqlite3.node` 바인딩만 미빌드라 **DB 로드 스위트만** 실패한다.

- **이건 환경 제약이지 코드 회귀가 아니다.** 아래 서명이 보이면 그렇게 판정한다:
  - electron install `Response code 403 (Forbidden)` · `node-gyp failed to rebuild 'better-sqlite3'` · `[sqlite-abi] ensure failed for electron`
  - vitest `Could not locate the bindings file … better_sqlite3.node` · `Cannot find module 'electron/package.json'`(설치 전 pretest)
  - 실패 스위트는 DB 를 인스턴스화하는 것들뿐이다 — **실측 5파일**(0180 재측정): `infra/db/{queries,migrate}.test.ts` · `features/extensions/builder` · `features/orchestration/fork` · `app/chat-turn.continuity`. 나머지 800+ 는 green.
- **DO ✅**
  - 설치: electron 바이너리 다운로드를 건너뛰고(`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`) postinstall(Electron ABI) 실패는 무시한 채 node_modules 를 그대로 쓴다. 필요하면 `npm rebuild better-sqlite3`(Node ABI, 소스 컴파일 — node 헤더가 로컬에 있으면 성공)로 DB 스위트까지 green 을 시도한다.
  - 게이트 판정: `npm run lint` + `npm run typecheck` + `vitest run`(또는 `./node_modules/.bin/vitest run`)의 **순수 스위트**로 한다. DB 로드 스위트 실패는 **알려진 베이스라인으로 분리 보고**한다 — 예: "N red = better-sqlite3 ABI egress 차단, 전부 DB 로드, 변경 무관".
  - `dev`/`build`/`electron-builder`/DB 런타임 실기를 요구하는 인수기준은 "네트워크 완전환경 / 사람 실기 대기"로 명시한다(0019·0102 선례). 실제 CI(`.github/workflows/ci.yml`, windows-latest)는 egress 가 열려 정상 rebuild 되므로 **최종 판정은 CI/사람 몫**이다.
- **DON'T ❌**
  - ABI 를 Node↔Electron 앞뒤로 뒤집으며 green 을 쫓지 마라 — 차단 환경에선 Electron ABI 자체가 불가하므로 테스트를 Node ABI 로 맞추면 이번엔 `dev`/`build` 가 깨지는 순환에 빠진다. 차단 환경에서 electron 로딩·빌드 검증은 **여기서 불가능**함을 받아들인다.
  - DB 로드 스위트의 bindings 실패를 자기 변경의 회귀로 보고하지 마라(코드 무관).

`scripts/` 에는 ABI 보장 외 릴리스 위생 스크립트 3종이 있다 (각각 `*.test.mjs` 동반, `npm test` 가 자동 실행):

- `check-migrations-appendonly.mjs` — 머지된 마이그레이션 파일 수정 금지(아래 DB 정책)를 **기계 강제** (CI·release 게이트).
- `validate-release-version.mjs` — `v*` 태그 ↔ `package.json` 버전 일치 검증 (release.yml fail-fast).
- `validate-dist.mjs` — 릴리스 산출물(installer/latest.yml/blockmap) sha512 재계산 검증.

## CI / 릴리스 (0087~0089)

| 워크플로우 | 트리거 | 동작 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | `main` push + 모든 PR (둘 다 paths `app/**`·`.github/workflows/**`) + 수동 dispatch | windows-latest · Node 22 — `npm ci` → 마이그레이션 append-only 가드 → lint → typecheck → test. PR CI 추가(0113 — 0088 "PR CI 없음" supersede), 로컬 게이트는 유지 |
| `.github/workflows/release.yml` | `v*` 태그 push (수동 dispatch = 항상 dry-run) | 버전 검증(fail-fast) → 게이트 → NSIS `build:win` → GitHub Release **즉시 게시**(installer·latest.yml·blockmap) → sha512 검증 |

- 릴리스 절차·수동 체크리스트·롤백 정본은 [`../docs/guides/release-operations.md`](../docs/guides/release-operations.md).
- 현재 채널: Windows unsigned NSIS + GitHub Releases (`v*` 태그 push 시 즉시 게시, 수동 dispatch는 dry-run). 인앱 자동 업데이트는 electron-updater (`src/main/app/updater.ts`, 0084~0086).

## 에이전트 원칙 (app 고유)

일반 원칙(트랜스크립트·PRD/TRD 우선, Open Questions 단독 결정 금지, 언어 규약)은 [`../AGENTS.md`](../AGENTS.md) 를 따른다. 여기엔 app 작업에만 적용되는 것만 둔다:

1. **TRD 먼저, 코드 나중.** 본 디렉토리 1차 사양은 `../docs/TRD.md`. TRD 와 코드가 충돌하면 사용자에게 묻고, TRD 갱신과 코드 변경은 같은(또는 짝) PR 로.
2. **레이어 경계를 지켜라.** `boundaries` 위반은 `npm run lint` error. cross-feature 흐름이 필요하면 pages/ 또는 app/ 에서 props 로 전달한다.
3. **Electron 보안 옵션은 항상 명시**(위 블록), **새 의존성은 사용자 확인**. 스타일 규칙은 `src/renderer/AGENTS.md`.
4. **테스트 동반.** 어댑터 정규화 · reducer · IPC 스키마 · 순수 변환기는 단위 테스트와 함께 작성 (UI 는 시각 검증으로 갈음).
5. **`package.json` 메타데이터는 실값이다** (0089 에서 정리 — name=`orca`·description·author·homepage). **버전은 수동 편집하지 않는다** — `npm run release:{patch,minor,major}` 가 bump·커밋·태그를 원샷 처리한다 (SemVer pre-1.0 정책은 `../docs/guides/release-operations.md`).
