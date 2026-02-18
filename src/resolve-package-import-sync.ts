import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { walkUp } from 'walk-up-path'
import {
  invalidImportSpecifier,
  moduleNotFound,
  packageImportNotDefined,
} from './errors.js'
import { fileExistsSync } from './file-exists.js'
import { findStarMatch } from './find-star-match.js'
import { ConditionalValue, ResolveImportOpts } from './index.js'
import { readPkgSync } from './read-pkg.js'
import { resolveConditionalValue } from './resolve-conditional-value.js'
import { resolveDependencyExportsSync } from './resolve-dependency-export-sync.js'
import { resolveExport } from './resolve-export.js'
import { resolveImportSync } from './resolve-import-sync.js'

/**
 * Resolve an import like '@package/name/sub/module', where
 * './sub/module' appears in the exports of the local package.
 */
export const resolvePackageImportSync = (
  url: string,
  parentPath: string,
  options: ResolveImportOpts & { originalParent: string },
): URL | string => {
  const { originalParent } = options
  const parts = url.match(/^(@[^\/]+\/[^\/]+|[^\/]+)(?:\/(.*))?$/) as
    | null
    | (RegExpMatchArray & [string, string, string])
  // impossible
  /* c8 ignore start */
  if (!parts) throw invalidImportSpecifier(url)
  /* c8 ignore stop */

  for (const dir of walkUp(dirname(parentPath))) {
    const pj = resolve(dir, 'package.json')
    const pkg = readPkgSync(pj)
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
          options,
        )
        const resolved = resolve(dir, subPath)
        if (fileExistsSync(resolved)) return pathToFileURL(resolved)
        else throw moduleNotFound(resolved, originalParent)
      }
    }

    if (url.startsWith('#')) {
      if (!pkg.imports) {
        throw packageImportNotDefined(url, pj, originalParent)
      }
      const exact = pkg.imports[url]
      if (exact !== undefined) {
        const res = resolveConditionalValue(exact, options)
        if (!res) {
          throw packageImportNotDefined(url, pj, originalParent)
        }
        // kind of weird behavior, but it's what node does
        if (res.startsWith('#')) {
          return resolveDependencyExportsSync(null, parentPath, options)
        }
        return resolveImportSync(res, pj, options)
      }

      const sm = findStarMatch(url, pkg.imports)
      if (!sm) {
        throw packageImportNotDefined(url, pj, originalParent)
      }
      const [key, mid] = sm
      const match = pkg.imports[key] as ConditionalValue
      const res = resolveConditionalValue(match, options)
      if (!res) {
        throw packageImportNotDefined(url, pj, originalParent)
      }
      if (res.startsWith('#')) {
        return resolveDependencyExportsSync(null, parentPath, options)
      }
      const expand = res.replace(/\*/g, mid)

      // start over with the resolved import
      return resolveImportSync(expand, pj, options)
    }

    break
  }

  return resolveDependencyExportsSync(url, parentPath, options)
}
