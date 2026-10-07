# Plan — 0255-daily-login-gate

> 절차 정본은 [`.agents/skills/handoff-plan/SKILL.md`](../../../.agents/skills/handoff-plan/SKILL.md),
> 협업/상태 머신은 [`docs/handoff/AGENTS.md`](../AGENTS.md).

## 메타

| 항목 | 값 |
|---|---|
| slug | `0255-daily-login-gate` |
| 작성자 | Claude Code 초안 · Codex 복원/설계 검토 |
| 일자 | 2026-10-07 |
| 매핑 | 기준 커밋 `origin/main@5e1e9209` · 브랜치 `claude/0254-0255-nav-progress-daily-login` |
| 상태 | IMPL_DONE |
| V mode | `Delta V` |
| 기준 V | `0255:V1@ba2c3eeb3e00d9126c4d80356823f2160d200f00` (공유 브랜치의 설계 커밋; `git cat-file -t` = commit) |
| 이번 V revision | `ΔV1` |
| 유효 V | `V1 + ΔV1` (§7-B의 대체 관계 적용) |
| 구현 주체 | Codex (기능 구현). **0254 다음 순서** — 두 handoff 가 `useSessionCompletion.ts`·그 테스트를 함께 고친다 |

---

# Part I — Product & UX Contract

## 1. Context / 목표

- 해결하려는 문제: 로그인 게이트를 한 번 통과하면 앱을 끌 때까지 다시 묻지 않는다. 하루 넘게 켜 둔 앱은 추가 로그인 이벤트가 없어 서버의 일별 사용 집계에서 빠진다.
- 완료 후 달라지는 것: 앱 실행 중 로컬 00:00 이 지나면 게이트 통과가 풀리고 로그인 화면이 뜬다. [로그인]을 다시 눌러 통과하면 하던 화면으로 돌아간다. 일일 정책은 자격증명·연결·진행 중 응답을 직접 변경하지 않으며 기존 자연 만료 처리는 유지한다(D-012).
- 성공을 한 문장으로: **서버 호출을 늘리지 않고, 날짜마다 최소 한 번 로그인 게이트를 거친다.**

## 2. 사용자 의도 / 요구 출처

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | "앱 실행 중 **00:00을 지나면 현재 인증 상태를 해제하고 로그인 게이트를 표시한다.**" · "앱이 종료되어 있었다면 다음 실행 시 로그인 게이트를 거치도록 한다." · "**날짜 경계를 기준으로 하루 최소 한 번 로그인 게이트를 거치도록 하는 제품 정책**을 추가한다." | 라이브 세션 2026-10-07 (Daily Login Policy 제안) |
| 명시 맥락 | "사용 집계만을 목적으로 주기적인 health check/fetch를 수행하는 것은 불필요한 서버 자원 사용으로 판단된다." · "별도의 주기적 서버 호출 없이 날짜 경계를 기준으로 로그인 기회를 보장할 필요가 있다." | 동일 |
| 명시 결정 ③ | 자정 해제 범위 = "게이트 통과만 해제" — 로그인 화면이 뜨고 [로그인]을 다시 눌러야 통과, 저장된 자격증명·플러그인 연결·진행 중 응답은 유지 | AskUserQuestion |
| 명시 결정 ④ | 앱 시작 = "현행 유지" — 매 실행마다 게이트가 저장된 로그인을 확인하고 유효하면 자동 통과 | AskUserQuestion |
| 명시 정정 승인 | "제안대로 수행하라" — 일일 정책이 인증을 직접 변경하지 않으며, 기존 자연 만료 처리와 무효화는 유지한다. 정책의 직접 방송과 자연 만료의 추가 방송을 구분한다 | 이 구현 세션, 2026-10-07; 자연 만료 반례와 기존 요구/정정안 차이 설명 뒤 승인 |
| 추론 의도 | "00:00" = 앱이 도는 PC 의 로컬 시각 기준 날짜 경계(D-001) | 사용자 PC 시간대가 곧 업무일 |
| 추론 의도 | 게이트가 떠 있는 밤사이 끝난 작업도 아침에 nav 에서 알아볼 수 있어야 한다(D-008) | 결정③ "진행 중 응답은 유지" + 0249 완료 표시 정책 |

원본 세션: `7e2f51f3-a3e3-5ebd-aa3a-1c5624bc3827` (`2026-10-07T05:06:27.751Z` 요청). `AskUserQuestion` 응답 `toolu_01DLhhmpSR5H6rFh58DWQr62`에서 결정 ①~④를 확인했다. 두 plan 작성 후 `2026-10-07T05:42:04.287Z` 사용 한도로 중단되어, 이번 턴에 코드 대조·추적표 정정·보드 등록을 마무리한다.

## 3. Decision Ledger

| ID | 결정 | 이유/조건 | 출처 | 상태 | 대체 관계 |
|---|---|---|---|---|---|
| D-001 | 기준 = main 프로세스 로컬 시각의 날짜(`YYYY-MM-DD`). 날짜가 바뀌는 순간 게이트 통과를 해제한다 | "00:00을 지나면" · "날짜 경계를 기준으로" | 요구 | ACTIVE | — |
| D-002 | 해제 대상은 **게이트 통과만**이다. Auth grant·`verified`·`credentialRevision`·vault·cookie jar·Plugin 도구·Harness 구성·진행 중 턴을 건드리지 않는다 | 결정③ | 결정③ | SUPERSEDED | D-012: 직접 변경 범위와 기존 자연 만료를 구분 |
| D-003 | 재통과 = 경계 뒤 게이트 멤버마다 로그인 커밋 1회. 판정은 멤버 snapshot이 `valid ∧ verified`이고, 실제 로그인 커밋 이벤트에서 기록한 `lastLoginRevision`이 경계 시점 credential revision보다 큰 것이다. 자동 refresh의 revision 증가는 로그인 증거가 아니다. 경계 시점에 미확인(`verified=false`)이던 멤버는 경계 뒤 첫 확인이 그날의 통과다 | 결정③ "[로그인]을 다시 눌러야 통과". 로그인과 refresh 모두 revision을 올리므로(`store.ts:248-258`, `login.ts:432,656`) 원인 구분이 필요하다(§11 로그인 증거 보완) | 결정③·코드 | ACTIVE | — |
| D-004 | 앱 시작은 현행 유지 — 부팅 자동 확인(복원 probe)으로 통과한다. 경계 표식은 실행 중 메모리에만 있고 영속하지 않는다 | 결정④ | 결정④ | ACTIVE | — |
| D-005 | 경계 감지 = 다음 로컬 자정 타이머 + 시스템 resume·unlock-screen·창 focus 때 날짜 재확인. 서버 호출을 추가하지 않는다. 날짜가 앞뒤 어느 쪽으로 바뀌어도 해제한다 | "별도의 주기적 서버 호출 없이". 절전 중에는 타이머가 제때 돌지 않고 시계 변경은 타이머가 모른다(추론) | 요구·추론 | ACTIVE | — |
| D-006 | 경계에서 즉시 게이트를 띄운다 — 진행 중 턴이 있어도 미루지 않는다. 턴은 main 에서 계속되고 renderer 의 이벤트 수신은 유지된다 | "00:00을 지나면 … 표시한다" + 결정③ "진행 중 응답은 유지". 수신 구독은 게이트 위 계층에 있다(`App.tsx:19-22` · `chatStore.ts:1905`) | 요구·결정③ | ACTIVE | — |
| D-007 | 경계 때문에 뜬 로그인 화면은 이유를 한 줄 안내한다. 현재 단계 멤버가 경계 대상이고 `status='valid'` 일 때만 보인다 | 이유 없이 로그인 화면이 뜨면 연결이 끊긴 것으로 읽힌다(추론). 만료 등 다른 이유와 겹치면 기존 화면 그대로 | 추론 | ACTIVE | — |
| D-008 | nav 주의 표시 구독을 메인 셸 밖(항상 마운트되는 `RootGate`)으로 옮긴다. 게이트 동안 열람 세션은 없음(`null`)이라 그사이 끝난 턴·응답 요청도 표시를 만든다 | 매일 뜨는 게이트가 0249 D-002·D-004 표시를 지우면 안 된다. 현재 구독은 `AppLayout` 안이라 게이트 동안 해제된다(`AppLayout.tsx:32` · `useSessionCompletion.ts:20`) | 결정③·0249 | ACTIVE | 0249 D-006 의 설치 위치만 변경(§16) |
| D-009 | 경계 뒤 로그인이 필요한 멤버 목록을 `ProviderGateState.dailyRelogin`(멤버 순서)으로 renderer 에 보낸다. 로그인 화면의 현재 단계 = `status≠valid` 이거나 이 목록에 있는 첫 멤버 | 현재 규칙(`GateLogin.tsx:42` `status !== 'valid'`)은 경계 뒤 전원이 valid 라 체인을 진행하지 못한다 | 코드 | ACTIVE | — |
| D-010 | DEV 우회(bypass)·게이트 미요구(prod 선언 0)에는 이 정책이 적용되지 않는다 — `dailyRelogin=[]`, `passed` 불변 | 기존 진리표의 앞선 분기(`features/gate/index.ts:72-73`) | 코드 | ACTIVE | — |
| D-011 | 정책의 이유(서버 일별 집계·주기 호출 배제·선택지)는 ADR-008 이 갖고, `docs/arch/backend/auth.md §5` 는 현재 규칙만 서술한다 | `docs/AGENTS.md §문서를 어디에 두는가` | 저장소 규칙 | ACTIVE | — |
| D-012 | 일일 정책은 Auth mutator·서버 요청·Plugin/Harness 무효화·턴 중단을 직접 실행하지 않는다. 유효기간이 남은 자격증명은 유지한다. `snapshot()`의 기존 자연 만료 정착과 그 Auth 이벤트·저장·소비자 무효화는 유지하며 정책의 직접 push 1회와 구분한다 | 실제 자정 만료에서 snapshot이 만료를 정착시킨다. 이를 억제하면 기존 인증 계약이 깨진다 | 사용자 "제안대로 수행하라"(2026-10-07) · [반례](natural-expiry-probe.md) | ACTIVE | D-002 대체; AC1·AC5·§10은 ΔV1 적용 |

### V1 갱신 메모 (기준선 기록; 정정은 §7-B)

- 이번 턴에서 새로 추가된 결정: D-001~D-011 (신규 handoff).
- 변경된 결정: 다른 handoff 결정 중 0249 D-006 의 **설치 위치**만 바뀐다(app 계층 연결 원칙은 유지, §16).
- 기존 ACTIVE 중 유지: 0188 D-007(게이트 membership 은 배포) · 0194 대기 화면 규칙 · `GateMember.verified` "별도 검증 경로를 만들지 마라"(`features/gate/index.ts:41-50`) — 이 plan 은 검증 경로를 추가하지 않고 평소 로그인만 요구한다.
- **`ACTIVE 결정 ↔ AC` 대조**: 충돌 0.
  - D-001 ↔ AC1·AC8(로컬 날짜 키) → 일치. D-002 ↔ AC5(Auth·Plugin·Harness 호출 0) → 일치. D-003 ↔ AC3·AC11·AC12 → 일치.
  - D-004 ↔ AC7(부팅 통과·영속 0) → 일치. D-005 ↔ AC8·AC9(타이머·wake 3종·역행) → 일치. D-006 ↔ AC1(즉시 push)·AC5(턴 abort 0) → 일치.
  - D-007 ↔ AC4 → 일치. D-008 ↔ AC6 → 일치. D-009 ↔ AC3 체인 단계 → 일치. D-010 ↔ AC10 → 일치. D-011 ↔ AC13 → 일치.

## 4. 요구 비판적 검토

| 질문 | 판단 | 근거 |
|---|---|---|
| 요구가 원인을 겨냥하는가 | **타당** — 실행 중에는 게이트를 다시 평가할 계기가 Auth 변화뿐이라 날짜가 바뀌어도 통과가 유지된다 | `createRuntimeModelAuthResume`(`runtime-model-startup.ts:113-125`)만 push 를 부른다 |
| 이미 충족되는가 | **아니다** — 게이트 판정 입력에 시각이 없다 | `evaluateGate`(`features/gate/index.ts:67-90`) |
| 더 작은 해법: Auth 를 만료시키기 | 결정③ 이 기각 — 만료는 Plugin 도구 회수·Harness 무효화를 부른다 | `runtime-model-startup.ts:100-110` |
| 더 작은 해법: 자정에 부팅 확인(probe)만 다시 돌리기 | 기각 — 로그인 화면이 순간 지나가 "[로그인]을 다시 눌러야 통과"(결정③)와 다르고, 세션 쿠키가 살아 있으면 서버에 로그인이 일어나지 않는다 | `auth-resume.ts:239-244` |
| 다시 로그인하면 revision 이 반드시 오르는가 | **예** — `login` 은 유효한 grant 에도 방식을 다시 실행하고 커밋은 `put` 하나다 | `login.ts:455-484` · `store.ts:248-258` |
| 경계가 진행 중 턴을 끊는가 | **아니다** — 게이트는 renderer 화면만 바꾼다. main IPC 는 게이트와 무관하다 | `auth.md §5` "UX 게이트이지 보안 경계가 아니다" · `gate.state()` 소비처 1곳(`connection-views.ts:101`) |
| 게이트가 뜨면 renderer 가 무엇을 잃는가 | 메인 셸 언마운트 — 이벤트 수신은 유지(`App.tsx:19-22`), 주의 표시 구독은 해제, 입력 중 초안은 소실(§17) | `AppLayout.tsx:32` · `ComposerInputController.tsx:104` |
| PRD OQ4(텔레메트리)와 충돌하는가 | **아니다** — 앱이 보내는 데이터가 늘지 않는다. 기존 로그인 경로만 하루 한 번 더 탄다 | `docs/PRD.md §11` OQ4 |

- 사용자에게 올릴 결정: **없음**(결정③④ 로 닫힘).
- 코드 조사로 닫은 사실: §8 F-01~F-18.

## 5. 동작 / 사용자 흐름

```text
[앱 실행 중, 게이트 통과 상태]
  → 로컬 00:00 경과 (타이머 / 절전 해제 / 잠금 해제 / 창 포커스 중 먼저 오는 것)
  → 로그인 화면 + "날짜가 바뀌어 다시 로그인해야 합니다."
     (진행 중 응답은 main 에서 계속 · nav 주의 표시는 계속 쌓임)
  → [로그인] → (SSO 세션이 살아 있으면 창이 바로 닫힘) → 커밋
  → 게이트 멤버가 여럿이면 다음 멤버 단계 → 전원 완료
  → 메인 화면 복귀(같은 경로)
  ↘ 로그인 실패: 같은 로그인 화면 + 기존 실패 문구, 다시 시도
[앱이 꺼져 있었다] → 다음 실행: 현행 부팅 확인 → 유효하면 자동 통과
```

### 상태와 전이

| 시작 상태/이벤트 | 시스템 동작 | 사용자에게 보이는 결과 |
|---|---|---|
| 게이트 통과 + 날짜 변경 감지 | `lapseDay()` → 멤버별 표식 기록 → push 1회 | 로그인 화면 + 경계 안내 |
| 같은 날 재확인(포커스 등) | 변화 없음 | 변화 없음 |
| 경계 뒤 멤버 로그인 커밋 | 로그인으로 기록한 revision > 표식 → 그 멤버 통과 | 다음 멤버 단계 또는 메인 화면 |
| 경계 뒤 로그인 실패·취소 | 커밋 없음 | 로그인 화면 유지 + 기존 실패 문구 |
| 경계 시점 부팅 확인 진행 중(`verified=false`) | 확인 성공이 곧 그날 통과 | 기존 부팅 흐름 그대로 |
| 게이트 미통과 상태에서 날짜 변경 | 표식 기록 | 기존 로그인 화면(안내는 현재 멤버가 valid 일 때만) |
| bypass ON / 게이트 미요구 | 표식 무시 | 변화 없음 |
| 게이트 동안 턴 종료·응답 요청 | 0249 표시 생성(열람 없음) | 재통과 뒤 nav 파랑, 현재 경로 세션은 열람 해제 |
| 앱 종료 후 재실행 | 표식 없음(메모리) | 현행 부팅 확인 |

### 파생 UX / 엣지케이스

- loading / error: 로그인 실패는 기존 `failed` step 문구를 쓴다. 새 문구는 경계 안내 1개.
- cancel / retry / close / restart: 로그인 창을 닫으면 게이트는 닫힌 채다. 재시작하면 현행 부팅.
- concurrency: 경계와 사용자의 로그인 클릭이 겹치면 커밋 시점 revision 이 판정한다 — 경계 뒤 커밋만 통과다.
- 절전·시계 변경: wake 3종에서 재확인한다. 시계를 되돌려도 날짜가 바뀌면 해제한다(D-005).
- 입력 중 초안: 게이트가 메인 셸을 언마운트하므로 자정 직전 입력 중이던 미전송 텍스트는 사라진다(§17, 후속 후보).

## 6. 범위 / 비범위

- **범위**: 날짜 경계 감지(main) · 게이트 일일 표식과 판정 · wire `dailyRelogin` · 로그인 화면 현재 단계·안내 · nav 주의 표시 구독 위치 이동 · Auth 커밋 원인 구분 및 기존 change 소비자에서 로그인 증거 기록 · 문서(auth.md §5 · IPC_CONTRACT · ADR-008 · decisions README · docs/INDEX · 폐쇄망 가이드 §2 · frontend state.md).
- **비범위**: 일일 정책의 직접 Auth 상태 변경(D-012) · 앱 시작 동작(D-004) · 서버 호출 추가 · 경계 표식 영속 · 입력 중 초안 보존 · 사용자 설정 토글(정책은 항상 켜짐) · 다른 시각 기준(서버 시각·고정 시간대). 기존 Auth 자연 만료·무효화는 억제하지 않는다.

| 미룬 항목 | 나중에 하면 더 비싼가 | 처리 |
|---|---|---|
| wire 필드 `ProviderGateState.dailyRelogin` | **예 — main→renderer 계약** | **지금 확정** (`string[]`, 필수) |
| 입력 중 초안 보존 | 아니오 — renderer 내부 | 후속 handoff 후보(§17) |
| 경계 기준 시간대 설정 | 아니오 — 판정 함수 인자 하나 | 요청 시 후속 |

## 7. V1 Requirements / Acceptance — `R ↔ AT` (기준선 기록)

AC1·AC5는 §7-B의 ΔV1 행으로 대체한다. 나머지 AC 13개는 그대로 유효하다.

| R | AT / AC | 동작 기준 | 검증 수단 — 무엇을 단언하는가 | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01 | AT-01 / AC1 | 게이트가 통과된 상태(멤버 전원 valid+verified)에서 로컬 날짜가 바뀌면 `gate.state()` 가 `passed:false`·`dailyRelogin=[멤버 id…]`(멤버 순서)이고 `pushConnectionState` 가 정확히 1회 불린다 | IT: `startDailyGate` + 실제 `createGate` + fake `BoundAuth` 2개 + push spy + 가짜 시계/타이머 — 자정 직후 타이머 발화 | 타이머/wake → `createDayBoundary.check` → `lapseDay` → `pushConnectionState` → `broadcastProviderState` |
| R-01 | AT-02 / AC2 | 그 state 를 받은 renderer 는 로그인 화면이다 | 기존 `rootFrame.test.ts` 규칙(`!gate.passed → 'gate'`)에 `dailyRelogin` 포함 fixture 1건 추가 | `useProviderGate` → `rootFrame` → `GateFrame` |
| R-02 | AT-03 / AC3 | 경계 뒤 멤버가 로그인 커밋(revision+1, valid, verified)하면 그 멤버가 `dailyRelogin` 에서 빠지고 전원이 빠지면 `passed:true` 다. 자동 refresh로 revision만 증가하면 목록과 차단은 유지한다. 첫 멤버만 다시 로그인하면 `passed:false`·`dailyRelogin=[둘째]` 이고 로그인 화면 현재 단계는 둘째 멤버다 | UT `createGate`(fake snapshot revision 증가 + `noteLoginCommit` 호출; refresh는 snapshot만 증가) + 실제 Auth refresh/로그인 이벤트와 app 조립 IT + UT `currentGateProvider(providers, dailyRelogin)` + `GateLogin` SSR 체인 문구 `2단계 중 2단계` | 로그인 IPC → `put` → change → push → `GateLogin` |
| R-02 | AT-04 / AC4 | 현재 단계 멤버가 `dailyRelogin` 에 있고 `status='valid'` 면 안내 `gate.dailyRelogin` 1줄이 보이고, `status≠valid`(만료 등)이거나 목록 밖이면 안 보인다 | `GateLogin` SSR 3케이스 | 동일 |
| R-03 | AT-05 / AC5 | 경계는 Auth 를 바꾸지 않는다 — `login`·`reauth`·`revoke`·`resume`·`refresh`·`request` 호출 0, 경계 전후 snapshot(status·verified·credentialRevision) 동일, push 외 부수효과 0 | IT: 위 메서드가 호출되면 던지는 fake Auth/BoundAuth 로 경계 실행 + snapshot 비교 | `lapseDay` 는 `snapshot()` 만 읽는다 |
| R-03 | AT-06 / AC6 | 게이트가 떠 있는 동안 끝난 턴(`turn.ended`)과 응답 요청(`permission.requested`)도 nav 표시를 만든다. 재통과 뒤 현재 경로 세션은 열람으로 해제된다. 0254 생성 중 집합도 게이트 동안 갱신되며 재통과 후 현재 턴 상태를 표시한다 | IT: `useSessionAttentionSubscription` 이 설치한 구독 + `setViewedSession(null)`(메인 셸 정리 상태) → 이벤트 → 표시 / 이후 `setViewedSession('s')` → 해제. 구조 단언: `RootGate.tsx` 가 `useSessionAttentionSubscription()` 호출, `useSessionCompletion` 몸체에 `subscribeSessionAttention` 없음 | `RootGate` effect → `subscribeSessionAttention` → `sessionsActions.mark*` |
| R-04 | AT-07 / AC7 | 앱 시작은 현행이다 — 새 `createGate` 는 표식이 없어 부팅 확인 통과 시 `passed:true`·`dailyRelogin=[]` 다. 표식은 파일·설정·DB 에 쓰지 않는다 | UT `createGate` 초기 / `rg` 로 `dailyRelogin`·표식 식별자가 `settings`·persist 경로에 0건 | 부팅 → `createAuthResume.run` → 기존 경로 |
| R-01 | AT-08 / AC8 | 날짜 감지: `localDayKey`·`msUntilNextLocalMidnight` 이 로컬 시각 기준이다(23:59:59.999 → 1ms, 00:00:00.000 → 다음 로컬 자정(일반 날짜 24h, DST 전환일은 23h/25h), 월말·연말 넘김). `createDayBoundary` 는 start 직후 콜백 0, 같은 날 `check` N회 → 0, 자정 넘김 → 1, 이틀 점프 → 1, 시계 역행 → 1, 조기 발화(23:59:59.5) → 0 이며 재예약, `dispose` 뒤 0, 살아 있는 타이머는 항상 1개 이하다 | UT(가짜 `now`·`setTimer`·`clearTimer`, 로컬 생성자 `new Date(y,m,d,h,…)` 로 시각 구성) | 순수 |
| R-01 | AT-09 / AC9 | 배선: `bootstrap.ts` 가 `startDailyGate` 를 정확히 1회 부르고 `powerMonitor` `resume`·`unlock-screen`, `app` `browser-window-focus` 가 `check` 로 이어지며 `shutdown()` 이 dispose 한다. `startDailyGate` 는 wake 콜백으로 날짜가 바뀌었을 때만 lapse+push 한다 | IT `startDailyGate`(가짜 wake 원천) + 소스 가드 테스트(`bootstrap.ts` 원문: 호출 1 · 이벤트 3 · dispose 1) | 실제 electron 이벤트 → `check` |
| R-05 | AT-10 / AC10 | bypass ON 이거나 게이트 미요구(prod 선언 0)면 경계 뒤에도 `passed` 가 그대로이고 `dailyRelogin=[]` 다. DEV 선언 0(`alwaysRequired`)은 bypass 없이 계속 차단이다 | UT `evaluateGate`·`createGate` 표 | 기존 진리표 분기 |
| R-02 | AT-11 / AC11 | 경계 시점에 `verified=false` 이던 멤버는 같은 revision 의 확인 성공(부팅 probe)으로 통과한다. 경계 시점 `expired`/`none` 멤버는 로그인 커밋으로 통과한다 | UT `dailyReloginRequired(mark, snapshot, lastLoginRevision)` 표 | 순수 |
| R-01 | AT-12 / AC12 | 재통과 뒤 다음 날짜 경계가 오면 다시 해제된다(표식 갱신) | UT `createGate`: lapse → 커밋 → pass → lapse → `passed:false` | 동일 |
| R-07 | AT-13 / AC13 | 문서: `auth.md §5` 표에 날짜 경계 행 + `§5.3` 현재 규칙 · `IPC_CONTRACT.md` `orca:provider:state` 에 `dailyRelogin` · ADR-008(문제·선택지·결정·포기·불변식) · `decisions/README.md` 목록 · `docs/INDEX.md` 라우팅 · 폐쇄망 가이드 §2 한 줄 · `docs/arch/frontend/state.md` 구독 위치 | `node scripts/check-doc-inventory.mjs --check` + 앵커 `rg` | 문서 |
| 전체 | AT-14 / AC14 | 게이트: lint 0 error · typecheck 3종 0 · 관련 vitest green · inventory · trailer 파싱 · `no-stray-auth-subscribe.test.ts` green | 명령 산출 | §7-A 운영 gate |
| R-06 | AT-15 / AC15 | 실기(게이트 선언이 있는 폐쇄망 빌드): ① 시스템 시계를 23:59:30 으로 → 자정 경과 → 로그인 화면+안내 → [로그인] → 메인 화면 같은 경로 ② 자정을 넘기는 턴 → 재로그인 뒤 결과와 nav 표시 ③ 절전 후 다음 날 깨우기 → 로그인 화면 ④ 시계를 다음 날로 바꾼 뒤 창 포커스 → 로그인 화면 | 사람 실기(§19) | Electron |

### AC 검증 주의사항

- 기존 테스트 재사용(실재 확인): `gate.test.ts` 의 `evaluateGate` 표(12 `bypassed:` 단언)·`rootFrame.test.ts` 완전 fixture 1건(별도 bypass override 1건은 Partial)·`connection-views.test.ts` 3건·`providers.test.ts` 1건·`login-free-deployment.test.ts` 1건은 `ProviderGateState` 리터럴을 쓴다 — 필드 추가로 `dailyRelogin: []` 를 넣는다(의미 불변).
- N회 기준: AC1 의 push 1회 — sink(`pushConnectionState`)의 production 호출부는 change 핸들러·부팅 복원·runtime catalog·`startDailyGate` 다. 단언 범위는 `startDailyGate` 가 스스로 내는 호출로 좁힌다(fake Auth 는 change 를 내지 않는다).
- 사람 실기 항목: 실제 electron `powerMonitor`·OS 시계·SSO 창만 남긴다. 날짜 계산·판정·체인 선택·배선은 테스트로 내렸다.
- 시간대: 테스트는 로컬 생성자로 시각을 만들어 실행 머신 시간대와 무관하게 성립시킨다.

## 7-A. V1 / Trace Matrix (기준선 기록)

아래 registry는 공유 설계 커밋의 V1이다. 현재 유효 V는 §7-B의 supersession을 적용해 재구성한다.

- V mode 판정: 상속할 V 가 없다. 게이트 진리표(0181/0188)·부팅 대기(0194)·nav 주의 표시(0249)는 `INHERITED` 회귀로 둔다.
- 기준 V 상속 근거: 없음. INHERITED 출처 = `origin/main@5e1e9209` 의 코드·테스트.
- `SUPERSEDED` 로 분해한 pair: 해당 없음.
- 변경이 시작되는 수준: Baseline 이라 해당 없음.

### Node registry

| Node | 레벨 | 계약 / 본문 절 | provenance | 기준선 출처 / 대체 node |
|---|---|---|---|---|
| R-01 | R | §7 경계 해제·즉시 표시·반복(AC1·AC2·AC8·AC9·AC12) | NEW | — |
| R-02 | R | §7 재통과·체인·안내·미확인 경계(AC3·AC4·AC11) | NEW | — |
| R-03 | R | §7 Auth 불변·nav 표시 유지(AC5·AC6) | NEW | — |
| R-04 | R | §7 앱 시작 현행(AC7) | NEW | — |
| R-05 | R | §7 bypass·미요구 면제(AC10) | NEW | — |
| R-06 | R | §7 실기(AC15) | NEW | — |
| R-07 | R | §7 문서(AC13) | NEW | — |
| R-G | R | 게이트 진리표 — valid+verified 전원·fail-closed·DEV 차단 | INHERITED | `features/gate/index.ts:9-20` · `gate.test.ts` |
| R-B | R | 부팅 복원·대기 화면(0194) | INHERITED | `auth-resume.ts` · `auth-resume.test.ts` · `rootFrame.test.ts` |
| R-0249 | R | nav 완료·응답대기 표시 | INHERITED | `useSessionCompletion.test.ts` 'r5'·'0249' describe |
| AR-AUTH | AR | 기존 Auth 구독 단일 설치 | INHERITED | `no-stray-auth-subscribe.test.ts` |
| IT-AUTH | IT | Auth 구독·주입 가드 | INHERITED | 같은 테스트 |
| AT-01~AT-15 | AT | §7 검증 수단 칸 | NEW | — |
| AT-G·AT-B·AT-0249 | AT | VP-15~VP-17 기존 행동 증거 | INHERITED | 해당 pair의 기존 테스트 |
| SD-01 | SD | §5 상태와 전이 — 경계 → 해제 → 로그인 → 통과 → 다음 경계 | NEW | — |
| ST-01 | ST | §11 IT 시퀀스 | NEW | — |
| AR-01 | AR | §10 main 배선 `startDailyGate`·wake 3종·dispose | NEW | — |
| AR-02 | AR | §10 wire `dailyRelogin` main → renderer | NEW | — |
| AR-04 | AR | §11 로그인과 자동 refresh 원인 구분·기존 구독 순서 | NEW | — |
| IT-04 | IT | 실제 Auth → 기존 app change handler → gate 판정 | NEW | — |
| R-0254 | R | 0254 생성 중 투영의 수명 | INHERITED | `0254-nav-session-progress-spinner/plan.md` V1 (선행 설계 커밋은 INDEX) |
| AT-0254 | AT | 0254 AC1·AC8·VP-06 회귀 | INHERITED | 선행 구현 테스트 |
| AR-03 | AR | §10 주의 표시 구독 위치 | CHANGED | `AppLayout.tsx:32` → `RootGate` |
| IT-01~IT-03 | IT | §11 | NEW | — |
| MD-01 | MD | §10 날짜 계산·`createDayBoundary` | NEW | — |
| MD-02 | MD | §10 일일 표식·`dailyReloginRequired`·`evaluateGate` | NEW | — |
| MD-03 | MD | §10 `currentGateProvider`·안내 조건 | NEW | — |
| UT-01~UT-03 | UT | §11 | NEW | — |

### Pair registry

| Pair | left ↔ right | requiredness | production path `start → edges → end` | 직접 evidence oracle | 선택적 적대 증거 | §10 강제 지점 전수 |
|---|---|---|---|---|---|---|
| VP-01 | R-01 ↔ AT-01·02·08·09·12 | REQUIRED | 타이머 → `check` → `onDayChanged` → `lapseDay` → `pushConnectionState` → `connectionState(gate.state())` | AC1 state·push 1·AC2·AC8·AC9·AC12 | required — 배선 불변식. M1: `onDayChanged` 에서 push 제거 · M2: `lapseDay` 호출 제거 | EP-01 (1) · EP-04 (10) · EP-05 (2) · EP-06 (자리 a~e) |
| VP-02 | R-02 ↔ AT-03·04·11 | REQUIRED | 로그인 커밋 → 원인 구분 → `noteLoginCommit` → `state()` → push → `GateLogin` | AC3·AC4·AC11 | required — M3: 로그인 revision 비교를 `>=`로 · M4: `!mark.verified` 분기 제거 · M5: `GateLogin` 을 옛 규칙(`status≠valid`)으로 · M6: 안내를 status 무관하게 | EP-02 (3) · EP-06 (자리 f·g) · EP-09 (2) · EP-10 (5) |
| VP-03 | R-03 ↔ AT-05·06 | REQUIRED | `lapseDay` → `BoundAuth.snapshot()` 만 · 구독 `RootGate` | AC5 호출 0 · AC6 표시 | required — 0건 성질. M7: `lapseDay` 안에서 `revoke`/`resume` 호출 → fake 가 던짐 · M8: 구독을 `AppLayout` 으로 되돌림 → 구조 단언 red | EP-01 (1) · EP-07 (2) |
| VP-04 | R-04 ↔ AT-07 | REQUIRED | 부팅 → 새 `createGate` → 기존 통과 | AC7 | not selected — 직접 oracle | 0 + 이유: 부팅 경로 무변경, 표식 생성 자리는 EP-01 하나 |
| VP-05 | R-05 ↔ AT-10 | REQUIRED | `evaluateGate` 앞선 분기 | AC10 표 | required — M9: bypass 조기 반환을 제거해 경계 표식이 우회를 막게 함 | EP-03 (2) |
| VP-06 | R-06 ↔ AT-15 | REQUIRED | Electron | §19 결과 | not selected — 실기 | 0 + 이유: 실기 |
| VP-07 | R-07 ↔ AT-13 | REQUIRED | 문서 | AC13 inventory·앵커 | not selected | EP-08 (7) |
| VP-08 | SD-01 ↔ ST-01 | REQUIRED | VP-01 → VP-02 → 다음 경계(VP-01) 한 시퀀스 | state 열 `[passed, lapsed(2), lapsed(1), passed, lapsed(2)]` | VP-01·VP-02 변이 공유 | EP-01 · EP-02 · EP-05 |
| VP-09 | AR-01 ↔ IT-01 | REQUIRED | `bootstrap.start` → `startDailyGate` → wake 구독 · `shutdown` → dispose | AC9 IT + 소스 가드 | required — M10: wake 이벤트 1종 제거(자리마다 3) · M11a: shutdown dispose 제거 · M11b/c/d: wake off 3종 각각 제거 · M12: bootstrap startDailyGate 호출 제거 | EP-04 (10) |
| VP-10 | AR-02 ↔ IT-02 | REQUIRED | `evaluateGate` → `ProviderGateState` → IPC → `useProviderGate` → `RootGate` → `GateFrame` → `GateLogin` | AC3·AC4 SSR + 타입 | VP-02 M5·M6 공유 | EP-06 (7) · EP-09 (2) |
| VP-11 | AR-03 ↔ IT-03 | REQUIRED | `RootGate` → `useSessionAttentionSubscription` → `subscribeSessionAttention` | AC6 | VP-03 M8 공유 | EP-07 (2) |
| VP-12 | MD-01 ↔ UT-01 | REQUIRED | 순수 | AC8 표 | required — M13: `!==` 를 `>` 로(역행 red) · M14: check 뒤 재예약 제거 · M15: start 에서 콜백 | EP-04 (자리 a·b) |
| VP-13 | MD-02 ↔ UT-02 | REQUIRED | 순수 + `createGate` | AC3·AC10·AC11·AC12 | VP-02 M3·M4 · VP-05 M9 공유 | EP-01 · EP-02 · EP-03 |
| VP-14 | MD-03 ↔ UT-03 | REQUIRED | 순수 | AC3·AC4 | VP-02 M5·M6 공유 | EP-06 (자리 f·g) |
| VP-15 | R-G ↔ AT-G | REGRESSION | 기존 진리표 | 기존 케이스 green(필드 추가만) | not selected | 0 + 이유: 분기 순서 불변, 결과 필드 1 추가 |
| VP-16 | R-B ↔ AT-B | REGRESSION | 부팅 복원·대기 화면 | 기존 케이스 green | not selected | 0 + 이유: `auth-resume.ts` 무변경 |
| VP-17 | R-0249 ↔ AT-0249 | REGRESSION | 0249 리스너 경로 | 기존 케이스 green + 구조 단언 갱신 | not selected | EP-07 과 공유 |
| VP-18 | AR-AUTH ↔ IT-AUTH | REGRESSION | `no-stray-auth-subscribe.test.ts` | green — 새 `auth.subscribe` 0 | not selected | 0 + 이유: 구독 추가 없음 |
| VP-19 | AR-04 ↔ IT-04 | REQUIRED | 실제 `LoginService.refresh`/login → `onSnapshot` → 기존 `createRuntimeModelAuthChangeHandler` → `noteLoginCommit` → push 시 `gate.state()` | AC3: refresh는 차단 유지·login만 해제; refresh도 기존 Plugin/Harness 무효화 유지 | M16: refresh 원인을 다시 `credential-committed`로 · M17: `recordGateLogin` 호출 제거 · M18: 기록을 push 뒤로 이동 · M19: bootstrap 포트 배선 제거 | EP-10 (5) · EP-02 (3) |
| VP-20 | R-0254 ↔ AT-0254 | REGRESSION | RootGate 구독 → 게이트 동안 chat 변경 → 재통과 → SessionRow | AC6: 게이트 동안 생성 시작·종료가 집합에 반영되고, 재통과 시 현재 상태 표시; 0254 관련 테스트 green | not selected — 직접 oracle; VP-11 M8 공유 | EP-07 (2) |

`§10 강제 지점 전수`의 N 은 자리 수다.

### 현재 변경의 운영 gate

| Gate | 이번 변경 산출물에 적용되는 이유 | 증거 / 명령 | 실패 범위 |
|---|---|---|---|
| app lint · typecheck | `app/**` 수정(main·renderer·shared) | `cd app && npm run lint && npm run typecheck` | 이번 변경이 낸 error 만 blocking |
| 관련 vitest(비-DB) | 수정 모듈 | §19 목록 | 같음 |
| doc inventory | 문서 7곳 | `node scripts/check-doc-inventory.mjs --check` | 같음 |
| message-bus | 커밋 trailer | `git log -1 --format='%(trailers:only=true)'` | 파싱 0건이면 blocking |

---

## 7-B. ΔV1 — 자연 만료 계약 정정 (2026-10-07)

**사용자 승인으로 PLAN_GAP을 정정한다.** 기존 실제 Auth는 snapshot을 읽을 때 자연 만료를 정착시킨다.
자정과 만료가 겹친 반례에서 snapshot valid/true/rev0 → expired/false/rev1, 저장·Plugin sync·Harness invalidate 각각 1, 직접 정책 방송 1·전체 방송 2를 관측했다([원문과 재현](natural-expiry-probe.md)).
기준선은 메타의 공유 설계 커밋이며 아래 행이 V1의 충돌하는 AC·node·pair·§10 행보다 우선한다. 제품 범위·생산 알고리즘·EP 자리 수는 확장하지 않는다.

### 현재 Acceptance Criteria — 대체 행

| R | AT / AC | 동작 기준 | 검증 수단 — 직접 oracle | 프로덕션 도달 경로 |
|---|---|---|---|---|
| R-01-D1 | AT-01-D1 / AC1 | 날짜 경계에서 `passed:false`·멤버 순서의 `dailyRelogin`으로 정착하며 **일일 정책이 직접 내는** `pushConnectionState`는 1회다. 기존 Auth의 추가 방송은 별도 집계한다 | 기존 DG 시퀀스 + 실제 Auth 만료 통합: policyPushes=1, 전체 방송=2, 마지막 state 차단·['gate']. snapshot의 재진입 방송 [] → 마지막 ['gate']와 순서 로그를 직접 단언 | 타이머/wake → check → lapseDay(snapshot 자연 만료 가능) → 정책 push; 기존 expired → change handler → 별도 push |
| R-03-D1 | AT-05-D1 / AC5 | 일일 정책의 `login`·`reauth`·`revoke`·`resume`·`refresh`·`request` 직접 호출은 0이다. 유효기간이 남은 snapshot과 연결은 유지한다. 자연 만료는 기존대로 expired/verified=false/revision+1로 한 번 정착하고 기존 저장·Plugin/Harness 무효화를 실행한다 | 던지는 fake Auth로 직접 mutator 0·유효 snapshot 동일. 실제 Auth 만료 통합으로 expired 이벤트1·credentialChanged=true·revision+1·저장1·sync1·invalidate1 및 서버/authorize 포트 호출0을 직접 단언 | lapseDay → BoundAuth.snapshot → runtime.snapshot → settleExpiry → expired publish → 기존 handler; 새 Auth 구독 없음 |

상태표 보완: 날짜 경계와 grant 만료가 겹치면 기존 자연 만료 정착·방송 후 표식 기록·정책 방송이 이어진다.
최종 화면은 만료 상태의 기존 로그인 화면이며 valid 전용 날짜 안내는 보이지 않는다(기존 AC4). 날짜 정책이 자연 만료를 유발하는 별도 mutator를 호출하지 않는다.

### Node delta / supersession

| Node | 레벨 | provenance | 기준선 / 대체 및 계약 |
|---|---|---|---|
| R-01·R-03·SD-01 | R·R·SD | SUPERSEDED | 각각 R-01-D1·R-03-D1·SD-01-D1로 대체 |
| AT-01·AT-05·ST-01 | AT·AT·ST | SUPERSEDED | 각각 AT-01-D1·AT-05-D1·ST-01-D1로 대체; 나머지 AT 유지 |
| R-01-D1 / AT-01-D1 | R / AT | CHANGED | AC1 직접 정책 방송·최종 정착; AC2·8·9·12 승계 |
| R-03-D1 / AT-05-D1 | R / AT | CHANGED | AC5 직접 변경 없음·기존 자연 만료 유지; AC6 승계 |
| SD-01-D1 / ST-01-D1 | SD / ST | CHANGED | 기존 경계→로그인→다음 경계 시퀀스 + 동시 자연 만료→재진입 방송→최종 차단 |
| AR-EXP | AR | INHERITED | V1 기준 코드의 runtime.snapshot→expired publish→기존 app handler→방송·Plugin/Harness 무효화 |
| IT-EXP | IT | NEW | 실제 AuthRuntime·createGate·startDailyGate·기존 handler 통합의 직접 만료 관측 |
| MD-EXP / UT-EXP | MD / UT | INHERITED | V1 기준 runtime/store 자연 만료 1회 정착; runtime.test.ts `시계 기반 만료의 1회 정착 (r3)` 4케이스 |

### Pair delta / 증거 이관

| Pair | V node | requiredness | start → edges → end / 직접 oracle | 선택 적대 증거 | §10 자리 |
|---|---|---|---|---|---|
| VP-01-D1 (VP-01 대체) | R-01-D1 ↔ AT-01-D1·02·08·09·12 | REQUIRED | 기존 VP-01 경로·AC 전부 승계 + 실제 만료에서 직접 정책1/전체2/최종차단 관측 | 기존 M1·M2 전부 승계 | EP-01·04·05·06(a~e) |
| VP-03-D1 (VP-03 대체) | R-03-D1 ↔ AT-05-D1·06 | REQUIRED | lapseDay→snapshot→기존 만료/handler; 직접 mutator0·유효 snapshot 유지·만료 소비자 정착 + RootGate 표시 | 기존 M7 revoke/resume·M8 전부 승계 | EP-01·07; 만료 기존 경로는 VP-21 |
| VP-08-D1 (VP-08 대체) | SD-01-D1 ↔ ST-01-D1 | REQUIRED | 기존 `[passed,lapsed(2),lapsed(1),passed,lapsed(2)]` + 실제 만료 시 []→['gate'] 방송·최종차단 | 기존 VP-01·02 변이 전부 승계 | EP-01·02·05 |
| VP-21 | AR-EXP ↔ IT-EXP | REGRESSION | 실제 Auth snapshot→settleExpiry→expired 이벤트1→기존 handler→저장/sync/invalidate 각1·Auth방송1→정책방송1 | not selected — 직접 상태·이벤트·호출·순서 oracle | EP-01·05; 기존 runtime/store/handler 경로 추가 구현 없음 |
| VP-22 | MD-EXP ↔ UT-EXP | REGRESSION | 기존 runtime의 snapshot 반복/요청 만료 관측→revision 1회 정착·verified 해제·credentialChanged=true | not selected — 기존 4케이스의 직접 oracle | 기존 Auth 내부 정착 경로 무변경; EP-01로 새 소비 경로 도달 |

- 증거 이관: superseded VP-01·03·08의 AC·선택 변이는 각각 대체 pair로 모두 승계한다. 폐기 증거 0.
- 유효 pair: V1 20 − 대체 3 + ΔV1 5 = **22 (REQUIRED 15·REGRESSION 7)**. 나머지 V1 17 pair는 원래 requiredness와 증거가 유효하다.
- 유효 AC는 **15개**다. 변경 AC1·5의 행동·검증·production 도달 경로를 위 표에서 다시 닫았으며 사람 실기는 기존 AC15뿐이다.

### §10 강제 지점 정정 / 테스트 설계

| 대체 행 | 현재 계약 / 실패 의미 | 자리·직접 관측 |
|---|---|---|
| EP-01 (V1 행 대체) | lapseDay는 snapshot의 revision·verified로 표식을 기록하며 Auth mutator를 직접 호출하지 않는다. snapshot의 기존 자연 만료는 유지한다. mutator 직접 호출 또는 만료 정착 억제는 D-012 위반 | 기존 자리1 유지; fake 직접호출0 + 실제 만료 상태/이벤트/저장/무효화 |
| EP-05 (V1 행 대체) | onDayChanged의 직접 순서는 lapseDay → 정책 push 1이다. lapseDay 안의 자연 만료 Auth 방송은 별도이고 최종 정책 방송에 표식이 반영된다 | 기존 자리2 유지; policyPushes1·전체2·순서·최종state |

- §10 나머지 8행 불변. EP 분모 **10행·41자리**를 유지하며 기존 Auth 내부는 회귀 경로로 추적한다.
- §11·§18 보완: `app/src/main/app/daily-gate.expiry.test.ts` 신규 1케이스를 VP-01-D1·03-D1·08-D1·21에 연결한다. `runtime.test.ts` 기존 자연 만료 4케이스는 VP-22다.
- §19 관련 Vitest 필터에 `src/main/app/daily-gate.expiry.test.ts`를 추가한다. 문서·정적 gate와 실제 OS/SSO 실기는 기존대로다.
- `natural-expiry-probe.md`는 충돌의 원문 증거이며 영구 통과 회귀는 신규 expiry 테스트다. 의도적으로 실패하는 반례를 전체 앱 테스트에 포함하지 않는다.

### ΔV1 READY self-review / 관측

- `git cat-file -t ba2c3eeb3e00d9126c4d80356823f2160d200f00` = commit. 공유 V1 기준선을 잠갔다.
- ACTIVE 결정↔AC: D-012↔AC1·5, D-001/005/006↔AC1·8·9, 나머지 D-003~011↔기존 AC 일치. D-002는 superseded이며 기존 절의 절대 불변 표현은 이 delta가 대체한다.
- 변경 R·SD 각각 같은 레벨 REQUIRED 대체 pair, 영향받는 기존 Auth AR·MD REGRESSION 2 pair를 선택했다. production 경로·직접 oracle·EP1/2자리 정정과 모든 이전 선택 변이의 이관을 표에서 확인했다.
- 두 바뀐 AC에 동작 기준·직접 단언·production 경로가 있고, 최종 방송과 직접 방송의 관측 주체를 구분한다. 공개 wire·저장 포맷·신규 의존성·부팅 정책 변경 0.
- 정정 설계는 구현 산출과 별도 커밋한다. READY/다음 Codex 상태를 plan 메타와 INDEX에 함께 반영한다.

# Part II — Technical Design

V1 설계의 EP-01·EP-05·자연 만료 관련 절대 불변 표현은 §7-B의 ΔV1을 적용한다. 나머지 경로·알고리즘·수명주기 설계는 유지한다.

## 8. Research — 현재 코드와 계약

| # | 발견 / 제약 | 근거 |
|---|---|---|
| F-01 | 게이트 판정은 순수 `evaluateGate` + 멤버 snapshot 을 읽는 `createGate` 다. 분기 순서: 미요구 → bypass → 전원 valid+verified | `features/gate/index.ts:67-90` · `:112-131` |
| F-02 | `Gate` 소비처는 `connectionState` 하나다 | `connection-views.ts:101` · `rg "gate.state()"` 1건 |
| F-03 | 게이트 state 는 `pushConnectionState` 로 방송되고 invoke 첫 스냅샷과 같은 함수다 | `bootstrap.ts:478-480` · `handlers/providers.ts:50-52` |
| F-04 | Auth change 구독은 `runtime-model-startup.ts` 단일 설치이고 가드 테스트가 강제한다 | `runtime-model-startup.ts:113-125` · `no-stray-auth-subscribe.test.ts:126-128` |
| F-05 | 가드의 주입 키 규칙: `snapshotOf`·`reconcileVerified`·`reconcile`·`bridge`·`invalidateForAuth`·`onChange` 는 허용 형태만 | `no-stray-auth-subscribe.test.ts:27-67` |
| F-06 | `login`은 grant 상태와 무관하게 방식을 실행한다. `put`은 revision을 올리지만 OAuth refresh도 같은 `settleGrant`를 사용하므로 revision만으로 로그인 여부를 판정할 수 없다 | `login.ts:455-484` · `store.ts:248-258` |
| F-07 | `verified` 의 진입점은 `put` 과 부팅 `resume` 둘뿐이다 | `store.ts:225-235` 주석 · `rg "'verified'" features/auth` 1건 |
| F-08 | 만료·해제도 revision 을 올리지만 status 가 valid 가 아니다 | `store.ts:300-307` · `:393-399` |
| F-09 | 부팅: 게이트 멤버를 `resume`(probe)으로 순차 확인 → 성공 시 통과 | `auth-resume.ts:239-244` |
| F-10 | renderer 최상위: `bootPhase`·`gate`·`resuming` → `rootFrame` → 프레임 하나 | `rootFrame.ts:34-40` · `RootGate.tsx:24-52` |
| F-11 | chat 이벤트 수신은 `ChatProvider`(게이트 위)라 게이트 동안에도 유지된다 | `App.tsx:19-22` · `chatStore.ts:1905` |
| F-12 | 주의 표시 구독과 열람 세션 설정은 `AppLayout` 의 `useSessionCompletion` 하나에 있다 | `AppLayout.tsx:32` · `useSessionCompletion.ts:15-21` |
| F-13 | 로그인 화면 현재 단계 = 첫 `status !== 'valid'` 멤버, 없으면 첫 멤버 | `GateLogin.tsx:42` |
| F-14 | `ProviderGateState` = `{ required, passed, bypassed }` | `shared/ipc.ts:1824-1829` |
| F-15 | 리터럴 사용처: `gate.test.ts` 12 · `connection-views.test.ts` 3 · `rootFrame.test.ts` 완전 fixture 1 + Partial override 1 · `providers.test.ts` 1 · `login-free-deployment.test.ts` 1 | `rg "bypassed:" --glob '*.test.ts'` |
| F-16 | main 에 `powerMonitor` 사용처 0 — 신규 | `rg powerMonitor app/src/main` 0건 |
| F-17 | 종료 정리는 `Bootstrap.shutdown()`(index.ts `will-quit`) | `bootstrap.ts:865-901` · `index.ts:335` |
| F-18 | 메인 셸이 언마운트되면 Composer 초안(컴포넌트 state)이 사라진다 | `ComposerInputController.tsx:104` |
| F-19 (ΔV1) | `AuthRuntime.snapshot()`은 `settleExpiry`를 실행하며 최초 자연 만료에서 verified 해제·revision+1·저장·expired publish가 발생한다. 기존 handler가 추가 방송·Plugin/Harness 무효화를 실행한다 | `runtime.ts:126`·`store.ts:393/429`·`runtime-model-startup.ts:102/106/107`; [실제 반례](natural-expiry-probe.md) |

### 전수 조사

| 대상 | 검색/방법 | N | 의미 |
|---|---|---:|---|
| `gate.state()` 소비처 | `rg "gate\.state\(\)" app/src/main --glob '!*.test.*'` | 1 | `connection-views.ts` — 새 필드는 그대로 실려 나간다 |
| `pushConnectionState` 호출부 | `rg "pushConnectionState\(" app/src/main --glob '!*.test.*'` | bootstrap 정의 + `auth-resume.ts` 2 + change 핸들러 1 + catalog `onChange` 주입 | AC1 단언은 `startDailyGate` 몫만 |
| `ProviderGateState` 리터럴(테스트) | F-15 | 완전 리터럴 18 + Partial override 1 | 필수 필드는 완전 리터럴에 추가; Partial override는 불필요 |
| `GateMember` 리터럴(테스트) | `rg "verified: (true\|false) }" gate.test.ts` | 다수 | `dailyReloginRequired` 필수 필드 추가 |
| renderer 게이트 소비 | `rg "useProviderGate\|GateLogin\|GateFrame" --glob '!*.test.*'` | RootGate·GateFrame·GateLogin | AR-02 경로 |
| 주의 표시 구독 설치 | `rg "subscribeSessionAttention" --glob '!*.test.*'` | 정의 1 + 설치 1 | 설치 자리 이동 |

### 수치 / 전칭 표현 검산

- "`verified` 진입점은 둘뿐": `store.ts` `markVerified` 주석 + `rg "markVerified\(" features/auth --glob '!*.test.*'` → `login.ts` resume 1곳 · `put` 내부.
- "구독 단일 설치": `no-stray-auth-subscribe.test.ts` 'installs Auth listeners in exactly one production file' 실재.
- 문서 앵커: `docs/arch/backend/auth.md §5`(375행) · `IPC_CONTRACT.md` `orca:provider:state` 행(481행) · `closed-network-extensions.md §2`(274행) · `docs/arch/frontend/state.md:44` 실재.

## 9. Architecture / Data & Control Flow — AS-IS → TO-BE

### AS-IS — 현재 구조와 문제 발생 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`
- 현재 책임 소유자: Auth(자격증명) · gate feature(판정) · bootstrap(방송) · renderer RootGate(프레임).
- 흐름: Auth change → push → `gate.state()` → renderer 프레임. 시각은 입력이 아니다.
- 문제의 직접 원인: 판정 입력에 날짜가 없고, 실행 중 재평가 계기가 Auth change 뿐이다.

```text
AuthChange ─▶ createRuntimeModelAuthChangeHandler ─▶ pushConnectionState
                                                     └▶ connectionState(gate.state())
                                                         └▶ renderer RootGate: passed ? AppLayout : GateFrame
```

### TO-BE — 변경 후 목표 구조와 동작 경로

- 관련 V node: `SD-01`, `AR-01`, `AR-02`, `AR-03`
- 변경 후 책임 소유자: 날짜 계산·감시 = gate feature(순수 `daily.ts`) · 일일 표식 = `createGate` · 배선 = app `startDailyGate` + bootstrap(electron 이벤트) · 단계 선택 = renderer `currentGateProvider` · 주의 표시 구독 = RootGate.
- 유지: Auth change 경로·부팅 복원·프레임 규칙(`rootFrame`)·0249 표시 규칙.

```text
setTimeout(next local midnight) ┐
powerMonitor resume / unlock-screen ├─▶ DayBoundary.check: localDayKey(now) !== day ?
app browser-window-focus        ┘        └▶ onDayChanged: gate.lapseDay() ; pushConnectionState()
gate.lapseDay(): marks[authId] = { revision, verified }   (snapshot 읽기만)
gate.state(): member.dailyReloginRequired = dailyReloginRequired(marks[authId], snapshot)
   → evaluateGate → { required, passed, bypassed, dailyRelogin }
renderer: rootFrame(!passed → 'gate') → GateFrame(dailyRelogin) → GateLogin
   current = currentGateProvider(providers, dailyRelogin) ; 안내 = dailyRelogin∋current ∧ status=valid
[로그인] → auth.login → put(revision+1) → AuthChange(committed) → noteLoginCommit → push → passed
RootGate: useSessionAttentionSubscription() (항상)   AppLayout: useSessionCompletion(viewed 만)
```

### AS-IS → TO-BE Delta

| 비교 축 | AS-IS | TO-BE | 변경 이유 | V / 구현·검증 연결 |
|---|---|---|---|---|
| 책임/소유권 | 게이트 = Auth 상태만 소비 | + 날짜 경계 표식(메모리) | D-001·D-002 | MD-02 / VP-13 · `features/gate` |
| data/control flow | 재평가 계기 = Auth change | + 날짜 경계(타이머·wake) | D-005 | AR-01 / VP-09 · `app/daily-gate.ts` |
| state/contract | `ProviderGateState` 3필드 | + `dailyRelogin: string[]` | D-009 | AR-02 / VP-10 · `shared/ipc.ts` |
| error/lifecycle | 게이트 동안 주의 표시 구독 해제 | 항상 설치 | D-008 | AR-03 / VP-11 |
| test seam/관측점 | 순수 판정 표 | + 가짜 시계·타이머·wake | AC8·AC9 | MD-01 / VP-12 |

### 핵심 책임 분리

| 모듈/레이어 | 책임 | 입력/출력 | 누가 import/호출 |
|---|---|---|---|
| `main/features/gate/daily.ts`(신규) | 날짜 키·자정까지 ms·표식 판정·`createDayBoundary` | 시각·snapshot → boolean / 감시 객체 | `features/gate/index.ts` · `app/daily-gate.ts` |
| `main/features/gate/index.ts` | 표식 저장·판정에 반영 | `DailyGate` | bootstrap · connection-views(`Gate`) |
| `main/app/daily-gate.ts`(신규) | 경계 → lapse + push 배선(electron 없음) | deps → `{ dispose }` | bootstrap |
| `main/app/bootstrap.ts` | electron wake 3종 연결·종료 정리 | — | index.ts |
| `shared/ipc.ts` | wire 필드 | — | main·renderer |
| `renderer/.../GateLogin.tsx` + lib | 현재 단계·안내 | providers·dailyRelogin | GateFrame |
| `renderer/src/app/RootGate.tsx` | 주의 표시 구독 설치 · `dailyRelogin` 전달 | — | App |

## 10. 계약 / 타입 / 강제 지점

| V node / pair | 계약/필드 | SSOT | 누가 | 언제 강제 | 실패 의미 |
|---|---|---|---|---|---|
| MD-02 / VP-01·VP-03 | **EP-01** `lapseDay()` 가 멤버마다 `{ revision: snapshot.credentialRevision, verified: snapshot.verified }` 를 기록하고 snapshot 외 Auth 메서드를 부르지 않는다 — 자리 1 | `createGate` | gate | 경계마다 | 표식이 없으면 해제가 없고, Auth 를 부르면 D-002 위반 |
| MD-02 / VP-02·VP-13 | **EP-02** `dailyReloginRequired(mark, s, loginRevision) = mark ≠ undefined ∧ ¬(s.status='valid' ∧ s.verified ∧ ((loginRevision ?? -1) > mark.revision ∨ ¬mark.verified))` — 자리 3: (a) `createGate.state` 멤버 매핑 (b) `evaluateGate.passed` 조건 (c) `evaluateGate.dailyRelogin` 목록 | `daily.ts` | gate | `state()` 마다 | (a) 누락 = 해제 없음 · (b) 누락 = 목록만 있고 통과 · (c) 누락 = 체인 정지 |
| R-05 / VP-05 | **EP-03** 미요구·bypass 분기는 `dailyRelogin: []` 로 일일 판정보다 먼저 반환 — 자리 2 | `evaluateGate` | gate | `state()` | DEV 우회·OSS 빌드가 매일 잠김 |
| AR-01 / VP-09·VP-12 | **EP-04** 경계 계기·정리 10자리: (a) start 첫 예약 (b) check 재예약 (c~e) resume·unlock-screen·focus 등록 (f) shutdown → dispose/타이머 해제 (g~i) 같은 이벤트 3종 해제 (j) bootstrap의 startDailyGate 호출 | `daily.ts` · `daily-gate.ts` · bootstrap | main | 부팅·wake·종료 | 한 자리 누락 = 해당 상황에서 해제가 하루 이상 늦음 / 종료 후 타이머 잔존 |
| AR-01 / VP-01 | **EP-05** `onDayChanged` = `gate.lapseDay()` → `pushConnectionState()` 순서 — 자리 2 | `daily-gate.ts` | app | 경계 | push 없으면 화면이 다음 Auth change 까지 그대로 |
| AR-02 / VP-10·VP-14 | **EP-06** `dailyRelogin` 운반 7자리: (a) `ProviderGateState` 타입 (b) `evaluateGate` 출력 (c) `connectionState` → IPC(무변경 운반) (d) `RootGate` → `GateFrame` prop (e) `GateFrame` → `GateLogin` prop (f) `currentGateProvider` (g) 안내 조건 | `shared/ipc.ts` | main·renderer | 렌더 | 체인 정지 또는 안내 오표시 |
| AR-03 / VP-11 | **EP-07** 주의 표시 구독: (a) `RootGate` 가 `useSessionAttentionSubscription()` 호출 (b) `useSessionCompletion` 은 열람 세션만 — 자리 2 | `useSessionCompletion.ts` | app | 마운트 | 게이트 동안 표시 소실 또는 이중 구독(0254 생성 중 투영 포함) |
| R-07 / VP-07 | **EP-08** 문서 7곳(§18 목록) | 문서 | 구현자 | 커밋 | 문서 드리프트 |
| R-02 / VP-02·VP-10 | **EP-09** i18n `gate.dailyRelogin` ko·en — 자리 2 | resources | renderer | 렌더 | 파리티 red |
| AR-04 / VP-19 | **EP-10** 로그인 증거 5자리: (a) Auth cause union (b) refresh의 settleGrant 원인 주입 (c) settleGrant의 onSnapshot 전달 (d) 기존 app change handler에서 push 이전 기록 (e) bootstrap의 gate.noteLoginCommit 포트 연결 | `contracts/auth.ts`·`login.ts`·`runtime-model-startup.ts`·bootstrap | Auth·app·gate | 성공 커밋 이벤트 | refresh의 자동 통과 또는 로그인 후 화면 정착 지연 |

- 같은 규칙이 여러 레이어에 있다면 SSOT와 공유 방법: 일일 판정은 `daily.ts` 의 `dailyReloginRequired` 하나. renderer 는 판정하지 않고 `dailyRelogin` 목록만 읽는다. `auth-resume.ts` 의 `gateOpen()`(부팅 대기 파생)은 일일 표식을 보지 않는다 — 부팅 복원 배치 시작 조건이라 의미가 다르다(§16).
- `실패 의미`에 "다른 게이트가 막는다"를 적은 행: 없음.
- 선택적 필드의 의미: `GateMember.dailyReloginRequired` 는 **필수 boolean**(누락이 fail-open 이 되지 않게). `ProviderGateState.dailyRelogin` 도 필수 배열.
- 외부 SDK 경계: electron `powerMonitor`(`resume`·`unlock-screen`)·`app`(`browser-window-focus`) 이벤트 — 인자 없이 `check()` 만 부른다.
- 가드 호환: 새 코드는 `auth.subscribe(`를 추가하지 않는다. 기존 `createRuntimeModelAuthChangeHandler`에 `recordGateLogin` 포트를 추가하며 F-05의 제한된 주입 키는 기존 형태로 유지한다(예: `onChange:` 대신 `onDayChanged:`).

## 11. 구현 설계

| 변경/신규 파일 | 책임 | 변경 내용 | 테스트 seam |
|---|---|---|---|
| `app/src/main/features/gate/daily.ts` (신규) | 순수 | `export interface DailyMark { readonly revision: number; readonly verified: boolean }` · `localDayKey(ms): string`(로컬 `getFullYear/getMonth/getDate`, zero-pad) · `msUntilNextLocalMidnight(ms): number`(`new Date(y, m, d + 1)` − ms) · `dailyReloginRequired(mark, s, loginRevision)`(EP-02 식) · `createDayBoundary({ now, setTimer, clearTimer, onDayChanged }): { start(); check(); dispose() }` — `day` 는 start 시 오늘, `check` 는 `!==` 이면 갱신 후 콜백, 매번 기존 타이머를 지우고 `Math.max(1, msUntilNextLocalMidnight(now()))` 로 재예약, dispose 뒤 no-op | UT |
| `app/src/main/features/gate/index.ts` | 판정 | `GateMember.dailyReloginRequired: boolean` 추가 · `evaluateGate` 반환에 `dailyRelogin`(미요구·bypass 는 `[]`, 그 외 `members.filter(m => m.dailyReloginRequired).map(m => m.authId)`) · `passed` 에 `!m.dailyReloginRequired` · `export interface DailyGate extends Gate { lapseDay(): void; noteLoginCommit(authId: string, revision: number): void }` · `createGate` 가 `Map<authId, DailyMark>`와 `Map<authId, number>`(로그인 커밋 revision)를 갖고 `DailyGate` 반환. 헤더 진리표 주석에 날짜 경계 행 추가 | UT |
| `app/src/main/app/daily-gate.ts` (신규) | 배선 | `startDailyGate({ gate: Pick<DailyGate,'lapseDay'>, pushConnectionState, now, setTimer, clearTimer, subscribeWake(check): () => void }): { dispose(): void }` — boundary 생성·start·`subscribeWake(boundary.check)`·dispose 는 구독 해제 + boundary dispose | IT |
| `app/src/main/app/bootstrap.ts` | 연결 | `pushConnectionState` 정의 뒤 `this.dailyGate = startDailyGate({ gate, pushConnectionState, now: Date.now, setTimer: (cb, ms) => setTimeout(cb, ms), clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>), subscribeWake: (check) => { powerMonitor.on('resume', check); powerMonitor.on('unlock-screen', check); app.on('browser-window-focus', check); return () => { …off 3종 } } })` · 필드 `private dailyGate?: { dispose(): void }` · `shutdown()` 첫머리 근처에서 `this.dailyGate?.dispose()` | 소스 가드 |
| `app/src/shared/ipc.ts` | wire | `ProviderGateState.dailyRelogin: string[]` + 주석(경계 뒤 다시 로그인해야 하는 게이트 멤버 id, 멤버 순서) | 타입 |
| `app/src/renderer/src/features/providers/lib/gateStep.ts` (신규) | 순수 | `currentGateProvider(providers, dailyRelogin): ProviderInfo \| undefined` · `showsDailyRelogin(current, dailyRelogin): boolean` | UT |
| `.../features/providers/components/GateLogin.tsx` | 그리기 | prop `dailyRelogin: readonly string[]` · `current` 를 `currentGateProvider` 로 · 안내 `<p className="mb-3 text-center text-[12.5px] text-ink2">{tr('gate.dailyRelogin')}</p>` 를 `showsDailyRelogin` 일 때(체인 문구 아래, 실패 문구 위) | SSR |
| `.../app/GateFrame.tsx` · `.../app/RootGate.tsx` | 전달·구독 | `GateFrame` prop `dailyRelogin` 전달 · `RootGate` 가 `gate.gate?.dailyRelogin ?? []` 전달 + 최상단에서 `useSessionAttentionSubscription()` | 구조 단언 |
| `.../app/hooks/useSessionCompletion.ts` | 구독 분리 | `export function useSessionAttentionSubscription(): void { useEffect(subscribeSessionAttention, []) }` · `useSessionCompletion` 은 열람 layout effect 만 | IT |
| `.../shared/i18n/resources/ko.ts`·`en.ts` | 문구 | `gate.dailyRelogin`: `'날짜가 바뀌어 다시 로그인해야 합니다.'` / `'A new day has started. Please sign in again.'` | 파리티 |
| 테스트 리터럴 5파일 | 계약 | `ProviderGateState` 에 `dailyRelogin: []` · `GateMember` 에 `dailyReloginRequired: false` | 기존 green |
| 문서 7곳 | §18 | §7 AC13 내용 | inventory |

### 로그인 증거 보완 — 사용자 결정③을 지키는 내부 설계

`credentialRevision`은 로그인 전용 카운터가 아니다. `LoginService.refresh()`도 `settleGrant()`를 거쳐 `credential-committed`를 내는 현재 경로를 구분한다. Auth에 게이트 정책을 넣거나 새 구독을 만들지 않는다.

| 파일/경계 | 변경 | 검증 |
|---|---|---|
| `main/contracts/auth.ts` | `AuthSnapshotChangeCause`에 `credential-refreshed` 추가(내부 main 계약, wire·영속 형상은 불변) | typecheck와 cause 소비처 전수 검색 |
| `main/features/auth/login.ts` | `settleGrant`에 커밋 원인 인자(default `credential-committed`)를 두고 refresh 호출만 `credential-refreshed`를 전달; 성공 `onSnapshot`은 그 원인 사용 | 실제 refresh 성공은 refreshed, begin/continue/reauth 성공은 committed; 실패·superseded는 성공 증거 없음 |
| `main/features/auth/runtime.ts` | `isCredentialEffective(cause !== 'verified')` 유지 — refresh도 실행 자격증명 변경이다 | 실제 runtime 이벤트의 `credentialChanged=true`; Plugin/Harness 무효화 회귀 |
| `main/app/runtime-model-startup.ts` | 기존 handler에 필수 `recordGateLogin(authId, revision)` 포트. snapshot + cause committed일 때 push보다 먼저 기록; step/verified/refreshed에는 호출하지 않음 | 순서 로그 `[gate, push, sync, invalidate, reconcile]`; refresh는 gate 없이 기존 4단계 |
| `main/app/bootstrap.ts` | 기존 factory 인자 `recordGateLogin: (id, revision) => gate.noteLoginCommit(id, revision)` | EP-10e source guard + M19 |
| `main/features/gate/index.ts` | `noteLoginCommit`은 멤버의 성공 로그인 revision만 메모리 Map에 보관. `lapseDay`의 기준은 현재 snapshot revision. snapshot valid+verified와 기록된 로그인 revision을 함께 읽음 | 경계 뒤 refresh만 증가하면 차단; 같은 revision/다른 멤버/실패/취소는 불통과; 실제 로그인 커밋 뒤 통과 |

기존 factory 호출부는 production bootstrap 1곳과 테스트 `runtime-model-startup.test.ts` 2곳·`deployment/login-free-deployment.test.ts` 1곳이다. 새 필수 포트의 테스트 fake도 함께 갱신한다. `no-stray-auth-subscribe.test.ts`의 제한 키를 바꾸지 않으며 구독 설치 파일은 그대로 유지한다.

### 신규·변경 테스트

| 파일 | pair | 내용 |
|---|---|---|
| `main/features/auth/login*.test.ts`·`runtime.test.ts` 및 `main/app/runtime-model-startup.test.ts` | VP-19 | 실제 refresh/login 원인 구분·gate 기록과 push 순서·Plugin/Harness 무효화; 테스트 파일명은 기존 책임별 배치 따름 |
| `main/features/gate/daily.test.ts` (신규) | VP-12·VP-13 | AC8 날짜·감시 표 · AC11 표식 판정 표 |
| `main/features/gate/gate.test.ts` | VP-13·VP-05·VP-15 | `createGate` lapse/커밋/체인/반복(AC3·AC12) · bypass·미요구·DEV(AC10) · 기존 표 필드 추가 |
| `main/app/daily-gate.test.ts` (신규) | VP-01·VP-03·VP-08·VP-09 | 실제 `createGate` + 던지는 fake Auth 메서드 + push spy + 가짜 시계·wake — AC1·AC5·시퀀스·dispose |
| `main/app/daily-gate.wiring.test.ts` (신규) | VP-09 | `bootstrap.ts` 원문: `startDailyGate(` 1 · `on`·`off` 호출의 `'resume'`·`'unlock-screen'`·`'browser-window-focus'` 각각 1쌍(문자열만 세면 각 2) · `dailyGate?.dispose()` 1 (`infra/source-scan` 의 스캐너, 문자열 리터럴은 원문에서 센다) |
| `renderer/.../features/providers/lib/gateStep.test.ts` (신규) | VP-14 | AC3 체인 · AC4 안내 3케이스 |
| `renderer/.../features/providers/components/GateLogin.render.test.ts` (신규) | VP-10 | SSR 체인 문구·안내 문구 존재/부재 |
| `renderer/.../app/rootFrame.test.ts` | VP-16 | `dailyRelogin` fixture 추가 |
| `renderer/.../app/hooks/useSessionCompletion.test.ts` | VP-11·VP-17 | AC6 IT + 구조 단언 갱신(RootGate에서 구독 설치·AppLayout의 useSessionCompletion 호출은 열람 설정용으로 유지) |

### 테스트 가능성

- electron 의존부와 분리할 별도 순수 파일: `features/gate/daily.ts` · `app/daily-gate.ts`(electron 미import — wake 원천을 주입받는다).
- 기존 메커니즘 재사용 시 형상/시점 적합성: push 는 기존 `pushConnectionState` 그대로 — invoke 첫 스냅샷과 같은 함수라 renderer 가 늦게 열려도 같은 값을 받는다(F-03).
- 순서를 관측할 훅: AC1 은 push spy 호출 시점의 `gate.state()` 를 기록해 lapse 가 push 보다 먼저임을 단언한다.

## 12. End-to-end 영향

### producer → consumer

```text
DayBoundary → gate.lapseDay → gate.state(dailyRelogin) → pushConnectionState → IPC → useProviderGate → RootGate → GateFrame → GateLogin
```

- producer 기준: 일일 판정은 main 의 `createGate` 하나.
- consumer 파생 규칙: renderer 는 `dailyRelogin` 소속과 기존 `status` 로 단계·안내만 고른다.
- 파생 가능한 합성값이 정본을 우회하지 않는가: renderer 가 시각으로 경계를 재계산하지 않는다.

### 부팅/등록/초기화 변경 시 기존 소비처

| 기존 소비처 | 값 증가/변경 시 영향 | 회귀 AC |
|---|---|---|
| `connectionState` invoke·push | 필드 1 추가 | AC14 · VP-15 |
| `rootFrame` | 입력 형상 동일(`passed` 만 봄) | VP-16 |
| 설정 화면 연결 목록(`ProviderInfo`) | 무변경 — 게이트 멤버는 계속 '연결됨' | AC5 |
| `auth-resume.ts` `gateOpen`·`resuming` | 무변경 — 일일 표식을 보지 않는다 | VP-16 |

## 13. Lifecycle / 오류 / 정리

- 생성/시작: `bootstrap.start()` 의 인증 스택 구성 직후 `startDailyGate` — `day` = 부팅 시각의 날짜, 표식 없음(D-004).
- 취소/중단: 경계는 취소할 대상이 없다. 로그인 취소는 기존 흐름.
- 종료/quit: `shutdown()` 이 타이머·wake 리스너를 해제한다(EP-04 f).
- retry/timeout/partial failure: 타이머가 늦거나 이르면 `check` 가 날짜로 판정하고 재예약한다.
- 다중 저장소 쓰기: 해당 없음 — 표식은 main 메모리 한 곳. 산출 문서 사본: `plan.md` + `INDEX.md` 행.

## 14. 성능 / 상한 / 최적화

- 새 타이머: 항상 1개(AC8). wake 이벤트당 `check` 1회 — O(멤버 수) 이하.
- 새 요청 수: 0 — 서버 호출 없음(D-005). 하루 1회 사용자가 로그인할 때 기존 로그인 경로만 탄다.
- 캐시/호출 축소: 해당 없음.

## 15. 외부 구현 포트 / 문서 계약

- 배포자가 구현하는 포트 변화 없음 — `GATE_AUTH_DEFINITIONS` 형상 불변.
- 배포자 문서: 폐쇄망 가이드 §2 에 "게이트 통과는 매일 로컬 00:00 에 풀려 다시 로그인한다 — 근거 ADR-008" 1줄.

## 16. 기존 결정·규칙과의 관계

| 기존 결정/규칙 | 출처 | 본문에서 건드리는 문장 | 결과 |
|---|---|---|---|
| 게이트 진리표·fail-closed | `features/gate/index.ts:9-20` · `auth.md §5` | §11 `evaluateGate` 분기 순서 유지 + 조건 1 추가 | 유지(확장) |
| "별도 검증 경로를 만들지 마라" | `features/gate/index.ts:41-50` | D-003 — 평소 로그인 커밋만 인정 | 유지 |
| Auth 구독 단일 설치 | `no-stray-auth-subscribe.test.ts` | §10 가드 호환 | 유지 |
| 0249 D-006 app 계층 연결 | 0249 §3 | D-008 — 설치 위치만 `AppLayout` → `RootGate`(둘 다 app 계층) | 변경(위치) |
| 0194 부팅 대기·`resuming` 파생 | `auth-resume.ts:246-258` | §10 SSOT 문단 | 유지 |
| `docs/arch` 는 현재 상태만 | `docs/AGENTS.md` 규칙 4 | D-011 — 이유는 ADR-008 | 유지 |
| PRD OQ4 텔레메트리 미정 | `docs/PRD.md §11` | §4 — 새 전송 없음 | 유지(무관) |

## 17. 리스크 / 트레이드오프

| 리스크 | 완화/결정 |
|---|---|
| 자정 직전 입력 중이던 Composer 초안이 게이트 표시로 사라진다(F-18) | 결정③ 범위(자격증명·연결·응답)는 지킨다. 초안 보존은 메인 셸 유지 또는 초안 저장소가 필요해 별도 handoff 후보로 남긴다 — 포털(`Modal`·`Popover` `createPortal` z-50)이 숨긴 셸 밖에 남는 문제 때문에 단순 숨김으로 해결되지 않는다 |
| 23:59 에 로그인해도 00:00 에 다시 로그인해야 한다 | "00:00을 지나면" 그대로의 정책 — 의도된 결과 |
| Windows 절전에서 `setTimeout` 이 늦게 발화 | wake 3종 재확인(D-005)으로 보완 |
| 시계를 되돌리면 하루에 두 번 해제될 수 있다 | 보수적 선택(로그인 더 많이, 적지 않게) |

- 되돌리기 어려운 결정: wire 필드 `dailyRelogin`(필수) — 지금 확정.
- 신규 의존성: 없음(`powerMonitor` 는 electron 내장).

## 18. 영향 받는 파일 / 문서

- `app/src/main/contracts/auth.ts` · `app/src/main/features/auth/login.ts` · 관련 로그인/refresh/runtime 테스트 · `app/src/main/app/runtime-model-startup.ts` · `runtime-model-startup.test.ts`
- `app/src/main/features/gate/daily.ts`(신규) · `daily.test.ts`(신규) · `index.ts` · `gate.test.ts`
- `app/src/main/app/daily-gate.ts`(신규) · `daily-gate.test.ts`(신규) · `daily-gate.wiring.test.ts`(신규) · `bootstrap.ts`
- `app/src/main/app/connection-views.test.ts` · `handlers/providers.test.ts` · `deployment/login-free-deployment.test.ts` (리터럴)
- `app/src/shared/ipc.ts`
- `app/src/renderer/src/features/providers/lib/gateStep.ts`(신규) · `gateStep.test.ts`(신규) · `components/GateLogin.tsx` · `GateLogin.render.test.ts`(신규)
- `app/src/renderer/src/app/GateFrame.tsx` · `RootGate.tsx` · `rootFrame.test.ts` · `hooks/useSessionCompletion.ts` · `hooks/useSessionCompletion.test.ts`
- `app/src/renderer/src/shared/i18n/resources/ko.ts` · `en.ts`
- `docs/arch/backend/auth.md` · `docs/IPC_CONTRACT.md` · `docs/decisions/008-daily-login-gate.md`(신규) · `docs/decisions/README.md` · `docs/INDEX.md` · `docs/guides/closed-network-extensions.md` · `docs/arch/frontend/state.md`

## 19. 게이트

- 적용할 하위 가이드: `app/AGENTS.md §better-sqlite3 ABI · 제약 환경 게이트 가이드` · `app/src/main/AGENTS.md` · `app/src/renderer/AGENTS.md`.
- ABI/네트워크 등 환경 제약: 변경 범위에 DB 스위트 없음 — `npm test` 불필요.
- 기본 정적 게이트: `cd app && npm run lint && npm run typecheck`.
- 관련 테스트: `./node_modules/.bin/vitest run src/main/features/gate src/main/features/auth src/main/app/runtime-model-startup.test.ts src/main/app/daily-gate.test.ts src/main/app/daily-gate.wiring.test.ts src/main/app/connection-views.test.ts src/main/app/handlers/providers.test.ts src/main/app/deployment/login-free-deployment.test.ts src/main/app/no-stray-auth-subscribe.test.ts src/main/app/auth-resume.test.ts src/renderer/src/features/providers src/renderer/src/app src/renderer/src/shared/i18n`.
- 문서: `node scripts/check-doc-inventory.mjs --check`.
- 사람 실기(AC15): 게이트 선언이 있는 폐쇄망 빌드에서 ① 시스템 시계 23:59:30 → 대기 → 로그인 화면+안내 → [로그인] → 같은 경로 복귀 ② 자정을 넘기는 긴 턴 → 재로그인 뒤 결과·nav 파랑 ③ 절전 → 다음 날 깨우기 ④ 시계를 다음 날로 바꾼 뒤 창 포커스.

## 복원 턴 설계 검토 (2026-10-07)

- 사용자 결정③④는 원본 tool 응답과 일치한다. D-003의 로그인 의도를 유지하고, 그 수단이던 credential revision 단독 판정을 로그인 커밋 원인과 함께 확인하도록 정정했다(§11, VP-19).
- 실제 코드에서 `refresh → settleGrant → store.put → onSnapshot(credential-committed)`를 확인했다. 자동 refresh만으로 통과하는 반례를 AC3·M16에 넣었으며 내부 원인 구분은 기존 Plugin/Harness 무효화를 보존한다.
- §7 AT와 pair를 일치시키고 누락된 Auth 구독 노드를 선언했다. 0254 구독 이동의 회귀는 VP-20, i18n은 EP-09, 예약/등록/해제/시작은 EP-04의 10자리로 추적한다.
- `rg 'bypassed:' app/src --glob '*.test.ts'`는 19건이지만 그중 rootFrame의 1건은 Partial override다. 필수 필드 추가 대상은 완전 리터럴 18건이며 `on`/`off` 이벤트 문자열은 각각 2번 등장한다.
- 자정 예약에서 의도적인 1초 지연을 제거했다. 다음 로컬 자정을 계산하고 타이머의 실제 지연·조기 발화는 날짜 재확인으로 처리한다; 24시간 고정값을 쓰지 않는다.
- 문서 상태 사본은 이 plan 메타와 `INDEX.md`의 0255 행이다. 둘의 READY 및 다음 주체 Codex(0254 이후)를 함께 확인한다. 최초 커밋 전 V1 정정이며 사용자 결정 변경·구현 완료 판정은 아니다.

문서 gate: `cd app; node scripts/check-doc-inventory.mjs --check`에서 generated doc·prose·relative links 모두 통과. 0255 AC 15·pair 20(REQUIRED 15/REGRESSION 5), §10에서 pair에 귀속되지 않은 EP 차집합 0.

### 기준선 검증 결과

`cd app; node node_modules/vitest/vitest.mjs run src/main/features/gate/gate.test.ts src/main/app/auth-resume.test.ts src/main/app/runtime-model-startup.test.ts src/main/app/no-stray-auth-subscribe.test.ts src/renderer/src/app/hooks/useSessionCompletion.test.ts src/renderer/src/features/sessions/components/navSections.render.test.ts src/renderer/src/features/sessions/store/sessionsStore.completion.test.ts src/renderer/src/app/rootFrame.test.ts`

관측: **8파일 155케이스 PASS**. 기존 게이트·부팅·구독·주의 표시 테스트의 실재와 현재 통과를 확인한 결과이며, 아직 구현하지 않은 0254·0255의 AC 충족 보고가 아니다.

## V1 READY self-review (기준선 기록; 현재 정정 검토는 §7-B)

- [x] Decision Ledger 가 제안 원문·결정③④ 를 보존한다 — §2 원문 인용, D-002·D-004.
- [x] Part I 만 읽어도 완료 상태가 이해된다 — §5 흐름·상태표.
- [x] "현재 인증 상태를 해제" 를 결정③ 의 "게이트 통과만 해제" 로 닫았고 재해석하지 않았다(D-002).
- [x] Product/UX 핵심 동작 ↔ AC ↔ Technical Design 연결 — §5 각 행이 AC1~AC12 와 §9 TO-BE 에 대응.
- [x] AS-IS 와 TO-BE 가 같은 축 — §9 Delta 5축. 사라진 책임: 없음(구독 위치 이동만, D-008).
- [x] 수치 실측 — 완전 리터럴 18 + Partial override 1 · 소비처 1 · `powerMonitor` 0 · `verified` 진입점 2(§8).
- [x] 각 AC 에 행동 단언·검증 수단·도달 경로.
- [x] Baseline V, NEW/CHANGED 노드 전부 REQUIRED pair, 영향받은 기존 노드는 REGRESSION(VP-15~VP-18·VP-20).
- [x] pair 마다 경로·§10 자리 수·직접 oracle, 적대 증거는 배선·0건·순서·형제 자리 불변식에만.
- [x] 운영 gate 열거 — 관련 없는 기존 실패는 blocking 아님.
- [x] 사람 실기로 미룬 순수 로직 없음 — 실기는 electron 이벤트·OS 시계·SSO 창뿐.
- [x] "X 가 쓰인다" 불변식(배선·구독 위치)의 장치가 X 제거 시 실패 — M1·M2·M8·M10~M12.
- [x] 선택적 필드 fail-open 없음 — 두 필드 모두 필수(§10).
- [x] 신규 모듈마다 레이어·강제 지점·seam(§9 책임 표 · §10).
- [x] producer/consumer · 기존 소비처 전수(§12).
- [x] one-way door(wire 필드) 지금 확정.
- [x] 게이트 명령이 `app/AGENTS.md` 와 충돌하지 않는다.
- [x] `ACTIVE 결정 ↔ AC` 대조 결과를 §3 갱신 메모에 적었다 — 충돌 0.
- [x] 산출물 문장 규칙 — 표 위주, Part I/II 중복 없음.

---

> **[구현자 기입]** 이하는 구현 턴에서 채운다. 절차 정본은
> [`handoff-impl/SKILL.md`](../../../.agents/skills/handoff-impl/SKILL.md).
> **재구현 턴도 같은 이름의 필드를 다시 채운다** — 표제(`… (r2)`, 같은 라운드 추가 턴이면 `… (r2.2)`)만 바꾸고 필드를 줄이지 않는다.
> 해당 없는 필드는 지우지 말고 `해당 없음`으로 남긴다.

2026-10-07 사용자 승인으로 PLAN_GAP을 정정했다. 현재 유효 V는 plan §7-B의 V1 + ΔV1이며 D-012가 D-002를 대체한다. 기존 Auth 자연 만료를 유지하고 일일 정책의 직접 변경·직접 방송으로 계약 범위를 한정했다.
정정 전 strict 단언2 red와 관측1 green의 원문은 [natural-expiry-probe.md](natural-expiry-probe.md)에 보존했다. 영구 통과 회귀는 app/src/main/app/daily-gate.expiry.test.ts이며 반례 임시 테스트와 구분한다.
아래 산출은 구현 턴 팀 관측과 실제 증거 JSON/로그를 합쳤다. 최종 관련 합집합59파일704케이스 PASS는 .tmp/0255-final-vitest.log의 팀 관측이다. 최종 typecheck 3구성 오류0·lint 오류0/기존 warning1·inventory 3검사 green을 확인했다. 구현 상태 사본은 아래 보고와 INDEX에 둔다.

## [구현자 기입] 설계 리뷰 (r1)

- 동의 / 그대로 진행: 일일 게이트·로그인 원인 구분·RootGate 구독·문서 배선은 유효 V대로 구현했다. 관련 합집합59파일704케이스 PASS(구현 턴 팀 관측).
- 이견 / 현실성 문제: 실제 Auth의 snapshot은 자연 만료를 정착시키므로 원문 AC5의 절대 불변·부수효과0 및 AC1의 전체 방송1과 충돌했다. 2026-10-07 사용자 승인과 §7-B ΔV1로 해결했다.
- ACTIVE Decision과 충돌하는 설계 발견: 현재 충돌 없음. D-012에 따라 유효기간이 남은 Auth는 정책이 직접 변경하지 않으며 기존 expired 이벤트·저장·Plugin/Harness 무효화는 유지한다. 영구 expiry 회귀의 직접 정책1/전체2·최종차단 oracle이 새 계약을 잠근다.

## [구현자 기입] 강제 지점 전수 (§10 대조) (r1)

| Pair | 계약/필드 | §10이 적은 지점 | 닫은 지점 | 재현 명령 / 관측 | 남긴 곳 |
|---|---|---|---|---|---|
| VP-01-D1·VP-03-D1·VP-08-D1·VP-13·VP-21 | EP-01 lapseDay snapshot 표식 | 1 | 1/1 | rg -n -e lapseDay -e 'snapshot\(' app/src/main/features/gate/index.ts → :129·131. DG 직접 mutator0·유효 snapshot 동일; EXP expired 이벤트1·rev+1·저장/sync/invalidate 각1·fetch/authorize0. 강화 후 단독1/1 PASS | 없음 |
| VP-02·VP-13·VP-19 | EP-02 일일 판정 | 3 | 3/3 | rg -n -e dailyReloginRequired -e 'const passed' -e 'const dailyRelogin' app/src/main/features/gate → state 매핑:148·passed:88·목록:90. M3/M4 각2 assertion red | 없음 |
| VP-05·VP-13 | EP-03 미요구·bypass 반환 | 2 | 2/2 | gate/index.ts:75·76의 빈 배열 반환. M9 assertion5 red | 없음 |
| VP-01-D1·VP-09·VP-12 | EP-04 예약·wake·정리 | 10 | 10/10 | bootstrap.ts:483·490~496·889와 daily.ts의 start/check 예약. M10a~c·M11a~d·M12 각각1, M14 2·M15 4 assertion red | 없음 |
| VP-01-D1·VP-08-D1·VP-21 | EP-05 lapse → 정책 push | 2 | 2/2 | EXP:165~184 직접 policy1·전체2·최종차단 ['gate']·방송 []→['gate']·expired→push→sync→invalidate→reconcile→policy-push→push 단언 green | 없음 |
| VP-01-D1·VP-02·VP-10·VP-14 | EP-06 dailyRelogin 운반 | 7 | 7/7 | rg -n -e dailyRelogin -e currentGateProvider -e showsDailyRelogin app/src/shared/ipc.ts app/src/main/features/gate app/src/main/app/connection-views.ts app/src/renderer/src/app app/src/renderer/src/features/providers — shared/ipc.ts:1830·RootGate.tsx:27/49·GateFrame.tsx:42·GateLogin.tsx:45/81 재검색, 운반 누락 차집합∅(팀 관측) | 없음 |
| VP-03-D1·VP-11·VP-17·VP-20 | EP-07 구독/열람 소유 | 2 | 2/2 | RootGate.tsx:27 설치; useSessionCompletion.ts:21/22 구독·28/29 열람 전용. M8 구조 단언1 red; 소유 검색 차집합∅ | 없음 |
| VP-07 | EP-08 문서 | 7 | 7/7 | auth.md:396·501·524, IPC_CONTRACT.md:481, ADR-008:3/13/23/37/46/52, decisions/README:36, docs/INDEX:49, guide:279, frontend/state.md:44. 승인 후 직접 변경 범위·기존 만료 유지 정합화와 inventory green | 없음; 반례 증거 문서는 분모 밖 |
| VP-02·VP-10 | EP-09 ko·en 안내 | 2 | 2/2 | rg -n 'dailyRelogin:' app/src/renderer/src/shared/i18n/resources → ko.ts:177·en.ts:178. locale 누락 차집합∅; i18n 포함 합집합 green | 없음 |
| VP-02·VP-19 | EP-10 로그인 증거 | 5 | 5/5 | auth.ts:407~408 cause, login.ts refresh 원인/settle 전달, runtime-model-startup.ts:99~102 방송 전 기록, bootstrap.ts:789 포트. M16/17/18/19 assertion1/3/2/1 red | 없음 |

- 분모 검산: EP10행·41자리 = 1+3+2+10+2+7+2+7+2+5. 실측 main26/26 + renderer9/9(문서 state 포함) + docs6/6 = 41/41.
- EP-01·05는 ΔV1 계약으로 닫았다. 기존 Auth 내부 정착 경로는 VP-21·22 회귀로 추적하며 새 EP 자리를 추가하지 않았다.
- §10 밖 발견: snapshot 자연 만료·재진입 방송은 사용자 승인 ΔV1에 반영했다. 운반·소유·locale 전수 검색의 차집합은 ∅다.

**V-pair 자기확인**

| Pair | requiredness | 자기 상태 | 직접 관측 | 선택된 적대 증거 결과 |
|---|---|---|---|---|
| VP-01-D1 | REQUIRED | SELF_PASS | DG 경계·wake·반복 + EXP 정책직접1/전체2·최종차단 green | VP-01의 M1 3·M2 2 assertion red 승계 |
| VP-02 | REQUIRED | SELF_PASS | 실제 Auth refresh 차단·login/reauth/continue 통과, 체인 SSR와 안내 green | M3/4 각2·M5 1·M6 3 red |
| VP-03-D1 | REQUIRED | SELF_PASS | DG 직접 mutator0·유효 snapshot 동일 + EXP 기존 자연 만료/소비자 정착 green | VP-03의 M7 revoke/resume 각각3·M8 1 red 승계 |
| VP-04 | REQUIRED | SELF_PASS | gate 초기 표식 없음·부팅 복원 회귀 green; 표식 영속 경로 전수 검색 없음 | 직접 oracle |
| VP-05 | REQUIRED | SELF_PASS | gate 진리표·bypass 우선·미요구 빈 목록 green | M9 5 red |
| VP-06 | REQUIRED | SELF_BLOCKED | AC15 실제 Windows 날짜·절전·focus·SSO 실기 미실행 | 실기 |
| VP-07 | REQUIRED | SELF_PASS | 규범 문서7곳 앵커·승인 후 정합화·inventory generated/prose/links green | not selected |
| VP-08-D1 | REQUIRED | SELF_PASS | DG passed→lapsed2→lapsed1→passed→lapsed2 + EXP []→['gate']·최종차단 green | VP-01·02 선택 변이 전부 승계 |
| VP-09 | REQUIRED | SELF_PASS | wake3종 on/off·bootstrap start·shutdown dispose 소스 가드5케이스 green | M10a~c·M11a~d·M12 각1 red |
| VP-10 | REQUIRED | SELF_PASS | GateLogin SSR·gateStep·prop 운반 green; renderer baseline/원복8파일96 | M5 1·M6 3 red |
| VP-11 | REQUIRED | SELF_PASS | RootGate effect 소유·AppLayout viewed 소유 구조 단언·게이트 중 주의 표시 green | M8 1 red |
| VP-12 | REQUIRED | SELF_PASS | D21케이스: 로컬 자정·DST·점프·역행·조기·dispose·timer 상한 green | M13/14/15 1/2/4 red |
| VP-13 | REQUIRED | SELF_PASS | gate/daily48케이스: revision·확인 예외·bypass·다음날 표식 갱신 green | M3/M4/M9 red 공유 |
| VP-14 | REQUIRED | SELF_PASS | gateStep·SSR 현재 단계/안내3조건 green | M5/M6 red 공유 |
| VP-15 | REGRESSION | SELF_PASS | 기존 gate 진리표 포함 G27케이스 green | not selected |
| VP-16 | REGRESSION | SELF_PASS | auth-resume·rootFrame 부팅/복원/대기 회귀 포함 합집합59파일704 PASS | not selected |
| VP-17 | REGRESSION | SELF_PASS | 기존 0249 완료·응답대기·열람 정책 green; renderer 넓은21파일205 | not selected |
| VP-18 | REGRESSION | SELF_PASS | no-stray-auth-subscribe 포함 합집합 green; 새 Auth 구독 없이 기존 handler 포트 사용 | not selected |
| VP-19 | REQUIRED | SELF_PASS | A15케이스: 실제 refresh/login·실패/취소/superseded·기록-before-push·기존 소비자 무효화 green | M16/17/18/19 1/3/2/1 red |
| VP-20 | REGRESSION | SELF_PASS | 게이트 중 생성 집합/주의 표시·재열람 회귀 green; RootGate.tsx:27 구독 유지 | M8 공유 |
| VP-21 | REGRESSION | SELF_PASS | EXP:165~184 실제 Auth·gate·daily·기존 handler: expired/effectiveExpiry1·저장/sync/invalidate 각1·Auth방송1→정책방송1·fetch/authorize0. 강화 후 단독1/1 PASS | not selected — 직접 상태·이벤트·호출·순서 oracle |
| VP-22 | REGRESSION | SELF_PASS | runtime.test.ts:171~226 기존4케이스: verified 해제·반복 revision 1회·expired1/credentialChanged=true·request 경로 정착 green | not selected — 기존 직접 oracle |

- 합계 검산: REQUIRED15 = SELF_PASS14 + SELF_BLOCKED1; REGRESSION7 = SELF_PASS7. 전체22 = SELF_PASS21 + SELF_BLOCKED1.
- V1 20 − 대체3 + ΔV1 5 = 22. superseded VP-01·03·08의 AC·선택 변이는 각각 -D1로 전부 승계했고 폐기 증거0이다. 자기결과이며 독립 검증 PASS를 선점하지 않는다.

## [구현자 기입] 이번 라운드 수정의 잠금 (r1)

구현 턴 팀 변이 관측: .tmp/daily-main-mutations.json 22회 + .tmp/0255-renderer-evidence/results.json 3회.
25회 모두 assertion red·대상 파일 bytes 원복. main JSON 재읽기22회 모두 exit1/failedCases≥1·복구6대상true, renderer JSON 재읽기3회 M5 1/M6 3/M8 1 red. main 원복5파일71·renderer baseline/원복8파일96 green이다.
약호 경로: DG=app/src/main/app/daily-gate.test.ts, EXP=app/src/main/app/daily-gate.expiry.test.ts, D=app/src/main/features/gate/daily.test.ts, G=app/src/main/features/gate/gate.test.ts, W=app/src/main/app/daily-gate.wiring.test.ts, A=app/src/main/app/runtime-model-startup.test.ts, GL=app/src/renderer/src/features/providers/components/GateLogin.render.test.ts, GS=app/src/renderer/src/features/providers/lib/gateStep.test.ts, SA=app/src/renderer/src/app/hooks/useSessionCompletion.test.ts.

| 심은 결함 | 출처 | 이전 라운드 결과 | 실패한 테스트 / 케이스 수 | 결과 |
|---|---|---|---|---|
| M1 일일 push 제거 | VP-01-D1 / EP-05 | 최초; ΔV1 승계 | DG lapses/follows/wakes — 3 | assertion red·원복 |
| M2 lapseDay 제거 | VP-01-D1 / EP-01·05 | 최초; ΔV1 승계 | DG lapses/follows — 2 | assertion red·원복 |
| M3 revision >를 >=로 | VP-02·13 / EP-02 | 최초 | D verified login evidence + G same revision cannot pass — 2 | assertion red·원복 |
| M4 미확인 경계 예외 제거 | VP-02·13 / EP-02 | 최초 | D verified login evidence + G previously unverified first confirmation — 2 | assertion red·원복 |
| M5 옛 현재 단계 규칙 | VP-02·10·14 / EP-06f | 최초 | GL advances to the second valid member — 1 | assertion red·원복 |
| M6 안내 status 조건 제거 | VP-02·10·14 / EP-06g | 최초 | GL expired reason + GS none/expired reason — 3 | assertion red·원복 |
| M7-revoke 경계에서 revoke | VP-03-D1 / EP-01 | 최초; ΔV1 승계 | DG3케이스 — 3 | assertion red·원복 |
| M7-resume 경계에서 resume | VP-03-D1 / EP-01 | 최초; ΔV1 승계 | DG3케이스 — 3 | assertion red·원복 |
| M8 구독을 AppLayout으로 복귀 | VP-03-D1·11 / EP-07 | 최초; ΔV1 승계 | SA RootGate owns the attention effect — 1 | assertion red·원복 |
| M9 bypass 조기 반환 제거 | VP-05·13 / EP-03 | 최초 | G 기존 bypass4 + daily marks bypass — 5 | assertion red·원복 |
| M10a resume on 제거 | VP-09 / EP-04c | 최초 | W powerMonitor resume on/off — 1 | assertion red·원복 |
| M10b unlock-screen on 제거 | VP-09 / EP-04d | 최초 | W powerMonitor unlock-screen on/off — 1 | assertion red·원복 |
| M10c focus on 제거 | VP-09 / EP-04e | 최초 | W app browser-window-focus on/off — 1 | assertion red·원복 |
| M11a shutdown dispose 제거 | VP-09 / EP-04f | 최초 | W starts once and disposes at shutdown — 1 | assertion red·원복 |
| M11b resume off 제거 | VP-09 / EP-04g | 최초 | W powerMonitor resume on/off — 1 | assertion red·원복 |
| M11c unlock-screen off 제거 | VP-09 / EP-04h | 최초 | W powerMonitor unlock-screen on/off — 1 | assertion red·원복 |
| M11d focus off 제거 | VP-09 / EP-04i | 최초 | W app browser-window-focus on/off — 1 | assertion red·원복 |
| M12 bootstrap 시작 제거 | VP-09 / EP-04j | 최초 | W starts once and disposes at shutdown — 1 | assertion red·원복 |
| M13 날짜 !==를 >로 | VP-12 / EP-04 | 최초 | D clock reversal — 1 | assertion red·원복 |
| M14 check 재예약 제거 | VP-12 / EP-04b | 최초 | D midnight/jump/reversal + early delivery — 2 | assertion red·원복 |
| M15 start에서 콜백 | VP-12 / EP-04a | 최초 | D lifetime4케이스 — 4 | assertion red·원복 |
| M16 refresh를 committed로 | VP-19 / EP-10b | 최초 | A real Auth refresh/login — 1 | assertion red·원복 |
| M17 recordGateLogin 제거 | VP-19 / EP-10d | 최초 | A snapshot routes/real refresh-login/reauth-continuation — 3 | assertion red·원복 |
| M18 기록을 push 뒤로 | VP-19 / EP-10d | 최초 | A snapshot routes/real refresh-login — 2 | assertion red·원복 |
| M19 bootstrap 포트 제거 | VP-19 / EP-10e | 최초 | W live gate login recorder — 1 | assertion red·원복 |

- 분모 검산: 등록24자리 + M7 대안 추가1회 = 실행25회·표25행. 인용 변이0·등록 밖 새 잠금 oracle0; 등록 proxy는 해당 변이 행으로 검사했다.
- 감사 재현: 저장소 루트에서 Get-Content .tmp/daily-main-mutations.json 및 Get-Content .tmp/0255-renderer-evidence/results.json. 심는/실행/복구 절차는 .tmp/daily-main-mutations.mjs·.tmp/0255-renderer-mutations.py 원문이다. 이 산출을 root가 직접 실행했다는 주장은 하지 않는다.
- 덮개 회귀: 최초 r1. 기존 0249·0254 회귀 합집합 green이며 구독 이동 구조 장치가 M8을 검출했다.
- 원문 자연 만료 strict2 red는 승인 정정의 증거로 보존했다. 현재 ΔV1은 EXP 통과 회귀와 기존 runtime4케이스로 닫는다. VP-21·22에는 선택 변이를 새로 등록하지 않았다.

## [구현자 기입] Product/UX 파생 검토 (r1)

| 질문 | 판정 | 후속 |
|---|---|---|
| 새 사용자 문구·상태에 소비자가 있는가 | RootGate→GateFrame→GateLogin prop과 gateStep/SSR green; 날짜 이유는 valid+목록소속일 때만 표시 | 없음 |
| seam 재배치 뒤 정리 스코프가 유지되는가 | dailyGate dispose·wake3종 off·timer 정리 W/DG green; M11a~d가 해당 누락을 각각 검출 | 없음 |
| 새 실패 경로가 Part I 상태표 어디에 해당하는가 | 로그인 실패·취소는 기존 화면 유지. 자정 동시 자연 만료는 ΔV1 상태표의 기존 expired 로그인 화면이며 날짜 안내는 숨김 | 승인 정정 반영 완료 |
| 실패가 아무 일도 안 일어남으로 보이지 않는가 | 경계 안내·기존 failed 문구 SSR green. authKind stale은 unknown_auth_kind 실패 가능 | 아래 후속 후보 |
| 늦은 응답이 화면을 되돌리지 않는가 | superseded 로그인 성공 증거 없음(A green). 게이트 중 turn/permission/생성 집합은 RootGate 구독 유지 | 실제 OS·긴 턴 실기는 AC15 대기 |

## [구현자 기입] 놓친 잠재 문제 + 대응 (r1)

| # | 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | snapshot 자연 만료 정착이 원문 AC5 절대 불변과 충돌 | 해결 — 사용자 승인 D-012·AC5(ΔV1)·EP-01로 직접 변경 범위와 기존 만료 정착을 분리; 영구 EXP+runtime 회귀 green | [반례 원문](natural-expiry-probe.md), runtime.ts:126→store.ts:393/429→startup.ts:102/106/107; EXP:168~184 |
| 2 | 동시 Auth방송1+정책방송1이 원문 AC1 전체1과 충돌 | 해결 — AC1(ΔV1)·EP-05 직접 정책1/전체2·방송 순서·최종차단 직접 oracle green | EXP:170~184, 정책직접1·전체2·[]→['gate'] |
| 3 | GateLogin authKind는 provider 변경 뒤에도 유지된다. 다음 provider 방식1개면 선택 UI 없이 잘못된 authKind로 실패 가능 | NEXT_HANDOFF 후보 — 기존 chain의 인접 UX, 이번 규범을 확장하지 않음 | GateLogin.tsx:52·95~113, login.ts:473~477 unknown_auth_kind. 코드 경로 관측이며 별도 행동 probe 미실행 |
| 4 | 메인 셸 언마운트 시 미전송 Composer 초안 소실 | 기존 plan§17 후속 후보 유지 | plan§17·ADR-008 포기 절; 초안 보존은 현재 비범위 |
| 5 | 문서 boolean-only cause 소비·무조건 refresh 불통과 표현이 gate/미확인 예외와 충돌 | 선조치 — Plugin/Harness 소비 범위 한정, 경계 당시 확인된 멤버 조건화. 승인 후 직접 Auth 변경 범위·기존 만료 유지 정합화 | auth.md§4.2·511·524~530, IPC_CONTRACT.md:481, ADR-008:37~39·52~53 |

### 설계 대비 명시적 차이

대체 구현 메커니즘 없음. 기존 Auth 자연 만료와 소비자 경로를 그대로 유지했다. 발견된 원문 설계 충돌은 사용자 승인 §7-B ΔV1에 반영했고 아래4축을 새 직접 oracle로 재확인했다.

| 축 | 대체물에만 있는 실패 모드 | 재확인한 AC·§10 행 / 관측 |
|---|---|---|
| 만료 | 대체물 없음; 기존 snapshot 자연 만료를 원문 계획이 누락 | AC1(ΔV1)·5-D1 / EP-01·05. EXP expired·verified false·rev+1·이벤트1·직접정책1/전체2 green; runtime 기존4케이스 green |
| 공유 (누가 함께 쓰고 누가 비울 수 있는가) | 대체물 없음; 기존 Auth 이벤트를 Plugin/Harness 소비자가 함께 받음 | D-012·AC5(ΔV1): 저장/sync/invalidate 각1 유지. 정책 직접 mutator0·유효 snapshot 동일 green |
| 재진입 | 대체물 없음; lapseDay snapshot의 handler push→gate.state 재진입 | AC1(ΔV1) / EP-05: EXP 방송 []→['gate']·정책직접1·전체2·최종차단·순서 로그 green |
| 다른 무효화 축 | 대체물 없음; refresh는 credentialChanged:true이나 로그인 증거가 아님 | AC3 / EP-10: A 실제 Auth green·M16 red; 기존 bypass·부팅 회귀 green |

## [구현자 기입] 구현 보고 (r1)

| 항목 | 내용 |
|---|---|
| 변경 파일 | main/auth·gate·app composition·shared IPC·renderer providers/app hooks/i18n·규범 문서7곳·natural-expiry-probe.md 증거·영구 daily-gate.expiry.test.ts. EP-08 분모7자리는 유지. §18 파일 목록 + 신규 영구 expiry 회귀. 구현 산출35파일과 plan/INDEX 보고2파일을 포함하며 별도 설계 커밋의 증거 문서는 중복 포함하지 않는다 |
| 실행 명령 | app에서 node node_modules/vitest/vitest.mjs run src/main/app/daily-gate.expiry.test.ts src/main/features/auth/runtime.test.ts 및 plan§19 관련 필터. node scripts/check-doc-inventory.mjs --check. 변이 script/JSON 위 표. npm run typecheck·npm run lint·git diff --check. 커밋 메시지와 파싱은 아래 상태 사본에서 기록 |
| 관측한 게이트 산출 | 관련 최종 합집합59파일704 PASS(.tmp/0255-final-vitest.log, 팀 관측); main24파일432·mutation 원복5파일71; renderer8파일96·넓은21파일205. 정정 후 관련5파일67 green. inventory generated9 items·102 channels/prose/relative links green |
| 정적 gate 관측 | 최종 full typecheck exit0(node/web/test 모두0, .tmp/0255-final-typecheck.log). fetch/authorize0 보강 EXP 단독1/1 PASS·읽기 전용 ESLint0. 최종 npm run lint exit0·0error/1warning(.tmp/0255-final-lint.log). warning은 기존 useTranscriptVirtualizer.ts:22 react-hooks/incompatible-library |
| V-pair 자기확인 | REQUIRED14 SELF_PASS·1 SELF_BLOCKED, REGRESSION7 SELF_PASS →21/22 자기 통과·실기1보류 |
| 강제 지점 전수 | EP41/41(main26+renderer9+docs6), 운반/소유/locale 차집합∅. EP-01·05는 ΔV1 직접변경/방송 계약과 기존 만료 회귀로 닫음 |
| AC 자기보고(Criteria-Met) | ✅14·⚠️1(AC15 실기)·❌0=15. Criteria-Met: 14/15 |
| 합계 검산 | pair22행·mutation25행·AC15행. REQUIRED15/REGRESSION7, 선택 증거24자리+M7 대안1·인용 변이0·등록 밖 새 proxy oracle0=표25행 |
| 블로커 / 역질문 | 사용자 승인 대기는 해소. 남은 사람 실기는 AC15·VP-06. 기계 gate 완료. plan/INDEX를 impl/IMPL_DONE·다음 Claude 검증으로 갱신하고 다시 읽어 확인 |
| 대상 커밋 | r1 구현 좌표 INDEX; ΔV1 설계 정정과 구현 산출 분리. 설계 trailer3키와 구현 커밋의6키 파싱 확인. `git log -1 --format='%(trailers:only=true)'`가 Agent codex·Handoff255·Status implemented·Criteria-Met14/15·Criteria-Pending AC15·Verified-By pending을 반환했다. 좌표는 INDEX의 검증자 기입 자리표시자 |

**AC 자기보고**

| AC | 자기 판정 | 실제 관측 / 재현 |
|---|---|---|
| AC1 경계 state·정책 직접 방송 | ✅ | ΔV1 R-01-D1/AT-01-D1. DG + EXP:165~184 정책직접1·전체2·최종 passedfalse/['gate']·방송 []→['gate']·순서 oracle green |
| AC2 renderer 게이트 프레임 | ✅ | rootFrame 포함 합집합 green; dailyRelogin fixture·!passed→gate |
| AC3 실제 로그인·refresh·체인 | ✅ | A real Auth refresh/login·reauth/continue, G 체인·GL 2단계 SSR green |
| AC4 날짜 안내 조건 | ✅ | GL/GS valid·expired·none·목록밖 oracle green; M6 3 red |
| AC5 정책 직접 Auth 변경0·기존 만료 유지 | ✅ | ΔV1 R-03-D1/AT-05-D1. DG:26·88~100 직접6mutator0·유효 snapshot 동일; EXP:168~184 expired/effectiveExpiry1·rev+1·저장/sync/invalidate 각1·fetch/authorize0 직접 단언. 보강 후 단독1/1 PASS·읽기 전용 ESLint0(팀 관측) |
| AC6 게이트 동안 이벤트/표시 | ✅ | SA RootGate 소유·완료/응답요청/생성집합·재열람 회귀 green; M8 1 red |
| AC7 초기 표식·영속 없음 | ✅ | G 초기/부팅 회귀 green; 표식 메모리만 사용. D-012 기존 자연 만료 저장과 분리 |
| AC8 날짜·자정·감시 수명 | ✅ | D21케이스: 로컬·DST23/25h·역행·점프·조기·dispose·timer 상한 green |
| AC9 Electron 배선 | ✅ | W5케이스·DG wake/dispose green; M10a~c·M11a~d·M12 각1 red |
| AC10 면제·DEV 진리표 | ✅ | G27케이스 green; M9 5 red |
| AC11 미확인 첫 확인·expired/none 로그인 | ✅ | D/G 판정 표 green; M4 2 red |
| AC12 다음 경계 재해제 | ✅ | DG passed→lapsed2→lapsed1→passed→lapsed2 green |
| AC13 문서 | ✅ | 규범7곳 앵커·승인 후 auth/IPC/ADR/probe 정합화·inventory generated/prose/links green |
| AC14 운영 gate·Auth 구독·trailer | ✅ | 최종 관련59파일704 PASS·no-stray·inventory green. 최종 full node/web/test0·보강 EXP1/1 PASS·읽기 전용 ESLint0·최종 full lint0error/1warning. 설계 trailer3키·구현 trailer6키의 실제 git log 파싱 확인 |
| AC15 OS·SSO 실기 | ⚠️ | 실제 Windows 날짜·자정 긴 턴·절전·focus·SSO 실기 미실행 |

- 합계 검산: ✅14·⚠️1·❌0=15. AC 분모는 ΔV1에서도15다.
- 상태 사본: plan 메타 IMPL_DONE·유효 V1+ΔV1, INDEX impl/IMPL_DONE·다음 Claude 검증·(r1 구현 — 검증자 기입). 커밋 직전 rg로 두 사본을 다시 읽어 확인했고 구현 커밋 뒤6키 trailer를 확인했다.

## [구현자 기입] Review Signals — 사실만 (r1)

- 이전 라운드와 같은 축인가: 최초 r1. 기존 Auth production 자연 만료를 이번 경계 snapshot 소비가 드러냈다.
- 막았어야 할 plan 지침·AC: 원문 EP-01 snapshot 소비에서 만료 효과를 분해하지 않아 fake Auth AC5 green/실제 strict AC1·5 red가 갈렸다. 사용자 승인 ΔV1이 직접 범위를 정정하고 EXP+runtime 회귀를 추가했다.
- 환경 한계: Windows·SSO 사람 실기 미실행. 최종 full typecheck0·보강 EXP1/1 PASS·full lint0error/기존warning1·구현 trailer6키 파싱을 관측했다. ABI·네트워크 장애를 추측해 추가하지 않았다.
- 현재 라운드·impl 턴: r1. 승인 대기는 해소됐으며 pair21/22 자기 통과·AC15 실기1보류다. 독립 검증 완료나 새 라운드로 올리지 않는다.

---

## [검증자 기입] 파생 이슈

| # | 이슈 | 출처 pair / 계약·gate | 대응 방향 | 분류 | 상태 |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
