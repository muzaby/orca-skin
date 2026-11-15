// 프로젝트 메뉴의 행과 검색 — 컴포저 프로젝트 버튼과 세션 밖 프로젝트 칩이 함께 쓴다.

export interface ProjectMenuItem {
  id: string
  name: string
  cwd: string | null
}
// 이름이나 경로에 검색어가 들어간 프로젝트.
export function filterProjectMenuItems<T extends ProjectMenuItem>(
  items: readonly T[],
  query: string
): T[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return [...items]
  return items.filter(
    (item) =>
      item.name.toLocaleLowerCase().includes(needle) ||
      (item.cwd?.toLocaleLowerCase().includes(needle) ?? false)
  )
}
