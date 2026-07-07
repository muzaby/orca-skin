import { CHANNELS } from '../../../shared/protocol'
import type { BootReport } from '../../../shared/ipc'
import { handlePlain } from '../../infra/ipc/handle'
import type { RouterContext } from '../context'

export function registerBootHandlers(ctx: RouterContext): void {
  handlePlain(CHANNELS.bootReport, (): BootReport => ctx.getBootReport())
}
