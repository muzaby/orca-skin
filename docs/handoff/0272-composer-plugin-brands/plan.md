# Plan — 0272-composer-plugin-brands

## 메타

| 항목 | 값 |
|---|---|
| 작성자 / 일자 | Codex / 2026-10-21 |
| 상태 / 라운드 | IMPL_DONE / r1 |
| V mode / 기준 V / 유효 V | Baseline V / none / V1 |
| 구현 당시 브랜치 / 현재 | codex-harness-entry-menu / main(병합 후 사용자 전환 요청) |

# Part I — Product & UX Contract

## 1. Context / 목표

수정한다. 엔진 추가 메뉴와 Composer 그룹 로고에 기존 브랜드 색을 적용하고, 양 하네스의 플러그인 선택을 `@` 하이라이트로 표시한다.
상태 패널 활성화와 nav 색상의 범위를 확인하고, OpenCode 시작 지연은 사용자 제공 소스와 설치 CLI 버전에 맞춰 조사해 보고한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | 엔진 추가 팝업의 Claude/OpenCode 왼쪽 컬러 로고, 이전 요청 여부 확인 | 현재 사용자 턴 |
| 명시 요구 | Composer + 메뉴의 스킬 `/`·플러그인 `@` 하이라이트, OpenCode 동일 적용 | 현재 사용자 턴 |
| 명시 허용 | 플러그인 하이라이트는 참조와 같은 색이어도 됨 | 현재 사용자 턴 |
| 명시 요구 | + 메뉴의 하네스 그룹 타이틀 컬러 로고 | 현재 사용자 턴 |
| 조사 요구 | `.temp/opencode` 데스크톱 시작과 Orca 비교, config 이후 약 13초·다수 MCP/plugin·Failed to load plugin 확인 | 현재 사용자 턴 |
| 후속 결정 | nav 스킬 탭 색상 기준은 “현상태 유지” | 범위 질문에 대한 사용자 답변 |

## 3. Decision Ledger

| ID | 결정 | 출처 / 조건 | 상태 |
|---|---|---|---|
| D-01 | native 토글·저장 범위 보고, nav 색상 현상태 유지 | 당시 사용자 답변 | 색상 부분 SUPERSEDED → 0278 D11·D24; 보고 요구 유지 |
| D-02 | 엔진 추가의 두 선택지 왼쪽에 공식 컬러 마크를 표시하고 선택 동작은 유지한다 | 사용자 | ACTIVE |
| D-03 | 양 Composer의 스킬은 `/name`, 플러그인 메뉴 항목은 `@id`로 삽입·하이라이트한다 | 사용자, native MCP도 현재 플러그인 메뉴에 포함됨 | ACTIVE |
| D-04 | 하네스 plugin이 제공하는 skill/command는 기존 스킬 그룹과 `/name` 계약을 유지한다 | 기존 0267 D-19, 이번 “스킬은 /”와 합치 | ACTIVE |
| D-05 | 플러그인은 파일 참조와 같은 기존 배경색을 사용한다 | 사용자 허용 범위의 구현 선택 | ACTIVE |
| D-06 | 사용 가능한 native MCP의 동일 투영을 메뉴와 하이라이트에 사용한다 | 두 원천을 다르게 읽으면 선택한 항목이 무색으로 남는 원인 | ACTIVE |
| D-07 | 새 의존성·설정 쓰기·OpenCode 2.x 마이그레이션 없이 시작 차이를 조사한다 | 요청은 비교·원인 확인이며 migration 요청 아님 | ACTIVE |

ACTIVE 결정 ↔ AC 대조: D-01↔AC6, D-02↔AC1, D-03~06↔AC2~5, D-07↔AC7·8, 충돌 0.

## 4. 요구 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 실제 활성화인가 | 예, Claude SDK flag 적용→reload 관측→프로젝트 local 설정 저장 | `native-resources.ts:set`, `adapter.ts`, `plugin-state.ts` |
| nav 색상과 왜 다른가 | global/home catalog와 cwd별 local 설정이 다름 | `skill-catalog.ts:readSkillCatalog(home, …)` |
| 기존 highlight가 있는가 | 내장 Plugin @id는 있음; native MCP는 일반 문장을 넣어 빠짐 | `attachMenuModel.ts:nativePrompt`, `composerDecoration.ts` |
| 기존 로고 구현이 있는가 | 카드·모델 그룹에 있음, 추가 선택지와 + sourceIcon에는 빠짐 | `EngineCard.tsx`, registry `composer.ts` |
| 소스 버전이 일치하는가 | HEAD 2.1.1, 설치 CLI 1.19.0, 해당 git tag 존재 | 로컬 git SHA·package.json·opencode --version |

최초 nav 색상 유지 답변은 후속 0278 D11·D24로 대체됐다. 현재 색상은 on/off가 아닌 Orca의 SDK 제어 가능성에 따른다.

## 5. 동작 / 사용자 흐름

```text
엔진 추가 → 컬러 로고가 있는 Claude/OpenCode → 기존 해당 폼
Composer + → 스킬 → /name 삽입 → skill 배경
Composer + → 플러그인 → @id 삽입 → 참조 배경
```

| 상태 / 입력 | 결과 |
|---|---|
| connected+enabled MCP 선택 | 실제 id의 @ 토큰, draft 보존, 메뉴 닫힘, 전송 없음 |
| disabled/configured/failed/disconnected native 항목 | 기존 사용 가능 필터 유지, 후보·native 하이라이트로 되살리지 않음 |
| OpenCode includeExtensions=false | native MCP @ 하이라이트 허용, Orca 통합 후보는 계속 제외 |
| 모르는 @·경로의 접두사 | Plugin으로 칠하지 않음, 검증된 파일만 참조색 |
| IME·재선택·세션 갱신 | 기존 draft/scroll/selection과 구독 수명 유지 |
| 공백을 포함하는 native id | `@"id with spaces"`로 원문 id 보존, 실제 파일과 별도로 membership 확인 |

## 6. 범위 / 비범위

범위: 위 로고/입력 표시·실제 메뉴 선택 회귀·요청 이력 조사·시작 시퀀스 비교 보고.
본 작업의 비범위: native 자동 활성화·MCP 연결 정책 변경·모델 전송·OpenCode 2.x 이행. 후속 nav 색상은 0278, 서버 수명은 0275가 소유한다.

## 7. Requirements / Acceptance — R ↔ AT

| R / AT / AC | 동작 기준 | 검증 / production 경로 |
|---|---|---|
| R-01 / AT-01 / AC1 | 엔진 추가 메뉴의 두 라벨 왼쪽에 대응 컬러 SVG, 선택→기존 폼 유지 | `AgentEnvironmentView.interaction.test.ts` 실제 add→두 SVG/순서/색→선택/닫힘 |
| R-02 / AT-02 / AC2 | 양 하네스에서 +→native MCP 선택은 @id를 넣고 참조색 highlight, draft 보존·자동 전송 없음 | `Composer.native-menu.test.ts` 실제 controller/menu/input/layer, id와 label을 다르게 준다 |
| R-02 / AT-03 / AC3 | 스킬은 `/` 그대로이며 대소문자·underscore·namespace가 있는 실제 명령도 highlight | 동일 실제 메뉴 테스트 + `composerDecoration.test.ts` known name 전체 비교 |
| R-02 / AT-04 / AC4 | 미연결·미활성 native는 후보/장식에서 제외, unknown·경로 접두사·다른 세션과 구별; 내장 Plugin도 유지 | `attachMenuModel.test.ts`, `Composer.native-menu.test.ts`, tokenizer 회귀 |
| R-01 / AT-05 / AC5 | +의 Claude/OpenCode 스킬·MCP 그룹 마크가 기존 브랜드색이며 출처/하네스가 일치 | 실제 양 Composer 메뉴 그룹 SVG class·viewBox 단언 및 브라우저 시각 |
| R-03 / AT-06 / AC6 | native 실제 적용·저장 범위와 nav 전역 상태 차이 보고. 색상 유지 부분은 0278 AC1로 이관 | 현재 native adapter/plugin-state 테스트·코드 경로와 보고서 |
| R-03 / AT-07 / AC7 | 이전 요청의 정확/유사 범위와 빠진 표면을 근거와 함께 보고 | 0238·0259·0267의 Decision/AC 원문 좌표 |
| R-03 / AT-08 / AC8 | 현재 HEAD와 1.19.0 데스크톱, Orca 시작 경로를 비교하고 config 이후 대기·plugin 오류의 확인/추정을 구분 | `startup-analysis.md`의 버전·소스 좌표·관측 및 재현 수단 |

## 후속 정책과 증거 승계

V1@256ddd24의 VP-06/AC6 색상 유지 부분은 0278 AC1/VP1·VP4로 이관한다. 브랜드·스킬 /·플러그인 @·기존 요청 조사 AC1–5·7은 유지한다. AC8의 HEAD/1.19.0 조사 기록은 당시 환경의 증거이며 사용자 환경 1.17.19 시작 기준은 0274·0275가 정본이다.

## 7-A. V / Trace Matrix

명시적으로 상속할 V 없이 이번 요청의 Baseline V를 만든다. 이전 handoff의 독립 검증 대기 상태는 바꾸지 않는다.

| Node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R-01 / AT-01·05 | R / AT | 브랜드 표시 | NEW |
| R-02 / AT-02~04 | R / AT | 식별자 삽입과 장식 | NEW |
| R-03 / AT-06~08 | R / AT | 조사·보고, 변경하지 않을 정책 | NEW |
| SD-01 / ST-01 | SD / ST | 메뉴 선택→draft→highlight | NEW |
| AR-01 / IT-01 | AR / IT | native 후보와 controller/layer, source 브랜드 투영 | NEW |
| MD-01 / UT-01 | MD / UT | token 원문·경계·membership | NEW |

| Pair | left ↔ right / requiredness | production path | 직접 oracle | 선택적 적대 증거 | §10 |
|---|---|---|---|---|---|
| VP-01 | R-01↔AT-01·05 REQUIRED | Add menu/Composer source→실제 SVG·선택 | 위 AC1·5의 실제 DOM 및 시각 | not selected — 직접 SVG·동작 관측 | EP-01·02 (4) |
| VP-02 | R-02↔AT-02~04 REQUIRED | 실제 +→CascadeMenu→runAttachMenuAction→snapshot→surface→layer | 실제 `Composer.native-menu.test.ts` 양 backend·native/Orca·inactive | not selected — 입력과 장식 출력 직접 관측 | EP-03~05 (12) |
| VP-03 | SD-01↔ST-01 REQUIRED | 연결 view→menu→선택→draft·highlight→연결 상태 갱신 | 위 실제 controller 테스트, disconnected/disabled 갱신에 text 보존 | not selected — 실제 상태 전이 | EP-03·04 (11) |
| VP-04 | AR-01↔IT-01 REQUIRED | 후보 projection→action/id, registry→SVG props, controller→surface→tokenize | `attachMenuModel.test.ts`와 실제 Composer/engine DOM 테스트 | not selected — id/label·source/backend 구별 | EP-01~04 (15) |
| VP-05 | MD-01↔UT-01 REQUIRED | raw text+known ids→token segments | tokenizer 테스트와 attachMenuToken의 slug/colon/공백/path 구별 입력 | not selected — 실제 parse 결과 | EP-03 serializer 2·EP-04 token matcher 1·EP-05 (4) |
| VP-06 | R-03↔AT-06~08 REQUIRED | 로컬 코드/기록/관측→보고 | `startup-analysis.md` 근거표·현행 테스트 실행 | not selected — 조사 산출물 | 0 — production 변경 없는 자료조사 |

운영 gate: 수정 subtree lint/typecheck, 관련 비DB 테스트, doc inventory·test budget, UI catalog·변경 문서 링크·diff/trailer·원격 동기화.

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 대상 / 검색 | N / 관측 | 의미 |
|---|---|---|
| `nativeAttachItems`의 nativePrompt | MCP action 1자리 | +의 native 플러그인은 일반 문장이라 @ 장식 불가 |
| `validPluginIds` source→surface→layer | controller/surface/layer/tokenizer | native membership를 기존 provider membership와 합쳐 전달해야 함 |
| `sourceIcon` registry | HarnessLogo backend/className | 그룹이 부모 text-ink3를 상속해 흐림 |
| `AgentEnvironmentView` HARNESS_IDS | 두 하네스 선택지 | 기존 SVG 자산 재사용 |
| 이전 요청 | 0238 Plugin chip, 0259 @id 선택, 0267 카드·모델 로고 | 정확 범위는 보고서에 보존 |

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

native MCP→nativePrompt 일반 문장, 내장 provider→@id. 장식 membership는 provider만 알고 native를 모른다.
그룹 SVG는 currentColor를 흐린 제목에서 상속하고, 엔진 추가 선택지는 텍스트만 있다.

### TO-BE

사용 가능한 native MCP의 최소 `{kind:plugin,id,label}` projection을 메뉴와 장식이 함께 쓴다. 기존 Plugin action으로 @ 토큰을 넣고, 원문 id의 membership로 구분한다.
기존 공식 SVG에 카드/모델과 같은 `text-spinner`·`text-oc-ink` 토큰을 명시한다.

| 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 책임 | native 후보 필터가 메뉴에만 있음 | 순수 projection을 메뉴/controller가 재사용 | EP-03 |
| 제어 흐름 | 일반 문장 삽입 | 기존 Plugin action→token | AC2 |
| 상태 | provider만 valid ids | provider+현재 연결의 native ids, OpenCode native 독립 | EP-04 |
| 표시 | plugin violet, file emerald | plugin/file 참조 배경 통일, skill 유지 | AC2~4 |
| 브랜드 | 부모색 상속·로고 없음 | 현재 출처의 명시 브랜드색 | AC1·5 |

## 10. 계약 / 타입 / 강제 지점

| Pair / EP | 계약 / SSOT | 언제 강제 (자리 목록 = 분모) | 자리 검색 명령 | 실패 의미 / oracle |
|---|---|---|---|---|
| VP-01 / EP-01 | 추가 선택지 브랜드 | AgentEnvironmentView의 Claude/OpenCode SVG 소비 (2) | `rg -n 'HARNESS_IDS|ClaudeLogo|OpenCodeLogo' app/src/renderer/src/features/engine/common/components/AgentEnvironmentView.tsx` | 다른 브랜드/색/선택, 실제 add 클릭 테스트 |
| VP-01·04 / EP-02 | source 로고 | registry composer의 HarnessLogo backend·className (2) | `rg -n 'HarnessLogo|backend:|className:' app/src/renderer/src/features/chat/harnesses/registries/composer.ts` | 출처와 다른 브랜드/부모 흐림 상속, 실제 양 메뉴 DOM |
| VP-02~05 / EP-03 | native 후보→@id | nativePluginMentions의 filter·id/label map, nativeAttachItems action, attachMenuToken plugin 분기, pluginMentionToken (5) | `rg -n 'nativePluginMentions|kind.*mcp|kind.*plugin|pluginMentionToken|type: .plugin' app/src/renderer/src/features/chat/lib/attachMenuModel.ts app/src/renderer/src/features/chat/lib/pluginMention.ts` | id/label 바뀜·비활성 포함·일반 문장 삽입, pure+실제 메뉴 테스트 |
| VP-02~05 / EP-04 | 유효 ids→표시 | controller union·surface prop, surface→layer prop, layer→tokenizer arg, tokenizer @ matcher, layer chip 색 (6) | `rg -n 'validPluginIds|PLUGIN_TOKEN_RE|segment.chip' app/src/renderer/src/features/chat/harnesses/common/composer/{ComposerInputController.tsx,ComposerInputSurface.tsx,ComposerDecorationLayer.tsx,composerDecoration.ts}` (PowerShell에서는 파일을 개별 인자로 전달) | 선택 후 무색·다른 세션 부활·파일 접두사 오인, 실제 controller와 pure token tests |
| VP-02·05 / EP-05 | known skill의 원문 | tokenizer skill matcher (1) | `rg -n 'SKILL_TOKEN_RE|knownSkillNames' app/src/renderer/src/features/chat/harnesses/common/composer/composerDecoration.ts` | uppercase/underscore/namespace 명령이 무색, 실제 선택+tokenizer |

분모: 2+2+5+6+1=16. 검색은 slot을 찾는 수단이며 import·선언·형제 origin 호출·일반 nativeCommand는 transport slot으로 중복 세지 않는다.
자리마다 위 테스트에서 반대 backend·다른 id/label·서로 다른 source·true/false를 구별 입력으로 사용한다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 / 변경 | 테스트 seam |
|---|---|---|
| engine `AgentEnvironmentView.tsx` | 두 기존 로고 사용 | 실제 add 메뉴→폼 |
| chat registry `composer.ts` | source를 올바른 backend·브랜드색으로 투영 | 실제 양 Composer |
| chat lib `pluginMention.ts`, `attachMenuModel.ts` | native 후보 SSOT와 @ 직렬화, 필요한 공백 id 인용 | 순수 + 실제 선택 |
| Composer controller/tokenizer/layer | 현재 native membership 전달·표시 | 실제 input/장식 + 순수 |
| 관련 기존 tests | 사용자가 누르는 entry부터 결과까지 관측 | renderHarness·SSR·Vitest |
| 디자인 시스템/카탈로그·rendering 문서 | 변경된 native 선택 토큰·표시 규칙 정정 | 현재 코드·UI와 대조 |
| `startup-analysis.md` | 활성 범위·이력·OpenCode 시작 비교 | 조사 근거·관측 분리 |

신규 production 순수 파일/IPC/의존성 없음. 기존 구조를 재사용하므로 Electron/native 의존을 테스트에 추가하지 않는다.

## 12. End-to-end 영향

native 명령은 계속 `/name`, 네이티브 MCP의 선택 토큰만 `@id`다. 원본 텍스트와 모델 전송·수동 편집은 기존 draft 경로를 사용한다.
OpenCode에서 Orca 통합을 주입하는 정책은 바꾸지 않고 native 후보만 별도로 인정한다.

## 13. Lifecycle / 오류 / 정리

새 저장소·구독·캐시 없음. 기존 native view 갱신에 따라 membership가 바뀌되 draft는 바꾸지 않는다.
설정 쓰기는 하지 않는다. 상태 사본은 plan 메타·INDEX·구현 trailer를 함께 갱신하고 재조회한다.

## 14. 성능 / 상한 / 최적화

기존 현재 native items의 선형 projection과 Set 합성만 추가한다. 네트워크·MCP 연결·새 서버를 UI 표시 때문에 시작하지 않는다.
시작 지연 조사는 별도 관측이며 이 수정에서 server lifetime이나 plugin/MCP 초기화 순서를 바꾸지 않는다.

## 15. 외부 포트 / 문서 계약

새 공개 포트 없음. native 선택 텍스트의 사용자 요구 변경을 현재 rendering 문서에 반영한다.

## 16. 기존 결정·규칙과의 관계

0238/0259의 @ Plugin 계약은 복구·확장하고, 0267의 native plugin skill 분류는 유지한다.
renderer DAG·공식 SVG·시맨틱 브랜드 토큰을 준수한다. source token의 기호는 이번 사용자 요구가 기준이다.

## 17. 리스크 / 트레이드오프

native MCP id와 파일명이 같아도 기존 membership 우선순위를 유지한다. 전체 id를 검증해 파일 접두사만 칠하지 않도록 테스트한다.
OpenCode 소스 HEAD와 설치 버전 차이는 보고서에서 나눈다. 계측 없이 13초의 단일 원인을 확정하지 않는다.

## 18. 영향 파일 / 문서

§11 파일·tests, 이 plan/INDEX. `.temp/opencode`와 사용자 설정은 조사만 하며 편집하지 않는다.

## 19. 게이트

`app/AGENTS.md`와 renderer 하위 가이드의 lint/typecheck, 관련 chat/engine 비DB 테스트, inventory·budget·빌드.
시각 확인은 실제 Chromium에서 white/dark, 양 하네스, add 메뉴와 +의 그룹/선택·좁은 입력·키보드 흐름을 확인한다.
조사는 CLI 버전과 git tag·소스 좌표를 잠그고, 실제 계측의 설정/시작/종료 범위를 보고한다.

## READY self-review

ACTIVE 결정·AC 대조 충돌 0. 기존 native-menu/engine interaction/decoration 테스트의 entry와 실제 callback·장식 출력을 확인했다.
모든 NEW node는 위 REQUIRED pair와 연결했고, 전수 분모는 §10의 16자리다. 직접 DOM/입력 oracle로 확인하며 선택 적대 증거는 없다.

---

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: D-01~07 유지. native MCP의 메뉴·장식을 동일 projection에 연결하고 출처 로고·엔진 추가 로고를 구현했다.
- 이견 / 현실성 문제: browser의 localhost 접근이 `ERR_BLOCKED_BY_CLIENT`, 앱 표면은 비활성이라 실제 창의 white/dark 시각 인수를 수행하지 못했다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. nav 색상과 native 설정·server lifetime의 production 변경은 없다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

아래에서 `N`은 `Composer.native-menu.test.ts`, `A`는 `attachMenuModel.test.ts`, `T`는 `composerDecoration.test.ts`, `L`은 `ComposerDecorationLayer.test.ts`, `E`는 `AgentEnvironmentView.interaction.test.ts`다. 파일 정본 경로는 §7·11에 있다.

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 · 자리별 oracle 좌표 | 운반 항 · 구별 값 · 관측 | 남긴 곳 |
|---|---|---|---|---|---|---|
| VP-01·04 | EP-01 브랜드 | add의 Claude/OpenCode SVG (2) | 2/2 (DOM) | §10 rg에서 두 SVG 소비; E:`selects Claude or OpenCode…` 실제 add→첫 SVG→각 폼 | label별 서로 다른 viewBox·명시 color·첫 자식 SVG; 선택값도 각 폼으로 구별 | 실제 창 시각 인수 |
| VP-01·04 | EP-02 source | HarnessLogo backend/className (2) | 2/2 (DOM) | registry rg의 backend/className; N:`shows all source groups…`, `highlights selected native @ plugins…` 양 backend | sourceBackend→Claude/OpenCode의 서로 다른 마크·text-spinner/text-oc-ink, skills/MCP 두 메뉴에서 관측 | 실제 창 시각 인수 |
| VP-02~05 | EP-03 후보·직렬화 | filter/map/native action/attachMenuToken/pluginMentionToken (5) | 5/5 | A:`shares native menu membership…`, `keeps the exact native plugin id…`; N의 native·Orca·내장 선택 | id와 label 구별, enabled false·configured·disconnected·origin 구별; quoted id도 원문 membership와 입력으로 관측 | — |
| VP-02~05 | EP-04 장식 전달 | controller union/prop, surface prop, tokenizer arg/matcher, 색 (6) | 6/6 | N:`highlights selected native @ plugins…`, `keeps a quoted native plugin id…`, `shows all source groups…`; L:`uses the reference background…` | native id·Orca id·Jira id·공백 id→실제 입력과 emerald span; disabled 갱신→span만 제거·draft 보존; OpenCode false 정책 구별 | — |
| VP-02·05 | EP-05 skill | skill matcher (1) | 1/1 | N:`loads %s native commands from +…`, T:`preserves complete skill identities…` | `/session-B:review`·underscore·Unicode·namespace·구두점→원문 skill span, unknown/plain 보존 | — |

검색 대조: EP-01~05의 소비 자리 2+2+5+6+1=16. 출력 중 import·선언·일반 내장 provider map·nativeCommand 형제는 §10 분모와 다른 역할이며 추가/누락 소비 자리 차집합은 없다.
§10 목록 밖 운반 자리: 없음. 이전 verify 고장 이력: 최초 r1이라 없음. 시각 인수는 DOM 강제 지점과 별도로 미확인으로 남긴다.

| Pair | requiredness | 자기 상태 | 직접 oracle 좌표 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_BLOCKED | E의 add→브랜드/폼, N의 양 메뉴 source 마크 DOM은 통과 | not selected; 실제 창 white/dark는 도구 접근 차단 |
| VP-02 | REQUIRED | SELF_PASS | N의 실제 +→선택→token/highlight, A/T/L | not selected — 직접 출력 |
| VP-03 | REQUIRED | SELF_PASS | N:`highlights selected native @ plugins…`의 disabled 갱신·draft 보존, 양 backend | not selected — 실제 상태 전이 |
| VP-04 | REQUIRED | SELF_PASS | E/N 실제 rendering path, A의 id/label/origin 구별 | not selected — 생산자/소비자 실제 조립 |
| VP-05 | REQUIRED | SELF_PASS | A:`keeps the exact native plugin id…`, T의 원문/형상/파일 접두사·구두점 테스트 | not selected — parse 결과 |
| VP-06 | REQUIRED | SELF_PASS | `startup-analysis.md` §2~7, CLI 버전·태그·계측 JSONL, Claude native 관련 테스트 | not selected — 조사 결과와 근거 |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 해당 없음 — 직접 oracle | 선택 적대 증거·인용 변이·신규 구조 proxy oracle 없음 | 최초 | 양 backend의 실제 menu/input/layer·SVG, pure membership·token 결과 | 직접 행동 관측으로 판정 |

분모 검산: 선택 증거 0 · 인용 변이 0 · 새 구조 oracle 0 = 잠금 의무 표 0행(위 행은 해당 없음 기록).
덮개 회귀: 기존 검사 삭제 없음. 예전 일반 문장 기대 두 행만 사용자 요구인 plugin action 기대값으로 바꾸고 실제 @ 입력·장식 단언을 더했다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 문구·상태의 소비자가 있는가 | 새 상태/문구 없음, @ token이 실제 textarea와 장식에 도달 | N 양 backend |
| production 재배치 때 정리 스코프 | 재배치 없음 | 새 구독·캐시 없음 |
| 이번 실패 경로가 상태표에 있는가 | disabled/configured/disconnected 및 unknown @는 §5 | A/N/T 직접 입력 |
| 실패가 무반응으로 보이는가 | 기존 메뉴 선택·닫힘·draft 보존·자동 전송 없음 | N 실제 menu/input sink |
| 늦은 응답이 draft를 되돌리는가 | native membership만 갱신, text는 갱신하지 않음 | N disabled push 뒤 입력 동일 |
| 하네스 경계를 지키는가 | OpenCode native만 허용, Orca 통합 false 유지 | N의 양 backend·origin/Jira 구별 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 기존 skill 정규식이 uppercase/underscore 이름에서 장식 실패 | 선조치 — known name 전체 비교, 후행 문장 구두점 보존 | T와 실제 `/session-B:review` span |
| 2 | native id는 내장 provider slug보다 넓음 | 선조치 — 필요 시 JSON quoted token, 전체 id로 membership 비교 | A/T/N의 공백·quote·scope/path 구별 |
| 3 | 초기 테스트 fixture가 존재하지 않는 idle 상태를 사용 | 선조치 — 실제 loading union으로 정정 | 첫 web typecheck TS2322 뒤 node/web/test 재실행 모두 통과 |
| 4 | 실제 창 시각 검수가 막힘 | 보고만 — AC5 시각 부분 미확인, 독립 검증에서 확인 | in-app browser localhost 접근 `ERR_BLOCKED_BY_CLIENT`; inventory에 native app/외부 browser 없음 |
| 5 | 13초·실패 plugin 환경이 이 호스트 설정에서 재현되지 않음 | 보고만 — 조사 범위를 구분하고 stage별 다음 계측 제시 | 최종 config 외부 plugin0/MCP0, 첫 SSE 4.452/3.878초 |

### 설계 대비 명시적 차이

production 설계 차이 없음. 실제 창 시각 gate만 환경으로 미완료다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — cache 대체 없음 | native view 기존 수명, N reconnect/disabled |
| 공유 | 해당 없음 — 새 저장소 없음 | A/N의 native/origin/내장 후보 구별 |
| 재진입 | 해당 없음 — controller 재배치 없음 | N reentry·menu 닫힘·draft 보존 |
| 다른 무효화 축 | 해당 없음 — 새 무효화 없음 | 기존 generation/세션 갱신 회귀 유지 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | §11 renderer·관련 tests, 현재 rendering/catalog·docs INDEX, 결과 보고·계측 evidence |
| 실행 명령 | 직접 Vitest(아래 대상 56파일), npm run lint/typecheck, harness-boundary·doc-inventory·test-budgets, ABI 확인 뒤 electron-vite build |
| 관측한 게이트 산출 | 최종 56파일/342케이스 pass; node/web/test 진단0; lint 오류0·기존 virtualizer 경고2 |
| 빌드 산출 | Electron ABI already ok; main398·preload3·renderer1836모듈 빌드 완료, 기존 SubAgentTaskDetail 정적/동적 import 경고1 |
| repository gate | inventory 생성물 변경 없음, real-git budget16 suites ok, boundary 오류 없음, 변경 문서5개 로컬 링크 누락 없음·diff whitespace 오류 없음 |
| UI catalog | 신규/삭제 TSX 없음. 기존 DecorationLayer·AgentEnvironmentView 행의 표시 계약 갱신 |
| 도구 변경 분리 | lint가 고친 무관한 chat-turn.execution-config.test.ts의 두 formatting hunk를 원복, main diff 없음 확인 |
| 계측·정리 | CLI1.19.0의 두 설정 probe, 출력 JSONL2행, 전용 title native 세션 read-only SQL 잔여0 |
| V-pair 자기확인 | SELF_PASS5 / SELF_BLOCKED1(시각); 위 pair 표 참조 |
| 강제 지점 전수 | DOM·기능16/16. 실제 창 시각 gate는 미완료 |
| AC 자기보고 | 7/8 — AC5 시각 인수만 ⚠️, 아래 표 |
| 합계 검산 | ✅7 · ⚠️1 · ❌0 = 총8 |
| 블로커 / 역질문 | 사용자 결정 미해결 없음. browser localhost 접근 차단으로 시각 인수 대기 |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 자기보고 / 이번 턴 관측 |
|---|---|
| AC1 | ✅ E의 실제 add 메뉴에서 각 첫 SVG의 viewBox/색→해당 폼, 선택·닫힘 통과 |
| AC2 | ✅ N의 Claude/OpenCode native @, 공백 id, 참조색 span, 자동 전송0·draft 보존 |
| AC3 | ✅ N 실제 스킬 선택과 T의 case/underscore/namespace/구두점/Unicode 원문 보존 |
| AC4 | ✅ A의 disconnected/configured/disabled/origin 필터, N native/Jira/Orca 구별·상태 push, T unknown·경로 접두사 |
| AC5 | ⚠️ 양 메뉴의 올바른 SVG·색 DOM은 통과; white/dark 실제 창 인수는 도구 차단으로 미수행 |
| AC6 | ✅ Claude 실제 SDK 호출→관측→프로젝트 local 저장 경로와 관련 tests, 사용자 nav 유지 결정 보존 |
| AC7 | ✅ 보고서 §3에 0238·0259·0267 D60/61과 이번 표면 차이 기록 |
| AC8 | ✅ 보고서 §4~8에 두 소스 버전·시퀀스·실제 계측·13초 미재현 범위와 다음 관측 구분 |

AC 행 검산: ✅7 · ⚠️1 · ❌0 = 총8. 분모 변경 없음.

## [구현자 기입] Review Signals — 사실만

- 이전 라운드와 같은 축인가: r1 최초 구현. 기존 @ 요구가 native MCP의 일반 문장 선택 경로에 적용되지 않았다.
- 막았어야 할 계약: 0238·0259의 token/chip 기준은 내장 provider 중심이었다. 이번에는 실제 + entry부터 native/Orca/내장 선택을 장식까지 측정했다.
- 반복 환경 한계: in-app browser의 localhost 접근 차단, 실제 다수 plugin/MCP의 13초 trace 부재. 추정과 관측을 결과 보고에서 나눴다.
- 현재 라운드·impl 턴: r1. 지침 자체는 변경하지 않았다.

## [검증자 기입] 파생 이슈

없음.
