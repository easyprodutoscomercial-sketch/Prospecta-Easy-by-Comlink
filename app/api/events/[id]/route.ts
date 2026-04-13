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
    if (body.status !== undefined) updates.status = body.status;
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

    const { data: event, error } = await admin
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

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

// DELETE /api/events/[id] — admin only
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

    const { error } = await admin
      .from('events')
      .delete()
      .eq('id', id)
      .eq('organization_id', profile.organization_id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao deletar evento' }, { status: 500 });
  }
}
