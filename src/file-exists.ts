import { stat } from 'node:fs/promises'
import { statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const toPath = (p: string | URL) =>
  typeof p === 'object' || p.startsWith('file://') ? fileURLToPath(p) : p

export const fileExists = async (f: string | URL): Promise<boolean> => {
  try {
    return (await stat(toPath(f))).isFile()
  } catch (er) {
    return false
  }
}

export const fileExistsSync = (f: string | URL): boolean => {
  try {
    return statSync(toPath(f)).isFile()
  } catch {
    return false
  }
}
