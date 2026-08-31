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

/** 파일 본문 한 측(old 또는 new)의 최대 바이트. 넘으면 본문 대신 `too-large` 를 돌려준다. */
export const MAX_DIFF_FILE_BYTES = 1024 * 1024

// `git log --format=%H%x1f%s%x1f%an%x1f%ct%x1e` 출력.
//
// **구분자를 `\x1f`(unit separator)·`\x1e`(record separator)로 쓰는 이유**: 커밋 제목과 작성자
// 이름에는 무엇이든 들어갈 수 있다. 탭·파이프·개행을 구분자로 쓰면 그것을 담은 제목 하나가
// 목록 전체를 어긋나게 한다. 두 문자는 git ref/제목에 실질적으로 등장하지 않는다.
export function parseCommitLog(out: string): { commits: GitDiffCommit[]; truncated: boolean } {
  const records = out
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter((r) => r.length > 0)
  const commits: GitDiffCommit[] = []
  for (const record of records) {
    const [sha, subject, author, committed] = record.split('\x1f')
    if (!sha || committed === undefined) continue
    const seconds = Number(committed)
    if (!Number.isFinite(seconds)) continue
    commits.push({
      sha,
      subject: subject ?? '',
      author: author ?? '',
      // git 은 초, 화면은 ms 를 쓴다.
      committedAt: seconds * 1000
    })
  }
  return {
    commits: commits.slice(0, MAX_DIFF_COMMITS),
    truncated: commits.length > MAX_DIFF_COMMITS
  }
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

// `git ls-files --others --exclude-standard -z` 출력 → 미추적 경로 목록.
//
// 미추적 파일도 "브랜치에서 작업된 내용"이다(0211 D-011) — 에이전트가 만든 새 파일은 커밋
// 전까지 untracked 라, 빼면 목록이 조용히 빈다. `--exclude-standard` 가 `.gitignore` 를
// 존중하므로 `node_modules` 류는 들어오지 않는다.
export function parseNulPaths(out: string): string[] {
  return out.split('\0').filter((p) => p.length > 0)
}

// 추적 변경 + 미추적을 한 목록으로 접고 상한을 적용한다.
//
// **경로로 중복을 제거한다**: `git add` 된 새 파일은 numstat 에도 나오고, 그 사이 상태가
// 바뀌면 ls-files 에도 나올 수 있다. numstat 쪽이 실제 줄 수를 가지므로 그쪽을 남긴다.
// **미추적 항목은 경로만 받는다**(0211 D-026): 수치가 0 이라 줄을 셀 이유가 없고, 세지
// 않으므로 요약이 파일 내용을 읽지 않는다. `binary` 는 요약 시점에 판정하지 않는다 —
// 정본은 본문 조회의 NUL 검사이고 여기 값은 수치 표시에 쓰이지 않는다.
//
// **합계는 `slice` 앞에서 센다**: 목록은 200개에서 잘려도 합계는 저장소의 실제 변경량이다.
export function mergeDiffEntries(
  tracked: readonly GitDiffFileEntry[],
  untracked: readonly { path: string }[]
): { files: GitDiffFileEntry[]; truncated: boolean; totals: GitDiffTotals } {
  const seen = new Set(tracked.map((entry) => entry.path))
  const merged: GitDiffFileEntry[] = [...tracked]
  for (const item of untracked) {
    if (seen.has(item.path)) continue
    seen.add(item.path)
    merged.push({ path: item.path, status: 'added', added: 0, removed: 0, binary: false })
  }
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
