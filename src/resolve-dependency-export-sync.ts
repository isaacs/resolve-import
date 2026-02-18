import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { moduleNotFound, packageNotFound } from './errors.js'
import { fileExistsSync } from './file-exists.js'
import { findDepPackageSync } from './find-dep-package.js'
import { ResolveImportOpts } from './index.js'
import { readPkgSync } from './read-pkg.js'
import { resolveExport } from './resolve-export.js'

/**
 * Resolve a dependency like '@dep/name/sub/module' where
 * '@dep/name' is in node_modules somewhere and exports './sub/module'
 */
export const resolveDependencyExportsSync = (
  url: string | null,
  parentPath: string,
  options: ResolveImportOpts & { originalParent: string },
): URL => {
  const { originalParent } = options
  const parts = url?.match(/^(@[^\/]+\/[^\/]+|[^\/]+)(?:\/(.*))?$/)
  const [, pkgName, sub] =
    url === null ? [, null, ''] : parts || ['', '', '']
  const ppath = findDepPackageSync(pkgName, parentPath)
  if (!ppath) {
    throw packageNotFound(pkgName, originalParent)
  }

  const indexjs = resolve(ppath, 'index.js')
  const pj = resolve(ppath, 'package.json')
  const pkg = readPkgSync(pj)
  const subpath = sub ? resolve(ppath, sub) : false
  // if not a package, then the sub can still be a direct path
  // if no sub, then resolves to index.js if available.
  if (!pkg) {
    if (!subpath) {
      // try index.js, otherwise fail
      if (fileExistsSync(indexjs)) return pathToFileURL(indexjs)
      else throw packageNotFound(ppath, originalParent)
    } else {
      if (fileExistsSync(subpath)) {
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
    if (fileExistsSync(resolved)) return pathToFileURL(resolved)
    else throw moduleNotFound(resolved, originalParent)
  } else if (subpath) {
    if (fileExistsSync(subpath)) return pathToFileURL(subpath)
    else throw moduleNotFound(subpath, originalParent)
  } else if (pkg.main) {
    // fall back to index.js if main is missing
    const rmain = resolve(ppath, pkg.main)
    if (fileExistsSync(rmain)) return pathToFileURL(rmain)
    else if (fileExistsSync(indexjs)) return pathToFileURL(indexjs)
    else throw packageNotFound(ppath, originalParent)
  } else if (fileExistsSync(indexjs)) {
    return pathToFileURL(indexjs)
  } else {
    throw packageNotFound(ppath, originalParent)
  }
}
