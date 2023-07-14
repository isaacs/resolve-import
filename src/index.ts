// this function resolves an import() the same way that node does
// We can't just use require.resolve() in many cases, because even
// though that works well for modules that can be loaded via require,
// it'll throw if a module is ESM-only. Even if it doesn't throw, hybrid
// modules will return the cjs version from require.resolve(), and what
// we want in this case is what import() would resolve to.
// We also can't use import.meta.resolve, because that is not available
// *from* commonjs (and is only available with a flag, as of node 20).
// Hence this re-implementation.

import { readFile, stat } from 'fs/promises'
import { dirname, isAbsolute, resolve, sep } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { walkUp } from 'walk-up-path'
import { builtinSet } from './builtin-set.js'
import { isRelativeRequire } from './is-relative-require.js'

// returns file:// url object for anything other than builtins
export const resolveImport = async (
  url: string | URL,
  parentURL?: string | URL
): Promise<URL | string> => {
  if (typeof url === 'object') return url
  if (url.startsWith('file://')) {
    return new URL(url)
  }
  if (parentURL && typeof parentURL === 'string') {
    parentURL = parentURL.startsWith('file://')
      ? new URL(parentURL)
      : pathToFileURL(parentURL)
  }
  if (isRelativeRequire(url)) {
    if (!parentURL) {
      throw Object.assign(new Error('relative import without parentURL'), {
        url,
        parentURL,
      })
    }
    return new URL(url, parentURL)
  }

  if (isAbsolute(url)) {
    return pathToFileURL(url)
  }

  if (builtinSet.has(String(url))) {
    return url
  }

  // ok, we have to resolve it. some kind of bare dep import,
  // either a package name resolving to module or main, or a named export.
  parentURL = parentURL || resolve('x')
  const parentPath: string =
    typeof parentURL === 'object' ? fileURLToPath(parentURL) : parentURL

  if (url) {
    return resolvePackageImport(url, parentPath)
  } else {
    return resolveDependencyExports(url, parentPath)
  }
}

const fileExists = async (f: string): Promise<boolean> =>
  stat(f).then(
    st => st.isFile(),
    () => false
  )

const dirExists = async (f: string): Promise<boolean> =>
  stat(f).then(
    st => st.isDirectory(),
    () => false
  )

const readJSON = async (f: string): Promise<any> =>
  readFile(f, 'utf8')
    .then(d => JSON.parse(d))
    .catch(() => null)

type ConditionalValueObject = {
  import?: ConditionalValue
  node?: ConditionalValue
  default?: ConditionalValue
}
type ConditionalValue =
  | null
  | string
  | ConditionalValueObject
  | ConditionalValue[]

type ExportsSubpaths = {
  [path: string]: ConditionalValue
}
type Exports = Exclude<ConditionalValue, null> | ExportsSubpaths

type Imports = {
  [path: string]: ConditionalValue
}

type Pkg = {
  name?: string
  main?: string
  type?: string
  module?: string
  exports?: Exports
  imports?: Imports
}

const isExports = (e: any): e is Exports =>
  !!e && (typeof e === 'object' || typeof e === 'string')

const isPkg = (o: any): o is Pkg =>
  !!o &&
  typeof o === 'object' &&
  (typeof o.name === 'string' || typeof o.name === 'undefined') &&
  (typeof o.main === 'string' || typeof o.main === 'undefined') &&
  (typeof o.module === 'string' || typeof o.module === 'undefined') &&
  (typeof o.exports === 'undefined' || isExports(o.exports))

const readPkg = async (f: string): Promise<Pkg | null> => {
  const pj = await readJSON(f)
  if (!isPkg(pj)) return null
  return pj
}

const resolvePackageImport = async (
  url: string,
  parentPath: string
): Promise<URL | string> => {
  const parts = url.match(/^(@[^\/]+\/[^\/]+|[^\/]+)(?:\/(.*))?$/)
  // impossible
  /* c8 ignore start */
  if (!parts) {
    throw new Error('invalid import() specifier: ' + url)
  }
  /* c8 ignore stop */

  for (const dir of walkUp(dirname(parentPath))) {
    const pj = resolve(dir, 'package.json')
    const pkg = await readPkg(pj)
    if (!pkg) continue
    if (pkg.name && pkg.exports) {
      // can import from this package name if exports is defined
      const [, pkgName, sub] = parts
      if (pkgName === pkg.name) {
        // ok, see if sub is a valid export then
        const subPath = resolveExport(sub, pkg.exports, pj, parentPath)
        const resolved = resolve(dir, subPath)
        if (await fileExists(resolved)) return pathToFileURL(resolved)
        else throw moduleNotFound(resolved, parentPath)
      }
    }

    if (pkg.imports && url.startsWith('#')) {
      const exact = pkg.imports[url]
      if (exact !== undefined) {
        const res = resolveConditionalValue(exact)
        if (!res) {
          throw packageImportNotDefined(url, pj, parentPath)
        }
        // kind of weird behavior, but it's what node does
        if (res.startsWith('#')) {
          return resolveDependencyExports(null, parentPath)
        }
        return resolveImport(res, parentPath)
      }

      const sm = starMatch(url, pkg.imports)
      if (!sm) {
        throw packageImportNotDefined(url, pj, parentPath)
      }
      const [key, mid] = sm
      const match = pkg.imports[key]
      const res = resolveConditionalValue(match)
      if (!res) {
        throw packageImportNotDefined(url, pj, parentPath)
      }
      if (res.startsWith('#')) {
        return resolveDependencyExports(null, parentPath)
      }
      const expand = res.replace(/\*/g, mid)

      // start over with the resolved import
      return resolveImport(expand, parentPath)
    }

    return resolveDependencyExports(url, parentPath)
  }

  return resolveDependencyExports(url, parentPath)
}

const resolveDependencyExports = async (
  url: string | null,
  parentPath: string
): Promise<URL> => {
  const parts = url?.match(/^(@[^\/]+\/[^\/]+|[^\/]+)(?:\/(.*))?$/)
  const [, pkgName, sub] = url === null ? [, null, ''] : parts || ['', '', '']
  // starting from the dirname, try to find the nearest node_modules
  for (const dir of walkUp(dirname(parentPath))) {
    const nm = resolve(dir, 'node_modules') + sep
    const ppath =
      pkgName === null ? nm : (!pkgName ? nm : resolve(nm, pkgName)) + sep
    if (!(await dirExists(ppath))) continue
    const indexjs = resolve(ppath, 'index.js')
    const subpath = sub ? resolve(ppath, sub) : false
    const pj = resolve(ppath, 'package.json')
    const pkg = await readPkg(pj)
    // if not a package, then the sub can still be a direct path
    // if no sub, then resolves to index.js if available.
    // TODO: walks up? or stop here? test.
    if (!pkg) {
      if (!subpath) {
        // try index.js, otherwise fail
        if (await fileExists(indexjs)) return pathToFileURL(indexjs)
        else throw packageNotFound(ppath, parentPath)
      } else {
        if (await fileExists(subpath)) {
          return pathToFileURL(subpath)
        } else throw moduleNotFound(subpath, parentPath)
      }
    } else {
      // ok, have a package, look up the export if present.
      // otherwise, use main, otherwise index.js
      if (pkg.exports) {
        const subPath = resolveExport(sub, pkg.exports, pj, parentPath)
        const resolved = resolve(ppath, subPath)
        if (await fileExists(resolved)) return pathToFileURL(resolved)
        else throw moduleNotFound(resolved, parentPath)
      } else if (subpath) {
        if (await fileExists(subpath)) return pathToFileURL(subpath)
        else throw moduleNotFound(subpath, parentPath)
      } else if (pkg.main) {
        // fall back to index.js if main is missing
        const rmain = resolve(ppath, pkg.main)
        if (await fileExists(rmain)) return pathToFileURL(rmain)
        else if (await fileExists(indexjs)) return pathToFileURL(indexjs)
        else throw packageNotFound(ppath, parentPath)
      } else if (await fileExists(indexjs)) {
        return pathToFileURL(indexjs)
      } else {
        throw packageNotFound(ppath, parentPath)
      }
    }
  }
  throw packageNotFound(pkgName, parentPath)
}

// this is the top-level exports tester.
// can be either a string, subpath exports, exports value object, or
// array of strings and exports value objects
const resolveExport = (
  sub: string,
  exp: Exports,
  pj: string,
  from: string
): string => {
  const s = sub ? `./${sub}` : '.'

  if (typeof exp === 'string' || Array.isArray(exp)) {
    const res = s === '.' && resolveConditionalValue(exp)
    if (!res) throw subpathNotExported(s, pj, from)
    return res
  }

  // now it must be a set of named exports or an export value object
  // first try to resolve as a value object, if that's allowed
  if (s === '.') {
    const res = resolveConditionalValue(exp)
    if (res) return res
  }

  // otherwise the only way to match is with subpaths
  const es = exp as ExportsSubpaths

  // if we have an exact match, use that
  const e = es[s]
  if (e !== undefined) {
    const res = resolveConditionalValue(e)
    if (!res) throw subpathNotExported(s, pj, from)
    return res
  }

  const sm = starMatch(s, es)
  if (sm) {
    const [key, mid] = sm
    const res = resolveConditionalValue(es[key])
    if (!res) throw subpathNotExported(s, pj, from)
    return res.replace(/\*/g, mid)
  }

  // did not find a match
  throw subpathNotExported(s, pj, from)
}

const starMatch = (
  s: string,
  obj: { [k: string]: any }
): [string, string] | null => {
  // longest pattern matches take priority
  const patterns = Object.keys(obj)
    .filter(p => p.length <= s.length)
    .sort((a, b) => b.length - a.length)
    .map(p => [p, p.split('*')])
    .filter(([, p]) => (p as string[]).length === 2) as [
    string,
    [string, string]
  ][]

  for (const [key, [before, after]] of patterns) {
    if (s.startsWith(before) && s.endsWith(after)) {
      const mid = s.substring(before.length, s.length - after.length)
      return [key, mid]
    }
  }

  return null
}

// find the first match for string, import, or default
// at this point, we know we're on the right subpath already
const resolveConditionalValue = (exp: ConditionalValue): string | null => {
  if (exp === null || typeof exp === 'string') return exp
  if (Array.isArray(exp)) {
    for (const e of exp) {
      const r = resolveConditionalValue(e)
      if (r) return r
    }
    return null
  }
  for (const [k, v] of Object.entries(exp)) {
    if (k === 'import' || k === 'node' || k === 'default') {
      return resolveConditionalValue(v)
    }
  }
  return null
}

const subpathNotExported = (sub: string, pj: string, from: string) => {
  const p =
    sub === '.'
      ? 'No "exports" main defined'
      : `Package subpath '${sub}' is not defined by "exports"`
  const er = Object.assign(new Error(`${p} in ${pj} imported from ${from}`), {
    code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
  })
  Error.captureStackTrace(er, resolveImport)
  throw er
}

const packageNotFound = (path: string | null, from: string) => {
  const er = Object.assign(
    new Error(`Cannot find package '${path}' imported from ${from}`),
    {
      code: 'ERR_MODULE_NOT_FOUND',
    }
  )
  Error.captureStackTrace(er, resolveImport)
  throw er
}

const moduleNotFound = (path: string, from: string) => {
  const er = Object.assign(
    new Error(`Cannot find module '${path}' imported from ${from}`),
    {
      code: 'ERR_MODULE_NOT_FOUND',
    }
  )
  Error.captureStackTrace(er, resolveImport)
  throw er
}

const packageImportNotDefined = (path: string, pj: string, from: string) => {
  const er = Object.assign(
    new Error(
      `Package import specifier "${path}" is not defined in package ${pj} imported from ${from}`
    ),
    { code: 'ERR_PACKAGE_IMPORT_NOT_DEFINED' }
  )
  Error.captureStackTrace(er, resolveImport)
  throw er
}
