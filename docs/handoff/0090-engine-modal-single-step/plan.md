# Plan — engine-modal-single-step

> 흐름: **의도 → 조사 → 설계 → 리스크**. 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0090-engine-modal-single-step` |
| 작성자 | Claude Code |
| 일자 | 2026-07-10 |
| 매핑 | PR (브랜치 `claude/engine-model-modal-redesign-mgxs0f`) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | ① 엔진 추가 모달의 1 depth(adapter 선택) 제거 — 클로드코드만 지원 ② 2 depth(공급자 선택) 제거 ③ 3 depth 유지 + 수정: `← 이전`/`닫기` 버튼 제거, 1·2·3 진행 표시 제거, adapter 는 claude 표기 고정(현행 유지), 공급자는 드롭다운으로 2 depth 선택지를 아이템화 + 설명 간결화, settings.json 자동완성 버튼(구글 메테리얼) 제공 + `~/.claude/settings.json` 을 가져오는 기능 배선까지 ④ (플랜 리뷰 중 추가) 설치 후 첫 시작 시(업데이트 ×) 기본 엔진&모델 구성 때 `~/.claude` 를 가져와 구성 — env 필드로 anthropic/bedrock/vertex/custom 판별 | 라이브 세션 요청 (2026-07-10) |
| 명시 확정 | 구현 주체 = Claude 직접(핸드오프 절차 준수) · 드롭다운 기본값 = anthropic 기본 선택 | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | 닫기 버튼 제거 후에도 모달 이탈 수단은 필요 → 하단 `취소` + 백드롭 클릭 유지, Esc 닫기 추가 (추론) | 기존 모달 UX 관행 (`shared/ui/Modal.tsx` 의 Esc/backdrop 패턴) |
| 추론 의도 | "첫 시작(업데이트 ×)" = provider 정규 소스가 빈 최초 부팅 1회 — 기존 스캐폴드 트리거 조건과 동일 (추론) | `features/extensions/scaffold.ts:1-4` "빈 상태 1회용" 규약 |

## Context (왜)

어댑터는 Claude Code 하나뿐이라 3단계 마법사(엔진 → 공급자 → 설정)의 1단계는 무의미하고, 2단계도 카드 클릭 한 번에 화면 하나를 소모한다. 단일 화면으로 압축해 추가 흐름을 줄이고, 이미 Claude Code 를 쓰는 사용자의 `~/.claude/settings.json` 을 (a) 모달에서 버튼 한 번으로 불러오고 (b) 설치 후 첫 부팅 시딩에 자동 반영해 초기 설정 비용을 없앤다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 모달은 3단계 로컬 state 마법사. `Stepper`/`EngineStep`/`ProviderStep`/`SettingsStep` 내부 컴포넌트, edit 모드는 이미 step 3 직행 + Stepper 숨김 | `app/src/renderer/src/features/engine/components/EngineFormModal.tsx:39,111,159-279` |
| 공급자 선택지 4종(anthropic/bedrock/vertex/custom) + settings.json 템플릿·검증은 순수 모듈에 집약. 템플릿은 TRD §6.8 레시피 표와 정합 | `app/src/renderer/src/features/engine/lib/providerCatalog.ts:37-68` |
| add/edit 콜백은 `AgentEnvironmentView` 가 `useEngines.add/update` 로 배선 — 모달 재설계와 무관하게 유지 가능 | `app/src/renderer/src/features/engine/components/AgentEnvironmentView.tsx:86-109` |
| provider settings.json 은 `~/.claude/settings.json` 과 **동일 스키마/취급** (handoff 0028) — 사용자 파일 verbatim 주입이 규약상 안전 | `app/src/main/adapters/claude-settings.ts:1-8` |
| 드롭다운 전용 프리미티브는 없음 — `shared/ui/Popover`(측정 기반 배치·외부클릭/Esc 닫기) + MenuRow 패턴이 관례 | `app/src/renderer/src/shared/ui/Popover.tsx:31`, `features/skills/components/customize/SkillAddMenu.tsx:5-28` |
| 아이콘은 Google Material Symbols(Outlined, 400) path 데이터 하드코딩 방식 | `app/src/renderer/src/shared/ui/Icon.tsx:57-60` |
| 무입력 invoke 채널 헬퍼 `handlePlain` 존재 (스키마 불요) | `app/src/main/infra/ipc/handle.ts:41-46` |
| 최초 부팅 시딩은 `scaffoldProviderSettings` — provider 디렉토리가 하나도 없을 때만 `anthropic + { env: {} }` 생성. 부팅 배선은 bootstrap `provider-scaffold` 스텝 | `app/src/main/features/extensions/scaffold.ts:35-53`, `app/src/main/app/bootstrap.ts:221-225` |
| `~/.claude` 경로 사용 전례: workspace-guard 가 read/write 허용 목록에 포함 | `app/src/main/adapters/workspace-guard.ts:25-29` |
| 구체 engine 리터럴/claude 경로는 adapters·features/extensions·컴포지션 루트에만 허용 | `app/src/main/AGENTS.md` 작업 규칙 |
| bedrock/vertex 판별 env 키 = `CLAUDE_CODE_USE_BEDROCK`/`CLAUDE_CODE_USE_VERTEX`, 게이트웨이 = `ANTHROPIC_BASE_URL` | `providerCatalog.ts:50,57,65` (TRD §6.8 레시피 표) |
| IPC 채널 변경 시 `docs/IPC_CONTRACT.md` 동시 갱신 의무 (현재 63채널) | `docs/IPC_CONTRACT.md` §6 |

## 인수 기준 (Acceptance Criteria)

1. 엔진 추가 모달이 **단일 화면**이다 — Stepper(1·2·3 진행 표시)·`← 이전`·상단 `닫기` 버튼·엔진 선택 화면·공급자 카드 화면이 존재하지 않는다.
2. adapter 는 `claude` 칩으로 고정 표기된다 (현행 3단계 표기 유지).
3. 공급자는 **드롭다운**으로 선택한다 — 아이템은 기존 4종(anthropic/bedrock/vertex/custom) + 간결화된 설명, 기본 선택 `anthropic`(anthropic 템플릿이 초기 채워짐). 선택 변경 시 settings.json 이 해당 템플릿으로 교체되고 Provider 이름 기본값이 갱신된다(custom = 빈 값 + 이름 입력 활성).
4. settings.json 라벨 행에 **Material `file_open` 아이콘 버튼**이 있고, 클릭 시 IPC 로 `~/.claude/settings.json` 원문을 읽어 textarea 를 채운다. 파일 부재/읽기 실패 시 인라인 안내를 표시한다.
5. 신규 IPC 채널 `orca:engine:importUserSettings` 가 main(adapters FS 로직) → preload → renderer `engineApi` 로 배선되고 `docs/IPC_CONTRACT.md` 에 등재된다 (63→64).
6. 최초 부팅 스캐폴드: `~/.claude/settings.json` 이 존재·파싱 가능하면 env 로 판별한 provider 이름(anthropic/bedrock/vertex/custom) 디렉토리에 **사용자 settings 전문을 verbatim 시딩**하고, 부재/파싱 실패 시 기존 `anthropic + { env: {} }` 폴백. 트리거 조건(빈 상태 1회)은 불변 — 업데이트(기존 provider 존재) 시 미개입.
7. edit 모드 동작(제목 "엔진 설정 편집"·settingsJson 만 저장) 과 add/update/delete IPC 계약은 회귀 없음.
8. Esc 키와 백드롭 클릭으로 모달이 닫힌다.
9. 게이트: `cd app && npm run lint && npm run typecheck && npm test` 전부 통과 + 신규 테스트(판별 함수·스캐폴드 시딩·catalog 갱신).

## 범위 / 비범위

- **범위**: `EngineFormModal` 재설계, `providerCatalog` 정리, `Icon` glyph 추가, `engineImportUserSettings` IPC 배선, `scaffold` 시딩 로직, 관련 테스트·문서(IPC_CONTRACT).
- **비범위**: `useEngines`/`AgentEnvironmentView` 콜백 시그니처, main `engine-write.ts` add/update/delete/read 로직, EngineCard/모델 리스트, opencode 어댑터, i18n 프레임워크 도입.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈 재사용: `shared/ui/Popover`(드롭다운), `shared/ui/Icon`(Material path 방식), `infra/ipc/handle.handlePlain`, `infra/config/json-file.writeJsonAtomic`, `adapters/claude-settings`(사용자 settings 스키마 정본).
- 전제: `~/.claude/settings.json` 은 사용자 홈 기준 고정 경로(`homedir()`), Orca 는 내용 검증을 렌더러 실시간 JSON 검증에 위임(파싱만 확인).
- **신규 의존성**: 없음.

## 설계

- **렌더러**: `EngineFormModal` 을 단일 화면 폼으로 재작성 — 기존 `SettingsStep` 승격 + 공급자 드롭다운(트리거 버튼 + `Popover placement="bottom"`, 선택 항목 `check` 아이콘) + settings.json 불러오기 버튼(`fileOpen` 아이콘, `engineApi.importUserSettings()`). Esc 닫기 추가. add 초기값 = anthropic + anthropic 템플릿.
- **IPC**: `CHANNELS.engineImportUserSettings` + `EngineUserSettingsResult { exists, settingsJson }`. main FS 로직은 `adapters/claude-settings.ts` 의 `readUserClaudeSettings(path?)`(경로 주입 = 테스트), 핸들러는 `app/handlers/engine.ts` 에 `handlePlain` 등록. preload `orca.engine.importUserSettings` + renderer `engineApi.importUserSettings`.
- **판별**: `classifyClaudeEnv(settings)` (adapters/claude-settings.ts, 순수) — `env.CLAUDE_CODE_USE_BEDROCK` truthy → `bedrock`, `env.CLAUDE_CODE_USE_VERTEX` truthy → `vertex`, `env.ANTHROPIC_BASE_URL` 존재 → `custom`, 그 외 → `anthropic`.
- **시딩**: `scaffoldProviderSettings(adapter, root, userSettingsJson?)` — 사용자 원문을 파라미터로 받아(기본값은 bootstrap 호출부에서 `readUserClaudeSettings()` 전달) 존재·파싱 성공 시 판별 provider 로 verbatim 시딩, 실패 시 기존 폴백. features → adapters 의존은 DAG 허용 방향.
- 레이어 경계: claude 경로·리터럴은 adapters(`claude-settings.ts`)·features/extensions(`scaffold.ts`)·컴포지션 루트(`app/handlers/engine.ts`, `bootstrap.ts`)에만.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 불러오기 실패(파일 부재·읽기 오류): 인라인 빨간 안내 "~/.claude/settings.json 을 찾을 수 없어요." — 모달은 유지.
- 불러온 내용이 유효 JSON 이 아니면 기존 실시간 검증(빨간 테두리 + 줄·열 안내)이 그대로 동작 — 별도 처리 불요.
- 드롭다운 변경은 textarea 를 템플릿으로 **덮어쓴다**(기존 2단계 재진입과 동일 의미) — 불러온/편집한 내용 위에서 공급자를 바꾸면 초기화됨을 수용.
- 시딩 시 custom 판별이어도 provider 이름은 `custom` 고정(이름 유추 없음 — 사용자가 이후 모달에서 관리).
- Esc/백드롭 닫기 시 입력값은 폐기(현행과 동일 — 모달 재오픈 시 초기 상태).
- 키보드: 드롭다운 트리거는 button 요소(Enter/Space 오픈), Popover 자체 Esc/외부클릭 닫기 재사용.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 사용자 settings 전문 verbatim 시딩 — env 외 필드(permissions 등)도 복사됨 | provider settings.json 은 `~/.claude/settings.json` 동일 스키마/취급 규약(0028)이라 안전. escalating defaultMode 는 로더가 런타임에 strip (`claude-settings.ts:34`) |
| `~/.claude/settings.json` 에 평문 API 키가 있으면 Orca 설정 트리로 복사됨 | 기존 규약 자체가 "env 에 auth key 직접 관리"(scaffold 헤더) — 동일 취급. 모달 안내 문구(`${VAR}` 권장) 유지 |
| ENGINE_OPTIONS 제거로 opencode 준비 중 표기 소실 | 1 depth 제거의 직접 귀결(사용자 명시 요구). 카드 목록(EngineCard)은 무관 — 수용 |

- 되돌리기 어려운 결정: 없음 (UI/시딩 로직 모두 가역).
- **단독 결정 금지 항목(Open Question)**: 없음 — PRD §11/TRD §15 미접촉.

## 영향 받는 파일

- `app/src/renderer/src/features/engine/components/EngineFormModal.tsx` (재작성)
- `app/src/renderer/src/features/engine/lib/providerCatalog.ts` / `providerCatalog.test.ts`
- `app/src/renderer/src/shared/ui/Icon.tsx`
- `app/src/shared/ipc.ts` · `app/src/shared/protocol.ts`
- `app/src/main/adapters/claude-settings.ts` (+ 신규 테스트)
- `app/src/main/app/handlers/engine.ts`
- `app/src/main/features/extensions/scaffold.ts` / `scaffold.test.ts`
- `app/src/main/app/bootstrap.ts` (스캐폴드 호출부)
- `app/src/preload/index.ts` · `app/src/preload/index.d.ts`
- `app/src/renderer/src/shared/api/ipc.ts`
- `docs/IPC_CONTRACT.md`

## 참고 문서

- `docs/TRD.md §6.8` (provider env 레시피 표)
- `docs/IPC_CONTRACT.md` §6 변경 절차 — **동시 갱신**
- `docs/arch/backend/security.md` (비밀 미저장 원칙)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: `classifyClaudeEnv` 4분기 + env 비객체/부재 · `readUserClaudeSettings` 존재/부재 · `scaffoldProviderSettings` 판별 시딩/verbatim/폴백/기존 미개입 · `providerCatalog` 갱신분.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청으로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`)를 붙였다.
- [x] 인수 기준 — 번호가 매겨졌고, 자료조사에 근거하며, 검증 가능하다.
- [x] 의존 기술 — 의존·전제를 식별했고, 신규 의존성은 없음을 확인했다.
- [x] 파생 UX — 로딩/에러/덮어쓰기/키보드 엣지케이스를 펼쳤다.
- [x] 리스크 — 트레이드오프를 적었고, Open Question 해당 없음을 확인했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (본 건 = Claude 직접 구현).

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 설계 전반. 단일 화면 전환·IPC 배선 지점·시딩 삽입 지점(스캐폴드 빈 상태 1회 조건) 모두 코드 실측과 일치했다.
- 이견 / 우려: 설계 §설계의 "판별 함수는 adapters" 는 유지하되, `classifyClaudeEnv` 의 truthy 판정에서 `'0'`/`''`/`null` 을 비활성 값으로 취급하도록 구체화했다 (`CLAUDE_CODE_USE_BEDROCK: '0'` 이 bedrock 으로 오판되는 것을 방지). 테스트로 고정.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | Esc 닫기와 드롭다운 Popover 의 자체 Esc 핸들러가 겹치면 Esc 한 번에 메뉴+모달이 동시에 닫힘 | ✅ 구현함 — 모달 Esc 핸들러가 `menuOpen` 이면 건너뛰어 메뉴만 닫힘(다음 Esc 가 모달) | UX 명백 누락, 선조치 경계 내 |
| 2 | settings.json 라벨을 `<label>` 로 감싼 채 내부에 불러오기 버튼을 두면 중첩 인터랙티브 요소가 됨 | ✅ 구현함 — 해당 블록을 `<div>` 로 전환, textarea 에 `aria-label` 부여 | a11y/HTML 유효성 |
| 3 | `SETTINGS_TEMPLATE` 를 `writeJsonAtomic` 에 그대로 넘기던 기존 구조에서 사용자 원문 시딩 시 재직렬화됨 — 원문 포매팅(주석 불가 JSON이므로 키/값은 보존)은 pretty-print 로 정규화됨 | ✅ 수용 — `writeJsonAtomic` 경유가 스캐폴드 규약(원자적 쓰기). 키/값 verbatim 은 테스트로 보장 | `infra/config/json-file.ts` 재사용 |

## [구현자 기입] 구현 체크리스트

- [x] IPC 배선 (shared → adapters → handlers → preload → renderer api)
- [x] EngineFormModal 단일 화면 재작성 + 드롭다운 + 불러오기 버튼
- [x] providerCatalog 정리 + Icon fileOpen
- [x] scaffold 시딩 + bootstrap 배선
- [x] 테스트 + IPC_CONTRACT 갱신

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/shared/{ipc,protocol}.ts` · `app/src/main/adapters/claude-settings.{ts,test.ts}` · `app/src/main/app/handlers/engine.ts` · `app/src/main/app/bootstrap.ts` · `app/src/main/features/extensions/scaffold.{ts,test.ts}` · `app/src/preload/index.ts` · `app/src/renderer/src/shared/api/ipc.ts` · `app/src/renderer/src/shared/ui/Icon.tsx` · `app/src/renderer/src/features/engine/components/EngineFormModal.tsx` · `app/src/renderer/src/features/engine/lib/providerCatalog.ts` · `docs/IPC_CONTRACT.md` · `docs/AGENTS.md`(채널 수 정합화) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm test` |
| 게이트 결과 | lint ✅ 0 / typecheck 3종 ✅ 0 / vitest **786 passed** (3 suite fail = electron 바이너리 403 환경 제한 · 0084~0089 계열 동일 · 코드 무관) + node --test 24/24 ✅ |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | (구현 커밋 — 본 문서와 같은 커밋) |
