# Verify — 0282-plugin-catalog-native-sync

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
