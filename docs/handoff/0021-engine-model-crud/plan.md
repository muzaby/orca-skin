# Plan — 0021-engine-model-crud

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md). 본 문서는 엔진&모델 페이지(`AgentEnvironmentView`)
> CRUD 기능의 설계(plan). 구현 주체 = **Codex**.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0021-engine-model-crud` |
| 작성자 | Claude Code |
| 일자 | 2026-06-15 |
| 매핑 | PHASES — 엔진&모델 페이지 CRUD / PR (없음) |
| 상태 | DRAFT → READY |

## Context (왜)

엔진&모델 페이지(`features/engine/components/AgentEnvironmentView.tsx`)의 "엔진 추가"·설정(편집)·
"+ 모델" 버튼이 전부 `disabled` mock 이라, 검증 엔지니어가 앱 재시작 없이 provider 를 구성할 수 없다.
백엔드 SSOT(handoff 0014)는 `~/.config/orca/sources/settings/<adapter>/<provider>/settings.json`
+ 어댑터별 `meta.json`(`models: {name, family, default}[]`)이고 `orca:agent:list` 가 이를 읽어
`AgentEnvironment[]` 를 돌려주지만, **이 데이터를 변경(write)하는 IPC 가 없다.** 또 모델 칩은
alias(`family`)만 보여 실제 모델명이 가려진다.

이 작업은 (1) claude-code provider 추가/편집/삭제 IPC, (2) settings.json env 키에서 모델·family
추출 → meta.json 갱신, (3) 카드/Composer 가 전체 뷰 리렌더 없이 싱크되는 공유 agent store,
(4) 모델명을 부각한 카드 UI 를 제공한다.

### 사용자 확정 사항 (요구 정의 시 결정)

- **모델 추출 원천** = settings.json 의 **env 키 규약** 파싱
  (`ANTHROPIC_DEFAULT_{SONNET,HAIKU,OPUS}_MODEL` → family, `ANTHROPIC_MODEL`/top-level `model` → default).
- **추출 실패(인식 모델 0개)** → **'SDK 기본 모델' 단일 칩 폴백**(현재 빈 `models[]` 동작과 동일).

### 재사용 기준점 (탐색 확정 — 정확도 핵심)

- **CRUD 선례 = MCP 기능** (그대로 미러): 채널 `mcpAdd/mcpUpdate/mcpDelete`
  (`app/src/main/ipc/handlers/mcp.ts`) + 모달 `features/skills/components/AddMcpServerModal.tsx`
  + 훅 `features/skills/hooks/useMcpServers.ts`(부팅 1회 list → mutation 직후 `refresh()`).
- **모달 + 백드롭 패턴**: `features/projects/components/CreateProjectModal.tsx`
  (`fixed inset-0 z-50 ... bg-black/40` + `onClick=onClose` + panel `stopPropagation`). 블러 요구는
  오버레이에 `backdrop-blur-sm` 추가.
- **모델 도메인**: `app/src/main/settings/model-resolve.ts`(`OrcaModelSchema {name,family?,default?}`,
  `modelKey`), `provider-registry.ts`(`listProviders` 가 meta.json 읽어 models 채움).
- **원자적 JSON write**: `app/src/main/deploy/scaffold.ts#writeJsonAtomic`(tmp→rename) 재사용/추출.
- **컨텍스트 1m 규약**: `app/src/renderer/src/features/chat/lib/contextWindow.ts` — 모델명에 `'1m'`
  포함 시 1M. 즉 `[1m]` 은 **이름 기반**(family 파생 시 동일 규약 차용).
- **agents 소비처가 둘**: `AgentEnvironmentView` + `Composer.tsx`(`useAgents` → `ModelMenu`,
  `composer/modelSelection.ts`). `shared/hooks/useAgents.ts` 는 **부팅 1회 로드(refresh 없음)** →
  편집/삭제 싱크의 핵심 변경점.

## 인수 기준 (Acceptance Criteria)

1. **엔진 추가 모달**: 헤더의 "엔진 추가" 버튼이 활성화되고 클릭 시 모달이 열리며, 입력 창을 제외한
   배경이 블러(`backdrop-blur`) + 딤 처리된다(`CreateProjectModal` 패턴 + blur).
2. **모달 입력**: ① 엔진 드롭다운 — `claude-code` 만 선택 가능(그 외 옵션 disabled), ② Provider
   text input — `trim()` 빈칸이면 저장 비활성, ③ settings.json 대형 textarea(monospace). 저장 시
   JSON.parse 실패하면 인라인 에러 + 저장 차단.
3. **즉시 생성(write IPC)**: 저장 시 main 이 신규 채널로
   `~/.config/orca/sources/settings/claude-code/<provider>/settings.json` 을 **원자적 write**
   (`writeJsonAtomic` 재사용). provider 빈값/중복은 거부(zod + 핸들러 검증).
4. **모델 추출 → meta.json**: 순수 함수 `extractModels(settingsJson)` 이 env 키 규약
   (`ANTHROPIC_DEFAULT_SONNET_MODEL`→`{family:'sonnet'}`, `_HAIKU_MODEL`→haiku, `_OPUS_MODEL`→opus,
   top-level `model`/`ANTHROPIC_MODEL`→default, 이름에 `1m` 포함 시 family 에 `[1m]` 표식)에서
   `OrcaModelConfig[]` 를 만들어 `claude-code/meta.json` 의 해당 provider `models` 를 갱신한다.
   인식 모델 0개면 빈 배열로 두어 카드가 'SDK 기본 모델' 폴백을 보이게 한다. **단위 테스트 동반.**
5. **카드 부분 리렌더(구조 분해)**: `AgentEnvironmentView` 를 컨테이너 + `EngineCard` + 모델 목록
   컴포넌트로 분해. 추가/편집/삭제 시 공유 agent store `refresh()` 로 카드 목록만 갱신(뷰 전체 강제
   리마운트 없음).
6. **Composer 싱크**: agents 를 공유 store 로 승격해 동일 `refresh()` 가 `Composer`/`ModelMenu` 에도
   반영(편집/삭제 후 모델 메뉴 즉시 갱신, 앱 재시작 불필요).
7. **편집/삭제**: 카드의 편집 버튼 → 저장된 raw settings.json 을 프리필한 모달(provider·engine 은
   읽기 전용, settings 만 편집), 삭제 버튼 → 확인 후 provider 디렉토리 제거 + 메뉴 싱크.
8. **모델 표시 디자인**: 카드 하단 모델 목록이 alias(family)와 **실제 모델명을 함께** 보이되 실제
   모델명이 primary(더 크고 진한 mono), family 는 secondary 태그. default 모델은 액센트(rust).
9. **계약·게이트**: 신규 IPC 채널을 `docs/IPC_CONTRACT.md` 에 동시 갱신. 게이트 4종
   (`lint`/`typecheck`/`test`/`build`) 통과 + `extractModels` 단위 테스트.

## 범위 / 비범위

- **범위**: claude-code provider 의 add/update/delete IPC + settings.json/meta.json write, env 키
  모델 추출, agent 공유 store(refresh) + 뷰 분해, 모달, 카드 모델 UI, IPC_CONTRACT.
- **비범위**: opencode 등 타 어댑터 추가(드롭다운 disabled 유지), provider rename(=삭제+추가로 대체),
  settings.json 스키마 풀 검증(JSON 파싱 + env 추출까지만), dist 핫리로드 외 런타임 적용 보장은
  `invalidateAll()` + 기존 deploy 경로 재사용 수준.

## 설계

**백엔드(main, L1→L3)**

- 신규 채널(`src/shared/ipc.ts` `CHANNELS`): `engineAdd: 'orca:engine:add'`,
  `engineUpdate: 'orca:engine:update'`, `engineDelete: 'orca:engine:delete'`,
  `engineRead: 'orca:engine:read'`(편집 프리필용 raw settings.json 반환). 읽기 목록은 기존
  `agentList` 재사용.
- zod 스키마(`src/shared/protocol.ts`): `CreateEngineSchema {engine:'claude-code', provider:string(min1),
  settingsJson:string}`, `UpdateEngineSchema {key:string, settingsJson:string}`,
  `DeleteEngineSchema {key}`, `ReadEngineSchema {key}`.
- 신규 L1 모듈 `src/main/settings/engine-write.ts`:
  - `extractModels(settingsJson): OrcaModelConfig[]` — **순수 함수**(env 키 규약 파싱, 인수 기준 4).
  - `writeProviderSettings(adapter, provider, json, root)` — 디렉토리 mkdir + `writeJsonAtomic`.
  - `updateMeta(adapter, provider, models, root)` — 기존 meta.json 읽어 provider models 머지 후 write.
  - `deleteProvider(adapter, provider, root)` + meta.json 엔트리 제거.
  - `parseEngineKey(key)` = 기존 `config/provider-key.ts#parseProviderKey` 재사용.
- 신규 핸들러 `src/main/ipc/handlers/engine.ts`(`mcp.ts` 미러) — write 후
  `ctx.providerSettings.invalidateAll()`; 런타임 즉시성 위해 기존 deploy 경로 재사용 여부는 구현 시
  최소(invalidate)→필요 시 redeploy 로 판단(보고에 기재). `router.ts` 에 `registerEngineHandlers` 등록.
- preload `src/preload/index.ts` 에 `engine.{add,update,delete,read}` 브리지 추가.

**프론트(renderer)**

- `shared/hooks/useAgents.ts` → **Zustand 기반 공유 store 로 승격**(handoff 0013 선례 — Context→store).
  `shared/stores/agentStore.ts`: 부팅 1회 로드 + `refreshAgents()` 액션, `useAgents()` 셀렉터 유지
  (Composer 호출부 무변경). 엔진 mutation 직후 `refreshAgents()` 호출 → 카드 + ModelMenu 동시 싱크.
- `shared/api/ipc.ts` 에 `engineApi.{add,update,delete,read}` 추가.
- `features/engine/` 분해:
  - `components/AgentEnvironmentView.tsx`(컨테이너: 헤더 + 추가버튼 + 목록 map),
  - `components/EngineCard.tsx`(카드 1개 — 헤더 + 편집/삭제 버튼 + 모델 목록),
  - `components/EngineModelList.tsx`(모델 row — 실제 모델명 primary mono / family 태그 secondary /
    default 액센트),
  - `components/EngineFormModal.tsx`(추가·편집 공용 — 드롭다운/provider input/settings textarea + 블러
    오버레이; `CreateProjectModal` 마크업 차용),
  - `hooks/useEngines.ts`(`useMcpServers` 미러 — list(store) + add/update/remove → IPC → refresh),
  - `index.ts` 배럴.
- 레이어: agent store 는 chat+engine 두 feature 가 쓰므로 `shared/` 에 둔다(타-feature import 회피).

### UX 디자인 노트 (수석 엔지니어 의도)

모델 row 권장 형태(트렌드 — primary id + secondary 태그):

```
┌ [SONNET] claude-sonnet-4-5            ✓ default
├ [OPUS·1m] claude-opus-4-1-1m
└ [HAIKU]  claude-haiku-4-5
```

- 실제 모델명: `font-mono text-[12.5px] font-medium text-ink`(primary).
- family 태그: `text-[10px] uppercase tracking-wide text-ink3 bg-cream-50 rounded px-1.5`.
- default: rust 액센트(`bg-rust-soft text-rust`) — 기존 칩 토큰 재사용.

## 영향 받는 파일

- `app/src/shared/ipc.ts`, `app/src/shared/protocol.ts`
- `app/src/main/settings/engine-write.ts`(신규) + `engine-write.test.ts`(신규)
- `app/src/main/ipc/handlers/engine.ts`(신규), `app/src/main/ipc/router.ts`(등록)
- `app/src/main/deploy/scaffold.ts`(`writeJsonAtomic` 재사용/공유 추출)
- `app/src/preload/index.ts`
- `app/src/renderer/src/shared/stores/agentStore.ts`(신규), `shared/hooks/useAgents.ts`,
  `shared/api/ipc.ts`
- `app/src/renderer/src/features/engine/components/{AgentEnvironmentView,EngineCard,EngineModelList,EngineFormModal}.tsx`,
  `features/engine/hooks/useEngines.ts`, `features/engine/index.ts`
- `docs/IPC_CONTRACT.md`(§6 — 동시 갱신)

## 참고 문서

- `docs/TRD.md`(provider/모델 메뉴), `docs/arch/frontend/layers.md`(4-layer), `docs/handoff/0014-provider-settings-dist/`(sources SSOT)
- `docs/IPC_CONTRACT.md` §6 변경 절차 — **신규 채널 추가 시 반드시 동시 갱신**

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test && npm run build`.
- 신규 테스트: `extractModels`(순수 변환기 — env 키→models, 1m 변형, 폴백) 단위 테스트 필수.
  IPC 스키마(zod) 파싱 테스트 권장.

---

## [Codex 기입] 구현 체크리스트

- [x] 인수 기준 1 — 엔진 추가 모달(블러 배경)
- [x] 인수 기준 2 — 드롭다운/provider input/settings textarea + 검증
- [x] 인수 기준 3 — engine add write IPC + 원자적 settings.json 생성
- [x] 인수 기준 4 — `extractModels` env 키 추출 + meta.json 갱신 (+ 폴백) + 단위 테스트
- [x] 인수 기준 5 — 뷰 분해(EngineCard 등) + 부분 리렌더
- [x] 인수 기준 6 — 공유 agent store + Composer 싱크
- [x] 인수 기준 7 — 편집(프리필)/삭제(디렉토리 제거)
- [x] 인수 기준 8 — 모델명 부각 카드 UI
- [x] 인수 기준 9 — IPC_CONTRACT 갱신 + 게이트 4종

## [Codex 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | `app/src/shared/{ipc,protocol}.ts`, `app/src/main/settings/engine-write.ts`, `app/src/main/ipc/handlers/engine.ts`, `app/src/preload/index.ts`, `app/src/renderer/src/shared/{api/ipc.ts,hooks/useAgents.ts,stores/agentStore.ts}`, `app/src/renderer/src/features/engine/**`, `docs/IPC_CONTRACT.md` |
| 실행 명령 | `cd app && npm run lint` / `cd app && npm run typecheck` / `cd app && npm test` / `cd app && npm run build` |
| 게이트 결과 | lint PASS / typecheck PASS / test PASS(384/384; 실행 전 better-sqlite3 Node ABI mismatch 9건 확인 후 `npm rebuild better-sqlite3` 로 복구) / build PASS |
| 블로커 / 역질문 | 없음. UI 시각 검증은 사람 확인 필요. |
| 대상 커밋 | `50b8dce` |
