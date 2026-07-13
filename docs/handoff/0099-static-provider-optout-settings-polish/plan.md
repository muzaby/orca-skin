# Plan — 0099-static-provider-optout-settings-polish

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 흐름: **의도 → 조사 → 설계 → 리스크**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0099-static-provider-optout-settings-polish` |
| 작성자 | Claude Code |
| 일자 | 2026-07-13 |
| 매핑 | PHASES 행 / PR (구현 후) |
| 상태 | READY |
| 구현 주체 | **Claude** (비기능 — 기본 주입 제거·UI 이동·게이트 fix·테마) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

핸드오프 0098 의 **후속 교정** 3건. 라이브 세션 요청.

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 ① | 정적(static) provider 를 코어에 **기본 주입하지 말 것**(미리구현 금지). 각 회사가 자기 환경 구축 시 붙이도록 **빼놓고**, **핵심 코드 무편집으로 쉽게 부착**되게 모듈화·디렉토리 계층화를 잘 할 것. | 라이브 세션 요청 |
| 명시 요구 ② | `nav.설정.일반.주기적 실행` → `nav.설정.사용량` 으로 이동. cron 표현식은 **`직접 입력` 드롭다운 선택 시에만 활성화**. | 라이브 세션 요청 |
| 명시 요구 ③ | `nav.설정` 모달 **각 컴포넌트가 Orca 디자인 토큰(테마) 준수**. **토글 선택 및 활성화는 파란 계열**로. | 라이브 세션 요청 |
| 명시 요구(추가 확정) | ① 구조 재편 = **전용 확장 디렉토리 + 예시 템플릿(비활성)**. ③ 범위 = **설정 모달 + 디버그 패널(FloatingPanel)**. ③ 블루 = **온/오프 토글 + 모든 선택·활성 상태**(활성 탭·테마 세그먼트·provider 서브탭). | 본 세션 Q&A (2026-07-13) |

## Context (왜)

0098 은 "정적 provider = 외부 사용량 리포트 플러그인 프레임워크"를 도입했으나, 구현 과정에서
**bedrock/vertex/custom 3종을 코어에 기본 주입**하는 형태로 마감했다(`STATIC_USAGE_PROVIDERS`
리터럴 배열 + 부팅 시 `materializeStaticProviderSettings()` 가 각 provider `settings.json` 기본 생성 —
0098 plan `[구현자 기입] 놓친 잠재 문제 #4`). 사용자 의도는 정반대다: 정적 provider 는
각 회사가 자기 환경을 구축할 때 스스로 붙이는 opt-in 확장이어야 하고, 프레임워크만 남겨
**핵심 코드 무편집으로 쉽게 부착**되게 계층화돼 있어야 한다.

동시에 0098 이 손댄 설정 모달에 두 UI 교정이 필요하다: `주기적 실행` 을 사용량 탭으로 옮기고
cron 입력을 `직접 입력` 시에만 열며, 설정 모달·디버그 패널이 디자인 토큰을 준수하고
토글·선택·활성 상태를 파란 계열로 통일한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 정적 provider 기본 목록 = bedrock/vertex/custom 리터럴 3종 | `app/src/main/features/providers/static/index.ts:25-29` |
| 부팅 시 각 provider `settings.json` 기본 생성(부재 시에만) | 같은 파일 `materializeStaticProviderSettings()` `:35-50` |
| 부팅 배선 — materialize 호출·`ExternalUsageService` 에 `STATIC_USAGE_PROVIDERS` 주입·5분 스케줄러 등록 | `app/src/main/app/bootstrap.ts:249,260-263,265-271` |
| 프레임워크는 이미 provider-불특정(레지스트리 순회·이름 미분기) + 회귀 테스트 존재 | `features/usage/external-usage-service.ts:28,72-103` · `external-usage-service.test.ts`("provider-agnostic registry entries") |
| 정적 provider 계약(모듈 규약·context·report) | `app/src/main/contracts/usage-report.ts` (`StaticUsageProviderModule`·`ExternalUsageProvider`·`ExternalUsageContext`) |
| main 레이어 DAG — features 교차 import 금지·구체 provider 리터럴은 adapters/extensions/컴포지션 루트만 | `app/src/main/AGENTS.md` |
| `주기적 실행` UI 블록 = GeneralTab 소재 + 프리셋 상수 | `app/src/renderer/src/features/settings/components/GeneralTab.tsx:19-23,162-228` |
| cron `<input>` 항상 편집 가능(disabled 조건 없음), `직접 입력`=`presetCustom`(value `'custom'`), onChange no-op | `GeneralTab.tsx:187-225` |
| 사용량 탭은 현재 `/cost` placeholder(Toggle/SettingsGroup/SettingsRow 미import) | `features/settings/components/UsageTab.tsx` |
| 스케줄 상태 백엔드(이동해도 재사용) | `shared/hooks/useTweaks.ts` `scheduler.usageRecompute.{enabled,cron}` |
| 탭 정의·활성 탭 스타일·provider 서브탭 | `features/settings/components/SettingsModal.tsx:17-20,74,82-101` |
| i18n 라벨(ko/en) — 스케줄링 키군 | `shared/i18n/resources/ko.ts:651-698` (+ `en.ts` 대응) |
| 디자인 토큰 정본(Tailwind v4 `@theme`) — accent=warm rust, 블루 `--color-indigo`=메터 전용 | `app/src/renderer/src/styles/tokens.css:21,40,68-78,157-178` |
| 설정 토글 on=중립 `bg-ink`(의도적 중립화 주석) | `shared/ui/Toggle.tsx:1-3,20-22` |
| formal 설정 모달(features/settings)은 토큰 준수(hex grep 0) | agent 조사(2026-07-13) |
| 디버그 오버레이 `FloatingPanel` 하드코딩 hex — 패널 rgba·`PanelToggle` on `#34c759`·`PanelRadio` 흰 pill·슬라이더 tan | `shared/ui/FloatingPanel.tsx:15-16,122,131,165-167,249` |
| 스타일 규약 — 시맨틱 토큰 우선·두 테마 스코프 대응·raw hex 금지 | `app/AGENTS.md` "스타일링" |

## 인수 기준 (Acceptance Criteria)

### 항목 1 — 정적 provider 기본 주입 제거 + 확장 모듈화
1. `STATIC_USAGE_PROVIDERS` 기본값 = **빈 배열**. 신규 클론 부팅 시 bedrock/vertex/custom `settings.json` **미생성**(기존 사용자 편집분 무변경 — materialize 는 부재 시에만 생성하므로 보존).
2. 정적 provider 추가 = 전용 확장 디렉토리 `features/providers/static/modules/<name>/` 폴더 + 배럴 1줄. **core 무편집**임을 시연: `external-usage-service`·scheduler(`bootstrap`)·IPC(`handlers/misc`)·tracker·enumeration(`provider-registry`)·materializer 편집 0.
3. **예시 템플릿(비활성)** — `modules/` 에 config-sugar 1건·hook 1건 골격을 두되 배럴에서 미수집(활성 0). 기본 부팅에 미로드. 활성화 절차 문서화.
4. 레이어 경계 위반 0 · 신규 의존성 0 · 0098 회귀 테스트("provider-agnostic registry 순회") green 유지 + **빈 기본·확장 회귀 테스트** 신설(배럴 확장만으로 인식, 기본 0).

### 항목 2 — `주기적 실행` 이동 + cron 게이트
5. `주기적 실행` `SettingsGroup` 이 `설정.사용량` 탭에 렌더되고 `설정.일반` 에서 제거된다.
6. cron `<input>` 은 `직접 입력`(custom) 선택 시에만 활성; 프리셋 선택 시 `disabled`(muted·`cursor-not-allowed`·`aria-disabled`). 게이트 판정은 `USAGE_RECOMPUTE_PRESETS.some(p => p.value === cron)` 재사용(select value 계산과 동일 로직).
7. 프리셋↔직접입력 전환·저장·영속(`useTweaks`) 무회귀. main 스케줄러 실동작 무변경.
8. i18n 스케줄링 키군을 `settings.usage.*` 로 이동(ko/en 동시), 참조 갱신, ko/en 키 패리티 유지.

### 항목 3 — 디자인 토큰 준수 + 블루 선택/활성
9. 신규 시맨틱 블루 토큰이 **white + `[data-theme='dark']` 두 스코프**에 정의(`--color-toggle-on`·`--color-selected`·`--color-selected-soft` 계열). `--color-indigo` 는 메터 전용 유지(역할 혼선 방지).
10. 온/오프 토글의 온-상태가 블루 — 설정 `Toggle`(`bg-ink`→블루) + 디버그 `PanelToggle`(`#34c759`→블루).
11. 설정 모달의 **모든 선택·활성 상태**가 블루 계열로 통일 — 활성 탭(`SettingsModal`)·테마 세그먼트 선택(`GeneralTab`)·provider 서브탭 활성.
12. 설정 모달 컴포넌트 + `FloatingPanel` 에 하드코딩 hex/rgb **0**(전부 토큰). raw-hex/rgb grep 0.
13. 게이트 green · 경계 0 · 신규 의존성 0. 양 테마 대비 확보(WCAG)·`role=switch`/`aria-checked` 유지 — 실제 색 튜닝·시각 검증은 사람 몫(verify §책임 분리).

## 범위 / 비범위

- **범위**: 위 13개 인수 기준 — 정적 provider 기본 비움 + 확장 디렉토리·예시 템플릿·문서 / 스케줄링 UI 이동 + cron 게이트 + i18n 키 이동 / 블루 토큰 + 토글·선택·활성 적용 + FloatingPanel 토큰화.
- **비범위(후속/사용자 직접)**: 실 bedrock/vertex/custom 모듈의 엔드포인트·인증·응답 매핑(회사가 config/hook 로 주입) · 0098 이월분(stale/offline 배지·30s 틱·`secret.set` Promise 계약) · 정적 provider 를 엔진 CRUD 로 노출 · rust→blue 전면 리브랜딩(설정/디버그 밖 컴포넌트).

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 재사용: 0098 프레임워크(`ExternalUsageService`·`materializeStaticProviderSettings`·`contracts/usage-report`·`http-usage-report`) 무편집 유지 · `useTweaks.scheduler` · `USAGE_RECOMPUTE_PRESETS` · `Toggle`/`SettingsGroup`/`SettingsRow`/`parts` · tokens.css `@theme`(양 테마 스코프) · i18n ko/en 카탈로그.
- 전제: Tailwind v4 CSS-first `@theme` → 신규 토큰이 유틸 클래스로 자동 노출(`bg-toggle-on` 등). 배럴 수집은 명시(explicit) 우선(0098 결정 — glob 번들 리스크 회피).
- **신규 의존성**: 없음.

## 설계

### 항목 1 (전용 확장 디렉토리 + 예시 템플릿)
- `features/providers/static/index.ts` — 기본 `STATIC_USAGE_PROVIDERS = []` 로 비우고, `modules/index.ts` 배럴 re-export 로 수집원 위임. `materializeStaticProviderSettings()`(provider-불특정) 는 유지. JSDoc 규약을 "정적 provider = opt-in 확장, 기본 0, 붙이는 법=modules/ 폴더+배럴 1줄"로 갱신.
- 신설 `features/providers/static/modules/` — `<name>/{config.ts,hook.ts?,index.ts}`(index 가 `StaticUsageProviderModule` default export). `modules/index.ts` 가 활성 모듈 배열 export(기본 `[]`).
- 예시 템플릿(비활성) — `modules/_example/`(config-sugar + hook 골격) 를 두되 `modules/index.ts` 배럴에서 **주석 처리**(미수집). 코드가 아니라 "붙이는 법" 참조물.
- 부팅 배선 무편집 시연 — `bootstrap.ts` 는 그대로 `materializeStaticProviderSettings()` + `new ExternalUsageService({ providers: STATIC_USAGE_PROVIDERS })` 호출(빈 배열=no-op). 스케줄러 등록도 그대로(순회 대상 0).
- 레이어 준수: `modules/` 는 `features/providers` 슬라이스 내부 — 교차 feature import 없음. 구체 provider 리터럴이 features 안에 있으나 이는 배포 레지스트리 성격(0098 이미 `features/providers/static` 채택, `app/src/main/AGENTS.md` extensions/배포 레지스트리 예외)이며, 코어·오케스트레이션은 여전히 중립.
- 문서: `app/src/main/AGENTS.md`(features 슬라이스 설명에 static modules 확장점) · `docs/arch/backend/standardization.md`(정적 provider = opt-in 확장·기본 0).

### 항목 2 (스케줄링 이동 + cron 게이트)
- `GeneralTab.tsx` 의 스케줄링 `SettingsGroup`(162-228) + `USAGE_RECOMPUTE_PRESETS`(19-23) 를 `UsageTab.tsx` 로 이동. `UsageTab.tsx` 에 `Toggle`·`SettingsGroup`·`SettingsRow` import 추가, `GeneralTab.tsx` 에서 블록·상수·미사용 import 제거.
- cron `<input>` 에 `disabled={isPreset}` — `isPreset = USAGE_RECOMPUTE_PRESETS.some(p => p.value === cron)`(select value 계산과 동일). disabled 시 `text-ink3`/muted·`cursor-not-allowed`·`aria-disabled`.
- i18n: `settings.general.{scheduling,usageRecompute*,refreshInterval*,preset*,cronAria}` → `settings.usage.*` (ko/en), 참조 grep 갱신.

### 항목 3 (토큰 + 블루)
- `styles/tokens.css` — 양 테마 스코프에 블루 토큰 추가: `--color-toggle-on`(white `#2a78d6` 계열, dark 밝은 블루) · `--color-selected`(강조 텍스트/보더) · `--color-selected-soft`(선택 배경). 값은 impl 대비 튜닝.
- `shared/ui/Toggle.tsx` on `bg-ink`→`bg-toggle-on`(off 유지). 헤더 주석의 "중립 ink" 근거를 블루 결정으로 갱신.
- 설정 모달 선택/활성 — `SettingsModal.tsx` 활성 탭·provider 서브탭, `GeneralTab.tsx` 테마 세그먼트 → `bg-selected-soft`/`text-selected`.
- 디버그 `FloatingPanel.tsx` — 하드코딩 hex/rgba(패널·라벨·hover)→토큰, `PanelToggle` on `#34c759`→`bg-toggle-on`, `PanelRadio` 선택 pill·슬라이더 accent→블루/토큰.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 항목1: 기존에 자동 노출되던 bedrock/vertex/custom 이 사라짐 — 기존 편집 `settings.json` 은 보존, 신규 환경엔 anthropic 스캐폴드만. 문서에 이전 안내.
- 항목2: 저장된 cron 이 프리셋과 불일치하면 select 는 자동으로 `직접 입력`(custom) 표기 → 입력 활성(기존 로직 재사용). 프리셋 재선택 시 저장값 갱신·입력 비활성.
- 항목3: 다크 테마 블루 대비·색맹 고려(파랑은 상태색 good/warn/bad 와 구분). off 토글은 중립 유지로 on/off 대비 확보.
- 접근성: 토글 `role=switch`/`aria-checked` 유지, cron 비활성 `aria-disabled`.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 기본 provider 제거가 기존 사용자 노출을 없앰 | materialize 는 부재 시에만 생성 → 기존 편집 보존. 문서 이전 안내. |
| features 안 구체 provider 리터럴(중립성 논쟁) | 0098 채택 배치(`features/providers/static`) 계승 — 배포 레지스트리 예외. 코어/오케스트레이션은 여전히 중립(이름 미분기). |
| 블루 정확값(다크 대비) 미확정 | 토큰 1곳 정의 + 사람 시각 검증(verify §책임 분리). rust→blue 전면 리브랜딩은 비범위. |
| i18n 키 이동 누락 | ko/en 동시 이동 + 참조 grep 0 + 기존 키-패리티 테스트 재실행. |
| 예시 템플릿이 실수로 활성화 | 배럴 주석 처리 + 회귀 테스트(기본 0) 로 고정. |

- **단독 결정 금지 항목**: 실 provider 엔드포인트·인증·매핑(회사 주입, 비범위).

## 영향 받는 파일

- **항목1**: `app/src/main/features/providers/static/index.ts`(기본 비움·배럴화) · `features/providers/static/modules/`(신설: `index.ts`+`_example/`) · `features/providers/static/*.test.ts`(빈 기본·확장 회귀) · `app/src/main/AGENTS.md` · `docs/arch/backend/standardization.md`. (bootstrap 무편집 원칙.)
- **항목2**: `app/src/renderer/src/features/settings/components/{GeneralTab,UsageTab}.tsx` · `shared/i18n/resources/{ko,en}.ts`.
- **항목3**: `app/src/renderer/src/styles/tokens.css` · `shared/ui/{Toggle,FloatingPanel}.tsx` · `features/settings/components/{SettingsModal,GeneralTab,UsageTab,ProviderUsageTab,parts}.tsx`.

## 참고 문서

- `docs/handoff/0098-static-provider-usage-correction/{plan,verify}.md`(선행) · `app/src/main/AGENTS.md`(레이어 DAG) · `docs/arch/backend/standardization.md`(배포/확장 계층) · `app/AGENTS.md`(스타일링·토큰) · `docs/arch/frontend/`(UI/상태).
- IPC 변경 없음(정적 provider 계약·cost 채널은 0098 유지) → `IPC_CONTRACT.md` 무변경 예상.

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트: (1) `STATIC_USAGE_PROVIDERS` 기본 `[]` + 배럴 확장만으로 service 인식(항목1 회귀) (2) cron 게이트 `isPreset` 파생(순수 판정) 또는 컴포넌트 상태 테스트 (3) i18n ko/en 키 패리티(기존 테스트 재실행). 시각(블루·이동 레이아웃)은 사람 검증.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 라이브 세션 요청 + 본 세션 Q&A 확정 인용, 추론 최소(도넛 등 파생 없음).
- [x] 자료조사 — 발견마다 `파일:라인`/문서 레퍼런스.
- [x] 인수 기준 — 13개 번호·검증 가능(기본 0·cron 게이트·블루·hex 0).
- [x] 의존 기술 — 신규 의존성 0, 0098 프레임워크 재사용.
- [x] 파생 UX — provider 이전·cron 자동표기·다크 대비·접근성.
- [x] 리스크 — 기본 제거 동작변화·features 리터럴·블루값·i18n·예시활성.

---

> **[구현자 기입]** 이하는 구현 턴(Claude 비기능)에서 채운다.
