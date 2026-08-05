# Plan — 0175-simplify-156-174-cleanup

> 정본 규칙은 [`../AGENTS.md`](../AGENTS.md) §1.

## 메타

| 항목 | 값 |
|---|---|
| slug | `0175-simplify-156-174-cleanup` |
| 작성자 | Claude Code |
| 일자 | 2026-08-05 |
| 매핑 | PHASES Phase 4 행 (0156~0174 계열 /simplify 정리) |
| 상태 | READY |

## 사용자 의도 / 요구 출처 (Intent & Provenance)

| 구분 | 내용 | 출처 |
|---|---|---|
| 명시 요구 | `/simplify 핸드오프 156~174` — 0156~0174 가 도입한 코드를 4관점(재사용·단순화·효율·altitude)으로 정리한다 | 라이브 세션 요청 (2026-08-05) |
| 명시 절차 | `/simplify` 스킬 정의가 **4개 리뷰 에이전트 병렬 기동**을 지시한다 — 사용자가 그 스킬을 호출한 것이 곧 서브에이전트 사용 요청이다(0155 가 에이전트를 못 쓴 제약과 다른 점) | `.claude/skills` `/simplify` 정의 |
| 추론 의도 | "정리" = **동작 보존** 품질 개선. 관찰 가능 동작·렌더 DOM·클래스·a11y 속성·IPC 채널/스키마는 불변 (추론) | `/simplify` 스킬 정의 + `0131`·`0149`·`0155` 선례 |
| 추론 의도 | 버그 사냥은 범위 밖(`/code-review` 몫). 다만 **정리 과정에서 규칙이 두 벌이라 갈릴 수 있는 지점**은 한 벌로 접는 것이 정리의 본체다 | `/simplify` 스킬 정의 |

## Context (왜)

`887292b9..HEAD` 의 `app/src` 변경(**261 파일 · +26,951/−2,793**, 커밋 100개)이 리뷰 구간이다.
`887292b9` 는 직전 /simplify 핸드오프 **0155** 의 마지막 커밋(검증+PHASES 승격)이라 그 이후
전체가 0156~0174 범위에 대응한다.

| 핸드오프 | 성격 |
|---|---|
| `0156-update-check-interval` | 앱 시작 기준 주기 업데이트 확인 + 설정 노출 |
| `0157-auth-plugin-platform` | **`features/sso` → `features/auth-platform` 전면 교체** (provider registry·transaction·binding·broker) |
| `0158-builtin-tool-plugin-host` | 내장 MCP runtime tool 플러그인 호스트 |
| `0159`~`0164` | 플러그인 카탈로그 페이지 · Confluence connector · 템플릿/인스턴스 · 빌드타임 서버 고정 |
| `0165`~`0167` | 취소 잔여 · 세션 체인 lease · 활동 투영(activity projection) |
| `0168`~`0171` | Confluence 이미지 회귀 · 멘션 · binding 복원 · 첨부 405/sourceUrl |
| `0172`~`0174` | 다중 provider 로그인 체인 · **Electron `net` 전송 전환** · SSO 리다이렉트 의미론 |

**이 묶음의 성격.** 한 인증 플랫폼이 19개 핸드오프에 걸쳐 **점증적으로** 자랐다. 각 라운드가
자기 자리에서 필요한 판정을 새로 적은 결과, **같은 규칙이 두세 벌로 갈라진 자리**가 이 구간의
지배적 결함 유형이다 — 그리고 그 규칙들이 하필 *credential 이 어디로 나가는지* 를 정하는
것들이다(origin allowlist · 리다이렉트 Location 해석 · binding 형상).

특히 두 자리는 **파일 자신의 주석이 "두 벌이면 갈린다" 고 경고하면서 바로 아래에서 두 벌을
만들고 있었다**:

- `policy.ts` 는 `isAllowedOrigin` 을 *"두 벌이면 규칙이 갈린다(0157 verify r1)"* 는 주석과 함께
  import 해 놓고, 15줄 아래에서 본문이 동일한 `isOriginAllowed` 를 다시 정의하고 **그쪽을** 썼다.
- `manifest.ts` 는 `PLUGIN_ID_PATTERN` 을 *"규칙을 두 벌 복붙하면 조용히 갈라진다(0158 verify r1
  D4)"* 는 주석과 함께 shared 에서 가져온 뒤, 두 선언 아래에서 origin 규칙을 손으로 다시 적었다.

**깨끗함이 확인된 것**(재발견 아님, 4에이전트 조사 결과):

- `limit.ts`/`mapWithLimit` 이 Confluence 페이지·첨부 취득을 **경계 세마포어로 올바르게 병렬화**
  한다 — 이 구간 어디에도 순차 `await` 루프가 없다.
- `PluginHost.onBindingsEnded`·`ConnectorHost.stopByBinding` 은 `Promise.all` 을 쓴다.
- `chat-turn.ts` 의 `wc.once(...)` 리스너는 전부 `finally` 의 `removeListener` 와 짝지어져 있다.
- 스케줄러 `intervalHandle` 은 `unschedule`/`stopAll` 로 정지 경로가 이어져 있고, `sameSpec` 이
  무관한 설정 쓰기에서의 재-anchor 를 막는다.
- `RuntimeToolRegistry`·`adaptRuntimeTools`·`runtime-tool-policy`·`netFetch`/`sendOnce` 분리 —
  범용 경로에 plugin-id·provider-name 분기가 **하나도 없다**.
- `ConnectorHost.stopByBinding` 이 `ConnectionRegistry.removeByBinding` 대신 인라인
  `filter`+`removeIfSame` 을 쓰는 것은 **중복이 아니라 의도된 레이스 가드**다(재연결이 연결
  객체를 갈아끼운 경우를 지운다) — 단순화 제안을 기각하고 미사용 `removeByBinding` 쪽을 지웠다.

## 자료조사 (Research)

> `/simplify` 절차대로 **4관점 리뷰 에이전트를 병렬 기동**했다(재사용·단순화·효율·altitude).
> 총 47건 보고 → 같은 기전을 가리키는 것 dedup → 아래로 수렴.

| 발견 / 제약 | 레퍼런스 |
|---|---|
| origin allowlist 판정이 **네 벌**이다 — `session-policy.isAllowedOrigin`(정본) · `policy.isOriginAllowed`(동일 본문 복제) · `broker.ts` 의 `allowedOrigins.includes(safeOrigin(url))` · `manifest.OriginSchema`. `safeOrigin` 도 두 벌이고 폴백이 서로 다르다(`'<invalid-url>'` ↔ `''`) | `policy.ts:9-11,30` · `broker.ts:725,825` · `manifest.ts:22` |
| 리다이렉트 Location 해석이 **두 벌**이다 — `net-response.locationOf`(단위 테스트 보유) ↔ `broker.redirectLocation`+`resolveLocation`. 후자가 credential 을 실을 다음 홉을 정한다 | `broker.ts:805,815` ↔ `net-response.ts:58` |
| `redirectFacts` 는 export·테스트돼 있는데 **프로덕션 호출자가 없다** — 유일한 호출 지점이 본문을 인라인했다 | `net-request.ts:85` ↔ `net-response.ts:32` |
| `apiBasePath` 정규식이 **세 벌**(protocol·instance-store·renderer), origin zod 스키마가 **세 벌**(protocol·instance-store·manifest) | `protocol.ts:296,320` · `instance-store.ts:14,27` · `connectorInstance.ts:85` |
| `binding-records.isTarget` 이 손으로 쓴 `AuthTarget` 가드인데 **스키마보다 느슨하다** — `connectionId` 를 아예 안 보고 `applicationId` 는 아무 문자열이나 받는다. 그 `connectionId` 는 `broker.restore()` 가 그대로 읽는 값이다 | `binding-records.ts:27` ↔ `protocol.ts:223` |
| lease 논리 키를 `features/sessions` 가 만들고 `features/chat` 이 **문자열 접두사로 디코드**한다. 교차 feature import 가 금지돼 형식이 두 곳에 손으로 적혀 있다 — 접두사를 바꾸면 투영이 `undefined` 를 받아 **타입 오류 없이** 활동 갱신이 멈춘다 | `session-activity-projector.ts:186` ↔ `session-chain-lease.ts:179` · `supervisor.ts:147`(리터럴 세 번째 사본) |
| `connectorAuthLabels` 가 `buildConnectOptions` 와 **같은 교집합 규칙을 재구현**한다. 주석은 "재사용한다" 고 적혀 있으나 실제로는 복제 — 갈리면 "고를 수 있다고 써놓고 못 고르는" 화면이 된다 | `pluginCatalog.ts:58` ↔ `connectorConnect.ts:35` |
| Confluence `createConfluencePackage` 가 connector·runtimeTool 선언을 **인라인 리터럴로** 적는다. 같은 파일의 `connectorDeclaration`/`runtimeToolDeclaration` helper 가 15줄 위에 있고 인스턴스 경로는 그것을 쓴다. registry 가 전 필드를 대조하고 등록은 패키지 단위 all-or-nothing 이다 | `confluence/index.ts:181` ↔ `:116,129` |
| `AuthBroker` 가 application 게이트 리셋을 **네 번** 반복한다. 오류값과 `publish()` 위치가 자리마다 달라 이미 갈리기 시작했다 | `broker.ts:112,490,602,753` |
| `registry.validatePackage` 의 선언↔구현 1:1 대조가 세 종류에 대해 **양방향 각각** 흩어져 있다. 실제 이력상 provider 만 전 필드 대조가 빠져 있었고 그것이 0164 D1(서버 0개인데 로그인 게이트가 켜짐)의 원인이었다 | `registry.ts:112-147` |
| `updater.patch()` 가 **변화 여부를 보지 않고** 전 webContents 로 broadcast 한다. lease 전이마다 `patch({})` 가 오는데(턴당 5~8회) 대부분 상태를 안 바꾼다 | `updater.ts:244` ← `bootstrap.ts:649` |
| `TurndownService` 를 **페이지마다** 새로 만든다 — `get_pages` 1회에 최대 50개, 매번 gfm 규칙 전량 재등록. 인스턴스는 호출 간 무상태다 | `storage-to-markdown.ts:91` |
| `new Uint8Array(Buffer.concat(chunks))` — `Buffer` 가 이미 `Uint8Array` 라 래핑이 **본문 전체를 한 번 더 복사**한다. 첨부 25MB×동시 4 경로 | `net-request.ts:95` |
| `broker.restore()` 가 **부팅마다 무조건** `adopt()`→`flush()` 로 동기 파일 쓰기를 한다 — 레코드 0건인 기본 설치도 매 실행 쓴다 | `broker.ts:197` → `bindings.ts:69` |
| `StatusLine` 이 심볼 애니메이션 때문에 **200ms 마다** 재렌더되는데, 매 렌더마다 라벨 파생 + N회 `tr()` + `slice`/`push`/`join` ×3 을 다시 돈다. 부모가 `activity` 객체 리터럴을 매 렌더 새로 만들어 memo 가 걸릴 수 없다 | `StatusLine.tsx:88-101` ← `PendingAssistant.tsx:52` |
| `chat-turn.residualBySession` 이 `SessionActivityProjector.residualAttempts` 를 **그림자 복제**한다. 쓰기 3곳이 전부 투영 setter 와 손으로 짝지어져 있고, 투영은 remap·자기치유를 하는데 사본은 안 한다 | `chat-turn.ts:250` ↔ `session-activity-projector.ts:24` |
| `sameFingerprint` 가 5개 식별 필드를 손으로 나열 비교한다 — `BindingFingerprint` 에 필드를 더하고 여기를 잊으면 **다른 binding 을 같다고 판정**한다(시작 도중 binding 교체 감지가 뚫린다) | `plugin-host.ts:317` |
| 죽은 표면: `PendingMessageQueue.openAttemptIds` · `ConnectionRegistry.removeByBinding` · `connectorOriginDisplay`(항등 함수) · `TurnRequest.onInterruptReceipt`(0166 D7 이 `captureInterruptReceipt` 로 대체했으나 계약 필드·`FRAME_DELEGATE_KEYS` 항목·`??` 폴백이 잔존) — 전부 프로덕션 참조 0 | 각 파일 |
| 게이트 제약: `postinstall` 이 better-sqlite3 를 **Electron ABI** 로 빌드하므로 `npm test` 전에 `node scripts/ensure-sqlite-abi.mjs node` 가 필요하다(`pretest` 훅이 하는 일). 안 하면 DB 스위트 41건이 ABI 불일치로 실패한다 | `app/AGENTS.md` "better-sqlite3 ABI" |

## 인수 기준 (Acceptance Criteria)

> 전부 **동작 보존** 전제 — 관찰 가능 동작·렌더 DOM·클래스·a11y 속성·IPC 채널/스키마 무변경.

| # | 기준 | 검증 수단 |
|---|---|---|
| AC1 | origin 판정 구현이 **한 벌**이다. `policy.isOriginAllowed` 와 `broker.safeOrigin` 이 사라지고, connector 경로·redirect 재검사·provider `ctx.fetch` 가 전부 `session-policy.isAllowedOrigin` 을 지난다 | `grep -c` 로 정의 0 확인 + `policy.test.ts`(이름 교체) green |
| AC2 | 리다이렉트 Location 해석이 **한 벌**이다. `broker.redirectLocation`/`resolveLocation` 이 사라지고 `net-response.locationOf` 를 쓴다. **깨진 Location 의 `invalid_redirect` 오류 경로가 보존**된다 | `broker.test.ts` redirect 스위트 8건 green (상대경로·허용밖·홉상한·303·304 포함) |
| AC3 | `locationOf` 가 헤더 이름 **대소문자를 가리지 않고** 값을 trim 한다 — 주입 가능한 전송 포트가 어떤 casing 을 주든 같은 답을 낸다 | `broker.test.ts` `Location`(대문자) fixture green + `net-response.test.ts` green |
| AC4 | `redirectFacts` 의 프로덕션 호출자가 생긴다(`net-request` 인라인 제거) | `grep` 로 호출부 존재 확인 |
| AC5 | origin 술어·`apiBasePath` 패턴의 정본이 **zod 비의존 shared 모듈**(`shared/connector-address.ts`)이고 protocol·instance-store·manifest·renderer 넷이 그것을 쓴다. **renderer 번들에 zod 가 들어가지 않는다** | `grep` 로 사본 0 + renderer 가 `shared/protocol` 을 import 하지 않음 확인 |
| AC6 | `binding-records` 의 target 검사가 `AuthTargetSchema` 를 쓴다 — 디스크 레코드가 IPC 와 같은 형상 기준을 통과한다 | `binding-records.test.ts` green |
| AC7 | lease 논리 키 코덱(encode+decode)이 `shared/lease-key.ts` **한 곳**에 있고, `features/sessions`(생성)·`features/chat`(해석)·`supervisor`(리터럴이던 곳)가 전부 그것을 쓴다 | `grep` 로 접두사 리터럴 0 + 세션/활동 스위트 green |
| AC8 | 수용 provider 교집합 규칙이 `acceptedConnectProviders` **한 함수**이고 연결(강제)·목록(표시) 둘 다 통과한다 | `connectorConnect.test.ts`·`pluginCatalog.test.ts` green |
| AC9 | Confluence 정적 패키지가 `connectorDeclaration`/`runtimeToolDeclaration` helper 로 선언을 파생한다(인라인 리터럴 0) | `confluence-package.test.ts` green |
| AC10 | application 게이트 리셋이 `settleApplicationGate` **한 곳**을 지난다. 네 호출부의 오류값 의미(취소=timeout 만 덮어씀·나머지 3종)와 `publish()` 위치가 **종전과 동일** | `broker.test.ts` 체인/취소 스위트 green |
| AC11 | `validatePackage` 의 선언↔구현 1:1 대조가 세 종류 공통 `checkPairing` 한 곳을 지난다. **오류 문구는 종전 그대로** | `registry.test.ts` 652줄 green(문구 정규식 매칭) |
| AC12 | `updater.patch()` 가 상태 변화가 없으면 broadcast 하지 않는다 | `updater` 스위트 green |
| AC13 | `TurndownService` 가 모듈 단위 지연 싱글턴이다 | `storage-to-markdown.test.ts` 345줄 green |
| AC14 | 응답 본문이 `Buffer.concat` 결과를 **그대로** 나른다(중복 사본 0) | `net-request`/첨부 다운로드 스위트 green |
| AC15 | `broker.restore()` 가 **버린 것도 바뀐 것도 없으면 파일을 쓰지 않는다** | `broker-restore.test.ts` green |
| AC16 | `StatusLine` 의 라벨 파생·번역이 `useMemo` 뒤에 있고, 부모가 `activity` 를 안정 참조로 넘긴다 | typecheck + `react-hooks` lint 0 error |
| AC17 | `residualBySession` 그림자 맵이 사라지고 잔여 attempt 의 소유자가 투영 하나다 | `chat-turn`·활동 투영 스위트 green |
| AC18 | `sameFingerprint` 가 필드를 열거하지 않는다 — 식별 필드를 늘려도 비교가 자동으로 따라온다 | `plugin-host.test.ts` 608줄 green |
| AC19 | 죽은 표면 4종(`openAttemptIds`·`removeByBinding`·`connectorOriginDisplay`·`onInterruptReceipt` 계약 필드+키+폴백)이 제거된다 | `grep` 로 참조 0 |
| AC20 | 게이트: `npm run lint` 0 error(기존 warning 1 = 0102 베이스라인)·`typecheck` 3분할 0 error·`vitest` green. 레이어 경계 위반 0, **신규 의존성 0** | 게이트 로그 |
| AC21 | IPC 채널 수·`NormalizedEvent` variant 집합·zod 요청 스키마·i18n 키가 **불변** | `git diff` 확인 |

## 범위 / 비범위

- **범위**: AC1~AC21 의 동작 보존 정리 + 게이트.
- **비범위** (발견됐으나 이번에 **의도적으로 손대지 않음**):
  - **`SessionRuntimeRegistry` ↔ `SessionChainLeaseRegistry` 이중 소유** (단순화·altitude 양쪽이
    지적). `getRuntimePopulation` 이 3개 제외 집합으로 중복 계수를 피하고, `all()`/`size`/
    `hasSession` 이 각자 화해 규칙을 갖는다. 정리하려면 **소유권 모델을 하나로 접는 설계 결정**이
    필요하다(런타임 cap 계수의 입력이라 회귀 시 조용히 잘못된 풀 크기가 된다) — **별도 핸드오프 대상**.
    이번엔 `getRuntimePopulation` 의 `leases.all()` 5회 재materialize 만 1회 순회로 줄였다.
  - **`SteerFlushBatch.attemptId` 가 항상 `uuid` 와 같다** — 계약 필드 제거는 `chat-turn.ts` 5곳 +
    큐 + 테스트를 함께 옮기는 계약 변경이라 동작 보존 정리의 경계를 넘는다. **별도 핸드오프 대상**.
  - **`ConnectorStatus.health` enum 이 IPC 경계에서 소실되고 renderer 가 한국어 산문을 정규식으로
    되파싱한다**(altitude #1). 플러그인이 문구를 영어로 쓰거나 바꾸면 모든 실패가 `'unknown'` 으로
    떨어진다 — 실재하는 결함이지만 고치려면 **구조화 오류 코드 IPC 계약**을 새로 정해야 한다.
    **별도 핸드오프 대상**(위험도 높음 — 기록 우선).
  - **`browser_session` binding 의 `authenticatedFetch` 가 probe 판정을 응답 모양으로 되돌려준다**
    (altitude #2). ADFS/WIA 로 connector 를 붙이면 본문이 빈 200 이 된다. 전송자 선택 설계가
    필요하다 — **별도 핸드오프 대상**.
  - **`ConnectorTemplate.fields` 가 선언·검증·전송되지만 렌더러가 무시하고 Confluence 3필드를
    하드코딩**(altitude #3) — 두 번째 템플릿을 붙일 때 해소해야 할 설계 부채. 기록만.
  - **`AuthArtifactRef.handleId` 가 vault credential 경로에서 무시된다**(altitude #4) — provider 가
    vault 키 이름 관례를 각자 지키는 구조. 계약 변경이라 범위 밖.
  - **Scheduler·settings-store 가 job 이름을 열거한다**(altitude #9). 두 job 의 설정 **형상이 서로
    다르다**(`{enabled,cron}` ↔ `{enabled,intervalHours}`) — 일반화하려면 컴포지션 루트가 spec 을
    주입하는 구조로 바꿔야 하고 이는 설계 결정이다. **별도 핸드오프 대상**.
  - **`CustomizeList` 의 탭 3분기 복제**(단순화 #9) — spec 테이블로 접을 수 있으나 셀 렌더가
    탭마다 실제로 다르고 시각 회귀 위험이 있다. 사람 실기 없이 바꾸지 않는다 — **의도적 스킵**.
  - **`ActiveConnection` 의 평면 3필드가 `bindingFingerprint` 와 겹치는 점** — 읽기 지점 23곳을
    전부 `active.bindingFingerprint.x` 로 바꾸면 가독성 손해가 이득보다 크다. 실제 위험이던
    `sameFingerprint` 의 손열거만 고쳤다(AC18) — **부분 채택**.
  - **`instance-store.list()` 의 매 호출 zod 재파싱**(효율 #7) — 캐시는 무효화 정합성 위험을
    더하는데 현재 N≈2~5 라 이득이 없다 — **의도적 스킵**.
  - **`broker.readBindingSecret` 의 요청당 keychain 복호화**(효율 #5) — 평문 캐시는 **보안 태세
    변경**이라 정리 범위에서 단독 결정하지 않는다 — **의도적 스킵(기록)**.
  - **`SessionActivityProjector` 의 무한 증가 맵**(효율 #3) — `current()` 가 조회만 해도 스냅샷을
    적재한다. 축출 정책은 동작 변경이라 설계 확인이 필요 — **기록만**.
  - **`auth/store.ts` 의 400ms×5 재시도 루프**(altitude #10) — 제거하면 실재 실패가 드러나는
    방향이라 옳지만, 부팅 순서 계약(`bootWhenReady`)과 함께 봐야 한다 — **별도 핸드오프 대상**.
  - **`static-credential` ↔ `basic-credential` 통합**(재사용·단순화 양쪽이 speculative 로 표시) —
    세 번째 provider(`corp-adfs-wia`)가 그 형상에 안 맞아 멤버가 둘뿐인 추상이 된다 — **스킵**.
  - 신규 기능·테스트 외 동작 변경.

## 의존 기술 / 전제 (Dependencies & Assumptions)

- 기존 모듈만 사용. **신규 파일 2개**(`shared/lease-key.ts`·`shared/connector-address.ts`)는 둘 다
  **순수·런타임 의존 0** 이고 `shared → shared` 방향만 갖는다(레이어 DAG 준수).
- **신규 의존성: 없음.**
- 전제: 0156~0174 는 verify 를 통과했거나 사용자 실기로 확정된 상태 — 본 정리는 그 인수 기준을
  재해석하지 않고 표현만 바꾼다.

## 설계

- **AC1**: `policy.ts` 의 로컬 정의 삭제 → import 한 `isAllowedOrigin` 을 직접 호출. `broker` 는
  `policy` 를 통해 같은 함수를 받아 `ctx.fetch` 가드에 쓴다. `broker.safeOrigin` 삭제.
- **AC2·AC3**: `locationOf` 를 `redirectLocationOf`(3xx+Location 존재 판정, **대소문자 무시 +
  trim**) 와 절대화 단계로 나눈다. broker 는 `locationOf` 로 다음 홉을 얻고, `null` 인데
  `redirectLocationOf` 가 값을 주면 `invalid_redirect` 로 던져 **기존 오류 경로를 보존**한다.
  대소문자 무시가 필요한 이유: `SendResult.headers` 는 주입 포트가 채우는 평범한 레코드라
  소문자 보장이 없다(실제로 테스트 fixture 가 `Location` 을 쓴다).
- **AC5**: 규칙(술어·정규식)을 `shared/connector-address.ts` 로 올리고 `protocol.ts` 는 그것을
  zod 로 감싸며 **메시지만** 자리별로 붙인다. renderer 는 zod 없는 쪽을 import 한다 —
  `protocol.ts` 헤더가 "preload/renderer 에서 import 금지" 를 명시하기 때문.
- **AC7**: `shared/lease-key.ts` 에 `sessionLeaseKey`/`clientLeaseKey`/`parseLeaseKey`. feature 끼리
  직접 import 가 금지돼 있으므로 shared 승격이 `main/AGENTS.md` 의 해소책 ①(공유 타입/규칙 승격).
  `session-chain-lease.ts` 는 기존 import 경로 호환을 위해 re-export 를 남긴다.
- **AC10**: `settleApplicationGate(target, errorMessage?)` — `errorMessage` 를 **생략하면 기존
  문구를 보존**한다(취소 경로가 timeout 만 덮어쓰는 의미를 그대로 표현). `publish()` 는 호출자가
  하도록 남겨 자리별 위치 차이를 보존한다.
- **AC15**: `adopt(records, { persist })` — 메모리 적재는 그대로, 쓰기만 건너뛴다. 길이가 같으면
  버린 레코드가 없다는 뜻이므로 순서가 보존되고, 그 위에서 `id`·`status` 만 대조하면 충분하다.
- **AC16**: 부모(`PendingAssistant`)가 `activity` 를 `useMemo` 로 안정화 → `StatusLine` 이
  `[activity, elapsedSec]` 로 memo. 이 저장소는 React Compiler 를 **쓰지 않으므로**(vite 설정에
  babel plugin 없음) 수동 memo 가 필요하다.
- **AC18**: `Object.keys(left)` 순회 비교 — 값이 전부 문자열이라 얕은 비교로 충분하고, 필드
  추가가 자동으로 반영된다.
- **레이어 경계**: 신규 파일 2개 모두 `shared/`. import 방향 역행 0.

## 리스크 / 롤백

| 리스크 | 완화 |
|---|---|
| `locationOf` 대소문자·trim 변경이 **다른 소비자**(`browser-session-store`)에 영향 | 두 변경 모두 **더 관대·더 정확**한 방향(소문자 키는 그대로 매칭, trim 은 공백뿐인 값만 걸러냄). `net-response.test.ts` 기존 6건이 전부 green |
| `broker` 리다이렉트 경로 회귀 = credential 이 잘못된 홉으로 | `invalid_redirect` 던지기를 명시 보존(AC2). redirect 스위트 8건이 상대경로·허용밖·홉상한·303·304 를 고정 |
| `binding-records` 강화로 **기존 저장 레코드가 거부**될 수 있음 | 강화 방향이 `connectionId` 요구 — 그 값 없이 저장된 레코드는 어차피 `restore()` 가 `undefined` 로 읽어 깨지던 것. fail-empty 정책상 재입력으로 복구된다 |
| `updater` broadcast 억제로 renderer 가 갱신을 놓침 | 비교가 **전 필드 + progress 중첩**을 덮는다. 값이 바뀌면 반드시 발신 |
| 4에이전트 보고 중 오탐 채택 | 각 건을 파일을 직접 읽어 확인한 뒤에만 적용. `removeByBinding` 제안은 레이스 가드임을 확인하고 **기각** |

## 롤백

커밋 단위 revert. 신규 shared 모듈 2개는 순수 함수라 revert 시 잔여 부작용 없음.
