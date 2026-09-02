// git diff 출력 파서 + 상한 절단 — **순수 함수만**. 실행(execFile)은 `git-diff.ts` 가 갖는다.
// `git-parse.ts` 와 같은 이유로 나눈다: 회귀는 언제나 출력 형식 해석 쪽에서 난다.
//
// 상한(0211 D-016)이 여기 사는 이유: 저장소 크기에는 상한이 없고, 절단하지 않으면 IPC 페이로드가
// `maxBuffer` 를 넘겨 **조회 자체가 실패**한다. 그리고 절단했다는 사실은 값으로 나가야 한다 —
// 조용히 자르면 사용자가 diff 를 전부 본 것으로 읽는다.

import type {
  GitDiffCommit,
  GitDiffFileEntry,
  GitDiffFileStatus,
  GitDiffPatchFile,
  GitDiffPatchLine,
  GitDiffTotals
} from '../../../shared/ipc'

/** 요약 1회가 실을 수 있는 최대 파일 수. 넘으면 잘라내고 `filesTruncated` 를 세운다. */
export const MAX_DIFF_FILES = 200

/** 요약 1회가 실을 수 있는 최대 커밋 수. */
export const MAX_DIFF_COMMITS = 100

/** 커밋 노드 하나가 실을 수 있는 최대 파일 수. */
export const MAX_DIFF_COMMIT_FILES = 50

// `git log -z --format=%x00orca-commit%x00%H%x00%s%x00%an%x00%ct%x00%b%x00`
// 프레임. Git 커밋 메시지와 경로는 NUL을 담을 수 없으므로 제목·본문·개행·탭을
// 손실 없이 싣는다. `withFiles=true`는 같은 프레임 뒤의 raw 블록과 numstat
// 블록을 결합한다. false는 메타데이터 폴백이라 파일 값을 null로 낸다.
export function parseCommitLog(
  out: string,
  withFiles = false
): { commits: GitDiffCommit[]; truncated: boolean } {
  const tokens = out.split('\0')
  const headers = findCommitHeaders(tokens)
  const commits: GitDiffCommit[] = []
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index]
    const [sha, subject, author, committed, body] = tokens.slice(header + 1, header + 6)
    if (!sha || committed === undefined) continue
    const seconds = Number(committed)
    if (!Number.isFinite(seconds)) continue
    const nextHeader = headers[index + 1]
    // header 뒤의 body 종결 NUL부터 다음 header 앞의 framing NUL까지가 이 commit의 raw/numstat다.
    const files = withFiles
      ? parseCommitFiles(
          tokens.slice(header + 6, nextHeader === undefined ? undefined : nextHeader - 1)
        )
      : []
    const totals = withFiles
      ? files.reduce<GitDiffTotals>(
          (sum, file) => ({ added: sum.added + file.added, removed: sum.removed + file.removed }),
          { added: 0, removed: 0 }
        )
      : null
    commits.push({
      sha,
      subject: subject ?? '',
      author: author ?? '',
      // git 은 초, 화면은 ms 를 쓴다.
      committedAt: seconds * 1000,
      ...(body ? { body } : {}),
      files: files.slice(0, MAX_DIFF_COMMIT_FILES),
      filesTruncated: files.length > MAX_DIFF_COMMIT_FILES,
      fileCount: withFiles ? files.length : null,
      totals
    })
  }
  return {
    commits: commits.slice(0, MAX_DIFF_COMMITS),
    truncated: commits.length > MAX_DIFF_COMMITS
  }
}

// `%x00orca-commit%x00` 자체만으로 stream을 자르면 루트 파일명 `orca-commit`의
// `\0orca-commit\0`과 충돌한다. header는 format이 만든 선행 빈 token 뒤에만 있고,
// 그 다음 다섯 metadata token이 완전해야 한다. 경로 token은 이 grammar를 만족하지 않는다.
function findCommitHeaders(tokens: readonly string[]): number[] {
  const headers: number[] = []
  for (let index = 1; index + 5 < tokens.length; index += 1) {
    if (tokens[index] !== 'orca-commit' || tokens[index - 1] !== '') continue
    const sha = tokens[index + 1]
    const committed = tokens[index + 4]
    // Git's %ct is a Unix epoch and may be negative for commits before 1970.
    if (!sha || !committed || !/^-?\d+$/.test(committed)) continue
    headers.push(index)
  }
  return headers
}

// `--raw --numstat -z` 한 스트림의 파서 — 커밋 이력(`log --raw --numstat`)과 세션 diff
// (`diff --raw --numstat`)가 **같은 형식**이라 한 곳이 읽는다(0211 D-052 · D-062).
export function parseCommitFiles(tokens: readonly string[]): GitDiffFileEntry[] {
  const statusByPath = new Map<string, GitDiffFileStatus>()
  let i = 0
  let numstatStart = tokens.length
  while (i < tokens.length) {
    const token = tokens[i]
    if (/^(?:-|\d+)\t(?:-|\d+)\t/.test(token)) {
      numstatStart = i
      break
    }
    const raw = token.replace(/^\n+/, '')
    if (!raw.startsWith(':')) {
      i += 1
      continue
    }
    const code = raw.trim().split(/\s+/).at(-1) ?? 'M'
    const letter = code[0]
    if (letter === 'R' || letter === 'C') {
      const newPath = tokens[i + 2]
      if (newPath) statusByPath.set(newPath, 'renamed')
      i += 3
      continue
    }
    const path = tokens[i + 1]
    if (path) {
      statusByPath.set(path, letter === 'A' ? 'added' : letter === 'D' ? 'deleted' : 'modified')
    }
    i += 2
  }
  return applyNameStatus(parseNumstatZ(tokens.slice(numstatStart).join('\0')), statusByPath)
}

// `git diff --numstat -z <base>` 출력.
//
// `-z` 는 레코드를 NUL 로 끊고 **경로를 인용하지 않는다** — 한글·공백·따옴표가 든 경로가
// `"src/\355\225\234"` 로 이스케이프되는 것을 막는다. rename 은 세 필드다:
//   `added \t removed \t \0 old \0 new \0`  (경로 자리가 비고 두 경로가 뒤따른다)
// binary 는 숫자 자리가 `-` 다.
export function parseNumstatZ(out: string): GitDiffFileEntry[] {
  const tokens = out.split('\0')
  const entries: GitDiffFileEntry[] = []
  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]
    if (!token || token.length === 0) {
      i += 1
      continue
    }
    const parts = token.split('\t')
    if (parts.length < 3) {
      i += 1
      continue
    }
    const [addedRaw, removedRaw, pathInline] = parts
    const binary = addedRaw === '-' || removedRaw === '-'
    let path = pathInline
    if (path.length === 0) {
      // rename/copy — 다음 두 토큰이 old·new 경로다. 새 경로를 쓴다.
      path = tokens[i + 2] ?? tokens[i + 1] ?? ''
      i += 3
    } else {
      i += 1
    }
    if (path.length === 0) continue
    entries.push({
      path,
      status: pathInline.length === 0 ? 'renamed' : 'modified',
      added: binary ? 0 : Number(addedRaw) || 0,
      removed: binary ? 0 : Number(removedRaw) || 0,
      binary
    })
  }
  return entries
}

// **합계는 `slice` 앞에서 센다**: 목록은 200개에서 잘려도 합계는 저장소의 실제 변경량이다.
export function mergeDiffEntries(tracked: readonly GitDiffFileEntry[]): {
  files: GitDiffFileEntry[]
  truncated: boolean
  totals: GitDiffTotals
} {
  const merged: GitDiffFileEntry[] = [...tracked]
  merged.sort((a, b) => a.path.localeCompare(b.path))
  const totals = merged.reduce<GitDiffTotals>(
    (acc, entry) => ({ added: acc.added + entry.added, removed: acc.removed + entry.removed }),
    { added: 0, removed: 0 }
  )
  return {
    files: merged.slice(0, MAX_DIFF_FILES),
    truncated: merged.length > MAX_DIFF_FILES,
    totals
  }
}

// `git diff --name-status -z <range>` 로 얻은 상태 문자를 목록에 입힌다.
// numstat 은 삭제/추가를 구분하지 않으므로(둘 다 숫자만 준다) 상태는 여기서 온다.
export function applyNameStatus(
  entries: readonly GitDiffFileEntry[],
  statusByPath: ReadonlyMap<string, GitDiffFileStatus>
): GitDiffFileEntry[] {
  return entries.map((entry) => {
    const status = statusByPath.get(entry.path)
    return status ? { ...entry, status } : entry
  })
}

// `git diff --name-status -z` 출력 → 경로별 상태.
// rename(`R100`)·copy(`C100`)는 뒤에 유사도 숫자가 붙고 경로가 둘이다.
export function parseNameStatusZ(out: string): Map<string, GitDiffFileStatus> {
  const tokens = out.split('\0').filter((t) => t.length > 0)
  const map = new Map<string, GitDiffFileStatus>()
  let i = 0
  while (i < tokens.length) {
    const code = tokens[i]
    const letter = code[0]
    if (letter === 'R' || letter === 'C') {
      const newPath = tokens[i + 2]
      if (newPath) map.set(newPath, 'renamed')
      i += 3
      continue
    }
    const path = tokens[i + 1]
    if (path) {
      map.set(path, letter === 'A' ? 'added' : letter === 'D' ? 'deleted' : 'modified')
    }
    i += 2
  }
  return map
}

// ── unified patch 파서 (0211 ΔV4) ────────────────────────────────────────────
// `git -c core.quotePath=false diff --unified=<n> -M --no-color <base>` 한 덩어리를
// **파일별 diff 줄**로 읽는다. 파일마다 본문을 따로 묻던 옛 경로를 대신하므로(D-075) 파서가
// 커버해야 할 케이스는 git 이 그 명령으로 낼 수 있는 블록 전부다 — 수정·추가·삭제·rename·
// binary·개행 없음·모드만 변경 **7종**(§11 ΔV4 표, git 2.43 실측).
//
// **`core.quotePath=false` 가 전제다.** 켜져 있으면 한글 경로가 `"a/\355\225\234…"` 로
// 이스케이프돼 오고, 그 문자열이 그대로 화면과 요구사항 anchor 의 `filePath` 가 된다.

/** 파일 하나가 실을 수 있는 최대 줄 수. 넘으면 줄 없이 `too-large` 로 낸다. */
export const MAX_PATCH_FILE_LINES = 50_000

/** 패치 한 벌 전체의 최대 줄 수. 넘긴 뒤의 파일은 줄 없이 `too-large` 다. */
export const MAX_PATCH_TOTAL_LINES = 200_000

// `--- a/<path>` · `+++ b/<path>`. 경로에 공백이 있으면 git 이 **탭을 덧붙인다**(실측) —
// 탭 앞까지가 경로다. `"` 로 시작하면 아직 인용된 경로이므로 C 이스케이프를 푼다.
function sidePath(raw: string): string {
  const cut = raw.indexOf('\t')
  const value = cut >= 0 ? raw.slice(0, cut) : raw
  if (value === '/dev/null') return value
  const unquoted = value.startsWith('"') ? unquoteGitPath(value) : value
  return unquoted.startsWith('a/') || unquoted.startsWith('b/') ? unquoted.slice(2) : unquoted
}

function unquoteGitPath(value: string): string {
  const body = value.slice(1, value.endsWith('"') ? -1 : undefined)
  const bytes: number[] = []
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] !== '\\') {
      bytes.push(...Buffer.from(body[i], 'utf8'))
      continue
    }
    const next = body[i + 1]
    if (next === undefined) break
    const octal = /^[0-7]{3}$/.test(body.slice(i + 1, i + 4)) ? body.slice(i + 1, i + 4) : null
    if (octal) {
      bytes.push(Number.parseInt(octal, 8))
      i += 3
      continue
    }
    const simple: Record<string, number> = { n: 10, t: 9, r: 13, '"': 34, '\\': 92 }
    bytes.push(simple[next] ?? Buffer.from(next, 'utf8')[0])
    i += 1
  }
  return Buffer.from(bytes).toString('utf8')
}

// binary 블록에는 `---`/`+++` 가 **없다**(실측) — 경로를 헤더에서만 얻을 수 있다.
// `a/<old> b/<new>` 에서 마지막 ` b/` 를 구분자로 본다.
function headerPaths(line: string): { oldPath: string; newPath: string } | null {
  const rest = line.slice('diff --git '.length)
  const cut = rest.lastIndexOf(' b/')
  if (cut < 0) return null
  return { oldPath: sidePath(rest.slice(0, cut)), newPath: sidePath(rest.slice(cut + 1)) }
}

interface PatchBlock {
  header: string
  lines: string[]
}

function splitBlocks(out: string): PatchBlock[] {
  const blocks: PatchBlock[] = []
  for (const raw of out.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      blocks.push({ header: raw, lines: [] })
      continue
    }
    blocks[blocks.length - 1]?.lines.push(raw)
  }
  return blocks
}

interface BlockScan {
  status: GitDiffFileStatus
  oldSide: string | null
  newSide: string | null
  renamedFrom: string | null
  binary: boolean
  hunkStart: number
}

function scanMeta(lines: readonly string[]): BlockScan {
  const scan: BlockScan = {
    status: 'modified',
    oldSide: null,
    newSide: null,
    renamedFrom: null,
    binary: false,
    hunkStart: lines.length
  }
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (line.startsWith('@@')) {
      scan.hunkStart = i
      break
    }
    if (line.startsWith('new file mode')) scan.status = 'added'
    else if (line.startsWith('deleted file mode')) scan.status = 'deleted'
    else if (line.startsWith('rename from ')) {
      scan.status = 'renamed'
      scan.renamedFrom = sidePath(line.slice('rename from '.length))
    } else if (line.startsWith('rename to ')) scan.status = 'renamed'
    else if (line.startsWith('--- ')) scan.oldSide = sidePath(line.slice(4))
    else if (line.startsWith('+++ ')) scan.newSide = sidePath(line.slice(4))
    else if (line.startsWith('Binary files ')) scan.binary = true
  }
  return scan
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

interface HunkScan {
  lines: GitDiffPatchLine[]
  added: number
  removed: number
  total: number
}

// 줄번호는 hunk 머리말의 시작값에서 전진시킨다 — `unchanged` 는 두 축 모두, `removed` 는 old,
// `added` 는 new 만. 한 카운터로 합치면 삭제가 많은 파일에서 이후 번호가 실제와 어긋난다.
function scanHunks(lines: readonly string[], from: number, collect: boolean): HunkScan {
  const out: HunkScan = { lines: [], added: 0, removed: 0, total: 0 }
  let oldLine = 0
  let newLine = 0
  for (let i = from; i < lines.length; i += 1) {
    const line = lines[i]
    const header = HUNK_HEADER.exec(line)
    if (header) {
      oldLine = Number(header[1])
      newLine = Number(header[2])
      continue
    }
    // `\ No newline at end of file` 는 직전 줄의 성질이지 새 줄이 아니다.
    if (line.startsWith('\\')) continue
    const marker = line[0]
    if (marker === undefined) continue
    if (marker === '+') {
      out.added += 1
      out.total += 1
      if (collect) out.lines.push({ type: 'added', oldLine: null, newLine, text: line.slice(1) })
      newLine += 1
    } else if (marker === '-') {
      out.removed += 1
      out.total += 1
      if (collect) out.lines.push({ type: 'removed', oldLine, newLine: null, text: line.slice(1) })
      oldLine += 1
    } else if (marker === ' ') {
      out.total += 1
      if (collect) out.lines.push({ type: 'unchanged', oldLine, newLine, text: line.slice(1) })
      oldLine += 1
      newLine += 1
    }
  }
  return out
}

export function parseUnifiedPatch(out: string): {
  files: GitDiffPatchFile[]
  filesTruncated: boolean
} {
  const files: GitDiffPatchFile[] = []
  let totalLines = 0
  for (const block of splitBlocks(out)) {
    const header = headerPaths(block.header)
    const scan = scanMeta(block.lines)
    const path =
      scan.newSide && scan.newSide !== '/dev/null'
        ? scan.newSide
        : scan.oldSide && scan.oldSide !== '/dev/null'
          ? scan.oldSide
          : (header?.newPath ?? header?.oldPath ?? '')
    if (path.length === 0) continue
    if (scan.oldSide === '/dev/null') scan.status = 'added'
    if (scan.newSide === '/dev/null') scan.status = 'deleted'

    // 먼저 **세기만** 한다 — 상한을 넘는 파일도 `+N −M` 은 맞아야 하고, 그래야 헤더가
    // "변경이 없다" 와 "줄을 싣지 않았다" 를 구분할 수 있다(D-077).
    const counted = scanHunks(block.lines, scan.hunkStart, false)
    const overFile = counted.total > MAX_PATCH_FILE_LINES
    const overTotal = totalLines + counted.total > MAX_PATCH_TOTAL_LINES
    const collect = !scan.binary && !overFile && !overTotal
    const body = collect ? scanHunks(block.lines, scan.hunkStart, true) : counted
    if (collect) totalLines += counted.total

    files.push({
      path,
      ...(scan.renamedFrom ? { oldPath: scan.renamedFrom } : {}),
      status: scan.status,
      added: scan.binary ? 0 : counted.added,
      removed: scan.binary ? 0 : counted.removed,
      kind: scan.binary ? 'binary' : collect ? 'text' : 'too-large',
      lines: collect ? body.lines : []
    })
  }
  return {
    files: files.slice(0, MAX_DIFF_FILES),
    filesTruncated: files.length > MAX_DIFF_FILES
  }
}
