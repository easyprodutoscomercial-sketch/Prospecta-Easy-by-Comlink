import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/contacts/duplicates - Listar contatos duplicados (apenas admin)
// Detecta duplicados por: 1) cpf_digits, 2) cnpj_digits, 3) phone_normalized
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

    // Group duplicates by cpf_digits, cnpj_digits, phone_normalized (in priority order)
    const groups: { key: string; field: string; label: string; contacts: typeof contacts }[] = [];
    const usedIds = new Set<string>();

    // 1) Group by CPF
    const cpfMap = new Map<string, typeof contacts>();
    for (const c of contacts || []) {
      if (c.cpf_digits && c.cpf_digits.length >= 11) {
        const arr = cpfMap.get(c.cpf_digits) || [];
        arr.push(c);
        cpfMap.set(c.cpf_digits, arr);
      }
    }
    for (const [key, arr] of cpfMap) {
      if (arr.length > 1) {
        groups.push({ key, field: 'cpf', label: `CPF: ${arr[0].cpf || key}`, contacts: arr });
        arr.forEach((c) => usedIds.add(c.id));
      }
    }

    // 2) Group by CNPJ
    const cnpjMap = new Map<string, typeof contacts>();
    for (const c of contacts || []) {
      if (c.cnpj_digits && c.cnpj_digits.length >= 14 && !usedIds.has(c.id)) {
        const arr = cnpjMap.get(c.cnpj_digits) || [];
        arr.push(c);
        cnpjMap.set(c.cnpj_digits, arr);
      }
    }
    for (const [key, arr] of cnpjMap) {
      if (arr.length > 1) {
        groups.push({ key, field: 'cnpj', label: `CNPJ: ${arr[0].cnpj || key}`, contacts: arr });
        arr.forEach((c) => usedIds.add(c.id));
      }
    }

    // 3) Group by phone
    const phoneMap = new Map<string, typeof contacts>();
    for (const c of contacts || []) {
      if (c.phone_normalized && c.phone_normalized.length >= 10 && !usedIds.has(c.id)) {
        const arr = phoneMap.get(c.phone_normalized) || [];
        arr.push(c);
        phoneMap.set(c.phone_normalized, arr);
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
