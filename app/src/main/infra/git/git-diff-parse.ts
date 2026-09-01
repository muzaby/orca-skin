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
  GitDiffTotals
} from '../../../shared/ipc'

/** 요약 1회가 실을 수 있는 최대 파일 수. 넘으면 잘라내고 `filesTruncated` 를 세운다. */
export const MAX_DIFF_FILES = 200

/** 요약 1회가 실을 수 있는 최대 커밋 수. */
export const MAX_DIFF_COMMITS = 100

/** 커밋 노드 하나가 실을 수 있는 최대 파일 수. */
export const MAX_DIFF_COMMIT_FILES = 50

/** 파일 본문 한 측(old 또는 new)의 최대 바이트. 넘으면 본문 대신 `too-large` 를 돌려준다. */
export const MAX_DIFF_FILE_BYTES = 1024 * 1024

// `git log -z --format=%x00orca-commit%x00%H%x00%s%x00%an%x00%ct%x00%b%x00`
// 프레임. Git 커밋 메시지와 경로는 NUL을 담을 수 없으므로 제목·본문·개행·탭을
// 손실 없이 싣는다. `withFiles=true`는 같은 프레임 뒤의 raw 블록과 numstat
// 블록을 결합한다. false는 메타데이터 폴백이라 파일 값을 null로 낸다.
export function parseCommitLog(
  out: string,
  withFiles = false
): { commits: GitDiffCommit[]; truncated: boolean } {
  const records = out.split('\0orca-commit\0').slice(1)
  const commits: GitDiffCommit[] = []
  for (const record of records) {
    const tokens = record.split('\0')
    const [sha, subject, author, committed, body] = tokens
    if (!sha || committed === undefined) continue
    const seconds = Number(committed)
    if (!Number.isFinite(seconds)) continue
    const files = withFiles ? parseCommitFiles(tokens.slice(5)) : []
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

function parseCommitFiles(tokens: readonly string[]): GitDiffFileEntry[] {
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
export function mergeDiffEntries(
  tracked: readonly GitDiffFileEntry[]
): { files: GitDiffFileEntry[]; truncated: boolean; totals: GitDiffTotals } {
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
