# Plan — i18n-remaining-screens

## 메타

| 항목 | 값 |
|---|---|
| slug | `0097-i18n-remaining-screens` |
| 작성자 | Claude Code |
| 일자 | 2026-07-11 |
| 매핑 | PHASES "Phase 4 진행 중" / PR (push 후) |
| 상태 | READY (비기능 = Claude 직접 plan→impl→verify) |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "i18n 후속작업을 진행하라. 각 페이지별 랜딩 페이지 및 모달, 디버그 패널 등 i18n이 진행되지 않은 UI 요소들을 확인하고 진행하라." | 라이브 세션 요청 (2026-07-11) |
| 명시 요구 | 범위 = **잔여 전체 일괄** — 랜딩·모달·디버그 패널 + 채팅 화면 본문(transcript·composer·에러·toolMeta·우측 패널)까지 renderer 잔여 하드코딩 전부를 한 핸드오프로. 영역별 커밋 분할. | 라이브 세션 AskUserQuestion 응답 |
| 명시 요구 | 구현 주체 = **Claude 직접** (plan→impl→verify) — 0096 과 동일 | 라이브 세션 AskUserQuestion 응답 |
| 추론 의도 | "확인하고 진행하라" = 하드코딩 인벤토리 전수 조사 후 0096 카탈로그 컨벤션(`feature.중첩` dot-path·ko SSOT·`en: typeof ko` 패리티) *상속* 마이그레이션 — 0096 plan §비범위 ①/verify §결론/PHASES Future Scope 가 이미 이 후속을 정의했으므로 (추론) | `0096-i18n-ui-locale/plan.md:61` · `verify.md:82` · `@docs/PHASES.md` Future Scope |
| 추론 의도 | ko 표시 결과는 마이그레이션 전후 동일해야 한다(0096 원칙 계승 — 카탈로그 값은 기존 문자열 원문 이동, 리라이트 금지) (추론) | `0096-i18n-ui-locale/plan.md:50` "ko 표시 결과는 마이그레이션 전후 동일" |

## Context (왜)

0096 이 i18n 인프라(i18next 동기 init·`resources/ko.ts` SSOT·`en: typeof ko` 키 패리티·typed `t()`·`useI18n`)와 핵심 화면(설정 모달·앱 셸·사용량·날짜 표면)을 완료했지만, 카탈로그는 셸+설정 범위(`common/sidebar/userMenu/header/settings/usage` ~70키)에서 멈춰 있다. 랜딩 페이지·모달·디버그 패널·채팅 화면 본문 등 renderer 잔여 영역의 사용자 노출 문자열은 여전히 한국어 인라인 하드코딩이라, en 전환 시 혼합 언어 상태(0096 plan §파생 UX "의도된 과도기")가 남아 있다. 본 작업으로 renderer 사용자 노출 문자열 전체를 카탈로그로 이관해 과도기를 종료한다.

## 자료조사 (Research)

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 언어 전환은 `useTranslation` 구독 컴포넌트만 리렌더 → 모듈 상수에 번역 *결과* 를 굳히면 stale. 0096 은 "키 상수 + 렌더 시 `tr()` 해석" 패턴으로 회피(Sidebar NAV·GeneralTab OPTIONS) | `app/src/renderer/src/shared/i18n/index.ts:38-41` · `app/Sidebar.tsx` · `0096/plan.md:73` |
| 카탈로그 위생 테스트는 리프 키 재귀 순회(패리티·빈값·`{{}}` 플레이스홀더) — 신규 키 자동 커버 | `app/src/renderer/src/shared/i18n/resources/resources.test.ts` |
| 순수 모듈 라벨맵 다수: `VERB_LABEL`/`VERB_LABEL_ACTIVE`/`UNIT_LABEL`(Record 상수), `ERROR_CATEGORY_LABELS`, `MODE_OPTIONS`, `EFFORT_LABELS`, `STATUS_COPY`, UpdateDialog 상태맵, BackendStatus capability 맵, DebugPanel 시나리오맵, `rightPanelTiles.ts`, `routes.ts` | `features/chat/lib/toolMeta.ts:30-67` · `lib/errorLabels.ts:7-16` · `composer/{modes,effort,statusCopy}.ts` · `shared/navigation/routes.ts:15-21` |
| `toolGroupSegments` 는 `'명령 2개'` 조립 문자열 반환, `ToolGroup.tsx` 가 verb/count span 분리 렌더. `summarizeToolGroup` 은 프로덕션 소비자 0(테스트만) | `toolMeta.ts:229-257` · `transcript/ToolGroup.tsx:47-61` |
| `[분기]/[핸드오프]` 제목 마커는 **영속 데이터** — renderer draft 와 main 물질화가 문자열 단위로 일치해야 하고(`chatStore.ts:734` 주석), main 이 동일 형식을 독립 생성. `/compact [핸드오프]` 자동 메시지는 main 테스트가 "마커는 불변" 으로 고정 | `features/chat/store/chatStore.ts:735-748` · `src/main/app/chat-turn.ts:448` · `src/main/features/history/writer.ts:143` · `src/main/features/orchestration/handoff.test.ts:16-18` |
| 계보 표시 문구는 마커를 파싱하지 않고 `forkFrom`/`handoffFrom` 존재로 파생 → 표시 문구만 번역하면 됨 | `transcript/LineageBanner.tsx:29` |
| `openConfirmDialog` 호출부는 2곳, 둘 다 컴포넌트(호출부 `tr()` 가능). `ConfirmRequest` 는 문자열/ReactNode 수용 | `sessions/SessionRow.tsx:142` · `chat/ChatTitleBar.tsx:204` · `shared/ui/confirmDialogStore.ts:7-14` |
| `useCompletionNotifier` 는 정식 훅(`useTweakContext`/`useEffect` 사용) → `useI18n` 추가 가능 | `app/hooks/useCompletionNotifier.ts` |
| `datetime.ts` '어제'/'N일 전' 은 locale 파라미터 순수 함수 — 같은 상대시간 사다리의 하위 구간을 `src/shared/time/relative.ts`(main 공유·renderer i18n import 불가·의존성 0 강제)가 동일 방식으로 담당 | `shared/i18n/datetime.ts:107-108` · `app/src/shared/time/relative.ts` · `app/eslint.config.mjs`(shared 의존성 0) |
| `parts.ts:124` 합성 aborted result `'중단되었습니다'` 는 데이터 파트(하이드레이션 백스톱) — 판정은 `reason:'aborted'` 마커로 언어 독립, 표시 라벨은 VERB_LABEL_ABORTED 경유 | `features/chat/lib/parts.ts:124,287-294` |
| 한국어 assert 기존 테스트: toolMeta·parts·statusViewModel·modes·providerCatalog. 무변 유지 가능: datetime·chatStore(:617 `[분기]` 마커)·parts.settle-orphan·main handoff | `features/chat/lib/*.test.ts` · `composer/*.test.ts` · `engine/lib/providerCatalog.test.ts` |
| i18next plural: `_one`/`_other` 접미 키 + `count` 옵션 (ko 는 `_other` 단일 규칙이지만 `typeof ko` 패리티를 위해 양 접미 정의) | https://www.i18next.com/translation-function/plurals |

## 인수 기준 (Acceptance Criteria)

1. **게이트**: 각 구현 커밋이 `cd app && npm run lint && npm run typecheck && npm test` 를 통과한다 (환경 제한 electron 바이너리 403 의 기존 2 suite 제외 — 0092~0096 동일 베이스라인).
2. **잔존 0**: `renderer/src` 의 사용자 노출 한글 리터럴이 비범위 화이트리스트(§범위/비범위) 외에 잔존하지 않는다 — grep 전수 대조를 verify 에 첨부.
3. **ko 무변**: ko 표시 결과가 마이그레이션 전과 동일하다 — 카탈로그 값은 기존 문자열 원문 이동이며, 본 계획이 명시한 수정 테스트 외 기존 테스트가 무수정 통과한다.
4. **stale 0**: 모듈 상수 라벨맵은 전부 키(dot-path) 또는 렌더 시 해석으로 전환 — en 전환이 재시작 없이 라이브 반영된다(번역 결과를 굳힌 모듈 상수 0).
5. **plural**: 도구 그룹 카운트가 i18next `count` 복수형으로 렌더된다 — ko '명령 2개', en '1 command'/'2 commands'.
6. **toolMeta 재설계**: `ToolGroupSegment` 구조화(`{category,n,hasError}`) + `summarizeToolGroup` 삭제 후 ToolGroup/ToolCard 의 ko 렌더 결과가 기존과 동일하다.
7. **마커 불변**: `[분기]/[핸드오프]` 제목 마커·`/compact [핸드오프]` 자동 메시지는 바이트 단위 불변 — `chatStore.test.ts`(분기 제목)·main `handoff.test.ts` 무수정 통과.
8. **카탈로그 위생**: `resources.test.ts` 3개 항목(키 패리티·빈값·플레이스홀더)이 신규 키 포함 통과한다.
9. **store 에러 키화**: store 가 만드는 폴백 에러/검증 메시지는 카탈로그 키(또는 코드)로 저장되고 렌더에서 번역된다 — 언어 전환 시 표시 중인 에러 문구도 갱신.
10. **OS 알림**: 응답 완료 알림 body 가 현재 locale 로 발송된다.

## 범위 / 비범위

- **범위**: `app/src/renderer/src` 전역의 사용자 노출 하드코딩 문자열 전체 — 랜딩 페이지(NewChatLanding·ProjectLanding·CustomizeLanding·Boot)·모달(검색·엔진·프로젝트·MCP/Skill·업데이트·설치·인증 만료·확인 다이얼로그)·디버그 패널·채팅 화면 본문(transcript·composer·에러 라벨·toolMeta 동사·우측 패널)·nav/search·backend/update·camera/login. 0096 카탈로그 컨벤션 상속.
- **비범위 (번역 비대상 화이트리스트)**:
  1. 코드 주석 · `console.*` 로그 · dev `mock.ts` 데이터.
  2. `[분기]/[핸드오프]` 제목 마커·`/compact [핸드오프]` 자동 메시지 — 영속/계약 데이터(자료조사 참조). en locale 마커는 main 의 locale 인지가 필요한 별도 후속.
  3. `parts.ts:124` 합성 aborted result 원문(데이터 파트).
  4. 고유명: 'Orca'·'Claude Code'·provider id·모델명·'SSO' 등.
  5. `app/src/shared/**`(main 공유 — renderer 카탈로그 import 금지, 기존 locale 파라미터 방식 유지) + `shared/i18n/datetime.ts` 의 locale 파라미터 분기(동일 계열 예외로 주석 문서화).
  6. main 프로세스 문자열 전체.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 재사용: `shared/i18n/`(0096 — useI18n·ko/en 카탈로그·typed t()·resources.test), `useTweaks`/`TweakProvider` 언어 배선(변경 없음).
- i18next plural(`_one`/`_other` + `count`) — 설치본 i18next v26 내장, **신규 의존성 0**.
- 전제: typed `t()`(`CustomTypeOptions`)가 plural 접미 키를 `count` 옵션으로 해석(C3 초입 확인 — 불가 시 `n===1` 분기 헬퍼 폴백, 리스크 표 참조).

## 설계

- **D1. 순수 모듈 라벨맵 표준**: Record 값 → dot-path 키, 컴포넌트에서 `tr(KEY_MAP[x])` 해석(0096 stale-방지 패턴). 대상: toolMeta VERB/UNIT 3종, errorLabels(`errorCategoryKey(): key | null` — 미지 카테고리는 null 반환·소비자가 원문 노출), modes/effort(`labelKey`/`descriptionKey` 필드명 전환), statusCopy(키 테이블)+statusViewModel(labels→labelKeys), UpdateDialog 상태맵, BackendStatus capability 맵, DebugPanel 시나리오맵, rightPanelTiles, routes(labelKey/breadcrumbKey — AppLayout 에서 해석). **예외**(일회성 imperative — 호출 시점 스냅샷이 의미상 옳음): OS 알림·토스트·`openConfirmDialog` 는 호출부(컴포넌트/훅)에서 `tr()` 해석한 문자열 전달.
- **D2. 카운트 조립**: `ToolGroupSegment` → `{category,n,hasError}` 구조화, 소비자(`ToolGroup`/`ToolCard`)가 `tr(UNIT_KEY[cat], {count:n})`. ko 도 `_one`/`_other` 동일 값 쌍 정의(`typeof ko` 패리티 유지). `summarizeToolGroup` 삭제(프로덕션 소비자 0). `parts.ts` `SubagentTaskSummary` 의 라벨 문자열 필드(toolCountLabel/durationLabel/tokenLabel)를 원시값(durationMs·tokenCount 등)으로 교체, 포맷은 소비자가 tr 로 수행.
- **D3. 계보 마커**: 마커·자동 메시지 불변(비범위 ②). 표시 문구(LineageBanner·Fork/CompactBoundaryMarker)만 `chat.transcript.*` 이관. `continuityDraftSession(marker)` 파라미터를 `'fork'|'handoff'` 시맨틱 값으로 바꾸고 내부 상수로 한글 마커 해석(가독성 리팩토링, 동작 무변).
- **D6. store 에러 키화**: `providerCatalog` validate 반환 `{ok:false, errorKey, params?}`(EngineFormModal 이 tr). login/update/agent store 폴백은 `errors.*` 키 저장+렌더 해석. backend 원문 `result.message` 는 그대로 통과.
- **네임스페이스 확장**(ko.ts 먼저): `common` 확장(confirm/add/create/delete/remove/copy/copied/more/loading/running/inProgress/done/aborted/failed/description/noDescription/rename/newChat), 신규 `nav`·`search`·`chat.{composer,status,transcript,toolMeta,rightpanel,approval,ask}`·`errors`·`notify`·`skills`·`projects`·`engine`·`backend`·`update`·`debug`·`camera`·`login`·`landing`·`boot`.
- **레이어 경계**: 카탈로그·훅은 `renderer/shared/i18n`(기존), feature 코드는 자기 feature 만 수정 — cross-feature import 신설 없음. `src/shared/**` 무변.
- **커밋 분할**: C1 common+nav/search → C2 errors/notify/store → C3 chat.toolMeta+transcript → C4 chat.composer+status+rightpanel+approval/ask → C5 skills+projects → C6 engine+backend/update+debug+camera/login → C7 랜딩/부트+잔여 sweep. 각 커밋 게이트 통과.

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **언어 전환 즉시성**: 라벨맵 소비 컴포넌트 전부 `useI18n` 경유 → `changeLanguage` 리렌더에 편승(stale 0). store 에 저장된 에러도 키 저장이므로 전환 시 갱신.
- **미지 값 폴백**: `errorCategoryKey` 미지 카테고리·backend 원문 메시지는 번역 시도 없이 원문 노출(기존 동작 보존).
- **en 혼합 잔존(의도됨)**: `[분기]/[핸드오프]` 제목 마커·backend 원문 에러는 en 에서도 원문 유지 — 비범위 명시.
- **a11y**: aria-label·placeholder·title 도 카탈로그화(0096 관례).
- **plural**: en 1건/複数 구분, ko 는 단일형 — i18next `count` 로 처리, ko 양 접미 동일 값.
- 테마/동시성/멀티세션: 문자열만 변경 — N/A.

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| ko 문자열 이동 중 오탈자·의미 변형 | 카탈로그 값은 복사-이동만(리라이트 금지), 커밋 diff 에서 원문 대조. 인수 기준 3 |
| toolMeta/parts 시그니처 변경 파급 | reducer/store/IPC 무변(라벨 필드 소비자 5곳 전수 추적: ToolGroup·ToolCard·AgentTaskRow·AgentTaskBody·SubAgentTileContent). 인수 기준 6 |
| typed t() 의 plural 접미 해석 불확실 | C3 초입 typecheck 로 확인 — 불가 시 `tr(n===1?k1:kOther)` 헬퍼 폴백(키 구조는 동일) |
| en 초벌 카피 품질 | 기계 초벌 명시 — 사람 확인 대기(0096 동일). 키 패리티만 게이트 |
| ko 양 접미(`_one`=`_other`) 중복 | `typeof ko` 패리티 유지 비용으로 수용(카탈로그 지역 중복, 소비자 영향 0) |

- 되돌리기 어려운 결정: 신규 키 네이밍(위 네임스페이스) — 이후 화면이 이 컨벤션을 상속.
- **단독 결정 금지 항목**: 없음 — 신규 의존성 0, Open Question 접촉 없음. 범위·주체는 사용자 확정(라이브 세션).

## 영향 받는 파일

- 카탈로그: `renderer/src/shared/i18n/resources/{ko,en}.ts`
- shared/ui: `Modal`·`ConfirmDialogHost`(+`confirmDialogStore` 호출부)·`CopyIconButton`·`markdown/CodeBlock`·`RenameInput`·`Notice`
- app 셸: `SearchModal`·`AppLayout`·`router.tsx`·`boot/BootScreen`·`hooks/useCompletionNotifier`·`shared/navigation/routes.ts`
- chat: `lib/{toolMeta,parts,errorLabels}.ts`(+tests) · `store/chatStore.ts`(가독성) · `components/transcript/*` · `components/composer/*`(+tests) · `components/rightpanel/*` · `ApprovalCard`·`AskUserQuestionCard`·`ChatTitleBar`·`Composer`·`StatusLine`
- features: `sessions/{SessionRow,SessionList,ProjectSessionsPanel}` · `skills/components/**` · `projects/components/**` · `engine/**`(+`providerCatalog.test.ts`) · `backend/**` · `update/**` · `debug/**` · `login/**` · `camera/**` · `cost`(잔여)
- pages: `NewChatLandingPage`·`ProjectLandingPage`·`ChatPage`(잔여)
- 문서: 본 핸드오프 + `INDEX.md` + (verify 후) `PHASES.md`

## 참고 문서

- `0096-i18n-ui-locale/{plan,verify}.md` — 인프라·컨벤션 정본(본 작업이 상속)
- `docs/TRD.md` §6.2 N2 · `docs/arch/frontend/layers.md`
- i18next plurals: https://www.i18next.com/translation-function/plurals

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test` (각 구현 커밋마다).
- 신규 테스트 요구: toolMeta 키맵 완전성(VerbCategory 전 카테고리 × verb/verbActive/unit 키가 ko 카탈로그에서 해석 가능). 기존 테스트 수정: `toolMeta`·`parts`·`statusViewModel`·`modes`·`providerCatalog` (한국어 assert → 키/구조 assert).

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 출처(라이브 세션 요청·AskUserQuestion 확정 2건)로 인용했고, 추론은 추론으로 표기했다.
- [x] 자료조사 — 모든 발견에 레퍼런스(`파일:라인`·`@docs/…`·웹 URL)를 붙였다.
- [x] 인수 기준 — 번호 10개, 자료조사에 근거, 검증 가능(게이트·grep·테스트 무수정 통과로 판정).
- [x] 의존 기술 — 신규 의존성 0(i18next 내장 plural), 전제(typed t() plural)는 리스크로 분리.
- [x] 파생 UX — 언어 전환 즉시성·미지 값 폴백·en 혼합 잔존·a11y·plural 을 펼쳤다.
- [x] 리스크 — 트레이드오프·되돌리기 어려운 결정(키 네이밍)을 적었고, Open Question 접촉 없음을 확인했다.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다 (비기능 = Claude 직접).

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: D1(키맵+렌더 해석 표준)·D2(plural 구조화)·D3(마커 불변)·D6(store 키 저장)·D7(datetime 예외)·D8(화이트리스트) 전부 설계대로 구현. typed t() 의 plural 접미 해석(설계 §리스크)은 C3 초입 typecheck 로 **가능 확인** — 폴백 헬퍼 불필요.
- **이견/보완 1 — lineage/EditInstructions 문장 분해**: 설계는 "표시 문구만 카탈로그 이관"이라 했지만, 라벨 강조 span 이 문장 중간에 끼는 문장(LineageBanner·EditInstructionsModal·engine.blurb/envHint)은 before/after 키 분해 시 `resources.test` 의 **빈 값 금지**와 충돌한다(en after=''). react-i18next `Trans` + 카탈로그 태그(`<hl>`/`<mono>`/`<c>`)로 해결 — 신규 라이브러리 아님(기존 react-i18next).
- **이견/보완 2 — UiMessage 판별 유니온**: 설계 D6 의 "키 저장"을 일반화하기 위해 `shared/i18n` 에 `MessageKey`/`UiMessage`/`uiMessageText` 를 신설했다(백엔드 원문 raw 통과와 카탈로그 키 폴백이 한 필드에 흐르는 store 4곳: login/update/agent/useEngines).
- **커밋 매핑 미세 이탈**: UpdateDialog aria '닫기'는 C1 이 아니라 C6(파일 전체 이관 시점)에서, SkillDetail 본문 일부는 C5 에서 처리 — 최종 상태는 설계와 동일.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | `CustomizeList` 의 MCP 그룹 open 상태 키가 한글 라벨 문자열이라 초기 open 맵('active'/'inactive')과 **불일치하던 기존 버그** + 언어 전환 시 상태 리셋 위험 | ✅ 그룹을 `{id,label,items}` 구조로 바꿔 open 상태를 id 로 키잉 | `skills/components/customize/CustomizeList.tsx` |
| 2 | `ToolGroup` 진행 헤더의 `실행 중 에이전트 N개`, `parts.ts` 의 duration/token 라벨 등 조립 문자열의 en 복수형 | ✅ ko 도 `_one/_other` 쌍으로 정의(typeof ko 패리티 유지) + `formatDurationLabel/formatTokenLabel(tr, …)` 헬퍼 | `toolMeta.ts` · `resources/{ko,en}.ts` |
| 3 | `Markdown.tsx` 차단 이미지 플레이스홀더 `[이미지: …]` — 인벤토리 미포착 | ✅ `markdown.imagePlaceholder` 키 + `BlockedImagePlaceholder` 컴포넌트 분리 | `shared/ui/markdown/Markdown.tsx` |
| 4 | `SidebarUserButton` 의 `'한국어 (대한민국)'` 언어 자기표기 | ⚠️ 보고만 — 언어명은 자기 언어로 표기하는 0096 관례 유지(번역 비대상). 이견 시 사용자 결정 | `app/SidebarUserButton.tsx:14` |
| 5 | en 사용자에게 `[분기]/[핸드오프]` 제목 마커·backend 원문 에러가 한글/원문으로 잔존 | ⚠️ 보고만 — D3/D8 설계 확정 사항(main locale 인지 필요, 후속) | 설계 §D3·§범위/비범위 |

## [구현자 기입] 구현 체크리스트

- [x] C1 common 확장 + 기존 키 재사용 + nav/search (`899bb45`)
- [x] C2 errors + notify + store 폴백 (`dd6c626`)
- [x] C3 chat.toolMeta + chat.transcript (`67d8170`)
- [x] C4 chat.composer + status + rightpanel + approval/ask (`3f419fd`)
- [x] C5 skills + projects (`1febece`)
- [x] C6 engine + backend/update + debug + camera/login (`57a92d0`)
- [x] C7 랜딩/부트 + 잔여 sweep (grep 전수 대조) (`d61867c`)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 카탈로그 2(ko/en, ~70→400+ 리프 키) · renderer 컴포넌트/모듈 ~80 파일 · 수정 테스트 5(toolMeta·parts·statusViewModel·modes·providerCatalog) · `shared/i18n/index.ts`(MessageKey/UiMessage) |
| 실행 명령 | `cd app && npm run lint && npm run typecheck && npm test` (각 커밋마다) |
| 게이트 결과 | lint ✅ 0 / typecheck 3종 ✅ 0 / vitest **821/821**(+3: toolMeta 키맵·구조) / scripts 24/24 ✅ — 실패 2 suite 는 electron 바이너리 403 환경 제한(0092~0096 동일 베이스라인) |
| 블로커 / 역질문 | 없음 (⚠️ 2건은 위 표 — 결정 불요 항목) |
| 대상 커밋 | `899bb45`~`d61867c` (C1~C7, 7 커밋) |
