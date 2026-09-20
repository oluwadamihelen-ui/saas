import "server-only";
import { parseCsvRecords } from "@/lib/csv";
import { listAssignableRoles, checkStaffDuplicate, createStaffDirect, inviteStaffMember, type DirectCreateStaffInput } from "@/lib/services/staff";
import { logAudit } from "@/lib/audit";

// ---------------------------------------------------------------------
// Bulk staff registration (preview-then-confirm) — one validation
// pipeline shared by both entry methods: CSV upload (parseStaffImportCsv)
// and the bulk page's manual multi-row table, which serializes its rows
// to the exact same { rowNumber, raw } shape client-side before either
// reaches validateStaffImportRows. Raw column keys (lowercase, no
// spaces) match STAFF_IMPORT_TEMPLATE_HEADER in import-templates.ts:
//   name, email, role, phone, staffid, jobtitle, department
// role must match one of the school's own assignable role names exactly
// (case-insensitive) — the same names shown throughout the rest of the
// staff UI, not a separate code a school would have to learn.
// ---------------------------------------------------------------------

export interface StaffImportRawRow {
  rowNumber: number;
  raw: Record<string, string>;
}

export interface StaffImportData extends DirectCreateStaffInput {
  roleName: string;
}

export interface StaffImportRowResult {
  rowNumber: number;
  data: StaffImportData | null;
  raw: Record<string, string>;
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseStaffImportCsv(csvText: string): StaffImportRawRow[] {
  const { records } = parseCsvRecords(csvText);
  return records.map((raw, i) => ({ rowNumber: i + 2, raw }));
}

export async function validateStaffImportRows(schoolId: string, rawRows: StaffImportRawRow[]): Promise<{ rows: StaffImportRowResult[] }> {
  const roles = await listAssignableRoles(schoolId);
  const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r]));

  const seenEmails = new Set<string>();
  const seenStaffIds = new Set<string>();
  const rows: StaffImportRowResult[] = [];

  for (const { rowNumber, raw } of rawRows) {
    const errors: string[] = [];

    const name = raw.name?.trim() || "";
    const email = raw.email?.trim().toLowerCase() || "";
    const roleNameRaw = raw.role?.trim() || "";
    const phone = raw.phone?.trim() || null;
    const staffId = raw.staffid?.trim() || null;
    const jobTitle = raw.jobtitle?.trim() || null;
    const department = raw.department?.trim() || null;

    if (!name) errors.push("Full name is required.");

    const emailValid = Boolean(email) && EMAIL_RE.test(email);
    if (!email) errors.push("Email is required.");
    else if (!emailValid) errors.push("Invalid email address.");
    else if (seenEmails.has(email)) errors.push("Duplicate email within this file.");
    else seenEmails.add(email);

    if (staffId) {
      if (seenStaffIds.has(staffId)) errors.push("Duplicate Staff ID within this file.");
      else seenStaffIds.add(staffId);
    }

    const role = roleNameRaw ? roleByName.get(roleNameRaw.toLowerCase()) : undefined;
    if (!roleNameRaw) errors.push("Role is required.");
    else if (!role) errors.push(`Invalid role "${roleNameRaw}".`);

    // Only hit the database once the row is otherwise well-formed — an
    // email that's already invalid shouldn't also report a duplicate.
    if (emailValid && errors.length === 0) {
      const dup = await checkStaffDuplicate(schoolId, email, staffId);
      if (dup.existingUser) errors.push("Email already has an account.");
      if (dup.pendingInvite) errors.push("Email already has a pending invitation.");
      if (dup.staffIdConflict) errors.push(`Staff ID "${staffId}" is already in use.`);
    }

    const data: StaffImportData | null =
      errors.length === 0
        ? {
            name,
            email,
            roleId: role!.id,
            roleName: role!.name,
            phone,
            staffId,
            jobTitle,
            department,
          }
        : null;

    rows.push({ rowNumber, data, raw, errors });
  }

  return { rows };
}

export interface StaffImportOutcome {
  created: number;
  failed: { rowNumber: number; name: string; error: string }[];
  results: { name: string; email: string; inviteToken: string }[];
}

/// Rows are created one at a time, not in a single transaction — a row
/// that fails (e.g. a race with another admin creating the same email
/// between preview and confirm) stops that row without discarding the
/// staff already created ahead of it. mode "DIRECT" creates each account
/// immediately (see createStaffDirect); "INVITE" only creates invitation
/// links (see inviteStaffMember) — no User exists until each is accepted.
export async function commitStaffImport(
  schoolId: string,
  actingUserId: string,
  rows: { rowNumber: number; data: StaffImportData }[],
  mode: "INVITE" | "DIRECT"
): Promise<StaffImportOutcome> {
  const outcome: StaffImportOutcome = { created: 0, failed: [], results: [] };

  for (const row of rows) {
    try {
      if (mode === "DIRECT") {
        const { user, invite } = await createStaffDirect(schoolId, actingUserId, row.data);
        outcome.results.push({ name: user.name, email: user.email, inviteToken: invite.token });
      } else {
        const invite = await inviteStaffMember(schoolId, actingUserId, row.data.email, row.data.roleId);
        outcome.results.push({ name: row.data.name, email: row.data.email, inviteToken: invite.token });
      }
      outcome.created++;
    } catch (error) {
      outcome.failed.push({
        rowNumber: row.rowNumber,
        name: row.data.name,
        error: error instanceof Error ? error.message : "Could not create this account.",
      });
    }
  }

  await logAudit({
    schoolId,
    userId: actingUserId,
    action: "staff.bulk_created",
    resourceType: "User",
    resourceId: "bulk",
    newValue: { mode, created: outcome.created, failed: outcome.failed.length },
  });

  return outcome;
}
