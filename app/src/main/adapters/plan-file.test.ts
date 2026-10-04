import { afterEach, describe, expect, it, vi } from 'vitest'
import { lstat, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { HookCallback } from '@anthropic-ai/claude-agent-sdk'
import {
  claudePlansDirectory,
  makePlanFileHook,
  nodePlanFileReader,
  PLAN_FILE_MAX_BYTES,
  planFileTarget,
  readDeclaredPlanFile,
  readTrackedPlanFile,
  type PlanFileCell
} from './plan-file'

const fixtures: string[] = []
afterEach(async () => {
  for (const root of fixtures.splice(0)) await rm(root, { recursive: true, force: true })
})
async function directory(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'orca-plan-file-'))
  fixtures.push(root)
  return root
}
const home = path.resolve('fixture-home')
const plansDir = path.join(home, '.claude', 'plans')
const planPath = path.join(plansDir, 'a.md')

describe('0249 VP-12 — plans 경로 판정', () => {
  it('CLAUDE_CONFIG_DIR 실효 조회값과 기본 home을 사용한다', () => {
    const lookup = vi.fn(() => undefined)
    expect(claudePlansDirectory(lookup, home)).toBe(plansDir)
    expect(lookup).toHaveBeenCalledWith('CLAUDE_CONFIG_DIR')
    expect(claudePlansDirectory(() => '~/custom-claude', home)).toBe(
      path.join(home, 'custom-claude', 'plans')
    )
  })
  it.each(['Write', 'Edit'])('%s는 ~ 확장·정규화된 plans .md만 받는다', (toolName) => {
    expect(
      planFileTarget(toolName, { file_path: '~/.claude/plans/nested/../a.md' }, plansDir, home)
    ).toBe(planPath)
  })
  it.runIf(process.platform === 'win32')('win32 대소문자를 무시한다', () => {
    expect(planFileTarget('Write', { file_path: planPath.toUpperCase() }, plansDir, home)).toBe(
      planPath.toUpperCase()
    )
  })
  it.each([
    ['Read', planPath],
    ['Write', path.join(home, '.claude', 'outside.md')],
    ['Write', path.join(plansDir, '..', 'outside.md')],
    ['Write', `${plansDir}-sibling/a.md`],
    ['Write', path.join(plansDir, 'a.txt')],
    ['Write', ''],
    ['Write', '   ']
  ])('%s %s는 출처가 아니다', (toolName, filePath) => {
    expect(planFileTarget(toolName, { file_path: filePath }, plansDir, home)).toBeNull()
  })
  it.each([null, [], {}, { file_path: 42 }])('비정상 입력 %j는 출처가 아니다', (input) => {
    expect(planFileTarget('Write', input, plansDir, home)).toBeNull()
  })
})

describe('0249 VP-12 — reader·선언 경로 guard', () => {
  it('일반 파일·256 KiB 경계는 읽고 초과·디렉토리·부재는 건너뛴다', async () => {
    const root = await directory()
    const allowed = path.join(root, 'a.md')
    const oversized = path.join(root, 'large.md')
    await writeFile(allowed, 'x'.repeat(PLAN_FILE_MAX_BYTES))
    await writeFile(oversized, 'x'.repeat(PLAN_FILE_MAX_BYTES + 1))
    const read = nodePlanFileReader()
    expect(await read(allowed)).toHaveLength(PLAN_FILE_MAX_BYTES)
    expect(await read(oversized)).toBeNull()
    expect(await read(root)).toBeNull()
    expect(await read(path.join(root, 'missing.md'))).toBeNull()
  })
  it('파일 심볼릭 링크는 읽지 않는다', async () => {
    const root = await directory()
    const original = path.join(root, 'original.md')
    const linked = path.join(root, 'linked.md')
    await writeFile(original, 'private plan')
    await symlink(original, linked, 'file')
    expect((await lstat(linked)).isSymbolicLink()).toBe(true)
    expect(await nodePlanFileReader()(linked)).toBeNull()
  })
  it('plans 내부의 디렉토리 링크도 밖의 파일을 읽지 않는다', async () => {
    const root = await directory()
    const outside = path.join(root, 'outside')
    const plans = path.join(root, 'plans')
    await mkdir(outside)
    await mkdir(plans)
    await writeFile(path.join(outside, 'a.md'), 'outside plan')
    await symlink(
      outside,
      path.join(plans, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir'
    )
    expect(
      await readDeclaredPlanFile(
        { planFilePath: path.join(plans, 'linked', 'a.md') },
        plans,
        nodePlanFileReader()
      )
    ).toBeUndefined()
  })
  it('선언 경로도 추적과 같은 판정을 먼저 적용하여 부적합 경로 reader를 부르지 않는다', async () => {
    const read = vi.fn(async () => '# 계획')
    for (const planFilePath of [
      path.join(home, 'outside.md'),
      path.join(plansDir, 'a.txt'),
      '',
      42
    ]) {
      expect(await readDeclaredPlanFile({ planFilePath }, plansDir, read)).toBeUndefined()
    }
    expect(read).not.toHaveBeenCalled()
    expect(await readDeclaredPlanFile({ planFilePath: planPath }, plansDir, read)).toEqual({
      plan: '# 계획',
      planFilePath: planPath
    })
    expect(read).toHaveBeenCalledExactlyOnceWith(planPath)
  })
  it('읽기 부재·공백·reject는 다음 출처로 내려간다', async () => {
    for (const read of [
      vi.fn(async () => null),
      vi.fn(async () => '  \n'),
      vi.fn(async () => {
        throw new Error('read failed')
      })
    ]) {
      expect(await readTrackedPlanFile({ path: planPath }, read)).toBeUndefined()
      expect(await readDeclaredPlanFile({ planFilePath: planPath }, plansDir, read)).toBeUndefined()
    }
    const unread = vi.fn(async () => '# 계획')
    expect(await readTrackedPlanFile({}, unread)).toBeUndefined()
    expect(unread).not.toHaveBeenCalled()
  })
})

describe('0249 VP-10 — 마지막 메인 쓰기·Stop 수명', () => {
  function hooks(cell: PlanFileCell): { record: HookCallback; reset: HookCallback } {
    const { hooks } = makePlanFileHook(cell, plansDir)
    expect(hooks?.PostToolUse?.[0].matcher).toBe('Write|Edit')
    return { record: hooks!.PostToolUse![0].hooks[0], reset: hooks!.Stop![0].hooks[0] }
  }
  async function write(record: HookCallback, filePath: string, extra = {}): Promise<void> {
    await record(
      {
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: filePath },
        tool_response: {},
        ...extra
      } as never,
      undefined,
      { signal: new AbortController().signal }
    )
  }
  it('쓰기 a→Edit b→서브에이전트 c→Exit→Stop→Exit', async () => {
    const cell: PlanFileCell = {}
    const { record, reset } = hooks(cell)
    const a = path.join(plansDir, 'a.md')
    const b = path.join(plansDir, 'b.md')
    await write(record, a)
    await write(record, b, { tool_name: 'Edit' })
    await write(record, path.join(plansDir, 'child.md'), { agent_id: 'child' })
    const read = vi.fn(async (filePath: string) => path.basename(filePath))
    expect(await readTrackedPlanFile(cell, read)).toEqual({ plan: 'b.md', planFilePath: b })
    await reset({ hook_event_name: 'Stop' } as never, undefined, {
      signal: new AbortController().signal
    })
    expect(await readTrackedPlanFile(cell, read)).toBeUndefined()
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('실패·범위 밖·다른 도구 쓰기는 마지막 정당한 출처를 바꾸지 않는다', async () => {
    const cell: PlanFileCell = {}
    const { record } = hooks(cell)
    await write(record, planPath)
    await write(record, path.join(plansDir, 'failed.md'), { tool_response: { isError: true } })
    await write(record, path.join(home, 'outside.md'))
    await write(record, path.join(plansDir, 'a.txt'))
    await write(record, path.join(plansDir, 'read.md'), { tool_name: 'Read' })
    expect(cell.path).toBe(planPath)
  })
})
