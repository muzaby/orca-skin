import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ESLint } from 'eslint'

const eslint = new ESLint({ cache: false })
const cases = [
  [
    'external relative runner',
    'src/main/features/worktrees/service.ts',
    "import { runGit } from '../../infra/git/runner'; void runGit",
    'import/no-restricted-paths'
  ],
  [
    'internal relative runner',
    'src/main/infra/git/repository.ts',
    "import { runGit } from './runner'; void runGit",
    'import/no-restricted-paths'
  ],
  [
    'runner re-export',
    'src/main/infra/git/repository.ts',
    "export { runGit } from './runner'",
    'import/no-restricted-paths'
  ],
  [
    'dynamic runner',
    'src/main/infra/git/repository.ts',
    "void import('./runner')",
    'import/no-restricted-paths'
  ],
  [
    'child_process',
    'src/main/features/worktrees/service.ts',
    "import { execFile } from 'child_process'; void execFile",
    'no-restricted-imports'
  ],
  [
    'node:child_process',
    'src/main/features/worktrees/service.ts',
    "import { execFile } from 'node:child_process'; void execFile",
    'no-restricted-imports'
  ],
  [
    'dynamic child_process',
    'src/main/features/worktrees/service.ts',
    "void import('node:child_process')",
    'no-restricted-syntax'
  ]
]
for (const [name, filePath, source, ruleId] of cases) {
  test(`Git boundary rejects ${name}`, async () => {
    const [result] = await eslint.lintText(source, { filePath })
    assert.ok(
      result.messages.some((message) => message.ruleId === ruleId && message.severity === 2),
      JSON.stringify(result.messages)
    )
  })
}

test('Git gateway and runner are the permitted execution boundary', async () => {
  for (const [filePath, source] of [
    ['src/main/infra/git/gateway.ts', "import { runGit } from './runner'; void runGit"],
    ['src/main/infra/git/runner.ts', "import { execFile } from 'node:child_process'; void execFile"]
  ]) {
    const [result] = await eslint.lintText(source, { filePath })
    assert.deepEqual(
      result.messages.filter((message) =>
        ['no-restricted-imports', 'no-restricted-syntax', 'import/no-restricted-paths'].includes(
          message.ruleId
        )
      ),
      []
    )
  }
})
