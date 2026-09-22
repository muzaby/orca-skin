# Verify — 0238-fable-plugin-composer-auth-ui

## 메타

| 항목 | 값 |
|---|---|
| slug | `0238-fable-plugin-composer-auth-ui` |
| 검증자 | Claude Code |
| 일자 | 2026-09-22 |
| 대상 커밋/range | `6200cf1..569d2c8` — r1 `6f40c8b`·`0d9174c`·`f31c068`, r2 `569d2c8` |
| 구현 전 plan 기준 | V1 `6200cf1` · ΔV1 `ee15ca9` |
| V mode / 유효 V | `Delta V` / `V1@6200cf1 + ΔV1@ee15ca9` (plan 메타의 `V1@651d9080`은 죽은 좌표 — D13) |
| 검증 기준 plan revision | `6200cf1:V1` / `ee15ca9:ΔV1` |
| 라운드 | 2 (첫 검증 — r1은 검증 없이 ΔV1로 이어짐) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 아니오 — 설계·구현 trailer `Agent: codex`, 검증 Claude |

## 0. 기준선 / plan 변경 확인

- **기준선 성립: 예.** 설계 커밋(`6200cf1`·`ee15ca9`)과 구현 커밋이 갈린다.
- 구현 커밋의 `plan.md` 변경: r1 `6f40c8b`·`f31c068` = 메타 상태·§13 한 줄 문구(“READY”→“상태”)·`[구현자 기입]`만. r2 `569d2c8` = `[구현자 기입]`만(`git diff ee15ca9 569d2c8 -- plan.md` hunk 1개, 923행 이후).
- Decision Ledger·Product/UX·AC·V node/pair·§10 변경: **없음**. D-005→D-017, D-007→D-014 SUPERSEDE는 설계 커밋 `ee15ca9`의 사용자 변경 4건에 근거한다.
- 채점 기준: V1 AC1~AC18(AC7은 AC23이 대체) + ΔV1 AC19~AC25 = **24건**.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V mode·상속 기준 | 유효 | 기준 V가 한 revision뿐이라 `6200cf1`로 재구성 가능. 좌표 표기 오류는 D13 |
| NEW/CHANGED node ↔ REQUIRED pair | 유효 | R-05~07·SD-04/05·AR-04·MD-05~07 → VP-15~23 |
| 영향받은 INHERITED ↔ REGRESSION | 유효 | R-08(V1 R-02~04 계승)→VP-24, V1 R-03→VP-25 |
| pair별 path·§10·oracle | 유효 | 모든 pair에 EP 분모와 oracle 명시 |
| 선택적 적대 증거 | 유효 | 순서·재진입·분류·callback 축에만 선택 |
| 운영 gate | 유효 | lint·typecheck·direct vitest·doc inventory·diff check |

- root PLAN_GAP: **없음**. 아래 결함은 모두 명시 계약 또는 등록 oracle 위반이다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision | 기대 결과 | 실제 production path | 판정 |
|---|---|---|---|
| D-001~004 | settings/env/availableModels Fable → 두 UI | `model-parser.ts:24-35` → `models.ts` → ModelMenu·EngineModelList | ✅ |
| D-006 | `@id ` raw 삽입 | `mentionAutocomplete.ts:95-98` | ✅ |
| D-008 | status 무관 후보, provider 실패 시 path 유지 | `useMentionAutocomplete.ts:48-64` | ✅ (probe AC10a/b) |
| D-009~011 | 인증/재인증﹀/danger 연결 해제, close 후 callback | `ProviderAuthActions.tsx:36-86` | ✅ 동작 · ❌ oracle (D5) |
| D-014 | path→Plugin 순서 | `mentionAutocomplete.ts:66-81` + `MentionAutocomplete.tsx:40` | ✅ 동작 · ❌ render oracle (D6) |
| D-015 | token null = occurrence 종료, 새 `@` 재오픈 | `useTokenAutocompleteState.ts:22-66` | ✅ 재오픈 · ❌ **Esc 재개 후 dismissal 부활 (D1)** |
| D-016·018·020 | 네 category optional catalog, fallback 유지 | `connections.ts:66-103` → `connection-views.ts:80` → `providerPresentation.ts` | ✅ |
| D-017 | 후보=`tools.length>0` | `pluginMention.ts:22` · `useMentionAutocomplete.ts:127` | ✅ 동작 · ❌ valid-id oracle (D8) |
| D-019·021 | Provider 정본 + Plugin alias, 신규 IPC 0 | `provider-catalog.ts`·`plugin-catalog.ts`·`pluginPresentation.ts` | ✅ |

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| 실환경 실패 방식 | ❌ | Esc→계속 입력→↓/hover 시 팝업이 다시 닫힌다. `setActiveIndex`가 `partial`만 갱신하고 `dismissed:true`를 남긴다(`useTokenAutocompleteState.ts:56-59`). `/` skill도 같은 상태 머신이라 함께 깨진다 (D1) |
| false success | ❌ | 결과 0건이면 빈 path 그룹 header만 보이고 `일치하는 항목 없음`이 사라진다 (D2) |
| Product/UX의 A 대신 B | ❌ | 유효 경로 `@jira-dc/notes.md`가 path chip 대신 `@jira-dc` Plugin chip으로 칠해진다 (D3) |
| partial failure/rollback | 해당 없음 | 저장소 쓰기·IPC 신설 0 |
| 최적화가 잃은 관측 | 없음 | provider 구독은 active일 때만, keystroke당 provider IPC 0 (`useMentionAutocomplete.ts:48-64`) |
| worst-case 상한 | 유지 | option = P + min(F,8) (`filterFileSuggestions` slice 8) |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 6200cf1..569d2c8` — 28파일.

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| `useFileAutocomplete`·`FileAutocomplete.tsx` | 죽은 코드 | production 참조 0(`rg` — 정의·테스트·주석만). plan §18은 “대체”였고 구현 보고의 “legacy caller 회귀” 근거는 caller 0으로 성립하지 않는다. AC20 repo oracle이 이 죽은 hook 위에만 있다 (D11) |
| `mentionGroupOptions`·`projectPluginMentions`·`splitDirAndPrefix` export | 미사용 alias | 참조 0 (D11) |
| Plugin/Provider alias(`pluginPresentation` 등) | 정상 | D-019 호환 facade |
| `connectionInfo`·`gateRows` 등 “테스트 전용” | 오탐 | 같은 파일 내 `connectionList`·`createConnectionSources`가 호출 |
| `createConnectionSources` optional `gateCatalog/harness/usage` deps | 미배선 | `bootstrap.ts:414-418`은 gate·plugins만 넘긴다. 배포는 row helper를 함수 본문에 넣어야 한다 (D12) |
| `catalog` 잔여 판별자 | 없음 | `rg '\.catalog'` — renderer 소비는 `providerPresentation.ts:34` 한 곳 |
| 형제 정책 비대칭 | 없음 | 스크립트 결과 0 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 suite(`model-parser`·`modes.r7`·`useFileAutocomplete`·`providerRows`) 실재 확인.
- **plan AC가 요구했지만 존재하지 않는 oracle**: `useMentionAutocomplete` hook test(AC10·AC20 production), `MentionAutocomplete` render test(AC6·AC19), controller keyboard test(AC11), `ProviderAuthActions` component callback test(AC15·AC16). `rg -l 'useMentionAutocomplete|MentionAutocomplete\b|ProviderAuthActions\b|useSkillAutocomplete' src --glob '*.test.*'` → **0파일**.
- structural proxy: `ProviderAuthActions.test.ts`의 `providerAuthMenuItems` 순서·kind 단언은 JSX가 소비하지 않는 상수다 — JSX는 `[1].danger`만 읽는다(`ProviderAuthActions.tsx:79`).
- **선택된 적대 증거 재측정: 27건 실행 — red 19 · green 8** (M8·N3는 변형별로 셈, 검증자 추가 축 3건 제외). 스위트 = 아래 명령의 105파일/783케이스 baseline green.

```text
cd app && ./node_modules/.bin/vitest run <model-parser·settings·runtime-catalog·chat/{components/composer,hooks,lib}·engine/components·skills·i18n resources·shared/plugin-catalog·main/app/{connection-views,deployment/{connections,plugins,deployment-wiring}}>
```

| 변이 | 범위 | 이번 라운드 | 귀속 |
|---|---|---|---|
| M1 `ALIAS_ENV_KEY.fable` 키 변경 | 스위트 | red 2 | VP-01·08 등록 |
| M2 default order Fable-first | 스위트 | red 4 | VP-11 등록 |
| M12 parser에서 Fable 제거(3 테이블) | 스위트 | red 12 | VP-08 등록 |
| **M3 Engine `1M`↔`default` 배지 조건 맞바꿈** | 스위트 | **green** | VP-01 등록 → D4 |
| M8 auth 분기 반전(model / component) | 스위트 | red 6 / red 2 | VP-03 등록 |
| M9b model 상수 `danger:false` | 스위트 | red 1 | VP-14 (상수만) |
| **M9 JSX `danger={false}`** | 스위트 | **green** | VP-03·14 등록 “danger 제거” → D5 |
| **M10 JSX 메뉴 항목 순서 맞바꿈** | 스위트 | **green** | VP-14 등록 → D5 |
| **M11 `closeThen` callback 후 close** | 스위트 | **green** | VP-07 등록 → D5 |
| **M13 재인증↔연결 해제 onClick 맞바꿈** | 스위트 | **green** | VP-10 등록 → D5 |
| M14 Plugin/file validity set 맞바꿈 | 스위트 | red 1 | VP-13 등록 |
| N1 `groupMentionSuggestions` path/Plugin 맞바꿈 | 스위트 | red 1 | VP-15·21 등록 |
| **N1b popup render에서 groups 역순** | 스위트 | **green** | VP-15 등록(render 지점) → D6 |
| M5 Plugin 삽입 id→label | 스위트 | red 1 | R-08 (D-006) |
| N2 token-null reset 제거 | 스위트 | red 1 (`useFileAutocomplete.test`) | VP-16·22 등록 |
| **N6 dismissal을 `state.dismissed`로 (partial 비교 제거)** | 스위트 | **green** | VP-18 등록 “stale dismissed partial 유지” → D7 |
| N5 projector를 catalog 판별로 | 스위트 | red 2 | VP-23 등록 |
| N5b projector를 catalog∧tools로 | 스위트 | red 1 | VP-23 등록 |
| **EP12 `validPluginIds`를 catalog 판별로** | 스위트 | **green** | VP-23 등록(EP-12 3번째 지점) → D8 |
| N4 `toolsOf` Plugin-only guard 제거 | 스위트 | red 3 | VP-20·23 등록 |
| N8 catalog spread를 plugin-only로 | 스위트 | red 1 | VP-17·20 등록 |
| N3a/b/d usage/harness/gate row catalog 소실 | 스위트 | red 2/2/2 | VP-17·19 등록 |
| N9 factory가 `gateCatalog` 누락 | 스위트 | red 1 | VP-19 등록 |
| N7 usage를 tools 대상으로 | 스위트 | red 4 | VP-24 등록 |

- 이전 라운드 대조: 해당 없음 — 이전 verify 없음. 구현 보고의 r1 red 7종·r2 red 5종은 위 M1·M2·M8·M9b·N1·M5·N2·N4·N5·N8에서 전부 red 재현(덮개 회귀 0).
- 구현 보고가 이름을 대지 않은 축(검증자 추가, 판정 비귀속): N2b occurrence 재오픈 분기 제거 → green(재오픈 후 Esc·↓ 무력화가 잠기지 않음), N9b harness catalog 정규화 생략 → green, M7 cwd-null Plugin-only open 제거 → green. D7·D9에 기록.
- 형제 슬롯 맞바꿈: path/Plugin 그룹(N1·N1b), 재인증/연결 해제(M10·M13), 1M/default 배지(M3) — 순수 그룹만 red.

### 동작 probe (임시 테스트, 커밋하지 않음)

production 심볼을 직접 호출하는 fixture로 동작을 따로 관측했다(동일 `vi.mock('react')` hook fixture 형태).

| probe | 결과 | 의미 |
|---|---|---|
| `useMentionAutocomplete('@', cwd=null)` + Plugin 1 | open, `list` 0회 | AC10a ✅ |
| provider `state()` reject + cwd | path 그룹 open, `state` 1·`onState` 1 | AC10b ✅ |
| `@` → `close()` → `''` → `@` | `{open:true, activeIndex:0}` | AC20 production ✅ |
| **`@a` close → `@al` 재오픈 → `setActiveIndex(1)`** | **`open:false`** | D1 — base `6200cf1`의 상태 머신으로 바꾸면 green |
| **`useSkillAutocomplete('/b')` close → `/bu` → `setActiveIndex(1)`** | **`open:false`** | D1 — `/` skill 회귀, base에서는 green |
| **`@zzz`(0건) / `@src/zzz`(0건) popup render** | **`noMatches` 없음, header만** | D2 |
| **`tokenizeComposerDecoration('@jira-dc/notes.md', …, paths={'jira-dc/notes.md'}, plugins={'jira-dc'})`** | **`[plugin '@jira-dc', text '/notes.md']`** | D3 |
| `ProviderAuthActions` 반환 트리의 MenuItem onClick 호출 | 순서 재인증→연결 해제, danger 둘째만, `setOpen(false)`→callback | AC15·16 동작 ✅ — 테스트 가능 핸들 존재 |
| `MentionAutocomplete` render(AnchoredDropdown mock) `@j` | path header/`jira.md`가 Plugin header/`@jira-dc`보다 앞 | AC19 동작 ✅ |

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | §10 전수 |
|---|---|---|---|---|---|
| VP-11 | MD-01 ↔ UT-01 | REQUIRED | PASS | parser 4-family matrix, M2 red | EP-01 4/4 |
| VP-13 | MD-03 ↔ UT-03 | REQUIRED | **PAIR_FAIL** | M14 red이나 D3 경로 토큰에 Plugin chip | EP-04 하위 2/2 |
| VP-14 | MD-04 ↔ UT-04 | REQUIRED | **PAIR_FAIL** (root D5) | M9·M10 green | EP-05 5/5 코드 |
| VP-21 | MD-05 ↔ UT-05 | REQUIRED | PASS | N1 red | EP-07 1/2 (render는 VP-15) |
| VP-22 | MD-06 ↔ UT-06 | REQUIRED | **PAIR_FAIL** (root D1) | D1 probe red, N2 red | EP-08 2/2 코드 |
| VP-23 | MD-07 ↔ UT-07 | REQUIRED | **PAIR_FAIL** (root D8) | N5 red, EP12 valid-id green | EP-09 3/3 · EP-12 3/3 코드, 잠금 2/3 |
| VP-08 | AR-01 ↔ IT-01 | REQUIRED | PASS | M12 red 12(parser+settings) | EP-01·02 7/7 |
| VP-10 | AR-03 ↔ IT-03 | REQUIRED | **PAIR_FAIL** (root D5) | M13 green | EP-05 |
| VP-20 | AR-04 ↔ IT-04 | REQUIRED | PASS | N4·N8 red | EP-10~12 |
| VP-05 | SD-01 ↔ ST-01 | REQUIRED | PASS | settings/parser/ModelMenu Fable/Engine render | EP-01·02 |
| VP-07 | SD-03 ↔ ST-03 | REQUIRED | **PAIR_FAIL** (root D5) | M11 green | EP-05 |
| VP-18 | SD-04 ↔ ST-04 | REQUIRED | **PAIR_FAIL** (root D7) | N6 green, production hook test 0 | EP-07~08 |
| VP-19 | SD-05 ↔ ST-05 | REQUIRED | PASS | N3a/b/d·N9 red | EP-09~11 9/9 |
| VP-01 | R-01 ↔ AT-01 | REQUIRED | **PAIR_FAIL** (root D4) | M1 red, M3 green | EP-01·02 |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | BLOCKED_BY:VP-14 | M8 red, danger 축은 VP-14 | EP-05 |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | PASS | EP-06 6문서 갱신 확인, stale 문구 `rg` 0(EP 문서), doc gate ok | EP-06 6/6 |
| VP-15 | R-05 ↔ AT-05 | REQUIRED | **PAIR_FAIL** (root D6) | N1 red, N1b green, render test 0 | EP-07 |
| VP-16 | R-06 ↔ AT-06 | REQUIRED | PASS | N2 red + production probe AC20 | EP-08 |
| VP-17 | R-07 ↔ AT-07~10 | REQUIRED | PASS | N3·N8 red, four-category `connection-views.test` | EP-09~11 |
| VP-24 | R-08 ↔ AT-11 | REGRESSION | **PAIR_FAIL** (root D2, +D1) | N7 red, D1 skill probe·D2 render probe red | EP-08·11·12 |
| VP-25 | V1 R-03 ↔ AT-03 | REGRESSION | BLOCKED_BY:VP-10 | render suites green, callback oracle 0 | EP-11 |

- V1 VP-02·06·09·12는 ΔV1이 R-02/SD-02/AR-02/MD-02를 SUPERSEDED로 분해해 채점하지 않는다(내용은 VP-15~24가 계승).
- **합계: PASS 9 · root PAIR_FAIL 10 · BLOCKED_BY 2 = 21** (REQUIRED 19 + REGRESSION 2). 구현 자기보고 25/25 SELF_PASS(r1 14 + r2 11)는 superseded 4를 포함한 값이다.
- root finding은 D1~D8 여덟 개이며 D5 하나가 VP-07·10·14 세 root pair에 걸친다.

### AT / AC 세부와 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1·2·3 | ✅ | `model-parser.test.ts` Fable 3케이스·4-alias 기대, M1·M12 red |
| AC4 | ✅ | `modelMenu0215.render.test.ts` “Fable family” — active row 1M·selectedModelShape |
| AC5 | ⚠️ | 동작 정상, 배지 맞바꿈 미검출 (D4) |
| AC6 | ⚠️ | 순수 그룹 test만, popup render test 0 (D6) |
| AC8 | ✅ | `mentionAutocomplete.test` id 삽입·caret, M5 red |
| AC9 | ✅ | quoted/slash path-only·8개·hidden `useFileAutocomplete.test`·`mentionAutocomplete.test` |
| AC10 | ⚠️ | probe ✅, hook test 0 (D7) |
| AC11 | ❌ | Esc 재개 후 ↓가 팝업을 닫는다 (D1), keyboard test 0 |
| AC12 | ❌ | 경로 토큰에 Plugin chip (D3) |
| AC13·14 | ✅ | `ProviderDetail.render.test` `provider-authenticate`·`provider-reauth-menu` aria-expanded, M8 red |
| AC15·16 | ⚠️ | probe ✅, component oracle 0 (D5) |
| AC17 | ✅ | TRD·ux-domains·auth.md·guide·IPC 갱신, doc gate ok (타 문서 stale은 D10) |
| AC18 | ✅ | `modes.r7`·`providerRows`·requestSeq suites green |
| AC19 | ⚠️ | 순수 순서 ✅, render 순서 미잠금 (D6) |
| AC20 | ✅ | N2 red + production probe |
| AC21·22·24 | ✅ | `connection-views.test` four-category·no-catalog, `connections.test`, alias tests, typecheck |
| AC23 | ⚠️ | 동작 정상, valid-id 지점 미잠금 (D8) |
| AC25 | ❌ | `/` skill·file dismissal 회귀 (D1), 0건 빈 그룹 (D2) |

- **합계 재측정: ✅ 14 · ⚠️ 7 · ❌ 3 = 24** (AC7은 AC23이 대체).
- 합계 사본: trailer r1 `18/18`·r2 `7/7`(합 25, AC7 포함) ↔ plan 구현 보고 동일 ↔ INDEX 비고 수치 없음. 분모 차이는 AC7 SUPERSEDE 때문이다.

### pair별 §10 강제 지점 분모 (독립 재열거)

| EP | plan 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|
| EP-01 (4) | FAMILY_ORDER·ALIAS_ENV_KEY·DEFAULT_FAMILY_ORDER·shared family | `model-parser.ts:24,25,30-35` · `model-identity.ts` | 4/4 |
| EP-02 (3) | wire·Composer·Engine | `models.ts` 변환 · `ModelMenu` identity · `EngineModelList.tsx:15` | 3/3 (Engine 잠금은 D4) |
| EP-05 (5) | predicate·직접 trigger·dropdown·reauth item·danger item | `providerAuthActionModel.ts:11` · `ProviderAuthActions.tsx:36,56,75,78` | 5/5 코드, 잠금 2/5 (D5) |
| EP-06 (6) | ko·en·TRD·ux-domains·auth.md·guide | 6파일 diff 확인 | 6/6 |
| EP-07 (2) | group 투영·render | `mentionAutocomplete.ts:66` · `MentionAutocomplete.tsx:40` | 2/2 코드, 잠금 1/2 (D6) |
| EP-08 (2) | shared state·mention open | `useTokenAutocompleteState.ts:22` · `useMentionAutocomplete.ts:122-124` | 2/2 코드, 결함 D1 |
| EP-09 (3) | generic type/normalizer·alias·wire type | `provider-catalog.ts` · `plugin-catalog.ts` · `ipc.ts:1750` | 3/3 |
| EP-10 (3) | row factory·toolsOf·connectionInfo | `connections.ts:54-103` · `connection-views.ts:58,80` | 3/3 |
| EP-11 (3) | resolver·CustomizeList·ProviderDetail | `providerPresentation.ts` · `CustomizeList.tsx:112` · `ProviderDetail.tsx:39` | 3/3 |
| EP-12 (3) | toolsOf·후보·valid id | `connection-views.ts:59` · `pluginMention.ts:22` · `useMentionAutocomplete.ts:126-129` | 3/3 코드, 잠금 2/3 (D8) |
| EP-13 (5) | IPC·TRD·auth·ux-domains·guide | 5파일 diff 확인 | 5/5 |

- EP-03·EP-04(V1, SUPERSEDED)는 EP-10·12·07·08이 대체.
- 표 밖 같은 불변식: `docs/arch/frontend/{state,layers,overview}.md`가 `useFileAutocomplete`를 Composer 자동완성으로 서술 → R-04 EP 목록 밖, NON_BLOCKING (D10).

### 현재 변경의 운영 gate

| Gate | 결과 | 관측 |
|---|---|---|
| typecheck | PASS | `npm run typecheck` exit 0, `error TS` 0 (node·web·test 3 config) |
| lint | PASS | `npm run lint` 0 error · 1 warning(기존 TanStack Virtual), 작업 트리 변화 0 |
| 관련 vitest | PASS (변경 무관 1 제외) | 105파일/783케이스 green. `deployment/mail.integration.test.ts`는 `better_sqlite3.node` bindings 미빌드 — ABI 서명, 변경 무관 |
| doc inventory | PASS | `9 items, 98 channels` · prose ok · links ok |
| `git diff --check 6200cf1 569d2c8` | PASS | 출력 0 |
| repository/message-bus | 부분 | trailer 6커밋 전부 파싱 ✅, INDEX 좌표 5개 죽음 → 이번 커밋에서 교정, plan 메타 좌표는 D13 |

## 6. 외부 포트 / 문서 계약

| 계약 | shape | semantics | 결과 |
|---|---|---|---|
| `ProviderCatalogPresentationInput` + Plugin alias | typecheck 3 config green, `JIRA_CATALOG_PRESENTATION_INPUT satisfies` | alias ≡ canonical (`plugin-catalog.test`·`pluginPresentation.test`) | ✅ |
| `UsageFetcher` 불변 (D-020) | `usage-fetcher.ts` diff 0 | usage row만 catalog | ✅ |
| guide §3 gate 예제 | `connections.ts` 안에서 자기 import·스코프 밖 `gateMembers` | — | NON_BLOCKING (D12) |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 신규 IPC 0: `IPC_CONTRACT.md` 변경은 `orca:provider:list` 설명 1행, doc inventory 98 channels 불변.
- provider 요청: active당 `state()` 1 + `onState` 1 (probe AC10b 호출 수 관측).
- 모델 UI 소비처 5 재측정은 plan 값 그대로(generic map) — 변경 없음.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 |
|---|---|---|
| Composer `@` 팝업 | 순서·재입력·0건·keyboard 상태(probe) | 두 테마 path 상단/Plugin 하단·clipping |
| Fable | parser·ModelMenu·Engine render | 실제 SDK에서 bare `fable` alias 해석(§17 리스크) |
| 인증 액션 | 분기·callback·close 순서(probe) | 좁은 우측 패널에서 dropdown 배치 |
| custom presentation | four-category wire·resolver | gate/harness/usage custom icon·본문 시각 |

- `ProviderAuthActions`·`MentionAutocomplete`·`useMentionAutocomplete`는 모두 node 환경에서 테스트 가능함을 probe로 확인했다. 사람 실기로 넘길 근거가 아니다.

## 9. 게이트 재실행

- 설치: `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci --ignore-scripts` (app/AGENTS 제약 환경 절차).
- `npm test` 미사용 — DB 동작 검증 대상 없음.
- 게이트의 작업 트리 변경: 없음(`git status --short` 비어 있음, lint `--fix` 후 포함).
- 잔여물: 임시 probe 4파일·mutation 백업은 scratch로 옮기고 트리에서 제거. `node_modules`는 gitignore.

## 10. 검증 책임 분리

| 항목 | 결과 |
|---|---|
| lint/typecheck/관련 테스트 | 에이전트 실행 — 위 관측 |
| AC ↔ production path | 24 AC 대조 — ✅14 ⚠️7 ❌3 |
| 문서 형식·링크 | doc gate ok |
| UI 시각 품질 | 사람 — §8 |
| 제품 결정 | 새 결정 요청 없음 |

## 11. Repository operation checks

- AGENTS.md 변경: 없음.
- INDEX: 상태 `IMPL_DONE`·다음 주체 Claude — 실제 상태와 일치. 대상 커밋 `651d9080`·`6030afae`·`2c7dad51`·`2caada46` 전부 `git cat-file` 실패 → `6200cf1`·`6f40c8b`~`f31c068`·`ee15ca9`·`569d2c8`로 교정.
- trailer: 6커밋 모두 `git log -1 --format='%(trailers:only=true)'`가 적힌 키를 반환. `Agent` 값 허용 범위.
- 재구현 라운드 `[구현자 기입]` 7필드(r2): 설계 리뷰·강제 지점 전수·수정의 잠금·Product/UX·놓친 문제·구현 보고·Review Signals — 7/7.
- plan 메타의 기준 V 좌표(`V1@651d9080`)와 r1 좌표 `6030afae`·`e96a2494`·`2c7dad51`도 죽음 (D13).
- plan 메타 상태가 r2 이후에도 `READY (ΔV1)`로 남아 INDEX(`IMPL_DONE`)와 갈렸다 → 이번 커밋에서 두 사본을 `verify/FAIL`로 함께 갱신.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 |
|---|---|
| r1 “legacy `FileAutocomplete` 호환 위해 유지” | 타당하지 않음 — production caller 0 (D11) |
| r1 VP-07 “close-before-callback은 source inspection” | 등록 변이 M11 미검출 — source inspection은 oracle이 아니다 (D5) |
| r2 “Electron 시각만 남음” | 기계 검증 가능한 hook/render/component oracle이 빠져 있었다 (D5~D8) |
| r2 `ProviderCatalog*` 정본 + facade | 타당 — D-019 그대로 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair |
|---|---|---|---|---|
| D1 | Esc 후 partial이 바뀌어 재오픈된 팝업에서 `setActiveIndex`(↓/↑·hover)가 `partial`만 갱신해 남아 있던 `dismissed:true`를 다시 유효하게 만든다 → 팝업이 닫힌다. `/` skill도 같은 회귀. base `6200cf1`에서는 green | D-015·V1 §5 “partial 변경 시 재개”·AC11·AC25 | BLOCKING | VP-22 root · VP-24 |
| D2 | 결과 0건이면 path 그룹을 빈 채로 push(`mentionAutocomplete.ts:75-77`)하고 popup은 `groups.length===0`일 때만 `noMatches`를 렌더 → header만 남는다. slash path 0건도 기존 `FileAutocomplete`의 `일치하는 항목 없음`을 잃었다 | V1 §5 loading/empty 행 · AC25 | BLOCKING | VP-24 root |
| D3 | `PLUGIN_TOKEN_RE`에 끝 경계가 없어 `@jira-dc/notes.md`의 앞부분이 Plugin chip이 되고 유효 path chip이 가려진다 | MD-03 “잘못된 chip” · AC12 | BLOCKING | VP-13 |
| D4 | Engine 1M/default 배지 조건 맞바꿈(M3)이 green — `EngineModelList.render.test`는 문자열 존재만 본다 | VP-01 등록 변이 | BLOCKING | VP-01 |
| D5 | `ProviderAuthActions` 렌더 트리 oracle 부재. JSX danger 제거(M9)·메뉴 순서(M10)·close 순서(M11)·callback 맞바꿈(M13) 전부 green. model 상수 test는 JSX가 안 읽는 순서를 잠근다 | VP-03·07·10·14·25 등록 변이 · AC15·16 | BLOCKING | VP-14·10·07 root · VP-03·25 BLOCKED_BY |
| D6 | popup render 순서 oracle 부재 — render에서 groups 역순(N1b) green. 화면≠keyboard 순서가 잠기지 않는다 | VP-15 등록 변이 · AC6·AC19 render test | BLOCKING | VP-15 |
| D7 | production `useMentionAutocomplete` hook test 0. N6(stale dismissal)·M7(cwd-null Plugin-only open)·N2b(재오픈 분기) green. AC20 oracle은 죽은 `useFileAutocomplete` 위에만 있다 | VP-18 등록 변이 · AC10 | BLOCKING | VP-18 |
| D8 | `validPluginIds`를 catalog 판별로 되돌려도(EP12) green — EP-12 세 번째 지점 미잠금 | VP-23 등록 변이 · EP-12 | BLOCKING | VP-23 |
| D9 | harness/usage row의 catalog 정규화를 건너뛰어도(N9b) green — fixture에 icon이 있어 기본값·검증이 보이지 않는다 | VP-19 비등록 축 | NON_BLOCKING | — |
| D10 | `docs/arch/frontend/state.md:40`·`layers.md:56`·`overview.md:55`가 `useFileAutocomplete`/`FileAutocomplete`를 현재 Composer 자동완성으로 서술 | R-04 EP 목록 밖 | NON_BLOCKING | — |
| D11 | `useFileAutocomplete.ts`·`FileAutocomplete.tsx` production 참조 0, `mentionGroupOptions`·`projectPluginMentions` 미사용 alias | plan §18 “대체” | NON_BLOCKING | D7과 함께 정리 권장 |
| D12 | `createConnectionSources`의 `gateCatalog/harness/usage` deps를 bootstrap이 넘기지 않는다. guide gate 예제는 `connections.ts` 안 자기 import·스코프 밖 `gateMembers` | D-016 경로는 row helper로 성립 | NON_BLOCKING | — |
| D13 | plan 메타 `V1@651d9080`·r1 `6030afae`·`e96a2494`·`2c7dad51` 죽은 좌표, r2가 메타 상태를 `READY`로 남김 | message-bus | NON_BLOCKING | 설계자 다음 revision에서 `6200cf1`·`6f40c8b`~`f31c068`로 교정 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 해당 없음(첫 verify). r1이 검증 없이 ΔV1 설계로 이어졌다.
- 관련 plan 지침/AC 존재: D1은 V1 §5 “partial 변경 시 재개”, D2는 V1 §5 empty 행, D4~D8은 pair 등록 변이·AC 검증 수단이 선행 기재돼 있었다.
- 사용자 결정 변경 근거: ΔV1 사용자 변경 4건(설계 커밋 `ee15ca9`).
- 설계 커밋 trailer가 `Agent: codex`·`Status: designed`다(plan 메타 “사용자 지시로 설계 턴 수행”).
- 반복된 검증 환경 한계: Electron/SDK 실기 불가, DB 스위트 1파일 ABI.

## 15. 결론

- 상태: **FAIL**
- pair 결과: PASS 9 · root PAIR_FAIL 10 · BLOCKED_BY 2 (총 21)
- PLAN_GAP: 없음
- Product/UX: Fable·catalog·인증 분기는 충족. Composer dismissal(D1)·empty state(D2)·chip(D3)이 계약 위반.
- AC: ✅ 14 · ⚠️ 7 · ❌ 3 / 24
- 운영 gate: typecheck·lint·vitest·doc·diff check PASS
- 다음 단계: 구현자 r3 — D1~D8 수정·oracle 추가. NON_BLOCKING D9~D12는 같은 라운드 정리 권장, D13은 설계자 몫.

---

# r3 검증 (2회차 verify 턴)

## 메타 (r3)

| 항목 | 값 |
|---|---|
| 검증자 | Claude Code |
| 일자 | 2026-09-22 |
| 대상 커밋/range | `a4f3b17..6b6c04f` — r3 구현 `6b6c04f` (기준: r2 verify `a4f3b17`, r2 구현 `569d2c8`) |
| 유효 V | `V1@6200cf1 + ΔV1@ee15ca9` — 변경 없음 |
| 라운드 | 3 |
| 상태 | **FAIL** |
| 자기 검증 여부 | **예** — r3 구현 trailer `Agent: claude`, 같은 세션. 보고가 이름을 대지 않은 적대 축 15건을 분모에 넣었다(§3) |

## 0. 기준선 (r3)

- **기준선 성립: 예.** `git diff a4f3b17 6b6c04f -- plan.md` hunk 2개 = 메타 상태 1행 + `[구현자 기입]` r3 절(1026행 이후)뿐.
- Decision·Product/UX·AC·V node/pair·§10 변경: **없음**. 채점 기준은 r2와 같은 24 AC(AC7은 AC23이 대체)·21 pair.
- Plan validity: r2 판정 그대로 유효, root PLAN_GAP 없음. 단 EP-05 분모가 `ProviderDetail → ProviderAuthActions` 결합 지점을 세지 않는다 — pair 경로가 이미 그 edge를 명시하므로 gap이 아니라 D14의 review signal로 둔다.

## 1. 구현 비판적 검토 — AC 전에

| 질문 | 판정 | 근거 |
|---|---|---|
| D1 수정이 dismissal을 다시 쓰는가 | 아니오 | `setActiveIndex`는 `activeIndex`만 바꾼다(`useTokenAutocompleteState.ts:52`). base `6200cf1`의 `dismissedAt` 의미와 같다 |
| D2 수정의 false success | 없음 | 빈 그룹 미생성 + popup `suggestions.length===0`. 경로 lib가 빈 그룹을 안 만들어 `groups`/`suggestions` 0 조건이 동치다. probe P4 `@zz`(cwd·Plugin 불일치) → open·groups 0·noMatches |
| D3 수정이 만든 새 표면 | 잠금 일부 없음 | 끝 경계 `(?=\s|$)`의 `$` 가지(draft 끝 `@id`)는 테스트가 없다 — S6 green (D17) |
| 0건 Enter/↓ | 기존 동작 | `length>0` 가드·`pick` undefined면 무동작 — r2와 동일 |
| 비동기·상한 | 불변 | provider `state` 1 + `onState` 1, option `P + min(F,8)` |

## 2. 역방향 탐색 (r3)

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 569d2c8..6b6c04f` — 9파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| `filterFileSuggestions` export | 미사용 export | 같은 파일 내부 호출뿐. D11이 형제 `splitDirAndPrefix`만 비export로 돌렸다 (D20) |
| `harnessRows`·`usageRows` 테스트 전용 | 의도 | D12로 deps 제거 — 배포가 `createConnectionSources` 본문에 끼워 넣는 row 조각이며 guide §3·§5-b 예제가 그 형태다. r2 D12 판단과 같다 |
| `gateRows`·`pluginRows`·`ConnectionDeploymentDeps` | 오탐 | 같은 파일 `createConnectionSources`·bootstrap 타입 |
| `MentionToken`·`ProviderAuthActionsProps` 타입 | 정상 | 시그니처 타입 |
| 죽은 이름 잔존 | 0 | `rg 'FileAutocomplete|useFileAutocomplete|fileAutocompleteAria' docs app/src --glob '!docs/{archive,handoff,etc}/**'` → 0줄. `mentionGroupOptions|projectPluginMentions|gateCatalog` → 0줄 |
| 형제 정책 비대칭 | 없음 | 스크립트 0 |

## 3. 적대 증거 재측정

러너: 변이 1건씩 적용 → 아래 스위트 전체 → 복원. 스위트 baseline **108파일 / 808케이스** green.

```text
cd app && ./node_modules/.bin/vitest run model-parser·settings·runtime-catalog · chat/{components/composer,hooks,lib} · engine/components · skills · i18n resources · shared/plugin-catalog · main/app/{connection-views,deployment/{connections,plugins,deployment-wiring}}
```

### 3-1. r3 잠금 표 15행 — 15/15 red

| 변이 | r2 | r3 | 실패 파일 |
|---|---|---|---|
| M3 Engine 1M↔default 조건 | green | red 1 | EngineModelList.render |
| M9 JSX `danger={false}` | green | red 3 | ProviderAuthActions.render |
| M10 렌더 순서 역전 | green | red 4 | ProviderAuthActions.render |
| M11 callback 후 close | green | red 1 | ProviderAuthActions.render |
| M13 onClick 맞바꿈(컴포넌트 내부) | green | red 1 | ProviderAuthActions.render |
| N1b popup groups 역순 | green | red 1 | MentionAutocomplete.render |
| N6 partial 비교 제거 | green | red 3 | useMention·useSkill |
| M7 cwd-null Plugin-only open 제거 | green | red 1 | useMention |
| N2b 새 occurrence 분기 제거 | green | red 1 | useMention |
| EP12 valid id를 catalog로 | green | red 2 | useMention |
| D1 되돌림 | — | red 2 | useMention·useSkill |
| D2 되돌림(빈 path 그룹 push) | — | red 4 | render·lib·hook |
| D3 되돌림(끝 경계 제거) | — | red 1 | composerDecoration |
| N9b harness 정규화 생략 | green | red 2 | connections |
| N9c usage 정규화 생략 | — | red 2 | connections |

### 3-2. 덮개 회귀 — r2 red 19건 재실행, red→green 0

M1 red 2 · M2 red 4 · M12 red 12 · M8(model) red 11 · M8(component) red 7 · M9b red 4 · M10b red 5 · M14 red 1 · N1 red 3 · M5 red 1 · N2 red 4 · N5 red 6 · N5b red 5 · N4 red 3 · N8 red 1 · N3a red 3 · N3b red 3 · N3d red 2 · N7 red 2. N9(factory `gateCatalog`)는 D12로 대상 필드가 사라져 해당 없음.

### 3-3. 검증자 신설 축 — 보고가 이름을 대지 않은 지점 15건: red 8 · **green 7**

| 축 | 변이 | 결과 | 귀속 |
|---|---|---|---|
| **S1** | `ProviderDetail`이 `onReauth={onRevoke}`·`onRevoke={onReauth}`로 넘김 | **green** | VP-10 등록 “reauth/revoke callback 맞바꿈”의 pair 경로 edge → **D14** |
| **S1b** | `ProviderDetail`이 `authKind={null}`로 넘김(선택 방식 소실) | **green** | 같은 edge → D14 |
| S2 | `ExtensionsCatalogView` 바인딩 `onReauth`→`providers.revoke` | green | 0238 미변경 기존 바인딩 → D15 |
| S3 | valid id를 `visibleProviders` 대신 `providers`로 | red 1 | EP-12 형제 |
| S4 | `pluginOpen`의 `!token.quoted` 제거 | green | 비등록, P3 동작은 정상 → D18 |
| S5a | controller ↑/↓ 모듈로에 header 1칸 포함 | green | AC11 → D16 |
| S5b | controller Enter/Tab이 `suggestions[0]` 선택 | green | AC11 → D16 |
| S5c | controller Esc가 `close()` 안 부름 | green | AC11 → D16 |
| S6 | Plugin chip 끝 경계에서 `$` 제거 | green | D3 수정의 새 표면 → D17 |
| S7 | 메뉴 라벨 매핑 맞바꿈 | red 3 | VP-14 형제 |
| S8 | gate row 정규화 생략 | red 2 | D9 형제(gate) |
| S9 | occurrence 경계에서 `dismissedAt` 유지 | red 3 | VP-22 다른 지점 |
| S10 | occurrence 경계에서 `activeIndex` 유지 | red 2 | VP-22 다른 지점 |
| S11 | noMatches에서 `!loading` 제거 | red 1 | D2 형제 |
| S12 | Plugin 그룹 조건을 `!quoted`만으로(slash 허용) | red 2 | AC9 |

- 인용 변이 미검출: **0** — r2 D1~D9가 인용한 변이는 전부 red. D5는 인용 변이 기준으로 닫혔으나 같은 계약(VP-10)이 컴포넌트 밖 edge에서 열려 있다 — D14로 새로 연다.
- 동작 보존 추출 라운드 아님. 소거 변이 잔여물 수렴: 해당 없음(각 변이가 typecheck 비대상 런타임 값 교체).

### 3-4. 동작 probe (임시 테스트, 커밋하지 않음)

production `useMentionAutocomplete`를 기존 hook fixture로 구동했다.

| probe | 결과 | 판정 |
|---|---|---|
| P1 `@a x @a`: caret 2에서 Esc → caret 7(두 번째 `@a`)로 직접 이동 | `open:false`, `tokenStart:5` | occurrence 경계가 null뿐이라 다른 token이 dismissal을 상속 → D19 |
| P2 `@a` Esc → `@ab` → `@a` | `open:false` | base `6200cf1` 의미 그대로(구현 보고 #2와 일치) |
| P3 `@"j`, cwd null, Plugin 있음 | `open:false` | 정상 (S4는 잠금만 없음) |
| P4 `@zz`, cwd 있음·경로/Plugin 불일치 | open·groups 0·suggestions 0 | D2 ✅ |
| P5 `@src/` listing 대기 | open·loading·groups 0 | spinner만, header 없음 — 구현 보고 Product/UX 4행과 일치 |

## 4. V-pair closeout (r3) — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | r2 | r3 | 직접 증거 (이번 라운드) |
|---|---|---|---|---|---|
| VP-11 | UT | REQUIRED | PASS | PASS | M2 red 4 |
| VP-13 | UT | REQUIRED | PAIR_FAIL | **PASS** | D3 case + D3 되돌림 red, M14 red. S6 green은 D17 |
| VP-14 | UT | REQUIRED | PAIR_FAIL | **PASS** | M9·M10·M9b·M10b·S7 red |
| VP-21 | UT | REQUIRED | PASS | PASS | N1 red 3 |
| VP-22 | UT | REQUIRED | PAIR_FAIL | **PASS** | N2·N2b·D1 되돌림·S9·S10 red |
| VP-23 | UT | REQUIRED | PAIR_FAIL | **PASS** | N5·N5b·EP12 red |
| VP-08 | IT | REQUIRED | PASS | PASS | M12 red 12 |
| VP-10 | IT | REQUIRED | PAIR_FAIL | **PAIR_FAIL** (root D14) | M13 red이나 S1·S1b green — `ProviderDetail props → auth actions` edge 미잠금 |
| VP-20 | IT | REQUIRED | PASS | PASS | N4·N8 red |
| VP-05 | ST | REQUIRED | PASS | PASS | parser/settings/ModelMenu/Engine suites green |
| VP-07 | ST | REQUIRED | PAIR_FAIL | **PASS** | 등록 축 close/callback 순서 M11 red. callback 식별 축은 VP-10 판정 범위 |
| VP-18 | ST | REQUIRED | PAIR_FAIL | **PASS** | production hook test 13케이스, N6·M7·N2b red |
| VP-19 | ST | REQUIRED | PASS | PASS | N3a/b/d·N9b/c·S8 red |
| VP-01 | AT | REQUIRED | PAIR_FAIL | **PASS** | M1·M3 red |
| VP-03 | AT | REQUIRED | BLOCKED_BY:VP-14 | **BLOCKED_BY:VP-10** | M8 red, 분기·danger 잠김. AC15의 `재인증→reauth` 결과가 D14 edge를 지난다 |
| VP-04 | AT | REQUIRED | PASS | PASS | stale 이름 0줄, doc gate ok |
| VP-15 | AT | REQUIRED | PAIR_FAIL | **PASS** | N1·N1b red |
| VP-16 | AT | REQUIRED | PASS | PASS | N2 red, production hook clear/retype |
| VP-17 | AT | REQUIRED | PASS | PASS | N3·N8 red |
| VP-24 | AT | REGRESSION | PAIR_FAIL | **PASS** | D1(skill) · D2 fixed, N7 red. AC11 controller glue는 D16 |
| VP-25 | AT | REGRESSION | BLOCKED_BY:VP-10 | **BLOCKED_BY:VP-10** | ProviderDetail render suite는 static markup이라 callback을 보지 않는다 |

- **합계: PASS 18 · root PAIR_FAIL 1 (VP-10) · BLOCKED_BY 2 (VP-03·VP-25) = 21.** 구현 자기보고 “r2 root·BLOCKED 12/12 SELF_PASS” ↔ 재측정 10/12 PASS.
- 실행 범위: 재검증이지만 21 pair 전부 변이를 재실행했다(r3가 connections·lib·docs까지 건드려 이전 PASS pair도 영향 범위).

### AT / AC (r3)

| AC | r2 | r3 | 근거 |
|---|---|---|---|
| AC1·2·3·4 | ✅ | ✅ | M1·M2·M12 red, modelMenu0215 Fable |
| AC5 | ⚠️ | ✅ | M3 red |
| AC6 | ⚠️ | ✅ | render test + N1b red |
| AC8·9 | ✅ | ✅ | M5·S12 red. S4 green은 동작 무관(D18) |
| AC10 | ⚠️ | ✅ | production hook test, M7 red |
| AC11 | ❌ | ⚠️ | D1 fixed. controller keyboard 직접 oracle 없음 — S5a/b/c green (D16) |
| AC12 | ❌ | ✅ | D3 fixed. draft 끝 `$` 가지 미잠금은 D17 |
| AC13·14 | ✅ | ✅ | M8 red |
| AC15 | ⚠️ | ⚠️ | 컴포넌트 내부 M13 red, `ProviderDetail` edge S1 green (D14) |
| AC16 | ⚠️ | ✅ | M11 red |
| AC17·18 | ✅ | ✅ | doc gate, stale 0줄, 회귀 suites green |
| AC19·20 | ⚠️·✅ | ✅ | N1b·N2 red |
| AC21·22·24 | ✅ | ✅ | N3·S8·N9 red, typecheck |
| AC23 | ⚠️ | ✅ | EP12 red |
| AC25 | ❌ | ✅ | D1·D2 fixed, N7 red |

- **합계 재측정: ✅ 22 · ⚠️ 2 · ❌ 0 = 24.** 자기보고 `Criteria-Met: 23/24`(⚠️ AC11 하나) ↔ 재측정 22/24 — **불일치**, 차이는 AC15(D14). trailer ↔ plan 구현 보고 `✅23·⚠️1`은 서로 일치, INDEX 비고는 수치 없음.

### 강제 지점 분모 (r3 독립 재열거)

| EP | 코드에서 센 지점 | 결과 |
|---|---|---|
| EP-05 (5) | `providerAuthActionModel.ts:12` predicate · `ProviderAuthActions.tsx:36` 직접 trigger · `:56-66` dropdown · `:75` map의 reauth·revoke 항목 | 5/5 코드, 잠금 5/5 |
| EP-05 밖 같은 계약 | `ProviderDetail.tsx:72-78` props 전달 1 · `ExtensionsCatalogView.tsx:215-218` sink 바인딩 1 | 잠금 0/2 (D14·D15) |
| EP-07 (2) | `mentionAutocomplete.ts:76·79` · `MentionAutocomplete.tsx:40` | 2/2, 잠금 2/2 |
| EP-08 (2) | `useTokenAutocompleteState.ts:41-43` · `useMentionAutocomplete.ts:118-124` | 2/2, 잠금 2/2 |
| EP-12 (3) | `connection-views.ts:59` · `pluginMention.ts:21` · `useMentionAutocomplete.ts:126-129` | 3/3, 잠금 3/3 |
| EP-10 row 조각 (3) | `gateRows`·`harnessRows`·`usageRows` 정규화 | 3/3, 잠금 3/3 (S8·N9b·N9c) |

- 구현 보고의 D1 “dismissal 쓰기 지점 3” 라벨 표본 확인: `close`(dismissedAt←partial)·경계(null)·`setActiveIndex`(activeIndex만) — 참.

### 운영 gate (r3) — 관측한 산출

| Gate | 결과 | 관측 |
|---|---|---|
| typecheck | PASS | node·web·test 3 config, `error TS` 0 |
| lint | PASS | 0 error · 1 warning(기존 TanStack Virtual). 실행 후 `git status` 변화 0 |
| 관련 vitest | PASS | **108파일 / 808케이스** pass (구현 보고와 같은 값) |
| doc inventory | PASS | `9 items, 98 channels` · prose ok · links ok |
| `git diff --check 569d2c8 6b6c04f` | PASS | 출력 0 |
| message-bus | PASS | `6b6c04f` trailer 8키 파싱, `Agent: claude`·`Status: implemented`·`Verified-By: pending` 허용값 |

- `npm test` 미사용 — DB 동작 검증 대상 없음. 임시 probe 1파일은 실행 후 삭제, 변이는 매건 복원 — 최종 `git status` 변화 0.

## 5. Repository operation checks (r3)

- INDEX: 상태 `IMPL_DONE`·다음 주체 Claude — 실제와 일치. 대상 커밋 자리표시자 `(r3 구현 — 검증자 기입)` → `6b6c04f`(`git cat-file -t` = commit)로 기입.
- `[구현자 기입]` r3 7필드: 설계 리뷰·강제 지점 전수·수정의 잠금·Product/UX·놓친 문제·구현 보고·Review Signals — **7/7**, 산문으로 접힌 필드 0.
- plan 메타 상태는 이번 커밋에서 INDEX와 함께 `verify/FAIL (r3)`로 갱신. D13(메타 죽은 좌표)은 설계자 몫으로 open 유지.
- 라운드: FAIL로 **4**가 되어 3을 초과한다 → `docs/handoff/AGENTS.md §handoff-review 트리거`에 따라 r4 재구현 전 `handoff-review` 수행.

## 6. Finding disposition (r3)

| # | finding | 귀속 | disposition | root / 영향 pair |
|---|---|---|---|---|
| D14 | `ProviderDetail → ProviderAuthActions` callback·`authKind` 전달 edge에 oracle이 없다. props를 맞바꾸면(S1) `재인증` 메뉴가 연결 해제를 실행하고, `authKind={null}`(S1b)이면 선택 방식이 사라진다 — 둘 다 808케이스 green. `ProviderDetail.render.test`는 static markup만 본다 | VP-10 등록 변이 “reauth/revoke callback 맞바꿈”의 pair 경로 edge · AC15 | BLOCKING | VP-10 root · VP-03·25 BLOCKED_BY |
| D15 | `ExtensionsCatalogView`의 `providers.reauth/revoke` 바인딩 맞바꿈(S2) green | 0238 미변경 기존 sink | NON_BLOCKING | — |
| D16 | AC11 controller keyboard glue 미잠금 — header 포함 모듈로(S5a)·Enter 첫 항목 고정(S5b)·Esc 무시(S5c) green. ΔV1이 V1 VP-06·12(“header index”) 적대 축을 대체 pair로 옮기지 않았다 | AC11 · 비등록 축 | NON_BLOCKING | r4에서 함께 닫기 권장 |
| D17 | D3 수정의 끝 경계 `$` 가지 미잠금 — draft 끝 `@jira-dc` chip 소실(S6) green | VP-13 새 표면 | NON_BLOCKING | — |
| D18 | `pluginOpen`의 `!token.quoted` 가드 제거(S4) green — 동작은 P3로 정상 확인 | AC9 비등록 축 | NON_BLOCKING | — |
| D19 | 같은 partial의 다른 `@` token으로 caret만 옮기면 dismissal이 이어진다(P1). occurrence 경계가 token null 하나뿐(EP-08)이고 base도 같다 | D-015 문언 “같은 문자열의 새 @ token” vs EP-08 null 경계 | NEXT_HANDOFF | 설계자 판단 — `tokenStart`를 occurrence identity에 넣을지 |
| D20 | `filterFileSuggestions` export 외부 참조 0 — D11이 형제 `splitDirAndPrefix`만 비export | D11 형제 | NON_BLOCKING | — |

- r2 D1~D12: 인용 변이 전부 red로 **closed 확인**. D13 open 유지.

## 7. Review Signals — 사실만 (r3)

- 이전 라운드와 유사 증상: 예 — D14는 r2 D5와 같은 계약(VP-10)이 **다른 지점**에서 열린 것. r3는 D5가 인용한 컴포넌트 내부 변이만 닫았다.
- 관련 plan 지침: VP-10 production path가 `ProviderDetail props`를 명시하나 §10 EP-05 분모 5곳은 컴포넌트 내부만 센다.
- D16: V1 VP-06·12의 header-index 적대 축이 ΔV1 분해(SUPERSEDED) 뒤 어느 pair에도 없다.
- 자기 검증: 보고된 변이 재실행 15/15 red만으로는 완결로 보였고, 보고에 없는 축 15건 중 7건이 green이었다.
- 반복 환경 한계: Electron/SDK 실기 불가.

## 8. 결론 (r3)

- 상태: **FAIL**
- pair: PASS 18 · root PAIR_FAIL 1 (VP-10) · BLOCKED_BY 2 · PLAN_GAP 0
- AC: ✅ 22 · ⚠️ 2 · ❌ 0 / 24
- Product/UX: r2 동작 결함 D1~D3 해소. 현재 production 동작 결함 0 — 남은 것은 D14 oracle 결함.
- 운영 gate: typecheck·lint·vitest 808·doc·diff check PASS
- 다음 단계: 라운드 4 > 3 → `handoff-review` 먼저, 그 뒤 r4 재구현(D14 필수, D16·D17 같은 라운드 권장). D19는 설계자 판단.
