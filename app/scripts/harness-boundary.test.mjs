import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ESLint } from 'eslint'

const eslint = new ESLint({ cache: false })
const forbiddenSdk = [
  "import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'; void createOpencodeClient",
  "export { createOpencodeClient } from '@opencode-ai/sdk/v2/client'",
  "export * from '@opencode-ai/sdk'",
  "void import('@opencode-ai/sdk/v2/client')",
  "require('@opencode-ai/sdk/v2/client')"
]
test('OpenCode SDK imports stay inside v1, including re-exports and dynamic access', async () => {
  for (const source of forbiddenSdk) {
    for (const filePath of [
      'src/main/adapters/opencode/index.ts',
      'src/renderer/src/features/engine/harnesses/opencode/index.ts'
    ]) {
      const [result] = await eslint.lintText(source, { filePath })
      assert.ok(
        result.messages.some((m) => m.ruleId === 'harness/sdk-version'),
        JSON.stringify(result.messages)
      )
    }
    const [allowed] = await eslint.lintText(source, {
      filePath: 'src/main/adapters/opencode/v1/adapter.ts'
    })
    assert.equal(allowed.messages.filter((m) => m.ruleId === 'harness/sdk-version').length, 0)
  }
})
test('harness implementations cannot import their sibling implementation', async () => {
  const cases = [
    [
      'src/main/adapters/opencode/v1/adapter.ts',
      "import { ClaudeAdapter } from '../../claude/adapter'; void ClaudeAdapter",
      'boundaries/dependencies'
    ],
    [
      'src/main/adapters/claude/adapter.ts',
      "import { OpenCodeAdapter } from '../opencode/v1/adapter'; void OpenCodeAdapter",
      'boundaries/dependencies'
    ],
    [
      'src/renderer/src/features/chat/harnesses/opencode/presentation.ts',
      "import { agentPresentation } from '../claude/presentation'; void agentPresentation",
      'import/no-restricted-paths'
    ],
    [
      'src/renderer/src/features/chat/harnesses/claude/presentation.ts',
      "import { openCodeTranscript } from '../opencode/presentation'; void openCodeTranscript",
      'import/no-restricted-paths'
    ]
  ]
  for (const [filePath, source, rule] of cases) {
    const [result] = await eslint.lintText(source, { filePath })
    assert.ok(
      result.messages.some((m) => m.ruleId === rule),
      JSON.stringify(result.messages)
    )
  }
})
test('common ports and same-harness version selection remain allowed', async () => {
  for (const [filePath, source] of [
    ['src/main/adapters/opencode/index.ts', "export { OpenCodeAdapter } from './v1/adapter'"],
    [
      'src/main/adapters/opencode/v1/adapter.ts',
      "import type { SessionAdapter } from '../../types'; export type { SessionAdapter }"
    ],
    [
      'src/renderer/src/features/chat/harnesses/opencode/presentation.ts',
      "import type { AgentTranscriptPresentation } from '../../lib/agentPresentation'; export type { AgentTranscriptPresentation }"
    ]
  ]) {
    const [result] = await eslint.lintText(source, { filePath })
    assert.deepEqual(
      result.messages.filter((m) =>
        ['harness/sdk-version', 'boundaries/dependencies', 'import/no-restricted-paths'].includes(
          m.ruleId
        )
      ),
      []
    )
  }
})
