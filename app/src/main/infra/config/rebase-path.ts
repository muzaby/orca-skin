// 저장된 절대경로의 루트 접두 교체 (handoff 0225). 이관이 디렉토리를 옮긴 뒤, DB 에 스냅샷으로
// 남은 절대경로를 새 루트 아래로 옮겨 적는 **순수 술어**다 — fs·electron·DB 를 모르므로 단위
// 테스트로 경계 규칙을 직접 관측할 수 있다.
//
// 경계는 **세그먼트 단위**로 본다. 문자열 `startsWith` 로 판정하면 `/a/orca-x` 가 `/a/orca` 의
// 하위로 잡혀 남의 경로를 건드린다(§10 EP-09).
//
// 구분자는 `/` 와 `\` 를 **둘 다** 세그먼트 경계로 취급한다. 저장값과 루트가 같은 OS 에서
// 만들어지므로 대소문자는 그대로 비교한다(Windows 의 대소문자 무시에 기대지 않는다).

function stripTrailingSeparators(value: string): string {
  return value.replace(/[\\/]+$/, '')
}

function segments(value: string): string[] {
  return stripTrailingSeparators(value).split(/[\\/]/)
}

function separatorOf(root: string): string {
  return root.includes('\\') ? '\\' : '/'
}

/**
 * `target` 이 `oldRoot` 자신이거나 그 하위면 `newRoot` 아래의 같은 상대 위치를 돌려주고,
 * 아니면 `null` 을 돌려준다. 꼬리 세그먼트는 원문 그대로 보존하고 이어붙일 구분자는
 * `newRoot` 의 것을 쓴다.
 */
export function rebaseUnderRoot(target: string, oldRoot: string, newRoot: string): string | null {
  if (target === '' || oldRoot === '') return null
  const oldSegments = segments(oldRoot)
  const targetSegments = segments(target)
  if (targetSegments.length < oldSegments.length) return null
  for (let index = 0; index < oldSegments.length; index += 1) {
    if (targetSegments[index] !== oldSegments[index]) return null
  }
  const tail = targetSegments.slice(oldSegments.length)
  const base = stripTrailingSeparators(newRoot)
  return tail.length === 0 ? base : base + separatorOf(newRoot) + tail.join(separatorOf(newRoot))
}
