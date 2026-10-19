/** Bound read-only metadata queries without interrupting the running agent. */
export async function resourceQuery<T>(read: () => Promise<T>, timeoutMs = 3000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve().then(read),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('하네스 목록 조회 시간이 초과되었습니다.')),
          timeoutMs
        )
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}
