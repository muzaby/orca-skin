import { createHash } from 'node:crypto'
import { lstat, open, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'
import { isAbsolutePath, isFilesystemRoot } from '../../../shared/absolute-path'
import { isRecord } from '../../../shared/obj'
import { isWithinDir } from '../../infra/config/paths'
import type { NativeHistoryRequest, NativeHistoryResult } from '../common/native-history'
import { envLookup } from './context-policy'
import { claudeNativePaths } from './native-paths'
import {
  isClaudeHistoryComplete,
  mapClaudeHistory,
  selectClaudeHistory,
  type ClaudeHistoryEntry
} from './native-history-map'

export const CLAUDE_HISTORY_MAX_BYTES = 128 * 1024 * 1024
const SESSION_ID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i

class HistoryReadError extends Error {
  constructor(
    readonly status: 'busy' | 'unavailable',
    message: string
  ) {
    super(message)
  }
}

const samePath = (left: string, right: string): boolean =>
  process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right

function code(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === 'string' ? error.code : undefined
}

async function readSnapshot(
  file: string,
  root: string
): Promise<{ bytes: Buffer; revision: string; signature: string; identity: string }> {
  const before = await lstat(file)
  if (!before.isFile() || before.isSymbolicLink() || before.size > CLAUDE_HISTORY_MAX_BYTES)
    throw new HistoryReadError('unavailable', 'Claude 원본 이력 파일을 안전하게 읽을 수 없습니다.')
  const directory = path.dirname(file)
  if ((await lstat(directory)).isSymbolicLink() || !isWithinDir(await realpath(directory), root))
    throw new HistoryReadError('unavailable', 'Claude 원본 이력의 경로가 일치하지 않습니다.')
  const handle = await open(file, 'r')
  try {
    const opened = await handle.stat()
    if (
      opened.ino !== before.ino ||
      opened.dev !== before.dev ||
      opened.size !== before.size ||
      !opened.isFile()
    )
      throw new HistoryReadError(
        'busy',
        'Claude 원본 이력이 변경 중입니다. 잠시 후 다시 열어 주세요.'
      )
    const buffer = Buffer.alloc(opened.size + 1)
    let offset = 0
    while (offset < buffer.length) {
      const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, offset)
      if (bytesRead === 0) break
      offset += bytesRead
    }
    const after = await handle.stat()
    const current = await lstat(file)
    if (
      offset !== opened.size ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.ino !== opened.ino ||
      current.dev !== opened.dev ||
      after.size !== opened.size ||
      after.mtimeMs !== opened.mtimeMs ||
      current.mtimeMs !== opened.mtimeMs
    )
      throw new HistoryReadError(
        'busy',
        'Claude 원본 이력이 변경 중입니다. 잠시 후 다시 열어 주세요.'
      )
    const bytes = buffer.subarray(0, offset)
    return {
      bytes,
      identity: JSON.stringify([current.dev, current.ino]),
      revision: createHash('sha256').update(bytes).digest('hex'),
      signature: JSON.stringify([
        current.ino,
        current.dev,
        current.size,
        current.mtimeMs,
        current.ctimeMs
      ])
    }
  } finally {
    await handle.close()
  }
}

function parseEntries(text: string): ClaudeHistoryEntry[] {
  if (!text.trim()) throw new HistoryReadError('busy', 'Claude 원본 이력이 아직 기록 중입니다.')
  const lines = text.split('\n')
  const entries: ClaudeHistoryEntry[] = []
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].trim()) continue
    let value: unknown
    try {
      value = JSON.parse(lines[index])
    } catch {
      throw new HistoryReadError(
        index === lines.length - 1 ? 'busy' : 'unavailable',
        'Claude 원본 이력을 아직 읽을 수 없습니다. 기록 완료 후 다시 열어 주세요.'
      )
    }
    if (!isRecord(value))
      throw new HistoryReadError('unavailable', 'Claude 원본 이력 형식이 올바르지 않습니다.')
    entries.push(value)
  }
  return entries
}

export async function readClaudeNativeHistory(
  req: NativeHistoryRequest
): Promise<NativeHistoryResult> {
  if (!SESSION_ID.test(req.sessionId) || !isAbsolutePath(req.cwd) || isFilesystemRoot(req.cwd))
    return {
      status: 'unavailable',
      message: 'Claude 원본 세션 ID 또는 작업 경로가 올바르지 않습니다.'
    }
  try {
    const native = claudeNativePaths(
      envLookup(req.env, req.providerSettings?.settings, process.env),
      undefined,
      req.cwd
    )
    if (isFilesystemRoot(native.root))
      return { status: 'unavailable', message: 'Claude 원본 저장 경로가 올바르지 않습니다.' }
    const cwd = await realpath(req.cwd)
    const root = await realpath(native.projects)
    const directories = await readdir(root, { withFileTypes: true })
    const candidates: string[] = []
    // Only this known ID is inspected. Do not discover/import arbitrary native sessions.
    for (const directory of directories) {
      if (!directory.isDirectory() && !directory.isSymbolicLink()) continue
      const file = path.join(root, directory.name, `${req.sessionId}.jsonl`)
      try {
        await lstat(file)
        candidates.push(file)
      } catch (error) {
        if (code(error) !== 'ENOENT') throw error
      }
    }
    if (candidates.length === 0)
      return {
        status: 'missing',
        message: 'Claude 원본 세션을 찾을 수 없습니다. Orca 보관 기록은 유지됩니다.'
      }
    if (candidates.length !== 1)
      return {
        status: 'unavailable',
        message: '같은 ID의 Claude 원본 세션이 여러 경로에 있어 확인이 필요합니다.'
      }
    const file = candidates[0]
    const snapshot = await readSnapshot(file, root)
    const sourceKey = `claude:${createHash('sha256')
      .update(JSON.stringify([file, cwd]))
      .digest('hex')}`
    const previous = req.previous
    const cursor = previous?.cursor
    const checkpoint = cursor?.checkpoint
    const reusable =
      cursor?.version === 1 &&
      cursor.sourceKey === sourceKey &&
      previous?.snapshot.sourceKey === sourceKey &&
      cursor.revision === previous.snapshot.revision
    if (reusable && cursor.revision === snapshot.revision) return { status: 'unchanged' }
    const offset = checkpoint?.offset
    const append =
      reusable &&
      checkpoint?.identity === snapshot.identity &&
      checkpoint?.newline === true &&
      typeof offset === 'number' &&
      Number.isSafeInteger(offset) &&
      offset > 0 &&
      offset < snapshot.bytes.length &&
      createHash('sha256').update(snapshot.bytes.subarray(0, offset)).digest('hex') ===
        cursor.revision &&
      Array.isArray(previous.snapshot.raw)
    // Prefix bytes are verified, but already parsed records are reused only for a proven append.
    const entries = append
      ? [
          ...(previous.snapshot.raw as ClaudeHistoryEntry[]),
          ...parseEntries(
            new TextDecoder('utf-8', { fatal: true }).decode(snapshot.bytes.subarray(offset))
          )
        ]
      : parseEntries(new TextDecoder('utf-8', { fatal: true }).decode(snapshot.bytes))
    const identities = entries.filter((entry) => typeof entry.sessionId === 'string')
    if (identities.some((entry) => entry.sessionId !== req.sessionId) || identities.length === 0)
      return {
        status: 'unavailable',
        message: 'Claude 원본 세션의 ID가 저장된 세션과 일치하지 않습니다.'
      }
    const latestCwd = entries
      .map((entry) => (entry.type === 'relocated' ? entry.relocatedCwd : entry.cwd))
      .findLast((value) => typeof value === 'string')
    if (
      typeof latestCwd !== 'string' ||
      !isAbsolutePath(latestCwd) ||
      !samePath(await realpath(latestCwd), cwd)
    )
      return {
        status: 'unavailable',
        message: 'Claude 원본 세션의 작업 경로가 저장된 세션과 일치하지 않습니다.'
      }
    const selected = await selectClaudeHistory(req.sessionId, cwd, entries)
    const latest = await lstat(file)
    if (
      !latest.isFile() ||
      latest.isSymbolicLink() ||
      snapshot.signature !==
        JSON.stringify([latest.ino, latest.dev, latest.size, latest.mtimeMs, latest.ctimeMs])
    )
      return {
        status: 'busy',
        message: 'Claude 원본 이력이 변경 중입니다. 잠시 후 다시 열어 주세요.'
      }
    if (!isClaudeHistoryComplete(selected, entries))
      return {
        status: 'busy',
        message: 'Claude 원본 응답이 아직 완료되지 않아 보관 기록을 표시합니다.'
      }
    return {
      status: 'ready',
      cursor: {
        version: 1,
        sourceKey,
        revision: snapshot.revision,
        checkpoint: {
          kind: 'claude-jsonl',
          identity: snapshot.identity,
          offset: snapshot.bytes.length,
          newline: snapshot.bytes.at(-1) === 10,
          lastUuid: entries.findLast((entry) => typeof entry.uuid === 'string')?.uuid
        }
      },
      snapshot: {
        sessionId: req.sessionId,
        cwd: req.cwd,
        sourceKey,
        revision: snapshot.revision,
        messages: mapClaudeHistory(selected, req.sessionId, req.cwd),
        raw: entries
      }
    }
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('encoded data'))
      return { status: 'busy', message: 'Claude 원본 문자가 아직 기록 중입니다.' }
    if (error instanceof HistoryReadError) return { status: error.status, message: error.message }
    if (code(error) === 'ENOENT')
      return {
        status: 'missing',
        message: 'Claude 원본 세션 또는 작업 경로를 찾을 수 없습니다. Orca 보관 기록은 유지됩니다.'
      }
    return {
      status: 'unavailable',
      message: 'Claude 원본 이력에 접근할 수 없습니다. 경로와 접근 권한을 확인해 주세요.'
    }
  }
}
