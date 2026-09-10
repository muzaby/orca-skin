import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

// Inputs and ordinary outputs share the OS user's temporary directory.
// On Windows this follows LocalAppData/Temp (including an OS TEMP override).
export const getTemporaryFilesPath = (): string => resolve(tmpdir())
