import { measurementEnvironment } from '../stage-d/measurement.mjs'

export function stageEVerdict(result, { isBaseline, size, environment }) {
  const messages = size === 'long' ? 100000 : 100
  const functional =
    !result.error &&
    result.visible &&
    result.receivedMessages === (isBaseline ? messages : 2) &&
    result.clickToBodyFrameMs > 0 &&
    result.readerPayloadBytes > 0 &&
    result.replyJsonBytes > 0
  const bounded =
    isBaseline ||
    (result.prepared?.sourceBytes > 0 &&
      result.replyJsonBytes <= 256 * 1024 &&
      result.warm?.visible &&
      result.warm.receivedMessages === 2 &&
      result.warm.readerPayloadBytes === 0 &&
      !result.warm.prepared &&
      result.warm.replyJsonBytes <= 256 * 1024)
  const linuxLatencyGate =
    !isBaseline && size === 'long'
      ? {
          limitMs: 3729,
          pass: result.clickToBodyFrameMs <= 3729,
          applies: environment === measurementEnvironment('linux')
        }
      : undefined
  return {
    functional: Boolean(functional),
    bounded: Boolean(bounded),
    linuxLatencyGate,
    verdict: Boolean(functional && bounded && (!linuxLatencyGate?.applies || linuxLatencyGate.pass))
  }
}
