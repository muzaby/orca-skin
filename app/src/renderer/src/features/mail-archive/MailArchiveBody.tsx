import { useState } from 'react'
import { useI18n } from '../../shared/i18n'
import type { MailArchiveMessage } from '../../../../shared/mail-archive'

export function MailArchiveBody({
  message,
  query
}: {
  message: MailArchiveMessage
  query: string
}): React.JSX.Element {
  const { tr: t } = useI18n()
  const [alternate, setAlternate] = useState(false)
  const [full, setFull] = useState(false)
  const body = alternate ? message.bodyAlternateText : message.bodyText
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const textClass =
    'whitespace-pre-wrap break-words font-sans text-[12.5px] leading-[1.7] text-ink2'
  return (
    <section aria-label={t('mailArchive.body')}>
      {message.bodyQualityFlags.includes('decode_suspect') && (
        <p className="mb-2 text-[12px] text-warn">{t('mailArchive.decodeSuspect')}</p>
      )}
      {message.bodyQualityFlags.includes('alternative_mismatch') && (
        <p className="mb-2 text-[12px] text-ink3">{t('mailArchive.alternativeMismatch')}</p>
      )}
      {message.bodyAlternateOmitted && (
        <p className="mb-2 text-[12px] text-ink3">{t('mailArchive.alternateOmitted')}</p>
      )}
      <details className="mb-3 rounded-r4 border border-border px-3 py-2 text-[11px] text-ink3">
        <summary className="cursor-pointer">{t('mailArchive.bodyInfo')}</summary>
        <p className="mt-2">
          {t('mailArchive.bodyFormat', {
            kind: t(
              `mailArchive.bodyKinds.${alternate ? (message.bodyAlternateKind ?? 'none') : message.bodyKind}`
            )
          })}
        </p>
        <p>{t(`mailArchive.bodyReasons.${message.bodySelectionReason}`)}</p>
      </details>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={full && !alternate}
          onClick={() => {
            setAlternate(false)
            setFull((value) => alternate || !value)
          }}
          className="rounded-r4 border border-border px-2.5 py-1.5 text-[11px] text-ink3 hover:bg-fill-uncontained-hover"
        >
          {t(full && !alternate ? 'mailArchive.foldBody' : 'mailArchive.fullBody')}
        </button>
        {message.bodyAlternateText !== null && (
          <button
            type="button"
            aria-pressed={alternate}
            onClick={() => setAlternate((value) => !value)}
            className="rounded-r4 border border-border px-2.5 py-1.5 text-[11px] text-ink3 hover:bg-fill-uncontained-hover"
          >
            {t(alternate ? 'mailArchive.selectedBody' : 'mailArchive.alternateBody')}
          </button>
        )}
      </div>
      {alternate || full || !message.bodySegments.length ? (
        <pre className={textClass}>
          {body ||
            t(
              message.bodySelectionReason === 'oversized'
                ? 'mailArchive.bodyOversized'
                : 'mailArchive.noBody'
            )}
        </pre>
      ) : (
        message.bodySegments.map((segment) => {
          const text = message.bodyText.slice(segment.start, segment.end)
          if (segment.kind === 'unknown')
            return (
              <pre key={segment.ordinal} className={textClass}>
                {text}
              </pre>
            )
          const hit = terms.some((term) => text.toLocaleLowerCase().includes(term))
          return (
            <details
              key={`${message.id}-${segment.ordinal}-${query}`}
              open={hit}
              className="my-2 rounded-r4 border border-border px-3 py-2"
            >
              <summary className="cursor-pointer text-[12px] text-ink3">
                {t(
                  segment.kind === 'quote' ? 'mailArchive.showQuote' : 'mailArchive.showSignature'
                )}
                {hit && (
                  <span className="ml-2 text-ink">
                    {t(
                      segment.kind === 'quote'
                        ? 'mailArchive.quoteMatch'
                        : 'mailArchive.signatureMatch'
                    )}
                  </span>
                )}
              </summary>
              <pre className={`${textClass} mt-2`}>{text}</pre>
            </details>
          )
        })
      )}
    </section>
  )
}
