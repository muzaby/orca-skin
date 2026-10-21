# 첫 입력 전 OpenCode 컴포저 준비 — 구현 보고

작업폴더가 정해진 OpenCode 컴포저에서 첫 메시지 전 native 에이전트를 선택하도록 구현했다. `/agent` 완료 시 목록을 반영하며 모델 조회가 끝나기를 기다리지 않는다. 사용자 후속 지시에 따라 팝업의 상태 문구·스피너·기타 안내는 제거했다. 고정 새로고침 메뉴로 명시 재조회한다.

## 실행 순서와 재조회

| 항목 | 구현 동작 / Desktop 대응 |
| --- | --- |
| 준비 시작 | OpenCode 선택 + 작업폴더 확정. 다중 하네스 앱이므로 앱 부팅만으로 서버를 시작하지 않음 |
| 에이전트 | `/agent`가 native directory 초기화·plugin config hook·Agent.list를 완료하면 즉시 반영. 별도 config/SSE/session/MCP/command 선행 없음 |
| 모델 | `/provider` 독립 완료·독립 실패. agent만 지정한 입력의 대기 조건에서 제외 |
| 재사용 | directory 세대별 각 목록 캐시와 진행 요청 공유. 두 컨트롤·메뉴 재개방·첫 제출·상태 패널 조회에서 중복 HTTP 방지 |
| 새로고침 | 실제 턴 resolver로 최신 settings/env/cwd를 다시 해석. 새 lease 확보 후 이전 lease 반납. 호환 profile은 같은 instance 유지 |
| 실패·취소 | 실패를 빈 성공으로 바꾸지 않음. 기존 결과 보존, 늦은 scope/세대 응답 폐기. 한 소비자 취소는 공유 HTTP를 중단하지 않음 |
| 첫 제출 | 준비한 directory에 세션 owner 추가. agent만 선택하면 agent만 검증, variant도 선택하면 필요한 두 부분을 병렬 검증 |
| 다른 폴더 | 기존 서버·module import 공유, 새 directory의 native plugin setup/config hook 수행 |
| 정리 | 마지막 화면 구독·창 reload/crash/destroy·앱 종료에서 준비 owner 반납. 살아 있는 세션 owner는 유지. 마지막 directory 정리가 끝나면 소유 서버 종료 |

native plugin 자체 초기화, 설정된 참조 탐색, MCP 등 native 내부 의존성 비용은 제거하지 않는다. 명시 조회는 native 캐시를 읽으며 plugin 파일 변경의 강제 hot reload·재설치는 제공하지 않는다.

## 실제 CLI 관측

OpenCode **1.17.19**, Electron **39.8.10**, 설치된 SDK `/v2/client`, production `OpenCodeServerPool`·`OpenCodeAdapter`를 사용했다. XDG 저장소·loopback 모델 서버·fixture plugin을 격리했다. 사용자 설정·이력은 변경하지 않았다. native 결과는 [native-result.json](evidence/native-result.json), 재현 코드는 [native-probe.cjs](evidence/native-probe.cjs)다.

- provider HTTP를 의도적으로 보류한 동안 `Atlas-A`를 얻고 선택한 첫 입력을 정상 완료했다. 에이전트 표시 전 `/config`, `/global/event`, `/session`, `/command`, `/mcp` 요청은 없었다.
- 같은 A 재읽기는 캐시를 사용했고 동시 명시 새로고침은 하나의 `/agent` 요청으로 합쳐졌다. plugin setup은 반복되지 않았다.
- A가 열린 idle 상태에서 B의 `Atlas-B`를 준비하고 B 입력을 완료했다. 서버 spawn 1회, 전역 SSE 1회, module import 1회, plugin setup/config hook은 폴더별 1회였다.
- 화면 준비 owner만 반납했을 때 살아 있는 세션의 instance는 유지됐다. 모든 세션을 닫은 뒤 `/instance/dispose`가 수행됐고 `adapter.close()` 전에 실제 서버가 종료됐다.

의존성이 설치된 검증 환경에서 최초 A `/agent`→목록은 약 2.60초, B는 약 1.87초였다. fixture는 폴더별 plugin setup에 1초 지연을 넣었다. 별도 서버 시작 비용은 포함하지 않은 구간이며 사용자 환경의 성능 보장은 아니다. 초기 격리 실행에서는 native 의존성 설치 대기가 발생했다. 설치 비용을 앱 비동기 분리만으로 제거할 수 있다는 결론을 내리지 않는다. 이 probe는 실제 MCP 서버를 구성하지 않았으며 MCP·다중 인스턴스 수명은 기존 0275 검증 및 관련 회귀 테스트로 확인한다.

## UI 관측

실제 ChatTile·React control·CSS를 사용하고 IPC만 대역으로 제공하는 격리 Electron 화면에서 확인했다. [실행 결과](evidence/ui-result.json), [재현 코드](evidence/ui.cjs), [밝은 테마](evidence/composer-white.png), [어두운 테마](evidence/composer-dark.png), [조회 실패 상태](evidence/composer-error.png).

모델 응답을 보류한 동안 에이전트 선택 가능, Atlas 선택 반영, 최초 조회 실패 후 새로고침 회복을 확인했다. 두 테마와 실패 상태 모두 로딩·오류 문구·스피너가 없다. 키보드 End로 새로고침 이동, Escape로 anchor 초점 복귀는 자동 테스트에서도 확인했다.

## 검증

- 관련 비DB Vitest: **40파일 385케이스 통과**(주요 회귀 39파일 378 + bootstrap shutdown 7). 실제 SDK 요청 순서·캐시·취소·수명·prompt/command 회귀와 renderer/preload/handler 조립을 포함한다.
- native cursor: Electron Node 모드의 thread pool에서 **7케이스 통과**. SQLite 바이너리를 Node ABI로 바꾸지 않았다.
- node/web/test 타입 검사 통과. lint 오류 0, 기존 React virtualizer 경고 2건.
- main/preload/renderer 빌드 통과. 기존 동적 import 혼용 경고 유지.
- 문서 inventory·수치 재서술 검사, 테스트 예산 검사 통과. 전체 링크 검사에는 외부 참고 checkout의 기존 오류 10건이 있다. `.tmp/opencode-dev`, `app/.temp/opencode`를 제외한 동일 링크 검사는 오류 0건이다.
- 독립 검증자의 verify는 별도 단계다.

## 재현

native probe는 `.tmp/0276-composer-probe/probe.cjs`로 복사하고 CLI를 `.git/opencode-1.17.19/package/bin/opencode.exe`에 둔다. probe 폴더의 `entry.ts`에서 production adapter/server를 export하고 app의 esbuild로 `adapter-server.cjs`를 생성한다(`bundle:true`, `platform:'node'`, `format:'cjs'`, `external:['electron','better-sqlite3']`). 처음 native 의존성 설치에는 네트워크와 시간이 필요하다. 이 보고의 마지막 실행은 이미 설치된 격리 의존성을 사용했다.

UI는 `app/scripts/fixtures/opencode-ui/README.md`대로 Vite를 시작하고 probe를 같은 `.tmp/0276-composer-probe` 폴더에 둔다. 두 probe는 `ELECTRON_RUN_AS_NODE`가 없는 Electron 프로세스에서 실행하며, 독립 userData와 hidden/offscreen 창을 사용한다. 생성된 설정·DB·이미지는 해당 probe 폴더 안에만 남는다. 제어된 fixture이며 실제 사용자 플러그인의 모든 네트워크·초기화 동작을 대표하지 않는다.
