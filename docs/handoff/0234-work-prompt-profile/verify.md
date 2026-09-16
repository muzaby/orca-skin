# Verify — 0234-work-prompt-profile

## 메타

| 항목 | 값 |
|---|---|
| slug | `0234-work-prompt-profile` |
| 검증자 | Claude Code |
| 일자 | 2026-09-16 |
| 대상 커밋/range | `89297c8..a0724f5` (r1 `8b48320` · r2 `a0724f5`) |
| 구현 전 plan 기준 | `89297c8` |
| V mode / 유효 V | Baseline V: V1 |
| 검증 기준 plan revision | `89297c8`:V1 |
| 라운드 | 2 |
| 상태 | **PASS** |
| 자기 검증 여부 | 아니다 — 설계·구현은 Codex, 검증은 Claude Code. §4 자기검증 분모 규칙 비적용이나 등록 변이 8건을 전건 재실행하고 검증자 신설 축 7건을 더했다 |

## 0. 기준선 / plan 변경 확인

- 구현 커밋이 `plan.md`를 변경했는가: 예 — 메타 `상태`·`다음 주체` 2행과 `[구현자 기입]` 절만.
- **기준선이 diff로 성립하는가**: 예. 설계 `89297c8`, 구현 `8b48320`·`a0724f5`가 별도 커밋이라 §0 자기 증명 방지 장치가 작동한다.
- Decision Ledger 변경: 없음 (`git show 8b48320 -- plan.md`·`git show a0724f5 -- plan.md`의 hunk가 `@@ -7,11` 메타와 `@@ -367` 이후 구현자 절뿐).
- Product/UX Contract 변경: 없음.
- AC 변경: 없음 — AC1~AC9 원문 그대로 채점했다.
- V node/pair·requiredness·§10·oracle 변경: 없음 — node 16 · pair 16 · EP 14 그대로.
- 채점에 사용할 원 기준: `89297c8`의 §3 Decision Ledger, §7 AC 표, §7-A V/Trace Matrix, §10 강제 지점 표.

### Plan validity

| 검사 | 판정 | 근거 |
|---|---|---|
| Baseline V / Delta V mode·상속 기준 | 유효 | Baseline V / 기준 V none. 0224 등 기존 V를 상속하지 않는다고 §7-A가 명시 |
| NEW/CHANGED node ↔ 같은 레벨 REQUIRED pair | 유효 | 왼쪽 node R 9 + SD 3 + AR 2 + MD 2 = 16, 같은 레벨 REQUIRED pair 16, 누락 0 |
| 영향받은 INHERITED ↔ REGRESSION pair | 유효 | INHERITED node 0 → REGRESSION pair 0이 정합 |
| pair별 path·§10 전수·직접 oracle | 유효 | 16행 모두 production path·직접 oracle·EP 목록을 갖는다. EP 참조 합집합 = {EP1…EP14}, 미선언 EP 참조 0 |
| 필요한 pair의 선택적 적대 증거·선택 이유 | 유효 | 구조적 proxy·0건 oracle·배포 도달성을 쓰는 pair가 M1~M6를 선택했고 선택 이유를 적었다. 직접 행동 oracle인 VP-06/09/11/14/16만 `미선택` |
| 현재 변경 산출물의 운영 gate·범위 | 유효 | 문서·message bus / 타입·lint / 관련 UT·IT·ST / packaging·native 4종. 무관한 기존 실패를 blocking으로 올리지 않았다 |

- V 도입 전 plan이면 읽기 전용 합성 매핑: 해당 없음 — V1 Baseline을 직접 선언한 plan이다.
- root PLAN_GAP과 영향 pair: 없음.

## 1. Product & UX / ACTIVE Decision 요약

| Decision / 요구 | 기대 결과 | 실제 production path |
|---|---|---|
| D-001 · D-009 | 보존 원문 전체가 Work instructions, key `work:4` | `work-system-prompt.ts` → `profiles.ts` → `agent-extension-profile.ts` → `builder.build` → `adaptSystemPrompt` |
| D-002 | preset·공통 헤더·동적 출력 경로를 기존 자리에 유지 | `builder.ts` → `system-header.ts` → `claude.ts` query options |
| D-003 · D-004 | 앱 소유 local plugin을 Work 세션에만 전달 | `bootstrap.ts` → `RouterContext.workProfilePluginPath` → `send.ts` → `adaptPlugins` |
| D-005 | workspace `.claude`를 만들거나 수정하지 않음 | plugin은 절대경로 root로만 전달, 설정 파일 쓰기 경로 없음 |
| D-006 | 기존 adapter·SDK·runtime·승인·취소 유지 | `ClaudeAdapter.sendMessage` 옵션 조립 그대로 |
| D-007 | 신규·warm·respawn·resume·자동 연속에서 출생 종류 유지 | `send.ts` 최초 + `prepareContinuation` 두 지점이 같은 helper 호출 |
| D-008 | 번들 실제 실행·패키지 실경로로 검증 | `scripts/smoke-work-profile.mjs` → 동봉 CLI → loopback |
| D-010 | 필수 Work 리소스 실패는 준비 오류 | `agent-extension-profile.ts` throw → `send.ts` classified error → `finally` 정리 |

### end-to-end 흐름

```text
사용자 전송 (Work / Code)
  → handleChatSend: DB/lease 출생 kind 확정
  → prepareAgentExtensionProfile(kind, ctx.workProfilePluginPath)
       kind=work 이면 manifest/work.md 읽기·검증 후 pluginRoots 추가
  → ExtensionBuilder.build(…, profile) : base roots 뒤에 새 배열로 Work root
  → ClaudeAdapter.sendMessage → adaptSystemPrompt + adaptPlugins → SDK query
  → 번들 CLI가 forced output style 적용, 코딩 지침 제외
  → 자동 연속(listen/flush)도 같은 helper를 재호출
  → 리소스 실패 시 query 전에 error 이벤트 + turn/lease/runtime 해제
```

## 2. 구현 결과 비판적 검토 — AC 전에

| 질문 | 판정 | 근거/후속 |
|---|---|---|
| 실환경 실패 방식 | 준비 오류로 노출 | `agent-extension-profile.ts:26`의 단일 catch가 경로·ENOENT·JSON·빈 본문을 하나의 한국어 오류로 올린다 |
| false success 가능성 | 낮음 | 적용 여부를 `init.output_style` 라벨이 아니라 실제 요청 본문(`styleOccurrences`·`codingInstructions`)으로 판정한다 |
| partial failure/rollback | 잔여 없음 | 준비 실패 시 SDK query 미호출을 직접 단언(`mocks.acquire` 0회), `release`·`releaseRuntime`·`releaseChain` 호출 확인 |
| Product/UX의 A가 아닌 다른 B를 구현했는가 | 아니다 | 원문은 append가, 코딩 지침 제거는 output style이 소유 — 사용자 제안 §1·§2의 역할 분리 그대로 |
| 증상만 제거하고 상태 변화가 남았는가 | 해당 없음 | 새 DB·파일·마이그레이션 쓰기 0. 리소스 읽기는 read-only |
| 최적화가 잃은 재검증/취소/만료 관측 | 없음 | cache/TTL 미도입 — Work 준비마다 파일을 다시 읽는다. 연속 턴 재진입도 같은 helper |
| 출력/요청 worst-case 상한 | 유계 | Work turn 당 readFile 2회, append 1회(원문 15,527 bytes), plugin root 1개 추가 |

## 3. 역방향 탐색

```bash
bash .agents/skills/handoff-verify/scripts/scan-surface.sh 89297c8..a0724f5
```

| 후보 | 판정 | 귀속 / 근거 |
|---|---|---|
| 미사용 export | 없음 | 값·타입 export 모두 후보 0 |
| 테스트 전용 참조 | 없음 | 후보 0. `prepareAgentExtensionProfile`·`resolveWorkProfilePluginDir`는 `send.ts`·`bootstrap.ts`가 부른다 |
| 형제 정책 비대칭 | 없음 | 후보 0 |
| 신규 등록값의 기존 소비처 영향 | 무영향 | `extensions.build` 프로덕션 호출부 전수 2곳(`send.ts:344`·`send.ts:567`)이 모두 새 profile을 받는다 |
| producer ↔ consumer 파생 불일치 | 없음 | `resolveWorkProfilePluginDir`의 packaged 산출이 `electron-builder.yml` extraResources 목적지와 일치 — 실제 package로 확인 |
| 동일 규칙 중복 구현 | SSOT 유지 | 원문 소유자는 `work-system-prompt.ts` 1곳. `docs/handoff/.../work-system-prompt.md`는 승인 입력이자 equality oracle이며 런타임이 읽지 않는다 |

- **배선 vs 테스트 분리**: 신규 심볼의 유일 호출자가 테스트인 경우 0. `work-profile.integration.test.ts`·`work-profile.runtime.test.ts`는 실제 `ClaudeAdapter`·`ExtensionBuilder`·`prepareAgentExtensionProfile`을 부르며 동명 로컬 재구현을 세우지 않는다.
- 다른 forced output style을 가진 base plugin root는 현재 0 — `rg 'output-styles'` 프로덕션 참조 1건이 Work 리소스 자신이다(D6).

## 4. 기존 테스트 / semantic 검증 확인

- plan이 인용한 기존 테스트 케이스 실제 존재: `work-profile.integration.test.ts`가 헤더 차이·공통 options·승인 거절을 유지한 채 plugins 단언만 Work 전용 계약으로 바뀌었다.
- 핵심 입력/분기가 실제 실행됨: `send.agent-profile.test.ts`가 실제 `handleChatSend`를 `new`·`resume`·`forkFrom`·`handoffFrom` 4종 × Work/Code 2종 × (최초 1 + 자동 연속 2)로 통과시킨다.
- structural proxy만으로 semantic 목표를 통과시킨 AC: 없음 — AC7/AC8은 실제 CLI 요청 본문을 본다.
- **선택된 적대 증거 재측정**: 등록 변이 8건(M1·M1a·M2·M3·M4a·M4b·M5·M6a) 전건 재실행, **검출 8 · 미검출 0**. 검증자 신설 축 7건 추가, **검출 6 · 미검출 1**. 일반 hunk 자동 확장 0.
- **이전 라운드 대조**: r1이 red로 적은 변이 중 이번에 green인 것 0건 — 덮개 회귀 없음. r2는 테스트 장치를 교체·삭제하지 않았다(`git show a0724f5`의 app 변경은 fixture 추가 2줄).
- **자기검증 분모**: 구현자(Codex) ≠ 검증자(Claude Code). 그래도 보고에 없던 축 7건을 만들어 1건이 미검출로 드러났다(D2).

| 변이 | 범위 | 이전 라운드 | 이번 라운드 | 귀속 |
|---|---|---|---|---|
| M1 — `builder.ts`가 profile roots를 병합하지 않음 | 9파일 46케이스 | red | **red** (4파일 7케이스 실패) | VP-01/03/13/15 등록 변이 |
| M1a — `send.ts` 최초 build가 `pluginRoots`를 버림 | 같음 | red | **red** (1파일 4케이스) | 같은 M1 |
| M2 — Work/Code 분기 맞바꿈 | 같음 | red | **red** (4파일 17케이스) | VP-01/02/03/10/13/15 등록 변이 |
| M3 — key `work:4`→`work:3` | 같음 | red | **red** (3파일 6케이스) | VP-04/10/15 등록 변이 |
| M4a — `keep-coding-instructions: true` | native smoke(dev) | red | **red** (`coding instructions mismatch`) | VP-07/08/12 등록 변이 |
| M4b — `force-for-plugin: false` | native smoke(dev) | red | **red** (`output style count mismatch`) | 같은 M4 |
| M5 — fixture cwd에 `.claude/settings.json` 주입 | native smoke(dev) | red | **red** (`added` 2항목: directory·settings.json) | VP-05/10 등록 변이 |
| M6a — packaged resolver가 `app.asar` 내부 반환 | 9파일 46케이스 | red | **red** (1파일 1케이스) | VP-08/12 등록 변이 |
| M6b — package config에서 Work extraResources 제외 | electron-builder | red | **미실행** — 양성 대조로 대체(§5 gate) | 같은 M6 |
| NEW-A — Work일 때 base roots를 버리고 profile roots만 반환 | 9파일 46케이스 | 최초 | **red** (3파일 6케이스) | 검증자 신설 — 형제 슬롯 맞바꿈 |
| NEW-B — 리소스 오류를 삼키고 profile을 그대로 반환 | 같음 | 최초 | **red** (2파일 10케이스) | 검증자 신설 — silent fallback |
| NEW-C — dev/packaged 분기 반전 | 같음 | 최초 | **red** (1파일 2케이스) | 검증자 신설 |
| **NEW-D — `isAbsolute` 가드만 제거** | 같음 | 최초 | **green — 미검출** | 검증자 신설 → D2 |
| NEW-E — 자동 연속이 `agentKind` 대신 `'code'` 전달 | 같음 | 최초 | **red** (1파일 5케이스) | 검증자 신설 — 형제 진입점 |
| NEW-F — manifest `name` 검사 제거 | 같음 | 최초 | **red** (1파일 2케이스) | 검증자 신설 |
| NEW-G — manifest/style 읽기 슬롯 맞바꿈 | 같음 | 최초 | **red** (4파일 10케이스) | 검증자 신설 — 형제 슬롯 맞바꿈 |

- 동작 보존 추출 라운드인가: 아니오 — 새 동작(원문·plugin·검증 실패)이 들어온 라운드다.
- 소거 변이의 잔여물 수렴: NEW-D는 1줄 조건 완화라 잔여물이 없다. typecheck·lint도 초록이며, 밀어야 할 다음 단계가 없다.
- 형제 슬롯 맞바꿈 변이: 3축 실행(NEW-A Work↔base roots · NEW-E Work↔Code kind · NEW-G manifest↔style 읽기) 전건 red.
- `N회` 기준의 실제 관측 주체: `approvedOccurrences`·`styleOccurrences`·`appendOccurrences`를 loopback 서버가 받은 실제 요청 본문에서 센다. Work 1/1/1, Code 0/0/1.
- 순서 기준의 관측 훅/로그: append 순서(Orca→Agent→Tools→User→Project)는 `workPrompt.append.replace('# Agent\n…','')` === `codePrompt.append` 로 실제 adapter options에서 관측한다.

## 5. V-pair closeout — `UT → IT → ST → AT`

| Pair | left ↔ right / 레벨 | requiredness | 결과 | 직접 검증 증거 | production path / §10 전수 |
|---|---|---|---|---|---|
| VP-15 | MD-01 ↔ UT-01 / UT | REQUIRED | **PASS** | 원문 byte equality 15,527·`work:4`·frozen base 비변이 / M1·M2·M3 red | profile→roots snapshot / EP1·EP2 (2/2) |
| VP-16 | MD-02 ↔ UT-02 / UT | REQUIRED | **PASS** | `builtin-resources.test.ts` dev/packaged + 실제 package 대상 검증자 probe / M6a·NEW-C red | host paths→plugin path/read / EP5·EP14 (2/2) |
| VP-13 | AR-01 ↔ IT-01 / IT | REQUIRED | **PASS** | `send.agent-profile` 최초·연속 양쪽 options, Bootstrap 입력 단언 / M1a·M2 red | app profile input→builder→adapt / EP2·3·4·5·6 (5/5) |
| VP-14 | AR-02 ↔ IT-02 / IT | REQUIRED | **PASS** | 누락·손상·비절대 8조건 거절, 쓰기 0 / NEW-B·NEW-F red | resource read→prepare error / EP3·4·5·14 (4/4) |
| VP-10 | SD-01 ↔ ST-01 / ST | REQUIRED | **PASS** | 같은 cwd Work/Code 동시 native 신규·재개, warm/key/연속 회귀 / M3·M5 red | send→runtime→continuation / EP3·4·5·6·7·8 (6/6) |
| VP-11 | SD-02 ↔ ST-02 / ST | REQUIRED | **PASS** | 실제 `ClaudeAdapter`의 질문 allow·PowerShell deny·interrupt·stopTask·output.captured·background 정규화 | adapter→runtime→history/relay / EP6·9·10·11 (4/4) |
| VP-12 | SD-03 ↔ ST-03 / ST | REQUIRED | **PASS** | dev native 요청 9관측 + Linux package 실경로 resolver probe / M4a·M4b·M6a red | packaged resolver→native SDK request / EP5·6·12·13 (4/4) |
| VP-01 | R-01 ↔ AT-01 / AT | REQUIRED | **PASS** | 원문 전체 일치 + `approvedOccurrences` Work 1 / Code 0 | profiles→header→SDK / EP1·2·6 (3/3) |
| VP-02 | R-02 ↔ AT-02 / AT | REQUIRED | **PASS** | `# Agent` 섹션 제거 후 Code append와 완전 일치, 7개 SDK 옵션 필드 동일 | builder→output append→SDK / EP2·3·4·6 (4/4) |
| VP-03 | R-03 ↔ AT-03 / AT | REQUIRED | **PASS** | 같은 cwd 두 세션의 roots = base+work / base, frozen base 불변 / NEW-A red | bootstrap→send→builder→SDK / EP3·4·5·6 (4/4) |
| VP-04 | R-04 ↔ AT-04 / AT | REQUIRED | **PASS** | 4 arrival × 2 kind × 3 build, native resume가 session ID·`work:4` 유지 / NEW-E red | DB/lease→send/continuation→runtime→SDK / EP1·3·4·7·8 (5/5) |
| VP-05 | R-05 ↔ AT-05 / AT | REQUIRED | **PASS** | empty·sentinel fixture의 `.claude` 트리 양방향 차집합 `[]`, sha256 동일 / M5 red | resource resolve→SDK / EP3·4·5·6 (4/4) |
| VP-06 | R-06 ↔ AT-06 / AT | REQUIRED | **PASS** | native toolNames Work=Code 29개 동일, workflow 런에서 Write deny 1건·`workflowCompleted` true | adapter hooks→runtime→events / EP6·9·10·11 (4/4) |
| VP-07 | R-07 ↔ AT-07 / AT | REQUIRED | **PASS** | dev native: Work `codingInstructions=false`·style 1, Code `true`·style 0 / M4a·M4b red | SDK→번들 CLI→loopback / EP6·12 (2/2) |
| VP-08 | R-08 ↔ AT-08 / AT | REQUIRED | **PASS** | Linux `electron-builder --dir` 산출에 manifest/style 존재, app.asar 내 `claude-plugins` 0건, 실제 package로 resolver→검증 통과 / M6a red | package→resolver→CLI / EP5·12·13 (3/3) |
| VP-09 | R-09 ↔ AT-09 / AT | REQUIRED | **PASS** | 8개 실패 입력에서 query 미호출·오류 이벤트·lease/runtime 해제, Code 음성 대조 통과 | validation→send catch/finally / EP3·4·5·14 (4/4) |

- root `PAIR_FAIL`: 없음.
- 종속 `BLOCKED_BY`: 없음.
- 하나의 증거가 함께 닫은 pair와 직접 판정 범위: native smoke 9관측이 VP-01·05·06·07·10·12를 함께 지지한다. 각 pair는 그 관측 중 자기 계약 필드(`approvedOccurrences` / workspaces 차집합 / toolNames / `codingInstructions` / resume ID / pluginPath)만으로 독립 판정했다.
- **VP-08에서 못 본 것**: packaged 모드 CLI 요청 본문. `scripts/smoke-work-profile.mjs:305`가 `packaged smoke requires Windows`로 하드 게이트하고 `claude-agent-sdk-win32-x64/claude.exe`를 고정 참조해 Linux에서 재측정할 수 없다(D3). dev 모드 요청 본문과 package 실경로·asar 배제는 검증자가 직접 관측했고, packaged 요청 본문만 구현자 증거에 의존한다.
- 이번 라운드 실행 범위: 최초 검증 라운드다 — 유효 V의 REQUIRED 16 pair 전건과 현재 변경의 운영 gate 4종을 실행했다.

### AT / AC 세부와 합계

| AT / AC | 제품/동작 기준 | 결과 | 검증 증거 | production path |
|---|---|---|---|---|
| AT-01 / AC1 | Work에만 원문 전체가 한 번 | ✅ | `work-system-prompt.ts` literal = 승인 원문 trim, 둘 다 **15,527 bytes**·95줄 byte 동일; 이스케이프(백틱·`${`·역슬래시) 0 | profiles→header→SDK |
| AT-02 / AC2 | preset·공통 헤더·동적 출력 경로 유지 | ✅ | `# Agent` 출현 1회, 그 절만 지우면 Code append와 완전 일치; cwd·additionalDirectories·model·permissionMode·settingSources·extraArgs·executable 7필드 동일 | send→builder→adaptSystemPrompt |
| AT-03 / AC3 | 같은 cwd에서 Work만 절대경로 plugin | ✅ | native 동시 세션: Work roots 2(base+work-profile 절대경로), Code roots 1; frozen base 배열 비변이 | bootstrap→send→builder→adaptPlugins |
| AT-04 / AC4 | 신규·warm·key·resume·fork/handoff·연속에서 종류 유지 | ✅ | 4 arrival × 2 kind × 3 build 전건, 연속 `resolveTurnProvider` 2회 모두 `agentKind` 일치; native resume이 session ID·`work:4` 보존 | send/continuation→runtime-entry→adapter |
| AT-05 / AC5 | 설정 파일 없이 시작, 기존 `.claude` 무변경 | ✅ | empty fixture `before=[] after=[]`; sentinel fixture CLAUDE.md·settings.json sha256 전후 동일, `added`·`removed` 모두 `[]` (new·resume 각각) | resource resolve→SDK load |
| AT-06 / AC6 | 도구·승인·취소·출력·background 기존 경로 | ✅ | native toolNames Work=Code 29개 동일; workflow 런 `workflowCompleted=true`·Write deny 1건; 실제 adapter에서 interrupt 영수증·stopTask·output.captured·background 정규화 | adapter hooks/permission→runtime→UI 이벤트 |
| AT-07 / AC7 | 번들이 Work style을 쓰고 코딩 지침 제외 | ✅ | dev native 8관측: Work style 1·coding false, Code style 0·coding true; M4a·M4b 두 설정 변이가 각각 red | SDK→번들 CLI(2.1.267)→loopback |
| AT-08 / AC8 | 배포 패키지가 cwd 무관 절대경로로 로드 | ✅ | `electron-builder --linux --dir` 산출의 `resources/claude-plugins/work-profile/`에 manifest·work.md 2파일, app.asar 내 `claude-plugins` 항목 **0**; 그 resources로 production resolver→`prepareAgentExtensionProfile` 통과 | packaged resources→resolver→SDK |
| AT-09 / AC9 | 필수 리소스 실패는 Work 준비 오류, Code 정상 | ✅ | 상대경로·빈 문자열·부재 경로 3건 + manifest 부재/파손/타 plugin·style 부재/공백 5건 = 8조건 거절, 리소스 루트 쓰기 0; 최초·자동 연속 양쪽에서 query 미호출·error 이벤트·정리 호출 | validation→send catch/finally |

- **합계 재측정**: `✅ 9 · ⚠️ 0 · ❌ 0 = 총 9` (분모 9를 §7 AC 표에서 직접 셌다) · 자기보고 `9/9` · **일치**.
- **합계 사본 대조**: 본문 9/9 ↔ 커밋 trailer `Criteria-Met: 9/9`(`8b48320`·`a0724f5` 모두) ↔ INDEX 비고 `AC 9/9` — **일치**.

### pair별 plan §10 강제 지점 분모

| Pair | 계약/필드 | plan이 적은 강제 지점 | 코드에서 확인한 지점 | 결과 |
|---|---|---|---|---|
| VP-01/04/15 | 원문·Code 불변·`work:4` | EP1 (1) | `profiles.ts:11-18` 단일 `PROFILES` (1/1) | PASS |
| VP-01/02/13/15 | 단일 append·base roots 불변 | EP2 (1) | `builder.ts:72` 새 배열 생성 1곳 (1/1) | PASS |
| VP-03/04/09/10/13/14 | 최초 준비 배선 | EP3 (1) | `send.ts:333` (1/1) | PASS |
| VP-04/09/10/13/14 | 자동 연속 준비 배선 | EP4 (1) | `send.ts:548` (1/1) | PASS |
| VP-03/05/08/12/13/16 | 앱 소유 절대경로 | EP5 (1) | `builtin-resources.ts:15` + `bootstrap.ts:736` 주입 (1/1) | PASS |
| VP-01/02/03/06/07/11/12 | preset·append·plugins | EP6 (1) | `claude.ts:490-494` (1/1) | PASS |
| VP-04/10 | 최초 key 비교 | EP7 (1) | `runtime-entry.ts:88`→`respawn-inputs.ts:73`→`respawn-policy.ts:38` (1/1) | PASS |
| VP-04/10 | 자동 key 비교 | EP8 (1) | `chat-turn-continuation.ts:79`→같은 policy (1/1) | PASS |
| VP-06/11 | 질문·승인·취소 | EP9 (1) | 기존 `canUseTool`·hooks·interrupt, Work 조건 실행 (1/1) | PASS |
| VP-06/11 | 출력 생성·수집 | EP10 (1) | `makeOutputFilesHook` PostToolUse→`output.captured` (1/1) | PASS |
| VP-06/11 | Task/background | EP11 (1) | 기존 `claude.background` 정규화, 추가 승인 0회 (1/1) | PASS |
| VP-07/08/12 | 실제 style 의미 | EP12 (1) | `output-styles/work.md` frontmatter 2필드 → CLI 요청 (1/1) | PASS |
| VP-08/12 | extraResources 복사 | EP13 (1) | `electron-builder.yml` `!resources/claude-plugins/**` + extraResources 1쌍 (1/1) | PASS |
| VP-09/14/16 | 필수 파일 read validation | EP14 (1) | `agent-extension-profile.ts:18-30` query보다 앞 (1/1) | PASS |

- **검증자 독립 재열거**: `extensions.build` 프로덕션 호출부 전수 2곳, `buildExtensions` 정의·호출 전수 4곳(`send.ts` 2 producer → `runtime-entry.ts`·`chat-turn-continuation.ts` 2 consumer). 둘 다 새 profile을 받는다. `complete()`는 `claude.ts:326`이 plugin 로딩을 하지 않는다고 주석·코드가 함께 말하고 실제 options에 `plugins` 키가 없다 — 제목 생성 경로에 Work가 새지 않는다.
- 표에 없는데 같은 불변식이 필요한 지점: **없음**. 세션 query를 여는 프로덕션 경로가 위 2 producer뿐이라 §10 분모 14가 전수다.
- `실패 의미`가 “다른 게이트가 막는다”고 적은 행: 없음 — 모든 EP가 자기 지점에서 직접 강제한다.

### 현재 변경의 운영 gate

| Gate | 현재 변경에 적용되는 이유 | 결과 | 증거 / 범위 판정 |
|---|---|---|---|
| 타입 (`npm run typecheck`) | app subtree 수정 | **PASS** | node·web·test 3구성 실행, **error 0** |
| lint (`npm run lint`) | 같음 | **PASS** | `0 errors, 1 warning` — 경고는 `useTranscriptVirtualizer.ts:22`의 기존 react-compiler 경고로 이번 변경 파일이 아니다 |
| 관련 UT/IT/ST (`vitest run`) | 프로필·runtime 경계 | **PASS** | 대상 12파일 68케이스. 전체 스위트 `a0724f5`에서 **525파일 통과 + 1파일 스킵 / 4,842케이스 통과 + 3스킵** |
| node scripts (`node --test scripts/*.test.mjs`) | `smoke-work-profile.test.mjs` 신규 | **PASS** | **119/119**, 16 suites, fail 0 |
| 문서·message bus | 새 plan·원문·보드·arch 문서 | **PASS** | `check-doc-inventory --check`: generated ok(9 items, 98 channels)·prose ok·links ok. `git diff --check 89297c8 a0724f5` 무출력 |
| packaging/native | 외부 CLI가 파일을 읽어야 함 | **PASS** | dev native smoke `status:pass` 8관측 / `--workflow` 9관측. Linux `electron-builder --dir` 산출 확인. packaged CLI 요청은 Windows 전용(D3) |

## 6. 외부 포트 / 문서 계약

| 계약 | shape 검증 | semantics 검증 | 결과 |
|---|---|---|---|
| SDK `Options.plugins` `{type:'local',path}` | `adaptPlugins` 타입 + typecheck | 실제 CLI가 해당 root의 style을 로드해 요청에 반영 | PASS |
| output-style frontmatter boolean 2필드 | YAML `keep-coding-instructions: false` · `force-for-plugin: true` | M4a/M4b 각각 red — 두 필드가 실제 의미를 갖는다 | PASS |
| `docs/arch/backend/system-prompt.md` | 상대 링크·inventory 게이트 통과 | 서술이 코드와 일치(경로 해석·주입·검증·respawn key) | PASS |

## 7. 숫자 / 음성 기준 / 상한 재측정

- 원문 길이: **15,527 bytes** — `work-system-prompt.ts`의 template literal과 승인 `work-system-prompt.md` trim이 byte·줄 수(95) 모두 동일.
- pair 16 · 왼쪽 node 16 · EP 14: 검증자가 표에서 직접 재계수, plan 자기보고와 일치. EP 참조 합집합도 14로 미선언 참조 0.
- 전체 스위트 자기보고 대조: 구현자 r2 `525파일·4,844통과·1스킵`(Windows) ↔ 검증자 `525통과+1스킵 파일 / 4,842통과+3스킵`(Linux). **총계 4,845로 동일**하고, 2건 차이는 Linux에서 스킵되는 Windows short path 케이스(`features/artifacts/files.test.ts`·`input-files.test.ts`)다 — 오계수가 아니다.
- 0건 게이트의 정당한 예외 보존: `.claude` 차집합 0건 oracle이 sentinel fixture의 기존 파일 2개를 지우지 않는다(before/after 모두 sha256 보존). M5로 민감도 확인.
- 출력/요청 상한: Work turn 당 readFile 2회·append 1개. token 추정치를 계약으로 만들지 않았다는 §14 서술과 코드가 일치한다.

## 8. 테스트 가능한 핸들 탐색 후 남은 사람 실기

| 항목 | 기계 검증한 범위 | 남은 사람 실기 | 실행 방법 |
|---|---|---|---|
| SDK/번들 CLI 적용 | loopback fixture 모델 + 실제 동봉 CLI 요청 본문 | 없음 | — |
| 패키징 | Linux `--dir` 산출 파일·asar 배제·resolver 통과 | Windows 패키지의 CLI 요청 본문 | Windows에서 `node app/scripts/smoke-work-profile.mjs --resources-path=<dist/win-unpacked/resources>` |
| Work 자연어 준수 품질 | 원문 전달·style 적용은 기계 검증 | 실제 모델의 문서·조사 작업 품질 표본 | 앱을 띄워 Work 대화로 문서 과제 수행 후 산출물·링크 확인 |
| 앱 UI 실기 | 오류 이벤트 발신·정리 호출은 단언 | 리소스 손상 시 화면 문구 시각 확인 | 설치본 리소스를 훼손하고 Work 전송 |

## 9. 게이트 재실행

- 실제 실행 명령:
  - `cd app && npm run typecheck` · `npm run lint`
  - `./node_modules/.bin/vitest run` (전체) 및 대상 12스위트 지정 실행
  - `node --test scripts/*.test.mjs`
  - `node scripts/check-doc-inventory.mjs --check` (app cwd)
  - `node scripts/smoke-work-profile.mjs` / `--workflow`
  - `./node_modules/.bin/electron-vite build && ./node_modules/.bin/electron-builder --linux --dir`
- **관측한 실행 산출**: typecheck 3구성 error 0 · lint `0 errors, 1 warning` · vitest `a0724f5` 526파일 4,845케이스(525+1 / 4,842+3) · scripts `# pass 119 # fail 0` · doc-inventory 3줄 ok · native smoke `status:"pass"` observations 8·9 · package `resources/claude-plugins/work-profile` 2파일.
- `npm test`를 썼다면 DB 검증 필요성: `npm test` 자체는 쓰지 않고 `vitest run`을 직접 호출했다. DB 로드 스위트(`work-profile.integration`·`infra/db/*`)를 실행해야 해서 `scripts/ensure-sqlite-abi.mjs node`로 Node ABI를 한 번 맞췄다.
- ABI 전환/egress 403 등 환경 기인 실패와 변경 관련 실패 분리 근거: 초기 1회 `NODE_MODULE_VERSION 140 vs 127`(Electron ABI 잔재)과 `Electron failed to install correctly`(binary 미다운로드)가 났다. 각각 Node ABI rebuild와 `node node_modules/electron/install.js`로 해소했고, 해소 후 대상 스위트가 전건 통과해 **변경 무관**으로 판정한다.
- **게이트가 작업 트리를 바꿨는가**: `npm run lint`는 `--fix`지만 실행 전후 `git status --porcelain` 모두 빈 출력 — autofix 쓰기 0. 검증자가 고친 코드를 채점한 부분이 없다.
- **검증 중 실행한 명령이 남긴 잔여물**: `electron-vite build`·`electron-builder`가 만든 `out/`(15M)·`dist/`(331M)는 격리 worktree에 생성했고 삭제했다. 저장소 작업 트리는 검증 전후 모두 clean이다. 15건 변이는 전부 격리 worktree에서 적용 후 `git checkout --`로 복원했다.

## 10. 검증 책임 분리 — 사람 vs 에이전트

| 항목 | 에이전트 | 사람 | 결과 |
|---|---|---|---|
| lint/typecheck/자동 테스트 | 실행·산출 관측 | — | PASS |
| AC ↔ 코드/production path | 9행 1:1 대조 | — | ✅9 |
| 레이어/계약/문서 형식·링크 | boundaries lint·inventory·링크 | — | PASS |
| AGENTS 위생 | 변경 없음 확인 | — | 해당 없음 |
| 제품 의도 / Open Question | 신규 OPEN 0 | **결정** | 해당 없음 |
| Work 자연어 품질 | 전달·적용만 기계 검증 | **표본 확인** | 남김 |
| Windows 패키지 실기 | Linux package로 대체 관측 | **최종 확인** | 남김 |
| 신규 의존성 / PR merge | 신규 의존성 0 | **승인** | 남김 |

## 11. Repository operation checks

### AGENTS.md 위생 / 정합성

- 이번 range가 `AGENTS.md`를 변경하지 않았다 — 해당 없음.
- 신규 산출물의 민감 패턴 스캔: 키·토큰·PW·이메일·사설 IP 0건. 원문에 등장하는 도구명은 조건부 행동 지침이며 자격증명이 아니다.

### INDEX 보드 정합성

- 상태 / 다음 주체 / 대상 커밋 일치: 이번 검증으로 `verify/PASS`·다음 주체 `—`로 갱신하고 archive로 옮겼다.
- 「다음 주체」 칸이 주체 하나만 담는가: 예.
- 대상 커밋 좌표 기입(검증자 몫): 설계 `89297c8` · r1 `8b48320` · r2 `a0724f5`. 셋 다 `git cat-file -t` = `commit`.
- **보드가 적었던 설계 좌표 `90ee11e9`는 실재하지 않는다**(`git cat-file -t` → `Not a valid object name`). 공유 브랜치의 설계 커밋은 `89297c8`이며 이번에 교정했다(D1).
- plan 메타의 `조사 기준 9de8dd3c`: 실재(`fix(renderer): 프로젝트 세션 UI 일관성 복구`).
- 비고 5줄 이내: 예 — 표 한 행.
- PASS 시 archive 이동: 완료 — `docs/archive/handoffs/INDEX-history.md` 최상단.

### Commit / reference 정합성

- trailer 허용값: `Agent: codex` · `Handoff: docs/handoff/0234-work-prompt-profile/` · `Status: designed|implemented` · `Criteria-Met: 9/9` · `Verified-By: pending` — root `AGENTS.md` 표와 일치.
- trailer 실제 파싱: `git log -1 --format='%(trailers:only=true)'`가 `89297c8` 3키 · `8b48320` 5키 · `a0724f5` 5키를 그대로 반환. 리터럴 `\n` 붕괴 0.
- 인용된 커밋 해시 실재: `9de8dd3c` ✓ · `90ee11e9` ✗(D1) · `89297c8`·`8b48320`·`a0724f5` ✓.
- 재구현 라운드 `[구현자 기입]` 7필드 전수: r2가 설계 리뷰 · 강제 지점/자기확인 · 이번 라운드 수정의 잠금 · Product/UX 파생 · 놓친 잠재 문제 · 구현 보고 · Review Signals **7/7**을 각각 표로 갖는다. 산문으로 접힌 필드 0.
- 이동/삭제한 reference·script: 없음. 신규 `scripts/smoke-work-profile.mjs`는 `smoke-work-profile.test.mjs`가 순수 헬퍼를 소비하고 `npm test`가 자동 실행한다.

## 12. 구현자 코멘트 / 선조치 경계

| 구현자 코멘트 | 검증자 판단 | 반영 |
|---|---|---|
| `work-profile-resource.ts` 대신 `agent-extension-profile.ts` 한 함수로 통합 | 타당 — §11이 허용한 구현 세부. 대체물이 새로 만든 실패 모드를 찾아봤으나 cache·공유 상태·재진입 축 모두 없음을 직접 확인(매 Work 준비 재읽기, frozen base 비변이, 연속 턴 재호출) | 그대로 |
| #1 Bootstrap 입력이 resolver 단위검사로 안 잠긴다 → 선조치 | 타당 — N1a~d 축을 `builtin-resources.test.ts`가 갖는다. M6a·NEW-C로 민감도 재확인 | 그대로 |
| #2 loopback이 CLI 초기 `HEAD /api/hello`를 거절 → 선조치 | 타당 — 검증자 재실행에서 dev 8·workflow 9관측 모두 성공 | 그대로 |
| #3 forced style 복수 시 앞선 plugin 우선 → 보고만 | 타당 — 현재 base roots에 output-styles 0개임을 프로덕션 grep 1건(Work 리소스 자신)으로 확인 | D6 |
| #4 공통 header의 workspace-only 문구 긴장 → 보고만 | 타당 — 비범위. 동적 출력 경로 실값 전달은 AC2에서 관측 | 기록 |
| #5 리뷰 subagent가 사용량 제한으로 종료 | 타당 — PASS로 집계하지 않았다. 이번 독립 검증이 그 자리를 대신한다 | 해소 |
| r2 #1 `as never`가 필수 컨텍스트 누락을 typecheck에서 숨김 → 보고만 | 타당하며 r1이 전체 gate red로 나간 직접 원인이다 | D5 |
| r2 #2 저장소 루트에서 vitest 호출 시 cwd 의존 → 선조치 | 타당하나 fixture가 여전히 `resolve()` 상대경로다 | D4 |

## 13. Finding disposition / 파생 이슈

| # | finding | 귀속 | disposition | root / 영향 pair | 후속 |
|---|---|---|---|---|---|
| D1 | INDEX의 설계 커밋 좌표 `90ee11e9`가 실재하지 않는다 (실제 `89297c8`) | repository operation | **NON_BLOCKING** | — | 이번 검증 커밋에서 교정 |
| D2 | `agent-extension-profile.ts:19`의 `isAbsolute` 가드를 지워도 대상 46케이스가 전건 green. 기존 `'relative/plugin'` 케이스는 경로 부재(ENOENT)로 실패해 절대경로 절을 잠그지 않는다 | VP-16 / EP5·AC8 | **NON_BLOCKING** | — | 프로덕션 동작은 정상(검증자 probe: `resources/claude-plugins/work-profile` 같은 cwd 상대 유효 경로도 가드가 거절, 가드 제거 시 통과). VP-16의 선언 oracle(dev/packaged 해석·파일 부재)은 충족 — 절대경로 전용 케이스 보강은 다음 작업 후보 |
| D3 | packaged native smoke가 `process.platform === 'win32'` 하드 게이트 + `claude-agent-sdk-win32-x64` 고정 참조라 Windows 밖에서 AC8의 요청 본문 절을 재측정할 수 없다 | 검증 환경 한계 | **NON_BLOCKING** | — | Linux package 산출·asar 배제·resolver 통과로 대체 관측. 요청 본문 절은 구현자 증거 유지 |
| D4 | 두 fixture가 `resolve('resources/claude-plugins/work-profile')`로 process cwd에 의존한다 | 테스트 위생 | **NON_BLOCKING** | — | app cwd 실행 전제를 지키면 통과. 절대 해석을 `import.meta.url` 기준으로 바꾸는 것이 다음 정리 후보 |
| D5 | `chat-turn.runtime-tools.test.ts`·`send.permission-mode.test.ts`의 `as never` 광범위 partial mock이 필수 `RouterContext` 필드 누락을 typecheck에서 숨긴다 — r1이 전체 gate red로 나간 원인 | 테스트 위생 | **NEXT_HANDOFF** | — | 하네스 타입 정리는 이번 범위 밖. 별도 작업 후보 |
| D6 | base plugin root가 장차 forced output style을 가지면 Work root가 뒤에 붙어 우선순위를 잃는다 | 설계 §17 알려진 범위 | **NEXT_HANDOFF** | — | 현재 프로덕션 output-styles 참조는 Work 리소스 1건뿐이라 지금은 충돌 없음 |
| D7 | M6b(패키징에서 Work extraResources 제외)를 검증자가 재실행하지 않았다 | 재측정 범위 | **NON_BLOCKING** | — | 양성 대조(실제 package에 2파일 존재·asar 0건)와 NEW-F·EP14 거절 경로로 같은 실패를 잡는다. 두 번째 electron-builder 실행 비용 대비 한계효용이 낮다고 판단 |

- BLOCKING 0 · PLAN_GAP 0.

## 14. Review Signals — 사실만

- 이전 라운드와 동일/유사 증상: r1 → r2는 같은 축(필수 Work resource context를 소비하는 테스트 하네스 누락)의 후속이며, 프로덕션 결함 재발은 아니다.
- 관련 plan 지침/AC의 존재 여부: §10 EP5가 절대경로 계약을 적었고 EP14가 필수 파일 검증을 적었다. r1이 전체 스위트 대신 §19 국소 집합만 돌려 기존 하네스 2곳을 놓쳤다 — plan §19의 `범위` 표가 전체 gate를 명시하지 않는다.
- 사용자 결정 변경 근거: 없음. SUPERSEDED 0, D-011의 구현 착수 조건은 사용자 후속 지시로 충족됐다고 r1이 기록했다.
- 반복된 검증 환경 한계: (1) egress 제약으로 electron 바이너리·better-sqlite3 ABI를 수동 복구해야 했다. (2) packaged native oracle이 Windows 전용이라 Linux 검증 환경에서 AC8의 한 절을 재측정할 수 없다(D3) — 0019·0102와 같은 계열의 한계다.

## 15. 결론

- 상태: **PASS**
- pair 결과: REQUIRED **16/16 PASS** · root `PAIR_FAIL` 0 · `BLOCKED_BY` 0 · REGRESSION 0(선언 없음)
- PLAN_GAP: 없음
- Product/UX 및 ACTIVE Decision 충족: ACTIVE 11건 중 제품 계약 D-001~D-010 전건 충족. D-011은 작업 경계이며 사용자 후속 지시로 해소됐다
- AC 충족: **✅9 · ⚠️0 · ❌0 = 9/9** — 자기보고·trailer·INDEX와 일치
- 현재 변경 운영 gate: 6종 전건 PASS (typecheck·lint·vitest·node scripts·문서·packaging/native)
- 변이: **15회 실행 · 검출 14 · 미검출 1**(등록 8/8 검출, 검증자 신설 7 중 6 검출). 미검출 1건은 D2
- NON_BLOCKING 5건(D1·D2·D3·D4·D7) · NEXT_HANDOFF 2건(D5·D6)
- repository operation checks: trailer 3커밋 전건 파싱, 인용 해시 1건 오류(D1) 교정, `[구현자 기입]` 7/7 필드, INDEX 좌표 기입 완료
- 남은 사람 확인: Windows 패키지의 CLI 요청 본문, Work 자연어 작업 품질 표본, 앱 UI 실기
- 다음 단계: 보드에서 archive로 이동. 다음 주체 없음
