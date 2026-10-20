import type { Backend } from '../../../../../shared/ipc'
import {
  StatusLine as CommonStatusLine,
  type StatusLineProps as CommonProps
} from '../harnesses/common/transcript/StatusLine'
import { statusSpinner, statusStreamingLabel } from '../harnesses/registries/status'
export interface StatusLineProps extends Omit<CommonProps, 'Spinner' | 'streamingLabelKey'> {
  backend?: Backend | null
}
export function StatusLine({ backend, ...props }: StatusLineProps): React.JSX.Element {
  return (
    <CommonStatusLine
      {...props}
      Spinner={statusSpinner(backend)}
      streamingLabelKey={statusStreamingLabel(backend)}
    />
  )
}
