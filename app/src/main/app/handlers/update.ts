import { CHANNELS } from '../../../shared/protocol'
import { handlePlain } from '../../infra/ipc/handle'
import type { RouterContext } from '../context'
export function registerUpdateHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.updateState, () => ctx.updates.getState())
  handlePlain(CHANNELS.updateCheck, () => ctx.updates.check(false))
  handlePlain(CHANNELS.updateDownload, () => ctx.updates.download())
  handlePlain(CHANNELS.updateQuitAndInstall, () => ctx.updates.quitAndInstall())
}
