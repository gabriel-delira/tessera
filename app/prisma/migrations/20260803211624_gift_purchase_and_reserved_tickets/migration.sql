-- AlterTable
ALTER TABLE "events" ADD COLUMN     "reserved_tickets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reserved_tickets_assigned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "is_reserved_allocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recipient_user_id" TEXT;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
