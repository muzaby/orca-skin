# Verify — 0236-jira-plugin-catalog-presentation

## 메타

| 항목 | 값 |
|---|---|
| slug | `0236-jira-plugin-catalog-presentation` |
| 검증자 | Claude Code |
| 일자 | 2026-09-17 |
| 대상 커밋/range | `41c07e9c^..cdf6ebc4` (구현 `6e017239`·`748372f1`·`14590a4f`·`255df587`·`cdf6ebc4`) |
| 구현 전 plan 기준 | `d0880910` (마지막 설계 커밋) |
| V mode / 유효 V | `Delta V` / `V1@41c07e9c + ΔV1@d0880910` |
| 검증 기준 plan revision | `41c07e9c:V1` + `52487f1c`·`914081b2`·`d0880910:ΔV1` |
| 라운드 | 1 (검증) |
| 상태 | **FAIL** |
| 자기 검증 여부 | 구현자 = Codex, 검증자 = Claude — 동일 에이전트 아님. 그래도 구현 보고가 이름을 대지 않은 적대 축 12건을 추가로 실행했다(§4) |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예. 다만 **규범 행은 설계 커밋에서만 바뀌었다**.
- **기준선이 diff로 성립하는가**: **예**. 설계(`41c07e9c`·`52487f1c`·`914081b2`·`d0880910`)와 구현(`6e017239`·`748372f1`·`14590a4f`·`255df587`·`cdf6ebc4`)이 분리돼 §0 자기 증명 방지가 작동한다.
- Decision Ledger 변경: D-010·D-019·D-020 문구 변경이 전부 `d0880910`(설계 커밋)에 있다. 구현 커밋의 Decision diff 0건.
- Product/UX Contract 변경: §5 상태표의 Jira 403 행 변경이 `d0880910`에 있다. 구현 커밋 0건.
- AC 변경: R-10·R-17·R-18 재작성이 `d0880910`에 있다. 구현 커밋 0건.
- V node/pair·requiredness·§10·oracle 변경: VP-27…33·EP-25·EP-26 갱신이 `d0880910`에 있다. 구현 커밋 `14590a4f`가 바꾼 EP-25/26 개수는 `[구현자 기입]` 절 안이며 규범 표가 아니다.
- 채점에 사용할 원 기준: `d0880910`의 plan 상단 전체(V1 + ΔV1).

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | 기준 `V1@41c07e9c` 명시, ΔV1이 R부터 MD까지 증분만 기록 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | R-17/18·SD-03·AR-05·MD-05 전부 REQUIRED pair(VP-27…31) 보유 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | MD-04→VP-32, R-14→VP-33 |
| pair별 path·§10 전수·직접 oracle | 유효 | 33 pair 전부 `start → edges → end`·강제 지점 수·oracle 보유 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | M1…M16이 pair별로 지정, VP-06·15·32는 `not selected` 이유 명시 |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 7 gate 표에 명령·실패 범위 분리 |

- V 도입 전 plan 여부: 해당 없음 — 신규 템플릿 handoff다.
- root PLAN_GAP과 영향 pair: **없음**. 아래 D1은 plan이 선언한 oracle을 구현이 못 채운 것이지 기준선 누락이 아니다.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001·D-004 | Plugin만 catalog를 싣고 non-Plugin은 undefined | `createPluginBinding`→`pluginRows`→`connectionInfo`(`connection-views.ts:78`)→`ProviderInfo.catalog` |
| D-002 | 미설정 icon은 `electrical_services` | `plugin-catalog.ts:13` → `pluginPresentation.ts:9` → `Icon.tsx:165` |
| D-003 | ko/en 즉시 전환, exact→base→ko→en | `useI18n.locale`→`resolveLocalizedPluginText`(`pluginPresentation.ts:24`) |
| D-005 | 출처는 본문과 분리된 4필드 | `source.ts:12`→`ProviderDetail.tsx:94-108` |
| D-006 | 플러그인→스킬→MCP, 초기 탭 플러그인 | `catalogSelection.ts:14`·`:20` |
| D-009 | 기본 14개만, upload 제외 | `tools.ts:16` `JIRA_TOOL_NAMES` 14 |
| D-013 | 조회 6개만 자동 허용 | `tools.ts:135` `READ_ONLY`→`runtimeApprovalToolNames` |
| D-017·D-018 | stage→result preflight→atomic publish | `service.ts` download→`tools.ts:178` `prepare→commit` |
| D-019 | Jira 401만 강등, tool 403 `forbidden`, probe 403 보존 | `rest.ts:17`→`authenticated-request.ts:169`·`login.ts:512`·`login.ts:352` |
| D-020 | probe·기본·dev-status·attachment 모두 Jira UA | `rest.ts:12` `JIRA_REQUEST_HEADERS` + 배포 probe |

### end-to-end 흐름

```text
배포 config (auth-definitions + plugins recipe)
  → AuthRuntime.bind → jiraTools(ctx, {apiBasePath})
  → createPluginBinding(catalog) → pluginRows → connectionInfo → ProviderInfo
  → renderer pluginPresentation(locale) → CustomizeList / ProviderDetail
  → login/resume probe → binding.sync → RuntimeToolRegistry
  → agent tool call → schemas.parse → service → buildJiraRequest → BoundAuth.request
  → prepareJiraSuccessResult → (save면 batch.commit) → RuntimeToolResult
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | ✅ | 모든 handler 예외가 `toJiraErrorResult`로 안정 code envelope가 된다(`tools.ts:186`) |
| false success 가능성 | ✅ 없음 | `parseJson`은 204/빈 body만 null, 그 외 파싱 실패는 `invalid_response`(`service.ts:53`) |
| partial failure/rollback | ✅ | 중간 실패·취소는 `batch.abort()`로 stage 전체 제거, publish 전에는 final path가 없다(`service.ts:206`) |
| Product/UX의 A가 아닌 다른 B를 구현했는가 | ✅ 아니오 | upstream 14개 tarball 대조에서 이름·경로·기본값 일치(§7) |
| 증상만 제거하고 상태 변화가 남았는가 | ✅ 아니오 | probe 403은 `markExpired`를 부르지 않고 `markVerified`도 부르지 않는다(`login.ts:352`) |
| 최적화가 잃은 재검증/취소/만료 관측 | ✅ 없음 | `getSignal()`이 모든 remote/binary 요청에 전달된다(`tools.ts:172`) |
| 출력/요청 worst-case 상한 | ✅ | request 1 MiB·response 2 MiB·attachment 25 MiB·batch 10개·tool output 2 MiB (§7 재계산) |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 41c07e9^..cdf6ebc
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export 8건(`JIRA_USER_AGENT`·`JIRA_JSON_MAX_BYTES`·`PLUGIN_CATALOG_ICON_NAMES` 등) | 정상 | 전부 정의 파일 내부에서 사용되는 상수다. `JIRA_USER_AGENT`는 `rest.ts:13`이 소비 |
| 테스트 전용 참조 18건 | 정상(알려진 한계) | `createPluginBindings()`가 `[]`이므로 Jira/Plugin 배선의 프로덕션 호출자가 0이다 — D-014의 의도이며 0184 verify가 같은 사실을 이미 기록했다. D5로 기록 |
| `connectionInfo` 프로덕션 0 | 오탐 | 같은 파일 `connectionViews`(`connection-views.ts:87`)가 부르고 `bootstrap.ts:411`이 그 소스를 만든다 |
| 형제 정책 비대칭 `infra/net` credentials | 무관 | 이번 diff가 만든 값이 아니다(`transport.ts` 기존 `'omit'`) |
| 신규 등록값의 기존 소비처 영향 | 무영향 | `ProviderInfo.catalog`는 optional이고 소비처는 `pluginPresentation` 1곳, non-Plugin은 `power`+label 유지(M1 red) |
| producer ↔ consumer 파생 불일치 | 없음 | `PluginCatalogIconName` 6개 ↔ renderer `ICON_NAMES` record 6개가 타입으로 전수 강제 |
| 동일 규칙 중복 구현 | SSOT 유지 | UA는 `JIRA_SOURCE.version` 파생 1곳, 기본 icon 1곳, tool name 1곳 |
| **Jira 요청 생성 지점의 헤더 seam** | ⚠️ 구조 가드 없음 | 현재 5개 생성 지점 전부 `jiraRequest()` 경유(검증자 전수 재열거). 새 지점이 우회해도 잡는 스윕이 없다 → D3 |

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: ✅ `connection-views.test`·`deployment-wiring.test`·`catalogSelection.test`·`CustomizeList.render.test`·`runtime-tool-policy.test` 전부 확장돼 있다.
- 핵심 입력/분기가 실제 실행됨: 부분 — REST payload 분기는 3/14만 실행된다(D1).
- structural proxy만으로 semantic 목표를 통과시킨 AC: **AC8** — route table(method+path+headers)이 payload 검증을 대신하고 있다(D1).
- **선택된 적대 증거 재측정**: 등록 변이 20건(M1…M14 + M15a·M15b·M16·M17·M18·M19) 중 **검출 20 · 미검출 0 · 일반 hunk 자동 확장 0**.
- **이전 라운드 대조**: 이전 검증 라운드 없음 — 덮개 회귀 판정 대상 0건.
- **자기검증 분모**: 구현자 ≠ 검증자. 추가로 구현 보고가 이름을 대지 않은 축 **12건**(S1…S4 형제 슬롯 맞바꿈, P-a…P-j payload/query/상태 가드)을 만들어 실행했고 **3건이 green**이었다.

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 `connectionInfo` catalog 전달 제거 | connection-views·wiring | — | **red 1** | VP-01·16·18 등록 변이 |
| M2 기본 icon `power_settings_new` 복귀 | plugin-catalog·plugins | — | **red 2** | VP-02·22 |
| M3 ko/en fallback 순서 교환 | pluginPresentation | — | **red 1** | VP-03·16·22 |
| M4 source version `0.34.1` drift | source·ProviderDetail·rest·wiring | — | **red 20** | VP-04 |
| M5 탭 선두·초기 탭 skills 복귀 | catalogSelection | — | **red 2** | VP-05·16 |
| M6 `jira_unlinkIssues` inventory 제거 | tools·wiring | — | **red 4** | VP-07·17·23 |
| M7 search REST path drift | rest·wiring | — | **red 2** | VP-08·19·23 |
| M8 error `isError` 제거 | result·tools | — | **red 11** | VP-09·17·19·24 |
| M9 API base 중복 | rest·wiring | — | **red 17** | VP-10 |
| M10 secret redaction 제거 | result | — | **red 3** | VP-11·19·24 |
| M11 attachment same-origin 제거 | rest·service | — | **red 1** | VP-12·20·25 |
| M12 create를 read-only로 | tools | — | **red 1** | VP-13 |
| M13 invalid auth registry remove 생략 | plugins·wiring | — | **red 4** | VP-14·17·21 |
| M14 upstream devDependency 추가 | native-boundary | — | **red 1** | VP-26 |
| M15a Jira policy에 403 재포함 | rest·wiring | — | **red 17** | VP-27·29·30·31·33 |
| M15b resume이 보존 실패도 만료 | wiring | — | **red 1** | VP-27·29·31 |
| M16 Jira 공통 UA 제거 | rest·wiring | — | **red 17** | VP-28·30·31 |
| M17 abort를 이름 없는 Error로 복귀 | net-request | — | **red 1** | 취소 회귀(D6 인용 변이) |
| M18 mapper가 DOMException만 인정 | result·tools | — | **red 2** | 취소 회귀 |
| M19 tool이 context API base 무시 | wiring | — | **red 1** | VP-09·10·30 |
| **S1 linkIssues inward↔outward 맞바꿈** | rest·tools·service | — | **green** | 검증자 추가 축 → **D1** |
| S2 attribution source↔version 맞바꿈 | source·ProviderDetail | — | red 2 | 검증자 추가 축 |
| S3 catalog ko↔en 본문 맞바꿈 | source·render | — | red 1 | 검증자 추가 축 |
| S4 presentation title↔body 맞바꿈 | pluginPresentation·render | — | red 2 | 검증자 추가 축 |
| **P-a updateIssue summary↔description** | jira 4스위트 | — | **green** | **D1** |
| **P-b updateIssue `notifyUsers` 변경** | jira 4스위트 | — | **green** | **D1** |
| **P-c linkIssues `type.name`→`type.id`** | jira 4스위트 | — | **green** | **D1** |
| **P-d postIssueComment body key 변경** | jira 4스위트 | — | **green** | **D1** |
| **P-e getIssue 기본 fields 축소** | jira 4스위트 | — | **green** | **D1** |
| **P-f download issueKey query fields 변경** | jira 5스위트 | — | **green** | **D1** |
| **P-g updateIssueComment body key 변경** | jira 5스위트 | — | **green** | **D1** |
| **P-h getIssueComments 기본 maxResults 제거** | jira 5스위트 | — | **green** | **D1** |
| **P-i batch 재진입 가드 제거** | jira 8스위트 | — | **green** | **D2** |
| P-j inline budget 역순 배분 | jira 8스위트 | — | red 1 | 검증자 추가 축 |

- 동작 보존 추출 라운드인가: 아니오 — 신규 기능 + 계약 변경이다.
- 소거 변이의 잔여물 수렴: 해당 없음 — 모든 변이가 동작 치환이라 미사용 진단이 남지 않았다(각 실행 후 `git status` 클린 확인).
- 형제 슬롯 맞바꿈 변이: **5슬롯 맞바꿔 검출 4 · 미검출 1**(S1 linkIssues inward/outward).
- `N회` 기준의 실제 관측 주체: "10개만 순차 download"는 `fake.request.mock.calls.filter(responseType==='binary')`가 실제 호출 수를 센다(`service.test.ts:104`).
- 순서 기준의 관측 훅: 탭 순서는 `CATALOG_TABS.map` 배열, 초기 탭은 `INITIAL_CATALOG_SELECTION`으로 서로 다른 oracle이다(M5가 2케이스 red).

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-22 | MD-01 ↔ UT-01 / UT | REQUIRED | PASS | `pluginPresentation.test` 6 · `plugin-catalog.test` · M2/M3 red | locale/icon 입력→resolved / 2/2 |
| VP-23 | MD-02 ↔ UT-02 / UT | REQUIRED | PASS | `rest.test` 14행 route table · M6/M7 red | tool input→route / 5/5 |
| VP-24 | MD-03 ↔ UT-03 / UT | REQUIRED | PASS | `result.test` 7케이스 · M8/M10 red · P-j red | HTTP/error→envelope / 1/1 |
| VP-25 | MD-04 ↔ UT-04 / UT | REQUIRED | PASS | `attachment-store.test` 5케이스 · M11 red | untrusted name/URL→stage/publish / 3/3 |
| VP-31 | MD-05 ↔ UT-05 / UT | REQUIRED | PASS | `authenticated-request.test` default/override · `login.test` · M15a/M15b/M16 red | status/header→demotion/header / 2/2 |
| VP-18 | AR-01 ↔ IT-01 / IT | REQUIRED | PASS | `connection-views.test` 4 category matrix · M1 red | binding→DTO→renderer / 6/6 |
| VP-19 | AR-02 ↔ IT-02 / IT | PASS(주 참조) | PASS | `service.test` 6케이스 fake `BoundAuth.request` | handler→service→envelope / 6/6 |
| VP-20 | AR-03 ↔ IT-03 / IT | REQUIRED | PASS | `service.test` 중간 실패·prepared/commit · M11 red | URL→binary→stage→publish / 4/4 |
| VP-21 | AR-04 ↔ IT-04 / IT | REGRESSION | PASS | 기존 renderer/main suite 전건 + M13 red | categories→UI/runtime / 3/3 |
| VP-30 | AR-05 ↔ IT-05 / IT | REQUIRED | PASS | `deployment-wiring.test` probe header/registry · M15/M16 red | policy/header→transport / 3/3 |
| VP-16 | SD-01 ↔ ST-01 / ST | REQUIRED | PASS | binding→wire→locale render 조합 · M1/M3/M5 red | boot config→locale rerender / 10/10 |
| VP-17 | SD-02 ↔ ST-02 / ST | REQUIRED | PASS | `deployment-wiring.test` Jira recipe 4케이스 · M6/M8/M13 red | boot→login→tool→revoke / 10/10 |
| VP-29 | SD-03 ↔ ST-03 / ST | REQUIRED | PASS | probe 403에서 `status:'valid', verified:false` + registry 유지 관측 | 403→grant/registry 유지 / 3/3 |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | PASS | identity fixture 3층 · M1 red | config→binding→UI / 6/6 |
| VP-02 | R-02 ↔ AT-02 / AT | REQUIRED | PASS | SVG glyph + list/detail equality · M2 red | icon resolver→2 surface / 4/4 |
| VP-03 | R-03 ↔ AT-03 / AT | REQUIRED | PASS | ko/en render + 임의 locale 표 · M3·S3·S4 red | locale→resolver→title/body / 4/4 |
| VP-04 | R-04 ↔ AT-04 / AT | REQUIRED | PASS | 4 attribution field · M4·S2 red | source→catalog→detail / 3/3 |
| VP-05 | R-05 ↔ AT-05 / AT | REQUIRED | PASS | order + initial 독립 oracle · M5 red 2 | initial state→tabs / 2/2 |
| VP-06 | R-06 ↔ AT-06 / AT | REGRESSION | PASS | 4 category DTO + auth callback 회귀 | categories→provider rows / 4/4 |
| VP-07 | R-07 ↔ AT-07 / AT | REQUIRED | PASS | exact 14-name set + **검증자 upstream tarball 대조**(§7) · M6 red | tool constants→descriptor / 3/3 |
| **VP-08** | **R-08 ↔ AT-08 / AT** | **REQUIRED** | **PAIR_FAIL** | route 14/14 ✅ · **payload/query 3/14** — 8변이 전부 미검출 | handler→service→BoundAuth / **4/5**(EP-15 부분) |
| VP-09 | R-09 ↔ AT-09 / AT | REQUIRED | PASS | text/structured parity·204 null·isError · M8 red 11 | mapper→RuntimeToolResult / 1/1 |
| VP-10 | R-10 ↔ AT-10 / AT | REQUIRED | PASS | default/non-default base compile fixture · M9 red 17 · M19 red | deployment Auth→probe/tools / 2/2 |
| VP-11 | R-11 ↔ AT-11 / AT | REQUIRED | PASS | 경계/초과·omission·metadata overflow·redaction · M10 red | bounds→pre-publish budget / 5/5 |
| VP-12 | R-12 ↔ AT-12 / AT | REQUIRED | PASS | temp fixture·junction·collision·중간 실패·stale cleanup · M11 red | selector→publish / 4/4 |
| VP-13 | R-13 ↔ AT-13 / AT | REQUIRED | PASS | 6/8 exact set · M12 red | annotations→approval set / 2/2 |
| VP-14 | R-14 ↔ AT-14 / AT | REQUIRED | PASS | same server identity + default 0 · M13 red 4 | auth status→registry / 3/3 |
| VP-15 | R-15 ↔ AT-15 / AT | REQUIRED | **BLOCKED_BY: 외부 환경** | 코드 경계 11/12 관측, 실제 Jira DC·ko/en UI 미수행 | packaged app→real Jira / 11/12 |
| VP-26 | R-16 ↔ AT-16 / AT | REQUIRED | PASS | dependency diff 0·import 0·`npm run build` 성공 · M14 red | package build→bundle / 1/1 |
| VP-27 | R-17 ↔ AT-17 / AT | REQUIRED | PASS | 401 강등·tool/probe 403 보존·`forbidden` · M15a red 17 + M15b red 1 | request/probe policy→mapper / 3/3 |
| VP-28 | R-18 ↔ AT-18 / AT | REQUIRED | PASS | probe+14+dev-status+attachment header 표 · M16 red 17 | builders→headers→transport / 4/4 |
| VP-32 | MD-04 ↔ UT-04 / UT | REGRESSION | PASS | `relative(...).split(sep)` 4 segment 단언(`attachment-store.test.ts:59`) | savedPath→canonical root / 1/1 |
| VP-33 | R-14 ↔ AT-14 / AT | REGRESSION | PASS | 공용 requester 401·403 parameterized 회귀 · M15a red | non-Jira 403→기존 강등 / 2/2 |

- root `PAIR_FAIL`: **VP-08** — AC8이 선언한 "각 도구의 outbound request/body" oracle이 3/14만 존재한다.
- 종속 `BLOCKED_BY`: VP-15 → 외부 Jira DC/UI 환경(사람 실기). VP-19·VP-23은 각자 선언한 oracle(통합 fake / literal route table)을 충족하므로 PASS로 두고 같은 root를 네 단계로 부풀리지 않는다.
- 하나의 증거가 함께 닫은 pair: M15a 1건이 VP-27·29·30·31·33을 함께 red로 만든다 — 각 pair의 판정 범위는 위 행에 적었다.
- 이번 라운드 실행 범위: **최초 검증 — 유효 V의 REQUIRED/REGRESSION 전건 33 pair + 현재 변경 운영 gate 7종 전건**.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AC1 | catalog 4필드가 상세까지 보존 | ✅ | `connection-views.test` + render fixture, M1 red | binding→DTO→UI |
| AC2 | 미설정은 `electrical_services`, non-Plugin은 power | ✅ | `plugin-catalog.test`·render, M2 red | icon resolver |
| AC3 | ko/en 전환 + forward-compatible fallback | ✅ | `pluginPresentation.test` 6, M3·S3·S4 red | locale→resolver |
| AC4 | source·0.34.0·pinned URL 분리 표시 | ✅ | `source.test`·`ProviderDetail.render.test`, M4·S2 red | attribution→detail |
| AC5 | 플러그인→스킬→MCP, 첫 탭 플러그인 | ✅ | `catalogSelection.test`, M5 red 2 | tabs render |
| AC6 | 기존 gate·harness·plugin·usage 행 보존 | ✅ | `connection-views.test` 4 category matrix | provider tab |
| AC7 | 기본 14개 정확히, upload 0 | ✅ | `tools.test` + **검증자 upstream 0.34.0 tarball 실측**(§7) | descriptor snapshot |
| **AC8** | **14개 REST method/path/query/body 보존** | **❌** | route 14/14 ✅ · **payload/query 미잠금 7 도구**(8변이 green) — 동작 자체는 검증자 실측으로 정상 | handler→service |
| AC9 | 안정 envelope + `isError` | ✅ | `result.test` 7, M8 red 11 | mapper→result |
| AC10 | PAT Bearer + 같은 base가 probe/tools 구동 | ✅ | `deployment-wiring.test` context-path 2케이스, M9·M19 red | Auth→tools |
| AC11 | 상한·omission·redaction | ✅ | `result.test`·`rest.test`, M10 red·P-j red | bounds→budget |
| AC12 | canonical Temp·all-or-nothing publish | ✅ | `attachment-store.test` 5 + `service.test` 2, M11 red | stage→publish |
| AC13 | 자동 허용 6 / 승인 8 | ✅ | `tools.test` exact set, M12 red | approval policy |
| AC14 | valid add / invalid remove / 기본 0 | ✅ | `plugins.test`·`deployment-wiring.test`, M13 red 4 | binding sync |
| AC15 | 실제 Jira DC + ko/en UI 실기 | ⚠️ | 코드 경계 전건 기계 검증, 외부 환경 없음 | packaged app |
| AC16 | 신규 dependency 0 + upstream import 0 | ✅ | manifest/lock diff 0 · import 0 · `npm run build` 성공, M14 red | build→bundle |
| AC17 | 401 강등 / tool·probe 403 보존 | ✅ | M15a red 17 + M15b red 1, `status:'valid', verified:false` 관측 | requester·resume |
| AC18 | 전 Jira 요청 UA + XSRF | ✅ | `rest.test` 14행 + dev-status + attachment + probe, M16 red 17 | headers→transport |

- **합계 재측정**: `✅ 16 · ⚠️ 1 · ❌ 1 = 총 18`. 자기보고 `17/18`(✅ 17 · ⚠️ 1). **불일치** — AC8을 검증자가 ❌로 내린다.
- **합계 사본 대조**: 자기보고는 본문 `17/18` ↔ trailer `Criteria-Met: 17/18`(`748372f1`·`14590a4f`·`255df587`·`cdf6ebc4` 4커밋 전부) ↔ INDEX 비고 `17/18`로 **세 사본 일치**. 검증 결과는 `16/18`이다.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-08 | schema/REST 의미 | EP-14/15/16/17/21 (5) | EP-14 ✅ · **EP-15 부분** · EP-16 ✅ · EP-17 ✅ · EP-21 ✅ → **4/5** | PAIR_FAIL |
| VP-27 | 요청별 인증 실패 status | EP-25 (3) | `rest.ts:17` · `authenticated-request.ts:169` · `login.ts:352`+`:512` → **3/3** | PASS |
| VP-28 | Jira UA/XSRF | EP-26 (4) | `jiraRequest` 경유 생성 지점 전수 재열거: json·read·unlink·dev-status·attachment content + 배포 probe → **4/4** | PASS |
| VP-13 | approval 정책 | EP-13/22 (2) | `tools.ts:135` READ_ONLY 6 · `runtime-tool-policy.ts:19` fail-closed → **2/2** | PASS |
| VP-12 | 안전한 첨부 commit | EP-18/19/20/21 (4) | `result.ts:120` · `rest.ts:205` · `attachment-store.ts` · schema/service cap → **4/4** | PASS |
| 그 외 28 pair | — | 합계 고유 EP-01…EP-26 | EP-15 외 전부 코드에서 재확인 | PASS |

- **고유 강제 지점 재측정: 26개 중 25 닫힘 · 1 부분(EP-15)**. 구현자 자기보고는 V1 `24/24` + ΔV1 `7/7`이며, ΔV1의 7은 EP-25 3 + EP-26 4로 검증자 재열거와 일치한다.
- 표에 없는데 같은 불변식이 필요한 지점: 1건 — "모든 Jira `AuthenticatedRequest`가 `jiraRequest()`를 지난다"는 seam에 구조 가드가 없다(D3, NON_BLOCKING).
- `실패 의미`가 "다른 게이트가 막는다"고 적은 행: 없음.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| plan/INDEX 정합성 | 이번 턴 산출물 | ⚠️→수정 | 대상 커밋 좌표가 자리표시자였다 — 검증자가 기입(§11) |
| renderer/main/shared | 세 subtree 동시 변경 | PASS | `npm run lint` **0 error / 1 기존 warning**(`useTranscriptVirtualizer.ts:22` react-compiler) |
| 관련 비-DB 테스트 | 순수 UI·REST·filesystem·wiring | PASS | §19 대상 **19파일 / 217케이스 pass** |
| 문서/인벤토리 | IPC·arch·guide 변경 | PASS | `check-doc-inventory.mjs --check` — generated ok(9 items, 98 channels)·prose ok·links ok; `git diff --check` clean |
| dependency | native port, 신규 패키지 0 | PASS | `git diff 41c07e9^..cdf6ebc -- app/package.json app/package-lock.json` **빈 diff**; `from '@atlassian` import **0건** |
| message bus | 설계/구현 커밋 분리 | PASS | 9커밋 trailer 전부 파싱됨, 설계 3·구현 5 분리(§11) |
| CI portability | attachment oracle이 OS 구분자 무관 | PASS | `relative(...).split(sep)` + `realpath` root 정규화, 현재 Linux host에서 green |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| upstream `@atlassian-dc-mcp/jira@0.34.0` | tarball `package.json` name/version/gitHead `ab2b534b…`·LICENSE MIT | `src/index.ts` 무조건 등록 14 + `if (attachmentGateway.upload.enabled)` 조건부 1 | ✅ D-007·D-009 실측 확인 |
| upstream REST 의미 | `jira-client/services/{Search,Issue,IssueLink,IssueLinkType,Attachment}Service` method/url | 14개 전부 Orca `rest.ts`와 일치(§7 표) | ✅ 동작 일치 / ❌ 잠금(D1) |
| `docs/guides/closed-network-extensions.md` Jira recipe | `deployment-wiring.test`가 같은 상수(`JIRA_REQUEST_HEADERS`·`JIRA_AUTH_FAILURE_STATUSES`·`normalizeJiraApiBasePath`)로 조립 | probe 403/401 두 상태를 end-to-end 관측 | ✅ |

## 7. 숫자 / 음성 기준 / 상한 재측정

- **upstream 등록 도구 재측정**: tarball `src/index.ts`에 `server.tool(` **15회**, 그중 `jira_uploadAttachment` 1개만 `attachmentGateway.upload.enabled` 분기 안 → 기본 등록 **14**. plan §8의 "최대 15 = 기본 13 + download 1 + 조건부 upload 1"과 일치한다.
- **Orca descriptor 재측정**: `JIRA_TOOL_NAMES` 길이 14 · `new Set(...)` 크기 14(중복 0) · `jira_uploadAttachment` 제품 코드 0건(테스트 2건은 부재 단언).
- **upstream ↔ Orca REST 대조(검증자 실측)**: search `POST /api/2/search` · getIssue `GET /api/2/issue/{key}` · comments `GET …/comment` · create `POST /api/2/issue?updateHistory=true` · update `PUT /api/2/issue/{key}?notifyUsers=true` · addComment `POST …/comment` · updateComment `PUT …/comment/{id}` · transitions `GET|POST …/transitions` · devInfo `getIssue1(key,undefined,'id')` → `GET /dev-status/1.0/issue/detail` · linkTypes `GET /api/2/issueLinkType` · link `POST /api/2/issueLink` · unlink `DELETE /api/2/issueLink/{id}` · attachment `GET /api/2/attachment/{id}` / `GET /api/2/issue/{key}?fields=attachment` — **14/14 일치**.
- **기본 필드 대조**: upstream `DEFAULT_SEARCH_FIELDS` 9개·`DEFAULT_ISSUE_FIELDS` = search + `parent,subtasks` ↔ `rest.ts:18`·`:29` **문자열 단위 일치**.
- **의도한 delta 확인**: `saveName`을 upstream은 "bean 1개면 허용", Orca는 "attachmentId selector에서만 허용" — plan §11 "`saveName`은 단일 attachment 선택에서만 허용한다" 및 D-016 `fixed safe save field`와 일치한다.
- 승인 분모: read-only 6 + 승인 8 = 14. `runtimeApprovalToolNames`가 `readOnlyHint !== true`를 fail-closed로 센다.
- 상한 worst-case 재계산: 한 호출 최대 `10 × 25 MiB = 250 MiB` 디스크 stage, inline은 `maxInlineBytes ≤ 1 MiB`씩이되 tool output 총 2 MiB로 다시 잘린다. JSON request 1 MiB · JSON response 2 MiB.
- 0건 게이트: dependency 4 section + lock **추가 0**, 제품 `@atlassian-dc-mcp` import **0**, `name="power"` provider presentation 잔여 **0**(탭 rail icon `power`는 provider presentation이 아니라 탭 아이콘이며 D-006 범위 밖).

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| Jira REST 동작 | request builder·envelope·에러 매핑·상한을 fake transport로 전건 | 실제 Jira DC의 권한·필드·transition id | 테스트 프로젝트에 PAT 연결 후 search/get/create/update/comment/transition/link/unlink 실행 |
| 첨부 저장 | sanitize·junction·collision·stale·atomic publish를 실제 filesystem fixture로 | 실제 binary·실제 Temp 경로 | `save:false/true` 각각 실행하고 `%LOCALAPPDATA%\Temp\orcinus-orca\jira\…` 확인 |
| ko/en UI | locale resolver·render markup·icon path를 단위/render 테스트로 | 최종 시각 레이아웃·줄바꿈·긴 URL 折 | 앱에서 ko↔en 전환하며 상세 패널 관측 |
| dev-status | issue id 선행 조회 + query 조립 | Bitbucket/Stash 연동된 실제 이슈 | 개발정보가 있는 이슈에서 도구 호출 |
| revoke 회수 | binding sync add/remove를 통합 테스트로 | 실제 spawn 후 도구 목록 | revoke 후 새 agent turn에서 Jira 도구 부재 확인 |

- "electron이라 불가"로 넘긴 항목 0건 — `bootstrap.ts`를 제외한 전 경로가 vitest 대상이다.

## 9. 게이트 재실행

- 실제 실행 명령:
  - `ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci` → `npm rebuild better-sqlite3`(Node ABI) → `node node_modules/electron/install.js`
  - `npm run typecheck` · `npm run lint`
  - `./node_modules/.bin/vitest run`(전체) · §19 대상 스위트
  - `node --test scripts/*.test.mjs` · `node scripts/check-doc-inventory.mjs --check` · `git diff --check` · `npm run build`
- **관측한 실행 산출**(exit code 아님):
  - typecheck 3구성(`node`/`web`/`test`) 통과, 출력 error 0.
  - lint **0 error · 1 warning**(기존 `react-hooks/incompatible-library`).
  - 전체 Vitest **537파일 / 4,937 pass · 3 skip · 0 fail**(DB 36파일은 Node ABI rebuild 후, electron 8파일은 electron 설치 후 green).
  - §19 대상 **19파일 / 217 pass**.
  - scripts **119 pass / 0 fail**(16 suite).
  - doc inventory: generated ok(9 items, 98 channels) · prose ok · links ok.
  - `npm run build`: main/preload/renderer 3구성 빌드 성공.
- `npm test`를 썼는가: 아니오 — `pretest` ABI flip을 피해 `./node_modules/.bin/vitest run`을 직접 썼다(`app/AGENTS.md`).
- ABI/egress 환경 실패 분리: 첫 실행에서 36파일 red였고 **distinct 실패 서명 5종 전부** `Module did not self-register: better_sqlite3.node` / `Electron failed to install correctly` 였다 — `app/AGENTS.md`가 적은 환경 서명과 일치. `npm rebuild better-sqlite3` 뒤 DB 28파일 green, electron 설치 뒤 나머지 8파일(34케이스) green. **변경 기인 red 0건**.
- **게이트가 작업 트리를 바꿨는가**: 아니오. `npm run lint`(`eslint --fix`) 실행 후 `git status --short` 빈 출력.
- **검증 중 실행한 명령이 남긴 잔여물**: `app/node_modules`·`app/out`(둘 다 `.gitignore`), `/tmp/claude-0/`의 upstream tarball. 저장소 추적 파일 잔여물 0건 — 모든 변이 실행 후 `git status` 클린을 확인했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 관측 | — | 전건 수행(§9) |
| AC ↔ production path | 18 AC 1:1 대조 + 32 변이 | — | AC8 ❌, 나머지 ✅/⚠️ |
| upstream 계약 대조 | tarball 실측 14/14 | — | 완료 |
| 레이어/문서 형식·링크 | doc-inventory·boundaries lint | — | PASS |
| AGENTS 위생 | 해당 변경 없음 | — | 해당 없음 |
| 제품 의도 / Open Question | 보조 | **결정** | 신규 없음 |
| UI/UX 시각 품질 | 로직·markup 기계 검증 | **시각 확인** | AC15 |
| 신규 의존성 / PR merge | dependency diff 0 확인 | **승인** | 신규 의존성 없음 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 이번 range에 `AGENTS.md` 변경 **0건** → 해당 없음.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋: 착수 시 `impl` / `IMPL_DONE (V1+ΔV1 r2)` / `Claude (검증)` — 실제 상태와 일치했다.
- 「다음 주체」 칸이 주체 하나만 담는가: ✅ `Claude (검증)` 단일.
- **대상 커밋 좌표 기입(검증자 몫)**: 자리표시자 `(r2 후속 구현 — 검증자 기입)`을 `14590a4f`·`255df587`·`cdf6ebc4`로 채웠다. 9개 인용 해시 전부 `git cat-file -t` = `commit`.
- 비고 5줄 이내: 착수 시점 비고는 6문장이었고, 이번 턴 갱신본을 5줄로 다시 썼다.
- PASS 시 archive 이동: 해당 없음 — FAIL이다.

### Commit / reference 정합성

- trailer 허용값: 9커밋 전부 `Agent ∈ {claude, codex}` · `Handoff` · `Status ∈ {designed, implemented}` · 구현 커밋만 `Criteria-*`/`Verified-By: pending`. ✅
- trailer 실제 파싱: `git log -1 --format='%(trailers:only=true)'`가 9커밋 모두 적힌 키를 그대로 반환(0건 없음). ✅
- 인용 해시 실재: plan·INDEX가 인용한 `41c07e9c`·`6e017239`·`52487f1c`·`914081b2`·`d0880910`·`748372f1` + 이번 기입 3건 전부 존재. ✅
- 재구현 라운드 `[구현자 기입]` 7필드: r2 절에 설계 리뷰·강제 지점 전수·이번 라운드 수정의 잠금·Product/UX 파생 검토·놓친 잠재 문제·구현 보고·Review Signals **7/7 존재**, 산문으로 접힌 필드 0. ✅
- 설계/구현 커밋 분리: 설계 3(`52487f1c`·`914081b2`·`d0880910`)과 구현 5가 분리돼 §0 기준선이 성립한다. ✅ 다만 설계 커밋의 `Agent`가 `codex`다(D4).
- 이동/삭제한 reference·script: 없음.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `.publish()` → `commit()` 이름 변경(r1 설계 대비 차이) | 타당 — 제품 전역 artifact 유일 진입점 가드(`bootstrap.artifacts.test`)를 보존한다. 동작 순서는 설계와 동일 | 유지. 단 4축 표의 `재진입` 행이 인용한 "store state fixture"는 실재하지 않는다 → D2 |
| ΔV1 §11 문구 불일치를 별도 설계 커밋 `914081b2`로 정정 | 타당 — 규범 정정을 구현과 분리한 올바른 처리 | 유지 |
| 독립 리뷰 지적(probe policy·resume 보존·취소 shape·context path·상세 렌더)을 회귀 oracle과 함께 닫음 | 타당 — M15b·M17·M18·M19 전부 red로 재현됨 | 유지 |
| `Criteria-Met: 17/18` | 부분 불일치 — AC8을 검증자는 ❌로 본다 | `16/18`로 재측정(§5) |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | 14개 도구 중 **7개의 REST query/body가 어떤 테스트로도 잠기지 않는다**. `rest.test.ts`의 케이스 제목은 "create/**update**/transition/**link** payload 의미를 보존한다"인데 update·link payload 단언이 없다. 8변이(S1·P-a…P-h) 전부 green | AC8 / EP-15 / VP-08 oracle | **BLOCKING** | root VP-08 (VP-19·23는 자기 oracle 충족) | 구현 — `jira_getIssue`·`getIssueComments`·`updateIssue`·`postIssueComment`·`updateIssueComment`·`linkIssues`·`downloadAttachment(issueKey)`의 query/body 단언 추가 후 같은 8변이로 red 확인 |
| D2 | `JiraAttachmentBatch`의 `state !== 'open'` 재진입 가드를 write/commit 양쪽에서 제거해도 8스위트 84케이스 전건 green | r1 `설계 대비 차이` 표의 `재진입` 행이 인용한 `store state fixture` | NON_BLOCKING | 인접 — AC12 선언 oracle 목록에는 재진입이 없다 | 구현(권장) — 중복 `commit()`·commit 후 `write()`가 `filesystem_error`임을 단언 |
| D3 | Jira `AuthenticatedRequest` 생성이 `jiraRequest()`를 지나는지 보장하는 구조 가드가 없다. 현재 5지점은 전부 준수(검증자 전수 재열거) | EP-26 seam | NON_BLOCKING | — | 기록 — 새 Jira 요청 지점 추가 시 header 누락이 조용히 통과할 수 있다 |
| D4 | 설계 커밋 `52487f1c`·`914081b2`·`d0880910`이 `Agent: codex` + `Status: designed` | root `AGENTS.md` 커밋 프로토콜 | NON_BLOCKING | — | 기록 — 허용값이고 구현과 커밋이 분리됐다. `docs/handoff/AGENTS.md §2`가 같은 에이전트의 설계 수행을 허용한다 |
| D5 | `jiraTools`·`createPluginBinding`·plugin catalog 경로의 프로덕션 호출자 0 — `createPluginBindings()`가 `[]`다 | D-014 | NON_BLOCKING | — | 기록 — 의도된 기본 배포이며 0184 verify가 같은 한계를 이미 기록했다. AC7·13·14의 production path는 배포 fixture에서만 실행된다 |
| D6 | AC15(실제 Jira DC·ko/en UI 실기)는 이 환경에서 관측 불가 | VP-15 | NON_BLOCKING(사람 실기) | — | 사람 — §8 체크리스트 |

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: 이전 **검증** 라운드 없음. 구현 r1→r2는 외부 리뷰 입력으로 돌았고 그 지적은 전부 회귀 oracle로 닫혔다(M15b·M17·M18·M19 red 재현).
- 관련 plan 지침/AC의 존재 여부: **있었다**. AC8이 "request fake가 **각 도구의** outbound request/body …를 함께 단언"으로 oracle을 명시했고 VP-08도 "14 route/**payload**"로 적었다. 구현 자기보고는 같은 칸을 "field inventory·14 route·XOR/cap"으로 적어 payload 항이 빠져 있다.
- 사용자 결정 변경 근거: D-019·D-020은 2026-09-17 사용자 라이브 세션 근거가 있고 D-010·R-10·R-17·R-18 재작성도 설계 커밋에 남아 있다.
- 반복된 검증 환경 한계: 실제 Jira DC endpoint/PAT와 사람 UI 세션 부재(r1·r2·검증 라운드 3회 연속). better-sqlite3 ABI와 electron 바이너리는 이 환경에서 각각 rebuild·재설치로 해소돼 전체 스위트를 green으로 관측했다.

## 15. 결론

- 상태: **FAIL**
- pair 결과: REQUIRED/REGRESSION **PASS 31** · root **PAIR_FAIL 1**(VP-08) · **BLOCKED_BY 1**(VP-15, 외부 환경)
- PLAN_GAP: **없음** — plan은 올바른 oracle을 선언했고 구현이 그 일부를 채우지 못했다. 새 계약을 발명하지 않고 테스트 추가만으로 닫힌다.
- Product/UX 및 ACTIVE Decision 충족: D-001…D-020 **20/20 충족**. 구현이 위반한 Decision은 없다.
- AC 충족: **✅ 16 · ⚠️ 1(AC15) · ❌ 1(AC8 검증 수단) = 18**. AC8의 *동작*은 검증자가 upstream 0.34.0 tarball과 14/14 대조해 정상임을 확인했고, 실패한 것은 그 동작을 잠그는 증거다.
- 현재 변경 운영 gate: **7종 전건 PASS**(lint 0 error · typecheck 3구성 · Vitest 537파일 4,937 pass · scripts 119 · doc inventory · dependency diff 0 · build 성공).
- NON_BLOCKING / NEXT_HANDOFF: D2·D3·D4·D5·D6 기록. 새 handoff 후보 없음.
- repository operation checks: trailer 9/9 파싱·인용 해시 9/9 실재·`[구현자 기입]` 7/7 필드. 대상 커밋 좌표와 비고를 검증자가 INDEX에 기입했다.
- 남은 사람 확인: AC15 (§8 5항목).
- 다음 단계: **구현자(Codex)** — D1을 닫고 D2를 함께 처리한 뒤 `impl/IMPL_DONE`으로 되돌린다. 재검증은 VP-08과 그 §10 EP-15, 그리고 이번 라운드가 green으로 관측한 8변이를 분모로 삼는다.
