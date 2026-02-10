/**
 * Normalização de dados para deduplicação
 */

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove tudo que não é dígito
  const digits = phone.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

export function normalizeCPF(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11 ? digits : null;
}

export function normalizeCNPJ(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const digits = cnpj.replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}

export function normalizeName(name: string | null | undefined): string {
  if (!name) return '';
  // Remove espaços extras e normaliza
  return name.trim().replace(/\s+/g, ' ');
}

export interface NormalizedContact {
  // Dados originais
  name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  cnpj: string | null;
  company: string | null;
  notes: string | null;
  
  // Dados normalizados
  name_normalized: string;
  phone_normalized: string | null;
  email_normalized: string | null;
  cpf_digits: string | null;
  cnpj_digits: string | null;
}

export function normalizeContactData(data: {
  name: string;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  company?: string | null;
  notes?: string | null;
}): NormalizedContact {
  return {
    name: data.name.trim(),
    phone: data.phone || null,
    email: data.email || null,
    cpf: data.cpf || null,
    cnpj: data.cnpj || null,
    company: data.company || null,
    notes: data.notes || null,
    
    name_normalized: normalizeName(data.name),
    phone_normalized: normalizePhone(data.phone),
    email_normalized: normalizeEmail(data.email),
    cpf_digits: normalizeCPF(data.cpf),
    cnpj_digits: normalizeCNPJ(data.cnpj),
  };
}
