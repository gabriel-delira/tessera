-- PLANO_EVOLUCAO_V2.md §10.5-10.6/D41,D42,D43 — código de entrada avulso
-- (sem NFT) e o registro da entrada por código, separado de Checkin porque
-- Checkin.tokenId exige Ticket, que entrada por código não tem.

-- CreateTable
CREATE TABLE "access_codes" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_entries" (
    "id" TEXT NOT NULL,
    "access_code_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "staff_user_id" TEXT NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_codes_code_key" ON "access_codes"("code");

-- CreateIndex
CREATE INDEX "access_codes_event_id_idx" ON "access_codes"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "access_entries_access_code_id_key" ON "access_entries"("access_code_id");

-- CreateIndex
CREATE INDEX "access_entries_event_id_idx" ON "access_entries"("event_id");

-- AddForeignKey
ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_entries" ADD CONSTRAINT "access_entries_access_code_id_fkey" FOREIGN KEY ("access_code_id") REFERENCES "access_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_entries" ADD CONSTRAINT "access_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_entries" ADD CONSTRAINT "access_entries_staff_user_id_fkey" FOREIGN KEY ("staff_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
