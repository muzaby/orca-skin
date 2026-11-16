// `check-ui-thread.mjs` 의 판정 (handoff 0324 AC2~AC4·AC26·AC34·AC35).
//
// 케이스는 plan §10 EP-1 규칙 칸의 분기를 따른다 — 분기마다 그 분기로 가는 트리 하나.
// 가드는 0건을 보고하는 장치라, 위반 픽스처가 실제로 exit 1 이 되는지를 규칙마다 본다.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, describe, it } from 'node:test'
import { check, documentedRuleIds, formatViolation, run, SYNC_NAMES } from './check-ui-thread.mjs'
import { ALLOWED, DOC, RULE_IDS, RULES, SYNC_REGISTRY } from './ui-thread-rules.mjs'

const roots = []
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

const ROUTE_TABLE = (ids) =>
  [
    '# 실행 모델',
    '',
    '| 하려는 일 | 요청하는 곳 | 경로 | 직접 하면 걸리는 규칙 |',
    '|---|---|---|---|',
    ...ids.map((id) => `| 일 ${id} | 곳 | 경로 | (${id}) |`),
    '',
    '표 밖의 (z) 는 세지 않는다.'
  ].join('\n')

// 규칙을 전부 지키는 최소 트리. `files` 가 같은 경로를 주면 덮어쓴다.
const BASE = {
  'src/main/index.ts': "import './app/shell/boot'\n",
  'src/main/app/shell/boot.ts': 'export const boot = 1\n',
  'src/main/app/agent-host/entry.ts': "import '../../infra/net/net-fetch'\n",
  'src/main/app/data-host/entry.ts': 'export const dataHost = 1\n',
  'src/main/infra/net/net-fetch.ts': "import { net } from 'electron'\nexport const f = net\n",
  'src/main/features/history/reader.ts':
    'export function loadSession(): number {\n  return 1\n}\nexport const other = 2\n'
}

function tree(files = {}, { ids = RULE_IDS, registry = [] } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'ui-thread-'))
  roots.push(base)
  const root = join(base, 'app')
  for (const [file, text] of Object.entries({ ...BASE, ...files })) {
    const full = join(root, file)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
  const docPath = join(base, 'execution-model.md')
  if (ids) writeFileSync(docPath, ROUTE_TABLE(ids))
  return { root, docPath, registry }
}

const exitOf = (files, options) => run([], tree(files, options))
const rulesOf = (result) => [...new Set(result.result.violations.map((v) => v.rule))]

function passes(files, options) {
  const result = exitOf(files, options)
  assert.deepEqual(result.lines, ['check-ui-thread: OK'])
  assert.equal(result.exitCode, 0)
}

function fails(rule, files, options) {
  const result = exitOf(files, options)
  assert.equal(result.exitCode, 1, `exit 1 이어야 한다: ${JSON.stringify(Object.keys(files))}`)
  assert.deepEqual(rulesOf(result), [rule])
  return result
}

const sync = (file, count) => ({ file, count, class: 'single-file', reason: '테스트' })

describe('기준 트리', () => {
  it('규칙을 전부 지키는 트리는 exit 0 이다', () => passes({}))
})

describe('(a) 동기 API', () => {
  const file = 'src/main/infra/a.ts'
  const twice = "import { readFileSync } from 'node:fs'\nexport const x = readFileSync('p')\n"

  it('동기 API 이름 집합은 Node 가 정한다', () => {
    for (const name of ['readFileSync', 'existsSync', 'execFileSync', 'spawnSync', 'statfsSync']) {
      assert.ok(SYNC_NAMES.has(name), name)
    }
    assert.ok(!SYNC_NAMES.has('readFile'))
  })

  it('등록 없는 파일에 이름을 더하면 exit 1', () => {
    fails('a', { [file]: twice })
  })

  it('등록과 개수가 같으면 exit 0', () => {
    passes({ [file]: twice }, { registry: [sync(file, 2)] })
  })

  it('실제 개수가 등록보다 많으면 exit 1', () => {
    fails('a', { [file]: twice }, { registry: [sync(file, 1)] })
  })

  it('실제 개수가 등록보다 적으면 exit 1', () => {
    fails('a', { [file]: twice }, { registry: [sync(file, 3)] })
  })

  it('등록된 파일에서 이름이 전부 사라져도 exit 1 — 등록을 지워야 한다', () => {
    fails('a', { [file]: 'export const x = 1\n' }, { registry: [sync(file, 2)] })
  })

  it('child_process 의 동기 API 도 센다', () => {
    fails('a', { [file]: 'declare const cp: any\nexport const x = cp.execFileSync("git")\n' })
  })

  it('같은 이름의 로컬 함수도 걸린다', () => {
    fails('a', { [file]: 'export function readSync(): number {\n  return 1\n}\n' })
  })

  it('주석·문자열 안의 이름은 세지 않는다', () => {
    passes({
      [file]:
        "// readFileSync 를 쓰지 않는다\n/* existsSync */\nexport const x = 'statSync `mkdirSync`'\n"
    })
  })

  it('테스트 파일은 대상이 아니다', () => {
    const body = "import { readFileSync } from 'node:fs'\nexport const x = readFileSync\n"
    passes({
      'src/main/infra/a.test.ts': body,
      'src/main/infra/a.testfixture.ts': body
    })
  })

  it('등록 표의 class 가 정해진 넷이 아니면 exit 1', () => {
    fails('a', { [file]: twice }, { registry: [{ ...sync(file, 2), class: 'misc' }] })
  })
})

describe('(b) 계산 라이브러리', () => {
  const outside = 'src/renderer/src/features/chat/lib/x.ts'

  it("허용 밖 파일의 정적 값 import(`import { x } from 'shiki'`)는 exit 1", () => {
    fails('b', { [outside]: "import { codeToHtml } from 'shiki'\nexport const x = codeToHtml\n" })
  })

  it("허용 밖 파일의 동적 값 import(`import('shiki/core')`)는 exit 1", () => {
    fails('b', { [outside]: "export const x = (): unknown => import('shiki/core')\n" })
  })

  it('허용 밖 파일의 `import type` 은 exit 0', () => {
    passes({
      [outside]:
        "import type { ThemedToken } from 'shiki'\nimport { type Change } from 'diff'\nexport type X = ThemedToken | Change\n"
    })
  })

  it('워커 구역의 값 import 는 exit 0', () => {
    passes({
      'src/renderer/src/shared/compute/worker/handler.ts':
        "import { codeToHtml } from 'shiki'\nimport { diffLines } from 'diff'\nexport const x = [codeToHtml, diffLines]\n"
    })
  })

  it('`inline.ts` 의 `diff` 값 import 는 exit 0', () => {
    passes({
      'src/renderer/src/shared/compute/inline.ts':
        "import { diffLines } from 'diff'\nexport const x = diffLines\n"
    })
  })

  it('허용 밖 파일(`lib/unifiedDiffLines.ts`)의 `diff` 값 import 는 exit 1', () => {
    fails('b', {
      'src/renderer/src/features/chat/lib/unifiedDiffLines.ts':
        "import { parsePatch } from 'diff'\nexport const x = parsePatch\n"
    })
  })

  it('`inline.ts` 의 `shiki` 값 import 는 exit 1', () => {
    fails('b', {
      'src/renderer/src/shared/compute/inline.ts':
        "import { codeToHtml } from 'shiki'\nexport const x = codeToHtml\n"
    })
  })

  it('이름이 비슷한 다른 패키지(`diff-match`)는 대상이 아니다', () => {
    passes({ [outside]: "import x from 'diff-match'\nexport default x\n" })
  })

  it('지정자가 리터럴이 아닌 동적 import 는 판정할 수 없어 exit 1', () => {
    fails('b', { [outside]: 'export const x = (name: string): unknown => import(name)\n' })
  })
})

describe('(c) `loadSession`', () => {
  const body =
    "import { loadSession } from '../../features/history/reader'\nexport const x = loadSession\n"

  it('등록 밖 파일의 import 는 exit 1', () => {
    fails('c', { 'src/main/app/handlers/session.ts': body })
  })

  it('등록된 두 파일의 import 는 exit 0', () => {
    passes({
      'src/main/app/data-host/session-load.ts': body,
      'src/main/app/chat-turn/native-session.ts': body
    })
  })

  it('같은 모듈의 다른 이름만 가져오면 exit 0', () => {
    passes({
      'src/main/app/handlers/session.ts':
        "import { other } from '../../features/history/reader'\nexport const x = other\n"
    })
  })

  it('namespace import 는 `loadSession` 을 가져온 것으로 본다', () => {
    fails('c', {
      'src/main/app/handlers/session.ts':
        "import * as reader from '../../features/history/reader'\nexport const x = reader\n"
    })
  })
})

describe('(d) `ipcMain` 등록', () => {
  for (const method of ['handle', 'on', 'once', 'handleOnce']) {
    it(`\`handle.ts\` 밖의 \`ipcMain.${method}(\` 는 exit 1`, () => {
      fails('d', {
        'src/main/app/shell/extra.ts': `declare const ipcMain: any\nipcMain.${method}('oo:x', () => 1)\n`
      })
    })
  }

  it('`handle.ts` 안의 등록은 exit 0', () => {
    passes({
      'src/main/infra/ipc/handle.ts':
        "declare const ipcMain: any\nipcMain.handle('a', () => 1)\nipcMain.on('b', () => 1)\n"
    })
  })
})

describe('(e) 셸 그래프', () => {
  const shellImports = (line) => ({
    'src/main/app/shell/boot.ts': `${line}\nexport const boot = 1\n`
  })

  for (const [dir, file] of [
    ['features', 'src/main/features/chat/x.ts'],
    ['adapters', 'src/main/adapters/claude/x.ts'],
    ['infra/db', 'src/main/infra/db/x.ts']
  ]) {
    it(`셸에서 값 import 로 \`${dir}\` 에 닿으면 exit 1`, () => {
      const result = fails('e', {
        ...shellImports(`import '../../${file.slice('src/main/'.length, -3)}'`),
        [file]: 'export const x = 1\n'
      })
      assert.match(
        result.lines.join('\n'),
        /src\/main\/index\.ts → src\/main\/app\/shell\/boot\.ts → /
      )
    })
  }

  it('셸에서 `better-sqlite3` 에 닿으면 exit 1', () => {
    const result = exitOf(
      shellImports("import Database from 'better-sqlite3'\nexport const d = Database")
    )
    assert.equal(result.exitCode, 1)
    assert.ok(rulesOf(result).includes('e'))
  })

  it('같은 대상을 `import type` 으로만 닿으면 exit 0', () => {
    passes({
      ...shellImports("import type { X } from '../../features/chat/x'\nexport type Y = X"),
      'src/main/features/chat/x.ts': 'export type X = number\n'
    })
  })

  it('동적 `import()` 로 닿아도 exit 1', () => {
    fails('e', {
      ...shellImports("export const lazy = (): unknown => import('../../features/chat/x')"),
      'src/main/features/chat/x.ts': 'export const x = 1\n'
    })
  })

  it('셸이 닿지 않는 `features` 모듈은 걸리지 않는다', () => {
    passes({ 'src/main/features/chat/x.ts': 'export const x = 1\n' })
  })

  it('파일로 풀 수 없는 상대 import 는 exit 1', () => {
    fails('e', shellImports("import '../../nowhere/missing'"))
  })

  it('셸 진입점이 없으면 exit 1', () => {
    const fixture = tree({})
    rmSync(join(fixture.root, 'src/main/index.ts'))
    assert.equal(run([], fixture).exitCode, 1)
  })
})

describe('(f) 호스트', () => {
  for (const entry of ALLOWED.f.entries) {
    it(`${entry} 에서 닿는 모듈이 등록 밖에서 \`electron\` 값을 import 하면 exit 1`, () => {
      fails('f', {
        [entry]: "import '../../infra/dialog'\n",
        'src/main/infra/dialog.ts': "import { dialog } from 'electron'\nexport const d = dialog\n"
      })
    })
  }

  it('등록된 파일(`infra/net/net-fetch.ts`)의 `electron` 값 import 는 exit 0', () => passes({}))

  it('호스트에서 닿는 `electron` 의 `import type` 은 exit 0', () => {
    passes({
      'src/main/app/agent-host/entry.ts': "import '../../infra/dialog'\n",
      'src/main/infra/dialog.ts':
        "import type { WebContents } from 'electron'\nexport type W = WebContents\n"
    })
  })

  it('호스트가 닿지 않는 모듈의 `electron` 값 import 는 걸리지 않는다', () => {
    passes({
      'src/main/app/shell/win.ts': "import { app } from 'electron'\nexport const a = app\n"
    })
  })

  for (const specifier of ALLOWED.f.threads) {
    it(`\`src/main\` 어디서든 \`${specifier}\` import 는 exit 1`, () => {
      fails('f', {
        'src/main/infra/pool.ts': `import { Worker } from '${specifier}'\nexport const w = Worker\n`
      })
    })
  }
})

describe('(g) 창 통지', () => {
  const outside = 'src/main/app/bootstrap.ts'
  const forms = {
    'wc.send(': "declare const wc: any\nwc.send('oo:x', 1)\n",
    'webContents.send(': "declare const win: any\nwin.webContents.send('oo:x', 1)\n",
    getAllWebContents:
      'declare const webContents: any\nexport const all = webContents.getAllWebContents()\n',
    'postMessage(': 'declare const port: any\nport.postMessage({ a: 1 })\n'
  }
  for (const [form, body] of Object.entries(forms)) {
    it(`전송 모듈 밖의 \`${form}\` 는 exit 1`, () => fails('g', { [outside]: body }))
  }

  it('전송 모듈 안에서는 exit 0', () => {
    passes(Object.fromEntries(ALLOWED.g.files.map((file) => [file, Object.values(forms).join('')])))
  })

  it('창이 아닌 대상의 `.send(` 는 대상이 아니다', () => {
    passes({ [outside]: "declare const client: any\nclient.send('oo:x', 1)\n" })
  })
})

describe('(h) `window.oo`', () => {
  const outside = 'src/renderer/src/features/chat/store/x.ts'

  it('`shared/api` 밖의 `window.oo` 는 exit 1', () => {
    fails('h', { [outside]: 'export const x = (): unknown => window.oo.chat\n' })
  })

  it("`window?.oo` · `window['oo']` 도 걸린다", () => {
    fails('h', {
      [outside]: "declare const window: any\nexport const x = [window?.oo, window['oo']]\n"
    })
  })

  it('`shared/api` 안에서는 exit 0', () => {
    passes({
      'src/renderer/src/shared/api/ipc.ts': 'export const x = (): unknown => window.oo.chat\n'
    })
  })

  it('주석 안의 `window.oo` 와 테스트 지원 파일은 대상이 아니다', () => {
    passes({
      [outside]: '// window.oo 를 직접 읽지 않는다\nexport const x = 1\n',
      'src/renderer/src/features/chat/store/x.testHarness.ts':
        'export const x = (): unknown => window.oo\n'
    })
  })
})

describe('(i) `Worker` 생성', () => {
  for (const ctor of ['Worker', 'SharedWorker']) {
    it(`계산 클라이언트 밖의 \`new ${ctor}(\` 는 exit 1`, () => {
      fails('i', {
        'src/renderer/src/features/chat/lib/w.ts': `export const w = new ${ctor}('x.js')\n`
      })
    })
  }

  it('계산 클라이언트 안에서는 exit 0', () => {
    passes({ 'src/renderer/src/shared/compute/client.ts': "export const w = new Worker('x.js')\n" })
  })
})

describe('(j) 프로세스 기동', () => {
  for (const specifier of ['child_process', 'node:child_process']) {
    it(`등록 밖 파일의 \`${specifier}\` import 는 exit 1`, () => {
      fails('j', {
        'src/main/features/chat/run.ts': `import { spawn } from '${specifier}'\nexport const s = spawn\n`
      })
    })
  }

  it('등록 밖 파일의 `utilityProcess` 는 exit 1', () => {
    fails('j', {
      'src/main/app/shell/extra.ts':
        "declare const utilityProcess: any\nexport const p = utilityProcess.fork('x')\n"
    })
  })

  it('등록 파일 안에서는 exit 0', () => {
    const spawn = "import { spawn } from 'node:child_process'\nexport const s = spawn\n"
    passes({
      ...Object.fromEntries(ALLOWED.j.childProcess.map((file) => [file, spawn])),
      'src/main/app/shell/host-supervisor.ts':
        "declare const utilityProcess: any\nexport const p = utilityProcess.fork('x')\n"
    })
  })

  it('`child_process` 의 `import type` 은 exit 0', () => {
    passes({
      'src/main/features/chat/run.ts':
        "import type { ChildProcess } from 'node:child_process'\nexport type C = ChildProcess\n"
    })
  })
})

describe('(k) DB 연결', () => {
  it('등록 밖 파일의 `better-sqlite3` 값 import 는 exit 1', () => {
    fails('k', {
      'src/main/features/history/db.ts':
        "import Database from 'better-sqlite3'\nexport const d = Database\n"
    })
  })

  it('등록된 두 파일의 값 import 는 exit 0', () => {
    const body = "import Database from 'better-sqlite3'\nexport const d = Database\n"
    passes(Object.fromEntries(ALLOWED.k.files.map((file) => [file, body])))
  })

  it('같은 모듈의 `import type` 은 exit 0', () => {
    passes({
      'src/main/features/history/db.ts':
        "import type Database from 'better-sqlite3'\nexport type D = Database.Database\n"
    })
  })
})

describe('문서 대조 (AC34)', () => {
  it('가드의 규칙 id 가 경로 표에 없으면 exit 1', () => {
    const result = fails('doc', {}, { ids: RULE_IDS.filter((id) => id !== 'h') })
    assert.match(result.lines.join('\n'), /규칙 \(h\) 가 경로 표에 없다/)
  })

  it('경로 표의 규칙 id 가 가드에 없으면 exit 1', () => {
    const result = fails('doc', {}, { ids: [...RULE_IDS, 'q'] })
    assert.match(result.lines.join('\n'), /경로 표의 규칙 \(q\) 가 가드에 없다/)
  })

  it('경로 표 문서가 없으면 exit 1', () => {
    fails('doc', {}, { ids: null })
  })

  it('표 밖 산문의 `(z)` 는 규칙 id 로 세지 않는다', () => {
    const fixture = tree({})
    assert.deepEqual([...documentedRuleIds(fixture.docPath)].sort(), RULE_IDS)
  })
})

describe('실패 메시지 (AC35)', () => {
  it('규칙마다 써야 할 경로와 문서 절을 알려 준다', () => {
    for (const id of RULE_IDS) {
      const message = formatViolation({ rule: id, file: 'src/x.ts', line: 3, detail: '위반' })
      assert.ok(message.includes(`(${id})`), id)
      assert.ok(message.includes(RULES[id].ask), id)
      assert.ok(message.includes(RULES[id].route), id)
      assert.ok(message.includes(DOC), id)
      assert.ok(message.includes('src/x.ts:3'), id)
    }
  })

  it('위반 픽스처의 출력에 경로 이름과 문서가 실린다', () => {
    const result = exitOf({
      'src/renderer/src/features/chat/store/x.ts': 'export const x = (): unknown => window.oo\n'
    })
    const text = result.lines.join('\n')
    assert.ok(text.includes(RULES.h.route))
    assert.ok(text.includes('execution-model.md'))
    assert.match(text, /1건 위반$/)
  })
})

// 아직 구현되지 않은 단계에 기대는 케이스 — 실행은 하되 실패가 스위트를 막지 않는다.
const PENDING = { todo: '0324 단계 4·5·7(호스트 이주·경로 표 문서)이 끝나면 통과한다 — 그때 todo 를 지우고 ci.yml 에 가드 단계를 단다' }

describe('실제 트리', () => {
  it('등록 표의 각 행은 class·reason 을 갖는다', () => {
    for (const entry of SYNC_REGISTRY) {
      assert.ok(entry.reason && entry.count > 0, entry.file)
    }
  })

  it('실제 트리는 exit 0 이다', PENDING, () => {
    const result = run([])
    assert.deepEqual(result.lines, ['check-ui-thread: OK'])
  })

  it('`--list` 는 규칙마다 발견 목록의 머리줄을 낸다', () => {
    const text = run(['--list']).lines.join('\n')
    for (const id of RULE_IDS) assert.ok(text.includes(`(${id}) ${RULES[id].title}`), id)
  })

  it('가드의 규칙 id 전부가 실제 경로 표에 있다 (차집합 0)', PENDING, () => {
    const documented = documentedRuleIds(new URL(`../../${DOC}`, import.meta.url).pathname)
    assert.deepEqual([...documented].sort(), RULE_IDS)
  })

  it('root·app·main·renderer 의 AGENTS.md 가 경로 표 문서를 링크한다', PENDING, async () => {
    const { readFileSync } = await import('node:fs')
    for (const file of [
      '../AGENTS.md',
      'AGENTS.md',
      'src/main/AGENTS.md',
      'src/renderer/AGENTS.md'
    ]) {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
      assert.ok(text.includes('arch/execution-model.md'), file)
      assert.ok(text.includes('check-ui-thread'), file)
    }
  })
})

// `check` 를 직접 부르는 경로도 같은 결과를 낸다(등록 표 주입).
it('check() 는 위반과 규칙별 발견을 함께 돌려준다', () => {
  const fixture = tree({
    'src/main/infra/a.ts': 'declare const fs: any\nexport const x = fs.existsSync("p")\n'
  })
  const result = check(fixture)
  assert.equal(result.violations.length, 1)
  assert.equal(result.findings.a.length, 1)
  assert.equal(result.syncCounts.get('src/main/infra/a.ts'), 1)
})
