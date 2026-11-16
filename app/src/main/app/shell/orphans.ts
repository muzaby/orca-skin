// 죽은 에이전트 호스트가 남긴 프로세스의 선별 (0324 EP-12 · MD-07 · B9).
//
// 호스트가 비정상 종료하면 그 호스트가 띄운 하네스·도구 프로세스가 부모 없이 남는다. 선별 기준은
// "부모 pid = 죽은 호스트 pid" 하나다 — 손자는 그 자식을 끝낼 때 OS 의 트리 종료에 맡긴다.
// 프로세스 목록과 종료는 주입받는다(실제 구현은 감독자가 넘긴다).

export interface ProcessInfo {
  readonly pid: number
  readonly parentPid: number
}

// 죽은 호스트를 부모로 둔 프로세스의 pid. 호스트 자신과 0 이하의 pid 는 대상이 아니다.
export function selectOrphans(processes: readonly ProcessInfo[], deadHostPid: number): number[] {
  if (!Number.isInteger(deadHostPid) || deadHostPid <= 0) return []
  const selected = new Set<number>()
  for (const process of processes) {
    if (process.parentPid !== deadHostPid) continue
    if (process.pid === deadHostPid || process.pid <= 0) continue
    selected.add(process.pid)
  }
  return [...selected]
}

export interface OrphanReaperDeps {
  listProcesses(): Promise<readonly ProcessInfo[]>
  // 프로세스 하나를 그 자식까지 끝낸다. 이미 없는 프로세스면 던져도 된다.
  killTree(pid: number): Promise<void>
  onError(stage: 'list' | 'kill', error: unknown, pid?: number): void
}

// 죽은 호스트의 자식을 한 번 훑어 끝낸다. 목록을 못 얻거나 일부를 못 끝내도 던지지 않는다 —
// 호출자(호스트 종료 처리)는 뒤이어 창에 알리고 상태를 비워야 한다. 반환값은 끝낸 pid 다.
export async function reapOrphans(deps: OrphanReaperDeps, deadHostPid: number): Promise<number[]> {
  let processes: readonly ProcessInfo[]
  try {
    processes = await deps.listProcesses()
  } catch (error) {
    deps.onError('list', error)
    return []
  }
  const killed: number[] = []
  for (const pid of selectOrphans(processes, deadHostPid)) {
    try {
      await deps.killTree(pid)
      killed.push(pid)
    } catch (error) {
      deps.onError('kill', error, pid)
    }
  }
  return killed
}
