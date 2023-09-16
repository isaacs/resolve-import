/* IMPORTANT
 * This snapshot file is auto-generated, but designed for humans.
 * It should be checked into source control and tracked carefully.
 * Re-generate by setting TAP_SNAPSHOT=1 and running tests.
 * Make sure to inspect the output below.  Do not ignore changes!
 */
'use strict'
exports[`test/get-all-conditional-values.ts > TAP > valid values > [{"import":{"node":"x"}},{"node":{"import":"y"}}] > must match snapshot 1`] = `
Array [
  Array [
    ".",
    Set {
      "import",
      "node",
    },
    "x",
  ],
]
`

exports[`test/get-all-conditional-values.ts > TAP > valid values > {"./x":{"import":"./x.js"},"./y":"./y.js"} > must match snapshot 1`] = `
Array [
  Array [
    "./x",
    Set {
      "import",
    },
    "./x.js",
  ],
  Array [
    "./y",
    Set {},
    "./y.js",
  ],
]
`

exports[`test/get-all-conditional-values.ts > TAP > valid values > {"import":{"node":"x"},"node":{"import":"y"}} > must match snapshot 1`] = `
Array [
  Array [
    ".",
    Set {
      "import",
      "node",
    },
    "x",
  ],
]
`

exports[`test/get-all-conditional-values.ts > TAP > valid values > {"import":{"node":[{"z":"z"},"x"]},"node":{"import":"y"}} > must match snapshot 1`] = `
Array [
  Array [
    ".",
    Set {
      "import",
      "node",
      "z",
    },
    "z",
  ],
  Array [
    ".",
    Set {
      "import",
      "node",
    },
    "x",
  ],
]
`

exports[`test/get-all-conditional-values.ts > TAP > valid values > {"import":{"node":{"default":"x"}},"node":{"import":"y"}} > must match snapshot 1`] = `
Array [
  Array [
    ".",
    Set {
      "import",
      "node",
    },
    "x",
  ],
]
`

exports[`test/get-all-conditional-values.ts > TAP > valid values > {"import":null,"node":[{"require":"x"},{"import":"y"},"z"]} > must match snapshot 1`] = `
Array [
  Array [
    ".",
    Set {
      "import",
    },
    null,
  ],
  Array [
    ".",
    Set {
      "node",
      "require",
    },
    "x",
  ],
  Array [
    ".",
    Set {
      "node",
    },
    "z",
  ],
]
`
