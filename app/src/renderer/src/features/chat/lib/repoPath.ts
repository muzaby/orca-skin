// 저장소 상대 경로를 절대 경로로 (0211 ΔV5 D-108).
//
// git 은 경로를 항상 `/` 로 준다. cwd 는 OS 형식(Windows 면 `\`)이라 둘을 그대로 이으면
// 구분자가 섞이는데, main 이 `path.resolve` 로 정규화하므로 그것이 문제가 되지 않는다 —
// renderer 에 `node:path` 를 들이지 않기 위해 여기서는 **잇기만** 한다.
//
// 이미 절대 경로면 그대로 둔다. 꼬리 구분자는 하나로 접는다.
export function joinRepoPath(cwd: string, relativePath: string): string {
  if (relativePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(relativePath)) return relativePath
  return `${cwd.replace(/[\\/]+$/, '')}/${relativePath}`
}
