import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { normalizePhone, normalizeCPF, normalizeCNPJ } from '@/lib/utils/normalize';

// GET /api/contacts/duplicates - Listar contatos duplicados (apenas admin)
// Detecta duplicados por: 1) CPF, 2) CNPJ, 3) Telefone
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem acessar' }, { status: 403 });
    }

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Fetch all contacts with relevant fields
    const { data: contacts, error } = await admin
      .from('contacts')
      .select('id, name, email, phone, cpf, cnpj, company, cpf_digits, cnpj_digits, phone_normalized, status, created_at, assigned_to_user_id')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ groups: [], totalDuplicates: 0 });
    }

    // Normalize on-the-fly for contacts that may have NULL normalized columns
    const normalized = contacts.map((c) => ({
      ...c,
      _cpf: c.cpf_digits || normalizeCPF(c.cpf),
      _cnpj: c.cnpj_digits || normalizeCNPJ(c.cnpj),
      _phone: c.phone_normalized || normalizePhone(c.phone),
    }));

    // Group duplicates by cpf, cnpj, phone (in priority order)
    const groups: { key: string; field: string; label: string; contacts: typeof contacts }[] = [];
    const usedIds = new Set<string>();

    // 1) Group by CPF
    const cpfMap = new Map<string, typeof normalized>();
    for (const c of normalized) {
      if (c._cpf && c._cpf.length >= 11) {
        const arr = cpfMap.get(c._cpf) || [];
        arr.push(c);
        cpfMap.set(c._cpf, arr);
      }
    }
    for (const [key, arr] of cpfMap) {
      if (arr.length > 1) {
        groups.push({ key, field: 'cpf', label: `CPF: ${arr[0].cpf || key}`, contacts: arr });
        arr.forEach((c) => usedIds.add(c.id));
      }
    }

    // 2) Group by CNPJ
    const cnpjMap = new Map<string, typeof normalized>();
    for (const c of normalized) {
      if (c._cnpj && c._cnpj.length >= 14 && !usedIds.has(c.id)) {
        const arr = cnpjMap.get(c._cnpj) || [];
        arr.push(c);
        cnpjMap.set(c._cnpj, arr);
      }
    }
    for (const [key, arr] of cnpjMap) {
      if (arr.length > 1) {
        groups.push({ key, field: 'cnpj', label: `CNPJ: ${arr[0].cnpj || key}`, contacts: arr });
        arr.forEach((c) => usedIds.add(c.id));
      }
    }

    // 3) Group by phone
    const phoneMap = new Map<string, typeof normalized>();
    for (const c of normalized) {
      if (c._phone && c._phone.length >= 10 && !usedIds.has(c.id)) {
        const arr = phoneMap.get(c._phone) || [];
        arr.push(c);
        phoneMap.set(c._phone, arr);
      }
    }
    for (const [key, arr] of phoneMap) {
      if (arr.length > 1) {
        groups.push({ key, field: 'phone', label: `Telefone: ${arr[0].phone || key}`, contacts: arr });
      }
    }

    return NextResponse.json({ groups, totalDuplicates: groups.reduce((sum, g) => sum + g.contacts.length - 1, 0) });
  } catch (error: any) {
    console.error('Error listing duplicates:', error);
    return NextResponse.json({ error: error.message || 'Erro ao listar duplicados' }, { status: 500 });
  }
}
