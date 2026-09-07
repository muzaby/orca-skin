// 실-git 스위트 공용 정리 픽스처 — **지우기 전에 고아 git 자식을 먼저 처리한다**.
//
// 케이스가 파일 예산을 넘겨 끊기면 vitest 는 그 케이스의 promise 를 버리지만, 그때 떠 있던
// git 자식은 계속 돈다. 그 자식이 임시 저장소에 핸들을 쥔 채 `afterEach` 의 `rm` 이 돌면
// windows 가 EBUSY/EPERM 을 던지고, 케이스 하나의 초과가 스위트 전체의 실패로 번진다.
// 0218 러너의 12건이 전부 이 연쇄였다 — 기능 결함은 0건이었다.
//
// 고아의 출처가 둘이라 두 겹으로 막는다.
//
// ① **테스트가 띄운 자식은 죽인다.** 픽스처 준비용 `execFile('git', …)` 에는 timeout 이 없어
//    버려진 뒤에도 스스로 끝날 때까지 남는다. `execGit` 을 지난 자식은 아래 집합에 들어가고,
//    정리 훅이 `rm` 앞에서 kill 하고 종료를 기다린다.
//
// ② **프로덕션이 띄운 자식은 기다린다.** `runGit` 은 이 모듈을 지나지 않아 추적할 수 없다.
//    Node 의 `rm` 은 EBUSY·EPERM·ENOTEMPTY 를 만나면 `retryDelay` 를 한 번에 그만큼씩 늘려
//    가며 재시도하므로, 짧은 git 명령이 스스로 끝나는 동안 정리를 미룬다. 즉시 한 번 던지고
//    끝나던 자리를 "잠시 기다렸다가 지운다" 로 바꾸는 것이 여기서 하는 일의 전부다.

import { execFile, type ChildProcess, type ExecFileOptions } from 'node:child_process'
import { rm } from 'node:fs/promises'

/** 아직 끝나지 않은 추적 자식. 케이스가 끊겨도 여기 남아 정리 훅이 찾을 수 있다. */
const running = new Set<ChildProcess>()

/** 종료를 기다리는 상한. 안 죽는 자식에 매달려 정리 전체를 막지 않는다. */
const KILL_GRACE_MS = 5_000

/** `rm` 재시도 — 200·400·…·2000ms 로 늘어 총 11초. 짧은 git 명령이 끝나기엔 충분하다. */
const RM_RETRY = { maxRetries: 10, retryDelay: 200 } as const

/**
 * `promisify(execFile)` 과 **같은 모양**이다 — 호출부는 그대로 두고 추적만 얹는다.
 * 시그니처를 맞춘 이유가 그것이다: 스위트마다 다른 래퍼를 만들면 새 스위트가 조용히
 * 추적 밖으로 샌다.
 */
export function execGit(
  file: string,
  args: readonly string[],
  options: ExecFileOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(file, [...args], options, (error, stdout, stderr) => {
      running.delete(child)
      if (error) reject(error)
      else resolve({ stdout: String(stdout), stderr: String(stderr) })
    })
    running.add(child)
  })
}

/** 살아 있는 추적 자식을 죽이고 종료까지 기다린다. */
export async function killTrackedGit(): Promise<void> {
  const children = [...running]
  running.clear()
  await Promise.all(
    children.map(
      (child) =>
        new Promise<void>((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) {
            resolve()
            return
          }
          const timer = setTimeout(resolve, KILL_GRACE_MS)
          // `unref` 가 없으면 이 타이머 하나가 워커 종료를 상한만큼 붙든다.
          timer.unref()
          child.once('close', () => {
            clearTimeout(timer)
            resolve()
          })
          child.kill()
        })
    )
  )
}

/**
 * 임시 루트를 지운다. **정리 훅은 이것만 부른다** — `rm` 을 직접 부르면 ①②가 빠진다.
 * 존재하지 않는 경로는 `force` 가 삼키므로 호출부가 미리 거를 필요가 없다.
 */
export async function removeTempRoots(roots: readonly string[]): Promise<void> {
  if (roots.length === 0) return
  await killTrackedGit()
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true, ...RM_RETRY })))
}
