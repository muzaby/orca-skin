// 고른 파일 섹션을 화면 위쪽에 세운다 (0211 ΔV4 AT-50 · §10 EP-36 ②).

/** `revealFileSection` 이 실제로 쓰는 부분만. 좁게 잡아야 DOM 없이 double 을 세울 수 있다. */
export interface FileSectionTarget {
  scrollIntoView(options?: ScrollIntoViewOptions): void
}

export interface FileSectionOwner {
  querySelector(selectors: string): FileSectionTarget | null
}

/**
 * `owner` 안에서 `path` 의 섹션을 찾아 **위쪽에 맞춰** 이동한다. 찾으면 `true`.
 *
 * **`DiffReview.pickFile` 에서 떼어낸 이유**: SSR 렌더는 ref 를 채우지 않아, 컴포넌트 안에
 * 두면 "이동한다" 를 관측할 눈이 없다(r2 검증 D16 — 이 줄을 지워도 3,071 케이스가 전건
 * green 이었다). 소유자를 인자로 받으면 축이 둘로 갈려 각각 잠긴다 — 여기서 **선택자와
 * `scrollIntoView`** 를, 호출 쪽에서 **"고른 경로로 부른다"** 를.
 *
 * 경로에는 `/` 와 `.` 가 들어 있다. 선택자에 그대로 넣으면 자손·클래스 선택자로 읽히므로
 * `CSS.escape` 를 지난다 — `docs/a.md` 같은 흔한 경로가 곧바로 걸리는 자리다.
 */
export function revealFileSection(owner: FileSectionOwner | null, path: string): boolean {
  const target = owner?.querySelector(`[data-diff-file="${CSS.escape(path)}"]`) ?? null
  target?.scrollIntoView({ block: 'start' })
  return target !== null
}
