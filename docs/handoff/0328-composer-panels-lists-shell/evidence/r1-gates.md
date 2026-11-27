# 0328 r1 · 로컬 게이트

Linux, Node 24.19.0, Electron 39.8.10에서 실행했다. 이행 결과와 기준선은 같은 Node ABI의 SQLite를 사용했다.

| 게이트 | 관측 |
|---|---|
| 마이그레이션 · 인벤토리 · 제품 표기 · 테스트 예산 · 프로세스 경계 | 통과. 마이그레이션은 v0.3.1 대비 append-only 검사. |
| lint · typecheck | lint 오류 0, 경고 12. node·web·test 타입 검사 통과. |
| 필터 없는 vitest | 적용 트리 1,113파일·10,720케이스 통과, 9파일·22케이스 실패. 기준선 `c7d2adf2` 1,110파일·10,729케이스 통과, 9파일·22케이스 실패. 실패 케이스 이름 차집합은 양방향 0이다. 두 실행에 동일 미처리 거부 1건이 있다. |
| scripts 전체 단위 테스트 | 1,099케이스 통과. 비정상 종료하는 vitest와 별도의 명령으로 실행했다. |
| Electron 번들·호스트·preload smoke | 번들 생성, 데이터→에이전트 기동·피어·창 포트·종료 및 preload sandbox 통과. |
| Electron 응답성 진단 | 기본 진단과 카탈로그 진단 통과. [r1 측정](r1-measurements.md) |

추가·수정 테스트 13개를 `git diff --cached --name-only --diff-filter=AM`으로 확인했다. 실제 파일 테스트는 임시 경로를 생성하고 해제한다. 계산·UI 테스트는 가짜 워커, 임시 DOM, 가짜 시계를 사용한다. 변경 테스트의 예산·풀 위반은 0이다.

| 기준선과 같은 실패 파일 | 실패 |
|---|---|
| `adapters/claude/adapter.native-plugins.test.ts` | 5 |
| `adapters/claude/native-resources.test.ts` | 3 |
| `adapters/claude/project-reconciliation.test.ts` | 2 |
| `adapters/opencode/v1/adapter.instances.test.ts` | 2 |
| `adapters/opencode/v1/adapter.persistent.test.ts` | 1 |
| `adapters/opencode/v1/adapter.test.ts` | 1 |
| `app/composer-catalog.test.ts` | 6 |
| `app/composer-preparation-service.test.ts` | 1 |
| `app/handlers/session-resources.claude-assembly.test.ts` | 1 |

OpenCode 테스트는 Windows 드라이브 경로를 기대한다. Linux의 경로 해석은 작업 디렉터리를 붙이며 카탈로그 준비 테스트에 `Composer directory must be absolute`가 발생한다. Claude 플러그인 테스트에는 지원되지 않는 프로젝트별 제어, 상태 불일치와 대기 초과가 포함된다. 미처리 거부 메시지는 두 트리 모두 «이 플러그인은 프로젝트별 제어를 지원하지 않습니다.»였다.
