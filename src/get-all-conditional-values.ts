/**
 * Exported as `'resolve-import/get-all-conditional-values'`
 * @module
 */
import { getConditionalValuesList } from './get-conditional-values-list.js'
import { Exports, Imports } from './index.js'

/**
 * Given an `exports` or `imports` value from a package, return the list of all
 * possible conditional values that it might potentially resolve to, for any
 * possible set of import conditions.
 *
 * Filters out cases that are unreachable, such as conditions that appear after
 * a `default` value, or after a set of conditions that would have been
 * satisfied previously.
 *
 * For example:
 *
 * ```json
 * {
 *   "import": { "node": "./x.js" },
 *   "node": { "import": { "blah": "./y.js" } }
 * }
 * ```
 *
 * Will return `['./x.js']`, omitting the unreachable `'./y.js'`, because the
 * conditions ['import','node','blah'] would have been satisfied by the earlier
 * condition.
 *
 * Note that this does *not* mean that the target actually can be imported, as
 * it may not exist, be an incorrect module type, etc.
 *
 * Star values are not expanded. For that, use `resolveAllExports` or
 * `resolveAllLocalImports`.
 */
export const getAllConditionalValues = (
  importsExports: Imports | Exports,
): string[] => [
  ...new Set(
    getConditionalValuesList(importsExports)
      .map(([_, __, c]) => c)
      .filter(c => !!c) as string[],
  ),
]
