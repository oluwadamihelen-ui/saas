-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PlanId" AS ENUM ('FREE', 'STARTER', 'CREATOR', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('SIGNUP_GRANT', 'MONTHLY_GRANT', 'PURCHASE', 'SCRIPT_GENERATION', 'STORYBOARD_GENERATION', 'IMAGE_GENERATION', 'VIDEO_GENERATION', 'VOICE_GENERATION', 'MUSIC_GENERATION', 'RENDER', 'REFUND', 'ADMIN_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SCRIPT_READY', 'STORYBOARD_READY', 'GENERATING', 'READY_TO_EDIT', 'RENDERING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AspectRatio" AS ENUM ('RATIO_16_9', 'RATIO_9_16', 'RATIO_1_1');

-- CreateEnum
CREATE TYPE "VisualStyle" AS ENUM ('MODERN_CARTOON', 'STORYBOOK', 'COMIC', 'THREE_D_ANIMATION', 'MINIMAL_ILLUSTRATION', 'HAND_DRAWN', 'CINEMATIC_CARTOON', 'EDUCATIONAL', 'KIDS_ANIMATION', 'DOCUMENTARY_ILLUSTRATION');

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('DRAFT', 'GENERATING', 'IMAGE_READY', 'ANIMATION_READY', 'VOICE_READY', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "JobStageStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'REFERENCE_IMAGE', 'UPLOAD');

-- CreateEnum
CREATE TYPE "VoiceStyle" AS ENUM ('WARM', 'ENERGETIC', 'DRAMATIC', 'PROFESSIONAL', 'EDUCATIONAL', 'FRIENDLY', 'STORYTELLING');

-- CreateEnum
CREATE TYPE "MusicMood" AS ENUM ('CINEMATIC', 'HAPPY', 'EMOTIONAL', 'INSPIRATIONAL', 'SUSPENSE', 'CALM', 'ADVENTURE', 'CORPORATE', 'CHILDRENS');

-- CreateEnum
CREATE TYPE "GenerationStage" AS ENUM ('SCRIPT_ANALYSIS', 'STORYBOARD', 'CHARACTER_EXTRACTION', 'SCENE_PROMPT', 'IMAGE', 'ANIMATION', 'VOICE', 'MUSIC', 'CAPTIONS', 'COMPOSE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RenderResolution" AS ENUM ('R_720P', 'R_1080P');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "passwordHash" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PlanId" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_balances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "idea" TEXT,
    "script" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL DEFAULT 'en',
    "audience" TEXT,
    "targetLengthSeconds" INTEGER,
    "aspectRatio" "AspectRatio" NOT NULL DEFAULT 'RATIO_16_9',
    "visualStyle" "VisualStyle" NOT NULL DEFAULT 'MODERN_CARTOON',
    "mood" TEXT,
    "colorMood" TEXT,
    "cameraMovement" TEXT,
    "animationIntensity" TEXT,
    "thumbnailUrl" TEXT,
    "finalVideoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "narration" TEXT,
    "visualPrompt" TEXT,
    "location" TEXT,
    "camera" TEXT,
    "transition" TEXT DEFAULT 'fade',
    "durationSeconds" INTEGER NOT NULL DEFAULT 6,
    "status" "SceneStatus" NOT NULL DEFAULT 'DRAFT',
    "imageUrl" TEXT,
    "videoUrl" TEXT,
    "voiceUrl" TEXT,
    "voiceDurationSeconds" DOUBLE PRECISION,
    "imageStatus" "JobStageStatus" NOT NULL DEFAULT 'PENDING',
    "animationStatus" "JobStageStatus" NOT NULL DEFAULT 'PENDING',
    "voiceStatus" "JobStageStatus" NOT NULL DEFAULT 'PENDING',
    "voicePresetId" TEXT,
    "voiceSpeed" DOUBLE PRECISION DEFAULT 1.0,
    "voicePitch" DOUBLE PRECISION DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captions" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "captions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageCategory" TEXT,
    "genderPresentation" TEXT,
    "appearance" TEXT,
    "hair" TEXT,
    "clothing" TEXT,
    "accessories" TEXT,
    "personality" TEXT,
    "visualDescriptor" TEXT,
    "referenceImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_characters" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "project_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scene_characters" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "scene_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "AssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_presets" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerVoiceId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "accent" TEXT,
    "style" "VoiceStyle" NOT NULL DEFAULT 'FRIENDLY',
    "gender" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "previewUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "music_tracks" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "mood" "MusicMood" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "url" TEXT,
    "durationSeconds" INTEGER,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_music" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "musicTrackId" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "fadeInMs" INTEGER NOT NULL DEFAULT 1000,
    "fadeOutMs" INTEGER NOT NULL DEFAULT 2000,
    "loop" BOOLEAN NOT NULL DEFAULT true,
    "duckUnderVoice" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "project_music_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "stage" "GenerationStage" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "metadata" JSONB,
    "error" TEXT,
    "creditsCost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "resolution" "RenderResolution" NOT NULL DEFAULT 'R_1080P',
    "aspectRatio" "AspectRatio" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT,
    "outputUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_balances_userId_key" ON "credit_balances"("userId");

-- CreateIndex
CREATE INDEX "credit_ledger_entries_userId_createdAt_idx" ON "credit_ledger_entries"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE INDEX "scenes_projectId_order_idx" ON "scenes"("projectId", "order");

-- CreateIndex
CREATE INDEX "captions_sceneId_order_idx" ON "captions"("sceneId", "order");

-- CreateIndex
CREATE INDEX "characters_userId_idx" ON "characters"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_characters_projectId_characterId_key" ON "project_characters"("projectId", "characterId");

-- CreateIndex
CREATE UNIQUE INDEX "scene_characters_sceneId_characterId_key" ON "scene_characters"("sceneId", "characterId");

-- CreateIndex
CREATE INDEX "assets_userId_idx" ON "assets"("userId");

-- CreateIndex
CREATE INDEX "assets_projectId_idx" ON "assets"("projectId");

-- CreateIndex
CREATE INDEX "generation_jobs_projectId_status_idx" ON "generation_jobs"("projectId", "status");

-- CreateIndex
CREATE INDEX "render_jobs_projectId_status_idx" ON "render_jobs"("projectId", "status");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_voicePresetId_fkey" FOREIGN KEY ("voicePresetId") REFERENCES "voice_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captions" ADD CONSTRAINT "captions_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_characters" ADD CONSTRAINT "project_characters_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_characters" ADD CONSTRAINT "project_characters_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_characters" ADD CONSTRAINT "scene_characters_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scene_characters" ADD CONSTRAINT "scene_characters_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_presets" ADD CONSTRAINT "voice_presets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_music" ADD CONSTRAINT "project_music_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_music" ADD CONSTRAINT "project_music_musicTrackId_fkey" FOREIGN KEY ("musicTrackId") REFERENCES "music_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "scenes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
