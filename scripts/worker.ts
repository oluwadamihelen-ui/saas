import "dotenv/config";
import { startDeploymentWorker } from "@/lib/queue/deploymentWorker";
import { startDomainRenewalWorker } from "@/lib/queue/domainRenewalWorker";
import { scheduleDomainRenewalSweep } from "@/lib/queue/domainRenewalQueue";
import { startHostingRenewalWorker } from "@/lib/queue/hostingRenewalWorker";
import { scheduleHostingRenewalSweep } from "@/lib/queue/hostingRenewalQueue";

const deploymentWorker = startDeploymentWorker();
console.log("Deployment worker started. Waiting for jobs...");

const domainRenewalWorker = startDomainRenewalWorker();
scheduleDomainRenewalSweep()
  .then(() => console.log("Domain renewal worker started (daily sweep scheduled)."))
  .catch((error) => console.error("Failed to schedule domain renewal sweep:", error));

const hostingRenewalWorker = startHostingRenewalWorker();
scheduleHostingRenewalSweep()
  .then(() => console.log("Hosting renewal worker started (daily sweep scheduled)."))
  .catch((error) => console.error("Failed to schedule hosting renewal sweep:", error));

process.on("SIGTERM", async () => {
  await deploymentWorker.close();
  await domainRenewalWorker.close();
  await hostingRenewalWorker.close();
  process.exit(0);
});
