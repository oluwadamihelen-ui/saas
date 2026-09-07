import { prisma } from "@/lib/db";
import { ApplicationVersionStatus, ArtifactType } from "@/generated/prisma/client";
import { recordAuditLog } from "@/lib/security/audit";

export interface EnvVarSchemaEntry {
  key: string;
  description?: string;
  required: boolean;
  secret: boolean;
  defaultValue?: string;
}

export interface DeploymentSpecInput {
  runtime: string;
  runtimeVersion?: string;
  framework?: string;
  frameworkVersion?: string;
  packageManager?: string;
  installCommand?: string;
  buildCommand?: string;
  startCommand?: string;
  port?: number;
  healthCheckPath?: string;
  databaseType?: string;
  databaseVersion?: string;
  requiredServices?: string[];
  environmentVariables: EnvVarSchemaEntry[];
  migrationCommand?: string;
  seedCommand?: string;
  deploymentMethod?: string;
}

export interface ArtifactInput {
  type: ArtifactType;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface CreateVersionInput {
  applicationId: string;
  version: string;
  releaseName?: string;
  description?: string;
  status?: ApplicationVersionStatus;
  isLatest?: boolean;
  isStable?: boolean;
  packageReference?: string;
  rollbackOf?: string;
  spec: DeploymentSpecInput;
  artifact?: ArtifactInput;
  actorId?: string;
}

/**
 * Creates one technical release of an application: a DeploymentSpecification
 * (the structured "how to install it" config commands are generated from,
 * never from raw input), an optional ApplicationArtifact (the "what gets
 * installed"), and the ApplicationVersion record tying them together. Marking
 * a version isLatest never touches any customer's existing Deployment --
 * upgrades are always an explicit, separate action.
 */
export async function createApplicationVersion(input: CreateVersionInput) {
  const version = await prisma.$transaction(async (tx) => {
    if (input.isLatest) {
      await tx.applicationVersion.updateMany({
        where: { applicationId: input.applicationId, isLatest: true },
        data: { isLatest: false },
      });
    }

    const spec = await tx.deploymentSpecification.create({
      data: {
        runtime: input.spec.runtime,
        runtimeVersion: input.spec.runtimeVersion,
        framework: input.spec.framework,
        frameworkVersion: input.spec.frameworkVersion,
        packageManager: input.spec.packageManager,
        installCommand: input.spec.installCommand,
        buildCommand: input.spec.buildCommand,
        startCommand: input.spec.startCommand,
        port: input.spec.port ?? 3000,
        healthCheckPath: input.spec.healthCheckPath ?? "/api/health",
        databaseType: input.spec.databaseType,
        databaseVersion: input.spec.databaseVersion,
        requiredServices: input.spec.requiredServices ?? [],
        environmentVariables: input.spec.environmentVariables as never,
        migrationCommand: input.spec.migrationCommand,
        seedCommand: input.spec.seedCommand,
        deploymentMethod: input.spec.deploymentMethod,
      },
    });

    const created = await tx.applicationVersion.create({
      data: {
        applicationId: input.applicationId,
        version: input.version,
        releaseName: input.releaseName,
        description: input.description,
        status: input.status ?? "DRAFT",
        isLatest: input.isLatest ?? false,
        isStable: input.isStable ?? false,
        packageReference: input.packageReference,
        rollbackOf: input.rollbackOf,
        deploymentSpecificationId: spec.id,
        artifact: input.artifact
          ? {
              create: {
                type: input.artifact.type,
                reference: input.artifact.reference,
                metadata: input.artifact.metadata as never,
              },
            }
          : undefined,
      },
    });

    if (input.isLatest) {
      await tx.application.update({ where: { id: input.applicationId }, data: { currentVersion: input.version } });
    }

    return created;
  });

  await recordAuditLog({
    actorId: input.actorId ?? null,
    action: "application_version.created",
    resourceType: "ApplicationVersion",
    resourceId: version.id,
    newValue: { applicationId: input.applicationId, version: input.version, status: version.status },
  });

  return version;
}

export async function publishApplicationVersion(versionId: string, actorId: string) {
  const version = await prisma.applicationVersion.findUniqueOrThrow({ where: { id: versionId } });

  await prisma.$transaction([
    prisma.applicationVersion.updateMany({
      where: { applicationId: version.applicationId, isLatest: true },
      data: { isLatest: false },
    }),
    prisma.applicationVersion.update({
      where: { id: versionId },
      data: { status: "STABLE", isLatest: true, isStable: true },
    }),
    prisma.application.update({ where: { id: version.applicationId }, data: { currentVersion: version.version } }),
  ]);

  await recordAuditLog({
    actorId,
    action: "application_version.published",
    resourceType: "ApplicationVersion",
    resourceId: versionId,
    newValue: { version: version.version },
  });
}

export async function getLatestVersion(applicationId: string) {
  return prisma.applicationVersion.findFirst({
    where: { applicationId, isLatest: true },
    include: { deploymentSpecification: true, artifact: true },
  });
}

export async function listVersions(applicationId: string) {
  return prisma.applicationVersion.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
    include: { deploymentSpecification: true, artifact: true },
  });
}
