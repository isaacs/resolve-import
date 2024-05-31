/**
 * Exported as `'resolve-import/resolve-import'`
 * @module
 */
import { realpath } from 'fs/promises'
import { basename, dirname, isAbsolute, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import {
  moduleNotFound,
  relativeImportWithoutParentURL,
} from './errors.js'
import { isBuiltin } from './is-builtin.js'
import { fileExists } from './file-exists.js'
import { ResolveImportOpts } from './index.js'
import { isRelativeRequire } from './is-relative-require.js'
import { resolveDependencyExports } from './resolve-dependency-export.js'
import { resolvePackageImport } from './resolve-package-import.js'
import { toFileURL } from './to-file-url.js'
import { toPath } from './to-path.js'

// It's pretty common to resolve against, eg, cwd + '/x', since we might not
// know the actual file that it's being loaded from, and want to resolve what
// a dep WOULD be from a given path. This allows us to realpath that directory,
// without requiring that the file exist.
const realpathParentDir = async (path: string | URL) => {
  path = toPath(path)
  return resolve(await realpath(dirname(path)), basename(path))
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
    const rp = await realpath(toPath(url))
    return rp !== fileURLToPath(url) ? pathToFileURL(rp) : url
  }

  const pu = parentURL
    ? toFileURL(await realpathParentDir(parentURL))
    : undefined

  if (isRelativeRequire(url)) {
    if (!pu) {
      throw relativeImportWithoutParentURL(url, parentURL)
    }
    const u = new URL(url, pu)
    if (!(await fileExists(u))) {
      throw moduleNotFound(url, String(parentURL))
    }
    return pathToFileURL(await realpath(new URL(url, pu)))
  }

  if (isAbsolute(url)) {
    if (!(await fileExists(url))) {
      throw moduleNotFound(url, String(parentURL))
    }
    return pathToFileURL(await realpath(url))
  }

  if (isBuiltin(String(url))) {
    return String(url)
  }

  // ok, we have to resolve it. some kind of bare dep import,
  // either a package name resolving to module or main, or a named export.
  const parentPath: string = toPath(
    parentURL || resolve(await realpath(process.cwd()), 'x')
  )
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
