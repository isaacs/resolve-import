/**
 * Exported as `'resolve-import/get-conditional-values-list'`
 * @module
 */
import { ConditionalValue, Exports, Imports } from './index.js'

export type ConditionalValuesList = [
  submodulePath: string,
  conditions: Set<string>,
  resolvedValue: string | null,
][]

/**
 * Given an `exports` or `imports` value from a package, return the list of all
 * possible conditional values that it might potentially resolve to, for any
 * possible set of import conditions, along with the `Set<string>` of
 * conditions, any superset of which will result in the condition.
 *
 * The list includes null results, since while these are not a valid resolution
 * per se, they do *prevent* valid resolutions that match the same conditions.
 */
export const getConditionalValuesList = (
  importsExports: Imports | Exports,
): ConditionalValuesList => {
  if (
    !!importsExports &&
    typeof importsExports === 'object' &&
    !Array.isArray(importsExports)
  ) {
    let subs: string | undefined = undefined
    const conditions: ConditionalValuesList = []
    for (const [k, v] of Object.entries(importsExports)) {
      /* c8 ignore start */
      if (!k) continue
      /* c8 ignore stop */
      if (subs === undefined) {
        if (!k.startsWith('#') && k !== '.' && !k.startsWith('./')) {
          return getConditionalValuesListFromCond(
            importsExports as ConditionalValue,
          ).map(s => ['.', ...s])
        }
        subs = k.charAt(0)
      }
      if (
        // imports have to be #<something>
        (subs === '#' && (k === '#' || !k.startsWith('#'))) ||
        // exports can be ./<something> or .
        (subs === '.' && k !== '.' && !k.startsWith('./'))
      ) {
        throw new Error(
          `invalid ${
            subs === '.' ? 'exports' : 'imports'
          } object, all keys ` + `must start with ${subs}. Found ${k}.`,
        )
      }
      conditions.push(
        ...getConditionalValuesListFromCond(v).map(
          s => [k, ...s] as [string, Set<string>, string | null],
        ),
      )
    }
    return conditions
  }
  return getConditionalValuesListFromCond(
    importsExports as ConditionalValue,
  ).map(s => ['.', ...s])
}

const isSubset = (maybeSub: Set<string>, sup: Set<string>) => {
  if (maybeSub.size > sup.size) return false
  for (const c of maybeSub) {
    if (!sup.has(c)) return false
  }
  return true
}

// walk down the tree, creating a list of [Set<Condition>, value]
// if a subset of the current set is already present in the list, then omit it
const getConditionalValuesListFromCond = (
  cond?: ConditionalValue,
  path: string[] = [], // path of conditions that got here
  list: [Set<string>, string | null][] = [],
): [Set<string>, string | null][] => {
  /* c8 ignore start */
  if (cond === undefined) return list
  /* c8 ignore stop */
  if (cond === null || typeof cond === 'string') {
    // reached a resolution value.
    // if we got here, we know it has not yet been seen.
    list.push([new Set(path), cond])
    return list
  }
  if (Array.isArray(cond)) {
    for (const c of cond) {
      getConditionalValuesListFromCond(c, path, list)
      // if we hit a default condition, break
      if (!c || typeof c === 'string') break
    }
    return list
  }
  // ConditionalValueObject
  for (const [k, v] of Object.entries(cond)) {
    if (k.startsWith('#') || k === '.' || k.startsWith('./')) {
      throw new Error(`Expected valid import condition, got: ${k}`)
    }
    const p = k === 'default' ? path : path.concat(k)
    // if no subset seen, then recurse
    const ps = new Set(p)
    const seen = list.some(([s]) => isSubset(s, ps))
    if (!seen) {
      getConditionalValuesListFromCond(v, p, list)
    }
    if (k === 'default') break
  }
  return list
}
