import { Queue } from "bullmq";
import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redisConnection?: IORedis };

export function getRedisConnection(): IORedis {
  if (!globalForRedis.redisConnection) {
    globalForRedis.redisConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return globalForRedis.redisConnection;
}

export type ProjectGenerateJobData = { projectId: string };
export type SceneImageJobData = { sceneId: string; projectId: string };

const globalForQueues = globalThis as unknown as {
  projectGenerateQueue?: Queue<ProjectGenerateJobData>;
  sceneImageQueue?: Queue<SceneImageJobData>;
};

export function getProjectGenerateQueue(): Queue<ProjectGenerateJobData> {
  if (!globalForQueues.projectGenerateQueue) {
    globalForQueues.projectGenerateQueue = new Queue<ProjectGenerateJobData>("project-generate", {
      connection: getRedisConnection(),
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 },
    });
  }
  return globalForQueues.projectGenerateQueue;
}

export function getSceneImageQueue(): Queue<SceneImageJobData> {
  if (!globalForQueues.sceneImageQueue) {
    globalForQueues.sceneImageQueue = new Queue<SceneImageJobData>("scene-image", {
      connection: getRedisConnection(),
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 },
    });
  }
  return globalForQueues.sceneImageQueue;
}
