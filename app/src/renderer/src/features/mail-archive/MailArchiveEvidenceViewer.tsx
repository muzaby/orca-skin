import { useEffect, useRef } from 'react'
import type { ArchiveEvidenceResult } from '../../../../shared/mail-archive-plugin'
import { Modal } from '../../shared/ui/Modal'
import { useI18n } from '../../shared/i18n'

export function MailArchiveEvidenceViewer({
  result,
  loading,
  error,
  onClose
}: {
  result: ArchiveEvidenceResult | null
  loading: boolean
  error: boolean
  onClose(): void
}): React.JSX.Element {
  const { tr: t } = useI18n()
  const close = useRef<HTMLButtonElement>(null)
  const mark = useRef<HTMLElement>(null)
  useEffect(() => {
    close.current?.focus({ preventScroll: true })
  }, [])
  useEffect(() => {
    mark.current?.scrollIntoView({ block: 'center' })
  }, [result])
  const available = result?.state === 'available' ? result : null
  return (
    <Modal open title={t('mailArchivePlugin.evidence')} onClose={onClose} width={820}>
      <div
        data-mail-archive-evidence=""
        onKeyDown={(event) => {
          // This viewer contains only the close action. Keep keyboard focus in the dialog.
          if (event.key === 'Tab') {
            event.preventDefault()
            close.current?.focus()
          }
        }}
      >
        {loading ? (
          <p role="status">{t('common.loading')}</p>
        ) : error ? (
          <p role="alert">{t('mailArchivePlugin.failed')}</p>
        ) : available ? (
          <>
            <h3 className="break-words font-semibold text-ink">
              {available.mail.subject || t('mailArchive.noSubject')}
            </h3>
            <p className="mt-1 break-words text-[12px] text-ink3">
              {available.mail.from} ·{' '}
              {available.mail.date === null
                ? t('mailArchive.noDate')
                : new Date(available.mail.date).toLocaleString()}
            </p>
            <p className="mb-3 break-words text-[12px] text-ink3">
              {available.mail.sourceName} · {available.mail.folderPath}
            </p>
            {available.mail.bodyQualityFlags.includes('decode_suspect') && (
              <p className="mb-2 text-warn">{t('mailArchive.decodeSuspect')}</p>
            )}
            <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words font-sans text-[12.5px] leading-[1.7] text-ink2">
              {available.mail.bodyText.slice(0, available.evidence.start)}
              <mark ref={mark} className="bg-fill-uncontained-active text-ink">
                {available.evidence.text}
              </mark>
              {available.mail.bodyText.slice(available.evidence.end)}
            </pre>
          </>
        ) : (
          <p role="status">
            {t(
              result?.state === 'removed'
                ? 'mailArchivePlugin.evidenceRemoved'
                : 'mailArchivePlugin.evidenceForbidden'
            )}
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <button
            ref={close}
            type="button"
            onClick={onClose}
            className="rounded-r4 border border-border px-4 py-2 text-ink"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
