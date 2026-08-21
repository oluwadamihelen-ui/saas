import { createGenerationQueue, redisConnection, type QueueName, type GenerationJobPayload, type Queue } from "@cinerra/queue";
import { env } from "./env";

const globalForQueue = globalThis as unknown as { queues?: Partial<Record<QueueName, Queue<GenerationJobPayload>>> };

function getQueue(name: QueueName): Queue<GenerationJobPayload> {
  const cache = (globalForQueue.queues ??= {});
  const existing = cache[name];
  if (existing) return existing;
  const queue = createGenerationQueue(name, redisConnection(env.REDIS_URL));
  cache[name] = queue;
  return queue;
}

/** Producer-side helper: enqueues a persisted GenerationJob row for processing by the worker. */
export async function enqueueGenerationJob(queueName: QueueName, generationJobId: string, priority: number): Promise<void> {
  await getQueue(queueName).add(queueName, { generationJobId }, { priority });
}
