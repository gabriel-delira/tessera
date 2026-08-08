-- PLANO_EVOLUCAO_V2.md §10.4/D39 — nullable: null continua significando "usa
-- a cota legal calculada em runtime", comportamento de todo evento existente.
ALTER TABLE "events" ADD COLUMN "social_half_bps" INTEGER;
