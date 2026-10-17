import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ESLint } from 'eslint'

const eslint = new ESLint({ cache: false })
// Future harness fixtures intentionally have no files on disk. The import plugin's
// cycle graph requires a physical source file; ownership still uses the real config.
const virtualEslint = new ESLint({
  cache: false,
  overrideConfig: { rules: { 'import/no-cycle': 'off' } }
})
const forbiddenSdk = [
  "import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'; void createOpencodeClient",
  "export { createOpencodeClient } from '@opencode-ai/sdk/v2/client'",
  "export * from '@opencode-ai/sdk'",
  "void import('@opencode-ai/sdk/v2/client')",
  "require('@opencode-ai/sdk/v2/client')",
  "export type SDK = import('@opencode-ai/sdk/v2/client').OpencodeClient",
  "import sdk = require('@opencode-ai/sdk/v2/client'); void sdk"
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
      'harness/ownership'
    ],
    [
      'src/renderer/src/features/chat/harnesses/claude/presentation.ts',
      "import { openCodeTranscript } from '../opencode/presentation'; void openCodeTranscript",
      'harness/ownership'
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
    [
      'src/main/adapters/opencode/index.ts',
      "import { implementation } from './v1'; void implementation"
    ],
    [
      'src/main/adapters/opencode/v1/adapter.ts',
      "import type { SessionAdapter } from '../../common/types'; export type { SessionAdapter }"
    ],
    [
      'src/renderer/src/features/chat/harnesses/opencode/presentation.ts',
      "import type { AgentTranscriptPresentation } from '../contracts'; export type { AgentTranscriptPresentation }"
    ]
  ]) {
    const [result] = await eslint.lintText(source, { filePath })
    assert.deepEqual(
      result.messages.filter((m) =>
        [
          'harness/sdk-version',
          'harness/ownership',
          'boundaries/dependencies',
          'import/no-restricted-paths'
        ].includes(m.ruleId)
      ),
      []
    )
  }
})

function forms(target) {
  return [
    `import '${target}'`,
    `export { value } from '${target}'`,
    `export * from '${target}'`,
    `void import('${target}')`,
    `require('${target}')`,
    `export type Value = import('${target}').Value`,
    `import value = require('${target}'); void value`
  ]
}

test('ownership rejects every import form across sibling harnesses including future names', async () => {
  for (const [filePath, target] of [
    ['src/main/adapters/codex/adapter.ts', '../claude/adapter'],
    ['src/main/adapters/claude/adapter.ts', '../codex'],
    ['src/main/features/harnesses/claude/models.ts', '../opencode/models'],
    ['src/main/features/extensions/codex/deploy.ts', '../claude/deployer'],
    ['src/main/app/harnesses/opencode/index.ts', '../codex'],
    ['src/shared/harnesses/claude/model-policy.ts', '../codex/model-policy'],
    ['src/renderer/src/features/chat/harnesses/codex/presentation.ts', '../opencode/presentation'],
    [
      'src/renderer/src/features/engine/harnesses/claude/configuration.ts',
      '../codex/configuration'
    ],
    [
      'src/renderer/src/features/chat/harnesses/opencode/presentation.ts',
      '@renderer/features/chat/harnesses/claude/presentation'
    ]
  ]) {
    for (const source of forms(target)) {
      const [result] = await virtualEslint.lintText(source, { filePath })
      assert.ok(
        result.messages.some((m) => m.ruleId === 'harness/ownership' && m.messageId === 'sibling'),
        `${filePath}: ${source}`
      )
    }
  }
})

test('common modules cannot reach concrete implementations or selection registries', async () => {
  for (const [filePath, target] of [
    ['src/main/adapters/common/registry.ts', '../claude/adapter'],
    ['src/main/features/harnesses/common/settings.ts', '../claude/model-parser'],
    ['src/main/features/extensions/common/deploy.ts', '../claude/deployer'],
    ['src/main/app/harnesses/common/policy.ts', '../registry'],
    ['src/shared/harnesses/common/policy.ts', '../codex/policy'],
    [
      'src/renderer/src/features/chat/harnesses/common/composer/Input.tsx',
      '../../opencode/composer/Controls'
    ],
    [
      'src/renderer/src/features/chat/harnesses/common/transcript/Message.tsx',
      '../../registries/transcript'
    ],
    ['src/renderer/src/features/chat/harnesses/common/transcript/Message.tsx', '../../catalog'],
    [
      'src/renderer/src/features/engine/common/components/Form.tsx',
      '../../harnesses/configuration'
    ],
    [
      'src/renderer/src/features/settings/common/components/Form.tsx',
      '@renderer/features/settings/harnesses/opencode/Fields'
    ]
  ]) {
    for (const source of forms(target)) {
      const [result] = await virtualEslint.lintText(source, { filePath })
      assert.ok(
        result.messages.some((m) => m.ruleId === 'harness/ownership' && m.messageId === 'common'),
        `${filePath}: ${source}`
      )
    }
  }
})

test('composition, same-harness and neutral contracts remain usable for any harness name', async () => {
  for (const [filePath, target] of [
    ['src/main/app/harnesses/registry.ts', './codex'],
    ['src/main/app/harnesses/codex/index.ts', '../../../adapters/codex/adapter'],
    ['src/main/adapters/codex/adapter.ts', '../common/types'],
    ['src/main/adapters/common/registry.ts', './types'],
    ['src/main/features/harnesses/common/settings.ts', './models'],
    ['src/main/features/harnesses/codex/models.ts', '../common/models'],
    [
      'src/renderer/src/features/chat/harnesses/registries/transcript.tsx',
      '../codex/transcript/Timeline'
    ],
    [
      'src/renderer/src/features/chat/harnesses/codex/transcript/Timeline.tsx',
      '../../common/transcript/UserMessage'
    ],
    [
      'src/renderer/src/features/chat/harnesses/common/transcript/UserMessage.tsx',
      '../../contracts'
    ],
    ['src/renderer/src/features/engine/common/components/Form.tsx', '../../harnesses/types'],
    [
      'src/renderer/src/features/chat/harnesses/opencode/transcript/ToolCard.tsx',
      '@renderer/features/chat/harnesses/opencode/toolPresentation'
    ]
  ]) {
    for (const source of forms(target)) {
      const [result] = await virtualEslint.lintText(source, { filePath })
      assert.deepEqual(
        result.messages.filter((m) => m.ruleId === 'harness/ownership'),
        [],
        `${filePath}: ${source}`
      )
    }
  }
})

test('renderer aliases cannot bypass the OpenCode version facade', async () => {
  for (const source of forms('@renderer/features/chat/harnesses/opencode/v1/toolPresentation')) {
    const [result] = await eslint.lintText(source, {
      filePath: 'src/renderer/src/features/chat/harnesses/opencode/transcript/ToolCard.tsx'
    })
    assert.ok(
      result.messages.some((m) => m.ruleId === 'harness/version-boundary'),
      source
    )
  }
})

test('native version imports require the facade and cannot cross version trees', async () => {
  for (const [filePath, target] of [
    ['src/main/app/bootstrap.ts', '../adapters/opencode/v1/adapter'],
    ['src/main/adapters/opencode/implementation.ts', './v1/adapter'],
    ['src/main/adapters/opencode/v1/adapter.ts', '../v2/adapter'],
    [
      'src/renderer/src/features/chat/harnesses/opencode/transcript/ToolCard.tsx',
      '../v1/toolPresentation'
    ],
    [
      'src/renderer/src/features/chat/harnesses/opencode/v1/toolPresentation.ts',
      '../v2/toolPresentation'
    ]
  ]) {
    for (const source of [
      `import '${target}'`,
      `export * from '${target}'`,
      `void import('${target}')`,
      `require('${target}')`
    ]) {
      const [result] = await eslint.lintText(source, { filePath })
      assert.ok(
        result.messages.some((m) => m.ruleId === 'harness/version-boundary'),
        `${filePath}: ${source}`
      )
    }
  }
  for (const [filePath, source] of [
    [
      'src/main/app/bootstrap.ts',
      "import {createOpenCodeAdapter} from '../adapters/opencode'; void createOpenCodeAdapter"
    ],
    [
      'src/main/adapters/opencode/index.ts',
      "import {implementation} from './v1'; void implementation"
    ],
    ['src/main/adapters/opencode/v1/adapter.ts', "import './map'"],
    [
      'src/renderer/src/features/chat/harnesses/opencode/toolPresentation.ts',
      "export {describeTool} from './v1/toolPresentation'"
    ]
  ]) {
    const [result] = await eslint.lintText(source, { filePath })
    assert.equal(result.messages.filter((m) => m.ruleId === 'harness/version-boundary').length, 0)
  }
})
