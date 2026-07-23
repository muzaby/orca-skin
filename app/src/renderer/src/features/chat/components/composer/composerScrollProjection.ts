export function composerDecorationTransform(scrollLeft: number, scrollTop: number): string {
  const x = scrollLeft === 0 ? 0 : -scrollLeft
  const y = scrollTop === 0 ? 0 : -scrollTop
  return `translate3d(${x}px, ${y}px, 0)`
}
