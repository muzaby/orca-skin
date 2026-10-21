# A 유휴 세션 유지 중 B 작업폴더의 첫 일반 입력 지연

2026-10-21. Orca `7b6111f6`, 실제 OpenCode CLI **1.17.19**, Electron39.8.10으로 조사했다. 참조 Desktop/native 소스는 `v1.17.19`의 `dc927a7ff071741537cb0bdac7e09b5667ed568d`다.

## 판정

**A의 응답이 끝났어도 MCP 연결은 살아 있다. B는 별도 directory instance의 MCP를 다시 준비하며, 이 준비가 첫 일반 응답을 1분 이상 지연시키는 경로를 실제로 재현했다.**

사용자는 최신 변경이 포함된 빌드에서 A를 유휴 상태로 열어 둔 채 B의 일반 메시지를 보냈다고 확인했다. 제어 실험에서 A가 보유한 MCP의 두 번째 연결만 응답하지 않게 하자 B는 **71,673ms** 뒤 정상 완료했다. 사용자 환경의 어느 MCP 또는 플러그인이 같은 문제를 일으켰는지는 아직 확정하지 않았다.

## 실제 재현과 대조 실험

생산 코드의 `OpenCodeAdapter`와 `OpenCodeServerPool`을 그대로 번들링해 Electron `net.fetch`로 호출했다. 모든 native config/cache/state/data 및 Electron userData는 저장소 `.git/opencode-cross-directory-research/` 아래에 격리했다.

MCP와 모델 API는 직접 만든 loopback HTTP 서버다. 모델 API는 고정 문자열의 OpenAI 호환 SSE를 반환하므로 외부 LLM 호출·실제 토큰 사용은 없다. A의 첫 일반 입력을 완료한 뒤 채널과 서버를 유지하고 B를 시작했다.

| 실험 | 제어 조건 | 관측 |
|---|---|---|
| 현행 Orca + 두 경로 + MCP 두 번째 연결 지연 | 첫 MCP client는 정상, 두 번째 client의 HTTP/SSE 초기 응답을 지연. native 기본 transport timeout 유지 | CLI 프로세스2개. B 일반 입력 완료71,673ms, 오류 없이 완료 |
| 대조: 두 경로 + MCP 두 연결 정상 | 같은 코드에서 MCP가 두 번째 client도 수용 | CLI 프로세스2개. B 일반 입력 완료8,520ms |
| 경계 확인: 한 프로세스 + 두 directory | 연구용 server-acquire seam만 같은 server로 고정. 두 번째 MCP client 지연, 각 transport timeout은1,000ms | CLI 프로세스1개여도 B MCP의 두 번째 HTTP→SSE 연결 발생. B 완료6,095ms |

마지막 실험은 실제 Desktop UI 측정이나 프로세스 공유의 성능 비교가 아니다. **같은 server라도 directory별 MCP instance가 별도라는 경계**를 확인했다. 첫 두 실행도 cache가 달라 총 소요 시간 차이를 순수 개선율로 해석하지 않는다.

0274의8세션 운영 검증은 같은 제어 server에서 SDK/global stream 공유를 확인한 것이다. 서로 다른 cwd의 실제 native MCP 초기화 지연은 그 검증 범위에 들어 있지 않았다. 이번에는 실제 server pool과 CLI를 사용해 그 경계를 측정했다.

| B 입력 이후 단계 | 첫 재현의 상대 시간 | 의미 |
|---|---:|---|
| server health HTTP200 | 3,362ms | B 서버가 뜨지 않아서 1분 대기한 것이 아님 |
| global SSE HTTP200 | 3,403ms | 전역 이벤트 연결이 이미 열림 |
| config 완료 | 7,827ms | 프로젝트 bootstrap 완료 |
| session 생성 완료 | 8,059ms | native 세션 ID 발급 완료 |
| prompt_async HTTP204 | 8,292ms | 일반 입력을 비동기 실행 작업으로 수락 |
| B MCP StreamableHTTP 초기 응답 지연 | 8,384ms | 첫 transport 대기 |
| B MCP SSE 초기 응답 지연 | 38,272ms | 약30초 뒤 fallback transport 시도 |
| 후반 모델 API 호출 | 70,683ms | MCP 대기 후 응답 실행 경로의 호출 |
| B 응답 프레임 완료 | 71,673ms | UI가 기다린 실제 일반 응답 완료 |

모델 API 요청은 제목 등 보조 작업을 포함해 전체4회였으므로 모든 요청을 본문 응답 시작으로 취급하지 않았다. 판정 oracle은 B의 실제 `turn.ended`와 오류 없는 frame이다.

근거: [지연 재현 JSON](evidence/cross-directory-idle-delay/blocked-result.json), [정상 MCP 대조 JSON](evidence/cross-directory-idle-delay/control-result.json), [한 프로세스 경계 JSON](evidence/cross-directory-idle-delay/single-server-result.json).

## 비동기로 기다릴 수 있는가

**가능하며 현재 코드도 스레드를 막는 방식으로 기다리지는 않는다. 문제는 첫 모델 실행이 필요한 준비 결과에 의존한다는 것이다.** `await`를 없애는 것만으로 아직 준비되지 않은 MCP 도구·지침이나 플러그인의 설정 변경을 모델에 전달할 수는 없다.

```text
A 응답 종료 → idle 채널 유지 → native instance/MCP client 유지
B 일반 입력 → 다른 directory 준비 → prompt_async 204
  ├─ 이벤트 수신·제목 등 독립 작업은 진행
  └─ 본문 모델 실행은 MCP tools/instructions 준비를 기다림
       └─ 원격 HTTP 기본30초 → 실패 후 SSE 기본30초 → 이후 진행
```

현행 `channel.ts`는 첫 일반 입력을 느린 command 목록과 독립적으로 제출한다. 그러나 native `session/prompt.ts`는 모델 실행 전에 `SessionTools.resolve`와 `sys.mcp`를 소비하고, 이들이 같은 directory의 MCP state를 기다린다. **Orca의 command 조회가 병렬이어도 native 모델 실행의 의존성은 남는다.**

이번 재현에서는 command SDK 조회의30초 예산이 지나도 native MCP의 SSE fallback이 계속됐고 일반 응답은 이후 완료했다. SDK read 취소를 native instance의 공유 초기화 종료와 동일하게 보면 안 된다.

## 실제 OpenCode Desktop의 준비 방식

| 축 | Desktop/native1.17.19에서 확인한 처리 | Orca와 비교 |
|---|---|---|
| 준비 시작 시점 | 세션 페이지의 `useSync`→directory context가 `serverSync.child(directory, { mcp: true })`를 사용. 폴더 UI가 활성화되면 bootstrap/MCP query를 시작 | Orca의 현재 채널은 선택된 engine/cwd의 첫 SDK 연결에서 준비. 사용자가 첫 입력하기 전의 시간을 충분히 이용하지 못함 |
| 화면과 느린 조회 | directory 상태를 partial로 열고 별도 async 작업에서 session·agent·config·VCS·command·MCP 등을 실행 | UI 전체를 느린 metadata의 완료까지 직렬로 기다리지 않는 방식이 참조점 |
| 준비 공유 | server SDK/global event와 directory bootstrap flight를 공유 | Orca도 같은 server/directory에서 공유하지만 서로 다른 cwd는 별도 native process라 공유 범위가 좁음 |
| config 의존성 설치 | config가 의존성 설치를 `Effect.forkDetach`로 시작. plugin이 필요하면 `waitForDependencies`로 완료를 join | 비동기 시작이 필수 의존성을 없애지는 않음. 같은 global install dir이면 프로세스 간 file lock 대기가 가능 |
| 외부 plugin 탐색·로딩 | `PluginLoader.loadExternal`의 후보 작업을 `Promise.all`로 시작 | 로더 전체가 직렬이라는 설명은 부정확 |
| plugin setup/config hook | 적용 순서를 보존해 차례대로 await. config→plugin.init 뒤 다른 bootstrap 서비스 init | plugin이 config를 변경하므로 무조건 병렬화하거나 뒤로 미루면 실행 의미가 달라짐 |
| MCP 연결 | directory별 state 안에서 여러 서버를 `concurrency: unbounded`로 연결. state 결과를 소비하는 쪽은 준비 결과를 기다림 | 서버 여러 개의 초기화는 병렬이어도 느린 서버 하나가 공통 state의 소비를 지연시킬 수 있음 |
| 원격 MCP fallback | 비인증 연결 실패 시 StreamableHTTP→SSE를 순서대로 시도, 기본30초씩 | Desktop도 같은 native 서비스를 사용하므로 이 경로를 면제받지 않음 |
| 일반 입력 | prompt_async가 작업을 fork하고204 반환. 모델 실행 전 tools와 MCP instructions를 준비 | HTTP 수락·SSE 연결 성공이 모델 입력 준비 완료를 뜻하지 않음 |

Desktop은 준비를 폴더 진입 시점으로 앞당겨 입력 전 시간을 활용한다. 하지만 사용자가 준비 전에 바로 입력하거나 MCP가 연결되지 않으면 native 대기는 남는다. **Desktop이 모든 plugin/MCP를 모델 응답 뒤로 미뤄 실행한다는 동작은 확인되지 않았다.**

### 고정 태그 source 좌표

아래 경로는 별도 참조 저장소 `app/.temp/opencode`의 `v1.17.19` 기준이다. 재현 명령은 `git -C app/.temp/opencode show v1.17.19:<경로>`다.

| 경로 | 좌표 / 확인 사항 |
|---|---|
| `packages/app/src/pages/session.tsx`, `context/sync.tsx` | `useSync`→`ensureDirSyncContext` |
| `packages/app/src/context/directory-sync.ts:28` | `child(directory, { mcp: true })` |
| `packages/app/src/context/server-sync.tsx:224` | MCP 활성화 시 비동기 command 조회 |
| `packages/app/src/context/global-sync/bootstrap.ts:233,291,354,368–380` | partial 표시, command/MCP 조회, paint 이후 독립 작업 실행 |
| `packages/opencode/src/project/bootstrap.ts:36–47` | config→plugin→나머지 병렬 init |
| `packages/opencode/src/config/config.ts:441–458,618` | 의존성 background 시작과 join |
| `packages/opencode/src/plugin/loader.ts:208–214` | 후보 로딩 Promise.all |
| `packages/opencode/src/plugin/index.ts:180,215,241` | 의존성 대기·plugin 적용·config hook 순서 |
| `packages/opencode/src/mcp/index.ts:38,269–331,492–529` |30초 예산, 두 transport 순차 fallback, directory별 state와 서버 병렬 |
| `packages/opencode/src/session/prompt.ts:1226,1261` | tools/MCP instructions 소비 |
| `packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts:311–329` | 비동기 fork 후204 |

## Orca의 구조적 병목과 배제할 설명

| 판정 | 관측 / 코드 |
|---|---|
| 확정: 경로별 별도 process와 cold 준비 | [server.ts](../../../../app/src/main/adapters/opencode/v1/server.ts)의 key에 cwd 포함. 실제 두 경로 실험에서 spawn2회 |
| 확정: A idle도 native 자원 보유 | [channel.ts](../../../../app/src/main/adapters/opencode/v1/channel.ts)의 session.idle은 응답 프레임만 종료. release는 채널 run의 finally. [runtime-pool.ts](../../../../app/src/main/features/sessions/runtime-pool.ts)는 idle runtime을 보관 |
| 확정: 공유 개선은 서로 다른 native server까지 합치지 않음 | [session-context.ts](../../../../app/src/main/adapters/opencode/v1/session-context.ts)의 context key는 URL+auth fingerprint. 두 cwd의 서로 다른 포트는 다른 context |
| 재현: B 첫 일반 응답 전 MCP60초 경로 | 위 실제 CLI trace. HTTP204/SSE 연결 이후에도 native 준비 대기 |
| 확정: 연결 준비와 모델 준비의 관측이 부족 | channel의15초 타이머는 첫 SSE handshake까지만 적용. 이후 일반 입력 수락은 모델 실행 전 tools 준비 완료를 보장하지 않음 |
| 위험: plugin dependency의 프로세스 간 경합 | native Npm의 `npm-install:<dir>` file lock. `EffectFlock`의 stale60초와 총 retry5분. 실제 plugin 설치 필요 여부에 따라 발생하며 이번 MCP 재현의 원인은 아님 |
| 관측 한계: native 초기화 세부 로그 폐기 | server.ts에서 stderr를 drain. 역압은 방지하지만 어느 plugin/MCP가 지연됐는지 현행 앱 로그만으로 구분하기 어려움 |
| 배제: A의 응답 생성이 끝날 때까지 B를 직렬 대기 | 사용자 조건은 A idle. runtime/lease는 세션 키별이며 전역 모델 실행 mutex를 발견하지 못함 |
| 배제: 일반 메시지가 command 목록30초를 직접 await해서 지연 | 현재 일반 입력은 목록 완료 전 prompt_async를 제출. 재현에서도8.3초에204 수신 |
| 배제: 이번 사례를 HTTP/1.1의6개 SSE 소켓 포화로 확정 | A/B가 별도 포트이고 재현의 B SSE는3.4초에 연결됨 |
| 미확정: 사용자 환경의 DB lock·특정 plugin 실패·MCP 이름 | 원격 실행 단계 trace가 없음. 제어 재현을 사용자 구성의 확정 원인으로 치환하지 않음 |

## 개선 방향

| 우선순위 | 변경 방향 | 의도 / 경계 |
|---|---|---|
| P0 | 선택 engine/작업폴더의 준비를 폴더 진입 시 비동기로 시작하고 첫 전송까지 lease 승계 | Desktop처럼 입력 전 시간을 이용. 준비 후 바로 마지막 lease를 해제하면 server/cache가 사라지므로 단순 fire-and-forget 조회로 끝내지 않음 |
| P0 | 연결·프로젝트·MCP/tools·모델 응답 단계를 분리 계측/표시 |204와 SSE ready를 전체 ready로 오인하지 않게 함. native 초기화는 안전한 stage·시간·오류 코드만 수집 |
| P0 | foreground 준비와 background 목록/이력의 우선순위 및 single-flight 유지 | 동일 준비를 합치고 한 caller 취소가 다른 owner를 중단하지 않게 함. UI/다른 세션은 계속 동작 |
| P1 | 느린 MCP의 HTTP/SSE 단계와 다중 client 수용 여부를 식별 | endpoint가 동시 연결을 제한하면 prewarm만으로 해결되지 않음. 사용자 MCP를 임의 비활성화하거나 A를 강제로 끊지 않음 |
| P1 | 호환 config/env 범위의 process 공유 검토 | CLI·모듈·전역 파일 작업 중복 완화. directory별 MCP/plugin 상태는 계속 구분되므로 cwd key 삭제만으로 해결됐다고 보지 않음 |
| P1 | 설치/탐색/cache 준비와 plugin setup/config hook 순서를 분리 | 독립 I/O는 병렬로 하되 native hook 순서 보존. 실제 실패 plugin의 단계부터 확인 |
| 별도 제품 결정 | 준비된 MCP만 사용해 모델 응답을 먼저 시작하고 나머지는 나중에 사용 | 도구 집합·지침이 달라짐. 동일 응답 도중 도구를 임의 추가하는 동작은 Desktop 동등 동작이 아니며 이번 진단에서 적용하지 않음 |

우선 실제 사용자 환경에서 `B-send → server/global/config/session/prompt204 → MCP transports/tools-ready → first assistant text`의 시간을 확보해야 한다. 이번 제어 재현과 대조는 MCP 대기가 1분 패턴을 만들 수 있음을 증명하지만 특정 사용자 MCP/플러그인의 원인을 확정하지 않는다.

## 실측 재현 자료와 범위

[지연 script](evidence/cross-directory-idle-delay/blocked-probe.cjs), [정상 MCP script](evidence/cross-directory-idle-delay/control-probe.cjs), [한 process script](evidence/cross-directory-idle-delay/single-server-probe.cjs), [번들 entry](evidence/cross-directory-idle-delay/entry.ts)를 `.git/opencode-cross-directory-research/`에 복사해 사용한다.
entry의 상대 경로는 이 위치를 전제로 한다. app의 esbuild에서 entry를 node/cjs로 번들링해 `adapter-server.cjs`를 만들고 `electron`·`better-sqlite3`는 external로 둔다. CLI는 형제 `.git/opencode-1.17.19/package/bin/opencode.exe`의 실제1.17.19를 사용했다.

정상 MCP 실험은 `ORCA_PROBE_ALLOW_MULTIPLE=1`, 한 process 경계 실험은 `ORCA_PROBE_SINGLE_SERVER=1`·`ORCA_PROBE_ALLOW_MULTIPLE=0`로 실행했다. Electron은 `Start-Process -WindowStyle Hidden -Wait`와 출력 파일 리다이렉트로 실행했고 종료 시 해당 script가 만든 native child tree와 제어 서버를 닫았다. 사용자 설치 CLI·설정·원본 DB와 실행 중인 다른 앱은 변경하지 않았다.

이번 턴은 진단과 제어 실측이다. 런타임 코드는 유지했으며 개선 방향은 아직 구현하지 않았다.
