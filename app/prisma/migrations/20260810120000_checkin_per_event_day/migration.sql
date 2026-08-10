-- Check-in por dia do evento. Antes: um check-in por ingresso pra sempre
-- (UNIQUE em token_id), o que impede qualquer ingresso multi-dia.
--
-- day_id é NOT NULL com default '' de propósito: no Postgres dois NULL são
-- distintos dentro de um UNIQUE, então (token_id, NULL) não impediria dois
-- check-ins do mesmo ingresso — que é justamente a garantia desta constraint.
-- '' significa "evento sem dimensão de dia" (lib/eventDay.ts: NO_DAY).
--
-- Backfill: todo check-in existente é de evento single-day (a dimensão de dia
-- só passa a valer daqui pra frente), então o default '' já os deixa corretos
-- e a UNIQUE nova não pode colidir — havia no máximo uma linha por token_id.

-- AlterTable
ALTER TABLE "checkins" ADD COLUMN "day_id" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX "checkins_token_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "checkins_token_id_day_id_key" ON "checkins"("token_id", "day_id");
