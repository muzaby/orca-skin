# Verify — 0282-plugin-catalog-native-sync

> 최신 판정: **r2 PASS (기계 범위)** — 아래 [`# r2`](#r2--2026-10-24) 절. 이어지는 메타~§15는 r1 원문이다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0282-plugin-catalog-native-sync` |
| 검증자 | Claude Code |
| 일자 | 2026-10-23 |
| 대상 커밋/range | `9982cdfe..6fa83b39` (r1 `1ea950b4` · r1.2 `6fa83b39`) |
| 구현 전 plan 기준 | `9982cdfe` |
| V mode / 유효 V | `Baseline V: V1` / `V1@789a727 + ΔV1@7227dc0 + ΔV2@9982cdf` |
| 검증 기준 plan revision | `789a727:V1` · `7227dc0:ΔV1` · `9982cdf:ΔV2` |
| 라운드 | 1 |
| 상태 | **RETURN_TO_PLAN** — PLAN_GAP 2(G1·G2)와 BLOCKING 6(F1·F3~F7)이 함께 있다 |
| 자기 검증 여부 | 설계자 = 검증자(Claude), 구현자 = Codex. G1은 검증자 자신이 쓴 plan의 결함이다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋의 `plan.md` 변경: `[구현자 기입]` r1·r1.2 절 추가, 메타 상태 행, `[검증자 기입]` CI1~CI3 행만 바뀌었다(`git diff 9982cdfe..6fa83b39 -- docs/handoff/0282-plugin-catalog-native-sync/plan.md`).
- 기준선이 diff로 성립한다: 설계 커밋 3개(`789a727`·`7227dc0`·`9982cdf`)와 구현 커밋이 분리되어 있다.
- Decision Ledger, Product/UX, AC, V node/pair, §10 변경: 0건.
- 채점 기준: `9982cdf` 시점 plan 원문.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | V1 + ΔV1 + ΔV2를 commit 3개로 재구성할 수 있다 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | VP-01~04·07~12·14~24·28~32·23′ |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | VP-05·06·13·25~27·33·34 |
| §10 자리 목록(기록된 검색 재실행 차집합) | 유효 1건 정정 · **PLAN_GAP G1** | `9982cdfe`에서 재실행한 결과: EP-01 13 · EP-02 16 · EP-03a 17 · EP-03b 13 · EP-04 7 · EP-05 2 · EP-06 18 · EP-07 10 · EP-08 **7**(기록은 6, N1) · EP-09 3. 모든 목록의 구성 차집합은 0이다. EP-07에는 owner 없는 reset 자리가 없다(G1) |
| 필요한 pair의 선택적 적대 증거 | 유효 | VP-01·02·08·09·12·18·19·21·23·28·29·31 |
| `SUPERSEDED` pair 이관 | 유효 | VP-23 → VP-23′ 변이 승계(`plan.md:721`) |
| 현재 변경 운영 gate | 유효 | `plan.md:237` · `:469` · `:646` |

- root PLAN_GAP:
  - **G1** — D-017과 D-020은 "플러그인 변경 시 에이전트 캐시를 비우고 1회 재로드"한다고 정했다. 그런데 AC25와 AC28은 그 대상을 "열린 Composer"로 좁혔고, VP-21 path와 EP-07 Q4~Q11은 reset을 `owners.revalidate` → owner 이벤트로만 운반한다. Composer가 없을 때의 운반 계약(전역 revision 방송, 읽기 시 revision 대조 등)은 둘 다 유효한 설계라 구현자가 고를 수 없다. 영향 pair는 VP-18·21·28이다.
  - **G2** — AC20 on 경로는 기록 파일이 더 이상 실효 파일이 아닌 경우(외부에서 상위 우선순위 전역 파일 생성)를 정하지 않았다. 구현은 `global-plugins.ts:121-122`에서 throw한다. 영향 pair는 VP-18·19다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path · 판정 |
|---|---|---|
| D-001·D-017 | 에이전트 목록은 1회만 읽고, 플러그인 변경 시 1회 재로드 | `composerAgentCache` singleton → `composerCatalogState.read` → 재로드는 `owners.revalidate` → owner 이벤트. **Composer가 없으면 재로드가 전달되지 않는다(F1)** |
| D-002·D-006 | 네이티브 플러그인은 플러그인 탭으로 옮기고 스킬 탭에서는 그 스킬을 숨김 | `CustomizeList.tsx:51·59·242` ✅ |
| D-003·D-007 | off가 Composer `+`→스킬과 새 Query에 반영 | `extensionChoices` → `adapter.ts:445-458` · bootstrap reader 4곳 ✅ |
| D-004·D-005 | 기본 경로 스킬은 토글 없이 활성 | `scan.ts:73·78` · `CustomizeList.tsx:157` · `SkillDetail.tsx:89` ✅ |
| D-012~D-016 | OpenCode 플러그인 off는 파일·기록·확인·새 서버로 처리 | `extension-catalog.ts:61-66` → `global-plugins.ts` → `retireAll` ✅. 실효 파일이 바뀌면 다시 켤 수 없다(G2) |
| D-019~D-021 | 외부 제거는 비노출, 같은 fan-out | `opencode-global-watch.ts` → `bootstrap.ts:1222-1227` ✅. Composer가 없을 때 재로드는 F1과 같다 |
| D-010·D-011 | MCP 폴더 자동 생성 | `json-file.ts:9` ✅ |

```text
/plugins 행 토글 → useNativeMcpCatalog.toggle → orca:extensions:setEnabled
  → extension-catalog.ts:61 (OpenCode plugin) → confirm | change(set) → global-plugins.set
  → watch.notify → changed(rev) → extensionsChanged→retireAll + owners.revalidate(rev)
  → (owner 있음) composerCatalogInvalidated{revalidate} → cache.reset → 재준비
  → (owner 없음) 전달 없음 → 다음 Composer는 옛 캐시를 ready로 표시 (F1)
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ⚠️ | 끄는 일반 경로는 `/plugins` 라우트(`router.tsx:36`)라 Composer가 unmount되어 owner가 0이다. 재로드가 이루어지지 않는다(F1) |
| false success 가능성 | ⚠️ | 토글 응답은 `applied`인데 Composer 에이전트 메뉴에는 끈 플러그인 에이전트가 앱 재시작 전까지 남는다(F1) |
| partial failure/rollback | ✅ | off 파일 실패 시 기록 원복은 V19-rollback 잡음. on은 파일 → 기록 순서이고 V19-onorder 잡음 |
| A가 아닌 B 구현 | ⚠️ | 실효 파일이 바뀐 뒤 다시 켜면 throw하고 off 행이 영구히 남는다(G2·F2 재현) |
| 증상만 제거 | 없음 | Claude off는 새 Query마다 flag를 계산한다(`adapter.ts:439-458`) |
| 최적화가 잃은 재검증 | ⚠️ | 캐시가 재검증 관측을 owner 존재에 묶었다(F1) |
| 출력/요청 상한 | ✅ | revalidate는 owner마다 1회, renderer는 revision마다 1회 reset한다(V21-rev 잡음) |

## 3. 역방향 탐색

`bash .agents/skills/handoff-verify/scripts/scan-surface.sh 9982cdfe..6fa83b39` 결과: 대상 43파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| 1a `selectClaudePlugins` 등 8건 | 정상 | 같은 파일 내부 사용(`plugin-catalog.ts:146`) 또는 기존 `protocol.ts` export. 이번 변경과 무관 |
| 2 `ComposerAgentCache`·`ComposerCatalogState` | 정상 | production은 singleton `composerAgentCache`(`composerAgentCache.ts:36`)과 팩토리(`composerCatalogState.ts:183`)로 사용 |
| 2 `buildTurnContent`·`prepareComposerCatalog` 등 | 정상 | 기존 심볼이며 이번 diff가 바꾸지 않았다 |
| 3 형제 정책 비대칭 | 없음 | 스크립트 출력 0 |
| 신규 settings 키 소비처 | 무영향 | `openCodeDisabledPlugins`는 renderer 응답에서 빈 배열이고(V20-renderer 잡음) patch에서 제외된다(M24·V20-P14b 잡음) |
| producer ↔ consumer | **결함** | revalidate producer는 owner 단위이고 consumer 캐시는 renderer 전역이다(F1) |

## 4. 기존 테스트 / semantic 검증 확인

- 등록된 oracle 이름 48개 중 45개가 실재한다. 없는 3개(VP-28·VP-30·VP-23′)는 대체 테스트가 같은 행동을 관측한다(N2).
- 선택된 적대 증거 재측정 결과: 등록 변이 전부(VP-01·02·08·09·12·18·19·21·23·28·29·31)를 심었고 전부 잡음이다. 미검출은 재량 변이와 형제 맞바꿈에서만 나왔다.
- 이전 라운드 대조: 첫 verify라 해당 없음. 구현자 M01~M24에 대응하는 자리는 모두 다시 심어 잡음이었다.
- 형제 슬롯 맞바꿈: provider↔Orca(못 잡음, F4), OpenCode↔Claude 세션 필터(못 잡음, F5), agents↔models reset(잡음), user↔project(잡음).
- `N회` 관측: `composerCatalog` mock의 호출 수(`Module.integration.test.ts`)와 `revalidate` revision 배열 `[1,2,3]`(bootstrap 테스트).

**고장 이력** — 79건. 귀속은 VP 등록 변이와 재량 변이를 함께 표기한다.

| ID | `파일:줄` | 종류 | 바꾼 내용 | 범위 | 이번 결과 | 잡은 테스트 / 동치 근거 | 귀속 |
|---|---|---|---|---|---|---|---|
| M01 | `composerCatalogState.ts:109` | 제거 | agents 캐시 조기 반환 삭제 | composer 3파일 | 잡음 | `publishes the first agent success to concurrent scopes…` | VP-01 A2 등록 |
| M02 | `composerCatalogState.ts:45` | 고정값 | agentSlot → loading | 〃 | 잡음 | 14건 | VP-01 A1 등록 |
| M03 | `useComposerCatalog.ts:28` | 고정값 | 무-scope agents → pending | 〃 | 잡음 | `shows cached agents before the chat scope exists` | VP-03 A9 |
| M04 | `composerCatalogState.ts:97` | 다른 값 | 무효화 시 agents error | 〃 | 잡음 | `keeps cached agents through instance invalidation…` | VP-02 A3 등록 |
| M05 | `composerCatalogState.ts:61` | 다른 값 | revision reset 때 models도 loading | 〃 | 잡음 | `resets agents once per revision…keeping models` | VP-21 등록 |
| M06 | `composerAgentCache.ts:25` | 뒤집기 | `<=` → `>` | 〃 | 잡음 | 6건 | VP-21 등록 |
| M07 | `composerAgentCache.ts:25` | 다른 값 | `<=` → `<` | 〃 | 잡음 | `resets once for a newer revision…` | VP-24 |
| M08 | `composerCatalogState.ts:69` | 제거 | `agents.reset` 호출 삭제 | 〃 | 잡음 | `resets agents once per revision…` | VP-21 Q10 |
| **M09** | `composerCatalogState.ts:53` | 제거 | subscribe 시 agentSlot 재파생 삭제 | 〃 | **못 잡음** | 스크래치 재현: 생성 후 subscribe 전 reset → 원본 green·변이 red(옛 agents ready·재요청 0) | VP-01/03 A2 → **F7** |
| M10 | `composerCatalogState.ts:40` | 제거 | 생성자 agentSlot 삭제 | 〃 | 잡음 | `publishes the first agent success…` | VP-03 A1 |
| M11 | `composerCatalogState.ts:53` | 고정값 | subscribe 시 agents loading | 〃 | 동치 | `:79` `read('agents')`가 두 캐시 상태 모두에서 즉시 재파생. 스크래치 reset 시나리오도 green | VP-01 A2 |
| M12 | `composerCatalogState.ts:143` | 제거 | 성공 시 `accept` 삭제 | 〃 | 잡음 | 14건 | VP-01 A7 |
| M13 | `composerCatalogState.ts:143` | 빈 값 | `accept(value)` revision 생략 | 〃 | 동치 | reset 때 캐시 구독자(`:54-58`)가 epoch를 올려 `:123`이 늦은 응답을 먼저 버린다. 스크래치 확인 green | VP-21 |
| M14 | `composerCatalogState.ts:130` | 제거 | 취소 시 캐시 유지 분기 삭제 | 〃 | 잡음 | `keeps the first cached agents when…cancelled/error` | VP-02 A6 |
| M15 | `composerCatalogState.ts:155` | 제거 | 실패 시 캐시 유지 분기 삭제 | 〃 | 잡음 | `…ends as reject` | VP-02 A8 |
| M16 | `composerAgentCache.ts:18` | 제거 | 첫 값 보존 조건 삭제 | 〃 | 잡음 | `keeps the first accepted list…` | VP-04 |
| M17 | `CustomizeList.tsx:59` | 맞바꿈 | providers↔mcp kind | customize 3파일 | 잡음 | 4건 | VP-08 R1 등록 |
| M18 | `CustomizeList.tsx:242` | 제거 | 플러그인 탭 nativeList 삭제 | 〃 | 잡음 | `orders Claude then OpenCode…` | VP-08 R3/R4 등록 |
| M19 | `CustomizeList.tsx:61` | 뒤집기 | Claude/OpenCode 정렬 | 〃 | 잡음 | 4건 | VP-08 |
| M20 | `CustomizeList.tsx:51` | 제거 | plugin 스킬 필터 | 〃 | 잡음 | `hides native plugin skills from the skills tab` | VP-07 K1 |
| **M21** | `CustomizeList.tsx:59` | 제거 | `tab !== 'skills' &&` 삭제 → 스킬 탭 빈 상태가 네이티브 MCP로 가려짐 | 〃 | **못 잡음** | 스크래치 재현: 빈 스킬 + 네이티브 MCP → 원본 `role=status`, 변이는 없음 | VP-08 R1/R2 → **F3** |
| M22 | `CustomizeList.tsx:157` | 고정값 | 스킬 토글 항상 렌더 | 〃 | 잡음 | `renders switches only for Orca skills` | VP-14 K3 |
| M23 | `ExtensionsCatalogView.tsx:140` | 제거 | 실패 배너 탭 게이트 | 〃 | 잡음 | `scopes native loading and failure…` | VP-07 R5 |
| M24 | `ExtensionsCatalogView.tsx:151` | 제거 | 로딩 탭 게이트 | 〃 | 잡음 | 〃 | VP-07 R6 |
| **M25** | `ExtensionsCatalogView.tsx:162` | 제거 | `suppressEmpty` 탭 게이트 | 〃 | **못 잡음** | 17건 전건 green | VP-07 R7 → **F3** |
| M26 | `SkillDetail.tsx:89` | 고정값 | 상세 토글 항상 | 〃 | 잡음 | `renders no switch for default-path skills` | VP-14 K5 |
| M27 | `SkillDetail.tsx:87` | 다른 값 | `!canToggle`이면 제목 회색 | 〃 | 잡음 | 〃 | VP-14 K4 |
| M28 | `CustomizeList.tsx:157` | 맞바꿈 | `canToggle` → `enabled` | 〃 | 잡음 | 3건 | VP-14 K2/K3 |
| M29 | `extension-sources.ts:28` | 다른 값 | `plugin:claude`만 | 〃 | 잡음 | 2건 | VP-07 K1 |
| M30 | `adapter.ts:487` | 호출 대체 | 첫 계산 plugins를 owned에 고정(스냅샷 회귀) | bootstrap·reader + win32 adapter | 잡음 | `carries catalog changes…` · `applies current global plugin choices…` | VP-09 C1 등록 |
| M31 | `bootstrap.ts:1147` | 빈 값 | 초안 명령 choices `{}` | 〃 | 잡음 | `applies nav plugin choices to draft…` | VP-09 C12 등록 |
| M32 | `bootstrap.ts:1157` | 빈 값 | 초안 리소스 choices | 〃 | 잡음 | 〃 | VP-09 C13 |
| M33 | `bootstrap.ts:1095` | 빈 값 | 세션 리소스 choices | 〃 | 잡음 | 〃 | VP-09 C10 |
| M34 | `bootstrap.ts:1129` | 빈 값 | 세션 명령 choices | 〃 | 잡음 | 〃 | VP-09 C11 |
| M35 | `configured-resources.ts:105` | 뒤집기 | Orca↔project | 〃 | 잡음 | `applies Orca plugin choices above user defaults and below project…` | VP-09 C5 등록 |
| M36 | `configured-resources.ts:104-106` | 맞바꿈 | user↔project | 〃 | 잡음 | 3건 | VP-12 등록 |
| M37 | `plugin-catalog.ts:226` | 빈 값 | 명령 reader choices | 〃 | 잡음 | `applies nav plugin choices…` | VP-12 C4 |
| M38 | `extension-control.ts:20` | 고정값 | prefix → `'plugin:'` | 〃 | 잡음 | `maps only one kind of choice…` | VP-12 C15 |
| M39 | `module.ts:40` | 빈 값 | Claude module choices | 〃 | 잡음 | `applies nav plugin choices…` | VP-11 C6 |
| M40 | `plugin-catalog.ts:138` | 뒤집기 | overrides를 project 뒤로 | 〃(두 설정) | 잡음 | 3건 + win32 2건 | VP-12 C4 |
| **M41** | `adapter.ts:452-453` | 맞바꿈 | provider enabledPlugins ↔ Orca flags 우선순위 | win32 adapter | **못 잡음** | 7건 green. 테스트에 같은 키를 가진 provider·Orca 입력이 없다 | VP-10/09 C1 → **F4** |
| M42 | `configured-resources.ts:151` | 제거 | 설치 폴더 존재 검사 | bootstrap·reader | 잡음 | `omits installations whose directory no longer exists` | VP-28 E2 등록 |
| M43 | `plugin-catalog.ts:160` | 고정값 | 존재 검사 → false | 〃 | 잡음 | `selects active installations…` | VP-32 E4 |
| M44 | `extension-catalog.ts:64` | 고정값 | 확인 검사 → false | handler·bootstrap·view | 잡음 | `requires confirmation…` | VP-18 등록 |
| M45 | `extension-catalog.ts:64` | 다른 값 | `> 0` → `> 1` | 〃 | 잡음 | `routes OpenCode plugin toggles…` | VP-18 |
| M46 | `extension-catalog.ts:61` | 맞바꿈 | opencode↔claude 분기 | 〃 | 잡음 | 5건 | VP-18 등록 |
| M47 | `extension-catalog.ts:38` | 제거 | OpenCode plugin 메모리 선택 제외 | 〃 | 잡음 | `requires confirmation…` | VP-18 P6 |
| M48 | `extension-catalog.ts:31` | 빈 값 | 기록 행 `[]` | 〃 | 잡음 | `routes OpenCode plugin toggles…` | VP-18 P6 |
| M49 | `extension-catalog.ts:66` | 호출 대체 | fan-out 우회 | 〃 | 잡음 | 〃 | VP-33 |
| **M50** | `bootstrap.ts:1241` | 맞바꿈 | 세션 필터 opencode → claude | 〃 | **못 잡음** | 22건 green. fixture가 OpenCode 1·Claude 1이라 두 값이 모두 1(`bootstrap.native-history.test.ts:781-787`) | VP-20 P9 → **F5** |
| M51 | `global-plugins.ts:25` | 맞바꿈 | json↔jsonc 순서 | OpenCode 8파일 | 잡음 | 2건 | VP-23 등록 |
| M52 | `configured-resources.ts:73`(opencode) | 고정값 | 전역 파일 합집합 | 〃 | 잡음 | `marks only plugins declared by the effective…` | VP-23 P2 |
| M53 | `configured-resources.ts:124`(opencode) | 제거 | 설치본 조건 | 〃 | 잡음 | 2건 | VP-23′ |
| M54 | `configured-resources.ts:124`(opencode) | 제거 | plugin canToggle 전체 | 〃 | 잡음 | 3건 | VP-23 P5 |
| M55 | `global-plugins.ts:144` | 제거 | off 실패 원복 | 〃 | 잡음 | `rolls back the record…` | VP-19 등록 |
| M56 | `global-plugins.ts:140` | 제거 | 기록 선행 쓰기 | 〃 | 잡음 | 5건 | VP-19 등록 |
| M57 | `global-plugins.ts:129` | 뒤집기 | on 기록 정리를 파일 앞으로 | 〃 | 잡음 | `records before removing…` | VP-19 등록 |
| M58 | `global-plugins.ts:83` | 제거 | 설치본 부재 건너뛰기 | 〃 | 잡음 | `shows a record only while its installation exists…` | VP-31/28 X5 등록 |
| M59 | `global-plugins.ts:81` | 제거 | 선언된 spec 건너뛰기 | 〃 | 잡음 | 2건 | VP-31 등록 |
| M60 | `global-plugins.ts:51-52` | 다른 값 | fingerprint = 파일 이름 | 〃 | 잡음 | `derives the fingerprint only…` | VP-31 X2 |
| M61 | `opencode-global-watch.ts:46` | 제거 | fingerprint 비교 | 〃 | 잡음 | 3건 | VP-29 등록 |
| M62 | `opencode-global-watch.ts:29` | 제거 | watchFile 등록 | 〃 | 잡음 | 2건 | VP-29 등록 |
| M63 | `opencode-global-watch.ts:44` | 제거 | reconcile | 〃 | 잡음 | `clears a record when the plugin is re-added…` | VP-29 |
| M64 | `opencode-global-watch.ts:60` | 제거 | 자기 쓰기 뒤 notify | 〃 | 잡음 | `routes OpenCode plugin toggles…` | VP-30 X4 |
| M65 | `bootstrap.ts:887` | 제거 | shutdown `close()` | 〃 | 잡음 | 〃 | VP-30 X3 |
| **M66** | `bootstrap.ts:181` | 제거 | prepareShutdown `drain()` | 〃 | **못 잡음** | 92건 green | 고정 목록 밖 → **F6** |
| M67 | `bootstrap.ts:1226` | 제거 | composer revalidate | 〃 | 잡음 | `routes OpenCode plugin toggles…` | VP-30 X6 |
| M68 | `bootstrap.ts:1225` | 제거 | `extensionsChanged` | 〃 | 잡음 | 〃 | VP-30 |
| M69 | `opencode/v1/adapter.ts:55` | 제거 | `retireAll` 호출 | 〃 | 잡음 | `starts a new server for new owners after retireAll…` | VP-21 Q12 |
| M70 | `server.ts:170` | 제거 | `entries.clear()` | 〃 | 잡음 | 〃 | VP-21 Q2 |
| M71 | `composer-catalog-owner.ts:152` | 제거 | revalidate 때 release | 〃 | 잡음 | `revalidates every OpenCode owner…` | VP-21 Q4 |
| M72 | `composer-catalog-owner.ts:153` | 빈 값 | revalidate 필드 생략 | 〃 | 잡음 | 〃 | VP-21 Q9 |
| M73 | `settings.ts:15` | 제거 | renderer 응답 기록 비움 | settings 2파일 | 잡음 | `keeps plugin restoration options…` | VP-20 P14 |
| M74 | `ipc.ts:1164` | 제거 | SettingsPatch 제외 키 | `npm run typecheck` | 잡음 | `openCodePluginRecord.testfixture.ts:5` TS2578 | 구현자 M24 재실행 |
| M75 | `protocol.ts:844` | 다른 값 | PatchSchema에 기록 필드 추가 | settings 4파일 | 잡음 | `persists plugin restoration records…` | VP-20 P14b |
| M76 | `scan.ts:73` | 다른 값 | adapter:claude 저장값 복귀 | skills 6파일 | 잡음 | 2건 | VP-15 S1 |
| M77 | `scan.ts:78` | 다른 값 | adapter:claude canToggle | 〃 | 잡음 | 2건 | VP-15 S2 |
| M78 | `scan.ts:78` | 다른 값 | agents canToggle | 〃 | 잡음 | `assembles the real catalog…` | VP-14 |
| M79 | `json-file.ts:9` | 제거 | mkdir | json·mcp 2파일 | 잡음 | 2건 | VP-16/17 J1 |

- 검산: 시도 79 = 잡음 71 · 못 잡음 6(M09·M21·M25·M41·M50·M66) · 동치 2(M11·M13).
- win32 전용 스위트(`adapter.native-plugins.test.ts`)는 `process.platform = 'win32'`와 `TEMP=/tmp`를 주입한 임시 vitest 설정으로 돌렸다. 원본 7/7 green이다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 증거 · 근거 |
|---|---|---|---|---|
| VP-04·24 | UT | REQUIRED | PASS | `composerAgentCache.test.ts` 2건 · M06·M07·M16 잡음 |
| VP-12 | UT | REQUIRED | PASS | `extension-control.test.ts` · `configured-resources.test.ts` · M36~M38·M40 잡음 |
| VP-15·17 | UT | REQUIRED | PASS | `scan.test.ts` · `json-file.test.ts` · M76·M77·M79 잡음 |
| VP-22 | UT | REQUIRED | PASS | `global-plugins.test.ts:removes and reinserts string and tuple entries…` |
| VP-23′ | UT | REQUIRED | PASS | `configured-resources.test.ts`(opencode) 2건 · M51~M54 잡음. 등록 이름 대체(N2) |
| VP-31·32 | UT | REQUIRED | PASS | `global-plugins.test.ts` fingerprint·record · `configured-resources.test.ts` 존재 검사 · M43·M58~M60 잡음 |
| **VP-03** | IT | REQUIRED | **PAIR_FAIL** | EP-01 A2(`composerCatalogState.ts:53`) 미잠금(M09, F7) |
| **VP-08** | IT | REQUIRED | **PAIR_FAIL** | EP-03a R1/R2(`CustomizeList.tsx:59·69`) 스킬 탭 빈 상태 미잠금(M21, F3) |
| VP-11 | IT | REQUIRED | PASS | `bootstrap.native-history.test.ts` · M39 잡음 |
| **VP-20** | IT | REQUIRED | **PAIR_FAIL** | EP-06 P9(`bootstrap.ts:1241`) 세션 필터 미잠금(M50, F5) |
| VP-21 | IT | REQUIRED | PASS(기재 path 한정) | server·owners·state 3좌표 · M05·M06·M08·M69~M72 잡음. owner 없는 edge는 G1 |
| VP-30 | IT | REQUIRED | PASS(고정 X3·X6·X7) | `routes OpenCode plugin toggles…` · M64·M65·M67·M68 잡음. 목록 밖 drain은 F6 |
| VP-02 | ST | REQUIRED | PASS | `composerCatalogState.test.ts` 3건 · M04·M14·M15 잡음 |
| VP-05·27 | ST | REGRESSION | PASS | 기존 5건 + models 유지 단언 · M05 잡음 |
| VP-06 | ST | REGRESSION | PASS | `adapter.persistent.test.ts:passes a live plugin agent…` |
| **VP-10** | ST | REQUIRED | **PAIR_FAIL** | EP-02 C1(`adapter.ts:452-453`) provider↔Orca 우선순위 미잠금(M41, F4) |
| VP-13 | ST | REGRESSION | PASS | `native-resource-sharing.test.ts` · `Composer.native-menu.test.ts` |
| VP-19 | ST | REQUIRED | PASS | `global-plugins.test.ts` 4건 · M55~M57 잡음 |
| VP-29 | ST | REQUIRED | PASS | `opencode-global-watch.test.ts` 2건 · M61~M63 잡음 |
| **VP-01** | AT | REQUIRED | **PAIR_FAIL** | VP-03과 같은 A2 자리(F7) |
| **VP-07** | AT | REQUIRED | **PAIR_FAIL** | R2(M21)·R7(M25) 미잠금(F3) |
| **VP-09** | AT | REQUIRED | **PAIR_FAIL** | VP-10과 같은 C1 자리(F4). 나머지 14자리는 M30~M35·M37·M39 잡음 |
| VP-14·16 | AT | REQUIRED | PASS | M22·M26~M28·M78·M79 잡음 · `store.fresh-root.test.ts` |
| **VP-18** | AT | REQUIRED | **PAIR_FAIL** | AC25 ❌(F1, D-017) · AC26 사람 실기 미실행 |
| VP-25·26·33·34 | AT | REGRESSION | PASS | T-list canToggle · `reuses the first successful agent list…` · M49 잡음 · bootstrap 초안 |
| **VP-28** | AT | REQUIRED | **PAIR_FAIL** | AC28 ❌(F1, D-020). Claude·OpenCode 비노출 자리는 M42·M43·M58 잡음 |

- root PAIR_FAIL: F7(VP-03), F3(VP-08·07), F4(VP-10), F5(VP-20), F1(VP-18·28). 공유 자리로 함께 실패한 pair: VP-01(F7), VP-09(F4).
- 합계: 34 pair = PASS 25 · PAIR_FAIL 9 · BLOCKED_BY 0.
- 실행 범위: 첫 verify이므로 유효 V의 REQUIRED/REGRESSION 전건을 실행했다.
- 좌표의 실행 구간:
  - renderer 좌표는 `shared/api/ipc`만 mock하고 실제 state·cache·hook·컴포넌트를 실행한다.
  - main 좌표는 실제 bootstrap handler·reader·임시 파일 루트를 쓴다.
  - F4·F5는 운반 값이 형제 값과 구별되게 채워지지 않은 자리다.

### AT / AC 세부와 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1·AC2·AC3 | ✅ | `Module.integration.test.ts` · `composerCatalogState.test.ts` |
| AC4 | ✅ | VP-06 |
| AC5·AC6 | ✅ | `ExtensionsCatalogView.interaction.test.ts` 2건 · M17~M19 |
| AC7 | ⚠️ | 동작은 맞다. 스킬 탭 빈 상태가 네이티브 상태로 가려지는 R2·R7은 잠기지 않았다(F3) |
| AC8~AC12 | ✅ | M30~M39 잡음 |
| AC13~AC17 | ✅ | M22·M26~M28·M76~M79 잡음 |
| AC18 | ⚠️ | 사람 실기 미실행 |
| AC19~AC22 | ✅ | M44~M59 잡음 |
| AC23 | ⚠️ | handler는 잠겼다. bootstrap 세션 backend 필터는 미잠금(F5) |
| AC24 | ✅ | M69·M70 |
| AC25 | ❌ | 적용 뒤 새로 연 Composer가 옛 캐시를 표시한다(F1). D-017 기준 |
| AC26 | ⚠️ | 사람 실기 미실행 |
| AC27 | ✅ | M42·M43 |
| AC28 | ❌ | 외부 변경 시점에 Composer가 없으면 재로드되지 않는다(F1). D-020 기준 |
| AC29·AC30 | ✅ | M58·M61·M63 |

- 합계 재측정: ✅ 24 · ⚠️ 4 · ❌ 2 = 30.
- 자기보고(본문·trailer 2개·INDEX)는 모두 `28/30`이다. 사본끼리는 일치하지만 재측정값과 갈린다.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| `npm run lint` | PASS | 0 error · 2 warning(`Timeline.tsx:49`·`useTranscriptVirtualizer.ts:22`, diff 밖 기존). 트리 변경 0 |
| `npm run typecheck` | PASS | node·web·test 3구성 |
| 관련 vitest(plan §19 + ΔV1·ΔV2 스위트) | 환경 한계 분리 후 PASS | head 234파일·2409건: 2215 pass · 188 fail · 6 skip. 같은 명령의 base(`9982cdfe` worktree)는 225파일·2366건: 2172 pass · 188 fail. 실패 이름 171종이 양쪽 동일(차집합 0) |
| 실패 서명 | 환경 | better-sqlite3 바인딩 미빌드 80줄 · `process.platform==='win32'` 분기 4건(`native-resources.ts:39-40`) · Windows 경로 fixture. 신규 테스트의 실패 0 |
| `check-doc-inventory --check` | PASS | `9 items, 113 channels` · prose ok · links ok |
| CI `gate` | PASS | run `39917800268` job `120295461391`, head `6fa83b39` |

## 8. 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC18 | AC1·AC5·AC8 로직 | Windows 앱: superpowers off → 새 세션 `/context`에 없음 · 플러그인 탭 white/dark · 랜딩 전환 시 스피너 없음 |
| AC26 | AC19~AC24 로직 | Windows: 실제 OpenCode 플러그인 off → 새 세션에 플러그인 에이전트·스킬 없음 · 전역 파일 주석 보존 · 대화상자 문구 |

## 9. 게이트 재실행 메모

- 실행 명령: `cd app && npm run lint && npm run typecheck` · `./node_modules/.bin/vitest run <plan §19·:469·:646 스위트 + 변경 테스트 28파일>` · `node scripts/check-doc-inventory.mjs --check`. `npm test`는 쓰지 않았다(DB 동작이 검증 대상이 아님).
- 환경 복구 잔여물:
  - `node_modules/jsonc-parser`는 lock의 integrity와 일치하는 3.3.1 tarball로 설치했다.
  - `node_modules/electron/dist`는 `install.js`로 설치했다.
  - 둘 다 추적 밖이다.
- 정리한 임시 산출물: 스크래치 테스트 5개, 임시 vitest 설정, base worktree. 정리 후 `git status` 출력 0.

## 11. Repository operation checks

- trailer 파싱: `1ea950b4`·`6fa83b39` 모두 `Agent`·`Handoff`·`Status`·`Criteria-*`·`Verified-By`를 반환한다.
- 대상 커밋 좌표: `git cat-file -t`로 `1ea950b4`·`6fa83b39` = commit을 확인하고 INDEX에 기입했다.
- `[구현자 기입]` 7필드: r1(`plan.md:765-965`)과 r1.2(`:976-1093`) 각각 7절 전부 있다.
- INDEX 비고는 5줄 이내로 갱신했다.

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | 후속 |
|---|---|---|---|---|
| G1 | owner가 없으면 플러그인 revision이 renderer 캐시에 닿지 않는다. AC25·AC28의 "열린"은 D-017·D-020보다 좁다 | D-017·D-020 · VP-18·21·28 · EP-07 | PLAN_GAP | 설계자: 전달 계약 선택 → AC·EP-07 자리·pair 정정 |
| G2 | 실효 파일이 바뀐 뒤 on 동작이 정의되지 않았다. 현재는 throw하고 off 행이 영구히 남는다(F2 재현) | AC20 · D-014 · VP-18·19 | PLAN_GAP | 설계자: 제품 동작 결정(사용자 확인 필요) |
| F1 | 앱 첫 로드 뒤 `/plugins`에서 토글하거나 외부에서 변경하면 Composer에 옛 에이전트가 남는다. 스크래치 재현: main `revalidate` 전달 0 · renderer 새 state의 agents 요청 0 | D-017·D-020 · AC25·AC28 | BLOCKING | G1 정정 후 구현 |
| F3 | 스킬 탭 빈 상태가 네이티브 행·실패로 가려지는 회귀가 잠기지 않았다(M21·M25) | VP-07·08 · EP-03a R1/R2·R7 | BLOCKING | 빈 스킬 + 네이티브 MCP/실패 입력에서 `role=status` 단언 |
| F4 | provider `enabledPlugins`와 Orca flag가 같은 키일 때의 우선순위가 잠기지 않았다(M41) | VP-10·09 · EP-02 C1 · `plan.md:362` | BLOCKING | 충돌 키 입력으로 Orca 값 우선을 단언 |
| F5 | OpenCode 세션 수 필터가 잠기지 않았다(M50) | VP-20 · EP-06 P9 · AC23 | BLOCKING | backend별 개수가 다른 fixture |
| F6 | prepareShutdown의 watch drain이 잠기지 않았다(M66) | 고정 목록 밖 · VP-30 path | BLOCKING | 종료 중 진행 토글이 파일 mutation 종료보다 먼저 끝남을 단언 |
| F7 | 생성 뒤 첫 subscribe 전에 reset되면 옛 agents를 ready로 보고 재요청하지 않는 회귀가 잠기지 않았다(M09) | VP-03·01 · EP-01 A2 | BLOCKING | 생성 → reset → subscribe 순서 테스트 |
| N1 | EP-08 기록 줄 수 6 ↔ 실측 7(E3가 2줄). 구성 차집합 0 | §10 기록 | NON_BLOCKING | 설계자 정정 |
| N2 | 등록 oracle 이름 3개 부재. 대체 테스트가 행동을 관측(M42·M53·M64~M68) | VP-23′·28·30 | NON_BLOCKING | 구현 보고에 대체 이름 명시 |
| N3 | Claude 플러그인 제어 4건은 win32에서만 실행된다. Linux 로컬 gate가 보지 못한다(base 동일) | `native-resources.ts:39-40` | NON_BLOCKING | 기록 |
| CI1~CI3 | 구현자 행 | 필수 Test gate | closed | CI run `39917800268` gate success |

## 14. Review Signals — 사실만

- 이전 라운드와 같은 증상: 해당 없음(첫 verify).
- 관련 plan 지침: D-017·D-020이 있었다. AC25·AC28 문장이 "열린 Composer"로 좁았고 §3 대조 줄은 "충돌 0"으로 적었다(`plan.md:73`).
- 사용자 결정 변경 근거: 없음.
- 반복된 환경 한계: better-sqlite3 바인딩 부재, win32 전용 분기, Electron 바이너리 미설치(이번에 복구).

## 15. 결론

- 상태: **RETURN_TO_PLAN** — verify 1회째.
- pair: PASS 25 · PAIR_FAIL 9(root 5 finding) · BLOCKED_BY 0.
- PLAN_GAP: G1(VP-18·21·28) · G2(VP-18·19).
- ACTIVE Decision: D-017·D-020 미충족(F1). 나머지 결정은 충족한다.
- AC: ✅ 24 · ⚠️ 4 · ❌ 2.
- 운영 gate: lint·typecheck·doc inventory·CI PASS. 관련 vitest는 환경 실패가 base와 동일하다.
- 다음 단계:
  - 설계자가 ΔV3로 G1·G2와 N1을 정정한다. G2는 제품 동작이라 사용자 확인이 필요하다.
  - 그다음 구현자가 F1·F3~F7을 고친다.

---

# r2 — 2026-10-24

r1 판정과 근거는 위 본문에 그대로 둔다. 이 절은 r2만 판정한다.

## r2 메타

| 항목 | 값 |
|---|---|
| 대상 커밋/range | `c1481dad..5084fa7c` (r2 `dc50d1bc` · r2.2 `5084fa7c`) |
| 구현 전 plan 기준 | `c1481dad` |
| V mode / 유효 V | `V1@789a727 + ΔV1@7227dc0 + ΔV2@9982cdf + ΔV3@3660d97b + ΔV5@80127c7c + ΔV6@2a6096a2` · D-036 기록 `c1481dad`. ΔV4(`fde5537d`·`1b8d636f`·`dd1a46bf`)는 ΔV5가 대체 |
| 라운드 | 2 |
| 상태 | **PASS (기계 범위)** — pair 33 PASS · PLAN_GAP 0 · BLOCKING 0. AC18 사람 실기 대기 |
| 자기 검증 여부 | 구현자 = Codex(두 커밋 trailer `Agent: codex`). ΔV3·ΔV5·ΔV6 설계자 = 검증자(Claude)라 plan validity는 자기 설계 감사다 |

## r2-0. 기준선 / plan validity

- 구현 커밋의 `plan.md` 변경은 메타 상태 1줄(`:11`)과 `[구현자 기입]` r2·r2.2 추가(`:1609` 이후)뿐이다(`git diff -U0 c1481dad..5084fa7c -- plan.md` hunk 2개).
- Decision Ledger, Product/UX, AC, V node/pair, §10 변경 0건. 채점 기준은 `c1481dad` 시점 plan 원문이다.

| 검사 | 판정 | 근거 |
|---|---|---|
| Delta V 적용 순서·상속 기준 | 유효 | 설계 커밋 6개를 순서대로 재구성할 수 있다. ΔV4 대체는 ΔV5 본문에 있다 |
| NEW/CHANGED ↔ REQUIRED, 영향 INHERITED ↔ REGRESSION | 유효 | REQUIRED 25 · REGRESSION 8 = 33 pair |
| `SUPERSEDED` 이관 | 유효 | VP-04·24→VP-04′, VP-18′→VP-18″, VP-28′→VP-28″, VP-19·20·22·25·33 폐기 근거와 EP-10 음성 게이트(`plan.md:1092-1102`) |
| §10 자리 목록 재검색 | 유효 — 검색 − (목록 ∪ 기록된 제외·이관) 차집합 0 | 아래 표 |
| G1·G2 (r1 PLAN_GAP) | 닫힘 | G1 = ΔV3 전역 revision 방송·store 구독. G2 = ΔV5가 OpenCode 플러그인 쓰기 경로 자체를 삭제 |

| EP | 기록된 명령 재실행(`5084fa7c`) | 판정 |
|---|---|---|
| EP-01′ | 31줄 = A1~A15 21 · 제외 5(`composerCatalogState.ts:91·94·95·96·101`) · EP-07′ 이관 5(`:38·54·113·139` · `useComposerCatalog.ts:25`) | 차집합 0 |
| EP-02 | 15줄 = C1·C2(2)·C4~C14 · 제외 `adapter.ts:475` | 차집합 0. C3는 r1에서 C1로 합쳐졌고 C15는 검색 파일 밖 helper(N4) |
| EP-03a · EP-03b | 17 · 14줄 | 차집합 0. EP-03b +1은 `CustomizeList.tsx:52-53` 줄바꿈 |
| EP-04 · EP-05 · EP-09 | 7 · 2 · 3줄 | 차집합 0 |
| EP-07′ | 12줄 = W1·W2·W4·W5·W10·W12·W13 + EP-01′ 이관 5 | 차집합 0. W6~W8·W11 삭제는 `revalidate` 0건으로 확인 |
| EP-08 | 6줄 = E1·E2·E3(2) · 제외 `plugin-catalog.ts:25·69` | 차집합 0. E4는 helper 이름 변경으로 검색에 안 걸린다(N4) |
| EP-10 | 음성 게이트 0건(`app/src`·`package*.json`·TRD·IPC_CONTRACT·arch·`app/AGENTS.md`, 테스트 포함) · `nativeFileMutations` 0건 | 0건 = 전수. 엄격화(저장소 전체, 이력 디렉터리 제외) 0건 |
| EP-11 | 13줄 = S1 1 · S2 1 · S3 1 · S4 2 · S5 2 · S6 2 · S7 2 · S8 1 · 타입 fixture 1 | 차집합 0 |

## r2-1. Product & UX / ACTIVE Decision

| Decision / 요구 | 실제 production path | 판정 |
|---|---|---|
| D-001·D-017·D-020 (에이전트 1회 로드, 플러그인 변경 시 Composer 유무와 무관하게 1회 재로드) | watch `changed(++revision)` → `bootstrap.ts:1223` `extensionsChanged`(retireAll) → `:1224` broadcast → preload `:277` → `ipc.ts:238` → `composerAgentStore.ts:31` invalidate → 다음 read | ✅ F1 해소. owner 없이도 store가 비워진다 |
| D-002·D-006 · D-004·D-005 · D-010·D-011 | r1과 같은 경로. r2 diff는 CustomizeList·scan·json-file을 바꾸지 않았다 | ✅ |
| D-003·D-007 (Claude off → 새 Query·초안) | `adapter.ts:444-452` provider 위에 Orca flag · bootstrap reader 4곳 | ✅ F4 해소(C41 잡음) |
| ΔV5 (Orca는 OpenCode 플러그인을 제어하지 않음) | `configured-resources.ts:120` `canToggle: item.kind === 'mcp'` · handler가 `canToggle`로 거절 · 쓰기 코드 0 | ✅ |
| ΔV6 (명시 선택 재시작 유지, renderer patch 불가, legacy 1회 비움) | `extension-control.ts:14·19` 저장 port → `bootstrap.ts:173-175` → `settings-store.ts:57` · `settings-migration.ts:52` · `ipc.ts:1164` | ✅ |
| D-036 (Claude 프로젝트 토글 현행 유지) | 변경 없음 | ✅ |

## r2-2. 구현 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 실패 방식 · false success | ✅ | 저장 실패 시 메모리 선택을 바꾸지 않는다(`extension-control.ts:19-20`, E04 잡음) |
| 부분 실패 잔여 | ✅ | 네이티브 파일 쓰기가 없다. 두 설정 파일 바이트 동일을 `restores global choices…`가 단언한다 |
| 동시성 · 늦은 응답 | ✅ | revision 변경 시 epoch 증가로 이전 응답을 버린다(`composerCatalogState.ts:57·119`) |
| 캐시가 재검증을 잃었는가 | ✅ | store 구독이 Composer 수명과 분리됐다(A08·W20 잡음) |
| fan-out 상한 | ✅ | 외부 변경 1회당 broadcast 1회, store는 큰 revision만 받는다(A06·A07·D61 잡음) |

## r2-3. 역방향 탐색

`scan-surface.sh c1481dad..5084fa7c` 결과 31파일.

| 후보 | 판정 | 근거 |
|---|---|---|
| `openCodePluginConfig.ts:39` `pluginSpec` 소비자 0 | 결함(경미) | `c1481dad`의 소비자 5곳(`global-plugins.ts`)이 ΔV5 삭제로 사라졌다. `configured-resources.ts:75`는 같은 규칙을 인라인으로 둔다(N5) |
| `createComposerAgentStore`·`ComposerCatalogState` "테스트에만" | 정상 | 같은 파일의 production singleton·factory가 사용(`composerAgentStore.ts:35`) |
| `rejectedNativeChoicePatch` | 정상 | 타입 음성 fixture(E13 TS2578) |
| 그 밖 1a·1b·2 항목 | 무관 | 이번 diff가 바꾸지 않은 기존 심볼 |
| 형제 정책 비대칭 | 없음 | 스크립트 출력 0 |
| r2.2 테스트 하네스 수정 4파일 | 정상 | 단언 약화 없음. `bootstrap.harness.test.ts`는 빈 선택 단언을 복원 선택값 단언으로 강화 |

## r2-4. 고장 이력 (r2)

- 하네스: 파일 한 곳을 정확히 1회 치환 → 관련 스위트 실행 → 원복 → `git diff` 0 확인. 기준선 실패가 있는 스위트는 기준선 실패 이름과의 차집합만 센다.
- win32 전용 `adapter.native-plugins.test.ts`는 `process.platform='win32'`·`TEMP=/tmp` 임시 설정으로 돌렸다(`-w`). 원본 7/7 green.
- 시도 85 = 잡음 82 · 동치 3 · 못 잡음 0.

| ID | `파일:줄` | 종류 | 바꾼 내용 | r1 | 결과 | 잡은 테스트 / 동치 근거 |
|---|---|---|---|---|---|---|
| A01 | `composerCatalogState.ts:105` | 제거 | agents 캐시 조기 반환 | M01 | 잡음 | `publishes the first agent success to concurrent scopes…` |
| A02 | `:45` | 고정값 | agentSlot → loading | M02 | 잡음 | 17건 |
| A03 | `useComposerCatalog.ts:29` | 고정값 | 무-scope agents → pending | M03 | 잡음 | `shows cached agents before the chat scope exists` |
| A04 | `:93` | 다른 값 | 인스턴스 무효화 때 agents error | M04 | 잡음 | `keeps cached agents through instance invalidation…` 등 2건 |
| A05 | `:61` | 다른 값 | revision 변경 때 models도 loading | M05 | 잡음 | `refreshes subscribed parts once per plugin revision while keeping models` |
| A06 | `composerAgentStore.ts:27` | 뒤집기 | `<=` → `>` | M06 | 잡음 | 10건 |
| A07 | `:27` | 다른 값 | `<=` → `<` | M07 | 잡음 | `invalidates only for a newer revision…` |
| A08 | `:31` | 제거 | 생성 시 구독(F1 · VP-35 등록 W21) | M08 | 잡음 | `clears cached agents on plugin changes with no Composer mounted…` 등 4건 |
| A09 | `composerCatalogState.ts:53` | 제거 | subscribe 재파생(F7 · VP-35 등록 A6) | **M09 못 잡음** | **잡음** | `refetches agents when the cache is cleared between construction and first subscribe` |
| A10 | `:40` | 제거 | 생성자 슬롯 | M10 | 잡음 | 2건 |
| A11 | `:53` | 고정값 | subscribe 슬롯 → loading | M11 동치 | 동치 | 같은 동기 호출의 `:75` `read('agents')`가 `:105-106`에서 캐시를 다시 파생한다. 25건 green |
| A12 | `:139` | 제거 | `accept` | M12 | 잡음 | 17건 |
| A13 | `:139` | 다른 값 | 포착 revision → 응답 시점 revision(VP-35 등록 W12) | M13 동치 | 동치 | revision 변경은 `:54-57` 동기 구독이 epoch를 올려 `:119`가 늦은 응답을 먼저 버린다. read는 구독 중에만 실행되고 dispose 뒤는 `disposed`로 버린다. 25건 green. store 자체 검사는 A17이 잠근다 |
| A14 | `:126` | 고정값 | 취소 시 캐시 유지 분기 → error | M14 | 잡음 | `…ends as cancelled` · `…ends as error` |
| A15 | `:151` | 고정값 | 실패 시 캐시 유지 분기 → error | M15 | 잡음 | `…ends as reject` |
| A16 | `composerAgentStore.ts:23` | 제거 | 첫 값 보존 조건 | M16 | 잡음 | 2건 |
| A17 | `:23` | 제거 | accept revision 검사 | 신규 | 잡음 | `invalidates only for a newer revision and ignores results captured at an older revision` |
| A18 | `composerCatalogState.ts:56` | 다른 값 | 재조회 조건 → `agents === undefined` | 신규 | 동치 | store setter는 accept(agents 정의·revision 불변)와 invalidate(revision 증가·agents 비움) 둘뿐이라 두 조건이 같은 전이를 고른다. 25건 green |
| A19 | `useComposerCatalog.ts:25` | 고정값 | store selector → undefined | 신규 | 잡음 | `shows cached agents before the chat scope exists` |
| W2 | `bootstrap.ts:1223` | 제거 | `extensionsChanged` | M68 | 잡음 | `broadcasts each OpenCode plugin revision after retiring servers without an owner` |
| W3 | `:1224` | 제거 | broadcast | 신규 | 잡음 | 〃 |
| W2W3 | `:1223-1224` | 뒤집기 | broadcast를 retire 앞으로 | 신규 | 잡음 | 〃 |
| W4 | `opencode/v1/adapter.ts:55` | 제거 | `retireAll` 호출 | M69 | 잡음 | 〃 · `starts a new server for new owners after retireAll…` |
| W5 | `server.ts:170` | 제거 | `entries.clear()` | M70 | 잡음 | `starts a new server for new owners after retireAll…` |
| W16 | `send.ts:25` | 고정값 | revision → 1 | 신규 | 잡음 | `broadcasts each OpenCode plugin revision…` |
| W17 | `shared/ipc.ts:96` | 다른 값 | 채널 이름 → composer 채널 | 신규 | 잡음 | `forwards OpenCode plugin changes on their own channel` |
| W19 | `preload/index.ts:277` | 맞바꿈 | 구독 채널 ↔ composerCatalogInvalidated | 신규 | 잡음 | 〃 |
| W20 | `renderer/shared/api/ipc.ts:238` | 빈 값 | 래퍼 → undefined | 신규 | 잡음 | 〃 · `clears cached agents on plugin changes with no Composer mounted…` |
| X3 | `bootstrap.ts:890` | 제거 | shutdown `close()` | M65 | 잡음 | `broadcasts each OpenCode plugin revision…` |
| B17 | `CustomizeList.tsx:59` | 맞바꿈 | providers↔mcp kind | M17 | 잡음 | 5건 |
| B18 | `:242` | 제거 | 플러그인 탭 nativeList | M18 | 잡음 | 4건 |
| B19 | `:61` | 뒤집기 | Claude/OpenCode 정렬 | M19 | 잡음 | 5건 |
| B20 | `:51` | 제거 | plugin 스킬 필터 | M20 | 잡음 | 2건 |
| B21 | `:59` | 제거 | `tab !== 'skills' &&` | **M21 못 잡음** | **잡음** | `shows the empty skills state when native resources are present` |
| B22 | `:157` | 고정값 | 스킬 토글 항상 | M22 | 잡음 | 3건 |
| B23 | `ExtensionsCatalogView.tsx:140` | 제거 | 실패 배너 탭 게이트 | M23 | 잡음 | 2건 |
| B24 | `:151` | 제거 | 로딩 탭 게이트 | M24 | 잡음 | 2건 |
| B25 | `:162` | 제거 | `suppressEmpty` 탭 게이트 | **M25 못 잡음** | **잡음** | `shows the empty skills state when native resources are failed` |
| B26 | `SkillDetail.tsx:89` | 고정값 | 상세 토글 항상 | M26 | 잡음 | `renders no switch for default-path skills` |
| B27 | `:87` | 다른 값 | `!canToggle`이면 제목 회색 | M27 | 잡음 | 〃 |
| B28 | `CustomizeList.tsx:157` | 맞바꿈 | `canToggle` → `enabled` | M28 | 잡음 | 3건 |
| B29 | `extension-sources.ts:28` | 다른 값 | `plugin:claude`만 | M29 | 잡음 | 2건 |
| B30 | `opencode/v1/configured-resources.ts:120` | 고정값 | `canToggle: true`(VP-18″ 등록 R21) | 신규 | 잡음 | `discovers global config.json…` · `broadcasts…` |
| B31 | `:120` | 맞바꿈 | mcp → plugin | 신규 | 잡음 | 3건 · `restores global choices…` |
| C30 | `claude/adapter.ts:486` | 호출 대체 | 첫 plugins를 owned에 고정 | M30 | 잡음 | `carries catalog changes through the real bootstrap registry…` |
| C30-w | `:486` | 〃 | 〃(win32) | M30 | 잡음 | `applies current global plugin choices to every new query…` |
| C31 | `bootstrap.ts:1148-1150` | 빈 값 | 초안 명령 choices | M31 | 잡음 | `applies nav plugin choices to draft and stored-session…` |
| C32 | `:1158-1160` | 빈 값 | 초안 리소스 choices | M32 | 잡음 | 〃 |
| C33 | `:1096-1098` | 빈 값 | 세션 리소스 choices | M33 | 잡음 | 〃 |
| C34 | `:1130-1132` | 빈 값 | 세션 명령 choices | M34 | 잡음 | 〃 |
| C35 | `claude/configured-resources.ts:105` | 뒤집기 | Orca↔project | M35 | 잡음 | 2건 |
| C36 | `:104-106` | 맞바꿈 | user↔project | M36 | 잡음 | 3건 |
| C37 | `plugin-catalog.ts:226` | 빈 값 | 명령 reader choices | M37 | 잡음 | `applies nav plugin choices…` |
| C38 | `common/extension-control.ts:20` | 고정값 | prefix → `'plugin:'` | M38 | 잡음 | `maps only one kind of choice to harness keys` |
| C39 | `harnesses/claude/module.ts:40` | 빈 값 | module choices | M39 | 잡음 | `applies nav plugin choices…` |
| C40 | `plugin-catalog.ts:138` | 뒤집기 | overrides를 project 뒤로 | M40 | 잡음 | 4건 |
| C41 | `adapter.ts:452-453` | 맞바꿈 | provider ↔ Orca flag(win32) | **M41 못 잡음** | **잡음** | `applies current global plugin choices to every new query while live queries keep theirs` |
| C42 | `configured-resources.ts:151` | 제거 | 설치 폴더 존재 검사 | M42 | 잡음 | `omits installations whose directory no longer exists` |
| C43 | `plugin-catalog.ts:160` | 제거 | 존재 검사 | M43 | 잡음 | `selects active installations by scope and precedence…` |
| D51 | `global-plugins.ts:8` | 맞바꿈 | json↔jsonc 순서 | M51 | 잡음 | `derives the fingerprint…` · `lists only plugins declared by the effective global file as fixed rows` |
| D52 | `opencode/v1/configured-resources.ts:73` | 고정값 | 전역 파일 합집합 | M52 | 잡음 | `lists only plugins declared…` |
| D53 | `:120` | 고정값 | `canToggle: true` | 신규 | 잡음 | 3건 |
| D54 | `:120` | 뒤집기 | `===` → `!==` | 신규 | 잡음 | 4건 · `restores global choices…` |
| D60 | `global-plugins.ts:34-35` | 다른 값 | fingerprint = 파일 이름 | M60 | 잡음 | `derives the fingerprint only from the effective plugin array` · `broadcasts…` |
| D61 | `opencode-global-watch.ts:44` | 제거 | fingerprint 비교 | M61 | 잡음 | `fans out once per external plugin change and ignores unchanged polls` · `broadcasts…` |
| D62 | `:27-28` | 제거 | watchFile 등록 | M62 | 잡음 | 〃 |
| E01 | `app/extension-control.ts:19` | 제거 | 저장 호출(VP-36 등록) | 신규 | 잡음 | `persists explicit global choices and restores them in a new control` 등 3건 |
| E02 | `:14` | 빈 값 | 시작 시 읽기(VP-36 등록) | 신규 | 잡음 | 4건 |
| E03 | `:16` | 맞바꿈 | claude↔opencode 선택(VP-36 등록) | 신규 | 잡음 | 7건 |
| E04 | `:19-20` | 뒤집기 | 메모리 갱신을 저장 앞으로 | 신규 | 잡음 | `keeps the last saved choices when persistence fails and allows a retry` |
| E05 | `bootstrap.ts:173` | 호출 대체 | 메모리 전용 control(VP-37 등록) | 신규 | 잡음 | `restores global choices through production Bootstrap…` · `initializes its actual adapter registry…` |
| E06 | `settings-migration.ts:52` | 뒤집기 | `<` → `>=`(VP-38 등록) | 신규 | 잡음 | 5건 |
| E07 | `:52` | 제거 | legacy 비움(VP-38 등록) | 신규 | 잡음 | `clears legacy native extension choices once…` 등 3건 |
| E08 | `:52` | 다른 값 | `< 2` → `< 3` | 신규 | 잡음 | 4건 |
| E09 | `settings-store.ts:64` | 제거 | save 버전 기록 | 신규 | 잡음 | `persists global choices through the main-only setter…` 등 3건 |
| E10 | `:58` | 제거 | setter의 선택 반영 | 신규 | 잡음 | 3건 |
| E11 | `mcp-control.ts:81-83` | 맞바꿈 | connect↔disconnect | 신규 | 잡음 | `applies restored choices once per new directory…` · `restores global choices…` |
| E12 | `:22` | 다른 값 | `mcp:` → `plugin:` prefix | 신규 | 잡음 | 〃 |
| E13 | `shared/ipc.ts:1164` | 제거 | SettingsPatch 제외 키 | M74 대응 | 잡음 | `npm run typecheck` → `nativeExtensionChoices.testfixture.ts:4` TS2578 |
| E14 | `protocol.ts:840` | 다른 값 | PatchSchema에 선택 필드 추가 | M75 대응 | 잡음 | `keeps global choices out of renderer patches…` 등 3건 |
| F76 | `skills/scan.ts:75` | 다른 값 | adapter 출처 저장값 복귀 | M76 | 잡음 | `assembles the real catalog…` · `여러 source root…` |
| F77 | `:78` | 다른 값 | adapter:claude canToggle | M77 | 잡음 | 〃 |
| F78 | `:78` | 다른 값 | `!== 'adapter'` | M78 | 잡음 | `assembles the real catalog…` |
| F79 | `json-file.ts:9` | 제거 | mkdir | M79 | 잡음 | `creates missing parents…` · `adds a server when the sources mcp directory does not exist` |
| G01 | `global-plugins.ts:1` | 제거의 역 | `nativeFileMutations` import 재삽입(VP-18″ 등록) | 신규 | 잡음 | EP-10 `nativeFileMutations` 검색 0 → 1 → 원복 0 |

### r1 행 대조

| r1 결과 | 행 | r2 |
|---|---|---|
| 잡음 71 | 52행 재실행 | 전부 잡음. **덮개 회귀(red → green) 0** |
| 잡음 71 | 19행(M44~M49·M53~M59·M63·M64·M67·M71~M73) | 자리 소멸 — ΔV3·ΔV5가 계약을 삭제했다. EP-10 음성 게이트 0건(G01 민감도 잡음)과 `revalidate` 0건이 대신 잠근다. M67의 후속 자리는 W3 |
| 못 잡음 6 | M09·M21·M25·M41 | A09·B21·B25·C41 **잡음** |
| 못 잡음 6 | M50·M66 | 자리 소멸 — `openCodeSessions`·`openCodeGlobalWatch?.drain` 검색 0건 |
| 동치 2 | M11·M13 | A11·A13 다시 동치 |

- 검산: 52 + 19 + 4 + 2 + 2 = 79(r1 시도 수). r2 신규 27 = 85 − 58.
- A13은 설계자가 VP-35에 등록한 변이(W12)다. 동치이므로 VP-35의 "stale 무시"는 epoch 검사가 운반하며, 그 검사는 `drops agent results requested before a plugin change…`가 관측한다.

## r2-5. V-pair closeout — `UT → IT → ST → AT`

| Pair | 레벨 | requiredness | 결과 | 직접 증거 |
|---|---|---|---|---|
| VP-04′ | UT | REQUIRED | PASS | `composerAgentStore.test.ts` 3건 · A06·A07·A08·A16·A17 |
| VP-12 | UT | REQUIRED | PASS | `configured-resources.test.ts`(claude) · `extension-control.test.ts` · C35~C38·C40 |
| VP-15 | UT | REQUIRED | PASS | `scan.test.ts` · `skill-catalog.test.ts` · F76~F78 |
| VP-17 | UT | REQUIRED | PASS | `json-file.test.ts:creates missing parents…` · F79 |
| VP-23″ | UT | REQUIRED | PASS | `configured-resources.test.ts`(opencode) 2건 · D51~D54·B30·B31 |
| VP-31″ | UT | REQUIRED | PASS | `global-plugins.test.ts:derives the fingerprint…` · D60 |
| VP-32 | UT | REQUIRED | PASS | `omits installations…` · `selects active installations…` · C42·C43 |
| VP-36 | UT | REQUIRED | PASS | `extension-control.test.ts` 2건 · E01~E04 |
| VP-38 | UT | REQUIRED | PASS | `settings-migration.test.ts` · `settings-store.test.ts` · E06~E10 |
| VP-03′ | IT | REQUIRED | PASS | `Module.integration.test.ts:shows cached agents before the chat scope exists` · A03·A19 |
| VP-08 | IT | REQUIRED | PASS | `CustomizeList.render.test.ts` · `ExtensionsCatalogView.interaction.test.ts` · B17~B19·B21 |
| VP-11 | IT | REQUIRED | PASS | `bootstrap.native-history.test.ts:applies nav plugin choices…` · C31~C34·C39 |
| VP-21′ | IT | REQUIRED | PASS | bootstrap `broadcasts…without an owner` · preload `forwards…` · `server.test.ts` · state `refreshes subscribed parts…` · W2~W5·W16·W17·W19·W20·A05 |
| VP-30″ | IT | REQUIRED | PASS | 같은 bootstrap 좌표(실제 watcher·shutdown) · X3·D62 |
| VP-37 | IT | REQUIRED | PASS | bootstrap `restores global choices through production Bootstrap…` · `bootstrap.harness.test.ts` · E05·E13·E14 |
| VP-02 | ST | REGRESSION | PASS | `composerCatalogState.test.ts` 취소·실패·거절 3건 · A04·A14·A15 |
| VP-05 | ST | REGRESSION | PASS | `keeps the new generation when an older part resolves in the same epoch` · A04·A05 |
| VP-06 | ST | REGRESSION | PASS | `adapter.persistent.test.ts:passes a live plugin agent…`. r2 변경 경로 밖, gate 실행 집합에서 통과 |
| VP-10 | ST | REQUIRED | PASS | win32 `adapter.native-plugins.test.ts` · C30·C30-w·C41 |
| VP-13 | ST | REGRESSION | PASS | `native-resource-sharing.test.ts` · `Composer.native-menu.test.ts` 18/18. r2 변경 경로 밖 |
| VP-27 | ST | REGRESSION | PASS | `refreshes subscribed parts once per plugin revision while keeping models` · A05 |
| VP-29″ | ST | REQUIRED | PASS | `opencode-global-watch.test.ts` · D61·D62 |
| VP-35 | ST | REQUIRED | PASS | Module `clears cached agents…no Composer mounted…` · state `drops agent results…` · `refetches agents when the cache is cleared…` · A08·A09·W20. 등록 W12는 동치(A13) |
| VP-01 | AT | REGRESSION | PASS | `Module.integration.test.ts` · A01·A02·A09·A10 |
| VP-07 | AT | REQUIRED | PASS | `ExtensionsCatalogView.interaction.test.ts` · B20·B23~B25·B29 |
| VP-09 | AT | REQUIRED | PASS | bootstrap 3건(`carries…`·`applies nav…`·`restores…`) · C30~C43. AC18은 별도 노드 AT-06 |
| VP-14 | AT | REQUIRED | PASS | B22·B26~B28·F78 |
| VP-16 | AT | REQUIRED | PASS | `store.fresh-root.test.ts:adds a server when the sources mcp directory does not exist` · F79 |
| VP-18″ | AT | REQUIRED | PASS | view `shows OpenCode plugin rows as fixed native state and sends no toggle` · handler `reads native defaults…`(OpenCode plugin 거절) · EP-10 0건 · G01·B30·B31 |
| VP-26 | AT | REGRESSION | PASS | `Module.integration.test.ts` scope 전환 요청 0 · A01 |
| VP-28″ | AT | REQUIRED | PASS | Claude 비노출 C42·C43 · 외부 편집 bootstrap D61·D62 · `useNativeMcpCatalog.test.ts:queries explicit global scope…` |
| VP-34 | AT | REGRESSION | PASS | bootstrap 초안·저장 세션 · C31~C34 |
| VP-39 | AT | REQUIRED | PASS | bootstrap `restores global choices…`(두 설정 파일 바이트 동일 · disconnect 1회 · 새 directory만 반영) · `mcp-control.test.ts` · E11·E12·D54 |

- 합계: 33 pair = PASS 33 · PAIR_FAIL 0 · BLOCKED_BY 0. UT 9 · IT 6 · ST 8 · AT 10.
- 실행 범위: 재검증이지만 ΔV3·ΔV5·ΔV6가 33 pair 대부분의 path를 바꿨으므로 전건을 다시 판정했다. VP-06·13은 r2 diff 밖이며 좌표 재실행으로 판정했다.
- 좌표의 실행 구간:
  - renderer 좌표는 `shared/api/ipc`의 IPC 경계만 mock한다. preload 좌표는 실제 preload 노출 → 실제 renderer 래퍼를 지난다.
  - main 좌표는 실제 `Bootstrap`·`SettingsStore`·reader·감시와 임시 설정 루트를 쓴다.
  - F1 경로의 edge 대응: watch→bootstrap(D61) · bootstrap→send(W16) · send→preload 채널(W17) · preload→래퍼(W19) · 래퍼→store(W20) · store 구독(A08) · 재조회(A05·A09).

### AC 세부와 합계

| AC | 결과 | 근거 |
|---|---|---|
| AC1·AC2·AC3 | ✅ | A01·A02·A10 · A14~A16 · A04 |
| AC4 | ✅ | VP-06 |
| AC5·AC6 | ✅ | B17~B20 |
| AC7 | ✅ | B21·B23~B25(F3 해소) |
| AC8~AC12 | ✅ | C30~C43(F4 해소) |
| AC13~AC17 | ✅ | B22·B26~B28 · F76~F79 |
| AC18 | ⚠️ | 사람 실기 미실행 |
| AC24 | ✅ | W4·W5 |
| AC25′ | ✅ | A06·A07·A17 · A05 |
| AC27 | ✅ | C42·C43 |
| AC28′ | ✅ | W2·W3·D61·D62 · A08 |
| AC31 | ✅ | A08·W20(F1 해소) |
| AC32 | ✅ | A05 |
| AC40 | ✅ | B30·B31·D53·D54 · EP-10 0건 · G01 |
| AC41 | ✅ | D51·D52 |
| AC42 | ✅ | E01~E05·E13·E14 |
| AC43 | ✅ | E11·E12 · 두 설정 파일 바이트 동일 단언 |
| AC44 | ✅ | E06~E10 |

- 합계 재측정: ✅ 28 · ⚠️ 1 · ❌ 0 = 29. 자기보고(r2·r2.2 본문, trailer 2개, INDEX) `28/29`와 일치한다.

### 현재 변경의 운영 gate

| Gate | 결과 | 증거 |
|---|---|---|
| `npm run lint` | PASS | 0 error · 2 warning(`Timeline.tsx`·`useTranscriptVirtualizer.ts`, diff 밖 기존). 트리 변경 0 |
| `npm run typecheck` | PASS | node·web·test 3구성 |
| 관련 vitest | 환경 한계 분리 후 PASS | 256파일·2544건: 2350 pass · 188 fail · 6 skip. 실패 이름 171종이 r1 head·base와 동일(양방향 차집합 0) |
| 실패 서명 | 환경 | better-sqlite3 바인딩(`r2-gate.err` 161줄) · win32 전용 분기(`claude/native-resources.test.ts` 3건, N3). 신규 테스트 실패 0 |
| `check-doc-inventory --check` | PASS | `9 items, 114 channels` · prose ok · links ok |
| CI `gate` | PASS | run `40069813030`, head `5084fa7c` |

## r2-8. 사람 실기

| 항목 | 기계 검증 범위 | 남은 사람 실기 |
|---|---|---|
| AC18 | AC1·AC5·AC8·AC42 로직 | Windows 앱: superpowers off → 새 세션 `/context`에 없음 · 재시작 뒤에도 off · 플러그인 탭 white/dark · 랜딩 전환 시 스피너 없음 |

- r1의 AC26(OpenCode 플러그인 off 실기)은 ΔV5가 AC를 폐기해 대상이 아니다.

## r2-9. 게이트 재실행 메모

- `npm test`는 쓰지 않았다(DB 동작이 검증 대상이 아님).
- 정리한 임시 산출물: 임시 vitest 설정(`app/vitest.win32.scratch.config.ts`). 정리 후 `git status` 출력 0.

## r2-11. Repository operation checks

- trailer 파싱: `dc50d1bc`·`5084fa7c` 모두 `Agent: codex` · `Handoff` · `Status: implemented` · `Criteria-Met: 28/29` · `Criteria-Pending` · `Verified-By: pending`을 반환한다.
- 대상 커밋 좌표: `git cat-file -t` = commit — ΔV6 `2a6096a2`, r2 `dc50d1bc`, r2.2 `5084fa7c`. INDEX 자리표시자 2곳을 기입했다. 원격 브랜치 head = `5084fa7c`(`git ls-remote`).
- `[구현자 기입]` 7필드: r2(`plan.md:1613-1842`)와 r2.2(`:1843-2008`) 각각 7절이 있다. 강제 지점 표는 11 EP 117자리 전부를 담는다.
- `app/AGENTS.md` 변경: 의존성 목록에서 `jsonc-parser` 제거 1줄. 비밀·변동 정보 없음, `package.json`·lock 제거와 일치.
- INDEX 비고는 5줄 이내로 갱신했다.

## r2-13. Finding disposition

| # | finding | 귀속 | disposition | 상태 |
|---|---|---|---|---|
| G1·G2 | r1 PLAN_GAP | ΔV3·ΔV5 | — | closed |
| F1·F3·F4·F7 | r1 BLOCKING | 인용 변이 | — | closed — A08·W20 / B21·B25 / C41 / A09 잡음 |
| F5·F6 | r1 BLOCKING | ΔV5가 자리 삭제 | — | closed(moot) — 검색 0건 |
| N1 | EP-08 기록 줄 수 | ΔV3 정정 | — | closed |
| N2 | 등록 oracle 이름 5개 부재: VP-18″ handler·VP-39 handler·VP-39 mcp-control·VP-37·VP-35 F1. 대체 테스트(`reads native defaults…`·`restores global choices…`·`applies restored choices once per new directory…`·`clears cached agents…no Composer mounted…`)가 같은 행동을 관측한다. `reads native defaults…keeps…only in memory`는 저장 port 없는 control을 쓰므로 이름이 ΔV6 의미와 어긋난다 | VP-18″·35·37·39 | NON_BLOCKING | open — 구현 보고에 대체 이름 명시 |
| N3 | Claude 플러그인 제어 3건 win32 전용 | 환경 | NON_BLOCKING | 기록 |
| N4 | 기록된 검색 술어가 구현 뒤 이름이 바뀐 자리를 다시 찾지 못한다: EP-02 C3·C15 · EP-03b K2·K4 · EP-07′ W3·W9·W15~W21 · EP-08 E4. 검색 − 목록 차집합은 0이고 각 자리는 위 변이로 잠겼다 | §10 기록 | NON_BLOCKING | open — 설계자, 다음 Delta V 때 술어 갱신 |
| N5 | `openCodePluginConfig.ts:39` `pluginSpec` 소비자 0. 같은 규칙이 `configured-resources.ts:75`에 인라인으로 있다 | ΔV5 삭제 잔여 | NON_BLOCKING | open |

## r2-14. Review Signals — 사실만

- 이전 라운드와 같은 증상: 없음. r1 `못 잡음` 4건이 이번에 전부 잡혔고 덮개 회귀 0.
- 관련 plan 지침: r1 G1(전달 계약 누락)은 설계자 = 검증자의 plan 결함이었고 ΔV3가 정정했다.
- 사용자 결정 변경 근거: ΔV4 → ΔV5(OpenCode 플러그인 제어 제외), ΔV6(전역 선택 재시작 유지), D-036(프로젝트 토글 유지) — 모두 사용자 지시.
- 반복된 환경 한계: better-sqlite3 바인딩 부재, win32 전용 분기(r1과 동일).

## r2-15. 결론

- 상태: **PASS (기계 범위)** — verify 2회째.
- pair: PASS 33 · PAIR_FAIL 0 · BLOCKED_BY 0. PLAN_GAP 0. BLOCKING 0.
- ACTIVE Decision: 전부 충족. AC ✅ 28 · ⚠️ 1(AC18 실기) · ❌ 0.
- 운영 gate: lint·typecheck·doc inventory·CI PASS. 관련 vitest 환경 실패는 r1과 동일하다.
- 다음 단계: 사용자가 AC18을 실기로 확인한다. 확인 뒤 INDEX 행을 archive로 옮긴다.

## 후행 재확인 (2026-10-29, 0275~0289 일괄 검증)

- **PASS 유지 — AC18 일부만 후행에서 다룸.** 연속 토글 거절·토글 사라짐은 0284 r1.2가 고쳤다(단 0284는 이번 verify FAIL — 방송 큐 잠금 상실, 동작 결함 아님). 플러그인 탭 그룹 제목·로고 시각은 0286이 다시 정의했고 0286 AC16(white/dark)으로 남는다. 재시작 뒤 off 유지·랜딩 스피너는 후행 해결 없음.
- HEAD `81153e2`에서 전체 vitest를 다시 돌렸다(865파일). Linux 전용 실패 21건은 `C:/` fixture와 `process.platform === 'win32'` 게이트뿐이며, POSIX 경로·win32 강제 미커밋 사본에서 green이고 Windows CI [run 40834862690](https://github.com/muzaby/orca-skin/actions/runs/40834862690)이 success다 — 근거는 [0289 verify §6](../0289-opencode-runtime-retention/verify.md).
