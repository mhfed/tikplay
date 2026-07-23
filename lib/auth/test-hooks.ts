// ============================================================================
// D1: Deterministic auth, mail, clock, and database test fixtures (Issue #32)
// ============================================================================
// These controls exist ONLY for test environments.  Every publicly reachable
// path is guarded by a random per-run control secret so that production
// builds, staging, and any non-test process cannot activate them.
// See docs/auth-quality-security-plan.md §6 for the threat model (TM-19).
// ============================================================================

import { randomBytes } from 'node:crypto';
import type { AuthMailer } from './mailer';

// ---------------------------------------------------------------------------
// Test-only marker — never export or expose this value outside this module.
// Production startup must refuse to boot if any test flag is set.
// ---------------------------------------------------------------------------
const TEST_CONTROL_ENV = 'TIKPLAY_TEST_CONTROL';

/**
 * 64-char hex secret generated at import time.
 * A caller must present this value to use any test-only control.
 * Per-run random → TM-19 / SEC-TST-004: run A cannot affect run B.
 */
const PER_RUN_SECRET: string = (() => {
  const fromEnv = process.env[TEST_CONTROL_ENV];
  if (fromEnv) {
    if (fromEnv.length < 16) {
      throw new Error(
        `${TEST_CONTROL_ENV} must be at least 16 characters (found ${fromEnv.length}).`,
      );
    }
    return fromEnv;
  }
  return randomBytes(32).toString('hex');
})();

/** Whether we are in a test environment — derived from NODE_ENV or explicit. */
export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.TIKPLAY_TEST === '1';
}

// ---------------------------------------------------------------------------
// Production guard
// ---------------------------------------------------------------------------
/**
 * Call this at module init or app startup.
 * Throws if test-only controls would be reachable in a non-test build.
 *
 * Coverage: SEC-TST-001 (production build no reachable test endpoint),
 *           SEC-TST-002 (production startup fails with test flag).
 */
export function assertNoTestHooksInProduction(): void {
  const env = process.env.NODE_ENV;
  const hasControl = !!process.env[TEST_CONTROL_ENV];
  const isTest =
    env === 'test' ||
    process.env.TIKPLAY_TEST === '1' ||
    process.env.TIKPLAY_TEST_CONTROL !== undefined;

  // If this is a production or development build with test flags, refuse.
  if ((env === 'production' || env === 'development') && isTest) {
    if (hasControl) {
      throw new Error(
        `FATAL: ${TEST_CONTROL_ENV} is set in NODE_ENV=${env}. ` +
          'Test hooks must never be configured outside test runs.',
      );
    }
    // TIKPLAY_TEST itself does not start with TIKPLAY_TEST_ prefix,
    // so the loop below would miss it — check it explicitly.
    if (process.env.TIKPLAY_TEST === '1') {
      throw new Error(
        `FATAL: TIKPLAY_TEST is set to '1' in NODE_ENV=${env}. ` +
          'Set it only for test runs.',
      );
    }
    // Also check for any known test-only env vars leaking through.
    for (const key of Object.keys(process.env)) {
      if (
        key.startsWith('TIKPLAY_TEST_') &&
        process.env[key] &&
        !key.endsWith('_ALLOW')
      ) {
        throw new Error(
          `FATAL: Test-only env var ${key} is set in NODE_ENV=${env}. ` +
            'Remove the variable or set it only for test runs.',
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Clock fixture
// ---------------------------------------------------------------------------
export type ClockFixture = {
  now(): Date;
  advance(ms: number): Date;
};

const FAKE_NOW_ENV = 'TIKPLAY_TEST_FAKE_NOW';

let fakeNowOverride: number | undefined;

/**
 * Get a controlled clock for test scenarios.
 * In non-test environments, returns the real system clock.
 * To advance the clock during a test, use advanceFakeClock().
 */
export function getTestClock(): ClockFixture {
  if (!isTestEnvironment()) {
    return {
      now: () => new Date(),
      advance: () => new Date(),
    };
  }

  // Initialize from env if present.
  if (fakeNowOverride === undefined) {
    const envNow = process.env[FAKE_NOW_ENV];
    fakeNowOverride = envNow ? Number(envNow) : Date.now();
  }

  return {
    now: () => new Date(fakeNowOverride!),
    advance: (ms: number) => {
      fakeNowOverride! += ms;
      return new Date(fakeNowOverride!);
    },
  };
}

/**
 * Reset the fake clock (call in afterEach / cleanup).
 * Guarded: no-op outside test environment.
 */
export function resetTestClock(): void {
  if (isTestEnvironment()) {
    fakeNowOverride = undefined;
  }
}

// ---------------------------------------------------------------------------
// Captured mail transport
// ---------------------------------------------------------------------------
export type CapturedMail = {
  to: string;
  url: string;
  sentAt: Date;
};

let capturedMails: CapturedMail[] = [];

/**
 * Create a test-only mailer that captures instead of sending.
 * Messages can be inspected in test assertions.
 */
export function createCapturedMailer(): AuthMailer {
  return {
    sendMagicLink: async ({ to, url }: { to: string; url: string }) => {
      if (!isTestEnvironment()) {
        throw new Error(
          'capturedMailer is only available in test environments.',
        );
      }
      capturedMails.push({ to, url, sentAt: new Date() });
    },
  };
}

export function getCapturedMails(): CapturedMail[] {
  return capturedMails;
}

export function resetCapturedMails(): void {
  capturedMails = [];
}

// ---------------------------------------------------------------------------
// Audit capture fixture
// ---------------------------------------------------------------------------
export type AuditEvent = {
  timestamp: Date;
  kind: string;
  actorId?: string;
  sessionId?: string;
  target?: string;
  outcome: 'success' | 'denied' | 'error';
  reason?: string;
};

let auditLog: AuditEvent[] = [];

/**
 * Record an audit event in test mode.
 * In production this is a no-op; real audit goes through the telemetry module.
 */
export function recordAuditEvent(event: Omit<AuditEvent, 'timestamp'>): void {
  if (isTestEnvironment()) {
    auditLog.push({ ...event, timestamp: new Date() });
  }
}

export function getAuditEvents(): AuditEvent[] {
  return auditLog;
}

export function resetAuditEvents(): void {
  auditLog = [];
}

// ---------------------------------------------------------------------------
// Environment verification helpers
// ---------------------------------------------------------------------------
/**
 * Verify that production environment doesn't have test flags.
 * Call early in startup.
 */
export function verifyProductionEnvironment(): void {
  if (process.env.NODE_ENV === 'production') {
    assertNoTestHooksInProduction();
  }
}

/**
 * Get the per-run control secret.
 * In test mode, this can be used to authenticate test-hook requests.
 */
export function getControlSecret(): string {
  return PER_RUN_SECRET;
}
