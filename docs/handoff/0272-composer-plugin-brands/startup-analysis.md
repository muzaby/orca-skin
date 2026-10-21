# 결과 보고 — 플러그인 표시·요청 이력·OpenCode 시작

2026-10-21 조사. UI 변경과 시작 시퀀스 조사를 구분한다.

## 1. 적용 결과

| 요청 | 결과 | 근거 |
|---|---|---|
| native 플러그인 활성화 확인·색상 | SDK에 실제 반영하는 경로 확인. 후속 답변 “현상태 유지”에 따라 nav 색상 기준 유지 | 아래 §2 |
| 엔진 추가 메뉴의 컬러 브랜드 | Claude/OpenCode 선택지 왼쪽에 기존 공식 SVG와 브랜드 토큰 적용 | `AgentEnvironmentView.interaction.test.ts` 실제 메뉴→폼 |
| 양 Composer의 `/`·`@` highlight | native MCP도 @id로 삽입, 참조와 같은 배경색. 스킬은 /name 유지 | `Composer.native-menu.test.ts` 양 backend 실제 +→선택→입력/장식 |
| + 메뉴 그룹의 컬러 브랜드 | 출처의 하네스에 맞는 색을 명시 | registry `composer.ts`, 실제 메뉴 SVG/색 단언 |
| OpenCode 시작 차이 | 버전별 시퀀스와 대기 지점 확인. 13초 추가 지연의 단일 원인은 미확정 | 아래 §4~7 |

플러그인 메뉴에 있는 native MCP는 연결·활성 관측이 모두 있을 때만 후보와 highlight에 포함한다. 설치 plugin이 제공하는 스킬은 기존 스킬 그룹의 `/이름`으로 남는다.
관련 56파일 342케이스와 node/web/test 타입 검사·린트·빌드가 통과했다. 실제 메뉴·입력·SVG·장식 DOM은 테스트했으며, 브라우저 도구가 localhost 접근을 `ERR_BLOCKED_BY_CLIENT`로 차단해 실제 창의 white/dark 시각 인수는 남아 있다.

## 2. 상태 패널 토글은 실제 활성화인가

그렇다. Claude의 경로는 다음과 같다.

```text
상태 패널 toggle
 → sessionSetNativeResource: 현재 runtime/generation/설치/canToggle 검증
 → applyFlagSettings(enabledPlugins의 pluginName@inline)
 → reloadPlugins()
 → 반환 plugin 목록에서 실제 활성 상태 확인
 → 프로젝트 .claude/settings.local.json의 marketplace key에 저장
 → 같은 범위의 리소스 관측을 구독자에게 전달
```

`reloadPlugins()`의 관측과 요청 상태가 다르면 오류를 내고 이전 flag로 복구를 시도한다. UI 값만 바꾸는 토글이 아니다.
근거: [native-resources.ts](../../../app/src/main/adapters/claude/native-resources.ts), [plugin-state.ts](../../../app/src/main/adapters/claude/plugin-state.ts), [session-resources.ts](../../../app/src/main/app/handlers/session-resources.ts), `adapter.native-plugins.test.ts`·`native-resources.test.ts`·`plugin-state.test.ts`.

nav 스킬 탭은 [skill-catalog.ts](../../../app/src/main/app/skill-catalog.ts)의 홈 디렉터리 기준 inventory를 읽는다. 프로젝트 local에서 Superpowers를 켜도 전역 설정은 false일 수 있으므로, 상태 패널과 nav가 서로 다른 범위를 표시할 수 있다.
사용자가 범위 질문에 **“현상태 유지”**라고 답했으므로 nav를 특정 세션의 색상으로 덮어쓰거나 전역 설정을 활성화하지 않았다.

OpenCode의 plugin bundle은 현재 읽기 전용이다. MCP 연결 제어와 Claude plugin reload 지원을 같은 기능으로 일반화하지 않는다.

## 3. 이전에 같은 요청을 했는가

저장소에 남은 사용자 결정·핸드오프 기록을 기준으로 확인했다.

| 이번 표면 | 이전 기록 | 판정 |
|---|---|---|
| 엔진 추가 팝업의 Claude/OpenCode 로고 | [0267 plan](../0267-harness-entry-menu/plan.md) D60/AC56은 엔진 **카드**, D61/AC57은 Composer **모델 popup**의 컬러 브랜드 | 유사 요청은 있었다. 추가 메뉴 자체의 같은 문장은 확인되지 않았다 |
| `/스킬`·`@플러그인` 선택·하이라이트 | [0238 plan](../0238-fable-plugin-composer-auth-ui/plan.md) 사용자 요청 2·기존 @ 강조/chip; [0259 plan](../0259-composer-menu-grouping/plan.md) D-003·선택 흐름은 @id 삽입 | 같은 방향의 요청이 있었다 |
| native plugin skill과 native MCP | [0267 plan](../0267-harness-entry-menu/plan.md) D-19는 plugin 제공 스킬을 스킬 메뉴에 /명령으로 배치 | 이 분류는 유지. native MCP를 일반 문장으로 넣던 경로가 @ highlight와 연결되지 않았음 |
| + 그룹 로고의 색 | 0267의 모델 그룹·상태 타일 컬러 브랜드 | 유사 요청은 있었으나 +의 sourceIcon에는 색이 빠져 있었음 |

이 조사는 저장소 기록의 범위다. 기록에 남지 않은 대화까지 없었다고 단정하지 않는다.

## 4. 비교한 버전

| 대상 | 고정한 상태 | 의미 |
|---|---|---|
| 사용자 제공 `.temp/opencode` HEAD | `5fa426f68d1dbf3c8aaa01557e357719f0577438`, package 2.1.1 | 최신 background service 설계 |
| 같은 저장소의 `v1.19.0` | `733b2c627e5aec39cb33cc22373bdce33053ef2c` | 설치 CLI와 맞춘 desktop/server/plugin 코드 |
| 실제 PATH CLI | `opencode --version` → `1.19.0` | 실제 loopback 계측 대상 |
| Orca | `adapters/opencode/v1` | serve 기반 1.x 구현, major 2는 현재 거부 |

HEAD 2.1.1의 desktop과 Orca 1.x의 시간을 같은 구현으로 비교하지 않았다. 아래 표에는 설치 버전에 맞는 1.19.0과 HEAD를 나눴다.

## 5. 데스크톱과 Orca의 시작 시퀀스

| 단계 | native desktop 1.19.0 | native desktop HEAD 2.1.1 | Orca |
|---|---|---|---|
| 서버 시작 시점 | 앱 loading task에서 sidecar 시작, serverReady/health 제공 | early window 생성 후 compatible service 탐색·ensure | 실행 채널이 client를 요청할 때 pool.acquire |
| 서버 방식 | 기본 SIDECAR_VERSION=v1은 utilityProcess의 bundled Server.listen. OPENCODE_SIDECAR_V2=1일 때 background CLI 분기 | `Service.discover/ensure`, `serve --service`, 같은 버전의 서비스 재사용 | 별도 소유 CLI `serve --hostname=127.0.0.1 --port=…` |
| 공유 단위 | desktop 앱의 server 연결 | background service | 실행 파일+설정+유효 env+cwd fingerprint |
| 수명 | 앱/window 연결보다 앞에서 준비한 server를 재사용 | background service 수명 | 마지막 owner release 시 entry 제거·자신의 child 종료 |
| 세션 진입 | 이미 확보한 server의 directory별 instance 사용 | service의 workspace/session 사용 | health→session.create/reuse→event.subscribe→첫 이벤트→첫 submit |
| Composer 목록 | UI/server가 기존 연결로 조회 | 기존 서비스 연결로 조회 | agent/provider 조회를 병렬 시작; 명시 agent/variant가 없으면 첫 submit이 그 결과를 기다리지 않음 |

확정 차이: Orca는 설정·cwd·env가 다르거나 owner가 모두 해제되어 새 서버가 필요하면 CLI와 instance 초기화 비용을 다시 낸다. native desktop이 이미 준비한 같은 server/instance를 사용하는 경우와 체감 시작 시간이 다를 수 있다.
이 사실만으로 사용자가 관측한 13초 전부를 server 생성 비용이라고 확정할 수는 없다.

현재 Orca 근거: [server.ts](../../../app/src/main/adapters/opencode/v1/server.ts)의 `key/acquire/release/start`, [channel.ts](../../../app/src/main/adapters/opencode/v1/channel.ts)의 `run/refreshComposer/submit`, [composer-catalog.ts](../../../app/src/main/adapters/opencode/v1/composer-catalog.ts), [native-storage.ts](../../../app/src/main/adapters/opencode/v1/native-storage.ts).
native 근거: `git -C app/.temp/opencode show v1.19.0:packages/desktop/src/main/{index,server,sidecar}.ts`; HEAD의 `main/index.ts`, `main/service/{background-service,sidecar-probe}.ts`.

## 6. config 이후에도 기다리는 지점

설치 버전 1.19.0의 직접 코드 조사 결과다.

| 자리 | 확인한 동작 | 지연 해석 |
|---|---|---|
| `project/bootstrap.ts:36–38` | `config.get()` 다음 `plugin.init()`을 먼저 기다림 | config를 읽었다고 plugin 준비까지 끝난 것은 아님 |
| `plugin/index.ts:184` | 외부 plugin이 있으면 `config.waitForDependencies()` | config 디렉터리의 의존성 작업을 기다릴 수 있음 |
| `plugin/loader.ts:loadExternal` | 후보 resolve/import를 Promise.all로 실행 | 플러그인 파일 해석·import 시간을 단순히 항목 수로 합산하면 틀림 |
| `plugin/index.ts:221–256` | 적용 함수와 config hook은 순서대로 await | 느린 setup/hook은 누적될 수 있음 |
| `mcp/index.ts`의 초기화 | 서버 연결은 concurrency=unbounded, 개별 connect timeout 사용 | 다수 MCP가 항상 N×timeout은 아님. 느린 연결·도구 조회·반복된 instance 생성은 분리해야 함 |
| `session/tools.ts:390`, `session/system.ts:123` | 첫 요청에서 MCP tools/instructions를 취득 | session.create/SSE 준비 이후 모델 호출 전에도 MCP 비용이 생길 수 있음 |
| Orca `channel.ts:299` | 첫 SSE 이벤트를 기다린 뒤 submit | 연결 준비와 첫 모델 응답은 다른 측정 경계 |
| Orca `server.ts:231` | child stderr를 drain하고 사용자 설정 원문은 로그에 복사하지 않음 | 현재 Orca 로그만으로 plugin별 세부 시간을 복원하기 어려움 |

`config/config.ts`의 **loading** 로그는 파일을 읽는 경로의 시작 로그다. 그 행만으로 config 전체 완료 시각을 확정할 수 없다.
`failed to load plugin`의 `path` 필드는 해당 plugin spec이며, 반드시 “OS 경로가 없음”만 뜻하지 않는다. resolve/install, entry·호환성, dynamic import, plugin 적용 함수, config hook 실패를 오류 원인과 함께 나눠야 한다.

현재 13초 관측과 양립하는 후보는 의존성 준비, 특정 plugin setup/hook, MCP 연결/도구 준비, server/instance 재생성이다. 실제 지연을 재현한 trace가 없으므로 이들 중 하나를 원인으로 확정하지 않았다.

## 7. 실제 계측과 한계

설치 CLI 1.19.0으로 별도 loopback server를 띄우고 health·병렬 Composer 조회·빈 세션 생성·SSE·MCP 상태·같은 server의 두 번째 세션 생성을 요청했다. 모델 prompt는 전송하지 않았고, probe가 생성한 세션 삭제와 소유 child 정리를 수행했다.
사용자 홈 설정과 Orca `hf` 원본 엔진 설정을 각각 사용했으며, 이 둘의 최종 config는 **외부 plugin 0·MCP 0**이었다.
계측 뒤 CLI가 반환한 native DB를 읽기 전용으로 조회하여 probe 전용 title의 잔여 세션이 0임을 확인했다.

| 프로세스 시작부터 누적 시간 | 홈 설정 | Orca hf 원본 설정 |
|---|---:|---:|
| listening | 2,287ms | 2,188ms |
| health | 2,379ms | 2,207ms |
| 첫 session.create 응답 | 3,123ms | 2,984ms |
| 첫 SSE 이벤트 | 4,452ms | 3,878ms |
| plugin load 실패 | 0 | 0 |
| 병렬 agent/provider 조회 | 2.5초 제한에서 둘 다 reject | 둘 다 fulfilled |

단발 관측이며 캐시·OS·동시 작업을 통제한 성능 benchmark가 아니다. 사용자의 다수 MCP/plugin 조건과 config 이후 13초 지연, 실패 plugin spec은 이 설정에서 재현되지 않았다.
agent/provider 기본 조회는 코드상 첫 submit의 필수 await가 아니므로 해당 timeout만으로 13초를 설명하지 않는다.

재현 자료: [계측 JSONL](evidence/startup-timings.jsonl), [실행 스크립트](evidence/startup-probe.cjs).
저장소 루트에서 `node docs/handoff/0272-composer-plugin-brands/evidence/startup-probe.cjs <opencode.exe 절대경로> <settings.json 절대경로>`로 실행한다. 출력에는 설정 원문·인증값·실제 MCP id를 싣지 않는다.

## 8. 다음 성능 변경의 우선순위

1. 지연이 발생한 동일 cwd·유효 설정에서 `config.get 종료 / dependencies 종료 / plugin별 resolve·setup·config hook / MCP connect·tools / session.create / SSE 첫 이벤트 / prompt 수락 / 첫 모델 이벤트`를 같은 trace로 잰다.
2. 실패한 plugin은 spec과 stage·오류 코드를 먼저 확인한다. 누락 경로·잘못된 entry/export·SDK 호환성·인증/네트워크 문제를 구분한다.
3. owner 해제와 config/env/cwd fingerprint 변화로 같은 구성이 반복 초기화되는지 센다. 따뜻한 소유 server 유지나 준비 시점 이동은 자원·격리·설정 갱신 계약을 별도 설계한 뒤 적용한다.

이번 변경은 시작 수명·MCP/plugin 활성 정책을 바꾸지 않는다. UI 표시 수정과 성능 원인 조사를 함께 완료한 결과다.
