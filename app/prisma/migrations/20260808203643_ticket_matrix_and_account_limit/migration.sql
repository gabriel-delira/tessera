-- AlterTable
ALTER TABLE "events" ADD COLUMN     "max_tickets_per_account" INTEGER,
ADD COLUMN     "ticket_areas" JSONB,
ADD COLUMN     "ticket_days" JSONB;

-- AlterTable
ALTER TABLE "ticket_types" ADD COLUMN     "area_id" TEXT,
ADD COLUMN     "day_id" TEXT,
ADD COLUMN     "label_touched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lot_number" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "ticket_types_event_id_day_id_area_id_idx" ON "ticket_types"("event_id", "day_id", "area_id");
