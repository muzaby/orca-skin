# Verify — 0228-landing-mode-memory-and-edit-diff-rendering

## 메타

| 항목 | 값 |
|---|---|
| slug | `0228-landing-mode-memory-and-edit-diff-rendering` |
| 검증자 | Claude Code |
| 일자 | 2026-09-11 |
| 대상 커밋/range | `9bb59e8..5259ede` |
| 구현 전 plan 기준 | `9bb59e8` |
| V mode / 유효 V | `Baseline V: V1` |
| 검증 기준 plan revision | `9bb59e8:V1` |
| 라운드 | 1 |
| 상태 | **PASS** |
| 자기 검증 여부 | 설계·구현·검증이 동일 에이전트다 — §4에 구현 보고가 이름을 대지 않은 적대 축 4건(A·B·C·D)을 추가했다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — **추가 103줄, 삭제 0줄**(`git diff 9bb59e8..5259ede -- .../plan.md | grep "^-"` → 0건). 전부 `[구현자 기입]` 섹션이다.
- 기준선이 diff로 성립하는가: **예** — 설계 커밋 `9bb59e8`과 구현 커밋 `5259ede`가 분리돼 있다.
- Decision Ledger 변경: 없음(삭제 0줄).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음 — §7 표 13행이 `9bb59e8` 원문 그대로다.
- V node/pair·requiredness·§10·oracle 변경: 없음.
- 채점에 사용할 원 기준: `9bb59e8`의 AC1~AC13 · VP-01~VP-11 · EP-01~EP-06.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 상속할 명시 V 없음 → Baseline V. 0204·0211 은 V 이전 형식이라 상속 대상이 아니다 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R 4 · SD 2 · AR 3 · MD 2 = 11 node, pair 11건 전부 REQUIRED |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | Baseline V 라 INHERITED node 0 — 해당 없음 |
| pair별 path·§10 전수·직접 oracle | 유효 | 11행 모두 `start → edges → end`·EP 번호·oracle 보유 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | VP-04·VP-08 둘만 `required`이고 이유가 적혀 있다. 나머지 9건은 직접 산출 관측이라 근거가 타당하다 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 4종 열거(subtree 정적·순수 테스트·문서 인벤토리·trailer). DB ABI 기존 실패를 blocking 으로 올리지 않았다 |

- V 도입 전 plan 여부: 해당 없음.
- root PLAN_GAP과 영향 pair: **없음**.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 토글 선택만 기억 | 잠긴 대화의 클릭은 영속되지 않는다 | `AgentModeToggle.onClick` → `chatActions.setAgentKind`(`chatStore.ts:1136`) → 수용 확인 후 `settingsApi.set` |
| D-002 첫 실행 `work` | 저장값 없음/손상 → `work` | `SettingsSchema.lastAgentKind`(`protocol.ts:657`, catch+default) |
| D-004 부트 완료 전 시드 | 히어로 토글이 잘못된 종류로 뜨지 않는다 | `bootStore.ts:60` `createBootSteps()` → `landing-target`(mandatory) → `applyLandingAgentKind` → `seedLandingAgentKind` |
| D-005 `DEFAULT_AGENT_KIND` 불변 | 과거 세션 해석 변화 0 | `agent-kind.ts:5` 값 `'code'` 유지, 새 상수는 별도 |
| D-006·D-007 패치 정본·투영 | 카드가 실제 줄번호를 그리고 `originalFile` 은 영속되지 않는다 | `claude-map.ts:576-585` → `writer.ts:396` → `parts.resultMap` → `DiffBody.tsx:45` |
| D-009 `Write` 제외 | Write 카드는 종전대로 1번 줄부터 | `carriesFileEditPatch`(`file-edit-tool.ts:30`) |
| D-011 패널과 같은 문법 경로 | 새 하이라이터 0 | `DiffTable.tsx:21` `useDiffSyntax` — 패널과 같은 훅 |
| D-012 3열 계약 유지 | 줄번호·거터·본문 | `DiffTable.tsx` `<colgroup>` 3열 유지 |
| D-013 Work 본문 불변 | Work 모드 카드 변화 0 | `WorkToolBody.tsx:44` `taskTool &&` 선행 조건이 편집 결과를 차단 |

### end-to-end 흐름

```text
[앱 시작] → runBoot → landing-target(mandatory) → seedLandingAgentKind
  → freshEntry/기존 초안의 agentKind → AgentModeToggle 활성 버튼
[Edit 실행] → SDK tool_use_result → claude-map 투영 {structuredPatch}
  → HistoryWriter JSON 영속 · 라이브 이벤트 → resultMap → DiffBody
  → DiffTable(실제 줄번호 + shiki 토큰)  ↘ 패치 없음/형상 불일치 → 입력 쌍 폴백
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 안전 | 패치 부재·형상 불일치·언어 미지원 모두 **변경 전과 동일한 카드**로 떨어진다 |
| false success 가능성 | 없음 | `readFileEditStructuredPatch` 가 hunk 자기정합(`removed+common===oldLines`)까지 보고 `null` 을 낸다 |
| partial failure/rollback | 해당 없음 | 새 저장소 쓰기가 없다. 설정 쓰기는 fire-and-forget 이고 실패해도 화면 상태는 유지된다 |
| Product/UX의 A가 아닌 다른 B | 아니오 | 사용자 기대 출력(`46 - async function animate…`)을 렌더 테이블 문자열로 직접 단언한다 |
| 증상만 제거하고 상태가 남았는가 | 해당 없음 | 제거한 증상이 없다 |
| 최적화가 잃은 관측 | 없음 | `useDiffSyntax` 의 stale 판정(lines·filePath·theme 동시 저장)을 그대로 승계했다 |
| 출력/요청 worst-case 상한 | 계산됨 | 편집 1건당 (변경 줄 + hunk 문맥). `originalFile`·`gitDiff` 제외를 직렬화 동등으로 잠갔다(§4 M-strict1) |
| **`settingsApi.set` 실패 시** | 허용 | `void` 라 조용히 버려진다 — 다음 선택이 다시 쓴다. Part I §13 이 명시한 동작이다 |
| **부트 설정 읽기 실패 시** | 기존 동작 승계 | `landing-target` 은 이전에도 mandatory 였고 `getLastSessionId` 가 같은 `settingsApi.get` 을 쓴다 — 실패 표면이 늘지 않는다 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 9bb59e8..5259ede
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `isFileEditToolName` (테스트 참조 4 · 프로덕션 0) | **죽은 export** | 비귀속 — 소비자(`toolMeta.FILE_EDIT_TOOLS`)는 Set 을 쓴다. D1 `NON_BLOCKING` |
| `FileEditToolName` (프로덕션 0) | 죽은 export | 위와 한 쌍 — D1 에 함께 적는다 |
| `FileEditPatchHunk` (프로덕션 0) | 정상 | 모듈 내부에서 반환/인자 타입으로 쓰이고 호출부는 추론으로 받는다 |
| `FILE_EDIT_TOOL_NAMES` (프로덕션 0) | 정상 | `FILE_EDIT_TOOL_NAME_SET` 의 리터럴 SSOT — 같은 파일이 소비한다 |
| `defaultBootDependencies`·`NEW_CHAT_KEY`·`ingestChatEvent` 등 | 오탐 | 스크립트가 자인한 배럴 re-export·기본 인자 오탐이며 이번 변경이 만든 것이 아니다 |
| 형제 정책 비대칭 | 없음 | 스캔 결과 `(없음)` |
| 신규 등록값의 기존 소비처 영향 | 무영향 | 아래 표 |
| producer ↔ consumer 파생 불일치 | 1건(비귀속) | 카드 헤더 `+N -M` 은 여전히 입력 쌍으로 센다 — D2 `NON_BLOCKING` |
| 동일 규칙 중복 구현 | SSOT 유지 | 축 C 재열거 참조 |

**`structuredOutput` 확장의 기존 소비처 재검증** (전수 4):

| 소비처 | 재검증 결과 |
|---|---|
| `chatReducer.ts:1876` `markCompletedAgentTask` | 무영향 — `ev.structuredOutput !== undefined` 통과 후 `call.toolName !== 'TaskUpdate'` 에서 반환. 비용은 역탐색 1회 |
| `WorkToolBody.tsx:44` | 무영향 — `taskTool &&` 가 선행이라 편집 결과가 들어오지 않는다 |
| `taskBoard.ts:173` | 무영향 — `isTaskToolName(part.toolName)` 로 먼저 거른다 |
| `writer.ts:396` | 의도된 영향 — 편집 결과 파트가 필드 1개를 더 갖는다(AC13 이 왕복을 잠근다) |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: `registry.test.ts:19` `'Write/Edit/MultiEdit → diff'` · `toolMeta.test.ts:74` · `diffSyntax.render.test.ts` 2케이스 — 전건 실재하고 이번 실행에서 통과.
- 핵심 입력/분기 실제 실행: 패치 경로·폴백 경로·형상 불일치 경로 3분기가 각각 다른 케이스로 실행된다.
- structural proxy만으로 semantic 목표를 통과시킨 AC: 없음 — AC6·AC7 은 렌더된 표의 거터 숫자와 본문 문자열을 본다.
- **선택된 적대 증거 재측정**: 등록 변이 2 + 새 oracle 민감도 3 + 형제 스왑 1 = 6건 중 **검출 6 · 미검출 0**. 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1 이라 대상 없음.
- **자기검증 분모**: 구현자 = 검증자 → 보고에 없던 축 **4건**(A·B·C·D)을 추가했고 전부 판정을 바꾸지 않았다.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 `diffSyntaxText.tsx:15` 토큰 무시 | DiffBody + 패널 렌더 스위트 | 미실행 | **red** 3케이스 | `VP-04 등록 변이` |
| M2 `DiffTable.tsx:59` old↔new 맞바꿈 | DiffBody 렌더 | 미실행 | **red** 1케이스 | 형제 슬롯 맞바꿈 |
| M3 `claude-map.ts` 투영 제거 | 어댑터 | 미실행 | **red** 1케이스 | `VP-08 등록 변이` |
| M4 `file-edit-tool.ts` 줄 수 검증 제거 | shared+어댑터+렌더 | 미실행 | **red** 3케이스 | EP-05 감도 |
| M5 `diffSyntaxText.tsx` 토큰 없이 span | DiffBody 렌더 | 미실행 | **red** 1케이스 | 0건 스윕 oracle(AC9) |
| M6 `steps.ts` 시드 호출 제거 | 부트 | 미실행 | **red** 1케이스 | 배선 존재 oracle |
| **축 A**(검증자 추가) `DiffBody.tsx:45` 렌더 지점만 제거 | DiffBody 렌더 | — | **red** 3케이스 | EP-05 **형제 지점** — 구현 보고는 공유 리더만 심었다 |
| **축 B**(검증자 추가) `freshEntry` 가 랜딩 캐시 무시 | chatStore | — | **red** 1케이스 | EP-02 **형제 지점** — 보고는 시드 함수 축만 이름을 댔다 |

- 동작 보존 추출 라운드인가: 부분적 — `syntaxText` 이설이 그렇다. 그 hunk 되돌림은 판정 근거로 쓰지 않았고, 대신 M1 이 **구 장치(`diffSyntax.render.test.ts`)까지 red** 로 만드는지 확인해 하한 보존을 봤다.
- 소거 변이의 잔여물 수렴: 해당 없음 — 여섯 변이 모두 단언 실패로 red 이고 타입/lint 잔여물에 기대지 않았다.
- 형제 슬롯 맞바꿈 변이: 1슬롯쌍(`old`/`new`) 맞바꿔 검출 1.
- **축 C**(검증자 추가, 분모 독립 재열거) — EP-06 의 분모를 해법 이름(`syntaxText`)이 아니라 **불변식의 주어**("토큰 색을 노드로 바꾸는 코드")로 다시 셌다: `rg "token.color|ThemedToken" src/renderer --glob '!*.test.*'` → 6건, 그중 **노드를 만드는 곳은 `diffSyntaxText.tsx:23` 하나**(나머지는 토큰 생산·타입). 중복 구현 0.
- **축 D**(검증자 추가, 라벨 진위) — `carriesFileEditPatch` 라벨이 참인지 SDK 원문으로 확인: `structuredPatch` 를 갖는 Output 은 `FileEditOutput`·`FileWriteOutput` **2종**이고(`awk` 로 전수), `Write` 제외는 D-009 의 명시 결정이다. `NotebookEdit` 은 `structuredPatch` 가 없고 diff 레지스트리에도 없어 누락 지점이 아니다.
- `N회` 기준의 실제 관측 주체: AC3 의 "1회"는 `settingsSet` mock 호출 인자에서 관측한다 — `settingsApi.set` 프로덕션 호출부 3건 중 이번에 추가된 1항만 단언 범위다.
- 순서 기준의 관측 훅: AC3 의 부트 순서는 `createBootSteps(deps)` 스텝 배열과 `mandatory` 플래그에서 관측한다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-10 | MD-01 ↔ UT-01 / UT | REQUIRED | **PASS** | `file-edit-tool.test.ts` 7케이스 · M4 red | 리더/변환 순수 함수 / EP-05 2/2 |
| VP-11 | MD-02 ↔ UT-02 / UT | REQUIRED | **PASS** | 잠긴 엔트리 `agentKind` 불변 · 축 B red | `seedLandingAgentKind` / EP-02 2/2 |
| VP-07 | AR-01 ↔ IT-01 / IT | REQUIRED | **PASS** | `parse({})`·`parse({bogus})` → `work`; `mergeSettings` spread 로 병합 확인 | `settingsApi.set → SettingsPatchSchema → patch` / EP-03 2/2 |
| VP-08 | AR-02 ↔ IT-02 / IT | REQUIRED | **PASS** | 키 집합 동등 + 직렬화 동등(엄격화) · M3 red | `tool_use → ctx 집합 → tool_result 투영` / EP-04 1/1 |
| VP-09 | AR-03 ↔ IT-03 / IT | REQUIRED | **PASS** | 두 소비자가 같은 모듈 import · 패널 기존 2케이스 통과 · 축 C 재열거 | `FileDiffSection`·`DiffTable` → `diffSyntaxText` / EP-06 2/2 |
| VP-05 | SD-01 ↔ ST-01 / ST | REQUIRED | **PASS** | `landing-target.mandatory === true` + 시드 1회 · M6 red | `runBoot → createBootSteps → AppLayout` / EP-02 |
| VP-06 | SD-02 ↔ ST-02 / ST | REQUIRED | **PASS** | 영속 JSON 왕복 후 같은 hunk·두 축 | `claude-map → 파트 JSON → resultMap → DiffBody` / EP-05 |
| VP-01 | R-01 ↔ AT-03·04 / AT | REQUIRED | **PASS** | `toHaveBeenCalledExactlyOnceWith({lastAgentKind:'work'})`, 잠금 시 미호출 | 토글 → 스토어 → 설정 / EP-01 1/1 |
| VP-02 | R-02 ↔ AT-01·02·05 / AT | REQUIRED | **PASS** | 시드 전 `work`, 시드 후 `code`, 손상값 복구 | 부트 → 스토어 → 토글 / EP-02·EP-03 |
| VP-03 | R-03 ↔ AT-06·07·10·13 / AT | REQUIRED | **PASS** | 거터 `45·46·46` · 본문 전체 줄 · 폴백 3케이스 · 왕복 1케이스 · 축 A red | 어댑터 → 영속 → 카드 / EP-04·EP-05 |
| VP-04 | R-04 ↔ AT-08·09 / AT | REQUIRED | **PASS** | `color:#112233`/`#445566`, 토큰 없으면 `[style]` 0개(엄격화) · M1·M2 red | 카드 → `useDiffSyntax` → `syntaxText` / EP-06 |

- root `PAIR_FAIL`: 없음. 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair: `DiffBody.render.test.ts` 의 패치 케이스가 VP-03(줄번호)과 VP-04(색)를 함께 지난다 — 두 행의 판정 범위는 각각 거터/본문 문자열과 `span[style]` 로 분리했다.
- 이번 라운드 실행 범위: 최초 검증 — 유효 V의 REQUIRED 11건 전건 + 운영 gate 4종.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | 지난 선택으로 랜딩이 열린다 | ✅ | `시드는 미전송 초안만 바꾸고…` 시드 후 `code` | 부트 → 초안 → 토글 |
| AT-02 / AC2 | 저장값 없으면 `work` | ✅ | `시드 전 새-채팅 초안은 work 다` + 스키마 기본값 | 모듈 초기 상태 → 토글 |
| AT-03 / AC3 | 선택이 설정에 기록된다 | ✅ | `settingsSet` 1회 `{lastAgentKind:'work'}` | 토글 → 설정 |
| AT-04 / AC4 | 잠긴 종류는 불변 | ✅ | 잠긴 하네스에서 `agentKind` 유지 + `settingsSet` 미호출 | 같은 경로 |
| AT-05 / AC5 | 손상값이 부팅을 막지 않는다 | ✅ | `parse({lastAgentKind:'bogus'}) → 'work'`; `migrateRawSettings` 가 같은 스키마를 쓴다 | 설정 로드 |
| AT-06 / AC6 | 실제 파일 줄번호 | ✅ | 거터 `['45','46','46']`, `'1'` 아님 | 어댑터 → 카드 |
| AT-07 / AC7 | 줄 전체 본문 | ✅ | `-` 행 본문 = `async function animate(): Promise<void> {` | 같은 경로 |
| AT-08 / AC8 | 언어별 색 | ✅ | `style="color:#112233"`/`#445566`, 텍스트 원문 보존 | 카드 → shiki |
| AT-09 / AC9 | 토큰 없어도 동일 구조 | ✅ | `td [style]` 0개(엄격화 재측정), 행 수·본문 동일 | 같은 경로 |
| AT-10 / AC10 | 패치 없으면 폴백 | ✅ | Edit 폴백 `['1','1']` · Write 2행 · MultiEdit 표 2개 | 카드 폴백 분기 |
| AT-11 / AC11 | 투영만 싣는다 | ✅ | 키 집합 `['structuredPatch']` + 직렬화 동등 | 어댑터 |
| AT-12 / AC12 | 어긋난 패치 거부 | ✅ | 리더 `null` 3형 · 어댑터 미탑재 · 카드 폴백 | 두 지점 |
| AT-13 / AC13 | 재로드 후 같은 줄번호 | ✅ | JSON 왕복 후 `[[45,45],[46,null],[null,46]]` | 영속 → `resultMap` → 카드 |

- **합계 재측정**: `✅ 13 · ⚠️ 0 · ❌ 0 = 총 13` — §7 표의 AT 행을 직접 세어 분모 13. 자기보고 `13/13` 과 일치.
- **합계 사본 대조**: 본문 13 ↔ 커밋 trailer `Criteria-Met: 13/13`(`git log -1 --format='%(trailers:only=true)' 5259ede`) ↔ INDEX 비고 `AC 13/13` — **일치**.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-01 | 수용된 선택만 영속 | 토글 클릭 (1) | `chatStore.ts:1141` 1/1 — `rg "lastAgentKind"` 프로덕션 5건 중 쓰기 1건 | PASS |
| VP-02·05·11 | 미전송·비잠금 초안만 시드 | 시드·신규 초안 (2) | `chatStore.ts:170`·`:180` 2/2 — 축 B 가 두 번째 지점을 독립으로 red 화 | PASS |
| VP-02·07 | 설정 열거·기본·복구 | 읽기·쓰기 (2) | `protocol.ts:657`·`:696` 2/2 — 세 번째 후보(`settings-migration`)는 `SettingsSchema.parse({})` 에서 키를 파생해 별도 지점이 아님 | PASS |
| VP-08 | 투영만 싣는다 | tool_result 매핑 (1) | `claude-map.ts:585` 1/1 | PASS |
| VP-03·06·10 | hunk 줄 수 정합 | 투영·렌더 (2) | `claude-map.ts:580`·`DiffBody.tsx:45` 2/2 — 축 A 가 렌더 지점을 독립으로 red 화 | PASS |
| VP-04·09 | 토큰→노드 SSOT | 두 소비자 렌더 (2) | `DiffTable.tsx:59`·`FileDiffSection.tsx:471·475·480·482` 2/2 — 축 C 가 분모를 불변식 주어로 재열거 | PASS |

- 전수 합계 **10/10** — 구현자 보고와 같은 값이나 축 A·B·C 로 독립 재측정했다.
- 표에 없는데 같은 불변식이 필요한 지점: 없음.
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| subtree 정적(`lint`+`typecheck`) | main·shared·renderer 를 모두 고쳤다 | **PASS** | typecheck `error TS` **0건**(3구성) · lint **0 error / 1 warning**(`useTranscriptVirtualizer.ts:22`, 변경 무관 기존 항목) |
| subtree 순수 테스트(`vitest run`) | 순수 변환기·렌더·스토어를 추가했다 | **PASS** | **483파일 4496케이스 — 4307 pass · 173 fail · 16 skip**. 실패 30파일은 기준선과 **동일 집합**(`diff base.txt after2.txt` → 0줄) |
| repository 문서 인벤토리 | `docs/` 를 고쳤고 settings 키가 늘었다 | **PASS** | `generated doc ok (9 items, 92 channels)` · `prose ok` · `links ok` — settings 키 18→19 재생성 반영 |
| message-bus trailer | 설계·구현 커밋 2건 | **PASS** | 두 커밋 모두 `%(trailers:only=true)` 가 적은 키를 그대로 반환 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| SDK `FileEditOutput.structuredPatch` | `sdk-tools.d.ts:3045` 필드 형태와 리더의 좁힘이 일치 | `sdk.d.ts` SDKUserMessage 가 "render from it instead of parsing the tool_result text" 로 규정 — 채택 방향이 문서와 일치 | PASS |
| `docs/IPC_CONTRACT.md` `Settings` | `lastAgentKind: AgentKind` 행 추가 — `ipc.ts:1044` 와 일치 | 기본·복구값 서술이 스키마와 일치 | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 소비처 재측정: `structuredOutput` 프로덕션 소비처 4건(§3 표) · `syntaxText` 소비 2파일 · `readFileEditStructuredPatch` 호출 2건 — 전부 재측정값.
- 내역 합 = 총계: 강제 지점 `1+2+2+1+2+2 = 10` = 보고 합계 10.
- 0건 게이트의 정당한 예외 보존: AC11 의 `originalFile` 부재 스윕을 **직렬화 전체 동등**으로 엄격화해 재측정 → 차집합 0. AC9 의 `span` 0개를 **`[style]` 속성을 가진 모든 요소**로 엄격화 → 차집합 0.
- 총량 임계의 형태 분해: 해당 없음 — 총량 AC 가 없다.
- 출력 상한 재계산: 편집 결과 파트 증가분 = hunk 문맥 줄. `originalFile`(파일 전체)·`gitDiff.patch` 는 직렬화 동등으로 배제 확인.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| 편집 카드 색 **값**의 시각 품질 | 색 **부착 여부**와 원문 보존을 `span[style]` 로 단언 | 없음 — 색 값의 출처가 우측 패널과 같은 shiki 테마라 새 시각 판단이 없다 | — |
| 실제 Claude CLI 의 `tool_use_result` 도착 | 형태 계약을 SDK 타입과 리더로 잠갔다 | **실기 1건** — 실제 `Edit` 실행에서 카드가 실제 줄번호를 보이는지 | 앱에서 Code 대화로 파일 1줄 편집 → 카드 펼침 |

## 9. 게이트 재실행

- 실제 실행 명령: `cd app && npm run typecheck` · `npm run lint` · `./node_modules/.bin/vitest run` · `node scripts/check-doc-inventory.mjs --check`.
- **관측한 실행 산출**: typecheck `error TS` 0건 · lint `✖ 1 problem (0 errors, 1 warning)` · vitest 483파일/4496케이스(4307 pass·173 fail·16 skip) · 문서 게이트 3줄 모두 ok.
- `npm test` 사용 여부: **쓰지 않았다** — DB 동작을 검증할 필요가 없고 `pretest` 가 ABI 를 Node 로 뒤집는다(`app/AGENTS.md`).
- 환경 기인 실패 분리 근거: 실패 30파일의 오류 원문이 3종뿐이다 — `Module did not self-register: …better_sqlite3.node` · `Electron failed to install correctly` · `Cannot read properties of undefined (reading 'close')`(DB 미생성 teardown 파생). 기준선(stash) 실행의 실패 파일 집합과 **차집합 0**이고 실패 케이스 수도 173 으로 같다.
- 게이트가 작업 트리를 바꿨는가: **없음** — `npm run lint`(`--fix`) 실행 후 `git status --short` 0줄.
- 검증 중 실행한 명령이 남긴 잔여물: **없음** — 엄격화 재측정용 임시 테스트 파일을 실행 직후 삭제하고 `git status` 로 0줄 확인. 여섯 변이와 검증자 축 2건도 백업본으로 원복 후 0줄 확인.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 증거 | — | 완료 |
| AC ↔ production path | 13행 1:1 대조 | — | 완료 |
| 레이어/계약/문서 링크 | boundaries lint + 문서 게이트 | — | 완료 |
| AGENTS 위생 | 해당 없음(변경 0) | — | 해당 없음 |
| 제품 의도 | — | **결정** | D2(헤더 카운트) 처리 방향 |
| 실제 CLI 결과 형태 | SDK 타입으로 잠금 | **실기 1건** | §8 |
| PR merge | — | **승인** | 대기 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

해당 없음 — `AGENTS.md` 변경 0건.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋 일치: 이번 검증으로 `verify/PASS` · 다음 주체 `사람`(실기 1건 + merge) 으로 갱신.
- 「다음 주체」 칸이 주체 하나만 담는가: 예.
- 대상 커밋 좌표 기입: `9bb59e8`(설계)·`5259ede`(r1) — `git cat-file -t` 둘 다 `commit`.
- 비고 5줄 이내: 예.
- PASS 시 archive 이동: **하지 않는다** — 사람 실기 1건이 남아 보드에 둔다(0225·0226 선례와 동형).

### Commit / reference 정합성

- trailer 허용값: 설계 `Agent: claude`·`Status: designed`, 구현 `Agent: claude`·`Status: implemented`·`Criteria-Met: 13/13`·`Verified-By: pending` — 전부 root `AGENTS.md` 표의 허용값.
- trailer 실제 파싱: 두 커밋 모두 `git log -1 --format='%(trailers:only=true)'` 가 적은 키를 그대로 반환(설계 5키·구현 6키).
- 인용된 커밋 해시 실재: `git cat-file -t 9bb59e8`·`5259ede` → `commit`.
- `[구현자 기입]` 7필드 전수: 설계 리뷰 · 강제 지점 전수 · 이번 라운드 수정의 잠금 · Product/UX 파생 검토 · 놓친 잠재 문제 · 구현 보고 · Review Signals = **7/7**, 산문으로 접힌 필드 0.
- 이동한 reference: `syntaxText` 이설 — 소비처 2곳이 새 경로를 import 하고 구 경로 참조 0건.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| 검증 위치를 `fileEditPatchLines` → `readFileEditStructuredPatch` 로 옮긴 차이 | **타당 + 실측 확인** — 공유 축 주장이 사실이다. 축 A 로 렌더 지점을, M3·M4 로 투영 지점을 각각 독립 red 화해 두 지점 모두 잠겼음을 확인했다 | 유지 |
| 잠재 문제 1(부트 의존 스텁) 선조치 | 타당 — 구현 세부다 | 유지 |
| 잠재 문제 2(UUID 패리티 스텁) 선조치 | 타당하나 근본 해결은 미이관 | D3 `NEXT_HANDOFF` 로 기록 |
| 잠재 문제 3(헤더 카운트) 보고만 | 타당 — 사용자가 보는 수치가 달라지는 제품 판단이다 | D2 `NON_BLOCKING` |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | `isFileEditToolName`·`FileEditToolName` 이 프로덕션 참조 0 — 소비자는 `FILE_EDIT_TOOL_NAME_SET` 만 쓴다 | 비귀속(현재 pair·AC·gate 어디에도 없음) | NON_BLOCKING | — | 다음 구현 턴 또는 정리 핸드오프에서 제거 |
| D2 | 카드 헤더 `+N -M`(`toolMeta.toolDiffStat`)은 입력 쌍으로 세고 본문은 패치로 그린다 — `replace_all` 다중 치환에서 두 수가 갈린다 | 비귀속(§6 비범위) | NON_BLOCKING | — | 사용자 결정 필요(헤더도 패치 기준으로 셀지) |
| D3 | `chatStore.test.ts` 의 `mockDraftIds` 가 `crypto.randomUUID` 호출 패리티에 결합 — 종류 기본값·우측 타일 정책이 바뀌면 다시 깨진다 | 비귀속 | NEXT_HANDOFF | — | 스텁을 draft-key 소비 순서 기준으로 바꾸는 별도 작업 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 없음 — r1 이다.
- 관련 plan 지침/AC의 존재 여부: D1·D3 을 막았을 지침은 없다. plan §12 의 "기존 소비처 전수" 표가 프로덕션 소비처만 세고 **테스트 픽스처**를 세지 않아 잠재 문제 1·2 가 구현 중에야 드러났다.
- 사용자 결정 변경 근거: 없음.
- 반복된 검증 환경 한계: better-sqlite3 Electron ABI 미빌드로 DB 로드 스위트 30파일이 red. `app/AGENTS.md` 가 적은 "실측 5파일(0180)" 보다 크므로 그 문서의 수치가 낡았다(이번 실측 30).

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED PASS **11** · root PAIR_FAIL 0 · BLOCKED_BY 0
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: D-001~D-013 전건 충족 — §1 표에 production path 를 1:1로 적었다
- AC 충족: **13/13**(자기보고와 일치, 분모 재측정 13)
- 현재 변경 운영 gate: 4종 전건 PASS
- NON_BLOCKING / NEXT_HANDOFF: D1·D2(NON_BLOCKING) · D3(NEXT_HANDOFF)
- repository operation checks: INDEX·trailer·reference 전건 정합
- 남은 사람 확인: 실기 1건(실제 `Edit` 실행에서 카드 줄번호) · D2 제품 결정 · PR merge
- 다음 단계: 보드는 `verify/PASS`·다음 주체 `사람`. 실기와 merge 후 archive 로 옮긴다
