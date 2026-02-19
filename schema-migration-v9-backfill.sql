-- Migration v9 PARTE 2: Backfill - Criar pipeline "Vendas" e migrar contatos
-- RODAR DEPOIS DA PARTE 1
-- Este bloco DO precisa ser rodado inteiro de uma vez

DO $$
DECLARE
  org_rec RECORD;
  pip_id UUID;
  stage_novo UUID;
  stage_prospeccao UUID;
  stage_contatado UUID;
  stage_reuniao UUID;
  stage_convertido UUID;
  stage_perdido UUID;
BEGIN
  FOR org_rec IN
    SELECT id FROM organizations
    WHERE id NOT IN (SELECT DISTINCT organization_id FROM pipelines)
  LOOP
    INSERT INTO pipelines (organization_id, name, description, is_default, "position")
    VALUES (org_rec.id, 'Vendas', 'Pipeline principal de vendas', true, 0)
    RETURNING id INTO pip_id;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Novo', 'NOVO', '#a3a3a3', 0, false, NULL)
    RETURNING id INTO stage_novo;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Em Prospecao', 'EM_PROSPECCAO', '#f59e0b', 1, false, NULL)
    RETURNING id INTO stage_prospeccao;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Contatado', 'CONTATADO', '#3b82f6', 2, false, NULL)
    RETURNING id INTO stage_contatado;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Reuniao Marcada', 'REUNIAO_MARCADA', '#22c55e', 3, false, NULL)
    RETURNING id INTO stage_reuniao;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Convertido', 'CONVERTIDO', '#10b981', 4, true, 'won')
    RETURNING id INTO stage_convertido;

    INSERT INTO pipeline_stages (pipeline_id, name, slug, color, "position", is_terminal, terminal_type)
    VALUES (pip_id, 'Perdido', 'PERDIDO', '#ef4444', 5, true, 'lost')
    RETURNING id INTO stage_perdido;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_novo
    WHERE organization_id = org_rec.id AND status = 'NOVO' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_prospeccao
    WHERE organization_id = org_rec.id AND status = 'EM_PROSPECCAO' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_contatado
    WHERE organization_id = org_rec.id AND status = 'CONTATADO' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_reuniao
    WHERE organization_id = org_rec.id AND status = 'REUNIAO_MARCADA' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_convertido
    WHERE organization_id = org_rec.id AND status = 'CONVERTIDO' AND pipeline_id IS NULL;

    UPDATE contacts SET pipeline_id = pip_id, stage_id = stage_perdido
    WHERE organization_id = org_rec.id AND status = 'PERDIDO' AND pipeline_id IS NULL;

  END LOOP;
END
$$;
