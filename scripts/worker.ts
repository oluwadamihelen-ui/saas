import "dotenv/config";
import { startOperationsSweepWorker } from "@/lib/queue/operationsSweepWorker";
import { scheduleOperationsSweep } from "@/lib/queue/operationsSweepQueue";

const worker = startOperationsSweepWorker();

scheduleOperationsSweep()
  .then(() => console.log("Operations sweep worker started (daily reminders, stale-outstanding alerts, auto no-show)."))
  .catch((error) => console.error("Failed to schedule operations sweep:", error));

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
