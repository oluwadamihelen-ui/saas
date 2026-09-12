import "server-only";
import { prisma } from "@/lib/db";
import type { PerformancePeriod } from "./types";

/// How far back a "previous comparable period" search is willing to walk
/// before giving up — a generous cap (not "3 terms back", since a school
/// can run any number of terms per session), not a behavior change: it
/// only protects against scanning a school's entire multi-year term
/// history for a student with genuinely no historical data anywhere.
const MAX_LOOKBACK_PERIODS = 12;

/// Every term this school has ever run, ordered chronologically —
/// deliberately NOT grouped or limited by academic session, since a
/// school's terms don't reset numbering at a session boundary (brief:
/// "2025/2026 First Term"'s previous period may be "2024/2025 Third
/// Term" if that's what actually came before it). Mirrors
/// academics.ts's listTerms() ordering (startDate) but ascending, and
/// reshaped into the flat PerformancePeriod the rest of this folder uses.
export async function listOrderedPeriods(schoolId: string): Promise<PerformancePeriod[]> {
  const terms = await prisma.term.findMany({
    where: { schoolId },
    include: { academicSession: true },
    orderBy: { startDate: "asc" },
  });
  return terms.map((t) => ({
    termId: t.id,
    termName: t.name,
    academicSessionId: t.academicSessionId,
    academicSessionName: t.academicSession.name,
    startDate: t.startDate,
  }));
}

/// Walks backward from `fromTermId` (exclusive) through the school's full
/// chronological term list, returning the periods that `hasData` accepts
/// — the "nearest prior period this student/class actually has a
/// recorded value for," not necessarily the literally-adjacent term. A
/// student absent an entire term, or newly transferred in, shouldn't be
/// reported "insufficient data" when perfectly good history exists two
/// terms back; skipping past empty terms while still searching only
/// chronologically-real periods (never inventing one) is the honest
/// middle ground. Returns at most `count` periods, oldest search first
/// but returned nearest-first (index 0 is the closest match to
/// `fromTermId`).
export function findPriorPeriodsWithData(
  orderedPeriods: PerformancePeriod[],
  fromTermId: string,
  hasData: (termId: string) => boolean,
  count: number
): PerformancePeriod[] {
  const fromIndex = orderedPeriods.findIndex((p) => p.termId === fromTermId);
  if (fromIndex <= 0) return [];

  const found: PerformancePeriod[] = [];
  const lookbackFloor = Math.max(0, fromIndex - MAX_LOOKBACK_PERIODS);
  for (let i = fromIndex - 1; i >= lookbackFloor && found.length < count; i--) {
    const candidate = orderedPeriods[i];
    if (hasData(candidate.termId)) found.push(candidate);
  }
  return found;
}

/// A fixed, position-based window — `targetTermId` plus the `lookback`
/// periods immediately before it chronologically, regardless of which of
/// those actually have data. Used for bulk (class/school) attendance/CBT/
/// assignment fetches, where bounding the query to a predictable number
/// of terms matters more than findPriorPeriodsWithData's per-student
/// "walk until you find data" precision — that per-student search is
/// cheap once (single student), but doing it per-student across a large
/// class would mean a different query window per row, defeating the
/// point of a single bulk query (brief Test 12: no N+1 at 100+ students).
export function windowAroundPeriod(orderedPeriods: PerformancePeriod[], targetTermId: string, lookback: number): PerformancePeriod[] {
  const index = orderedPeriods.findIndex((p) => p.termId === targetTermId);
  if (index < 0) return [];
  const start = Math.max(0, index - lookback);
  return orderedPeriods.slice(start, index + 1).reverse(); // nearest-first, matching findPriorPeriodsWithData's convention
}
