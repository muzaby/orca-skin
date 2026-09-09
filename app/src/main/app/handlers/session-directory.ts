import { realpath, stat } from 'node:fs/promises'
import type { DbQueries } from '../../infra/db'
import { isAbsolutePath, isFilesystemRoot } from '../../../shared/absolute-path'
import {
  directoryIdentity,
  MAX_SESSION_EXTRA_DIRECTORIES,
  parseStoredExtraDirectories
} from '../../../shared/extra-directories'
import type { AddSessionDirectoryRequest, AddSessionDirectoryResult } from '../../../shared/ipc'
import { parseAgentKind } from '../../../shared/agent-kind'
import { agentSessionPolicy } from '../../../shared/agent-session-policy'

async function resolveDirectory(directory: string): Promise<string> {
  if (!isAbsolutePath(directory) || isFilesystemRoot(directory))
    throw new Error('invalid-directory')
  const canonical = await realpath(directory)
  if (isFilesystemRoot(canonical) || !(await stat(canonical)).isDirectory()) {
    throw new Error('invalid-directory')
  }
  return canonical
}

interface DirectoryDependencies {
  db: Pick<DbQueries, 'getSessionById' | 'updateSessionExtraDirs'>
  isSessionBusy: (sessionId: string) => boolean
  resolveDirectory?: (directory: string) => Promise<string>
}

// 폴더 검증 중 시작된 턴/세션 삭제를 다시 확인한다. 최종 검사와 DB 갱신 사이에는 await가 없다.
export async function addSessionDirectory(
  deps: DirectoryDependencies,
  request: AddSessionDirectoryRequest
): Promise<AddSessionDirectoryResult> {
  const initial = deps.db.getSessionById(request.sessionId)
  if (!initial) return { ok: false, reason: 'not-found' }
  if (!agentSessionPolicy[parseAgentKind(initial.agent_kind)].allowDirectoryUpdates)
    return { ok: false, reason: 'not-work' }
  if (deps.isSessionBusy(request.sessionId)) return { ok: false, reason: 'busy' }
  if (!isAbsolutePath(request.directory) || isFilesystemRoot(request.directory)) {
    return { ok: false, reason: 'invalid-directory' }
  }
  const resolve = deps.resolveDirectory ?? resolveDirectory
  let canonical: string
  const aliases = new Map<string, string>()
  try {
    canonical = await resolve(request.directory)
    if (!isAbsolutePath(canonical) || isFilesystemRoot(canonical)) {
      return { ok: false, reason: 'invalid-directory' }
    }
    // 이전 버전이 저장한 junction/별칭도 중복으로 처리한다. 사라진 기존 폴더는 그대로 보존한다.
    const previous = parseStoredExtraDirectories(initial.extra_dirs)
    await Promise.all(
      previous.map(async (directory) => {
        try {
          aliases.set(directoryIdentity(directory), directoryIdentity(await resolve(directory)))
        } catch {
          // 이번에 새로 허용할 경로가 아니다. 기존 기록을 삭제하거나 확대하지 않는다.
        }
      })
    )
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return {
      ok: false,
      reason: code === 'EACCES' || code === 'EPERM' ? 'failed' : 'invalid-directory'
    }
  }
  if (deps.isSessionBusy(request.sessionId)) return { ok: false, reason: 'busy' }
  const current = deps.db.getSessionById(request.sessionId)
  if (!current) return { ok: false, reason: 'not-found' }
  if (!agentSessionPolicy[parseAgentKind(current.agent_kind)].allowDirectoryUpdates)
    return { ok: false, reason: 'not-work' }
  const extraDirs = parseStoredExtraDirectories(current.extra_dirs)
  const key = directoryIdentity(canonical)
  // cwd도 명시적으로 선택하면 Context에 남긴다. 이미 추가한 폴더만 중복이다.
  if (
    extraDirs.some((directory) => {
      const identity = directoryIdentity(directory)
      return identity === key || aliases.get(identity) === key
    })
  )
    return { ok: true, extraDirs }
  if (extraDirs.length >= MAX_SESSION_EXTRA_DIRECTORIES) return { ok: false, reason: 'limit' }
  const next = [...extraDirs, canonical]
  try {
    deps.db.updateSessionExtraDirs(request.sessionId, next)
  } catch {
    return { ok: false, reason: 'failed' }
  }
  return { ok: true, extraDirs: next }
}
