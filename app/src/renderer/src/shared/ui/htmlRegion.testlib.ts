// SSR 산출에서 **영역 소속**을 판정한다 — 렌더 테스트 전용 헬퍼.
//
// 문서 순서(`html.indexOf(a) < html.indexOf(b)`)는 "b 가 a 뒤에 있다" 만 말하고 "b 가 a 밖에
// 있다" 를 말하지 못한다. 두 판정은 다른 축이라, 별도 블록이어야 할 요소를 상대 요소 **안으로**
// 옮긴 변이는 순서 단언을 그대로 통과한다. 영역 주장은 중첩으로 잰다.
//
// `renderToStaticMarkup` 산출은 항상 균형 잡힌 태그이고 void 요소는 자기 자신을 닫으므로
// 같은 태그 이름의 깊이 계수로 outerHTML 경계를 정확히 찾는다.

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr'
])

/** `marker`(속성 문자열)를 가진 요소의 outerHTML. 없으면 던진다 — 빈 대상 집합은 스윕이 아니다. */
export function outerHtmlOf(html: string, marker: string): string {
  const at = html.indexOf(marker)
  if (at < 0) throw new Error(`marker not found: ${marker}`)
  const open = html.lastIndexOf('<', at)
  const tag = /^<([a-zA-Z][a-zA-Z0-9]*)/.exec(html.slice(open))?.[1]
  if (!tag) throw new Error(`no tag for marker: ${marker}`)
  if (VOID_TAGS.has(tag.toLowerCase())) {
    return html.slice(open, html.indexOf('>', open) + 1)
  }

  const openRe = new RegExp(`<${tag}[\\s/>]`, 'gi')
  const closeTag = `</${tag}>`
  let depth = 0
  let cursor = open
  for (;;) {
    openRe.lastIndex = cursor
    const nextOpen = openRe.exec(html)
    const nextClose = html.indexOf(closeTag, cursor)
    if (nextClose < 0) throw new Error(`unbalanced <${tag}> for marker: ${marker}`)
    if (nextOpen && nextOpen.index < nextClose) {
      depth += 1
      cursor = nextOpen.index + 1
      continue
    }
    depth -= 1
    cursor = nextClose + closeTag.length
    if (depth === 0) return html.slice(open, cursor)
  }
}

/** `outer` 마커 요소가 `inner` 마커를 자기 안에 담고 있는가. */
export function regionContains(html: string, outer: string, inner: string): boolean {
  return outerHtmlOf(html, outer).includes(inner)
}
