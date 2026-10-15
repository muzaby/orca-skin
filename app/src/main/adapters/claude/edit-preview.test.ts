import path from 'node:path'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { buildEditPreview, nodeEditPreviewReader, EDIT_PREVIEW_MAX_BYTES } from './edit-preview'
import { resolveGuardRoots } from './workspace-guard'

const WS = path.resolve('/ws')
const roots = resolveGuardRoots(WS)

const FILE = [
  'const frame = 0',
  '',
  'async function animate(): Promise<void> {',
  '  requestAnimationFrame(animate)',
  '}',
  ''
].join('\n')

function preview(
  input: unknown,
  text: string | null = FILE,
  toolName = 'Edit'
): ReturnType<typeof buildEditPreview> {
  return buildEditPreview(toolName, input, roots, () => text)
}

const edit = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  file_path: path.join(WS, 'hello_world.ts'),
  old_string: 'animate(): Promise<void>',
  new_string: 'animate2(): Promise<void>',
  ...over
})

describe('buildEditPreview', () => {
  it('편집 전 파일의 실제 줄번호로 hunk 를 만든다', () => {
    const hunks = preview(edit())
    expect(hunks).toHaveLength(1)
    expect(hunks?.[0]).toMatchObject({ oldStart: 1, newStart: 1 })
    expect(hunks?.[0].lines).toContain('-async function animate(): Promise<void> {')
    expect(hunks?.[0].lines).toContain('+async function animate2(): Promise<void> {')
  })

  it('문맥 폭이 SDK 결과 패치와 같은 4줄이다', () => {
    const long = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n')
    const hunks = buildEditPreview(
      'Edit',
      edit({ old_string: 'line 20', new_string: 'line twenty' }),
      roots,
      () => long
    )
    // 변경 1줄 + 위아래 문맥 4줄씩 = 9줄, 시작은 16번 줄이다.
    expect(hunks?.[0]).toMatchObject({ oldStart: 16, oldLines: 9, newStart: 16, newLines: 9 })
  })

  // 0229 §10 EP-Δ3 — 자리가 특정되지 않으면 좌표를 만들지 않는다.
  it('일치가 0회거나 2회 이상(replace_all 아님)이면 null', () => {
    expect(preview(edit({ old_string: '없는 문자열' }))).toBeNull()
    expect(preview(edit({ old_string: 'animate' }))).toBeNull()
  })

  it('replace_all 이면 모든 자리를 반영한다', () => {
    const hunks = preview(edit({ old_string: 'animate', new_string: 'spin', replace_all: true }))
    const added = (hunks ?? []).flatMap((h) => h.lines).filter((l) => l.startsWith('+'))
    expect(added.join('\n')).toContain('spin')
    expect(added.filter((l) => l.includes('spin'))).toHaveLength(2)
  })

  it('Edit 외 도구·형상 불일치 입력은 null', () => {
    expect(preview(edit(), FILE, 'Write')).toBeNull()
    expect(preview(edit(), FILE, 'MultiEdit')).toBeNull()
    expect(preview(edit(), FILE, 'Read')).toBeNull()
    expect(preview({ file_path: 1 })).toBeNull()
    expect(preview({ file_path: 'a.ts', old_string: '', new_string: 'x' })).toBeNull()
  })

  it('읽기 실패는 null 이고 예외를 올리지 않는다', () => {
    expect(preview(edit(), null)).toBeNull()
  })

  it('치환 결과가 원문과 같으면 null', () => {
    expect(preview(edit({ old_string: 'animate', new_string: 'animate', replace_all: true }))).toBe(
      null
    )
  })

  // 0229 §10 EP-Δ1 — 가드가 거부하면 **reader 를 부르지 않는다**. 결과값만 보면 읽고 버린
  // 경우와 구분되지 않는다.
  it('workspace 밖 경로는 읽지 않는다', () => {
    const read = vi.fn().mockReturnValue(FILE)
    const outside = buildEditPreview(
      'Edit',
      edit({ file_path: path.resolve('/elsewhere/secret.ts') }),
      roots,
      read
    )
    expect(outside).toBeNull()
    expect(read).not.toHaveBeenCalled()

    const inside = buildEditPreview('Edit', edit(), roots, read)
    expect(read).toHaveBeenCalledTimes(1)
    expect(inside).not.toBeNull()
  })

  // 0229 verify r1 D1 — 가드가 **푼 경로**와 reader 가 **읽는 경로**가 같아야 한다. 둘이 갈리면
  // 상대 경로 `file_path` 가 가드는 workspace 기준으로, 읽기는 main 프로세스 cwd 기준으로 풀려
  // 가드 밖 파일을 읽는다. 호출 여부(위 케이스)만 보면 이 갈림이 보이지 않는다.
  it('reader 는 가드가 통과시킨 그 경로를 받는다 — 상대 경로도 workspace 기준이다', () => {
    const read = vi.fn().mockReturnValue(FILE)
    const relative = buildEditPreview(
      'Edit',
      edit({ file_path: 'nested/hello_world.ts' }),
      roots,
      read
    )

    expect(relative).not.toBeNull()
    expect(read).toHaveBeenCalledExactlyOnceWith(path.join(WS, 'nested', 'hello_world.ts'))
    // main 프로세스 cwd 기준으로 풀린 경로가 아니다 — 그랬다면 workspace 밖을 읽은 것이다.
    expect(read.mock.calls[0][0]).not.toBe(path.resolve('nested/hello_world.ts'))
  })

  it('절대 경로도 정규화해 같은 문자열로 넘긴다', () => {
    const read = vi.fn().mockReturnValue(FILE)
    buildEditPreview(
      'Edit',
      edit({ file_path: path.join(WS, '.', 'a', '..', 'x.ts') }),
      roots,
      read
    )
    expect(read).toHaveBeenCalledExactlyOnceWith(path.join(WS, 'x.ts'))
  })
})

describe('nodeEditPreviewReader', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'orca-edit-preview-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('상한 이하 파일은 본문을 준다', () => {
    const file = path.join(dir, 'small.ts')
    writeFileSync(file, 'const a = 1\n')
    expect(nodeEditPreviewReader()(file)).toBe('const a = 1\n')
  })

  // 0229 §10 EP-Δ2 — 상한 초과는 본문을 읽지 않는다.
  it('상한 초과 파일은 null', () => {
    const file = path.join(dir, 'big.ts')
    writeFileSync(file, 'x'.repeat(64))
    expect(nodeEditPreviewReader(32)(file)).toBeNull()
    expect(nodeEditPreviewReader(64)(file)).not.toBeNull()
  })

  it('부재·디렉토리는 null 이고 throw 하지 않는다', () => {
    expect(nodeEditPreviewReader()(path.join(dir, 'missing.ts'))).toBeNull()
    expect(nodeEditPreviewReader()(dir)).toBeNull()
  })

  // 0229 verify r1 D2 — 상수 값 자체를 단언하면 동어반복이다. 인자 없는 기본 reader 가 실제로
  // 그 상한을 쓰는지(경계 바로 위/아래)를 본다.
  it('기본 reader 가 EDIT_PREVIEW_MAX_BYTES 를 경계로 쓴다', () => {
    const atCap = path.join(dir, 'at-cap.ts')
    const overCap = path.join(dir, 'over-cap.ts')
    writeFileSync(atCap, 'x'.repeat(EDIT_PREVIEW_MAX_BYTES))
    writeFileSync(overCap, 'x'.repeat(EDIT_PREVIEW_MAX_BYTES + 1))

    expect(nodeEditPreviewReader()(atCap)).toHaveLength(EDIT_PREVIEW_MAX_BYTES)
    expect(nodeEditPreviewReader()(overCap)).toBeNull()
  })
})
