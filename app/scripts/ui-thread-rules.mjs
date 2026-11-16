// 실행 위치·경로 규칙의 정본 (handoff 0324 D-008·D-028).
//
// 판정(`check-ui-thread.mjs`)과 실패 메시지가 이 표 하나를 본다. 같은 표가
// `docs/arch/execution-model.md` 의 경로 표에 있고, 가드가 두 표의 규칙 id 를 대조한다 —
// 규칙을 더하거나 빼면 문서도 같이 고쳐야 통과한다.
//
// 경로는 모두 `app/` 기준이다.

export const DOC = 'docs/arch/execution-model.md'

/** 규칙 표 — `ask` 는 요청하는 곳, `route` 는 써야 할 경로다. 실패 메시지가 그대로 출력한다. */
export const RULES = {
  a: {
    title: 'Node 동기 API',
    ask: '비동기 API',
    route: '`fs/promises` · 비동기 `child_process`'
  },
  b: {
    title: '계산 라이브러리 값 import',
    ask: '계산 워커',
    route: '`src/renderer/src/shared/compute/client.ts`'
  },
  c: {
    title: '세션 본문 조회(`loadSession`)',
    ask: '데이터 호스트',
    route: '`src/renderer/src/shared/api/dataHost.ts`'
  },
  d: {
    title: '`ipcMain` 직접 등록',
    ask: '`src/main/infra/ipc/handle.ts`',
    route: '`handle` · `handlePlain` · `on`'
  },
  e: {
    title: '셸의 import 경계',
    ask: '에이전트 호스트',
    route: '수명 이벤트 → `LifecycleState` · DB 는 호스트의 `ctx.db`'
  },
  f: {
    title: '호스트의 Electron 값 import · `worker_threads`',
    ask: 'main(셸)',
    route: '셸 서비스 클라이언트(`src/main/app/agent-host/shell-client.ts`)'
  },
  g: {
    title: '창 통지 API',
    ask: 'renderer',
    route: '`src/main/infra/ipc/send.ts` 의 통지 함수'
  },
  h: {
    title: '`window.oo` 접근',
    ask: '에이전트 호스트(창·OS 는 셸)',
    route: '`src/renderer/src/shared/api/*`'
  },
  i: {
    title: '`Worker` 생성',
    ask: '계산 워커',
    route: '`src/renderer/src/shared/compute/client.ts`'
  },
  j: {
    title: '프로세스 기동',
    ask: '등록된 기동 모듈',
    route: '`infra/git/runner` · `infra/shell/shell-runner` · 하네스 어댑터 · `host-supervisor`'
  },
  k: {
    title: 'DB 연결',
    ask: '에이전트 호스트의 `DbQueries`',
    route: '`ctx.db` 주입'
  }
}

export const RULE_IDS = Object.keys(RULES)

/** 테스트 지원 파일 — 프로덕션 경로가 아니라 모든 규칙에서 뺀다. */
export const TEST_FILE = /\.(test|testfixture|testlib|testHarness)\.[cm]?[jt]sx?$/

const MAIN = 'src/main/'
const RENDERER = 'src/renderer/src/'

/**
 * (a) 동기 API 등록 표. `count` 는 그 파일의 동기 API 이름 개수와 정확히 같아야 한다 —
 * 늘어도 줄어도 실패한다. `class` 는 남겨도 되는 이유의 종류다:
 * `boot`(부팅·마이그레이션 전용) · `single-file`(파일 하나의 읽기·쓰기·존재 확인) ·
 * `capped`(상한 상수 있음) · `tooling`(프로덕션 경로 아님).
 */
export const SYNC_CLASSES = ['boot', 'single-file', 'capped', 'tooling']

export const SYNC_REGISTRY = [
  {
    file: `${MAIN}adapters/claude/adapt.ts`,
    count: 2,
    class: 'single-file',
    reason: '경로 하나의 존재 확인'
  },
  {
    file: `${MAIN}adapters/claude/adapter.ts`,
    count: 2,
    class: 'single-file',
    reason: '설정 파일 하나를 읽는다'
  },
  {
    file: `${MAIN}adapters/claude/edit-preview.ts`,
    count: 4,
    class: 'capped',
    reason: '편집 미리보기 — 1MiB 상한(0229 E-006)'
  },
  {
    file: `${MAIN}adapters/claude/native-settings-file.ts`,
    count: 5,
    class: 'single-file',
    reason: 'native 설정 파일 하나 — `readSync` 는 같은 이름의 로컬 함수'
  },
  {
    file: `${MAIN}adapters/claude/project-reconciliation.ts`,
    count: 4,
    class: 'single-file',
    reason: '프로젝트 설정 파일 하나의 존재 확인·읽기'
  },
  {
    file: `${MAIN}adapters/claude/project-settings.ts`,
    count: 2,
    class: 'single-file',
    reason: '경로 하나의 stat'
  },
  {
    file: `${MAIN}adapters/claude/settings.ts`,
    count: 5,
    class: 'single-file',
    reason: '설정 파일 하나의 존재 확인·읽기'
  },
  {
    file: `${MAIN}adapters/common/git-root.ts`,
    count: 2,
    class: 'single-file',
    reason: '경로 하나의 stat'
  },
  {
    file: `${MAIN}adapters/opencode/v1/server-profile.ts`,
    count: 4,
    class: 'single-file',
    reason: '실행 파일 경로 하나의 존재 확인·stat'
  },
  {
    file: `${MAIN}adapters/opencode/v1/server.ts`,
    count: 5,
    class: 'single-file',
    reason: '실행 파일·설정 경로의 존재 확인'
  },
  {
    file: `${MAIN}adapters/opencode/v1/settings.ts`,
    count: 3,
    class: 'single-file',
    reason: '설정 파일 하나를 읽는다'
  },
  {
    file: `${MAIN}app/handlers/error.ts`,
    count: 2,
    class: 'single-file',
    reason: '로그 경로 하나의 존재 확인'
  },
  {
    file: `${MAIN}features/extensions/claude/deployer.ts`,
    count: 7,
    class: 'single-file',
    reason: '배포 대상 경로의 존재 확인'
  },
  {
    file: `${MAIN}features/extensions/claude/scaffold.ts`,
    count: 6,
    class: 'single-file',
    reason: '스킬 뼈대 — 디렉토리 하나의 생성·열거(사용자 동작 1회)'
  },
  {
    file: `${MAIN}features/extensions/common/mcp/file.ts`,
    count: 2,
    class: 'single-file',
    reason: 'MCP 설정 파일 하나를 읽는다'
  },
  {
    file: `${MAIN}features/extensions/common/skills/seed.ts`,
    count: 2,
    class: 'boot',
    reason: '부팅 때 스킬 시드의 존재 확인'
  },
  {
    file: `${MAIN}features/harnesses/common/settings-write.ts`,
    count: 10,
    class: 'single-file',
    reason: '설정 파일 하나의 쓰기·삭제'
  },
  {
    file: `${MAIN}features/harnesses/common/settings.ts`,
    count: 5,
    class: 'single-file',
    reason: 'settings 디렉토리 하나의 열거와 파일 읽기'
  },
  {
    file: `${MAIN}index.ts`,
    count: 2,
    class: 'single-file',
    reason: '`app://` 자산 경로 하나의 존재 확인'
  },
  {
    file: `${MAIN}infra/config/json-file.ts`,
    count: 9,
    class: 'single-file',
    reason: 'JSON 설정 파일 하나의 원자적 읽기·쓰기'
  },
  {
    file: `${MAIN}infra/config/oo-file.ts`,
    count: 4,
    class: 'single-file',
    reason: '`orcinus-orca.json` 하나의 존재 확인·읽기'
  },
  {
    file: `${MAIN}infra/db/migrate.ts`,
    count: 9,
    class: 'boot',
    reason: '부팅 마이그레이션의 백업 판정'
  },
  {
    file: `${MAIN}infra/log/file-transport.ts`,
    count: 16,
    class: 'single-file',
    reason: '로그 파일 하나의 추가·회전 — 종료 직전 flush 가 동기여야 한다'
  },
  {
    file: `${MAIN}infra/source-scan.ts`,
    count: 6,
    class: 'tooling',
    reason: '소스 가드 테스트의 트리 스캔 — 프로덕션 경로 아님'
  }
]

export const ALLOWED = {
  // (b) 계산 라이브러리 — 워커 구역은 전부, `inline.ts` 는 `diff` 만.
  b: {
    modules: ['shiki', 'diff'],
    anyModule: [`${RENDERER}shared/compute/worker/`],
    byModule: { diff: [`${RENDERER}shared/compute/inline.ts`] }
  },
  // (c) `loadSession` 을 import 해도 되는 자리.
  c: {
    module: `${MAIN}features/history/reader`,
    name: 'loadSession',
    files: [`${MAIN}app/data-host/session-load.ts`, `${MAIN}app/chat-turn/native-session.ts`]
  },
  d: { files: [`${MAIN}infra/ipc/handle.ts`] },
  // (e) 셸 진입점에서 값 import 로 닿으면 안 되는 곳.
  e: {
    entry: `${MAIN}index.ts`,
    dirs: [`${MAIN}features/`, `${MAIN}adapters/`, `${MAIN}infra/db/`],
    packages: ['better-sqlite3', 'worker_threads', 'node:worker_threads']
  },
  // (f) 호스트 진입점에서 닿는 모듈 중 `electron` 값을 import 해도 되는 파일.
  f: {
    entries: [`${MAIN}app/agent-host/entry.ts`, `${MAIN}app/data-host/entry.ts`],
    electronFiles: [`${MAIN}infra/net/net-fetch.ts`],
    threads: ['worker_threads', 'node:worker_threads']
  },
  // (g) 창·포트로 직접 보내도 되는 전송 모듈.
  g: {
    files: [
      `${MAIN}infra/ipc/send.ts`,
      `${MAIN}infra/ipc/transport.ts`,
      `${MAIN}app/shell/host-supervisor.ts`,
      `${MAIN}app/agent-host/entry.ts`,
      `${MAIN}app/data-host/entry.ts`
    ]
  },
  h: { dirs: [`${RENDERER}shared/api/`] },
  i: { files: [`${RENDERER}shared/compute/client.ts`] },
  j: {
    childProcess: [
      `${MAIN}infra/git/runner.ts`,
      `${MAIN}infra/shell/shell-runner.ts`,
      `${MAIN}adapters/opencode/v1/server.ts`
    ],
    utilityProcess: [`${MAIN}app/shell/host-supervisor.ts`]
  },
  k: {
    files: [`${MAIN}infra/db/file-database.ts`, `${MAIN}infra/db/warm-file-sqlite.ts`]
  }
}
