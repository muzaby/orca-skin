// 프로세스 목록 출력의 해석 (0324 EP-12 · MD-07). `shell-runner.ts` 의 `listProcesses` 가 OS 명령의
// 출력을 넘긴다 — POSIX `ps -A -o pid=,ppid=` 와 Windows 의 같은 모양 출력("pid 부모pid" 한 줄씩).
// 이 파일은 프로세스를 띄우지 않는다.

export interface ProcessRow {
  readonly pid: number
  readonly parentPid: number
}

// 숫자 두 개로 된 줄만 받는다 — 머리글·빈 줄·잘린 줄은 버린다.
export function parseProcessTable(output: string): ProcessRow[] {
  const rows: ProcessRow[] = []
  // CRLF 의 `\r` 은 줄 끝 `\s*` 가 받는다.
  for (const line of output.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s*$/.exec(line)
    if (!match) continue
    rows.push({ pid: Number(match[1]), parentPid: Number(match[2]) })
  }
  return rows
}

// 그 플랫폼에서 "pid 부모pid" 줄을 내는 명령(`shellInvocation` 이 감싼다).
export function processTableCommand(platform: NodeJS.Platform): string {
  return platform === 'win32'
    ? 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }'
    : 'ps -A -o pid=,ppid='
}
