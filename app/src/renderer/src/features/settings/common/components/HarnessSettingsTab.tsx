import type { HarnessSettingsConfiguration, HarnessSettingsDraft } from '../../harnesses/types'
import { useEffect, useState } from 'react'
import type { Backend } from '../../../../../../shared/ipc'
import { HARNESS_CAPABILITIES, type HarnessPreferences } from '../../../../../../shared/harness'
import { settingsApi } from '../../../../shared/api/ipc'
import { useI18n } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { AutoGrowTextarea } from '../../../../shared/ui/AutoGrowTextarea'
import { SettingsGroup, SettingsRow } from '../../components/parts'

export function HarnessSettingsTab({
  backend,
  configuration
}: {
  backend: Backend
  configuration: HarnessSettingsConfiguration
}): React.JSX.Element {
  const { tr } = useI18n()
  const [saved, setSaved] = useState<HarnessPreferences | null>(null)
  const [draft, setDraft] = useState<HarnessSettingsDraft>({ instructions: '', fields: {} })
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
        setDraft(configuration.createDraft(value))
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
  }, [backend, configuration, revision, tr])

  const dirty = saved != null && configuration.isDirty(saved, draft)
  const save = async (): Promise<void> => {
    if (!saved || saving || !dirty) return
    setSaving(true)
    setError(null)
    const value = configuration.serialize(saved, draft)
    try {
      await settingsApi.set({ harnesses: { [backend]: value } })
      setSaved(value)
      setDraft(configuration.createDraft(value))
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
        <configuration.Description />
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
                  value={draft.instructions}
                  onChange={(instructions) => setDraft({ ...draft, instructions })}
                  ariaLabel={tr('settings.harness.instructions')}
                  placeholder={tr('settings.harness.instructionsPlaceholder')}
                  className="min-h-[100px] max-h-64"
                />
              </SettingsRow>
              <configuration.Fields draft={draft} onChange={setDraft} />
            </fieldset>
            <div className="flex justify-end gap-2">
              <Button
                variant="contained"
                disabled={!dirty || saving}
                onClick={() => {
                  setDraft(configuration.createDraft(saved))
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
