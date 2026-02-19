import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/contacts/attachment-counts?ids=uuid1,uuid2,...
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });
    }

    const idsParam = request.nextUrl.searchParams.get('ids');
    if (!idsParam) {
      return NextResponse.json({ counts: {} });
    }

    const contactIds = idsParam.split(',').filter(Boolean).slice(0, 500);
    if (contactIds.length === 0) {
      return NextResponse.json({ counts: {} });
    }

    const admin = getAdminClient();

    const { data: attachments, error } = await admin
      .from('contact_attachments')
      .select('contact_id')
      .eq('organization_id', profile.organization_id)
      .in('contact_id', contactIds);

    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const att of attachments || []) {
      counts[att.contact_id] = (counts[att.contact_id] || 0) + 1;
    }

    return NextResponse.json({ counts });
  } catch (error: any) {
    console.error('Error fetching attachment counts:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
