// 원자적 JSON 파일 쓰기 — temp 파일에 직렬화 후 rename 으로 교체(부분 쓰기/손상 방지). orcinus-orca.json·
// mcp.json·provider settings.json 등 "사용자가 발견·편집 가능한" 설정 파일의 공용 쓰기 경로다.
// config(L1) 의 가장 낮은 위치에 둬, 상위(deploy·settings) 가 하향으로만 의존하게 한다.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isRecord } from '../../../shared/obj'

// \uBE48 \uB0B4\uC6A9 \uADDC\uCE59(SSOT) \u2014 \uC5C6\uC74C\u00B70\uBC14\uC774\uD2B8\u00B7\uACF5\uBC31\u00B7BOM\uB9CC\u00B7JSON `null` \uC740 "\uC124\uC815 \uC5C6\uC74C" = `{}` \uC774\uB2E4. \uB0B4\uC6A9\uC774 \uC788\uB294\uB370
// \uAC1D\uCCB4\uAC00 \uC544\uB2C8\uAC70\uB098 \uD30C\uC2F1\uD560 \uC218 \uC5C6\uC73C\uBA74 `invalid()` \uB97C \uB358\uC9C4\uB2E4. \uC4F0\uAE30 \uACBD\uB85C\uB3C4 \uC774 \uADDC\uCE59\uC744 \uADF8\uB300\uB85C \uB530\uB974\uBBC0\uB85C
// \uBE48 \uD30C\uC77C \uC704\uC5D0\uB294 \uC800\uC7A5\uD558\uACE0, \uAE68\uC9C4 \uB0B4\uC6A9 \uC704\uC5D0\uB294 \uC800\uC7A5\uC744 \uAC70\uBD80\uD55C\uB2E4.
export function parseJsonObject(
  text: string | undefined,
  invalid: (reason: 'parse' | 'shape') => Error
): Record<string, unknown> {
  // `trim()` also strips a leading BOM (U+FEFF is ECMAScript whitespace).
  const body = text?.trim()
  let value: unknown
  try {
    value = body === undefined || body === '' ? {} : JSON.parse(body)
  } catch {
    throw invalid('parse')
  }
  if (value === null) return {}
  if (!isRecord(value)) throw invalid('shape')
  return value
}

export function readJsonObjectSync(path: string, invalid: () => Error): Record<string, unknown> {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw invalid()
  }
  return parseJsonObject(text, invalid)
}

export async function readJsonObject(
  path: string,
  invalid: () => Error
): Promise<Record<string, unknown>> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw invalid()
  }
  return parseJsonObject(text, invalid)
}

export function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, path)
}

// 관용 JSON 읽기 — 파일 부재/파싱 실패를 undefined 로 뭉개는 "있으면 쓰고 없으면 폴백" 리더용.
// 실패 원인을 구분하거나 경고를 남겨야 하는 리더는 이 헬퍼 대신 자체 read 경로를 유지한다.
export function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    return undefined
  }
}
