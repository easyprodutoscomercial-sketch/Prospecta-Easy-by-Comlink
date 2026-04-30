-- /furos round 2: UNIQUE INDEX em booth_visits e quiz_participantes
--
-- Problema: ambas tabelas tinham regra "deve ser unica por X" implementada
-- so em codigo (SELECT antes de INSERT). Race condition (clique duplo,
-- retry de rede) gerava duplicatas reais — 39 booth_visits e 1 quiz
-- duplicado encontrados em prod (Agrishow 2026-04-30).
--
-- Antes de aplicar essa migration:
--   1. Rodar `node scripts/dedupe-booth-visits.mjs --apply` (dedupa as 39)
--   2. Rodar o UPDATE/DELETE da 1 duplicata de quiz_participantes (incluso aqui)
--
-- Reverter (rollback):
--   DROP INDEX IF EXISTS uq_booth_visits_user_booth_event;
--   DROP INDEX IF EXISTS uq_quiz_participante_telefone;

-- =============================================================
-- 1. booth_visits: visita unica por (user, booth, event)
-- =============================================================
-- Codigo do check-in ja tem fallback `error.code === '23505'` que vira ativo
-- com esse constraint. Click duplo ou race agora retorna 23505 e o codigo
-- atualiza a visita existente em vez de criar duplicata.
CREATE UNIQUE INDEX IF NOT EXISTS uq_booth_visits_user_booth_event
ON booth_visits (user_id, booth_id, event_id);

-- =============================================================
-- 2. quiz_participantes: dedup do unico par duplicado encontrado em prod
-- =============================================================
-- Phone "16996090177" no quiz_config_id atual tem 2 registros (dia 4).
-- Mantem o mais antigo (created_at ASC), deleta o resto.
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY quiz_config_id, regexp_replace(coalesce(telefone, ''), '[^0-9]', '', 'g')
           ORDER BY created_at ASC
         ) AS rn
  FROM quiz_participantes
)
DELETE FROM quiz_participantes
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- =============================================================
-- 3. quiz_participantes: UNIQUE em (quiz_config_id, telefone normalizado)
-- =============================================================
-- Como nao temos coluna telefone_normalized, indexamos pelo regex que
-- remove tudo que nao e digito. Mesmo padrao usado no codigo de dedupe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_participante_telefone
ON quiz_participantes (quiz_config_id, (regexp_replace(coalesce(telefone, ''), '[^0-9]', '', 'g')));
