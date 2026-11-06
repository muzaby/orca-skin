#!/usr/bin/env node
// vitest JSON 보고서 → 풀별 벽시계·시간 합·느린 파일 요약 (0298 ΔV2).
//
// CI 로그 API 는 마지막 5,000줄만 돌려주고 `node --test` TAP 이 그 대부분을 차지해, vitest 파일별
// 시간이 잘린다. 실측 워크플로는 이 요약을 **마지막 단계**에 찍어 잘린 로그에서도 비교할 수 있게 한다.
//
//   node scripts/summarize-vitest-report.mjs <report.json> [--top 15]

import { readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import process from 'node:process'
import { partitionTestFiles, resolveIoMode } from './test-pools.mjs'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 모드별로 파일이 실행된 프로젝트 이름. `test-pools.mjs` `buildProjects` 와 같은 이름을 쓴다. */
export function poolResolver({ io, ioSqlite }, mode) {
  return (relPath) => {
    if (!io.includes(relPath)) return 'unit'
    if (mode === 'sqlite-serial' && ioSqlite.includes(relPath)) return 'io-sqlite'
    return 'io'
  }
}

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`

/**
 * @param {{ testResults: Array<{ name: string, startTime: number, endTime: number }>, numTotalTests?: number, numPassedTests?: number, numFailedTests?: number }} report
 * @param {{ appDir: string, poolOf: (relPath: string) => string, mode?: string, top?: number }} options
 * @returns {string[]}
 */
export function summarizeReport(report, { appDir, poolOf, mode, top = 15 }) {
  const files = report.testResults.map((result) => {
    const relPath = relative(appDir, result.name).split(sep).join('/')
    return {
      relPath,
      pool: poolOf(relPath),
      start: result.startTime,
      end: result.endTime,
      ms: result.endTime - result.startTime
    }
  })
  const lines = []
  const span = (list) =>
    list.length === 0
      ? 0
      : Math.max(...list.map((f) => f.end)) - Math.min(...list.map((f) => f.start))
  lines.push(
    `[pools] mode=${mode ?? 'default'} files=${files.length} tests=${report.numTotalTests ?? '?'} passed=${report.numPassedTests ?? '?'} failed=${report.numFailedTests ?? '?'}`
  )
  lines.push(`[pools] wall total ${secs(span(files))} (첫 파일 시작 → 마지막 파일 끝)`)
  const pools = [...new Set(files.map((f) => f.pool))].sort()
  for (const pool of pools) {
    const list = files.filter((f) => f.pool === pool)
    const sum = list.reduce((total, f) => total + f.ms, 0)
    lines.push(
      `[pools] ${pool}: files ${list.length} · wall ${secs(span(list))} · sum ${secs(sum)}`
    )
  }
  lines.push(`[pools] slowest ${top}:`)
  for (const f of [...files].sort((a, b) => b.ms - a.ms).slice(0, top)) {
    lines.push(`  ${secs(f.ms).padStart(7)} ${f.pool.padEnd(9)} ${f.relPath}`)
  }
  return lines
}

export function runCli(argv = process.argv.slice(2)) {
  const [reportPath, ...rest] = argv
  if (!reportPath)
    throw new Error('Usage: node scripts/summarize-vitest-report.mjs <report.json> [--top N]')
  const topIndex = rest.indexOf('--top')
  const top = topIndex === -1 ? 15 : Number(rest[topIndex + 1])
  const mode = resolveIoMode()
  const report = JSON.parse(readFileSync(reportPath, 'utf8'))
  const poolOf = poolResolver(partitionTestFiles(APP_DIR), mode)
  for (const line of summarizeReport(report, { appDir: APP_DIR, poolOf, mode, top })) {
    console.log(line)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli()
