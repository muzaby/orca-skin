// 0211 ΔV4 — 컨텍스트 바의 비교 기준 라벨 (VP-51 · AT-43).
//
// 네 상태가 서로를 대신하지 못한다: `ref` 는 브랜치 이름, `oid` 는 이름을 모를 때의 sha 7자,
// `head` 는 기준선 자체를 모를 때의 문구, `none` 은 커밋이 하나도 없는 저장소다.

import { describe, expect, it } from 'vitest'
import type { GitDiffBase, GitDiffSummary } from '../../../../../../shared/ipc'
import type { MessageKey } from '../../../../shared/i18n'
import { summaryBaseLabel, summaryBaseText } from './sessionChangesData'

const LABELS: Partial<Record<MessageKey, string>> = {
  'chat.rightpanel.diffBaselineHead': '현재 HEAD',
  'chat.rightpanel.diffBaselineNone': '기준 없음'
}
const tr = (key: MessageKey): string => LABELS[key] ?? String(key)

function summaryWith(base: GitDiffBase): GitDiffSummary {
  return {
    isRepo: true,
    base,
    files: [],
    totals: { added: 0, removed: 0 },
    filesTruncated: false,
    commits: [],
    commitsTruncated: false,
    commitFilesUnavailable: false,
    uncommitted: { files: [], totals: { added: 0, removed: 0 }, filesTruncated: false }
  }
}

describe('비교 기준 라벨 4상태', () => {
  it('브랜치 이름을 알면 그 이름이 라벨이다', () => {
    const base: GitDiffBase = { kind: 'worktree-base', oid: 'a'.repeat(40), ref: 'main' }

    expect(summaryBaseLabel(summaryWith(base))).toEqual({ kind: 'ref', ref: 'main' })
    expect(summaryBaseText(summaryWith(base), tr)).toBe('main')
  })

  it('이름을 모르면 sha 7자로 접는다 — 라벨 자리를 비우지 않는다', () => {
    const base: GitDiffBase = { kind: 'worktree-base', oid: 'abcdef1234567890', ref: null }

    expect(summaryBaseLabel(summaryWith(base))).toEqual({ kind: 'oid', oid: 'abcdef1' })
    expect(summaryBaseText(summaryWith(base), tr)).toBe('abcdef1')
  })

  it('기준선 자체를 모르면 sha 가 아니라 문구다 — 그 sha 는 출발점이 아니다', () => {
    const base: GitDiffBase = { kind: 'head', oid: 'b'.repeat(40) }

    expect(summaryBaseLabel(summaryWith(base))).toEqual({ kind: 'head' })
    expect(summaryBaseText(summaryWith(base), tr)).toBe('현재 HEAD')
  })

  it('커밋이 하나도 없는 저장소와 요약 부재는 none 이다', () => {
    expect(summaryBaseLabel(summaryWith({ kind: 'none' }))).toEqual({ kind: 'none' })
    expect(summaryBaseLabel(null)).toEqual({ kind: 'none' })
  })

  // 0211 ΔV4 r2 (D14) — `none` 도 카탈로그를 지난다. 문자 기호를 그대로 두면 UI 라벨이
  // 카탈로그 밖에 사는 자리가 하나 남는다(root AGENTS §8).
  it('커밋이 하나도 없는 저장소도 카탈로그 문구다 — 기호를 화면에 흘리지 않는다', () => {
    expect(summaryBaseText(summaryWith({ kind: 'none' }), tr)).toBe('기준 없음')
    expect(summaryBaseText(null, tr)).toBe('기준 없음')
  })

  it('라벨은 현재 브랜치를 붙이지 않는다 — 화살표도 우측 값도 없다 (D-069)', () => {
    const base: GitDiffBase = { kind: 'worktree-base', oid: 'a'.repeat(40), ref: 'main' }

    expect(summaryBaseText(summaryWith(base), tr)).toBe('main')
  })
})
