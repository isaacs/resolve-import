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
  return resolveDepImport(url, parentPath)
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

type ExportValueObject = {
  import?: ExportValue
  default?: ExportValue
}
type ExportValue = string | ExportValueObject | ExportValue[]

type ExportsSubpaths = {
  [path: string]: ExportValue
}
type Exports = ExportValue | ExportsSubpaths

type Pkg = {
  main?: string
  type?: string
  module?: string
  exports?: Exports
}

const isExports = (e: any): e is Exports =>
  !!e && (typeof e === 'object' || typeof e === 'string')

const isPkg = (o: any): o is Pkg =>
  !!o &&
  typeof o === 'object' &&
  (typeof o.main === 'string' || typeof o.main === 'undefined') &&
  (typeof o.module === 'string' || typeof o.module === 'undefined') &&
  (typeof o.exports === 'undefined' || isExports(o.exports))

const readPkg = async (f: string): Promise<Pkg | null> => {
  const pj = await readJSON(f)
  if (!isPkg(pj)) return null
  return pj
}

const resolveDepImport = async (
  url: string,
  parentPath: string
): Promise<URL> => {
  const parts = url.match(/^(@[^\/]+\/[^\/]+|[^\/]+)(?:\/(.*))?$/)
  // impossible
  /* c8 ignore start */
  if (!parts) {
    throw new Error('invalid import() specifier: ' + url)
  }
  /* c8 ignore stop */
  const [, pkgName, sub] = parts
  // starting from the dirname, try to find the nearest node_modules
  for (const dir of walkUp(dirname(parentPath))) {
    const nm = resolve(dir, 'node_modules')
    const ppath = resolve(nm, pkgName) + sep
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
    const res = s === '.' && resolveExportValue(exp)
    if (!res) throw subpathNotExported(s, pj, from)
    return res
  }

  // now it must be a set of named exports or an export value object
  const e = (exp as ExportsSubpaths)[s]
  if (!e) {
    if (s === '.') {
      // '.' can match against the exports object as a single value
      const res = resolveExportValue(exp)
      if (!res) throw subpathNotExported(s, pj, from)
      return res
    } else {
      throw subpathNotExported(s, pj, from)
    }
  }

  // now we know we have a subpath that matches. test for the value.
  const res = resolveExportValue(e)
  if (!res) throw subpathNotExported(s, pj, from)
  return res
}

// find the first match for string, import, or default
// at this point, we know we're on the right subpath already
const resolveExportValue = (exp: ExportValue): string | null => {
  if (typeof exp === 'string') return exp
  if (Array.isArray(exp)) {
    for (const e of exp) {
      const r = resolveExportValue(e)
      if (r) return r
    }
    return null
  }
  if (exp.import) return resolveExportValue(exp.import)
  if (exp.default) return resolveExportValue(exp.default)
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

const packageNotFound = (path: string, from: string) => {
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
