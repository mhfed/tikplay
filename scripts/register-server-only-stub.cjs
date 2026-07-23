'use strict';
// ============================================================================
// Test bootstrap: redirect 'server-only' to a no-op stub.
// The real 'server-only' package intentionally throws when imported outside
// of the Next.js server bundle.  During tsx --test, every module runs in a
// Node.js process where the server/client distinction is meaningless, so a
// no-op stub is correct.
//
// Usage:
//   NODE_OPTIONS='--require ./scripts/register-server-only-stub.cjs' \
//     npx tsx --test scripts/your-test-file.test.ts
// ============================================================================

const path = require('node:path');
const Module = require('node:module');

const origResolve = Module._resolveFilename;

Module._resolveFilename = function resolveWithServerOnlyStub(
  request,
  parent,
  isMain,
) {
  if (
    request === 'server-only' ||
    request === 'server-only/index' ||
    request === 'server-only/index.js'
  ) {
    return path.resolve(__dirname, 'server-only-stub.cjs');
  }
  return origResolve.call(this, request, parent, isMain);
};
