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

## 첫 OpenCode 사용 비용과 다른 경로·세션의 재사용 범위

사용자의 후속 질문은 Orca가 OpenCode 전용 앱이 아니므로 앱 전체 부팅이 아니라 **첫 OpenCode 세션에서 공통 비용을 지불하고 이후 재사용할 수 있는가**다. 동일한 실제 CLI·adapter/server pool에 정상 다중 client MCP와 제어 file plugin을 더해 각 수명의 비용을 측정했다.

plugin module의 top-level import, directory별 setup, config hook을 loopback endpoint로 각각 기록했다. setup에만1,200ms를 의도적으로 넣었다. 모델 응답은 앞 실험과 같은 고정 SSE이고 npm 의존성은 이전 격리 실험에서 이미 설치되어 있었다.

| 단계 | 현재 per-directory process: 완료 시간 | 공통 process 연구 구성: 완료 시간 |
|---|---:|---:|
| A 첫 세션 | 13,920ms | 10,927ms |
| A 같은 세션 후속 입력 | 2,070ms | 1,689ms |
| A 같은 경로 새 세션 | 1,763ms | 1,754ms |
| B 처음 여는 다른 경로 | 9,669ms | 6,481ms |
| B 같은 세션 후속 입력 | 1,739ms | 1,666ms |
| B 같은 경로 새 세션 | 1,719ms | 1,675ms |
| A 경로로 돌아와 새 세션 | 1,699ms | 1,694ms |
| A의 마지막 채널 owner 해제 후 다시 A, B는 유지 | 11,414ms | 1,680ms |

시간은 각 구성1회 실행한 제어 실험이며 사용자 환경 benchmark나 개선율이 아니다. 모델/제목 처리도 포함하므로 아래 **초기화 발생 횟수**로 재사용 여부를 판정했다. 마지막 행은 adapter의 `live.close()`로 A owner들을 실제 해제한 조건이며 UI 탭을 닫는 것과 같다고 가정하지 않는다.

완료 시간 정본은 JSON의 `steps[].ms`다. `trace`의 `step-result.ms`는 해당 단계 소요시간을 다시 기록한 요약행이며, 다른 trace 행의 ms는 script 실행 시작 기준이다.

| 새로 발생한 횟수: spawn / plugin import / plugin setup / MCP 연결 | 현행 구조 | 공통 process 연구 구성 |
|---|---|---|
| A 첫 세션 | 1 / 1 / 1 / 1 | 1 / 1 / 1 / 1 |
| A 후속 입력·같은 경로 새 세션 | 각0 / 0 / 0 / 0 | 각0 / 0 / 0 / 0 |
| B 첫 경로 | 1 / 1 / 1 / 1 | **0 / 0 / 1 / 1** |
| B 후속 입력·같은 경로 새 세션 | 각0 / 0 / 0 / 0 | 각0 / 0 / 0 / 0 |
| A로 돌아와 새 세션, 기존 owner 유지 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| A 마지막 owner 해제 후 다시 A, B 유지 | **1 / 1 / 1 / 1** | 0 / 0 / 0 / 0 |

config hook은 plugin setup과 같은 횟수로 발생했다. 전체 실행에서 현행 구조는 spawn/import/setup/MCP 각각3회, 연구 구성은 spawn/import1회·setup/MCP2회였고, 각 구성의8개 응답 frame 모두 오류 없이 완료했다.

근거: [현행 비용 범위 JSON](evidence/cross-directory-idle-delay/warm-production-result.json), [공통 process 비용 범위 JSON](evidence/cross-directory-idle-delay/warm-shared-result.json), [실행 script](evidence/cross-directory-idle-delay/warm-scope-probe.cjs).

### 공통 비용을 첫 세션으로 모을 수 있는 범위

| 범위 | 비용과 수명 | 관측 / 설계상 의미 |
|---|---|---|
| Orca 앱 | 엔진 등록·설치 상태 조회 | 현재 bootstrap은 모든 adapter의 설치 상태를 확인하며 OpenCode `--version` probe는 있다. 이때 serve/plugin/MCP를 모두 준비하는 것은 아님 |
| 동일 OpenCode 실행 파일·설정·환경 묶음 | 프로세스·공통 module import·서버 event 연결 | OpenCode 최초 사용 시 지연 초기화하고 여러 세션에서 유지할 수 있음. 현재 process key에는 cwd가 있어 다른 경로에서 반복 |
| directory instance | 해당 폴더의 config·plugin setup/config hook·MCP·agent/provider 준비 | 처음 보는 경로에서는 다시 필요. 같은 module을 import했어도 plugin 함수는 directory/worktree를 받아 다시 실행됨 |
| native session | 세션 생성·대화 이력·제목·모델 입력 | 같은 경로 새 세션에도 세션 고유 작업은 존재. 초기화 재사용을 무응답 시간0으로 해석하지 않음 |

모든 경로의 비용까지 첫 세션에 몰아넣으려면 미리 아는 모든 directory를 실제 초기화해야 한다. 이후 추가되는 경로까지 준비를 완료할 수는 없으며, 다중 MCP 연결을 한꺼번에 만드는 비용도 생긴다. 따라서 이 조사에서 확인한 목표는 **엔진 공통 비용1회 + 처음 쓰는 경로별 준비1회 + 세션 고유 비용**이다.

### 여러 엔진을 지원하는 Orca에 맞춘 방향

OpenCode의 무거운 서비스 준비는 첫 OpenCode 사용 시점에만 시작하고, 다른 엔진의 사용과 독립적으로 수명을 관리하는 방식이 맞다. 같은 설정·환경의 서비스와 directory 준비를 재사용하면 다른 세션에서 공통 초기화를 반복하지 않을 수 있다. 프로필의 설정·인증·env가 다르면 동일 service로 무조건 합치지 않는다.

현재 pool은 마지막 owner 해제 시 process를 종료하므로, "첫 사용 비용을 이후에도 보존"하려면 세션 lease와 별개의 engine/service owner가 필요하다. 연구 구성에서 A가 빨랐던 마지막 행은 **B owner가 남아 공유 process를 보존했기 때문**이며, 모든 OpenCode owner가0인 상태를 넘어 유지하는 정책을 구현한 것은 아니다. 설정/실행 파일 변경·native instance 폐기·앱 종료와 자원 회수 시의 무효화도 함께 설계해야 한다.

동일 process의 여러 directory 공유는 이번 제어 plugin에서는 동작했지만, 임의 plugin의 `process.cwd()` 의존성·상대 경로·프로필 격리까지 검증한 제품 구현이 아니다. 공통 process만으로 MCP가 directory별 재연결되는 경계나1분 timeout 문제까지 사라진다고 보지 않는다.

재현은 같은 임시 폴더와 번들 entry를 사용한다. `warm-scope-probe.cjs`를 복사하고 `ORCA_PROBE_SINGLE_SERVER=0`으로 현행 구성을, `1`로 연구 구성을 실행한다. script가 생성하는 file plugin, native DB, MCP/model HTTP endpoint는 모두 격리된 제어 데이터이며 두 실행의 소유 child tree를 종료했다.

## 서버 공유·인스턴스 해제 제안 검토 — 적용하지 않음

사용자는 다른 작업폴더도 Desktop처럼 운영하고, 세션 종료 시 인스턴스까지 해제한 뒤 모든 인스턴스 해제 시 서버를 정리하는 방식을 제안했다. 이어서 **바로 적용하지 말고 검토**하라고 지시했다. 이번 절은 타당성 검토와 격리 API 실험이며 제품 코드·수명 정책·handoff 보드는 변경하지 않았다.

**조건부로 타당하다.** 같은 설정·환경의 서버 공유와 directory별 native 해제는 가능하지만, session과 directory instance는1:1이 아니다. 현재의 `cwd` key 제거와 session close마다 무조건 dispose 호출만으로 구현할 수는 없다.

### 실제 native 해제 API 확인

설치 SDK의 `client.instance.dispose({ directory })`는 `POST /instance/dispose`를 사용한다. CLI1.17.19는 해당 directory context를 해제 대상으로 표시한 뒤 HTTP 응답 이후 native middleware에서 teardown을 수행한다. 따라서 응답 성공을 finalizer 완료로 취급하면 안 된다.

한 소유 CLI server에서 A/B의 config·plugin·MCP를 준비하고 A에 native session을 생성했다. 모델 prompt는 보내지 않았으며 제어 plugin의 dispose hook에만1,500ms 지연을 넣어 완료 시점을 구분했다.

| 확인 항목 | 실측 / 의미 |
|---|---|
| A 해제 응답과 완료 구분 | HTTP200 수신6,277ms → plugin dispose 완료7,798ms → `server.instance.disposed`7,810ms |
| 다른 directory 보존 | A 해제 후 B MCP status는 connected. B plugin setup/dispose는 그 시점에 다시 발생하지 않음 |
| native 데이터 보존 | A를 다시 준비한 뒤 기존 native session.get 성공. instance dispose는 저장된 대화 삭제가 아님 |
| A 재진입 비용 | 같은 process의 module import는1회 유지. A setup은 다시 실행되고 MCP도 재연결 |
| 미생성 C에 해제 요청 | plugin setup C10,415ms → config C11,640ms → dispose HTTP20011,656ms → dispose event13,184ms. 해제 API도 instance middleware가 먼저 load함 |
| MCP 정리 범위 | A/B의 제어 MCP 수신 stream close 관측. MCP endpoint로 DELETE 요청은0회였으므로 원격 서버 측 세션 삭제까지 보장한다고 해석하지 않음 |
| 최종 정리 | A/B 해제 완료 event 후 실험 종료. 소유 child tree/HTTP 서버 종료, modelRequests0 |

근거: [native 해제 검토 JSON](evidence/cross-directory-idle-delay/instance-review-result.json), [검토 script](evidence/cross-directory-idle-delay/instance-review-probe.cjs). 앞 실험과 같은 임시 폴더·번들을 사용하고 `ORCA_PROBE_SINGLE_SERVER=1`로 실행했다. session 원본은 격리된 native DB에만 있으며 사용자 DB·설정은 변경하지 않았다.

### Desktop과 같은 부분 / Orca에 맞춘 추가 정책

| 항목 | 검토 판정 |
|---|---|
| 공유 서버의 directory 라우팅 | Desktop과 같은 native 기능으로 가능. `serve`는 시작 시 ambient project instance가 없고 요청 directory로 instance를 load함 |
| config·plugin·MCP 의존성 준비 | native bootstrap·InstanceState의 기존 순서와 scope를 사용해야 함. Orca가 hook 순서나 MCP 도구 집합을 임의로 재구현할 필요는 없음 |
| 인스턴스 정리 | native API가 scoped cache 무효화와 등록된 plugin/MCP finalizer를 수행. 임의 plugin의 미등록 전역 자원까지 정리한다고 보장할 수는 없음 |
| Desktop 화면 해제 | `child-store.disposeDirectory`는 renderer store/query/SDK cache의 정리. 이것을 native `instance.dispose` 호출과 같은 동작으로 보지 않음 |
| 마지막 인스턴스 이후 server 종료 | Desktop의 기본 app-lifetime server와 다름. 여러 엔진을 쓰는 Orca의 자원 회수를 위한 추가 정책으로는 성립 |

source: 고정 태그의 `cli/cmd/serve.ts`, `server/routes/instance/httpapi/{handlers/instance.ts,lifecycle.ts,middleware/instance-context.ts}`, `effect/{instance-state.ts,instance-registry.ts}`, `project/instance-store.ts`, `plugin/index.ts`, `mcp/index.ts`, app의 `context/global-sync/child-store.ts`·`server-sync.tsx`.

### 적용 전에 닫아야 할 경계

| 경계 | 필요한 조건 / 현재 코드의 영향 |
|---|---|
| 세션↔인스턴스 cardinality | 같은 폴더의 세션 여러 개가 한 instance를 공유. 한 세션 종료는 자기 참조만 반납하고 마지막 사용자가 사라질 때만 native dispose |
| 실제 소유자 | 진행/idle runtime·background child·승인·bootstrap·history/complete 등 해당 instance를 쓰는 작업을 포함. UI 탭 개수나 응답 완료만으로0을 판정하지 않음 |
| 초기화된 대상만 해제 | 미생성 instance의 dispose가 bootstrap을 유발할 수 있음. acquire만 했거나 준비 중 취소된 대상의 native 상태를 구분해야 함 |
| 해제 중 재진입 | `ready → disposing → disposed` 동안 같은 directory의 새 세대 연결을 serialize. 이전 dispose event/cache 삭제가 새 세대를 지우지 않도록 fence 필요 |
| 종료 시점 | 서버의0 판정에 새 acquire·부팅 중 instance·dispose 진행 상태를 포함. HTTP200만 받고 PID를 종료하면 plugin/MCP cleanup이 중단됨 |
| 해제 실패 | A teardown이 늦거나 실패했을 때 살아 있는 B까지 server kill로 정리할 수 없음. 별도 timeout·회수 보류·오류 상태 필요 |
| process 환경·상대 경로 | Desktop sidecar도 process cwd는 하나. 임의 plugin의 `process.cwd()`·상대 OPENCODE_CONFIG/env·경로 생략 SDK 호출을 조사해야 하며 cwd key만 제거하면 기존 동작이 달라질 수 있음 |
| 설정·인증·작업공간 격리 | 실행 파일/설정/env가 다른 profile은 별도 server. 실제 요청의 directory/workspace와 native data 경로 의미도 보존 |
| 보조 작업과 전송의 연결 | history/complete가 잠깐 instance를 보유했다가0으로 만들면 다음 전송에서 재초기화. 같은 준비 작업의 lease 승계가 없으면 비용 반복은 남음 |
| 공유 서버의 실패 범위 | process 장애·global SSE 실패가 여러 폴더에 영향을 줌. B 실패가 A를 조용히 끊거나 prompt를 자동 재전송하지 않게 해야 함 |

현재 `RuntimeSupervisor.releaseRuntime`은 응답이 끝난 live runtime을 idle pool에 보관한다. 따라서 제안의 "세션 종료"는 기존 정책을 유지한다면 실제 runtime/channel owner 반납 시점에 해당한다. 탭 전환·응답 완료에 맞춰 해제하려면 별도의 사용자 동작/수명 정책 변경이다.

### 비용과 수명 정책의 절충

A의 마지막 사용자가 떠날 때 instance를 즉시 해제하면, B 덕분에 server가 살아 있어도 다음 A 진입에서 plugin setup·MCP 준비를 다시 수행한다. 앞의 공통 process 연구 구성에서 A 재진입1,680ms였던 조건은 A native instance를 해제하지 않은 경우다. 제안한 즉시 instance 회수 정책에 같은 시간을 그대로 약속할 수 없다.

모든 instance를 정리하고 server도 종료하면 이후 OpenCode 사용에서 process 공통 비용도 다시 발생한다. 이는 회수 정책의 의도된 결과이며 "앱 전체에서 최초1회 비용"과는 다른 목표다. 재사용성과 자원 회수 중 어느 수준까지 보존할지는 실제 owner 해제 기준과 함께 확정해야 한다.

검토 기준으로 가능한 수순은 **호환 profile의 server acquire → directory instance 참조 획득 → session/작업 수행 → 개별 참조 반납 → directory 마지막 참조에서 native dispose 완료 확인 → 부팅/해제 작업까지 모두 사라진 server 종료**다. 원본 session DB는 이 수순의 삭제 대상이 아니다.

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
