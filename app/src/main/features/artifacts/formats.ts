import { extname } from 'node:path'
import type { ArtifactPreviewResult, ArtifactRef } from '../../../shared/artifacts'
import { staticArtifactHtml } from './html-preview'

export const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024

const textLanguages: Readonly<Record<string, string>> = {
  '.txt': 'text',
  '.text': 'text',
  '.log': 'text',
  '.csv': 'text',
  '.tsv': 'text',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.json': 'json',
  '.jsonl': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.sql': 'sql',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.sh': 'bash',
  '.bash': 'bash',
  '.ps1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',
  '.toml': 'toml',
  '.ini': 'ini',
  '.conf': 'text',
  '.cfg': 'text',
  '.r': 'r',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.php': 'php',
  '.vue': 'xml',
  '.svelte': 'xml',
  '.lua': 'lua'
}
const imageMimeTypes: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
}
interface ArtifactFormat {
  format: ArtifactRef['kind']
  mimeType: string
  language?: string
}
export function artifactFormat(filename: string): ArtifactFormat {
  const extension = extname(filename).toLowerCase()
  if (extension === '.md' || extension === '.markdown')
    return { format: 'markdown', mimeType: 'text/markdown', language: 'markdown' }
  if (extension === '.html' || extension === '.htm')
    return { format: 'html', mimeType: 'text/html', language: 'html' }
  const language = textLanguages[extension]
  if (language) return { format: 'text', mimeType: 'text/plain', language }
  const mimeType = imageMimeTypes[extension]
  if (mimeType) return { format: 'image', mimeType }
  throw new Error('unsupported-format')
}

function utf8(bytes: Buffer): string {
  try {
    // Keep the original BOM as well as CRLF and other source text for copy/code view.
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new Error('invalid-utf8')
  }
}
function validImage(bytes: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/png':
      return (
        bytes.length >= 24 &&
        bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        bytes.toString('ascii', 12, 16) === 'IHDR' &&
        bytes.readUInt32BE(16) > 0 &&
        bytes.readUInt32BE(20) > 0
      )
    case 'image/jpeg':
      return (
        bytes.length >= 5 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff &&
        bytes[bytes.length - 2] === 0xff &&
        bytes[bytes.length - 1] === 0xd9
      )
    case 'image/gif':
      return (
        bytes.length >= 10 &&
        ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6)) &&
        bytes.readUInt16LE(6) > 0 &&
        bytes.readUInt16LE(8) > 0
      )
    case 'image/webp':
      return (
        bytes.length >= 16 &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.readUInt32LE(4) === bytes.length - 8 &&
        bytes.toString('ascii', 8, 12) === 'WEBP' &&
        ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16))
      )
    case 'image/svg+xml': {
      const source = utf8(bytes)
      // Image mode never grants document privileges. Exclude DTDs/entities and require an SVG root.
      if (/<!DOCTYPE|<!ENTITY/iu.test(source)) return false
      const root = source
        .replace(/^\uFEFF/u, '')
        .replace(/^\s*<\?xml\s[^?]*\?>/u, '')
        .replace(/^\s*(?:<!--[\s\S]*?-->\s*)*/u, '')
      return /^\s*<svg(?:\s[^<>]*?)?(?:\/>\s*|>[\s\S]*<\/svg>\s*)$/u.test(root)
    }
    default:
      return false
  }
}

export function validateArtifactBytes(filename: string, bytes: Buffer): ArtifactFormat {
  if (bytes.length > MAX_ARTIFACT_BYTES) throw new Error('too-large')
  const format = artifactFormat(filename)
  if (format.format === 'image') {
    if (!validImage(bytes, format.mimeType)) throw new Error('invalid-image')
  } else utf8(bytes)
  return format
}

export function artifactPreview(filename: string, bytes: Buffer): ArtifactPreviewResult {
  const format = validateArtifactBytes(filename, bytes)
  const content =
    format.format === 'image'
      ? `data:${format.mimeType};base64,${bytes.toString('base64')}`
      : utf8(bytes)
  return {
    state: 'ready',
    ...format,
    content,
    ...(format.format === 'html' ? { previewContent: staticArtifactHtml(content) } : {})
  }
}
