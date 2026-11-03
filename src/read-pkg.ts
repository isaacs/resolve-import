import type { Exports, Imports } from './index.js'
import { readJSON, readJSONSync } from './read-json.js'

export type Pkg = {
  name?: string
  main?: string
  type?: string
  module?: string
  exports?: Exports
  imports?: Imports
}

const isExports = (e: unknown): e is Exports =>
  !!e && (typeof e === 'object' || typeof e === 'string')

const isImports = (e: unknown): e is Exports => {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false
  for (const p in e) {
    if (!p.startsWith('#')) return false
  }
  return true
}

const isPkg = (o: unknown): o is Pkg =>
  !!o &&
  typeof o === 'object' &&
  (!('name' in o) || typeof o.name === 'string') &&
  (!('main' in o) || typeof o.main === 'string') &&
  (!('module' in o) || typeof o.module === 'string') &&
  (!('exports' in o) || isExports(o.exports)) &&
  (!('imports' in o) || isImports(o.imports))

const ifPkg = (p: unknown): Pkg | null => (isPkg(p) ? p : null)

export const readPkg = async (f: string): Promise<Pkg | null> =>
  ifPkg(await readJSON(f))

export const readPkgSync = (f: string): Pkg | null =>
  ifPkg(readJSONSync(f))
