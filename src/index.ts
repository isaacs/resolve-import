export * from './get-all-conditional-values.js'
export * from './get-all-conditions.js'
export * from './get-unique-condition-sets.js'
export * from './is-relative-require.js'
export * from './resolve-all-exports.js'
export * from './resolve-all-local-imports.js'
export * from './resolve-conditional-value.js'
export * from './resolve-import.js'

export interface ResolveImportOpts {
  /**
   * Used when resolves take multiple steps through dependencies.
   *
   * @internal
   */
  originalParent?: string

  /**
   * List of conditions to resolve. Defaults to ['import', 'node'].
   *
   * If set to ['require', 'node'], then this is functionally equivalent to
   * `require.resolve()`.
   *
   * 'default' is always allowed.
   */
  conditions?: string[]
}

export type ConditionalValueObject = {
  [k: string]: ConditionalValue
}
export type ConditionalValue =
  | null
  | string
  | ConditionalValueObject
  | ConditionalValue[]

export type ExportsSubpaths = {
  [path: string]: ConditionalValue
}

export type Exports = Exclude<ConditionalValue, null> | ExportsSubpaths

export type Imports = {
  [path: string]: ConditionalValue
}
