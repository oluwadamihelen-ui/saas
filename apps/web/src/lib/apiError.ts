import { NextResponse } from "next/server";
import * as Sentry from "@sentry/node";
import { ProviderNotConfiguredError } from "@cinerra/ai";
import { PublishNotEligibleError } from "@cinerra/domain";
import { FairUseLimitError } from "./fairUse";
import { PaystackNotConfiguredError, PlanNotAvailableError, InvalidWebhookSignatureError, NoActiveSubscriptionError } from "./subscriptions";
import { PayoutsNotConfiguredError, NoPayoutAccountError, BelowPayoutMinimumError, PayoutClaimConflictError, AccountResolutionFailedError } from "./payouts";
import { UserNotFoundError, InvalidGrantAmountError } from "./promotionalCoins";
import { UserNotFoundError as UserNotFoundForModerationError, CannotSuspendSelfError } from "./trustSafety";

/**
 * Central error-to-response mapping. Every error surfaced to the browser
 * is a short, human-readable sentence (spec §56) — never a raw stack
 * trace or a bare "Internal Server Error".
 */
export function toApiErrorResponse(error: unknown): NextResponse {
  if (error instanceof FairUseLimitError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  if (error instanceof ProviderNotConfiguredError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof PublishNotEligibleError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof PaystackNotConfiguredError || error instanceof PlanNotAvailableError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof InvalidWebhookSignatureError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof NoActiveSubscriptionError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof PayoutsNotConfiguredError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof NoPayoutAccountError || error instanceof BelowPayoutMinimumError || error instanceof AccountResolutionFailedError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof PayoutClaimConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof UserNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof InvalidGrantAmountError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof UserNotFoundForModerationError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof CannotSuspendSelfError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "SUSPENDED") {
    return NextResponse.json({ error: "Your account has been suspended. Contact support if you believe this is a mistake." }, { status: 403 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "You do not have access to this resource." }, { status: 403 });
  }
  if (error instanceof Error && error.message === "NOT_FOUND") {
    return NextResponse.json({ error: "We couldn't find that." }, { status: 404 });
  }
  // eslint-disable-next-line no-console
  console.error(error);
  // Safe to call unconditionally — captureException is a no-op if Sentry
  // was never initialized (SENTRY_DSN unset), same honest-degrade pattern
  // as every other optional provider in this codebase.
  Sentry.captureException(error);
  return NextResponse.json({ error: "Something went wrong on our end. Your project is safe — please try again." }, { status: 500 });
}
