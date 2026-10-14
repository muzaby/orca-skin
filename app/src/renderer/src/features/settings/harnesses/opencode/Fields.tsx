import { useI18n } from '../../../../shared/i18n'
import { SettingsRow } from '../../components/parts'
export function OpenCodeFields({
  executablePath,
  setExecutablePath
}: {
  executablePath: string
  setExecutablePath: (value: string) => void
}): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <SettingsRow
      label={tr('settings.harness.executablePath')}
      description={tr('settings.harness.executablePathHint')}
      stacked
    >
      <input
        value={executablePath}
        onChange={(event) => setExecutablePath(event.target.value)}
        aria-label={tr('settings.harness.executablePath')}
        placeholder={tr('settings.harness.executablePathPlaceholder')}
        className="rounded-md border border-border bg-bg px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-border-strong"
      />
    </SettingsRow>
  )
}
export function OpenCodeDescription(): React.JSX.Element {
  const { tr } = useI18n()
  return (
    <p className="m-0 text-[12px] leading-5 text-ink3">{tr('settings.harness.managedServer')}</p>
  )
}
