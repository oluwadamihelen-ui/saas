import "dotenv/config";
import { Worker } from "bullmq";
import {
  getRedisConnection,
  getSceneImageQueue,
  type ProjectGenerateJobData,
  type SceneImageJobData,
  type SceneVoiceJobData,
  type ProjectRenderJobData,
} from "./queue";
import { runProjectGeneration, markProjectReadyIfComplete } from "@/server/pipeline/orchestrator";
import { runGenerateSceneImage } from "@/server/pipeline/generate-scene-image";
import { runGenerateSceneVoice } from "@/server/pipeline/generate-scene-voice";
import { runRenderProject } from "@/server/pipeline/render-project";
import { prisma } from "@/server/db/client";

const connection = getRedisConnection();

const projectGenerateWorker = new Worker<ProjectGenerateJobData>(
  "project-generate",
  async (job) => {
    const sceneIds = await runProjectGeneration(job.data.projectId);

    const queue = getSceneImageQueue();
    for (const sceneId of sceneIds) {
      await queue.add(
        "generate-scene-image",
        { sceneId, projectId: job.data.projectId },
        { removeOnComplete: 100, removeOnFail: 100 }
      );
      await prisma.scene.update({ where: { id: sceneId }, data: { imageStatus: "QUEUED" } });
    }
  },
  { connection }
);

const sceneImageWorker = new Worker<SceneImageJobData>(
  "scene-image",
  async (job) => {
    await runGenerateSceneImage(job.data.sceneId);
    await markProjectReadyIfComplete(job.data.projectId);
  },
  { connection }
);

const sceneVoiceWorker = new Worker<SceneVoiceJobData>(
  "scene-voice",
  async (job) => {
    await runGenerateSceneVoice(job.data.sceneId);
  },
  { connection }
);

// Rendering bundles + drives a headless browser — kept at concurrency 1 so a
// single worker process doesn't run multiple Chrome instances at once.
const projectRenderWorker = new Worker<ProjectRenderJobData>(
  "project-render",
  async (job) => {
    await runRenderProject(job.data.renderJobId);
  },
  { connection, concurrency: 1 }
);

const workers = [projectGenerateWorker, sceneImageWorker, sceneVoiceWorker, projectRenderWorker];

for (const worker of workers) {
  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} (${job?.queueName}) failed:`, err.message);
  });
  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} (${job.queueName}) completed`);
  });
}

console.log("Generation worker started — listening on queues: project-generate, scene-image, scene-voice, project-render");

process.on("SIGTERM", async () => {
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
});
