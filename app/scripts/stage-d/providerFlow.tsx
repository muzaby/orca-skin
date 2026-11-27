import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { EngineFormModal } from '@renderer/features/engine/components/EngineFormModal'
import { validateSettingsJson } from '@renderer/features/engine/common/lib/providerCatalog'
import { importedProviders } from '@renderer/features/engine/harnesses/opencode/v1/customProvider'
import { editInput, frame } from './domInput'

export async function measureProviderFlow(comparison = false): Promise<unknown> {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const previous = window.oo
  const noop = (): void => {}
  const name = 'stage-d'
  const models = Object.fromEntries(
    Array.from({ length: 10_000 }, (_, index) => ['m' + index, { name: 'Model ' + index }])
  )
  const body = { provider: { fixture: { npm: '@ai-sdk/openai-compatible', models } }, padding: '' }
  const target = 307845
  body.padding = 'x'.repeat(target - JSON.stringify(body).length)
  const json = JSON.stringify(body)
  let resolveImport: (result: { exists: boolean; settingsJson: string }) => void = noop
  let sent = ''
  Object.assign(window, {
    oo: {
      engine: {
        importUserSettings: () =>
          new Promise((resolve) => {
            resolveImport = resolve
          })
      }
    }
  })
  try {
    flushSync(() =>
      root.render(
        <EngineFormModal
          mode="edit"
          engine="claude"
          provider={name}
          initialSettingsJson="{}"
          onClose={noop}
          onSubmit={async (value) => {
            sent = value.settingsJson
          }}
        />
      )
    )
    const area = document.querySelector<HTMLTextAreaElement>('[aria-label="settings.json"]')!
    const dialog = area.closest('[role=dialog]')!
    const load = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button[title]')).find((x) =>
      x.parentElement?.parentElement?.contains(area)
    )!
    const submit = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).at(-1)!
    const invalid = '{\n  "a": 1\n  "b": 2\n}'
    const times: Record<string, number>[] = []
    for (const value of [json, invalid, json]) {
      const start = performance.now()
      flushSync(() => editInput(area, value))
      const commit = performance.now()
      await frame()
      const paint = await frame()
      if (submit.disabled === (value !== invalid)) throw Error('incorrect form validation')
      if (value === invalid) {
        const error = validateSettingsJson(value)
        if (error.ok || error.params?.line !== 3 || error.params?.col !== 3)
          throw Error('missing error position')
      }
      times.push({ characters: value.length, commitMs: commit - start, paintMs: paint - commit })
    }
    flushSync(() => load.click())
    const latest = '{"corrected":true}'
    flushSync(() => editInput(area, latest))
    resolveImport({ exists: true, settingsJson: '{"obsolete":true}' })
    await frame()
    const obsoleteDiscarded = area.value === latest
    if (!comparison && !obsoleteDiscarded) throw Error('late import replaced edit')
    flushSync(() => load.click())
    resolveImport({ exists: true, settingsJson: json })
    await frame()
    flushSync(() => submit.click())
    if (sent !== json || importedProviders(sent)[0].models.at(-1)?.id !== 'm9999')
      throw Error('incorrect provider save')
    const unsupported = JSON.stringify({ provider: { unsupported: { npm: 'unsupported' } } })
    if (importedProviders(unsupported).length !== 0) throw Error('unsupported provider imported')
    return {
      characters: json.length,
      edits: times,
      storedCharacters: sent.length,
      obsoleteDiscarded,
      errorPosition: [3, 3]
    }
  } finally {
    root.unmount()
    host.remove()
    Object.assign(window, { oo: previous })
  }
}
