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
  options: ResolveImportOpts,
): string | null => {
  if (exp === null || typeof exp === 'string') return exp
  if (Array.isArray(exp)) {
    for (const e of exp) {
      const r = resolveConditionalValue(e, options)
      if (r) return r
    }
    return null
  }

  const conditions = new Set(['default'])
  for (const condition of options.conditions ?? ['import', 'node']) {
    if (condition.startsWith('!')) {
      conditions.delete(condition.slice(1))
    } else {
      conditions.add(condition)
    }
  }
  for (const [k, v] of Object.entries(exp)) {
    if (conditions.has(k)) {
      return resolveConditionalValue(v, options)
    }
  }
  return null
}
