// textarea 의 native scroll 좌표를 decoration projection 에 그대로 투영한다.
// (-0 은 템플릿 보간에서 "0" 으로 직렬화되므로 별도 정규화가 필요 없다.)
export function composerDecorationTransform(scrollLeft: number, scrollTop: number): string {
  return `translate3d(${-scrollLeft}px, ${-scrollTop}px, 0)`
}
