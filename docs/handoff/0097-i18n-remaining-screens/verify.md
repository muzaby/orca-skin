# Verify — i18n-remaining-screens

## 메타

| 항목 | 값 |
|---|---|
| slug | `0097-i18n-remaining-screens` |
| 검증자 | Claude Code |
| 일자 | 2026-07-12 |
| 대상 커밋 | `899bb45`~`d61867c` (C1~C7) |
| 라운드 | 1 |
| 상태 | **PASS** (에이전트 판정 범위) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

> 비기능 = Claude 직접 구현이라 설계자=구현자=검증자 동일 주체. plan `[구현자 기입]` 의 이견/선조치를 검증 관점에서 재대조했다.

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 1 — before/after 분해 대신 `Trans`+태그(`<hl>`/`<mono>`/`<c>`) | 타당 — resources.test 빈 값 금지와의 충돌을 라이브러리 표준 기능으로 해소, 신규 의존성 0 | 매트릭스 #3·#8 증거로 채택 |
| 이견 2 — `UiMessage` 판별 유니온 신설 | 타당 — D6 "키 저장" 의 일반화, 원문 통과와 키 폴백의 타입 구분 | 매트릭스 #9 증거 |
| 선조치 ✅ #1(CustomizeList open 키) #2(plural 쌍) #3(Markdown 이미지) | 구현 세부/명백한 누락 범위 — 선조치 경계 내 | 매트릭스 #2·#5 반영 |
| 선조치 ⚠️ #4(언어 자기표기) #5(마커/원문 잔존) | 결정 불요(기존 관례·설계 확정) — 사람 확인 대기 항목으로만 표기 | 아래 책임 분리표 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | 각 구현 커밋 게이트 통과 | ✅ | C1~C7 각 커밋 시점 lint/typecheck/vitest 실행(구현 보고). 최종 재실행: lint 0 · typecheck 3종 0 · vitest **821/821** · scripts **24/24** (아래 게이트 로그) |
| 2 | 사용자 노출 한글 리터럴 잔존 = 화이트리스트만 | ✅ | 전수 grep(주석·테스트·카탈로그 제외) 잔존 = ① `datetime.ts:107-108`(D7 locale-파라미터 예외) ② `SidebarUserButton:14` 언어 자기표기 ③ `chatStore.ts` `CONTINUITY_TITLE_MARKER`(영속 마커, D3 주석) ④ `parts.ts:124` 합성 aborted 데이터 파트 ⑤ `updateStore.ts:38` dev 더미 releaseNotes ⑥ `CustomizeList:137` main 데이터 키('Orca 스킬') — 전부 D8 화이트리스트 |
| 3 | ko 표시 결과 전후 동일 | ✅ | 카탈로그 값 = 원문 복사-이동(리라이트 0). ko 리터럴 고정 테스트: `toolMeta.test.ts`(실행됨/읽는 중 등)·`modes.test.ts`(계획/기본/권한 우회)·`statusViewModel.test.ts`(pill/actionButton 카피). 무수정 통과: `datetime.test.ts`·`chatStore.test.ts`(`[분기] 원본 세션`)·`parts.settle-orphan.test.ts` |
| 4 | 모듈 상수 stale 0 (라이브 전환) | ✅(구조) | 번역 결과를 굳힌 모듈 상수 0 — 전 Record 가 키맵(`VERB_KEY`·`MODE_OPTIONS.labelKey`·`STATUS_COPY_KEYS`·`STATUS_KEY`(update)·`SCENARIO_LABEL_KEYS`·`rightPanelTileDefinitions.defaultLabelKey`·`ERROR_CATEGORY_KEYS`·capability 키맵) + 렌더 `tr()` 해석. **실기 라이브 전환은 사람 확인 대기**(환경상 Electron 실행 불가) |
| 5 | 도구 그룹 카운트 plural | ✅ | `chat.toolMeta.unit.*_one/_other`(ko 동일 값·en 단/복수) + `ToolGroup.tsx` `tr(unitKey, { count })`. typed t() plural 해석 = typecheck 통과로 확인 |
| 6 | `summarizeToolGroup` 제거·세그먼트 구조화 후 ko 렌더 동일 | ✅ | `toolMeta.ts` — `ToolGroupSegment={category,n,hasError}`·`summarizeToolGroup` 삭제(프로덕션 소비자 0 grep 확인). `ToolGroup.tsx` 가 동일 순서(CATEGORY_ORDER)·동일 span 구조로 조립, ko 값 동일(`명령 {{count}}개` = 구 `명령 N개`) |
| 7 | `[분기]/[핸드오프]` 마커·`/compact` 메시지 바이트 불변 | ✅ | `chatStore.ts` `CONTINUITY_TITLE_MARKER` 값 '분기'/'핸드오프' 원문 유지(파라미터만 'fork'\|'handoff' 시맨틱화). `chatStore.test.ts` `'[분기] 원본 세션'` 무수정 통과, main `orchestration/handoff.test.ts` 무접촉·통과 |
| 8 | `resources.test.ts` 신규 키 포함 통과 | ✅ | 리프 재귀 순회로 신규 ~330 키 자동 커버 — 패리티/빈값/플레이스홀더 3항목 green(vitest 821 포함). `Trans` 태그(`<hl>` 등)·plural 쌍도 리프로 검사됨 |
| 9 | store 에러 = 키 저장 + 렌더 번역 | ✅ | `shared/i18n` `UiMessage`/`uiMessageText` + login(`errors.loginFailed`)·updateStore(`errors.updateDownloadFailed`/`updateInstallFailed`)·agentStore(`errors.agentListFailed`)·useEngines(`errors.engineMutationFailed`)·providerCatalog(`errorKey`+params). 렌더 해석: LoginView·UpdateDialog·AgentEnvironmentView·EngineFormModal — 언어 전환 시 표시 중 문구 갱신(키 저장이므로) |
| 10 | OS 알림 body 현재 locale | ✅(구조) | `useCompletionNotifier.ts` — `tr('notify.completeBody')` + effect deps `tr`. **실 발송은 사람 확인 대기**(Electron 실행 불가) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | green (아래 로그) |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 10/10 (4·10 은 구조 검증까지) |
| 레이어 경계 위반 0 | ✅ | — | eslint boundaries 포함 lint 0 (i18n 은 shared — features→shared 하향만) |
| 문서 형식/링크/한국어 | ✅ | — | plan/verify/INDEX/PHASES 한국어·표 중심 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | AGENTS.md 무변경 — 해당 없음 |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | ko 무변 원칙 준수 — 사람 스팟체크 권장 |
| UI/UX 시각 검증(라이브 en 전환·플래시) | ✖ | ✅ | **사람 확인 대기** — `npm run dev` 후 설정→언어 en 전환 실기 |
| en 카피 어감(기계 초벌 ~330 키) | ✖ | ✅ | **사람 확인 대기** — `resources/en.ts` 값만 수정하면 됨 |
| 신규 의존성 승인 | ✖ | ✅ | 신규 0 (`Trans` 는 기존 react-i18next) |
| PR 머지 승인 | ✖ | ✅ | 사용자 요청 시 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # eslint(boundaries 포함) — 에러 0
$ npm run typecheck               # node/web/test 3종 — 에러 0
$ npm test                        # vitest 821 passed (821) + scripts 24/24
  Test Files  2 failed | 108 passed (110)   ← 실패 2 suite = electron 바이너리 403 환경 제한
  Tests       821 passed (821)                 (chat-turn.continuity / history/writer — 0092~0096 동일 베이스라인)
$ grep -rnP "한글 리터럴" src/renderer/src (주석·테스트·카탈로그 제외)
  → 잔존 = D8 화이트리스트 6종만 (매트릭스 #2)
```

## 위생 검토

- 키/토큰/이메일/IP 패턴 스캔: 신규/변경 파일 grep 0.
- 변동성 정보 혼입: 없음 — 상태는 INDEX/PHASES, 카탈로그는 코드.

## PHASES.md 정합성

- 0097 행 승격(범위·커밋 C1~C7) + Future Scope "다국어 잔여 화면 마이그레이션" 항목 해소 갱신 — 본 검증 커밋에 포함.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: `resources.test` 의 빈 값 금지 규칙이 before/after 키 분해와 충돌함을 사전에 못 봤다(구현 중 `Trans` 로 선회). 위생 테스트 규칙도 설계 입력으로 읽을 것.
- 구현 단계: 인벤토리가 `Markdown.tsx` 이미지 플레이스홀더를 놓쳤다 — JSX 표현식 내부 문자열은 라인 grep 에 안 걸린다. 최종 sweep 이 백스톱으로 잡았다.
- 검증 단계: Electron 실행 불가 환경이라 라이브 언어 전환·OS 알림·`Trans` 마크업 실렌더는 구조 검증까지만 — 사람 시각 검증에 위임. plural 의 Electron ICU 동작(en '1 command')도 실기 확인 권장.

## 결론 / 다음 단계

- 상태: **PASS** (r1, 에이전트 판정 범위) → PHASES 승격.
- 사람 확인 대기: ① `npm run dev` 라이브 en 전환(랜딩·모달·디버그 패널·채팅 transcript/composer 전 표면) ② en 카피 어감(`resources/en.ts`) ③ OS 알림 body 실 발송 ④ PR 머지.
- 후속 후보(범위 밖 명시): `[분기]/[핸드오프]` 마커 locale 화(main locale 인지 필요) · LLM 응답 언어(`language`) 컨트롤 UI · `clock.ts` 기간 경계 타임존화.
