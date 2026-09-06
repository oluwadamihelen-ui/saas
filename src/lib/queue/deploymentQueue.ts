import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export const DEPLOYMENT_QUEUE_NAME = "deployments";

let queue: Queue | null = null;

export function getDeploymentQueue(): Queue {
  if (!queue) {
    queue = new Queue(DEPLOYMENT_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return queue;
}

export interface RunDeploymentPipelineJob {
  deploymentJobId: string;
  deploymentId: string;
}

/**
 * Enqueues the deployment pipeline instead of running it inline in the
 * request that created it -- provisioning/installing/DNS/SSL can take
 * minutes and must never block an HTTP response.
 */
export async function enqueueDeploymentPipeline(input: RunDeploymentPipelineJob) {
  const queue = getDeploymentQueue();
  await queue.add("run_pipeline", input, {
    jobId: input.deploymentJobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  });
}
