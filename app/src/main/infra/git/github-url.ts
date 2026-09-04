// 로컬 Git 원격 문자열을 브라우저용 GitHub 주소로 투영한다.
// raw 원격에는 자격증명이 있을 수 있으므로 renderer에는 정규화 결과만 보낸다.
export function githubRepositoryUrl(remote: string): string | null {
  const value = remote.trim()
  if (!value || /\s/.test(value)) return null
  const scp = /^(?:[^@/:]+@)?github\.com:(.+)$/i.exec(value)
  let path: string
  if (scp) {
    path = scp[1]!
  } else {
    let url: URL
    try {
      url = new URL(value)
    } catch {
      return null
    }
    if (url.hostname.toLowerCase() !== 'github.com') return null
    if (url.protocol === 'https:') {
      if (url.port !== '') return null
    } else if (url.protocol === 'ssh:') {
      if (url.port !== '' && url.port !== '22') return null
    } else {
      return null
    }
    path = url.pathname.slice(1)
  }
  const parts = path
    .replace(/\/$/, '')
    .replace(/\.git$/, '')
    .split('/')
  if (
    parts.length !== 2 ||
    parts.some((part) => !/^[a-zA-Z0-9_.-]+$/.test(part) || part === '.' || part === '..')
  )
    return null
  return `https://github.com/${parts.join('/')}`
}
