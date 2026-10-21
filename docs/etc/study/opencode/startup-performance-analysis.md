# OpenCode 시작 병목 조사 — Desktop과 Orca의 다중 프로젝트·세션

2026-10-21. 조사 기준 Orca `4652840b`. **개선 제안이며 현재 제품 계약·구현 변경이 아니다.** 앞선 [시작 시퀀스·기초 계측](../../../handoff/0272-composer-plugin-brands/startup-analysis.md)에 이어 동시성, 소유권, 전송 한계와 코드의 대기 경로를 조사했다.

## 결론

Orca는 같은 fingerprint의 서버 시작과 버전 조회를 합치고, 목록 조회 일부를 병렬로 실행한다. 그러나 **서버·이벤트 구독의 공유 단위, cold resume의 소유권 단절, 시작 작업의 동시성 제한과 취소 전달**까지 병목을 완화하지는 못한다. `async`/`Promise.all`만으로 충분한 상태는 아니다.

우선순위는 **서버별 SSE 구독 통합 → 이력 확인~전송 사이 서버 lease 유지 → 취소 가능한 시작 작업과 동시성 제한 → 조건부 프로젝트 간 서버 공유**다. 프로젝트 간 공유부터 확대하면 기존 세션별 SSE가 같은 origin에 모여 전송 병목을 키울 수 있다.

## 1. 근거의 범위

| 구분 | 대상 / 판정 |
|---|---|
| 설치 버전과 맞춘 Desktop·server | `.temp/opencode`의 `v1.19.0`, commit `733b2c627e5aec39cb33cc22373bdce33053ef2c` |
| 사용자 제공 clone HEAD | package 2.1.1, commit `5fa426f68d1dbf3c8aaa01557e357719f0577438`. background service 설계는 참고로 분리 |
| 실제 전송 재현 | 앱에 설치된 Electron 39.8.10 / Chromium 142.0.7444.265, 소유한 HTTP/1.1 loopback 테스트 서버 |
| 기존 계약 확인 | server·DB 경로·persistent channel·native history·supervisor 관련 기존 테스트 5파일 103케이스 통과 |
| 확인하지 않은 것 | 다수 실제 plugin/MCP를 사용한 사용자 환경의 13초 trace와 Orca 전체 화면에서의 동일 증상 |

아래의 **재현**은 전송 계층 실측, **코드 확인**은 소스에서 실행 경로가 확인된 사실, **가능성**은 실제 지연 기여도를 별도로 측정해야 하는 항목이다. 이전 plugin0/MCP0의 첫 SSE 시간으로 다수 확장 환경의 시간을 추정하지 않는다.

## 2. Desktop과 Orca의 공유 단위

| 축 | Desktop 1.19.0 | Orca |
|---|---|---|
| 서버 준비 | 앱 loading task에서 sidecar 준비. 기본 v1은 utilityProcess의 bundled `Server.listen` | 채널이 `client()`를 요청할 때 CLI `serve` 시작 |
| 프로젝트 분리 | 같은 서버의 `InstanceStore`가 정규화 directory별 Deferred를 보관하고 같은 경로의 bootstrap을 합침 | executable+config+유효 env+cwd별 `ServerEntry`. 다른 cwd는 별도 CLI |
| 이벤트 | `server-sdk.tsx`의 서버 context가 legacy `/global/event` 구독을 소유하고 directory별로 배분 | `openCodeChannel()`마다 `/event?directory=…` 구독 |
| 수명 | 앱이 준비한 서버를 여러 프로젝트/세션에서 사용 | 마지막 server owner release 시 삭제·종료. warm channel이 있으면 계속 보존 |
| plugin·MCP 상태 | instance별 초기화. 서로 다른 프로젝트의 setup/MCP가 모두 한 번으로 줄지는 않음 | 프로세스와 instance의 초기화를 프로젝트마다 부담. 같은 cwd/fingerprint의 동시 세션은 서버 공유 |

HEAD 2.1.1은 early window와 compatible background service의 discover/ensure를 사용한다. Orca는 현재 1.x만 지원하므로 HEAD service 방식을 곧바로 적용 가능한 API로 취급하지 않는다.

근거: Orca [server.ts](../../../../app/src/main/adapters/opencode/v1/server.ts) `key/acquire/start`, [channel.ts](../../../../app/src/main/adapters/opencode/v1/channel.ts) `run`; native 고정 태그의 `packages/desktop/src/main/index.ts`, `sidecar.ts`, `packages/app/src/context/server-sdk.tsx:181–320`, `packages/opencode/src/project/instance-store.ts:38–123`. 태그 소스는 `git -C app/.temp/opencode show v1.19.0:<경로>`로 재현한다.

프로젝트 수를 P, 전체 warm/active 세션 수를 S, 서버 fingerprint 수를 U라고 하면 현재 Orca의 CLI 수는 U, SSE 수는 S다. 같은 설정의 서로 다른 프로젝트만 고려하면 U=P다. Desktop의 해당 로컬 연결은 서버 하나와 directory별 instance를 사용한다.

**MCP 연결은 별개다.** 양쪽 모두 프로젝트별 instance가 있으므로 프로젝트마다 같은 stdio MCP가 K개 있으면 P×K 연결/child가 생길 수 있다. 서버만 합쳤다고 P×K가 K로 줄어든다고 주장할 수 없다. cwd·인증·설정이 다른 MCP를 공유하는 것은 별도 계약이다.

## 3. 가장 우선할 병목: 세션별 SSE와 HTTP 연결 점유

### 재현

앱의 `netFetch`가 사용하는 것과 같은 Electron `net.fetch`로 하나의 HTTP/1.1 loopback origin에 응답 본문이 닫히지 않는 SSE를 열었다. 사용자 OpenCode 서버나 설정은 사용하지 않았다.

| 조건 | 일반 `/health` 요청 |
|---|---|
| SSE 5개 유지 | HTTP 200, 8ms |
| SSE 6개 유지 | 2,008ms에 timeout |
| SSE 하나 abort 후 | HTTP 200, 6ms |

실행한 [probe](evidence/startup-net-pool/probe.cjs)와 [원시 결과](evidence/startup-net-pool/result.json). 일반 요청 timeout은 실험의 2초 제한이며 Orca가 2초 timeout을 갖는다는 뜻이 아니다.

Electron의 `net.fetch`는 Chromium 전송 계층을 쓴다([공식 문서](https://www.electronjs.org/docs/latest/api/session#sesfetchinput-init)). Chromium은 일반 소켓 그룹의 기본 상한을 6으로 둔다([소스](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/net/socket/client_socket_pool_manager.cc)). 최종 판단은 위 설치 버전 실측에 근거한다.

### Orca에 미치는 영향

- `channel.ts:291–312`는 세션마다 SSE를 열고 첫 이벤트를 확인한 뒤 prompt를 전송한다. 같은 서버에서 구독이 연결 슬롯을 채우면 prompt·상태·도구 승인 HTTP 요청도 대기할 위험이 있다. 현재 SSE handshake 이후의 `promptAsync`에는 독립된 시작 deadline이 없다.
- 기존 idle runtime도 연결을 유지한다. 공통 cap은 idle LRU 축출 정책이지 active 시작을 제한하는 semaphore가 아니다. active만 많은 상황은 허용하므로 cap만으로 전송 포화를 막을 수 없다.
- `/event`는 directory의 이벤트를 배포한다. 같은 directory의 세션마다 같은 이벤트를 전송·JSON parse하고 그 뒤 각 activity mapper가 소유 세션/child를 가른다. 연결뿐 아니라 불필요한 반복 처리도 생긴다.
- 다른 프로젝트는 현재 별도 port를 쓰므로 이 재현의 **동일 origin** 한계를 그대로 서로 공유하지 않는다. 다중 프로젝트의 일차 비용은 프로세스·초기화 중복이고, 같은 프로젝트의 다중 세션은 SSE 점유가 직접 문제다.

**개선 P0:** server generation마다 하나의 `/global/event` broker를 두고 directory+session+소유 child 기준으로 채널에 배분한다. 구독 등록/첫 연결 확인이 prompt보다 먼저 끝나는 현재 순서를 유지한다. 채널 종료는 구독자만 제거하고 다른 채널의 stream을 닫지 않는다. generation 교체·재연결 실패·중복 이벤트·승인 소유권을 시험한다. prompt를 자동 재전송하여 중복 실행을 만드는 방식으로 해결하지 않는다.

## 4. cold resume의 이중 시작과 LRU 이후 재초기화

살아 있는 runtime이 없는 기존 세션의 입력은 다음 경로를 가진다.

```text
resolveTurn
  → prepareNativeSession
    → adapter.readHistory
      → client/acquire: server A 준비
      → native session 확인 + DB 경로 조회 + 원본 일관성 검사
      → finally release: 마지막 owner이면 server A 종료
  → runtime 확보와 실제 채널 실행
    → client/acquire: server B 준비
    → SSE 준비 → prompt
```

**코드 확인:** 다른 owner가 없으면 이력 조회와 실제 전송 사이의 서버 연결이 보존되지 않는다. config/plugin setup이 비싼 환경에서 같은 cwd의 bootstrap을 연달아 반복할 수 있다. 화면 진입의 native refresh도 먼저 끝나서 서버를 해제했다면 추가 cold 시작이 생길 수 있다. 반대로 기존 warm runtime이 있으면 이 preflight를 건너뛴다.

근거: [resolve-turn.ts:125](../../../../app/src/main/app/chat-turn/resolve-turn.ts), [native-session.ts:48](../../../../app/src/main/app/chat-turn/native-session.ts), [adapter.ts](../../../../app/src/main/adapters/opencode/v1/adapter.ts) `readHistory/sendMessage`, [server.ts:160](../../../../app/src/main/adapters/opencode/v1/server.ts), [native-history.ts](../../../../app/src/main/app/native-history.ts).

여러 프로젝트를 번갈아 열어 공통 runtime cap 밖의 idle 세션이 축출되면 이 경로를 다시 밟을 수 있다. 이는 무조건 모든 턴이 새 CLI라는 뜻은 아니다. warm runtime은 재사용되고 같은 key의 다른 owner가 살아 있으면 server도 유지된다.

**개선 P1:** 하나의 전송 준비 작업이 이력 확인부터 채널 연결까지 같은 server lease를 유지하고 채널로 소유권을 넘긴다. 실패·취소 시에는 그 lease만 해제한다. 단순히 이력 무결성 검사를 빼지 않는다. 추가로 짧은 서버 보존이나 프로젝트 선택 시 준비를 검토할 수 있으나, 보존 한도·설정 무효화·자원 회수 정책을 먼저 정해야 한다.

## 5. 다중 프로젝트 시작: 병렬 실행은 있지만 시작 부하 제한은 없음

| 코드 확인 | 의미 / 개선 |
|---|---|
| `ServerPool.acquire`는 같은 key의 `ready` promise를 공유 | 같은 cwd/config/env의 중복 spawn은 이미 완화됨. 유지해야 함 |
| 다른 key는 각각 `start`하고 공통 시작 semaphore가 없음 | P개의 프로젝트가 CLI·모듈·SQLite·파일 스캔·plugin setup을 동시에 시작. 벽시계 시간은 단순 합이 아니라 가장 느린 초기화와 CPU/디스크/AV/메모리 경쟁에 좌우됨 |
| native MCP의 `MCP.state`는 `concurrency: unbounded` | 개별 프로젝트가 K개를 병렬 연결. 다중 프로젝트에서는 P×K개의 접속/프로세스 시작 폭주 가능 |
| config의 dependency 준비는 fork 후 plugin init에서 join | 비동기 시작이어도 plugin이 있으면 실제 필수 대기로 되돌아옴 |
| upstream Npm reify는 `npm-install:<dir>` file lock 사용 | 같은 전역 config/cache를 쓰는 여러 process가 설치를 필요로 하면 락·npm I/O 대기가 생길 수 있음. 캐시가 정상인 모든 시작이 reify를 한다는 뜻은 아님 |

**개선 P1:** foreground 세션 준비를 우선하는 취소 가능한 시작 queue를 둔다. 합쳐진 같은-key flight는 queue 한 작업으로 센다. 동시 시작 수를 여러 후보로 측정하여 p95와 처리량으로 선택한다. 전체 active runtime을 거절하는 기능과 시작 작업의 짧은 queue는 구분한다. 메타데이터와 백그라운드 이력 갱신이 foreground 시작보다 앞을 차지하지 않게 한다.

**개선 P2:** broker와 lease가 먼저 안정화된 뒤 같은 executable·호환 config/env의 여러 directory를 한 소유 server로 처리하는 방식을 검토한다. 단순히 pool key에서 cwd를 빼는 변경은 부적절하다. CLI process.cwd를 보는 plugin, 상대 경로·상속 env·저장소 격리·실패 범위·설정 reload를 검증해야 한다. Desktop이 쓰는 directory별 instance 모델을 참고하되 기존 원본 저장 정책을 유지한다.

native 근거: 고정 태그 `config/config.ts:441–480,632`, `packages/core/src/npm.ts:87–198`, `mcp/index.ts:493–529`, `project/bootstrap.ts:36–47`. Orca 근거: `server.ts:130–155`, [runtime-cap-policy.ts](../../../../app/src/main/features/sessions/runtime-cap-policy.ts), [supervisor.ts:316](../../../../app/src/main/features/sessions/supervisor.ts).

## 6. plugin·MCP가 많은 경우의 긴 경로

| 단계 | 현재 비동기 동작 | 남은 대기와 판정 |
|---|---|---|
| project bootstrap | config 완료 → plugin.init → 나머지 init 병렬 | plugin이 config를 변경하므로 이 선후관계는 의도적 |
| plugin resolve/import | `PluginLoader.loadExternal`의 Promise.all | 후보 파일 해석·import가 모두 직렬이라는 진단은 틀림 |
| plugin 적용 / config hook | 순서를 보존해 차례로 await | 개별 setup/hook의 긴 await는 누적될 수 있음. 무조건 Promise.all로 바꾸면 설정·hook 등록 순서가 바뀜 |
| MCP 초기 연결 | 서버별 병렬, state 준비는 전체 완료를 기다림 | 느린 서버가 전체 MCP 관측/도구 준비를 지연. 기본 connect timeout은 30초 |
| remote MCP transport | StreamableHTTP 실패 뒤 SSE를 순서대로 시도 | 비인증 연결 실패에서 개별 transport timeout이 이어질 수 있음. MCP 수×30초와는 다른 구조 |
| command 목록 | native `Command.state`가 `mcp.prompts()` 사용 | 단순 스킬 메뉴 조회도 MCP 준비/프롬프트 조회를 시작하거나 기다릴 수 있음 |
| 첫 prompt | tools/instructions에서 MCP state 사용 | session.create와 SSE가 준비돼도 첫 모델 요청 전 대기가 남을 수 있음. 이미 시작된 같은 instance의 state는 공유 |

**개선:** 우선 실패 plugin의 resolve/install/entry/import/setup/config-hook과 MCP connect/defs/prompts 시간을 분리해 기록한다. 반복 실패는 spec·파일 revision·CLI version 단위로 사용자에게 드러내고 재시도를 제어한다. 사용자 plugin을 자동 삭제·비활성화하지 않는다. 선택적 MCP 지연 연결이나 느린 서버를 제외한 부분 준비는 사용할 도구 집합이 달라지는 제품 결정이므로 별도 설계가 필요하다.

`Failed to load plugin path`의 path는 plugin spec이다. 경로가 없다는 오류로만 취급하지 않는다. 현재 stderr drain은 역압을 막지만 진단 원문을 버리므로 느린 plugin을 식별할 수 없다. 원문·인증값을 그대로 로그에 쓰는 대신 안전한 stage·duration·오류 코드·spec 식별자를 남기는 방식이 필요하다.

근거: 고정 태그 `plugin/index.ts:114–123,184–256`, `plugin/loader.ts:199–239`, `mcp/index.ts:38,270–331,493–529`, `command/index.ts:105`, `session/tools.ts:390`, `session/system.ts:123`; Orca `server.ts:231`.

## 7. timeout·취소·메타데이터의 코드 스멜

| 요소 / 근거 | 확인한 문제 | 개선 |
|---|---|---|
| [resource-query.ts](../../../../app/src/main/adapters/common/resource-query.ts) | 3초 Promise.race는 호출자의 대기만 끝낸다. read callback에 signal이 없으므로 작업 중단을 보장하지 않음 | 조회 전용 AbortSignal을 SDK까지 전달. 에이전트 본체의 signal과 분리 |
| `native-resources.ts:75–78` | mcp.status/config.get에 timeout·caller signal 없음. 겉 race가 끝나도 HTTP/서버 작업이 남을 수 있음 | 모든 read의 transport deadline·취소, 늦은 결과 fence, 같은 instance/generation의 flight 병합 |
| `server.acquire`와 `channel.ts:269–270` | acquire는 caller signal을 받지 않음. 중단된 세션도 connect가 끝날 때까지 기다린 뒤 release | 대기자별 취소·reference count. 다른 대기자를 함께 중단하지 않되 마지막 취소 시 시작 작업 회수 |
| `server.start` | version timeout, spawn/health timeout, SSE timeout은 분리. session/create·history HTTP를 덮는 전체 준비 deadline은 없음 | 전체 준비 budget과 stage별 하위 budget을 함께 사용. 시간 초과 원인을 단계로 반환 |
| `channel.ts:271,310` / `composer-catalog.ts:8` | catalog는 먼저 병렬 시작. 기본 입력은 기다리지 않지만 agent/variant 명시 때는 기다림 | 이미 성공한 같은 instance/generation의 catalog 재사용, foreground 요청 우선. 별도 실행 입력의 유효성 검사는 유지 |
| `channel.ts:415–433` | items·commands·catalog를 Promise.all로 모으므로 가장 느린 항목까지 snapshot 완료 지연 | 조회 묶음의 flight/캐시와 부분 갱신 검토. 부분 DTO 정책은 계약 설계 후 적용 |
| `native-resources.ts:19–25` | skills 다음 config를 순서대로 조회하고 plugin 메타데이터를 목록 경로끼리 반복 해석 | command 결과 이후 독립된 skills/config 병렬화, 요청 내 config·plugin 설치 정보 공유 |
| [skill-sources.ts:35](../../../../app/src/main/adapters/opencode/v1/skill-sources.ts) | `isOpenCodeSkill`이 명령마다 같은 상위 root의 realpath를 다시 모음 | 조회 단위로 root를 한 번 계산하고 같은 실제 경로를 dedup. Promise.all만 늘려 FS queue를 키우지 않음 |

Renderer의 [nativeResourceState](../../../../app/src/renderer/src/features/chat/lib/nativeResourceState.ts)는 같은 window·scope·session의 진행 중 조회를 이미 합친다. Composer·상태 타일이 항상 독립 조회를 세 번 실행한다는 뜻은 아니다. 다만 **서로 다른 세션과 main의 실제 instance 단위**까지 합치지는 않는다.

## 8. 비동기 함수 안의 main thread 작업과 불필요한 cold 전환

### 긴 이력의 동기 작업

[native-history.ts](../../../../app/src/main/adapters/opencode/v1/native-history.ts)는 checkpoint가 다르거나 재사용 정보가 없으면 header+messages를 읽는 일을 두 번 수행하고 snapshot을 JSON 직렬화·hash한다. [native-cursor.ts](../../../../app/src/main/adapters/opencode/v1/native-cursor.ts)는 better-sqlite3로 세션의 message/part 전체를 동기 조회하고 JSON/hash한다. `async readHistory()` 안에서도 이 작업은 main thread를 점유한다.

cold resume의 `prepareNativeSession`은 previous cursor를 전달하지 않으므로 navigation refresh의 unchanged fast path를 그대로 이용하지 못한다. 긴 이력 여러 개를 열면 full-history 처리와 여러 process의 같은 native DB 접근이 경쟁할 수 있다. SQLite lock이 실제 13초를 만들었다는 계측은 아직 없다.

**개선 P2:** 일관된 read-only snapshot·digest 계산을 worker로 옮기거나 검증된 cursor 재사용을 설계한다. API fallback의 이중 읽기는 변경 중 이력 보호를 위한 것이므로 단순 삭제하지 않는다. event sequence만으로 모든 mutation을 검출할 수 없다는 현재 invariant도 유지한다.

### OpenCode에도 적용되는 공통 respawn 정책

[respawn-policy.ts](../../../../app/src/main/features/sessions/respawn-policy.ts)의 model 변경은 channel teardown을 유발한다. OpenCode는 `promptAsync`/`command`마다 model을 전달하지만 공통 정책은 하네스별로 구분하지 않는다. sole owner가 닫히면 server도 내려가므로 단순 모델 변경이 cold start로 이어질 수 있다.

**개선 P2:** 하네스별로 실제 hot 적용이 검증된 속성만 capability/정책으로 분리한다. Claude의 respawn 규칙을 전체적으로 완화하지 않는다. 우선 server lease 보존만으로 불필요한 process 재시작을 줄이는 방안도 가능하다.

pool key도 raw `JSON.stringify(config/env)`를 fingerprint의 문자열 값으로 넣으므로 객체 key 순서 차이와 Windows 경로 표기 차이가 같은 구성의 cache miss를 만들 수 있다. 빈번한지 계측한 뒤 의미를 보존하는 canonicalization을 적용한다. 인증·저장 경계가 다른 env를 무작정 무시해서는 안 된다.

## 9. 이미 완화되는 부분과 제외한 진단

| 항목 | 판정 |
|---|---|
| 세션 전체가 전역 queue로 직렬 실행됨 | 코드와 다름. 다른 세션의 턴은 동시 실행 |
| 매 세션마다 CLI version 조회 | 같은 executable identity의 version promise/cache로 합침 |
| 같은 프로젝트의 모든 세션이 별도 CLI | config/env/cwd key가 같으면 시작·프로세스 공유 |
| agent/provider metadata가 항상 첫 prompt를 막음 | 기본 입력은 await하지 않음. 명시 agent/variant에서만 결과 대기 |
| plugin 파일을 하나씩 직렬 import | loader는 병렬. 적용과 config hook의 순서가 별도 |
| MCP가 많으면 timeout을 모두 합산 | 서버 간 연결은 병렬. 최장 경로·개별 transport fallback·자원 경쟁을 나눠야 함 |
| 제목 생성이 최초 세션 시작을 직렬 지연 | 첫 턴 이후 fire-and-forget이며 최초 연결 병목으로 보지 않음 |

## 10. 구현 순서와 검증 기준

| 순서 | 작업 | 완료를 판정할 관측 |
|---|---|---|
| P0 | server별 SSE broker | 세션을 늘려도 서버당 SSE가 증가하지 않음. 같은 server의 다중 세션에서 prompt·승인·상태 요청이 진행. 이벤트 누락·다른 세션 유출·중복 제출 없음 |
| P1 | cold resume lease 인계 | 다른 owner가 없는 이력 확인→실제 전송에서 CLI가 반복 시작되지 않음. 실패·취소는 자신만 정리 |
| P1 | stage trace·취소·시작 queue | 중단된 준비의 child/조회가 계속 누적되지 않음. 별도 세션은 유지. 동시 시작 수별 p50/p95·처리량·최대 child/RSS 비교 |
| P2 | metadata/FS dedup·history worker | native 목록 재조회 수·realpath 수·main event loop 지연·긴 이력 peak memory 감소, 같은 원본 판정 유지 |
| P2 | backend별 hot 설정 정책 | OpenCode 모델만 바꿀 때 불필요한 CLI 재시작 제거, Claude·설정/인증 경계 회귀 없음 |
| 후속 | 조건부 cross-directory server | SSE broker 도입 후 비교. cwd/config/env 격리·상대 경로 plugin·MCP child cwd·설정 reload·실패 범위 검증 |

측정은 동일 CLI/설정에서 프로젝트 수, 프로젝트당 세션 수, cold/warm/resume, 정상/실패 plugin, 정상/지연 MCP, 짧은/긴 이력을 바꿔 수행한다. 한 프로젝트의 동시 세션과 서로 다른 프로젝트의 동시 시작을 별도 축으로 둔다.

trace는 `admitted → config-resolved → lease-acquire → version → spawn → health → instance/config/deps/plugin-ready → native-history → session-ready → SSE-ready → prompt-accepted → MCP/tool-ready → first-model-event`를 monotonic 시간으로 남긴다. 병렬 단계는 시작/끝을 모두 기록해 중복 비용과 임계 경로를 구분한다. 설정 원문·인증값은 로그에 싣지 않는다.

**13초 원인 판정은 보류한다.** 이번에 재현한 것은 HTTP 연결 점유이고, 소스에서 확인한 추가 비용은 cold resume의 반복 시작과 초기화/조회 중복이다. 실제 사용자 환경에서는 같은 trace로 이 중 어느 구간이 지배하는지 확인해야 한다.

### 전송 실험 재현

probe를 저장소 `.git/opencode-startup-research/`에 복사한 뒤 설치 Electron으로 실행한다. script는 BrowserWindow를 만들지 않고 자신의 loopback 서버·stream만 정리한다. userData는 probe 옆의 전용 폴더를 사용한다. PowerShell의 GUI 실행 stdout 수집을 위해 `Start-Process -WindowStyle Hidden -Wait`와 stdout/stderr 파일 리다이렉트를 사용했다. OpenCode 세션·설정·모델 요청은 만들지 않는다.
