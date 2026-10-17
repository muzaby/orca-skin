import { createContext, useContext } from 'react'
import type { ScrollAnchor } from '../../common/transcript/scrollTypes'
import type { TimelineViewState } from './viewState'

export interface TimelineScroll extends ScrollAnchor {
  state: TimelineViewState
  retained: string[]
}
export const TimelineScrollContext = createContext<TimelineScroll | null>(null)
export const useTimelineScroll = (): TimelineScroll | null => useContext(TimelineScrollContext)
