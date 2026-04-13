import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id]/delete-preview
//
// Retorna contagem dos registros que serao apagados em cascata se o evento
// for deletado. Usado pelo modal "digite o nome" pro admin ver o estrago
// antes de confirmar.
//
// NAO precisa ser admin — e so leitura. O gate de admin e na hora do DELETE.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile nao encontrado' }, { status: 404 });

    const admin = getAdminClient();

    const { data: event } = await admin
      .from('events')
      .select('id, name')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento nao encontrado' }, { status: 404 });
    }

    // Conta tudo que vai cair pelo cascade
    const [booths, visits, contacts] = await Promise.all([
      admin
        .from('event_booths')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id)
        .eq('organization_id', profile.organization_id),
      admin
        .from('booth_visits')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id)
        .eq('organization_id', profile.organization_id),
      admin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', id)
        .eq('organization_id', profile.organization_id),
    ]);

    // Ids dos contatos pra contar filhos deles
    const { data: contactRows } = await admin
      .from('contacts')
      .select('id, valor_estimado, temperatura')
      .eq('event_id', id)
      .eq('organization_id', profile.organization_id);

    const contactIds = (contactRows || []).map((c: any) => c.id);

    let interactionsCount = 0;
    let meetingsCount = 0;
    let attachmentsCount = 0;
    if (contactIds.length > 0) {
      const [intR, meetR, attR] = await Promise.all([
        admin
          .from('interactions')
          .select('id', { count: 'exact', head: true })
          .in('contact_id', contactIds),
        admin
          .from('meetings')
          .select('id', { count: 'exact', head: true })
          .in('contact_id', contactIds),
        admin
          .from('contact_attachments')
          .select('id', { count: 'exact', head: true })
          .in('contact_id', contactIds),
      ]);
      interactionsCount = intR.count || 0;
      meetingsCount = meetR.count || 0;
      attachmentsCount = attR.count || 0;
    }

    // Deals com valor
    const totalValue = (contactRows || []).reduce((sum: number, c: any) => {
      return sum + (Number(c.valor_estimado) || 0);
    }, 0);
    const highValueCount = (contactRows || []).filter((c: any) => Number(c.valor_estimado) > 0).length;
    const hotLeadsCount = (contactRows || []).filter((c: any) => c.temperatura === 'QUENTE').length;

    return NextResponse.json({
      event_id: event.id,
      event_name: event.name,
      counts: {
        booths: booths.count || 0,
        visits: visits.count || 0,
        contacts: contacts.count || 0,
        interactions: interactionsCount,
        meetings: meetingsCount,
        attachments: attachmentsCount,
        high_value_deals: highValueCount,
        hot_leads: hotLeadsCount,
        total_value: totalValue,
      },
    });
  } catch (error: any) {
    console.error('[delete-preview event] error:', error);
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}
