# Product Requirements Document: TikPlay Multi-Auth & Personalization

- **Status:** Draft for implementation
- **Owner:** Product & Engineering
- **Created:** 2026-07-22
- **Target:** Multi-user MVP

## 1. Executive Summary

TikPlay currently behaves as a shared, single-user music library backed by a JSON database. This initiative will introduce multi-user authentication, private user libraries, cross-device synchronization, safe guest-data migration, and transparent personalization.

The product must remain guest-friendly. New visitors can listen and build a small local library before signing in. Authentication should be requested only when it provides clear value, such as synchronization, backup, or sharing. Playback must not stop when a session expires or a user signs out.

The MVP will support Google and email magic-link authentication. Apple and passkeys are planned as follow-up capabilities after the account model and linking flows are stable.

## 2. Problem Statement

The current data model stores tracks, playlists, favorites, and listening history globally. It cannot:

- Isolate one user's library from another user's library.
- Synchronize personal data across devices.
- Provide reliable per-user recommendations.
- Safely support private or shared playlists.
- Manage user sessions, linked identities, recovery, or account deletion.
- Scale safely as a multi-user system using concurrent JSON-file writes.

A conventional sign-in wall would solve identity but damage TikPlay's low-friction discovery experience. The product therefore needs an identity model that preserves guest use and progressively introduces authentication at high-value moments.

## 3. Goals

### 3.1 MVP goals

- Allow visitors to use core playback without authentication.
- Support sign-in with Google and email magic links.
- Persist secure sessions across reloads and browser tabs.
- Isolate libraries, favorites, playlists, preferences, and history by user.
- Import guest data into a newly authenticated account without silent loss or duplication.
- Keep playback active during authentication, sign-out, and session-expiry flows where technically possible.
- Provide basic profile, privacy, session, and account-deletion controls.
- Deliver rule-based personalized home sections with clear fallbacks.
- Provide automated coverage for authentication, authorization, data isolation, and guest migration.

### 3.2 Follow-up goals

- Sign in with Apple.
- Passkey enrollment and authentication.
- Safe linking and unlinking of multiple providers.
- Public and unlisted playlist sharing.
- More sophisticated recommendations and experimentation.
- Suspicious-login notifications and richer security audit history.

## 4. Non-Goals

The MVP will not include:

- Password-based registration or password reset.
- Machine-learning recommendation infrastructure.
- Social feeds, comments, followers, or direct messaging.
- Subscription billing or paid account tiers.
- Collaborative real-time playlist editing.
- Automatic identity linking based only on matching email addresses.
- A separate backend service; Next.js App Router remains the UI and API platform.

## 5. Product Principles

1. **Guest first:** listening should not require an account.
2. **Ask at a value moment:** explain why sign-in benefits the user.
3. **No silent data loss:** guest imports and account merges must be explicit and recoverable.
4. **Playback continuity:** identity transitions must not unnecessarily interrupt audio.
5. **Private by default:** personal data and playlists are private unless the user explicitly shares them.
6. **Transparent personalization:** users can understand, disable, and reset personalization.
7. **Server-enforced ownership:** the client never chooses the authoritative user ID for protected writes.
8. **Progressive complexity:** ship Google and magic link before Apple, passkeys, and advanced linking.

## 6. Target Users and Jobs

### 6.1 Casual guest

**Job:** Quickly extract and play audio without creating an account.

Needs:

- Immediate access to playback.
- A clear explanation of what remains local.
- A non-blocking path to save work later.

### 6.2 Returning listener

**Job:** Continue listening across devices and preserve playlists.

Needs:

- Fast sign-in.
- Synced library and playback context.
- Recent playlists and listening history.

### 6.3 Playlist curator

**Job:** Organize a growing library and eventually share selected playlists.

Needs:

- Reliable ownership and ordering.
- Safe import and deduplication.
- Privacy controls.

### 6.4 Privacy-conscious user

**Job:** Use useful personalization while retaining control over personal data.

Needs:

- Clear personalization consent and settings.
- History deletion.
- Session revocation.
- Data export and account deletion.

## 7. User Experience Requirements

### 7.1 Authentication entry points

Authentication may be opened from:

- The desktop sidebar account area.
- The mobile account drawer.
- A synchronization prompt after meaningful guest activity.
- An action that requires identity, such as cross-device sync or private sharing.
- Session-expiry recovery prompts.

The app must not show an automatic blocking sign-in modal on first visit.

### 7.2 Authentication surface

The responsive auth modal or mobile sheet must present:

1. A primary **Continue with Google** action.
2. A secondary **Continue with Apple** action only after Apple support is shipped.
3. A divider labeled **or**.
4. Email input and **Send sign-in link** action.
5. Terms and privacy disclosure.

It must support these states:

- Initial.
- Redirecting to provider.
- Waiting for magic-link delivery.
- Link expired or already used.
- Provider authorization canceled.
- Provider popup or redirect failure.
- Existing identity conflict.
- Successful authentication.
- Offline or transient server error.

Error copy must explain the next available action and must not expose provider tokens or internal errors.

### 7.3 Value-moment prompts

Suggested triggers, configurable after launch:

- User creates a second playlist.
- User accumulates at least five favorites.
- User attempts cross-device synchronization.
- User attempts private or unlisted sharing.
- User has meaningful local data at the end of a session.

Prompt example:

> Sign in to keep 18 songs and 3 playlists available on every device.

Prompts must be dismissible and rate-limited locally.

### 7.4 Guest-data import

After first authentication on a device containing guest data, show an import review:

- Summary of local songs, favorites, playlists, and relevant preferences.
- **Import all** as the primary action.
- **Choose what to import** as a secondary action.
- **Not now** as a reversible dismissal.

Import rules:

- Deduplicate tracks by canonical source URL and/or stable audio key.
- Never silently overwrite a server playlist.
- Rename conflicting guest playlists with a clear suffix or request user resolution.
- Preserve playlist order where possible.
- Make the operation idempotent using an import identifier.
- Keep a local recovery snapshot until the server confirms successful import.
- Show imported, skipped, and renamed counts.

### 7.5 Onboarding

Onboarding occurs after authentication and may be skipped at any point.

Steps:

1. Choose preferred moods or categories.
2. Choose primary use cases: discover music, save social audio, curate playlists, or focused listening.
3. Import guest data if available.

The MVP must not request birth date, gender, contacts, or other data unrelated to the product experience.

### 7.6 Account menu and profile

Desktop account controls appear at the bottom of the sidebar. Mobile account controls appear in the mobile drawer.

Required destinations:

- Profile.
- Listening preferences.
- Devices and sessions.
- Privacy and data.
- Sign out.

Profile and settings must allow:

- Display-name and avatar updates.
- Locale and theme preferences.
- Explicit-content preference when applicable.
- Personalization enable/disable.
- Listening-history deletion.
- Active-session review and revocation.
- Account deletion.

### 7.7 Session expiry and sign-out

If a session expires during playback:

- Audio continues playing.
- Public browsing remains available.
- Protected mutations are queued locally when safe or rejected with a recoverable message.
- The app shows a non-blocking prompt to sign in again.
- Pending operations must not be duplicated after recovery.

Signing out must clear user-specific client state without deleting guest-independent media cache or crashing the global player.

## 8. Personalization Requirements

### 8.1 Personalized home modules

Authenticated users may see:

- Time-aware greeting using display name.
- Continue listening.
- Recently opened playlists.
- Recommended for you.
- Mood/category shortcuts.
- A discovery section containing unfamiliar content.

Guests and users without sufficient history receive editorial, trending, or category-based fallbacks. Empty modules must not leave unexplained blank space.

### 8.2 MVP recommendation model

Use deterministic, rule-based ranking:

- Positive weight for frequently completed categories and authors.
- Positive weight for favorites and playlist membership.
- Negative weight for repeated early skips.
- Recency suppression for recently completed tracks.
- A configurable exploration ratio to prevent a closed recommendation loop.

Recommendation responses should include reason codes, enabling copy such as:

- “Because you listen to Chill.”
- “Similar to songs in Late Night.”
- “Popular with your recent artists.”

### 8.3 Privacy controls

Users must be able to:

- Disable use of listening history for recommendations.
- Clear listening history.
- Inspect a concise reason for a recommendation.
- Delete their account and personal records.

Disabling personalization must not disable core playback or library functionality.

## 9. Technical Architecture

### 9.1 Platform

- Next.js 16 App Router remains both UI and API.
- The global PlaybackProvider remains mounted at the root layout.
- Route components must not instantiate a second audio engine.
- Shared audio, cover, and track metadata may remain globally cached.
- User ownership and activity data must move to a transactional database.

### 9.2 Authentication approach

Preferred implementation candidates:

- Better Auth for modern account linking and future passkey support.
- Auth.js for established Next.js ecosystem support.

The implementation team must produce a short decision record before adding dependencies, comparing:

- Next.js 16 compatibility.
- PostgreSQL adapter maturity.
- Magic-link support.
- Google and Apple provider support.
- Session revocation.
- Account linking safeguards.
- Passkey path.
- Operational complexity.

### 9.3 Persistence

Use PostgreSQL for multi-user records. The existing JSON database may remain temporarily during migration but must not become the source of truth for authenticated user ownership.

Recommended entities:

#### User

- `id`
- `email`
- `emailVerifiedAt`
- `displayName`
- `avatarUrl`
- `locale`
- `role`
- `onboardingCompletedAt`
- `createdAt`
- `updatedAt`
- `deletedAt`

#### Account

- `id`
- `userId`
- `provider`
- `providerAccountId`
- provider token metadata required by the selected library
- `createdAt`
- `updatedAt`

Unique constraint: provider plus provider account ID.

#### Session

- `id` or secure session token identifier
- `userId`
- `expiresAt`
- `createdAt`
- `lastSeenAt`
- optional device label, user agent summary, and approximate region

#### Verification token

Fields required by the selected auth implementation, including expiry and single-use guarantees.

#### User preference

- `userId`
- `theme`
- `locale`
- `personalizationEnabled`
- `explicitContentAllowed`
- selected moods/categories
- onboarding/use-case selections

#### User library track

- `userId`
- `trackId`
- `addedAt`
- optional source/import metadata

Unique constraint: user plus track.

#### Favorite

- `userId`
- `trackId`
- `createdAt`

Unique constraint: user plus track.

#### Playlist

- Existing playlist fields.
- `ownerId`
- `visibility`: private, unlisted, or public.
- optional share identifier.

#### Playlist track

- Existing relationship and ordering fields.
- Authorization derives from playlist ownership.

#### Listening event/history

- `userId`
- `trackId`
- playback timestamp
- listened duration
- completion percentage
- optional skip/completion classification

Retention must be documented and configurable.

#### Guest import

- `id`
- `userId`
- client-generated idempotency key
- status
- summary counts
- created and completed timestamps

### 9.4 Authorization

Protected API routes must resolve the authenticated user from the server-side session. They must not trust a client-supplied user ID.

Ownership checks are required for:

- User library mutations.
- Favorites.
- Playlist creation, updates, deletion, and track ordering.
- Listening history and preference writes.
- Private playlist reads.
- Session revocation and account deletion.

Administrative access uses server-side roles or permissions. Existing administrative authentication must be migrated or explicitly isolated with a documented transition plan.

### 9.5 Account linking

The system must not automatically link identities based solely on matching email strings.

To link a new provider:

- The user must have an active authenticated session.
- The user must complete the new provider's authentication.
- High-risk conflicts require reauthentication with an existing method.
- The final usable authentication method cannot be removed.
- Linking and unlinking events must be audited.

### 9.6 Security requirements

- Session cookies are HttpOnly and Secure in production.
- SameSite policy must support OAuth while minimizing CSRF exposure.
- State, nonce, PKCE, and token verification follow provider/library guidance.
- Magic links are single-use, expire quickly, and do not reveal whether an address has an account.
- Authentication and verification endpoints are rate-limited.
- Redirect destinations are allowlisted.
- OAuth access and refresh tokens are never exposed to browser storage.
- Sensitive tokens are encrypted at rest if persisted.
- All protected mutations enforce CSRF defenses appropriate to the session strategy.
- Logs redact tokens, magic-link values, and personal data not needed for operations.
- Account deletion revokes sessions immediately and defines cleanup of personal records.

## 10. API Capability Requirements

Exact routes depend on the selected auth library, but the product requires capabilities for:

- Start and complete provider authentication.
- Request and consume a magic link.
- Fetch current session and profile.
- Update profile and preferences.
- List and revoke sessions.
- Import guest library idempotently.
- Fetch and mutate the authenticated library.
- Fetch and mutate favorites.
- Fetch and mutate owned playlists.
- Record listening events for the authenticated user.
- Clear history.
- Export data.
- Delete account.

All responses must use consistent error codes for unauthenticated, forbidden, conflict, validation, rate limit, and transient failures.

## 11. Migration Strategy

The existing shared JSON data may represent a single installation or shared demo library. Before migration, deployment owners must choose one policy:

1. Treat existing tracks as a global media catalog and leave personal collections empty.
2. Assign existing personal collections to a designated owner account.
3. Preserve selected playlists as editorial/public playlists.

Migration must:

- Back up the JSON file before mutation.
- Be repeatable or record completion atomically.
- Preserve shared media cache keys.
- Validate counts and relationships.
- Avoid assigning global favorites/history to every new user.
- Provide rollback instructions.

## 12. Analytics and Observability

Track privacy-conscious product events:

- Auth surface opened and source.
- Provider selected.
- Authentication success/failure category.
- Magic link requested and completed.
- Guest import offered, started, completed, dismissed, and failed.
- Onboarding completed or skipped.
- Personalization enabled or disabled.
- Session revoked.
- Account deletion initiated and completed.

Do not log raw emails, provider tokens, magic-link tokens, source URLs containing secrets, or detailed listening history in general application logs.

Operational metrics:

- Auth success rate by provider.
- Magic-link delivery and completion latency.
- Session validation latency/error rate.
- Guest import duration and failure rate.
- Authorization-denial rate.
- Recommendation response latency.

## 13. Accessibility and Internationalization

- All auth flows must be keyboard accessible.
- Focus is trapped and restored correctly in modals/sheets.
- Provider buttons have accessible names independent of logos.
- Errors are announced via an appropriate live region.
- Color is not the sole error or success indicator.
- Touch targets meet mobile accessibility guidance.
- User-facing strings are structured for localization.
- Time-aware greetings use the user's locale and timezone when available.

## 14. Testing Requirements

### 14.1 Unit and integration coverage

- Session resolution and protected-route helpers.
- Ownership and role authorization.
- Guest-import deduplication and idempotency.
- Playlist-name conflict handling.
- Recommendation ranking and reason codes.
- Personalization opt-out behavior.
- Account-linking conflict rules.

### 14.2 End-to-end coverage

- Guest can play without signing in.
- Google auth succeeds using a deterministic test strategy or provider boundary mock.
- Magic-link login succeeds and an expired link fails safely.
- Session persists across reload and tabs.
- Two users cannot read or mutate one another's private data.
- Guest data imports once without duplicates.
- Dismissed import can be resumed.
- Sign-out clears user data while playback remains stable.
- Expired session produces a recoverable prompt without crashing playback.
- Session revocation affects the targeted session.
- Personalization can be disabled and history can be cleared.
- Account deletion revokes access.

### 14.3 Required verification commands

- `npm run format`
- `npm run lint`
- `npx tsc --noEmit`
- Focused Playwright suites for affected behavior.
- `npm run build` before Playwright when no compatible running server exists.

## 15. Acceptance Criteria

The MVP is ready when:

1. Guests can browse and play without a forced login.
2. Google and magic-link authentication work in supported environments.
3. Authenticated sessions persist securely across reloads.
4. Guest library import is explicit, idempotent, and reports conflicts.
5. Favorites, libraries, playlists, preferences, and history are isolated per user.
6. A user cannot access another user's private resources by changing route or payload IDs.
7. Session expiry and sign-out do not cause player crashes or unnecessary playback interruption.
8. Users can review/revoke sessions, clear history, disable personalization, and delete accounts.
9. Personalized modules have deterministic fallback content and explainable reason codes.
10. Required lint, typecheck, focused tests, and build verification pass.
11. Deployment and rollback documentation covers database migration and auth secrets.

## 16. Rollout Plan

### Phase 0: Decision and foundations

- Select auth library and PostgreSQL access layer.
- Define environment variables and secret management.
- Finalize schema and migration policy.
- Add server-side session/authorization helpers.

### Phase 1: Identity and data isolation

- Implement Google and magic-link flows.
- Implement user, account, session, and verification records.
- Add user ownership to library, favorites, playlists, preferences, and history.
- Protect APIs and test cross-user isolation.

### Phase 2: Guest migration and account UX

- Add responsive auth surface.
- Add value-moment prompts.
- Add guest import review and idempotent import API.
- Add profile, privacy, and session management.
- Preserve playback behavior through identity transitions.

### Phase 3: Personalization

- Add skippable preference onboarding.
- Add continue listening and recent playlists.
- Add rule-based recommendations and reason codes.
- Add personalization opt-out and history reset.

### Phase 4: Extended identity

- Add Apple.
- Add passkeys.
- Add safe provider linking/unlinking.
- Add suspicious-login communication and richer audit controls.

## 17. Workstream Boundaries

To reduce merge conflicts, implementation should be divided as follows.

### Workstream A: Architecture and auth foundation

Owns:

- Auth technology decision record.
- Database schema and migrations.
- Auth configuration and server session helpers.
- Authorization primitives.
- Environment documentation.

Must avoid editing presentation components unless required for provider callbacks.

### Workstream B: Data ownership and migration

Owns:

- Repository/query changes for user-scoped records.
- Migration from global JSON concepts to PostgreSQL ownership.
- Guest import service and idempotency.
- API route authorization adoption.

Coordinates route-by-route ownership with Workstream A.

### Workstream C: Authentication and account UX

Owns:

- Auth modal/mobile sheet.
- Account menu and profile surfaces.
- Session-expiry and sign-out UI.
- Guest import review UI.
- Onboarding and personalization controls.

Must preserve the global playback architecture.

### Workstream D: Quality, security, and rollout

Owns:

- Threat model and security checklist.
- Test strategy, fixtures, and Playwright coverage.
- Migration validation and rollback runbook.
- Monitoring and release checklist.

## 18. Risks and Mitigations

| Risk                                             | Impact                  | Mitigation                                                                          |
| ------------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------- |
| Multi-user data remains partially global         | Privacy breach          | Require server ownership checks and cross-user E2E tests before rollout             |
| JSON-to-PostgreSQL migration loses data          | User data loss          | Backup, dry run, count validation, idempotent migrations, rollback runbook          |
| Provider email collision causes account takeover | Critical security issue | No automatic email-only linking; require authenticated linking and reauthentication |
| Session transition disrupts playback             | Poor music experience   | Keep playback provider independent from user data; add expiry/sign-out tests        |
| Guest import duplicates libraries                | User distrust           | Canonical deduplication, idempotency key, import preview and result report          |
| Magic-link delivery is delayed                   | Login abandonment       | Clear waiting state, resend cooldown, alternative Google action                     |
| Recommendation feels invasive                    | Trust loss              | Explicit controls, reason codes, opt-out, history deletion                          |
| Multiple agents modify shared files              | Merge conflicts         | Enforce workstream ownership and integrate foundation before route/UI adoption      |

## 19. Open Decisions

These decisions must be resolved before implementation of the foundation:

- Better Auth versus Auth.js.
- PostgreSQL hosting and migration tooling.
- Email delivery provider for magic links.
- Existing JSON data ownership policy.
- Whether account deletion hard-deletes or first applies a retention window.
- Listening-history retention period.
- Whether playlist sharing is excluded entirely from MVP or ships as unlisted only.
- Analytics provider and consent model.

## 20. Definition of Done

A work item is complete only when:

- Product acceptance criteria are met.
- Ownership and authorization are enforced server-side.
- Relevant loading, empty, offline, and error states are implemented.
- Accessibility requirements are satisfied.
- Tests cover happy paths and high-risk failure paths.
- Biome formatting/lint and TypeScript checks pass.
- Operational documentation and environment requirements are updated.
- No auth token, secret, or personal data is exposed in client storage or logs.
