// 도구(tool call) 렌더링용 파생 셀렉터 — Claude Code 출력 양식 모방.
// ToolCall 타입/reducer/IPC/DB 는 변경하지 않고, 렌더 시점에 친화적 서술·동사 카테고리·
// 그룹 요약을 *계산* 한다. (전략 문서 §4 참조)

import type { ToolCall } from '../reducer/chatReducer'

export type VerbCategory = 'ran' | 'created' | 'edited' | 'used' | 'planned'

// 동사 라벨 (인라인 한국어 — shared/i18n/ko.ts 는 future scope)
export const VERB_LABEL: Record<VerbCategory, string> = {
  ran: '실행됨',
  created: '생성됨',
  edited: '편집됨',
  used: '사용함',
  planned: '제안된 계획'
}

// 단위 라벨 — planned 는 단위 없는 싱글톤 명사
export const UNIT_LABEL: Record<VerbCategory, string | null> = {
  ran: '명령',
  created: '파일',
  edited: '파일',
  used: '도구',
  planned: null
}

// 요약 조립 순서
const CATEGORY_ORDER: VerbCategory[] = ['ran', 'created', 'edited', 'used', 'planned']

// 도구 이름 → 카테고리 (전략 문서 §3 관찰 매핑)
export function toolVerbCategory(name: string): VerbCategory {
  switch (name) {
    case 'Bash':
    case 'PowerShell':
      return 'ran'
    case 'Write':
      return 'created'
    case 'Edit':
    case 'MultiEdit':
      return 'edited'
    case 'ExitPlanMode':
      return 'planned'
    default:
      // Read / Glob / Grep / WebFetch / WebSearch / Task* / mcp__* / 그 외
      return 'used'
  }
}

// file_path 의 마지막 세그먼트 (`/`·`\` 양쪽 지원)
function basename(path: string): string {
  const segs = path.split(/[/\\]/).filter(Boolean)
  return segs.length > 0 ? segs[segs.length - 1] : path
}

function asRecord(input: unknown): Record<string, unknown> | null {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : null
}

function stringField(rec: Record<string, unknown> | null, key: string): string | null {
  const v = rec?.[key]
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

// 친화적 서술: input.description 우선 → 도구별 fallback → call.name
export function toolDescription(call: ToolCall): string {
  const rec = asRecord(call.input)

  // 1) description 파라미터를 갖는 도구(Bash/PowerShell, Task 등)는 raw input 에 그대로 존재
  const desc = stringField(rec, 'description')
  if (desc) return desc

  // 2) 도구별 fallback
  switch (call.name) {
    case 'ExitPlanMode':
      return '제안된 계획'
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'Read': {
      const fp = stringField(rec, 'file_path')
      if (fp) return basename(fp)
      break
    }
    case 'Glob':
    case 'Grep': {
      const pattern = stringField(rec, 'pattern')
      if (pattern) return pattern
      break
    }
    case 'WebFetch': {
      const url = stringField(rec, 'url')
      if (url) return url
      break
    }
    default:
      break
  }

  // 3) 그래도 비면 도구 이름
  return call.name
}

// 그룹 요약: 완료된 calls → 카테고리별 카운트 → 정해진 순서로 '{verb} {unit} {N}개' join(', ')
//   planned 싱글톤(카운트 없음)은 '제안된 계획' 만.
export function summarizeToolGroup(calls: ToolCall[]): string {
  const counts = new Map<VerbCategory, number>()
  for (const call of calls) {
    const cat = toolVerbCategory(call.name)
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }

  const parts: string[] = []
  for (const cat of CATEGORY_ORDER) {
    const n = counts.get(cat)
    if (!n) continue
    const unit = UNIT_LABEL[cat]
    if (unit == null) {
      // planned 등 단위 없는 카테고리 — 카운트 없이 명사 라벨만
      parts.push(VERB_LABEL[cat])
    } else {
      parts.push(`${VERB_LABEL[cat]} ${unit} ${n}개`)
    }
  }
  return parts.join(', ')
}
