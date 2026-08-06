import { promises as fs } from 'node:fs'
import { basename, extname, parse, resolve } from 'node:path'
import { homedir, platform } from 'node:os'
import type { ComposerAttachment } from '../../../shared/ipc'
import { SUPPORTED_IMAGE_MEDIA_TYPES } from './image'
import type { ExtractedAttachmentText, ExtractedAttachmentImage } from '../../adapters/turn'

export const MAX_FILE_CONTEXT_CHARS = 24_000
export const SUPPORTED_IMAGE_MIME_TYPES = new Set<string>(SUPPORTED_IMAGE_MEDIA_TYPES)

interface AttachmentExtractor {
  supports(ext: string): boolean
  extract(absPath: string): Promise<string>
}

export class TextExtractor implements AttachmentExtractor {
  supports(ext: string): boolean {
    return ext === '.txt' || ext === '.md'
  }

  async extract(absPath: string): Promise<string> {
    const buf = await fs.readFile(absPath)
    if (buf.includes(0)) throw new Error('binary-like text attachment is not supported')
    return buf.toString('utf8').replace(/^\uFEFF/, '')
  }
}

const textExtractor = new TextExtractor()

// 대용량 버퍼 base64 인코딩(0110) — 이미지 상한 32MB 의 단일 .toString('base64') 는
// send 경로에서 이벤트 루프를 수백 ms 점유한다. base64 패딩 경계(3바이트 배수) 청크로
// 나눠 setImmediate 로 양보하며 인코딩한다 — 총비용 동일, 점유만 분산. worker 오프로딩은
// 1회성 수십~백 ms 에 프로세스/직렬화 비용이 부적합해 기각(계획 문서).
const BASE64_CHUNK_BYTES = 3 * 1024 * 1024

export async function bufferToBase64Chunked(
  buf: Buffer,
  chunkBytes = BASE64_CHUNK_BYTES
): Promise<string> {
  const aligned = Math.max(3, chunkBytes - (chunkBytes % 3))
  if (buf.length <= aligned) return buf.toString('base64')
  const parts: string[] = []
  for (let at = 0; at < buf.length; at += aligned) {
    parts.push(buf.subarray(at, Math.min(buf.length, at + aligned)).toString('base64'))
    // 청크 *사이*에서만 양보 — 마지막 청크 뒤 양보는 결과만 한 틱 늦춘다.
    if (at + aligned < buf.length) await new Promise<void>((resolve) => setImmediate(resolve))
  }
  return parts.join('')
}

function mimeTypeForPath(path: string): string {
  const ext = extname(path).toLowerCase()
  if (ext === '.md') return 'text/markdown'
  if (ext === '.txt') return 'text/plain'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  return 'application/octet-stream'
}

export async function fileMeta(
  path: string
): Promise<{ name: string; mimeType: string; sizeBytes: number }> {
  const st = await fs.stat(path)
  return { name: basename(path), mimeType: mimeTypeForPath(path), sizeBytes: st.size }
}

function stripDataUrlPrefix(data: string): string {
  const idx = data.indexOf(',')
  return data.startsWith('data:') && idx >= 0 ? data.slice(idx + 1) : data
}

function makeAttachmentId(source: { name: string; path?: string; data?: string }): string {
  const seed = `${source.name}:${source.path ?? ''}:${source.data?.slice(0, 24) ?? ''}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const stem =
    parse(source.name)
      .name.replace(/[^A-Za-z0-9_-]+/g, '-')
      .slice(0, 24) || 'attachment'
  return `att_${hash.toString(36)}_${stem}`
}

export function assertAllowedAttachmentPath(path: string): string {
  const real = resolve(path)
  const home = resolve(homedir())
  const currentPlatform = platform()
  if (currentPlatform === 'linux' || currentPlatform === 'darwin') {
    if (real === home || real.startsWith(`${home}/`)) return real
    throw new Error('attachment path is outside the user home directory')
  }
  if (currentPlatform === 'win32') {
    const lower = real.toLowerCase()
    const homeLower = home.toLowerCase()
    const drive = lower.slice(0, 2)
    if (drive === 'c:') {
      if (lower === homeLower || lower.startsWith(`${homeLower}\\`)) return real
      throw new Error('attachment path on C: must be inside the user profile directory')
    }
    if (drive.match(/^[a-z]:$/)) return real
    throw new Error('network attachment paths are not supported')
  }
  return real
}

function truncateText(text: string): {
  text: string
  charsOriginal: number
  charsIncluded: number
  truncated: boolean
} {
  const charsOriginal = text.length
  if (charsOriginal <= MAX_FILE_CONTEXT_CHARS) {
    return { text, charsOriginal, charsIncluded: charsOriginal, truncated: false }
  }
  return {
    text: text.slice(0, MAX_FILE_CONTEXT_CHARS),
    charsOriginal,
    charsIncluded: MAX_FILE_CONTEXT_CHARS,
    truncated: true
  }
}

async function attachmentFromPath(
  att: Extract<ComposerAttachment, { kind: 'path' }>
): Promise<ExtractedAttachmentText | ExtractedAttachmentImage> {
  const path = assertAllowedAttachmentPath(att.path)
  const mimeType = att.mimeType || mimeTypeForPath(path)
  const sizeBytes = att.sizeBytes ?? (await fs.stat(path)).size
  const id = makeAttachmentId({ name: att.name, path })
  if (SUPPORTED_IMAGE_MIME_TYPES.has(mimeType)) {
    const data = await bufferToBase64Chunked(await fs.readFile(path))
    return { id, name: att.name, mimeType, sizeBytes, data, sourceKind: att.sourceKind }
  }
  const ext = extname(path).toLowerCase()
  if (!textExtractor.supports(ext)) throw new Error(`unsupported attachment type: ${ext}`)
  const extracted = await textExtractor.extract(path)
  const truncated = truncateText(extracted)
  return { id, name: att.name, mimeType, sizeBytes, sourceKind: att.sourceKind, ...truncated }
}

function attachmentFromInline(
  att: Extract<ComposerAttachment, { kind: 'inline' }>
): ExtractedAttachmentImage {
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(att.mimeType))
    throw new Error('inline attachment must be an image')
  return {
    id: makeAttachmentId({ name: att.name, data: att.data }),
    name: att.name,
    mimeType: att.mimeType,
    sizeBytes: att.sizeBytes,
    data: stripDataUrlPrefix(att.data),
    sourceKind: att.sourceKind
  }
}

export async function normalizeAttachments(attachments: ComposerAttachment[]): Promise<{
  attachmentTexts: ExtractedAttachmentText[]
  attachmentImages: ExtractedAttachmentImage[]
}> {
  const attachmentTexts: ExtractedAttachmentText[] = []
  const attachmentImages: ExtractedAttachmentImage[] = []
  for (const att of attachments) {
    const normalized =
      att.kind === 'path' ? await attachmentFromPath(att) : attachmentFromInline(att)
    if ('text' in normalized) attachmentTexts.push(normalized)
    else attachmentImages.push(normalized)
  }
  return { attachmentTexts, attachmentImages }
}
