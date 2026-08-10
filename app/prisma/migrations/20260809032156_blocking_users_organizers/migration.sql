-- AlterTable
ALTER TABLE "organizers" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blocked_at" TIMESTAMP(3),
ADD COLUMN     "blocked_reason" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "blocked_at" TIMESTAMP(3),
ADD COLUMN     "blocked_reason" TEXT;
