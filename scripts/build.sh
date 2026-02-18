#!/usr/bin/env bash

esbuild \
  --minify \
  --platform=node \
  --sourcemap \
  --bundle dist/commonjs/index.js \
  --outfile=dist/commonjs/index.min.js \
  --format=cjs

esbuild \
  --minify \
  --platform=node \
  --sourcemap \
  --bundle dist/esm/index.js \
  --outfile=dist/esm/index.min.js \
  --format=esm

esbuild \
  --minify \
  --platform=node \
  --sourcemap \
  --bundle dist/commonjs/resolve-import-sync.js \
  --outfile=dist/commonjs/resolve-import-sync.min.js \
  --format=cjs

esbuild \
  --minify \
  --platform=node \
  --sourcemap \
  --bundle dist/esm/resolve-import-sync.js \
  --outfile=dist/esm/resolve-import-sync.min.js \
  --format=esm

esbuild \
  --minify \
  --platform=node \
  --sourcemap \
  --bundle dist/commonjs/resolve-import-async.js \
  --outfile=dist/commonjs/resolve-import-async.min.js \
  --format=cjs

esbuild \
  --minify \
  --platform=node \
  --sourcemap \
  --bundle dist/esm/resolve-import-async.js \
  --outfile=dist/esm/resolve-import-async.min.js \
  --format=esm
