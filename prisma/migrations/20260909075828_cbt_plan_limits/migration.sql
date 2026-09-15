-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "cbtActiveExamLimit" INTEGER,
ADD COLUMN     "cbtAiQuestionsPerMonthLimit" INTEGER,
ADD COLUMN     "cbtCandidateLimit" INTEGER,
ADD COLUMN     "cbtQuestionBankLimit" INTEGER;

-- One-time backfill for plan rows that already existed before these columns
-- did, so an already-provisioned environment doesn't read every plan as
-- unlimited the moment this migration lands. Matches src/lib/billing/
-- plan-catalog.ts's PLAN_CATALOG values at the time this migration was
-- written. Both ensureDefaultPlans() and the seed script only ever CREATE
-- a missing plan row and no-op on an existing one (so a Super Admin's live
-- edits in the platform UI are never overwritten by a redeploy) — this
-- backfill is a one-time exception for columns that, by definition, no
-- Super Admin could have edited yet.
UPDATE "SubscriptionPlan" SET "cbtActiveExamLimit" = 2, "cbtQuestionBankLimit" = 100, "cbtAiQuestionsPerMonthLimit" = 0, "cbtCandidateLimit" = 150 WHERE "slug" = 'STARTER';
UPDATE "SubscriptionPlan" SET "cbtActiveExamLimit" = 10, "cbtQuestionBankLimit" = 1000, "cbtAiQuestionsPerMonthLimit" = 100, "cbtCandidateLimit" = 500 WHERE "slug" = 'PROFESSIONAL';
UPDATE "SubscriptionPlan" SET "cbtActiveExamLimit" = 50, "cbtQuestionBankLimit" = 5000, "cbtAiQuestionsPerMonthLimit" = 500, "cbtCandidateLimit" = 1500 WHERE "slug" = 'PREMIUM';

-- The 4 CBT boolean feature keys (cbt, cbt_question_bank, cbt_ai_generation,
-- cbt_advanced_analytics) were added to PLAN_TIER_DEFAULT_FEATURES back in
-- CBT Phase 1, long before this migration — but createPlan()/ensureDefaultPlans()/
-- the seed script only ever set `features` on a plan's first INSERT and never
-- touch it again (so a Super Admin's own toggles in the platform UI survive a
-- redeploy). An environment whose SubscriptionPlan rows already existed
-- before Phase 1 never got these 4 keys added to their stored `features`
-- JSON at all, so CBT Phase 9's new requireFeature("cbt", ...) calls would
-- read every plan as lacking CBT entirely. Merged in with the jsonb `||`
-- operator so any other key a Super Admin has already customized is left
-- untouched — this only ever adds the 4 keys this migration introduces
-- meaningful enforcement for, and only if they're not already present.
UPDATE "SubscriptionPlan" SET features = features || '{"cbt": true}'::jsonb
  WHERE slug IN ('STARTER', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE') AND NOT (features ? 'cbt');
UPDATE "SubscriptionPlan" SET features = features || '{"cbt_question_bank": true, "cbt_ai_generation": true}'::jsonb
  WHERE slug IN ('PROFESSIONAL', 'PREMIUM', 'ENTERPRISE') AND NOT (features ? 'cbt_question_bank');
UPDATE "SubscriptionPlan" SET features = features || '{"cbt_advanced_analytics": true}'::jsonb
  WHERE slug IN ('PREMIUM', 'ENTERPRISE') AND NOT (features ? 'cbt_advanced_analytics');

