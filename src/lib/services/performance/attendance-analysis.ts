import type { AttendancePerformanceAnalysis } from "./types";
import type { AttendanceTermSummary } from "./fetchers";

/// Pure. Mirrors getStudentAttendanceHistory's "present" definition
/// (PRESENT + LATE both count toward the rate; only ABSENT counts
/// against it) so this reads consistently with the rest of the app —
/// just term-scoped, which that existing helper isn't.
export function computeAttendancePerformanceAnalysis(
  current: AttendanceTermSummary | undefined,
  previous: AttendanceTermSummary | undefined,
  attendanceConcernThreshold: number
): AttendancePerformanceAnalysis {
  if (!current || current.total === 0) {
    return {
      availability: "INSUFFICIENT_DATA",
      attendanceRate: null,
      daysPresent: 0,
      daysAbsent: 0,
      daysLate: 0,
      totalRecorded: 0,
      previousAttendanceRate: null,
      changePoints: null,
      isConcern: false,
    };
  }

  const attendanceRate = Math.round(((current.present + current.late) / current.total) * 100);
  const previousAttendanceRate =
    previous && previous.total > 0 ? Math.round(((previous.present + previous.late) / previous.total) * 100) : null;
  const changePoints = previousAttendanceRate === null ? null : attendanceRate - previousAttendanceRate;

  return {
    availability: "AVAILABLE",
    attendanceRate,
    daysPresent: current.present,
    daysAbsent: current.absent,
    daysLate: current.late,
    totalRecorded: current.total,
    previousAttendanceRate,
    changePoints,
    // Never treated as a concern when there's no data (the undefined/0
    // branch above already returned before this line) — a missing record
    // is never read as a poor one (brief: "do not treat missing
    // attendance as poor attendance").
    isConcern: attendanceRate < attendanceConcernThreshold,
  };
}
