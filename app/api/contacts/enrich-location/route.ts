import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { DDD_TO_LOCATION, extractDDD } from '@/lib/data/brazil-ddd';

// POST /api/contacts/enrich-location
// Enriches contacts that have phone but no cidade/estado using DDD mapping
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const admin = getAdminClient();
    const profile = await ensureProfile(supabase, user);
    if (!profile) {
      return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const pipelineId = body.pipeline_id;

    // Fetch contacts without cidade/estado but with phone
    let query = admin
      .from('contacts')
      .select('id, phone_normalized, phone, whatsapp')
      .eq('organization_id', profile.organization_id)
      .is('cidade', null)
      .not('phone_normalized', 'is', null);

    if (pipelineId) {
      query = query.eq('pipeline_id', pipelineId);
    }

    const { data: contacts, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        enriched: 0,
        not_found: 0,
        message: 'Nenhum contato sem localização encontrado',
      });
    }

    let enriched = 0;
    let notFound = 0;
    const batchSize = 50;

    // Group contacts by DDD location for batch updates
    const updatesByLocation: Record<string, string[]> = {};

    for (const contact of contacts) {
      const phoneDigits = contact.phone_normalized;
      if (!phoneDigits) { notFound++; continue; }

      const ddd = extractDDD(phoneDigits);
      if (!ddd) { notFound++; continue; }

      const location = DDD_TO_LOCATION[ddd];
      if (!location) { notFound++; continue; }

      const key = `${location.cidade}|${location.estado}`;
      if (!updatesByLocation[key]) updatesByLocation[key] = [];
      updatesByLocation[key].push(contact.id);
    }

    // Batch update by location group
    for (const [key, ids] of Object.entries(updatesByLocation)) {
      const [cidade, estado] = key.split('|');

      // Update in chunks
      for (let i = 0; i < ids.length; i += batchSize) {
        const chunk = ids.slice(i, i + batchSize);
        const { error: updateError } = await admin
          .from('contacts')
          .update({ cidade, estado })
          .in('id', chunk);

        if (updateError) {
          console.error(`Error updating chunk for ${cidade}-${estado}:`, updateError);
        } else {
          enriched += chunk.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      total: contacts.length,
      enriched,
      not_found: notFound,
      message: `${enriched} contatos atualizados com localização via DDD`,
    });

  } catch (error: any) {
    console.error('Error enriching contacts location:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao enriquecer localização' },
      { status: 500 }
    );
  }
}
