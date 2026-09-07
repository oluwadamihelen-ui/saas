import { NodeSSH } from "node-ssh";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/security/encryption";
import { ProviderTestResult } from "../types";
import {
  DeploymentConnectionTarget,
  DeploymentProviderAdapter,
  DeploymentStatusResult,
  DeploymentStepInput,
  DeploymentStepResult,
  HealthCheckResult,
  ValidateTargetResult,
} from "./types";

const DEFAULT_PORT = 22;
const BASE_DIR = "~/bridgecodes";
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

interface ResolvedCredentials {
  host: string;
  port: number;
  username: string;
  privateKey: string;
}

/** Wraps a value as a safely-quoted POSIX shell argument (defense in depth -- most inputs here are already admin/platform-validated, not raw customer text). */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Real deployment adapter for a customer's own Linux server, reached over
 * SSH (node-ssh, wrapping ssh2). Unlike the payment/domain/hosting
 * adapters, one shared instance of this class serves every customer's SSH
 * target -- there's no single "the" credential to construct it with, so
 * every method resolves that specific target's DeploymentCredential
 * (SSH_KEY, encrypted) via target.deploymentTargetId and opens a fresh
 * connection for the duration of that one step.
 *
 * Process supervision and the reverse-proxy/TLS steps both assume tools a
 * customer would reasonably have (or can install) on a Linux box: pm2 to
 * keep the app running across steps, nginx + certbot for the public
 * domain and SSL. Where a tool isn't present, those steps degrade to a
 * clear, non-fatal result message rather than silently pretending to
 * succeed or hard-failing the whole deployment -- a server without nginx
 * still gets the app installed and running, just reachable by IP:port
 * instead of the domain.
 *
 * The interface has no dedicated "start the process" step, so the app is
 * (re)started at the end of runMigrations() -- the last step that runs
 * before the health check, and specifically after any migrations have
 * applied rather than before, when the database might not be ready yet.
 */
export class SSHDeploymentAdapter implements DeploymentProviderAdapter {
  readonly key = "ssh";
  readonly label = "SSH (Customer Server)";

  private async resolveCredentials(target: DeploymentConnectionTarget): Promise<ResolvedCredentials> {
    if (!target.host) throw new Error("No server hostname configured for this deployment target.");
    if (!target.username) throw new Error("No SSH username configured for this deployment target.");
    if (!target.deploymentTargetId) throw new Error("This deployment target has no stored credentials.");

    const credential = await prisma.deploymentCredential.findFirst({
      where: { deploymentTargetId: target.deploymentTargetId, type: "SSH_KEY" },
      orderBy: { createdAt: "desc" },
    });
    if (!credential) throw new Error("No SSH key is stored for this deployment target.");

    return {
      host: target.host,
      port: target.port ?? DEFAULT_PORT,
      username: target.username,
      privateKey: decryptSecret(credential.encryptedValue),
    };
  }

  private async withConnection<T>(
    target: DeploymentConnectionTarget,
    fn: (ssh: NodeSSH, creds: ResolvedCredentials) => Promise<T>
  ): Promise<T> {
    const creds = await this.resolveCredentials(target);
    const ssh = new NodeSSH();
    try {
      await ssh.connect({
        host: creds.host,
        port: creds.port,
        username: creds.username,
        privateKey: creds.privateKey,
        readyTimeout: 15000,
      });
      return await fn(ssh, creds);
    } finally {
      ssh.dispose();
    }
  }

  private releaseDir(applicationSlug: string, version: string): string {
    return `${BASE_DIR}/${applicationSlug}/releases/${version}`;
  }

  private currentLink(applicationSlug: string): string {
    return `${BASE_DIR}/${applicationSlug}/current`;
  }

  private async execOrThrow(ssh: NodeSSH, command: string, cwd?: string): Promise<string> {
    const result = await ssh.execCommand(command, cwd ? { cwd } : undefined);
    if (result.code !== 0) {
      throw new Error(`Command failed (exit ${result.code}): ${command}\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
  }

  private assertSafeDomain(domain: string): void {
    if (!DOMAIN_PATTERN.test(domain)) {
      throw new Error(`Refusing to configure an unexpected domain value: ${domain}`);
    }
  }

  private async loadDeploymentContext(deploymentId: string) {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { application: true, applicationVersion: { include: { deploymentSpecification: true } } },
    });
    if (!deployment) throw new Error("Could not resolve the deployment record for this step.");
    return {
      applicationSlug: deployment.application.slug,
      port: deployment.applicationVersion.deploymentSpecification?.port ?? 3000,
    };
  }

  async testConnection(): Promise<ProviderTestResult> {
    // No single "the" server for this adapter -- connectivity is checked
    // per deployment target via validateTarget(), not here.
    return {
      state: "CONNECTED",
      message: "SSH adapter is active; connectivity is checked per deployment target.",
      checkedAt: new Date().toISOString(),
    };
  }

  async validateTarget(target: DeploymentConnectionTarget): Promise<ValidateTargetResult> {
    try {
      await this.withConnection(target, async (ssh) => {
        await this.execOrThrow(ssh, "echo ok");
      });
      return { valid: true, message: "Connected to the server successfully." };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to connect to the server.";
      return { valid: false, message, isConfigurationError: true };
    }
  }

  async connect(target: DeploymentConnectionTarget): Promise<DeploymentStepResult> {
    await this.withConnection(target, async (ssh) => {
      await this.execOrThrow(ssh, `mkdir -p ${BASE_DIR}`);
    });
    return { success: true, message: `Connected to ${target.host} via SSH.` };
  }

  async prepareEnvironment(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    const dir = this.releaseDir(input.applicationSlug, input.version);
    return this.withConnection(input.target, async (ssh) => {
      await this.execOrThrow(ssh, `mkdir -p ${dir}`);
      return { success: true, message: `Prepared release directory for ${input.runtime}.` };
    });
  }

  async deploy(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    if (!input.artifact) {
      throw new Error("This application version has no deployable artifact configured.");
    }
    const artifact = input.artifact;
    const dir = this.releaseDir(input.applicationSlug, input.version);

    return this.withConnection(input.target, async (ssh) => {
      switch (artifact.type) {
        case "GIT_REPOSITORY":
          await this.execOrThrow(ssh, `git clone --depth 1 ${shellQuote(artifact.reference)} ${dir}`);
          break;
        case "GIT_COMMIT": {
          const [repoUrl, commitSha] = artifact.reference.split("#");
          if (!repoUrl || !commitSha) {
            throw new Error("Malformed GIT_COMMIT artifact reference (expected <repo-url>#<commit-sha>).");
          }
          await this.execOrThrow(ssh, `git clone ${shellQuote(repoUrl)} ${dir}`);
          await this.execOrThrow(ssh, `git checkout ${shellQuote(commitSha)}`, dir);
          break;
        }
        case "ARCHIVE":
          await this.execOrThrow(
            ssh,
            `mkdir -p ${dir} && curl -fsSL ${shellQuote(artifact.reference)} -o ${dir}/artifact.tar.gz && tar -xzf ${dir}/artifact.tar.gz -C ${dir} && rm ${dir}/artifact.tar.gz`
          );
          break;
        default:
          throw new Error(`SSH deployment doesn't support ${artifact.type} artifacts -- use a Docker or cloud deployment target instead.`);
      }

      if (input.installCommand) await this.execOrThrow(ssh, input.installCommand, dir);
      if (input.buildCommand) await this.execOrThrow(ssh, input.buildCommand, dir);

      return { success: true, message: `Installed ${input.applicationSlug}@${input.version}.` };
    });
  }

  async configureEnvironment(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    const dir = this.releaseDir(input.applicationSlug, input.version);
    const envFileContent = Object.entries(input.envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const encoded = Buffer.from(envFileContent, "utf8").toString("base64");

    return this.withConnection(input.target, async (ssh) => {
      // Piped through base64 rather than interpolated into a shell heredoc
      // -- env values are already filtered to non-secret defaults upstream,
      // but this avoids any shell-metacharacter risk entirely regardless.
      await this.execOrThrow(ssh, `echo ${encoded} | base64 -d > ${dir}/.env`);
      const count = Object.keys(input.envVars).length;
      return { success: true, message: `Configured ${count} environment variable${count === 1 ? "" : "s"}.` };
    });
  }

  async configureDomain(target: DeploymentConnectionTarget, domain: string): Promise<DeploymentStepResult> {
    this.assertSafeDomain(domain);
    const { port } = await this.loadDeploymentContext(target.deploymentId);

    return this.withConnection(target, async (ssh) => {
      const hasNginx = (await ssh.execCommand("command -v nginx")).code === 0;
      if (!hasNginx) {
        return {
          success: false,
          message: `nginx isn't installed on this server -- skipped domain configuration. The app is reachable at http://${target.host}:${port} directly.`,
        };
      }

      const siteConfig = [
        "server {",
        "  listen 80;",
        `  server_name ${domain};`,
        "  location / {",
        `    proxy_pass http://127.0.0.1:${port};`,
        "    proxy_set_header Host $host;",
        "    proxy_set_header X-Real-IP $remote_addr;",
        "  }",
        "}",
      ].join("\n");
      const encoded = Buffer.from(siteConfig, "utf8").toString("base64");
      const sitePath = `/etc/nginx/sites-available/${domain}`;

      await this.execOrThrow(ssh, `echo ${encoded} | base64 -d | sudo tee ${sitePath} > /dev/null`);
      await this.execOrThrow(ssh, `sudo ln -sf ${sitePath} /etc/nginx/sites-enabled/${domain}`);
      const test = await ssh.execCommand("sudo nginx -t");
      if (test.code !== 0) throw new Error(`nginx config test failed: ${test.stderr}`);
      await this.execOrThrow(ssh, "sudo systemctl reload nginx");

      return { success: true, message: `Configured nginx to proxy ${domain} to 127.0.0.1:${port}.` };
    });
  }

  async configureSSL(target: DeploymentConnectionTarget, domain: string): Promise<DeploymentStepResult> {
    this.assertSafeDomain(domain);

    return this.withConnection(target, async (ssh) => {
      const hasCertbot = (await ssh.execCommand("command -v certbot")).code === 0;
      if (!hasCertbot) {
        return { success: false, message: "certbot isn't installed on this server -- skipped SSL setup. Install certbot and redeploy to enable HTTPS." };
      }

      const result = await ssh.execCommand(
        `sudo certbot --nginx -d ${domain} --non-interactive --agree-tos --redirect --register-unsafely-without-email`
      );
      if (result.code !== 0) {
        return { success: false, message: `certbot failed: ${result.stderr || result.stdout}` };
      }
      return { success: true, message: `Issued and installed an SSL certificate for ${domain}.` };
    });
  }

  async runMigrations(input: DeploymentStepInput): Promise<DeploymentStepResult> {
    const dir = this.releaseDir(input.applicationSlug, input.version);
    const currentLink = this.currentLink(input.applicationSlug);

    return this.withConnection(input.target, async (ssh) => {
      if (input.migrationCommand) {
        await this.execOrThrow(ssh, input.migrationCommand, dir);
      }

      await this.execOrThrow(ssh, `ln -sfn ${dir} ${currentLink}`);

      if (input.startCommand) {
        const hasPm2 = (await ssh.execCommand("command -v pm2")).code === 0;
        if (hasPm2) {
          await ssh.execCommand(`pm2 delete ${shellQuote(input.applicationSlug)}`, { cwd: currentLink }); // best-effort; ignore if it doesn't exist yet
          await this.execOrThrow(
            ssh,
            `pm2 start bash --name ${shellQuote(input.applicationSlug)} -- -c ${shellQuote(input.startCommand)}`,
            currentLink
          );
          await ssh.execCommand("pm2 save");
        } else {
          await this.execOrThrow(ssh, `nohup ${input.startCommand} > app.log 2>&1 & disown`, currentLink);
        }
      }

      return {
        success: true,
        message: input.migrationCommand ? "Ran migrations and started the application." : "Started the application (no migrations configured).",
      };
    });
  }

  async runHealthCheck(_target: DeploymentConnectionTarget, url: string): Promise<HealthCheckResult> {
    const httpsUrl = url.replace(/^http:\/\//, "https://");
    const httpUrl = url.replace(/^https:\/\//, "http://");
    const httpsOk = httpsUrl.startsWith("https://") ? await this.probeUrl(httpsUrl) : false;
    const httpOk = httpsOk || (await this.probeUrl(httpUrl));

    return { httpOk, httpsOk, sslValid: httpsOk, applicationHealthy: httpOk };
  }

  private async probeUrl(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
      clearTimeout(timeout);
      return res.status < 500;
    } catch {
      return false;
    }
  }

  async rollback(target: DeploymentConnectionTarget, toVersion: string): Promise<DeploymentStepResult> {
    const { applicationSlug } = await this.loadDeploymentContext(target.deploymentId);
    const releaseDir = this.releaseDir(applicationSlug, toVersion);

    return this.withConnection(target, async (ssh) => {
      const exists = await ssh.execCommand(`test -d ${releaseDir}`);
      if (exists.code !== 0) {
        throw new Error(`Release ${toVersion} was not found on the server (${releaseDir}). It may need to be redeployed first.`);
      }

      await this.execOrThrow(ssh, `ln -sfn ${releaseDir} ${this.currentLink(applicationSlug)}`);
      await ssh.execCommand(`pm2 restart ${shellQuote(applicationSlug)}`);

      return { success: true, message: `Rolled back to ${toVersion}.` };
    });
  }

  async getStatus(target: DeploymentConnectionTarget): Promise<DeploymentStatusResult> {
    try {
      return await this.withConnection(target, async (ssh) => {
        const result = await ssh.execCommand("pm2 jlist");
        if (result.code !== 0) return { status: "unknown" as const };
        try {
          const list = JSON.parse(result.stdout) as Array<{ pm2_env?: { status?: string } }>;
          const anyOnline = list.some((p) => p.pm2_env?.status === "online");
          return { status: anyOnline ? ("running" as const) : ("stopped" as const) };
        } catch {
          return { status: "unknown" as const };
        }
      });
    } catch {
      return { status: "unknown" };
    }
  }

  async destroy(target: DeploymentConnectionTarget): Promise<DeploymentStepResult> {
    const { applicationSlug } = await this.loadDeploymentContext(target.deploymentId);
    return this.withConnection(target, async (ssh) => {
      // Stops the process but deliberately leaves release files on disk --
      // this is a customer's own server, and silently deleting files there
      // is a much higher-risk default than leaving a few unused directories.
      await ssh.execCommand(`pm2 delete ${shellQuote(applicationSlug)}`);
      return { success: true, message: "Stopped the application process." };
    });
  }
}
