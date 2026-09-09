import { basename, isAbsolute, relative, resolve, sep, win32 } from 'node:path'
import type { ArtifactAvailability, ArtifactRef } from '../../../shared/artifacts'
import { artifactFormat } from './formats'

export { MAX_ARTIFACT_BYTES } from './formats'

export interface PublishArtifactInput {
  path: string
  title?: string
}

// Windows의 drive-relative/device/ADS 경로는 resolve 이전에 차단한다.
export function assertLocalPath(value: string): void {
  if (
    !value ||
    value.length > 4096 ||
    [...value].some((char) => char.charCodeAt(0) < 32) ||
    /^[\\/]{2}/u.test(value) ||
    /^\\/u.test(value) ||
    (/^[a-z]:/iu.test(value) && !/^[a-z]:[\\/]/iu.test(value)) ||
    value.replace(/^[a-z]:/iu, '').includes(':')
  )
    throw new Error('unsafe-path')
}

export function containsPath(child: string, parent: string): boolean {
  const path = /^[a-z]:/iu.test(parent) ? win32 : { relative, resolve, isAbsolute, sep }
  const rel = path.relative(path.resolve(parent), path.resolve(child))
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
}

export function assertArtifactFilename(filename: string): void {
  if (
    !filename ||
    [...filename].some((char) => char.charCodeAt(0) < 32) ||
    /[\\/<>:"|?*]/u.test(filename) ||
    /[. ]$/u.test(filename) ||
    /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(filename)
  )
    throw new Error('unsafe-path')
}

export function artifactInput(
  input: unknown
): PublishArtifactInput & { filename: string; title: string; kind: ArtifactRef['kind'] } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid-input')
  const value = input as Record<string, unknown>
  if (
    Object.keys(value).some((key) => key !== 'path' && key !== 'title') ||
    typeof value.path !== 'string'
  )
    throw new Error('invalid-input')
  assertLocalPath(value.path)
  const filename = basename(value.path.replaceAll('\\', '/'))
  assertArtifactFilename(filename)
  const kind = artifactFormat(filename).format
  if (value.title !== undefined && typeof value.title !== 'string') throw new Error('invalid-title')
  const title = value.title === undefined ? filename : (value.title as string).trim()
  if (!title || title.length > 160) throw new Error('invalid-title')
  return { path: value.path, filename, title, kind }
}

export function classifyFileError(error: unknown): ArtifactAvailability {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (code === 'ENOENT' || code === 'ENOTDIR') return { state: 'missing' }
  if (code === 'EACCES' || code === 'EPERM')
    return { state: 'unavailable', reason: 'access-denied' }
  return {
    state: 'unavailable',
    reason: error instanceof Error && error.message === 'unsafe-path' ? 'unsafe-path' : 'io-error'
  }
}

export function artifactError(error: unknown): Error {
  const known = [
    'unsafe-path',
    'invalid-input',
    'invalid-title',
    'unsupported-format',
    'too-large',
    'invalid-utf8',
    'invalid-image',
    'file-changed',
    'cancelled',
    'busy',
    'closed',
    'forbidden',
    'missing',
    'access-denied',
    'io-error',
    'storage-failed'
  ]
  if (error instanceof Error && known.includes(error.message)) return error
  const state = classifyFileError(error)
  return new Error(
    state.state === 'missing'
      ? 'missing'
      : state.state === 'unavailable'
        ? state.reason
        : 'io-error'
  )
}
