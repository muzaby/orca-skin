// 원자적 JSON 파일 쓰기 — temp 파일에 직렬화 후 rename 으로 교체(부분 쓰기/손상 방지). orca.json·
// mcp.json·provider settings.json 등 "사용자가 발견·편집 가능한" 설정 파일의 공용 쓰기 경로다.
// config(L1) 의 가장 낮은 위치에 둬, 상위(deploy·settings) 가 하향으로만 의존하게 한다.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isRecord } from '../../../shared/obj'

export function parseJsonObject(
  text: string | undefined,
  invalid: () => Error
): Record<string, unknown> {
  try {
    const value: unknown = text === undefined ? {} : JSON.parse(text.replace(/^\uFEFF/, ''))
    if (!isRecord(value)) throw new Error('Expected a JSON object')
    return value
  } catch {
    throw invalid()
  }
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
