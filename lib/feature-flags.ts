// ============================================================================
// D6: Rollout flags, kill switch, and rollback-safe feature gates (Issue #37)
// ============================================================================
// Every flag is environment-configured so that a zero-config production
// deploy runs with guest-first semantics and all auth disabled.
// See docs/auth-quality-security-plan.md §11 for staged rollout stages 0-6.
// ============================================================================

// ---------------------------------------------------------------------------
// Flag schema
// ---------------------------------------------------------------------------
export type FeatureFlag = {
  /** Display / documentation name. */
  name: string;
  /** If true, the feature is enabled for all users.
   *  If false, the feature is disabled entirely.
   *  When a rollout percentage is active, this acts as the master kill switch. */
  enabled: boolean;
  /** Optional rollout fraction (0.0 – 1.0).  Only meaningful when enabled=true. */
  rollout?: number;
  /** Optional list of user IDs that always get the feature (allowlist). */
  allowedUserIds?: Set<string>;
  /** Optional list of user IDs that never get the feature (blocklist). */
  blockedUserIds?: Set<string>;
  /** Optional expiry date after which the flag is treated as false. */
  expiresAt?: Date;
};

// ---------------------------------------------------------------------------
// Known flags
// ---------------------------------------------------------------------------
export type FlagName =
  | 'auth.enabled' // Master switch: any auth entry points rendered
  | 'auth.google' // Google OAuth enabled
  | 'auth.magic_link' // Magic-link enabled
  | 'auth.import' // Guest import enabled
  | 'auth.account_pages' // Account / preferences / sessions UI
  | 'auth.privacy' // Privacy controls (export, deletion, history)
  | 'personalization' // Personalized home/ranking
  | 'admin.new_boundary'; // Use Better Auth session for admin (vs legacy token)

// ---------------------------------------------------------------------------
// Flag registry
// ---------------------------------------------------------------------------
const FLAG_DEFAULTS: Record<FlagName, FeatureFlag> = {
  'auth.enabled': {
    name: 'Authentication entry points',
    enabled: process.env.FLAG_AUTH_ENABLED === 'true',
  },
  'auth.google': {
    name: 'Google OAuth provider',
    enabled: process.env.FLAG_AUTH_GOOGLE === 'true',
  },
  'auth.magic_link': {
    name: 'Magic-link email provider',
    enabled: process.env.FLAG_AUTH_MAGIC_LINK === 'true',
  },
  'auth.import': {
    name: 'Guest import with account',
    enabled: process.env.FLAG_AUTH_IMPORT === 'true',
  },
  'auth.account_pages': {
    name: 'Account settings pages',
    enabled: process.env.FLAG_AUTH_ACCOUNT_PAGES === 'true',
  },
  'auth.privacy': {
    name: 'Privacy controls (export/deletion/history)',
    enabled: process.env.FLAG_AUTH_PRIVACY === 'true',
  },
  personalization: {
    name: 'Personalized home and ranking',
    enabled: process.env.FLAG_PERSONALIZATION === 'true',
  },
  'admin.new_boundary': {
    name: 'Better Auth session-based admin boundary',
    enabled: process.env.FLAG_ADMIN_NEW_BOUNDARY === 'true',
  },
};

// Cache parsed flags for the lifetime of the module.
let flagCache: Record<FlagName, FeatureFlag> | null = null;

function getFlags(): Record<FlagName, FeatureFlag> {
  if (flagCache) return flagCache;
  flagCache = {} as Record<FlagName, FeatureFlag>;
  for (const [key, defaultValue] of Object.entries(FLAG_DEFAULTS)) {
    flagCache[key as FlagName] = { ...defaultValue };
  }
  return flagCache;
}

/**
 * Force re-read flags from environment (for testing).
 */
export function resetFeatureFlags(): void {
  flagCache = null;
}

// ---------------------------------------------------------------------------
// Evaluation helpers
// ---------------------------------------------------------------------------

/**
 * Check if a feature flag is enabled.
 * Respects: master kill switch → expiry → rollout percentage → allowlist/blocklist.
 */
export function isFeatureEnabled(flag: FlagName, userId?: string): boolean {
  const config = getFlags()[flag];
  if (!config.enabled) return false;

  // Check expiry.
  if (config.expiresAt && config.expiresAt < new Date()) {
    return false;
  }

  // Check blocklist.
  if (userId && config.blockedUserIds?.has(userId)) {
    return false;
  }

  // Check allowlist.
  if (userId && config.allowedUserIds?.has(userId)) {
    return true;
  }

  // Check rollout percentage.
  if (config.rollout !== undefined && userId) {
    // Deterministic hash of flag + userId for consistent assignment.
    const hash = simpleHash(`${flag}:${userId}`);
    if (hash / 0xffffffff > config.rollout) {
      return false;
    }
  }

  return true;
}

/**
 * Simple non-crypto hash for consistent rollout assignment.
 * Not suitable for security decisions — use only for rollout bucketing.
 */
function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Kill-switch helpers
// ---------------------------------------------------------------------------

/**
 * Emergency kill switch — disables all auth features.
 * Set FLAG_KILL_AUTH=true in environment to trigger.
 */
export function isAuthKillSwitchActive(): boolean {
  return process.env.FLAG_KILL_AUTH === 'true';
}

/**
 * Verify that kill-switch invariants hold:
 * - When kill switch is active, auth entry points return disabled state.
 * - In-flight callbacks and session reads remain safe.
 * - Protected mutations return recoverable 503 when kill switch + personal writes flag.
 */
export function getAuthKillSwitchMode():
  | 'normal'
  | 'disable_new'
  | 'recoverable_503' {
  if (!isAuthKillSwitchActive()) return 'normal';
  // When personal writes have started, return 503 for protected mutations.
  if (process.env.FLAG_PERSONAL_WRITES_ACTIVE === 'true') {
    return 'recoverable_503';
  }
  return 'disable_new';
}

// ---------------------------------------------------------------------------
// Rollback safety
// ---------------------------------------------------------------------------

/**
 * Returns true when the app should serve guest/public paths only.
 * Protected mutations return 503 in this mode.
 * PostgreSQL remains the source of truth; no writes go back to JSON.
 */
export function isDegradedMode(): boolean {
  return (
    isAuthKillSwitchActive() &&
    process.env.FLAG_PERSONAL_WRITES_ACTIVE === 'true'
  );
}

// ---------------------------------------------------------------------------
// Init check — call at startup to log flag state
// ---------------------------------------------------------------------------
export function logFeatureFlags(): void {
  const flags = getFlags();
  for (const [key, config] of Object.entries(flags)) {
    if (config.enabled) {
      // biome-ignore lint: intentional startup diagnostics.
      console.log(
        `[flags] ${key}=enabled${config.rollout ? ` (rollout=${config.rollout})` : ''}`,
      );
    }
  }
}
