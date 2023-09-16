/**
 * Exported as `'resolve-import/resolve-import'`
 * @module
 */
import { isBuiltin } from 'module'
import { isAbsolute, resolve } from 'path'
import { pathToFileURL } from 'url'
import {
  moduleNotFound,
  relativeImportWithoutParentURL,
} from './errors.js'
import { fileExists } from './file-exists.js'
import { ResolveImportOpts } from './index.js'
import { isRelativeRequire } from './is-relative-require.js'
import { resolveDependencyExports } from './resolve-dependency-export.js'
import { resolvePackageImport } from './resolve-package-import.js'
import { toFileURL } from './to-file-url.js'
import { toPath } from './to-path.js'

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

  if (isBuiltin(String(url))) {
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
