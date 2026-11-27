import type { Backend } from '../../../../../../shared/ipc'
import type { NativeResource } from '../../../../../../shared/native-resources'
import { harnessSourceTitle } from '../../../../../../shared/extension-sources'
import { useI18n } from '../../../../shared/i18n'
import { CatalogToggle } from './CatalogToggle'

export type CatalogEntry = { backend: Backend; resource: NativeResource }

export function ExtensionChoice({
  entry: { backend, resource },
  locked,
  failedTarget,
  onToggle,
  details = false
}: {
  entry: CatalogEntry
  locked?: boolean
  failedTarget?: boolean
  onToggle?: (backend: Backend, resource: NativeResource, desired?: boolean) => void | Promise<void>
  details?: boolean
}): React.JSX.Element {
  const { tr } = useI18n()
  const reason =
    resource.controlReason ??
    (!resource.canToggle ? tr('chat.nativeResources.readOnlyReason') : undefined)
  const failedConnection =
    resource.status === 'failed' || resource.observations?.some((s) => s.status === 'failed')
  const retryTarget =
    failedTarget ?? (failedConnection && resource.canToggle ? resource.selected : undefined)
  return (
    <div className="min-w-0 text-caption text-ink3">
      <div className="flex flex-wrap items-center gap-g2">
        <span>{harnessSourceTitle(backend)}</span>
        <span>{tr(`chat.nativeResources.${resource.status}`)}</span>
        <CatalogToggle
          name={`${harnessSourceTitle(backend)} · ${resource.name}`}
          enabled={resource.selected ?? resource.enabled}
          canToggle={resource.canToggle}
          locked={locked}
          onToggle={() => onToggle?.(backend, resource)}
        />
      </div>
      {!!resource.pendingSessions && (
        <p>{tr('chat.nativeResources.nextInput', { count: resource.pendingSessions })}</p>
      )}
      {reason && <p>{reason}</p>}
      {retryTarget !== undefined && (
        <div role="alert">
          {tr(
            failedTarget !== undefined
              ? 'chat.nativeResources.saveFailed'
              : 'chat.nativeResources.failed'
          )}{' '}
          <button
            type="button"
            disabled={locked}
            onClick={() => void onToggle?.(backend, resource, retryTarget)}
          >
            {tr('chat.nativeResources.retry')}
          </button>
        </div>
      )}
      {details &&
        resource.observations?.map((observation) => (
          <p key={observation.sessionId}>
            {observation.sessionId} · {tr(`chat.nativeResources.${observation.status}`)}{' '}
            {observation.reason}
          </p>
        ))}
    </div>
  )
}
