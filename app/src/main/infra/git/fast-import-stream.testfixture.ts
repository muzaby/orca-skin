import { HERMETIC_GIT_IDENTITY } from '../../../../scripts/test-host.mjs'

export interface RepoCommit {
  files?: Record<string, string | Buffer | null>
  message: string
  date?: string
}
export interface RepoSpec {
  branch?: string
  commits?: RepoCommit[]
  branches?: Record<string, number>
  detach?: number
}

/** 경로는 항상 C 인용한다. UTF-8 바이트를 octal로 쓰면 core.quotePath·로캘과 무관하다. */
function quotePath(path: string): string {
  return (
    '"' +
    [...Buffer.from(path)]
      .map((byte) =>
        byte >= 32 && byte < 127 && byte !== 34 && byte !== 92
          ? String.fromCharCode(byte)
          : `\\${byte.toString(8).padStart(3, '0')}`
      )
      .join('') +
    '"'
  )
}

export function fastImportStream(spec: RepoSpec, parent?: string, now = Date.now()): Buffer {
  const chunks: Buffer[] = []
  const line = (text: string): void => {
    chunks.push(Buffer.from(text + '\n'))
  }
  const data = (content: string | Buffer): void => {
    const bytes = Buffer.from(content)
    line(`data ${bytes.length}`)
    chunks.push(bytes, Buffer.from('\n'))
  }
  const branch = spec.branch ?? 'main'
  for (const [index, commit] of (spec.commits ?? []).entries()) {
    line(`commit refs/heads/${branch}`)
    line(`mark :${index + 1}`)
    const seconds = Math.floor((commit.date ? Date.parse(commit.date) : now) / 1000)
    const identity = `${HERMETIC_GIT_IDENTITY.name} <${HERMETIC_GIT_IDENTITY.email}> ${seconds} +0000`
    line(`author ${identity}`)
    line(`committer ${identity}`)
    data(commit.message + '\n')
    if (index === 0 && parent) line(`from ${parent}`)
    for (const [path, content] of Object.entries(commit.files ?? {})) {
      if (content === null) line(`D ${quotePath(path)}`)
      else {
        line(`M 100644 inline ${quotePath(path)}`)
        data(content)
      }
    }
    line('')
  }
  for (const [name, index] of Object.entries(spec.branches ?? {})) {
    line(`reset refs/heads/${name}`)
    line(`from :${index + 1}`)
    line('')
  }
  return Buffer.concat(chunks)
}

export function parseMarks(text: string): string[] {
  const marks: string[] = []
  for (const line of text.trim().split('\n')) {
    const match = line.match(/^:(\d+) ([0-9a-f]{40}|[0-9a-f]{64})$/)
    if (!match || Number(match[1]) < 1 || marks[Number(match[1]) - 1])
      throw new Error(`Invalid git mark: ${line}`)
    marks[Number(match[1]) - 1] = match[2]
  }
  if (Array.from(marks).some((oid) => !oid)) throw new Error('Missing git marks')
  return marks
}
