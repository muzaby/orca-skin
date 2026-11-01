import { useEffect, useRef, useState } from 'react'
import { engineApi } from '../../../../shared/api/ipc'
import { useI18n, type MessageKey } from '../../../../shared/i18n'
import { Button } from '../../../../shared/ui/Button'
import { Icon } from '../../../../shared/ui/Icon'
import { Modal } from '../../../../shared/ui/Modal'
import type { EngineFormModalProps } from '../../common/components/EngineFormModal'
import {
  emptyProviderDraft,
  importedProviders,
  serializeProviderDraft,
  validateProviderDraft
} from './index'
import type { ProviderDraft } from './providerForm.types'

const inputClass =
  'min-w-0 w-full rounded-lg border border-border bg-bg px-3 py-2 text-[13px] text-ink outline-none focus:border-border-strong disabled:opacity-60'

function Field({
  label,
  value,
  placeholder,
  secret,
  error,
  disabled,
  onChange
}: {
  label: string
  value: string
  placeholder?: string
  secret?: boolean
  error?: string
  disabled?: boolean
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-[12px] font-medium text-ink2">
      <span>{label}</span>
      <input
        aria-label={label}
        type={secret ? 'password' : 'text'}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        className={inputClass}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <span className="text-[11.5px] text-bad">{error}</span>}
    </label>
  )
}

function RowListEditor<Row extends { row: string }>({
  label,
  rows,
  fields,
  disabled,
  error,
  addLabel,
  removeLabel,
  create,
  onChange
}: {
  label: string
  rows: Row[]
  fields: Array<{ key: keyof Row; label(index: number): string; placeholder: string }>
  disabled: boolean
  error(key: string): string | undefined
  addLabel: string
  removeLabel(index: number): string
  create(): Row
  onChange(rows: Row[]): void
}): React.JSX.Element {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" disabled={disabled}>
      <legend className="mb-3 text-[12px] font-medium text-ink2">{label}</legend>
      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <div key={row.row} className="flex items-start gap-2">
            {fields.map((field) => (
              <Field
                key={String(field.key)}
                label={field.label(index)}
                value={String(row[field.key])}
                placeholder={field.placeholder}
                error={error(row.row + '.' + String(field.key))}
                onChange={(value) =>
                  onChange(
                    rows.map((item) => (item === row ? { ...item, [field.key]: value } : item))
                  )
                }
              />
            ))}
            <Button
              className="mt-6 shrink-0"
              iconOnly
              leadingIcon="trash"
              disabled={rows.length <= 1}
              aria-label={removeLabel(index)}
              onClick={() => onChange(rows.filter((item) => item !== row))}
            />
          </div>
        ))}
      </div>
      <Button
        className="mt-2"
        size="small"
        leadingIcon="plus"
        onClick={() => onChange([...rows, create()])}
      >
        {addLabel}
      </Button>
    </fieldset>
  )
}

export function OpenCodeProviderForm({
  busy = false,
  onClose,
  onSubmit
}: EngineFormModalProps): React.JSX.Element {
  const { tr } = useI18n()
  const [draft, setDraft] = useState(emptyProviderDraft)
  const [imports, setImports] = useState<ProviderDraft[]>([])
  const [importedId, setImportedId] = useState('')
  const [importing, setImporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, MessageKey>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const importRevision = useRef(0),
    importPending = useRef(false),
    submitting = useRef(false)
  const rowId = useRef(0)
  const disabled = busy || saving
  useEffect(
    () => () => {
      importRevision.current += 1
    },
    []
  )
  const invalidateImport = (): void => {
    importRevision.current += 1
    importPending.current = false
    setImporting(false)
  }
  const update = (next: ProviderDraft): void => {
    invalidateImport()
    setNotice(null)
    setErrors({})
    setDraft(next)
  }
  const close = (): void => {
    invalidateImport()
    onClose()
  }
  const error = (key: string): string | undefined => (errors[key] ? tr(errors[key]) : undefined)
  const load = async (): Promise<void> => {
    if (disabled || importPending.current) return
    const revision = ++importRevision.current
    importPending.current = true
    setImporting(true)
    setNotice(null)
    try {
      const result = await engineApi.importUserSettings('opencode')
      if (revision !== importRevision.current) return
      if (!result.exists) {
        setNotice(tr('engine.form.openCodeImportNotFound'))
        return
      }
      const values = importedProviders(result.settingsJson)
      if (!values.length) {
        setNotice(tr('engine.openCode.importUnsupported'))
        return
      }
      setImports(values)
      const selected = values.find((value) => value.id === draft.id) ?? values[0]
      setImportedId(selected.id)
      setDraft(selected)
      setErrors({})
    } catch {
      if (revision === importRevision.current) setNotice(tr('engine.form.openCodeImportFailed'))
    } finally {
      if (revision === importRevision.current) {
        importPending.current = false
        setImporting(false)
      }
    }
  }
  const submit = async (): Promise<void> => {
    if (disabled || importPending.current || submitting.current) return
    const nextErrors = validateProviderDraft(draft)
    setErrors(nextErrors)
    setNotice(null)
    if (Object.keys(nextErrors).length) return
    submitting.current = true
    setSaving(true)
    try {
      await onSubmit({
        engine: 'opencode',
        provider: draft.id.trim(),
        settingsJson: serializeProviderDraft(draft)
      })
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : tr('engine.form.saveFailed'))
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  return (
    <Modal
      open
      onClose={close}
      ariaLabel={tr('engine.form.titleAdd')}
      panelClassName="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-r6 border border-border bg-panel shadow-xl"
    >
      <div className="border-b border-border px-6 pb-3.5 pt-4">
        <h2 className="m-0 font-serif text-[18px] font-semibold text-ink">
          {tr('engine.form.titleAdd')}
        </h2>
      </div>
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="flex items-center text-[12px] text-ink2">
            <span className="rounded-md bg-sidebar px-2 py-0.5 font-medium text-ink">OpenCode</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-ink2">{tr('engine.form.provider')}</span>
            <button
              type="button"
              title={tr('engine.openCode.importHint')}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-medium text-ink2 hover:bg-sidebar hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled || importing}
              onClick={() => void load()}
            >
              <Icon name="fileOpen" size={13} />
              {importing ? tr('common.loading') : tr('engine.form.openCodeImportButton')}
            </button>
          </div>
          {imports.length > 1 && (
            <label className="flex flex-col gap-1.5 text-[12px] text-ink2">
              {tr('engine.openCode.importedProvider')}
              <select
                aria-label={tr('engine.openCode.importedProvider')}
                value={importedId}
                disabled={disabled}
                className={inputClass}
                onChange={(event) => {
                  const value = imports.find((item) => item.id === event.target.value)
                  if (value) {
                    setImportedId(value.id)
                    update(value)
                  }
                }}
              >
                {imports.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name} ({value.id})
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 items-start gap-3">
              <div className="flex flex-col gap-1.5">
                <Field
                  label={tr('engine.openCode.id')}
                  value={draft.id}
                  placeholder="myprovider"
                  error={error('id')}
                  disabled={disabled}
                  onChange={(id) => update({ ...draft, id })}
                />
                <span className="text-[11px] text-ink3">{tr('engine.openCode.idHint')}</span>
              </div>
              <Field
                label={tr('engine.openCode.name')}
                value={draft.name}
                placeholder={tr('engine.openCode.namePlaceholder')}
                error={error('name')}
                disabled={disabled}
                onChange={(name) => update({ ...draft, name })}
              />
            </div>
            <Field
              label={tr('engine.openCode.baseURL')}
              value={draft.baseURL}
              placeholder="https://api.myprovider.com/v1"
              error={error('baseURL')}
              disabled={disabled}
              onChange={(baseURL) => update({ ...draft, baseURL })}
            />
            <div className="flex flex-col gap-1.5">
              <Field
                secret
                label={tr('engine.openCode.apiKey')}
                value={draft.apiKey}
                placeholder={tr('engine.openCode.apiKey')}
                disabled={disabled}
                onChange={(apiKey) => update({ ...draft, apiKey })}
              />
              <span className="text-[11px] text-ink3">{tr('engine.openCode.apiKeyHint')}</span>
            </div>
          </div>
          <RowListEditor
            label={tr('engine.openCode.models')}
            rows={draft.models}
            disabled={disabled}
            error={error}
            fields={[
              {
                key: 'id',
                label: (index) => tr('engine.openCode.modelId', { count: index + 1 }),
                placeholder: 'model-id'
              },
              {
                key: 'name',
                label: (index) => tr('engine.openCode.modelName', { count: index + 1 }),
                placeholder: tr('engine.openCode.name')
              }
            ]}
            addLabel={tr('engine.openCode.addModel')}
            removeLabel={(index) => tr('engine.openCode.removeModel', { count: index + 1 })}
            create={() => ({ row: 'new-model-' + ++rowId.current, id: '', name: '' })}
            onChange={(models) => update({ ...draft, models })}
          />
          <RowListEditor
            label={tr('engine.openCode.headers')}
            rows={draft.headers}
            disabled={disabled}
            error={error}
            fields={[
              {
                key: 'key',
                label: (index) => tr('engine.openCode.headerKey', { count: index + 1 }),
                placeholder: tr('engine.openCode.headerKeyPlaceholder')
              },
              {
                key: 'value',
                label: (index) => tr('engine.openCode.headerValue', { count: index + 1 }),
                placeholder: tr('engine.openCode.headerValuePlaceholder')
              }
            ]}
            addLabel={tr('engine.openCode.addHeader')}
            removeLabel={(index) => tr('engine.openCode.removeHeader', { count: index + 1 })}
            create={() => ({ row: 'new-header-' + ++rowId.current, key: '', value: '' })}
            onChange={(headers) => update({ ...draft, headers })}
          />
          {notice && (
            <p role="alert" className="m-0 rounded-lg bg-bad/10 px-3 py-2 text-[12px] text-bad">
              {notice}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-6 py-3.5">
          <Button variant="contained" onClick={close}>
            {tr('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={disabled || importing}>
            {saving || busy ? tr('engine.form.adding') : tr('engine.form.addAction')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
