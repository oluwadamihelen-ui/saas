"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createApplicationVersion, publishApplicationVersion, EnvVarSchemaEntry } from "@/lib/services/application-versions";

function parseEnvVars(raw: FormDataEntryValue | null): EnvVarSchemaEntry[] {
  // One per line: KEY|description|required|secret|defaultValue
  return String(raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key, description, required, secret, defaultValue] = line.split("|").map((s) => s?.trim());
      return {
        key,
        description: description || undefined,
        required: required === "true",
        secret: secret === "true",
        defaultValue: defaultValue || undefined,
      };
    });
}

const versionSchema = z.object({
  applicationId: z.string().uuid(),
  version: z.string().trim().min(1).max(40),
  releaseName: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  rollbackOf: z.string().trim().max(40).optional().or(z.literal("")),
  publishNow: z.coerce.boolean().default(false),
  runtime: z.string().trim().min(1).max(80),
  runtimeVersion: z.string().trim().max(40).optional().or(z.literal("")),
  framework: z.string().trim().max(80).optional().or(z.literal("")),
  packageManager: z.string().trim().max(40).optional().or(z.literal("")),
  installCommand: z.string().trim().max(300).optional().or(z.literal("")),
  buildCommand: z.string().trim().max(300).optional().or(z.literal("")),
  startCommand: z.string().trim().max(300).optional().or(z.literal("")),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  healthCheckPath: z.string().trim().max(200).optional().or(z.literal("")),
  databaseType: z.string().trim().max(80).optional().or(z.literal("")),
  requiredServices: z.string().trim().max(300).optional().or(z.literal("")),
  migrationCommand: z.string().trim().max(300).optional().or(z.literal("")),
  seedCommand: z.string().trim().max(300).optional().or(z.literal("")),
  artifactType: z.enum(["DOCKER_IMAGE", "GIT_REPOSITORY", "GIT_COMMIT", "ARCHIVE", "OTHER"]).optional(),
  artifactReference: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function createVersion(formData: FormData) {
  const user = await requirePermission(PERMISSIONS.APPLICATIONS_MANAGE);
  const data = versionSchema.parse(Object.fromEntries(formData.entries()));

  const requiredServices = (data.requiredServices || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const version = await createApplicationVersion({
    applicationId: data.applicationId,
    version: data.version,
    releaseName: data.releaseName || undefined,
    description: data.description || undefined,
    rollbackOf: data.rollbackOf || undefined,
    status: data.publishNow ? "STABLE" : "DRAFT",
    isLatest: data.publishNow,
    isStable: data.publishNow,
    actorId: user.id,
    spec: {
      runtime: data.runtime,
      runtimeVersion: data.runtimeVersion || undefined,
      framework: data.framework || undefined,
      packageManager: data.packageManager || undefined,
      installCommand: data.installCommand || undefined,
      buildCommand: data.buildCommand || undefined,
      startCommand: data.startCommand || undefined,
      port: data.port,
      healthCheckPath: data.healthCheckPath || undefined,
      databaseType: data.databaseType || undefined,
      requiredServices,
      environmentVariables: parseEnvVars(formData.get("environmentVariables")),
      migrationCommand: data.migrationCommand || undefined,
      seedCommand: data.seedCommand || undefined,
      deploymentMethod: "cloud",
    },
    artifact:
      data.artifactType && data.artifactReference
        ? { type: data.artifactType, reference: data.artifactReference }
        : undefined,
  });

  redirect(`/admin/versions?created=${version.id}`);
}

export async function publishVersion(versionId: string) {
  const user = await requirePermission(PERMISSIONS.APPLICATIONS_PUBLISH);
  await publishApplicationVersion(versionId, user.id);
  revalidatePath("/admin/versions");
}
