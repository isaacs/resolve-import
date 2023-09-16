import { readFile } from 'node:fs/promises'
export const readJSON = async (f: string): Promise<any> =>
  readFile(f, 'utf8')
    .then(d => JSON.parse(d))
    .catch(() => null)

