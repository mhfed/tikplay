// ============================================================================
// D5: Telemetry, audit, and operational instrumentation (Issue #36)
// ============================================================================
// Low-cardinality structured event logging for auth, session, import, and
// admin operations.  No raw email, token, magic-link URL, or personal data
// may reach the sink.  See docs/auth-quality-security-plan.md §10.
// ============================================================================

import 'server-only';

// ---------------------------------------------------------------------------
// Event taxonomy
// ---------------------------------------------------------------------------
export type TelemetryEventKind =
  // Auth lifecycle
  | 'auth.start'
  | 'auth.success'
  | 'auth.failure'
  | 'auth.cancel'
  | 'auth.conflict'
  // Magic link
  | 'magic.request'
  | 'magic.accepted'
  | 'magic.delivered'
  | 'magic.delayed'
  | 'magic.bounced'
  | 'magic.rejected'
  // Session
  | 'session.validated'
  | 'session.expired'
  | 'session.revoked'
  | 'session.denied'
  // Authorization
  | 'authorization.denied'
  // Guest import
  | 'import.preview'
  | 'import.commit'
  | 'import.status'
  | 'import.hash_mismatch'
  | 'import.retry'
  | 'import.failure'
  // Privacy
  | 'privacy.history_clear'
  | 'privacy.deletion_request'
  | 'privacy.deletion_cancel'
  | 'privacy.purge'
  | 'privacy.export'
  // Admin
  | 'admin.action'
  | 'admin.denial'
  // Database
  | 'db.pool_saturation'
  | 'db.transaction_error'
  | 'db.migration_status'
  // Playback
  | 'playback.continuity_transition'
  // System
  | 'system.startup'
  | 'system.error';

// ---------------------------------------------------------------------------
// Event envelope
// ---------------------------------------------------------------------------
export type TelemetryEvent = {
  /** Event kind — always present, low cardinality. */
  kind: TelemetryEventKind;
  /** ISO-8601 UTC timestamp set at creation. */
  timestamp: string;
  /** Environment label (production, staging, test, development). */
  environment: string;
  /** Outcome or reason category — never raw data. */
  reason?: string;
  /** HTTP status class or operation result summary. */
  statusClass?: string;
  /** Target route group or resource kind (not resource ID). */
  routeGroup?: string;
  /** Count of items affected (for batch operations). */
  count?: number;
  /** Actor role if available (admin, user, system). */
  actorRole?: string;
  /** Request ID for correlated debugging (not stored in metrics). */
  requestId?: string;
  /** Duration in milliseconds. */
  durationMs?: number;
};

// ---------------------------------------------------------------------------
// Sanitization — ensure no raw PII/tokens reach the sink.
// ---------------------------------------------------------------------------
const SENSITIVE_PATTERNS = [
  /[A-Za-z0-9+/=]{40,}/, // potential token/secret
  /\b[\w.+-]+@[\w-]+\.[\w.+-]+\b/, // email address
  /magic[-_]?link[-_]?token[=:][A-Za-z0-9_-]+/i, // magic-link token in URL
  /verify[=:][A-Za-z0-9_-]+/i, // verification token
];

function sanitize(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sink — pluggable for test capture or production exporter.
// ---------------------------------------------------------------------------
export type TelemetrySink = (event: TelemetryEvent) => void | Promise<void>;

let activeSink: TelemetrySink | undefined;

/**
 * Set the telemetry sink (called once at startup).
 * Default: stdout JSON lines when NODE_ENV is not test.
 */
export function setTelemetrySink(sink: TelemetrySink): void {
  activeSink = sink;
}

function defaultSink(event: TelemetryEvent): void {
  // In test, swallow by default; tests can install a capture sink.
  if (process.env.NODE_ENV === 'test' || process.env.TIKPLAY_TEST === '1') {
    return;
  }
  // JSON-line output for log aggregators.
  // biome-ignore lint: console is intentional for structured logging.
  console.log(JSON.stringify(event));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
const environment: string =
  (process.env.NODE_ENV ?? process.env.TIKPLAY_TEST === '1')
    ? 'test'
    : 'development';

/**
 * Record a telemetry event.
 * Safe to call from any context; never throws.
 */
export function emitTelemetry(
  event: Omit<TelemetryEvent, 'timestamp' | 'environment'>,
): void {
  try {
    const envelope: TelemetryEvent = {
      ...event,
      kind: event.kind,
      timestamp: new Date().toISOString(),
      environment,
    };
    (activeSink ?? defaultSink)(envelope);
  } catch {
    // Telemetry must never crash the application.
  }
}

/**
 * Create a convenience recorder for a specific route group.
 */
export function telemetryFor(routeGroup: string) {
  return {
    emit: (
      event: Omit<TelemetryEvent, 'timestamp' | 'environment' | 'routeGroup'>,
    ) => emitTelemetry({ ...event, routeGroup }),
  };
}

// ---------------------------------------------------------------------------
// Authorization denial helper
// ---------------------------------------------------------------------------
export function emitAuthDenial(
  reason: string,
  statusClass: string,
  requestId?: string,
): void {
  emitTelemetry({
    kind: 'authorization.denied',
    reason: sanitize(reason),
    statusClass,
    routeGroup: 'auth',
    requestId,
  });
}

// ---------------------------------------------------------------------------
// Audit helper — wraps admin actions with structured payload
// ---------------------------------------------------------------------------
export function emitAdminAudit(
  action: string,
  outcome: 'success' | 'denied' | 'error',
  target: string,
  actorRole: string,
  count?: number,
  requestId?: string,
): void {
  emitTelemetry({
    kind: outcome === 'denied' ? 'admin.denial' : 'admin.action',
    reason: sanitize(`${action} on ${target}`),
    statusClass:
      outcome === 'success' ? '2xx' : outcome === 'denied' ? '4xx' : '5xx',
    routeGroup: 'admin',
    count,
    actorRole,
    requestId,
  });
}

/**
 * Initialize telemetry — call once at app startup.
 */
export function initTelemetry(): void {
  if (!activeSink) {
    setTelemetrySink(defaultSink);
  }
  emitTelemetry({
    kind: 'system.startup',
    routeGroup: 'system',
  });
}
