# Plan — 0234-work-prompt-profile

## 메타

| 항목 | 값 |
|---|---|
| slug | `0234-work-prompt-profile` |
| 작성자 | Codex — 사용자의 신규 핸드오프 착수 요청에 따라 설계 수행 |
| 일자 | 2026-09-14 |
| 상태 | verify/PASS (V1 r2) — 판정 원문은 [verify.md](verify.md) |
| V mode / 기준 V | Baseline V / none |
| 이번 revision / 유효 V | V1 / V1 |
| 조사 기준 | `9de8dd3c` — 시작 시 작업 트리 clean, `git pull --ff-only` 결과 Already up to date |
| 다음 주체 | — (종료) |

# Part I — Product & UX Contract

## 1. Context / 목표

Work 사용자는 문서·조사·정리·분석과 실제 산출물 완성을 요청한다. 현재 Work는 Claude Code preset에 짧은 역할 지침만 추가한다(`features/agents/profiles.ts`, `claude-adapt.ts:54`).

완료 후 Work는 프로그래밍을 필요에 따라 활용하되 작업 폴더가 저장소라는 이유만으로 개발 과제로 해석하지 않는다. Code는 현재 동작을 유지하며, 두 종류의 대화가 같은 작업 폴더를 함께 사용해도 프로필이 섞이지 않는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | Work 시스템프롬프트 교체, 앱 소유 output-style plugin, 기존 런타임 유지 | 2026-09-14 사용자 메시지의 제안 1·2 |
| 원문 보존 | 전체 Work 지침; 태그 사이 공백만 개행으로 정규화 | [work-system-prompt.md](work-system-prompt.md) |
| 조건 원문 | “Work and Code sessions may use the same `cwd`, so Work-specific configuration must be owned entirely by Orcinus orca and applied per session.” | 제안 2 §1 |
| 조건 원문 | “Confirm with the actually bundled Claude Code version that plugin `output-styles` and `force-for-plugin: true` are applied. Do not assume this from documentation alone.” | 제안 2 §3 |
| 설계 해석 | 이번에는 독립된 신규 핸드오프를 만든다. 기존 Work 계층·background 핸드오프의 검증 상태를 변경하지 않는다 | 보드의 0224·0231·0232는 별도 범위 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 보존 원문 전체를 Work profile의 instructions로 사용 | “Only Work-specific behavior belongs in this prompt.” | 사용자 A | ACTIVE | 현재 짧은 Work 지침 대체 |
| D-002 | `claude_code` preset + append 유지; 공통 헤더·동적 출력 경로는 기존 조립 경로 유지 | “Keep common Orcinus orca instructions and dynamically generated session information in the existing system-header / extension composition path.” | 사용자 A | ACTIVE | — |
| D-003 | 앱 소유 local plugin을 Work 세션에만 전달 | 동일 cwd의 Work·Code 격리 | 사용자 B | ACTIVE | — |
| D-004 | plugin 이름 `orcinus-orca-work-profile`, version `1.0.0`; 작은 work.md에 제안된 두 문장과 boolean frontmatter | output style은 기본 코딩 지침 제거, 실제 Work 행동은 append 소유 | 사용자 B | ACTIVE | — |
| D-005 | workspace `.claude`·settings·output-styles를 만들거나 수정하지 않음 | “Do not create or modify `.claude` under the user's workspace.” | 사용자 §1·B | ACTIVE | — |
| D-006 | 기존 adapter·SDK·SessionRuntime·도구·승인·취소 경로 유지 | 신규 Cowork 런타임·provider·`CLAUDE_CODE_IS_COWORK` 도입 금지 | 사용자 C | ACTIVE | — |
| D-007 | 신규·warm·respawn·resume·자동 연속 턴에서 세션 종류 유지 | Work append/plugin을 Code에 전달하지 않음 | 사용자 AC | ACTIVE | — |
| D-008 | 번들 실제 실행과 패키지 실경로를 검증 | 문서·옵션 객체·상태 라벨만으로 적용 PASS 금지 | 사용자 AC | ACTIVE | — |
| D-009 | 기존 4KB 테스트 상한을 원문 무손실 검증으로 대체; Work key를 `work:4`로 변경 | 원문은 trim 후 UTF-8 15,527 bytes; spawn-bound 지침 갱신 필요 | D-001·기존 respawn 계약에서 도출 | ACTIVE | 기존 `work:3`·4KB 기준 대체 |
| D-010 | 필수 Work 리소스가 누락되거나 읽히지 않으면 기존 준비 오류 경로로 실패 | adaptPlugins는 없는 manifest를 조용히 생략하므로 필수 프로필을 보장하지 못함 | D-003·D-008의 구현상 귀결 | ACTIVE | 일반 확장의 기존 생략 정책은 유지 |
| D-011 | 이번 작업은 handoff-plan까지만 완료; 구현은 사용자 확인 후 | “Handoff-impl 전에 확인하겠다. Handoff-plan 까지만 완료하라” | 사용자 후속 메시지 | ACTIVE | 이번 턴의 작업 경계 확정 |

### 갱신 메모

- 신규 결정 D-001~D-011, OPEN 없음. 제품명·경로·세션 종류는 사용자 지정 또는 기존 계약을 유지한다.
- ACTIVE 결정 ↔ AC 대조: 충돌 0. D-001/009→AC1·AC4, D-002→AC2, D-003/004→AC3·AC7, D-005→AC5, D-006→AC6, D-007→AC4, D-008→AC7·AC8, D-010→AC9.
- D-011은 제품 AC가 아닌 작업 경계다. app 변경 0 및 INDEX 다음 주체=사람으로 강제한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 기본 코딩 지침을 제거할 수 있는가 | 가능 — 실제 번들로 확인 | [native-evidence.json](native-evidence.json): Work 신규·resume 모두 codingInstructions=false |
| 기존 코드로 충분한가 | append 배선은 재사용, plugin 선택은 추가 필요 | `builder.ts:66`은 모든 세션에 같은 base roots 반환 |
| 기존 규칙과 충돌하는가 | 4KB 상한만 이번 요구에 맞춰 명시 대체 | `profiles.test.ts`의 `toBeLessThanOrEqual(4096)` |
| plugin 로드 상태만 보면 되는가 | 불충분 | 실제 Work 요청에 스타일이 있으나 init.output_style은 `default` |
| 미설치 리소스 실패를 어떻게 다루는가 | 준비 오류로 알림 | `adaptPlugins`가 manifest 부재를 filter하므로 사전 검증 필요 |
| 추가 제품 결정이 필요한가 | 없음 | 제안이 역할·구현 분리·수명·파일 쓰기 범위까지 명시 |

## 5. 동작 / 사용자 흐름

```text
Work 또는 Code 대화 전송
  → DB/lease의 출생 agentKind 검증
  → 종류별 append·plugin 후보 조립
  → 기존 runtime 확보·warm 재사용 또는 respawn/resume
  → 기존 도구·승인·취소·출력 수집으로 작업 수행
  → 실제 산출물과 절대경로 링크 전달
```

| 상태/이벤트 | 시스템 동작 | 사용자/소비자 결과 |
|---|---|---|
| 신규 Work / Code | 각 프로필로 생성 | Work 실무 행동 / Code 현행 행동 |
| 동일 cwd 동시 전송 | 서로 다른 세션에 서로 다른 SDK options 전달 | 작업 종류가 교차 오염되지 않음 |
| 후속 전송·warm | 동일 key이면 재사용 | 대화 이어짐 |
| 재시작·resume·fork/handoff | 기존 출생 종류로 재조립 | 기존 Work를 Code로 바꾸지 않음 |
| Work key 변경 | 기존 respawn 판정 사용 | 다음 실행에 새 지침·plugin 적용 |
| listen/flush 자동 연속 | 동일 조립 경로 사용 | append/plugin 유지, 배경 이벤트를 새 승인으로 해석하지 않음 |
| 승인 거절·취소 | 기존 broker·interrupt·cleanup | 작업 중단/거절 반영 |
| 필수 Work plugin 누락 | SDK 실행 전에 준비 오류 전달, lease/runtime 정리 | 실패가 보이며 프로필 없는 Work로 진행하지 않음 |

시각 레이아웃·테마·키보드 변경은 없다. 네트워크 모델 실기는 문구 준수의 표본 관측이며, SDK 적용·권한 강제의 기계 검증을 대신하지 않는다.

## 6. 범위 / 비범위

- 범위: Work 원문 적용, plugin 번들·실경로 해석·세션별 조립, key 갱신, 관련 회귀 테스트와 시스템 프롬프트 아키텍처 문서.
- 비범위: 새 runtime/provider/tool, 외부 업로드·게시·scheduler 도입, cwd·출력 디렉터리·권한 정책 변경, Code 공통 헤더 재작성, SDK 업그레이드, 기존 handoff 검증 종결.
- 제안 원문의 도구명은 조건부 행동 지침이다. 설치·인증·가용성을 보장하는 새 기능으로 해석하지 않는다.

## 7. Requirements / Acceptance — R ↔ AT

| R | AT / AC | 동작 기준 | 검증 수단 / 직접 단언 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | Work에 원문 전체가 손실 없이 한 번 적용되고 Code에는 없음 | 원문 정규화 비교 + 실제 SDK request의 append 내용 대조 | profile→header→builder→adapter→SDK |
| R-02 | AT-02 / AC2 | preset·공통 헤더·계정/프로젝트 지침·동적 출력 경로가 기존 위치에 유지 | Code options 기준선 비교; Work profile 제거 후 공통 내용 동일, 출력 경로 실값 유지 | send→builder/system-header→adaptSystemPrompt |
| R-03 | AT-03 / AC3 | 같은 cwd 동시 Work에만 앱 소유 절대경로 plugin 추가, base roots와 도구 유지 | 실제 조립부를 통과한 두 SDK options 및 base 배열 무변경 단언 | bootstrap→send→builder→adaptPlugins |
| R-04 | AT-04 / AC4 | 신규·warm·key 변경·resume·fork/handoff·listen/flush에서 출생 종류에 맞는 지침과 plugin 유지 | DB/lease 종류 상속 테스트, runtime spawn 기록·resume ID·자동 연속 options 확인 | send/continuation→runtime-entry/respawn→adapter |
| R-05 | AT-05 / AC5 | 설정 파일 없이 시작되며 기존 workspace `.claude`도 변경되지 않음 | 빈 cwd 전후 ENOENT + 별도 기존 sentinel 트리의 경로/바이트 해시 전후 동일 | bootstrap/send→SDK load |
| R-06 | AT-06 / AC6 | AskUserQuestion·Task·파일 생성/수집·검증 지침·승인·취소·background 이벤트가 기존 경로로 동작 | hook/canUseTool 거절·취소 결과, task 이벤트·output.captured 확인; 모델 지침과 런타임 강제를 구분 | adapter hooks/permission→runtime→기존 UI 이벤트 |
| R-07 | AT-07 / AC7 | 실제 번들이 Work style 본문을 사용하고 코딩 우선 지침을 제외; Code는 그대로 | loopback 서버가 받은 system: Work 본문/append 포함+coding marker 부재, Code 반대 | 실제 SDK→실제 bundled CLI→local model fixture |
| R-08 | AT-08 / AC8 | 배포 패키지가 cwd와 무관한 앱 리소스 절대경로로 plugin을 로드 | electron-builder dir 산출의 manifest/style 읽기+동봉 CLI 요청으로 적용 확인 | packaged resources→production resolver→SDK |
| R-09 | AT-09 / AC9 | 필수 plugin 누락/읽기 실패를 Work 준비 오류로 표시, Code는 정상 실행 | manifest/style 누락·비절대경로 조건에서 query 미호출·오류 및 정리, Code negative control | resource validation→send catch/finally |

기존 테스트 재사용 근거: `work-profile.integration.test.ts`는 header 차이·공통 options·승인 거절·title completion을 검사한다. 현재의 plugins 동일 단언만 Work 전용 추가 계약으로 바꾸고 나머지 보존한다.

사람에게 넘길 순수 로직은 없다. 실제 앱 UI에서 자유형 문서 작업의 품질 확인은 보조 관측이며, AC7/8을 표시 라벨이나 모델 자기보고로 대체할 수 없다.

## 7-A. V / Trace Matrix

이번 요청의 독립 Baseline V다. 0224 등의 기존 V 전체를 상속하거나 그 작업의 PASS를 이번 증거로 승계하지 않는다.

### Node registry

| Node | 레벨 | 계약 | provenance | 출처 |
|---|---|---|---|---|
| R-01…R-09 / AT-01…AT-09 | R / AT | §7 각 행 | NEW | 이번 사용자 요구와 직접 검증 |
| SD-01 / ST-01 | SD / ST | 동시 실행·warm·resume·연속 턴의 종류 격리 | NEW | §5·AC3/4/5 |
| SD-02 / ST-02 | SD / ST | 기존 도구/출력/승인/취소/background 경로 보존 | NEW | AC6 |
| SD-03 / ST-03 | SD / ST | 실제 CLI와 packaged 리소스 실행 | NEW | AC7/8 |
| AR-01 / IT-01 | AR / IT | app 주입→builder→adapter 배선 | NEW | AC2/3 |
| AR-02 / IT-02 | AR / IT | 필수 리소스 검증→오류·cleanup | NEW | AC9 |
| MD-01 / UT-01 | MD / UT | 원문·key·Code 불변·plugin 배열 비변이 | NEW | AC1/3/4 |
| MD-02 / UT-02 | MD / UT | dev/packaged 절대경로와 파일 유효성 | NEW | AC8/9 |

### Pair registry

§10의 EP ID는 개별 지점이다. 같은 EP가 여러 pair를 지지하더라도 전수 총계에서는 한 번만 센다.

| Pair | left ↔ right | requiredness | production path | 직접 oracle | 선택적 적대 증거 | §10 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | profiles→header→SDK | 원문 전체/위치/횟수 비교 | M1·M2 | EP1/2/6 (3) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | builder→output append→SDK | 공통 섹션과 native 출력 경로 일치 | M2 | EP2/3/4/6 (4) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | bootstrap→send→builder→SDK | 같은 cwd Work/Code options·base roots 불변 | M1·M2 | EP3/4/5/6 (4) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | DB/lease→send/continuation→runtime→SDK | 종류·warm 횟수·key 갱신·resume/options | M3 | EP1/3/4/7/8 (5) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | resource resolve→SDK | 빈 cwd + sentinel 트리 차집합 없음 | M5 | EP3/4/5/6 (4) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | adapter hooks→runtime→events | 승인·취소·task·output 결과 | 미선택 — 직접 행동 oracle | EP6/9/10/11 (4) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | SDK→번들 CLI→loopback | 요청 system의 style/append/coding marker | M4 | EP6/12 (2) |
| VP-08 | R-08 ↔ AT-08 | REQUIRED | package→resolver→CLI | 산출 경로 파일 + 실제 요청 | M4·M6 | EP5/12/13 (3) |
| VP-09 | R-09 ↔ AT-09 | REQUIRED | validation→send catch/finally | 오류 이벤트·query 미호출·lease 해제 | 미선택 — 직접 실패 입력 | EP3/4/5/14 (4) |
| VP-10 | SD-01 ↔ ST-01 | REQUIRED | send→runtime→continuation | AC3/4/5 종단 회귀 | M2·M3·M5 | EP3/4/5/6/7/8 (6) |
| VP-11 | SD-02 ↔ ST-02 | REQUIRED | adapter→runtime→history/relay | AC6 기존 실행 경로 결과 | 미선택 — 직접 행동 oracle | EP6/9/10/11 (4) |
| VP-12 | SD-03 ↔ ST-03 | REQUIRED | packaged resolver→native SDK request | AC7/8 실제 요청 내용 | M4·M6 | EP5/6/12/13 (4) |
| VP-13 | AR-01 ↔ IT-01 | REQUIRED | app profile input→builder→adapt | 최초/연속 양쪽 options 비교 | M1·M2 | EP2/3/4/5/6 (5) |
| VP-14 | AR-02 ↔ IT-02 | REQUIRED | resource read→prepare error | AC9 cleanup 결과 | 미선택 — 직접 오류 주입 | EP3/4/5/14 (4) |
| VP-15 | MD-01 ↔ UT-01 | REQUIRED | profile/roots→immutable snapshot | 원문·Code 값·새 roots 배열 | M1·M2·M3 | EP1/2 (2) |
| VP-16 | MD-02 ↔ UT-02 | REQUIRED | host paths→plugin path/read | dev/packaged 해석·파일 부재 | 미선택 — 직접 입출력 | EP5/14 (2) |

M1=Work plugin/append 배선 제거, M2=Work·Code 슬롯 맞바꿈, M3=Work key를 work:3으로 유지 또는 연속 턴의 key 전달 제거, M4=keep-coding-instructions=true 및 force-for-plugin=false를 각각 주입, M5=테스트 cwd의 `.claude/settings.json` 쓰기 주입, M6=패키징 리소스 제외 또는 app.asar 내부 경로 반환.

선택 이유: M1/2는 존재·위치를 함께 잠그고, M3는 갱신 배선, M4는 SDK 옵션의 의미, M5는 0건 파일 변경 oracle, M6는 실제 배포 도달성을 반증한다. 중복 ID는 한 번 실행한 증거로 해당 pair를 함께 지원하되 M4·M6의 세부 변이는 각각 기록한다.

### 현재 변경의 운영 gate

| Gate | 적용 이유 | 명령/관측 | 실패 범위 |
|---|---|---|---|
| 문서·message bus | 새 plan·원문·보드·라우팅 | `git diff --check`, app cwd에서 `node scripts/check-doc-inventory.mjs --check`, 상대 링크 확인·trailer 파싱 | 이번 산출물 불일치 |
| 타입·lint | 구현의 app subtree | `cd app`; `npm run typecheck`; `npm run lint` | 변경 유발 오류·명시 계약 위반 |
| 관련 UT/IT/ST | 프로필 및 runtime 경계 | §19 | 현재 pair 실패 |
| packaging/native | 외부 CLI가 파일을 읽어야 함 | electron-builder dir + loopback probe | AC7/8 미충족 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| 다음 번호 | `Get-ChildItem docs/handoff -Directory` 정렬 | max=0233 | 새 작업 0234 |
| Work 정의 | `rg 'key:|instructions:' app/src/main/features/agents/profiles.ts` | Work 1 | key work:3, 짧은 지침 |
| profile 전달 | `rg -n 'extensionProfile' app/src/main/app/chat-turn/send.ts` | 선언 1·사용 2 | 최초 runtime 및 자동 연속 양쪽 |
| append/plugin 변환 | `rg -n 'adaptSystemPrompt\(|adaptPlugins\(' app/src/main/adapters/claude.ts` | 각 1 | 세션 query 생성; 단발 complete에는 Work 미전달 |
| profile respawn 비교 호출 | `rg -n 'agentProfileKey: extensions' app/src/main/app` | 2 | runtime-entry·chat-turn-continuation |
| base plugin roots | bootstrap의 ExtensionBuilder 생성 인자 | 2 | app 확장 및 사용자 skill wrapper |
| 실제 번들 | SDK package.json + 동봉 exe `--version` | SDK 0.3.267 / CLI 2.1.267 | 호스트 설치본 미사용 |
| native 실행 | `node docs/handoff/0234-work-prompt-profile/probe-output-style.mjs` | 4 | 같은 cwd Work/Code 신규+resume 모두 success |

[공식 output styles 문서](https://code.claude.com/docs/en/output-styles)는 coding 지침 유지 여부와 plugin 자동 적용을 설명한다. 실제 번들에서는 plugin loader가 두 필드를 읽고, forced style을 선택하며, 선택 스타일의 keepCodingInstructions가 true가 아니면 코딩 지침 블록을 생략한다.

실행 증거는 [native-evidence.json](native-evidence.json)에 고정했다. 전체 approved append·style 본문·coding marker를 실제 요청에서 검사했고, 도구 목록은 두 종류에서 동일했으며 cwd `.claude`는 없었다.

이 실증은 SDK 경계 조사다. 앱 조립부·실제 packaged 리소스·도구 실행·자유형 모델 품질의 구현 완료 증거로 승격하지 않는다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS

```text
DB/lease agentKind → profiles(work:3)
  → send.extensionProfile → ExtensionBuilder → system-header
  → TurnExtensions(systemPromptAppend, 동일 basePluginRoots)
  → ClaudeAdapter(adaptSystemPrompt + adaptPlugins)
  → SDK / SessionRuntime
```

`builtin-resources.ts`는 현재 builtin skills의 dev/packaged 경로를 순수 입력으로 해석한다. `electron-builder.yml`은 resources/builtin을 extraResources로 복사하며 일반 resources는 asarUnpack한다.

### TO-BE

```text
Bootstrap(appPath/resourcesPath) → Work plugin 절대경로
DB/lease agentKind → profiles(work:4, 원문)
  → send의 세션 profile 입력(+ Work일 때만 plugin 후보)
  → ExtensionBuilder(base roots + profile roots, 새 배열)
  → 기존 TurnExtensions → 기존 ClaudeAdapter → SDK / SessionRuntime
```

app 컴포지션 루트가 구체 Claude 리소스 경로를 주입한다. profiles는 순수 행동·key, extensions는 backend-neutral 텍스트/후보 조립, adapter는 SDK 변환을 계속 소유한다.

### AS-IS → TO-BE Delta

| 축 | AS-IS | TO-BE | 연결 |
|---|---|---|---|
| 행동 | 짧은 Work instructions | 원문 전체 + work:4 | MD-01 / AC1/4 |
| plugin | 종류와 무관한 base roots | base 유지 + Work 전용 root | AR-01 / AC3 |
| 경로 | builtin skills만 전용 해석 | work-profile dev/packaged resolver 추가 | MD-02 / AC8 |
| 수명 | key 비교·warm·resume | 같은 메커니즘, 최초/연속에서 같은 profile 입력 | SD-01 / AC4 |
| 오류 | 일반 missing plugin 생략 | 필수 Work 리소스는 사전 검증 후 준비 오류 | AR-02 / AC9 |
| 검증 | mock SDK options 중심 | 실제 request 및 packaged 실경로 추가 | SD-03 / AC7/8 |

## 10. 계약 / 타입 / 강제 지점

| EP | 계약 / SSOT | 누가·언제 강제 | 실패 의미 |
|---|---|---|---|
| EP1 | profile 원문·Code 불변·work:4 / profiles.ts | resolveAgentProfile 호출 시 | 역할 누락·Code 오염·stale 지침 |
| EP2 | 단일 append·base roots 불변 / builder.ts·system-header.ts | 매 build | 복제·공통 지침 유실·공유 배열 오염 |
| EP3 | 최초/new/resume 프로필 배선 / send.ts runtime acquire | SDK 요청 준비 시 | 신규/재개 Work plugin 누락 |
| EP4 | 자동 listen/flush profile 배선 / send.ts prepareContinuation | 자동 연속 준비 시 | 연속 턴에 다른 지침/roots 전달 |
| EP5 | 앱 소유 절대경로 / builtin-resources.ts·bootstrap/context 주입 | 부팅 경로 조립 및 Work 준비 | cwd 종속·asar 내부·리소스 누락 |
| EP6 | preset append·plugins / claude.ts→claude-adapt.ts | session query spawn/resume | 설정 객체가 SDK에 미도달 |
| EP7 | profile key 비교 / runtime-entry.ts→respawn-inputs→respawn-policy | 사용자 전송의 warm 판정 | 갱신 미적용·불필요 재시작 |
| EP8 | profile key 비교 / chat-turn-continuation.ts→respawn-inputs→respawn-policy | 자동 연속 warm 판정 | 연속 경로의 stale profile |
| EP9 | canUseTool·hooks·interrupt / 기존 adapter·runtime | 질문·승인·거절·취소 실행 | 프롬프트를 승인으로 오인하거나 기존 제어 회귀 |
| EP10 | Write/Edit hook·final-link 수집 / claude-output-files 경로 | 실제 출력 생성/최종 응답 | 파일 생성과 수집의 혼동·출력 누락 |
| EP11 | Task/background 원본→정규화 / 기존 claude.background 경로 | task/tool/system 이벤트 수신 | 배경 이벤트 상관·종료 처리 회귀 |
| EP12 | manifest/work.md boolean·본문 / resources/claude-plugins/work-profile | CLI plugin load 및 prompt 생성 | 표면 로드 성공이지만 코딩 지침 잔류 |
| EP13 | 배포 복사 / electron-builder.yml extraResources | package dir 생성 | dev만 성공하는 구현 |
| EP14 | 필수 파일 read validation / 앱 소유 resource 검증 helper | Work 준비, query보다 앞 | silent fallback·오류 후 lease/runtime 유실 |

전수는 14개 EP다. 근거 검색은 §8의 profile/SDK 진입점과 `rg -n 'spawnedAgentProfileKey|agentProfileKey' app/src/main`이며, 구현자는 새 경로가 생기면 재열거한다.

`pluginRoots` 미지정은 base만 유지한다. Work는 host가 공급한 root를 추가하고, `undefined` 경로를 adaptPlugins에 넘겨 필수 plugin을 생략하게 하지 않는다.

## 11. 구현 설계

| 변경/신규 파일 | 변경 내용 | 테스트 seam |
|---|---|---|
| `app/src/main/features/agents/profiles.ts` | 원문 literal 또는 같은 slice의 정적 문자열 import, work:4; Code 객체 동일 | profiles.test 원문 정규화 비교 |
| `app/resources/claude-plugins/work-profile/.claude-plugin/plugin.json` | 사용자 제안 manifest | JSON parse + 실제 loader |
| `app/resources/claude-plugins/work-profile/output-styles/work.md` | 사용자 제안 YAML 및 작은 두 문장; 전체 Work prompt 복제 금지 | native request + M4 |
| `app/src/main/app/builtin-resources.ts` | `resolveWorkProfilePluginDir({isPackaged,resourcesPath,appPath})` 순수 해석 | Electron 미import UT |
| `app/src/main/app/work-profile-resource.ts` (필요 시) | 절대경로·manifest name·style 읽기 검증; 오류 throw | fs 경계 주입 또는 tmp fixture |
| `app/src/main/app/bootstrap.ts`, `context.ts` | host 경로로 계산한 Work root를 RouterContext에 전달 | 주입·dev/packaged 통합 |
| `app/src/main/app/chat-turn/send.ts` | Work일 때 profile plugin 후보 구성·검증; 최초와 자동 연속에서 같은 입력 사용 | 실제 send seam 테스트 |
| `app/src/main/features/extensions/builder.ts` | profile 인자에 optional readonly pluginRoots; base와 합쳐 새 배열 반환 | 기존 base 배열 비변이·Code 동일 |
| `app/electron-builder.yml` | resources/claude-plugins → claude-plugins extraResources, app.asar 내 중복 제외 | dir 산출 파일+native |
| 관련 tests / `docs/arch/backend/system-prompt.md` | 바뀐 선택 계약·key·출력 스타일 사용 상태 동기화 | §19 |

dev=`join(appPath,'resources','claude-plugins','work-profile')`, packaged=`join(resourcesPath,'claude-plugins','work-profile')`로 고정한다. asar 내부 경로를 CLI에 넘기지 않으며 workspace에 설정 파일을 배포하지 않는다.

정적 문자열을 별도 파일로 두더라도 런타임은 `docs/handoff`를 읽지 않는다. 보존 원문은 승인 입력/equality oracle이고, 앱 런타임 원문 소유자는 profiles slice다.

## 12. End-to-end 영향

profile→builder→TurnExtensions→adapter→SDK의 기존 edge를 재사용한다. 새로운 IPC·DB column·provider kind는 없다.

| 기존 소비자 | 영향 / 회귀 |
|---|---|
| 최초 runtime 및 자동 연속 build | 둘 모두 Work root와 key 전달 / AC3·4 |
| adapter session query | 추가 local plugin을 기존 adaptPlugins로 변환 / AC3·7 |
| title 등 complete | Work 확장 수신하지 않음 / AC2·6 |
| runtime spawn 기록과 respawn 비교 | 기존 agentProfileKey 사용, 새 key 기록 / AC4 |
| 기존 app/user skill plugin | root 순서·skills/MCP snapshot 유지 / AC3·6 |

## 13. Lifecycle / 오류 / 정리

생성은 기존 DB/lease 종류 판정을 따른다. key 갱신 외 새로운 hot-update나 프로필 전환은 없다.

필수 리소스 검증은 send의 보호된 준비 구간에 두고, 오류는 기존 classified error→renderer와 finally의 lease/runtime 정리로 보낸다. 자동 연속 재준비에서 동일 실패가 발생해도 기존 실행 정리 경로를 사용한다.

취소·quit·renderer-gone·background 종료 처리는 기존 runtime 소유다. Work prompt는 도구 가용성·추가 승인·앱 종료 후 실행을 새로 보장하지 않는다.

다중 저장소: 앱 기능은 새 DB/파일 transaction이 없다. 설계 상태 사본은 이 plan과 handoff INDEX 두 곳이며, 같은 커밋에서 READY/다음 주체를 맞춘다.

## 14. 성능 / 상한

원문 trim UTF-8 길이는 15,527 bytes다. query의 system append에는 원문 1개만 추가되며, 자동 연속에서 새 query가 필요하지 않으면 같은 prompt를 재전송하려 별도 query를 만들지 않는다.

token 수와 캐시 비용은 실제 모델 tokenizer/공급자에 따라 달라지므로 bytes에서 추정치를 계약으로 만들지 않는다. 원문 hash·정규화 equality로 누락/중복을 검사하고 4KB로 자르지 않는다.

## 15. 외부 구현 포트 / 문서 계약

신규 외부 포트는 없다. SDK `Options.plugins`의 `{type:'local',path:absolute}`와 preset append shape를 기존 adapter 타입 검사로 유지한다.

output-style frontmatter는 `keep-coding-instructions: false`, `force-for-plugin: true`라는 YAML boolean이다. 두 필드의 실제 의미는 native request oracle로 검사한다.

## 16. 기존 결정·규칙과의 관계

| 기존 규칙 | 출처 | 본문 관계 | 결과 |
|---|---|---|---|
| DAG·feature 교차 import 금지 | main AGENTS | §9/11: 앱이 경로 주입, builder는 backend-neutral | 유지 |
| preset+단일 append | system-prompt.md §1/2A | §9/10 EP2/6 | 유지 |
| work:3·4KB 상한 | profiles 및 tests | D-009 | 사용자 원문 적용 때문에 대체 |
| 번들 executable 단일 출처 | claude-executable.ts | §8 native identity | 유지 |
| workspace 설정 소스 project/local | adaptSettingSources | §6·native probe | 유지; 파일 쓰기 없음 |
| 기존 산출물·runtime 계약 | Work integration/output/permission tests | AC6 | 유지 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/처리 |
|---|---|
| init.output_style이 실제 forced style과 다름 | `default` 관측됨; 요청 prompt를 정본 oracle로 사용 |
| 여러 forced plugin 충돌 | 번들은 첫 forced style을 선택함; 기존 base roots에 강제 style이 없음을 확인하고, 새 범용 plugin 우선순위 정책은 도입하지 않음 |
| missing manifest 생략 | 필수 Work 리소스 선검증, 일반 plugin 생략 정책 유지 |
| 기존 공통 header의 workspace-only 문구와 동적 output 예외의 긴장 | 기존 문제로 기록; 이번에는 공통 header 정책을 바꾸지 않고 실제 출력 경로/수집 회귀를 확인 |
| 긴 프롬프트가 자연어 행동을 완전히 강제하지 못함 | 정확한 전달과 runtime 강제를 기계 검증; 자유형 품질을 보장했다고 주장하지 않음 |

신규 npm 의존성·데이터 마이그레이션·외부 게시 없음. 롤백은 Work prompt/key·plugin 조립 및 리소스의 해당 변경을 되돌리고 기존 세션 종류는 유지한다.

## 18. 영향 파일 / 문서

변경 목록은 §11이 소유한다. 이 핸드오프 부속 파일은 승인 원문·native 조사 script·측정 JSON이며 제품 코드가 아니다.

## 19. 게이트

구현은 app/AGENTS의 ABI 지침을 따른다. 순수 회귀는 `app/node_modules/.bin/vitest run`으로 실행하고 DB 의존 tests만 필요한 경우 별도 ABI 전략을 명시한다.

| 범위 | 실행/확인 |
|---|---|
| 국소 UT | profiles, builtin-resources, builder, system-header.agent, respawn-policy |
| 배선/수명 | work-profile.integration, chat-turn-continuation, chat-turn/runtime-entry, resolve-turn.agent, session-runtime의 profile key case, 실제 send 경로 신규 case |
| 도구/승인 | claude.canusetool, claude.live-control, claude-runtime-tools, claude-output-files, claude.background의 관련 case |
| static | `npm run typecheck`; `npm run lint` 후 autofix diff 확인 |
| 문서 | `node scripts/check-doc-inventory.mjs --check`; `git diff --check`; 새 링크/보드 상태 확인 |
| native | 본 probe를 실제 production profile/root 조립을 소비하는 app 테스트로 승격; hardcoded fixture만으로 AC3/8 PASS 금지 |
| package | `npm run build`; `node_modules/.bin/electron-builder --win --dir`; 산출 resources root를 production resolver에 넣고 동봉 CLI로 AC8 실행 |

AC6은 현재 bundled fixture의 도구 목록 equality만으로 닫지 않는다. 기존 도구 실행 회귀에 Work profile/plugin을 적용한 조건을 더해 실제 결과를 확인한다.

## READY self-review

- 완료: §3 ACTIVE 결정 ↔ §7 AC 대조 충돌 0, §9 AS-IS/TO-BE/Delta ↔ §11 변경 목록 모두 연결.
- 완료: R 9 + SD 3 + AR 2 + MD 2 = 왼쪽 node 16, 같은 레벨 REQUIRED pair 16; 누락 0. 기존 V를 상속하지 않았으므로 inherited/NOT_REQUIRED 없음.
- 완료: §10 EP1~EP14를 pair에서 모두 참조, 선언되지 않은 EP 참조 없음. 최초·자동 연속의 profile 주입과 key 비교를 각각 분리했다.
- 완료: 원문 전체·metadata·실제 CLI 요청을 조사했으며 지원 여부를 공식 문서만으로 단정하지 않았다. 본 probe 4회 success는 앱 구현 완료와 구분했다.
- 완료: workspace 무수정·Code 불변과 SDK/package 적용은 양성/음성·형제 대조 oracle을 지정했다. 순수 로직을 사람 실기로 넘긴 항목 없음.
- 완료: 실제 도구 실행·패키징·새 app 배선의 검증은 구현 gate로 남겼고, 지금 통과했다고 표기하지 않았다.

### 설계 턴 검증 기록

| 검증 | 관측 |
|---|---|
| 실제 번들 SDK probe | 신규/재개 Work·Code 4회 success, 상세 native-evidence.json |
| 기존 국소 회귀 | Vitest 6파일·32케이스 통과 — profiles, builtin-resources, system-header.agent, respawn-policy, chat-turn-continuation, runtime-entry |
| 문서 gate | app cwd에서 check-doc-inventory --check: generated/prose/links 모두 통과 |
| 신규 산출물 검사 | plan 상대 링크 누락 0, EP14·pair16, 원문 태그21쌍 일치, 원문 hash=실측 JSON |
| 작업 범위 | app 코드/리소스 변경 없음; SDK fixture는 임시 경로의 설계 실험 |

문서 gate 최초 호출은 저장소 루트 cwd여서 src/shared/ipc.ts를 찾지 못했다. app cwd에서 재실행해 통과했으며 §7-A 명령 표기도 바로잡았다.

---

## [구현자 기입] 설계 리뷰

r1 구현(2026-09-14~15). 사용자 후속 “핸드오프 impl”로 D-011의 확인 조건이 충족됐다. 설계 당시의 app 변경 0 조건은 설계 턴에 대한 기록이며, 이번 구현은 별도로 승인됐다.

- 동의 / 그대로 진행: Work prompt·작은 output-style plugin·기존 runtime의 책임 분리를 유지했다.
- 이견 / 현실성 문제: 없음. V1 REQUIRED VP-01~VP-16, EP1~EP14, AC1~AC9를 기준으로 수행했다. REGRESSION으로 선언된 pair는 없다.
- ACTIVE Decision과 충돌하는 설계 발견: 없음. Part I·Decision·AC·V·§10 규범 행은 변경하지 않았다.
- 검증 범위: 앱 조립/제어 경로는 실제 모듈을 호출하는 테스트로, SDK 의미는 loopback에 도착한 실제 CLI 요청으로 확인했다. 외부 모델의 자유형 작업 품질이나 전체 앱 UI 실기는 수행하지 않았다.

재현 명령·native 관측·변이 결과는 [implementation-evidence.json](implementation-evidence.json)에 보존한다. 임시 디렉터리의 raw 로그는 보조 자료이며, 공유 가능한 요약과 실행 스크립트가 저장소에 남는다.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01/04/15 | 원문·spawn key | EP1 | 1/1 | profiles 테스트: 원문 전체 equality, Code 객체 불변, work:4; native approvedOccurrences=1/0 | — |
| VP-01/02/13/15 | 단일 append·roots 비변이 | EP2 | 1/1 | agent-extension-profile + integration: frozen base 유지, Work Agent 제거 후 Code append와 동일 | — |
| VP-03/04/09/10/13/14 | 최초 준비 배선 | EP3 | 1/1 | 실제 handleChatSend의 new/resume/forkFrom/handoffFrom에서 Work/Code roots·key·append 확인; M1a/b RED | — |
| VP-04/09/10/13/14 | 자동 연속 준비 배선 | EP4 | 1/1 | 같은 send 테스트의 자동 준비 2회, continuation의 listen/flush 회귀; M1c/d RED | — |
| VP-03/05/08/12/13/16 | host 절대경로 | EP5 | 1/1 | builtin-resources dev/package 및 Bootstrap 입력 단언; N1a~d RED; 실제 package pluginPath 확인 | — |
| VP-01/02/03/06/07/11/12 | preset·append·plugins | EP6 | 1/1 | integration 실제 ClaudeAdapter의 query options, native 요청의 원문·style 각 1회 | — |
| VP-04/10 | 최초 key 비교 | EP7 | 1/1 | runtime-entry의 동일/다른/없는 profile key에 대한 teardown 단언; respawn-policy 회귀 | — |
| VP-04/10 | 자동 key 비교 | EP8 | 1/1 | chat-turn-continuation의 fresh profile key 비교; M3b RED, 복원 후 통과 | — |
| VP-06/11 | 질문·승인·취소 | EP9 | 1/1 | Work 조건의 AskUserQuestion allow, PowerShell deny, interrupt 영수증, stopTask 전달 확인 | — |
| VP-06/11 | 출력 생성·수집 | EP10 | 1/1 | native Write 실제 바이트 확인; Work PostToolUse→capture→output.captured 및 기존 최종 링크 회귀 | — |
| VP-06/11 | Task/background | EP11 | 1/1 | native TaskCreate/TaskUpdate 완료; Work background.snapshot/task 정규화·추가 승인 0회 | — |
| VP-07/08/12 | 실제 style 의미 | EP12 | 1/1 | dev/package 실제 CLI의 Work codingInstructions=false, Code=true; M4a/b RED | — |
| VP-08/12 | extraResources 복사 | EP13 | 1/1 | Windows dir package의 manifest/style, app.asar 내 Work plugin 목록 []; 누락 package M6b RED | — |
| VP-09/14/16 | 필수 리소스 읽기 | EP14 | 1/1 | 잘못된 경로·누락·손상 fixture 거절; 최초/자동 준비 오류와 supervisor/lease 정리 확인 | — |

강제 지점 14/14. `rg -n 'agentProfileKey|spawnedAgentProfileKey|extensionProfile|workProfilePluginPath' app/src/main -g '!*.test.ts' -g '!*.testfixture.ts'`로 최초/자동 준비·양쪽 key 비교·spawn 기록/해제를 재확인했다. §10에 없는데 현재 계약상 추가가 필요했던 지점은 발견하지 않았다. EP5의 Bootstrap 배선은 별도 구조 단언과 입력/소비 슬롯 변이로 보강했다.

**V-pair 자기확인** — 독립 검증의 PASS가 아니다.

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01 | REQUIRED | SELF_PASS | 원문 equality·native 횟수 | M1·M2 RED |
| VP-02 | REQUIRED | SELF_PASS | 공통 append equality·출력 디렉터리 실값 | M2 RED |
| VP-03 | REQUIRED | SELF_PASS | 같은 cwd의 Work/Code roots, 실제 동시 query | M1·M2 RED |
| VP-04 | REQUIRED | SELF_PASS | 출생 종류 상속·warm/key·native resume ID 유지 | M3 RED |
| VP-05 | REQUIRED | SELF_PASS | dev/package 빈/sentinel의 설정 트리 양방향 차집합 [] | M5 RED |
| VP-06 | REQUIRED | SELF_PASS | Work 질문/거절/취소/output/background 및 native Task 실행 | 미선택 — 직접 행동 oracle |
| VP-07 | REQUIRED | SELF_PASS | 번들 CLI 요청의 style/코딩 지침 분리 | M4 RED |
| VP-08 | REQUIRED | SELF_PASS | 실제 packaged CLI의 절대경로 plugin 로드 | M4·M6 RED |
| VP-09 | REQUIRED | SELF_PASS | 누락/손상 리소스 실패, query 전 정리·Code 비영향 | 미선택 — 직접 실패 입력 |
| VP-10 | REQUIRED | SELF_PASS | send/continuation/runtime 회귀 + 동시 native 신규/재개 | M2·M3·M5 RED |
| VP-11 | REQUIRED | SELF_PASS | Work adapter 제어/출력/provider 이벤트 결과 | 미선택 — 직접 행동 oracle |
| VP-12 | REQUIRED | SELF_PASS | dev/package 요청 내용·동일 bundled binary hash | M4·M6 RED |
| VP-13 | REQUIRED | SELF_PASS | 실제 최초/연속 조립부·Bootstrap 입력 단언 | M1·M2 RED, N1a~d RED |
| VP-14 | REQUIRED | SELF_PASS | 처음/자동 준비 실패의 오류 이벤트·정리 | 미선택 — 직접 실패 입력 |
| VP-15 | REQUIRED | SELF_PASS | 원문·Code 객체·key·새 roots 배열 | M1·M2·M3 RED |
| VP-16 | REQUIRED | SELF_PASS | dev/package 경로, 잘못된 파일 fixture 거절 | 미선택 — 직접 입출력; N1은 EP5 보조 배선 검사 |

## [구현자 기입] 이번 라운드 수정의 잠금

각 변이는 격리해 실행 후 복원했다. 이전 구현 라운드는 없으므로 이전 결과는 모두 최초다.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1a: send 최초 build의 profile.pluginRoots 제거 | VP-01/03/13/15 M1 | 최초 | send.agent-profile: 4 failed | 잠김 |
| M1b: send 최초 build의 agentInstructions 제거 | 같은 M1 | 최초 | send.agent-profile: 4 failed | 잠김 |
| M1c: 자동 build의 profile.pluginRoots 제거 | 같은 M1 | 최초 | send.agent-profile: 4 failed | 잠김 |
| M1d: 자동 build의 agentInstructions 제거 | 같은 M1 | 최초 | send.agent-profile: 4 failed | 잠김 |
| M2a: helper의 Work-only plugin 분기를 Code-only로 맞바꿈 | VP-01/02/03/10/13/15 M2 | 최초 | profile + send: 15 failed | 잠김 |
| M2b: helper가 읽는 Work/Code 행동 profile 맞바꿈 | 같은 M2 | 최초 | profile + send: 5 failed | 잠김 |
| M3a: work:4를 work:3으로 복귀 | VP-04/10/15 M3 | 최초 | profiles + send: 5 failed | 잠김 |
| M3b: 자동 respawn 입력의 agentProfileKey 제거 | 같은 M3 | 최초 | continuation + send: 5 failed | 잠김 |
| M4a: keep-coding-instructions=true | VP-07/08/12 M4 | 최초 | 실제 CLI: coding instructions mismatch | 잠김 |
| M4b: force-for-plugin=false | 같은 M4 | 최초 | 실제 CLI: output style count mismatch | 잠김 |
| M5: native fixture cwd에 .claude/settings.json 쓰기 | VP-05/10 M5 | 최초 | no-write oracle 실패, added에 directory/settings.json 2항목 | 잠김 |
| M6a: packaged resolver가 app.asar 내부 경로 반환 | VP-08/12 M6 | 최초 | builtin-resources: 1 failed | 잠김 |
| M6b: 별도 package config에서 Work extraResources 제외 | 같은 M6 | 최초 | 실제 누락 package: 필수 manifest 부재로 native smoke 실패 | 잠김 |
| N1a: Bootstrap의 소비 슬롯 이름을 바꿔 Work 경로 전달 폐기 | 새 EP5 배선 oracle | 최초 | builtin-resources: 1 failed | 잠김 |
| N1b: Bootstrap의 isPackaged를 false로 고정 | 같은 oracle | 최초 | builtin-resources: 1 failed | 잠김 |
| N1c: Bootstrap의 resourcesPath를 cwd로 대체 | 같은 oracle | 최초 | builtin-resources: 1 failed | 잠김 |
| N1d: Bootstrap의 appPath를 cwd로 대체 | 같은 oracle | 최초 | builtin-resources: 1 failed | 잠김 |

- 분모 검산: 선택 증거 **13 세부 변이**(M1~M6) · 인용 변이 0 · 새 oracle 4 = **표 행 17**. 새 send/native oracle의 민감도는 선택 M1~M6와 중복되므로 다시 더하지 않았다.
- 덮개 회귀: 해당 없음 — r1이며 이전 구현의 적대 증거를 교체하지 않았다. 원문 변경으로 폐기한 4KB 상한은 D-009의 명시 변경이다.
- 복원 관측: 마지막 소스 복원 후 5파일/31케이스를 재실행해 통과했다(아래 회귀 집합과 중복, 합산하지 않음). 관련 Vitest 20파일/230케이스, 추가 연속 턴 2파일/18케이스, node scripts 119케이스 통과. dev/package native 정상 조건 각각 9관측 통과.
- EP/VP/AC 및 잠금 행의 누락 여부는 최종 문서 검사에서 ID 집합의 차집합으로 대조했다. 이 문서 행 대조는 production 범위를 추출하는 별도 oracle이 아니다.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 대면 문구·상태에 소비자가 있는가 | Work 리소스 오류가 기존 classified error→sendChatEvent로 전달됨; send 테스트에서 문구 관측 | UI 문자열/새 IPC 추가 없음 |
| 준비 함수 분리 후 정리 스코프는 유지되는가 | leaderTurn 등록 뒤 보호 구간에서 읽음; 최초 실패 시 release/releaseChain, 자동 실패 시 releaseRuntime도 호출 | 정리 책임은 기존 send에 유지 |
| 새 실패 경로가 어느 상태 행인가 | Part I §5의 “필수 Work plugin 누락” | 신규 상태 전이 없음 |
| 실패가 아무 일도 안 일어남으로 보이는가 | error 이벤트 발신과 runtime 미획득을 직접 단언 | 실제 화면 시각 실기는 별도 |
| 늦은 응답·취소가 화면을 되돌리는가 | 새 응답 비동기 경로는 없음; 기존 interrupt/stop/background 경로의 회귀 통과 | 기존 runtime 수명 정책 유지 |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 순수 resolver만 검사하면 Bootstrap의 잘못된 입력을 놓침 | 선조치 — 실제 파일의 한정된 배선 단언 추가 | N1a~d가 각각 RED |
| 2 | native fixture가 CLI 초기 HEAD /api/hello를 거절 | 선조치 — loopback의 해당 초기 요청 처리 | 재실행 dev/package 9관측씩 통과 |
| 3 | 여러 forced output style이 있다면 앞선 plugin이 우선할 수 있음 | 보고만 — 이번 base app/user wrapper에는 해당 style이 없고 기존 순서 유지 | §17의 알려진 범위; 일반 plugin 우선순위 정책 미도입 |
| 4 | 공통 header의 workspace-only 문구와 동적 출력 경로 예외 사이 긴장 | 보고만 — 공통 정책 수정은 비범위 | 실제 출력 디렉터리 전달·수집 회귀는 통과 |
| 5 | 별도 코드 리뷰 subagent가 사용량 제한으로 종료 | 미완료로 기록; 독립 검증 대기 유지 | 리뷰 결과나 PASS로 집계하지 않음 |

### 설계 대비 명시적 차이

선택적 `work-profile-resource.ts` 대신 `agent-extension-profile.ts` 한 함수에서 종류 선택과 필수 리소스 읽기를 묶었다. §11이 허용한 구현 세부이며 새 cache·runtime·정책은 없다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 해당 없음 — cache/TTL 미도입 | 매 Work 준비에서 파일 읽기 |
| 공유 | 추가 공유 상태 없음; base roots가 공유되는 기존 조건은 유지 | AC3·EP2: frozen base 비변이·두 snapshot 분리 |
| 재진입 | 최초/자동 준비가 같은 helper를 재호출 | AC4/9·EP3/4/14: 종류 유지, 제거된 경로 재검증·정리 |
| 다른 무효화 축 | 별도 무효화 정책 없음; 파일 부재·손상은 읽기 실패, prompt 변경은 기존 key 비교 | AC4/9·EP7/8/14: key 변경·누락 fixture 결과 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | agents 원문/key, app profile helper·경로 주입·send, extensions builder, plugin 리소스·패키지 설정, 회귀/native 테스트, system-prompt 문서. 상세는 diff |
| 실행 명령 | §19 실행 집합 및 추가 continuation 2파일; 명령 원문은 implementation-evidence.json |
| 관측한 게이트 산출 | Vitest **22파일/248케이스**(20/230 + 2/18), node scripts **119통과**. typecheck 3구성 0오류, lint 0오류/기존 경고1, build main/preload/renderer 생성 |
| native / package | CLI 2.1.267·SDK 0.3.267, dev/package 각각 9관측. 실제 packaged 바이너리 hash는 dev와 같고 Work plugin은 asar 밖에서 로드 |
| 환경 기인 실패 | ABI 오류 없음: DB 회귀를 Node ABI에서 마친 뒤 build/package에서 Electron ABI로 전환. 초기 test fixture 오류는 수정·재실행. 별도 리뷰만 사용량 제한 |
| V-pair 자기확인 | SELF_PASS 16 / SELF_BLOCKED 0 — 독립 검증 아님 |
| 강제 지점 전수 | 14/14 — 각 행의 직접 관측은 위 표 |
| AC 자기보고(Criteria-Met) | 9/9 — 아래 AC별 관측 |
| 합계 검산 | ✅ 9 · ⚠️ 0 · ❌ 0 = 총 9. AC 분모 변경 없음 |
| 블로커 / 역질문 | 없음. 독립 handoff-verify와 자유형 모델 품질 표본/전체 UI 실기는 아직 수행하지 않음 |
| 대상 커밋 | (r1 구현 — 좌표는 INDEX) |

| AC | 자기보고 | 이번 턴의 직접 관측 |
|---|---|---|
| AC1 | ✅ | 원문 전체 equality; 실제 Work 요청 approvedOccurrences=1, Code=0 |
| AC2 | ✅ | 실제 adapter options의 preset·공통 append·기존 옵션 유지, send의 동적 출력 절대경로 확인 |
| AC3 | ✅ | native 같은 cwd 동시 Work/Code, 독립 session ID; Work만 절대경로 plugin, base frozen roots 유지 |
| AC4 | ✅ | 신규/재개/fork/handoff send 배선, warm/key 변경·자동 준비 회귀; native resume ID 유지 |
| AC5 | ✅ | dev/package 빈/sentinel의 경로·바이트 해시 전후 양방향 차집합 []; M5가 쓰기 검출 |
| AC6 | ✅ | Work 질문·승인 거절·취소·output.captured·background 정규화; native TaskCreate/Update/Write 실행 및 거절 파일 부재 |
| AC7 | ✅ | 실제 번들의 Work style 1회·coding marker 없음, Code 반대; M4 두 설정 변이 검출 |
| AC8 | ✅ | electron-builder Windows dir 산출을 실제 bundled CLI로 실행; asar 밖 리소스 로드·누락 package 실패 |
| AC9 | ✅ | 경로/manifest/style 실패 입력에서 Work 오류, Code 비영향; 최초/자동 준비의 오류 이벤트·lease/runtime 해제 |

## [구현자 기입] Review Signals — 사실만

- 이전 라운드와 같은 불변식 축인가: 해당 없음 — 첫 구현 라운드.
- 막았어야 할 plan 지침·AC가 있었는가: §10 EP5는 있었고, resolver 단위 검사만으로는 호출 입력이 잠기지 않아 Bootstrap 단언을 추가했다.
- 반복 환경 한계: 두 subagent가 사용량 제한으로 종료했다. native harness 산출물은 주 구현자가 읽고 실행·수정했으며, 별도 코드 리뷰는 완료하지 못했다.
- 현재 라운드 수: 1. handoff 지침·실패 corpus를 변경하지 않았다.
- 상태 사본: 최종 검사에서 이 plan 메타와 INDEX의 impl/IMPL_DONE·다음 Claude를 대조한다. 구현 커밋의 trailer 파싱은 커밋 직후 확인한다.

## [구현자 기입] 설계 리뷰 — r2

- 판정: 명백한 테스트 fixture 누락이며 PLAN_GAP은 아니다. `RouterContext.workProfilePluginPath`를 요구하는 기존 Work send 경로에 두 하네스가 값을 주지 않아 전체 gate가 red였다.
- 불변식: Work 프로필 준비까지 도달하는 테스트 하네스는 실제 앱 번들 리소스의 절대경로를 공급한다. 운영 검증을 optional로 낮추거나 프로덕션 fallback을 추가하지 않는다.
- 범위: `chat-turn.runtime-tools.test.ts`와 `chat-turn/send.permission-mode.test.ts`의 fixture만 보완했다. ACTIVE Decision·AC·V·§10과 프로덕션 코드는 바꾸지 않았다.

## [구현자 기입] 강제 지점 전수와 V-pair 자기확인 — r2

| 범위 | 판정 | 관측 | 남긴 곳 |
|---|---|---|---|
| red를 만든 Work send 하네스 | 2/2 보완 | 두 fixture의 `ctx`에서 `resolve('resources/claude-plugins/work-profile')` 절대경로 공급 | — |
| EP3·EP4·EP5 | SELF_PASS 유지 | 최초/listen/flush와 권한-mode Work 경로 14/14 통과 | — |
| VP-03·04·06·10·11·13 | SELF_PASS 유지 | 전체 Vitest 525파일에서 신규 red 0 | — |

기존 V1 pair 16개와 EP 14개 분모는 변경하지 않았다. 이번 수정은 r1의 프로덕션 동작을 바꾸지 않고 현재 변경 산출물의 전체 테스트 gate를 복구한다.

## [구현자 기입] 이번 라운드 수정의 잠금 — r2

| 심은/재현한 결함 | 출처 | 수정 전 | 수정 후 | 결과 |
|---|---|---|---|---|
| Work send fixture에서 필수 plugin 경로 누락 | 현재 산출물 `npm test` gate | 대상 2파일 6실패·8통과 | 대상 2파일 14/14 통과 | 잠김 |

- 분모 검산: 선택 증거 0 · 인용 변이 0 · 새 oracle 0 = 표 행 0. 위 행은 기존 직접 행동 oracle의 red→green 재현이며 새 mutation 주장이 아니다.
- 덮개 회귀: 테스트 장치를 교체·삭제하지 않았다. 기존 Work/Code 양성·음성 단언은 그대로 실행됐다.

## [구현자 기입] Product/UX 파생 검토 — r2

| 질문 | 판정 | 관측 |
|---|---|---|
| 사용자 동작이 바뀌는가 | 아니오 | 프로덕션 diff 0; 테스트 fixture만 실제 Bootstrap 계약과 맞춤 |
| 실패 표시·정리 경로를 약화했는가 | 아니오 | 필수 경로 검증을 유지했고 기존 missing-resource 테스트를 수정하지 않음 |
| Code 세션에 Work 경로가 새는가 | 아니오 | 대상 실행의 Code continuation 및 Code permission 양성 짝 통과 |

## [구현자 기입] 놓친 잠재 문제 + 대응 — r2

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 두 테스트의 `as never`가 필수 컨텍스트 누락을 typecheck에서 숨김 | 보고만 — 해당 하네스의 광범위 partial mock 타입 정리는 별도 리팩터링 범위 | 수정 전 `npm run typecheck:test` 통과와 runtime 6실패가 동시에 재현됨 |
| 2 | 저장소 루트에서 직접 Vitest를 호출하면 cwd 기준 resource 경로가 달라짐 | 선조치 — 정본 `npm test`와 대상 Vitest를 app cwd에서 실행 | app cwd에서 대상 14/14·전체 gate 통과 |

설계 대비 명시적 차이는 없다. 신규 cache·공유 상태·재진입·무효화 축을 만들지 않았다.

## [구현자 기입] 구현 보고 — r2

| 항목 | 내용 |
|---|---|
| 변경 파일 | 테스트 fixture 2개와 이 구현 기록·INDEX |
| 관측한 게이트 산출 | 대상 Vitest 2파일 14/14; 전체 Vitest 525파일·4,844통과·1스킵; node scripts 119/119 |
| static | lint 0 error·기존 warning 1; typecheck node/web/test 3구성 통과 |
| V-pair/강제 지점 | V1 SELF_PASS 16·EP 14/14 유지 — 독립 검증 아님 |
| AC 자기보고 | 9/9 유지; ✅ 9 · ⚠️ 0 · ❌ 0 = 총 9 |
| 블로커 | 없음. 독립 handoff-verify는 여전히 대기 |
| 대상 커밋 | (r2 구현 — 좌표는 INDEX) |

## [구현자 기입] Review Signals — r2

- 이전 라운드와 같은 축인가: r1이 추가한 필수 Work resource context의 테스트 소비자 누락이다.
- 막았어야 할 지침·AC: 현재 변경의 전체 PR/CI test gate가 막았으며, 국소 §19 집합만 실행한 r1 자기검증에서는 두 기존 하네스가 빠졌다.
- 환경 한계: 없음. Node ABI는 이미 정상이고 전체 스위트가 종료 코드 0으로 끝났다.
- 현재 라운드 수: 2. handoff 지침·failure corpus는 변경하지 않았다.

## [검증자 기입] 파생 이슈

r2 = **PASS**. 판정·증거 원문은 [verify.md](verify.md)이며 여기서 재서술하지 않는다.
BLOCKING 0 · PLAN_GAP 0 · REQUIRED pair 16/16 PASS · AC 9/9 · 강제 지점 14/14.

| # | finding | disposition | 후속 |
|---|---|---|---|
| D1 | INDEX의 설계 좌표 `90ee11e9`가 실재하지 않음 (실제 `89297c8`) | NON_BLOCKING | 검증 커밋에서 교정 |
| D2 | `agent-extension-profile.ts`의 `isAbsolute` 가드가 committed 스위트로 잠기지 않음 — 제거해도 46케이스 전건 green | NON_BLOCKING | 프로덕션 동작은 정상. 절대경로 전용 케이스 보강은 다음 작업 후보 |
| D3 | packaged native smoke가 Windows 전용이라 Linux에서 AC8의 요청 본문 절을 재측정 불가 | NON_BLOCKING | Linux package 산출·asar 배제·resolver 통과로 대체 관측 |
| D4 | 두 fixture가 `resolve()`로 process cwd에 의존 | NON_BLOCKING | app cwd 실행 전제 유지 |
| D5 | `as never` partial mock이 필수 `RouterContext` 필드 누락을 typecheck에서 숨김 | NEXT_HANDOFF | 하네스 타입 정리는 별도 작업 |
| D6 | base plugin root가 장차 forced style을 가지면 Work root가 우선순위를 잃음 | NEXT_HANDOFF | 현재 프로덕션 output-styles 참조는 Work 리소스 1건뿐 |
| D7 | M6b를 검증자가 재실행하지 않음 | NON_BLOCKING | 양성 대조와 EP14 거절 경로가 같은 실패를 잡는다 |
