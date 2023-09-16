/**
 * Exported as `'resolve-import/resolve-conditional-value'`
 * @module
 */
import { ConditionalValue, ResolveImportOpts } from './index.js'

/**
 * find the first match for string, import, node, or default
 * at this point, we know we're on the right subpath already
 */
export const resolveConditionalValue = (
  exp: ConditionalValue,
  options: ResolveImportOpts
): string | null => {
  const { conditions = ['import', 'node'] } = options
  if (exp === null || typeof exp === 'string') return exp
  if (Array.isArray(exp)) {
    for (const e of exp) {
      const r = resolveConditionalValue(e, options)
      if (r) return r
    }
    return null
  }
  for (const [k, v] of Object.entries(exp)) {
    if (conditions.includes(k) || k === 'default') {
      return resolveConditionalValue(v, options)
    }
  }
  return null
}
