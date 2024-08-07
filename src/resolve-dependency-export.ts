import { resolve } from 'path'
import { pathToFileURL } from 'url'
import { moduleNotFound, packageNotFound } from './errors.js'
import { fileExists } from './file-exists.js'
import { findDepPackage } from './find-dep-package.js'
import { ResolveImportOpts } from './index.js'
import { readPkg } from './read-pkg.js'
import { resolveExport } from './resolve-export.js'

/**
 * Resolve a dependency like '@dep/name/sub/module' where
 * '@dep/name' is in node_modules somewhere and exports './sub/module'
 */
export const resolveDependencyExports = async (
  url: string | null,
  parentPath: string,
  options: ResolveImportOpts & { originalParent: string },
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
      options,
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
