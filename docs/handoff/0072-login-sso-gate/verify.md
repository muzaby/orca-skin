# Verify — 0072-login-sso-gate

## 메타

| 항목 | 값 |
|---|---|
| slug | `0072-login-sso-gate` |
| 검증자 | Claude Code |
| 일자 | 2026-07-05 |
| 대상 커밋 | (push 후 기재) |
| 라운드 | 1 |
| 상태 | PASS |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 자기-정정: bypass `DebugMockState`→`Settings`(영속) | 타당 — debugMock 비영속 확인(IPC_CONTRACT §2.13). 요구 ⑥ 충족 필수 | 기준 #6 매트릭스에 영속 증거 반영 |
| 선조치 #1 자산 콜로케이트 | 타당 — boundaries default:disallow 회피 | lint 위반 0 로 확인 |
| 선조치 #3 로그인 화면 DebugPanel | 타당 — 요구 ⑦ | 기준 #7 시각 증거 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 부팅 시 로그인 화면(흰 배경·사이드바 없음·슬림 타이틀바) | ✅ | `app/RootGate.tsx`(미인증→`<LoginFrame/>`) · `app/LoginFrame.tsx`(header 햄버거+`WinControls`, `bg-bg`) · Playwright idle 스크린샷 |
| 2 | 오르카가 제목 대체 + 검정 SSO 버튼 1개 | ✅ | `features/login/components/LoginView.tsx`(`<img orca>` + `Button variant="primary"` "SSO로 로그인") · 스크린샷 |
| 3 | inflight("로그인 중"+스피너·비활성) | ✅ | `LoginView.tsx`(`status==='inflight'`→스피너+텍스트, `busy`) · inflight 스크린샷 |
| 4 | 항상 실패 → 빨간 메시지, 성공 경로 완비 | ✅ | `features/login/sso.ts`(`runSso` throw) · `store.ts`(`attemptSso` catch→`text-bad` 메시지 / try→`authenticated`+`navigate('/new')`) · error 스크린샷(alert="로그인에 실패했습니다…") |
| 5 | 디버그 "SSO 로그인" 그룹(bypass 토글 + 개발 버튼=콘솔) | ✅ | `features/login/components/SsoDebugSection.tsx`(`PanelSection`+`PanelToggle`+`PanelButton`) · `sso.ts` `ssoDevProbe` console.log · 스크린샷 |
| 6 | bypass=true 앱 시작 스킵(영속) + 즉시 반응 | ✅ | `store.ts`(`setBypass`→`settingsApi.set({ssoBypass})` 영속·store 갱신 → `RootGate` 셀렉터 즉시 반응) · `protocol.ts` `SettingsSchema.ssoBypass.default(false)` |
| 7 | 로그인 화면에서도 디버그 패널(갇힘 방지) | ✅ | `LoginFrame.tsx`(`import.meta.env.DEV && <DebugPanel ssoSection=…/>`) · idle 스크린샷 우측 패널 |
| 8 | 게이트 green·경계 0·신규 채널 0 | ✅ | 아래 게이트 결과 · boundaries 위반 0(lint) · `CHANNELS` 불변(Settings 필드만 추가) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test/build | ✅ | — | 전부 green(아래) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 8/8 ✅ |
| 레이어 경계 위반 0 | ✅ | — | lint 0 |
| 문서 형식/링크/한국어 | ✅ | — | ✅ |
| UI/UX 시각 검증 | ✖(Playwright 근사) | ✅ | **사람 확인 대기**(실제 Electron `npm run dev` — 본 환경은 electron 바이너리 다운로드 차단) |
| 오르카 원본 자산 교체 | ✖ | ✅ | 근사 PNG 배치, 원본 교체는 사용자 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 의존성 0 |
| PR 머지 승인 | ✖ | ✅ | 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run typecheck   → node/web/test 3종 통과
$ npm run lint                  → eslint(boundaries 포함) 통과, 위반 0
$ npx vitest run                → Test Files 3 failed | 85 passed, Tests 682 passed
   (3 파일-레벨 실패 = chat-turn.continuity / chat-turn.runtime-resilience / history/writer:
    "Electron failed to install correctly" — electron 바이너리 미설치 환경 제한, 본 변경 무관.
    better-sqlite3 는 npm rebuild --build-from-source 로 해소하여 682 테스트 전건 green.)
$ npm run build                 → electron-vite build ✓ (오르카 PNG data-URI 인라인, CSP img-src 'self' data: 준수)
```

## PHASES.md 정합성

- `docs/PHASES.md` 에 "로그인 SSO 게이트(handoff `0072-login-sso-gate`)" 행 추가(상태 = 완료, 커밋은 push 후). `docs/handoff/INDEX.md` 0072 행 verify/PASS.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계: bypass 영속 홈을 초안에서 debugMock(비영속)로 잡은 뒤 조사로 정정 — 착수 전 "설정 영속 계층" 조사를 먼저 했으면 1패스로 끝났을 항목.
- 구현: 오르카 원본 미접근 → 근사 생성. 픽셀 정합은 사용자 교체 필요.
- 검증: 시각 검증은 Electron 대신 Vite+Playwright(mock preload)로 근사 — 실제 창 드래그/traffic-light(macOS)·실 IPC 왕복은 미검(사람 확인 대기). 3 테스트 파일은 electron 바이너리 차단으로 로드 불가(환경 제한, 코드 무관).

## 결론 / 다음 단계

- 상태: **PASS** → PHASES 승격 · (사용자 요청) draft PR. 사람 확인 대기: 실 `npm run dev` 시각/드래그 검증 · 오르카 원본 PNG 교체.
