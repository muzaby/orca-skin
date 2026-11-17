// preload 산출 검사 (0324 D-058 · EP-28 · AC52). `electron-vite build` 의 산출(`out/preload`)이 sandbox 창에서
// 끝까지 실행돼 다리를 노출하는지 본다.
//
// sandbox preload 의 `require` 는 `electron` 하나만 불러온다 — 서드파티 의존(zod 등)이나 나뉜 조각이 산출에
// 남으면 창이 로드 중에 죽어 빈다. 검사는 fail-closed 다.
//   ① 대조 — 산출 `.js` 마다 `require` 는 모두 `require("electron")` 꼴이고 `import(` 는 없다.
//   ② 흉내 `require` — `electron` 만 준다. 그 밖은 `module not found: <id>` 로 던진다.
//   ③ 실행 전역 — `process`(platform · contextIsolated) · `console` · 타이머 · `queueMicrotask` · `window` ·
//      `MessageChannel` 만 둔다. 그 밖(`__dirname` 등)은 ReferenceError 다.
//   ④ 노출 판정 — `exposeInMainWorld` 1회 · 키 `ooBridge` · 다리 키 7.
//   ⑤ CLI — 발견을 모두 출력하고 하나라도 있으면 종료 코드 1.
// sandbox 의 그 밖 제한(`process` 필드 · `webFrame` 등)은 흉내 내지 않는다 — 사람 실기(AC23)가 본다(B40).
//
// 사용: node scripts/smoke-preload.mjs [out/preload]

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

export const BRIDGE_KEY = 'ooBridge'
export const BRIDGE_KEYS = [
  'invoke',
  'send',
  'on',
  'connectHost',
  'onHostExited',
  'pathForFile',
  'platform'
]

function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return jsFiles(path)
    return name.endsWith('.js') ? [path] : []
  })
}

// ① 산출 대조 — 줄마다 `require` 가 `require("electron")` 꼴이 아닌 것과 `import(` 를 낸다.
function scanOutput(dir) {
  const findings = []
  for (const file of jsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      const where = `${relative(dir, file).replaceAll('\\', '/')}:${index + 1}`
      const all = line.match(/\brequire\b/g)?.length ?? 0
      const electron = line.match(/\brequire\("electron"\)/g)?.length ?? 0
      if (all !== electron) findings.push(`${where}: \`electron\` 밖의 require — ${line.trim()}`)
      if (/\bimport\s*\(/.test(line)) findings.push(`${where}: 동적 import — ${line.trim()}`)
    })
  }
  return findings
}

// ②③④ sandbox 흉내 실행 — 진입 파일을 지정한 전역만 있는 맥락에서 CommonJS 로 한 번 돌린다.
function runEntry(entry) {
  const exposed = []
  const noop = () => {}
  const electron = {
    contextBridge: { exposeInMainWorld: (key, api) => exposed.push({ key, api }) },
    ipcRenderer: { on: noop, off: noop, send: noop, invoke: async () => undefined },
    webUtils: { getPathForFile: () => '' }
  }
  const sandboxRequire = (id) => {
    if (id === 'electron') return electron
    throw new Error(`module not found: ${id}`)
  }
  const context = vm.createContext({
    process: { platform: process.platform, contextIsolated: true },
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    window: { postMessage: noop },
    MessageChannel
  })
  const module = { exports: {} }
  try {
    const wrapped = vm.runInContext(
      `(function (exports, require, module) {\n${readFileSync(entry, 'utf8')}\n})`,
      context,
      { filename: entry }
    )
    wrapped(module.exports, sandboxRequire, module)
  } catch (error) {
    return [`로드 중 실패 — ${error?.name ?? 'Error'}: ${error?.message ?? String(error)}`]
  }
  if (exposed.length !== 1)
    return [`\`exposeInMainWorld\` 를 ${exposed.length}번 불렀다 — 다리 노출은 1번이다`]
  const [{ key, api }] = exposed
  if (key !== BRIDGE_KEY) return [`노출 키가 \`${key}\` 다 — \`${BRIDGE_KEY}\` 여야 한다`]
  const keys = Object.keys(api ?? {})
  const findings = []
  const missing = BRIDGE_KEYS.filter((name) => !keys.includes(name))
  const extra = keys.filter((name) => !BRIDGE_KEYS.includes(name))
  if (missing.length > 0) findings.push(`다리에 빠진 키: ${missing.join(', ')}`)
  if (extra.length > 0) findings.push(`다리에 등록 밖 키: ${extra.join(', ')}`)
  return findings
}

/** 산출 폴더를 검사한다 — `scan`(① 대조)과 `run`(②③④ 흉내 실행)의 발견. 둘 다 비면 통과다. */
export function checkPreloadOutput(dir) {
  const entry = join(dir, 'index.js')
  if (!existsSync(entry)) return { scan: [], run: [`진입 파일 \`index.js\` 없음: ${entry}`] }
  return { scan: scanOutput(dir), run: runEntry(entry) }
}

// ⑤ CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = resolve(process.argv[2] ?? 'out/preload')
  const { scan, run } = checkPreloadOutput(dir)
  const findings = [...scan.map((f) => `[대조] ${f}`), ...run.map((f) => `[실행] ${f}`)]
  if (findings.length > 0) {
    console.error(`smoke-preload: FAIL — ${dir}`)
    for (const finding of findings) console.error(`  ${finding}`)
    process.exitCode = 1
  } else {
    console.log(
      `smoke-preload: OK — require 는 electron 뿐 · 다리 \`${BRIDGE_KEY}\` 노출(키 ${BRIDGE_KEYS.length})`
    )
  }
}
