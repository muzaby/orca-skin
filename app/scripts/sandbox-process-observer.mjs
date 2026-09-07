// Read-only Windows process identity observation; never request PROCESS_TERMINATE for a liveness check.
import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const maxPids = 16

/** @typedef {{ pid: number, createdAt: string }} ProcessSnapshot */

// PID values enter as JSON data, not interpolated PowerShell source. Output is deliberately narrow.
const command = `
$ErrorActionPreference = 'Stop'
$ids = ConvertFrom-Json -InputObject $env:ORCA_SMOKE_PROCESS_IDS
if ($ids.Count -lt 1 -or $ids.Count -gt 16) { throw 'invalid_ids' }
foreach ($id in $ids) {
  if (($id -isnot [int] -and $id -isnot [long]) -or $id -le 0 -or $id -gt 4294967295) { throw 'invalid_ids' }
}
$filter = ($ids | ForEach-Object { 'ProcessId = ' + $_.ToString([Globalization.CultureInfo]::InvariantCulture) }) -join ' OR '
$rows = @(Get-CimInstance -ClassName Win32_Process -Filter $filter | ForEach-Object {
  if ($null -eq $_.CreationDate) { throw 'missing_creation_date' }
  [pscustomobject]@{
    pid = [long]$_.ProcessId
    createdAt = $_.CreationDate.ToUniversalTime().Ticks.ToString([Globalization.CultureInfo]::InvariantCulture)
  }
})
ConvertTo-Json -InputObject $rows -Compress
`

/**
 * @param {number[]} pids Positive, distinct Windows PIDs; never the observer's own process.
 * @returns {Promise<ProcessSnapshot[]>} Only currently observed requested identities; absence is explicit.
 */
export async function observeSmokeProcesses(pids) {
  if (
    !Array.isArray(pids) ||
    pids.length > maxPids ||
    new Set(pids).size !== pids.length ||
    pids.some(
      (pid) => !Number.isInteger(pid) || pid <= 0 || pid > 0xffffffff || pid === process.pid
    )
  ) {
    throw new Error('INVALID_PROCESS_IDS')
  }
  if (pids.length === 0) return []
  try {
    if (process.platform !== 'win32') throw new Error('unsupported_platform')
    const shell = path.join(
      process.env.SystemRoot ?? 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    )
    if (!path.isAbsolute(shell)) throw new Error('invalid_shell_path')
    const { stdout } = await execFileAsync(
      shell,
      ['-NoProfile', '-NonInteractive', '-Command', command],
      {
        env: {
          ...process.env,
          PSModulePath: path.join(path.dirname(shell), 'Modules'),
          ORCA_SMOKE_PROCESS_IDS: JSON.stringify(pids)
        },
        windowsHide: true,
        timeout: 5000,
        maxBuffer: 64 * 1024
      }
    )
    const rows = JSON.parse(stdout.replace(/^\uFEFF/, '').trim())
    if (
      !Array.isArray(rows) ||
      rows.length > pids.length ||
      new Set(rows.map((row) => row?.pid)).size !== rows.length ||
      rows.some(
        (row) =>
          !row ||
          !pids.includes(row.pid) ||
          typeof row.createdAt !== 'string' ||
          !/^\d{17,19}$/.test(row.createdAt) ||
          Object.keys(row).sort().join(',') !== 'createdAt,pid'
      )
    ) {
      throw new Error('invalid_observation')
    }
    return rows.sort((left, right) => left.pid - right.pid)
  } catch {
    // Never expose command output, machine metadata, or inherited environment through an error.
    throw new Error('PROCESS_OBSERVATION_FAILED')
  }
}

/** @param {ProcessSnapshot} before @param {readonly ProcessSnapshot[]} after */
export function processSnapshotIsAlive(before, after) {
  return after.some((row) => row.pid === before.pid && row.createdAt === before.createdAt)
}
