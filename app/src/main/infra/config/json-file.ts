// 원자적 JSON 파일 쓰기 — temp 파일에 직렬화 후 rename 으로 교체(부분 쓰기/손상 방지). orca.json·
// mcp.json·provider settings.json 등 "사용자가 발견·편집 가능한" 설정 파일의 공용 쓰기 경로다.
// config(L1) 의 가장 낮은 위치에 둬, 상위(deploy·settings) 가 하향으로만 의존하게 한다.

import { renameSync, writeFileSync } from 'node:fs'

export function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8')
  renameSync(tmp, path)
}
