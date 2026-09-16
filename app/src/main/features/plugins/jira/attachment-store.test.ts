import { mkdtemp, mkdir, readFile, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { createJiraAttachmentStore, sanitizeAttachmentFilename } from './attachment-store'

const roots: string[] = []
const root = async (): Promise<string> => {
  const value = await mkdtemp(join(tmpdir(), 'orca-jira-store-'))
  roots.push(value)
  return value
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(
    roots.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

describe('Jira attachment store', () => {
  it.each([
    ['../secret.txt', 'secret.txt'],
    ['CON', '_CON'],
    ['a/b\\c?.txt', 'c_.txt'],
    ['trailing. ', 'trailing']
  ])('%s를 Windows-safe basename %s로 만든다', (input, expected) => {
    expect(sanitizeAttachmentFilename(input)).toBe(expected)
  })

  it('길이 제한으로 잘린 이름도 Windows 금지 종결 문자를 남기지 않는다', () => {
    expect(sanitizeAttachmentFilename(`${'a'.repeat(119)}.txt`)).not.toMatch(/[. ]$/)
  })

  it('write 완료 전과 publish 전에는 final path가 보이지 않고 publish는 batch directory rename이다', async () => {
    const directory = await root()
    const store = createJiraAttachmentStore({ root: directory })
    const batch = await store.begin('jira-corp', 'issue-QA-1')
    const first = await batch.write('report.txt', Buffer.from('one'))
    const second = await batch.write('report.txt', Buffer.from('two'))

    await expect(stat(first.savedPath)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(second.filename).toBe('report (2).txt')

    await batch.commit()
    await expect(readFile(first.savedPath, 'utf8')).resolves.toBe('one')
    await expect(readFile(second.savedPath, 'utf8')).resolves.toBe('two')
    expect(resolve(first.savedPath).startsWith(resolve(directory, 'jira') + '\\')).toBe(true)
  })

  it('abort는 현재 stage 전체를 지우고 final을 만들지 않는다', async () => {
    const directory = await root()
    const batch = await createJiraAttachmentStore({ root: directory }).begin(
      'jira-corp',
      'attachment-42'
    )
    const written = await batch.write('a.txt', Buffer.from('a'))
    await batch.abort()
    await expect(stat(written.savedPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('publish 대상 batch가 이미 있으면 기존 파일을 덮어쓰지 않는다', async () => {
    const directory = await root()
    const batch = await createJiraAttachmentStore({ root: directory }).begin(
      'jira-corp',
      'attachment-42'
    )
    const written = await batch.write('a.txt', Buffer.from('new'))
    await mkdir(dirname(written.savedPath))
    await writeFile(written.savedPath, 'existing')

    await expect(batch.commit()).rejects.toThrow('filesystem_error')
    await expect(readFile(written.savedPath, 'utf8')).resolves.toBe('existing')
  })

  it('selector ancestor가 junction이면 root 탈출 전에 거부한다', async () => {
    const directory = await root()
    const outside = await root()
    const selector = join(directory, 'jira', 'jira-corp', 'issue-QA-1')
    await mkdir(join(directory, 'jira', 'jira-corp'), { recursive: true })
    await symlink(outside, selector, 'junction')

    await expect(
      createJiraAttachmentStore({ root: directory }).begin('jira-corp', 'issue-QA-1')
    ).rejects.toThrow('filesystem_error')
  })

  it('24시간 지난 real stage만 다음 prepare에서 정리한다', async () => {
    const directory = await root()
    const stale = join(directory, 'jira', 'jira-corp', 'issue-QA-1', '.staging', 'stale')
    await mkdir(stale, { recursive: true })
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000)
    await utimes(stale, old, old)

    const fresh = await createJiraAttachmentStore({ root: directory }).begin(
      'jira-corp',
      'issue-QA-1'
    )
    await expect(stat(stale)).rejects.toMatchObject({ code: 'ENOENT' })
    await fresh.abort()
  })
})
