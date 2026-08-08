-- PLANO_EVOLUCAO_V2.md §10.1/D35 — nullable primeiro, backfill, depois NOT NULL.
-- Backfill copia event_date: nenhum ingresso muda de aba na migração.
ALTER TABLE "events" ADD COLUMN "end_date" TIMESTAMP(3);

UPDATE "events" SET "end_date" = "event_date" WHERE "end_date" IS NULL;

ALTER TABLE "events" ALTER COLUMN "end_date" SET NOT NULL;
