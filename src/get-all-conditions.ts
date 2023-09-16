import { ConditionalValue, Exports, Imports } from './index.js'

/**
 * Given an `exports` or `imports` value from a package, return the list of
 * conditions that it is sensitive to.
 *
 * `default` is not included in the returned list, since that's always
 * effectively relevant.
 *
 * Note that a condition being returned by this method does not mean
 * that the export/import object actually has a *target* for that condition,
 * since it may map to `null`, be nested under another condition, etc. But it
 * does potentially have some kind of conditional behavior for all the
 * conditions returned.
 *
 * Ordering of returned conditions is arbitrary, and does not imply precedence
 * or object shape.
 */
export const getAllConditions = (
  importsExports: Imports | Exports | ConditionalValue
): string[] => {
  if (
    !!importsExports &&
    typeof importsExports === 'object' &&
    !Array.isArray(importsExports)
  ) {
    let subs: string | undefined = undefined
    const conditions: string[] = []
    for (const [k, v] of Object.entries(importsExports)) {
      /* c8 ignore start */
      if (!k) continue
      /* c8 ignore stop */
      if (subs === undefined) {
        if (!k.startsWith('#') && k !== '.' && !k.startsWith('./')) {
          return getAllConditionsFromCond(
            importsExports as ConditionalValue
          )
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
          } object, all keys ` + `must start with ${subs}. Found ${k}.`
        )
      }
      conditions.push(...getAllConditionsFromCond(v))
    }
    return [...new Set(conditions)]
  }

  return getAllConditionsFromCond(importsExports as ConditionalValue)
}

const getAllConditionsFromCond = (cond?: ConditionalValue): string[] => {
  if (!cond || typeof cond === 'string') return []
  if (Array.isArray(cond)) {
    const conditions: string[] = []
    for (const e of cond) {
      if (!e || typeof e === 'string') break
      conditions.push(...getAllConditionsFromCond(e))
    }
    return [...new Set(conditions)]
  }
  const conditions: string[] = []
  for (const [k, v] of Object.entries(cond)) {
    if (k.startsWith('#') || k === '.' || k.startsWith('./')) {
      throw new Error(`Expected valid import condition, got: ${k}`)
    }
    // anything after 'default' isn't relevant
    conditions.push(...getAllConditionsFromCond(v))
    if (k === 'default') break
    else conditions.push(k)
  }
  return [...new Set(conditions)]
}
