-- =============================================
-- VIEWS EDITAVEIS COM NOMES EM PORTUGUES
-- Rodar cada CREATE VIEW separadamente no Supabase
-- =============================================

-- 1. ORGANIZACOES
CREATE OR REPLACE VIEW vw_organizacoes AS
SELECT
  id AS id,
  name AS nome,
  pipeline_settings AS configuracoes_pipeline,
  created_at AS criado_em
FROM organizations;

-- 2. PERFIS (usuarios)
CREATE OR REPLACE VIEW vw_perfis AS
SELECT
  user_id AS id_usuario,
  organization_id AS id_organizacao,
  name AS nome,
  email AS email,
  role AS funcao,
  avatar_url AS foto_url,
  created_at AS criado_em
FROM profiles;

-- 3. CONTATOS
CREATE OR REPLACE VIEW vw_contatos AS
SELECT
  id AS id,
  organization_id AS id_organizacao,
  name AS nome,
  phone AS telefone,
  email AS email,
  cpf AS cpf,
  cnpj AS cnpj,
  company AS empresa,
  notes AS observacoes,
  tipo AS tipo,
  referencia AS referencia,
  classe AS classe,
  produtos_fornecidos AS produtos_fornecidos,
  contato_nome AS nome_contato,
  cargo AS cargo,
  endereco AS endereco,
  cidade AS cidade,
  estado AS estado,
  cep AS cep,
  website AS website,
  instagram AS instagram,
  whatsapp AS whatsapp,
  temperatura AS temperatura,
  origem AS origem,
  proxima_acao_tipo AS proxima_acao,
  proxima_acao_data AS data_proxima_acao,
  motivo_ganho_perdido AS motivo_ganho_perdido,
  valor_estimado AS valor_estimado,
  status AS status,
  assigned_to_user_id AS id_responsavel,
  created_by_user_id AS id_criador,
  created_at AS criado_em,
  updated_at AS atualizado_em
FROM contacts;

-- 4. INTERACOES
CREATE OR REPLACE VIEW vw_interacoes AS
SELECT
  id AS id,
  organization_id AS id_organizacao,
  contact_id AS id_contato,
  type AS tipo,
  outcome AS resultado,
  note AS nota,
  happened_at AS data_ocorrencia,
  created_by_user_id AS id_criador,
  created_by_name AS nome_criador,
  created_by_email AS email_criador,
  created_at AS criado_em,
  updated_at AS atualizado_em
FROM interactions;

-- 5. REUNIOES
CREATE OR REPLACE VIEW vw_reunioes AS
SELECT
  id AS id,
  organization_id AS id_organizacao,
  contact_id AS id_contato,
  created_by_user_id AS id_criador,
  title AS titulo,
  notes AS notas,
  location AS local,
  meeting_at AS data_reuniao,
  duration_minutes AS duracao_minutos,
  status AS status,
  notifications_generated AS notificacoes_geradas,
  created_at AS criado_em,
  updated_at AS atualizado_em
FROM meetings;

-- 6. NOTIFICACOES
CREATE OR REPLACE VIEW vw_notificacoes AS
SELECT
  id AS id,
  organization_id AS id_organizacao,
  user_id AS id_usuario,
  type AS tipo,
  title AS titulo,
  body AS corpo,
  contact_id AS id_contato,
  metadata AS metadados,
  read AS lida,
  dismissed AS dispensada,
  scheduled_for AS agendada_para,
  created_at AS criado_em
FROM notifications;

-- 7. SOLICITACOES DE ACESSO
CREATE OR REPLACE VIEW vw_solicitacoes_acesso AS
SELECT
  id AS id,
  organization_id AS id_organizacao,
  contact_id AS id_contato,
  requester_user_id AS id_solicitante,
  owner_user_id AS id_proprietario,
  status AS status,
  created_at AS criado_em,
  resolved_at AS resolvido_em
FROM access_requests;

-- 8. ANEXOS DE CONTATO
CREATE OR REPLACE VIEW vw_anexos AS
SELECT
  id AS id,
  organization_id AS id_organizacao,
  contact_id AS id_contato,
  file_name AS nome_arquivo,
  file_path AS caminho_arquivo,
  file_size AS tamanho_bytes,
  mime_type AS tipo_arquivo,
  uploaded_by_user_id AS id_enviador,
  uploaded_by_name AS nome_enviador,
  created_at AS criado_em
FROM contact_attachments;

-- 9. IMPORTACOES
CREATE OR REPLACE VIEW vw_importacoes AS
SELECT
  id AS id,
  organization_id AS id_organizacao,
  created_by_user_id AS id_criador,
  total_rows AS total_linhas,
  created_count AS qtd_criados,
  duplicate_count AS qtd_duplicados,
  invalid_count AS qtd_invalidos,
  created_at AS criado_em
FROM import_runs;

-- 10. ITENS DE IMPORTACAO
CREATE OR REPLACE VIEW vw_itens_importacao AS
SELECT
  id AS id,
  import_run_id AS id_importacao,
  row_number AS numero_linha,
  status AS status,
  contact_id AS id_contato,
  error_message AS mensagem_erro,
  data AS dados
FROM import_run_items;

-- 11. CACHE DE ANALISE IA
CREATE OR REPLACE VIEW vw_cache_analise AS
SELECT
  id AS id,
  organization_id AS id_organizacao,
  analysis_type AS tipo_analise,
  cache_key AS chave_cache,
  result AS resultado,
  created_at AS criado_em,
  expires_at AS expira_em
FROM ai_analysis_cache;
