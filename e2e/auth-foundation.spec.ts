import { expect, test } from '@playwright/test';
import {
  AuthConfigurationError,
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  normalizeReturnPath,
  parseTrustedOrigins,
  readAuthRuntimeConfig,
} from '@/lib/auth/config';

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  BETTER_AUTH_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: '0123456789abcdef0123456789abcdef',
  DATABASE_URL: 'postgres://test:test@localhost:5432/tikplay_test',
};

test.describe('authentication foundation contracts', () => {
  test('uses a 15-minute magic-link lifetime', () => {
    expect(MAGIC_LINK_EXPIRES_IN_SECONDS).toBe(900);
  });

  test('accepts paired optional providers without leaking values', () => {
    const config = readAuthRuntimeConfig({
      ...validEnvironment,
      GOOGLE_CLIENT_ID: 'google-client',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      RESEND_API_KEY: 'resend-secret',
      AUTH_EMAIL_FROM: 'TikPlay <auth@example.com>',
      AUTH_TRUSTED_ORIGINS: 'http://127.0.0.1:3000',
    });

    expect(config.baseUrl).toBe('http://localhost:3000');
    expect(config.trustedOrigins).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
    expect(config.google).toEqual({
      clientId: 'google-client',
      clientSecret: 'google-secret',
    });
    expect(config.resend?.from).toBe('TikPlay <auth@example.com>');
  });

  test('rejects partial provider configuration', () => {
    expect(() =>
      readAuthRuntimeConfig({
        ...validEnvironment,
        GOOGLE_CLIENT_ID: 'google-client',
      }),
    ).toThrow(AuthConfigurationError);

    expect(() =>
      readAuthRuntimeConfig({
        ...validEnvironment,
        RESEND_API_KEY: 'resend-secret',
      }),
    ).toThrow(AuthConfigurationError);
  });

  test('requires explicit runtime configuration only when read', () => {
    expect(() => readAuthRuntimeConfig({ NODE_ENV: 'test' })).toThrow(
      'Authentication runtime requires BETTER_AUTH_URL.',
    );
  });

  test('requires HTTPS origins in production and rejects wildcards', () => {
    expect(() =>
      readAuthRuntimeConfig({
        ...validEnvironment,
        NODE_ENV: 'production',
      }),
    ).toThrow('BETTER_AUTH_URL must use HTTPS in production.');

    expect(() =>
      parseTrustedOrigins(
        'https://*.example.com',
        'https://music.example.com',
        'production',
      ),
    ).toThrow('must not contain wildcards');
  });

  test('normalizes local return paths and rejects external redirects', () => {
    expect(normalizeReturnPath('/library?tab=favorites#tracks')).toBe(
      '/library?tab=favorites#tracks',
    );
    expect(normalizeReturnPath('https://evil.example/steal')).toBe('/');
    expect(normalizeReturnPath('//evil.example/steal')).toBe('/');
    expect(normalizeReturnPath(undefined, '/library')).toBe('/library');
  });
});
