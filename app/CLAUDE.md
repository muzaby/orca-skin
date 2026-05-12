# app/ — 코딩 에이전트용 가이드

이 디렉토리는 **Orca v1 의 실제 구현체**가 사는 곳이다. 현재는 `@quick-start/electron` 의 `react-ts` 템플릿 (electron-vite 기반) 으로 깔린 *스캐폴드 상태* 이며, 본 구현은 `docs/TRD.md` 의 사양을 따른다.

## 현재 상태 (스캐폴드)

| 영역 | 상태 |
|---|---|
| 템플릿 | `@quick-start/electron` `react-ts` (electron-vite 기반) |
| 번들러 | Vite (main/preload/renderer 3-config 통합) |
| Electron | 39.2.6 |
| React | 19.2.1 |
| TypeScript | 5.x (TRD `strict + target: ES2022` 충족) |
| 메인 (`src/main/index.ts`) | 템플릿 기본 `createWindow`. `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true` 명시. |
| 렌더러 (`src/renderer/src/`) | `App.tsx` + 샘플 `Versions.tsx`. Orca UI 미구현 |
| 프리로드 (`src/preload/index.ts`) | `contextBridge.exposeInMainWorld('electron', electronAPI)` 샘플 — Orca 화이트리스트로 교체 필요 |
| 패키저 | electron-builder (`electron-builder.yml`) |
| 도메인 코드 | **없음** — TRD §1.2 모듈 미구현 |
| `package.json` | 템플릿 기본값 (`name: "electron-app"`, `author: "example.com"` 등) — 첫 도메인 PR 에서 갱신 |

## 타깃 모듈 레이아웃 (TRD §1.2 기준)

경로는 electron-vite (`@quick-start/electron` react-ts 템플릿) 의 sub-config 분할을 반영한다. 빌드는 `electron.vite.config.ts` 의 main/preload/renderer 3개 sub-config 가 각각 처리한다.

| 경로 | 책임 | 현 상태 |
|---|---|---|
| `src/main/index.ts` | Electron `app` 부트, BrowserWindow, IpcRouter 부착 | 템플릿 기본 |
| `src/main/ipc/router.ts` | IPC 채널 라우팅 + 입력 검증 (zod) | 미작성 |
| `src/main/adapters/types.ts` | `SessionAdapter`, `ChatEvent`, `Backend` 공통 타입 | 미작성 |
| `src/main/adapters/claude-code.ts` | Claude Code spawn / NDJSON / `--resume` | 미작성 |
| `src/main/adapters/opencode.ts` | opencode `serve` / SDK / SSE | 미작성 |
| `src/main/adapters/registry.ts` | 설치 상태 + 활성 백엔드 선택 | 미작성 |
| `src/main/installer/index.ts` | CLI 설치 자동화 | 미작성 |
| `src/main/settings/store.ts` | Phase 2+ `electron-store`. Phase 1 은 in-memory | 미작성 |
| `src/renderer/src/main.tsx` | React 엔트리 + DOM mount | 템플릿 기본 |
| `src/renderer/src/App.tsx` | 루트 컴포넌트 (Versions.tsx 샘플) | 템플릿 기본 |
| `src/renderer/src/app/*` | `ChatShell`, `Composer`, `MessageList`, `Markdown`, `TweaksPanel` | 미작성 |
| `src/preload/index.ts` | `contextBridge.exposeInMainWorld` 화이트리스트 — electron-vite preload sub-config 진입점 | 템플릿 기본 |
| `src/shared/protocol.ts` | Renderer ↔ Main 메시지 스키마 | 미작성 |
| `src/shared/i18n/ko.ts` | 한국어 라벨 | 미작성 |

> 이 레이아웃에서 벗어나려면 사용자에게 먼저 확인. TRD §1.2 와 코드를 동시에 갱신해야 한다.

## 보안 베이스라인 (TRD §1.3) — 첫 PR 에서 반드시 적용

`BrowserWindow` 생성 시 다음을 *명시*. 스캐폴드 기본값을 신뢰하지 말 것. 현재 템플릿은 이미 올바르게 설정되어 있으나, 변경 시 반드시 유지할 것.

```ts
import { join } from 'path';
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,   // 필수
    nodeIntegration: false,   // 필수
    sandbox: true,            // 필수
    preload: join(__dirname, '../preload/index.js'),
  },
});
```

| 항목 | 규칙 |
|---|---|
| DevTools 자동 오픈 | dev 빌드(`process.env.NODE_ENV !== 'production'`) 한정 |
| 외부 URL 로드 | 금지. `webContents.setWindowOpenHandler` 로 차단 + OS 기본 브라우저 위임 |
| 비밀 저장 | 앱은 저장하지 않음 — OAuth/API 키는 호스트 CLI 가 관리 (PRD N6) |
| `@electron-toolkit/utils` 사용 시 | `contextIsolation`, `nodeIntegration`, `sandbox` 는 여전히 *명시*. 공통 유틸은 이 3옵션 조합을 가정한다. |

## 의존성 정책

- TRD §2 의 Stack 표 밖의 패키지 추가는 **사용자 승인 필수**. PR 설명에 *왜* 가 들어가야 한다.
- 이미 채택된 것 (도입 시점만 자유): React, react-markdown, shiki, electron-store, zod, vitest, playwright.
- 템플릿 동봉 (사전 승인): `@electron-toolkit/utils`, `@electron-toolkit/preload`.
- 미정 항목 (PRD §11 / TRD §15 — 단독 결정 금지):
  - OQ1: React 버전 (18 / 19) — 현재 19 로 템플릿 기본, TRD 확인 필요
  - OQ2: 마크다운/하이라이트 라이브러리 최종 결정
  - OQ3: 패키징·서명·자동업데이트
  - OQ4: 텔레메트리·크래시 리포트
  - OQ5: 라이센스
  - OQ6: 성능 SLA 수치
  - OQ7: 둘 다 설치된 경우 기본 백엔드
  - OQ8: 새 대화 시 직전 세션 노출 방식

## 빌드 / 실행

| 스크립트 | 동작 |
|---|---|
| `npm run dev` | electron-vite dev (HMR for renderer, main/preload watch+restart) |
| `npm run build` | `tsc --noEmit && electron-vite build` (3-config 번들 → `out/`) |
| `npm start` | `electron-vite preview` (프로덕션 번들 실행) |
| `npm run build:win` | `electron-vite build && electron-builder --win` Windows 배포 산출 |
| `npm run build:mac` | macOS 배포 산출 |
| `npm run build:linux` | Linux 배포 산출 |
| `npm run typecheck` | `tsc --noEmit` (node + web 두 tsconfig 분리 검증) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | **미설정** — Vitest 추가 시 채워라 (TRD §10.1) |

## 에이전트 원칙

1. **`docs/TRD.md` 먼저 읽고 코드 짜라.** 본 디렉토리 작업의 1차 사양은 TRD. PRD §11 / TRD §15 Open Questions 는 단독 결정 금지.
2. **위 모듈 레이아웃을 따르라.** 스캐폴드의 평면 구조에 코드 누적 금지. `src/main/`, `src/preload/`, `src/renderer/src/`, `src/shared/` 로 분리한 뒤 진행.
3. **새 의존성 추가 시 사용자 확인.** TRD §2 표 밖이면 PR 설명에 사유 명시.
4. **Electron 보안 옵션은 항상 명시.** 기본값 의존 금지. 위 code block 참고.
5. **테스트 동반.** 어댑터 정규화, reducer, IPC 스키마는 단위 테스트와 함께 작성 (TRD §10).
6. **`package.json` 메타데이터는 템플릿 기본값이다.** 첫 도메인 PR 에서 `name`, `productName`, `description`, `author` 갱신. `electron-builder.yml` 도 검토.
7. **TRD 와 코드가 충돌하면 사용자에게 물어라.** TRD 갱신과 코드 변경은 같은 PR 또는 짝 PR 로.

## 위치 규약

- 사용자 의도 트랜스크립트 → `chats/` (참조: `chats/CLAUDE.md`)
- 제품 정의 / 구현 사양 / 전략 문서 → `docs/` (참조: `docs/CLAUDE.md`)
- 디자인 프로토타입 → `project/` (참조: `project/CLAUDE.md`)
- 실 구현체 → `app/` (여기)
- 저장소 전체 진입점 → `./CLAUDE.md`
