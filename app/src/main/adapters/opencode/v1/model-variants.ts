import { isRecord } from '../../../../shared/obj'
export function enabledVariantNames(value: unknown): string[] {
  return isRecord(value)
    ? Object.entries(value)
        .filter(([, variant]) => !isRecord(variant) || variant.disabled !== true)
        .map(([name]) => name)
    : []
}
