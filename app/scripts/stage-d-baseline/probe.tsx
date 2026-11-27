// This entry only imports product APIs present on the Stage D baseline.
import { measurePanelTimings } from '../stage-d/panelTimings'
import { measureResources } from '../stage-d/resourceFlow'

Object.assign(window, { measurePanelTimings, measureResources })
