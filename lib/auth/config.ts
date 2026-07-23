export const MAGIC_LINK_EXPIRES_IN_SECONDS = 15 * 60;

export type AuthRuntimeConfig = {
  baseUrl: string;
  trustedOrigins: string[];
  secret: string;
  google?: {
    clientId: string;
    clientSecret: string;
  };
  resend?: {
    apiKey: string;
    from: string;
  };
};

export class AuthConfigurationError extends Error {
  readonly code = 'AUTH_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

function required(name: string, env: NodeJS.ProcessEnv): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new AuthConfigurationError(
      `Authentication runtime requires ${name}.`,
    );
  }
  return value;
}

function parseOrigin(
  value: string,
  name: string,
  nodeEnv: string | undefined,
): string {
  if (value.includes('*')) {
    throw new AuthConfigurationError(`${name} must not contain wildcards.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthConfigurationError(
      `${name} must be an absolute HTTP(S) URL.`,
    );
  }

  if (
    (url.protocol !== 'https:' && url.protocol !== 'http:') ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new AuthConfigurationError(
      `${name} must be an HTTP(S) origin without credentials, path, query, or fragment.`,
    );
  }

  if (nodeEnv === 'production' && url.protocol !== 'https:') {
    throw new AuthConfigurationError(`${name} must use HTTPS in production.`);
  }

  return url.origin;
}

export function parseTrustedOrigins(
  value: string | undefined,
  baseUrl: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string[] {
  const origins = new Set([new URL(baseUrl).origin]);
  for (const [index, candidate] of (value ?? '').split(',').entries()) {
    const trimmed = candidate.trim();
    if (trimmed) {
      origins.add(
        parseOrigin(
          trimmed,
          `AUTH_TRUSTED_ORIGINS entry ${index + 1}`,
          nodeEnv,
        ),
      );
    }
  }
  return [...origins];
}

export function readAuthRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuthRuntimeConfig {
  const baseUrl = parseOrigin(
    required('BETTER_AUTH_URL', env),
    'BETTER_AUTH_URL',
    env.NODE_ENV,
  );
  const secret = required('BETTER_AUTH_SECRET', env);
  if (secret.length < 32) {
    throw new AuthConfigurationError(
      'BETTER_AUTH_SECRET must contain at least 32 characters.',
    );
  }

  // Database access is validated lazily by getPostgresDb().
  required('DATABASE_URL', env);

  const googleClientId = env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
    throw new AuthConfigurationError(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.',
    );
  }

  const resendApiKey = env.RESEND_API_KEY?.trim();
  const resendFrom = env.AUTH_EMAIL_FROM?.trim();
  if (Boolean(resendApiKey) !== Boolean(resendFrom)) {
    throw new AuthConfigurationError(
      'RESEND_API_KEY and AUTH_EMAIL_FROM must be configured together.',
    );
  }

  return {
    baseUrl,
    trustedOrigins: parseTrustedOrigins(
      env.AUTH_TRUSTED_ORIGINS,
      baseUrl,
      env.NODE_ENV,
    ),
    secret,
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
    ...(resendApiKey && resendFrom
      ? { resend: { apiKey: resendApiKey, from: resendFrom } }
      : {}),
  };
}

export function normalizeReturnPath(
  value: string | null | undefined,
  fallback = '/',
): string {
  if (!value?.startsWith('/') || value.startsWith('//')) return fallback;

  try {
    const parsed = new URL(value, 'https://return-path.invalid');
    if (parsed.origin !== 'https://return-path.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
