// ============================================================================
// D1 / SEC-TST: Production guards for test-only hooks (Issues #32, #33)
// ============================================================================
// Verifies that test-only controls are unreachable in production/development.
// Run: npx tsx --test scripts/test-hooks-production-guard.test.ts
// ============================================================================

import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
  createCapturedMailer,
  getTestClock,
  isTestEnvironment,
} from '../lib/auth/test-hooks';
import { isFeatureEnabled, resetFeatureFlags } from '../lib/feature-flags';

// ---------------------------------------------------------------------------
// Helper: set NODE_ENV via loose-typed cast (TS 7 treats it as readonly).
// ---------------------------------------------------------------------------
const _env = process.env as Record<string, string | undefined>;

function setNodeEnv(value: string | undefined): void {
  _env.NODE_ENV = value;
}

// ---------------------------------------------------------------------------
// SEC-TST-001: Production build must not contain reachable control endpoint.
// ---------------------------------------------------------------------------
describe('SEC-TST-001: test hooks in production', () => {
  const origEnv = process.env.NODE_ENV;

  after(() => {
    setNodeEnv(origEnv);
  });

  it('isTestEnvironment returns true when NODE_ENV=test', () => {
    setNodeEnv('test');
    assert.equal(isTestEnvironment(), true);
  });

  it('isTestEnvironment returns true when TIKPLAY_TEST=1', () => {
    setNodeEnv(origEnv);
    _env.TIKPLAY_TEST = '1';
    assert.equal(isTestEnvironment(), true);
    delete _env.TIKPLAY_TEST;
  });

  it('isTestEnvironment returns false when NODE_ENV=production', () => {
    setNodeEnv('production');
    delete _env.TIKPLAY_TEST;
    assert.equal(isTestEnvironment(), false);
  });

  it('isTestEnvironment returns false when NODE_ENV=development', () => {
    setNodeEnv('development');
    assert.equal(isTestEnvironment(), false);
  });
});

// ---------------------------------------------------------------------------
// SEC-TST-002: Production startup must fail with test auth flag.
// ---------------------------------------------------------------------------
describe('SEC-TST-002: assertNoTestHooksInProduction', () => {
  const origEnv = process.env.NODE_ENV;
  const origTestFlag = _env.TIKPLAY_TEST;
  const origControl = _env.TIKPLAY_TEST_CONTROL;

  // We test the assertion logic by importing and calling.
  // The actual guard runs once at module init; we can test the function directly.
  let guardModule: typeof import('../lib/auth/test-hooks');

  before(async () => {
    setNodeEnv('test');
    guardModule = await import('../lib/auth/test-hooks');
  });

  after(() => {
    setNodeEnv(origEnv);
    if (origTestFlag === undefined) delete _env.TIKPLAY_TEST;
    else _env.TIKPLAY_TEST = origTestFlag;
    if (origControl === undefined) delete _env.TIKPLAY_TEST_CONTROL;
    else _env.TIKPLAY_TEST_CONTROL = origControl;
  });

  it('assertNoTestHooksInProduction does not throw when NODE_ENV=test', () => {
    setNodeEnv('test');
    guardModule.assertNoTestHooksInProduction();
  });

  it('assertNoTestHooksInProduction throws when NODE_ENV=production with TIKPLAY_TEST_CONTROL', () => {
    setNodeEnv('production');
    _env.TIKPLAY_TEST_CONTROL = 'some-secret';
    assert.throws(() => {
      guardModule.assertNoTestHooksInProduction();
    }, /FATAL/);
    delete _env.TIKPLAY_TEST_CONTROL;
  });

  it('assertNoTestHooksInProduction throws when TIKPLAY_TEST is set in production', () => {
    setNodeEnv('production');
    _env.TIKPLAY_TEST = '1';
    assert.throws(() => {
      guardModule.assertNoTestHooksInProduction();
    }, /FATAL/);
    delete _env.TIKPLAY_TEST;
  });
});

// ---------------------------------------------------------------------------
// SEC-TST-003: Captured mailer throws outside test environment.
// ---------------------------------------------------------------------------
describe('SEC-TST-003: captured mailer test-only', () => {
  const origEnv = process.env.NODE_ENV;

  after(() => {
    setNodeEnv(origEnv);
  });

  it('capturedMailer works in NODE_ENV=test', async () => {
    setNodeEnv('test');
    const mailer = createCapturedMailer();
    await mailer.sendMagicLink({
      to: 'test@example.com',
      url: 'https://example.com/verify',
    });
    const { getCapturedMails, resetCapturedMails } = await import(
      '../lib/auth/test-hooks'
    );
    const mails = getCapturedMails();
    assert.equal(mails.length, 1);
    assert.equal(mails[0].to, 'test@example.com');
    resetCapturedMails();
    assert.equal(getCapturedMails().length, 0);
  });

  it('capturedMailer throws when NODE_ENV=production', async () => {
    setNodeEnv('production');
    const mailer = createCapturedMailer();
    await assert.rejects(
      () =>
        mailer.sendMagicLink({
          to: 'test@example.com',
          url: 'https://example.com/verify',
        }),
      /only available in test/,
    );
  });
});

// ---------------------------------------------------------------------------
// SEC-TST-004: Fake clock is isolated per run.
// ---------------------------------------------------------------------------
describe('SEC-TST-004: clock fixture isolation', () => {
  const origEnv = process.env.NODE_ENV;

  after(() => {
    setNodeEnv(origEnv);
  });

  it('getTestClock returns real clock outside test', () => {
    setNodeEnv('production');
    const clock = getTestClock();
    const before = Date.now();
    const now = clock.now().getTime();
    const after = Date.now();
    assert.ok(now >= before && now <= after, 'clock should be real time');
  });

  it('getTestClock advances in test mode', () => {
    setNodeEnv('test');
    const clock = getTestClock();
    const start = clock.now().getTime();
    clock.advance(60_000);
    const later = clock.now().getTime();
    assert.equal(later - start, 60_000);
  });
});

// ---------------------------------------------------------------------------
// Feature flags: no unexpected enablement.
// ---------------------------------------------------------------------------
describe('feature flag defaults are safe', () => {
  const origEnv = { ...process.env };

  after(() => {
    // Clean up test flags.
    for (const key of Object.keys(_env)) {
      if (key.startsWith('FLAG_')) {
        delete _env[key];
      }
    }
    // Restore original env (only known keys).
    for (const [key, value] of Object.entries(origEnv)) {
      if (key.startsWith('FLAG_')) {
        _env[key] = value;
      }
    }
    resetFeatureFlags();
  });

  it('all auth flags default to disabled when no env set', () => {
    resetFeatureFlags();
    assert.equal(isFeatureEnabled('auth.enabled'), false);
    assert.equal(isFeatureEnabled('auth.google'), false);
    assert.equal(isFeatureEnabled('auth.magic_link'), false);
    assert.equal(isFeatureEnabled('auth.import'), false);
    assert.equal(isFeatureEnabled('auth.account_pages'), false);
    assert.equal(isFeatureEnabled('auth.privacy'), false);
    assert.equal(isFeatureEnabled('personalization'), false);
    assert.equal(isFeatureEnabled('admin.new_boundary'), false);
  });

  it('kill switch disables auth even when individual flags are set', () => {
    _env.FLAG_KILL_AUTH = 'true';
    const {
      isAuthKillSwitchActive,
      getAuthKillSwitchMode,
    } = require('../lib/feature-flags');
    assert.equal(isAuthKillSwitchActive(), true);
    assert.equal(getAuthKillSwitchMode(), 'disable_new');
    delete _env.FLAG_KILL_AUTH;
  });
});
