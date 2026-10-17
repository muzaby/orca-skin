export interface ComposerSubmitProps {
  showCancelButton: boolean
  onCancel: () => void
  submit: () => void
  canAbort: boolean
  text: string
  feedbackMode: boolean
}

export interface ModelPresentation {
  selection: (value: {
    providerKey: string
    provider?: string
    modelFamily: string | null
    modelAlias: string | null
  }) => string
  menu: (value: { alias: string; identity: string }) => string
}
