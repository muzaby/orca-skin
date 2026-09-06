// 진행 스피너의 런타임 비용을 재는 하네스 — 0216 AT-211 · ΔVP-209 의 오라클이다.
//
// 왜 커밋되어 있는가: 0216 r1 은 이 측정을 **산문 재현 절차**로만 남겼고, 두 사람이 각자
// 재구성하자 layout·main-thread task 에서 반대 방향이 나왔다. 절차가 산출을 결정하지 못하면
// 그것은 오라클이 아니다(D-210). 그래서 조건·페이지·차분·요약을 전부 여기 한 파일에 둔다.
//
// 무엇을 재는가: 격리 페이지에 스피너를 **동시 3개**(실제 최악 — transcript · 작업 타일 ·
// 서브에이전트 타일) 띄우고 CDP `Performance.getMetrics` 의 누적값을 5,000ms 간격으로
// 차분한다. `none`/`old`/`new` 를 3회 교차 반복해 순서 편향이 드러나게 한다.
//
// 측정 유효성 전제: 창이 가려지면 rAF 가 멈춰 모든 수치가 0 이 된다. 그 0 을 "비용 없음" 으로
// 읽지 않도록 rAF 프레임 수를 함께 재고, 60fps 에 못 미치면 그 행을 무효로 표시한다.
//
// 비교 대상의 정본:
//   old — `fixtures/spinner-legacy-0208.html` 동결 스냅샷. 교체 전 코드는 삭제됐다.
//   new — 커밋된 원본 SVG(`docs/handoff/0216-…/spinner-reference.svg`)에서 파생한다.
//         파생물이 실제 컴포넌트와 같다는 것은 `statusLine.render.test.ts` 가 잠근다 —
//         하네스가 프로덕션과 갈라지면 그 테스트가 red 다.
//
// 실행: `cd app && npm run measure:spinner-perf`
// Electron 진입점은 옆의 `measure-spinner-perf.electron.cjs` 다 — Electron 39 의 **ESM 진입점에서는
// `app.whenReady()` 가 돌아오지 않는다**(ready 가 비동기 모듈 평가보다 먼저 발화한다). 그래서
// 측정 로직은 여기 `runMeasurement()` 에 두고 CJS 셸이 그것을 부른다.
// 이 파일의 순수 부분(페이지 생성 · 차분 · 요약)은 `measure-spinner-perf.test.mjs` 가 돌린다.
// 그 companion 은 Electron 을 띄우지 않는다 — `npm test` 안에서 도는 테스트다.

import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = join(HERE, '..')
const REPO = join(APP, '..')

export const MODES = ['none', 'old', 'new']
export const INSTANCES = 3
export const WINDOW_MS = 5000
export const REPS = 3
/** rAF 프레임이 이보다 적으면 창이 가려진 것으로 보고 그 행을 무효로 둔다. */
export const MIN_FPS = 50

/** `@utility X { … }` → `.X { … }`. Tailwind 빌드 없이 브라우저가 읽게 한다. */
export function deutility(css) {
  return css.replace(/@utility ([a-z0-9-]+) \{/g, '.$1 {')
}

/** 동결 스냅샷에서 `<style>` 본문과 스피너 마크업을 꺼낸다. */
export function parseLegacyFixture(html) {
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1]
  const svg = /<svg[\s\S]*<\/svg>/.exec(html)?.[0]
  if (!css || !svg) throw new Error('legacy fixture: <style> 또는 <svg> 를 찾지 못했다')
  return { css: deutility(css.trim()), svg: svg.trim() }
}

/**
 * 커밋된 원본 SVG → 프로덕션과 같은 형상의 신 스피너 마크업.
 *
 * 원본은 100×100 에 `class="s sA"` 이고 색을 리터럴로 갖는다. 프로덕션은 14×14 에
 * `class="animate-spark-a"` 이고 색을 `currentColor` 로 상속한다 — 그 세 축만 바꾼다.
 * 기하·좌표·자식 순서는 원본 문자열 그대로다.
 */
export function buildSpinnerMarkup(referenceSvg) {
  const body = referenceSvg.replace(/<metadata>[\s\S]*?<\/metadata>/, '')
  const groups = [...body.matchAll(/<g class="s s([A-E])">([\s\S]*?)<\/g>/g)]
  if (groups.length !== 5)
    throw new Error(`원본에서 마크 그룹 5개를 찾지 못했다 (${groups.length})`)
  const inner = groups
    .map(([, id, children]) => {
      const track = `animate-spark-${id.toLowerCase()}`
      return `<g class="${track}">${children.replace(/\s*\n\s*/g, '')}</g>`
    })
    .join('')
  return (
    '<svg width="14" height="14" viewBox="0 0 100 100" fill="currentColor" ' +
    `stroke="currentColor" aria-hidden="true">${inner}</svg>`
  )
}

/** 측정 페이지 하나. `color` 는 토큰 대신 인라인으로 준다 — 스피너만 담은 격리 페이지다. */
export function buildPage({ css, svg, count = INSTANCES, color }) {
  const spinners = svg ? `<span style="color:${color}">${svg}</span>`.repeat(count) : ''
  return (
    '<!doctype html><meta charset="utf-8">' +
    `<style>body{margin:0;background:#fff}${css}</style>` +
    `<div id="host">${spinners}</div>` +
    '<script>window.__frames=0;(function t(){window.__frames++;requestAnimationFrame(t)})()</script>'
  )
}

/** 저장소에서 세 조건의 페이지를 만든다. */
export function buildPages({
  legacyHtml = readFileSync(join(HERE, 'fixtures/spinner-legacy-0208.html'), 'utf8'),
  appCss = readFileSync(join(APP, 'src/renderer/src/styles/app.css'), 'utf8'),
  tokensCss = readFileSync(join(APP, 'src/renderer/src/styles/tokens.css'), 'utf8'),
  referenceSvg = readFileSync(
    join(REPO, 'docs/handoff/0216-spinner-artwork-swap/spinner-reference.svg'),
    'utf8'
  )
} = {}) {
  const legacy = parseLegacyFixture(legacyHtml)
  const newCss = deutility(appCss.slice(appCss.indexOf('@keyframes spark-')))
  const newColor = /--color-spinner:\s*([^;]+);/.exec(tokensCss)?.[1]?.trim()
  if (!newColor) throw new Error('tokens.css 에서 --color-spinner 를 찾지 못했다')
  // 구 고정색은 스냅샷 시점의 토큰값이다 — 지금 토큰을 주면 두 조건의 페인트 색이 달라진다.
  return {
    none: buildPage({ css: '', svg: '', color: newColor }),
    old: buildPage({ css: legacy.css, svg: legacy.svg, color: '#d97757' }),
    new: buildPage({ css: newCss, svg: buildSpinnerMarkup(referenceSvg), color: newColor })
  }
}

const metric = (m, name) => m.metrics.find((x) => x.name === name)?.value ?? 0

/** 두 `Performance.getMetrics` 스냅샷의 차분. 시간 단위는 ms 다. */
export function diffMetrics(m0, m1, frames, windowMs = WINDOW_MS) {
  const fps = frames / (windowMs / 1000)
  return {
    frames,
    fps: +fps.toFixed(1),
    valid: fps >= MIN_FPS,
    recalcCount: metric(m1, 'RecalcStyleCount') - metric(m0, 'RecalcStyleCount'),
    recalcMs: (metric(m1, 'RecalcStyleDuration') - metric(m0, 'RecalcStyleDuration')) * 1000,
    layoutCount: metric(m1, 'LayoutCount') - metric(m0, 'LayoutCount'),
    layoutMs: (metric(m1, 'LayoutDuration') - metric(m0, 'LayoutDuration')) * 1000,
    taskMs: (metric(m1, 'TaskDuration') - metric(m0, 'TaskDuration')) * 1000
  }
}

const KEYS = ['fps', 'recalcCount', 'recalcMs', 'layoutCount', 'layoutMs', 'taskMs']

/** 모드별 평균 + `none` 기준선 대비 순증가(ms/s). 무효 행이 있으면 그 사실을 남긴다. */
export function summarize(rows) {
  const byMode = MODES.map((mode) => {
    const rs = rows.filter((r) => r.mode === mode)
    if (rs.length === 0) throw new Error(`${mode} 행이 없다`)
    const avg = (k) => +(rs.reduce((a, r) => a + r[k], 0) / rs.length).toFixed(1)
    return {
      mode,
      reps: rs.length,
      invalid: rs.filter((r) => !r.valid).length,
      ...Object.fromEntries(KEYS.map((k) => [k, avg(k)]))
    }
  })
  const base = byMode.find((r) => r.mode === 'none').taskMs
  for (const row of byMode) row.netMsPerSec = +((row.taskMs - base) / (WINDOW_MS / 1000)).toFixed(1)
  return byMode
}

/**
 * AT-211 판정 — 신이 구보다 싸야 하고 두 조건 모두 60fps 를 지켜야 한다.
 * 무효 행이 하나라도 있으면 판정하지 않는다(가려진 창의 0 을 통과시키지 않는다).
 */
export function verdict(summary) {
  const get = (m) => summary.find((r) => r.mode === m)
  const [old_, new_] = [get('old'), get('new')]
  const invalid = summary.reduce((a, r) => a + r.invalid, 0)
  const reasons = []
  if (invalid > 0) reasons.push(`무효 행 ${invalid}개 — rAF < ${MIN_FPS}fps`)
  if (new_.netMsPerSec > old_.netMsPerSec)
    reasons.push(`main-thread 순증가 신 ${new_.netMsPerSec} > 구 ${old_.netMsPerSec} ms/s`)
  if (new_.layoutMs > old_.layoutMs)
    reasons.push(`layout 신 ${new_.layoutMs} > 구 ${old_.layoutMs} ms`)
  if (old_.fps < 59 || new_.fps < 59)
    reasons.push(`fps 60 미유지 (구 ${old_.fps} · 신 ${new_.fps})`)
  return { pass: invalid === 0 && reasons.length === 0, reasons }
}

export function formatTable(summary) {
  const head = '| mode | fps | recalc | recalc ms | layout | layout ms | task ms | 순증가 ms/s |'
  const sep = '|---|---|---|---|---|---|---|---|'
  const rows = summary.map(
    (r) =>
      `| ${r.mode} | ${r.fps} | ${r.recalcCount}회 | ${r.recalcMs} | ${r.layoutCount}회 | ` +
      `${r.layoutMs} | ${r.taskMs} | ${r.netMsPerSec} |`
  )
  return [head, sep, ...rows].join('\n')
}

// --- Electron 안에서 도는 측정부 (CJS 셸이 부른다) --------------------------------------

/**
 * `electron` 모듈을 **주입받아** 측정한다 — 이 파일이 electron 을 직접 import 하지 않는 이유는
 * companion 테스트가 평범한 node 에서 이 모듈을 읽기 때문이다.
 */
export async function runMeasurement({ app, BrowserWindow }, out = process.stdout) {
  const pages = buildPages()
  const dir = mkdtempSync(join(tmpdir(), 'spinner-perf-'))
  for (const [mode, html] of Object.entries(pages)) writeFileSync(join(dir, `${mode}.html`), html)

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const win = new BrowserWindow({ width: 420, height: 260, show: true })
  // 첫 로드 뒤에 붙인다 — 빈 webContents 에 붙이면 attach 가 돌아오지 않는 환경이 있다.
  await win.loadFile(join(dir, 'none.html'))
  const dbg = win.webContents.debugger
  dbg.attach('1.3')
  await dbg.sendCommand('Performance.enable')

  const rows = []
  for (let rep = 0; rep < REPS; rep++) {
    for (const mode of MODES) {
      await win.loadFile(join(dir, `${mode}.html`))
      await sleep(700) // 초기 레이아웃·폰트 로드를 창 밖으로 밀어낸다
      const m0 = await dbg.sendCommand('Performance.getMetrics')
      const f0 = await win.webContents.executeJavaScript('window.__frames')
      await sleep(WINDOW_MS)
      const m1 = await dbg.sendCommand('Performance.getMetrics')
      const f1 = await win.webContents.executeJavaScript('window.__frames')
      rows.push({ mode, rep, ...diffMetrics(m0, m1, f1 - f0) })
    }
  }

  const summary = summarize(rows)
  const result = verdict(summary)
  const reason = result.reasons.length ? ` — ${result.reasons.join(' · ')}` : ''
  out.write(
    [
      '',
      `# 스피너 런타임 측정 — 동시 ${INSTANCES}개 · ${WINDOW_MS}ms 창 · ${REPS}회 평균`,
      '',
      formatTable(summary),
      '',
      `AT-211: ${result.pass ? 'PASS' : 'FAIL'}${reason}`,
      '',
      'raw:',
      ...rows.map((r) => JSON.stringify(r)),
      ''
    ].join('\n')
  )
  rmSync(dir, { recursive: true, force: true })
  app.exit(result.pass ? 0 : 1)
}

/** 평범한 node 로 실행하면 CJS 셸을 entry 로 Electron 을 띄운다. */
async function relaunchInElectron() {
  const { spawn } = await import('node:child_process')
  const electron = (await import('electron')).default
  const entry = join(HERE, 'measure-spinner-perf.electron.cjs')
  const child = spawn(electron, [entry], { stdio: 'inherit' })
  child.on('exit', (code) => process.exit(code ?? 1))
}

if (!process.versions.electron && process.argv[1] === fileURLToPath(import.meta.url)) {
  await relaunchInElectron()
}
