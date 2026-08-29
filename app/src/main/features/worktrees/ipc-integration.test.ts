// AC1 · AC2 · VP-09 — renderer payload → main schema → worktree service → git 까지 **한 경로**로 잇는다.
//
// 조각별 테스트는 이미 있다(`protocol.worktree.test.ts` 스키마 · `runner.test.ts` execFile 인자 ·
// `service.test.ts` 생성). 조각이 각각 맞아도 **그 사이를 실제로 흐르는지**는 별개 축이고,
// 이 경로가 끊기면 renderer 가 보낸 값이 조용히 기본값으로 대체된다.
//
// 곁들여 EP-04 의 음성 축을 장치로 만든다 — feature 는 git 명령을 직접 만들지 않는다.

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { SendChatMessageSchema } from '../../../shared/protocol'
import type { DbQueries } from '../../infra/db'
import { sourceFiles, stripCommentsAndStrings } from '../../infra/source-scan'
import { WorktreeService } from './service'

const exec = promisify(execFile)
const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('renderer payload → schema → service → git (AC1 · AC2 · VP-09)', () => {
  it('renderer 가 보낸 격리 요청이 실제 worktree 와 branch 로 도착한다', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'orca-ipc-repo-'))
    roots.push(repo)
    await exec('git', ['init', repo])
    await exec('git', ['-C', repo, 'config', 'user.email', 'a@b.c'])
    await exec('git', ['-C', repo, 'config', 'user.name', 'orca'])
    await writeFile(join(repo, 'f.txt'), 'x\n')
    await exec('git', ['-C', repo, 'add', '.'])
    await exec('git', ['-C', repo, 'commit', '-m', 'init'])
    const managed = await mkdtemp(join(tmpdir(), 'orca-ipc-managed-'))
    roots.push(managed)

    // renderer 가 실제로 보내는 형상 그대로 신뢰 경계를 건넌다.
    const parsed = SendChatMessageSchema.safeParse({
      sessionId: null,
      projectId: null,
      text: 'fix auth redirect',
      cwd: repo,
      worktreeIsolation: true,
      attachmentViews: []
    })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    const rows: Array<{ branch: string; worktreeRoot: string; baseOid: string }> = []
    const db = {
      insertManagedWorktree: (row: { branch: string; worktreeRoot: string; baseOid: string }) =>
        rows.push(row)
    } as unknown as DbQueries

    const result = await new WorktreeService(db, managed).prepare({
      sourceCwd: parsed.data.cwd!,
      firstPrompt: parsed.data.text
    })

    expect(result.kind).toBe('managed')
    // git 이 실제로 그 branch 를 그 경로에 만들었는지 — 서비스 반환값이 아니라 git 에게 묻는다.
    const listed = (await exec('git', ['-C', repo, 'worktree', 'list', '--porcelain'])).stdout
    expect(listed).toContain(rows[0].worktreeRoot)
    expect(listed).toContain(`branch refs/heads/${rows[0].branch}`)
    expect(rows[0].branch.startsWith('work/')).toBe(true)
    const head = (await exec('git', ['-C', repo, 'rev-parse', 'HEAD'])).stdout.trim()
    expect(rows[0].baseOid).toBe(head)
  })

  it('스키마가 막는 조합은 service 에 도달하지 않는다 (AC7)', () => {
    const base = {
      projectId: null,
      text: 'work',
      cwd: '/repo',
      worktreeIsolation: true,
      attachmentViews: []
    }
    expect(SendChatMessageSchema.safeParse({ ...base, sessionId: 's1' }).success).toBe(false)
    expect(
      SendChatMessageSchema.safeParse({ ...base, sessionId: null, forkFrom: 's1' }).success
    ).toBe(false)
    expect(
      SendChatMessageSchema.safeParse({ ...base, sessionId: null, handoffFrom: 's1' }).success
    ).toBe(false)
    expect(SendChatMessageSchema.safeParse({ ...base, sessionId: null }).success).toBe(true)
  })
})

// EP-04 음성 축 — 지금은 사실이지만 그것을 지키는 장치가 없었다(verify r11 D26).
// 프로세스를 여는 축과 infra 의 git 실행기를 부르는 축. 술어는 불변식의 주어다 —
// "feature 가 git 프로세스를 직접 만든다". `import` 지정자는 문자열이지만 산문이 아니라
// 코드라 **원문**에서 본다(`stripCommentsAndStrings` 가 문자열을 지운다).
const CHILD_PROCESS_IMPORT = /from\s*['"]node:child_process['"]/
const CALL_AXIS = /\brunGit\s*\(|\bexecFile\s*\(|\bspawn\s*\(/

describe('feature 는 git 명령을 직접 만들지 않는다 (EP-04)', () => {
  const featureRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const infraGit = join(featureRoot, '..', 'infra', 'git')
  const offends = (file: string): boolean =>
    CHILD_PROCESS_IMPORT.test(readFileSync(file, 'utf8')) ||
    CALL_AXIS.test(stripCommentsAndStrings(readFileSync(file, 'utf8')))

  it('features/** 어디에서도 git 프로세스를 직접 만들지 않는다', () => {
    // 대상 집합이 비면 아래 0건은 전수가 아니라 아무것도 안 본 결과다.
    const files = sourceFiles(featureRoot)
    expect(files.length).toBeGreaterThan(20)
    expect(files.filter(offends).map((f) => f.slice(featureRoot.length + 1))).toEqual([])
  })

  it('그 술어가 실제로 두 축을 본다 — 눈이 없는 0건은 전수의 증거가 아니다', () => {
    // 축마다 실제로 그것을 하는 파일에서 참을 본다. `runner.ts` 가 프로세스를 열고,
    // `git-cli.ts` 는 그 실행기를 부른다. 한 축이 눈이 멀면 여기서 드러난다.
    expect(offends(join(infraGit, 'runner.ts'))).toBe(true)
    expect(
      CALL_AXIS.test(stripCommentsAndStrings(readFileSync(join(infraGit, 'git-cli.ts'), 'utf8')))
    ).toBe(true)
    // 주석 속 `spawn(resume)` 같은 산문은 호출이 아니다 — 그것까지 세면 분모가 오염된다.
    expect(CALL_AXIS.test(stripCommentsAndStrings('// spawn( 예정'))).toBe(false)
  })
})
