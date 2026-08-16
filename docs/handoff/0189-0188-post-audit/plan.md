# Plan — 0189-0188-post-audit

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md), 협업/상태 머신은 [`../AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0189-0188-post-audit` |
| 설계자 | Claude Code |
| 구현자 | Claude Code (비기능 = 문서 전용) |
| 일자 | 2026-08-16 |
| 감사 대상 | 0188 구현 범위 `ad10f6c..dff06a0` (app 139파일 · +8,561/−3,407) |
| 산출물 | [`audit.md`](audit.md) 1건. **`app/**` 변경 0** |

---

# Part I — Product & UX Contract

## 1. Context / 목표

0188(`auth-harness-plugin-lightweight`)은 impl 라운드 10회 후 `verify/PASS` 로 종료됐다. 그런데 그
verify 는 **자기 검증**이었다 — 설계·구현·검증이 모두 Claude Code 였고 `verify.md` 스스로 그것을
판정의 한계로 적었다.

사용자가 네 축의 재검토를 요구했다: 제안서 충실도 · 성능 회귀 · UI/UX 회귀 · 경량화 달성.

완료 후 달라지는 것: **0188 의 실제 결과가 판정 가능한 문서로 남는다.** 시정 여부는 그 문서를
읽은 뒤 별도 핸드오프로 결정한다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 |
|---|---|
| 명시 요구 | ① 0188 에 첨부된 제안을 충실히 구현했는가 ② 퍼포먼스가 떨어진 점은 없는가 ③ UI/UX 를 유지하는가·회귀하지 않았는가 ④ 경량화를 충실히 만족하는가·회귀하지 않았는가 |
| 설계자 해석 | 네 질문은 **판정을 요구한다** — "무엇을 봤다" 가 아니라 "충족/미달" 과 그 근거. 따라서 축마다 한 줄 판정 + 근거 표를 계약으로 잡는다 |
| 후속 질의 결과 | 산출물 형태·경량화 판정 기준·이탈 처리·UI/UX 처리를 사용자에게 물어 §3 으로 확정했다 |

## 3. Decision Ledger

| # | 상태 | 결정 | 출처 |
|---|---|---|---|
| D-001 | ACTIVE | **산출물은 감사 보고서 전용.** `app/**` 코드 변경 0. 시정은 후속 핸드오프 | 사용자 선택 |
| D-002 | ACTIVE | **경량화는 결합 축뿐 아니라 볼륨 축으로도 판정한다** | 사용자 선택 |
| D-003 | ACTIVE | 제안 이탈 3건(F1·F2·F3)은 **전부 "시정 필요"로 판정**하고 각각 시정 명세를 적는다 | 사용자 선택 |
| D-004 | ACTIVE | UI/UX 2건(U1 해제 실패 침묵 · U3 가드 비대칭)은 **기록만** 한다 | 사용자 선택 |
| D-005 | ACTIVE | D-003 문항에서 "① 복원 / ② 시정 / ③ 추가" 와 "전부 기록만" 이 함께 선택됐다. D-001 과 양립하도록 **"판정은 시정 필요, 실행은 이번 범위 밖"** 으로 읽었다 | 설계자 해석 — 다르면 이 항목만 정정 |
| D-006 | ACTIVE | 보고서는 **실측과 연역을 구분 표기**한다. 폐쇄망 배포에서만 관측되는 항목은 조건을 명시한다 | 설계자 |
| D-007 | ACTIVE | 0188 이 이미 남긴 파생 이슈(verify D39·D40)와의 **중복 여부를 명시**한다 — 새 발견인지 재확인인지 | 설계자 |
| D-008 | ACTIVE | **채점은 3층이다** — ① code ↔ `proposal.md` ② ACTIVE Decision 이 승인했는가(출처 포함) ③ 0188 이 만든 변화인가(`git show ad10f6c:`). r2 에서 신설 | 사용자 지적 — "구현 과정에서 변수명·모듈명이 사용자 제안으로 바뀌었을 수 있다" |
| D-009 | ACTIVE | 이미 push 된 문서이므로 **본문을 정정하고 `정정 이력` 절을 함께 남긴다.** 조용히 덮어쓰지 않는다 | 설계자 |

### 갱신 메모

0188 의 ACTIVE Decision 63건은 이 핸드오프가 바꾸지 않는다. 이 핸드오프는 그 구현의 **관측**이지
재설계가 아니다.

## 4. 요구 비판적 검토

| 질문 | 판정 | 근거 |
|---|---|---|
| 증상과 원인이 맞는가 | 맞다 | 사용자의 네 질문은 0188 verify 가 스스로 적은 한계(자기 검증·폐쇄망 실기 미수행)와 정확히 겹친다 |
| 이미 충족됐는가 | 아니다 | `verify.md` 는 AC 25건 대조가 중심이고 **제안서 원문 대조는 하지 않았다**. 성능·경량화는 축 자체가 없었다 |
| 더 작은 해법이 있는가 | 없다 | 판정을 요구하므로 코드 실측이 필요하다. 다만 D-001 에 따라 산출은 문서 하나로 최소화한다 |
| 선행 자료가 맞는가 | 부분 | `verify.md` 의 "AC 25/25" 는 유효하나 AC 자체가 제안서 36불릿 중 6건을 번역하지 않았다(F4) |
| 기존 결정과 충돌하는가 | 없다 | 코드·계약을 바꾸지 않는다 |

## 5. 동작 / 사용자 흐름

독자는 **이 저장소의 다음 유지보수자(사람 또는 에이전트)** 다.

```text
0188 결과가 궁금하다
  → docs/handoff/INDEX.md 에서 0189 행을 본다
  → audit.md 를 연다
  → 축별 한 줄 판정을 먼저 읽는다 (4줄)
  → 관심 축의 표에서 문제·원인·방안을 본다
  → 파일:줄 을 열어 직접 대조한다
  → 시정할지 말지 결정한다 (→ 0190)
```

### 상태와 전이

문서 산출물이므로 런타임 상태가 없다. 보드 상태만 `plan/READY → impl/IMPL_DONE → verify/*`.

### 파생 UX / 엣지케이스

- 감사 수치는 **특정 커밋 범위의 관측**이다. `docs/generated/inventory.md` 가 소유하는 "현재 개수"
  와 성격이 다르므로 문서 머리에 그 사실을 적는다(root `AGENTS.md` 원칙 4 와의 관계 명시).
- 이 환경은 `app/node_modules` 부재로 lint/typecheck/vitest 를 돌릴 수 없다. 보고서가 그것을
  한계로 적는다.

## 6. 범위 / 비범위

- **범위**: `docs/handoff/0189-0188-post-audit/{plan,audit}.md` 신설 · `docs/handoff/INDEX.md` 갱신.
- **비범위**: `app/**` 의 모든 변경(D-001) · 0188 의 Decision/AC 개정(F3·U3 이 짚은 Ledger 정합성 정리 포함 — 지적만 하고 고치지 않는다) · `docs/arch/` 갱신 ·
  F1~F4·P1~P2·U1~U3 의 실제 시정.

> 비범위가 범위를 막지 않는지 확인: 판정에 필요한 증거는 전부 **읽기**로 얻는다. 코드 수정 없이
> 네 축 모두 닫힌다.

## 7. Acceptance Criteria — 제품 계약

| # | 동작 기준 | 검증 수단 | 도달 경로 |
|---|---|---|---|
| AC1 | `audit.md` 가 네 축 각각에 **한 줄 판정**을 갖는다 | 축별 "판정:" 문장 4건 존재 | 문서 상단 |
| AC2 | 모든 발견 항목이 `파일:줄` 근거를 갖고, 그 줄이 현재 트리에서 실제로 해당 내용을 가리킨다 | 인용 전수 `sed -n <n>p` 재확인 | 독자의 대조 |
| AC3 | 실측과 연역이 구분 표기되고, 폐쇄망 한정 항목은 조건이 명시된다(D-006) | 표기 누락 0건 | 독자의 판단 |
| AC4 | 제안 이탈 3건이 각각 **문제·원인·방안** 3열을 갖고, 코드는 변경되지 않는다(D-003·D-005) | 표 대조 + `git diff -- app/` | 후속 0190 |
| AC5 | 성능 항목이 **낭비형 / 대가형**으로 갈리고, 대가형은 되돌릴 때 되살아나는 결함을 병기한다 | 분류 2표 존재 | 후속 0190 |
| AC6 | 경량화 판정이 **미달**이고 근거 수치와 **반대 논거**를 함께 싣는다(D-002) | 표 + 반대 논거 절 | 사용자 판단 |
| AC7 | 0188 verify 의 D39·D40 과 이번 발견의 중복 여부가 명시된다(D-007) | U1↔D39 매핑 문장 존재 | 중복 작업 방지 |
| AC8 | `app/**` 가 변경되지 않는다 | 이 핸드오프 커밋의 `git diff --stat -- app/` 가 빈 diff | 릴리스 안전 |
| AC9 | `docs/handoff/INDEX.md` 의 0189 행이 실제 상태·다음 주체와 일치한다 | 보드 대조 | 다음 에이전트 |
| AC10 | 문서 링크·인벤토리 규칙 검사를 통과한다 | `node app/scripts/check-doc-inventory.mjs --check` exit 0 | CI |
| AC11 | 제안 §수용기준 불릿이 plan AC 로 **전수 매핑**되고, AC 에 없는 요구가 목록으로 남는다 | 36불릿 ↔ AC1~25 매핑 + 각 항목의 코드 상태 판정 | 후속 0190 · handoff-review |
| AC12 | 축 1·3 의 모든 판정이 **3층**을 거치고 각 항목이 **어느 층에서 갈렸는지** 밝힌다(D-008) | 항목별 `층` 열 존재 | 독자의 재현 |
| AC13 | 철회·정정 항목이 **`정정 이력` 절**에 초안 주장과 함께 남는다(D-009) | 절 존재 + 철회 2·정정 3·강화 3 대조 | 감사의 신뢰 |
| AC14 | Decision 을 인용한 곳은 **ID 와 출처**(제안서/외부리뷰/사용자)를 함께 적는다 | 인용 전수 | 독자의 판단 |
| AC15 | §9 가 ①레이어·슬라이스 지도 ②축↔표면 매핑 ③제어 흐름 4개 ④배포 확장점 인벤토리 ⑤감사 파이프라인 **5개를 모두** 갖고, **발견 ID 전수(F1~F4·P1~P6·U1~U3)가 ② 또는 ③ 에 최소 1회 좌표를 갖는다** | 하위절 5개 존재 + 발견 ID 13건 grep | 독자가 "어디를 고치나" 를 §9 만 보고 답한다 |

### AC 검증 주의사항

- AC2 는 **파일 존재가 아니라 줄 내용**을 본다. 인용 줄이 다른 것을 가리키면 실패다.
- AC8 의 "빈 diff" 는 이 핸드오프가 만든 커밋 기준이다. 0188 이 만든 `app/` 변경은 대상이 아니다.
- AC6 의 "반대 논거" 는 형식 요건이 아니라 **판정의 공정성 요건**이다. 수치만 있고 강건화 근거가
  빠지면 미충족이다.

---

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

조사는 설계 턴에서 이미 수행했고 결과가 `audit.md` 본문이다. 사용한 증거는 세 종류다.

| 증거 | 방법 |
|---|---|
| 현재 트리 코드 | `sed -n`/`rg` 로 인용 줄 직접 확인 |
| 0188 이전 트리 | `git show ad10f6c:<path>` 로 대조 |
| 규모 수치 | `git diff --stat` + `find … \| xargs wc -l` 전수 |

### 전수 조사

- `features/providers` → 후계 4슬라이스 파일·줄 전수(주석 제외 계산 포함).
- 신설 추상의 **기본 배포 구현체 수** 전수(`app/deployment/*` 반환값 확인).
- feature 교차 import 전수(`from '...'` 기준, before/after 양쪽).
- 사용자 대면 한국어 문자열 diff 전수.
- **제어 흐름 4개**(부팅·턴·자격증명·카탈로그)를 코드에서 재구성 — `bootstrap.ts` 조립 순서 · `chat-turn/send.ts` 12단계 주석 · `login.settleGrant` · `connectionState` (§9.3).
- `app/deployment/` 6파일의 **export 와 기본 반환값** 전수 (§9.4).

### 수치 / 전칭 표현 검산

- main 프로덕션 `.ts` 총계: `ad10f6c` 24,249 → 현재 **26,480**. 내역 합(Phase A~C +1,325 / r2~r10
  +906)과 총계(+2,231)가 일치한다.
- "구현체 0개" 는 기본 배포 기준이다 — `deployment-wiring.test.ts` 는 가상 배포로 그 경로를
  태우므로 "테스트조차 없다" 가 아니다. 보고서가 그 구분을 적는다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

이 절은 **판정의 좌표계**다. 네 축의 발견(F·P·U)마다 "구조의 어느 지점에서 갈렸는가" 를 §9.2 의
매핑표나 §9.3 의 화살표가 가리킨다. 수치는 이번 세션 실측이다.

### 9.1 AS-IS — 감사 대상 구조 (0188 이 만든 것)

```
app/src/main/
├── app/                      컴포지션 루트 (전부 import 가능)
│   ├── bootstrap.ts   816줄  조립 + 순서 (DB 이전 / 이후 2구간)
│   ├── deployment/    6파일  ★ 배포가 고치는 유일한 묶음 (§9.4)
│   ├── chat-turn/    14파일  턴 파이프라인 12단계
│   ├── connection-views.ts   카탈로그 DTO 조립 (compat 경계)
│   ├── auth-resume.ts        부팅 resume 순서 = 제품 정책
│   └── handlers/             IPC 등록
├── features/                 수직 슬라이스 12개 — 교차 import 금지
│   ├── auth/      16파일     인증 lifecycle
│   ├── gate/       1파일     Auth snapshot → 앱 접근 조건
│   ├── harnesses/  9파일     settings 열거·해석·Model·실행 구성·respawn 경계
│   └── plugins/    8파일     Confluence
├── contracts/auth.ts  export 30   인증 계약 — 소비 슬롯 0 (AC2)
├── adapters/harness-config.ts     fingerprint SSOT + settings 포트
└── infra/vault.ts                 세대 키(`versionedVaultKey`)
```

의존 방향: `app → 전부` · `features → 같은 slice · contracts · adapters · infra · shared` ·
**feature 교차 import 금지**(eslint boundaries 강제, `app/src/main/AGENTS.md §레이어 DAG`).

0188 의 핵심 이동: `features/providers/` 1슬라이스 → 위 4슬라이스 + `app/deployment/` +
`app/{connection-views,auth-resume}.ts`.

### 9.2 축 ↔ 구조 표면 매핑

| 축 | 검사 표면 | 정본 파일 | 발견 |
|---|---|---|---|
| 1 충실도 | contracts 경계 · 배포 확장점 · 금지표 22행 | `contracts/auth.ts` · `app/deployment/*` | F1 · F2 · F3 · F4 |
| 2 성능 | 턴 hot path · 부팅 · 자격증명 교체 | `app/chat-turn/turn-setup.ts` → `features/harnesses/prepared-config.ts` → `features/sessions/session-runtime.ts` · `app/auth-resume.ts` · `features/auth/{store,login}.ts` | P1~P6 |
| 3 UI/UX | DTO 조립 · IPC 모드 · renderer 훅 | `app/connection-views.ts` · `app/handlers/providers.ts` · `renderer/src/features/{skills,providers}/hooks/*` | U1 · U2 · U3 |
| 4 경량화 | 슬라이스 부피 · 확장점 구현체 수 · 개념 수 | `features/{auth,gate,harnesses,plugins}` · `app/deployment/` | 볼륨 · 간접층 |

### 9.3 제어 흐름 4개 — 발견을 화살표에 못박는다

**(a) 부팅** — `index.ts → Bootstrap.start()`

```
[DB 이전]
  SecretStore · RuntimeToolRegistry
  createAuthRuntime(AUTH_DEFINITIONS, persistence, vault, netFetch)
      └ store.restore() → authoritative 일 때만 vault sweep       ◄ P4 (D-060)
  mcp.attachTokenSource(authId => secretReader.read(authId))       ◄ AC5 좁은 closure
  createGate(selectGateMembers(...))                               ◄ AC4 fail-closed
  createPluginBindings(deps) → plugin.sync()   (resume 보다 먼저)
  createConnectionSources({auth, gateMembers, plugins})            ◄ 축4 확장점
  auth.subscribe(change => …)              D-008 단일 소비 지점
      └ pushConnectionState() 가 credentialChanged 가드보다 **앞**  ◄ 개선 여지
  registerConnectionHandlers(...)          renderer 첫 invoke 대상
  createAuthResume(...).run()  gate 순차 → 나머지 Promise.all → push 1회  ◄ 0187 보존
[DB 이후]
  db-init → HarnessSettingsService → HarnessRuntimeConfigService → UsageTracker
```

**(b) 턴** — `chat:send` 12단계 중 성능 관련 구간

```
send.ts ①진입게이트 ②첨부 ③lease ④⑤continuity+resolve-turn
   └→ turn-setup.resolveTurnProvider
        harnessRuntime.resolve(key)      warm cache + settings mtime stat 1
        prepareHarnessConfig({config, appEnv, baseEnv: processEnvRecord})
             withoutEnvBlock(settings)   env 블록 있으면 새 객체   ◄ P2 (D-042 부작용)
             env = base → app → settings → runtimeEnv             (D-041)
             harnessEnvFingerprint(env)                            ◄ P1 1회차
   ⑥turn-context     titleSettings **required** → title/chat 동일 snapshot (AC17)
   ⑦runtime-entry.decideRespawn(boundary·model·settings·runtimeEnv·toolsRevision) ◄ P6
   ⑪TurnRequest 조립 → SessionRuntime.spawn
             harnessEnvFingerprint(req.env)   재사용할 필드가 없다  ◄ P1 2회차
   ⑫post-turn 루프 → prepareAutomaticContinuation → 전체 재resolve  ◄ P3 (D-020)
```

**(c) 자격증명 교체**

```
login.settleGrant
   probeOk(candidate)              확인 전 커밋 없음            (D-047)
   세대 확인 (모든 await 뒤)                                    (D-050·D-058)
   vault.set(versionedVaultKey)    새 키                        ◄ P5 ①
   store.put(): boolean            내구 저장이 곧 커밋           (D-056·D-057)
   discardKeys(previous)           옛 키 삭제                   ◄ P5 ②
revoke: persist 먼저 → 실패면 throw → handlers/providers 'reject'
      → renderer `void providers.revoke(...)` 가 rejection 폐기  ◄ U1
```

**(d) 카탈로그**

```
createConnectionSources → ConnectionViewSource[] {gate|harness|plugin|usage}
   → connectionState(auth, gate, sources)
        auth.describe()   메모리
        auth.snapshot()   settleExpiry 부수효과                  ◄ 정보성 관측
   → ProviderPlatformState → orca:provider:state → renderer
renderer   useProviders(requestSeq 가드 ✓) / useProviderGate(가드 ✗)  ◄ U3 (D-054)
```

### 9.4 배포 확장점 인벤토리 — 축 4 간접층의 근거 표면

| 파일 | export | 기본값 | 기본 배포 구현체 |
|---|---|---|---|
| `auth-definitions.ts` | `AUTH_DEFINITIONS` | `[]` | 0 |
| `gate-auth.ts` | `GATE_AUTH_DEFINITIONS` · `remainingAuthDefinitions` | `[]` | 0 |
| `harness-runtime.ts` | `HarnessConfigApiDeps` · `HarnessDirectCredentialDeps` · `DIRECT_CREDENTIAL_AUTH_IDS` · `createConfigApiAugmenters` · `createDirectCredentialAugmenters` · `createRuntimeConfigAugmenters` · `mergeAugmenters` · `AUTH_INVALIDATED_HARNESS_KEYS` | `{}` · `[]` | 0 (`mergeAugmenters` 만 실행) |
| `plugins.ts` | `PluginBinding` · `CreatePluginBindingDeps` · `createPluginBinding` · `PluginDeploymentDeps` · `createPluginBindings` | `[]` | 0 |
| `connections.ts` | `createConnectionSources` · `gateRows` · `pluginRows` | gate+plugin 만 | `harness`·`usage` 0 |
| `usage-fetcher.ts` | `UsageDeploymentDeps` · `createUsageFetcher` | `undefined` | 0 |

이 표 하나가 **F2**(deps 타입 좁힘) · **축 4**(구현체 0개 6종) · **AC25**(`deployment-wiring.test.ts` 가
가상 배포로 태우는 경로)가 전부 **같은 표면**을 가리킨다는 사실을 보인다. 확장점 자체는
`D-044`·`D-045`·`D-048`·`D-051` 이 승인한 구조다 — 드리프트가 아니다.

### 9.5 TO-BE — 이 핸드오프가 바꾸는 것

**코드 아키텍처는 바꾸지 않는다(D-001).** 바뀌는 것은 감사 산출물의 정보 구조다.

```
증거 3종                      3층 채점 (D-008)              산출
──────────────────────────────────────────────────────────────────
현재 워킹트리 코드      ─┐    1층  code ↔ proposal.md    ─┐
`git show ad10f6c:`     ─┼──→ 2층  ACTIVE Decision+출처  ─┼──→ 축별 판정 4 → audit.md
0188 plan §3 Ledger     ─┘    3층  pre-change baseline   ─┘         + 정정 이력
```

### AS-IS → TO-BE Delta

| 항목 | AS-IS (0189 초안) | TO-BE |
|---|---|---|
| 채점 층 | 1층 — `proposal.md` 만 | **3층** — Decision(출처)·baseline 포함 |
| 구조 좌표 | 없음 | §9.1~9.4 — 발견마다 구조 위 위치 |
| 성능 서술 | 파일:줄 나열 | 제어 흐름 위 화살표에 P1~P6 고정 |
| 확장점 근거 | 산문에 흩어짐 | 6파일 × export × 구현체 수 표 |
| 제안 충실도 판정 | 없음(0188 시점) | 수용기준 36불릿 ↔ AC 25건 매핑 + 금지표 22행 |

### 핵심 책임 분리

- `plan.md`(본 문서) = **좌표계와 기준** — 무엇을 어떤 층으로 채점하고 어디에 남길지.
- `audit.md` = **관측과 판정** — 그 좌표 위의 발견을 `파일:줄` 로 고정.
- 시정 설계 = 0190 (이번 범위 밖).

## 10. 계약 / 타입 / 강제 지점

| 계약 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|
| 인용 `파일:줄` 의 정확성 | 현재 워킹트리 | 작성자 | 작성 시 + verify | 독자가 근거를 재현 못 하면 보고서 전체의 신뢰가 깨진다 |
| 실측/연역 구분 | 각 항목 표기 | 작성자 | 작성 시 | 연역을 실측으로 읽으면 없는 회귀를 고치게 된다 |
| `app/**` 무변경 | git | 커밋 | 커밋 시 | D-001 위반 |
| 0188 Decision/AC 무변경 | `0188/plan.md` | 커밋 | 커밋 시 | 감사가 대상을 바꾸면 감사가 아니다 |
| **3층 채점 적용** | §9.5 파이프라인 | 작성자 | **축별 판정 시** | 1층에서 멈추면 정당한 Decision·기존 상태를 이탈로 오판한다 — 초안이 실제로 2건 오판했다 |
| **발견의 구조 좌표** | §9.2 매핑표 · §9.3 흐름 | 작성자 | 발견 신설 시 | 좌표 없는 발견은 독자가 "어디를 고쳐야 하는가" 를 알 수 없다 |
| 수치의 커밋 범위 명시 | `audit.md` 머리 | 작성자 | 작성 시 | `docs/generated/inventory.md` 와 혼동되어 두 정본이 갈린다 |

## 11. 구현 설계

1. `audit.md` 작성 — 축 4개, 각 축 = 판정 1줄 + 문제/원인/방안 표.
2. 인용 전수 재확인(`sed -n <n>p`).
3. `INDEX.md` 에 0189 행 추가.
4. 게이트 실행 후 커밋.

### 테스트 가능성

문서 산출물이라 단위 테스트가 없다. 대신 **AC2 의 인용 재확인**이 기계 검증을 대신한다 —
`sed -n` 으로 전수 확인 가능하며 verify 턴이 같은 방법으로 재현한다.

## 12. End-to-end 영향

### producer → consumer

`audit.md`(producer) → 유지보수자·후속 0190 설계(consumer). 소비자는 판정과 `파일:줄` 만 쓰며
보고서가 코드를 바꾸지 않으므로 런타임 소비자는 없다.

**§9.2 매핑표가 `audit.md` 축 절의 목차를 결정한다** — 축 순서·검사 표면·발견 ID 가 두 문서에서
같아야 독자가 좌표를 따라갈 수 있다. 축을 늘리거나 발견 ID 를 바꾸면 §9.2 를 먼저 고친다.

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음(코드 무변경).

## 13. Lifecycle / 오류 / 정리

해당 없음. 문서는 상태를 갖지 않는다. 보고서가 낡으면 그것을 인용하는 후속 핸드오프가 커밋
범위를 다시 적는다.

## 14. 성능 / 상한 / 최적화

- 보고서 길이 상한: 축당 표 1~2개. 0188 문서 3종(2,488줄)을 다시 요약해 늘리지 않는다.
- 인용 수는 발견 수에 비례하며, 발견마다 최소 1개 최대 3개로 제한한다(AC2 재확인 비용).

## 15. 외부 구현 포트 / 문서 계약

해당 없음.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문이 건드리는 문장 | 결과 |
|---|---|---|---|
| "코드에서 셀 수 있는 수치를 문서에 적지 마라" | root `AGENTS.md` 원칙 4 | 경량화 축의 줄 수·파일 수 | **유지** — 이 규칙은 `docs/arch/` 등 현재 상태 문서 대상이다. 감사 보고서는 특정 커밋 범위의 관측이므로 대상이 아니며, 그 성격을 문서 머리에 명시한다 |
| "`docs/arch/` 는 현재 상태만 서술한다" | root `AGENTS.md` 원칙 5 | — | **유지** — `docs/arch/` 를 건드리지 않는다 |
| "외부 리뷰는 verify 를 대체하지 않는다" | `docs/handoff/AGENTS.md` | 이 감사의 성격 | **유지** — 이 감사는 0188 의 verify 를 대체하지 않는다. 0188 은 이미 PASS 로 닫혔고 이것은 **사후 관측**이다 |
| 0188 ACTIVE Decision 63건 | `0188/plan.md §3` | 없음 | **유지** — 하나도 바꾸지 않는다 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화 |
|---|---|
| 자기 감사(0188 도 Claude Code 가 구현) | 채점 기준을 **제안서 원문**으로 잡았다. `plan.md`/`verify.md` 의 주장을 증거로 쓰지 않고 코드를 직접 읽었다. 그럼에도 독립 감사자가 아니라는 한계는 남으며 보고서가 그것을 적는다 |
| 경량화 "미달" 판정이 정당한 강건화를 깎아내림 | AC6 이 반대 논거 병기를 요건으로 잡았다 |
| 폐쇄망 한정 항목을 일반 회귀로 오독 | D-006/AC3 이 조건 명시를 요건으로 잡았다 |
| 게이트 미실행(node_modules 부재) | 코드 무변경이라 lint/typecheck/vitest 가 비대상이다. 그 사실을 보고서에 적는다 |

## 18. 영향 받는 파일 / 문서

| 파일 | 역할 |
|---|---|
| `docs/handoff/0189-0188-post-audit/plan.md` | 본 설계 (신설) |
| `docs/handoff/0189-0188-post-audit/audit.md` | 감사 보고서 (신설) |
| `docs/handoff/INDEX.md` | 0189 행 추가 |

## 19. 게이트

```bash
node app/scripts/check-doc-inventory.mjs --check   # 링크·prose 검사
git diff --check
git diff --stat -- app/                            # 빈 diff 여야 한다 (AC8)
# 인용 전수: audit.md 의 각 파일:줄 을 sed -n <n>p 로 재확인 (AC2)
```

`app/**` 미변경이므로 `npm run lint`·`typecheck`·`vitest` 는 **비대상**이다. 이 환경은
`app/node_modules` 가 없어 실행도 불가하다(`app/AGENTS.md` 제약 환경 게이트 가이드).

## READY self-review

- [x] 사용자 결정 7건이 Decision Ledger 에 ACTIVE 로 있다.
- [x] Product & UX Contract 가 Technical Design 보다 앞이고 구현 방식 없이 완료 상태를 설명한다.
- [x] "기록만"·"시정 필요" 같은 사용자 표현을 재해석하지 않았다(D-005 에 해석 근거를 남겼다).
- [x] 사용자에게 물어야 할 것(산출물 형태·판정 기준·처리 범위)은 물었고, 코드 사실은 조사했다.
- [x] 수치를 이번 세션에서 다시 셌고 내역 합과 총계를 검산했다.
- [x] 저장소 규칙(root AGENTS 원칙 4·5, handoff AGENTS 의 verify 대체 금지)을 §16 에서 대조했다.
- [x] 각 AC 가 행동 단언·검증 방법·도달 경로를 갖는다.
- [x] structural proxy 만으로 통과하는 AC 가 없다 — AC2 는 파일 존재가 아니라 줄 내용을 본다.
- [x] 본문을 Decision Ledger 와 교차검증했다.

---

## [구현자 기입] 강제 지점 전수 (§10 대조)

| 강제 지점 | 닫은 수 / 전체 | 비고 |
|---|---|---|
| 인용 `파일:줄` 정확성 | 전수 / 전수 | 작성 후 `sed -n <n>p` 로 재확인. 초안의 4건(`handlers/providers.ts:69`→`:67`, `runtime.ts:120`→`:119`, `store-file.ts:58`→`:56`, `useProviders.ts:93`→`:91-96`)을 정정했다 |
| 실측/연역 구분 | 전수 | 연역 항목은 §축3 U1 하나이며 표기했다 |
| `app/**` 무변경 | 1 / 1 | `git diff --stat -- app/` 빈 diff |
| 0188 Decision/AC 무변경 | 1 / 1 | `0188/plan.md` 미수정 |
| 수치의 커밋 범위 명시 | 1 / 1 | `audit.md` 머리 |

## [구현자 기입] Product/UX 파생 검토

- 독자가 판정만 읽고 덮을 수 있는가 → 축별 판정 1줄을 표 위에 뒀다.
- 근거를 재현할 수 있는가 → 발견마다 `파일:줄`. AC2 가 그것을 계약으로 잡는다.
- 감사가 0188 을 부당하게 깎는가 → 축4 에 반대 논거를 병기했다(AC6).

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 |
|---|---|---|
| 1 | 조사 에이전트가 `createConnectionSources` 의 `harness`/`usage` category 를 "호출부 부재 결함" 으로 보고했다 | ❌ 기각. `app/deployment/connections.ts` 는 **배포가 채우는 확장점**이고 헤더가 그 설계를 명시한다. `deployment-wiring.test.ts:332,337` 이 두 category 를 실제로 태운다. 보고서에는 "기본 배포 구현체 0개(간접층)" 로만 적었다 |
| 2 | 사용자 대면 문구 변경이 plan r10 기록보다 1건 많다 | ✅ 반영. `login.ts:375` 는 어디에도 기록이 없어 U2 로 신규 기록 |
| 3 | `verify.md` 는 IPC/DTO diff 0 이라 했는데 `shared/ipc.ts` 에 2줄 diff 가 있다 | ✅ 확인 후 무해 판정 — 주석의 경로 표기 1줄뿐(`contracts/provider.ts`→`contracts/auth.ts`). 계약 무변경이므로 회귀로 적지 않았다 |
| 5 | **사용자 지적으로 드러남(r2)** — 초안이 축 1 을 `code ↔ proposal.md` **1층**으로만 채점했다. 0188 은 ACTIVE Decision 63건을 갖고 일부는 제안서를 정당하게 구체화·대체하며(출처: 제안서/외부리뷰/**사용자**), 일부 "이탈" 은 0188 이전부터 그랬던 것이다 | ✅ 3층 채점으로 전면 재작성. **철회 2건**(`AgentEnvironment`·`ResolvedHarnessSettings` 명명 — 둘 다 baseline/Decision 이 해소) · **정정 3건**(F1 축소 · F4 재정의 · U2 축소) · **강화 3건**(F3→D-017 미이행, F2→비대칭, U3→D-054 부분 적용). `정정 이력` 절 신설 |
| 4 | **사용자 질의로 드러남** — 초안은 F2 를 "AC 번역 누락" 으로 한 줄 적었을 뿐, 그것이 **얼마나 넓은 현상인지** 세지 않았다 | ✅ 선조치. 제안 수용기준 36불릿을 AC1~25 에 1:1 매핑해 **승계 누락 6건**을 찾았고(그중 2건이 실제 이탈), F4 로 신설했다. AC11 을 함께 추가했다. `plan.md §2` 가 "그대로 승계" 를 선언했으므로 이것은 취향 차이가 아니라 선언 위반이다 |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 3 (신설 2 · 갱신 1). `app/**` 0 |
| 실행 명령 | `node app/scripts/check-doc-inventory.mjs --check` · `git diff --check` · 인용 전수 `sed -n` |
| 게이트 결과 | 아래 커밋 메시지 참조 |
| 블로커 | 없음 |

## [검증자 기입] 파생 이슈

- [ ] (verify 턴에서 채운다)
