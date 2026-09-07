import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createApplicationVersion, getLatestVersion, publishApplicationVersion } from "@/lib/services/application-versions";

const SUFFIX = `versioning-${Date.now()}`;

describe("application versioning", () => {
  let categoryId: string;
  let applicationId: string;
  let actorUserId: string;

  beforeAll(async () => {
    const adminRole = await prisma.role.upsert({ where: { key: "SUPER_ADMIN" }, update: {}, create: { key: "SUPER_ADMIN", name: "Super Admin" } });
    const actor = await prisma.user.create({
      data: { name: "Test Admin", email: `admin-${SUFFIX}@example.com`, roleId: adminRole.id, status: "ACTIVE" },
    });
    actorUserId = actor.id;

    const category = await prisma.category.create({ data: { name: `Versioning Test ${SUFFIX}`, slug: `versioning-test-${SUFFIX}` } });
    categoryId = category.id;
    const application = await prisma.application.create({
      data: {
        name: `Versioning Test App ${SUFFIX}`,
        slug: `versioning-test-app-${SUFFIX}`,
        shortDescription: "Test",
        fullDescription: "Test",
        categoryId,
        status: "DRAFT",
      },
    });
    applicationId = application.id;
  });

  afterAll(async () => {
    // Guard against beforeAll having thrown before these ids were assigned --
    // an unscoped `where: { applicationId: undefined }` matches every row in
    // the table, so without this a setup failure would wipe unrelated data.
    if (!categoryId || !applicationId || !actorUserId) return;

    const versions = await prisma.applicationVersion.findMany({ where: { applicationId }, select: { id: true, deploymentSpecificationId: true } });
    await prisma.applicationArtifact.deleteMany({ where: { applicationVersionId: { in: versions.map((v) => v.id) } } });
    await prisma.applicationVersion.deleteMany({ where: { applicationId } });
    for (const v of versions) {
      if (v.deploymentSpecificationId) await prisma.deploymentSpecification.delete({ where: { id: v.deploymentSpecificationId } }).catch(() => undefined);
    }
    await prisma.application.delete({ where: { id: applicationId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.auditLog.deleteMany({ where: { actorId: actorUserId } });
    await prisma.user.delete({ where: { id: actorUserId } });
  });

  it("creates a version with its own deployment specification and artifact", async () => {
    const v1 = await createApplicationVersion({
      applicationId,
      version: "1.0.0",
      status: "STABLE",
      isLatest: true,
      isStable: true,
      spec: { runtime: "node20", buildCommand: "npm run build", startCommand: "npm start", environmentVariables: [] },
      artifact: { type: "GIT_REPOSITORY", reference: "https://github.com/example/app" },
    });

    const withRelations = await prisma.applicationVersion.findUniqueOrThrow({
      where: { id: v1.id },
      include: { deploymentSpecification: true, artifact: true },
    });
    expect(withRelations.deploymentSpecification?.runtime).toBe("node20");
    expect(withRelations.artifact?.reference).toBe("https://github.com/example/app");
    expect(withRelations.isLatest).toBe(true);
  });

  it("marking a new version isLatest unmarks the previous one, without touching its deployments", async () => {
    const v2 = await createApplicationVersion({
      applicationId,
      version: "1.1.0",
      status: "STABLE",
      isLatest: true,
      isStable: true,
      rollbackOf: "1.0.0",
      spec: { runtime: "node20", buildCommand: "npm run build", startCommand: "npm start", environmentVariables: [] },
    });

    const v1 = await prisma.applicationVersion.findFirstOrThrow({ where: { applicationId, version: "1.0.0" } });
    expect(v1.isLatest).toBe(false); // superseded

    const latest = await getLatestVersion(applicationId);
    expect(latest?.id).toBe(v2.id);
    expect(v2.rollbackOf).toBe("1.0.0");
  });

  it("publishing a DRAFT version marks it STABLE and latest, and updates Application.currentVersion", async () => {
    const draft = await createApplicationVersion({
      applicationId,
      version: "2.0.0",
      status: "DRAFT",
      spec: { runtime: "node22", environmentVariables: [] },
    });
    expect(draft.status).toBe("DRAFT");
    expect(draft.isLatest).toBe(false);

    await publishApplicationVersion(draft.id, actorUserId);

    const published = await prisma.applicationVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(published.status).toBe("STABLE");
    expect(published.isLatest).toBe(true);

    const app = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(app.currentVersion).toBe("2.0.0");
  });
});
