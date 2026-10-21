# 공유 OpenCode 서버와 directory 인스턴스 — 구현 검증

구현했다. 호환되는 실행 파일·구성·환경은 작업폴더가 달라도 소유 서버를 공유한다. 폴더별 SDK 참조가 모두 끝나면 native 인스턴스를 해제하고, 모든 정리가 완료되면 서버를 종료한다. 응답 idle·탭 전환 자체는 참조를 반납하지 않는다.

## 실제 CLI / Electron 관측

CLI 1.17.19, Electron 39.8.10, 설치된 SDK의 `/v2/client`와 production `OpenCodeServerPool`·`OpenCodeAdapter`를 사용했다. 격리 XDG 저장소와 loopback MCP·고정 모델 응답을 사용했고 사용자 설정·이력은 변경하지 않았다. 아래 첫 실행은 다른 검사와 겹쳤으므로 시간 개선율의 근거로 사용하지 않는다.

| 입력 / 상태 | 추가 서버 / SSE / module import | directory 준비 |
|---|---|---|
| 최초 A | 각각 1 | config·plugin setup/config hook·MCP 각각 1 |
| 같은 A 후속 입력·새 세션 | 각각 0 | 추가 없음 |
| 최초 B | 각각 0 | B의 config·plugin setup/config hook·MCP 각각 1 |
| B 후속 입력·새 세션, 살아 있는 A로 복귀 | 각각 0 | 추가 없음 |
| A의 마지막 참조 종료 후 A 재진입, B 유지 | 각각 0 | A의 config·plugin setup/config hook·MCP 재수행 |

모든 입력 프레임이 정상 종료했다. [실행 결과](evidence/shared-server-result.json)에 요청 순서와 단계별 증분을 저장했다. module import는 서버가 살아 있는 동안 재사용되지만, 다른 directory의 plugin setup·MCP 비용은 남는다.

[수명 관리 실측](evidence/instance-lifecycle-result.json)은 모델 호출 없이 수행했다. plugin dispose hook에 1.5초 지연을 주었으며 HTTP ack 뒤 hook 완료까지 lease 반환과 같은 폴더 재획득이 대기했다. B의 MCP는 연결 상태를 유지했고, A 재진입 후 기존 native session ID 조회가 성공했다. 마지막 A/B hook 정리가 끝난 뒤 모든 lease가 반환됐고, `adapter.close()`를 부르기 전에 소유 서버가 실제 종료됐다. 종료 뒤 해당 격리 CLI 프로세스 잔여 0개를 확인했다.

## 자동 검증

- OpenCode·SessionRuntime·Supervisor: 27파일 312케이스 통과. 이후 추가한 기본 30초 예산 oracle을 포함해 lifecycle 8케이스 재실행 통과. 고유 비DB 케이스는 313개다.
- native cursor: Electron Node 모드·thread pool에서 1파일 7케이스 통과. SQLite 바이너리를 Node ABI로 바꾸지 않았다.
- node/web/test 타입 검사 통과. lint 오류 0, 기존 React virtualizer 경고 2. main/preload/renderer build 성공, 기존 동적 import 경고 유지.
- 문서 inventory 산출물·문서의 수치 재서술 검사 통과. 전체 링크 검사에는 외부 참고 checkout `.tmp/opencode-dev`·`app/.temp/opencode`의 기존 오류 10건이 있다. 이 두 경로를 제외한 동일 검사 결과는 오류 0건이다.
- 테스트 예산 검사 통과. 독립 검증자의 `verify`는 별도 단계다.

초기 전체 검사에서 발견된 fixture의 이전 요청 목록, 테스트 타입/스타일 오류는 수정 후 재실행했다. 부하가 큰 병렬 검사 중 native 시작 예산 초과가 한 차례 있었으며, 최종 수명 실측은 성공했다. 사용자 환경의 1분 지연이 모두 해소됐다는 성능 결론은 내리지 않는다. 느린 MCP 초기화나 directory별 plugin hook은 여전히 native 준비 비용이다.

## 실측 재현

소유 프로세스와 저장소가 격리된 증거용 실행이다. [공유 실행 probe](evidence/shared-server-probe.cjs)와 [수명 probe](evidence/instance-lifecycle-probe.cjs)를 `.git/opencode-cross-directory-research/`로 복사한다. CLI 1.17.19 실행 파일은 `.git/opencode-1.17.19/package/bin/opencode.exe`에 두며, 그 위치가 다르면 probe의 `executable`만 변경한다. 기존 `isolated`와 `electron-data`가 다른 용도로 사용 중이면 새 증거 폴더를 사용한다.

같은 디렉터리의 `entry.ts`에서 아래 production export를 번들한다. `app`에서 esbuild의 `bundle:true`, `platform:'node'`, `format:'cjs'`, `external:['electron','better-sqlite3']`로 `adapter-server.cjs`를 생성한다.

```ts
export { OpenCodeAdapter } from '../../app/src/main/adapters/opencode/v1/adapter'
export { OpenCodeServerPool } from '../../app/src/main/adapters/opencode/v1/server'
```

`ORCA_PROBE_SINGLE_SERVER`와 `ELECTRON_RUN_AS_NODE`를 설정하지 않은 자식 환경에서 Electron으로 probe를 실행한다. 기존 연구용 강제 단일 서버 facade는 사용하지 않는다. probe는 자신이 만든 native 프로세스·HTTP 서버만 정리한다. JSON의 host 디렉터리 표시 이름은 개인정보 제거를 위해 `host`로 저장했다.
