import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'

export const readJSON = async (f: string): Promise<unknown> => {
  try {
    return JSON.parse(await readFile(f, 'utf8'))
  } catch {
    return null
  }
}

export const readJSONSync = (f: string): unknown => {
  try {
    return JSON.parse(readFileSync(f, 'utf8'))
  } catch {
    return null
  }
}
