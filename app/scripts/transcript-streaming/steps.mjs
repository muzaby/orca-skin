// A completed message has no live tail. Its body still carries all sent markers.
export const STEPS = [
  { step: 'sync@4000', tailLength: 4000, view: null, parsedChars: null, stableDelta: 0 },
  { step: 'enter@4001', tailLength: 4001, view: 'raw', parsedChars: null, stableDelta: 0 },
  { step: 'parsed@4001', tailLength: 4001, view: 'parsed', parsedChars: 4001, stableDelta: 0 },
  { step: 'parsed@50000', tailLength: 50000, view: 'parsed', parsedChars: 50000, stableDelta: 0 },
  { step: 'final@50001', tailLength: 50001, view: 'final', parsedChars: null, stableDelta: 0 },
  { step: 'finalized', tailLength: 7, view: null, parsedChars: null, stableDelta: 1 },
  { step: 'after', tailLength: 28, view: null, parsedChars: null, stableDelta: 1 },
  { step: 'completed', tailLength: null, view: null, parsedChars: null, stableDelta: null }
]
