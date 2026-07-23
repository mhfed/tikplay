import 'server-only';

import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import { magicLink } from 'better-auth/plugins/magic-link';
import { eq } from 'drizzle-orm';
import { getPostgresDb } from '@/lib/db/postgres/client';
import * as schema from '@/lib/db/postgres/schema';
import { MAGIC_LINK_EXPIRES_IN_SECONDS, readAuthRuntimeConfig } from './config';
import { type AuthMailer, createAuthMailer } from './mailer';

export type AuthRuntimeOverrides = {
  mailer?: AuthMailer;
};

function defineAuth(overrides: AuthRuntimeOverrides = {}) {
  const config = readAuthRuntimeConfig();
  const mailer = overrides.mailer ?? createAuthMailer(config.resend);

  return betterAuth({
    appName: 'TikPlay',
    baseURL: config.baseUrl,
    basePath: '/api/auth',
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(getPostgresDb(), {
      provider: 'pg',
      schema,
      usePlural: true,
      transaction: true,
    }),
    emailAndPassword: { enabled: false },
    socialProviders: config.google
      ? {
          google: {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret,
          },
        }
      : {},
    user: {
      modelName: 'users',
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'user' },
        deletionRequestedAt: { type: 'date', required: false, input: false },
        purgeAfter: { type: 'date', required: false, input: false },
        deletedAt: { type: 'date', required: false, input: false },
      },
    },
    account: {
      modelName: 'accounts',
      accountLinking: {
        enabled: true,
        disableImplicitLinking: true,
        allowDifferentEmails: false,
      },
      encryptOAuthTokens: true,
    },
    session: {
      modelName: 'sessions',
      cookieCache: { enabled: false },
      additionalFields: {
        lastSeenAt: { type: 'date', required: false, input: false },
        deviceLabel: { type: 'string', required: false },
        revokedAt: { type: 'date', required: false, input: false },
        revokedReason: { type: 'string', required: false, input: false },
      },
    },
    verification: {
      modelName: 'verifications',
      additionalFields: {
        consumedAt: { type: 'date', required: false, input: false },
      },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === 'production',
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              name: user.name.trim() || 'TikPlay listener',
            },
          }),
        },
      },
      session: {
        create: {
          before: async (session) => {
            const user = await getPostgresDb().query.users.findFirst({
              where: eq(schema.users.id, session.userId),
              columns: {
                deletedAt: true,
                deletionRequestedAt: true,
                purgeAfter: true,
              },
            });
            return (
              user &&
              !user.deletedAt &&
              !user.deletionRequestedAt &&
              !user.purgeAfter
            );
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
        storeToken: 'hashed',
        sendMagicLink: async ({ email, url }) => {
          await mailer.sendMagicLink({ to: email, url });
        },
      }),
    ],
  });
}

export type TikPlayAuth = ReturnType<typeof defineAuth>;

let authRuntime: TikPlayAuth | undefined;

export function getAuth(overrides?: AuthRuntimeOverrides): TikPlayAuth {
  if (overrides) return defineAuth(overrides);
  authRuntime ??= defineAuth();
  return authRuntime;
}

export async function handleAuthRequest(request: Request): Promise<Response> {
  return getAuth().handler(request);
}
