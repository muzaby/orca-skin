# Plan — 0132-settings-density

> 밀도(density) 컨트롤을 설정 → 일반 → 환경설정 그룹에 노출. 비기능(기존 배관 재사용 UI 노출) = Claude 직접 plan→impl→verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0132-settings-density` |
| 작성자 | Claude Code |
| 일자 | 2026-07-21 |
| 매핑 | PHASES / PR (구현 후 draft) |
| 상태 | DRAFT → READY → IMPL_DONE |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "디버그 패널의 위젯의 밀도를 nav.설정.일반에서 환경설정 그룹내에 추가할 것" | 라이브 세션 요청 |
| 추론 의도 | 디버그 패널에만 있던 density 컨트롤(개발 빌드 전용)을 정규 설정 UI 에 노출해 일반 사용자도 조절 가능하게. 새 상태가 아니라 **기존 `t.density` Tweak 을 재노출**하는 것 (추론) | (근거: DebugPanel 의 density = `t.density`, 이미 영속됨) |

## Context (왜)

밀도 컨트롤(`compact`/`normal`/`comfortable`)은 현재 개발 빌드 전용 `DebugPanel` 에만 있다(`OverlayLayer` 가 `import.meta.env.DEV` 로만 마운트). 이 컨트롤은 `t.density` Tweak 을 바꾸고 `TweakProvider` 가 루트 `font-size`(`DENSITY_FONT`)로 적용해 rem 기반 Tailwind 스페이싱·타입 스케일 전체를 리스케일하는 **앱 전역 설정**이다. 프로덕션 사용자는 조절할 수 없어, 정규 설정(일반 탭 환경설정 그룹)에 폰트·언어와 나란히 노출한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| density 는 이미 영속 Tweak — `Tweaks.density`·`DEFAULTS`·하이드레이션 매핑 완비 | `app/src/renderer/src/shared/hooks/useTweaks.ts` |
| SettingsSchema 에 `density` 존재(영속 + projection, 기본값 `normal`) | `app/src/shared/protocol.ts:440,481` |
| `DensityId`·`DENSITY_FONT` 정의, TweakProvider 가 루트 font-size 로 적용 | `app/src/renderer/src/shared/config/theme.ts` · `shared/theme/TweakProvider.tsx` |
| DebugPanel 이 동일 `t.density` 를 `PanelRadio` 로 노출(setTweak('density', v)) | `app/src/renderer/src/features/debug/components/DebugPanel.tsx` |
| 환경설정 그룹의 기존 select 패턴(폰트·언어) — 옵션 상수 + tr() 해석 | `app/src/renderer/src/features/settings/components/GeneralTab.tsx` |
| i18n ko↔en 리프 키 패리티 + 빈 값 금지 테스트 강제 | `app/src/renderer/src/shared/i18n/resources/resources.test.ts` |

## 인수 기준 (Acceptance Criteria)

1. 설정 모달 → 일반 탭 → 환경설정(Preferences) 그룹에 "밀도" 행이 폰트·언어와 같은 `<select>` UI 로 노출된다.
2. 옵션은 조밀/보통/넓게(compact/normal/comfortable) 3종, 현재 `t.density` 를 반영하고 변경 시 `setTweak('density', ...)` 로 영속된다.
3. 디버그 패널의 밀도 라디오와 값이 동기화된다(같은 `t.density` Tweak).
4. i18n 키 `settings.general.density`/`densityDesc`/`densityCompact`/`densityNormal`/`densityComfortable` 가 ko·en 양쪽에 추가되어 패리티 테스트 통과.
5. 게이트: lint 0 error · typecheck 3분할 통과 · resources 테스트 통과.

## 범위 / 비범위

- **범위**: GeneralTab UI 행 1개 + i18n 키(ko/en). 기존 density 배관 재사용.
- **비범위**: 스키마/Tweaks/TweakProvider/store 변경(이미 완비). DebugPanel density 라디오 유지(제거 안 함). FloatingPanel 자체 크롬은 density 미반응(기존 동작, 별건).

## 의존 기술 / 전제

- 재사용: `useTweakContext()`(t/setTweak), `DensityId`(config/theme), `SettingsGroup`/`SettingsRow`(parts.tsx), `tr()`(i18n).
- 신규 의존성: 없음.

## 설계

- `GeneralTab.tsx`: `DensityId` import 추가, `DENSITY_OPTIONS` 모듈 상수(FONT_OPTIONS 패턴), 환경설정 그룹 언어 행 다음에 density `SettingsRow`(폰트/언어와 동일 select className). 밀도 옵션은 아이콘 없는 순수 텍스트라 select 가 관례에 부합(모양=appearance 만 sun/moon 아이콘 버튼 그룹).
- i18n: `settings.general` 블록에 5개 키(ko/en). DebugPanel 의 `debug.density*` 는 그대로 두고, 설정 라벨은 `settings.general.*` 아래에 신설(폰트/모양/언어 옵션 라벨이 모두 여기 사는 기존 패턴 일관성).
- 레이어: features/settings + shared 만 사용, 경계 위반 없음.

## 파생 UX / 엣지케이스

- 상태: 로딩=마운트 직후 DEFAULTS(normal) 표시 후 settings.get 하이드레이션(폰트/언어와 동일, flash 거의 없음). 에러=setTweak 실패 시 이전 값 롤백(useTweaks 기존 처리). 빈 상태 N/A.
- 상호작용: 언어 전환 시 옵션 라벨 stale 없음(tr() 렌더 시 해석). 테마 2종 무관(select 는 토큰 색). 접근성=native `<select>`(폰트/언어와 동일).

## 리스크 / 트레이드오프

| 리스크 | 완화책 / 결정 |
|---|---|
| 설정과 디버그 패널 두 곳에서 같은 값 노출 → 혼동? | 같은 `t.density` 라 항상 동기화. 디버그 패널은 개발 빌드 전용이라 프로덕션 사용자에겐 설정만 보임. |

- 되돌리기 어려운 결정: 없음(UI 행 + i18n 키).
- Open Question: 없음.

## 영향 받는 파일

- `app/src/renderer/src/features/settings/components/GeneralTab.tsx`
- `app/src/renderer/src/shared/i18n/resources/ko.ts`
- `app/src/renderer/src/shared/i18n/resources/en.ts`

## 참고 문서

- `docs/arch/frontend/` (환경설정 UI) · IPC 변경 없음(채널 무변경).

## 게이트

- `npm run lint`(0 error) · `npm run typecheck`(3분할) · `./node_modules/.bin/vitest run .../resources.test.ts`.
- 신규 테스트: 없음(순수 UI + i18n, 기존 resources 패리티 테스트가 키를 커버).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 인용, 추론 표기.
- [x] 자료조사 — 발견마다 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능.
- [x] 의존 기술 — 신규 의존성 0.
- [x] 파생 UX — 로딩/에러/언어전환/접근성 펼침.
- [x] 리스크 — 트레이드오프 기록, Open Question 없음.

---

> **[구현자 기입]** Claude 비기능 직접 구현.

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 배관이 전부 존재해 순수 UI + i18n 추가로 충분. select 패턴이 폰트/언어와 1:1.
- 이견 / 우려: 없음.

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| — | 없음 | — | 기존 density 배관 재사용, 새 상태/스키마 0 |

## [구현자 기입] 구현 체크리스트

- [x] `GeneralTab.tsx` — `DensityId` import + `DENSITY_OPTIONS` + 환경설정 그룹 density `SettingsRow`.
- [x] `ko.ts` / `en.ts` — `settings.general` 에 density 5키 추가.

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `GeneralTab.tsx` · `resources/ko.ts` · `resources/en.ts` |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `vitest run resources.test.ts` |
| 게이트 결과 | lint ✅ 0 error(1 pre-existing warning 무관) / typecheck ✅ 3분할 / resources 테스트 ✅ 3/3 |
| 블로커 / 역질문 | 없음. (electron ABI egress 차단으로 `npm test` 전체·`npm run dev` 실기는 네트워크 완전환경/사람 몫 — AGENTS.md 기준.) |
| 대상 커밋 | `f179ada` |
