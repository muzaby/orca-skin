import { createElement, type ReactElement } from 'react'
import { it } from 'vitest'
import { expectVirtualKeys } from '../../../../../shared/ui/virtual/rowKeys.testfixture'
import { InstallLog } from './InstallLog'
import { InstallLogArchive } from './installLogArchive'

it('keys log fragments by execution generation and starting offset across append and restart', () => {
  const archive = new InstallLogArchive()
  archive.append('abc\ndef')
  const view = (generation: number, revision: number): ReactElement =>
    createElement(InstallLog, { generation, archive, revision })
  expectVirtualKeys(view(7, 1), ['7:0', '7:4'])
  archive.append('ghi\nx')
  expectVirtualKeys(view(7, 2), ['7:0', '7:4', '7:11'])
  expectVirtualKeys(view(8, 1), ['8:0', '8:4', '8:11'])
})
