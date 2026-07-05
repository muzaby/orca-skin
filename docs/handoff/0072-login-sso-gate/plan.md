# Plan — 0072-login-sso-gate

## 메타

| 항목 | 값 |
|---|---|
| slug | `0072-login-sso-gate` |
| 작성자 | Claude Code |
| 일자 | 2026-07-05 |
| 매핑 | PHASES "로그인 SSO 게이트" 행 / 브랜치 `claude/login-page-design-inricr` |
| 상태 | READY → 구현 완료(Claude 직접) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① 클로드코드 로그인 페이지(첨부 이미지1) 참고 랜딩. **흰 배경 + 검정 `SSO로 로그인` 버튼 1개만**. ② 중앙 '로그인' 제목을 오르카(첨부 이미지2)로 **대체**. ③ 앱 실행 시 로그인 렌더 → SSO 시도 → **성공=`/new` 이동, 실패=버튼 위 빨간 메시지**. ④ 디버그 패널 "SSO 로그인" 그룹 + 버튼 2개(**bypass**=앱 시작 시 로그인 건너뜀 · **SSO 개발 버튼**=콘솔 출력만). ⑤ SSO 버튼 = **항상 실패** 배선 + **inflight**("로그인 중" 텍스트 + 애니메이션). | 라이브 세션 요청(첨부 이미지 2장 + 지시문) + AskUserQuestion 응답 4건("흰 배경+검정 버튼"·"제목 제거하고 오르카로 대체"·"첨부 PNG 직접 추가") |
| 추론 의도 | 로그인은 사이드바 없는 **풀-프레임**(이미지1 = 사이드바 없음). bypass 는 **영속**(재시작 후에도 스킵 = "앱 시작 시" 문구 해석). SSO 성공 분기는 향후 실로직 교체용으로 코드만 완비. | 추론 — 이미지1 구성 + "앱 시작 시 건너뜀" 문구 |

## Context (왜)

Orca 앱(`app/`)에는 로그인/인증 화면이 없었다(호스트 CLI 인증 모델, 자격증명 미저장). 사용자는 디자인/스킨 성격의 **로그인 랜딩 + 부팅 게이트**를 원하며, 실제 SSO 백엔드는 미도입이라 **항상 실패**로 배선하되 inflight/성공/실패 UX 와 디버그 훅(bypass·개발 버튼)을 미리 갖춘다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 셸 조립은 `AppLayout` 이 `Header + Sidebar + <main><AppRouter/></main> + OverlayLayer` 를 항상 렌더 — 게이트는 `<AppLayout/>` 자리에 삽입 | `app/src/renderer/src/app/AppLayout.tsx` · `App.tsx` |
| 프레임리스(`frame:false`) — 타이틀바는 `Header.tsx`(드래그 레이어) + `WinControls.tsx`(min/max/close). 이미지1 상단 바와 동형 | `app/src/main/index.ts` · `app/src/renderer/src/app/{Header,WinControls}.tsx` |
| 디버그 패널은 `import.meta.env.DEV && <DebugPanel/>` 로 `OverlayLayer`(=AppLayout) 안에서만 렌더 → 게이트가 AppLayout 을 가리면 안 보임(항상-실패 로그인에 갇힘) | `app/src/renderer/src/app/OverlayLayer.tsx:55` |
| `DebugMockState`(debug 패널 상태)는 **비영속** — 재시작 시 리셋. bypass 영속 불가 | `docs/IPC_CONTRACT.md §2.13(259)` · `app/src/main/app/bootstrap.ts:73`(in-memory 필드) |
| `Settings` 는 electron-store 로 **영속**(zod 검증·부팅 재개). bypass 의 올바른 영속 홈 | `app/src/main/infra/settings-store.ts` · `app/src/shared/protocol.ts:344` |
| 레이어 경계 `default:'disallow'`, features↔features 교차 import 금지 | `app/eslint.config.mjs:74` |
| 검정 버튼 = `Button variant="primary"`(=`bg-ink`/`text-bg`), 실패색 `text-bad`(#b54a3a) | `app/src/renderer/src/shared/ui/Button.tsx:63` · `styles/tokens.css:47` |
| Zustand 채택(`chatStore` 선례) — 로그인 런타임 상태 store | `app/src/renderer/src/features/chat/store/chatStore.ts:117` |
| CSP `img-src 'self' data:` — 번들 PNG(2.7KB<4KB → data URI 인라인) 허용 | `app/src/renderer/index.html` |

## 인수 기준 (Acceptance Criteria)

1. 앱 부팅 시(bypass off·미인증) **로그인 화면**이 렌더된다 — 흰 배경, 사이드바 없음, 슬림 타이틀바(햄버거 좌·min/max/close 우).
2. 중앙 '로그인' 제목 자리에 **오르카 이미지**가 있고, 그 아래 카드에 **검정 `SSO로 로그인` 버튼 1개**만 있다.
3. SSO 버튼 클릭 → 수행 중 **inflight**(버튼 텍스트 "로그인 중" + 스피너, 비활성).
4. SSO 는 **항상 실패** → 버튼 위에 **빨간 실패 메시지**. (성공 경로는 코드상 `authenticated=true`+`/new` 이동으로 완비)
5. 디버그 패널에 **"SSO 로그인" 그룹** — **bypass 토글** + **SSO 개발 버튼**(콘솔 출력만).
6. **bypass=true** 이면 앱 시작 시 로그인 건너뜀(영속) + 디버그 토글에 게이트가 **즉시** 반응.
7. 로그인 화면에서도 디버그 패널이 보여 bypass 로 탈출 가능(갇힘 방지).
8. 게이트 통과: lint·typecheck(3종)·test·build green, 레이어 경계 위반 0, 신규 IPC 채널 0.

## 범위 / 비범위

- **범위**: 로그인 랜딩 UI, 부팅 게이트, 항상-실패 SSO 배선(inflight/성공경로/실패), 디버그 bypass·개발 버튼, bypass Settings 영속.
- **비범위**: 실제 SSO/OAuth 인증(향후 `runSso` 교체), 자격증명 저장, 로그아웃 흐름, 로그인 라우트(`/login`) 등록(게이트가 라우터 앞에서 처리).

## 의존 기술 / 전제

- Zustand(기채택), react-router `useNavigate`/`NavigateFunction`, `settingsApi`(영속), `Button`(primary), Tailwind `animate-spin`.
- **신규 의존성 0.** **신규 IPC 채널 0**(`Settings` 스키마에 `ssoBypass` 필드만 추가 — 기존 settings get/set 재사용).

## 설계

- **`features/login`**(신규 슬라이스): `store.ts`(Zustand — `hydrated/bypass/authenticated/status/errorMessage` + `hydrateBypass/setBypass/attemptSso/resetError`) · `sso.ts`(`runSso`=~800ms 후 throw 항상 실패 · `ssoDevProbe`=console.log) · `components/LoginView.tsx`(오르카+카드+버튼, inflight/error) · `components/SsoDebugSection.tsx`(패널 그룹) · `assets/orca-login.png` · `index.ts` 배럴.
- **`app/RootGate.tsx`**: 부팅 시 `hydrateBypass()` → `!hydrated` 면 null, `bypass||authenticated` 면 `<AppLayout/>`, 아니면 `<LoginFrame/>`. `App.tsx` 가 `<AppLayout/>`→`<RootGate/>`.
- **`app/LoginFrame.tsx`**: 슬림 타이틀바(`Header` 드래그 패턴 재사용 + `WinControls`) + `<LoginView/>` + DEV 시 `<DebugPanel ssoSection={<SsoDebugSection/>}/>`.
- **레이어 경계 해소**: `features/debug`→`features/login` 직접 import 금지 → `DebugPanel` 에 `ssoSection?: ReactNode` 슬롯 prop 신설, app 레이어(`OverlayLayer`·`LoginFrame`)가 주입.
- **재사용**: `shared/ui/Button`(primary) · `shared/ui/FloatingPanel`(+신규 `PanelButton`) · `WinControls` · `settingsApi`.
- **bypass 영속**: `Settings.ssoBypass`(shared `ipc.ts` 인터페이스 + `protocol.ts` `SettingsSchema`.default(false)/`SettingsPatchSchema`). `settings-store` 는 `SettingsSchema.parse({})` 로 default 자동 충전.

## 파생 UX / 엣지케이스

- 상태: inflight(스피너+비활성) · error(빨간 `role="alert"`) · idle. bypass 즉시 반응(store 공유).
- 갇힘 방지: 로그인 화면에도 DebugPanel 렌더.
- 테마: 기본 light = 이미지1 정합. 오르카 PNG = 투명 배경(mix-blend 불요).
- 프레임리스: 로그인 타이틀바 드래그 영역 필수(창 이동).
- 접근성: 버튼 `busy`/`aria-busy`, 오르카 `alt`, 실패 메시지 `role="alert"`.

## 리스크 / 트레이드오프

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| bypass 를 `DebugMockState` 에 두면 재시작 시 리셋(비영속) → "앱 시작 시 스킵" 미충족 | **`Settings`(영속) 로 이전** — 조사에서 debugMock 비영속 확인 후 설계 정정 |
| 오르카 원본 PNG(첨부) 를 에이전트가 파일로 접근 불가 | 첨부 구성(오르카+게+하트)을 **픽셀아트 근사 PNG 로 생성**(투명 배경). 사용자가 원본으로 교체 가능(경로 `features/login/assets/orca-login.png`) |
| 게이트를 AppLayout 분기 대신 별도 프레임으로 | `RootGate` 조기 반환 — 사이드바/헤더 완전 배제(이미지1 정합), 라우터는 인증 후에만 |

- **단독 결정 금지 항목**: 없음(신규 의존성·Open Question 무). 오르카 원본 교체는 사용자 자산 제공 대기.

## 영향 받는 파일

- 신규: `app/src/renderer/src/features/login/**`(store·sso·components·assets·index) · `app/src/renderer/src/app/{RootGate,LoginFrame}.tsx`
- 수정: `App.tsx` · `app/OverlayLayer.tsx` · `features/debug/components/DebugPanel.tsx`(슬롯 prop) · `shared/ui/FloatingPanel.tsx`(`PanelButton`) · `shared/ipc.ts`(Settings) · `shared/protocol.ts`(Settings 스키마) · `docs/IPC_CONTRACT.md`(Settings 필드)

## 참고 문서

- `docs/IPC_CONTRACT.md`(Settings §2.5) · `docs/arch/frontend/`(4-layer) · `app/AGENTS.md`(스타일·경계)

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test && npm run build`.
- 신규 순수 테스트: 없음(스키마 default 는 기존 settings 경로가 커버, UI 는 시각 검증으로 갈음). 기존 스위트 회귀 0.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의: 게이트를 라우터 앞 `RootGate` 로 두는 편이 사이드바 완전 배제에 정확. 슬롯 prop 으로 debug→login 경계 우회 = 표준 해소책(app 주입).
- 정정(자기): 최초 bypass 를 `DebugMockState` 에 뒀으나 `IPC_CONTRACT §2.13`(비영속) 확인 후 **`Settings`(영속) 로 이전** — "앱 시작 시 스킵" 요구를 실제로 만족시키려면 필수.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `.png` 를 비-레이어 `assets/` 에서 import 시 boundaries "unknown element" 위험 | ✅ 자산을 `features/login/assets/` 로 콜로케이트(same-feature 허용) | `eslint.config.mjs:74` default:disallow |
| 2 | bypass 비영속 시 재시작 미스킵 | ✅ `Settings.ssoBypass` 로 영속 | IPC_CONTRACT §2.13 |
| 3 | debug 패널이 로그인 화면 미노출 → 항상-실패 로그인에 갇힘 | ✅ `LoginFrame` 에도 DebugPanel 렌더 | 요구 ⑦ |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 위 "영향 받는 파일" 참조(신규 8·수정 7) |
| 실행 명령 | `npm run lint` · `npm run typecheck` · `npx vitest run` · `npm run build` |
| 게이트 결과 | lint ✅ · typecheck ✅(node/web/test) · test **682 passed** ✅ · build ✅ (파일-레벨 3건 실패 = electron 바이너리 미설치 환경 제한, 변경 무관) |
| 블로커 / 역질문 | 없음. 오르카 원본 PNG 교체는 사용자 자산 대기(근사본 배치됨) |
| 대상 커밋 | (push 후 기재) |
