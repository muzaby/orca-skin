import type {
  MailArchiveBodyKind,
  MailArchiveBodySelectionReason,
  MailArchiveImportFailure,
  MailArchiveImportResult
} from '../../../../shared/mail-archive'

const ERROR_MESSAGES: Record<string, string> = {
  mail_import_already_running: '다른 가져오기가 진행 중입니다. 끝난 뒤 다시 시도해 주세요.',
  mail_source_remove_in_progress: '자료원을 제거하는 중입니다. 잠시 후 다시 시도해 주세요.',
  mail_archive_source_removing: '자료원을 제거하는 중입니다. 잠시 후 다시 시도해 주세요.',
  eml_folder_empty: '선택한 폴더에 EML 파일이 없습니다.',
  eml_folder_not_found: '선택한 폴더를 찾을 수 없습니다.',
  mail_source_not_found: '선택한 파일을 찾을 수 없습니다.',
  mail_source_unsupported: 'EML 또는 PST 파일만 가져올 수 있습니다.',
  mail_eml_too_large: 'EML 파일이 50 MiB 한도를 넘어 가져오지 않았습니다.',
  mail_source_changed_during_import: '가져오는 동안 원본이 바뀌어 이전 보관 내용을 유지했습니다.',
  mail_source_parse_failed: '파일을 해석하지 못했습니다.',
  mail_pst_folders_unreadable: '손상된 PST 폴더를 읽지 못했습니다. 나머지 메일은 가져왔습니다.',
  mail_pst_messages_unreadable: '손상된 PST 메시지를 읽지 못했습니다. 나머지 메일은 가져왔습니다.',
  mail_archive_index_worker_exited: '보관함 색인 작업이 중단됐습니다. 다시 시도해 주세요.',
  mail_attachment_destination_is_source:
    '원본 EML·PST 파일이나 자료원 폴더 안에는 저장할 수 없습니다. 다른 위치를 선택해 주세요.',
  mail_attachment_source_changed:
    '원본 파일이 보관 당시와 달라 첨부를 저장하지 않았습니다. 자료원을 다시 가져온 뒤 시도해 주세요.'
}

/**
 * Electron invoke 거절 메시지는 `Error invoking remote method '…': Error: <code>` 형태라 코드를
 * 문자열 비교로는 찾을 수 없다. 안정 오류 코드와 뒤의 개수를 뽑는다.
 */
export function archiveErrorCode(reason: unknown): { code: string; count: string | null } | null {
  const message = reason instanceof Error ? reason.message : String(reason)
  const match = /\b((?:mail|eml)_[a-z0-9_]+)(?::(\d+))?/.exec(message)
  return match ? { code: match[1]!, count: match[2] ?? null } : null
}

export function archiveErrorMessage(reason: unknown, fallback: string): string {
  const parsed = archiveErrorCode(reason)
  const message = parsed ? ERROR_MESSAGES[parsed.code] : undefined
  if (!message) return fallback
  return parsed?.count ? `${message} (${parsed.count}개)` : message
}

function failureLine(failure: MailArchiveImportFailure): string {
  return `${failure.path}: ${archiveErrorMessage(failure.reason, '가져오지 못했습니다.')}`
}

export function importSummary(result: MailArchiveImportResult): string {
  const lead =
    result.state === 'cancelled'
      ? `가져오기를 취소했습니다. 반영된 메일 ${result.messages}개`
      : `메일 ${result.messages}개를 확인했습니다`
  const failures =
    result.failures.length > 0 ? `\n${result.failures.map(failureLine).join('\n')}` : ''
  return `${lead} — 새로 저장 ${result.inserted}개, 이미 보관 ${result.skipped}개.${failures}`
}

export function bodyKindLabel(kind: MailArchiveBodyKind | null): string {
  if (kind === 'plain') return '일반 텍스트'
  if (kind === 'html') return 'HTML 변환 텍스트'
  return '본문 없음'
}

const SELECTION_LABELS: Record<MailArchiveBodySelectionReason, string> = {
  plain_preferred: '일반 텍스트를 우선 사용했습니다.',
  plain_placeholder_fallback: '일반 텍스트가 HTML 보기 안내문이라 HTML 본문을 사용했습니다.',
  plain_unusable_fallback: '일반 텍스트가 비어 있거나 대체 문자만 있어 HTML 본문을 사용했습니다.',
  html_only: 'HTML 본문만 있어 읽을 수 있는 텍스트로 변환했습니다.',
  oversized: '본문이 2 MiB 보관 한도를 넘어 저장되지 않았습니다.',
  empty: '읽을 수 있는 본문이 없습니다.'
}

export function bodySelectionLabel(reason: MailArchiveBodySelectionReason): string {
  return SELECTION_LABELS[reason]
}
