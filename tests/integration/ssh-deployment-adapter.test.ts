import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/security/encryption";
import type { DeploymentStepInput } from "@/lib/providers/deployment/types";

const SUFFIX = `ssh-adapter-${Date.now()}`;

// execCommand's behavior is swapped out per test via this ref rather than
// re-mocking the module each time -- node-ssh is imported once at module
// load, so vi.mock's factory has to stay generic and delegate to something
// tests can reassign.
type ExecResult = { stdout: string; stderr: string; code: number };
let execImpl: (command: string, opts?: { cwd?: string }) => ExecResult = () => ({ stdout: "", stderr: "", code: 0 });
const connectMock = vi.fn(async () => undefined);
const disposeMock = vi.fn();

vi.mock("node-ssh", () => ({
  NodeSSH: vi.fn().mockImplementation(function (this: unknown) {
    return {
      connect: connectMock,
      execCommand: vi.fn(async (command: string, opts?: { cwd?: string }) => execImpl(command, opts)),
      dispose: disposeMock,
    };
  }),
}));

describe("SSHDeploymentAdapter", () => {
  let categoryId: string;
  let applicationId: string;
  let applicationVersionId: string;
  let customerId: string;
  let deploymentTargetId: string;
  let deploymentId: string;
  let deploymentCredentialId: string;

  beforeAll(async () => {
    const customerRole = await prisma.role.upsert({ where: { key: "CUSTOMER" }, update: {}, create: { key: "CUSTOMER", name: "Customer" } });
    const customer = await prisma.user.create({
      data: { name: "SSH Test Customer", email: `customer-${SUFFIX}@example.com`, roleId: customerRole.id, status: "ACTIVE" },
    });
    customerId = customer.id;

    const category = await prisma.category.create({ data: { name: `SSH Adapter Test ${SUFFIX}`, slug: `ssh-adapter-test-${SUFFIX}` } });
    categoryId = category.id;

    const application = await prisma.application.create({
      data: {
        name: `SSH Adapter Test App ${SUFFIX}`,
        slug: `ssh-adapter-test-app-${SUFFIX}`,
        shortDescription: "Test",
        fullDescription: "Test",
        categoryId,
        status: "PUBLISHED",
      },
    });
    applicationId = application.id;

    const spec = await prisma.deploymentSpecification.create({
      data: { runtime: "node20", port: 4000, environmentVariables: [] },
    });

    const version = await prisma.applicationVersion.create({
      data: {
        applicationId,
        version: "1.0.0",
        status: "STABLE",
        isLatest: true,
        isStable: true,
        deploymentSpecificationId: spec.id,
        artifact: { create: { type: "GIT_REPOSITORY", reference: "https://example.com/repo.git" } },
      },
    });
    applicationVersionId = version.id;

    const target = await prisma.deploymentTarget.create({
      data: {
        customerId,
        type: "CUSTOMER_SERVER",
        provider: "ssh",
        hostname: "server.example.com",
        port: 22,
        sshUsername: "deploy",
        status: "ACTIVE",
      },
    });
    deploymentTargetId = target.id;

    const credential = await prisma.deploymentCredential.create({
      data: { deploymentTargetId, type: "SSH_KEY", encryptedValue: encryptSecret("-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----") },
    });
    deploymentCredentialId = credential.id;

    const deployment = await prisma.deployment.create({
      data: {
        customerId,
        applicationId,
        applicationVersionId,
        deploymentTargetId,
        type: "CUSTOMER_SERVER",
        status: "INSTALLING",
      },
    });
    deploymentId = deployment.id;
  });

  afterAll(async () => {
    if (deploymentId) await prisma.deployment.delete({ where: { id: deploymentId } }).catch(() => undefined);
    if (deploymentCredentialId) await prisma.deploymentCredential.delete({ where: { id: deploymentCredentialId } }).catch(() => undefined);
    if (deploymentTargetId) await prisma.deploymentTarget.delete({ where: { id: deploymentTargetId } }).catch(() => undefined);
    if (applicationVersionId) {
      const v = await prisma.applicationVersion.findUnique({ where: { id: applicationVersionId }, select: { deploymentSpecificationId: true } });
      await prisma.applicationArtifact.deleteMany({ where: { applicationVersionId } });
      await prisma.applicationVersion.delete({ where: { id: applicationVersionId } }).catch(() => undefined);
      if (v?.deploymentSpecificationId) await prisma.deploymentSpecification.delete({ where: { id: v.deploymentSpecificationId } }).catch(() => undefined);
    }
    if (applicationId) await prisma.application.delete({ where: { id: applicationId } }).catch(() => undefined);
    if (categoryId) await prisma.category.delete({ where: { id: categoryId } }).catch(() => undefined);
    if (customerId) await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
  });

  beforeEach(() => {
    execImpl = () => ({ stdout: "", stderr: "", code: 0 });
    connectMock.mockClear();
    disposeMock.mockClear();
  });

  function baseTarget() {
    return {
      deploymentId,
      deploymentTargetId,
      adapter: "ssh" as const,
      host: "server.example.com",
      port: 22,
      username: "deploy",
    };
  }

  function baseInput(overrides: Partial<DeploymentStepInput> = {}): DeploymentStepInput {
    return {
      target: baseTarget(),
      applicationSlug: `ssh-adapter-test-app-${SUFFIX}`,
      version: "1.0.0",
      runtime: "node20",
      envVars: { NODE_ENV: "production" },
      ...overrides,
    };
  }

  it("validateTarget succeeds when the connection and echo succeed", async () => {
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.validateTarget(baseTarget());
    expect(result.valid).toBe(true);
    expect(connectMock).toHaveBeenCalledWith(expect.objectContaining({ host: "server.example.com", username: "deploy" }));
    expect(disposeMock).toHaveBeenCalled();
  });

  it("validateTarget fails with a configuration error when connect throws", async () => {
    connectMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.validateTarget(baseTarget());
    expect(result.valid).toBe(false);
    expect(result.isConfigurationError).toBe(true);
    expect(result.message).toContain("ECONNREFUSED");
  });

  it("validateTarget fails clearly when the target has no stored credential", async () => {
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.validateTarget({ ...baseTarget(), deploymentTargetId: "nonexistent-target-id" });
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/no ssh key/i);
  });

  it("deploy clones a GIT_REPOSITORY artifact and runs install/build commands", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.deploy(
      baseInput({ artifact: { type: "GIT_REPOSITORY", reference: "https://example.com/repo.git" }, installCommand: "npm install", buildCommand: "npm run build" })
    );

    expect(result.success).toBe(true);
    expect(commands.some((c) => c.startsWith("git clone --depth 1"))).toBe(true);
    expect(commands).toContain("npm install");
    expect(commands).toContain("npm run build");
  });

  it("deploy for a GIT_COMMIT artifact clones then checks out the commit", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    await adapter.deploy(baseInput({ artifact: { type: "GIT_COMMIT", reference: "https://example.com/repo.git#abc123" } }));

    expect(commands.some((c) => c.startsWith("git clone "))).toBe(true);
    expect(commands.some((c) => c.includes("git checkout") && c.includes("abc123"))).toBe(true);
  });

  it("deploy rejects a malformed GIT_COMMIT reference", async () => {
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    await expect(adapter.deploy(baseInput({ artifact: { type: "GIT_COMMIT", reference: "https://example.com/repo.git" } }))).rejects.toThrow(/malformed/i);
  });

  it("deploy downloads and extracts an ARCHIVE artifact", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    await adapter.deploy(baseInput({ artifact: { type: "ARCHIVE", reference: "https://example.com/build.tar.gz" } }));

    expect(commands.some((c) => c.includes("curl -fsSL") && c.includes("tar -xzf"))).toBe(true);
  });

  it("deploy rejects unsupported artifact types like DOCKER_IMAGE", async () => {
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    await expect(adapter.deploy(baseInput({ artifact: { type: "DOCKER_IMAGE", reference: "example/image:latest" } }))).rejects.toThrow(/doesn't support DOCKER_IMAGE/);
  });

  it("deploy throws when no artifact is configured", async () => {
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    await expect(adapter.deploy(baseInput())).rejects.toThrow(/no deployable artifact/i);
  });

  it("configureEnvironment writes env vars through a base64-encoded pipe", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.configureEnvironment(baseInput({ envVars: { NODE_ENV: "production", PORT: "4000" } }));

    expect(result.success).toBe(true);
    const envCommand = commands.find((c) => c.includes("base64 -d >"));
    expect(envCommand).toBeDefined();
    const encoded = envCommand!.match(/^echo (\S+) \| base64 -d/)?.[1];
    expect(encoded).toBeDefined();
    const decoded = Buffer.from(encoded!, "base64").toString("utf8");
    expect(decoded).toBe("NODE_ENV=production\nPORT=4000");
  });

  it("configureDomain rejects a domain that doesn't look like a hostname", async () => {
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    await expect(adapter.configureDomain(baseTarget(), "not a domain; rm -rf /")).rejects.toThrow(/unexpected domain/i);
  });

  it("configureDomain degrades gracefully when nginx isn't installed", async () => {
    execImpl = (command) => (command === "command -v nginx" ? { stdout: "", stderr: "", code: 1 } : { stdout: "", stderr: "", code: 0 });
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.configureDomain(baseTarget(), "app.example.com");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/nginx isn't installed/i);
  });

  it("configureDomain writes an nginx config proxying to the app's configured port when nginx is present", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.configureDomain(baseTarget(), "app.example.com");
    expect(result.success).toBe(true);

    const writeCommand = commands.find((c) => c.includes("sites-available/app.example.com"));
    expect(writeCommand).toBeDefined();
    const encoded = writeCommand!.match(/^echo (\S+) \| base64 -d/)?.[1];
    const decoded = Buffer.from(encoded!, "base64").toString("utf8");
    expect(decoded).toContain("proxy_pass http://127.0.0.1:4000;");
    expect(commands.some((c) => c.includes("nginx -t"))).toBe(true);
    expect(commands.some((c) => c.includes("systemctl reload nginx"))).toBe(true);
  });

  it("configureSSL degrades gracefully when certbot isn't installed", async () => {
    execImpl = (command) => (command === "command -v certbot" ? { stdout: "", stderr: "", code: 1 } : { stdout: "", stderr: "", code: 0 });
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.configureSSL(baseTarget(), "app.example.com");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/certbot isn't installed/i);
  });

  it("configureSSL runs certbot when it's available", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.configureSSL(baseTarget(), "app.example.com");
    expect(result.success).toBe(true);
    expect(commands.some((c) => c.includes("certbot --nginx -d app.example.com"))).toBe(true);
  });

  it("runMigrations runs the migration command, symlinks current, and starts the app via pm2 when available", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      if (command === "command -v pm2") return { stdout: "/usr/bin/pm2", stderr: "", code: 0 };
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.runMigrations(baseInput({ migrationCommand: "npm run migrate", startCommand: "npm start" }));

    expect(result.success).toBe(true);
    expect(commands).toContain("npm run migrate");
    expect(commands.some((c) => c.startsWith("ln -sfn"))).toBe(true);
    expect(commands.some((c) => c.includes("pm2 delete"))).toBe(true);
    expect(commands.some((c) => c.includes("pm2 start bash"))).toBe(true);
    expect(commands).toContain("pm2 save");
  });

  it("runMigrations falls back to nohup when pm2 isn't available", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      if (command === "command -v pm2") return { stdout: "", stderr: "", code: 1 };
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    await adapter.runMigrations(baseInput({ startCommand: "npm start" }));

    expect(commands.some((c) => c.startsWith("nohup npm start"))).toBe(true);
  });

  it("getStatus reports running when pm2 lists an online process", async () => {
    execImpl = (command) => {
      if (command === "pm2 jlist") return { stdout: JSON.stringify([{ pm2_env: { status: "online" } }]), stderr: "", code: 0 };
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.getStatus(baseTarget());
    expect(result.status).toBe("running");
  });

  it("getStatus reports stopped when pm2 lists no online process", async () => {
    execImpl = (command) => {
      if (command === "pm2 jlist") return { stdout: JSON.stringify([{ pm2_env: { status: "stopped" } }]), stderr: "", code: 0 };
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.getStatus(baseTarget());
    expect(result.status).toBe("stopped");
  });

  it("getStatus reports unknown when the connection itself fails", async () => {
    connectMock.mockRejectedValueOnce(new Error("unreachable"));
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.getStatus(baseTarget());
    expect(result.status).toBe("unknown");
  });

  it("rollback repoints the current symlink when the target release exists", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      if (command.startsWith("test -d")) return { stdout: "", stderr: "", code: 0 };
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.rollback(baseTarget(), "0.9.0");
    expect(result.success).toBe(true);
    expect(commands.some((c) => c.startsWith("ln -sfn") && c.includes("0.9.0"))).toBe(true);
    expect(commands.some((c) => c.startsWith("pm2 restart"))).toBe(true);
  });

  it("rollback throws when the target release doesn't exist on the server", async () => {
    execImpl = (command) => (command.startsWith("test -d") ? { stdout: "", stderr: "", code: 1 } : { stdout: "", stderr: "", code: 0 });
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    await expect(adapter.rollback(baseTarget(), "9.9.9")).rejects.toThrow(/was not found on the server/i);
  });

  it("destroy stops the pm2 process without deleting files", async () => {
    const commands: string[] = [];
    execImpl = (command) => {
      commands.push(command);
      return { stdout: "", stderr: "", code: 0 };
    };
    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.destroy(baseTarget());
    expect(result.success).toBe(true);
    expect(commands.some((c) => c.includes("pm2 delete"))).toBe(true);
    expect(commands.some((c) => c.includes("rm -rf"))).toBe(false);
  });

  it("runHealthCheck probes over HTTP without opening an SSH connection", async () => {
    connectMock.mockClear();
    const fetchMock = vi.fn(async (url: string) => ({ status: url.startsWith("https://") ? 500 : 200 }) as Response);
    vi.stubGlobal("fetch", fetchMock);

    const { SSHDeploymentAdapter } = await import("@/lib/providers/deployment/ssh");
    const adapter = new SSHDeploymentAdapter();

    const result = await adapter.runHealthCheck(baseTarget(), "https://app.example.com");

    expect(result.httpOk).toBe(true);
    expect(result.httpsOk).toBe(false);
    expect(result.applicationHealthy).toBe(true);
    expect(connectMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
