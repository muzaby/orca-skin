# Plan — i18n-ui-locale

## 메타

| 항목 | 값 |
|---|---|
| slug | `0096-i18n-ui-locale` |
| 작성자 | Claude Code |
| 일자 | 2026-07-11 |
| 매핑 | PHASES "Phase 4 진행 중" / PR (push 후) |
| 상태 | READY → IMPL_DONE → verify |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "i18n 구현하려 한다. 지원외국어는 영어랑 한국어. 타임존도 지원하라." | 라이브 세션 요청 (2026-07-11) |
| 명시 요구 | 추출 범위 = **인프라 + 핵심 화면**(잔여 화면은 후속 분할) | 라이브 세션 AskUserQuestion 응답 |
| 명시 요구 | 라이브러리 = **i18next 도입** (신규 의존성 승인) | 라이브 세션 AskUserQuestion 응답 |
| 명시 요구 | 타임존 = **"OS 자동 감지만 제대로"** — 선택 UI 없음. 이후 보충: "utc 기준. 타임존 맞춰서 시간 보정. 타임존은 로컬 pc" | 라이브 세션 AskUserQuestion 응답 + 후속 메시지 |
| 명시 요구 | 구현 주체 = **Claude 직접** (plan→impl→verify) | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | "핵심 화면" = 설정 모달 전체 + 앱 셸(사이드바·헤더·사용자 메뉴) + 사용량 패널 + 모든 날짜/시간 표시 표면 — 설정에서 언어를 바꾸는 순간 눈에 보이는 크롬이 함께 바뀌어야 기능이 성립하므로 (추론) | 설계 판단 |
| 추론 의도 | 기본 언어 = ko 유지(기존 사용자 무변화), 언어 스위처는 기존 inert 플라이아웃 자리를 활성화 (추론) | `SidebarUserButton.tsx` 기존 UI 자리 |

## Context (왜)

렌더러 UI 문자열이 150+ 파일에 한국어 인라인 하드코딩이고, 날짜/시간 포맷은 전부 `'ko-KR'` 로케일 하드코딩 + OS 로컬 타임존 *암묵* 사용이다. TRD §6.2 N2 가 언급하는 `shared/i18n/ko.ts` 는 future scope 로만 존재했다(`features/chat/lib/toolMeta.ts:28` 주석). 영어 사용자 지원을 위해 i18n 인프라를 세우고, 시간 표시는 "저장 = epoch ms(UTC 절대시각) / 표시 = 로컬 PC(OS) 타임존 보정"을 명시적으로 만든다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| i18n 인프라 부재 — `src/**/i18n` 디렉토리 없음, 관련 라이브러리 0. 유일한 언급은 future-scope 주석 | `app/src/renderer/src/features/chat/lib/toolMeta.ts:28` |
| 기존 `language` 설정 = **LLM 응답 언어**(시스템 프롬프트 `Preferred language` 주입). UI 로케일과 별개 개념. UI writer 없음(플라이아웃 inert) | `app/src/shared/protocol.ts:425-427` · `app/src/main/features/extensions/system-header.ts` · `app/src/renderer/src/app/SidebarUserButton.tsx:8-13` |
| 타임스탬프 저장은 전부 epoch ms(`Date.now()`) — 타임존 무관 절대시각. 표시 레이어만 고치면 됨 | `app/src/main/features/history/writer.ts` 등 |
| 날짜 포맷터 5개 사이트가 `'ko-KR'` 하드코딩 + `timeZone` 미명시 | `features/chat/format.ts:5-33` · `projects/ProjectsScreen.tsx:21` · `projects/ProjectInfoHero.tsx:28` · `skills/customize/SkillDetail.tsx:20` |
| `src/shared/time/{relative,resetLabels}.ts` 는 한국어 라벨 하드코딩·순수 레이어(의존성 0 강제 — i18next import 불가). 소비자는 렌더러 전용(main 소비자 없음) | `app/src/shared/time/relative.ts` · `resetLabels.ts` · `app/eslint.config.mjs:107-172` |
| 설정 인프라 완비: zod `SettingsSchema`(SSOT) + electron-store + `settings.get/set` IPC + `useTweaks`/`TweakProvider` 양방향 바인딩(theme 적용 이펙트 패턴) | `protocol.ts:404-463` · `infra/settings-store.ts` · `shared/hooks/useTweaks.ts` · `shared/theme/TweakProvider.tsx` |
| 렌더러 boundaries: features→shared 만 허용 → i18n 모듈은 `renderer/src/shared/i18n/` 에 둬야 전 feature 가 소비 가능 | `app/eslint.config.mjs:57-101` |
| react/react-dom 은 devDependencies(렌더러 완전 번들) → i18next 도 devDependencies | `app/package.json:48-72` |
| `SETTINGS_VERSION` bump 불필요 — 기존 additive 키 전례상 zod `.default()` 로 부재 키 흡수 | `infra/settings-migration.ts` |
| vitest 는 node 환경·`src/**/*.test.ts` 만 — 컴포넌트 테스트 인프라 없음 → 순수 함수/카탈로그 테스트로 구성 | `app/vitest.config.ts` |
| i18next typed keys = `CustomTypeOptions` 모듈 확장 (v23+, 설치본 v26) | https://www.i18next.com/overview/typescript |

## 인수 기준 (Acceptance Criteria)

1. **설정 키**: `SettingsSchema`/`SettingsPatchSchema`/`ipc.ts Settings` 에 `uiLocale: 'ko'|'en'` (default `'ko'`, 불량값 `.catch('ko')`) 추가. 기존 `language`(LLM 응답 언어)는 무변경.
2. **i18n 모듈**: `renderer/src/shared/i18n/` — i18next 동기 init(번들 리소스), `resources/ko.ts`(SSOT) + `resources/en.ts`(`typeof ko` 로 키 패리티 컴파일 강제) + `i18next.d.ts`(typed `t()`) + `useI18n()` 훅.
3. **배관**: `main.tsx` 가 첫 렌더 전 init, `useTweaks`/`TweakProvider` 가 `uiLocale` 변경 시 `i18n.changeLanguage` + `<html lang>` 반영(테마 이펙트와 동일 패턴), electron-store 영속.
4. **날짜/시간 = 로케일·타임존 명시**: `shared/i18n/datetime.ts` — 모든 `Intl.DateTimeFormat` 에 명시적 `timeZone`(기본 = OS 감지, 테스트 주입 가능), "같은 날" 판정을 대상 타임존 기준으로 계산(DST 안전). 기존 `'ko-KR'` 하드코딩 5개 사이트 전부 치환(치환 후 `ko-KR` 리터럴 = i18n 모듈 밖 0건).
5. **순수 레이어 locale 파라미터**: `relativeTimeLabel`/`weekResetLabel`/`monthResetLabel`/`computeUsageLimits` 에 후행 `locale: 'ko'|'en' = 'ko'` — 기존 호출자 무변경 하위 호환(기존 ko 테스트 무수정 통과).
6. **핵심 화면 마이그레이션**: 설정 모달(SettingsModal·GeneralTab·UsageTab·ProviderUsageTab·UsageLimitViews) + 앱 셸(Sidebar NAV·Header·SidebarUserButton) + UsagePanel + 날짜 표면(MessageMeta·SubAgentTileContent·ProjectsScreen·ProjectInfoHero·SkillDetail) 의 문자열이 카탈로그 `t()` 로 해석. ko 표시 결과는 마이그레이션 전후 동일.
7. **언어 스위처**: 사이드바 플라이아웃 활성화(en/ko 선택 → `setTweak('uiLocale')`, "앱 표시 언어" 헤더로 LLM 언어와 구분) + GeneralTab 환경설정에 언어 select 추가.
8. **테스트**: 카탈로그 패리티(리프 키·빈 값·`{{}}` 플레이스홀더) + datetime 결정론(타임존 주입·타임존 경계·DST·양 로케일) + shared/time·limits en 케이스 + settings 마이그레이션 uiLocale 케이스.
9. **문서**: `IPC_CONTRACT.md` §2.4 + settings 키 수(17→18) 참조 문서 전부(TRD·PRD·GLOSSARY·persistence.md·docs/AGENTS.md) 동기화.
10. **게이트**: `cd app && npm run lint && npm run typecheck && npm test` green (환경 제한 electron 바이너리 403 의 기존 2 suite 제외).

## 범위 / 비범위

- **범위**: 위 인수 기준. i18n 인프라 + 핵심 화면(설정·셸·사용량·날짜 표면) + OS 타임존 명시 정비.
- **비범위(후속 핸드오프)**: ① 잔여 ~140 파일 문자열 마이그레이션(채팅 transcript·composer·에러 라벨·toolMeta 동사·스킬/MCP/프로젝트/엔진 화면 본문 등 — 이번에 만든 카탈로그 컨벤션을 따른다) ② 타임존 *선택* UI(사용자 결정으로 제외 — 항상 OS 로컬) ③ 사용량 기간 경계(`shared/time/clock.ts`)의 타임존 파라미터화(OS 로컬 유지, 기존 동작) ④ LLM 응답 언어(`language`) 컨트롤 UI(여전히 writer 없음 — 별도 결정 필요) ⑤ main 프로세스 문자열(윈도우 타이틀 정적 "Orca", 네이티브 메뉴 없음 — 대상 자체가 없음).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- **신규 의존성**: `i18next@^26` + `react-i18next@^17` (devDependencies — react 와 동일 위치, 렌더러 완전 번들) → **사용자 승인 완료**(라이브 세션 AskUserQuestion, "i18next 도입" 선택).
- 재사용: `SettingsSchema`/`useTweaks`/`TweakProvider` 배선, `shared/time` 순수 유틸, `SettingsGroup/SettingsRow` UI.
- 전제: 렌더러 Chromium 의 ICU 가 ko/en 로케일 데이터 보유(Electron 표준). epoch ms 저장 = UTC 절대시각.

## 설계

- **레이어 배치**: 카탈로그·훅·datetime = `renderer/src/shared/i18n/`(features→shared 방향 준수). 설정 키 = `src/shared/protocol.ts`. 순수 시간 라벨 = `src/shared/time/` 에 locale 파라미터(이 레이어는 의존성 0 강제라 i18next 카탈로그 밖 인라인 ko/en 사전 — 의도된 트레이드오프).
- **타입 안전**: `i18next.d.ts` `CustomTypeOptions` → 잘못된 키 = 컴파일 에러. `en: typeof ko` → 키 누락/초과 = 컴파일 에러.
- **stale 라벨 방지**: 모듈 상수(NAV·TABS·THEME/FONT_OPTIONS 등)에는 키만 두고 컴포넌트 렌더에서 `t()` 해석 — 언어 전환 시 `useTranslation` 리렌더에 편승.
- **타임존**: `datetime.ts` 가 `Intl.DateTimeFormat().resolvedOptions().timeZone`(로컬 PC)을 기본값으로 모든 포맷터에 **명시** 전달 + 포맷터 메모이즈. "같은 날" 판정은 `en-CA` y-m-d 를 대상 타임존으로 산출해 비교(구현 전: `getFullYear()` 류 암묵 로컬 — 이제 주입 가능·DST 안전).
- **`t` 네이밍 충돌**: Tweak 컨텍스트 관례 `t`(Tweaks)와 충돌 회피를 위해 훅이 `{ tr, locale }` 반환.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **부팅 플래시**: 설정 로드 전 DEFAULTS(`'ko'`)로 첫 렌더 → en 사용자에게 순간 ko 노출 가능. 기존 theme 플래시와 동일 수용 패턴(BrowserWindow ready-to-show 지연으로 거의 안 보임).
- **언어 전환 즉시성**: `changeLanguage` → `useTranslation` 구독 컴포넌트 전부 리렌더(라이브 전환, 재시작 불필요). 날짜 포맷터는 `useI18n().locale` 을 인자로 받아 같은 리렌더에 편승.
- **혼합 언어 상태(의도됨)**: 이번 범위 밖 화면(채팅 본문 등)은 en 선택 시에도 한국어 잔존 — 후속 마이그레이션까지의 과도기 상태로 사용자 확정 범위.
- **a11y**: `<html lang>` 동기화 + aria-label 전부 카탈로그화(범위 내 화면). 테마 2종 무관(문자열만 변경).
- **불량 설정값**: `uiLocale` 에 zod `.catch('ko')` — 디스크 오염 시 ko 복구(마이그레이션 테스트로 고정).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| `src/shared` 순수 레이어의 ko/en 인라인 사전이 i18next 카탈로그 밖에 존재(이중 관리) | 레이어 의존성 0 제약의 의도된 트레이드오프. 대상 3함수뿐이며 en 케이스 테스트로 고정 |
| ICU/CLDR 버전에 따라 ko 시각 글리프 상이(Node 22 ICU78 = 'PM', Electron Chromium = '오후' 가능) | 테스트는 동일 옵션 Intl 참조 출력과 비교(로직 검증) — 글리프 리터럴 고정 회피. en 리터럴은 안정적이라 유지 |
| en 번역 카피 품질(기계 초벌) | verify "사람 확인 대기" 항목 — 사용자 검토 후 카탈로그 값만 수정하면 됨 |
| 모듈 상수 라벨 stale | 키-상수 + 렌더 시 `t()` 해석 패턴으로 전면 회피 |
| 되돌리기 어려운 결정 | 카탈로그 키 네이밍(`settings.general.*` 등 feature 중첩) — 후속 마이그레이션이 이 컨벤션을 상속 |

- **단독 결정 금지 항목**: 신규 의존성(i18next) — 사용자 승인 완료. 타임존 UI 범위 — 사용자 확정("OS 자동 감지만"). 그 외 Open Question 접촉 없음.

## 영향 받는 파일

- 신규: `app/src/renderer/src/shared/i18n/{index.ts, datetime.ts, i18next.d.ts, resources/{ko,en}.ts, datetime.test.ts, resources/resources.test.ts}`
- 설정: `app/src/shared/{protocol,ipc}.ts` · `shared/hooks/useTweaks.ts` · `shared/theme/TweakProvider.tsx` · `main.tsx`
- 순수 시간: `app/src/shared/time/{relative,resetLabels}.ts`(+tests) · `app/src/shared/usage/limits.ts`(+test)
- 화면: `app/{Sidebar,Header,SidebarUserButton}.tsx` · `features/settings/components/{SettingsModal,GeneralTab,UsageTab,ProviderUsageTab,UsageLimitViews}.tsx` · `features/chat/{format.ts, components/UsagePanel.tsx, components/transcript/MessageMeta.tsx, components/rightpanel/SubAgentTileContent.tsx, lib/toolMeta.ts(주석)}` · `features/cost/hooks/{useUsageLimits,useProviderUsageLimits}.ts` · `features/projects/components/{ProjectsScreen,ProjectInfoHero}.tsx` · `features/skills/components/customize/SkillDetail.tsx`
- main 테스트: `app/src/main/infra/settings-migration.test.ts`
- 문서: `docs/IPC_CONTRACT.md` · `docs/TRD.md` · `docs/PRD.md` · `docs/GLOSSARY.md` · `docs/arch/backend/persistence.md` · `docs/AGENTS.md` · 본 핸드오프 + `INDEX.md` + `PHASES.md`
- 의존성: `app/package.json`(+lock) — `i18next`·`react-i18next` devDependencies

## 참고 문서

- `docs/TRD.md` §6.2 N2 (i18n 한국어 1차 — 본 작업으로 ko/en 확장) · §6.7 (settings)
- `docs/IPC_CONTRACT.md` §2.4 (동시 갱신 완료)
- `docs/arch/frontend/layers.md` (renderer 4-layer)
- i18next TypeScript: https://www.i18next.com/overview/typescript

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 카탈로그 패리티 · datetime 결정론(타임존/DST) · 순수 시간 함수 en · settings 마이그레이션 uiLocale.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구(라이브 세션 4개 결정 + 타임존 보충)를 출처와 함께 인용했고, "핵심 화면" 해석은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 `파일:라인`·config·웹 URL 레퍼런스를 붙였다.
- [x] 인수 기준 — 번호 10개, 자료조사 근거, 검증 가능(게이트·grep·테스트로 대조).
- [x] 의존 기술 — i18next 신규 의존성 = 사용자 승인 완료로 표기.
- [x] 파생 UX — 부팅 플래시·라이브 전환·혼합 언어 과도기·a11y·불량값 복구를 펼쳤다.
- [x] 리스크 — 순수 레이어 이중 사전·ICU 글리프·en 카피 품질 트레이드오프와 완화책을 적었다.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 전체 구조(카탈로그 SSOT=ko·typed keys·Tweak 배선·datetime 명시 타임존). 설계자=구현자(Claude 직접)라 설계 확정 직후 구현.
- 이견 / 우려: "자료조사 §ICU" — 설계 시점엔 ko 글리프 리터럴 테스트를 계획했으나 실행 환경(Node 22 ICU 78)이 ko hour12 dayPeriod 를 'PM' 으로 렌더해 실측 반증됨 → 참조 비교 방식으로 설계 수정(리스크 표에 반영).

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 렌더 중 `Date.now()` 명시 호출이 `react-hooks/purity` lint error (locale 스레딩 위해 3번째 인자를 채우면서 유발) | ✅ `undefined` 전달로 순수 함수 내부 기본값 경로 복원 (4개 사이트) | lint 게이트 실측 |
| 2 | 테스트 환경 ICU 78 이 ko 시각을 'PM 12:30' 으로 렌더(글리프 리터럴 브리틀) | ✅ ko 시각 기대값만 동일 옵션 Intl 참조 출력과 비교(프리셋 선택 로직 검증은 유지, en 리터럴 유지) | `npm test` 실측 |
| 3 | GeneralTab 에 언어 select 부재 시 스위처가 플라이아웃에만 존재(발견성 낮음) | ✅ 환경설정 그룹에 언어 select 추가(언어 이름은 자기 언어 표기 — 번역 대상 아님) | 파생 UX |

## [구현자 기입] 구현 체크리스트

- [x] 의존성 설치(i18next·react-i18next, devDeps)
- [x] 설정 키 uiLocale (protocol/ipc/useTweaks/TweakProvider/main.tsx)
- [x] i18n 모듈(카탈로그 ko/en·typed keys·useI18n·datetime)
- [x] 순수 레이어 locale 파라미터(relative/resetLabels/limits + 소비자 스레딩)
- [x] 핵심 화면 마이그레이션 + 언어 스위처(플라이아웃 활성화 + GeneralTab select)
- [x] 테스트(카탈로그·datetime·en 케이스·마이그레이션)
- [x] 문서 동기화(IPC_CONTRACT §2.4·키 수 18 전파·toolMeta 주석)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 38 파일(+464/−230) — 위 "영향 받는 파일" 전수 |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` / `node --test scripts/*.test.mjs` |
| 게이트 결과 | lint ✅(0) / typecheck 3종 ✅ / test ✅ 818/818 passed + scripts 24/24 (2 suite fail = electron 바이너리 403 환경 제한 — 0092~0095 와 동일 베이스라인: `chat-turn.continuity`·`history/writer`, 코드 무관) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (커밋 후 기입) |
