// 도구(tool call) 렌더링용 파생 셀렉터 — Claude Code 출력 양식 모방.
// ToolCall 타입/reducer/IPC/DB 는 변경하지 않고, 렌더 시점에 친화적 서술·동사 카테고리·
// 그룹 요약을 *계산* 한다. (전략 문서 §4 참조)
//
// 백엔드 중립: 입력은 중립 ToolCall(name/input/result) 뿐 — claude 전용 의존 없음.
// 미지 도구명은 'used' 로 폴백하므로 타 SDK 의 낯선 도구도 합리적으로 렌더된다.

import type { ToolCall } from '../reducer/chatReducer'
import { diffLines as jsDiffLines } from 'diff'
import { basenameForDisplay } from '../../../../../shared/path-basename'
import { isAgentTaskName } from './parts'

// 파일 도구 이름 집합 — 편집(diff 렌더 대상)과 읽기 포함(파일경로 헤더 대상)의 단일 진실원.
// 새 편집형 도구는 여기에만 추가하면 registry(diff)·ToolCard(헤더/복사)가 함께 따라온다.
export const FILE_EDIT_TOOLS: ReadonlySet<string> = new Set(['Write', 'Edit', 'MultiEdit'])
export const FILE_TOOLS: ReadonlySet<string> = new Set(['Read', ...FILE_EDIT_TOOLS])

export type VerbCategory =
  | 'ran'
  | 'created'
  | 'edited'
  | 'read'
  | 'used'
  | 'planned'
  | 'requested'
  | 'delegated'

// 동사 라벨 — 완료 시제 (인라인 한국어. i18n 인프라는 0096 으로 도입됨 —
// shared/i18n 카탈로그로의 이관은 채팅 화면 문자열 마이그레이션 후속 핸드오프 몫)
export const VERB_LABEL: Record<VerbCategory, string> = {
  ran: '실행됨',
  created: '업데이트됨',
  edited: '수정됨',
  read: '읽음',
  used: '사용함',
  planned: '제안된 계획',
  requested: '요청됨',
  delegated: '실행됨'
}

// 동사 라벨 — 진행 시제 (도구가 아직 result 없이 동작 중일 때)
export const VERB_LABEL_ACTIVE: Record<VerbCategory, string> = {
  ran: '실행 중',
  created: '업데이트 중',
  edited: '수정 중',
  read: '읽는 중',
  used: '사용 중',
  planned: '계획 제안 중',
  requested: '질문 중',
  delegated: '실행 중'
}

// 동사 라벨 — 중단됨 (도구가 result 없이 진행 중이다가 턴 취소/타임아웃으로 정착된 경우).
// 카테고리 무관 단일 라벨 — 완료(VERB_LABEL)도 진행(VERB_LABEL_ACTIVE)도 아닌 제3 상태.
export const VERB_LABEL_ABORTED = '중단됨'

// 단위 라벨 — planned 는 단위 없는 싱글톤 명사
export const UNIT_LABEL: Record<VerbCategory, string | null> = {
  ran: '명령',
  created: '파일',
  edited: '파일',
  read: '파일',
  used: '도구',
  planned: null,
  requested: '질문',
  delegated: '에이전트'
}

// 요약 조립 순서
const CATEGORY_ORDER: VerbCategory[] = [
  'ran',
  'created',
  'edited',
  'read',
  'used',
  'delegated',
  'requested',
  'planned'
]

// 도구 이름 → 카테고리 (전략 문서 §3 관찰 매핑)
export function toolVerbCategory(name: string): VerbCategory {
  if (isAgentTaskName(name)) return 'delegated'
  switch (name) {
    case 'Bash':
    case 'PowerShell':
      return 'ran'
    case 'Write':
      return 'created'
    case 'Edit':
    case 'MultiEdit':
      return 'edited'
    case 'Read':
      return 'read'
    case 'ExitPlanMode':
      return 'planned'
    case 'AskUserQuestion':
      return 'requested'
    default:
      // Glob / Grep / WebFetch / WebSearch / mcp__* / 그 외
      return 'used'
  }
}

function asRecord(input: unknown): Record<string, unknown> | null {
  return typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : null
}

function stringField(rec: Record<string, unknown> | null, key: string): string | null {
  const v = rec?.[key]
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

// AskUserQuestion 의 첫 질문 header (≤12자 라벨) → 없으면 질문 텍스트
function askHeader(rec: Record<string, unknown> | null): string | null {
  const qs = rec?.questions
  if (!Array.isArray(qs) || qs.length === 0) return null
  const first = asRecord(qs[0])
  return stringField(first, 'header') ?? stringField(first, 'question')
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
    case 'AskUserQuestion':
      return askHeader(rec) ?? 'AskUserQuestion'
    case 'Write':
    case 'Edit':
    case 'MultiEdit':
    case 'Read': {
      const fp = stringField(rec, 'file_path')
      if (fp) return basenameForDisplay(fp, fp) // 세그먼트가 없으면(루트 등) 경로 원문 유지
      break
    }
    case 'Bash':
    case 'PowerShell': {
      // description 이 없으면 명령 자체로 작업을 식별 (도구명 "Bash" 보다 유용).
      const command = stringField(rec, 'command')
      if (command) {
        const firstLine = command.split('\n')[0].trim()
        return firstLine.length > 80 ? `${firstLine.slice(0, 80)}…` : firstLine
      }
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

// jsdiff 라인 diff → 추가/삭제 라인 카운트.
function countChanges(oldStr: string, newStr: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const part of jsDiffLines(oldStr, newStr)) {
    if (part.added) added += part.count ?? 0
    else if (part.removed) removed += part.count ?? 0
  }
  return { added, removed }
}

// Write/Edit/MultiEdit 의 diff-stat (+추가 / -삭제 라인). 그 외는 null.
export function toolDiffStat(call: ToolCall): { added: number; removed: number } | null {
  const rec = asRecord(call.input)
  if (!rec) return null
  switch (call.name) {
    case 'Write': {
      const content = stringField(rec, 'content') ?? ''
      return countChanges('', content)
    }
    case 'Edit': {
      const oldStr = typeof rec.old_string === 'string' ? rec.old_string : ''
      const newStr = typeof rec.new_string === 'string' ? rec.new_string : ''
      return countChanges(oldStr, newStr)
    }
    case 'MultiEdit': {
      const edits = Array.isArray(rec.edits) ? rec.edits : []
      let added = 0
      let removed = 0
      for (const e of edits) {
        const er = asRecord(e)
        const oldStr = typeof er?.old_string === 'string' ? er.old_string : ''
        const newStr = typeof er?.new_string === 'string' ? er.new_string : ''
        const stat = countChanges(oldStr, newStr)
        added += stat.added
        removed += stat.removed
      }
      return { added, removed }
    }
    default:
      return null
  }
}

// 그룹 요약 세그먼트 — 카테고리별 카운트 + 에러 여부(렌더에서 동사를 빨강 처리).
export interface ToolGroupSegment {
  category: VerbCategory
  /** 합쳐진 라벨 ("실행됨 명령 2개") — 문자열 요약용. */
  text: string
  /** 동사 라벨만 ("실행됨") — 헤더 span 분리 렌더용. */
  verb: string
  /** 단위+카운트만 ("명령 2개") — 단위 없는 카테고리(planned)는 null. */
  count: string | null
  hasError: boolean
}

export function toolGroupSegments(calls: ToolCall[]): ToolGroupSegment[] {
  const counts = new Map<VerbCategory, number>()
  const errors = new Map<VerbCategory, boolean>()
  for (const call of calls) {
    const cat = toolVerbCategory(call.name)
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
    if (call.result?.isError === true) errors.set(cat, true)
  }

  const segments: ToolGroupSegment[] = []
  for (const cat of CATEGORY_ORDER) {
    const n = counts.get(cat)
    if (!n) continue
    const unit = UNIT_LABEL[cat]
    // 단위 없는 카테고리(planned)는 카운트 없이 명사 라벨만
    const verb = VERB_LABEL[cat]
    const count = unit == null ? null : `${unit} ${n}개`
    const text = count == null ? verb : `${verb} ${count}`
    segments.push({ category: cat, text, verb, count, hasError: errors.get(cat) === true })
  }
  return segments
}

// 그룹 요약 문자열 (세그먼트 join). 진행 중이 아닌 완료 그룹용.
export function summarizeToolGroup(calls: ToolCall[]): string {
  return toolGroupSegments(calls)
    .map((s) => s.text)
    .join(', ')
}
