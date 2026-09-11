import { describe, expect, it } from 'vitest'
import {
  carriesFileEditPatch,
  fileEditPatchLines,
  isFileEditToolName,
  readFileEditStructuredPatch
} from './file-edit-tool'

// SDK `FileEditOutput.structuredPatch` 한 hunk — `animate` → `animate2` 한 줄 교체.
const hunk = {
  oldStart: 45,
  oldLines: 3,
  newStart: 45,
  newLines: 3,
  lines: [
    '   const frame = 0',
    '-async function animate(): Promise<void> {',
    '+async function animate2(): Promise<void> {',
    '   requestAnimationFrame(animate)'
  ]
}

describe('편집 도구 이름', () => {
  it('카드가 diff 로 그리는 3종만 참이다', () => {
    expect(['Write', 'Edit', 'MultiEdit'].every(isFileEditToolName)).toBe(true)
    expect(isFileEditToolName('Read')).toBe(false)
    expect(isFileEditToolName('NotebookEdit')).toBe(false)
  })

  it('구조화 패치를 싣는 도구는 Edit 뿐이다 (0228 D-009)', () => {
    expect(carriesFileEditPatch('Edit')).toBe(true)
    expect(carriesFileEditPatch('Write')).toBe(false)
    expect(carriesFileEditPatch('MultiEdit')).toBe(false)
  })
})

describe('readFileEditStructuredPatch', () => {
  it('정상 hunk 를 좌표 그대로 읽는다', () => {
    expect(readFileEditStructuredPatch({ structuredPatch: [hunk] })).toEqual([hunk])
  })

  it('패치가 없거나 형태가 아니면 null', () => {
    expect(readFileEditStructuredPatch(undefined)).toBeNull()
    expect(readFileEditStructuredPatch({ originalFile: 'x' })).toBeNull()
    expect(readFileEditStructuredPatch({ structuredPatch: [] })).toBeNull()
    expect(
      readFileEditStructuredPatch({ structuredPatch: [{ ...hunk, lines: [1, 2] }] })
    ).toBeNull()
    expect(readFileEditStructuredPatch({ structuredPatch: [{ ...hunk, oldStart: -1 }] })).toBeNull()
  })

  // 0228 §10 EP-05 — 한 hunk 라도 줄 수가 어긋나면 그 뒤 좌표가 전부 밀린다.
  it('줄 수가 oldLines/newLines 와 어긋나면 패치 전체를 거부한다', () => {
    expect(readFileEditStructuredPatch({ structuredPatch: [{ ...hunk, newLines: 4 }] })).toBeNull()
    expect(readFileEditStructuredPatch({ structuredPatch: [{ ...hunk, oldLines: 9 }] })).toBeNull()
    expect(readFileEditStructuredPatch({ structuredPatch: [hunk, { ...hunk, oldLines: 9 }] })).toBe(
      null
    )
  })
})

describe('fileEditPatchLines', () => {
  it('hunk 시작값에서 두 축을 각각 전진시킨다', () => {
    expect(fileEditPatchLines([hunk])).toEqual([
      { type: 'unchanged', oldLine: 45, newLine: 45, text: '  const frame = 0' },
      {
        type: 'removed',
        oldLine: 46,
        newLine: null,
        text: 'async function animate(): Promise<void> {'
      },
      {
        type: 'added',
        oldLine: null,
        newLine: 46,
        text: 'async function animate2(): Promise<void> {'
      },
      { type: 'unchanged', oldLine: 47, newLine: 47, text: '  requestAnimationFrame(animate)' }
    ])
  })

  it('삭제가 많아도 이후 추가 줄이 new 축을 따른다', () => {
    const lines = fileEditPatchLines([
      {
        oldStart: 10,
        oldLines: 3,
        newStart: 10,
        newLines: 1,
        lines: ['-a', '-b', '-c', '+z']
      }
    ])
    expect(lines.map((line) => [line.type, line.oldLine, line.newLine])).toEqual([
      ['removed', 10, null],
      ['removed', 11, null],
      ['removed', 12, null],
      ['added', null, 10]
    ])
  })

  it('`\\ No newline` 표식은 줄을 만들지 않는다', () => {
    const lines = fileEditPatchLines([
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: ['-a', '\\ No newline at end of file', '+b']
      }
    ])
    expect(lines.map((line) => line.text)).toEqual(['a', 'b'])
  })
})
