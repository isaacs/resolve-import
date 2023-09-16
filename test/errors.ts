import t from 'tap'

import {
  invalidImportSpecifier,
  invalidPackage,
  moduleNotFound,
  packageImportNotDefined,
  packageNotFound,
  relativeImportWithoutParentURL,
  subpathNotExported,
} from '../dist/esm/errors.js'

t.matchSnapshot(invalidImportSpecifier('some invalid url'))
t.matchSnapshot(invalidPackage('/some/package.json'))
t.matchSnapshot(moduleNotFound('/path/to/module', '/from'))
t.matchSnapshot(packageImportNotDefined('./a', '/x/package.json', '/from'))
t.matchSnapshot(packageNotFound('@some/pkg', '/from'))
t.matchSnapshot(relativeImportWithoutParentURL('../foo', null))
t.matchSnapshot(subpathNotExported('.', '/x/package.json', '/from'))
t.matchSnapshot(subpathNotExported('./x', '/x/package.json', '/from'))
