// 절대 경로 판정 — `extraDirs`(컴포저 참조 경로) 검증의 SSOT.
//
// **`path.isAbsolute` 를 쓰지 않는다.** 그 함수는 *실행 중인* 플랫폼의 규칙만 본다 — Linux
// 러너에서 `C:\work` 가 상대경로로 판정되고, Windows 에서 `/srv/x` 가 절대로 판정된다. 같은
// 규칙이 IPC 스키마(검증 시점)와 workspace 가드(루트 해석 시점) 양쪽에서 성립해야 하므로
// 플랫폼과 무관한 순수 판정을 여기 한 곳에 둔다.
//
// 이 값이 느슨하면 0075 workspace 격리가 무력화된다: 상대경로는 main 프로세스의 cwd 기준으로
// 풀려 사용자가 의도하지 않은 폴더가 read/write 루트로 올라간다.

// POSIX `/x` · Windows 드라이브 `C:\x`·`C:/x` · UNC `\\server\share`.
const UNC_ROOT = /^\\\\[^\\/]+[\\/][^\\/]+/
const DRIVE_ROOT = /^[A-Za-z]:[\\/]/
const POSIX_ROOT = /^\//

const SEPARATOR = /[\\/]/

// 루트의 길이 = **뒤따르는 구분자까지**. UNC(`\\\\server\\share`)는 매치가 구분자 앞에서
// 끝나므로 그것을 함께 먹지 않으면 나머지가 구분자로 시작해 첫 세그먼트가 늘 비어 보인다.
function rootLength(value: string): number {
  const unc = UNC_ROOT.exec(value)
  if (unc) {
    const end = unc[0].length
    return SEPARATOR.test(value[end] ?? '') ? end + 1 : end
  }
  if (DRIVE_ROOT.test(value)) return 3
  if (POSIX_ROOT.test(value)) return 1
  return 0
}

// 루트 뒤에 **빈 세그먼트**(`/a//b`)가 있으면 거부한다. 맨 끝의 구분자 하나(`/a/`)는 같은
// 디렉토리를 가리키는 흔한 표기라 허용한다.
function hasEmptySegment(rest: string): boolean {
  if (rest.length === 0) return false
  const segments = rest.split(SEPARATOR)
  if (segments[segments.length - 1] === '') segments.pop()
  return segments.some((segment) => segment.length === 0)
}

export function isAbsolutePath(value: string): boolean {
  if (value.includes('\0')) return false
  const root = rootLength(value)
  if (root === 0) return false
  return !hasEmptySegment(value.slice(root))
}

// 파일시스템 루트인가 — `/` · `C:\` · `\\server\share` (뒤 구분자 포함/미포함 모두).
//
// **루트를 `extraDirs` 로 받으면 0075 가드가 no-op 이 된다** (D-019): writeRoots 에 모든 경로의
// 조상이 오르면 가드가 "밖" 이라고 판정할 대상이 남지 않는다. 실측 —
// `resolveGuardRoots('/tmp/ws', ['/']).writeRoots[1] === '/'`.
//
// **이 판정은 텍스트 층이다.** `/.` · `/a/..` 처럼 정규화해야만 루트로 드러나는 별칭은 여기서
// 잡히지 않는다 — 그것은 `path.resolve` 를 이미 하는 `resolveGuardRoots` 가 정규화 **후** 이
// 함수를 다시 불러 잡는다. 두 층은 중복이 아니라 역할이 다르다: 앞 층은 사용자에게 즉시
// 말하고(칩 추가 거부), 뒤 층은 무엇이 통과했든 가드를 지킨다.
export function isFilesystemRoot(value: string): boolean {
  if (!isAbsolutePath(value)) return false
  return value.slice(rootLength(value)).length === 0
}
