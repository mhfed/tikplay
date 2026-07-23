# Wave 1 authentication compatibility spike

- **Issue:** GitHub #13
- **Date:** 2026-07-22 UTC
- **Scope:** Research, package inspection, and isolated TypeScript compilation only
- **Decision:** Conditional **GO** for issues #14–#17; production authentication and schema work did not begin in this spike
- **Evidence level:** High for package resolution, package metadata, exported TypeScript APIs, and TypeScript 7 compilation; medium for documented runtime behavior; not yet verified against a live PostgreSQL database, real Google OAuth, Resend delivery, or a production Next.js build

## 1. Executive decision

Use these exact pins in the foundation implementation:

| Role              | Exact pin             | Placement              | Decision basis                                                                                                                                           |
| ----------------- | --------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication    | `better-auth@1.6.24`  | runtime dependency     | Current stable release; explicitly peers with Next 14–16, React 18–19, Drizzle `^0.45.2`, `pg ^8`, and `drizzle-kit >=0.31.4`; isolated TS7 proof passed |
| ORM               | `drizzle-orm@0.45.2`  | runtime dependency     | Exact version required by Better Auth 1.6.24's peer range; isolated node-postgres adapter proof passed                                                   |
| PostgreSQL driver | `pg@8.22.0`           | runtime dependency     | Preferred for the long-lived Node.js Docker/Fly process, standard pooling, transactions, and migration tooling; Node `>=16`, so Node 20.19.6 passes      |
| PostgreSQL types  | `@types/pg@8.15.6`    | development dependency | Required by the isolated strict TypeScript proof; pin it with `pg`                                                                                       |
| Migration CLI     | `drizzle-kit@0.31.10` | development dependency | Current stable; satisfies Better Auth's `>=0.31.4` peer requirement                                                                                      |
| Email SDK         | `resend@6.18.0`       | runtime dependency     | Current stable; Node `>=20`, exactly satisfied by the repository's Node 20 runtime                                                                       |

Do **not** use floating ranges for this foundation. Preserve the resulting lockfile in the later dependency-owned issue. Better Auth 1.6.24 was published only about 52 minutes before this spike's registry snapshot; despite the successful compile, its same-day age raises operational risk. The implementation should therefore keep a quick rollback pin to `better-auth@1.6.23` available if integration tests expose a 1.6.24 regression. Version 1.6.23 is represented in the official versioned documentation and has the same documented integration surface used here.

## 2. Baseline and compatibility matrix

The repository baseline inspected was:

- Next.js `16.2.10`, React and React DOM `19.2.7`.
- TypeScript `7.0.2`, plus `@typescript/native-preview` for the project's current workflow.
- Node `v20.19.6`, npm `10.8.2`, macOS development host.
- Next.js standalone output with webpack and build-time TypeScript checking intentionally disabled; repository type safety is checked separately with `npx tsc --noEmit`.
- TypeScript options include strict mode, ESM output, bundler module resolution, isolated modules, and `skipLibCheck`.

Better Auth 1.6.24 declares these relevant peer ranges:

```text
next: ^14.0.0 || ^15.0.0 || ^16.0.0
react/react-dom: ^18.0.0 || ^19.0.0
drizzle-orm: ^0.45.2
drizzle-kit: >=0.31.4
pg: ^8.0.0
```

All selected pins satisfy those ranges. Better Auth does not declare a Node engine. The effective minimum for this selected stack is Node 20 because Resend 6.18.0 declares `node >=20`; `pg` 8.22.0 declares `node >=16`.

No package declares TypeScript 7 explicitly. Compatibility with TypeScript 7.0.2 is therefore proven by this spike's strict no-emit compile, not by an upstream support declaration.

## 3. PostgreSQL driver decision

### Preferred: node-postgres (`pg`)

Use `pg@8.22.0` through Drizzle's `drizzle-orm/node-postgres` adapter.

Reasons:

1. TikPlay is deployed as a persistent Node.js process in Docker/Fly, not as a short-lived edge function. A singleton, bounded `pg.Pool` fits that lifecycle.
2. Better Auth 1.6.24 explicitly lists `pg ^8.0.0` as an optional peer, and its current Drizzle PostgreSQL test setup uses `drizzle-orm/node-postgres`, `Pool`, `provider: 'pg'`, and adapter transactions.
3. `pg` provides conventional connection pooling and explicit client transactions. This is suitable for auth session/account writes and TikPlay's future multi-table guest imports.
4. Drizzle Kit and PostgreSQL migration operations fit a direct Node connection. Runtime and migration URLs can be separated when a managed provider supplies a transaction pooler that is unsuitable for DDL or migration locks.
5. It avoids choosing an HTTP/edge-specialized driver when the route must use Node-only dependencies and database transactions.

Operational shape:

- Create one process-level pool, with a conservative maximum and connection/idle timeouts appropriate to Fly machine count and the managed PostgreSQL connection limit.
- Use TLS verification required by the provider; never globally disable certificate verification.
- Use `DATABASE_URL` for the pooled runtime connection.
- Prefer `DATABASE_MIGRATION_URL` for a direct/non-pooled migration connection where the provider's pooler has DDL, advisory-lock, prepared-statement, or transaction limitations.
- Run reviewed Drizzle migrations as a release/administrative step, not at application startup and not concurrently from every Fly machine.
- Enable Better Auth Drizzle adapter transaction support and test it against the selected provider/pool mode.

### Fallback: Postgres.js

`postgres@3.4.9` is a viable Drizzle-supported Node driver and declares Node `>=12`. It is not preferred because Better Auth's package metadata and current PostgreSQL adapter test evidence directly identify `pg`, and `pg.Pool` is the clearer operational fit for this deployment. Use Postgres.js only if provider-specific testing demonstrates a concrete `pg` blocker; repeat schema generation, transaction, migration, and standalone-build proofs after any driver change.

Serverless/edge drivers such as Neon HTTP are not selected. They would alter transaction semantics and should not be substituted without a separate deployment-specific spike.

## 4. Better Auth integration contract

### 4.1 App Router handler

Use a catch-all route under `/api/auth/[...all]` and export methods from `toNextJsHandler`:

```ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const runtime = 'nodejs';
export const { GET, POST } = toNextJsHandler(auth);
```

Current Better Auth examples can also expose PUT, PATCH, and DELETE from the returned handler when enabled plugins require them. Start with the documented GET/POST surface, then inspect generated endpoint requirements before freezing route methods.

The auth route and all database-backed session calls must remain on the Node runtime. Do not mark them as Edge routes. The selected `pg` driver and connection model are Node-oriented.

### 4.2 Server session API

Server Components and Route Handlers obtain request headers and pass them to Better Auth:

```ts
const session = await auth.api.getSession({ headers: await headers() });
```

`headers()` is asynchronous on this Next.js baseline. Application APIs must wrap this call in TikPlay-owned optional/required-session helpers and must never authorize from client session state or a body-supplied user ID.

### 4.3 Client API

Create the browser client from `better-auth/react`:

```ts
import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});
```

Keep this in a client-safe module. Do not import server auth configuration, `pg`, secrets, or Resend into the client graph.

### 4.4 Cookies and Server Actions

Better Auth uses cookie-backed session tokens; production policy must retain HttpOnly and Secure attributes and use the library's default/recommended SameSite behavior unless callback testing justifies a reviewed change. Avoid a broad cookie Domain.

Add `nextCookies()` from `better-auth/next-js` when authentication APIs are called in Server Actions. It translates returned `Set-Cookie` headers through Next.js cookie APIs and must be the **last** Better Auth plugin. Route-handler responses already carry their cookie headers and do not require a custom cookie bridge.

Do not read only a cookie name in middleware and treat it as authorization. Full session validation must occur in Node runtime code against the database. Middleware may be a navigation optimization only.

### 4.5 Origins, secret, and base URL

Required production configuration:

- `BETTER_AUTH_SECRET`: at least 32 cryptographically random bytes, unique per environment.
- `BETTER_AUTH_URL`: canonical HTTPS origin with no auth path suffix.
- `trustedOrigins`: an explicit array of exact origins. Parse and trim `AUTH_ALLOWED_ORIGINS`; reject malformed or wildcard production entries. Include only canonical production and specifically approved preview/development origins.

Do not derive trusted origins from an untrusted request Host header. Google redirect URIs and post-auth callback URLs must use the canonical origin and an application allowlist.

### 4.6 Google provider

Google is first-party through `socialProviders.google`:

```ts
socialProviders: {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  },
}
```

Use separate Google OAuth clients per environment and register the exact Better Auth callback URI. Keep the client secret server-only. Do not enable automatic account linking solely because provider and magic-link emails match; the PRD's authenticated, conflict-safe linking policy remains authoritative.

### 4.7 Magic links and Resend

Email magic-link authentication is **not core-only configuration**. Add Better Auth's first-party `magicLink` server plugin and `magicLinkClient` client plugin. The server plugin owns token creation/verification and supplies `{ email, url }` to an application callback. Resend is only the delivery boundary:

```ts
magicLink({
  sendMagicLink: async ({ email, url }) => {
    await resend.emails.send({ from, to: email, subject, html });
  },
});
```

Do not reconstruct the token or URL in browser code. Implementation must verify single-use and expiration behavior against PostgreSQL, return enumeration-resistant responses, rate-limit requests, validate redirects, and inject a fake/capture mail transport in tests. Set the product's proposed 15-minute expiry explicitly if the plugin option/default does not exactly match it.

## 5. Schema generation and migration workflow

Better Auth owns the required auth table shape, while Drizzle owns reviewed SQL migrations.

Recommended workflow for issue #14:

1. Pin all dependencies and create the actual Better Auth configuration, including Google, magic-link, naming/ID choices, and all enabled plugins.
2. Run the pinned CLI, never `@latest`: `npx auth@1.6.24 generate` (or an exact package script using the locally installed CLI).
3. Generate Drizzle schema into a temporary/review branch location first. Diff it against any hand-authored schema and the foundation invariants.
4. Treat generated auth fields, indexes, and plugin tables as compatibility requirements. Add TikPlay fields through reviewed Drizzle schema composition rather than deleting adapter-required columns.
5. Run pinned `drizzle-kit@0.31.10 generate` to create SQL migrations.
6. Review generated SQL, apply it to an empty PostgreSQL database, then apply it to an upgrade fixture. Verify constraints and rollback/restore procedures.
7. Deploy migrations through a single controlled process using the direct migration URL where required. Never use runtime auto-migration or `drizzle-kit push` in production.
8. Regenerate and diff the auth schema on every Better Auth/plugin upgrade.

Important CLI distinction: Better Auth's `migrate` command applies only to its built-in Kysely adapter. For Drizzle, use Better Auth `generate`, then Drizzle Kit generation/migration commands.

The CLI executable is provided by the npm package named `auth`, which is brought in when `npx auth@1.6.24 ...` is used. During the isolated run, `npx auth --version` resolved npm package `auth@1.6.24` but printed internal CLI version `1.1.2`. This confusing version output is not sufficient proof of the resolved package; implementation scripts must use an exact npm spec and verify resolution with `npm ls`/lockfile review.

The compile spike did not execute schema generation because doing so correctly requires the final schema module and Better Auth configuration, and this issue explicitly forbids production schema implementation. CLI loading of that future TypeScript config remains an integration-test item. If TS7 config loading fails, run the pinned CLI through its bundled loader against a minimal config, or supply a temporary transpiled config; do not downgrade the application's compiler or hand-apply an unreviewed schema as a workaround.

## 6. Compatibility risks and mitigations

### TypeScript 7 preview

- **Verified:** Strict `tsc --noEmit` with TypeScript 7.0.2 compiled the Better Auth server/client APIs, magic-link plugins, Next handler, Drizzle node-postgres adapter, `pg`, and Resend callback.
- **Not verified:** Better Auth config discovery/schema generation under TS7, Drizzle Kit config discovery under TS7, and Next's own integrated typecheck. The repository already bypasses Next build-time typechecking because of its TS7 gap.
- Keep `skipLibCheck` as the repository baseline, but do not treat it as proof that runtime exports work. The spike imported all proposed public entry points.

### ESM/CJS

- Better Auth 1.6.24 is ESM and publishes `.mjs` plus `.d.mts` types.
- Drizzle ORM is ESM with conditional CJS/ESM exports.
- `pg` is CommonJS-compatible; Drizzle's node-postgres entry point compiled under `moduleResolution: bundler` and `esModuleInterop: true`.
- Resend publishes CJS and ESM entries.
- Drizzle Kit is a CJS CLI and uses `tsx`/esbuild internally. The install emitted deprecation warnings for transitive `@esbuild-kit` packages; warnings did not prevent installation or compilation, but should be monitored rather than suppressed.

Do not deep-import unpublished package files. Use only documented exports such as `better-auth/next-js`, `better-auth/plugins`, `better-auth/client/plugins`, `better-auth/react`, `better-auth/adapters/drizzle`, and `drizzle-orm/node-postgres`.

### Edge versus Node

The auth route, session validation, and PostgreSQL access must use Node runtime. Do not import the server auth module into Edge middleware. If route interception is later implemented in Next.js proxy/middleware, perform only optimistic cookie-presence/navigation checks there, or explicitly select Node runtime where Next permits it; authorization remains in route/service code.

### Next.js cookies and Server Actions

`nextCookies()` is required only for Better Auth calls made directly from Server Actions and must be last in the plugin list. Avoid mixing manual cookie mutation with Better Auth response cookie handling. Verify sign-in, sign-out, expiration, revocation, callback, and cross-tab behavior in integration tests.

### Bundling and standalone output

The TypeScript proof does not prove Next webpack standalone tracing. `pg`, Better Auth's ESM exports, and CLI packages were installed only in `/tmp`; no production build was run because adding temporary imports to application source was prohibited. Issue #14 must add a minimal real auth boundary and then run the repository's webpack production build, inspect `.next/standalone`, and boot the standalone server before Gate A is considered complete.

## 7. Isolated proof procedure and results

The proof used `/tmp/craw-music-auth-compat-spike`, outside application source. It created an independent package manifest and lockfile, installed with scripts disabled, compiled representative integration modules, inspected package metadata, and removed the directory. The main workspace manifest, lockfile, and `node_modules` were not used or modified.

Representative commands:

```sh
npm install --ignore-scripts --no-audit --no-fund
npm ls better-auth drizzle-orm drizzle-kit pg resend next react typescript --depth=0
npm run typecheck
npx auth --version
npm pack better-auth@1.6.24 drizzle-orm@0.45.2 drizzle-kit@0.31.10 pg@8.22.0 resend@6.18.0 auth@1.6.24
```

Concise results:

```text
added 89 packages in 23s
better-auth@1.6.24
Drizzle ORM 0.45.2 / Drizzle Kit 0.31.10
pg@8.22.0 / resend@6.18.0
next@16.2.10 / react@19.2.7 / typescript@7.0.2
tsc --noEmit: PASS
npx auth --version: resolved auth@1.6.24; printed 1.1.2
TEMP_REMOVED=yes
PACK_TEMP_REMOVED=yes
```

The proof compiled:

- `betterAuth` with a Drizzle `pg` adapter and transaction option.
- A `pg.Pool` passed to `drizzle()`.
- Google provider configuration.
- Better Auth magic-link plugin calling `resend.emails.send()`.
- `nextCookies()` as the last plugin.
- App Router GET/POST exports from `toNextJsHandler` with Node runtime.
- Server `auth.api.getSession({ headers: await headers() })`.
- React client creation with `magicLinkClient()`.

No database connection, migration, network email, OAuth callback, Next production build, or runtime HTTP request was attempted. Passing compilation therefore demonstrates API/type compatibility, not end-to-end behavior.

## 8. Package evidence snapshot

Registry snapshot: `2026-07-22T11:24:56Z` UTC.

| Package                            | Version | Published UTC            | Relevant metadata                                                                              |
| ---------------------------------- | ------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| Better Auth                        | 1.6.24  | 2026-07-22T10:33:06.503Z | ESM; `.d.mts`; peers with Next 14–16, React 18–19, Drizzle 0.45.2, `pg` 8, Drizzle Kit 0.31.4+ |
| Drizzle ORM                        | 0.45.2  | 2026-03-27T17:06:27.140Z | ESM plus conditional CJS; peers with `pg >=8`                                                  |
| Drizzle Kit                        | 0.31.10 | 2026-03-17T09:31:40.190Z | CJS CLI; bundled config tooling uses `tsx` and esbuild                                         |
| `pg`                               | 8.22.0  | 2026-06-19T00:53:54.954Z | Node `>=16`; CJS-compatible exports                                                            |
| Resend                             | 6.18.0  | 2026-07-21T14:12:59.472Z | CJS and ESM; Node `>=20`                                                                       |
| Better Auth CLI npm package `auth` | 1.6.24  | 2026-07-22T10:33:05.550Z | ESM; exposes `auth` and `better-auth` bins                                                     |

The package tarballs were inspected without extracting into the workspace. File counts were: Better Auth 475, Drizzle ORM 2,666, Drizzle Kit 13, `pg` 20, Resend 7, and `auth` CLI 7.

## 9. Official sources

- Better Auth Next.js integration: <https://www.better-auth.com/docs/integrations/next>
- Better Auth installation and environment variables: <https://www.better-auth.com/docs/installation>
- Better Auth options, including trusted origins: <https://www.better-auth.com/docs/reference/options>
- Better Auth Google provider: <https://www.better-auth.com/docs/authentication/google>
- Better Auth magic-link plugin: <https://www.better-auth.com/docs/plugins/magic-link>
- Better Auth Drizzle adapter: <https://www.better-auth.com/docs/adapters/drizzle>
- Better Auth database/schema CLI concepts: <https://www.better-auth.com/docs/concepts/database>
- Better Auth versioned source/docs used by Context7: <https://github.com/better-auth/better-auth/tree/v1.6.23/docs/content/docs>
- Better Auth npm metadata: <https://www.npmjs.com/package/better-auth/v/1.6.24>
- Better Auth CLI npm metadata: <https://www.npmjs.com/package/auth/v/1.6.24>
- Drizzle node-postgres guide: <https://orm.drizzle.team/docs/get-started-postgresql>
- Drizzle migrations overview: <https://orm.drizzle.team/docs/migrations>
- Drizzle ORM npm metadata: <https://www.npmjs.com/package/drizzle-orm/v/0.45.2>
- Drizzle Kit npm metadata: <https://www.npmjs.com/package/drizzle-kit/v/0.31.10>
- node-postgres pooling: <https://node-postgres.com/features/pooling>
- node-postgres transactions: <https://node-postgres.com/features/transactions>
- `pg` npm metadata: <https://www.npmjs.com/package/pg/v/8.22.0>
- Resend Node.js SDK: <https://resend.com/docs/send-with-nodejs>
- Resend npm metadata: <https://www.npmjs.com/package/resend/v/6.18.0>
- Next.js route handlers: <https://nextjs.org/docs/app/getting-started/route-handlers>
- Next.js runtime configuration: <https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#runtime>

Context7 was queried against `/better-auth/better-auth/v1.6.23`. Exact 1.6.24 package facts came from npm metadata and tarball inspection because 1.6.24 was newer than the available versioned Context7 corpus at spike time.

## 10. Guardrails and follow-up gates for issues #14–#17

### Issue #14: dependency and schema foundation

- Add only exact pins from this report and review the lockfile as one dependency-owned change.
- Run Better Auth schema generation with the exact CLI package, then Drizzle migration generation; never production `push` or runtime migration.
- Keep auth schema/table naming aligned with generated output. Do not force the planning document's illustrative UUID/citext fields over adapter-required types without a tested mapping.
- Test config discovery under TypeScript 7 and capture generated schema in review.
- Apply migrations to empty and upgrade PostgreSQL fixtures using the intended provider/pool topology.
- Run `npm run lint`, `npx tsc --noEmit`, and the real webpack standalone build.

### Issue #15: auth server and providers

- Keep server auth in a server-only module and export a thin Node catch-all handler.
- Configure canonical URL, explicit trusted origins, 32+ byte secret, exact Google callbacks, and separate environment credentials.
- Add magic-link server/client plugins and inject a Resend boundary; never expose Resend or OAuth secrets client-side.
- Keep `nextCookies()` last if Server Actions invoke auth APIs.
- Disable dangerous same-email automatic linking and verify generic magic-link responses, redirect allowlisting, expiry, single use, and replay resistance.

### Issue #16: session and authorization boundaries

- Resolve sessions server-side from request headers and current database state.
- Keep middleware non-authoritative; enforce ownership and roles in every route/service transaction.
- Verify database-backed session persistence, current/other-session revocation, soft-deleted-user denial, cookie clearing, and private no-store caching.
- Preserve guest playback and the root playback provider through sign-in/sign-out/expiry.

### Issue #17: quality and rollout

- Run real Google callback testing in staging and captured/fake Resend magic-link tests.
- Test two-user isolation and admin boundaries, especially the Wave 0 routes.
- Verify standalone webpack tracing and boot from `.next/standalone` in the deployment container.
- Load-test pool sizing and session validation against managed PostgreSQL; test direct migration URL behavior.
- Do not enable production auth until restore, migration, revocation, token redaction, email-domain, and rollback gates pass.

## 11. Go/no-go and unresolved blockers

**Recommendation: Conditional GO** to begin the dependency/schema foundation in issue #14 with the exact pins above. There is no compile-time incompatibility among the selected Better Auth, Next.js, React, Drizzle, `pg`, Resend, and TypeScript 7 versions under the repository's compiler settings.

The recommendation is not a production-release GO. These blockers remain before auth can be enabled:

1. Better Auth CLI and Drizzle Kit config/schema generation must be proven against the final TS7 config.
2. Generated Better Auth plus magic-link schema must be reviewed against the planned custom user/session fields.
3. Transactions, migrations, session persistence/revocation, and magic-link single use/expiry must pass against the selected managed PostgreSQL service and pool mode.
4. A real Next.js webpack standalone build and container boot must verify bundling and output tracing.
5. Google OAuth callback and trusted-origin behavior must pass in staging.
6. Resend sender-domain setup and captured delivery/error behavior must pass.
7. The same-day Better Auth 1.6.24 release needs focused regression tests; pin 1.6.23 temporarily if 1.6.24 fails them.

No production auth, schema, dependency, source, test, deployment, lockfile, or persistence changes were made by this spike.
