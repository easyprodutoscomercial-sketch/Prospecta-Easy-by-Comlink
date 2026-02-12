import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { normalizePhone, normalizeCPF, normalizeCNPJ, normalizeEmail, normalizeName } from '@/lib/utils/normalize';

// POST /api/contacts/backfill-normalized - Backfill normalized columns (admin only)
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 });
    }

    const admin = getAdminClient();
    const orgId = profile.organization_id;

    // Fetch all contacts from this org
    const { data: contacts, error } = await admin
      .from('contacts')
      .select('id, name, phone, email, cpf, cnpj, phone_normalized, email_normalized, cpf_digits, cnpj_digits, name_normalized')
      .eq('organization_id', orgId);

    if (error) throw error;

    let updated = 0;

    for (const c of contacts || []) {
      const updates: Record<string, string | null> = {};

      const phoneNorm = normalizePhone(c.phone);
      if (phoneNorm && !c.phone_normalized) updates.phone_normalized = phoneNorm;

      const emailNorm = normalizeEmail(c.email);
      if (emailNorm && !c.email_normalized) updates.email_normalized = emailNorm;

      const cpfNorm = normalizeCPF(c.cpf);
      if (cpfNorm && !c.cpf_digits) updates.cpf_digits = cpfNorm;

      const cnpjNorm = normalizeCNPJ(c.cnpj);
      if (cnpjNorm && !c.cnpj_digits) updates.cnpj_digits = cnpjNorm;

      const nameNorm = normalizeName(c.name);
      if (nameNorm && !c.name_normalized) updates.name_normalized = nameNorm;

      if (Object.keys(updates).length > 0) {
        await admin.from('contacts').update(updates).eq('id', c.id);
        updated++;
      }
    }

    return NextResponse.json({ message: `Backfill completo. ${updated} contatos atualizados de ${(contacts || []).length} total.`, updated, total: (contacts || []).length });
  } catch (error: any) {
    console.error('Error backfilling:', error);
    return NextResponse.json({ error: error.message || 'Erro no backfill' }, { status: 500 });
  }
}
