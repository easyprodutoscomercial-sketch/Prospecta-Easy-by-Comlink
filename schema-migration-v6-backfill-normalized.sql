-- ============================================
-- MIGRATION V6: Backfill normalized columns
-- Preenche cpf_digits, cnpj_digits, phone_normalized, email_normalized
-- para contatos existentes que tem dados brutos mas campos normalizados NULL
-- ============================================

-- 1) Backfill phone_normalized (remove tudo que nao e digito)
UPDATE contacts
SET phone_normalized = regexp_replace(phone, '\D', '', 'g')
WHERE phone IS NOT NULL
  AND phone != ''
  AND (phone_normalized IS NULL OR phone_normalized = '');

-- 2) Backfill email_normalized (lowercase + trim)
UPDATE contacts
SET email_normalized = lower(trim(email))
WHERE email IS NOT NULL
  AND email != ''
  AND (email_normalized IS NULL OR email_normalized = '');

-- 3) Backfill cpf_digits (so aceita se tem exatamente 11 digitos)
UPDATE contacts
SET cpf_digits = regexp_replace(cpf, '\D', '', 'g')
WHERE cpf IS NOT NULL
  AND cpf != ''
  AND (cpf_digits IS NULL OR cpf_digits = '')
  AND length(regexp_replace(cpf, '\D', '', 'g')) = 11;

-- 4) Backfill cnpj_digits (so aceita se tem exatamente 14 digitos)
UPDATE contacts
SET cnpj_digits = regexp_replace(cnpj, '\D', '', 'g')
WHERE cnpj IS NOT NULL
  AND cnpj != ''
  AND (cnpj_digits IS NULL OR cnpj_digits = '')
  AND length(regexp_replace(cnpj, '\D', '', 'g')) = 14;

-- 5) Backfill name_normalized (trim + collapse spaces)
UPDATE contacts
SET name_normalized = trim(regexp_replace(name, '\s+', ' ', 'g'))
WHERE name IS NOT NULL
  AND (name_normalized IS NULL OR name_normalized = '');
