'use strict';
// No-op stub for the 'server-only' module during test runs.
// In the Next.js build pipeline, 'server-only' throws when imported
// from client components.  During tsx --test, we don't have that
// distinction and all modules are server-side, so a no-op is safe.
module.exports = {};
