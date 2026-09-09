import { describe, expect, it } from 'vitest'
import {
  parseClaudeModels,
  parseRuntimeModels
} from '../../../../../../main/features/harnesses/claude/model-parser'
import type { AgentEnvironment } from '../../../../../../shared/ipc'
import { modelIdentity } from '../../../../../../shared/model-identity'
import { coerceAutoPermissionModeForModelName } from '../../../../../../shared/permission-mode'
import { selectedModelShape } from './modelSelection'
import { modeMenuOptions } from './modes'

describe('model variants through discovery, Composer and execution policy', () => {
  for (const name of [
    'claudecode-sonnet-5',
    'claudecode-opus-4.8',
    'claudecode-opus-4.8[1m]',
    'claudecode-opus-4-8[1m]',
    'claudecode-haiku-4.6',
    'claudecode-fable-4-6'
  ]) {
    for (const source of ['settings', 'runtime'] as const) {
      it(`${source}: ${name}`, () => {
        const models =
          source === 'settings'
            ? parseClaudeModels({ env: { ANTHROPIC_MODEL: name } })
            : parseRuntimeModels({ availableModels: [name] })
        const selected = models.find((model) => modelIdentity(model) === name)!
        expect(selected.isCustom).toBe(false)
        const agent: AgentEnvironment = {
          key: 'fixture',
          adapter: 'claude',
          supported: true,
          models
        }
        const shape = selectedModelShape([agent], {
          providerKey: agent.key,
          adapter: 'claude',
          modelFamily: name,
          modelAlias: selected.alias
        })
        for (const kind of ['work', 'coding'] as const) {
          expect(
            modeMenuOptions(shape, kind).some((option) => option.mode === 'auto_classified')
          ).toBe(true)
          expect(coerceAutoPermissionModeForModelName('auto_classified', name, kind)).toBe(
            'auto_classified'
          )
          expect(
            modeMenuOptions({ ...shape!, isCustom: true }, kind).some(
              (option) => option.mode === 'auto_classified'
            )
          ).toBe(false)
        }
      })
    }
  }
})
