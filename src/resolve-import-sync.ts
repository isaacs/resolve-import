/**
 * Exported as `'resolve-import/resolve-import-sync'`
 * @module
 */
import { realpathSync } from 'node:fs'
import Module from 'node:module'
import { basename, dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  moduleNotFound,
  relativeImportWithoutParentURL,
} from './errors.js'
import { fileExistsSync } from './file-exists.js'
import type { ResolveImportOpts } from './index.js'
import { isRelativeRequire } from './is-relative-require.js'
import { resolveDependencyExportsSync } from './resolve-dependency-export-sync.js'
import { resolvePackageImportSync } from './resolve-package-import-sync.js'
import { toFileURL } from './to-file-url.js'
import { toPath } from './to-path.js'

// affordance for node 16 <16.17 and 18 <18.9
/* c8 ignore start */
if (typeof Module.isBuiltin !== 'function') {
  Module.isBuiltin = (moduleName: string) => {
    if (moduleName.startsWith('node:')) {
      moduleName = moduleName.substring('node:'.length)
    }
    return Module.builtinModules.includes(moduleName)
  }
}
/* c8 ignore stop */

// It's pretty common to resolve against, eg, cwd + '/x', since we might not
// know the actual file that it's being loaded from, and want to resolve what
// a dep WOULD be from a given path. This allows us to realpath that directory,
// without requiring that the file exist.
const realpathParentDir = (path: string | URL) => {
  path = toPath(path)
  return resolve(realpathSync(dirname(path)), basename(path))
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
export const resolveImportSync = (
  /** the thing being imported */
  url: string | URL,
  /**
   * the place the import() would be coming from. Required for relative
   * imports.
   */
  parentURL: string | URL | undefined = undefined,
  options: ResolveImportOpts = {},
): URL | string => {
  // already resolved, just check that it exists
  if (typeof url === 'string' && url.startsWith('file://')) {
    url = new URL(url)
  }
  if (typeof url === 'object') {
    if (!fileExistsSync(url)) {
      throw moduleNotFound(String(url), String(parentURL))
    }
    const rp = realpathSync(toPath(url))
    return rp !== fileURLToPath(url) ? pathToFileURL(rp) : url
  }

  const pu =
    parentURL ? toFileURL(realpathParentDir(parentURL)) : undefined

  if (isRelativeRequire(url)) {
    if (!pu) {
      throw relativeImportWithoutParentURL(url, parentURL)
    }
    const u = new URL(url, pu)
    if (!fileExistsSync(u)) {
      throw moduleNotFound(url, String(parentURL))
    }
    return pathToFileURL(realpathSync(new URL(url, pu)))
  }

  if (isAbsolute(url)) {
    if (!fileExistsSync(url)) {
      throw moduleNotFound(url, String(parentURL))
    }
    return pathToFileURL(realpathSync(url))
  }

  if (Module.isBuiltin(String(url))) {
    return String(url)
  }

  // ok, we have to resolve it. some kind of bare dep import,
  // either a package name resolving to module or main, or a named export.
  const parentPath: string = toPath(
    parentURL || resolve(realpathSync(process.cwd()), 'x'),
  )
  const opts = {
    ...options,
    originalParent: String(options.originalParent || parentPath),
  }
  if (url) {
    return resolvePackageImportSync(url, parentPath, opts)
  } else {
    return resolveDependencyExportsSync(url, parentPath, opts)
  }
}
