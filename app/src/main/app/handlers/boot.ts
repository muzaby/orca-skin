import { CHANNELS } from '../../../shared/protocol'
import type { BootReport } from '../../../shared/ipc'
import { handlePlain } from '../../infra/ipc/handle'
import type { RouterContext } from '../context'

export function registerBootHandlers(ctx: Pick<RouterContext, 'getBootReport'>): void {
  handlePlain(CHANNELS.bootReport, (): BootReport => ctx.getBootReport())
}
