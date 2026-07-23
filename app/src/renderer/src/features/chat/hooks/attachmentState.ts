// 비동기 submit은 전송 시점의 배열 identity를 optimistic concurrency token으로 쓴다.
// current가 그대로일 때만 새 빈 배열을 반환해 이후 ref/state가 같은 token으로 이동하게 한다.
export function clearAttachmentsIfUnchanged<T>(current: T[], expected: T[]): T[] | null {
  return current === expected ? [] : null
}
