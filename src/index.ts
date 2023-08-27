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
import { escape, glob } from 'glob'
import { dirname, isAbsolute, resolve, sep } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { walkUp } from 'walk-up-path'
import { builtinSet } from './builtin-set.js'
import {
  invalidImportSpecifier,
  invalidPackage,
  moduleNotFound,
  packageImportNotDefined,
  packageNotFound,
  relativeImportWithoutParentURL,
  subpathNotExported,
} from './errors.js'
import { isRelativeRequire } from './is-relative-require.js'

const toFileURL = (p: string | URL): URL =>
  typeof p === 'object'
    ? p
    : p.startsWith('file://')
    ? new URL(p)
    : pathToFileURL(p)

const toPath = (p: string | URL): string =>
  typeof p === 'object' || p.startsWith('file://') ? fileURLToPath(p) : p

/**
 * Given a path or file URL to a package.json file, return an object where each
 * possible local import path is mapped to the file URL that it would resolve
 * to.
 *
 * Invalid local imports are omitted.
 *
 * If a local import resolves into a dependecy, like `{"#d/*":"dep/*"}`, then
 * that may result in resolving to a file that does not exist, if the dep
 * has invalid exports.
 */
export const resolveAllLocalImports = async (
  packageJsonPath: string | URL,
  options: ResolveImportOpts = {}
): Promise<Record<string, string | URL>> => {
  const pjPath = toPath(packageJsonPath)
  const pjDir = dirname(pjPath)
  const pjURL = toFileURL(packageJsonPath)

  const pkg = await readPkg(pjPath)
  if (!pkg) {
    throw invalidPackage(packageJsonPath, resolveAllLocalImports)
  }
  const results: Record<string, URL | string> = {}

  for (const [sub, target] of getNamedImportsList(pkg, options)) {
    // if the import is local, then look it up
    // if it's another package, then look up that package
    // if it's another package with a *, then look up all exports
    // of that package, and filter by the matches.
    const parts = target.match(/^(@[^\/]+\/[^\/]+|[^\/]+)/)
    // make internal package named modules consistently `./`
    const name = pkg.name

    // non-matches already filtered out
    /* c8 ignore start */
    if (!parts) continue
    /* c8 ignore stop */

    const ssub = sub.split('*')
    const starget = target.split('*')
    const star = ssub.length === 2 && starget.length === 2
    if (!star) {
      // simple case, no * replacement
      // if not found, just omit it.
      // do a full resolve, because the target can be anything like
      // './foo/bar' or 'dep/blah', etc.
      try {
        results[sub] = await resolveImport(target, pjURL)
      } catch {}
      continue
    }

    // has a star, have to glob if it's localPath, or look up exports if not
    const localPath = parts[1] === '.'
    if (localPath) {
      for (const [rep, target] of await starGlob(starget, pjDir)) {
        results[ssub[0] + rep + ssub[1]] = pathToFileURL(target)
      }
      continue
    }

    const localName = parts[1] === name
    const dep = !localPath && !localName ? parts[1] : null

    // if we can't find the package, it's not valid.
    const ppath = dep ? await findDepPackage(dep, pjDir) : pjDir
    if (!ppath) continue

    const pj = resolve(ppath, 'package.json')
    if (!(await fileExists(pj))) {
      continue
    }

    const allExports = await resolveAllExports(pj)
    for (const [k, v] of Object.entries(allExports)) {
      if (k === '.' || k === './') continue
      const i = dep + k.substring(1)
      if (i.startsWith(starget[0]) && i.endsWith(starget[1])) {
        const s =
          ssub[0] +
          i.substring(starget[0].length, i.length - starget[1].length) +
          ssub[1]
        // should be impossible to throw, because we're pulling the list
        // from the package itself, and it gets resolved at that point.
        /* c8 ignore start */
        try {
          results[s] = await resolveImport(v, pjURL)
        } catch {}
        /* c8 ignore stop */
      }
    }
  }

  return results
}

const starGlob = async (
  star: string[], // actually [string,string]
  dir: string
): Promise<[string, string][]> => {
  const pattern =
    escape(star[0]) +
    (star[0].endsWith('/') ? '' : '*/') +
    '**' +
    (star[1].startsWith('/') ? '' : '/*') +
    escape(star[1])
  const matches = await glob(pattern, {
    posix: true,
    absolute: false,
    nodir: true,
    cwd: dir,
    dotRelative: true,
  })
  return matches.map(match => {
    const rep = match.substring(
      star[0].length,
      match.length - star[1].length
    )
    return [rep, resolve(dir, match)]
  })
}

/**
 * Given a path or file URL to a package.json file, return an object where each
 * possible export path is mapped to the file URL that it would resolve to.
 *
 * Invalid exports are omitted. No errors are raised as long as the file is a
 * valid `package.json`.
 *
 * Note: in cases like `"./x/*": "./file.js"`, where the list of possible
 * import paths is unbounded, the returned object will contain `"./x/*"` as the
 * key, since there's no way to expand that to every possible match.
 */
export const resolveAllExports = async (
  packageJsonPath: string | URL,
  options: ResolveImportOpts = {}
): Promise<Record<string, string | URL>> => {
  const pjPath = toPath(packageJsonPath)
  const pjDir = dirname(pjPath)

  const pkg = await readPkg(pjPath)
  if (!pkg) {
    throw invalidPackage(packageJsonPath, resolveAllExports)
  }

  const results: Record<string, string | URL> = {}

  const { exports } = pkg
  for (const sub of getNamedExportsList(exports)) {
    let res

    // this can't shouldn't be able to actually throw, because we're
    // pulling the list from the set itself.
    /* c8 ignore start */
    try {
      res = resolveExport(sub, exports as Exports, pjPath, pjPath, options)
    } catch {}
    if (!res) continue
    /* c8 ignore stop */

    // if it contains a *, then we have to glob,
    // in package.json exports * is actually **, but only
    // relevant if there is exactly ONE star
    const sres = res.split('*')
    const ssub = sub.split('*')
    if (sres.length === 2 && ssub.length === 2) {
      for (const [rep, target] of await starGlob(sres, pjDir)) {
        results[ssub[0] + rep + ssub[1]] = pathToFileURL(target)
      }
    } else {
      results[sub] = pathToFileURL(resolve(pjDir, res))
    }
  }

  return results
}

export interface ResolveImportOpts {
  /**
   * Used when resolves take multiple steps through dependencies.
   *
   * @internal
   */
  originalParent?: string

  /**
   * List of conditions to resolve. Defaults to ['import', 'node'].
   *
   * If set to ['require', 'node'], then this is functionally equivalent to
   * `require.resolve()`.
   *
   * 'default' is always allowed.
   */
  conditions?: string[]
}

/**
 * Resolve an import URL or string as if it were coming from the
 * module at parentURL.
 *
 * Returns a string for node builtin modules, and a file:// URL
 * object for anything resolved on disk.
 *
 * If the resolution is impossible, then an error will be raised, which
 * closely matches the errors raised by Node when failing for the same
 * reason.
 */
export const resolveImport = async (
  /** the thing being imported */
  url: string | URL,
  /**
   * the place the import() would be coming from. Required for relative
   * imports.
   */
  parentURL: string | URL | undefined = undefined,
  options: ResolveImportOpts = {}
): Promise<URL | string> => {
  // already resolved, just check that it exists
  if (typeof url === 'string' && url.startsWith('file://')) {
    url = new URL(url)
  }
  if (typeof url === 'object') {
    if (!(await fileExists(url))) {
      throw moduleNotFound(String(url), String(parentURL))
    }
    return url
  }

  const pu = parentURL ? toFileURL(parentURL) : undefined

  if (isRelativeRequire(url)) {
    if (!pu) {
      throw relativeImportWithoutParentURL(url, parentURL)
    }
    const u = new URL(url, pu)
    if (!(await fileExists(u))) {
      throw moduleNotFound(url, String(parentURL))
    }
    return new URL(url, pu)
  }

  if (isAbsolute(url)) {
    if (!(await fileExists(url))) {
      throw moduleNotFound(url, String(parentURL))
    }
    return pathToFileURL(url)
  }

  if (builtinSet.has(String(url))) {
    return url
  }

  // ok, we have to resolve it. some kind of bare dep import,
  // either a package name resolving to module or main, or a named export.
  const parentPath: string = toPath(parentURL || resolve('x'))
  const opts = {
    ...options,
    originalParent: String(options.originalParent || parentPath),
  }
  if (url) {
    return resolvePackageImport(url, parentPath, opts)
  } else {
    return resolveDependencyExports(url, parentPath, opts)
  }
}

const fileExists = async (f: string | URL): Promise<boolean> =>
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

export type ConditionalValueObject = {
  import?: ConditionalValue
  node?: ConditionalValue
  default?: ConditionalValue
}
export type ConditionalValue =
  | null
  | string
  | ConditionalValueObject
  | ConditionalValue[]

export type ExportsSubpaths = {
  [path: string]: ConditionalValue
}

const isExportSubpaths = (e: Exports): e is ExportsSubpaths => {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return false
  for (const p in e) {
    if (!p.startsWith('.')) return false
  }
  return true
}

export type Exports = Exclude<ConditionalValue, null> | ExportsSubpaths

export type Imports = {
  [path: string]: ConditionalValue
}

export type Pkg = {
  name?: string
  main?: string
  type?: string
  module?: string
  exports?: Exports
  imports?: Imports
}

// TODO: actually verify this beast
// - Cannot contain both `"."` prefixed items and non-"."-prefixed together
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

const readPkg = async (f: string): Promise<Pkg | null> => {
  const pj = await readJSON(f)
  return isPkg(pj) ? pj : null
}

/**
 * Resolve an import like '@package/name/sub/module', where
 * './sub/module' appears in the exports of the local package.
 */
const resolvePackageImport = async (
  url: string,
  parentPath: string,
  options: ResolveImportOpts & { originalParent: string }
): Promise<URL | string> => {
  const { originalParent } = options
  const parts = url.match(/^(@[^\/]+\/[^\/]+|[^\/]+)(?:\/(.*))?$/)
  // impossible
  /* c8 ignore start */
  if (!parts) throw invalidImportSpecifier(url)
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
        const subPath = resolveExport(
          sub,
          pkg.exports,
          pj,
          originalParent,
          options
        )
        const resolved = resolve(dir, subPath)
        if (await fileExists(resolved)) return pathToFileURL(resolved)
        else throw moduleNotFound(resolved, originalParent)
      }
    }

    if (pkg.imports && url.startsWith('#')) {
      const exact = pkg.imports[url]
      if (exact !== undefined) {
        const res = resolveConditionalValue(exact, options)
        if (!res) {
          throw packageImportNotDefined(url, pj, originalParent)
        }
        // kind of weird behavior, but it's what node does
        if (res.startsWith('#')) {
          return resolveDependencyExports(null, parentPath, options)
        }
        return resolveImport(res, pj, options)
      }

      const sm = findStarMatch(url, pkg.imports)
      if (!sm) {
        throw packageImportNotDefined(url, pj, originalParent)
      }
      const [key, mid] = sm
      const match = pkg.imports[key]
      const res = resolveConditionalValue(match, options)
      if (!res) {
        throw packageImportNotDefined(url, pj, originalParent)
      }
      if (res.startsWith('#')) {
        return resolveDependencyExports(null, parentPath, options)
      }
      const expand = res.replace(/\*/g, mid)

      // start over with the resolved import
      return resolveImport(expand, pj, options)
    }

    return resolveDependencyExports(url, parentPath, options)
  }

  return resolveDependencyExports(url, parentPath, options)
}

const findDepPackage = async (
  pkgName: string | null,
  parentPath: string
) => {
  // starting from the dirname, try to find the nearest node_modules
  for (const dir of walkUp(dirname(parentPath))) {
    const nm = resolve(dir, 'node_modules') + sep
    // if it's null, then we need the node_modules itself
    // if it's '' then we use node_modules with an extra / on it
    // thisis only relevant when generating the error message, since
    // of course node_modules// is never going to be a valid package.
    const ppath =
      pkgName === null ? nm : (!pkgName ? nm : resolve(nm, pkgName)) + sep
    if (!(await dirExists(ppath))) continue
    return ppath
  }
}

/**
 * Resolve a dependency like '@dep/name/sub/module' where
 * '@dep/name' is in node_modules somewhere and exports './sub/module'
 */
const resolveDependencyExports = async (
  url: string | null,
  parentPath: string,
  options: ResolveImportOpts & { originalParent: string }
): Promise<URL> => {
  const { originalParent } = options
  const parts = url?.match(/^(@[^\/]+\/[^\/]+|[^\/]+)(?:\/(.*))?$/)
  const [, pkgName, sub] =
    url === null ? [, null, ''] : parts || ['', '', '']
  const ppath = await findDepPackage(pkgName, parentPath)
  if (!ppath) {
    throw packageNotFound(pkgName, originalParent)
  }

  const indexjs = resolve(ppath, 'index.js')
  const pj = resolve(ppath, 'package.json')
  const pkg = await readPkg(pj)
  const subpath = sub ? resolve(ppath, sub) : false
  // if not a package, then the sub can still be a direct path
  // if no sub, then resolves to index.js if available.
  if (!pkg) {
    if (!subpath) {
      // try index.js, otherwise fail
      if (await fileExists(indexjs)) return pathToFileURL(indexjs)
      else throw packageNotFound(ppath, originalParent)
    } else {
      if (await fileExists(subpath)) {
        return pathToFileURL(subpath)
      } else throw moduleNotFound(subpath, originalParent)
    }
  }

  // ok, have a package, look up the export if present.
  // otherwise, use main, otherwise index.js
  if (pkg.exports) {
    const subPath = resolveExport(
      sub,
      pkg.exports,
      pj,
      originalParent,
      options
    )
    const resolved = resolve(ppath, subPath)
    if (await fileExists(resolved)) return pathToFileURL(resolved)
    else throw moduleNotFound(resolved, originalParent)
  } else if (subpath) {
    if (await fileExists(subpath)) return pathToFileURL(subpath)
    else throw moduleNotFound(subpath, originalParent)
  } else if (pkg.main) {
    // fall back to index.js if main is missing
    const rmain = resolve(ppath, pkg.main)
    if (await fileExists(rmain)) return pathToFileURL(rmain)
    else if (await fileExists(indexjs)) return pathToFileURL(indexjs)
    else throw packageNotFound(ppath, originalParent)
  } else if (await fileExists(indexjs)) {
    return pathToFileURL(indexjs)
  } else {
    throw packageNotFound(ppath, originalParent)
  }
}

/**
 * Resolve an export that might be a string, subpath exports, exports value
 * object, or array of strings and exports value objects
 */
const resolveExport = (
  sub: string,
  exp: Exports,
  pj: string,
  from: string,
  options: ResolveImportOpts
): string => {
  const s = !sub
    ? '.'
    : sub === '.' || sub.startsWith('./')
    ? sub
    : `./${sub}`

  if (typeof exp === 'string' || Array.isArray(exp)) {
    const res = s === '.' && resolveConditionalValue(exp, options)
    if (!res) throw subpathNotExported(s, pj, from)
    return res
  }

  // now it must be a set of named exports or an export value object
  // first try to resolve as a value object, if that's allowed
  if (s === '.') {
    const res = resolveConditionalValue(exp, options)
    if (res) return res
  }

  // otherwise the only way to match is with subpaths
  const es = exp as ExportsSubpaths

  // if we have an exact match, use that
  const e = es[s]
  if (e !== undefined) {
    const res = resolveConditionalValue(e, options)
    if (!res) throw subpathNotExported(s, pj, from)
    return res
  }

  const sm = findStarMatch(s, es)
  if (sm) {
    const [key, mid] = sm
    const res = resolveConditionalValue(es[key], options)
    if (!res) throw subpathNotExported(s, pj, from)
    return res.replace(/\*/g, mid)
  }

  // did not find a match
  throw subpathNotExported(s, pj, from)
}

/**
 * Given an object with string keys possibly containing *, and a test
 * string, return the matching key, and the section that the star should
 * expand to when matching against the test string.
 */
const findStarMatch = (
  s: string,
  obj: Record<string, any>
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

/**
 * Get the condition-resolved targets of all exports
 *
 * Stars are not expanded.
 */
const getNamedExportsList = (exports?: Exports): string[] => {
  if (!exports) return []
  if (!isExportSubpaths(exports)) return ['.']
  return Object.keys(exports).filter(e => e === '.' || e.startsWith('./'))
}

/**
 * Get the condition-resolved targets of all imports
 *
 * Stars are not expanded.
 */
const getNamedImportsList = (
  pkg: Pkg,
  options: ResolveImportOpts
): [string, string][] => {
  const results: [string, string][] = []
  const { imports } = pkg
  if (!imports || typeof imports !== 'object') return results
  for (const [k, v] of Object.entries(imports)) {
    const r = resolveConditionalValue(v, options)
    if (r && !r.startsWith('#')) results.push([k, r])
  }
  return results
}

/**
 * find the first match for string, import, node, or default
 * at this point, we know we're on the right subpath already
 */
const resolveConditionalValue = (
  exp: ConditionalValue,
  options: ResolveImportOpts
): string | null => {
  const { conditions = ['import', 'node'] } = options
  if (exp === null || typeof exp === 'string') return exp
  if (Array.isArray(exp)) {
    for (const e of exp) {
      const r = resolveConditionalValue(e, options)
      if (r) return r
    }
    return null
  }
  for (const [k, v] of Object.entries(exp)) {
    //TODO: this list should be an option that's passed in by the caller
    if (conditions.includes(k) || k === 'default') {
      return resolveConditionalValue(v, options)
    }
  }
  return null
}
