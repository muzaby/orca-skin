# Verify — 0099-static-provider-optout-settings-polish

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0099-static-provider-optout-settings-polish` |
| 검증자 | Claude Code |
| 일자 | 2026-07-13 |
| 대상 커밋 | `7df8a78` (구현 산출물 = INDEX 기재 Codex env `b308c59` 를 본 브랜치에 편입, 위생 노트 ①) |
| 라운드 | 1 |
| 상태 | **PASS** |

## 구현자 코멘트 확인 (매트릭스 전 선행)

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 설계 리뷰: "core 무편집" = service·scheduler·IPC·tracker·enumeration·materializer 에 provider-name 분기 미추가로 해석, opt-in 지점은 `modules/index.ts` 한 곳 | 타당 | 기준 2 매트릭스에서 diff 파일 목록으로 재확인 — 해당 6종 미편집 ✅ |
| 설계 리뷰: 기존 `sources/settings/claude/{bedrock,vertex,custom}` 파일 미삭제, 재등록 전까지 refresh 비활성 | 타당 | 기준 1·문서(standardization.md) 이전 안내와 일치 |
| 설계 리뷰: 공용 `Toggle` on 을 blue 로 — Skill detail 등 타 사용처도 동일 on/off semantics | 타당 (공용 atom 의미 일관) | 기준 10 — 시각 톤은 사람 검증 이관 |
| ✅ 선조치: preset→`직접 입력` 선택 즉시 input 활성 (`customSelected` UI state + `usageSchedule` view-model) | 타당 — plan 의 단순 `isPreset` 만으로는 커스텀 진입 직후 input 이 계속 disabled 되는 결함이 실제 존재 | 기준 6·7, `usageSchedule.test.ts` 3케이스로 고정 |
| ✅ 선조치: `_example` 는 typecheck 되되 `modules/index.ts` 미import → 기본 부팅/번들 비활성 | 타당 | 기준 3 — typecheck green + import 부재 grep |
| ✅ 선조치: static refresh 5분 스케줄러 유지, 기본 registry 0개라 순회 대상 0 | 타당 | 기준 2 — scheduler 무편집 |

## 요구사항 충족 매트릭스

### 항목 1 — 정적 provider 기본 주입 제거 + 확장 모듈화

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 1 | `STATIC_USAGE_PROVIDERS` 기본 `[]` · 신규 부팅 시 bedrock/vertex/custom `settings.json` 미생성 (기존 편집분 보존) | ✅ | `features/providers/static/index.ts:25`(= `STATIC_USAGE_PROVIDER_MODULES`) · `modules/index.ts:15`(`= []`) · `index.test.ts:9-20`("registers no static providers by default and materializes no settings" — bedrock/vertex/custom 디렉토리 부재 assert) 통과 · materialize 는 `existsSync` 가드로 부재 시에만 생성(`index.ts:40`) |
| 2 | opt-in = `modules/<name>/` 폴더 + 배럴 1줄, **core 무편집** 시연 | ✅ | 구현 diff(`7df8a78`) 에 `bootstrap`·`external-usage-service`·`scheduler`·`handlers/misc`·`provider-registry`·tracker **미포함**(`git show --name-only` 확인). `materializeStaticProviderSettings` 는 `index.ts` 에 있으나 provider-불특정 루프(이름 분기 0, `:36-44`) |
| 3 | 예시 템플릿(비활성) — 골격 존재하되 배럴 미수집·기본 부팅 미로드·활성화 절차 문서화 | ✅ | `modules/_example/index.ts`(config-sugar+hook 골격) · `modules/index.ts` 는 `[]` 이며 `_example` 미import(활성화 예시는 주석 `:11-13`) · typecheck green |
| 4 | 경계 위반 0 · 신규 의존성 0 · 회귀 테스트(빈 기본·확장) 신설 | ✅ | `npm run lint` exit 0 · deps 0(diff 에 package.json 무변경) · `index.test.ts:22-40`("materializes a registry-only opt-in module without provider-name branches" — 명시 모듈만 materialize) |

### 항목 2 — `주기적 실행` 이동 + cron 게이트

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 5 | 스케줄링 `SettingsGroup` 이 `설정.사용량` 에 렌더, `설정.일반` 에서 제거 | ✅ | `UsageTab.tsx:66-139`(scheduling group) · `GeneralTab.tsx` 에 `scheduler`/`usageRecompute` 참조 0 (grep) |
| 6 | cron `<input>` 은 custom 선택 시에만 활성, 프리셋 선택 시 disabled(muted·`cursor-not-allowed`·`aria-disabled`) | ✅ | `UsageTab.tsx:118-119`(`disabled`/`aria-disabled = !cronInputEnabled`), `:133-135`(muted+`cursor-not-allowed`) · 판정 `isUsageCronInputEnabled(selectValue)` = `usageRecomputeSelectValue` 재사용(`usageSchedule.ts:9-18`) |
| 7 | 프리셋↔직접입력 전환·저장·영속(`useTweaks`) 무회귀 · main 스케줄러 실동작 무변경 | ✅ | `customSelected` state + `input key={cron:selectValue}`(`:116`) 로 전환 반영, 저장은 기존 `setTweak('scheduler', …)`(`:99-102,124-127`) · main scheduler 코드 미편집(기준 2) · `usageSchedule.test.ts` 3/3 |
| 8 | i18n 스케줄링 키군 `settings.usage.*` 이동(ko/en 동시)·참조 갱신·ko/en 패리티 | ✅ | ko `usage` 네임스페이스 `:687-697` · `settings.general.{scheduling,…}` 참조 0(grep) · `resources.test.ts` 3/3 통과(ko/en 키 패리티) |

### 항목 3 — 디자인 토큰 준수 + 블루 선택/활성

| # | 인수 기준 | 충족 | 증거 |
|---|---|---|---|
| 9 | 신규 블루 토큰이 white + `[data-theme='dark']` 두 스코프 정의 · `--color-indigo` 메터 전용 유지 | ✅ | `tokens.css:41-43`(white: `--color-toggle-on`·`--color-selected`·`--color-selected-soft`) · `:198-200`(dark) · `--color-indigo`(`:40`) 주석·용도 불변 |
| 10 | 온-토글이 블루 — 설정 `Toggle` + 디버그 `PanelToggle` | ✅ | `Toggle.tsx:21`(`on ? 'bg-toggle-on'`) · `FloatingPanel.tsx:131`(`value ? 'bg-toggle-on'`), `#34c759` 소멸(grep 0) |
| 11 | 모든 선택·활성 상태 블루 통일 — 활성 탭·테마 세그먼트·provider 서브탭 | ✅ | `SettingsModal.tsx:74`(활성 탭)·`:94`(provider 서브탭) = `bg-selected-soft`/`text-selected` · `GeneralTab.tsx:109`(테마 세그먼트) · `FloatingPanel.tsx:170`(PanelRadio pill=`bg-selected-soft`)·`:212,252`(focus/accent=selected) |
| 12 | 설정 컴포넌트 + `FloatingPanel` 하드코딩 hex/rgb 0 | ✅ | `grep -riE '#[0-9a-f]{3,8}\b\|rgba?\('` on `settings/components/` + `FloatingPanel.tsx` + `Toggle.tsx` → 0 매치 |
| 13 | 게이트 green · 경계 0 · 의존성 0 · (색 튜닝·시각 검증은 사람) | ✅ (기계 판정분) | 아래 게이트 결과 · 색 대비/시각은 §책임 분리로 사람 이관 |

## 검증 책임 분리 (사람 vs 에이전트)

| 항목 | 에이전트(Claude) | 사람(사용자) | 결과 |
|---|---|---|---|
| 게이트 lint/typecheck/test | ✅ 실행 | — | lint 0 · typecheck 3종 0 · Vitest 802/834(32 red=DB 네이티브 ABI 환경 제한) · scripts 24/24 |
| 인수 기준 ↔ 코드 대조 | ✅ 증거 첨부 | 이견 시 중재 | 13/13 충족 |
| 레이어 경계(eslint-boundaries) | ✅ 위반 0 | — | lint green |
| 문서 형식/링크/한국어 | ✅ | — | standardization.md·AGENTS.md 갱신 정합 |
| AGENTS.md 위생 스캔 | ✅ grep | ✅ 최종 판단 | 키/토큰/이메일/IP 0 (매치=`orca.json/secret` 아키텍처 용어) |
| 제품 의도 부합(opt-in 방향) | ✖ 보조 | ✅ 결정 | 0098 기본 주입 → opt-in 전환, 라이브 세션 의도와 일치(보조 판단 부합) |
| UI/UX 시각 검증(블루 톤·다크 대비·레이아웃) | ✖ | ✅ | 사람 확인 대기 |
| 신규 의존성 승인 | ✖ | — | 신규 0 |
| PR 머지 승인 | ✖ | ✅ | 사람 확인 대기 |

## 게이트 재실행 결과

> 본 세션은 신선 클론이라 `npm ci` 를 선행. Electron 바이너리 egress 403(0019/0098 동일 베이스라인)으로 `postinstall` 의 electron ABI 리빌드 및 better-sqlite3 네이티브 빌드가 차단됨 → `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install` 로 JS 툴체인만 설치.

```
$ npm run lint       → exit 0 (eslint --cache --fix ./src ./scripts, 경계 포함 위반 0)
$ npm run typecheck  → exit 0 (typecheck:node + typecheck:web + typecheck:test 3종 green)
$ vitest run         → Test Files 6 failed | 108 passed (114)
                       Tests 32 failed | 802 passed (834)
   · 32 red 전부 "Error: Could not locate the bindings file"(better-sqlite3 네이티브 미빌드)
     + 1 "Electron failed to install correctly" — 모두 egress 403 환경 제한, 로직 무관.
     실패 파일 6종 = queries/migrate/writer/fork/continuity/builder(전부 DB 네이티브 로드).
   · 신규 0099 스위트는 네이티브 무의존 → 직접 실행 5/5 green
     (static/index.test.ts 2 + usageSchedule.test.ts 3).
$ node --test scripts/*.test.mjs → # tests 24 # pass 24 # fail 0
```

- **게이트 판정**: lint/typecheck 완전 green. Vitest 32 red 는 0098·0019 verify 와 동일한 네이티브 ABI 환경 제한(코드 무관)이며, 본 변경이 손댄 파일의 스위트(static 레지스트리·usage schedule·i18n 리소스 패리티)는 전부 green. 게이트 통과로 판정.

## 위생 검토 (AGENTS.md 변경 시)

- `app/src/main/AGENTS.md` 변경분 키/토큰/이메일/IP 스캔: 매치 없음 (유일 hit `orca.json/secret` 은 아키텍처 용어).
- 변동성/일회성/장문 코드설명서 혼입: 없음 — features 슬라이스 표에 정적 provider opt-in 레지스트리 경로 1항, 작업 규칙에 provider 리터럴 허용 위치 추가(항구적 규칙).
- `docs/arch/backend/standardization.md`: opt-in 규칙 1블록 추가(정본 톤·한국어·결정 중심).

## PHASES.md 정합성

- 형식/커밋 기재 확인: 페이즈 표에 `0099` 행 승격, 커밋 `7df8a78` 기재 — 형식 정합.

## 검증 자기 리뷰 (무엇이 부족했나)

- **설계 단계**: plan 의 cron 게이트를 단순 `isPreset = presets.some(cron)` 로 제시했으나, preset→custom 진입 직후 input 이 계속 비활성되는 엣지를 못 짚음 — 구현자가 `customSelected` view-model 로 선조치·보고. 설계가 파생 UX(§엣지케이스)에서 이 전이를 예열했으면 더 나았다.
- **구현 단계**: 미흡 없음. 선조치 3건 모두 경계(구현 세부) 내에서 처리·보고. `_example` 를 typecheck 대상으로 유지하되 배럴 비수집한 처리가 "붙이는 법" 참조물 의도와 정확히 부합.
- **검증 단계**: 네이티브 DB 스위트를 본 환경에서 실행하지 못해 DB 경유 로직(0099 는 미해당)은 단위+`--check` 대리검증에 의존. 0099 변경은 DB·IPC 무편집이라 이 공백이 리스크로 이어지지 않음. 블루 색값의 다크 대비(WCAG)·레이아웃 시각은 기계 판정 불가로 사람 이관.

## 결론 / 다음 단계

- 상태: **PASS** — 인수 13/13 충족, 게이트(lint/typecheck 완전 green, Vitest 802 pass·32 red=네이티브 ABI 환경 제한, scripts 24/24), 레이어 경계 0, 신규 의존성 0, IPC 무변경, 하드코딩 hex/rgb 0.
- `INDEX.md` `verify/PASS` → `docs/PHASES.md` 표 승격.
- **사람 확인 대기**: 블루 토큰 색값·다크 테마 대비(WCAG)·설정/디버그 선택 상태 시각 톤 · `주기적 실행` 사용량 탭 이동 후 레이아웃 · 실환경에서 회사별 정적 provider 모듈 opt-in 등록 흐름 · PR 머지.
