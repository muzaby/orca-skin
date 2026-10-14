import { HarnessFields, HarnessDescription } from '../harnesses/fields'
import { harnessPreferences } from '../harnesses/preferences'
import { useEffect, useState } from 'react'
import type { Backend } from '../../../../../shared/ipc'
import { HARNESS_CAPABILITIES, type HarnessPreferences } from '../../../../../shared/harness'
import { settingsApi } from '../../../shared/api/ipc'
import { useI18n } from '../../../shared/i18n'
import { Button } from '../../../shared/ui/Button'
import { AutoGrowTextarea } from '../../../shared/ui/AutoGrowTextarea'
import { SettingsGroup, SettingsRow } from './parts'

export function HarnessSettingsTab({ backend }: { backend: Backend }): React.JSX.Element {
  const { tr } = useI18n()
  const [saved, setSaved] = useState<HarnessPreferences | null>(null)
  const [instructions, setInstructions] = useState('')
  const [executablePath, setExecutablePath] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    void settingsApi
      .get()
      .then((settings) => {
        if (cancelled) return
        const value = settings.harnesses?.[backend] ?? { instructions: '' }
        setSaved(value)
        setInstructions(value.instructions)
        setExecutablePath(value.executablePath ?? '')
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : tr('settings.harness.loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [backend, revision, tr])

  const dirty =
    saved != null &&
    (instructions !== saved.instructions || executablePath.trim() !== (saved.executablePath ?? ''))
  const save = async (): Promise<void> => {
    if (!saved || saving || !dirty) return
    setSaving(true)
    setError(null)
    const value = harnessPreferences(backend, saved, instructions, executablePath)
    try {
      await settingsApi.set({ harnesses: { [backend]: value } })
      setSaved(value)
      setExecutablePath(value.executablePath ?? '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('settings.harness.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-harness-settings={backend}>
      <SettingsGroup title={HARNESS_CAPABILITIES[backend].label}>
        <p className="m-0 text-[12px] leading-5 text-ink3">{tr('settings.harness.description')}</p>
        <HarnessDescription backend={backend} />
        {loading && (
          <p role="status" className="text-[12px] text-ink3">
            {tr('common.loading')}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-bad/10 p-2 text-[12px] text-bad">
            {error}
          </p>
        )}
        {!loading && !saved && (
          <Button
            variant="contained"
            onClick={() => {
              setLoading(true)
              setError(null)
              setRevision((n) => n + 1)
            }}
          >
            {tr('settings.harness.retry')}
          </Button>
        )}
        {saved && !loading && (
          <>
            <fieldset
              disabled={saving}
              className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0 disabled:opacity-70"
            >
              <SettingsRow
                label={tr('settings.harness.instructions')}
                description={tr('settings.harness.instructionsHint')}
                stacked
              >
                <AutoGrowTextarea
                  value={instructions}
                  onChange={setInstructions}
                  ariaLabel={tr('settings.harness.instructions')}
                  placeholder={tr('settings.harness.instructionsPlaceholder')}
                  className="min-h-[100px] max-h-64"
                />
              </SettingsRow>
              <HarnessFields
                backend={backend}
                executablePath={executablePath}
                setExecutablePath={setExecutablePath}
              />
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button
                variant="contained"
                disabled={!dirty || saving}
                onClick={() => {
                  setInstructions(saved.instructions)
                  setExecutablePath(saved.executablePath ?? '')
                  setError(null)
                }}
              >
                {tr('common.cancel')}
              </Button>
              <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? tr('engine.form.saving') : tr('common.save')}
              </Button>
            </div>
          </>
        )}
      </SettingsGroup>
    </div>
  )
}
