// 플러그인 첨부 내보내기의 공통 파일시스템 경계 — jira attachment-store 와 mail attachment-export 가
// 같은 봉쇄 불변식(직접 만든 plain directory · realpath 기준 parent 내부 · stale stage 정리)을 공유한다.
import { lstat, mkdir, readdir, realpath, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { isWithinDir } from '../../infra/config/paths'

const STALE_STAGE_MS = 24 * 60 * 60 * 1000
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

export function safeSegment(value: string): string {
  const withoutControls = Array.from(value, (character) =>
    character.charCodeAt(0) <= 0x1f ? '_' : character
  ).join('')
  const sanitized = withoutControls
    .replace(/[<>:"/\\|?*]/g, '_')
    .slice(0, 120)
    .replace(/[. ]+$/g, '')
  if (!sanitized || sanitized === '.' || sanitized === '..') return '_'
  return WINDOWS_RESERVED.test(sanitized) ? `_${sanitized}` : sanitized
}

export function sanitizeAttachmentFilename(value: string): string {
  return safeSegment(basename(value.replace(/\\/g, '/')) || 'attachment')
}

// directory 를 만들거나 재사용하고 realpath 를 돌려준다. parentReal 이 주어지면 그 내부여야 한다.
// 봉쇄 위반은 호출자 도메인의 오류(`unsafe`)로 던진다.
export async function ensurePlainDirectory(
  parentReal: string | null,
  directory: string,
  unsafe: () => Error
): Promise<string> {
  try {
    await mkdir(directory)
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'))
      throw error
  }
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) throw unsafe()
  const resolved = await realpath(directory)
  if (parentReal !== null && !isWithinDir(resolved, parentReal)) throw unsafe()
  return resolved
}

export async function cleanupStaleStages(staging: string, now: number): Promise<void> {
  for (const entry of await readdir(staging, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    const target = join(staging, entry.name)
    const info = await lstat(target)
    if (now - info.mtimeMs <= STALE_STAGE_MS) continue
    const resolved = await realpath(target)
    if (isWithinDir(resolved, staging)) await rm(resolved, { recursive: true, force: true })
  }
}
