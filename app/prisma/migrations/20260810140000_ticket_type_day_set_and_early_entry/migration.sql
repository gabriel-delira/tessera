-- Passe multi-dia: um TicketType deixa de valer para UM dia e passa a valer
-- para um CONJUNTO de dias.
--   day_id NULL      -> day_ids '{}'        (evento sem dimensão de dia)
--   day_id 'abc'     -> day_ids '{abc}'     (ingresso de um dia, como antes)
--   (novo)           -> day_ids '{a,b,c}'   (passe)
--
-- E entrada antecipada (early_entry_minutes), que é perk de porta e não tem
-- nada a ver com quais dias o ingresso cobre — por isso coluna separada.

-- AlterTable: cria a coluna nova já com default vazio pra não travar em linha existente
ALTER TABLE "ticket_types" ADD COLUMN "day_ids" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "ticket_types" ADD COLUMN "early_entry_minutes" INTEGER;

-- Backfill: cada tipo existente vira um conjunto de exatamente um dia (ou vazio)
UPDATE "ticket_types"
   SET "day_ids" = CASE WHEN "day_id" IS NULL THEN '{}'::TEXT[] ELSE ARRAY["day_id"] END;

-- O índice antigo referenciava day_id; day_ids é array e não entra em btree
-- do mesmo jeito. A busca quente é por evento (+ área), que é o que sobra.
DROP INDEX IF EXISTS "ticket_types_event_id_day_id_area_id_idx";
CREATE INDEX "ticket_types_event_id_area_id_idx" ON "ticket_types"("event_id", "area_id");

-- DropColumn: day_ids é a única fonte de verdade a partir daqui; manter as duas
-- colunas só criaria divergência silenciosa.
ALTER TABLE "ticket_types" DROP COLUMN "day_id";
