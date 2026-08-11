# Plan — 0184-provider-auth-verification-fixes

> **사후 작성(선 수정 후 작성).** 구현이 먼저 나가고(커밋 4건) 이 문서가 뒤에 쓰였다. 그래서
> 아래 §설계·§인수 기준은 *예측* 이 아니라 **실제로 들어간 코드에서 역산한 설계**다 — 그 사실을
> 숨기지 않는다(사용자 지시 2026-08-11). 다만 역산이 "된 것을 정당화하는 글"이 되지 않도록,
> 인수 기준은 코드가 아니라 **테스트 케이스 이름**으로 고정했고(있는 것만 적는다), 코드가
> 남긴 구멍은 `[검증자 기입] 파생 이슈` 로 뺐다.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0184-provider-auth-verification-fixes` |
| 작성자 | Claude Code |
| 일자 | 2026-08-11 |
| 매핑 | PHASES "현재 작업 중" / PR = 브랜치 `claude/bug-fixes-documentation-ffi3kf` |
| 상태 | READY (**사후**) → impl 완료 → verify |
| 구현 주체 | **Claude** (버그수정 = 비기능. 환경에 Codex 부재 — AGENTS.md "구현 주체 분담") |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 (본 문서) | "최근 4개 커밋은 이전 핸드오프까지 구현된 기능들에 대해 그동안 실기 테스트에서 발견한 버그들을 수정한 것이다. **선 수정 후 작성으로 진행된 건이니 정리하여 plan 및 verify 문서를 만들 것**" | 라이브 세션 요청 (2026-08-11) |
| 명시 요구 (원 버그, 실기 보고) | ① "로그인에 **성공한 provider id 가 bypass 와 같은 현상**" ② "컨플루언스+PAT 를 구성하자마자 **연결됨**이 떴다" ③ "그 도구를 에이전트가 부르면 **`unknown_provider`** 로 죽는다" ④ "state 를 명세에 두지 않은 SP 로는 로그인이 안 된다" | 커밋 `397d48b`·`cc57477`·`8d32745` 메시지에 인용된 사용자 실기 보고 |
| 명시 요구 (설계 제약) | "자동 로그인은 **기존 로그인 창이 살아있는 쿠키로 즉시 닫히는 것**이며, 별도 검증 경로를 두지 마라" | 사용자 결정 2026-08-11 (`gate/index.ts:31-38` 주석에 기록) — **뒤에 사용자가 뒤집었다**(아래 §요구 비판적 검토) |
| 추론 의도 | 네 커밋을 **하나의 핸드오프**로 묶는다 — 전부 `features/providers` 의 *인증 판정 근거* 라는 한 축이고, 뒤 커밋이 앞 커밋의 결정을 이어받거나 뒤집는 **순차 의존**이다(추론) | `git log 397d48b..8d32745` 의 diff 의존 관계 |

## Context (왜)

0180(제거) → 0181(재작성) → 0182(신원·세션 등록) → 0183(사용량 접기) 으로 provider 플랫폼이 서고
**실기 테스트**에 들어갔다. 거기서 나온 결함 4건은 표면이 다 다르지만(게이트·연결 배지·도구
호출·OAuth 콜백) 뿌리가 하나다 — **"인증됐다" 고 판정하는 근거가 기록이거나 형식이었고, 서버에
물어본 적이 없었다.**

| 실기 증상 | 그때의 판정 근거 | 왜 틀렸나 |
|---|---|---|
| 한 번 로그인한 게이트가 영구 통과 | 디스크에서 복원한 `Grant.status` | 세션 grant 는 vault 도 만료도 없어 **기록만으로 영원히 `valid`** |
| PAT 입력 즉시 "연결됨" | `compose()` 형식 검사 | 서버가 그 PAT 를 **받아 주는지** 물은 적 없음(회수된 PAT 도 통과) |
| 연결된 도구가 `unknown_provider` | 선언이 **손으로 적은** provider id 문자열 | 컴파일러도 등록 검사도 대조하지 않음 |
| state 없는 SP 로 로그인 불가 | "state 는 늘 발급된다" 는 코어 가정 | authorize URL 은 **선언이** 만드는데 코어가 state 전송을 단정 |

## 요구 비판적 검토 (수석 엔지니어 관점)

| 질문 | 판단 | 근거 |
|---|---|---|
| 이 요구가 진짜 문제를 겨냥하는가 (증상 ↔ 원인) | **전제 정정** — 증상 4건은 서로 다른 버그로 보고됐지만 원인은 *판정 근거* 하나다. 그래서 4건을 각각 패치하지 않고 **판정을 `Provider.probe` 한 지점으로 접었다** | `contracts/provider.ts:164-193`(probe 계약 주석) · `auth/login.ts:212-249`(`probeOk`) |
| 이미 있는 것 아닌가 | **부분적으로 있었다 — 그리고 그게 문제였다.** `browser-session` 에는 판정이 있었고(`authenticationProbeUrl` + `SessionRunner.verify`) 값형에는 없었다. 두 벌이라 규칙이 갈렸다 | 제거된 `infra/browser-session-policy.ts` 의 `classifyProbeChain`(`git show cc57477^:app/src/main/infra/browser-session-policy.ts`) |
| 더 작은 해법이 있는가 | **있었고, 실기가 기각했다.** ⓐ "게이트만 고치기"(397d48b) 는 값형 "연결됨" 오판을 안 고친다 ⓑ "값형에도 probe 추가" 는 판정이 **세 벌**이 된다. 그래서 계약(`Provider.probe`)으로 올렸다 | `auth/login.ts:119-131` 의 resume 주석(방식별 분기를 지운 이유) |
| 인용 자료가 요구를 부풀리지 않았나 | **해당 없음 — 인용 자료가 없다.** 이번 입력은 선행 보고서가 아니라 사용자 실기 로그다. 다만 **이전 핸드오프의 결정을 그대로 승계하지 않았다**: 0174 가 실기로 세운 판정 규칙(2xx + 체인이 origin 으로 복귀)은 *규칙만* 살리고 그것을 담던 모듈은 지웠다 | `infra/browser-session-policy.ts:1-12`(이관 기록) |
| 기존 채택 결정을 뒤집는가 | **뒤집는다 — 3건.** 그중 1건은 **사용자 자신의 하루 전 결정**이다(아래) | §기존 결정·규칙과의 관계 |

**사용자 결정이 하루 만에 뒤집힌 지점 — 기록해 둔다.** `397d48b` 은 사용자 결정을 인용해
"자동 로그인은 기존 로그인 창이 즉시 닫히는 것이며 **별도 검증 경로를 두지 마라**" 를
`gate/index.ts` 주석에 못 박았다. 그런데 그 결정대로면 재시작마다 로그인 창이 한 번 뜬다 —
쿠키가 살아 있어도 창은 열린다. 다음 커밋(`2350a42`)이 **창을 열지 않는 probe** 로 그 자리를
채웠다. 즉 "별도 검증 경로 금지" 는 유지되지 않았다. 설계 문서가 없어서 이 반전이 **커밋
메시지 안에서만** 일어났다 — 사후 작성이 실제로 잃은 것이 이것이다.

- **사용자에게 올릴 것**(단독 결정 불가): §리스크의 OQ1(재인증 실패 시 이전 자격증명 소실).

## 자료조사 (Research)

> 수치는 **2026-08-11 이 세션에서 직접 측정**했다(승계 0건).

| 발견 / 제약 | 레퍼런스 |
|---|---|
| 게이트 판정은 순수 함수 하나(`evaluateGate`)이고 electron 의존이 0 이라 vitest 대상이다 — 진리표가 주석에 표로 산다 | `app/src/main/features/providers/gate/index.ts:1-24` |
| `Grant` 3종 중 **`session` 만 vault 도 `expiresAt` 도 없다**. 그래서 `status()` 가 기록만으로 `valid` 를 돌려준다 | `app/src/main/contracts/provider.ts:158-162` · `auth/store.ts:107-121` |
| 만료를 **로컬에서 아는 것은 `token` 뿐**이다. PAT·API key 는 서버만 안다(회수 여부를 앱이 모른다) | `auth/login.ts:122-126` |
| `ProviderApi.request` 는 리다이렉트를 **호출자가** 돌며 홉마다 정책을 재검사한다 → 최종 URL 을 알 수 있는 유일한 지점 | `auth/api.ts:107-135` |
| 0174 가 실기로 교정한 판정 규칙: **status 만 보면 안 된다.** SSO 배포는 미인증일 때 IdP 로그인 폼을 **200** 으로 주고, 인증 성공 시에는 오히려 302 체인을 태운다 | `contracts/provider.ts:236-246`(`ProviderResponse.finalUrl` 주석) · 제거 전 `browser-session-policy.ts` 의 `classifyProbeChain` |
| 세션 grant 의 정상 체인은 **IdP 를 경유**한다. 리다이렉트 allowlist 를 `provider.origin` 하나로 두면 인증 성공 판정이 영원히 안 나온다 | `auth/api.ts:138-150`(`redirectOrigins`) |
| provider id 는 SDK MCP 서버 이름(`<id>-tools`)과 `${BINDING:<id>}` 파서(`[A-Za-z0-9_-]+`)로 흘러간다 — 범위 밖 문자는 등록·로그인·vault 는 통과하고 **도구 노출만 조용히 깨진다** | `auth/registry.ts:20-26` · `infra/vars.ts` |
| `checkOutboundRequest` 는 `grantStatus !== 'valid'` 인 요청을 거부한다 → **확인하려면 grant 를 먼저 커밋해야 한다**(닭-달걀) | `auth/policy.ts` · `auth/login.ts:262-268`(`settleGrant` 주석) |
| 사내 서비스는 게이트와 **같은 cookie jar**(`sessionGroup`)를 쓴다 → 게이트 로그인 **전**에 플러그인을 훑으면 살아 있는 연결도 미인증으로 강등되고, 강등되면 `grant_not_valid` 로 스스로 회복하지 못한다 | `auth/login.ts:152-160`(`sweepPlugins` 주석) · `docs/guides/closed-network-extensions.md §1.6` |
| OAuth authorize URL 은 **선언이** 만든다(`ctx` 를 받아 URL 을 조립). 선언이 state 값을 얻는 통로는 `ctx.state()` **하나뿐** → 미호출 = 미전송(추론이 아니라 필요조건) | `auth/oauth-runner.ts:61-76` · `auth/oauth.ts:28-34` |
| 게이트 화면은 DEV 에서 항상 뜬다(선언 0개여도) — 로그인 화면을 개발 중 계속 봐야 하므로. 탈출구는 `Settings.authBypass` 하나 | `gate/index.ts:26-33` · `app/bootstrap.ts:295-300` |
| 현행 provider 스코프 테스트: **21 파일 / 314 케이스** (전량 pass) | `npx vitest run src/main/features/providers` (2026-08-11 실측) |

## 인수 기준 (Acceptance Criteria)

> 검증 수단은 **실재하는 케이스 이름**으로만 적었다. 파일 경로는 `app/src/main/features/providers/` 기준.

| # | 인수 기준 | 검증 수단 (`파일::케이스`) | 프로덕션 도달 경로 |
|---|---|---|---|
| 1 | 복원만 된 grant 로는 게이트가 **열리지 않는다** (재시작하면 확인이 풀린다) | `gate/gate.test.ts::"복원됐지만 이번 실행에서 미확인인 grant 는 게이트를 열지 않는다"` · `auth/login.test.ts::"재시작하면 세션 grant 가 valid 여도 확인은 풀린다 (로그인 화면이 다시 뜬다)"` | `handlers/providers.ts` → `ProviderPlatform.state()` → `evaluateGate` |
| 2 | 로그인 성공 직후에는 그 실행 안에서 확인이 **성립한다** | `auth/login.test.ts::"로그인 성공 직후에는 확인이 성립한다"` | `orca:provider:login` → `LoginService.begin` → `store.put` |
| 3 | 해제·401 강등은 확인을 **함께 푼다** (게이트가 다시 닫힌다) | `auth/login.test.ts::"해제·401 강등은 확인을 함께 푼다"` | `orca:provider:revoke` / `ProviderApiImpl.request` 401 분기 → `store.markExpired` |
| 4 | 게이트 멤버가 **하나라도** 미확인이면 차단된다 | `gate/gate.test.ts::"멤버 하나만 미확인이어도 차단된다"` | 위 AC1 과 같음 |
| 5 | 부팅 시 복원된 세션 쿠키가 살아 있으면 **창 없이** 통과한다 | `auth/login.test.ts::"probe 가 2xx 면 창 없이 자동 로그인으로 통과한다"` | `Bootstrap.start()` → `void providers.resume()` → `LoginService.resume` |
| 6 | 부팅 확인에 실패하면 **강등하고 로그인 화면에 남는다** (grant 는 지우지 않아 어느 provider 인지 보인다) | `auth/login.test.ts::"probe 가 실패하면 강등하고 로그인 화면에 남는다"` | 위와 같음 |
| 7 | grant 가 없으면 probe 를 **치지 않는다** (첫 실행이 네트워크를 두드리지 않는다) | `auth/login.test.ts::"grant 가 없으면 probe 를 치지 않는다 — 처음부터 수동 로그인이다"` | 위와 같음 |
| 8 | **값형도** 부팅 때 probe 로 확인한다 — 서버가 이미 회수한 PAT 면 강등된다 | `auth/login.test.ts::"값형도 부팅 때 probe 로 확인한다 — 서버가 거부하면 강등된다"` | 위와 같음 |
| 9 | 로그인 직후에도 **probe 가 통과해야** `done`(연결됨)이 된다 | `auth/login.test.ts::"probe 가 통과해야 연결됨이 된다"` | `orca:provider:login` → `settleGrant` |
| 10 | 서버가 값을 거부하면 연결되지 않고 **같은 입력 폼**으로 돌아온다(사유 포함) | `auth/login.test.ts::"서버가 거부하면 연결되지 않고 같은 폼으로 돌아온다"` | 위와 같음 → `input-required` |
| 11 | 확인이 끝나기 **전에는** renderer 로 state 를 쏘지 않는다 (게이트가 한 순간 열렸다 닫히지 않는다) | `auth/login.test.ts::"probe 가 끝나기 전에는 renderer 로 아무것도 쏘지 않는다"` | `commit(…, notify=false)` → `onChange` → `broadcastProviderState` |
| 12 | **`probe` 미선언**(미지정 케이스)이면 왕복 없이 현행대로 저장한다 — 선언만으로 기존 배포가 잠기지 않는다 | `auth/login.test.ts::"probe 미선언이면 왕복 없이 현행대로 저장한다"` · `auth/login.test.ts::"실행 통로가 없으면 확인을 건너뛴다 — 선언만으로 잠기지 않는다"` | `probeOk` 조기 반환 |
| 13 | **2xx 라도** 체인이 IdP 에 머물면 미인증으로 판정한다 (0174 규칙 보존) | `auth/login.test.ts::"2xx 라도 체인이 IdP 에 머물면 미인증이다"` | `probeOk` → `ProviderResponse.finalUrl` |
| 14 | 브라우저 세션 로그인도 **같은 probe** 로 확인된다 (`doneUrlPrefix` 도달만으로 성공을 선언하지 않는다) | `auth/login.test.ts::"브라우저 세션 로그인도 probe 로 확인한다"` · `auth/specs/browser-session.test.ts::"창이 완료되면 session grant 를 만든다"` | `SessionRunner.login` → `absorb` → `settleGrant` |
| 15 | `kind:'gate'` 인데 `probe` 가 없는 선언은 **등록 거부**된다 (확인 없이 통과하는 게이트 = 우회) | `auth/registry.test.ts::"probe 없는 게이트는 거부하고 나머지는 등록한다"` | `registerProviders` (부팅 시 1회) |
| 16 | 케밥 소문자가 아닌 provider id 는 **등록 거부**된다 | `auth/registry.test.ts::"케밥 소문자가 아닌 id 는 거부한다"` | 위와 같음 |
| 17 | 도구 호출이 **선언의 id 로** 나간다 — 선언이 id 를 다시 적을 자리가 없다 (`unknown_provider` 회귀) | `service/index.test.ts::"도구 호출이 선언의 id 로 나간다 (unknown_provider 회귀)"` · `service/index.test.ts::"컨텍스트를 선언으로부터 만든다 — id 를 다시 적을 자리가 없다"` | `serviceTools.sync` → `provider.tools(ctx)` → 에이전트 도구 호출 |
| 18 | `orca:provider:list` 가 모델이 보는 **도구 완전 이름**을 싣는다(없으면 `[]`) | `service/index.test.ts::"도구를 선언하지 않은 provider 는 조회에서 null 이다"` (+ `ProviderPlatform.info` 의 `toolNames` 합성) | `orca:provider:list` → `platform.list()` → `toolsOf` |
| 19 | 플러그인 상태 갱신은 **게이트가 통과한 뒤에만** 돈다 (같은 cookie jar 를 미인증으로 강등시키지 않는다) | `auth/login.test.ts::"게이트가 통과해야 플러그인을 훑는다 — 순서가 규칙이다"` · `auth/login.test.ts::"게이트 통과 후 플러그인 상태를 갱신한다"` | `resume()` / `settleGrant`(gate) → `sweepPlugins` |
| 20 | 게이트 선언이 0개면 부팅 직후 바로 플러그인을 훑는다 (`every` 빈 배열이 참) | `auth/login.test.ts::"게이트 선언이 없으면 부팅 직후 바로 훑는다"` | 위와 같음 |
| 21 | state 를 **보냈으면** 콜백 echo 를 요구하고, **안 보냈으면** 요구하지 않는다 (loopback·window 양쪽) | `auth/oauth.test.ts::"state 를 보냈는데 안 돌아온 콜백은 거부한다"` · `::"state 없는 콜백으로 교환까지 간다"` · `::"loopback 분기에서도 같다"` | `OAuthRunner.authorize` → `absorbCallback` |
| 22 | 보낸 적 없는 state 가 실려 오면 **판정에 쓰지 않고 기록만** 한다 | `auth/oauth.test.ts::"보낸 적 없는 state 가 실려 오면 통과시키되 기록한다"` | 위와 같음 |
| 23 | 게이트 화면이 자동 로그인 진행을 표시한다(`resuming`) — 버튼이 멈춘 것처럼 보이지 않는다 | **사람 실기 — 실행 경로**: DEV 빌드로 앱 기동 → 게이트 선언이 있는 배포에서 재시작 → 로그인 화면 상단에 `gate.resuming` 문구가 뜨고 폼이 busy 인지 확인 (`GateLogin.tsx:105-111`) | `orca:provider:state` push → `useProviderGate` → `GateLogin` |
| 24 | 문서 SSOT 가 코드와 일치한다 — `IPC_CONTRACT.md` 의 게이트 통과 규칙·step 목록·재인증 보장, `arch/backend/providers.md` 의 모듈 인벤토리 | **grep 대조**: `rg "verified" docs/IPC_CONTRACT.md` 1건 이상 · `rg "resuming" docs/IPC_CONTRACT.md` 1건 이상 · 인벤토리 줄 수 = `wc -l` 실측 | 사람이 읽는 정본(다음 핸드오프의 설계 입력) |

## 범위 / 비범위

- **범위**: `features/providers` 의 **인증 판정 근거**(게이트 통과 · 로그인 직후 · 부팅 복원),
  `service` 도구 컨텍스트 바인딩, OAuth state 전송 원장, 그리고 위 변경이 건드리는 문서 SSOT.
- **비범위**:
  - 실제 폐쇄망 선언 값 채우기(0181 OQ1/OQ2 — `declarations/` 는 여전히 비어 있다).
  - probe 실패의 **재시도·백오프**. 지금은 부팅 1회 + 사용자 재시도뿐.
  - `resuming` 중 사용자가 수동 로그인을 눌렀을 때의 경쟁(폼이 busy 로 잠긴다 = 회피).

| 미룬 항목 | 나중에 하면 더 비싼가 (일방향인가) |
|---|---|
| probe 재시도/백오프 | 아니오 — `probeOk` 내부 정책이라 호출자 계약이 안 바뀐다 |
| 폐쇄망 실값 | 아니오 — `declarations/` 3파일만 채운다(계약 불변) |
| **`Provider.probe` 필드 이름·형상** | **예 — 일방향이었다.** 배포가 고치는 선언 파일의 공개 필드이므로 이름이 나가면 개명 비용이 붙는다. 그래서 미루지 않고 이번에 확정했다(`{path, method?}`, origin 기준 상대 경로 — `whoami`·`exchange` 와 같은 규칙) |
| **`ProviderInfo.tools` 이름 형식**(`mcp__<serverId>__<tool>`) | **예 — 일방향.** GUI 에 노출되고 승인 설정·프롬프트가 쓰는 이름과 같아야 하므로 이번에 `adapters/runtime-tool-policy.ts` 규칙에 맞춰 확정 |

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈에 기댄다: `ProviderApi.request`(전송·정책·401 강등), `infra/vault`(safeStorage),
  `electron-store` 영속, Chromium `persist:` 파티션의 쿠키 복원.
- **신규 의존성: 0건.** `AbortSignal.timeout` 은 Node 내장.
- 전제: 부팅 시점에 네트워크가 없을 수 있다(VPN 이전) → probe 실패는 "수동 로그인 필요" 로 접고
  **던지지 않는다**.

## 설계

판정 지점을 **하나로 접고**, 그 하나를 *사용 경로와 같은 통로*로 실행한다.

**F1 — 게이트 통과 근거를 `기록` 에서 `이번 실행의 확인` 으로 옮긴다** (`397d48b`)
`ProviderStore` 에 프로세스 수명의 `verified: Set<string>` 을 둔다. `restore()` 는 채우지 않고,
`put()`(로그인 성공)·`markVerified()`(자동 로그인)만 채우며, `revoke()`·`markExpired()`(401)는
푼다. `evaluateGate` 는 `status==='valid' && verified` 를 본다. **영속하지 않는다** — 디스크에
남기는 순간 영구 bypass 가 그대로 돌아온다.

**F2 — 부팅 자동 로그인** (`2350a42`)
컴포지션 루트가 `void providers.resume()` 로 **await 없이** 1회 부른다(부팅을 붙들지 않는다).
그동안 게이트는 닫혀 있고 renderer 는 `step:'resuming'` 을 표시한다. 성공하면 화면이 넘어가고
실패하면 그 자리에서 수동 로그인 버튼이 살아난다.

**F3 — 판정을 `Provider.probe` 하나로 통일한다** (`cc57477`)
- 계약: `Provider.probe?: {path, method?}` — `origin` 기준 상대 경로. `kind:'gate'` 는 **필수**
  (등록 검사 `missing_probe`).
- 실행: `ProviderApi.request` 한 줄. **grant 를 먼저 커밋한 뒤** 부르므로 세션이면 cookie jar,
  값형이면 `present` 로 실리는 것을 `transport()` 가 이미 갈라 준다 → **검증 경로 = 사용 경로**.
- 판정: `ok && 최종 URL 의 origin === provider.origin`(0174 규칙 보존). `ProviderResponse` 에
  `finalUrl` 을 더해 그 값을 노출한다.
- 실패 처리: `settleGrant` 가 되돌린다. 입력 폼이 있는 방식은 **같은 폼**(`input-required` + 사유),
  없는 방식(OAuth·브라우저 세션)은 `failed(reason:'probe_failed')`.
- 통지 억제: 확인 전에는 `onChange` 를 쏘지 않는다(`commit(..., notify=false)`).
- 순서 규칙: 게이트가 통과한 **뒤**에 `sweepPlugins()` 로 나머지 provider 를 훑는다.
- 정리: `BrowserSessionConfig.authenticationProbeUrl` · `SessionAuthenticator.verify` ·
  `BrowserSessionPort.probe` · `classifyProbeChain`/`classifyProbeResponse` 를 제거한다(소비자 소멸).

**F4 — 도구 컨텍스트를 provider 로부터 만든다** (`cc57477`)
`Provider.tools: (ctx: ProviderToolContext) => RuntimeToolServer`. `ctx` 는 `{providerId, label,
origin, request}` 로 **선언이 id 를 적을 자리를 없앤다**. 부수적으로 `registry` 에 id 형상 검사를
더하고(`invalid_id`), GUI 가 `id` 와 **도구 완전 이름**을 보여 대조 근거를 만든다.

**F5 — state 전송 여부를 원장에 남긴다** (`8d32745`)
`AuthCtx.state()` 호출 여부를 `stateSent` 로 기록해 `PendingAuthorization` 에 싣는다. 콜백 대조는
`stateSent` 일 때만 강제한다. **`undefined` 는 `true` 로 읽는다**(구 레코드가 조용히 관대해지지
않게 — fail-closed).

| 신규 모듈 / 표면 | 책임 | 레이어 | 테스트 방법 |
|---|---|---|---|
| `ProviderProbe` (계약) | 인증 확인 endpoint 선언 | `main/contracts` | 타입 — 소비 지점(`probeOk`)을 순수 테스트로 |
| `LoginService.probeOk` / `settleGrant` / `resume` / `sweepPlugins` | 확인 실행·되돌림·부팅 복원·순서 | `main/features/providers/auth` | `api`·`store`·`registry` 를 페이크로 주입한 순수 단위 (electron 무의존) |
| `ProviderStore.verified` | 이번 실행의 확인 집합 | 〃 | 순수 단위 |
| `ProviderToolContext` | provider 에 묶인 좁은 포트 | `main/contracts` | `service/index.test.ts` 가 request 통로를 스파이 |
| `ServiceToolRegistrar.descriptorFor` | GUI 노출용 도구 이름 조회 | `main/features/providers/service` | 순수 단위 |
| `PendingAuthorization.stateSent` | state 전송 원장 | `main/features/providers/auth` | `oauth.test.ts` 순수 단위 |

## 기존 결정·규칙과의 관계

> 본문(§설계·§파생 UX·§범위)을 다 쓴 뒤 채웠다.

| 기존 결정 / 규칙 | 출처 | 본문에서 건드리는 문장 | 이번 변경 |
|---|---|---|---|
| **게이트 진리표 — "멤버가 전부 `valid` 면 통과"** | `gate/index.ts` 진리표 주석(0181) · `IPC_CONTRACT.md §2.13-c` | §설계 F1 의 "`status==='valid' && verified` 를 본다" | **뒤집음** — `valid` 는 필요조건일 뿐이다. 세션 grant 가 기록만으로 영구 `valid` 라 진리표가 우회를 만들었다(실기 확인) |
| **"자동 로그인은 창이 즉시 닫히는 것이며 별도 검증 경로를 두지 마라"**(사용자 결정 2026-08-11) | `gate/index.ts:31-38` 주석(`397d48b`) | §설계 F2 전체 | **뒤집음(사용자 재결정)** — 그대로면 재시작마다 창이 뜬다. `2350a42` 가 창 없는 probe 로 대체했고, 주석의 그 문장도 함께 지워야 한다(→ 파생 이슈 D3) |
| **판정은 electron 비의존 순수 모듈에 둔다**(0157 D1·D7 / 0174) | `infra/browser-session-policy.ts:1-8` 헤더 주석 | §설계 F3 의 "판정: `ok && 최종 URL origin` … `probeOk`" | **유지(이관)** — 규칙은 그대로 살리고 위치만 `login.ts` 로 옮겼다. `probeOk` 도 electron 무의존이라 순수 테스트가 계속 가능하다 |
| **0174 실기 교정 — "3xx=미인증" 이 아니라 "최종 origin 복귀"** | `browser-session-policy.ts` 의 `classifyProbeChain` 주석 | §설계 F3 의 "0174 규칙 보존" · AC13 | **유지** — 모듈은 지웠지만 규칙과 그 근거 주석은 `contracts/provider.ts:236-246` 으로 옮겼다 |
| **`tools` 는 `ProviderApi` 전체를 받는다** | `declarations/service.ts` 레시피 주석(0181) | §설계 F4 | **뒤집음** — 넓은 포트가 id 를 손으로 적게 만들었다. 좁은 `ProviderToolContext` 로 교체 |
| **`origin` 에 경로를 붙이지 않는다**(등록 검사) | `auth/registry.ts` · `declarations/service.ts` | §설계 F4 의 "id 형상 검사를 더하고" | **유지 + 확장** — origin 검사는 그대로, id 검사를 같은 자리에 추가 |
| **IPC 변경은 `IPC_CONTRACT.md` 동시 갱신**(저장소 규칙) | `docs/AGENTS.md` 원칙 5 · `IPC_CONTRACT.md §6` | AC24 | **유지** — 채널 수는 안 바뀌고(76) 페이로드 타입 3곳이 바뀐다: `ProviderInfo.tools` 추가 · `ProviderStepInfo`+`resuming` · `ProviderFailureReason`+`probe_failed` |
| **`Criteria-Met` 은 테스트가 있는 기준만 센다** | `docs/handoff/AGENTS.md` | §게이트 | **유지** — AC23 은 사람 실기라 카운트에서 뺀다 |
| main 레이어 DAG(app → features → contracts → adapters → infra → shared), feature 교차 import 금지 | `app/src/main/AGENTS.md` · `eslint.config.mjs`(boundaries) | §설계의 레이어 열 | **유지** — `login.ts`(features) 가 `contracts` 를 읽고 `infra` 를 직접 안 문다. 확인 통로는 주입된 `api` |

## 파생 UX / 엣지케이스 (Derived UX & Edge Cases)

- **부팅 중 상태**: probe 가 도는 동안 게이트는 **닫힌 채**다. 표시가 없으면 "버튼이 멈춘"
  화면이 되므로 `resuming` step + 폼 busy 로 진행을 알린다(`GateLogin.tsx:44-46,105-111`).
- **네트워크 없음(VPN 이전)**: `resume` 은 던지지 않고 전부 "수동 로그인 필요" 로 접는다.
  로그는 `providers.probe.failed{reason}` 로 남아 원인을 가른다.
- **응답 없는 SP**: probe 왕복에 **15초 상한**(`PROBE_TIMEOUT_MS`). 없으면 로그인 invoke 가
  매달리고 부팅 복원에서는 게이트가 영영 안 열린다.
- **재인증 실패**: 값형은 새 값을 **같은 vault 키**에 쓴 뒤 확인하므로 되돌림이 이전 값도 지운다
  → §리스크 OQ1.
- **선언에서 방식이 사라진 빌드**: 복원된 grant 의 `authKind` 가 선언에 없으면 통과시키지 않는다
  (`restorable` 이 `status==='valid'` 를 요구 → 강등된 grant 는 probe 대상에서 빠진다).
- **게이트 0개 배포(OSS/기본)**: `every` 가 빈 배열에 참이므로 부팅 직후 바로 `sweepPlugins` 가
  돈다 — 게이트 없는 배포에서 서비스 연결이 갱신되지 않는 구멍을 막는다.
- **DEV 우회 토글**: `bypass` 가 켜지면 `verified` 와 무관하게 통과한다(진리표 최상단 유지).

## 리스크 / 트레이드오프 (Risks & Trade-offs)

| 리스크 / 트레이드오프 | 완화책 / 결정 |
|---|---|
| **매 실행 probe 왕복이 부팅 경로에 붙는다** | `await` 하지 않는다. 게이트가 닫힌 동안 도는 것이라 사용자 대기 시간이 아니라 *로그인 화면 체류 시간*이다 |
| **KMSI 없는 ADFS 배포는 매번 수동 로그인이 된다** | 세션 쿠키만 내리면 복원될 쿠키가 없어 probe 가 항상 실패한다. `providers.probe.result{ok,status,returned}` 로그로 진단 가능하게 남겼다(`arch/backend/providers.md` 의 운영 주석) |
| **게이트 로그인 invoke 가 `sweepPlugins` 를 await 한다** — 서비스 provider N개 × 최대 15초 | 현행 배포는 `SERVICE_PROVIDERS = []` 라 N=0. 폐쇄망에서 N 이 커지면 로그인 응답이 늦어진다 → 파생 이슈 D1 |
| **판정을 한 지점에 모은 대가**: probe endpoint 가 죽으면 그 provider 는 어떤 방식으로도 연결되지 않는다 | 의도된 fail-closed. 게이트에 `probe` 를 **필수**로 만든 것과 같은 결정("확인 없이 통과하는 게이트 = 우회") |
| `verified` 가 메모리라 **main 프로세스 재시작 = 재확인** | 의도. 영속하면 원래 버그가 그대로 돌아온다(`store.ts:41-47` 주석에 못 박음) |

- 되돌리기 어려운 결정: `Provider.probe` 필드 형상, `ProviderInfo.tools` 이름 형식,
  `Provider.tools` 시그니처(선언 파일의 공개 표면).
- **단독 결정 금지 항목(Open Question) → 사용자에게**:
  **OQ1 — 재인증(`orca:provider:reauth`) 이 probe 에 실패했을 때 이전 자격증명을 잃는 것을
  받아들일 것인가.** 현행 계약 문장("실패하면 이전 자격증명으로 계속 쓸 수 있다")과 모순된다.
  선택지 ⓐ 계약 문장을 현행 동작에 맞춰 고친다(지금 상태) ⓑ 재인증만 **임시 키**로 확인한 뒤
  성공 시에만 덮는다(구현 필요). → verify D2.

## 영향 받는 파일

- 계약/공유: `app/src/main/contracts/provider.ts` · `app/src/shared/ipc.ts`
- main: `app/src/main/app/bootstrap.ts` · `features/providers/{platform.ts, gate/index.ts,
  auth/{store.ts, login.ts, registry.ts, api.ts, oauth.ts, oauth-runner.ts,
  specs/browser-session.ts}, service/{index.ts, confluence/tools.ts}, declarations/{sso,llm,service}.ts}`
  · `infra/{browser-session.ts, browser-session-policy.ts}` · `app/src/main/AGENTS.md`
- renderer: `features/providers/components/GateLogin.tsx` ·
  `features/skills/components/customize/ProviderDetail.tsx` · `shared/i18n/resources/{ko,en}.ts`
- 문서: `docs/IPC_CONTRACT.md` · `docs/arch/backend/{providers.md, security.md}` ·
  `docs/guides/closed-network-extensions.md`

## 참고 문서

- `docs/arch/backend/providers.md` (provider 플랫폼 정본 — 게이트 진리표 · 자동 로그인 · probe)
- `docs/IPC_CONTRACT.md §2.13-c` (provider 6채널 — **동시 갱신 대상**)
- `docs/guides/closed-network-extensions.md §2~§5` (선언 레시피 — `probe` 필수 표기)
- `docs/arch/backend/security.md §1.4-b` (노출 경계)

## 게이트

- 통과 필요: `cd app && npm run lint && npm run typecheck && npm test`.
- 신규 테스트 요구: 게이트 진리표(순수) · `LoginService` 확인/복원/순서 · 등록 검사 2종 ·
  도구 컨텍스트 바인딩 · OAuth state 4분기.

## 설계 self-review 체크리스트 (READY 전)

- [x] 사용자 의도 — 명시 요구를 라이브 세션 요청 + 커밋 인용으로 표기, 추론은 추론으로 표기.
- [x] 자료조사 — 모든 발견에 `파일:라인` 레퍼런스.
- [x] 의존 기술 — 신규 의존성 0건임을 명시.
- [x] 파생 UX — 부팅 중/네트워크 없음/타임아웃/재인증 실패/게이트 0개를 펼쳤다.
- [x] 리스크 — OQ1 을 사용자 결정으로 분리했다.

**기계적으로 확인 가능한 것**:

- [x] 요구 비판적 검토 5문항 답변 완료. 범위를 줄이지 않았다(4 커밋 전량 + 문서 SSOT 까지 포함).
- [x] 검증 수단 칸 24/24 채움 — AC23 은 "사람 실기 + 실행 경로" 로 명시.
- [x] 부정형/"불변" 기준 0개 (AC 는 전부 양성 단언. AC12 는 "왕복 없이 저장한다" 로 씀).
- [x] AC 상호 모순 점검 — AC5(창 없이 통과) ↔ AC1(복원만으로 안 열림) 은 *확인 여부*로 갈리므로
      모순이 아니다. AC8(값형도 probe) 은 `2350a42` 단계의 "값형은 왕복 안 한다" 를 **의도적으로
      뒤집은 것**이라 그 단계의 테스트(`값형 게이트는 왕복 없이 로컬 근거로 통과한다`)는 AC 에서
      제외했다(현행 코드에 없다).
- [x] 인용 수치 직접 측정 — 21파일/314케이스, 인벤토리 줄 수 `wc -l` 실측.
- [x] 신규 모듈마다 테스트 방법 + electron 무의존 seam 명시.
- [x] 전수 조사 N 수치 — 뒤집는 기존 결정 3건, 제거된 표면 5종, 문서 드리프트 13건(verify).
- [x] 각 AC 에 프로덕션 도달 경로 (유일 호출자가 테스트인 AC 0개 — AC18 은 `platform.list()` 경유).
- [x] 사람 실기 AC(23) 에 실행 경로가 있고 비범위에 막혀 있지 않다(DEV 빌드로 도달 가능).
- [x] 선택적 필드 판정마다 미지정 케이스 AC — `probe?` → AC12, `stateSent?` → AC21/22.
- [x] 계약 제약 필드의 강제 지점 — `probe`(게이트 필수) → `registry.ts` 등록 시, id 형상 → 같은 자리.
- [x] 참조 구현 전수 — `AuthSpec` 5종(`api-key`·`password`·`pat`·`oauth`·`browser-session`) 전부가
      `settleGrant` 를 지나는지 확인했다(`runCredential` 1 · `absorb` 의 secret/token/session 3).
- [x] 미룬 항목마다 일방향 여부 답변(§범위 표).
- [x] 관문 4 — 기존 결정 표를 본문 훑으며 채웠고, 인용 경로를 `Read`/`rg` 로 열어 확인했다.
- [x] "확정" 서술의 앵커 grep — `IPC_CONTRACT.md §2.13-c` · `arch/backend/providers.md` 게이트
      진리표 절 존재 확인.

---

> **[구현자 기입]** — 이 핸드오프는 구현이 **먼저** 끝났다(커밋 4건). 아래는 그 구현의 사후 보고.

## [구현자 기입] 설계 리뷰 (비판적)

- **동의 / 그대로 진행**: "판정을 계약 한 지점으로 접는다"(§설계 F3)는 실기 4건을 하나로 닫는
  유일한 방법이었다. 방식별로 패치했다면 값형·세션·OAuth 에 판정이 세 벌 남았을 것이다.
- **이견 / 우려 1 — §설계 F2 의 단계적 결론이 F3 에서 뒤집혔다.** `2350a42` 는 "값형은 vault 에
  값이 있는 것이 곧 근거라 왕복하지 않는다" 로 썼고, 같은 날 `cc57477` 이 "값형도 서버만 안다"
  로 뒤집었다. **하루 안에 결론이 반대로 간 것은 설계 문서가 없었기 때문**이다 — plan 이 있었다면
  "만료를 로컬에서 아는 것은 token 뿐" 이라는 §자료조사 한 줄에서 F2 단계에 이미 걸렸다.
- **이견 / 우려 2 — §설계 F3 의 `sweepPlugins` 를 로그인 invoke 안에서 await 하는 것**은
  응답 지연을 만든다(§리스크). 현행 N=0 이라 실기에서 안 보였을 뿐이다.

## [구현자 기입] 놓친 잠재 문제 + 대응 (선조치 후보고)

| # | 놓친 문제 | 대응 | 근거 |
|---|---|---|---|
| 1 | 세션 grant 의 정상 리다이렉트 체인이 IdP 를 경유하는데 `checkRedirect` 가 `provider.origin` 하나만 허용해 **인증 성공 판정이 나오지 않을** 뻔했다 | ✅ 구현함 — `redirectOrigins()` 로 **세션일 때만** 그 spec 의 `allowedOrigins` 를 더한다. 값형에는 넓히지 않는다(자격증명이 다른 host 로 따라가면 안 된다) | `auth/api.ts:138-150` |
| 2 | probe 를 `grant` 커밋 **전에** 부르면 `checkOutboundRequest` 가 `grant_not_valid` 로 막는다 | ✅ 구현함 — 커밋 → 확인 → 실패 시 되돌림(`settleGrant`). 대신 커밋 시 통지를 억제해(`notify=false`) 게이트가 한 순간 열렸다 닫히는 것을 막았다 | `auth/login.ts:255-275` |
| 3 | 게이트 로그인 **전에** 플러그인을 훑으면 같은 cookie jar 의 살아 있는 연결이 강등되고, 강등되면 스스로 회복하지 못한다 | ✅ 구현함 — `sweepPlugins` 는 게이트 통과 후에만 돈다(AC19/20) | `auth/login.ts:145-168` |
| 4 | provider id 가 `${BINDING:}` 파서 범위 밖이면 **도구 노출만 조용히 깨진다** | ✅ 구현함 — 등록 검사에 `invalid_id` 추가(AC16) | `auth/registry.ts:20-26,58-65` |
| 5 | probe 응답이 없으면 로그인 invoke 가 매달린다 | ✅ 구현함 — `PROBE_TIMEOUT_MS = 15_000` | `auth/login.ts:50-53` |
| 6 | `stateSent` 가 없던 시절의 pending 레코드가 **조용히 관대해진다** | ✅ 구현함 — `undefined` 를 `true` 로 읽는다(fail-closed) | `auth/oauth.ts:28-34` |
| 7 | **문서 SSOT 가 코드를 따라가지 않았다** — `IPC_CONTRACT.md` 의 게이트 통과 규칙·step 목록·재인증 보장 3건, `arch/backend/providers.md` 모듈 인벤토리 13건 | ✅ 구현함 — 이 핸드오프 커밋에서 마감(AC24). **원 커밋 4건은 이 부분을 빠뜨렸다**(사후 작성이 아니었다면 게이트에 걸렸을 항목) | verify §역방향 탐색 |
| 8 | 재인증 실패 시 이전 자격증명 소실 | ⚠️ **보고만 · 결정 필요** — 계약 문장과 모순이고, 되돌림 방식을 바꾸는 것은 제품 판단이다 | §리스크 OQ1 · verify D2 |

## [구현자 기입] 구현 체크리스트

- [x] F1 게이트 통과 근거 이전 (`verified`)
- [x] F2 부팅 자동 로그인 (`resume` + `resuming` step)
- [x] F3 판정 `Provider.probe` 통일 + 구 판정 표면 5종 제거
- [x] F4 도구 컨텍스트 바인딩 + id 형상 검사 + GUI 대조 표면
- [x] F5 OAuth state 전송 원장
- [x] 문서 SSOT 동기화 (IPC_CONTRACT · providers.md · closed-network-extensions · security)

## [구현자 기입] 구현 보고

| 항목 | 내용 |
|---|---|
| 변경 파일 | §영향 받는 파일 (커밋 4건 합계 **43 파일**) |
| 실행 명령 | `cd app && npm ci && npm run lint && npm run typecheck && npm test` |
| 게이트 결과 | lint ✅ 0 error / 1 warning(0102 베이스라인 — `useTranscriptVirtualizer.ts` react-compiler) · typecheck ✅ 3/3 · test ✅ vitest **192 파일 1708 케이스** + scripts **28** 전량 pass |
| 블로커 / 역질문 | OQ1(재인증 실패 시 이전 자격증명) — 사용자 결정 필요 |
| 대상 커밋 | `397d48b` · `2350a42` · `cc57477` · `8d32745` (+ 본 핸드오프 문서·SSOT 커밋) |

---

## [검증자 기입] 파생 이슈 (Derived Issues)

> verify r1 이 채웠다. 상세는 `verify.md`.

| # | 이슈 | 출처 | 대응 방향 | 상태 |
|---|---|---|---|---|
| D1 | 게이트 로그인 invoke 가 `sweepPlugins` 를 await → 서비스 provider N개 × 최대 15초 지연 | verify r1 역방향 탐색 | 게이트 확정 후 **비동기**로 훑고 `onChange` 로 따라잡게 한다(현행 N=0 이라 실해 없음) | open |
| D2 | 재인증 probe 실패가 **이전 자격증명까지** 지운다 — `IPC_CONTRACT` 재인증 보장과 모순 | verify r1 · 구현자 §놓친 문제 8 | **사용자 결정(OQ1)**: ⓐ 계약 문장 정정(임시 조치로 반영함) ⓑ 임시 키로 확인 후 덮기 | open |
| D3 | `gate/index.ts:31-38` 주석이 **폐기된 사용자 결정**("별도 검증 경로를 두지 마라")을 여전히 못 박고 있다 — 다음 설계자가 이 문장을 근거로 읽는다 | verify r1 | 주석을 F2/F3 결과로 갱신(문장 교체) | open |
| D4 | `PendingAuthorization.stateSent` 가 **영속 왕복에서 사라진다**(`parsePending` 이 필드를 안 싣는다). 현재는 fail-closed 라 무해하지만 계약 필드가 저장에서 유실된다 | verify r1 역방향 탐색 | `parsePending` 에 `stateSent` 추가 + 왕복 테스트 | open |
| D5 | `ProviderProbe.method` 를 실제로 쓰는 테스트가 없다(전 케이스가 기본 GET) | verify r1 | `method:'HEAD'` 케이스 1건 추가 | open |
