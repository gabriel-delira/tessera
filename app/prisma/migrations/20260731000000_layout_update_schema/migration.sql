-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('SHOW', 'FESTIVAL', 'TEATRO', 'ESPORTE', 'CONFERENCIA', 'OUTRO');

-- CreateEnum
CREATE TYPE "KycLevel" AS ENUM ('NONE', 'IDENTIFIED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('PIX', 'CRYPTO');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('RESALE_PAYOUT', 'ROYALTY_PAYOUT', 'WITHDRAWAL', 'WITHDRAWAL_REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "NegotiationParty" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "category" "EventCategory" NOT NULL DEFAULT 'OUTRO',
ADD COLUMN     "doors_open_at" TIMESTAMP(3),
ADD COLUMN     "featured_rank" INTEGER,
ADD COLUMN     "lineup" TEXT,
ADD COLUMN     "max_resale_bps" INTEGER,
ADD COLUMN     "subcategory" TEXT;

-- AlterTable
ALTER TABLE "organizers" ADD COLUMN     "kyb_verified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "kyc_level" "KycLevel" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "kyc_verified_at" TIMESTAMP(3),
ADD COLUMN     "payout_method" "PayoutMethod" NOT NULL DEFAULT 'PIX',
ADD COLUMN     "pix_key" TEXT,
ADD COLUMN     "pix_key_updated_at" TIMESTAMP(3),
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount_brl" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "purchase_id" TEXT,
    "withdrawal_id" TEXT,
    "onchain_tx_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiations" (
    "id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "buyer_user_id" TEXT NOT NULL,
    "status" "NegotiationStatus" NOT NULL DEFAULT 'OPEN',
    "turn" "NegotiationParty" NOT NULL,
    "round_count" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "agreed_price" DECIMAL(18,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_rounds" (
    "id" TEXT NOT NULL,
    "negotiation_id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "author" "NegotiationParty" NOT NULL,
    "price_usdc" DECIMAL(18,6) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_entries_user_id_created_at_idx" ON "ledger_entries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "negotiations_listing_id_status_idx" ON "negotiations"("listing_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "negotiations_listing_id_buyer_user_id_key" ON "negotiations"("listing_id", "buyer_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_cpf_key" ON "users"("cpf");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_rounds" ADD CONSTRAINT "negotiation_rounds_negotiation_id_fkey" FOREIGN KEY ("negotiation_id") REFERENCES "negotiations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

