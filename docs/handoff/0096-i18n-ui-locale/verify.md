# Verify — 0096-i18n-ui-locale

## 메타

| 항목 | 값 |
|---|---|
| slug | `0096-i18n-ui-locale` |
| 검증자 | Claude Code |
| 일자 | 2026-07-11 |
| 대상 커밋 | `bdecef8` |
| 라운드 | 1 |
| 상태 | **PASS** (에이전트 판정 범위) |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 이견 §자료조사 ICU — ko 글리프 리터럴 테스트가 Node ICU78 에서 반증('PM') → 참조 비교로 설계 수정 | 타당 — 글리프는 CLDR 소관, 우리 로직(로케일·타임존·프리셋 전달)만 검증하는 게 옳다. en 리터럴·ko 날짜 리터럴은 유지돼 회귀 감지력 보존 | 매트릭스 #8 증거로 채택 |
| 선조치 ✅ #1 lint purity(렌더 중 `Date.now()`) | 타당 — `undefined` 전달로 기본값 경로 복원, 동작 동일 | 매트릭스 #10 |
| 선조치 ✅ #3 GeneralTab 언어 select 추가 | 타당 — 파생 UX(발견성), 설계 §인수 기준 7 에 이미 포함 | 매트릭스 #7 |

## 요구사항 충족 매트릭스

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | settings `uiLocale`(ko/en, default ko, catch ko) + `language` 무변경 | ✅ | `app/src/shared/protocol.ts:430`(SettingsSchema)·`:459`(Patch)·`app/src/shared/ipc.ts:796`; `language` diff = 주석만 |
| 2 | i18n 모듈(동기 init·ko SSOT·`en: typeof ko`·typed t()·useI18n) | ✅ | `renderer/src/shared/i18n/{index.ts, resources/ko.ts, resources/en.ts(6행 typeof ko), i18next.d.ts}` |
| 3 | 배관(main.tsx init → TweakProvider changeLanguage + `<html lang>` → electron-store 영속) | ✅ | `main.tsx:2-3` · `useTweaks.ts`(Tweaks/DEFAULTS/get 매핑) · `TweakProvider.tsx`(uiLocale 이펙트) |
| 4 | 날짜 = 로케일·타임존 명시 + `ko-KR` 잔존 0 | ✅ | `datetime.ts`(전 포맷터 `timeZone` 명시·`ymdInZone` 같은-날 판정) · `grep -rn 'ko-KR' src \| grep -v shared/i18n` = **0건** |
| 5 | 순수 레이어 locale 파라미터 + 하위 호환 | ✅ | `shared/time/{relative,resetLabels}.ts`·`usage/limits.ts` 후행 `locale='ko'`; 기존 ko 테스트 **무수정** 통과(하위 호환 증명) |
| 6 | 핵심 화면 마이그레이션(ko 표시 동일) | ✅ | 설정 모달 5종·Sidebar/Header/SidebarUserButton·UsagePanel·날짜 표면 5종 — 카탈로그 값은 기존 문자열 그대로 이전(ko.ts 헤더 주석 계약) |
| 7 | 언어 스위처(플라이아웃 활성화 + GeneralTab select) | ✅ | `SidebarUserButton.tsx`(en/ko `menuitemradio`→`setTweak('uiLocale')`+"앱 표시 언어" 헤더) · `GeneralTab.tsx` 환경설정 언어 select |
| 8 | 테스트 | ✅ | 신규 23 — 카탈로그 패리티/빈값/플레이스홀더(`resources.test.ts` 3) · datetime 결정론/타임존 경계/DST/사다리(`datetime.test.ts` 7) · relative/resetLabels/limits en 케이스 · settings 마이그레이션 uiLocale 3분기 |
| 9 | 문서 동기화 | ✅ | IPC_CONTRACT §2.4 `uiLocale` + 헤더 / 17→18 키: TRD(3곳)·PRD·GLOSSARY·persistence.md(§1.2 카탈로그 행 추가)·docs/AGENTS.md — `grep '17 키' docs/{TRD,PRD,GLOSSARY,IPC_CONTRACT}.md docs/arch docs/AGENTS.md` 잔존 0 |
| 10 | 게이트 | ✅ | lint 0(purity 4건 선조치 후) · typecheck 3종 0 · vitest **818/818 passed** + scripts 24/24 (2 suite 로드 실패 = electron 바이너리 403 환경 제한 — `chat-turn.continuity`·`history/writer`, 0092~0095 와 동일 베이스라인·본 변경 무관) |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ | — | 위 #10 |
| 인수 기준 ↔ 코드 대조 | ✅ | 이견 시 중재 | 10/10 |
| 레이어 경계 위반 0 | ✅ | — | boundaries 포함 lint 0 (i18n 모듈 = renderer shared, features→shared 방향만) |
| 문서 형식/링크/한국어 | ✅ | — | 통과 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 0 (AGENTS.md 는 docs/AGENTS.md 키 수 1줄만 변경) |
| 제품 의도 부합 | ✖ 보조 | ✅ 결정 | 사람 확인 대기 — 특히 **en 번역 카피 어감**(기계 초벌, `resources/en.ts` 검토) |
| Open Questions | ✖ | ✅ | 접촉 없음(신규 의존성은 승인 완료) |
| UI/UX 시각 검증 | ✖ | ✅ | 사람 확인 대기 — `npm run dev`: ① 기본 ko 화면 기존과 동일 ② 플라이아웃/GeneralTab 에서 English 선택 → 설정 모달·사이드바·헤더·사용량 패널·타임스탬프 라이브 전환 ③ 재시작 후 en 유지 ④ ko 복귀 |
| 신규 의존성 승인 | ✖ 제안 | ✅ | **승인 완료**(라이브 세션) — i18next@^26·react-i18next@^17 devDeps |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

```
$ cd app && npm run lint          # 0 problems (boundaries 포함)
$ npm run typecheck               # node/web/test 3종 통과
$ npm test                        # vitest: Tests 818 passed (818); Test Files 108 passed,
                                  #   2 failed = electron 바이너리 403 환경 제한(로드 실패, 기존 베이스라인)
$ node --test scripts/*.test.mjs  # 24/24 pass
$ grep -rn 'ko-KR' app/src | grep -v shared/i18n   # 0건
```

## 위생 검토

- 키/토큰/이메일/IP 패턴 스캔: 신규/변경 파일 grep 0.
- 변동성 정보 혼입: 없음 — 상태는 INDEX/PHASES, 카탈로그는 코드.

## PHASES.md 정합성

- 0096 행 승격(범위·커밋) + "현재 상태" 문단·Future Scope 다국어 항목 현행화 — 본 검증 커밋에 포함.

## 검증 자기 리뷰 (무엇이 부족했나)

- 설계 단계: 테스트 환경 ICU 글리프 차이를 사전 조사에서 놓쳤다(구현 중 실측으로 발견) — 외부 런타임 의존 검증은 설계 시 실측 먼저.
- 구현 단계: "핵심 화면" 경계상 범위 내 화면에도 미이관 잔존 문자열이 있다(예: SkillDetail 본문·ProjectsScreen 헤더 — 날짜 표면만 계약). 후속 마이그레이션 목록에 명시적으로 포함할 것.
- 검증 단계: 렌더러 실행 검증(Electron GUI) 불가 환경 — 라이브 언어 전환·플래시 여부는 사람 시각 검증에 위임. Electron(Chromium ICU)의 ko 글리프('오후')는 실기에서 확인 필요.

## 결론 / 다음 단계

- 상태: **PASS** (r1, 에이전트 판정 범위) → PHASES 승격 + PR(draft).
- 사람 확인 대기: en 카피 어감 · `npm run dev` 라이브 전환/영속 실기 · PR 머지.
- 후속 핸드오프 후보: 잔여 ~140 파일 문자열 마이그레이션(채팅 transcript·composer·에러/toolMeta·스킬/MCP/프로젝트/엔진 화면 — 0096 카탈로그 컨벤션 상속).
