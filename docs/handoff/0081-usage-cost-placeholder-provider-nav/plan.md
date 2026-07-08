# 0081 — 사용량 UI 피드백 (진행바 색 · 도넛→provider 탭 · 설정 사용량 /cost 플레이스홀더)

> 0080 후속 사용자 피드백 3건. 비기능+소기능 = **Claude 직접 구현**(plan → impl → verify). 라이브 Codex 부재.

## 0. 자료조사

- **0080 산출물**(`2130af0`): `Meter`/`UsageCircle` low tone = 파랑(`--color-indigo`), 설정 사용량 탭(`UsageTab` 전역 한도 바+월 한도 설정) + provider 서브탭(`ProviderUsageTab`) + 도넛 `UsagePanel` `>` 클릭. 진입점은 `INDEX.md` 0080 행.
- 파랑 토큰: `--color-indigo: #4a5b8c`(`styles/tokens.css:40`, named 팔레트). **사용처는 `Meter.tsx:9`(`bg-indigo`)·`UsageCircle.tsx:22`(`var(--color-indigo)`) 2곳뿐**(grep 확인) — 다른 컴포넌트 미참조.
- 도넛 클릭 배선: `UsagePanel.onOpenUsageSettings` → `Composer`(`Composer.tsx:657`) → 페이지 콜백(`ChatPage`/`NewChatLandingPage`/`ProjectLandingPage`) → `openSettings('usage')`. Composer 는 세션 provider 를 이미 안다(`Composer.tsx:102` `providerKey`).
- provider 서브탭 라우팅: `providerTabId(key)`(`settingsModalStore.ts:10`) → `provider:<key>`. 현재 `features/settings/index.ts` 배럴은 `providerTabId` 미노출.
- 전역 사용량 탭 데이터 주입: app `SidebarUserButton`(`useUsageLimits`·`useCostRefresh`·`useProviderUsage`) → `SettingsModal`(`usageLimits`·`costRefresh`·`providerUsage`). 전역 `UsageTab` 만 `usageLimits`·`costRefresh` 사용, provider 서브탭은 `providerUsage`.
- `SyncRow`·`CostRefreshView` 는 `UsageTab.tsx` 정의, `ProviderUsageTab` 이 `SyncRow` 를 import(전역 탭에서 제거해도 유지 필요).
- Claude Code `/cost`: 세션 총비용·토큰(입력/출력/캐시)·모델별 내역 표시. 사용자 요구 = **안내문구+"추후 구현"만**(실집계 미구현).

## 1. 사용자 의도 (명시)

1. **도넛패널/설정.사용량 하위 페이지의 진행바 파란색을 `#2a78d6`** 으로.
2. **도넛에서 '사용량 한도' 클릭 시 현재 composer 에서 선택된 provider 서브탭으로 이동**(전역 '사용량' 탭이 아니라).
3. **설정.사용량(전역) 페이지 내용 교체**: 기존 사용량 한도 바 + 한도 설정은 provider 하위 탭으로 이관되었으므로 **전역 탭에서 모두 제거**하고, Claude Code `/cost` 유사 기능 자리로 **안내문구 + "추후 구현" 표시**만 둔다.

## 2. 의존 기술·전제

- 신규 의존성 0. 신규 IPC 0. 신규 DB 0. 색상 토큰 값만 변경(#4a5b8c→#2a78d6, 토큰명 `--color-indigo` 유지 — 사용처 2곳 국소).
- `providerKey` null(미선택)/미구성(삭제) 폴백 = 전역 '사용량' 탭.

## 3. 인수 기준 (verify 1:1 대조)

1. `--color-indigo` 값이 `#2a78d6`. `Meter`(`bg-indigo`)·`UsageCircle`(progress arc low) 진행바 파랑이 전부 새 값 사용(임계 0.6/0.85·warn/bad 무변).
2. `onOpenUsageSettings` 시그니처가 `(providerKey?: string) => void`. `Composer` 가 세션 `providerKey` 를 전달. 3개 페이지 콜백이 `openSettings(key ? providerTabId(key) : 'usage')`. `providerTabId` 를 `features/settings` 배럴에 노출.
3. 도넛 '사용량 한도' `>` 클릭 시 현재 provider 서브탭(`provider:<key>`)이 열린다. providerKey 없음/미구성 시 전역 '사용량' 탭.
4. 전역 `UsageTab` 에서 **한도 바(`LimitBarsSection`)·동기화(`SyncRow`)·"한도 설정" 섹션·`LimitEditor` 진입 전부 제거**. 대신 `/cost` 유사 안내(총비용·토큰·모델별 내역 예고) + **"추후 구현" 배지/문구** 표시.
5. `UsageTab` 이 `usageLimits`·`costRefresh` props 를 더 이상 받지 않는다(제거). `SettingsModal`·`SidebarUserButton` 주입에서도 제거(unused 0). provider 서브탭(`ProviderUsageTab` + `SyncRow`)은 무변.
6. 게이트 lint(경계 0·unused 0)/typecheck 3종/test 통과. 레이어 경계 0.

## 4. 파생 UX·엣지케이스

- 도넛에서 provider 미선택(새 채팅, providerKey null) → 전역 사용량 탭(플레이스홀더)로. 삭제된 provider → SettingsModal 이 "provider 를 찾을 수 없습니다"(0080 기존 분기).
- 전역 탭 플레이스홀더는 정적(로딩/에러 없음). 라이트/다크 토큰 사용.
- provider 서브탭·도넛은 파랑 진행바 유지(색만 교체).

## 5. 리스크·트레이드오프

- 토큰명 `--color-indigo` 가 값(#2a78d6, 파랑)과 의미상 어긋나지만 국소 사용(2곳)이라 리네임 churn 회피 — 주석으로 용도 명시.
- 전역 탭에서 `usageLimits`/`costRefresh` 제거 시 app 주입도 정리 → `SidebarUserButton` 이 `useUsageLimits`/`useCostRefresh` 를 더는 호출 안 함(페이지 도넛 경로는 무관·유지).

## 5. 설계 self-review 체크리스트

- [x] 인수 기준 번호화(1:1 대조 가능)
- [x] 사용자 의도 명시 3건(추론 없음 — 피드백 직접)
- [x] 신규 의존성/IPC/DB 0
- [x] 레이어 경계 유지(provider 라우팅은 페이지 콜백 경유, Composer↛settings 직접 import 없음)
- [x] 폴백 경로(providerKey null/미구성) 명시

## [구현자 기입] — Claude 직접 구현

- **변경 파일**:
  - 색: `styles/tokens.css`(`--color-indigo` #4a5b8c→#2a78d6).
  - 도넛→provider: `features/chat/components/UsagePanel.tsx`(`onOpenUsageSettings` 무변 — provider 미인지) · `Composer.tsx`(콜백에 `providerKey` 전달) · `ChatView.tsx`·`ChatTile.tsx`(시그니처 통과) · 3 페이지(`ChatPage`/`NewChatLandingPage`/`ProjectLandingPage`, `openSettings` 라우팅) · `features/settings/index.ts`(`providerTabId` 노출).
  - 전역 탭: `features/settings/components/UsageTab.tsx`(플레이스홀더로 축소·props 제거·`SyncRow`/`CostRefreshView` 유지) · `SettingsModal.tsx`(`usageLimits`·`costRefresh` props 제거) · `app/SidebarUserButton.tsx`(주입 정리).
- **게이트**: `npm run lint` 0(경계·unused 0) · `npm run typecheck` 3종 0 · `npx vitest run` **753/753 runnable green**(3 suite=electron 바이너리 403 환경 제한·0050/0080 계열·본 변경 무관). better-sqlite3 는 `npm rebuild` 후 DB 테스트 green(Node ABI).
- **설계 리뷰**: 인수 6/6 구현. provider 라우팅은 페이지 콜백 경유(Composer↛settings 직접 import 없음)로 레이어 경계 보존. 색은 토큰 값만 교체(사용처 2곳 국소, 리네임 churn 회피).
- **놓친 잠재 문제 + 대응**: (a) `providerKey ?? undefined` — 세션 provider 가 `null`이면 전역 탭 폴백(인수 3). (b) `SyncRow`/`CostRefreshView` 는 전역 탭에서 빠졌지만 `ProviderUsageTab` 이 계속 소비 → `UsageTab.tsx` 에 export 유지(선조치). (c) `SettingsModal` 서명 prettier 1줄 정규화(lint --fix) 수용.
