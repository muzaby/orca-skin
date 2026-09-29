import { useState } from 'react'
import type { MailArchiveMessage, MailArchiveThreadResult } from '../../../../shared/mail-archive'
import { bodyKindLabel, bodySelectionLabel } from './mailArchiveText'

interface MailMessageDetailProps {
  readonly message: MailArchiveMessage
  readonly thread: MailArchiveThreadResult
  readonly formatDate: (value: number | null) => string
  readonly exportingAttachmentId: string | null
  readonly exportDisabled: boolean
  readonly onOpen: (id: string) => void
  readonly onClose: () => void
  readonly onExportAttachment: (attachmentId: string) => void
}

export function MailMessageDetail({
  message,
  thread,
  formatDate,
  exportingAttachmentId,
  exportDisabled,
  onOpen,
  onClose,
  onExportAttachment
}: MailMessageDetailProps): React.JSX.Element {
  const [showAlternate, setShowAlternate] = useState(false)
  const flags = message.bodyQualityFlags
  const body = showAlternate ? message.bodyAlternateText : message.bodyText

  return (
    <article className="px-5 py-4">
      <button
        type="button"
        onClick={onClose}
        className="mb-3 text-[12px] text-ink3 hover:text-ink lg:hidden"
      >
        ← 검색 결과
      </button>
      <div className="mb-4 border-b border-border pb-4">
        <h2 className="text-[16px] font-semibold text-ink">{message.subject || '(제목 없음)'}</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] text-ink3">
          <dt>보낸 사람</dt>
          <dd className="truncate text-ink2">{message.from || '—'}</dd>
          <dt>받는 사람</dt>
          <dd className="truncate text-ink2">{message.to || '—'}</dd>
          {message.cc && (
            <>
              <dt>참조</dt>
              <dd className="truncate text-ink2">{message.cc}</dd>
            </>
          )}
          <dt>날짜</dt>
          <dd className="text-ink2">{message.date ? formatDate(message.date) : '날짜 미상'}</dd>
          <dt>자료원</dt>
          <dd className="truncate text-ink2">
            {message.sourceName}
            {message.folderPath ? ` · ${message.folderPath}` : ''}
          </dd>
        </dl>
      </div>

      {thread.mails.length > 1 && (
        <section
          aria-label="확인된 대화"
          className="mb-5 rounded-r4 border border-border bg-bg px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-medium text-ink">
              확인된 대화 · {thread.mails.length}
              {thread.truncated ? '+' : ''}개
            </h3>
            {thread.truncated && (
              <span className="text-[10.5px] text-ink3">최대 50개까지 표시</span>
            )}
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-ink3">
            메일의 답장·참조 헤더로 확인된 연결입니다. 제목만 비슷한 메일은 합치지 않았습니다.
          </p>
          <ol className="mt-2 max-h-48 divide-y divide-border overflow-y-auto">
            {thread.mails.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={item.id === message.id ? 'true' : undefined}
                  onClick={() => onOpen(item.id)}
                  className={`block w-full py-2 text-left hover:text-ink ${item.id === message.id ? 'text-ink' : 'text-ink3'}`}
                >
                  <span className="block truncate text-[11.5px]">
                    {item.subject || '(제목 없음)'}
                  </span>
                  <span className="mt-0.5 block truncate text-[10.5px]">
                    {formatDate(item.date)} · {item.from || '발신자 없음'}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(flags.length > 0 || message.bodyAlternateOmitted) && (
        <div
          role="note"
          aria-label="본문 처리 알림"
          className="mb-3 rounded-r4 border border-border bg-bg px-3 py-2 text-[11.5px] leading-relaxed text-ink3"
        >
          {flags.includes('decode_suspect') && (
            <p>문자 해석이 불확실할 수 있습니다. 아래 본문을 원본 메일과 대조해 주세요.</p>
          )}
          {flags.includes('alternative_mismatch') && (
            <p>일반 텍스트와 HTML 본문 내용이 다릅니다. 다른 본문 형식도 확인할 수 있습니다.</p>
          )}
          {flags.includes('oversized') && (
            <p>
              {message.bodySelectionReason === 'oversized'
                ? '본문이 2 MiB 보관 한도를 넘어 본문을 저장하지 않았습니다.'
                : '본문 보관 한도 때문에 대체 형식은 저장하지 않았습니다.'}
            </p>
          )}
        </div>
      )}
      <details className="mb-3 rounded-r4 border border-border px-3 py-2 text-[11px] text-ink3">
        <summary className="cursor-pointer font-medium text-ink2">본문 처리 정보</summary>
        <p className="mt-2">
          표시 형식: {bodyKindLabel(showAlternate ? message.bodyAlternateKind : message.bodyKind)}
        </p>
        <p>{bodySelectionLabel(message.bodySelectionReason)}</p>
      </details>
      {message.bodyAlternateText !== null && (
        <button
          type="button"
          aria-pressed={showAlternate}
          onClick={() => setShowAlternate((shown) => !shown)}
          className="mb-2 rounded-r4 border border-border px-2.5 py-1.5 text-[11px] text-ink3 hover:bg-fill-uncontained-hover hover:text-ink"
        >
          {showAlternate
            ? '선택 본문으로 돌아가기'
            : `대체 본문 보기 · ${bodyKindLabel(message.bodyAlternateKind)}`}
        </button>
      )}
      <pre className="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-[1.7] text-ink2">
        {body ||
          (message.bodySelectionReason === 'oversized'
            ? '보관 한도를 넘어 본문을 저장하지 않았습니다.'
            : '(본문 없음)')}
      </pre>
      {message.attachments.length > 0 && (
        <div className="mt-5 border-t border-border pt-4 text-[12px] text-ink3">
          <div className="mb-2 font-medium text-ink">첨부파일 이름</div>
          {message.attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex flex-wrap items-center justify-between gap-2 py-1"
            >
              <span className="min-w-0 truncate">
                {attachment.name} · {attachment.sizeBytes.toLocaleString()} bytes
              </span>
              <button
                type="button"
                aria-label={`${attachment.name} 첨부파일 저장`}
                disabled={exportDisabled}
                onClick={() => onExportAttachment(attachment.id)}
                className="shrink-0 rounded-r4 border border-border px-2 py-1 text-[11px] text-ink3 hover:bg-fill-uncontained-hover hover:text-ink disabled:opacity-50"
              >
                {exportingAttachmentId === attachment.id ? '저장 중…' : '파일로 저장'}
              </button>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
