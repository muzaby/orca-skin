// 프로세스 목록 출력의 해석 (0324 EP-12 · MD-07).

import { describe, expect, it } from 'vitest'
import { parseProcessTable, processTableCommand } from './process-table'

describe('parseProcessTable', () => {
  it('"pid 부모pid" 줄을 읽는다 — 앞뒤 공백·CRLF 를 견딘다', () => {
    expect(parseProcessTable('    1     0\n  4200     1\r\n4301 4200  \n')).toEqual([
      { pid: 1, parentPid: 0 },
      { pid: 4200, parentPid: 1 },
      { pid: 4301, parentPid: 4200 }
    ])
  })

  it('숫자 두 개가 아닌 줄은 버린다', () => {
    expect(parseProcessTable('PID PPID\n\n12\n12 34 56\n-1 2\nab 3\n7 8')).toEqual([
      { pid: 7, parentPid: 8 }
    ])
  })
})

describe('processTableCommand', () => {
  it('플랫폼마다 "pid 부모pid" 를 내는 명령을 고른다', () => {
    expect(processTableCommand('linux')).toBe('ps -A -o pid=,ppid=')
    expect(processTableCommand('darwin')).toBe('ps -A -o pid=,ppid=')
    expect(processTableCommand('win32')).toBe(
      'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }'
    )
  })
})
