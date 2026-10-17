import type { ProviderDescriptor } from '../../../../shared/ipc'

export const OPENCODE_DESCRIPTOR: ProviderDescriptor = {
  provider: 'opencode',
  session: {
    continue: true,
    resume: true,
    fork: false,
    persistSessionFalse: false,
    delete: true,
    update: true,
    children: false,
    summarize: false,
    abort: true,
    share: false,
    init: true,
    liveModeSwitch: false,
    contextInjectionNoReply: false,
    structuredOutput: false,
    conversationRevert: false,
    conversationUnrevert: false,
    fileCheckpointCreate: false,
    fileCheckpointRestore: false
  },
  revert: {
    conversationRevert: false,
    conversationUnrevert: false,
    fileCheckpointCreate: false,
    fileCheckpointRestore: false
  },
  cancellation: { sessionAbort: true, denyInterrupt: true, abortSignal: true }
}
