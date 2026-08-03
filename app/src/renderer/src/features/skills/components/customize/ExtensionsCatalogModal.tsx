import { Modal } from '../../../../shared/ui/Modal'
import { useI18n } from '../../../../shared/i18n'
import { useExtensionsModalStore } from '../../store/extensionsModalStore'
import { ExtensionsCatalogView } from './ExtensionsCatalogView'

export function ExtensionsCatalogModal(): React.JSX.Element | null {
  const open = useExtensionsModalStore((state) => state.open)
  const hide = useExtensionsModalStore((state) => state.hide)
  const { tr } = useI18n()
  return (
    <Modal
      open={open}
      onClose={hide}
      ariaLabel={tr('skills.pageTitle')}
      panelClassName="flex h-[600px] max-h-[85vh] w-[860px] max-w-[92vw] overflow-hidden rounded-r6 border border-border bg-panel shadow-xl"
    >
      <ExtensionsCatalogView />
    </Modal>
  )
}
