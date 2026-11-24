export const frame = (): Promise<number> => new Promise((resolve) => requestAnimationFrame(resolve))
export function editInput(area: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const proto =
    area instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(area, value)
  area.dispatchEvent(
    new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value })
  )
}
