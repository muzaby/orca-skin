# Plan — 0235-adapter-agent-kind-env

## 메타

| 항목 | 값 |
|---|---|
| slug | `0235-adapter-agent-kind-env` |
| 작성자 | Codex — 사용자의 신규 handoff-plan 요청에 따라 설계 수행 |
| 일자 | 2026-09-15 |
| 매핑 | 0234 Work 프로필 후속이지만 독립 제품 계약 |
| 상태 | plan/READY — 구현 미착수 |
| V mode | Baseline V |
| 기준 V | none |
| 이번 V revision | V1 |
| 유효 V | V1 |
| 조사 기준 | `d8cc4054` — `git pull --ff-only` 결과 Already up to date, 시작 시 변경 파일 0 |
| 다음 주체 | Codex — 별도 handoff-impl 턴 |
| 이번 턴 경계 | plan 문서와 INDEX만 작성; app 코드·테스트 구현은 하지 않음 |

# Part I — Product & UX Contract

## 1. Context / 목표

Code와 Work는 같은 adapter를 사용해도 서로 다른 최적화된 실행 환경이 필요하다. 현재 spawn env 조립은 process·app·settings·runtime·배포 custom 축만 알며, adapter가 `agentKind`별 전용 환경 정책을 강제할 계약은 없다(`harness-config.ts:283-356`).

완료 후 활성 adapter가 Code/Work별 전용 환경변수 정책을 소유한다. 현재 Claude Work는 세 변수를 `1`로 강제하고 Claude Code는 같은 Work 전용 키를 제거하며, 미래 adapter도 중앙 분기 추가 없이 같은 계약을 구현한다.

성공을 사용자 관점에서 한 문장으로: 같은 cwd에서 Code와 Work를 함께 실행해도 각 세션은 선택된 adapter가 정한 종류별 최적화 환경만 받는다.

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | adapter를 식별할 수 있고 Code/Work를 식별할 수 있어야 함 | 2026-09-15 사용자 메시지 |
| 명시 요구 | `Claude + Work`에 `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, `CLAUDE_CODE_ENABLE_TASKS=1`, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` 적용 | 2026-09-15 사용자 메시지 |
| 조건 원문 | “code/work 각각의 최적화된 서비스를 제공하기 위해 claude에서 강제해야하는 추가 환경변수가 있는 것이다.” | 2026-09-15 사용자 정정 |
| 조건 원문 | “환경변수는 각각의 adapter에서 제공하는 전용 환경변수이다. 이것은 추후 추가될 타 adapter에서도 적용되는 개념이다” | 2026-09-15 사용자 정정 |
| 설계 승인 | adapter가 정책을 소유하고 Code에서 Work 전용 키를 제거하는 수정안 뒤 새 handoff 구현 요청 | 2026-09-15 후속 메시지 |
| 작업 경계 | “plan문서까지만 작성하라” | 2026-09-15 최종 범위 지정 |

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 종류별 spawn 환경 정책은 각 `SessionAdapter`가 소유한다 | 환경변수는 adapter 전용이며 미래 adapter에도 같은 개념 적용 | 사용자 정정 | ACTIVE | 중앙 `adapterId` switch 제안 대체 |
| D-002 | adapter 정책 입력은 세션 출생 속성인 `AgentKind` 하나다 | adapter 식별은 활성 adapter 인스턴스/`id`, Code/Work 식별은 검증된 kind가 담당 | 사용자 요구 + 기존 계약 | ACTIVE | — |
| D-003 | 정책 산출은 문자열 설정과 명시적 제거를 함께 표현한다 | Work 전용 키가 하위 process/settings 등에 있어도 Code에서 제거해야 “강제”가 성립 | 사용자 “강제” + 승인된 수정안 | ACTIVE | 빈 객체만 반환하는 이전 제안 대체 |
| D-004 | adapter 정책은 기존 모든 env 레이어보다 나중에 적용한다 | 예약된 adapter 최적화 키를 custom/runtime/settings/app/process가 되돌리지 못하게 함 | 사용자 “강제” | ACTIVE | 0207의 기존 레이어 상호 우선순위는 비예약 키에서 유지 |
| D-005 | Claude Work는 지정된 세 키를 정확히 `1`로 설정하고 Claude Code는 세 키를 제거한다 | 현재 제공된 Claude 종류별 정책 | 사용자 요구 + 설계 확인 | ACTIVE | — |
| D-006 | `harness-config.ts`는 범용 patch 적용·settings env hoist·fingerprint만 소유한다 | adapter 이름과 제품 정책을 generic 조립부에 넣지 않음 | 사용자 위치 제안에 대한 레이어 검토 | ACTIVE | 중앙 Claude 분기 제안 대체 |
| D-007 | 신규·resume·fork/handoff·자동 연속·provider 미해석 경로가 같은 정책을 사용한다 | 한 경로라도 빠지면 같은 세션의 재spawn 환경이 달라짐 | 기존 수명주기 계약에서 도출 | ACTIVE | — |
| D-008 | 현재 `Backend`에 가상의 `opencode`를 미리 추가하지 않는다 | 미래 adapter는 도입 시 자기 구현을 추가하며, 현재 공개 union을 허위 확장하지 않음 | 코드 조사 + 사용자 미래 확장 요구 | ACTIVE | — |
| D-009 | 기존 `RuntimeSessionAdapter`·SDK/SessionRuntime·권한·도구·DB·IPC·workspace 설정 경로는 유지한다 | env 정책은 턴 준비에만 필요하므로 runtime 거버넌스 port를 넓히지 않음 | 기존 아키텍처 + 0234 경계 | ACTIVE | — |
| D-010 | 이번 턴은 READY plan과 INDEX 등록까지만 수행한다 | 사용자의 반복된 범위 제한 | 사용자 최종 지시 | ACTIVE | 이전 구현 요청의 실행 범위 대체 |

### 갱신 메모

- 신규 결정 D-001~D-010, OPEN 0건. D-003~D-005는 사용자가 “강제” 의미를 정정한 뒤 승인한 adapter 소유 설계를 보존한다.
- ACTIVE 결정 ↔ AC 대조: 충돌 0. D-001/002/008→AC3, D-003/004/005→AC1·AC2·AC5, D-006→AC5, D-007→AC4, D-009→AC6·AC7.
- D-010은 제품 AC가 아닌 작업 경계다. 이번 변경 목록을 `docs/handoff/0235-adapter-agent-kind-env/plan.md`와 `docs/handoff/INDEX.md` 두 파일로 제한한다.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 증상이 아니라 원인을 겨냥하는가 | 타당 | `resolveTurn`은 kind와 adapter를 모두 알지만 env 조립 요청에는 kind를 전달하지 않는다(`resolve-turn.ts:65,85`). |
| 기존 코드가 이미 충족하는가 | 미충족 | `PrepareHarnessConfigInput`에는 app/base/config/custom만 있고 adapter 종류별 정책 입력이 없다(`harness-config.ts:283-294`). |
| `harness-config.ts`에 Claude 분기를 직접 두는가 | 부적합 | adapters 공통 조립부가 미래 adapter별 정책을 중앙 소유하면 D-001과 충돌한다. |
| `SpawnEnvInjector`를 재사용하는가 | 부적합 | 배포 전역 정책이며 입력에 `AgentKind`가 없고 custom env가 최상위라는 0207 목적은 프록시·CA 적응이다(`auth.md:510-516`). |
| 단순 Work overlay만 추가하면 충분한가 | 불충분 | `options.env` 생략 시 SDK가 process env를 상속하므로 Code에서 Work 전용 키의 부재를 강제할 수 없다(`harness-config.ts:288-290,339-356`). |
| 미래 OpenCode를 지금 enum에 넣어야 하는가 | 아니오 | 현재 `Backend`는 `claude` 한 값뿐이다(`shared/ipc.ts:297`); port 다형성으로 확장점을 먼저 만들 수 있다. |
| 추가 사용자 결정이 필요한가 | 없음 | owner·강제 의미·현재 Claude 값·plan-only 범위가 모두 확정됐다. |

코드 조사로 닫은 사실: 삭제를 표현하려면 문자열 env overlay가 아닌 patch가 필요하며, null 제거 patch가 하나라도 있으면 명시적 `options.env`를 만들어 process 상속에서도 키를 제거해야 한다.

## 5. 동작 / 사용자 흐름

```text
세션 전송/자동 연속 이벤트
  → DB·lease에서 AgentKind 검증
  → 활성 SessionAdapter가 kind별 강제 env patch 산출
  → 기존 env 레이어 조립 후 patch를 마지막에 적용
  → 최종 env fingerprint 계산
  → 기존 chat/title/respawn 경로가 같은 snapshot 소비
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자/소비자에게 보이는 결과 |
|---|---|---|
| 신규 Claude Work | 세 키를 최종 env에서 `1`로 강제 | Todo/Task 활성화와 foreground background-task 비활성 정책을 가진 Work 실행 |
| 신규 Claude Code | 하위 레이어에 같은 키가 있어도 최종 env에서 제거 | Work 전용 최적화가 Code에 누출되지 않음 |
| 같은 cwd의 Code·Work 동시 실행 | 세션별 검증 kind로 각 patch 계산 | workspace 공유와 무관하게 서로 다른 env snapshot 사용 |
| resume·fork·handoff | 저장된/계승된 출생 kind를 다시 사용 | 재개 뒤에도 종류별 정책 유지 |
| provider entry 미해석 | 활성 adapter와 kind로 patch 적용, runtime fingerprint는 기존 보수적 undefined 유지 | fallback spawn도 종류별 env를 잃지 않음 |
| 자동 listen/flush 연속 | 캡처된 lease kind로 provider/env 재해석 | 재spawn 시 최초 턴과 같은 정책 사용 |
| 기존 env와 예약 키 충돌 | adapter patch가 마지막에 override/delete | 배포 custom을 포함한 하위 값이 정책을 뒤집지 못함 |
| 미래 adapter 추가 | 새 adapter가 같은 port 메서드를 구현 | 중앙 Claude/OpenCode switch 없이 전용 Code/Work 정책 확장 |
| adapter가 빈 patch 반환 | 기존 lazy env 생략과 레이어 우선순위 유지 | 전용 정책이 없는 adapter의 현재 동작 불변 |

### 파생 UX / 엣지케이스

- loading / error: 새 비동기 작업은 없다. 순수 adapter 정책 계산의 예외는 기존 턴 준비 오류 경로로 전파하되 구현 계약은 throw 금지다.
- cancel / retry / close / restart: env는 spawn-bound snapshot이며 기존 cancellation·cleanup을 변경하지 않는다. 재시작과 retry는 같은 kind로 다시 계산한다.
- concurrency / multi-session: 전역 `process.env`를 수정하지 않고 요청별 새 env 객체에만 patch를 적용한다.
- 외부환경/폐쇄망: 비예약 키의 `custom > runtime > settings > app > process` 순서는 유지한다. adapter가 선언한 예약 키만 그 위에서 강제한다.

## 6. 범위 / 비범위

- **범위**: adapter port의 kind별 env patch 계약, Claude 정책, DEV Mock의 Claude 동등 정책, resolved/unresolved/자동 연속 배선, 최종 env·fingerprint, 테스트와 현재 아키텍처 문서의 우선순위 갱신.
- **비범위**: OpenCode adapter 구현·`Backend` union 확장, 사용자 환경변수 UI, DB/IPC/schema 변경, 새 Cowork runtime/provider, `process.env` 전역 수정, 새 Claude Code용 변수 추가, SDK 업그레이드.
- **이번 턴 비범위**: `app/**`와 제품 문서 구현, 테스트 작성·실행, 구현 커밋·push.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| OpenCode별 실제 env 목록 | 아니오 — adapter 도입 때 확정 | 후속 adapter handoff |
| Claude Code 전용 추가 변수 | 아니오 — 현재 사용자 제공값 없음 | 새 요구 시 같은 정책 함수에 추가 |
| 외부 plugin adapter API 공개 | 예 — 공개 계약이 됨 | 현재 내부 `SessionAdapter` port로 제한 |

## 7. Requirements / Acceptance — `R ↔ AT`

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | Claude Work의 최종 spawn env에 세 키가 정확히 `1`이며 모든 하위 충돌값을 이긴다 | process/app/settings/runtime/custom을 각각 `0`으로 둔 표에서 최종 세 값 `1` 단언 | send→resolveTurnProvider→Claude policy→prepareHarnessConfig→SDK |
| R-02 | AT-02 / AC2 | Claude Code의 최종 spawn env에는 세 Work 전용 키가 없고 null 값도 전달되지 않는다 | 모든 하위 레이어에 세 키 `1`을 둔 뒤 key 부재·env 값 전부 string 단언 | send→Claude policy(null)→명시 env 생성/delete→SDK |
| R-03 | AT-03 / AC3 | 활성 adapter가 `AgentKind`를 받아 자기 정책을 산출하며 미래 adapter는 같은 필수 port를 구현한다 | Claude/Mock의 `SessionAdapter` 구현과 resolver의 좁은 준비용 shape typecheck; 중앙 adapter-id 정책 switch 부재를 코드 리뷰로 대조 | registry active adapter→required port→resolveTurnProvider |
| R-04 | AT-04 / AC4 | 신규·resume·fork/handoff·unresolved·자동 연속에서 검증된 kind가 같은 adapter 정책에 도달한다 | 최초/저장 kind/continuation의 Code·Work 양성·음성 대조와 unresolved 결과 단언 | resolveTurn + send.prepareContinuation 두 호출부→resolved/unresolved 조립 |
| R-05 | AT-05 / AC5 | adapter patch 뒤의 최종 env가 settings hoist와 fingerprint의 단일 입력이며 patch 변화는 respawn 비교값을 바꾼다 | 강제 set/delete·settings 원본 불변·work/code fingerprint 차이·동일 입력 안정성 단언 | prepareHarnessConfig→PreparedHarnessConfig→respawnInputs |
| R-06 | AT-06 / AC6 | 비예약 키의 기존 우선순위와 chat/title/listen/flush의 동일 snapshot 소비가 유지된다 | 기존 5층 ladder + title/chat + listen/flush env·fingerprint 회귀 테스트 | prepared snapshot→TurnContext/TurnRequest/continuation→ClaudeAdapter |
| R-07 | AT-07 / AC7 | UI·DB·IPC·권한·workspace 설정을 바꾸지 않고 새 의존성 없이 기존 runtime을 사용한다 | diff 경계, lint boundaries, typecheck, workspace `.claude` write 0 경로 대조 | 기존 SessionRuntime/SDK options.env 경로 |

### AC 검증 주의사항

- 기존 테스트 재사용 확인: `harness-config.test.ts`에 5층 우선순위·settings hoist·fingerprint가 있고, `chat-turn-continuation.test.ts`에 fresh env/fingerprint의 listen/flush 승계가 있다.
- 새 직접 oracle: 정책 함수의 Code/Work 표, harness patch set/delete, resolved/unresolved provider, 자동 연속 호출의 `agentKind`를 각각 실제 결과로 단언한다.
- 총량 기준: `resolveTurnProvider` production 검색은 정의 1 + 호출 2다. kind 전달 강제 지점은 `resolve-turn.ts:85`와 `send.ts:559` 두 호출부다.
- 음성 기준: 중앙 adapter-id 정책 switch 부재는 단독 PASS oracle로 쓰지 않는다. 필수 port typecheck와 서로 다른 adapter double의 반환값 소비를 양성 단언으로 짝짓는다.
- 사람 실기 항목은 없다. SDK에 전달되는 `options.env`는 adapter 옵션 경계 테스트로 기계 판정한다.

## 7-A. V / Trace Matrix

- V mode 판정: 독립 신규 기능이므로 Baseline V.
- 기준 V 상속 근거: 없음. 0234의 `AgentKind`/profile 경로는 코드 기준선으로 사용하지만 그 V 판정을 승계하지 않는다.
- 변경이 시작되는 수준: Baseline V라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01…R-07 | R | §7 각 요구 | NEW | 사용자 정정 |
| AT-01…AT-07 | AT | §7 각 직접 증거 | NEW | 구현 후 테스트/게이트 |
| SD-01 / ST-01 | SD / ST | §5 전체 턴 수명에서 kind별 env 유지 | NEW | — |
| SD-02 / ST-02 | SD / ST | §5·AC6 기존 runtime/snapshot 회귀 | INHERITED | 0188/0190 env snapshot·respawn 계약과 기존 테스트 |
| AR-01 / IT-01 | AR / IT | adapter port가 정책을 소유하고 app이 kind를 배선 | NEW | — |
| AR-02 / IT-02 | AR / IT | generic harness가 강제 patch 뒤 최종 env/fingerprint 생산 | NEW | — |
| MD-01 / UT-01 | MD / UT | Claude Code/Work 순수 정책표 | NEW | — |
| MD-02 / UT-02 | MD / UT | string/null patch의 set/delete·우선순위 알고리즘 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01 | REQUIRED | Work send→adapter policy→final env→SDK | 5층 충돌 fixture에서 세 값 `1` | M3 — 강제 patch를 custom 아래로 이동 | EP-03/04/06/09/10/12 (6) |
| VP-02 | R-02 ↔ AT-02 | REQUIRED | Code send→null patch→delete→SDK | 하위 세 키 존재 fixture에서 최종 key 부재 | M4 — null 처리를 no-op으로 변경 | EP-03/04/06/09/10/12 (6) |
| VP-03 | R-03 ↔ AT-03 | REQUIRED | registry→active adapter required port→resolver | 필수 shape typecheck + adapter double 결과 소비 | M5 — resolver에서 adapter 메서드 호출 제거 | EP-01/02/04/05/09 (5) |
| VP-04 | R-04 ↔ AT-04 | REQUIRED | DB/lease kind→initial/continuation→resolved/unresolved | 경로별 Code/Work 결과 | M1·M2 — 두 kind 전달 중 각 하나 제거 | EP-06/07/08/09/10/11 (6) |
| VP-05 | R-05 ↔ AT-05 | REQUIRED | merged env→forced patch→HMAC→respawn input | 원본 불변·최종 fingerprint 비교 | M3·M4 | EP-10/11/12/13 (4) |
| VP-06 | R-06 ↔ AT-06 | REQUIRED | prepared snapshot→chat/title/listen/flush | 기존 env 동일성·5층 ladder 테스트 | not selected — 기존 직접 행동 oracle | EP-10/12/13 (3) |
| VP-07 | R-07 ↔ AT-07 | REQUIRED | existing app composition→existing runtime | diff/lint/typecheck/dependency·write 경계 | not selected — repository gate | EP-01/02/06/07/08/14 (6) |
| VP-08 | SD-01 ↔ ST-01 | REQUIRED | session birth kind→all re-resolution paths→spawn | initial/resume/fork/handoff/continuation 종단 조합 | M1·M2 | EP-06/07/08/09/10/11/12 (7) |
| VP-09 | SD-02 ↔ ST-02 | REGRESSION | prepared snapshot→SessionRuntime reuse/respawn | 동일 env reuse·변경 env respawn + downstream snapshot | not selected — 기존 종단 oracle | EP-12/13 (2) |
| VP-10 | AR-01 ↔ IT-01 | REQUIRED | adapter contract→Claude/Mock→resolveTurnProvider | 구현체 2/2와 호출부 2/2 + adapter double | M1·M2·M5 | EP-01…09 (9) |
| VP-11 | AR-02 ↔ IT-02 | REQUIRED | adapter patch→resolved/unresolved harness→prepared | 두 조립 갈래의 set/delete·fingerprint | M3·M4 | EP-09/10/11/12 (4) |
| VP-12 | MD-01 ↔ UT-01 | REQUIRED | `AgentKind`→Claude patch | literal Code/Work 기대표 | not selected — 순수 직접 oracle | EP-03 (1) |
| VP-13 | MD-02 ↔ UT-02 | REQUIRED | legacy env + patch→final env | set/delete/empty/host-managed 경계표 | M3·M4 | EP-10/12 (2) |

M1=`resolveTurn`의 최초 `agentKind` 전달 제거, M2=자동 연속 호출의 `agentKind` 전달 제거, M3=adapter patch를 `customEnv`보다 먼저 적용, M4=`null` 키 삭제를 생략, M5=`resolveTurnProvider`가 adapter 메서드 대신 빈 patch를 사용.

선택 이유: M1/2/5는 port가 존재해도 production 배선이 빠지는 회귀를, M3은 “강제” 우선순위를, M4는 Code 격리를 직접 반증한다. 같은 변이가 여러 pair를 지지해도 구현 잠금 표에서는 변이별 한 행으로 센다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| plan/INDEX 정합성 | 이번 턴 산출물은 두 문서뿐 | `git diff --check`; 링크·slug·상태·다음 주체 재읽기 | 문서 불일치가 있으면 READY 불가 |
| 문서 인벤토리 | 새 상대 링크와 handoff 경로 | `cd app; node scripts/check-doc-inventory.mjs --check` | 이번 문서로 생긴 오류만 blocking |
| 구현 subtree gate | 이후 `app/**` 변경 | `npm run lint`; `npm run typecheck`; 관련 `npx vitest run ...` | 구현 변경 유발 오류 또는 pair 실패 |
| branch 통합 gate | 현재 branch의 기존 사용자 요구 | 구현 후 push 직전 `npm test`를 마지막에 실행 | 신규 실패 또는 명시 계약 위반; ABI 환경 실패는 별도 분리 |
| message bus | 설계/구현 커밋 분리 | 설계 커밋 후 trailer parse, 구현은 별도 커밋 | trailer·상태 사본 불일치 |

# Part II — Technical Design

## 8. Research — 현재 코드와 계약

| 발견 / 제약 | 근거 |
|---|---|
| `AgentKind`는 `code|work`이며 세션 출생 속성이다 | `app/src/shared/agent-kind.ts:3-5` |
| `Backend`는 현재 `claude`만 포함한다 | `app/src/shared/ipc.ts:297` |
| `SessionAdapter`에는 env 정책 메서드가 없다 | `app/src/main/adapters/types.ts:70-92` |
| runtime용 adapter 표면은 `SessionAdapter`의 네 메서드만 Pick한다 | `app/src/main/contracts/ports.ts:23-26` |
| kind와 adapter가 처음 함께 존재하는 곳은 `resolveTurn`이다 | `app/src/main/app/chat-turn/resolve-turn.ts:58-85` |
| env는 legacy 5층을 spread한 뒤 HMAC fingerprint로 접힌다 | `app/src/main/adapters/harness-config.ts:339-363` |
| unresolved 경로도 같은 조립기를 쓰되 runtime fingerprint는 undefined다 | `app/src/main/adapters/harness-config.ts:383-398` |
| chat과 title은 같은 prepared env를 받는다 | `app/src/main/app/chat-turn/send.ts:232,279,499-502` |
| 자동 연속은 매회 provider/env를 다시 resolve한다 | `app/src/main/app/chat-turn/send.ts:552-566`; `chat-turn-continuation.ts:58-82` |
| 기존 문서는 custom env를 legacy 최상위로 규정한다 | `docs/arch/backend/auth.md:538-566`; `docs/guides/closed-network-extensions.md:457` |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| handoff 번호 | `Get-ChildItem docs/handoff -Directory` 정렬 | max=0234 | 신규 slug는 0235 |
| `SessionAdapter` 구현체 | `rg 'implements SessionAdapter' app/src/main/adapters` | 2 | ClaudeAdapter·MockAdapter 모두 새 필수 port 구현 |
| `RuntimeSessionAdapter` 명시 test double | `rg ': RuntimeSessionAdapter|RuntimeSessionAdapter\s*=' app/src/main --glob '*.test.ts'` | 2 | 턴 실행 port를 유지하면 두 fixture는 변경 대상이 아님 |
| `resolveTurnProvider` production 위치 | 테스트 제외 `rg 'resolveTurnProvider\('` | 정의 1 + 호출 2 | 최초/재개와 자동 연속이 kind 전달 전수 |
| harness production 조립 갈래 | 테스트 제외 `rg 'prepareHarnessConfig\(|prepareUnresolvedHarnessConfig\('` | resolved 1 + unresolved 1 | patch 전달 전수 |
| adapter 구현 식별자 | `ClaudeAdapter.id`, `MockAdapter.id` | 2/2 `claude` | DEV Mock은 Claude 정책을 공유해야 함 |

### 수치 / 전칭 표현 검산

- 재측정 수치: production kind 전달 호출부 2, 조립 갈래 2, adapter 구현체 2, 명시 runtime test double 2.
- 내역 합 = 총계: 호출부 `resolve-turn.ts:85` + `send.ts:559` = 2; 조립 `resolve-turn.ts:210` + `:233` = 2.
- 반례 검색: app production에서 `resolveTurnProvider`를 부르는 제3 호출부 0, `SessionAdapter` 제3 구현체 0.
- 기존 테스트 존재 확인: `env 우선순위 (AC15)`, `배포 spawn env injector (0207)`, `chat turn automatic continuation — runtime config fingerprint (0188)` describe가 실제 존재한다.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: SD-01, AR-01, AR-02.
- 현재 책임 소유자: 배포 custom은 app/deployment, runtime/settings/app/process 병합과 fingerprint는 adapters/harness-config, kind 검증은 app/chat-turn.
- 현재 오류/취소/정리 경로는 기존 send 준비 try/finally가 소유한다. env 정책 계산은 존재하지 않는다.
- 직접 원인: adapter port가 kind를 입력받지 않고, 조립기는 문자열 overlay만 받아 하위 env 키 제거를 표현할 수 없다.

```text
resolveAgentKind + activeAdapter
  → resolveTurnProvider(adapter만 전달)
  → legacy env 5층 조립
  → PreparedHarnessConfig
  → chat/title/SessionRuntime
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: SD-01/02, AR-01/02.
- 변경 후 책임 소유자: adapter는 종류별 전용 정책, harness-config는 범용 patch 적용, app/chat-turn은 검증 kind 전달만 소유한다.
- 정책 계산은 동기·순수이고 요청별 객체만 바꾼다. 예외·취소·cleanup 경로는 추가하지 않는다.
- 기존 legacy 레이어·settings hoist·HMAC·respawn·SDK 전달은 유지하고 그 최종화 직전에 adapter patch만 신설한다.

```text
resolveAgentKind + active SessionAdapter
  → adapter.agentSpawnEnv(agentKind): string|null patch
  → process→app→settings→runtime→custom env
  → adapter patch set/delete (최종 강제)
  → final env HMAC
  → existing chat/title/continuation/SessionRuntime→SDK
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | env 종류 정책 없음 | 각 adapter가 kind별 정책 소유 | 미래 adapter 확장 | AR-01 / VP-03·10 |
| data/control flow | resolver에 adapter만 전달 | 두 호출부가 검증 kind도 전달 | 전체 수명 일관성 | SD-01 / VP-04·08 |
| state/contract | 문자열 env overlay만 | `string|null` 강제 patch | Code에서 하위 키 제거 | AR-02·MD-02 / VP-02·11·13 |
| 우선순위 | custom이 legacy 최상위 | adapter 예약 patch가 최상위, legacy 상호 순서 유지 | 강제 정책 | R-01/02 / VP-01·02·05 |
| lifecycle | resolved/unresolved/continuation에 kind 없음 | 세 갈래 모두 같은 adapter policy | 재spawn drift 방지 | SD-01 / VP-04·08 |
| test seam | generic env와 continuation만 | Claude 순수 정책 + patch algebra + production 배선 | adapter/종류 행렬 직접 관측 | MD-01/02 / VP-12·13 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `adapters/harness-config.ts` | patch 타입·최종 적용·fingerprint | legacy env + `AdapterSpawnEnvPatch` → prepared | app/chat-turn, adapter tests |
| `adapters/types.ts` | adapter 필수 정책 port | `AgentKind` → patch | adapter 구현·resolve-turn의 좁은 Pick |
| `adapters/claude-agent-kind-env.ts` | Claude Code/Work 정책 SSOT | kind → 동결된 literal patch | ClaudeAdapter·MockAdapter |
| `adapters/claude.ts`, `mock.ts` | 자기 정책을 port로 노출 | method delegate | registry/app |
| `app/chat-turn/resolve-turn.ts` | 검증 kind와 활성 adapter를 결합 | request → prepared snapshot | send initial/continuation |
| `app/chat-turn/send.ts` | 자동 연속에서 lease kind 승계 | captured kind → resolver | continuation loop |

## 10. 계약 / 타입 / 강제 지점

| EP | V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|---|
| EP-01 | AR-01 / VP-03,10 | `SessionAdapter.agentSpawnEnv(agentKind)` 필수 port | `adapters/types.ts` | 모든 adapter | 구현체 선언 시 typecheck | 미래 adapter가 종류 정책을 빼먹거나 중앙 분기로 회귀 |
| EP-02 | AR-01 / VP-03,10 | resolver adapter 입력은 `Pick<SessionAdapter, 'id' | 'agentSpawnEnv'>` | `resolve-turn.ts` | resolveTurn/resolveTurnProvider | 턴 준비 타입검사 | env와 무관한 RuntimeSessionAdapter를 넓히거나 resolver가 정책 port를 잃음 |
| EP-03 | MD-01 / VP-01,02,12 | Claude 정책표: Work=set 3, Code=remove 3 | `claude-agent-kind-env.ts` | Claude·Mock | kind별 정책 계산 | Work 기능 누락 또는 Code 누출 |
| EP-04 | AR-01 / VP-01,02,03,10 | ClaudeAdapter가 정책 SSOT를 노출 | `claude.ts` | registry active adapter | 턴 준비 | 실제 Claude와 순수 정책 분리 |
| EP-05 | AR-01 / VP-03,10 | MockAdapter도 Claude 정책 SSOT 사용 | `mock.ts` | DEV registry | mock 턴 준비 | DEV만 제품 정책과 다름 |
| EP-06 | SD-01 / VP-01,02,04,08,10 | 최초/재개 resolver 요청에 `identity.kind` | `resolve-turn.ts:85` | resolveTurn | source kind 검증 직후 | 신규/resume/fork/handoff가 잘못된 env 사용 |
| EP-07 | SD-01 / VP-04,08,10 | 자동 연속 resolver 요청에 캡처된 `agentKind` | `send.ts:559` | continuation callback | 매 listen/flush 준비 | continuation 재spawn만 정책 유실 |
| EP-08 | AR-01 / VP-04,08,10 | resolver request의 `agentKind`는 필수 | `resolve-turn.ts` request type | 두 production caller | 컴파일 시 | 제3 호출부가 kind를 생략 |
| EP-09 | AR-01/02 / VP-01…05,10,11 | 활성 adapter method를 1회 호출해 patch snapshot 생성 | `resolveTurnProvider` | app composition | provider 선택 전 공통 | resolved/unresolved가 다른 정책 계산 |
| EP-10 | AR-02·MD-02 / VP-01,02,05,11,13 | `AdapterSpawnEnvPatch = Readonly<Record<string,string|null>>`; 문자열=set, null=delete | `harness-config.ts` | prepareHarnessConfig | legacy merge 뒤 | null이 SDK로 흐르거나 하위 값이 남음 |
| EP-11 | SD-01·AR-02 / VP-04,08,11 | unresolved helper도 같은 patch 입력 | `prepareUnresolvedHarnessConfig` | resolveTurnProvider | entry 미선택 | fallback spawn에서 정책 유실 |
| EP-12 | AR-02 / VP-01,02,05,06,08,09,11 | patch 비어있지 않으면 env를 만들고 custom 뒤 set/delete | `prepareHarnessConfig` | harness 조립기 | settings hoist/host flag 판정과 최종화 | Code process 상속 누출 또는 강제 우선순위 역전 |
| EP-13 | SD-02 / VP-05,06,09 | patch 후 env로 fingerprint 1회 계산하고 기존 3소비자가 공유 | `PreparedHarnessConfig` | send/title/continuation/runtime | 턴 준비·respawn 비교 | stale runtime 재사용 또는 snapshot 불일치 |
| EP-14 | R-07 / VP-07 | 우선순위·책임 문서가 코드와 일치 | `auth.md`, closed-network guide | 구현자 | 코드 변경과 같은 커밋 | 운영자가 custom env를 최종 강제로 오해 |

- 같은 규칙의 SSOT: Claude 키 목록과 Code/Work 값은 `claude-agent-kind-env.ts` 하나이며 두 adapter class가 delegate한다. tests가 별도 키 목록을 생산 코드에서 import해 기대값을 만들지 않고 literal 기대표를 쓴다.
- 강제 지점 전수: port 2 + policy 노출 3 + kind 배선/dispatch 4 + patch 조립 4 + 문서 2개 묶음 1 = EP 14개. 각 EP는 위 표에서 한 번만 센다.
- 선택적 필드 의미: harness utility의 `adapterEnvPatch` 생략/빈 객체는 기존 동작, 문자열은 최종 설정, null은 최종 삭제다. 실제 adapter port 반환은 항상 객체다.
- host-managed 의미: patch가 `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST`를 set/delete할 미래 경우까지 patch 후 유효값으로 판정한다. 현재 Claude 정책은 이 키를 사용하지 않는다.
- 외부 SDK 경계: SDK `Options.env`에는 문자열만 전달한다. null은 delete directive이며 adapter 밖으로 나가지 않는다.

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/adapters/harness-config.ts` | generic env finalizer | patch 타입·set/delete·buildsEnv·host flag·fingerprint 반영 | 기존 순수 harness 테스트 확장 |
| `app/src/main/adapters/types.ts` | adapter port | 필수 `agentSpawnEnv(AgentKind)` 추가 | typecheck + 구현체 테스트 |
| `app/src/main/adapters/claude-agent-kind-env.ts` | Claude 정책 SSOT | Code/Work literal patch | 신규 순수 table test |
| `app/src/main/adapters/claude.ts` | Claude port 구현 | 정책 SSOT delegate | adapter options 경계 |
| `app/src/main/adapters/mock.ts` | DEV Claude double | 같은 정책 SSOT delegate | mock adapter test |
| `app/src/main/app/chat-turn/resolve-turn.ts` | 좁은 준비 port + 최초/resolved/unresolved 배선 | adapter 입력을 id+policy로 좁히고 req에 kind 추가, patch 1회 계산·두 조립 갈래 전달 | agent/runtime-catalog integration |
| `app/src/main/app/chat-turn/send.ts` | continuation 배선 | resolveTurnProvider에 captured kind 추가 | agent-profile continuation test |
| 관련 `*.test.ts` | 직접 oracle | AC1~6와 M1~M5 검출 | Vitest |
| `docs/arch/backend/auth.md` | current-state env 책임 | adapter forced patch 축과 최종 우선순위 | 문서 대조 |
| `docs/guides/closed-network-extensions.md` | 운영 절차 | custom env가 adapter 예약값 아래임을 명시 | 링크/문서 검사 |

### 테스트 가능성

- electron/DB/native 의존부와 분리할 별도 순수 파일: `claude-agent-kind-env.ts`; `harness-config.ts`는 이미 node crypto 외 외부 런타임을 물지 않는다.
- 기존 메커니즘 재사용 적합성: final env HMAC과 respawn 비교는 patch 적용 뒤 값만 받으면 형상·시점이 맞다. settings fingerprint와 합치지 않는다.
- 순서 관측: 5층 모두 충돌하는 기존 ladder에 forced patch를 더해 `adapter > custom > runtime > settings > app > process`의 각 승자를 literal로 단언한다.
- production 배선 관측: resolver의 실제 adapter double이 받은 kind와 반환 patch가 resolved/unresolved prepared env에 나타나는지 본다. mock 호출 횟수만으로 PASS하지 않는다.

## 12. End-to-end 영향

### producer → consumer

```text
DB/lease AgentKind
  → active SessionAdapter.agentSpawnEnv
  → prepareHarnessConfig set/delete
  → PreparedHarnessConfig.env + envFingerprint
  → TurnRequest / title CompleteRequest / continuation
  → ClaudeAdapter adaptExecutionConfig
  → Claude SDK Options.env
```

- producer 기준: source session이 있으면 저장된 kind와 요청 kind가 일치해야 하고, 새 세션은 요청 kind가 출생 속성이 된다.
- consumer 파생 규칙: SDK는 null을 보지 않고 문자열 final env만 받는다. SessionRuntime은 기존 HMAC fingerprint만 보존한다.
- 파생 가능한 합성값이 정본을 우회하지 않는다: chat/title/continuation이 policy를 각자 재계산하지 않고 prepared snapshot을 공유한다.

### 부팅/등록/초기화 변경 시 기존 소비처

해당 없음 — registry 항목 수와 부팅 순서는 바뀌지 않는다. 기존 adapter 구현체 2개가 필수 port를 구현할 뿐이다.

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `resolveTurnProvider`가 adapter patch를 턴 해석마다 한 번 계산한다. 같은 continuation의 listen/flush는 기존 prepared 한 벌을 공유한다.
- 취소/중단: 새 await·AbortSignal·resource가 없다. 기존 준비 중 취소와 runtime interrupt를 그대로 사용한다.
- 종료/quit/crash/renderer-gone: 요청별 env 객체와 patch는 참조가 사라지면 회수된다. 전역/DB/파일 상태를 쓰지 않는다.
- retry/timeout/partial failure: retry·resume는 저장된 kind로 재계산한다. 정책 함수는 동기·순수·throw 금지이며 빈 정책은 `{}`다.
- cleanup/rollback: 해당 없음 — 외부 상태 쓰기 없음.
- 다중 저장소 쓰기: 제품 동작에는 없음. handoff 상태는 plan과 INDEX 두 문서에 있으므로 이번 턴에 둘을 함께 READY로 갱신하고 재읽는다.

## 14. 성능 / 상한 / 최적화

- 새 출력 상한: adapter 정책 patch의 key 수. 현재 Claude는 Code/Work 각각 3개 directive다.
- 새 요청 수: 0. 네트워크·디스크·SDK 호출을 추가하지 않는다.
- 계산 상한: 턴 해석마다 patch key `P`를 한 번 순회하고 기존 env key `E`에 적용하므로 `O(E+P)`, 현재 `P=3`.
- cache/snapshot: 새 cache 없음. 같은 턴의 patch를 resolved/unresolved 분기 전에 1회 계산해 adapter가 비순수해지는 잘못된 구현에서도 한 턴 내 snapshot 분기를 막는다.

## 15. 외부 구현 포트 / 문서 계약

- 외부 공개 포트는 아니다. 저장소 내부 미래 adapter 구현자가 `SessionAdapter.agentSpawnEnv`를 필수 구현한다.
- shape 검증: `AgentKind → Readonly<Record<string,string|null>>`; `SessionAdapter` 구현체 2개가 새 port를 만족하고 기존 `RuntimeSessionAdapter` test doubles는 변경 없이 typecheck한다.
- semantics 검증: string=set, null=delete, empty=no-op, patch가 legacy env보다 우선한다. 순수 contract test로 네 의미를 대조한다.
- 문서: adapter 개발 절차가 별도로 생기기 전까지 `adapters/types.ts` 주석과 `auth.md §6.4`가 진입점이다.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| env legacy 순서 `custom > runtime > settings > app > process` | `auth.md:538-566`, 0207 | §5·§9·§10 | 유지 — 비예약 키 상호 순서 불변; adapter 예약 patch를 새 최상위 축으로 추가 |
| settings/env fingerprint 축 분리 | `harness-config.ts:35-78`, 0188 | §10 EP-13 | 유지 — final env만 기존 HMAC에 입력 |
| unresolved fingerprint는 undefined | `harness-config.ts:383-398` | §5·§10 EP-11 | 유지 — env에는 policy 적용, runtime fingerprint null 의미론은 불변 |
| concrete adapter literal 허용 위치 | `app/src/main/AGENTS.md §작업 규칙` | §9·§11 | 유지 — Claude 키는 adapters에만 위치 |
| feature 교차 import 금지 | `app/src/main/AGENTS.md §레이어 DAG` | §9·§11 | 유지 — adapters는 shared AgentKind만 import |
| Work/Code는 세션 출생 속성 | `shared/agent-kind.ts`, 0224 | §5·§12 | 유지 — 같은 세션의 kind 변경 경로를 만들지 않음 |
| Work profile/runtime 분리 | 0234 D-006 | §6·§12 | 유지 — plugin/system prompt와 env 정책은 별도 축, 기존 runtime 공유 |
| workspace `.claude` 비수정 | 0234 D-005 | §6·AC7 | 유지 — 요청별 Options.env만 변경 |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| Code에서도 명시 `options.env`를 만들며 기존 lazy 경로가 달라짐 | null 제거를 강제하려면 필요. settings env 전체 hoist·base snapshot 보존을 AC2/6으로 잠금 |
| adapter patch가 운영자 custom 값을 덮음 | 사용자 “강제”의 의도된 결과. adapter 예약 키에만 사용하고 문서에 우선순위 명시 |
| 필수 `SessionAdapter` port 확장으로 실제 구현체가 누락될 수 있음 | ClaudeAdapter·MockAdapter 2/2를 typecheck; RuntimeSessionAdapter와 그 test doubles 2곳은 의도적으로 유지 |
| 정책 키 목록이 Claude/Mock에 복제됨 | 별도 Claude 순수 SSOT를 두 adapter가 delegate |
| 중앙 정책 switch가 다시 생김 | required port + resolver adapter-double IT로 동적 dispatch를 양성 검증 |
| null이 SDK env로 누출 | patch 적용 후 `Record<string,string>`만 반환하고 값 전수 string 단언 |

- 되돌리기 어려운 결정: 내부 `SessionAdapter` 필수 메서드 이름. 공개 API는 아니며 같은 구현 커밋에서 모든 구현체를 갱신한다.
- 신규 의존성: 없음.

## 18. 영향 받는 파일 / 문서

- `app/src/main/adapters/{harness-config,types,claude,mock}.ts`
- `app/src/main/adapters/claude-agent-kind-env.ts` 및 관련 테스트
- `app/src/main/app/chat-turn/{resolve-turn,send}.ts` 및 관련 테스트
- `docs/arch/backend/auth.md`
- `docs/guides/closed-network-extensions.md`
- `docs/handoff/0235-adapter-agent-kind-env/plan.md`
- `docs/handoff/INDEX.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §빌드/실행·better-sqlite3 ABI`, `app/src/main/AGENTS.md §레이어 DAG·작업 규칙`, `docs/handoff/AGENTS.md §구현 게이트의 정본`.
- plan-only 게이트: `git diff --check`; `cd app && node scripts/check-doc-inventory.mjs --check`; slug/link/READY/다음 주체 재읽기.
- 구현 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `npx vitest run src/main/adapters/harness-config.test.ts src/main/adapters/claude-agent-kind-env.test.ts src/main/app/chat-turn/resolve-turn.agent.test.ts src/main/app/chat-turn/resolve-turn.runtime-catalog.test.ts src/main/app/chat-turn/send.agent-profile.test.ts src/main/app/chat-turn-continuation.test.ts src/main/features/sessions/respawn-policy.test.ts`.
- branch 최종 gate: 이전 사용자 지시에 따라 push 직전 `npm test`; 실행 후 Node ABI가 되므로 build/dev는 별도 Electron ABI 환경이 필요함을 분리 보고한다.
- 사람 실기: 없음. 실제 SDK 옵션은 adapter 경계 테스트로 관측한다.

## READY self-review

- [x] Decision Ledger가 사용자 정정과 plan-only 경계를 ACTIVE/SUPERSEDED 의미로 보존한다.
- [x] Part I만으로 Claude Work 설정·Code 제거·미래 adapter 확장을 설명한다.
- [x] “강제”와 “각 adapter 전용”을 단순 overlay나 중앙 switch로 재해석하지 않았다.
- [x] AS-IS/TO-BE와 Delta가 같은 adapter/kind/env/lifecycle 축을 비교한다.
- [x] 수치와 전칭 표현은 구현체 2·호출부 2·조립 갈래 2로 재측정했다.
- [x] AC 7개가 행동 단언·직접 검증·production path를 갖는다.
- [x] 독립 신규 기능이라 Baseline V를 사용하고 NEW node마다 REQUIRED pair를 두었다.
- [x] 새 R-06은 VP-06 REQUIRED로, 기존 snapshot/runtime SD-02 영향은 VP-09 REGRESSION으로 선택했다.
- [x] pair 13개가 path·직접 oracle·EP 전수를 가지며 배선/순서/삭제에만 M1~M5를 선택했다.
- [x] 사람 실기로 미룬 순수 로직이 없다.
- [x] 중앙 switch 부재는 음성 grep 단독이 아니라 필수 port와 adapter 결과 소비로 검증한다.
- [x] string/null 의미와 빈 patch·host-managed 의미를 계약에 고정했다.
- [x] producer/consumer와 resolved/unresolved/continuation 전 경로를 연결했다.
- [x] 신규 요청 0, patch 계산 `O(E+P)`와 현재 `P=3`을 계산했다.
- [x] ACTIVE Decision ↔ AC 충돌 0과 기존 0207/0188/0234 관계를 §3·§16에서 대조했다.
- [x] plan/INDEX 두 상태 사본을 같은 턴에 갱신하도록 §13·§19에 등록했다.

---

> **[구현자 기입]** 아래는 별도 handoff-impl 턴에서 작성한다. 이번 plan-only 턴에는 구현 증거를 선점하지 않는다.

## [구현자 기입] 설계 리뷰

- 동의 / 그대로 진행: 구현 턴에서 작성.
- 이견 / 현실성 문제: 구현 턴에서 작성.
- ACTIVE Decision과 충돌하는 설계 발견: 구현 턴에서 작성.

## [구현자 기입] 강제 지점 전수 (§10 대조)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| 구현 턴에서 작성 | — | — | — | — | — |

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| 구현 턴에서 작성 | — | — | — | — |

## [구현자 기입] 이번 라운드 수정의 잠금

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| 구현 턴에서 작성 | — | — | — | — |

- 분모 검산: 구현 턴에서 작성.
- 덮개 회귀: 구현 턴에서 작성.

## [구현자 기입] Product/UX 파생 검토

| 질문 | 판정 | 후속 |
|---|---|---|
| 새로 만든 사용자 대면 문구·상태에 소비자가 있는가 | 구현 턴에서 작성 | — |
| seam을 만들려고 production을 재배치했다면 정리 코드가 보던 변수가 여전히 그 스코프에 있는가 | 구현 턴에서 작성 | — |
| 이번에 만든 실패 경로가 Part I 상태 전이표의 어느 행인가 | 구현 턴에서 작성 | — |
| 실패가 화면에서 “아무 일도 안 일어남”으로 보이지 않는가 | 구현 턴에서 작성 | — |
| 늦게 도착한 응답이 화면을 되돌리지 않는가 | 구현 턴에서 작성 | — |

## [구현자 기입] 놓친 잠재 문제 + 대응

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 구현 턴에서 작성 | — | — | — |

### 설계 대비 명시적 차이

- plan이 지정한 것과 다르게 구현한 것과 그 이유: 구현 턴에서 작성.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 구현 턴에서 작성 | — |
| 공유 | 구현 턴에서 작성 | — |
| 재진입 | 구현 턴에서 작성 | — |
| 다른 무효화 축 | 구현 턴에서 작성 | — |

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | 구현 턴에서 작성 |
| 실행 명령 | 구현 턴에서 작성 |
| 관측한 게이트 산출 | 구현 턴에서 작성 |
| V-pair 자기확인 | 구현 턴에서 작성 |
| 강제 지점 전수 | 구현 턴에서 작성 |
| AC 자기보고 | 구현 턴에서 작성 |
| 합계 검산 | 구현 턴에서 작성 |
| 블로커 / 역질문 | 구현 턴에서 작성 |
| 대상 커밋 | `(r1 구현 — 좌표는 INDEX)` |

## [구현자 기입] Review Signals — 사실만

- 이번에 닫은 불변식이 이전 라운드와 같은 축인가: 구현 턴에서 작성.
- 그것을 막았어야 할 plan 지침·AC가 있었는가, 있었다면 왜 안 걸렸는가: 구현 턴에서 작성.
- 반복해서 부딪히는 환경 한계: 구현 턴에서 작성.
- 현재 라운드 수: 구현 턴에서 작성.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| 검증 턴에서 작성 | — | — | — | — | — |
