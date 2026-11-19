// 스트리밍 마크다운 소스를 "확정(stable) 블록들 + 꼬리(tail)"로 분할하는 순수 헬퍼.
// StreamingMarkdown 이 확정 블록을 memo 된 <Markdown> 으로 고정해 매 델타의 unified
// 재파스를 꼬리 블록으로 한정한다 (0008 — 프레임당 파싱 O(전문) → O(꼬리)).
// 0326 EP-19: 캐시에 스캐너 상태(scanState)를 유지해 delta 마다 새로 완결된 줄만
// 스캔하고(누적 스캔 문자 ≈ 입력 길이), 꼬리가 열린 펜스 하나뿐이면 remark 없이
// StreamingFence 로 직접 그릴 수 있도록 OpenFenceTail 을 돌려준다.

export interface StableBlocks {
  stable: string[]
  tail: string
}

export interface OpenFenceState {
  char: '`' | '~'
  length: number
  indent: number
  lang: string | undefined
  /** source 기준 펜스 본문 시작 오프셋 (여는 펜스 줄의 '\n' 바로 다음) */
  bodyStart: number
}

export interface OpenFenceTail {
  char: '`' | '~'
  length: number
  indent: number
  lang: string | undefined
  code: string
}

export interface MarkdownScanState {
  /** 현재 tail 이 시작하는 source 오프셋 (= consumed) */
  blockStart: number
  /** 마지막으로 완결 스캔을 마친 줄의 끝 다음 오프셋 (항상 줄 시작) */
  scannedEnd: number
  /** 마지막으로 '\n' 존재를 확인한 source 길이 (개행 없는 긴 줄 O(n) 보장) */
  checkedUntil: number
  /** 현재 열린 펜스 상태 (완결 줄 기준) */
  fence: OpenFenceState | null
  /** 현재 tail 이 여는 펜스 하나로 시작해 아직 닫히지 않았는지 */
  onlyOpenFence: boolean
  /** 현재 tail 에서 가장 최근 비공백 완결 줄 (펜스 밖) */
  prevNonBlankLine: string | null
  /** 현재 tail 에서 prevNonBlankLine 끝 오프셋 ('\n' 직전) */
  prevNonBlankEnd: number
  /** prevNonBlankLine 이후 펜스 밖 빈 줄을 1개 이상 지났는지 */
  hasBlankAfterNonBlank: boolean
  /** 현재 tail 에 완결 비공백 줄이 이미 있었는지 */
  hasContentInTail: boolean
  /** 누적 스캔 문자 수 (계측·테스트용) */
  scannedChars: number
}

export interface StableBlocksCache {
  source: string
  consumed: number
  stable: string[]
  scanState: MarkdownScanState
}

export interface AdvanceResult extends StableBlocks {
  cache: StableBlocksCache
  scanState: MarkdownScanState
  openFence: OpenFenceTail | null
}

// 리스트 항목 시작( -·*·+ 또는 1. / 1) ) — CommonMark 의 0~3칸 들여쓰기 허용.
const LIST_ITEM_RE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s/
// 들여쓰기 코드블록(4칸+ 또는 탭) 시작.
const INDENTED_RE = /^(?: {4,}|\t)/
// CommonMark 펜스 열림 후보 (0~3칸 들여쓰기 + ``` 이상 또는 ~~~ 이상 + info).
export const FENCE_RE = /^( {0,3})(`{3,}|~{3,})(.*)$/
// CommonMark 펜스 닫힘 후보 (0~3칸 들여쓰기 + 마커 + 선택 공백만).
const FENCE_CLOSE_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*$/

const isBlank = (line: string): boolean => line.trim() === ''

function stripCr(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}

function parseOpeningFence(rawLine: string): {
  char: '`' | '~'
  length: number
  indent: number
  lang: string | undefined
} | null {
  const line = stripCr(rawLine)
  const m = FENCE_RE.exec(line)
  if (!m) return null
  const indent = m[1].length
  const marker = m[2]
  const char = marker[0] as '`' | '~'
  const info = m[3]
  // CommonMark: 백틱 펜스 info 문자열에는 백틱이 올 수 없다.
  if (char === '`' && info.includes('`')) return null
  const trimmedInfo = info.trim()
  const firstToken = trimmedInfo === '' ? undefined : trimmedInfo.split(/\s+/, 1)[0]
  return {
    char,
    length: marker.length,
    indent,
    lang: firstToken
  }
}

function isClosingFence(rawLine: string, fence: { char: '`' | '~'; length: number }): boolean {
  const line = stripCr(rawLine)
  const m = FENCE_CLOSE_RE.exec(line)
  if (!m) return false
  return m[2][0] === fence.char && m[2].length >= fence.length
}

function normalizeFenceCode(rawBody: string, indent: number): string {
  let normalized = rawBody.replace(/\r\n/g, '\n')
  if (indent > 0 && normalized.length > 0) {
    const prefixRe = new RegExp(`^ {1,${indent}}`, 'gm')
    normalized = normalized.replace(prefixRe, '')
  }
  return normalized.replace(/\n$/, '')
}

function createInitialScanState(): MarkdownScanState {
  return {
    blockStart: 0,
    scannedEnd: 0,
    checkedUntil: 0,
    fence: null,
    onlyOpenFence: false,
    prevNonBlankLine: null,
    prevNonBlankEnd: 0,
    hasBlankAfterNonBlank: false,
    hasContentInTail: false,
    scannedChars: 0
  }
}

function scanIncrement(
  source: string,
  prevStable: string[],
  prevState: MarkdownScanState
): { stable: string[]; state: MarkdownScanState } {
  // 새 입력 구간에서만 '\n' 을 찾아 개행 없는 긴 줄에서 O(n²) 재스캔을 막는다.
  const searchFrom = Math.max(prevState.scannedEnd, prevState.checkedUntil)
  const firstNewline = source.indexOf('\n', searchFrom)
  if (firstNewline === -1) {
    const deltaScanned = Math.max(0, source.length - prevState.checkedUntil)
    return {
      stable: prevStable,
      state: {
        ...prevState,
        checkedUntil: source.length,
        scannedChars: prevState.scannedChars + deltaScanned
      }
    }
  }

  let stable = prevStable
  let stableCopied = false
  let blockStart = prevState.blockStart
  let fence = prevState.fence
  let onlyOpenFence = prevState.onlyOpenFence
  let prevNonBlankLine = prevState.prevNonBlankLine
  let prevNonBlankEnd = prevState.prevNonBlankEnd
  let hasBlankAfterNonBlank = prevState.hasBlankAfterNonBlank
  let hasContentInTail = prevState.hasContentInTail
  let scannedChars = prevState.scannedChars

  let lineStart = prevState.scannedEnd
  let nlIdx = firstNewline

  while (nlIdx !== -1) {
    const rawLine = source.slice(lineStart, nlIdx)
    const lineEnd = nlIdx + 1
    // 이전 델타에서 checkedUntil 까지 이미 훑은 접두는 중복 계수하지 않는다.
    const newlyCountedFrom = Math.max(lineStart, prevState.checkedUntil)
    if (lineEnd > newlyCountedFrom) {
      scannedChars += lineEnd - newlyCountedFrom
    }

    const line = stripCr(rawLine)

    if (fence !== null) {
      if (isClosingFence(line, fence)) {
        fence = null
        onlyOpenFence = false
        prevNonBlankLine = line
        prevNonBlankEnd = nlIdx
        hasBlankAfterNonBlank = false
        hasContentInTail = true
      }
      lineStart = lineEnd
      nlIdx = source.indexOf('\n', lineStart)
      continue
    }

    if (isBlank(line)) {
      if (prevNonBlankLine !== null) {
        hasBlankAfterNonBlank = true
      }
      lineStart = lineEnd
      nlIdx = source.indexOf('\n', lineStart)
      continue
    }

    // 펜스 밖 비공백 완결 줄 — 직전에 빈 줄 런이 있었으면 분할 경계 평가.
    if (hasBlankAfterNonBlank && prevNonBlankLine !== null) {
      const protectedBoundary =
        LIST_ITEM_RE.test(prevNonBlankLine) ||
        LIST_ITEM_RE.test(line) ||
        INDENTED_RE.test(prevNonBlankLine) ||
        INDENTED_RE.test(line)

      if (!protectedBoundary) {
        if (!stableCopied) {
          stable = [...prevStable]
          stableCopied = true
        }
        stable.push(source.slice(blockStart, prevNonBlankEnd))
        blockStart = lineStart
        onlyOpenFence = false
        prevNonBlankLine = null
        prevNonBlankEnd = lineStart
        hasBlankAfterNonBlank = false
        hasContentInTail = false
      } else {
        hasBlankAfterNonBlank = false
      }
    }

    const opened = parseOpeningFence(line)
    if (opened) {
      fence = {
        ...opened,
        bodyStart: lineEnd
      }
      onlyOpenFence = !hasContentInTail
      hasContentInTail = true
      prevNonBlankLine = line
      prevNonBlankEnd = nlIdx
      hasBlankAfterNonBlank = false
    } else {
      hasContentInTail = true
      prevNonBlankLine = line
      prevNonBlankEnd = nlIdx
      hasBlankAfterNonBlank = false
    }

    lineStart = lineEnd
    nlIdx = source.indexOf('\n', lineStart)
  }

  // 마지막 개행 뒤 남은 미완결 조각도 checkedUntil 까지 훑었으므로 1회 계수한다.
  if (source.length > Math.max(lineStart, prevState.checkedUntil)) {
    scannedChars += source.length - Math.max(lineStart, prevState.checkedUntil)
  }

  return {
    stable,
    state: {
      blockStart,
      scannedEnd: lineStart,
      checkedUntil: source.length,
      fence,
      onlyOpenFence,
      prevNonBlankLine,
      prevNonBlankEnd,
      hasBlankAfterNonBlank,
      hasContentInTail,
      scannedChars
    }
  }
}

export function openFenceTail(tail: string, scanState?: MarkdownScanState): OpenFenceTail | null {
  if (scanState) {
    if (!scanState.fence || !scanState.onlyOpenFence) return null
    const bodyOffsetInTail = scanState.fence.bodyStart - scanState.blockStart
    if (bodyOffsetInTail < 0 || bodyOffsetInTail > tail.length) return null
    return {
      char: scanState.fence.char,
      length: scanState.fence.length,
      indent: scanState.fence.indent,
      lang: scanState.fence.lang,
      code: normalizeFenceCode(tail.slice(bodyOffsetInTail), scanState.fence.indent)
    }
  }

  // 단독 호출(완결 또는 정적 tail 판정): 첫 비공백 줄이 여는 펜스이고 이후 닫히지 않았는지 확인.
  const lines = tail.split('\n')
  let idx = 0
  while (idx < lines.length && isBlank(stripCr(lines[idx]))) idx++
  if (idx >= lines.length) return null
  // 여는 펜스 줄이 아직 개행으로 끝나지 않았으면 펜스 본문이 없다.
  if (idx === lines.length - 1) return null
  const opened = parseOpeningFence(lines[idx])
  if (!opened) return null
  for (let i = idx + 1; i < lines.length; i++) {
    if (isClosingFence(lines[i], opened)) return null
  }
  const rawBody = lines.slice(idx + 1).join('\n')
  return {
    ...opened,
    code: normalizeFenceCode(rawBody, opened.indent)
  }
}

export function splitStableBlocks(source: string): StableBlocks {
  const { stable, state } = scanIncrement(source, [], createInitialScanState())
  return { stable, tail: source.slice(state.blockStart) }
}

export function advanceStableBlocks(
  cache: StableBlocksCache | null,
  source: string
): AdvanceResult {
  if (cache !== null && source.startsWith(cache.source)) {
    const { stable, state } = scanIncrement(source, cache.stable, cache.scanState)
    const tail = source.slice(state.blockStart)
    const openFence = openFenceTail(tail, state)
    return {
      stable,
      tail,
      scanState: state,
      openFence,
      cache: { source, consumed: state.blockStart, stable, scanState: state }
    }
  }
  const { stable, state } = scanIncrement(source, [], createInitialScanState())
  const tail = source.slice(state.blockStart)
  const openFence = openFenceTail(tail, state)
  return {
    stable,
    tail,
    scanState: state,
    openFence,
    cache: { source, consumed: state.blockStart, stable, scanState: state }
  }
}
