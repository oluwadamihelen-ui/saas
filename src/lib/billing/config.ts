/// Centralized, documented billing constants (spec sections 15, 27, 28) —
/// change here, not scattered through components.

/// Days a PAST_DUE subscription keeps access before it's treated as
/// expired. Configurable via env so a deployment can tune it without a
/// code change.
export const GRACE_PERIOD_DAYS = Number(process.env.BILLING_GRACE_PERIOD_DAYS ?? 7);

/// How long a cancelled/expired school's data is guaranteed to be kept
/// before any future permanent-deletion workflow could apply. Nothing in
/// this codebase currently deletes on this timer — see ARCHITECTURE.md's
/// "Data retention" note; this constant exists so that workflow, when
/// built, has one place to read the policy from rather than a new guess.
export const DATA_RETENTION_DAYS = Number(process.env.BILLING_DATA_RETENTION_DAYS ?? 90);

/// Student-usage warning thresholds (spec section 15), as fractions of
/// the plan's studentLimit.
export const USAGE_WARNING_THRESHOLD = 0.7;
export const USAGE_STRONG_WARNING_THRESHOLD = 0.85;
export const USAGE_URGENT_THRESHOLD = 0.95;
