# 0082 — 도넛 사용량 한도를 선택된 provider 기준으로 (모델 선택 반영)

> 0081 후속 사용자 피드백 1건: "도넛패널이 모델 선택에 따라 주간/월간 사용율이 업데이트되지 않는다." 비기능(버그수정)+소기능 = **Claude 직접 구현**(plan → impl → verify).

## 0. 자료조사

- **버그 원인**: 도넛 `UsagePanel` 의 `usageLimits` 는 페이지가 `useUsageLimits()`(`features/cost/hooks/useUsageLimits.ts`)로 파생 — **전역**(전체 계정 `costStore` summary + 전역 월 한도 Tweak `spendingLimitUsd`). 세션의 선택 provider(`providerKey`)와 무관하므로 모델/provider 를 바꿔도 도넛 주간/월간 바가 그대로다.
- **0080/0081 맥락**: 0080 이 provider별 실집계(`turn_usage ⨝ sessions.provider_key`)+provider별 한도(`provider_limits`)를 도입, 0081 이 도넛 `>` 클릭을 현재 provider 서브탭으로 라우팅. 따라서 도넛 패널 내용도 선택 provider 기준이어야 일관.
- **provider별 데이터 원**: `costApi.providerSummaries([keys])` → `ProviderUsageEntry{providerKey, summary:CostSummary, limitUsd}`(`shared/ipc.ts:141`). `useProviderUsage`(설정 서브탭용)가 이미 사용. `computeUsageLimits(summary, limitUsd)`(`shared/usage/limits.ts:34`)가 뷰 파생(전역/​provider 동일 순수함수).
- **세션 provider**: `useChatSession((s) => s.providerKey)`(`features/chat`, `Composer.tsx:102`). 모델 선택 시 `setModel(providerKey,…)` 로 갱신 → providerKey 반응. 3 페이지 중 New/Project 는 이미 `useChatSession` import, ChatPage 는 미import.
- **턴 종료 시 갱신 신호**: `costStore.lastUpdatedAt`(`costStore.ts:11`, summaryEvent 수신 시 갱신). 이걸 refetch 트리거로 쓰면 턴 후 도넛도 최신 반영.

## 1. 사용자 의도 (명시)

1. **도넛 패널의 주간/월간 사용율이 현재 선택된 provider(모델 선택) 기준으로 표시·업데이트**되어야 한다. (모델/provider 전환 시 도넛 바가 그 provider 의 실사용/한도로 바뀐다.)

## 2. 의존 기술·전제

- 신규 의존성/IPC/DB 0. 기존 `costApi.providerSummaries`·`computeUsageLimits`·`costStore` 재사용.
- providerKey 없음(새 채팅·미선택) 폴백 = 전역 한도(`useUsageLimits`) — 기존 동작 보존.

## 3. 인수 기준 (verify 1:1 대조)

1. 신규 훅 `useProviderUsageLimits(providerKey)`(`features/cost/hooks/`): providerKey 있으면 `costApi.providerSummaries([key])` 로 그 provider 의 `ProviderUsageEntry` 를 조회해 `computeUsageLimits(entry.summary, entry.limitUsd)` 반환, 없으면(또는 조회 전/불일치) 전역 `useUsageLimits()` 폴백. `costStore.lastUpdatedAt` 변경(턴 종료) 시 재조회.
2. providerKey 전환 시 이전 provider 엔트리를 그대로 쓰지 않는다(`entry.providerKey===providerKey` 가드 — 조회 대기 중엔 전역 폴백).
3. 3 페이지(`ChatPage`/`NewChatLandingPage`/`ProjectLandingPage`)가 `useUsageLimits()` 대신 세션 `providerKey` 로 `useProviderUsageLimits(providerKey)` 를 파생해 `usageLimits` 로 주입. ChatPage 는 `useChatSession` import 추가.
4. `useProviderUsageLimits` 를 `features/cost` 배럴에 노출. 레이어 경계 0(파생은 page 에서, Composer↛cost 직접 import 없음).
5. 게이트 lint/typecheck/test 통과. 도넛 클릭 라우팅(0081)·설정 서브탭(0080)·전역 /cost 플레이스홀더(0081)는 무회귀.

## 4. 파생 UX·엣지케이스

- 새 채팅/랜딩에서 providerKey null → 전역 한도(기존과 동일). 모델 선택 즉시 provider 기준으로 전환.
- provider 전환 직후 조회 대기(수십 ms) 동안 전역 폴백 → 곧 provider 값으로. 짧은 플리커 허용.
- 턴 종료로 costStore 갱신 시 provider 엔트리도 재조회(도넛이 최신 사용량 반영).
- 삭제된/미구성 providerKey → providerSummaries 가 해당 키 미반환 → 전역 폴백.

## 5. 리스크·트레이드오프

- 도넛이 전역→provider 기준으로 의미가 바뀐다(사용자 요청). 전역 총사용량은 설정 전역 탭(/cost, 추후)·다른 곳에서.
- provider 엔트리 조회를 도넛 렌더 경로(페이지)에서 1 IPC — 단일 키·턴/선택 변경 시에만. 비용 무시 가능.

## 5. 설계 self-review 체크리스트

- [x] 버그 원인 근거(파일:라인) 명시
- [x] 인수 기준 번호화(1:1 대조)
- [x] 신규 의존성/IPC/DB 0
- [x] 레이어 경계(page 파생) 보존
- [x] 폴백(providerKey null/미구성/조회대기) 명시

## [구현자 기입] — Claude 직접 구현

- **변경 파일**: `features/cost/hooks/useProviderUsageLimits.ts`(신규) · `features/cost/index.ts`(배럴) · `pages/ChatPage.tsx`(+`useChatSession` import)·`pages/NewChatLandingPage.tsx`·`pages/ProjectLandingPage.tsx`(providerKey 파생 주입).
- **게이트**: `npm run lint` 0(경계·hooks 규칙 0) · `npm run typecheck` 3종 0 · `npx vitest run` **753/753 runnable green**(3 suite=electron 바이너리 403 환경 제한·무관).
- **설계 리뷰**: 인수 5/5 구현. 파생을 page 에서 수행해 Composer↛cost 교차 import 회피(레이어 경계 0).
- **놓친 잠재 문제 + 대응**: (a) 초기 설계의 `setEntry(null)`(providerKey 없을 때 즉시 clear)이 `react-hooks/set-state-in-effect` lint 위반 → **제거**하고 memo 가드(`entry.providerKey===providerKey`)가 stale 엔트리를 무시(전역 폴백)하도록 정리 — 동작 동일·경고 0(선조치). (b) `useMemo` deps 의 `global` 은 `useUsageLimits` 내부 memo 로 안정(summary/limit 변경 시에만 갱신) → 무한 재렌더 없음.
