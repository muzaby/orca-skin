# Plan — harness-module-isolation

## 메타

| 항목 | 값 |
|---|---|
| slug | `0264-harness-module-isolation` |
| 작성자 | Codex — 사용자의 직접 리팩토링 요청 |
| 일자 | 2026-10-15 |
| 상태 | READY |
| V mode / revision | Baseline V / V1 |
| 기준 V | 없음 — 0262·0263 제품 동작은 회귀 기준으로 유지 |
| 매핑 | PR #502 / 하네스 모듈 소유권·재사용·추적 파일 정리 |

# Part I — Product & UX Contract

## 1. 목표

Claude·OpenCode 구현과 공통 구현을 디렉터리와 의존 방향으로 구분한다. 새 하네스를 추가할 때 기존 하네스 구현을 복사하거나 공통 실행부의 두 갈래 분기를 늘리지 않도록 등록 계약을 둔다. 사용자가 보는 화면·설정·세션·승인 동작은 현재 제품과 같다.

## 2. 요구 출처

| 구분 | 요구 | 출처 |
|---|---|---|
| 명시 | renderer composer·transcript·우측 패널, main의 Claude/OpenCode/공통 구조 분리 | 2026-10-15 사용자 요청 |
| 명시 | 추후 Codex 등 하네스가 들어올 여지, 구조·경량화·재사용 리팩토링 | 같은 요청 |
| 명시 | 커밋에서 관리 중인 불필요·미사용 파일과 첨부 제거 | 같은 요청 |
| 유지 | Claude GUI 보존, OpenCode 전용 디자인·Code 모드·생성 세션 하네스 고정 | 누적 사용자 결정 / 0262 |
| 유지 | 질문·승인 FIFO 1장으로 composer 대체, Todo 펼침/접힘·완료 퇴장, 패널 위 상세 패널과 닫기 복귀 | 0262 ΔV11~13 / 0263 ΔV4 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 |
|---|---|---|---|---|
| D01 | feature/레이어 DAG 안에서 공통과 하네스 구현을 물리 분리한다 | 단일 전역 harness 폴더로 feature 경계를 우회하지 않음 | 사용자 / renderer·main AGENTS | ACTIVE |
| D02 | 정적 typed registry로 선택한다. Backend·IPC·DB 형상은 유지한다 | Codex 구현이나 런타임 플러그인 로더를 추가하는 요구가 아님 | 사용자 확장 의도 | ACTIVE |
| D03 | 공통은 구체 하네스와 registry에 의존하지 않는다. 조립부가 정책·슬롯·parser를 주입한다 | 형제 하네스 직접 import도 금지 | 사용자 구조 분리 | ACTIVE |
| D04 | OpenCode SDK·native API/설정 해석의 1.x 구현은 기존 v1 경계를 유지한다 | 내부 SDK 경로와 제품 버전을 혼동하지 않음 | 0262 기존 결정 | ACTIVE |
| D05 | 동작·화면·수명주기·저장 형상은 유지한다 | stable input, 초안·첨부·IME, 요청 순서·스크롤, 종료·cache generation 보존 | 누적 사용자 결정 | ACTIVE |
| D06 | tracked이며 참조·빌드·증거 용도가 없음을 확인한 파일만 제거한다 | 문서 증거·회귀 fixture·사용자 untracked 첨부·ignored 소스 아카이브는 유지 | 사용자 정리 조건 | ACTIVE |
| D07 | 추가 패키지·동적 등록 프레임워크 없이 기존 함수와 작은 타입 계약을 재사용한다 | 불필요한 계층·중복 구현·새 무효화 상태를 만들지 않음 | 사용자 경량화 요구 | ACTIVE |

ACTIVE ↔ AC 충돌 없음. D01~04는 AC1~6, D05는 AC7~10, D06은 AC11, D07은 AC1~6·11에 대응한다. 미정 제품 결정은 없다.

## 4. 요구 검토

| 판단 | 근거 |
|---|---|
| 실제 소유권 분리가 필요하다 | `chat/harnesses/presentation.ts`는 boolean 분기이고 Claude viewport는 공통 `TranscriptView.tsx` 내부에 있다 |
| 폴더 이름만 바꾸면 부족하다 | `adapters/registry.ts`가 ClaudeAdapter를 생성하고 공통 live-turn은 ClaudePermissionMode를 받는다 |
| 동작을 바꾸는 최적화는 제외한다 | 초안 입력·cache·승인·스크롤이 이미 회귀 테스트와 0262/0263 계약을 가진다 |
| 모든 오래된 자산이 쓰레기는 아니다 | `resources/logo-with-claude.png`는 0227에서 원본 보존, UI fixture는 실제 회귀 경로다 |

## 5. 동작 / 상태 전이

```text
새 대화/기존 세션 → 저장된 Backend → feature별 registry → 해당 하네스 화면
입력/승인/도구 이벤트 → 기존 공통 상태 → 하네스 표현 → 같은 요청/결과
앱 부팅 → 하네스 조립부 → 공통 registry/runtime → 각 adapter → 같은 정규 이벤트
```

| 상황 | 유지되는 결과 |
|---|---|
| 새 대화의 하네스 전환 | 마지막 사용 기본값, input 인스턴스·초안·첨부 유지 |
| 기존 세션 | 하네스 불변, 해당 transcript·패널·모델/설정 표시 |
| 질문·도구 승인 대기 | 도착 순서의 한 카드만 composer를 대체, 소비 후 다음 카드 |
| Todo/스크롤/패널 상세 | 기존 접힘·완료 퇴장·읽기 위치·텍스트 선택·닫기 복귀 유지 |
| 설정 실패/취소·늦은 응답·종료 | 기존 오류 표시, generation fence, rollback/close 유지 |

loading/empty/error, 키보드·테마·폰트 배율, Work 모드는 기존 구현 그대로다. 외부 네트워크·실모델 호출·새 저장소는 추가하지 않는다.

## 6. 범위 / 비범위

- 범위: chat/engine/settings/landing의 하네스 소유권, main adapter·harness service·native extension 배포, 공통 권한 계약, 자동 의존 경계, 확인된 dead code 제거, 현재 구조 문서.
- 비범위: Codex 기능 구현, OpenCode 2.x 지원, SDK 업그레이드, UI 재설계, DB/IPC 마이그레이션, git history 재작성, 사용자 첨부 삭제.

## 7. Requirements / Acceptance

| R / AT / AC | 동작 기준 | 검증 수단 | production 경로 |
|---|---|---|---|
| R01 / AT01 / AC1 | chat의 Claude/OpenCode 실제 composer·transcript·rightpanel 구현과 공통 부품이 분리되고 Backend 등록으로 선택된다 | registry 선택·실제 렌더 테스트, 경계 lint | ChatTile → 조립 진입점 → registry → concrete/common |
| R02 / AT02 / AC2 | engine/settings/landing에서 하네스 전용 표현·설정과 공통 상태가 분리된다 | 기존 form/import/save/landing 동작 테스트 | 페이지 → feature registry → form/fields/landing slots |
| R03 / AT03 / AC3 | main의 공통 adapter가 concrete를 만들지 않으며 앱 조립부가 등록한다 | registry 등록/close·bootstrap 회귀 | bootstrap → app/harnesses → adapters/common → concrete |
| R04 / AT04 / AC4 | 공통 설정·모델 카탈로그가 하네스 parser/policy를 주입받는다 | 설정 목록·runtime reconcile 양쪽 parser 실행, cache/stale 회귀 | app composition → common settings/catalog → harness policy |
| R05 / AT05 / AC5 | native extension 배포와 권한 변환이 Claude 구현 경계에 있다 | deploy/scaffold·권한 live 호출 테스트 | app → Claude deployment; approvals → normalized port → Claude SDK 변환 |
| R06 / AT06 / AC6 | 형제 하네스·common→concrete·OpenCode 버전 경계 위반이 자동 검출되고 새 하네스 이름에도 적용된다 | 실제 ESLint positive/negative fixture, exhaustiveness typecheck | source imports → lint rules; registry → component/policy |
| R07 / AT07 / AC7 | Claude와 OpenCode 입력 수명·폼/페이지 UI가 동일하다 | composer lifetime·landing·engine/settings 렌더/interaction | 페이지/ChatTile → Composer → stable input |
| R08 / AT08 / AC8 | FIFO request/Todo/도구·transcript·스크롤·선택 동작이 유지된다 | 기존 reducer/interaction/Timeline 테스트 및 fixture 실기 | normalized event → store → dock/timeline |
| R09 / AT09 / AC9 | 양쪽 우측 패널·타일 헤더·상세 닫기 복귀가 유지된다 | panel/tiles/navigation 렌더·interaction | RightPanel → host → harness tiles/detail |
| R10 / AT10 / AC10 | 설정·runtime·종료·모델 선택·기존 세션 동작이 유지된다 | main regression suite와 부팅/종료·turn tests | boot/settings/turn/shutdown → common service → adapter |
| R11 / AT11 / AC11 | 확인된 tracked 미사용 파일을 제거하고 활성 자산·fixture를 유지한다 | 삭제 후보 참조 감사, typecheck/build, 기존 동작 테스트 | tracked files → import/build/document references |

## 7-A. Baseline V

| Node | 레벨 | 계약 | provenance |
|---|---|---|---|
| R01~06, R11 / AT01~06, AT11 | R / AT | §7 소유권·확장·정리 | NEW |
| R07~10 / AT07~10 | R / AT | §7 현재 사용자 동작 | INHERITED — 0262/0263 현재 구현 |
| SD01 / ST01 | SD / ST | stable input·요청·패널·boot/close 경로 보존 | INHERITED |
| AR01 / IT01 | AR / IT | feature별 조립 → concrete → common 의존 | NEW |
| AR02 / IT02 | AR / IT | main registry/parser/normalized permission 배선 | NEW |
| MD01 / UT01 | MD / UT | generic import owner/version 검사 | NEW |
| MD02 / UT02 | MD / UT | 중립 registry 선택·등록 계약 | NEW |

| Pair | left ↔ right | 요구 | production path / 직접 oracle | 선택 적대 증거 | §10 자리 |
|---|---|---|---|---|---|
| VP01 | R01~02 ↔ AT01~02 | REQUIRED | ChatTile/page → registry → 실제 화면. 신규 `harnesses/registry.test.tsx`, 기존 `ChatTile.composerLifetime`, `NewChatLandingPage.harness`, engine/settings 테스트 | registry의 Claude/OpenCode slot 맞바꿈을 렌더 oracle로 검출 | EP01 6 |
| VP02 | R03~05 ↔ AT03~05 | REQUIRED | bootstrap/engine handler → 등록·parser·permission. `registry.test`, 신규 `app/harnesses/registry.test`, `settings.test`, `runtime-catalog.test`, approvals/Claude adapter tests | not selected — 주입 값·호출 결과 직접 관측 | EP02 6 |
| VP03 | R06 ↔ AT06 | REQUIRED | import 소스 → 실제 ESLint 결과. `scripts/harness-boundary.test.mjs` | 형제·common 역방향·가상 codex·alias/dynamic/re-export·v1 우회 fixture | EP03 4 |
| VP04 | R07 ↔ AT07 | REGRESSION | 페이지/ChatTile → stable input·설정 입력. `ChatTile.composerLifetime`, `EngineFormModal.harness/import`, `HarnessSettingsTab.save`, landing tests | not selected — 기존 interaction 결과 | EP04 2 |
| VP05 | R08 ↔ AT08 | REGRESSION | event/store → FIFO/Todo/Timeline. `RequestDock`, `TodoDock.integration`, `Timeline.selection`, `ScrollController.interaction` 및 fixture | not selected — 실제 렌더/스크롤 행동 | EP04 3 |
| VP06 | R09 ↔ AT09 | REGRESSION | RightPanel → tile/detail → close. `rightPanelTiles.render`, `opencode/rightpanel/Panel.render`, `navigation.test` | not selected — 실제 출력/전환 | EP04 2 |
| VP07 | R10 ↔ AT10 | REGRESSION | boot/send/shutdown → 서비스 → adapter. `bootstrap.shutdown`, `engine.import/runtime-catalog`, `resolve-turn`, adapter tests | not selected — 기존 호출·결과 | EP05 3 |
| VP08 | R11 ↔ AT11 | REQUIRED | 추적 파일 → import/빌드. 삭제 후보 직접 검색 + `diffTile.render`, `plan0215.render`, build | not selected — 삭제는 아래 확정 2파일이며 신규 범용 unused 검출기는 만들지 않음 | EP06 2 |
| VP09 | SD01 ↔ ST01 | REGRESSION | VP04~07의 실제 시스템 경로 및 UI fixture | not selected — 같은 직접 oracle 재사용 | EP04~05 10 |
| VP10 | AR01 ↔ IT01 | REQUIRED | feature entry → per-harness module → common. registry 실제 component/policy 연결 테스트·boundary fixtures | VP01 slot 맞바꿈, VP03 경계 fixture 재사용 | EP01+03 10 |
| VP11 | AR02 ↔ IT02 | REQUIRED | app composition → common ports → concrete. VP02 직접 호출 테스트 | not selected — 실제 주입·변환 결과 | EP02 6 |
| VP12 | MD01 ↔ UT01 | REQUIRED | AST import node → owner/version判定 → lint diagnostic. boundary tests | VP03 각 위반 fixture 재사용 | EP03 4 |
| VP13 | MD02 ↔ UT02 | REQUIRED | Backend → module lookup / adapter registration. 신규 registry tests, `AdapterRegistry` explicit injection tests | VP01 slot 맞바꿈 재사용 | EP01~02 선택 자리 7 |

운영 gate: 수정 source/scripts readonly ESLint, 전체 typecheck, 관련 Vitest·script tests, build, doc inventory/link/diff/trailer, 원격 Windows CI. 기존 사용자 ignored archive의 문서 링크 오류는 제품 실패와 구분한다.

# Part II — Technical Design

## 8. 조사

| 현재 사실 | 근거 |
|---|---|
| boolean 기반 appearance 선택과 공통 내부 Claude viewport | `chat/harnesses/presentation.ts`, `components/transcript/TranscriptView.tsx`, `HarnessScrollController.tsx` |
| 공통 composer가 양쪽 dock와 구체 controls를 조립 | `components/Composer.tsx`, `components/composer/ComposerInputController.tsx` |
| tile registry가 양쪽 map을 직접 보유, Claude Panel은 re-export | `components/rightpanel/tileRegistry.ts`, `harnesses/claude/rightpanel/Panel.tsx` |
| 공통 registry가 ClaudeAdapter 직접 생성 | `main/adapters/registry.ts` constructor |
| 공통 모델 parser·제목/기본 provider 정책이 Claude에 결합 | `features/harnesses/{settings,runtime-catalog,models}.ts` |
| Claude native 배포가 중립 extensions 경로에 있음 | `features/extensions/{deployer,scaffold}.ts` |
| 사용하지 않는 tracked 코드 | `PlanTile.tsx` 자기 export 외 참조 없음; `htmlRegion.testlib.ts` 소비 테스트가 이전 개편에서 삭제됨 |

`git ls-files`와 import/리터럴 참조를 함께 조사했다. 사용자 `.codex-remote-attachments/`는 untracked이고 `.tmp/opencode-dev`는 ignored이다. 문서·프로토타입·브랜드 원본은 실행 import가 없다는 이유로 삭제하지 않는다.

## 9. AS-IS → TO-BE

| 축 | AS-IS | TO-BE |
|---|---|---|
| chat 소유권 | public components에 Claude 구현·OpenCode 분기 | public 진입점은 조립, `harnesses/{claude,opencode,common}`에 실제 구현 |
| 정책과 컴포넌트 | bool ternary와 concrete inferred type | 중립 contracts, pure catalog와 React registry 분리 |
| engine/settings | 공통 상태와 전용 문구/필드 혼합 | feature-local common과 per-harness config/fields; feature 간 import 없음 |
| main | adapter root에 공통, native 정책 일부 암묵 default | adapters/common, feature-local common/claude/opencode, app/harnesses 명시 조립 |
| 권한 | 공통 port에 ClaudePermissionMode | 공통 NormalizedPermissionMode, SDK 변환은 Claude 내부 |
| lifecycle | existing controller/store/cache/cleanup | 동일 인스턴스·상태·순서, 소유자 경로만 이동 |
| 의존 강제 | Claude/OpenCode 이름 열거한 일부 zone | owner 이름 일반화 + common 역방향 금지 + v1 유지 |

```text
app/pages 또는 main app composition
  → feature harness registry (exhaustive Backend map)
    → harnesses/claude | harnesses/opencode[/v1]
      → harnesses/common + 중립 contracts + 기존 domain state
```

main은 `adapters/common` 및 `features/harnesses/common`을 사용한다. 하네스 이름을 포함한 feature 자체(`features/harnesses`)와 구체 구현 소유자를 구별한다. main의 infra·contracts와 renderer의 기존 store/reducer는 본래 DAG 안에 유지한다.

## 10. 계약 / 강제 지점

| EP | 계약 / SSOT | 언제 강제 — 자리 목록 | 실패 의미 |
|---|---|---|---|
| EP01 | feature registry·중립 props | composer, transcript, rightpanel, engine config, settings fields, landing (6) | 두 하네스 선택이 잘못된 화면/정책으로 감 |
| EP02 | main composition·중립 port | adapter 등록, settings parser, runtime parser, engine user-settings reader, native extension 배포, live permission 변환 (6) | 공통이 Claude를 암묵 선택하거나 native 형상 누수 |
| EP03 | ESLint owner/version SSOT | concrete sibling, common→concrete/registry, SDK outside v1, version deep/cross import (4) | 새 이름/동적 import로 분리 경계 우회 |
| EP04 | 기존 UI 상태 | input instance, engine/settings save, request FIFO, Todo, transcript scroll/selection, Claude tiles, OpenCode overlay close (7) | remount·초안손실·중복카드·스크롤점프·헤더변형 |
| EP05 | 기존 main runtime | bootstrap/shutdown, catalog/cache generation, send/permission/session (3) | 종료 누수·늦은 cache 복구·세션동작 변경 |
| EP06 | 삭제 후보 | PlanTile.tsx, htmlRegion.testlib.ts (2) | 활성 consumer/회귀 fixture 삭제 |

전체 강제 자리 28. pair별 중복 참조는 전체 분모에 중복 합산하지 않는다. 실제 세부 import 자리·component 전달은 구현 보고에서 직접 oracle의 실행 구간으로 대조한다.

## 11. 구현 설계

| 대상 | 변경 |
|---|---|
| chat `harnesses/contracts`, `catalog`, `registries/*` | 타입·순수 정책과 표면별 React 선택 분리. Backend map의 누락은 타입 오류; transcript import closure에 composer 전체를 끌어오지 않음 |
| chat `harnesses/common/{composer,transcript,rightpanel}` | 입력 surface/controller, 공통 메시지·diff·승인 본문, tile host·공통 내용 이동; 구체 선택은 props로 주입 |
| chat `harnesses/claude/**` | Claude Timeline/ScrollController/Work·질문·도구승인·subagent/task 표현 실제 소유 |
| chat `harnesses/opencode/**` | 기존 전용 렌더를 유지하고 composer slots·tile registration 소유 |
| engine `common/{components,hooks,lib}`, settings `common` | 공통 입력·CRUD·저장 경쟁 제어 이동, 일반 설정 기능은 기존 위치 유지 |
| backend `harnesses/claude` | 기존 Claude installer·로그인 만료·상태 표현의 실제 소유권 이동. 새 OpenCode 설치/인증 UI나 노출 정책을 만들지 않음 |
| main `adapters/common/**` | 공통 포트·registry·turn/helpers 이동, concrete 생성 제거 |
| main `features/harnesses/{common,claude,opencode}` | ParsedModel 중립 타입, parser/title/default-provider 정책 명시 주입 |
| main `features/extensions/{common,claude}` | 공통 sources·builder·직렬화와 Claude plugin/scaffold 배포 분리 |
| main `app/harnesses/**` | adapter·loader/parser·user-settings·native 배포 조립. 기존 Claude 우선 기본 정책을 이곳에서 명시 |
| scripts boundary·tests | 모든 import 형태와 새 하네스 이름 fixture; 기존 DAG/버전 guard 약화 금지 |
| 확정 삭제 2파일 | 대체 경로 참조 확인 후 제거. 다른 후보 발견 시 같은 기준으로 근거 기록 |

공통 `AssistantMessage`/subagent detail은 양쪽 소비자가 있으므로 Claude로 통째 이동하지 않는다. 공통이 registry를 참조해야 한다면 조립 진입점을 공통 밖에 남기거나 props로 역할을 주입한다. 입력 controller의 부모 타입·key를 하네스별로 교체하지 않는다.

기존 사용자 정의 harness/native blob의 호환 동작은 app의 명시 호환 정책으로 보존한다. 공통 서비스 자체는 Claude parser를 기본값으로 import하지 않는다. 등록하지 않은 runtime 모델의 의미를 새로 정의하지 않는다.

## 12. End-to-end / 13. Lifecycle

이벤트 producer·NormalizedEvent·DB·IPC 소비자는 동일하다. module path 변경으로 생기는 import/test fixture·error-site registry·문서 경로를 함께 갱신한다. adapter close, 실패 정리, cache generation, 입력 draft·queued refs는 기존 소유 수명을 유지한다.

새 다중 저장소 쓰기는 없다. plan과 INDEX의 상태 사본은 함께 갱신하고 읽어 확인한다. 컴포넌트 등록 객체는 module scope 상수로 두어 render마다 component identity를 바꾸지 않는다.

## 14. 성능 / 15. 포트

새 네트워크 요청·cache·타이머·패키지를 추가하지 않는다. pure policy 소비자가 React registry 전체를 끌어오지 않도록 import graph를 분리한다. 중복 pass-through wrapper는 실제 소비자가 필요할 때만 남기며 lazy subagent detail은 공통 detail 파일로 분리해 중복 static/dynamic import를 줄인다.

공개 포트 변경 없음. 내부 LiveTurn의 permission 입력은 이미 TurnRequest에서 쓰는 normalized 타입으로 맞추며 Claude SDK 전달값을 회귀 검증한다.

## 16. 기존 규칙 / 17. 리스크

| 규칙·리스크 | 처리 |
|---|---|
| renderer feature 교차 import / main DAG | feature-local common, app만 concrete 조립 |
| OpenCode v1 격리 | facade 진입만 유지, SDK/CLI 버전 변경 없음 |
| Claude UI·입력 인스턴스 | DOM/표현 값 동일, existing interaction 테스트·fixture |
| 이동으로 source 기반 테스트 누락 | 단언을 삭제하지 않고 새 실제 소유 경로로 갱신 |
| 과도한 추상화 | 기존 Record/props/함수 사용, 새 framework·Codex stub 없음 |

되돌리기 어려운 결정과 신규 의존성 없음.

## 18. 문서 영향 / 19. 게이트

현재 구조는 `docs/arch/frontend/{layers,rendering}.md`, `docs/arch/backend/adapters.md`에 반영한다. 코드 이동을 참조하는 생성 inventory는 정본 스크립트로 재생성한다.

- `app/AGENTS.md` ABI 규칙에 따라 `npm test`/install/rebuild 없이 `npm run typecheck`, `node node_modules/eslint/bin/eslint.js src scripts`, 직접 Vitest와 `node --test scripts/*.test.mjs` 실행.
- 관련 묶음: chat/composer/transcript/rightpanel·engine·settings·landing, main adapters/harnesses/extensions/approvals/runtime·app bootstrap/handlers/turn, shared 오류등록·문자배율·boundary tests.
- `node node_modules/electron-vite/bin/electron-vite.js build`, docs inventory/link/diff, trailer 파싱, 원격 Windows CI.
- 기존 `scripts/fixtures/opencode-ui`에서 두 하네스·mixed request·Todo·transcript·패널을 Computer Use로 확인한다. 실모델 도구 호출은 이전 사용자 결정대로 생략한다.

## READY self-review

READY — 사용자 요구와 기존 제품 결정을 AC에 대조했고 충돌 없음. 중립 계약·조립·구체 구현 소유권과 기존 상태 수명, 삭제 근거를 분리했다. 각 V 수준의 직접 행동·경계 oracle과 기존 회귀·운영 gate를 명시했다.

## [구현자 기입] 설계 리뷰

구현 착수 후 기입.

## [구현자 기입] 강제 지점 전수 / V-pair 자기확인

구현 착수 후 기입.

## [구현자 기입] 이번 라운드 수정의 잠금

구현 착수 후 기입.

## [구현자 기입] Product/UX 파생 검토

구현 착수 후 기입.

## [구현자 기입] 놓친 잠재 문제 + 대응

구현 착수 후 기입.

## [구현자 기입] 구현 보고

구현 착수 후 기입.

## [구현자 기입] Review Signals

r1 — 새 사용자 리팩토링 요구. 독립 검증은 구현 완료 후 별도 수행한다.
