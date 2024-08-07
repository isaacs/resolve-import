import { getConditionalValuesList } from './get-conditional-values-list.js'
import { Exports, Imports } from './index.js'

/**
 * Get the minimal set of conditions that can potentially produce different
 * resolution values for a given imports or exports object from a package
 * manifest.
 *
 * For example:
 *
 * ```json
 * {
 *   ".": [{"import":[{"types":"x.d.ts"},"x.mjs"], "require":"y.js"}]
 *   "./a": {"browser":{"require":"./a.js"}},
 *   "./b": {"browser":"./b.js"},
 *   "./c": {"require":{"browser":"./c.js"}}
 * }
 * ```
 *
 * would return:
 * ```js
 * [
 *   ['import','types'],
 *   ['import'],
 *   ['require'],
 *   ['browser'],
 *   ['browser', 'require'],
 * ]
 * ```
 *
 * With the `['require', 'browser']` condition set omitted, as it is already
 * covered by `['browser', 'require']`.
 *
 * Condition ordering is arbitrary and not guaranteed to be consistent.
 */
export const getUniqueConditionSets = (
  importsExports: Imports | Exports,
): string[][] => {
  const list = getConditionalValuesList(importsExports)
  let results: string[][] = []
  for (const [_, conditions] of list) {
    if (!results.some(arr => arrayIsEquivalent(arr, conditions))) {
      results.push([...conditions])
    }
  }
  return results
}

const arrayIsEquivalent = (arr: string[], sup: Set<string>) => {
  if (arr.length !== sup.size) return false
  for (const c of arr) {
    if (!sup.has(c)) return false
  }
  return true
}
