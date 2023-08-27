/**
 * Errors raised by resolve failures.
 * @module
 */

// TODO: move "caller" to an options object. Then the same options object can
// be used that handles conditions, parentURL, etc., and the relevant
// top-level function can set it explicitly at the start of the process and
// just pass it along.

import { resolveImport } from './index.js'

export const invalidImportSpecifier = (
  url: string,
  caller: (...a: any[]) => any = resolveImport
) => {
  const er = new Error('invalid import() specifier: ' + url)
  Error.captureStackTrace(er, caller)
  return er
}

export const invalidPackage = (
  pj: string | URL,
  caller: (...a: any[]) => any = resolveImport
) => {
  const er = new Error(`Not a valid package: ${pj}`)
  Error.captureStackTrace(er, caller)
  return er
}

export const relativeImportWithoutParentURL = (
  url: string,
  parentURL: any,
  caller: (...a: any[]) => any = resolveImport
) => {
  const er = Object.assign(
    new Error('relative import without parentURL'),
    {
      url,
      parentURL,
    }
  )
  Error.captureStackTrace(er, caller)
  return er
}

export const subpathNotExported = (
  sub: string,
  pj: string,
  from: string,
  caller: (...a: any[]) => any = resolveImport
) => {
  const p =
    sub === '.'
      ? 'No "exports" main defined'
      : `Package subpath '${sub}' is not defined by "exports"`
  const er = Object.assign(
    new Error(`${p} in ${pj} imported from ${from}`),
    {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    }
  )
  Error.captureStackTrace(er, caller)
  return er
}

export const packageNotFound = (
  path: string | null,
  from: string,
  caller: (...a: any[]) => any = resolveImport
) => {
  const er = Object.assign(
    new Error(`Cannot find package '${path}' imported from ${from}`),
    {
      code: 'ERR_MODULE_NOT_FOUND',
    }
  )
  Error.captureStackTrace(er, caller)
  return er
}

export const moduleNotFound = (
  path: string,
  from: string,
  caller: (...a: any[]) => any = resolveImport
) => {
  const er = Object.assign(
    new Error(`Cannot find module '${path}' imported from ${from}`),
    {
      code: 'ERR_MODULE_NOT_FOUND',
    }
  )
  Error.captureStackTrace(er, caller)
  return er
}

export const packageImportNotDefined = (
  path: string,
  pj: string,
  from: string,
  caller: (...a: any[]) => any = resolveImport
) => {
  const er = Object.assign(
    new Error(
      `Package import specifier "${path}" is not defined in package ` +
        `${pj} imported from ${from}`
    ),
    { code: 'ERR_PACKAGE_IMPORT_NOT_DEFINED' }
  )
  Error.captureStackTrace(er, caller)
  return er
}
