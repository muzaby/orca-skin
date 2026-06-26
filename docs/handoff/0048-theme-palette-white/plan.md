# Plan — 0048-theme-palette-white

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 비기능(UI 스타일링/리팩토링) = Claude 가 plan→impl→verify 직접 수행.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0048-theme-palette-white` |
| 작성자 | Claude Code |
| 일자 | 2026-06-26 |
| 매핑 | PHASES 행 / PR (impl 후) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "테마 팔레트에서 클래식과 쿨 제거하고 화이트로 대체하겠다. 클로드 코드(웹)의 컬러를 참고하라." | 라이브 세션 요청(첨부 스크린샷 = Claude Code 웹 UI) |
| 명시 요구 | 화이트 표면 톤 = **뉴트럴 니어화이트**(배경 #ffffff, 사이드바/카드는 아주 옅은 중립 그레이, 따뜻한 아이보리 기 제거). 강조색은 Claude 코랄/러스트 `#c96442` 유지. | AskUserQuestion 응답("뉴트럴 니어화이트 (추천)") |

## Context (왜)

기존 테마 팔레트는 **classic(따뜻한 아이보리)·dark·cool(블루)** 3종(`app/src/renderer/src/shared/config/theme.ts`). 사용자는 classic·cool 을 없애고 Claude Code 웹의 뉴트럴 화이트 1종으로 단순화하길 원한다. 결과 팔레트: **white(루트 기본) + dark** 2종.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 테마 토큰 정본: 루트 `@theme` = 기본 팔레트(classic), `[data-theme='dark'\|'cool']` 가 오버라이드. classic 은 오버라이드 블록 없음 → 루트 기본값 사용 | `app/src/renderer/src/styles/tokens.css:5-195` |
| `TweakProvider` 가 `html[data-theme]=t.theme` 설정. 'white' 는 오버라이드 없이 루트 기본값 사용 | `app/src/renderer/src/shared/theme/TweakProvider.tsx:17` |
| ThemeId/ThemePref/zod enum 4곳에 `'classic'\|'dark'\|'cool'` 리터럴 | `config/theme.ts:1` · `shared/ipc.ts:609` · `shared/protocol.ts:308,331` |
| 디버그 패널 컬러 팔레트 라디오(클래식/다크/쿨) | `features/debug/components/DebugPanel.tsx:64-68` |
| shiki 코드블럭 테마 매핑: dark→github-dark, cool→one-light, 기본→github-light | `shared/ui/markdown/CodeBlock.tsx:19,36-38` |
| 설정 로드 fallback: 전체 parse 실패 시 **모든** default 로 리셋(다른 설정 손실) | `app/src/main/settings/store.ts:15-20` |
| 스타일 가이드: 새 토큰은 "세 테마 스코프(classic/dark/cool) 전부" 채우라는 규칙 | `app/AGENTS.md` 스타일링 절 |

## 인수 기준 (Acceptance Criteria)

1. `ThemeId`·`ThemePref` 타입과 zod enum 2곳이 `'white' | 'dark'` 로 통일된다.
2. 기본 테마가 `white`(루트 `@theme` 팔레트 = 뉴트럴 니어화이트). 디스크에 남은 옛 값(`classic`/`cool`)은 `.catch('white')` 로 화이트로 강등되며 **다른 설정(density/sidebarWidth 등)은 보존**된다.
3. `tokens.css` 루트 `@theme` 가 뉴트럴 니어화이트(bg #ffffff·sidebar/card 중립 그레이·코랄 강조 유지), `[data-theme='cool']` 블록 제거, `[data-theme='dark']` 유지.
4. 디버그 패널 컬러 팔레트 라디오가 **화이트/다크** 2종.
5. 코드블럭 테마가 white→github-light, dark→github-dark 로 매핑(미사용 `one-light` 제거).
6. 게이트 4종 통과(lint/typecheck/typecheck:test/test). 레이어 경계 0, 신규 의존성 0, IPC 채널/DB 스키마 변경 0.

## 범위 / 비범위

- **범위**: 테마 enum·기본값·tokens.css 팔레트·디버그 라디오·코드블럭 매핑·옛 값 마이그레이션·주석/AGENTS.md 정합.
- **비범위**: 새 테마 추가, 테마 선택 UI 를 디버그 패널 밖으로 노출(별도 요구), tokens.css 외 컴포넌트별 색 튜닝.

## 의존 기술 / 전제

- zod `.catch()` 로 잘못된 enum 값 그레이스풀 강등. SDK/신규 의존성 0.
- white = 루트 `@theme` 기본값 전략(별도 `[data-theme='white']` 블록 불필요 — classic 과 동일 메커니즘).

## 설계

- enum/타입 4곳 + DEFAULTS.theme + 디버그 라디오 + CodeBlock 매핑 동시 갱신.
- `tokens.css` 루트 `@theme` 시맨틱 토큰을 뉴트럴 니어화이트로 교체(아래 영향 파일), `t3` press 표면 중립화(#e8e8e6), `cool` 블록 삭제.
- 마이그레이션: `SettingsSchema.theme` 에 `.catch('white')` 추가 → `readSafe` 전체-리셋 경로 회피로 사용자 다른 설정 보존.
- 레이어: 렌더러 shared/features/styles + main shared(protocol)·settings 무변경 로직. 경계 영향 0.

## 파생 UX / 엣지케이스

- 옛 설정 마이그레이션: `classic`/`cool` → `white`(catch), 나머지 보존.
- 테마 2종: white(라이트)·dark. 코드블럭·에러색(`bad` 토큰, 0038) 등 토큰 추종 컴포넌트는 자동 재테마.
- 접근성: 코랄 강조색 유지로 기존 대비비 변화 최소.

## 리스크 / 트레이드오프

| 리스크 | 완화책 |
|---|---|
| tokens.css 구체 hex 가 디자인 의도와 미세 차이 | 사용자 GUI 시각 검증 항목으로 분리(아래 검증). 토큰 1곳만 조정하면 전 트리 재테마 |
| 옛 `cool` 사용자의 파란 강조색 → 코랄로 변경 | 의도된 결과(쿨 제거). catch 로 무에러 강등 |

- 되돌리기 어려운 결정: 없음(색/enum 변경, 스키마 구조 불변).

## 영향 받는 파일

- `app/src/renderer/src/styles/tokens.css`(핵심) · `app/src/renderer/src/shared/config/theme.ts` · `app/src/renderer/src/shared/hooks/useTweaks.ts`
- `app/src/shared/protocol.ts` · `app/src/shared/ipc.ts`
- `app/src/renderer/src/features/debug/components/DebugPanel.tsx` · `app/src/renderer/src/shared/ui/markdown/CodeBlock.tsx`
- 주석/문서: `app/AGENTS.md` · `app/src/renderer/src/shared/ui/Button.tsx` · `app/src/renderer/src/features/engine/components/EngineFormModal.tsx`

## 게이트

- `cd app && npm run lint && npm run typecheck && npm test`(better-sqlite3 Node ABI 빌드 후 green).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 + AskUserQuestion 응답 인용.
- [x] 자료조사 — 모든 발견 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — zod .catch, 신규 의존성 0.
- [x] 파생 UX — 마이그레이션·테마 2종·접근성.
- [x] 리스크 — 색 미세차/쿨 강조색 변경 완화.

---

> **[구현자 기입]** — Claude(비기능) 구현 턴.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: white=루트 `@theme` 기본값 전략이 classic 과 동일 메커니즘이라 `[data-theme='white']` 블록 없이 최소 변경으로 성립. `.catch('white')` 가 `readSafe`(`store.ts:15`)의 전체-리셋을 피하는 정확한 지점.
- 우려: tokens.css hex 는 디자인 정밀값이 아니라 제안값 — GUI 시각 검증으로 사용자가 미세 조정 필요(검증 책임 분리에 명시).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `CodeBlock.THEMES` 에 미사용 `one-light` 가 남으면 shiki 번들에 불필요 테마 로드 | ✅ `THEMES` 배열에서 `one-light` 제거(매핑 제거와 함께) | `CodeBlock.tsx:19` |
| 2 | `--color-t3`(press 표면) 루트값이 warm `#eae8df` 로 남아 화이트와 톤 불일치 | ✅ `#e8e8e6` 중립화 | `tokens.css` epitaxy 비-alias |

## [구현자 기입] 구현 체크리스트

- [x] ThemeId/ThemePref/zod enum 2곳 → `'white' | 'dark'`
- [x] DEFAULTS.theme = 'white' + SettingsSchema `.catch('white')`
- [x] tokens.css 루트 @theme 뉴트럴 니어화이트 + t3 중립화 + cool 블록 삭제
- [x] DebugPanel 라디오 화이트/다크
- [x] CodeBlock cool→one-light 매핑·THEMES 항목 제거
- [x] 주석/AGENTS.md(세 테마→두 테마) 정합

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | renderer: `styles/tokens.css`·`shared/config/theme.ts`·`shared/hooks/useTweaks.ts`·`features/debug/components/DebugPanel.tsx`·`shared/ui/markdown/CodeBlock.tsx`·`shared/ui/Button.tsx`(주석)·`features/engine/components/EngineFormModal.tsx`(주석) / shared: `protocol.ts`·`ipc.ts` / 문서: `app/AGENTS.md` |
| 실행 명령 | `npm run typecheck` · `npm run lint` · `npm test` |
| 게이트 결과 | typecheck ✅(node+web+test) / lint ✅(boundaries 0) / test **531/531 실행분 green**(better-sqlite3 Node ABI 빌드 후). 2 suites(`persist`·`send.runtime-resilience`) electron 바이너리 미설치(프록시 다운로드 차단) 환경 제한 — import-time 실패, 본 변경 무관(0033/0041~0046 동일 계열) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (push 후 기재) |
