import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { ensureProfile } from '@/lib/ensure-profile';

// GET /api/events/[id] — get event detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();

    const { data: event, error } = await admin
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (error || !event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    // Get booth counts
    const { data: booths } = await admin
      .from('event_booths')
      .select('id, status')
      .eq('event_id', id);

    event.booth_count = (booths || []).length;
    event.visited_count = (booths || []).filter((b: any) => b.status === 'VISITADO').length;

    return NextResponse.json(event);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro' }, { status: 500 });
  }
}

// PUT /api/events/[id] — update event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();
    const contentType = request.headers.get('content-type') || '';

    let body: any = {};
    let coverFile: File | null = null;
    let mapFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      // Extract text fields
      for (const [key, value] of formData.entries()) {
        if (key === 'cover_image' && value instanceof File) {
          coverFile = value;
        } else if (key === 'map_image' && value instanceof File) {
          mapFile = value;
        } else if (typeof value === 'string') {
          body[key] = value;
        }
      }
    } else {
      body = await request.json();
    }

    // Verify event belongs to org (and capture current pipeline/stage for migration)
    const { data: existing } = await admin
      .from('events')
      .select('id, pipeline_id, stage_id')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.location !== undefined) updates.location = body.location;
    if (body.start_date !== undefined) updates.start_date = body.start_date;
    if (body.end_date !== undefined) updates.end_date = body.end_date;
    if (body.map_url !== undefined) updates.map_url = body.map_url;
    if (body.pipeline_id !== undefined) updates.pipeline_id = body.pipeline_id || null;
    if (body.stage_id !== undefined) updates.stage_id = body.stage_id || null;
    if (body.status !== undefined) {
      if (profile.role !== 'admin') {
        return NextResponse.json(
          { error: 'Apenas administradores podem ativar ou encerrar eventos' },
          { status: 403 }
        );
      }
      updates.status = body.status;
    }
    if (body.cover_image_url !== undefined) updates.cover_image_url = body.cover_image_url;

    // Upload cover image if provided
    if (coverFile && coverFile.size > 0) {
      const ext = coverFile.name.split('.').pop() || 'jpg';
      const safeName = `${Date.now()}-cover-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filePath = `${profile.organization_id}/events/${id}/${safeName}`;
      const buffer = Buffer.from(await coverFile.arrayBuffer());
      const { error: uploadErr } = await admin.storage
        .from('attachments')
        .upload(filePath, buffer, { contentType: coverFile.type || 'image/jpeg' });
      if (!uploadErr) {
        const { data: urlData } = admin.storage.from('attachments').getPublicUrl(filePath);
        updates.cover_image_url = urlData.publicUrl;
      }
    }

    // Upload map image (planta do evento) if provided
    if (mapFile && mapFile.size > 0) {
      const ext = mapFile.name.split('.').pop() || 'jpg';
      const safeName = `${Date.now()}-map-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const filePath = `${profile.organization_id}/events/${id}/${safeName}`;
      const buffer = Buffer.from(await mapFile.arrayBuffer());
      const { error: uploadErr } = await admin.storage
        .from('attachments')
        .upload(filePath, buffer, { contentType: mapFile.type || 'image/jpeg' });
      if (!uploadErr) {
        const { data: urlData } = admin.storage.from('attachments').getPublicUrl(filePath);
        updates.map_url = urlData.publicUrl;
      }
    }

    // Allow explicit removal of the map
    if (body.map_image_remove === 'true' || body.map_image_remove === true) {
      updates.map_url = null;
    }

    // Detecta transi\u00e7\u00e3o pra ENCERRADO pra gerar snapshot auto depois.
    const becameEncerrado =
      updates.status === 'ENCERRADO' &&
      (existing as any).status !== 'ENCERRADO';

    const { data: event, error } = await admin
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Auto-snapshot ao encerrar o evento. Fire-and-forget: se falhar, loga
    // mas nao trava o PUT (o evento ja foi atualizado).
    if (becameEncerrado) {
      try {
        const origin = request.nextUrl.origin;
        // Repasse o cookie de auth pra chamada interna ficar autenticada.
        const cookieHeader = request.headers.get('cookie') || '';
        await fetch(`${origin}/api/events/${id}/snapshot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            cookie: cookieHeader,
          },
          body: JSON.stringify({ trigger: 'auto_encerrado' }),
        }).catch((e) => console.error('[encerrar] snapshot fetch failed:', e));
      } catch (e) {
        console.error('[encerrar] snapshot error:', e);
      }
    }

    // If pipeline_id or stage_id changed, migrate all contacts linked to this event
    const pipelineChanged = updates.pipeline_id !== undefined && updates.pipeline_id !== existing.pipeline_id;
    const stageChanged = updates.stage_id !== undefined && updates.stage_id !== existing.stage_id;

    if (pipelineChanged || stageChanged) {
      const contactUpdates: any = {};
      if (pipelineChanged) contactUpdates.pipeline_id = updates.pipeline_id;
      if (stageChanged) contactUpdates.stage_id = updates.stage_id;

      // Primary path: contacts.event_id = this event (covers primary + extras after migration)
      await admin
        .from('contacts')
        .update(contactUpdates)
        .eq('organization_id', profile.organization_id)
        .eq('event_id', id);

      // Legacy fallback: older contacts (before event_id existed) linked via booth_visits.contact_id
      const { data: visitsWithContacts } = await admin
        .from('booth_visits')
        .select('contact_id')
        .eq('event_id', id)
        .eq('organization_id', profile.organization_id)
        .not('contact_id', 'is', null);

      const legacyContactIds = Array.from(
        new Set((visitsWithContacts || []).map((v: any) => v.contact_id).filter(Boolean))
      );

      if (legacyContactIds.length > 0) {
        await admin
          .from('contacts')
          .update(contactUpdates)
          .in('id', legacyContactIds)
          .eq('organization_id', profile.organization_id);
      }
    }

    return NextResponse.json(event);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao atualizar evento' }, { status: 500 });
  }
}

// DELETE /api/events/[id] — hard delete em cascata. Admin-only.
//
// Fluxo:
//  1. Valida admin
//  2. Gera snapshot pre-dele\u00e7\u00e3o (protecao contra erro humano — depois do
//     delete, o snapshot fica orfao mas preservado em event_snapshots)
//  3. Limpa arquivos do Storage (o banco nao limpa sozinho)
//  4. DELETE na tabela — o banco cascade apaga event_booths, booth_visits,
//     contacts (event_id CASCADE), e tudo que depende dos contatos
//     (interactions, meetings, attachments, lead_score_history, etc)
//  5. Grava audit_log
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const profile = await ensureProfile(supabase, user);
    if (!profile) return NextResponse.json({ error: 'Profile não encontrado' }, { status: 404 });

    const admin = getAdminClient();

    // Check admin role
    let role = profile.role;
    if (!role) {
      const { data: firstUser } = await admin
        .from('profiles')
        .select('user_id')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      role = (firstUser && firstUser.user_id === profile.user_id) ? 'admin' : 'user';
    }
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem excluir eventos' }, { status: 403 });
    }

    // Busca evento pra pegar metadata do audit
    const { data: event } = await admin
      .from('events')
      .select('id, name, status')
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Evento nao encontrado' }, { status: 404 });
    }

    // 1) Gera snapshot pre-delecao pra preservar historico (fire-and-forget).
    try {
      const origin = request.nextUrl.origin;
      const cookieHeader = request.headers.get('cookie') || '';
      await fetch(`${origin}/api/events/${id}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({ trigger: 'manual' }),
      }).catch((e) => console.error('[delete] pre-snapshot failed:', e));
    } catch (e) {
      console.error('[delete] pre-snapshot error:', e);
    }

    // 2) Conta filhos pra gravar no audit antes do delete
    const [boothsR, visitsR, contactsR] = await Promise.all([
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

    // 3) Limpa arquivos do Storage (pasta do evento).
    // O banco nao limpa Storage — precisa manual. Lista todos os files
    // em attachments/{org}/events/{id}/* e apaga em batch.
    try {
      const folder = `${profile.organization_id}/events/${id}`;
      const { data: files } = await admin.storage
        .from('attachments')
        .list(folder, { limit: 1000 });
      if (files && files.length > 0) {
        const paths = files.map((f) => `${folder}/${f.name}`);
        await admin.storage.from('attachments').remove(paths);
      }
    } catch (e) {
      console.error('[delete] storage cleanup failed:', e);
      // Segue mesmo assim — o delete do evento tem prioridade.
    }

    // 4) DELETE em cascata (o banco faz o trabalho)
    const { error } = await admin
      .from('events')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) throw error;

    // 5) Audit log
    try {
      await admin.from('audit_log').insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        user_name: profile.name || 'Sem nome',
        entity: 'event',
        entity_id: id,
        action: 'delete',
        old_values: { name: event.name, status: event.status },
        metadata: {
          cascade_booths: boothsR.count || 0,
          cascade_visits: visitsR.count || 0,
          cascade_contacts: contactsR.count || 0,
        },
      });
    } catch (e) {
      console.error('[delete] audit log failed:', e);
    }

    return NextResponse.json({
      ok: true,
      deleted: {
        event_name: event.name,
        booths: boothsR.count || 0,
        visits: visitsR.count || 0,
        contacts: contactsR.count || 0,
      },
    });
  } catch (error: any) {
    console.error('[delete event] error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao deletar evento' }, { status: 500 });
  }
}
