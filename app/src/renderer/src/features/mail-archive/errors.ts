const errorKeys = {
  mail_attachment_destination_is_source: 'sourceDestination',
  mail_attachment_source_changed: 'sourceChanged',
  mail_source_changed_during_import: 'sourceChanged',
  mail_pst_folder_read_failed: 'damagedPst',
  mail_pst_subfolders_read_failed: 'damagedPst',
  mail_eml_too_large: 'largeEml',
  mail_import_already_running: 'alreadyRunning',
  mail_archive_index_worker_exited: 'workerRetry',
  mail_archive_index_timeout: 'workerRetry',
  mail_source_timeout: 'workerRetry',
  mail_attachment_timeout: 'workerRetry',
  mail_source_not_found: 'sourceMissing',
  mail_source_enoent: 'sourceMissing',
  mail_source_eacces: 'sourceMissing',
  mail_source_not_selected: 'pickAgain'
} as const

export function mailArchiveErrorKey(
  error: unknown
): `mailArchiveRepair.${(typeof errorKeys)[keyof typeof errorKeys] | 'failed'}` {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  // Electron wraps rejected invoke errors. Never display its prefix or an arbitrary file path.
  const code = message.match(/\bmail_[a-z0-9_]+\b/)?.[0]
  const key =
    code && Object.hasOwn(errorKeys, code) ? errorKeys[code as keyof typeof errorKeys] : 'failed'
  return `mailArchiveRepair.${key}`
}
