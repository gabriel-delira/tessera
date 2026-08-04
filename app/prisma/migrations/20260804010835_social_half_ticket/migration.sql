-- AlterTable
ALTER TABLE "events" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'BR',
ADD COLUMN     "has_social_half" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "is_half_price" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "is_half_price" BOOLEAN NOT NULL DEFAULT false;
