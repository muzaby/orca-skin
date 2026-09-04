export function githubBranchUrl(githubUrl: string | null, branch: string | null): string | null {
  if (!githubUrl || !branch) return null
  return `${githubUrl}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`
}

// Disabled actions remain visible with their reason, but keyboard navigation skips them.
export function moveGitMenuFocus(menu: HTMLElement, key: string): boolean {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return false
  const items = Array.from(
    menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
  )
  if (items.length === 0) return true
  const current = items.findIndex((item) => item === menu.ownerDocument.activeElement)
  const next =
    key === 'Home'
      ? 0
      : key === 'End'
        ? items.length - 1
        : current < 0
          ? key === 'ArrowUp'
            ? items.length - 1
            : 0
          : (current + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  items[next].focus()
  return true
}
