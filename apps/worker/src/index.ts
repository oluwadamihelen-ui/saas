import * as Sentry from "@sentry/node";
import { loadEnv } from "@cinerra/config";
import { ModelRouter, ProviderRegistry } from "@cinerra/ai";
import { createGenerationWorker, redisConnection, QUEUE_NAMES, type GenerationJobPayload, type Job } from "@cinerra/queue";
import { createStorageClient } from "@cinerra/storage";
import { isFfmpegAvailable } from "@cinerra/media";
import {
  runStoryGenerationJob,
  runScriptGenerationJob,
  runCharacterGenerationJob,
  runLocationGenerationJob,
  runPropGenerationJob,
  runStoryboardGenerationJob,
  runReferenceImageGenerationJob,
  runShotGenerationJob,
  runAudioGenerationJob,
  runEpisodeExportJob,
  runClipGenerationJob,
} from "@cinerra/domain";
import { prisma } from "@cinerra/database";

const env = loadEnv(process.env);

if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV, tracesSampleRate: 0 });
}

// A long-running process can throw outside any job's own try/catch (a
// stray Redis reconnect error, a bug in a "failed" listener itself) — this
// is the worker's equivalent of apiError.ts's catch-all, so those don't
// vanish silently instead of reaching Sentry/the console.
process.on("unhandledRejection", (reason) => {
  console.error("[worker] unhandled rejection:", reason);
  Sentry.captureException(reason);
});
process.on("uncaughtException", (error) => {
  console.error("[worker] uncaught exception:", error);
  Sentry.captureException(error);
});

const registry = new ProviderRegistry(env);
const router = new ModelRouter(registry);
const storage = createStorageClient(env);
const connection = redisConnection(env.REDIS_URL);

// Global per-worker-process concurrency ceiling (distinct from the
// per-user fair-use concurrency enforced at enqueue time in the API —
// this bounds how much this one worker instance does at once).
const WORKER_CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? 4);

/**
 * Provider adapters wrap the real underlying error (a rejected fetch, the
 * SDK's own APIError with a status/message, etc.) in a generic, honest
 * user-facing message via ProviderGenerationError's `cause2` field — but
 * that real cause needs to actually reach the server logs, or every
 * provider failure looks identical here and is undiagnosable from the
 * worker console alone.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as { cause2?: unknown }).cause2;
  if (cause === undefined) return error.message;
  const causeText = cause instanceof Error ? `${cause.name}: ${cause.message}` : JSON.stringify(cause);
  return `${error.message} — caused by: ${causeText}`;
}

async function withJobLogging(job: Job<GenerationJobPayload>, run: () => Promise<void>): Promise<void> {
  const startedAt = Date.now();
  console.log(`[worker] starting ${job.name} generationJobId=${job.data.generationJobId} attempt=${job.attemptsMade + 1}`);
  try {
    await run();
    console.log(`[worker] finished ${job.name} generationJobId=${job.data.generationJobId} in ${Date.now() - startedAt}ms`);
  } catch (error) {
    console.error(`[worker] failed ${job.name} generationJobId=${job.data.generationJobId}:`, describeError(error));
    Sentry.captureException(error, { tags: { jobType: job.name, generationJobId: job.data.generationJobId } });
    throw error; // let BullMQ apply the configured retry/backoff policy
  }
}

const workers = [
  createGenerationWorker(QUEUE_NAMES.storyGeneration, connection, WORKER_CONCURRENCY, (job) =>
    withJobLogging(job, () => runStoryGenerationJob(router, job.data.generationJobId)),
  ),
  createGenerationWorker(QUEUE_NAMES.scriptGeneration, connection, WORKER_CONCURRENCY, (job) =>
    withJobLogging(job, () => runScriptGenerationJob(router, job.data.generationJobId)),
  ),
  createGenerationWorker(QUEUE_NAMES.characterGeneration, connection, WORKER_CONCURRENCY, (job) =>
    withJobLogging(job, () => runCharacterGenerationJob(router, job.data.generationJobId)),
  ),
  createGenerationWorker(QUEUE_NAMES.locationGeneration, connection, WORKER_CONCURRENCY, (job) =>
    withJobLogging(job, () => runLocationGenerationJob(router, job.data.generationJobId)),
  ),
  createGenerationWorker(QUEUE_NAMES.propGeneration, connection, WORKER_CONCURRENCY, (job) =>
    withJobLogging(job, () => runPropGenerationJob(router, job.data.generationJobId)),
  ),
  createGenerationWorker(QUEUE_NAMES.storyboardGeneration, connection, WORKER_CONCURRENCY, (job) =>
    withJobLogging(job, () => runStoryboardGenerationJob(router, job.data.generationJobId)),
  ),
  createGenerationWorker(QUEUE_NAMES.assetGeneration, connection, WORKER_CONCURRENCY, (job) =>
    withJobLogging(job, () => runReferenceImageGenerationJob(router, storage, job.data.generationJobId)),
  ),
  // Video generation is typically the slowest and most provider-rate-limited
  // step, so it gets its own (usually lower) concurrency rather than
  // sharing the general worker concurrency.
  createGenerationWorker(QUEUE_NAMES.shotGeneration, connection, Number(process.env.WORKER_SHOT_CONCURRENCY ?? 2), (job) =>
    withJobLogging(job, () => runShotGenerationJob(router, storage, job.data.generationJobId)),
  ),
  // One queue shared by dialogue/SFX/music (spec §25) — the dispatcher
  // reads the persisted job's type and routes to the right service.
  createGenerationWorker(QUEUE_NAMES.audioGeneration, connection, WORKER_CONCURRENCY, (job) =>
    withJobLogging(job, () => runAudioGenerationJob(router, storage, job.data.generationJobId)),
  ),
  // Episode export is CPU-bound (ffmpeg re-encoding) rather than
  // provider-rate-limited, so it gets a small dedicated concurrency of its
  // own too — running many at once would just thrash the same CPU.
  createGenerationWorker(QUEUE_NAMES.export, connection, Number(process.env.WORKER_EXPORT_CONCURRENCY ?? 2), (job) =>
    withJobLogging(job, () => runEpisodeExportJob(storage, job.data.generationJobId)),
  ),
  // Trailer/social clip generation shares the same CPU-bound ffmpeg
  // assembly as episode export, just on a smaller selection of shots.
  createGenerationWorker(QUEUE_NAMES.clipGeneration, connection, Number(process.env.WORKER_EXPORT_CONCURRENCY ?? 2), (job) =>
    withJobLogging(job, () => runClipGenerationJob(storage, job.data.generationJobId)),
  ),
];

// The remaining queue (episode-assembly) is defined in @cinerra/queue for
// a future multi-episode/movie assembly step distinct from the
// per-episode export above.

for (const w of workers) {
  w.on("failed", (job, error) => {
    console.error(`[worker] job ${job?.id} exhausted retries:`, error.message);
  });
}

isFfmpegAvailable().then((available) => {
  console.log(
    `[worker] Cinerra worker started. Concurrency=${WORKER_CONCURRENCY}. Providers configured: TEXT=${registry.isConfigured("TEXT")} IMAGE=${registry.isConfigured("IMAGE")} VIDEO=${registry.isConfigured("VIDEO")} VOICE=${registry.isConfigured("VOICE")} MUSIC=${registry.isConfigured("MUSIC")} SOUND_EFFECT=${registry.isConfigured("SOUND_EFFECT")}. FFmpeg available=${available}. Error monitoring: ${env.SENTRY_DSN ? "configured" : "not configured"}.`,
  );
});

async function shutdown(signal: string) {
  console.log(`[worker] received ${signal}, shutting down gracefully…`);
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  await Sentry.close(2000); // flush any in-flight events before exiting; no-op if never initialized
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
