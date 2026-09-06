import "dotenv/config";
import { startDeploymentWorker } from "@/lib/queue/deploymentWorker";
import { startDomainRenewalWorker } from "@/lib/queue/domainRenewalWorker";
import { scheduleDomainRenewalSweep } from "@/lib/queue/domainRenewalQueue";

const deploymentWorker = startDeploymentWorker();
console.log("Deployment worker started. Waiting for jobs...");

const domainRenewalWorker = startDomainRenewalWorker();
scheduleDomainRenewalSweep()
  .then(() => console.log("Domain renewal worker started (daily sweep scheduled)."))
  .catch((error) => console.error("Failed to schedule domain renewal sweep:", error));

process.on("SIGTERM", async () => {
  await deploymentWorker.close();
  await domainRenewalWorker.close();
  process.exit(0);
});
