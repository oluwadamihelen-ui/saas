import "dotenv/config";
import { startDeploymentWorker } from "@/lib/queue/deploymentWorker";

const worker = startDeploymentWorker();
console.log("Deployment worker started. Waiting for jobs...");

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
