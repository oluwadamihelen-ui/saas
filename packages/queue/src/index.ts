import { Queue, Worker, type ConnectionOptions, type Job, type Processor } from "bullmq";
import Redis, { type RedisOptions } from "ioredis";

/**
 * One BullMQ queue per generation job family (spec §25). Splitting queues
 * (rather than one generic "jobs" queue) lets each family carry its own
 * concurrency ceiling, retry policy, and priority weighting — a runaway
 * batch of shot-video generations must never starve story-outline jobs.
 */
export const QUEUE_NAMES = {
  storyGeneration: "story-generation",
  scriptGeneration: "script-generation",
  characterGeneration: "character-generation", // Character + Wardrobe bible (text)
  locationGeneration: "location-generation", // Location bible (text)
  propGeneration: "prop-generation", // Prop bible (text)
  storyboardGeneration: "storyboard-generation", // Director agent shot list (text)
  assetGeneration: "asset-generation", // character/location/wardrobe/prop reference images
  shotGeneration: "shot-generation", // video
  audioGeneration: "audio-generation", // dialogue / sfx / music
  episodeAssembly: "episode-assembly",
  export: "export",
  clipGeneration: "clip-generation", // trailer / social clip
  // Not a generation-job-family queue like the rest of these — a periodic
  // maintenance task (CreatorEarning PENDING -> AVAILABLE once its
  // settlement hold elapses). Registered as a BullMQ repeatable job rather
  // than plain generation jobs, so it carries no GenerationJobPayload.
  settlementTransition: "settlement-transition",
  // Same pattern — expires unused PromotionalGrant coins once their
  // expiresAt passes.
  promotionalExpiration: "promotional-expiration",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Every BullMQ job payload is just a pointer to a GenerationJob row — all
 * real state (status, attempts, error message, result) lives in Postgres,
 * so the queue itself never becomes a second source of truth and job
 * status survives a worker restart.
 */
export interface GenerationJobPayload {
  generationJobId: string;
}

export function redisConnection(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

/** A plain ioredis client against the same REDIS_URL BullMQ uses — for non-queue uses like rate limiting. */
export function createRedisClient(redisUrl: string): Redis {
  const url = new URL(redisUrl);
  return new Redis({
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === "rediss:" ? {} : undefined,
  } satisfies RedisOptions);
}

/** Lower number = processed first. Maps directly from Plan.queuePriority. */
export function bullPriorityFor(queuePriority: "LOW" | "NORMAL" | "HIGH" | "HIGHEST"): number {
  switch (queuePriority) {
    case "HIGHEST":
      return 1;
    case "HIGH":
      return 5;
    case "NORMAL":
      return 10;
    case "LOW":
      return 20;
  }
}

const DEFAULT_ATTEMPTS = 3;

export function createGenerationQueue(name: QueueName, connection: ConnectionOptions): Queue<GenerationJobPayload> {
  return new Queue<GenerationJobPayload>(name, {
    connection,
    defaultJobOptions: {
      attempts: DEFAULT_ATTEMPTS,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 500 },
      // Failed jobs are retained (dead-letter behaviour, spec §25) so
      // admins can inspect them; the linked GenerationJob/ProviderTask rows
      // are the durable record either way.
      removeOnFail: { count: 2000 },
    },
  });
}

export function createGenerationWorker(
  name: QueueName,
  connection: ConnectionOptions,
  concurrency: number,
  processor: Processor<GenerationJobPayload>,
): Worker<GenerationJobPayload> {
  return new Worker<GenerationJobPayload>(name, processor, { connection, concurrency });
}

export type { Job };
export type { Redis };
export { Queue, Worker };
