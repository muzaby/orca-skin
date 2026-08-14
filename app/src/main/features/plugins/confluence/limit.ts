// 동시성 세마포어 (0160) — `p-limit` 대체.
//
// 필요한 것은 "동시에 N개까지" 하나뿐이라 의존성을 늘리지 않고 여기서 만든다(사용자 결정).
// 첨부가 수십 개인 페이지에서 전부 동시에 요청하면 사내 서버가 429/타임아웃을 낸다.

export type LimitedTask<T> = () => Promise<T>

export interface Limiter {
  <T>(task: LimitedTask<T>): Promise<T>
}

export function createLimiter(concurrency: number): Limiter {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`concurrency 는 1 이상의 정수여야 합니다: ${concurrency}`)
  }

  let active = 0
  const queue: Array<() => void> = []

  const release = (): void => {
    active -= 1
    // 큐가 비면 아무것도 깨우지 않는다. 다음 호출이 곧바로 슬롯을 가져간다.
    queue.shift()?.()
  }

  return async <T>(task: LimitedTask<T>): Promise<T> => {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve))
    }
    active += 1
    try {
      return await task()
    } finally {
      // 실패해도 슬롯을 반드시 돌려준다 — 하나가 던져서 나머지가 영영 대기하면 안 된다.
      release()
    }
  }
}

// 실패를 개별 결과로 담아 나머지를 계속 진행시킨다. 첨부 하나가 404 라고 페이지 전체를
// 실패시키지 않는 것이 이 함수의 존재 이유다.
export type SettledResult<T> = { ok: true; value: T } | { ok: false; error: Error }

export async function mapWithLimit<I, O>(
  items: readonly I[],
  concurrency: number,
  worker: (item: I, index: number) => Promise<O>
): Promise<Array<SettledResult<O>>> {
  const limit = createLimiter(concurrency)
  return Promise.all(
    items.map((item, index) =>
      limit(async (): Promise<SettledResult<O>> => {
        try {
          return { ok: true, value: await worker(item, index) }
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error : new Error(String(error)) }
        }
      })
    )
  )
}

// `mapWithLimit` 결과를 성공/실패로 가른다. 실패 모양은 호출자마다 다르므로(페이지는 pageId,
// 첨부는 파일명) 변환을 받는다 — 같은 forEach 를 두 번 쓰지 않기 위한 최소 공통분모다.
export function partitionSettled<T, F>(
  settled: ReadonlyArray<SettledResult<T>>,
  toFailure: (error: Error, index: number) => F
): { values: T[]; failures: F[] } {
  const values: T[] = []
  const failures: F[] = []
  settled.forEach((result, index) => {
    if (result.ok) values.push(result.value)
    else failures.push(toFailure(result.error, index))
  })
  return { values, failures }
}
