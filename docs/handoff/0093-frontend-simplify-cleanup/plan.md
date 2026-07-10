# Plan — 0093-frontend-simplify-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1. 비기능(리팩토링) = Claude 직접 plan → impl → verify.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0093-frontend-simplify-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-07-10 |
| 매핑 | PR (본 브랜치 `claude/simplify-shared-preload-renderer-hy4rpg`) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify @./app/src/shared @./app/src/preload @./app/src/renderer` — 세 트리를 reuse/simplification/efficiency/altitude 4관점으로 리뷰하고 발견 사항을 수정하라. 버그 헌팅은 비범위(`/code-review` 소관). | 라이브 세션 요청 (2026-07-10) |
| 추론 의도 | "수정"은 동작 보존 정리에 한정하고, 설계/동작 변경이 수반되는 발견은 적용하지 않고 기록만 한다. 단, 모달 셸의 공용 `Modal` 이관은 *시각 통일이 곧 목적*이라 크롬 차이(타이틀 크기·X 버튼·라벨 톤)를 수용 — 추론. 근거: `Modal` 헤더 주석이 "AddMcpServerModal 패턴 일반화"라 명시(미완의 이관), /simplify 규칙 "동작 변경 수정은 스킵하고 노트". | (추론) |

## Context (왜)

0092(`/simplify app/src/main`) 후속. `app/src/shared`+`preload`+`renderer` (~288파일 / 25.4k줄, 프로덕션 ~21.5k줄) 을 4개 독립 리뷰 에이전트로 스캔한 결과 4관점 공통 평가는 "이미 잘 정돈됨" — delta/commit 분리·`reconcileSegments`·memo 체계·store 패턴·레이어 경계 모두 클린. 살아남은 고확신 발견을 dedup 후 **13건 적용 / 5건 스킵**으로 판정했다. 목적은 유지보수 비용 절감(셸/상수/헬퍼 중복 제거)과 스트리밍 핫 패스 낭비 제거(라이브 reasoning 전문 재파스)이며, §리스크에 명시한 모달 크롬 통일 외 동작 변경 없음.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| `MOCK_HATCH_BG` 소비자 0 (`DISABLED_HATCH_CLASS` 만 `ProjectFilesCard` 사용) | `renderer/src/shared/ui/mock.ts:2` · grep 결과 정의부 외 0 |
| `MODE_LABELS` 6개 라벨이 `MODE_OPTIONS.label` 의 수기 사본 (이중 진실원) | `features/chat/components/composer/modes.ts:54-61` vs `:7-52` · 소비자 `Composer.tsx:581` |
| `MENU_ITEM` 동일 문자열 3중 정의 (`AttachMenu` 는 변형이라 별도) | `EffortMenu.tsx:15` · `ModeMenu.tsx:6` · `ModelMenu.tsx:6` |
| 모달 오버레이 셸(portal/backdrop/Esc/footer) 수동 재구현 — `Modal` 주석 "AddMcpServerModal 의 fixed overlay 패턴을 일반화" 의 이관 미완. 기존 이관 완료 5종(`SkillAuthorModal` 등)이 패턴 적합성 증명 | `CreateProjectModal.tsx:44` · `EditInstructionsModal.tsx:53` · `AddMcpServerModal.tsx:88`(+`FIELD_LABEL/INPUT`=`MODAL_LABEL/INPUT` 중복 `:32-33`) · `SettingsModal.tsx:60-62` · `shared/ui/Modal.tsx:28-30` |
| `ProjectsScreen.formatRelative` 의 분/시간 사다리가 shared `relativeTimeLabel` 재구현 (`ProviderUsageTab` 은 shared 사용 선례) | `ProjectsScreen.tsx:14-27` vs `app/src/shared/time/relative.ts` |
| Skill/File 자동완성의 anchored floating 셸 ~40줄 verbatim 중복 (+양쪽 미사용 `panelRef` 데드) | `SkillAutocomplete.tsx:27-52` vs `FileAutocomplete.tsx:31-58` |
| 자동완성 훅의 `rawActiveIndex`+`dismissedAt`+clamp+close plumbing 동일 중복 | `useSkillAutocomplete.ts:25-48` vs `useFileAutocomplete.ts:49-137` |
| `toolMeta` 로컬 `basename` 이 shared `basenameForDisplay` 재구현 — `basenameForDisplay(fp, fp)` 로 폴백 의미 동치(세그먼트 0 → 원문) | `toolMeta.ts:100-103` vs `app/src/shared/path-basename.ts` |
| 라이브 reasoning 이 plain `Markdown` 경유 → 델타 프레임(~rAF)마다 누적 전문 unified 재파스. 텍스트 경로는 `StreamingMarkdown`(stable/tail 분리, 0008)으로 이미 해소 — reasoning 경로만 패리티 누락 | `PendingAssistant.tsx:23-27` → `ReasoningBlock.tsx:31` vs `markdown/StreamingMarkdown.tsx` |
| `subagentTasksFromMessages` O(전체 parts) 파생이 헤더/본문 2개 컴포넌트에서 비메모 재계산 (`AgentTaskRow:38` 은 useMemo 선례) | `SubAgentTileContent.tsx:57,86` |
| `HighlightedTextarea` 가 Composer 재렌더(caret·메뉴 등 draft 무관 상태 포함)마다 전체 draft 재토크나이즈 | `HighlightedTextarea.tsx:141` |
| `FILE_EDIT_TOOLS`{W,E,ME} vs `FILE_TOOLS`{R,W,E,ME} near-identical 집합 2개 + `Task\|\|Agent` 인라인 판별 2곳 (`parts.ts:266` `isAgentTaskName` 기존 헬퍼 존재, `ToolGroup` 은 사용 중) | `registry.ts:62,79` · `ToolCard.tsx:18` · `toolMeta.ts:90-91` |
| `StatusLine` 은 shared/ui 소재지만 소비자 2곳 전부 chat(어시스턴트-턴 어휘) — `shared/ = 도메인 로직 0` 규약(layers.md) 위반의 배치 문제. `elapsed.ts` 는 범용이라 잔류 | `shared/ui/StatusLine.tsx` · 소비자 `PendingAssistant.tsx:38`·`SubAgentTileContent.tsx:123` |
| rename fan-out 2줄이 pages/app 훅에 중복이나 양쪽 모두 배치 의도 주석 보유 + delete 쪽은 active-id 소스 상이 | `pages/useSessionActions.ts:36-39` vs `app/hooks/useSessionHandlers.ts:94-100` |
| 부트 스텝(backend/sessions/projects-cost) 직렬 await — 병렬화는 진행바 UX·per-step 계측 트레이드오프 | `app/boot/steps.ts:125-152` |

## 인수 기준 (Acceptance Criteria)

**A. 데드코드 / 파생**

1. `mock.ts` 의 `MOCK_HATCH_BG` 삭제 (`DISABLED_HATCH_CLASS` 유지).
2. `MODE_LABELS` 를 `MODE_OPTIONS` 에서 `Object.fromEntries` 파생으로 전환 — 수기 사본 제거, 소비자(`Composer`) 무변경.
3. `MENU_ITEM` 을 composer 공용 모듈 1곳으로 승격, Effort/Mode/Model 3개 메뉴가 import (`AttachMenu` 변형은 유지).

**B. 재사용 통합**

4. `CreateProjectModal`·`EditInstructionsModal`·`AddMcpServerModal` 이 `Modal`+`ModalActions`+`MODAL_LABEL/INPUT` 을 사용하고 로컬 오버레이/footer/`FIELD_*` 정의는 삭제된다. `ModalActions` 에 `cancelDisabled`(busy 중 취소 차단) 추가. `SettingsModal` 은 `panelClassName`/`ariaLabel` 크롬리스 경로로 backdrop/portal/Esc 를 `Modal` 에 위임(클래스 1:1 보존). `EngineFormModal`/`UpdateDialog` 는 §스킵.
5. `ProjectsScreen.formatRelative` 의 하루-미만 구간이 shared `relativeTimeLabel` 호출로 대체된다 (어제/N일/날짜 tail 은 로컬 유지, 출력 문자열 동일).
6. Skill/File 자동완성의 포지셔닝+portal 셸을 공용 `AnchoredDropdown` 으로 추출 — 두 컴포넌트는 항목 렌더만 보유, 미사용 `panelRef` 제거.
7. 자동완성 훅 공통 상태 머신을 `useTokenAutocompleteState(partial, suggestionCount)` 로 추출, 두 훅이 합성한다 (반환 인터페이스 무변경).
8. `toolMeta` 로컬 `basename` 을 `basenameForDisplay(fp, fp)` 로 대체.

**C. 효율 (핫 패스)**

9. 라이브 reasoning 이 `StreamingMarkdown` 으로 렌더된다 — `ReasoningBlock` 에 `streaming` prop 추가, `LiveReasoning` 만 전달. 커밋 경로(단일 `Markdown` + memo bail)는 무변경.
10. `SubAgentTileHeader`/`SubAgentTileContent` 의 `subagentTasksFromMessages` 파생이 `useMemo([messages(, selectedId)])` 로 고정된다.
11. `HighlightedTextarea` 의 `tokenize` 가 `useMemo([value, knownSkillNames, validFilePaths])` 로 고정된다.

**D. 단일 진실원 / 배치**

12. `FILE_EDIT_TOOLS`·`FILE_TOOLS`(파생: +Read) 를 `toolMeta` 단일 export 로 통일 — `registry`(diff match)·`ToolCard`(헤더/복사) 가 import. `registry.agent_task`·`toolVerbCategory` 의 인라인 `Task||Agent` 를 `isAgentTaskName` 호출로 대체.
13. `StatusLine.tsx` 를 `shared/ui` → `features/chat/components` 로 이동(git mv), 소비자 2곳 import 갱신. `elapsed.ts` 는 shared/ui 잔류.

**공통**

14. 게이트 3종(lint/typecheck(+test)/test) green. 레이어 경계 위반 0(신규 import 전부 하향/동일 feature). 신규 의존성 0. 순수 파생 신설분(2·12)은 단위 테스트로 고정.

## 범위 / 비범위 (스킵 5건 — 사유 기록)

- **부트 스텝 병렬화** (`steps.ts:125-152`): 총 부팅시간 단축 가능하나 한-줄-씩 진행바 UX·per-step 계측이 의도된 직렬 설계일 수 있음 → 동작 변경이라 /simplify 범위 밖.
- **`EngineFormModal` Modal 이관**: Esc 닫기가 `!menuOpen` 조건부(Popover Esc 와 층위 분리) — `Modal` 의 무조건 Esc 로는 동작 보존 불가(prop 신설 필요). 백드롭 클래스도 상이(`px-4`·flex). 보류.
- **`UpdateDialog` Modal 이관**: 백드롭 클릭 미닫힘 + busy 중 닫기 차단이 의도된 dismissal 정책 — `Modal` 이관 시 동작 변경. 보류.
- **rename/delete fan-out 통합** (`useSessionActions` vs `useSessionHandlers`): 중복은 2줄 store 호출뿐, 양쪽 모두 배치 의도 주석 보유, delete 는 active-id 소스가 달라 의도 차이 가능 → 교차-레이어 헬퍼의 간접화 비용이 이득을 초과.
- **descriptor 전면 일반화** (toolMeta/ToolCard/DiffBody/registry 의 도구별 필드 지식 4중 분산): 대형 리팩토링 — #12 의 이름-집합 단일화로 드리프트 지점만 제거하고, `ToolRenderer` descriptor 확장(verbCategory/필드 접근자/diffPairs)은 후속 후보로 기록.
- (보더라인 무조치) clipboard copy 훅 신설(2 사이트) · USD 포매터 2종 통합(레이어 경계상 shared 신설 필요) — 트리비아.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 사용: `shared/ui/Modal`(+`ModalActions`·`MODAL_*`) · `shared/time/relative` · `shared/path-basename` · `markdown/StreamingMarkdown` · `lib/parts.isAgentTaskName`. **신규 의존성: 없음.**
- `basenameForDisplay(fp, fp)` 는 세그먼트 부재 시 fallback(=원문) 반환 — 기존 로컬 `basename` 의 "세그먼트 0 → 원문" 폴백과 동치(끝 구분자 처리 포함).
- 하루-미만 상대시각: `relativeTimeLabel` 의 방금/분/시간 경계가 기존 `formatRelative` 와 floor 연산까지 동일(미래 시각 포함).

## 설계

- 신규 파일 배치는 4-layer 경계 하향 유지: `menuItem.ts`·`AnchoredDropdown.tsx`=composer 로컬(소비자 전부 composer), `useTokenAutocompleteState.ts`=`features/chat/hooks`, `StatusLine.tsx`=`features/chat/components`(소비자 transcript·rightpanel 의 공통 부모).
- `ReasoningBlock.streaming` 은 라이브/커밋 경로 분기를 *데이터가 아닌 렌더러 선택* 으로 한정 — items 조립·memo 계약(0008) 무변경.
- `FILE_TOOLS = {Read} ∪ FILE_EDIT_TOOLS` 파생으로 새 편집형 도구 추가 시 1곳만 수정. `DiffBody.buildPairs` 는 도구별 *구조 추출*(branch 별 상이)이라 집합 소비자가 아님 — 무변경.
- `ModalActions.cancelDisabled` 는 optional(default false) — 기존 5개 소비자 무변경.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- 모달 3종(Create/EditInstructions/AddMcp)은 `Modal` 크롬으로 통일되며 **시각·미세동작이 변한다**: 타이틀 16→18px·우상단 X 버튼 추가·라벨 uppercase 톤→`MODAL_LABEL`·인풋 `rounded-md`→`MODAL_INPUT`·**Esc 닫기 추가**·portal 렌더. 폼 상태/검증/저장 로직은 무변경.
- `SettingsModal` 은 클래스 1:1 보존(백드롭·패널·Esc·portal 모두 기존과 동일 동작) — 시각 변화 없음.
- 라이브 reasoning 의 블록 간 간격이 `StreamingMarkdown` 래퍼(`flex flex-col gap-2`)를 따름 — 텍스트 경로와 동형(기존 Markdown 문단 마진 근사, 0008 주석).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| 모달 3종 크롬 통일 = 의도적 시각 변경 | 이미 이관된 5종과 시각 일치가 목적(Modal 주석의 미완 이관 완료). 사람 시각 검증 대기 항목으로 명시 |
| Esc 닫기 추가로 폼 입력 중 실수 닫힘 가능 | 다른 5종 모달과 동일 계약. unmount=reset 패턴이라 재오픈 시 깨끗한 상태 |
| `StreamingMarkdown` 의 stable/tail 분할이 reasoning 마크다운에서 블록 경계 미세 차이 가능 | 텍스트 경로에서 이미 검증된 메커니즘 + message.completed 커밋 렌더가 자기교정(기존 주석 근거) |
| `basenameForDisplay` 세그먼트 내 trim 이 기존과 미세 상이(공백-only 세그먼트) | 표시 전용 + 병리적 입력 한정 — 수용 |

- 되돌리기 어려운 결정: 없음 (전부 git 이력 복원 가능).
- **단독 결정 금지 항목**: 없음 (Open Question 무접촉, 신규 의존성 0, IPC/preload/main 무접촉).

## 영향 받는 파일

- 신설 4: `composer/{menuItem.ts,AnchoredDropdown.tsx,modes.test.ts}` · `hooks/useTokenAutocompleteState.ts`
- 이동 1: `shared/ui/StatusLine.tsx` → `features/chat/components/StatusLine.tsx`
- 수정 23: `shared/ui/{Modal.tsx,mock.ts}` · `composer/{modes.ts,EffortMenu,ModeMenu,ModelMenu,HighlightedTextarea,SkillAutocomplete,FileAutocomplete}` · `transcript/{ReasoningBlock,PendingAssistant,ToolCard,registry.ts}` · `rightpanel/SubAgentTileContent` · `hooks/{useSkillAutocomplete,useFileAutocomplete}` · `lib/toolMeta.ts(+test)` · `projects/{CreateProjectModal,EditInstructionsModal,ProjectsScreen}` · `skills/AddMcpServerModal` · `settings/SettingsModal`
- `app/src/shared`·`app/src/preload` 무변경(리뷰 결과 클린 — preload 는 per-channel 일관 미러라 무조치).

## 참고 문서

- `docs/arch/frontend/layers.md` (4-layer 경계 · shared=도메인 로직 0)
- handoff `0008`(스트리밍 재렌더 계약) · `0092`(main /simplify 선행)
- IPC 변경: 없음 (`IPC_CONTRACT.md` 무접촉)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm run typecheck:test && npm test`.
- 신규 테스트 요구: AC2(MODE_LABELS 완전성)·AC12(집합 파생·delegated 판별) 단위 테스트.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구 인용, 모달 시각 통일 수용은 추론으로 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인` 레퍼런스.
- [x] 인수 기준 — 번호·검증 가능·자료조사 근거.
- [x] 의존 기술 — 신규 의존성 0 확인.
- [x] 파생 UX — 모달 크롬 변경·reasoning 간격 동형성 검토.
- [x] 리스크 — 시각 변경·Esc·스트리밍 분할 기록, Open Question 무접촉.

---

## [구현자 기입] 설계 리뷰 (비판적)

- 동의 / 그대로 진행: 13건 전부 설계대로 구현. 스킵 5건(부트 병렬화·EngineFormModal·UpdateDialog·fan-out·descriptor 전면화)의 사유가 실사와 일치함을 확인.
- 이견 / 우려: 없음. `EngineFormModal`/`UpdateDialog` 는 실독 결과 dismissal 정책이 실제로 상이(조건부 Esc / 백드롭 미닫힘)해 스킵 판단이 옳았다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 모달 3종의 취소 버튼이 busy 중 `disabled` — 기존 `ModalActions` 는 미지원이라 이관 시 busy 중 취소 가능해지는 동작 변화 | ✅ `ModalActions.cancelDisabled` optional prop 신설(기존 소비자 무변경)로 동작 보존 | AC4 |
| 2 | `SubAgentTileHeader` 는 기존에 `selectedId == null` 이면 파생 자체를 건너뜀 — 무조건 useMemo 화하면 목록 모드에서 오히려 계산 추가 | ✅ `useMemo` 내부에서 `selectedId ? … : undefined` 분기 유지(레이지 보존) | AC10 |
| 3 | 자동완성 두 컴포넌트의 `panelRef` 가 양쪽 다 미사용(부착만) — 셸 추출 시 승계하면 데드코드 이식 | ✅ `AnchoredDropdown` 에서 제거 | AC6 |
| 4 | `modes.test.ts` 신설 시 tsconfig.test 범위 — renderer 테스트는 `tsconfig.web` 포함이라 typecheck:web 로 커버 | ✅ `typecheck`+`typecheck:test` 둘 다 green 확인 | 게이트 |

## [구현자 기입] 구현 체크리스트

- [x] A1~A3 데드코드/파생
- [x] B4~B8 재사용 통합
- [x] C9~C11 효율
- [x] D12~D13 단일 진실원/배치
- [x] 게이트 green + 신규 테스트

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 신설 4 · 이동 1 · 수정 23 (위 §영향 파일) — 순 -80줄 (412+ / 492-) |
| 실행 명령 | `npm run lint` / `npm run typecheck` / `npm run typecheck:test` / `npm test` |
| 게이트 결과 | lint ✅ 0 / typecheck ✅ 3종 0 / test ✅ vitest **804 passed** (기존 801 + 신규 3) + node --test — 2 suite(`chat-turn.continuity`·`history/writer`)는 electron 바이너리 egress 403 환경 제한(0019/0092 동일 계열, 무변경 베이스라인에서도 동일) |
| 블로커 / 역질문 | 없음 |
| 대상 커밋 | 본 구현 커밋 (hash 는 INDEX.md·verify.md 에 기재) |
