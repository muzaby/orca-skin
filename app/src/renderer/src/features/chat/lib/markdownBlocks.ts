// 스트리밍 마크다운 소스를 "확정(stable) 블록들 + 꼬리(tail)"로 분할하는 순수 헬퍼.
// StreamingMarkdown 이 확정 블록을 memo 된 <Markdown> 으로 고정해 매 델타의 unified
// 재파스를 꼬리 블록으로 한정한다 (0008 — 프레임당 파싱 O(전문) → O(꼬리)).
//
// 분할 경계는 보수적으로 고른다 — 라이브 렌더가 최종(단일 파스) 렌더와 달라질 수 있는
// 지점은 자르지 않는다:
//   · 펜스 코드블록 내부의 빈 줄 (펜스 미닫힘 포함)
//   · loose list 의 항목 사이 빈 줄 (쪼개면 ol 번호 리셋/margin 중복)
//   · 들여쓰기 코드블록 앞 (쪼개면 별도 <pre> 로 갈라짐)
//   · 경계 뒤에 "완결된 비공백 줄" 이 아직 없는 지점 (다음 줄 성격을 모르면 미확정)
// 소스는 append-only 이므로 한 번 확정된 경계는 이후 입력으로 뒤집히지 않는다 —
// 확정 블록 문자열이 불변 → <Markdown source> shallow memo 가 영구 적중한다.

export interface StableBlocks {
  stable: string[]
  tail: string
}

// 리스트 항목 시작( -·*·+ 또는 1. / 1) ) — CommonMark 의 0~3칸 들여쓰기 허용.
const LIST_ITEM_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s/
// 들여쓰기 코드블록(4칸+ 또는 탭) 시작.
const INDENTED_RE = /^(?: {4,}|\t)/
// 펜스 열림/닫힘 후보 (``` 또는 ~~~, 0~3칸 들여쓰기).
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/

const isBlank = (line: string): boolean => line.trim() === ''

export function splitStableBlocks(source: string): StableBlocks {
  const lines = source.split('\n')
  // 마지막 요소는 '\n' 미종결(스트리밍 중 미완) 줄 — 경계 판단의 "다음 줄"로 쓰지 않는다.
  const lastComplete = lines.length - 1

  const stable: string[] = []
  let blockStart = 0
  let fence: string | null = null // 열린 펜스의 마커 문자열 (닫힘 매칭용)

  for (let i = 0; i < lastComplete; i++) {
    const line = lines[i]

    if (fence !== null) {
      // 닫힘: 같은 문자, 같은 길이 이상의 펜스 줄.
      const m = FENCE_RE.exec(line)
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null
      continue
    }
    const open = FENCE_RE.exec(line)
    if (open) {
      fence = open[1]
      continue
    }

    if (!isBlank(line)) continue

    // 빈 줄(펜스 밖) — 분할 후보. 빈 줄 런의 첫 줄에서만 평가한다.
    if (i === blockStart || isBlank(lines[i - 1])) continue
    const prev = lines[i - 1]

    // 다음 "완결된 비공백 줄" 탐색 — 없으면(꼬리가 아직 안 자람) 미확정.
    let j = i + 1
    while (j < lastComplete && isBlank(lines[j])) j++
    if (j >= lastComplete) continue
    const next = lines[j]

    // loose list / 들여쓰기 코드 보호.
    if (LIST_ITEM_RE.test(prev) || LIST_ITEM_RE.test(next)) continue
    if (INDENTED_RE.test(prev) || INDENTED_RE.test(next)) continue

    stable.push(lines.slice(blockStart, i).join('\n'))
    blockStart = j
    i = j - 1 // 다음 루프에서 next 줄부터 재개
  }

  return { stable, tail: lines.slice(blockStart).join('\n') }
}

// 증분 분할 캐시(0108) — 스트리밍은 append-only 라 확정된 prefix 는 다시 스캔할 필요가
// 없다. consumed = source 안에서 tail 이 시작하는 오프셋. 안전 근거: 분할 경계는 항상
// 펜스 밖 빈 줄에서만 확정되므로 tail 시작점의 스캐너 상태는 fence=null — suffix 만 새로
// 스캔해도 전체 스캔과 결과가 동치다(동치 property 테스트로 고정).
export interface StableBlocksCache {
  source: string
  consumed: number
  stable: string[]
}

export interface AdvanceResult extends StableBlocks {
  cache: StableBlocksCache
}

export function advanceStableBlocks(
  cache: StableBlocksCache | null,
  source: string
): AdvanceResult {
  // append 가 아니면(메시지 교체·수축) 전체 재계산으로 폴백 — startsWith 는 네이티브
  // prefix 비교라 split+정규식 스캔보다 훨씬 싸다.
  if (cache !== null && source.startsWith(cache.source)) {
    const suffix = source.slice(cache.consumed)
    const next = splitStableBlocks(suffix)
    const stable = next.stable.length > 0 ? [...cache.stable, ...next.stable] : cache.stable
    const consumed = cache.consumed + (suffix.length - next.tail.length)
    return { stable, tail: next.tail, cache: { source, consumed, stable } }
  }
  const full = splitStableBlocks(source)
  return {
    stable: full.stable,
    tail: full.tail,
    cache: { source, consumed: source.length - full.tail.length, stable: full.stable }
  }
}
