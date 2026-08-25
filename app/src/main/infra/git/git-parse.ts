// git CLI stdout 파서 — **순수 함수만**. 실행(execFile)은 `git-cli.ts` 가 갖는다.
// 나누는 이유: 실행부는 프로세스 스폰이라 단위 테스트가 무겁지만, 회귀가 나는 곳은
// 언제나 출력 형식 해석 쪽이다.

import type { GitDirtyStat } from '../../../shared/ipc'

// `git diff HEAD --shortstat` 한 줄. 변경이 없으면 빈 문자열이 온다.
//   " 8 files changed, 104 insertions(+), 2 deletions(-)"
// insertions/deletions 는 한쪽만 있을 수 있다(삽입만·삭제만).
export function parseShortstat(out: string): GitDirtyStat | null {
  const files = /(\d+) files? changed/.exec(out)
  if (!files) return null
  const insertions = /(\d+) insertions?\(\+\)/.exec(out)
  const deletions = /(\d+) deletions?\(-\)/.exec(out)
  return {
    files: Number(files[1]),
    insertions: insertions ? Number(insertions[1]) : 0,
    deletions: deletions ? Number(deletions[1]) : 0
  }
}

// `git for-each-ref --format=%(refname:short) refs/heads/` 출력 → 로컬 브랜치 목록.
// 현재 브랜치를 맨 앞에 고정하고 나머지는 이름순 — 팝업이 "지금 어디인가" 를 먼저 보여준다.
export function parseBranchList(out: string, current: string | null): string[] {
  const names = out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const rest = names.filter((name) => name !== current).sort((a, b) => a.localeCompare(b))
  return current != null && names.includes(current) ? [current, ...rest] : rest
}

// git 이 stderr 로 뱉는 안내를 한 줄로 접는다 — 모달/토스트에 그대로 실린다.
// 빈 출력이면 호출자가 대체 문구를 쓰도록 빈 문자열을 돌려준다.
export function firstErrorLine(stderr: string): string {
  const line = stderr
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('hint:'))
  return line ?? ''
}
