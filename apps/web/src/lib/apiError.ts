import { NextResponse } from "next/server";
import { ProviderNotConfiguredError } from "@cinerra/ai";
import { FairUseLimitError } from "./fairUse";

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
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "You do not have access to this resource." }, { status: 403 });
  }
  if (error instanceof Error && error.message === "NOT_FOUND") {
    return NextResponse.json({ error: "We couldn't find that." }, { status: 404 });
  }
  // eslint-disable-next-line no-console
  console.error(error);
  return NextResponse.json({ error: "Something went wrong on our end. Your project is safe — please try again." }, { status: 500 });
}
