-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "durationMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "os" TEXT;
