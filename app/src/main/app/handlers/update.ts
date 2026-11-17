import { CHANNELS } from '../../../shared/protocol'
import { handlePlain } from '../../infra/ipc/handle'
import type { UpdateController } from '../updater'

// 업데이트는 셸이 맡는다(0324 D-035) — 셸 조립이 자기 컨트롤러를 넘긴다.
export function registerUpdateHandlers(ctx: { updates: UpdateController }): void {
  handlePlain(CHANNELS.updateState, () => ctx.updates.getState())
  handlePlain(CHANNELS.updateCheck, () => ctx.updates.check(false))
  handlePlain(CHANNELS.updateDownload, () => ctx.updates.download())
  handlePlain(CHANNELS.updateQuitAndInstall, () => ctx.updates.quitAndInstall())
}
