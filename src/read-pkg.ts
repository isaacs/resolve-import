import { Exports, Imports } from './index.js'
import { readJSON, readJSONSync } from './read-json.js'

export type Pkg = {
  name?: string
  main?: string
  type?: string
  module?: string
  exports?: Exports
  imports?: Imports
}

const isExports = (e: any): e is Exports =>
  !!e && (typeof e === 'object' || typeof e === 'string')

const isImports = (e: any): e is Exports => {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false
  for (const p in e) {
    if (!p.startsWith('#')) return false
  }
  return true
}

const isPkg = (o: any): o is Pkg =>
  !!o &&
  typeof o === 'object' &&
  (typeof o.name === 'string' || typeof o.name === 'undefined') &&
  (typeof o.main === 'string' || typeof o.main === 'undefined') &&
  (typeof o.module === 'string' || typeof o.module === 'undefined') &&
  (typeof o.exports === 'undefined' || isExports(o.exports)) &&
  (typeof o.imports === 'undefined' || isImports(o.imports))

const ifPkg = (p: unknown): Pkg | null => (isPkg(p) ? p : null)

export const readPkg = async (f: string): Promise<Pkg | null> =>
  ifPkg(await readJSON(f))

export const readPkgSync = (f: string): Pkg | null =>
  ifPkg(readJSONSync(f))
