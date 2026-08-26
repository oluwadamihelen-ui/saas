-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "doeCostPerAudioSecond" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "doeCostPerTextGeneration" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "doeCostPerVoice100Chars" INTEGER NOT NULL DEFAULT 2;
